import * as THREE from 'three';
import {
  computeAnatomicalFrame,
  computeLoomisMeasurementScale,
  computeConstructionRings,
} from './portraitProcessor';
import {
  LOOMIS_LINE_GROUPS,
  REILLY_LINE_GROUPS,
  PLANAR_FACE_GROUPS,
} from './landmarkIndices';

export function hexToRgb(hexColor: string): THREE.Color {
  return new THREE.Color(hexColor);
}

export function build3DTubeFromPoints(
  points: THREE.Vector3[],
  radius: number = 0.03,
  colorHex: string = '#3b82f6'
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const color = hexToRgb(colorHex);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.3,
    metalness: 0.1,
  });

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const vec = new THREE.Vector3().subVectors(p2, p1);
    const dist = vec.length();

    if (dist < 1e-5) continue;

    const cylinderGeo = new THREE.CylinderGeometry(radius, radius, dist, 6);
    const mesh = new THREE.Mesh(cylinderGeo, material);

    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(midpoint);

    const defaultAxis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(defaultAxis, vec.clone().normalize());
    mesh.quaternion.copy(quat);

    meshes.push(mesh);
  }

  return meshes;
}

export function generateWireframeCageMeshes(
  vertices: THREE.Vector3[],
  cageColor: string = '#38bdf8',
  wireRadius: number = 0.012
): THREE.Mesh[] {
  const frame = computeAnatomicalFrame(vertices);
  const { glabella, hairline, chin, xAxis, yAxis, zAxis } = frame;

  const faceH = hairline.distanceTo(chin);
  const radius = faceH * 0.5;
  const center = glabella
    .clone()
    .sub(zAxis.clone().multiplyScalar(radius * 1.02))
    .add(yAxis.clone().multiplyScalar(radius * 0.04));

  const sphereGeo = new THREE.IcosahedronGeometry(radius, 2);

  // Side clip (flatten side discs of the Loomis ball)
  const posAttr = sphereGeo.attributes.position;
  const sideClip = radius * 0.84;
  for (let i = 0; i < posAttr.count; i++) {
    let x = posAttr.getX(i);
    if (x > sideClip) x = sideClip;
    if (x < -sideClip) x = -sideClip;
    posAttr.setX(i, x);
  }
  posAttr.needsUpdate = true;

  const transformMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  transformMat.setPosition(center);
  sphereGeo.applyMatrix4(transformMat);

  const sphereMat = new THREE.MeshStandardMaterial({
    color: hexToRgb(cageColor),
    wireframe: true,
    roughness: 0.3,
    transparent: true,
    opacity: 0.75,
  });

  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  return [sphereMesh];
}

export function generateLoomisScaleBarMeshes(
  vertices: THREE.Vector3[],
  barColor: string = '#fbbf24',
  detectedColor: string = '#fbbf24',
  idealColor: string = '#38bdf8'
): THREE.Mesh[] {
  const scaleData = computeLoomisMeasurementScale(vertices);
  const tubeMeshes: THREE.Mesh[] = [];

  // Parallel rod
  tubeMeshes.push(...build3DTubeFromPoints(scaleData.scaleBarPts, 0.04, barColor));

  // Measured anatomy ticks
  for (const tick of scaleData.ticksDetected) {
    tubeMeshes.push(...build3DTubeFromPoints(tick, 0.03, detectedColor));
  }

  // Ideal Loomis third ticks
  for (const tick of scaleData.ticksIdeal) {
    tubeMeshes.push(...build3DTubeFromPoints(tick, 0.03, idealColor));
  }

  return tubeMeshes;
}

export function generateConstructionRingMeshes(
  vertices: THREE.Vector3[],
  browColor: string = '#facc15',
  midlineColor: string = '#f87171',
  coronalColor: string = '#4ade80',
  sideDiscColor: string = '#c084fc'
): THREE.Mesh[] {
  const ringsData = computeConstructionRings(vertices);
  const tubeMeshes: THREE.Mesh[] = [];

  // Brow ring
  tubeMeshes.push(...build3DTubeFromPoints(ringsData.browRingPts, 0.03, browColor));

  // Midline ring
  tubeMeshes.push(...build3DTubeFromPoints(ringsData.midlineRingPts, 0.03, midlineColor));

  // Coronal ring
  tubeMeshes.push(...build3DTubeFromPoints(ringsData.coronalRingPts, 0.03, coronalColor));

  // Side discs
  for (const ring of ringsData.sideRingsPts) {
    tubeMeshes.push(...build3DTubeFromPoints(ring, 0.025, sideDiscColor));
  }

  // Side crosshairs
  for (const crossLine of ringsData.sideCrossPts) {
    tubeMeshes.push(...build3DTubeFromPoints(crossLine, 0.02, sideDiscColor));
  }

  return tubeMeshes;
}

export function generateGuideTubes(
  vertices: THREE.Vector3[],
  showLoomis: boolean = true,
  showReilly: boolean = true,
  loomisColor: string = '#ef4444',
  reillyColor: string = '#3b82f6',
  tubeRadius: number = 0.025
): THREE.Mesh[] {
  const guideMeshes: THREE.Mesh[] = [];

  if (showLoomis) {
    for (const indices of Object.values(LOOMIS_LINE_GROUPS)) {
      const validPoints = indices
        .filter((idx) => idx < vertices.length)
        .map((idx) => vertices[idx]);
      if (validPoints.length >= 2) {
        guideMeshes.push(...build3DTubeFromPoints(validPoints, tubeRadius, loomisColor));
      }
    }
  }

  if (showReilly) {
    for (const indices of Object.values(REILLY_LINE_GROUPS)) {
      const validPoints = indices
        .filter((idx) => idx < vertices.length)
        .map((idx) => vertices[idx]);
      if (validPoints.length >= 2) {
        guideMeshes.push(...build3DTubeFromPoints(validPoints, tubeRadius, reillyColor));
      }
    }
  }

  return guideMeshes;
}

export function applyPlanarFaceColors(
  geometry: THREE.BufferGeometry,
  baseColorHex: string = '#f4e6d3'
): THREE.BufferGeometry {
  const geo = geometry.clone();
  const posAttr = geo.attributes.position;
  if (!posAttr) return geo;

  const numVertices = posAttr.count;
  const colors = new Float32Array(numVertices * 3);

  const baseColor = new THREE.Color(baseColorHex);

  for (let i = 0; i < numVertices; i++) {
    colors[i * 3] = baseColor.r;
    colors[i * 3 + 1] = baseColor.g;
    colors[i * 3 + 2] = baseColor.b;
  }

  const planeColors: Record<string, string> = {
    'Forehead Central': '#f8efe4',
    'Nose Bridge': '#faf3eb',
    'Nose Sides Left': '#e6d5c2',
    'Nose Sides Right': '#e6d5c2',
    'Upper Lip Plane': '#ebd7c4',
    'Chin Plane': '#dcc6b1',
    'Left Cheek Plane': '#efe0d0',
    'Right Cheek Plane': '#efe0d0',
  };

  for (const [planeName, indices] of Object.entries(PLANAR_FACE_GROUPS)) {
    const colHex = planeColors[planeName] || baseColorHex;
    const col = new THREE.Color(colHex);
    for (const idx of indices) {
      if (idx < numVertices) {
        colors[idx * 3] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
      }
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
