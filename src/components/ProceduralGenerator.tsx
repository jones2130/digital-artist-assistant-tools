import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { ThreeViewport } from './ThreeViewport';
import {
  createCube,
  createSphere,
  createCylinder,
  createCone,
  createTorus,
  createMobius,
  getMeshInfo,
  exportSceneToGLB,
  exportSceneToOBJ,
  exportSceneToSTL,
  type MeshInfo,
} from '../utils/meshGenerator';
import { Box, Download, Info, Layers } from 'lucide-react';

export const ProceduralGenerator: React.FC = () => {
  const [shapeName, setShapeName] = useState<string>('Sphere');
  const [meshColor, setMeshColor] = useState<string>('#3b82f6');

  // Parameters
  // Cube
  const [cubeX, setCubeX] = useState<number>(1.0);
  const [cubeY, setCubeY] = useState<number>(1.0);
  const [cubeZ, setCubeZ] = useState<number>(1.0);

  // Sphere
  const [sphereRadius, setSphereRadius] = useState<number>(1.0);
  const [sphereSubdiv, setSphereSubdiv] = useState<number>(3);

  // Cylinder
  const [cylRadius, setCylRadius] = useState<number>(1.0);
  const [cylHeight, setCylHeight] = useState<number>(2.0);
  const [cylSections, setCylSections] = useState<number>(32);

  // Cone
  const [coneRadius, setConeRadius] = useState<number>(1.0);
  const [coneHeight, setConeHeight] = useState<number>(2.0);
  const [coneSections, setConeSections] = useState<number>(32);

  // Torus
  const [torusMajorR, setTorusMajorR] = useState<number>(2.0);
  const [torusMinorR, setTorusMinorR] = useState<number>(0.5);
  const [torusMajorSec, setTorusMajorSec] = useState<number>(32);
  const [torusMinorSec, setTorusMinorSec] = useState<number>(16);

  // Mobius
  const [mobiusWidth, setMobiusWidth] = useState<number>(0.5);
  const [mobiusTurns, setMobiusTurns] = useState<number>(1);
  const [mobiusResU, setMobiusResU] = useState<number>(100);

  const [exportFmt, setExportFmt] = useState<'GLB' | 'OBJ' | 'STL'>('GLB');
  const [activeMesh, setActiveMesh] = useState<THREE.Mesh | null>(null);
  const [metadata, setMetadata] = useState<MeshInfo | null>(null);

  useEffect(() => {
    let mesh: THREE.Mesh;
    if (shapeName === 'Cube') {
      mesh = createCube(cubeX, cubeY, cubeZ, meshColor);
    } else if (shapeName === 'Sphere') {
      mesh = createSphere(sphereRadius, sphereSubdiv, meshColor);
    } else if (shapeName === 'Cylinder') {
      mesh = createCylinder(cylRadius, cylHeight, cylSections, meshColor);
    } else if (shapeName === 'Cone') {
      mesh = createCone(coneRadius, coneHeight, coneSections, meshColor);
    } else if (shapeName === 'Torus') {
      mesh = createTorus(torusMajorR, torusMinorR, torusMajorSec, torusMinorSec, meshColor);
    } else if (shapeName === 'Möbius Strip') {
      mesh = createMobius(mobiusWidth, mobiusTurns, mobiusResU, meshColor);
    } else {
      mesh = createCube(1, 1, 1, meshColor);
    }

    setActiveMesh(mesh);
    setMetadata(getMeshInfo(mesh));
  }, [
    shapeName,
    meshColor,
    cubeX,
    cubeY,
    cubeZ,
    sphereRadius,
    sphereSubdiv,
    cylRadius,
    cylHeight,
    cylSections,
    coneRadius,
    coneHeight,
    coneSections,
    torusMajorR,
    torusMinorR,
    torusMajorSec,
    torusMinorSec,
    mobiusWidth,
    mobiusTurns,
    mobiusResU,
  ]);

  const handleExport = () => {
    if (!activeMesh) return;
    const name = `${shapeName.toLowerCase().replace(/\s+/g, '_')}.${exportFmt.toLowerCase()}`;
    if (exportFmt === 'GLB') {
      exportSceneToGLB(activeMesh, name);
    } else if (exportFmt === 'OBJ') {
      exportSceneToOBJ(activeMesh, name);
    } else {
      exportSceneToSTL(activeMesh, name);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Controls */}
      <div className="lg:col-span-1 bg-slate-800/80 border border-slate-700 p-5 rounded-2xl flex flex-col gap-5 text-slate-200">
        <div>
          <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
            <Box className="w-5 h-5 text-sky-400" /> 3D Procedural Primitive Generator
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate and export custom 3D primitive geometry in real-time.
          </p>
        </div>

        {/* Primitive Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-300">Select 3D Primitive</label>
          <select
            value={shapeName}
            onChange={(e) => setShapeName(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="Cube">Cube / Box</option>
            <option value="Sphere">Icosphere</option>
            <option value="Cylinder">Cylinder</option>
            <option value="Cone">Cone</option>
            <option value="Torus">Torus (Donut)</option>
            <option value="Möbius Strip">Möbius Strip</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-300">Mesh Surface Color</label>
          <input
            type="color"
            value={meshColor}
            onChange={(e) => setMeshColor(e.target.value)}
            className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 cursor-pointer"
          />
        </div>

        {/* Dynamic Shape Parameters */}
        <div className="border-t border-slate-700 pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
            <Layers className="w-4 h-4" /> {shapeName} Parameters
          </h3>

          {shapeName === 'Cube' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Width (X)</span>
                  <span className="font-mono text-emerald-400">{cubeX}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={cubeX}
                  onChange={(e) => setCubeX(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Height (Y)</span>
                  <span className="font-mono text-emerald-400">{cubeY}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={cubeY}
                  onChange={(e) => setCubeY(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Depth (Z)</span>
                  <span className="font-mono text-emerald-400">{cubeZ}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={cubeZ}
                  onChange={(e) => setCubeZ(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
            </div>
          )}

          {shapeName === 'Sphere' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Radius</span>
                  <span className="font-mono text-emerald-400">{sphereRadius}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={sphereRadius}
                  onChange={(e) => setSphereRadius(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Subdivisions (Quality)</span>
                  <span className="font-mono text-emerald-400">{sphereSubdiv}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={sphereSubdiv}
                  onChange={(e) => setSphereSubdiv(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
            </div>
          )}

          {shapeName === 'Cylinder' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Radius</span>
                  <span className="font-mono text-emerald-400">{cylRadius}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={cylRadius}
                  onChange={(e) => setCylRadius(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Height</span>
                  <span className="font-mono text-emerald-400">{cylHeight}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={cylHeight}
                  onChange={(e) => setCylHeight(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Radial Sections</span>
                  <span className="font-mono text-emerald-400">{cylSections}</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="64"
                  step="4"
                  value={cylSections}
                  onChange={(e) => setCylSections(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
            </div>
          )}

          {shapeName === 'Cone' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Base Radius</span>
                  <span className="font-mono text-emerald-400">{coneRadius}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={coneRadius}
                  onChange={(e) => setConeRadius(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Height</span>
                  <span className="font-mono text-emerald-400">{coneHeight}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={coneHeight}
                  onChange={(e) => setConeHeight(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Radial Sections</span>
                  <span className="font-mono text-emerald-400">{coneSections}</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="64"
                  step="4"
                  value={coneSections}
                  onChange={(e) => setConeSections(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
            </div>
          )}

          {shapeName === 'Torus' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Major Radius (Ring)</span>
                  <span className="font-mono text-emerald-400">{torusMajorR}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={torusMajorR}
                  onChange={(e) => setTorusMajorR(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Minor Radius (Tube)</span>
                  <span className="font-mono text-emerald-400">{torusMinorR}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={torusMinorR}
                  onChange={(e) => setTorusMinorR(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Ring Segments</span>
                  <span className="font-mono text-emerald-400">{torusMajorSec}</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="64"
                  step="4"
                  value={torusMajorSec}
                  onChange={(e) => setTorusMajorSec(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Tube Segments</span>
                  <span className="font-mono text-emerald-400">{torusMinorSec}</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="32"
                  step="2"
                  value={torusMinorSec}
                  onChange={(e) => setTorusMinorSec(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
            </div>
          )}

          {shapeName === 'Möbius Strip' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Strip Width</span>
                  <span className="font-mono text-emerald-400">{mobiusWidth}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={mobiusWidth}
                  onChange={(e) => setMobiusWidth(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Twist Turns</span>
                  <span className="font-mono text-emerald-400">{mobiusTurns}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={mobiusTurns}
                  onChange={(e) => setMobiusTurns(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Resolution</span>
                  <span className="font-mono text-emerald-400">{mobiusResU}</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="200"
                  step="10"
                  value={mobiusResU}
                  onChange={(e) => setMobiusResU(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg h-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* Export & Download */}
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
                      ? 'bg-emerald-500 text-slate-950'
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
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Download className="w-4 h-4" /> Export {shapeName} ({exportFmt})
          </button>
        </div>
      </div>

      {/* Right Column: Viewport & Metadata */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <ThreeViewport sceneGroup={activeMesh} height={500} />

        {metadata && (
          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl text-slate-300 flex flex-col gap-2">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400" /> 📊 Procedural Mesh Properties
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t border-slate-700 pt-3">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Vertices</span>
                <span className="font-mono text-slate-200 font-bold">{metadata.vertices.toLocaleString()}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Faces</span>
                <span className="font-mono text-slate-200 font-bold">{metadata.faces.toLocaleString()}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Volume Est.</span>
                <span className="font-mono text-slate-200 font-bold">{metadata.volume} units³</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Bounding Box</span>
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

