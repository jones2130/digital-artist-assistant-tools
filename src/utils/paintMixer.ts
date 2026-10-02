import type { Pigment, GamutMix } from "../types/pigmentTypes";
import { rgbToLab, deltaE } from "./colorMath";

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
