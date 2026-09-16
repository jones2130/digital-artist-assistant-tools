import * as THREE from 'three';
import { type HandLandmarkData } from './handProcessor';

export interface HandStyleOptions {
  showJoints: boolean;
  showBones: boolean; // Tapered Bridgman Phalanx/Tendon blocks
  showRings: boolean; // Foreshortening Torus Rings
  showPlanes: boolean; // Volumetric Palm Block & Thenar Wedge
  showWireframe: boolean;
  showLabels: boolean;
  jointColor: string;
  mcpColor: string;
  boneColor: string; // Tendon/phalanx block color
  ringColor: string;
  planeColor: string; // Palm main color
  thenarColor: string; // Thenar muscle color
  wireframeColor: string;
  shadingStyle: 'Faceted / Flat-Shaded' | 'Smooth-Shaded';
}

// Anatomical Finger Connections with Tapering Scale (startScale, endScale)
export const TAPERED_FINGER_CONNECTIONS: Array<[number, number, number, number]> = [
  // Thumb: Wrist->1, 1->2, 2->3, 3->4
  [0, 1, 1.15, 1.0],
  [1, 2, 1.0, 0.9],
  [2, 3, 0.9, 0.8],
  [3, 4, 0.8, 0.65],
  // Index finger: 5->6, 6->7, 7->8
  [5, 6, 1.0, 0.85],
  [6, 7, 0.85, 0.75],
  [7, 8, 0.75, 0.6],
  // Middle finger: 9->10, 10->11, 11->12
  [9, 10, 1.1, 0.95],
  [10, 11, 0.95, 0.8],
  [11, 12, 0.8, 0.65],
  // Ring finger: 13->14, 14->15, 15->16
  [13, 14, 1.0, 0.85],
  [14, 15, 0.85, 0.75],
  [15, 16, 0.75, 0.6],
  // Pinky finger: 17->18, 18->19, 19->20
  [17, 18, 0.85, 0.75],
  [18, 19, 0.75, 0.65],
  [19, 20, 0.65, 0.5],
];

const MCP_JOINTS = new Set([1, 5, 9, 13, 17]);
const TIPS = new Set([4, 8, 12, 16, 20]);

/**
 * Helper to build 8-vertex tapered 3D boxy phalanx/tendon block mesh
 */
function createTaperedBoxyBlock(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  sScale: number,
  eScale: number,
  palmNormal: THREE.Vector3,
  baseWidth: number,
  material: THREE.Material,
  flatShading: boolean
): THREE.Group {
  const group = new THREE.Group();
  const vec = new THREE.Vector3().subVectors(p2, p1);
  const length = vec.length();
  if (length < 0.001) return group;

  const boneDir = vec.clone().normalize();

  let sideVec = new THREE.Vector3().crossVectors(boneDir, palmNormal);
  if (sideVec.lengthSq() < 1e-4) {
    sideVec = new THREE.Vector3(1, 0, 0);
  } else {
    sideVec.normalize();
  }

  const normVec = new THREE.Vector3().crossVectors(sideVec, boneDir).normalize();

  const wStart = baseWidth * sScale * 0.5;
  const hStart = baseWidth * 0.75 * sScale * 0.5;
  const wEnd = baseWidth * eScale * 0.5;
  const hEnd = baseWidth * 0.75 * eScale * 0.5;

  // 8 Vertices of tapered block
  const v0 = p1.clone().add(sideVec.clone().multiplyScalar(wStart)).add(normVec.clone().multiplyScalar(hStart));
  const v1 = p1.clone().sub(sideVec.clone().multiplyScalar(wStart)).add(normVec.clone().multiplyScalar(hStart));
  const v2 = p1.clone().sub(sideVec.clone().multiplyScalar(wStart)).sub(normVec.clone().multiplyScalar(hStart));
  const v3 = p1.clone().add(sideVec.clone().multiplyScalar(wStart)).sub(normVec.clone().multiplyScalar(hStart));

  const v4 = p2.clone().add(sideVec.clone().multiplyScalar(wEnd)).add(normVec.clone().multiplyScalar(hEnd));
  const v5 = p2.clone().sub(sideVec.clone().multiplyScalar(wEnd)).add(normVec.clone().multiplyScalar(hEnd));
  const v6 = p2.clone().sub(sideVec.clone().multiplyScalar(wEnd)).sub(normVec.clone().multiplyScalar(hEnd));
  const v7 = p2.clone().add(sideVec.clone().multiplyScalar(wEnd)).sub(normVec.clone().multiplyScalar(hEnd));

  const verts = [v0, v1, v2, v3, v4, v5, v6, v7];

  const faces = [
    // Top & Bottom caps
    [0, 1, 2], [0, 2, 3],
    [4, 6, 5], [4, 7, 6],
    // 4 Sides
    [0, 4, 5], [0, 5, 1],
    [1, 5, 6], [1, 6, 2],
    [2, 6, 7], [2, 7, 3],
    [3, 7, 4], [3, 4, 0],
  ];

  const positions: number[] = [];
  faces.forEach(([a, b, c]) => {
    positions.push(verts[a].x, verts[a].y, verts[a].z);
    positions.push(verts[b].x, verts[b].y, verts[b].z);
    positions.push(verts[c].x, verts[c].y, verts[c].z);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  group.add(mesh);

  // Add edge lines for artistic Bridgman boxy rendering
  const edgesGeo = new THREE.EdgesGeometry(geo, 15);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.6,
    linewidth: 1,
  });
  const edgesLine = new THREE.LineSegments(edgesGeo, lineMat);
  group.add(edgesLine);

  return group;
}

