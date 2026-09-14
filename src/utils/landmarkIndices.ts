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
// Forehead lines
export const REILLY_FOREHEAD_LINES_01 = [67,67,69,66,65,55,8,285,295,296,299,297];
export const REILLY_FOREHEAD_LINES_02 = [109,108,107,9,336,337,338];

// Eyes and nose bridge
export const REILLY_EYES_AND_NOSE_BRIDGE =  [357,350,349,348,347,346,340,265,353,276,283,282,295,285,417,351,419,248,281,275,274,1,44,45,51,3,196,122,193,55,65,52,53,46,124,35,111,117,118,119,120,121,128,245,193,168,417,465,357];

// Nose outer contour
export const REILLY_OUTER_NOSE_CONTOUR= [8,285,441,414,398,381,380,252,451,349,329,371,358,327,326,2,97,98,129,142,100,120,231,22,153,154,173,190,221,55,8];
// Nose inner contour
export const REILLY_INNER_NOSE_CONTOUR = [98,97,2,326,327,358,294,439,438,457,274,1,44,237,218,219,64,129,98];

// brow ridge
export const REILLY_BROW_RIDGE = [265,383,300,293,334,296,336,9,107,66,105,63,70,156,143];

// Jaw ridges
export const REILLY_JAW_RIDGE_01 = [389,264,352,416,364,394,395,369,396,175,171,140,170,169,135,192,123,34,162];
export const REILLY_JAW_RIDGE_02 = [127,227,137,177,215,136,150,149,176,148,152,377,400,378,379,365,435,401,366,447,356];

// Muzzle lines:
export const REILLY_MUZZLE_01 = [168,193,245,128,121,120,101,50,187,192,135,150,149,176,148,152,377,400,378,379,364,416,411,280,348,349,350,357,465,417,168];
export const REILLY_MUZZLE_02 = [358,423,426,436,434,430,431,262,428,199,208,32,211,210,214,216,206,203,129];

// Chin
export const REILLY_CHIN = [200,421,262,369,377,152,148,140,32,201,200];

// Jaw hinge
export const REILLY_JAW_HINGE = [389,264,352,411,427,306,78,207,187,123,34,162];

// Eye lids
export const REILLY_EYE_LID_01 = [33,246,161,160,159,158,157,173,154,153,145,144,163,7,7,33];
export const REILLY_EYE_LID_02 =[263,466,388,387,386,385,384,398,362,382,381,380,374,373,390,249,263];


export const LOOMIS_LINE_GROUPS: Record<string, number[]> = {
  "Central Axis": LOOMIS_CENTRAL_AXIS,
  "Brow Line": LOOMIS_BROW_LINE,
  "Nose Base": LOOMIS_NOSE_BASE_LINE,
  "Chin Line": LOOMIS_CHIN_LINE,
  "Jawline": LOOMIS_JAWLINE,
};

export const REILLY_LINE_GROUPS: Record<string, number[]> = {
  "Forehead Line 01": REILLY_FOREHEAD_LINES_01,
  "Forehead Line 02": REILLY_FOREHEAD_LINES_02,
  "Eyes and Nose Bridge": REILLY_EYES_AND_NOSE_BRIDGE,
  "Outer Nose Contour": REILLY_OUTER_NOSE_CONTOUR,
  "Inner Nose Contour": REILLY_INNER_NOSE_CONTOUR,
  "Brow Ridge": REILLY_BROW_RIDGE,
  "Jaw Ridge 01": REILLY_JAW_RIDGE_01,
  "Jaw Ridge 02": REILLY_JAW_RIDGE_02,
  "Muzzle 01": REILLY_MUZZLE_01,
  "Muzzle 02": REILLY_MUZZLE_02,
  "Chin": REILLY_CHIN,
  "Jaw Hinge": REILLY_JAW_HINGE,
  "Eye Lid 01": REILLY_EYE_LID_01,
  "Eye Lid 02": REILLY_EYE_LID_02,
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

