import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  type Pigment,
  type GamutMix,
  type CalculatedRegion,
  type Point,
  createMasterPigments,
  buildAchievableGamut,
  findClosestGamutMix,
  rgbToLab,
  deltaE,
} from '../utils/pigmentEngine';
import {
  Palette,
  Upload,
  Check,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const PaletteStudio: React.FC = () => {
  // Master Pigments State
  const [pigments, setPigments] = useState<Pigment[]>(() => createMasterPigments());
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Active Tool & Mask State
  const [activeTool, setActiveTool] = useState<'eyedropper' | 'freehand' | 'poly'>('eyedropper');
  const [isOverlayVisible, setIsOverlayVisible] = useState<boolean>(true);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(70);
  const [soloRegionIndex, setSoloRegionIndex] = useState<number | null>(null);

  // Canvas Refs
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Image & Mask Data
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [hasImage, setHasImage] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const maskPolygonRef = useRef<Point[] | null>(null);
  const [hasActiveMask, setHasActiveMask] = useState<boolean>(false);

  // Calculation Results
  const [activeGamut, setActiveGamut] = useState<GamutMix[]>([]);
  const [calculatedRegions, setCalculatedRegions] = useState<CalculatedRegion[]>([]);
  const [sampledColor, setSampledColor] = useState<{
    hex: string;
    recipeText: string;
    deltaE: number;
  }>({
    hex: '#------',
    recipeText: 'Hover or click over the canvas to inspect formulation',
    deltaE: 0,
  });
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Drawing State for Lasso & Poly
  const isDrawingRef = useRef<boolean>(false);
  const polyPointsRef = useRef<Point[]>([]);

  const activeTubesCount = pigments.filter((p) => p.active).length;

  // Find which pigments are actually used in the dominant regions
  const requiredPigmentIds = new Set<string>();
  calculatedRegions.forEach((r) => {
    r.parts.forEach((p) => {
      if (p.ratio > 0) {
        requiredPigmentIds.add(p.pigment.id);
      }
    });
  });
  const requiredPigments = pigments.filter((p) => requiredPigmentIds.has(p.id));

  // --- Helper: Convert Event to Canvas Coordinates ---
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.floor((e.clientX - rect.left) * scaleX),
      y: Math.floor((e.clientY - rect.top) * scaleY),
    };
  };

  // --- Render Active Mask Lines on drawCanvas ---
  const redrawMaskGuide = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (maskPolygonRef.current && maskPolygonRef.current.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      maskPolygonRef.current.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // --- Analysis & Gamut Projection ---
  const runAnalysis = useCallback(() => {
    if (!imageRef.current || !baseCanvasRef.current || !overlayCanvasRef.current) return;
    const baseCanvas = baseCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
    const overlayCtx = overlayCanvas.getContext('2d', { willReadFrequently: true });
    if (!baseCtx || !overlayCtx) return;

    const activePigs = pigments.filter((p) => p.active);
    if (activePigs.length === 0) {
      setCalculatedRegions([]);
      setActiveGamut([]);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      return;
    }

    // 1. Build achievable gamut
    const gamut = buildAchievableGamut(activePigs);
    setActiveGamut(gamut);

    // 2. Downsample for fast spatial clustering
    const W = 140;
    const H = Math.max(20, Math.floor((baseCanvas.height / (baseCanvas.width || 1)) * W));
    const offCanvas = document.createElement('canvas');
    offCanvas.width = W;
    offCanvas.height = H;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(baseCanvas, 0, 0, W, H);
    const imgData = offCtx.getImageData(0, 0, W, H);
    const pixels = imgData.data;

    // 3. Mask tester
    let maskFn = (_idx: number) => true;
    if (maskPolygonRef.current && maskPolygonRef.current.length > 2) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = W;
      maskCanvas.height = H;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        const scaleX = W / baseCanvas.width;
        const scaleY = H / baseCanvas.height;
        mCtx.beginPath();
        maskPolygonRef.current.forEach((pt, i) => {
          if (i === 0) mCtx.moveTo(pt.x * scaleX, pt.y * scaleY);
          else mCtx.lineTo(pt.x * scaleX, pt.y * scaleY);
        });
        mCtx.closePath();
        mCtx.fill();
        const maskData = mCtx.getImageData(0, 0, W, H).data;
        maskFn = (idx: number) => maskData[idx * 4 + 3] > 0;
      }
    }

    // 4. Project masked pixels into achievable physical space
    const projectedPixels: GamutMix[] = [];
    for (let i = 0; i < W * H; i++) {
      const pIdx = i * 4;
      if (maskFn(i)) {
        const r = pixels[pIdx];
        const g = pixels[pIdx + 1];
        const b = pixels[pIdx + 2];
        const closest = findClosestGamutMix(r, g, b, gamut);
        projectedPixels.push(closest);
      }
    }

    if (projectedPixels.length === 0) {
      setCalculatedRegions([]);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      return;
    }

    // 5. K-Means clustering (k = 5) in Lab space
    const k = Math.min(5, gamut.length);
    const centroids: [number, number, number][] = [];
    for (let i = 0; i < k; i++) {
      const randomPix = projectedPixels[Math.floor(Math.random() * projectedPixels.length)];
      centroids.push([...randomPix.lab]);
    }

    for (let iter = 0; iter < 6; iter++) {
      const clusters: GamutMix[][] = Array.from({ length: k }, () => []);
      for (const p of projectedPixels) {
        let minD = Infinity;
        let bestC = 0;
        for (let c = 0; c < k; c++) {
          const d = deltaE(p.lab, centroids[c]);
          if (d < minD) {
            minD = d;
            bestC = c;
          }
        }
        clusters[bestC].push(p);
      }

      for (let c = 0; c < k; c++) {
        if (clusters[c].length === 0) continue;
        let sumL = 0,
          sumA = 0,
          sumB = 0;
        for (const p of clusters[c]) {
          sumL += p.lab[0];
          sumA += p.lab[1];
          sumB += p.lab[2];
        }
        centroids[c] = [
          sumL / clusters[c].length,
          sumA / clusters[c].length,
          sumB / clusters[c].length,
        ];
      }
    }

    // Map cluster centroids back to closest achievable recipes
    const newRegions: CalculatedRegion[] = centroids.map((cLab, idx) => {
      let best = gamut[0];
      let minD = Infinity;
      for (const g of gamut) {
        const d = deltaE(cLab, g.lab);
        if (d < minD) {
          minD = d;
          best = g;
        }
      }
      return {
        regionIndex: idx,
        hex: best.hex,
        rgb: [best.r, best.g, best.b],
        lab: best.lab,
        parts: best.parts,
        count: 0,
      };
    });

    // Sort regions by lightness (L)
    newRegions.sort((a, b) => b.lab[0] - a.lab[0]);
    setCalculatedRegions(newRegions);

    // 6. Paint Overlay Canvas
    overlayCanvas.width = baseCanvas.width;
    overlayCanvas.height = baseCanvas.height;

    const fullW = baseCanvas.width;
    const fullH = baseCanvas.height;
    const fullData = baseCtx.getImageData(0, 0, fullW, fullH);
    const outImg = overlayCtx.createImageData(fullW, fullH);

    for (let y = 0; y < fullH; y++) {
      for (let x = 0; x < fullW; x++) {
        const outIdx = (y * fullW + x) * 4;
        const r = fullData.data[outIdx];
        const g = fullData.data[outIdx + 1];
        const b = fullData.data[outIdx + 2];
        const a = fullData.data[outIdx + 3];

        if (a === 0) continue;

        const targetLab = rgbToLab(r, g, b);
        let bestRegion = newRegions[0];
        let minD = Infinity;

        for (let regIdx = 0; regIdx < newRegions.length; regIdx++) {
          const reg = newRegions[regIdx];
          const d = deltaE(targetLab, reg.lab);
          if (d < minD) {
            minD = d;
            bestRegion = reg;
          }
        }

        if (soloRegionIndex !== null && bestRegion.regionIndex !== soloRegionIndex) {
          outImg.data[outIdx] = Math.round(r * 0.15);
          outImg.data[outIdx + 1] = Math.round(g * 0.15);
          outImg.data[outIdx + 2] = Math.round(b * 0.15);
          outImg.data[outIdx + 3] = 230;
        } else {
          outImg.data[outIdx] = bestRegion.rgb[0];
          outImg.data[outIdx + 1] = bestRegion.rgb[1];
          outImg.data[outIdx + 2] = bestRegion.rgb[2];
          outImg.data[outIdx + 3] = 255;
        }
      }
    }

    overlayCtx.putImageData(outImg, 0, 0);
  }, [pigments, soloRegionIndex]);

  // Re-run analysis when pigments or solo region changes
  useEffect(() => {
    if (hasImage) {
      runAnalysis();
    }
  }, [pigments, soloRegionIndex, runAnalysis, hasImage]);

  // --- Load Image File ---
  const handleImageFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setHasImage(true);

        const baseCanvas = baseCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        const drawCanvas = drawCanvasRef.current;

        if (baseCanvas && overlayCanvas && drawCanvas) {
          [baseCanvas, overlayCanvas, drawCanvas].forEach((c) => {
            c.width = img.width;
            c.height = img.height;
          });

          const ctx = baseCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
          }

          maskPolygonRef.current = null;
          setHasActiveMask(false);
          polyPointsRef.current = [];
          setSoloRegionIndex(null);

          const drawCtx = drawCanvas.getContext('2d');
          if (drawCtx) {
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
          }

          runAnalysis();
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- Drag and Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  // --- Eyedropper Live Sampler ---
  const handleEyedropper = (pt: Point) => {
    const baseCanvas = baseCanvasRef.current;
    if (!baseCanvas) return;
    const ctx = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (pt.x < 0 || pt.x >= baseCanvas.width || pt.y < 0 || pt.y >= baseCanvas.height) return;

    const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
    const hex =
      '#' +
      ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);

    if (activeGamut.length === 0) {
      setSampledColor({
        hex: hex.toUpperCase(),
        recipeText: 'No pigments active in palette',
        deltaE: 0,
      });
      return;
    }

    const closest = findClosestGamutMix(pixel[0], pixel[1], pixel[2], activeGamut);
    const partsDesc = closest.parts
      .map((p) => `${p.ratio} parts ${p.pigment.name}`)
      .join(' + ');

    setSampledColor({
      hex: hex.toUpperCase(),
      recipeText: partsDesc || 'Pure Pigment',
      deltaE: closest.deltaE ?? 0,
    });
  };

  // --- Mouse / Pointer Event Handlers for Canvas ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasImage) return;
    const pt = getCanvasCoords(e);

    if (activeTool === 'eyedropper') {
      handleEyedropper(pt);
    } else if (activeTool === 'freehand') {
      isDrawingRef.current = true;
      maskPolygonRef.current = [pt];
    } else if (activeTool === 'poly') {
      if (polyPointsRef.current.length > 2) {
        const origin = polyPointsRef.current[0];
        const dist = Math.hypot(pt.x - origin.x, pt.y - origin.y);
        if (dist < 15) {
          maskPolygonRef.current = [...polyPointsRef.current];
          polyPointsRef.current = [];
          finalizeMask();
          return;
        }
      }
      polyPointsRef.current.push(pt);
      renderPolyPreview();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasImage) return;
    const pt = getCanvasCoords(e);

    if (activeTool === 'eyedropper') {
      handleEyedropper(pt);
    } else if (activeTool === 'freehand' && isDrawingRef.current && maskPolygonRef.current) {
      maskPolygonRef.current.push(pt);
      redrawMaskGuide();
    } else if (activeTool === 'poly' && polyPointsRef.current.length > 0) {
      renderPolyPreview(pt);
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'freehand' && isDrawingRef.current) {
      isDrawingRef.current = false;
      if (maskPolygonRef.current && maskPolygonRef.current.length > 5) {
        finalizeMask();
      } else {
        maskPolygonRef.current = null;
        setHasActiveMask(false);
        redrawMaskGuide();
      }
    }
  };

  const handleDoubleClick = () => {
    if (activeTool === 'poly' && polyPointsRef.current.length > 2) {
      maskPolygonRef.current = [...polyPointsRef.current];
      polyPointsRef.current = [];
      finalizeMask();
    }
  };

  const renderPolyPreview = (cursorPt: Point | null = null) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawMaskGuide();

    if (polyPointsRef.current.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    polyPointsRef.current.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    if (cursorPt) ctx.lineTo(cursorPt.x, cursorPt.y);
    ctx.stroke();

    // Draw anchor points
    polyPointsRef.current.forEach((p) => {
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  const finalizeMask = () => {
    setHasActiveMask(true);
    redrawMaskGuide();
    setActiveTool('eyedropper');
    runAnalysis();
  };

  const clearMask = () => {
    maskPolygonRef.current = null;
    polyPointsRef.current = [];
    setHasActiveMask(false);
    redrawMaskGuide();
    if (hasImage) {
      runAnalysis();
    }
  };

  // --- Palette Drawer Preset Actions ---
  const handleTogglePigment = (id: string) => {
    setPigments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  const handleSelectAllPigments = () => {
    setPigments((prev) => prev.map((p) => ({ ...p, active: true })));
  };

  const handleDeselectAllPigments = () => {
    setPigments((prev) => prev.map((p) => ({ ...p, active: false })));
  };

  const handleApplyZornPalette = () => {
    const zornIds = ['pw6', 'py43', 'pr108_m', 'pbk9'];
    setPigments((prev) =>
      prev.map((p) => ({ ...p, active: zornIds.includes(p.id) }))
    );
  };

  const handleApplyBlueBlackPreset = () => {
    const ids = ['pw6', 'pb35', 'pbk9'];
    setPigments((prev) => prev.map((p) => ({ ...p, active: ids.includes(p.id) })));
  };

  // --- Download & Copy Actions ---
  const handleDownloadRender = () => {
    if (!baseCanvasRef.current) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = baseCanvasRef.current.width;
    tempCanvas.height = baseCanvasRef.current.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(baseCanvasRef.current, 0, 0);
    if (isOverlayVisible && overlayCanvasRef.current) {
      ctx.globalAlpha = overlayOpacity / 100;
      ctx.drawImage(overlayCanvasRef.current, 0, 0);
      ctx.globalAlpha = 1.0;
    }

    const dataUrl = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'palette-gamut-study.png';
    a.click();
  };

  const handleCopyRecipes = () => {
    if (calculatedRegions.length === 0) return;
    const summaryLines = [
      '🎨 Physical Palette & Pigment Recipes:',
      '',
      `Paints to Squeeze (${requiredPigments.length} tubes):`,
      ...requiredPigments.map((p) => ` - ${p.name} (${p.code})`),
      '',
      'Physical Color Region Recipes:',
      ...calculatedRegions.map(
        (r, i) =>
          `Region #${i + 1} (${r.hex}): ${r.parts
            .map((p) => `${p.ratio} parts ${p.pigment.name}`)
            .join(' + ')}`
      ),
    ];
    navigator.clipboard.writeText(summaryLines.join('\n'));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] flex-shrink-0 animate-pulse"></span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Physical Palette & Pigment Recipe Studio
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                v0.3 Gamut-Constrained
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Subtractive Kubelka-Munk pigment matching, ROI region masking, and studio tube recipes
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Inventory Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-2 shadow-sm"
          >
            <Palette className="w-4 h-4 text-amber-400" />
            <span>Studio Palette:</span>
            <span className="font-bold text-amber-400">{activeTubesCount}</span>
            <span className="text-slate-400 text-[11px]">Tubes</span>
            {isDrawerOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            )}
          </button>

          {/* Upload Button */}
          <label className="text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 cursor-pointer transition shadow-md flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>Upload Reference Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleImageFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Studio Pigment Inventory Drawer (Collapsible) */}
      {isDrawerOpen && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl transition-all animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <span>Studio Pigment Inventory (What Paints You Have)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Formulations and achievable gamut regions are strictly restricted to the paints checked below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyZornPalette}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition font-medium"
              >
                Zorn Palette (4)
              </button>
              <button
                type="button"
                onClick={handleApplyBlueBlackPreset}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition font-medium"
              >
                Cerulean + Black (3)
              </button>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <button
                type="button"
                onClick={handleSelectAllPigments}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-slate-700">|</span>
              <button
                type="button"
                onClick={handleDeselectAllPigments}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs max-h-72 overflow-y-auto pr-1">
            {pigments.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer select-none border transition ${
                  p.active
                    ? 'bg-slate-800/90 border-slate-700 text-slate-100 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-500 hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={() => handleTogglePigment(p.id)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0 accent-amber-500 w-4 h-4 cursor-pointer"
                />
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-600/80 flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: p.hex }}
                ></span>
                <div className="truncate">
                  <div className="truncate font-medium text-xs">{p.name}</div>
                  <div className="text-[10px] font-mono text-slate-400">{p.code}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Main Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Canvas Viewport & Mask Controls */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Toolbar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
            {/* Selection Tools */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-semibold mr-1">Tool:</span>
              <button
                type="button"
                onClick={() => setActiveTool('eyedropper')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTool === 'eyedropper'
                    ? 'border border-amber-500/50 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border border-slate-800 bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🔍 Eyedropper
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('freehand')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTool === 'freehand'
                    ? 'border border-amber-500/50 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border border-slate-800 bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ✏️ Freehand Lasso
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('poly')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTool === 'poly'
                    ? 'border border-amber-500/50 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border border-slate-800 bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📐 Polygon Lasso
              </button>
              {hasActiveMask && (
                <button
                  type="button"
                  onClick={clearMask}
                  className="px-3 py-1.5 rounded-lg font-medium border border-red-900/50 bg-red-950/40 text-red-400 hover:bg-red-900/60 transition flex items-center gap-1"
                >
                  ✕ Clear Mask
                </button>
              )}
            </div>

            {/* Overlay & Opacity Slider */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={isOverlayVisible}
                  onChange={(e) => setIsOverlayVisible(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0 accent-amber-500"
                />
                <span>Gamut Overlay</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseInt(e.target.value, 10))}
                  className="w-20 accent-amber-500 cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-400 w-8">{overlayOpacity}%</span>
              </div>
            </div>
          </div>

          {/* Canvas Viewport Frame */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl min-h-[480px]">
            <div
              ref={containerRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex-1 bg-slate-950 rounded-xl border flex items-center justify-center overflow-hidden transition-colors min-h-[400px] ${
                isDraggingFile
                  ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500'
                  : 'border-slate-800'
              }`}
            >
              <canvas
                ref={baseCanvasRef}
                className="max-w-full max-h-[560px] object-contain rounded-lg"
              />
              <canvas
                ref={overlayCanvasRef}
                style={{
                  display: isOverlayVisible ? 'block' : 'none',
                  opacity: overlayOpacity / 100,
                }}
                className="absolute max-w-full max-h-[560px] object-contain pointer-events-none rounded-lg"
              />
              <canvas
                ref={drawCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                className="absolute max-w-full max-h-[560px] object-contain cursor-crosshair rounded-lg"
              />

              {/* Empty State Prompt */}
              {!hasImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-3">
                    <Palette className="w-8 h-8 text-amber-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Drag & drop your reference photo here
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    or use the top button to browse. The studio will calculate your paint recipes
                    and gamut constraints.
                  </p>
                </div>
              )}
            </div>

            {/* Sampled Spot Card */}
            <div className="mt-3 p-3 bg-slate-950/90 rounded-xl border border-slate-800/90 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-slate-700 shadow-inner flex-shrink-0"
                  style={{ backgroundColor: sampledColor.hex !== '#------' ? sampledColor.hex : '#334155' }}
                ></div>
                <div>
                  <div className="text-[11px] font-bold text-slate-200">Sampled Target</div>
                  <div className="text-xs font-mono text-slate-400">{sampledColor.hex}</div>
                </div>
              </div>

              <div className="flex-1 text-right truncate">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Achievable Mix Formulation:
                </div>
                <div className="text-xs font-semibold text-amber-400 truncate mt-0.5">
                  {sampledColor.recipeText}
                  {sampledColor.hex !== '#------' && sampledColor.deltaE > 0 && (
                    <span className="text-slate-500 font-normal ml-1">
                      (ΔE {sampledColor.deltaE.toFixed(1)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Required Tubes & Recipes */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Paints to Squeeze / Recommended Tubes */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Paints Needed for Picture
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Paints from your inventory recommended to squeeze out
                </p>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {hasActiveMask ? 'Mask Region Scope' : 'Full Image Scope'}
              </span>
            </div>

            {requiredPigments.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {requiredPigments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 border border-amber-500/30 text-slate-100 shadow-sm"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-slate-600 shadow-sm flex-shrink-0"
                      style={{ backgroundColor: p.hex }}
                    ></span>
                    <span className="font-semibold text-xs text-amber-300">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({p.code})</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-2">
                {hasImage
                  ? 'Calculating required tubes...'
                  : 'Upload an image to identify which paints to squeeze.'}
              </div>
            )}
          </div>

          {/* Gamut-Constrained Dominant Recipe Cards */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Dominant Physical Regions
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Mixes achievable with your selected pigment inventory
                </p>
              </div>
              {soloRegionIndex !== null && (
                <button
                  type="button"
                  onClick={() => setSoloRegionIndex(null)}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 text-amber-400 border border-slate-700 hover:bg-slate-700 transition"
                >
                  Show All Regions
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {calculatedRegions.length > 0 ? (
                calculatedRegions.map((r, idx) => {
                  const isSolo = soloRegionIndex === r.regionIndex;
                  const partsDesc = r.parts
                    .map((p) => `${p.ratio} parts ${p.pigment.name}`)
                    .join(' + ');

                  return (
                    <div
                      key={idx}
                      onClick={() =>
                        setSoloRegionIndex(isSolo ? null : r.regionIndex)
                      }
                      className={`p-3.5 rounded-xl border transition cursor-pointer ${
                        isSolo
                          ? 'bg-slate-800/95 border-amber-500 shadow-lg ring-1 ring-amber-500/80'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg border border-slate-700 shadow-inner flex-shrink-0"
                            style={{ backgroundColor: r.hex }}
                          ></div>
                          <div>
                            <div className="text-xs font-bold text-slate-200">
                              Physical Region #{idx + 1}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {r.hex.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition ${
                            isSolo
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isSolo ? 'Solo Active' : 'Click to Isolate'}
                        </span>
                      </div>

                      {/* Proportional Mixture Bar */}
                      <div className="w-full flex h-2.5 rounded-md overflow-hidden border border-slate-800 bg-slate-900 mb-2.5">
                        {r.parts.map((p, pIdx) => (
                          <div
                            key={pIdx}
                            style={{
                              width: `${p.percent}%`,
                              backgroundColor: p.pigment.hex,
                            }}
                            className="h-full first:rounded-l last:rounded-r"
                            title={`${p.pigment.name}: ${p.percent}%`}
                          ></div>
                        ))}
                      </div>

                      {/* Parts Recipe Text */}
                      <div className="text-xs text-slate-300 font-medium">
                        {partsDesc}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-500 italic p-8 text-center border border-dashed border-slate-800 rounded-xl">
                  {hasImage ? 'Analyzing colors...' : 'No reference image loaded yet.'}
                </div>
              )}
            </div>

            {/* Export & Copy Bar */}
            {calculatedRegions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCopyRecipes}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-1.5"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy Recipes</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRender}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Save Image</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
