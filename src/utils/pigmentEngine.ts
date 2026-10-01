export interface Pigment {
  id: string;
  name: string;
  code: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  active: boolean;
  lab?: [number, number, number];
  abs?: [number, number, number];
}

export interface PigmentPart {
  pigment: Pigment;
  ratio: number;
  percent: number;
}

export interface GamutMix {
  r: number;
  g: number;
  b: number;
  hex: string;
  lab: [number, number, number];
  parts: PigmentPart[];
  deltaE?: number;
}

export interface CalculatedRegion {
  regionIndex: number;
  hex: string;
  rgb: [number, number, number];
  lab: [number, number, number];
  parts: PigmentPart[];
  count: number;
}

export interface Point {
  x: number;
  y: number;
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rL = r / 255;
  let gL = g / 255;
  let bL = b / 255;

  rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
  gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
  bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

  const x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) / 0.95047;
  const y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) / 1.00000;
  const z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) / 1.08883;

  const xT = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  const yT = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  const zT = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  return [116 * yT - 16, 500 * (xT - yT), 200 * (yT - zT)];
}

export function deltaE(labA: [number, number, number], labB: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(labA[0] - labB[0], 2) +
    Math.pow(labA[1] - labB[1], 2) +
    Math.pow(labA[2] - labB[2], 2)
  );
}

export function computePigmentAbsorption(p: Pigment): [number, number, number] {
  return [
    Math.pow((255 - p.r) / 255, 2.2),
    Math.pow((255 - p.g) / 255, 2.2),
    Math.pow((255 - p.b) / 255, 2.2)
  ];
}

export function blendPigments(pigmentWeights: { pigment: Pigment; weight: number }[]): GamutMix {
  let totWeight = 0;
  const blendedAbs = [0, 0, 0];

  for (const pw of pigmentWeights) {
    totWeight += pw.weight;
    const abs = pw.pigment.abs ?? computePigmentAbsorption(pw.pigment);
    blendedAbs[0] += abs[0] * pw.weight;
    blendedAbs[1] += abs[1] * pw.weight;
    blendedAbs[2] += abs[2] * pw.weight;
  }

  if (totWeight === 0) {
    return {
      r: 255,
      g: 255,
      b: 255,
      hex: "#ffffff",
      lab: [100, 0, 0],
      parts: []
    };
  }

  const rNorm = 1 - Math.pow(blendedAbs[0] / totWeight, 1 / 2.2);
  const gNorm = 1 - Math.pow(blendedAbs[1] / totWeight, 1 / 2.2);
  const bNorm = 1 - Math.pow(blendedAbs[2] / totWeight, 1 / 2.2);

  const r = Math.min(255, Math.max(0, Math.round(rNorm * 255)));
  const g = Math.min(255, Math.max(0, Math.round(gNorm * 255)));
  const b = Math.min(255, Math.max(0, Math.round(bNorm * 255)));
  const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

  return {
    r,
    g,
    b,
    hex,
    lab: rgbToLab(r, g, b),
    parts: pigmentWeights.map(pw => ({
      pigment: pw.pigment,
      ratio: Math.round(pw.weight * 10),
      percent: Math.round((pw.weight / totWeight) * 100)
    }))
  };
}

