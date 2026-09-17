import * as THREE from 'three';
import { type HandLandmarkData } from './handProcessor';

export interface HandStyleOptions {
  showJoints: boolean;
  showBones: boolean; // Tapered Faceted Phalanges with Chisel Tips
  showRings: boolean; // Banded Division Rings along Finger Pipes
  showPlanes: boolean; // Volumetric Palm Block, Wedges & Dorsal Tendon Ridges
  showWireframe: boolean;
  showLabels: boolean;
  jointColor: string;
  mcpColor: string;
  boneColor: string; // Phalanx block color
  ringColor: string; // Facet band color
  planeColor: string; // Palm main color
  thenarColor: string; // Thenar muscle color
  wireframeColor: string;
  shadingStyle: 'Faceted / Flat-Shaded' | 'Smooth-Shaded';
}

// Anatomical Finger Connections with Tapering Scale (startScale, endScale, isDistal)
export const FINGER_CONNECTIONS_FACETED: Array<[number, number, number, number, boolean]> = [
  // Thumb: Wrist->1, 1->2, 2->3, 3->4 (distal tip at 4)
  [0, 1, 1.30, 1.15, false],
  [1, 2, 1.15, 1.05, false],
  [2, 3, 1.05, 0.95, false],
  [3, 4, 0.95, 0.80, true],
  // Index finger: 5->6, 6->7, 7->8 (distal tip at 8)
  [5, 6, 1.15, 1.00, false],
  [6, 7, 1.00, 0.88, false],
  [7, 8, 0.88, 0.72, true],
  // Middle finger: 9->10, 10->11, 11->12 (distal tip at 12)
  [9, 10, 1.25, 1.10, false],
  [10, 11, 1.10, 0.95, false],
  [11, 12, 0.95, 0.78, true],
  // Ring finger: 13->14, 14->15, 15->16 (distal tip at 16)
  [13, 14, 1.15, 1.00, false],
  [14, 15, 1.00, 0.88, false],
  [15, 16, 0.88, 0.72, true],
  // Pinky finger: 17->18, 18->19, 19->20 (distal tip at 20)
  [17, 18, 1.00, 0.88, false],
  [18, 19, 0.88, 0.78, false],
  [19, 20, 0.78, 0.65, true],
];

export const TAPERED_FINGER_CONNECTIONS = FINGER_CONNECTIONS_FACETED;

const MCP_JOINTS = new Set([1, 5, 9, 13, 17]);
const IP_JOINTS = new Set([2, 3, 6, 7, 10, 11, 14, 15, 18, 19]);
const FINGER_BONE_BASE_WIDTH = 0.15;
const JOINT_BASE_WIDTH = 0.08;

/**
 * Computes a true dorsal normal invariant to handedness or mirror flips.
 * Natural finger flexion curls towards the palmar side (-normal).
 */
export function getConsistentDorsalNormal(landmarks: THREE.Vector3[]): THREE.Vector3 {
  const vLong = new THREE.Vector3().subVectors(landmarks[9], landmarks[0]); // Wrist to middle MCP
  const vLat = new THREE.Vector3().subVectors(landmarks[5], landmarks[17]); // Index MCP to pinky MCP
  const normal = new THREE.Vector3().crossVectors(vLong, vLat);

  if (normal.lengthSq() < 1e-8) {
    return new THREE.Vector3(0, 0, 1);
  }
  normal.normalize();

  // Natural finger flexion curl check: tips curl towards palmar side (-normal)
  // If dot(normal, curl_vec) > 0, flip normal so it always points dorsal
  const curlVec = new THREE.Vector3()
    .subVectors(landmarks[8], landmarks[5])
    .add(new THREE.Vector3().subVectors(landmarks[12], landmarks[9]));

  if (normal.dot(curlVec) > 0) {
    normal.negate();
  }
  return normal;
}

/**
 * Creates a faceted phalanx segment with hexagonal cross-section, embedded division band,
 * and tapered chisel distal tip for finger terminal phalanges.
 */
