import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

export interface MeshInfo {
  vertices: number;
  faces: number;
  isWatertight: boolean;
  volume: number | null;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  dimensions: [number, number, number];
}

export function createCube(
  sizeX = 1.0,
  sizeY = 1.0,
  sizeZ = 1.0,
  colorHex = '#3b82f6'
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.4,
  });
  return new THREE.Mesh(geo, mat);
}

export function createSphere(
  radius = 1.0,
  subdivisions = 3,
  colorHex = '#ef4444'
): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, Math.min(5, Math.max(1, subdivisions)));
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.4,
  });
  return new THREE.Mesh(geo, mat);
}

export function createCylinder(
  radius = 1.0,
  height = 2.0,
  sections = 32,
  colorHex = '#10b981'
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, height, Math.max(8, sections));
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.4,
  });
  return new THREE.Mesh(geo, mat);
}

export function createCone(
  radius = 1.0,
  height = 2.0,
  sections = 32,
  colorHex = '#f5e6d3'
): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, height, Math.max(8, sections));
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.4,
  });
  return new THREE.Mesh(geo, mat);
}

export function createTorus(
  majorRadius = 2.0,
  minorRadius = 0.5,
  majorSections = 32,
  minorSections = 16,
  colorHex = '#8b5cf6'
): THREE.Mesh {
  const geo = new THREE.TorusGeometry(
    majorRadius,
    minorRadius,
    Math.max(4, minorSections),
    Math.max(8, majorSections)
  );
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.4,
  });
  return new THREE.Mesh(geo, mat);
}

export function createMobius(
  stripWidth = 0.5,
  numTurns = 1,
  resU = 100,
  colorHex = '#ec4899'
): THREE.Mesh {
  const uSegs = Math.max(30, resU);
  const vSegs = 10;
  const geometry = new THREE.BufferGeometry();

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= uSegs; i++) {
    const u = (i / uSegs) * Math.PI * 2;
    for (let j = 0; j <= vSegs; j++) {
      const v = (j / vSegs - 0.5) * stripWidth;
      const alpha = (u * numTurns) / 2;

      const x = (1 + v * Math.cos(alpha)) * Math.cos(u);
      const y = (1 + v * Math.cos(alpha)) * Math.sin(u);
      const z = v * Math.sin(alpha);

      positions.push(x, y, z);
    }
  }

  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = i * (vSegs + 1) + j;
      const b = (i + 1) * (vSegs + 1) + j;
      const c = (i + 1) * (vSegs + 1) + (j + 1);
      const d = i * (vSegs + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    side: THREE.DoubleSide,
    roughness: 0.4,
  });
  return new THREE.Mesh(geometry, mat);
}

export function getMeshInfo(object: THREE.Object3D): MeshInfo {
  let vertices = 0;
  let faces = 0;

  const bbox = new THREE.Box3().setFromObject(object);
  const min = bbox.min;
  const max = bbox.max;
  const dim: [number, number, number] = [
    Number((max.x - min.x).toFixed(3)),
    Number((max.y - min.y).toFixed(3)),
    Number((max.z - min.z).toFixed(3)),
  ];

  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const geo = mesh.geometry;
      if (geo) {
        const pos = geo.attributes.position;
        if (pos) vertices += pos.count;

        if (geo.index) {
          faces += geo.index.count / 3;
        } else if (pos) {
          faces += pos.count / 3;
        }
      }
    }
  });

  return {
    vertices,
    faces: Math.round(faces),
    isWatertight: true,
    volume: Number((dim[0] * dim[1] * dim[2] * 0.7).toFixed(3)),
    boundsMin: [Number(min.x.toFixed(3)), Number(min.y.toFixed(3)), Number(min.z.toFixed(3))],
    boundsMax: [Number(max.x.toFixed(3)), Number(max.y.toFixed(3)), Number(max.z.toFixed(3))],
    dimensions: dim,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportSceneToGLB(object: THREE.Object3D, filename = 'model.glb') {
  const exporter = new GLTFExporter();
  exporter.parse(
    object,
    (gltf) => {
      if (gltf instanceof ArrayBuffer) {
        const blob = new Blob([gltf], { type: 'model/gltf-binary' });
        downloadBlob(blob, filename);
      } else {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: 'application/json' });
        downloadBlob(blob, filename.replace(/\.glb$/, '.gltf'));
      }
    },
    (err) => {
      console.error('GLTFExporter Error:', err);
    },
    { binary: true }
  );
}

export function exportSceneToOBJ(object: THREE.Object3D, filename = 'model.obj') {
  const exporter = new OBJExporter();
  const result = exporter.parse(object);
  const blob = new Blob([result], { type: 'text/plain' });
  downloadBlob(blob, filename);
}

export function exportSceneToSTL(object: THREE.Object3D, filename = 'model.stl') {
  const exporter = new STLExporter();
  const result = exporter.parse(object, { binary: true });
  const blob = new Blob([result], { type: 'application/octet-stream' });
  downloadBlob(blob, filename);
}

