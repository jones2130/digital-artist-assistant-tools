import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ThreeViewport } from './ThreeViewport';
import {
  extractHandLandmarksFromImage,
  generateDefaultHandLandmarks,
  type HandLandmarkData,
} from '../utils/handProcessor';
import { generateHandMeshGroup, type HandStyleOptions } from '../utils/handGuideGenerator';
import {
  getMeshInfo,
  exportSceneToGLB,
  exportSceneToOBJ,
  exportSceneToSTL,
  type MeshInfo,
} from '../utils/meshGenerator';
import {
  Hand,
  Upload,
  Sparkles,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  CheckCircle,
  Info,
} from 'lucide-react';

interface PhotoHandStudioProps {
  basePath?: string;
}

export const PhotoHandStudio: React.FC<PhotoHandStudioProps> = ({ basePath = '' }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Default 3D Hand Models Loaded ℹ️');

  // MediaPipe Hand Detection Options
  const [maxHands, setMaxHands] = useState<number>(2);
  const [detectedHands, setDetectedHands] = useState<HandLandmarkData[]>([]);

  // Pagination state: 'all' or specific hand index (0..count-1)
  const [activeHandIndex, setActiveHandIndex] = useState<'all' | number>('all');

  // 3D Controls & Visual Options
  const [showJoints, setShowJoints] = useState<boolean>(true);
  const [showBones, setShowBones] = useState<boolean>(true); // Bridgman tapered blocks
  const [showRings, setShowRings] = useState<boolean>(true); // Foreshortening Torus Rings
  const [showPlanes, setShowPlanes] = useState<boolean>(true); // Volumetric Palm Block & Thenar Wedge
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  const [jointColor, setJointColor] = useState<string>('#facc15'); // Finger joints (yellow)
  const [mcpColor, setMcpColor] = useState<string>('#f97316'); // Knuckles (orange)
  const [boneColor, setBoneColor] = useState<string>('#f1f5f9'); // Tendon / phalanx blocks (light slate)
  const [ringColor, setRingColor] = useState<string>('#06b6d4'); // Foreshortening rings (cyan)
  const [planeColor, setPlaneColor] = useState<string>('#f4e6d3'); // Palm block (skin tone)
  const [thenarColor, setThenarColor] = useState<string>('#e2e8f0'); // Thenar muscle wedge
  const [wireframeColor, setWireframeColor] = useState<string>('#4ade80');
  const [shadingStyle, setShadingStyle] = useState<'Faceted / Flat-Shaded' | 'Smooth-Shaded'>(
    'Faceted / Flat-Shaded'
  );

  // Studio Lighting
  const [lightPreset, setLightPreset] = useState<string>('Rembrandt Lighting (Dramatic Chiaroscuro)');
  const [lightAngle, setLightAngle] = useState<number>(45);
  const [lightContrast, setLightContrast] = useState<number>(2.0);

  // Export
  const [exportFmt, setExportFmt] = useState<'GLB' | 'OBJ' | 'STL'>('GLB');

  // Scene & Metadata Refs
  const [sceneGroup, setSceneGroup] = useState<THREE.Group | null>(null);
  const [metadata, setMetadata] = useState<MeshInfo | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Initial load of default hands
  useEffect(() => {
    const defaults = generateDefaultHandLandmarks(maxHands);
    setDetectedHands(defaults);
  }, []);

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setIsProcessing(true);
    setStatusMessage('Detecting MediaPipe 3D Hand Landmarks...');

    const img = new Image();
    img.src = url;
    img.onload = async () => {
      loadedImageRef.current = img;
      await processImage(img, maxHands);
    };
  };

  // Re-run MediaPipe detection when maxHands slider changes with uploaded image
  const handleMaxHandsChange = async (newMax: number) => {
    setMaxHands(newMax);
    if (loadedImageRef.current) {
      setIsProcessing(true);
      setStatusMessage(`Detecting up to ${newMax} hands...`);
      await processImage(loadedImageRef.current, newMax);
    } else {
      const defaults = generateDefaultHandLandmarks(newMax);
      setDetectedHands(defaults);
      if (activeHandIndex !== 'all' && activeHandIndex >= newMax) {
        setActiveHandIndex('all');
      }
    }
  };

  const processImage = async (img: HTMLImageElement, numHands: number) => {
    const hands = await extractHandLandmarksFromImage(img, numHands, basePath);
    if (hands && hands.length > 0) {
      setDetectedHands(hands);
      setStatusMessage(`Extracted ${hands.length} 3D Hand Model${hands.length > 1 ? 's' : ''} ✅`);
    } else {
      const defaults = generateDefaultHandLandmarks(numHands);
      setDetectedHands(defaults);
      setStatusMessage('No hands detected in photo. Using default 3D pose hands ℹ️');
    }
    setIsProcessing(false);
  };

  // Rebuild 3D Scene when hands, pagination, or visual options change
  const rebuildScene = () => {
    if (!detectedHands || detectedHands.length === 0) return;

    const mainGroup = new THREE.Group();
    mainGroup.name = 'HandStudio_SceneGroup';

    const options: HandStyleOptions = {
      showJoints,
      showBones,
      showRings,
      showPlanes,
      showWireframe,
      showLabels,
      jointColor,
      mcpColor,
      boneColor,
      ringColor,
      planeColor,
      thenarColor,
      wireframeColor,
      shadingStyle,
    };

    if (activeHandIndex === 'all') {
      // Render all hands together in scene
      detectedHands.forEach((handData) => {
        const handMeshGroup = generateHandMeshGroup(handData, options, false);
        mainGroup.add(handMeshGroup);
      });
    } else {
      // Render selected individual hand centered for detailed inspection
      const selectedHand = detectedHands[activeHandIndex];
      if (selectedHand) {
        const handMeshGroup = generateHandMeshGroup(selectedHand, options, true);
        mainGroup.add(handMeshGroup);
      }
    }

    setSceneGroup(mainGroup);
    setMetadata(getMeshInfo(mainGroup));
  };

  useEffect(() => {
    rebuildScene();
  }, [
    detectedHands,
    activeHandIndex,
    showJoints,
    showBones,
    showRings,
    showPlanes,
    showWireframe,
    showLabels,
    jointColor,
    mcpColor,
    boneColor,
    ringColor,
    planeColor,
    thenarColor,
    wireframeColor,
    shadingStyle,
  ]);

  // Pagination Helper Functions
  const handlePrevHand = () => {
    if (detectedHands.length === 0) return;
    if (activeHandIndex === 'all') {
      setActiveHandIndex(detectedHands.length - 1);
    } else if (activeHandIndex === 0) {
      setActiveHandIndex('all');
    } else {
      setActiveHandIndex(activeHandIndex - 1);
    }
  };

  const handleNextHand = () => {
    if (detectedHands.length === 0) return;
    if (activeHandIndex === 'all') {
      setActiveHandIndex(0);
    } else if (activeHandIndex === detectedHands.length - 1) {
      setActiveHandIndex('all');
    } else {
      setActiveHandIndex(activeHandIndex + 1);
    }
  };

  // Export 3D Model
  const handleExport = () => {
    if (!sceneGroup) return;
    const handSuffix =
      activeHandIndex === 'all' ? `all_${detectedHands.length}_hands` : `hand_${activeHandIndex + 1}`;
    const name = `hand_3d_model_${handSuffix}.${exportFmt.toLowerCase()}`;

    if (exportFmt === 'GLB') {
      exportSceneToGLB(sceneGroup, name);
    } else if (exportFmt === 'OBJ') {
      exportSceneToOBJ(sceneGroup, name);
    } else {
      exportSceneToSTL(sceneGroup, name);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trigger-tip-modal'));
      if (typeof (window as any).triggerTipModal === 'function') {
        (window as any).triggerTipModal();
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Controls & Inputs */}
      <div className="lg:col-span-1 bg-slate-800/80 border border-slate-700 p-5 rounded-2xl flex flex-col gap-5 text-slate-200">
        <div>
          <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
            <Hand className="w-5 h-5 text-sky-400" /> Photo to 3D Hand Studio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Detect up to 6 hands from photos with MediaPipe WASM and visualize high-fidelity 3D anatomical skeletal models.
          </p>
        </div>

        {/* Image Upload */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300">Upload Hand Photo (Optional)</label>
          <div className="relative border-2 border-dashed border-slate-600 rounded-xl p-4 text-center hover:border-sky-500 transition-colors bg-slate-900/50 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
            <span className="text-xs text-slate-300 font-medium">Click or Drag Hand Photo Here</span>
          </div>

          {photoUrl && (
            <div className="flex items-center gap-3 bg-slate-900/70 p-2 rounded-lg border border-slate-700 mt-1">
              <img src={photoUrl} alt="Hand preview" className="w-12 h-12 object-cover rounded-md" />
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Uploaded Image</p>
                <p className="text-slate-400 text-[10px]">{statusMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Max Hands Detector Setting */}
        <div className="flex flex-col gap-1.5 border-t border-slate-700 pt-4">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
            <span>Detection Limit (Max Hands)</span>
            <span className="font-mono text-sky-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">
              {maxHands} Hand{maxHands > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 mt-1">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleMaxHandsChange(num)}
                disabled={isProcessing}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  maxHands === num
                    ? 'bg-sky-500 border-sky-400 text-slate-950 shadow-md'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Hand Pagination Selector */}
        <div className="flex flex-col gap-2.5 border-t border-slate-700 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Hand Model Pagination
            </h3>
            <span className="text-[10px] text-slate-400">
              {activeHandIndex === 'all'
                ? `Viewing All ${detectedHands.length} Hands`
                : `Focusing Hand #${activeHandIndex + 1}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevHand}
              className="bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 p-2 rounded-lg transition-colors"
              title="Previous Hand"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveHandIndex('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                activeHandIndex === 'all'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              All Hands ({detectedHands.length})
            </button>

            <button
              type="button"
              onClick={handleNextHand}
              className="bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 p-2 rounded-lg transition-colors"
              title="Next Hand"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Individual Hand Pill Selectors */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {detectedHands.map((h, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveHandIndex(idx)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 ${
                  activeHandIndex === idx
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span>🖐️ #{idx + 1}</span>
                <span className="text-[10px] opacity-80">({h.handedness})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3D Anatomical Visual Mesh Controls */}
        <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-sky-400">🎨 Anatomical Skeleton & Mesh Style</h3>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showJoints}
                onChange={(e) => setShowJoints(e.target.checked)}
                className="accent-amber-400 rounded"
              />
              Knuckles & Joint Spheres
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showBones}
                onChange={(e) => setShowBones(e.target.checked)}
                className="accent-sky-400 rounded"
              />
              Tapered Tendon Blocks
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRings}
                onChange={(e) => setShowRings(e.target.checked)}
                className="accent-cyan-400 rounded"
              />
              Foreshortening Torus Rings
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPlanes}
                onChange={(e) => setShowPlanes(e.target.checked)}
                className="accent-purple-400 rounded"
              />
              Palm & Thenar Blocks
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showWireframe}
                onChange={(e) => setShowWireframe(e.target.checked)}
                className="accent-emerald-400 rounded"
              />
              Wireframe Overlay
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="accent-blue-400 rounded"
              />
              3D Handedness Badges
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-slate-700/60 pt-3 text-[10px] text-slate-400">
            <div className="flex flex-col gap-1">
              <span>Knuckles (MCP)</span>
              <input
                type="color"
                value={mcpColor}
                onChange={(e) => setMcpColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Finger Joints</span>
              <input
                type="color"
                value={jointColor}
                onChange={(e) => setJointColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Foreshortening Rings</span>
              <input
                type="color"
                value={ringColor}
                onChange={(e) => setRingColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Tendon Blocks</span>
              <input
                type="color"
                value={boneColor}
                onChange={(e) => setBoneColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Palm Main</span>
              <input
                type="color"
                value={planeColor}
                onChange={(e) => setPlaneColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Thenar Wedge</span>
              <input
                type="color"
                value={thenarColor}
                onChange={(e) => setThenarColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Studio Lighting & Shading */}
        <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> 3D Studio Lighting
          </h3>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">Lighting Preset</label>
            <select
              value={lightPreset}
              onChange={(e) => setLightPreset(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="Rembrandt Lighting (Dramatic Chiaroscuro)">Rembrandt Lighting (Chiaroscuro)</option>
              <option value="Caravaggio Extreme Chiaroscuro">Caravaggio Extreme Chiaroscuro</option>
              <option value="Three-Point Studio">Three-Point Studio</option>
              <option value="High-Key Studio (Bright & Soft)">High-Key Studio (Bright & Soft)</option>
              <option value="Flat Studio Clay">Flat Studio Clay</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Key Light Angle</span>
                <span className="font-mono text-amber-400">{lightAngle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={lightAngle}
                onChange={(e) => setLightAngle(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-slate-900 rounded-lg h-2"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Light Contrast</span>
                <span className="font-mono text-amber-400">{lightContrast}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={lightContrast}
                onChange={(e) => setLightContrast(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-slate-900 rounded-lg h-2"
              />
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-300">Export Format</span>
            <div className="flex gap-1">
              {(['GLB', 'OBJ', 'STL'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setExportFmt(fmt)}
                  className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
                    exportFmt === fmt
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            data-action="export-hand"
            className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Download className="w-4 h-4" /> Download 3D Reference Model ({exportFmt})
          </button>
        </div>
      </div>

      {/* Right Column: 3D Viewport & Metadata */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <ThreeViewport
          sceneGroup={sceneGroup}
          lighting={{
            preset: lightPreset,
            keyAngleDeg: lightAngle,
            contrastBoost: lightContrast,
          }}
          height={560}
        />

        {/* Metadata Card */}
        {metadata && (
          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl text-slate-300 flex flex-col gap-2">
            <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400" /> 🎨 High-Fidelity 3D Hand Metadata
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t border-slate-700 pt-3">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Active View</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-3 h-3" />
                  {activeHandIndex === 'all' ? `All (${detectedHands.length})` : `Hand #${activeHandIndex + 1}`}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Total Vertices</span>
                <span className="font-mono text-slate-200 font-bold">{metadata.vertices.toLocaleString()}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Total Faces</span>
                <span className="font-mono text-slate-200 font-bold">{metadata.faces.toLocaleString()}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Bounding Dimensions</span>
                <span className="font-mono text-slate-200">
                  {metadata.dimensions[0]} × {metadata.dimensions[1]} × {metadata.dimensions[2]}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