/**
 * Generate 3D Three.js Group for a high-fidelity hand model with finger tapering and foreshortening rings.
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

  const wristPt = landmarks[0];
  const p5 = landmarks[5];
  const p17 = landmarks[17];

  // Palm Normal Vector calculated from wrist -> index MCP & pinky MCP
  const v1 = new THREE.Vector3().subVectors(p5, wristPt);
  const v2 = new THREE.Vector3().subVectors(p17, wristPt);
  const palmNormal = new THREE.Vector3().crossVectors(v1, v2);
  if (palmNormal.lengthSq() > 1e-4) {
    palmNormal.normalize();
  } else {
    palmNormal.set(0, 0, 1);
  }

  // Base dimensions scale
  const palmSpan = p5.distanceTo(p17);
  const baseDim = Math.max(2.5, palmSpan);
  const baseWidth = baseDim * 0.28;
  const sphereRadius = baseDim * 0.08;

  const flatShading = options.shadingStyle === 'Faceted / Flat-Shaded';

  // 1. Volumetric Main Palm Block & Thenar Wedge
  if (options.showPlanes) {
    const palmMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.planeColor),
      roughness: 0.5,
      metalness: 0.05,
      flatShading,
      side: THREE.DoubleSide,
    });

    const thenarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.thenarColor),
      roughness: 0.5,
      metalness: 0.05,
      flatShading,
      side: THREE.DoubleSide,
    });

    // Main Palm Block (Wrist -> MCPs 1, 5, 9, 13, 17)
    const mcpIndices = [1, 5, 9, 13, 17];
    const mcpPts = mcpIndices.map((idx) => landmarks[idx]);
    const wristThickness = baseDim * 0.12;
    const knuckleThickness = baseDim * 0.14;

    const mainTop = [
      wristPt.clone().add(palmNormal.clone().multiplyScalar(wristThickness)),
      ...mcpPts.map((pt) => pt.clone().add(palmNormal.clone().multiplyScalar(knuckleThickness))),
    ];

    const mainBot = [
      wristPt.clone().sub(palmNormal.clone().multiplyScalar(wristThickness)),
      ...mcpPts.map((pt) => pt.clone().sub(palmNormal.clone().multiplyScalar(knuckleThickness))),
    ];

    const mainVerts = [...mainTop, ...mainBot];
    const mainFaces = [
      // Top Cap
      [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5],
      // Bottom Cap
      [6, 8, 7], [6, 9, 8], [6, 10, 9], [6, 11, 10],
      // Sides
      [0, 6, 7], [0, 7, 1],
      [1, 7, 8], [1, 8, 2],
      [2, 8, 9], [2, 9, 3],
      [3, 9, 10], [3, 10, 4],
      [4, 10, 11], [4, 11, 5],
      [5, 11, 6], [5, 6, 0],
    ];

    const mainPositions: number[] = [];
    mainFaces.forEach(([a, b, c]) => {
      mainPositions.push(mainVerts[a].x, mainVerts[a].y, mainVerts[a].z);
      mainPositions.push(mainVerts[b].x, mainVerts[b].y, mainVerts[b].z);
      mainPositions.push(mainVerts[c].x, mainVerts[c].y, mainVerts[c].z);
    });

    const mainGeo = new THREE.BufferGeometry();
    mainGeo.setAttribute('position', new THREE.Float32BufferAttribute(mainPositions, 3));
    mainGeo.computeVertexNormals();

    const mainPalmMesh = new THREE.Mesh(mainGeo, palmMat);
    group.add(mainPalmMesh);

    // Thenar Muscle Wedge (Wrist 0, Thumb CMC 1, Thumb MCP 2, Index MCP 5)
    const thenarIndices = [0, 1, 2, 5];
    const thenarPts = thenarIndices.map((idx) => landmarks[idx]);
    const thenarThicknesses = [
      wristThickness * 1.2,
      wristThickness * 1.1,
      wristThickness * 0.8,
      knuckleThickness * 1.0,
    ];

    const thenarTop = thenarPts.map((pt, i) =>
      pt.clone().add(palmNormal.clone().multiplyScalar(thenarThicknesses[i]))
    );
    const thenarBot = thenarPts.map((pt, i) =>
      pt.clone().sub(palmNormal.clone().multiplyScalar(thenarThicknesses[i]))
    );

    const thenarVerts = [...thenarTop, ...thenarBot];
    const thenarFaces = [
      [0, 1, 2], [0, 2, 3],
      [4, 6, 5], [4, 7, 6],
      [0, 4, 5], [0, 5, 1],
      [1, 5, 6], [1, 6, 2],
      [2, 6, 7], [2, 7, 3],
      [3, 7, 4], [3, 4, 0],
    ];

    const thenarPositions: number[] = [];
    thenarFaces.forEach(([a, b, c]) => {
      thenarPositions.push(thenarVerts[a].x, thenarVerts[a].y, thenarVerts[a].z);
      thenarPositions.push(thenarVerts[b].x, thenarVerts[b].y, thenarVerts[b].z);
      thenarPositions.push(thenarVerts[c].x, thenarVerts[c].y, thenarVerts[c].z);
    });

    const thenarGeo = new THREE.BufferGeometry();
    thenarGeo.setAttribute('position', new THREE.Float32BufferAttribute(thenarPositions, 3));
    thenarGeo.computeVertexNormals();

    const thenarMesh = new THREE.Mesh(thenarGeo, thenarMat);
    group.add(thenarMesh);
  }

  // 2. Anatomically Scaled Joint Spheres
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
        // Wrist
        rScale = 1.3;
      } else if (MCP_JOINTS.has(idx)) {
        // MCP Knuckles (Orange / Custom MCP color)
        rScale = 1.15;
        mat = mcpJointMat;
      } else if (TIPS.has(idx)) {
        // Tips
        rScale = 0.85;
      } else {
        // IP Joints (Yellow / Custom Joint color)
        rScale = 0.95;
      }

      const sphereMesh = new THREE.Mesh(sphereGeo, mat);
      sphereMesh.position.copy(pt);
      sphereMesh.scale.setScalar(rScale);
      group.add(sphereMesh);
    });
  }

  // 3. Bridgman Tapered Phalanx/Tendon Blocks
  if (options.showBones) {
    const boneMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.boneColor),
      roughness: 0.45,
      metalness: 0.05,
      flatShading,
      side: THREE.DoubleSide,
    });

    TAPERED_FINGER_CONNECTIONS.forEach(([startIdx, endIdx, sScale, eScale]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      if (!p1 || !p2) return;

      const blockGroup = createTaperedBoxyBlock(
        p1,
        p2,
        sScale,
        eScale,
        palmNormal,
        baseWidth,
        boneMat,
        flatShading
      );
      group.add(blockGroup);
    });
  }

  // 4. Foreshortening Torus Rings Between Joints
  if (options.showRings) {
    const ringMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.ringColor),
      roughness: 0.3,
      metalness: 0.2,
      flatShading: false,
    });

    TAPERED_FINGER_CONNECTIONS.forEach(([startIdx, endIdx, sScale, eScale]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      if (!p1 || !p2) return;

      const vec = new THREE.Vector3().subVectors(p2, p1);
      const length = vec.length();
      if (length < 0.001) return;

      const dir = vec.clone().normalize();

      // Place rings at 35% and 70% along finger segment
      const ringPositionsT = [0.35, 0.7];

      ringPositionsT.forEach((t) => {
        const ringCenter = new THREE.Vector3().addVectors(p1, vec.clone().multiplyScalar(t));
        const currScale = (1.0 - t) * sScale + t * eScale;
        const rMajor = baseWidth * currScale * 0.58;
        const rMinor = baseWidth * 0.07;

        const torusGeo = new THREE.TorusGeometry(rMajor, rMinor, 12, 24);
        const ringMesh = new THREE.Mesh(torusGeo, ringMat);

        ringMesh.position.copy(ringCenter);

        // Align torus Z-axis to bone direction vector
        const defaultNormal = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultNormal, dir);
        ringMesh.setRotationFromQuaternion(quaternion);

        group.add(ringMesh);
      });
    });
  }

  // 5. Wireframe Skeleton Overlay
  if (options.showWireframe) {
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(options.wireframeColor),
      wireframe: true,
    });

    const wireGroup = new THREE.Group();
    TAPERED_FINGER_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const pStart = landmarks[startIdx];
      const pEnd = landmarks[endIdx];

      if (!pStart || !pEnd) return;

      const lineGeo = new THREE.BufferGeometry().setFromPoints([pStart, pEnd]);
      const line = new THREE.Line(lineGeo, wireMat);
      wireGroup.add(line);
    });

    group.add(wireGroup);
  }

  // 6. Handedness Badge / Label
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
