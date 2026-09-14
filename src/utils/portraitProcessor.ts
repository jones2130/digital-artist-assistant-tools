import * as THREE from 'three';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let landmarkerInstance: FaceLandmarker | null = null;

export function parseCanonicalObj(objText: string): {
  geometry: THREE.BufferGeometry;
  vertices: THREE.Vector3[];
} {
  const lines = objText.split('\n');
  const positions: number[] = [];
  const vertices: THREE.Vector3[] = [];
  const indices: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/).filter(Boolean).slice(1).map(Number);
      if (parts.length >= 3) {
        positions.push(parts[0], parts[1], parts[2]);
        vertices.push(new THREE.Vector3(parts[0], parts[1], parts[2]));
      }
    } else if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).filter(Boolean).slice(1);
      const faceIndices = parts.map((p) => {
        const vIdx = parseInt(p.split('/')[0], 10);
        return vIdx - 1; // Convert 1-indexed OBJ to 0-indexed vertex array
      });
      if (faceIndices.length === 3) {
        indices.push(faceIndices[0], faceIndices[1], faceIndices[2]);
      } else if (faceIndices.length === 4) {
        indices.push(faceIndices[0], faceIndices[1], faceIndices[2]);
        indices.push(faceIndices[0], faceIndices[2], faceIndices[3]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, vertices };
}

export async function initFaceLandmarker(basePath: string = ''): Promise<FaceLandmarker | null> {
  if (landmarkerInstance) return landmarkerInstance;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    const modelPath = `${basePath}/models/face_landmarker.task`.replace(/\/+/g, '/');
    landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
    });
    return landmarkerInstance;
  } catch (err) {
    console.warn('GPU delegate fallback to CPU for MediaPipe FaceLandmarker:', err);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      const modelPath = `${basePath}/models/face_landmarker.task`.replace(/\/+/g, '/');
      landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numFaces: 1,
      });
      return landmarkerInstance;
    } catch (e) {
      console.error('Failed to initialize FaceLandmarker:', e);
      return null;
    }
  }
}

export async function extractLandmarksFromImage(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  basePath: string = ''
): Promise<THREE.Vector3[] | null> {
  const landmarker = await initFaceLandmarker(basePath);
  if (!landmarker) return null;

  try {
    const result = landmarker.detect(imageSource);
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return null;
    }

    const landmarks = result.faceLandmarks[0];
    const w = imageSource.width || 500;
    const h = imageSource.height || 500;
    const maxDim = Math.max(h, w);

    const coords: THREE.Vector3[] = landmarks.map((lm) => {
      const x = ((lm.x - 0.5) * w) / maxDim;
      const y = -((lm.y - 0.5) * h) / maxDim;
      const z = (-lm.z * w) / maxDim;
      return new THREE.Vector3(x, y, z);
    });

    return coords;
  } catch (e) {
    console.error('Error extracting face landmarks:', e);
    return null;
  }
}

export interface AnatomicalFrame {
  glabella: THREE.Vector3;
  hairline: THREE.Vector3;
  subnasale: THREE.Vector3;
  chin: THREE.Vector3;
  leftTemple: THREE.Vector3;
  rightTemple: THREE.Vector3;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
}

export function computeAnatomicalFrame(vertices: THREE.Vector3[]): AnatomicalFrame {
  const glabella = vertices[168] ? vertices[168].clone() : new THREE.Vector3(0, 2, 0);
  const hairline = vertices[10] ? vertices[10].clone() : new THREE.Vector3(0, 5, 0);
  const subnasale = vertices[2] ? vertices[2].clone() : new THREE.Vector3(0, -1, 0);
  const chin = vertices[152] ? vertices[152].clone() : new THREE.Vector3(0, -5, 0);
  const leftTemple = vertices[234] ? vertices[234].clone() : new THREE.Vector3(-3, 1, 0);
  const rightTemple = vertices[454] ? vertices[454].clone() : new THREE.Vector3(3, 1, 0);

  const xAxis = new THREE.Vector3().subVectors(rightTemple, leftTemple).normalize();

  const yAxis = new THREE.Vector3().subVectors(hairline, chin);
  const xProj = xAxis.clone().multiplyScalar(yAxis.dot(xAxis));
  yAxis.sub(xProj).normalize();

  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

  return {
    glabella,
    hairline,
    subnasale,
    chin,
    leftTemple,
    rightTemple,
    xAxis,
    yAxis,
    zAxis,
  };
}

