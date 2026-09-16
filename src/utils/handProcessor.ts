import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export interface HandLandmarkData {
  handIndex: number;
  handedness: 'Left' | 'Right' | 'Unknown';
  score: number;
  landmarks: THREE.Vector3[];
  worldLandmarks: THREE.Vector3[];
}

export const HAND_CONNECTIONS: Array<[number, number]> = [
  // Wrist & Palm base connections
  [0, 1],
  [0, 5],
  [0, 9],
  [0, 13],
  [0, 17],
  // Palm transverse connections
  [5, 9],
  [9, 13],
  [13, 17],
  // Thumb
  [1, 2],
  [2, 3],
  [3, 4],
  // Index finger
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle finger
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring finger
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky finger
  [17, 18],
  [18, 19],
  [19, 20],
];

let handLandmarkerInstance: HandLandmarker | null = null;
let currentMaxHands: number = 2;

export async function initHandLandmarker(
  numHands: number = 2,
  basePath: string = ''
): Promise<HandLandmarker | null> {
  if (handLandmarkerInstance && currentMaxHands === numHands) {
    return handLandmarkerInstance;
  }

  if (handLandmarkerInstance) {
    try {
      handLandmarkerInstance.close();
    } catch (e) {
      console.warn('Error closing previous HandLandmarker instance:', e);
    }
    handLandmarkerInstance = null;
  }

  const modelPath = `${basePath}/models/hand_landmarker.task`.replace(/\/+/g, '/');

  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numHands: numHands,
    });
    currentMaxHands = numHands;
    return handLandmarkerInstance;
  } catch (err) {
    console.warn('GPU delegate fallback to CPU for MediaPipe HandLandmarker:', err);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numHands: numHands,
      });
      currentMaxHands = numHands;
      return handLandmarkerInstance;
    } catch (e) {
      console.error('Failed to initialize HandLandmarker:', e);
      return null;
    }
  }
}

export async function extractHandLandmarksFromImage(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  numHands: number = 2,
  basePath: string = ''
): Promise<HandLandmarkData[] | null> {
  const landmarker = await initHandLandmarker(numHands, basePath);
  if (!landmarker) return null;

  try {
    const result = landmarker.detect(imageSource);
    if (!result.landmarks || result.landmarks.length === 0) {
      return null;
    }

    const w = imageSource.width || 500;
    const h = imageSource.height || 500;
    const maxDim = Math.max(h, w);

    const handsData: HandLandmarkData[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const rawLandmarks = result.landmarks[i];
      const rawWorldLandmarks = result.worldLandmarks ? result.worldLandmarks[i] : null;

      let handedness: 'Left' | 'Right' | 'Unknown' = 'Unknown';
      let score = 1.0;

      if (result.handednesses && result.handednesses[i] && result.handednesses[i][0]) {
        const cat = result.handednesses[i][0];
        handedness = cat.categoryName === 'Left' ? 'Left' : cat.categoryName === 'Right' ? 'Right' : 'Unknown';
        score = cat.score ?? 1.0;
      }

      // Convert 2D image landmarks to 3D scene coordinates
      const landmarks: THREE.Vector3[] = rawLandmarks.map((lm) => {
        const x = ((lm.x - 0.5) * w) / (maxDim * 0.1);
        const y = -((lm.y - 0.5) * h) / (maxDim * 0.1);
        const z = (-lm.z * w) / (maxDim * 0.1);
        return new THREE.Vector3(x, y, z);
      });

      // Convert world 3D landmarks (in meters) to scaled 3D scene coordinates
      const worldLandmarks: THREE.Vector3[] = rawWorldLandmarks
        ? rawWorldLandmarks.map((wlm) => new THREE.Vector3(wlm.x * 25, -wlm.y * 25, -wlm.z * 25))
        : landmarks;

      handsData.push({
        handIndex: i,
        handedness,
        score,
        landmarks,
        worldLandmarks,
      });
    }

    return handsData;
  } catch (e) {
    console.error('Error extracting hand landmarks:', e);
    return null;
  }
}

/**
 * Generate default realistic hand landmarks (open palm pose) for 1..count hands.
 */
export function generateDefaultHandLandmarks(count: number = 2): HandLandmarkData[] {
  const basePose: [number, number, number][] = [
    // 0: Wrist
    [0.0, -3.5, 0.0],
    // Thumb: 1, 2, 3, 4
    [-1.2, -2.2, 0.4],
    [-2.2, -1.2, 0.8],
    [-2.8, -0.2, 1.0],
    [-3.2, 0.6, 1.1],
    // Index: 5, 6, 7, 8
    [-1.2, 0.5, 0.2],
    [-1.5, 2.0, 0.2],
    [-1.6, 3.2, 0.1],
    [-1.7, 4.2, 0.0],
    // Middle: 9, 10, 11, 12
    [-0.1, 0.7, 0.1],
    [-0.1, 2.3, 0.1],
    [-0.1, 3.6, 0.0],
    [-0.1, 4.7, -0.1],
    // Ring: 13, 14, 15, 16
    [1.0, 0.5, 0.1],
    [1.2, 2.0, 0.0],
    [1.3, 3.2, -0.1],
    [1.4, 4.2, -0.2],
    // Pinky: 17, 18, 19, 20
    [2.0, 0.0, 0.0],
    [2.4, 1.3, -0.1],
    [2.6, 2.3, -0.2],
    [2.8, 3.2, -0.3],
  ];

  const hands: HandLandmarkData[] = [];

  for (let i = 0; i < count; i++) {
    const isRight = i % 2 === 0;
    const handedness: 'Left' | 'Right' = isRight ? 'Right' : 'Left';

    // Horizontal offset for multiple hands
    const offsetX = (i - (count - 1) / 2) * 9.0;

    const landmarks: THREE.Vector3[] = basePose.map(([x, y, z]) => {
      // Mirror X if Left hand
      const adjustedX = isRight ? x + offsetX : -x + offsetX;
      return new THREE.Vector3(adjustedX, y, z);
    });

    hands.push({
      handIndex: i,
      handedness,
      score: 0.99,
      landmarks: landmarks.map((v) => v.clone()),
      worldLandmarks: landmarks.map((v) => v.clone()),
    });
  }

  return hands;
}