export function createFacetedPhalanxSingleBand(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  palmNormal: THREE.Vector3,
  w1: number,
  h1: number,
  w2: number,
  h2: number,
  colorBoneHex: string,
  colorBandHex: string,
  isDistal: boolean = false,
  showBand: boolean = true
): THREE.Group {
  const group = new THREE.Group();
  const vec = new THREE.Vector3().subVectors(p2, p1);
  const length = vec.length();
  if (length < 1e-4) return group;

  const boneDir = vec.clone().normalize();
  let sideVec = new THREE.Vector3().crossVectors(boneDir, palmNormal);
  if (sideVec.lengthSq() < 1e-8) {
    sideVec = new THREE.Vector3(1, 0, 0);
  } else {
    sideVec.normalize();
  }
  const dorsalVec = new THREE.Vector3().crossVectors(sideVec, boneDir).normalize();

  const cBone = new THREE.Color(colorBoneHex);
  const cBand = new THREE.Color(colorBandHex);

  const divisions = [
    { t: 0.00, isBand: false },
    { t: 0.44, isBand: false },
    { t: 0.56, isBand: showBand },
    { t: 1.00, isBand: false },
  ];

  const getCrossSection = (tVal: number): THREE.Vector3[] => {
    const w = w1 * (1.0 - tVal) + w2 * tVal;
    const h = h1 * (1.0 - tVal) + h2 * tVal;
    let center = p1.clone().add(vec.clone().multiplyScalar(tVal));

    if (isDistal && tVal === 1.0) {
      center.sub(boneDir.clone().multiplyScalar(length * 0.1));
    }

    return [
      center.clone().add(sideVec.clone().multiplyScalar(w * 0.50)).add(dorsalVec.clone().multiplyScalar(h * 0.40)),
      center.clone().sub(sideVec.clone().multiplyScalar(w * 0.50)).add(dorsalVec.clone().multiplyScalar(h * 0.40)),
      center.clone().sub(sideVec.clone().multiplyScalar(w * 0.55)).sub(dorsalVec.clone().multiplyScalar(h * 0.10)),
      center.clone().sub(sideVec.clone().multiplyScalar(w * 0.25)).sub(dorsalVec.clone().multiplyScalar(h * 0.60)),
      center.clone().add(sideVec.clone().multiplyScalar(w * 0.25)).sub(dorsalVec.clone().multiplyScalar(h * 0.60)),
      center.clone().add(sideVec.clone().multiplyScalar(w * 0.55)).sub(dorsalVec.clone().multiplyScalar(h * 0.10)),
    ];
  };

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Build vertices and colors
  divisions.forEach(({ t, isBand }) => {
    const pts = getCrossSection(t);
    const col = isBand ? cBand : cBone;
    pts.forEach((pt) => {
      positions.push(pt.x, pt.y, pt.z);
      colors.push(col.r, col.g, col.b);
    });
  });

  // Triangles for the 3 longitudinal segment rings (connect division seg to seg+1)
  for (let seg = 0; seg < 3; seg++) {
    const base1 = seg * 6;
    const base2 = (seg + 1) * 6;
    for (let i = 0; i < 6; i++) {
      const nextI = (i + 1) % 6;
      indices.push(base1 + i, base1 + nextI, base2 + nextI);
      indices.push(base1 + i, base2 + nextI, base2 + i);
    }
  }

  // Base cap (fan at division 0)
  for (let i = 1; i < 5; i++) {
    indices.push(0, i + 1, i);
  }

  // End cap or Tapered Chisel Distal Tip (at division 3)
  const lastBase = 3 * 6;
  if (isDistal) {
    const tipPt = p2.clone().add(dorsalVec.clone().multiplyScalar(h2 * 0.1));
    const tipIdx = positions.length / 3;
    positions.push(tipPt.x, tipPt.y, tipPt.z);
    colors.push(cBone.r, cBone.g, cBone.b);

    for (let i = 0; i < 6; i++) {
      const nextI = (i + 1) % 6;
      indices.push(lastBase + i, lastBase + nextI, tipIdx);
    }
  } else {
    for (let i = 1; i < 5; i++) {
      indices.push(lastBase, lastBase + i, lastBase + i + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.65,
    metalness: 0.05,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  // Crisp facet edge lines
  const edges = new THREE.EdgesGeometry(geo, 15);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x09090b,
    transparent: true,
    opacity: 0.5,
  });
  const line = new THREE.LineSegments(edges, lineMat);
  group.add(line);

  return group;
}

/**
 * Creates a slim, crisp dorsal tendon ridge mesh sitting on top of the dorsal palm deck.
 */
export function createDorsalTendon(
  pWrist: THREE.Vector3,
  pMcp: THREE.Vector3,
  palmNormal: THREE.Vector3,
  width: number,
  thickness: number,
  colorHex: string
): THREE.Group | null {
  const group = new THREE.Group();
  const vec = new THREE.Vector3().subVectors(pMcp, pWrist);
  const length = vec.length();
  if (length < 1e-4) return null;

  const dirVec = vec.clone().normalize();
  let sideVec = new THREE.Vector3().crossVectors(dirVec, palmNormal);
  if (sideVec.lengthSq() < 1e-8) {
    sideVec = new THREE.Vector3(1, 0, 0);
  } else {
    sideVec.normalize();
  }

  const wHalf = width * 0.5;
  const v0 = pWrist.clone().sub(sideVec.clone().multiplyScalar(wHalf * 0.4));
  const v1 = pWrist.clone().add(sideVec.clone().multiplyScalar(wHalf * 0.4));
  const v2 = pMcp.clone().add(sideVec.clone().multiplyScalar(wHalf));
  const v3 = pMcp.clone().sub(sideVec.clone().multiplyScalar(wHalf));
  const ridge = pWrist.clone().add(pMcp).multiplyScalar(0.5).add(palmNormal.clone().multiplyScalar(thickness));

  const verts = [v0, v1, v2, v3, ridge];
  const positions: number[] = [];
  verts.forEach((v) => positions.push(v.x, v.y, v.z));

  const faces = [
    [0, 1, 4],
    [1, 2, 4],
    [2, 3, 4],
    [3, 0, 4],
    [0, 3, 2],
    [0, 2, 1],
  ];

  const indices: number[] = [];
  faces.forEach(([a, b, c]) => indices.push(a, b, c));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.5,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  return group;
}

/**
 * Creates a standard polyhedron mesh given vertices, faces, and color.
 */
function createPolyhedronMesh(
  vertices: THREE.Vector3[],
  faces: number[][],
  colorHex: string,
  flatShading: boolean = true
): THREE.Mesh {
  const positions: number[] = [];
  faces.forEach(([a, b, c]) => {
    positions.push(vertices[a].x, vertices[a].y, vertices[a].z);
    positions.push(vertices[b].x, vertices[b].y, vertices[b].z);
    positions.push(vertices[c].x, vertices[c].y, vertices[c].z);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.5,
    metalness: 0.05,
    flatShading,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geo, mat);
}

/**
 * Generate 3D Three.js Group for a high-fidelity hand model with banded phalanx pipes,
 * tapered distal tips, solid palm convex block, thenar wedge, and dorsal tendon ridges.
 */
export function generateHandMeshGroup(
  handData: HandLandmarkData,
  options: HandStyleOptions,
  isCentered: boolean = false
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Hand_${handData.handIndex + 1}_${handData.handedness}`;

  const rawLandmarks = handData.landmarks;
  if (!rawLandmarks || rawLandmarks.length < 21) return group;

  // Center landmarks if requested
  let landmarks = rawLandmarks;
  if (isCentered) {
    const centroid = new THREE.Vector3();
    rawLandmarks.forEach((pt) => centroid.add(pt));
    centroid.divideScalar(rawLandmarks.length);

    landmarks = rawLandmarks.map((pt) => pt.clone().sub(centroid));
  }

  // Consistent Dorsal Normal calculation invariant to handedness & flexion curl
  const palmNormal = getConsistentDorsalNormal(landmarks);

  // Base dimensions scale
  const wristPt = landmarks[0];
  const p5 = landmarks[5];
  const p17 = landmarks[17];
  const palmSpan = p5.distanceTo(p17);
  const baseDim = Math.max(2.5, palmSpan);
  const baseBoneWidth = baseDim * FINGER_BONE_BASE_WIDTH;
  const sphereRadius = baseDim * JOINT_BASE_WIDTH;

  const flatShading = options.shadingStyle === 'Faceted / Flat-Shaded';

  // 1. Volumetric Palm Block, Thenar/Hypothenar Wedges & Slim Tendon Ridges
  if (options.showPlanes) {
    const wristThickness = baseDim * 0.16;
    const knuckleThickness = wristThickness * 0.55;

    // A. Main Palm Block (Wrist 0, MCPs 5, 9, 13, 17)
    const mcpIndices = [0, 5, 9, 13, 17];
    const mPts = mcpIndices.map((idx) => landmarks[idx]);

    const topPts = mPts.map((pt) => pt.clone().add(palmNormal.clone().multiplyScalar(knuckleThickness * 0.45)));
    const botPts = mPts.map((pt) => pt.clone().sub(palmNormal.clone().multiplyScalar(knuckleThickness * 0.70)));
    // Deepen carpal canal at wrist
    botPts[0].sub(palmNormal.clone().multiplyScalar(wristThickness * 0.3));

    const mainVerts = [...topPts, ...botPts];
    const mainFaces = [
      // Top Cap
      [0, 1, 2], [0, 2, 3], [0, 3, 4],
      // Bottom Cap
      [5, 7, 6], [5, 8, 7], [5, 9, 8],
      // Sides around border
      [0, 5, 6], [0, 6, 1],
      [1, 6, 7], [1, 7, 2],
      [2, 7, 8], [2, 8, 3],
      [3, 8, 9], [3, 9, 4],
      [4, 9, 5], [4, 5, 0],
    ];

    const palmMesh = createPolyhedronMesh(mainVerts, mainFaces, options.planeColor, flatShading);
    group.add(palmMesh);

    // B. Slim Crisp Tendon Ridges (Sitting on dorsal deck)
    const wristDorsal = topPts[0];
    const mcpDeckIndices = [1, 2, 3, 4]; // corresponding to MCPs 5, 9, 13, 17
    mcpDeckIndices.forEach((deckIdx, i) => {
      const mcpIdx = [5, 9, 13, 17][i];
      const mcpDorsal = topPts[deckIdx];
      const ridge = createDorsalTendon(
        wristDorsal,
        mcpDorsal,
        palmNormal,
        baseBoneWidth * 0.20,
        knuckleThickness * 0.18,
        options.boneColor
      );
      if (ridge) {
        group.add(ridge);
      }
    });

    // C. Thenar Muscle Wedge (Wrist 0, CMC 1, MCP 2, Index MCP 5)
    const thenarIndices = [0, 1, 2, 5];
    const thenarPts = thenarIndices.map((idx) => landmarks[idx]);

    let thumbOutward = new THREE.Vector3().crossVectors(
      landmarks[5].clone().sub(landmarks[0]),
      palmNormal
    );
    if (thumbOutward.lengthSq() > 1e-8) {
      thumbOutward.normalize();
    } else {
      thumbOutward.set(1, 0, 0);
    }
    if (thumbOutward.dot(landmarks[2].clone().sub(landmarks[5])) < 0) {
      thumbOutward.negate();
    }

    const tTop = thenarPts.map((pt) => pt.clone().add(palmNormal.clone().multiplyScalar(knuckleThickness * 0.35)));
    const tBot = thenarPts.map((pt) =>
      pt
        .clone()
        .sub(palmNormal.clone().multiplyScalar(wristThickness * 0.55))
        .add(thumbOutward.clone().multiplyScalar(knuckleThickness * 0.25))
    );

    const thenarVerts = [...tTop, ...tBot];
    const thenarFaces = [
      [0, 1, 2], [0, 2, 3],
      [4, 6, 5], [4, 7, 6],
      [0, 4, 5], [0, 5, 1],
      [1, 5, 6], [1, 6, 2],
      [2, 6, 7], [2, 7, 3],
      [3, 7, 4], [3, 4, 0],
    ];

    const thenarMesh = createPolyhedronMesh(thenarVerts, thenarFaces, options.thenarColor, flatShading);
    group.add(thenarMesh);

    // D. Hypothenar Muscle Cushion (Pinky Heel)
    const hypoMid = landmarks[0].clone().add(landmarks[17]).multiplyScalar(0.5);
    let lateralDir = landmarks[17].clone().sub(landmarks[5]);
    if (lateralDir.lengthSq() > 1e-8) {
      lateralDir.normalize();
    } else {
      lateralDir.set(1, 0, 0);
    }

    const hypoTop = [landmarks[0], landmarks[17], hypoMid].map((pt) =>
      pt.clone().add(palmNormal.clone().multiplyScalar(knuckleThickness * 0.35))
    );
    const hypoBulge = hypoMid
      .clone()
      .add(lateralDir.clone().multiplyScalar(knuckleThickness * 0.30))
      .sub(palmNormal.clone().multiplyScalar(wristThickness * 0.50));

    const hypoVerts = [...hypoTop, hypoBulge];
    const hypoFaces = [
      [0, 1, 2],
      [0, 2, 3],
      [1, 3, 2],
      [0, 3, 1],
    ];

    const hypoMesh = createPolyhedronMesh(hypoVerts, hypoFaces, options.thenarColor, flatShading);
    group.add(hypoMesh);
  }

  // 2. Joint Spheres
  if (options.showJoints) {
    const baseJointMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.jointColor),
      roughness: 0.35,
      metalness: 0.1,
      flatShading,
    });

    const mcpJointMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.mcpColor),
      roughness: 0.35,
      metalness: 0.1,
      flatShading,
    });

    const sphereGeo = new THREE.IcosahedronGeometry(sphereRadius, 2);

    landmarks.forEach((pt, idx) => {
      let rScale = 0.95;
      let mat = baseJointMat;

      if (idx === 0) {
        rScale = 1.3;
      } else if (MCP_JOINTS.has(idx)) {
        rScale = 1.15;
        mat = mcpJointMat;
      } else if (IP_JOINTS.has(idx)) {
        rScale = 0.95;
      } else {
        return;
      }

      const sphereMesh = new THREE.Mesh(sphereGeo, mat);
      sphereMesh.position.copy(pt);
      sphereMesh.scale.setScalar(rScale);
      group.add(sphereMesh);
    });
  }

  // 3. Faceted Phalanges with Banded Divisions & Tapered Chisel Distal Tips
  if (options.showBones) {
    FINGER_CONNECTIONS_FACETED.forEach(([startIdx, endIdx, sScale, eScale, isDistal]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (!p1 || !p2) return;

      const wStart = baseBoneWidth * sScale;
      const hStart = baseBoneWidth * 0.95 * sScale;
      const wEnd = baseBoneWidth * eScale;
      const hEnd = baseBoneWidth * 0.95 * eScale;

      const boneGroup = createFacetedPhalanxSingleBand(
        p1,
        p2,
        palmNormal,
        wStart,
        hStart,
        wEnd,
        hEnd,
        options.boneColor,
        options.ringColor,
        isDistal,
        options.showRings
      );
      group.add(boneGroup);
    });
  }

  // 4. Wireframe Skeleton Overlay
  if (options.showWireframe) {
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(options.wireframeColor),
      wireframe: true,
    });

    const wireGroup = new THREE.Group();
    FINGER_CONNECTIONS_FACETED.forEach(([startIdx, endIdx]) => {
      const pStart = landmarks[startIdx];
      const pEnd = landmarks[endIdx];
      if (!pStart || !pEnd) return;

      const lineGeo = new THREE.BufferGeometry().setFromPoints([pStart, pEnd]);
      const line = new THREE.Line(lineGeo, wireMat);
      wireGroup.add(line);
    });

    group.add(wireGroup);
  }

  // 5. Handedness Badge / Label
  if (options.showLabels) {
    const wrist = landmarks[0];
    const middleTip = landmarks[12];
    const labelPos = middleTip
      ? new THREE.Vector3(middleTip.x, middleTip.y + 0.8, middleTip.z)
      : new THREE.Vector3(wrist.x, wrist.y + 5.0, wrist.z);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 256, 128);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#06b6d4';
      ctx.strokeRect(4, 4, 248, 120);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Hand #${handData.handIndex + 1}`, 128, 52);

      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`${handData.handedness} Hand`, 128, 92);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(labelPos);
    sprite.scale.set(2.4, 1.2, 1.0);
    group.add(sprite);
  }

  return group;
}