export function deformVertices(
  baseVertices: THREE.Vector3[],
  landmarks: THREE.Vector3[]
): THREE.Vector3[] {
  const minCount = Math.min(baseVertices.length, landmarks.length);
  if (minCount <= 10) return baseVertices.map((v) => v.clone());

  const deformed = baseVertices.map((v) => v.clone());

  const targetPts = landmarks.slice(0, minCount);
  const basePts = baseVertices.slice(0, minCount);

  const targetCenter = new THREE.Vector3();
  targetPts.forEach((p) => targetCenter.add(p));
  targetCenter.divideScalar(minCount);

  const baseCenter = new THREE.Vector3();
  basePts.forEach((p) => baseCenter.add(p));
  baseCenter.divideScalar(minCount);

  let baseScale = 0;
  basePts.forEach((p) => {
    baseScale = Math.max(baseScale, p.distanceTo(baseCenter));
  });

  let targetScale = 0;
  targetPts.forEach((p) => {
    targetScale = Math.max(targetScale, p.clone().sub(targetCenter).length());
  });

  if (targetScale > 1e-6) {
    const scaleFactor = baseScale / targetScale;
    for (let i = 0; i < minCount; i++) {
      const scaledTarget = targetPts[i]
        .clone()
        .sub(targetCenter)
        .multiplyScalar(scaleFactor)
        .add(baseCenter);
      deformed[i].lerpVectors(basePts[i], scaledTarget, 0.85);
    }
  }

  return deformed;
}

export function computeLoomisMeasurementScale(vertices: THREE.Vector3[]) {
  const frame = computeAnatomicalFrame(vertices);
  const { glabella, hairline, subnasale, chin, leftTemple, rightTemple, xAxis, yAxis, zAxis } = frame;

  const faceH = hairline.distanceTo(chin);

  const yHairline = hairline.dot(yAxis);
  const yBrow = glabella.dot(yAxis);
  const yNose = subnasale.dot(yAxis);
  const yChin = chin.dot(yAxis);

  const totalH = yHairline - yChin;
  const idealUnit = totalH / 3.0;
  const yIdealBrow = yHairline - idealUnit;
  const yIdealNose = yHairline - 2.0 * idealUnit;

  const scaleXOffset = rightTemple.distanceTo(leftTemple) * 0.42;
  const scaleZOffset = faceH * 0.15;

  const scaleBaseOrigin = chin
    .clone()
    .add(xAxis.clone().multiplyScalar(scaleXOffset))
    .add(zAxis.clone().multiplyScalar(scaleZOffset));

  const barStart = scaleBaseOrigin
    .clone()
    .add(yAxis.clone().multiplyScalar(yChin - scaleBaseOrigin.dot(yAxis)));
  const barEnd = scaleBaseOrigin
    .clone()
    .add(yAxis.clone().multiplyScalar(yHairline - scaleBaseOrigin.dot(yAxis)));

  const scaleBarPts: [THREE.Vector3, THREE.Vector3] = [barStart, barEnd];
  const tickLen = faceH * 0.15;

  const makeTick = (yVal: number, length: number = tickLen): [THREE.Vector3, THREE.Vector3] => {
    const ptBase = scaleBaseOrigin
      .clone()
      .add(yAxis.clone().multiplyScalar(yVal - scaleBaseOrigin.dot(yAxis)));
    const ptExt = ptBase.clone().add(xAxis.clone().multiplyScalar(length));
    return [ptBase, ptExt];
  };

  const ticksDetected = [
    makeTick(yHairline),
    makeTick(yBrow),
    makeTick(yNose),
    makeTick(yChin),
  ];

  const ticksIdeal = [
    makeTick(yIdealBrow, tickLen * 1.3),
    makeTick(yIdealNose, tickLen * 1.3),
  ];

  return {
    scaleBarPts,
    ticksDetected,
    ticksIdeal,
  };
}

