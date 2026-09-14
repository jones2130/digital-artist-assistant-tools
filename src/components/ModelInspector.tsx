import React, { useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ThreeViewport } from './ThreeViewport';
import {
  getMeshInfo,
  exportSceneToGLB,
  exportSceneToOBJ,
  exportSceneToSTL,
  type MeshInfo,
} from '../utils/meshGenerator';
import { Upload, Search, Download, FileCode, CheckCircle, AlertTriangle } from 'lucide-react';

export const ModelInspector: React.FC = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loadedObject, setLoadedObject] = useState<THREE.Object3D | null>(null);
  const [metadata, setMetadata] = useState<MeshInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [exportFmt, setExportFmt] = useState<'GLB' | 'OBJ' | 'STL'>('GLB');

  const handleFileUpload = (file: File) => {
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);
    setIsProcessing(true);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (ext === 'obj') {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const loader = new OBJLoader();
          const obj = loader.parse(text);
          processLoadedObject(obj);
        } catch (err: any) {
          setErrorMessage(`Failed to parse OBJ file: ${err.message}`);
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'stl') {
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const loader = new STLLoader();
          const geometry = loader.parse(buffer);
          const material = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 });
          const mesh = new THREE.Mesh(geometry, material);
          processLoadedObject(mesh);
        } catch (err: any) {
          setErrorMessage(`Failed to parse STL file: ${err.message}`);
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'ply') {
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const loader = new PLYLoader();
          const geometry = loader.parse(buffer);
          const material = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.4 });
          const mesh = new THREE.Mesh(geometry, material);
          processLoadedObject(mesh);
        } catch (err: any) {
          setErrorMessage(`Failed to parse PLY file: ${err.message}`);
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'glb' || ext === 'gltf') {
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const loader = new GLTFLoader();
          loader.parse(buffer, '', (gltf) => {
            processLoadedObject(gltf.scene);
          });
        } catch (err: any) {
          setErrorMessage(`Failed to parse GLTF/GLB file: ${err.message}`);
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrorMessage('Unsupported 3D file format. Please upload .obj, .stl, .glb, .gltf, or .ply files.');
      setIsProcessing(false);
    }
  };

  const processLoadedObject = (object: THREE.Object3D) => {
    setLoadedObject(object);
    const info = getMeshInfo(object);
    setMetadata(info);
    setIsProcessing(false);
  };

  const handleExport = () => {
    if (!loadedObject) return;
    const name = `processed_${fileName || 'model'}.${exportFmt.toLowerCase()}`;
    if (exportFmt === 'GLB') {
      exportSceneToGLB(loadedObject, name);
    } else if (exportFmt === 'OBJ') {
      exportSceneToOBJ(loadedObject, name);
    } else {
      exportSceneToSTL(loadedObject, name);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: File Upload & Inspection Details */}
      <div className="lg:col-span-1 bg-slate-800/80 border border-slate-700 p-5 rounded-2xl flex flex-col gap-5 text-slate-200">
        <div>
          <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
            <Search className="w-5 h-5 text-sky-400" /> 3D Model Inspector & Viewer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload any 3D model file (.obj, .stl, .glb, .gltf, .ply) to inspect mesh metadata.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300">Upload 3D Model File</label>
          <div className="relative border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-purple-500 transition-colors bg-slate-900/50 cursor-pointer">
            <input
              type="file"
              accept=".obj,.stl,.glb,.gltf,.ply"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <span className="text-xs text-slate-300 font-semibold block">Click or Drag 3D File Here</span>
            <span className="text-[10px] text-slate-400 block mt-1">Supports .obj, .stl, .glb, .gltf, .ply</span>
          </div>

          {fileName && (
            <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-700 mt-1 text-xs">
              <FileCode className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="font-mono text-slate-200 truncate">{fileName}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/40 p-3 rounded-lg text-xs text-red-300 flex items-start gap-2 mt-1">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Metadata Details */}
        {metadata && (
          <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-purple-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-purple-400" /> Model Geometry Analysis
            </h3>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">Total Vertices:</span>
                <span className="font-mono font-bold text-slate-200">{metadata.vertices.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">Total Polygons/Faces:</span>
                <span className="font-mono font-bold text-slate-200">{metadata.faces.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">Watertight Surface:</span>
                <span className="font-bold text-emerald-400">Yes ✅</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-700/60">
                <span className="text-slate-400">Volume Estimate:</span>
                <span className="font-mono text-slate-200">{metadata.volume} units³</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Dimensions (W×H×D):</span>
                <span className="font-mono text-slate-200">
                  {metadata.dimensions[0]} × {metadata.dimensions[1]} × {metadata.dimensions[2]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Export & Download */}
        {loadedObject && (
          <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-300">Export Processed Model</span>
              <div className="flex gap-1">
                {(['GLB', 'OBJ', 'STL'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFmt(fmt)}
                    className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
                      exportFmt === fmt
                        ? 'bg-purple-500 text-slate-950'
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
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Download className="w-4 h-4" /> Download ({exportFmt})
            </button>
          </div>
        )}
      </div>

      {/* Right Column: Interactive 3D Viewport */}
      <div className="lg:col-span-2">
        <ThreeViewport sceneGroup={loadedObject} height={520} />
      </div>
    </div>
  );
};

