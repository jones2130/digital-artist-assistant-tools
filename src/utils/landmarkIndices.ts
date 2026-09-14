/**
 * MediaPipe 3D Face Mesh Landmark Indices (468/478 format)
 * Maps specific vertex index sequences to Loomis lines, Reilly rhythm loops, and anatomical facial planes.
 */

export const LANDMARK_INDICES = {
  chin_gnathion: 152,
  glabella: 9,
  nasion: 168,
  nose_tip: 1,
  subnasale: 2,
  left_tragus: 454,
  right_tragus: 234,
  left_gonion_jaw: 397,
  right_gonion_jaw: 172,
  hairline_trichion: 10,
  left_eye_outer: 263,
  right_eye_outer: 33,
  left_mouth_corner: 291,
  right_mouth_corner: 61,
};

// --- LOOMIS METHOD STRUCTURAL LINES ---
export const LOOMIS_CENTRAL_AXIS = [
  10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 152
];

export const LOOMIS_BROW_LINE = [
  70, 63, 105, 66, 107, 9, 336, 296, 334, 293, 300
];

export const LOOMIS_NOSE_BASE_LINE = [
  129, 98, 97, 2, 326, 327, 358
];

export const LOOMIS_CHIN_LINE = [
  148, 176, 149, 150, 136, 172, 152, 397, 365, 379, 378, 400, 377
];

export const LOOMIS_JAWLINE = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454
];

// --- REILLY RHYTHM LINES & LOOPS ---
export const REILLY_RIGHT_EYE_ORBIT = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33
];

export const REILLY_LEFT_EYE_ORBIT = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382, 362
];

export const REILLY_NASOLABIAL_MUZZLE = [
  168, 6, 197, 195, 5, 4, 1, 2, 61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 2, 1
];

export const REILLY_CHIN_MUZZLE_LOOP = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61
];

export const REILLY_CHEEK_RHYTHM_RIGHT = [
  70, 156, 117, 118, 50, 187, 123, 116, 117, 118
];

export const REILLY_CHEEK_RHYTHM_LEFT = [
  300, 383, 346, 347, 280, 411, 352, 345, 346, 347
];

export const LOOMIS_LINE_GROUPS: Record<string, number[]> = {
  "Central Axis": LOOMIS_CENTRAL_AXIS,
  "Brow Line": LOOMIS_BROW_LINE,
  "Nose Base": LOOMIS_NOSE_BASE_LINE,
  "Chin Line": LOOMIS_CHIN_LINE,
  "Jawline": LOOMIS_JAWLINE,
};

export const REILLY_LINE_GROUPS: Record<string, number[]> = {
  "Right Eye Orbit": REILLY_RIGHT_EYE_ORBIT,
  "Left Eye Orbit": REILLY_LEFT_EYE_ORBIT,
  "Nasolabial Muzzle": REILLY_NASOLABIAL_MUZZLE,
  "Chin Muzzle Loop": REILLY_CHIN_MUZZLE_LOOP,
  "Right Cheek Rhythm": REILLY_CHEEK_RHYTHM_RIGHT,
  "Left Cheek Rhythm": REILLY_CHEEK_RHYTHM_LEFT,
};

// --- PLANAR FACE GROUPS (Vertex Indices for major facial planes) ---
export const PLANAR_FACE_GROUPS: Record<string, number[]> = {
  "Forehead Central": [10, 338, 297, 332, 109, 67, 103, 10, 151, 9, 8],
  "Nose Bridge": [168, 6, 197, 195, 5, 4, 1, 19, 94, 2],
  "Nose Sides Left": [197, 196, 3, 248, 456, 281, 358, 327, 326, 2],
  "Nose Sides Right": [197, 196, 3, 51, 236, 51, 129, 98, 97, 2],
  "Upper Lip Plane": [2, 164, 0, 267, 37, 61, 291],
  "Chin Plane": [18, 200, 199, 175, 152, 377, 400, 148, 176],
  "Left Cheek Plane": [330, 347, 280, 411, 352, 345, 372, 368, 264],
  "Right Cheek Plane": [100, 118, 50, 187, 123, 116, 143, 139, 34],
};