export const MASTER_PIGMENTS_RAW: Omit<Pigment, 'lab' | 'abs'>[] = [
  { id: "pw6", name: "Titanium White", code: "PW6", hex: "#FCFBF7", r: 252, g: 251, b: 247, active: true },
  { id: "py35", name: "Cadmium Yellow Light", code: "PY35", hex: "#FFF000", r: 255, g: 240, b: 0, active: true },
  { id: "py43", name: "Yellow Ochre", code: "PY43", hex: "#C78B38", r: 199, g: 139, b: 56, active: true },
  { id: "pbr7_rs", name: "Raw Sienna", code: "PBr7", hex: "#BF7B32", r: 191, g: 123, b: 50, active: true },
  { id: "po20", name: "Cadmium Orange", code: "PO20", hex: "#FF5900", r: 255, g: 89, b: 0, active: true },
  { id: "pbr7_bs", name: "Burnt Sienna", code: "PBr7", hex: "#883222", r: 136, g: 50, b: 34, active: true },
  { id: "pr108_l", name: "Cadmium Red Light", code: "PR108", hex: "#E5251B", r: 229, g: 37, b: 27, active: true },
  { id: "pr108_m", name: "Cadmium Red Medium", code: "PR108", hex: "#B81E19", r: 184, g: 30, b: 25, active: true },
  { id: "pv19", name: "Quinacridone / Crimson", code: "PV19", hex: "#80172B", r: 128, g: 23, b: 43, active: true },
  { id: "pbr7_bu", name: "Burnt Umber", code: "PBr7", hex: "#43281E", r: 67, g: 40, b: 30, active: true },
  { id: "pbr7_ru", name: "Raw Umber", code: "PBr7", hex: "#4B3D31", r: 75, g: 61, b: 49, active: true },
  { id: "pg36", name: "Sap Green", code: "PG36", hex: "#415C27", r: 65, g: 92, b: 39, active: true },
  { id: "pg7", name: "Viridian / Phthalo Green", code: "PG7", hex: "#006243", r: 0, g: 98, b: 67, active: true },
  { id: "pb35", name: "Cerulean Blue", code: "PB35", hex: "#2A689C", r: 42, g: 104, b: 156, active: true },
  { id: "pb28", name: "Cobalt Blue", code: "PB28", hex: "#0048AC", r: 0, g: 72, b: 172, active: true },
  { id: "pb29", name: "Ultramarine Blue", code: "PB29", hex: "#1A2F7D", r: 26, g: 47, b: 125, active: true },
  { id: "pb15", name: "Phthalo Blue", code: "PB15", hex: "#0B2442", r: 11, g: 36, b: 66, active: true },
  { id: "pv23", name: "Dioxazine Purple", code: "PV23", hex: "#321737", r: 50, g: 23, b: 55, active: true },
  { id: "pbk9_pg", name: "Payne's Grey", code: "PB29/PBk9", hex: "#2D3740", r: 45, g: 55, b: 64, active: true },
  { id: "pbk9", name: "Ivory Black", code: "PBk9", hex: "#1B1B19", r: 27, g: 27, b: 25, active: true }
];

export function createMasterPigments(): Pigment[] {
  return MASTER_PIGMENTS_RAW.map(p => ({
    ...p,
    lab: rgbToLab(p.r, p.g, p.b),
    abs: computePigmentAbsorption(p as Pigment)
  }));
}

export function buildAchievableGamut(activePigments: Pigment[]): GamutMix[] {
  const gamut: GamutMix[] = [];

  // 1. Pure active tubes
  for (const p of activePigments) {
    gamut.push({
      r: p.r,
      g: p.g,
      b: p.b,
      hex: p.hex,
      lab: p.lab ?? rgbToLab(p.r, p.g, p.b),
      parts: [{ pigment: p, ratio: 1, percent: 100 }]
    });
  }

  // 2. Binary blends between active tubes
  for (let i = 0; i < activePigments.length; i++) {
    for (let j = i + 1; j < activePigments.length; j++) {
      const pA = activePigments[i];
      const pB = activePigments[j];
      for (let w = 1; w <= 9; w += 2) {
        const wA = w / 10;
        const wB = 1 - wA;
        const blend = blendPigments([
          { pigment: pA, weight: wA },
          { pigment: pB, weight: wB }
        ]);
        gamut.push({
          r: blend.r,
          g: blend.g,
          b: blend.b,
          hex: blend.hex,
          lab: blend.lab,
          parts: [
            { pigment: pA, ratio: Math.round(wA * 10), percent: Math.round(wA * 100) },
            { pigment: pB, ratio: Math.round(wB * 10), percent: Math.round(wB * 100) }
          ]
        });
      }
    }
  }

  // 3. Tints with White (if Titanium White is active)
  const white = activePigments.find(p => p.id === "pw6");
  if (white) {
    for (const p of activePigments) {
      if (p.id === "pw6") continue;
      for (let w = 2; w <= 8; w += 2) {
        const wWhite = w / 10;
        const wP = 1 - wWhite;
        const blend = blendPigments([
          { pigment: white, weight: wWhite },
          { pigment: p, weight: wP }
        ]);
        gamut.push({
          r: blend.r,
          g: blend.g,
          b: blend.b,
          hex: blend.hex,
          lab: blend.lab,
          parts: [
            { pigment: white, ratio: Math.round(wWhite * 10), percent: Math.round(wWhite * 100) },
            { pigment: p, ratio: Math.round(wP * 10), percent: Math.round(wP * 100) }
          ]
        });
      }
    }
  }

  return gamut;
}

export function findClosestGamutMix(
  r: number,
  g: number,
  b: number,
  gamut: GamutMix[]
): GamutMix {
  if (gamut.length === 0) {
    return {
      r,
      g,
      b,
      hex: "#888888",
      lab: rgbToLab(r, g, b),
      parts: [],
      deltaE: 0
    };
  }

  const targetLab = rgbToLab(r, g, b);
  let best = gamut[0];
  let minD = Infinity;

  for (let i = 0; i < gamut.length; i++) {
    const gItem = gamut[i];
    const d = deltaE(targetLab, gItem.lab);
    if (d < minD) {
      minD = d;
      best = gItem;
    }
  }

  return { ...best, deltaE: minD };
}
