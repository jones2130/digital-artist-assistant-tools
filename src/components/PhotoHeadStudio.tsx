import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeViewport } from './ThreeViewport';
import {
  extractLandmarksFromImage,
  deformVertices,
  computeAnatomicalFrame,
  parseCanonicalObj,
} from '../utils/portraitProcessor';
import {
  generateWireframeCageMeshes,
  generateLoomisScaleBarMeshes,
  generateConstructionRingMeshes,
  generateGuideTubes,
  applyPlanarFaceColors,
} from '../utils/guideGenerator';
import {
  getMeshInfo,
  exportSceneToGLB,
  exportSceneToOBJ,
  exportSceneToSTL,
  type MeshInfo,
} from '../utils/meshGenerator';
import { Camera, Upload, Sparkles, Download, CheckCircle, Info } from 'lucide-react';

interface PhotoHeadStudioProps {
  basePath?: string;
}

export const PhotoHeadStudio: React.FC<PhotoHeadStudioProps> = ({ basePath = '' }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [meshSource, setMeshSource] = useState<'Photo-Fitted Face' | 'Default Canonical Face'>('Photo-Fitted Face');
  const [landmarksDetected, setLandmarksDetected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Default Canonical Face Model Loaded ℹ️');

  // Controls
  const [lightPreset, setLightPreset] = useState<string>('Rembrandt Lighting (Dramatic Chiaroscuro)');
  const [lightAngle, setLightAngle] = useState<number>(45);
  const [lightContrast, setLightContrast] = useState<number>(2.0);
  const [shadingStyle, setShadingStyle] = useState<'Faceted / Flat-Shaded' | 'Smooth-Shaded'>('Faceted / Flat-Shaded');

  const [showScaleBar, setShowScaleBar] = useState<boolean>(true);
  const [showWireframeCage, setShowWireframeCage] = useState<boolean>(true);
  const [showRings, setShowRings] = useState<boolean>(true);
  const [showPlanes, setShowPlanes] = useState<boolean>(true);
  const [showLoomisLines, setShowLoomisLines] = useState<boolean>(true);
  const [showReillyRhythms, setShowReillyRhythms] = useState<boolean>(true);

  const [faceColor, setFaceColor] = useState<string>('#f4e6d3');
  const [loomisColor, setLoomisColor] = useState<string>('#facc15');
  const [reillyColor, setReillyColor] = useState<string>('#38f872');
  const [exportFmt, setExportFmt] = useState<'GLB' | 'OBJ' | 'STL'>('GLB');

  // Mesh & Scene State
  const canonicalVertices = useRef<THREE.Vector3[]>([]);
  const baseGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const photoLandmarksRef = useRef<THREE.Vector3[] | null>(null);

  const [sceneGroup, setSceneGroup] = useState<THREE.Group | null>(null);
  const [metadata, setMetadata] = useState<MeshInfo | null>(null);

  // Load canonical face model OBJ on mount
  useEffect(() => {
    const objPath = `${basePath}/models/canonical_face_model.obj`.replace(/\/+/g, '/');
    fetch(objPath)
      .then((res) => res.text())
      .then((text) => {
        const { geometry, vertices } = parseCanonicalObj(text);
        baseGeometryRef.current = geometry;
        canonicalVertices.current = vertices;
        rebuildScene();
      })
      .catch((err) => {
        console.warn('Fallback to icosphere geometry on OBJ load error:', err);
        const sphere = new THREE.IcosahedronGeometry(8.0, 3);
        baseGeometryRef.current = sphere;
        const posAttr = sphere.attributes.position;
        const verts: THREE.Vector3[] = [];
        for (let i = 0; i < posAttr.count; i++) {
          verts.push(new THREE.Vector3().fromBufferAttribute(posAttr, i));
        }
        canonicalVertices.current = verts;
        rebuildScene();
      });
  }, [basePath]);

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setIsProcessing(true);
    setStatusMessage('Extracting MediaPipe Face Landmarks...');

    const img = new Image();
    img.src = url;
    img.onload = async () => {
      const landmarks = await extractLandmarksFromImage(img, basePath);
      if (landmarks && landmarks.length > 0) {
        photoLandmarksRef.current = landmarks;
        setLandmarksDetected(true);
        setStatusMessage('Custom Photo Facial Features Extracted ✅');
      } else {
        photoLandmarksRef.current = null;
        setLandmarksDetected(false);
        setStatusMessage('No face detected in photo. Using default canonical model ℹ️');
      }
      setIsProcessing(false);
      rebuildScene();
    };
  };

  // Rebuild 3D Scene based on active toggles & controls
  const rebuildScene = () => {
    if (canonicalVertices.current.length === 0 || !baseGeometryRef.current) return;

    let activeVerts = canonicalVertices.current;

    if (meshSource === 'Photo-Fitted Face' && photoLandmarksRef.current) {
      activeVerts = deformVertices(canonicalVertices.current, photoLandmarksRef.current);
    }

    const mainGroup = new THREE.Group();

    // 1. Create Base Face Mesh
    let faceGeo = baseGeometryRef.current.clone();
    const posAttr = faceGeo.attributes.position;
    for (let i = 0; i < Math.min(posAttr.count, activeVerts.length); i++) {
      posAttr.setXYZ(i, activeVerts[i].x, activeVerts[i].y, activeVerts[i].z);
    }
    posAttr.needsUpdate = true;
    faceGeo.computeVertexNormals();

    let faceMat: THREE.Material;
    if (showPlanes) {
      faceGeo = applyPlanarFaceColors(faceGeo, faceColor);
      faceMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        flatShading: shadingStyle === 'Faceted / Flat-Shaded',
        side: THREE.DoubleSide,
      });
    } else {
      faceMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(faceColor),
        roughness: 0.55,
        flatShading: shadingStyle === 'Faceted / Flat-Shaded',
        side: THREE.DoubleSide,
      });
    }

    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    mainGroup.add(faceMesh);

    // 2. Wireframe Cranial Cage
    if (showWireframeCage) {
      const cageMeshes = generateWireframeCageMeshes(activeVerts, '#38bdf8', 0.012);
      cageMeshes.forEach((m) => mainGroup.add(m));
    }

    // 3. Construction Rings
    if (showRings) {
      const ringMeshes = generateConstructionRingMeshes(
        activeVerts,
        '#facc15',
        '#f87171',
        '#4ade80',
        '#c084fc'
      );
      ringMeshes.forEach((m) => mainGroup.add(m));
    }

    // 4. Loomis Parallel Scale Bar
    if (showScaleBar) {
      const scaleMeshes = generateLoomisScaleBarMeshes(activeVerts, '#fbbf24', '#fbbf24', '#38bdf8');
      scaleMeshes.forEach((m) => mainGroup.add(m));
    }

    // 5. Loomis Face Lines & Reilly Rhythm Loops
    if (showLoomisLines || showReillyRhythms) {
      const guideTubes = generateGuideTubes(
        activeVerts,
        showLoomisLines,
        showReillyRhythms,
        loomisColor,
        reillyColor
      );
      guideTubes.forEach((m) => mainGroup.add(m));
    }

    setSceneGroup(mainGroup);
    setMetadata(getMeshInfo(mainGroup));
  };

  // Re-trigger scene rebuild when control state changes
  useEffect(() => {
    rebuildScene();
  }, [
    meshSource,
    showScaleBar,
    showWireframeCage,
    showRings,
    showPlanes,
    showLoomisLines,
    showReillyRhythms,
    shadingStyle,
    faceColor,
    loomisColor,
    reillyColor,
  ]);

  const handleExport = () => {
    if (!sceneGroup) return;
    const name = `loomis_reference_head.${exportFmt.toLowerCase()}`;
    if (exportFmt === 'GLB') {
      exportSceneToGLB(sceneGroup, name);
    } else if (exportFmt === 'OBJ') {
      exportSceneToOBJ(sceneGroup, name);
    } else {
      exportSceneToSTL(sceneGroup, name);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Controls & Inputs */}
      <div className="lg:col-span-1 bg-slate-800/80 border border-slate-700 p-5 rounded-2xl flex flex-col gap-5 text-slate-200">
        <div>
          <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
            <Camera className="w-5 h-5 text-sky-400" /> Portrait Photo & Mesh Fitting
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload a portrait photo to extract facial landmarks using client-side MediaPipe WASM.
          </p>
        </div>

        {/* Photo Input Picker */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300">Upload Portrait Photo (Optional)</label>
          <div className="relative border-2 border-dashed border-slate-600 rounded-xl p-4 text-center hover:border-sky-500 transition-colors bg-slate-900/50 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
            <span className="text-xs text-slate-300 font-medium">Click or Drag Photo Here</span>
          </div>

          {photoUrl && (
            <div className="flex items-center gap-3 bg-slate-900/70 p-2 rounded-lg border border-slate-700 mt-1">
              <img src={photoUrl} alt="Portrait preview" className="w-12 h-12 object-cover rounded-md" />
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Uploaded Image</p>
                <p className="text-slate-400 text-[10px]">{statusMessage}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-300">Mesh Model Target</label>
          <select
            value={meshSource}
            onChange={(e) => setMeshSource(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="Photo-Fitted Face">Photo-Fitted Face (Landmarks)</option>
            <option value="Default Canonical Face">Default Canonical Face Model</option>
          </select>
        </div>

        {/* Studio Lighting & Shading */}
        <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> 3D Studio Lighting & Shading
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

          <div className="flex flex-col gap-1 mt-1">
            <label className="text-xs font-medium text-slate-300">Mesh Shading Style</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShadingStyle('Faceted / Flat-Shaded')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  shadingStyle === 'Faceted / Flat-Shaded'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                Faceted (Flat)
              </button>
              <button
                type="button"
                onClick={() => setShadingStyle('Smooth-Shaded')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  shadingStyle === 'Smooth-Shaded'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                Smooth Shaded
              </button>
            </div>
          </div>
        </div>

        {/* Guides & Overlays */}
        <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-sky-400">📏 Loomis Parallel Scale & Cranial Cage</h3>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showScaleBar}
                onChange={(e) => setShowScaleBar(e.target.checked)}
                className="accent-amber-400 rounded"
              />
              Loomis Parallel Scale
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showWireframeCage}
                onChange={(e) => setShowWireframeCage(e.target.checked)}
                className="accent-sky-400 rounded"
              />
              Cranial Wireframe Cage
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRings}
                onChange={(e) => setShowRings(e.target.checked)}
                className="accent-emerald-400 rounded"
              />
              Construction Rings
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPlanes}
                onChange={(e) => setShowPlanes(e.target.checked)}
                className="accent-purple-400 rounded"
              />
              Planar Face Shading
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLoomisLines}
                onChange={(e) => setShowLoomisLines(e.target.checked)}
                className="accent-red-400 rounded"
              />
              Loomis Face Lines
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showReillyRhythms}
                onChange={(e) => setShowReillyRhythms(e.target.checked)}
                className="accent-blue-400 rounded"
              />
              Reilly Rhythm Loops
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-slate-700/60 pt-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Face Clay Tone</span>
              <input
                type="color"
                value={faceColor}
                onChange={(e) => setFaceColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Loomis Line</span>
              <input
                type="color"
                value={loomisColor}
                onChange={(e) => setLoomisColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Reilly Loop</span>
              <input
                type="color"
                value={reillyColor}
                onChange={(e) => setReillyColor(e.target.value)}
                className="w-full h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Export & Build */}
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
          height={540}
        />

        {/* Metadata Card */}
        {metadata && (
          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl text-slate-300 flex flex-col gap-2">
            <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400" /> 🎨 3D Loomis Reference Metadata
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t border-slate-700 pt-3">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Landmarks Status</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-3 h-3" /> {landmarksDetected ? 'Photo Fitted' : 'Canonical'}
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