export function computeConstructionRings(vertices: THREE.Vector3[]) {
  const frame = computeAnatomicalFrame(vertices);
  const { glabella, hairline, chin, xAxis, yAxis, zAxis } = frame;

  const faceH = hairline.distanceTo(chin);
  const radius = faceH * 0.5;

  const center = glabella
    .clone()
    .sub(zAxis.clone().multiplyScalar(radius * 1.02))
    .add(yAxis.clone().multiplyScalar(radius * 0.04));

  const sideClip = radius * 0.84;
  const numSteps = 96;
  const thetaStep = (Math.PI * 2) / numSteps;

  const browRingPts: THREE.Vector3[] = [];
  const midlineRingPts: THREE.Vector3[] = [];
  const coronalRingPts: THREE.Vector3[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const t = i * thetaStep;

    // Brow Ring
    const browPt = center
      .clone()
      .add(
        xAxis
          .clone()
          .multiplyScalar(radius * 0.99 * 0.86 * Math.cos(t))
      )
      .sub(
        zAxis
          .clone()
          .multiplyScalar(radius * 0.99 * Math.sin(t))
      );
    browRingPts.push(browPt);

    // Midline Ring
    const midPt = center
      .clone()
      .add(
        yAxis
          .clone()
          .multiplyScalar(radius * 0.99 * Math.cos(t))
      )
      .sub(
        zAxis
          .clone()
          .multiplyScalar(radius * 0.99 * Math.sin(t))
      );
    midlineRingPts.push(midPt);

    // Coronal Ring
    const corPt = center
      .clone()
      .add(
        xAxis
          .clone()
          .multiplyScalar(radius * 0.99 * 0.86 * Math.cos(t))
      )
      .add(
        yAxis
          .clone()
          .multiplyScalar(radius * 0.99 * Math.sin(t))
      );
    coronalRingPts.push(corPt);
  }

  const discRadius = radius * 0.53;
  const sideRingsPts: THREE.Vector3[][] = [];
  const sideCrossPts: [THREE.Vector3, THREE.Vector3][] = [];

  [-1.0, 1.0].forEach((sideSign) => {
    const discCenter = center.clone().add(xAxis.clone().multiplyScalar(sideSign * sideClip));
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= numSteps; i++) {
      const t = i * thetaStep;
      const pt = discCenter
        .clone()
        .add(zAxis.clone().multiplyScalar(discRadius * Math.cos(t)))
        .add(yAxis.clone().multiplyScalar(discRadius * Math.sin(t)));
      ringPts.push(pt);
    }
    sideRingsPts.push(ringPts);

    const crossH: [THREE.Vector3, THREE.Vector3] = [
      discCenter.clone().sub(zAxis.clone().multiplyScalar(discRadius)),
      discCenter.clone().add(zAxis.clone().multiplyScalar(discRadius)),
    ];
    const crossV: [THREE.Vector3, THREE.Vector3] = [
      discCenter.clone().sub(yAxis.clone().multiplyScalar(discRadius)),
      discCenter.clone().add(yAxis.clone().multiplyScalar(discRadius)),
    ];
    sideCrossPts.push(crossH, crossV);
  });

  return {
    browRingPts,
    midlineRingPts,
    coronalRingPts,
    sideRingsPts,
    sideCrossPts,
  };
}
