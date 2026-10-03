import type { MarkerSwatch, MarkerRecipe, MarkerStep } from "../types/markerTypes";
import { rgbToLab, deltaE, rgbToHex } from "./colorMath";

/**
 * Computes dye optical transmittance vector [0..1] relative to paper white (255).
 * Under Beer-Lambert, Transmittance T = R / 255.
 */
export function computeMarkerTransmittance(m: MarkerSwatch): [number, number, number] {
  return [
    Math.max(0.001, m.r / 255),
    Math.max(0.001, m.g / 255),
    Math.max(0.001, m.b / 255)
  ];
}

/**
 * Simulates optical two-pass layering on white paper using Beer-Lambert transmission:
 * T_final = T_base * T_glaze
 * R_final = 255 * T_final
 */
export function simulateMarkerLayer(
  base: MarkerSwatch,
  glaze: MarkerSwatch
): { r: number; g: number; b: number; hex: string; lab: [number, number, number] } {
  const tBase = base.transmittance ?? computeMarkerTransmittance(base);
  const tGlaze = glaze.transmittance ?? computeMarkerTransmittance(glaze);

  // Multiplicative dye transmission through paper reflection
  const rNorm = tBase[0] * tGlaze[0];
  const gNorm = tBase[1] * tGlaze[1];
  const bNorm = tBase[2] * tGlaze[2];

  const r = Math.min(255, Math.max(0, Math.round(rNorm * 255)));
  const g = Math.min(255, Math.max(0, Math.round(gNorm * 255)));
  const b = Math.min(255, Math.max(0, Math.round(bNorm * 255)));

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    lab: rgbToLab(r, g, b)
  };
}

/**
 * Simulates softening/diluting a marker stroke using a Colorless Blender (#0) on paper.
 * Mixes dye transmittance toward paper white (factor 0.4 - 0.7).
 */
export function simulateBlenderTint(
  marker: MarkerSwatch,
  dilutionFactor: number = 0.5
): { r: number; g: number; b: number; hex: string; lab: [number, number, number] } {
  const r = Math.min(255, Math.round(marker.r + (255 - marker.r) * dilutionFactor));
  const g = Math.min(255, Math.round(marker.g + (255 - marker.g) * dilutionFactor));
  const b = Math.min(255, Math.round(marker.b + (255 - marker.b) * dilutionFactor));

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    lab: rgbToLab(r, g, b)
  };
}

/**
 * Pre-hydrates raw marker data with Lab and Transmittance for high-speed matching.
 */
export function prepareMarkerSwatches(rawMarkers: MarkerSwatch[]): MarkerSwatch[] {
  return rawMarkers.map(m => ({
    ...m,
    lab: m.lab ?? rgbToLab(m.r, m.g, m.b),
    transmittance: m.transmittance ?? computeMarkerTransmittance(m)
  }));
}

/**
 * Finds the optimal alcohol marker recipe for a given target pixel.
 * Priority:
 * 1. Direct match with a single pen (if deltaE < 3.5)
 * 2. Diluted stroke with Colorless Blender (for high-key/pastel tones)
 * 3. 2-pen optical layer (Base coat + Glaze pass)
 */
export function solveMarkerRecipe(
  targetR: number,
  targetG: number,
  targetB: number,
  activeMarkers: MarkerSwatch[],
  blenderMarker?: MarkerSwatch
): MarkerRecipe {
  if (activeMarkers.length === 0) {
    return {
      r: targetR,
      g: targetG,
      b: targetB,
      hex: rgbToHex(targetR, targetG, targetB),
      lab: rgbToLab(targetR, targetG, targetB),
      deltaE: 0,
      technique: "single",
      steps: [],
      instruction: "No active markers selected."
    };
  }

  const targetLab = rgbToLab(targetR, targetG, targetB);

  // 1. Direct Single-Pen Search
  let bestDirect = activeMarkers[0];
  let minDirectD = Infinity;

  for (let i = 0; i < activeMarkers.length; i++) {
    const m = activeMarkers[i];
    const d = deltaE(targetLab, m.lab ?? rgbToLab(m.r, m.g, m.b));
    if (d < minDirectD) {
      minDirectD = d;
      bestDirect = m;
    }
  }

  // If a single marker is an exact or near-imperceptible match, return immediately
  if (minDirectD <= 3.5) {
    return {
      r: bestDirect.r,
      g: bestDirect.g,
      b: bestDirect.b,
      hex: bestDirect.hex,
      lab: bestDirect.lab ?? rgbToLab(bestDirect.r, bestDirect.g, bestDirect.b),
      deltaE: minDirectD,
      technique: "single",
      steps: [
        {
          marker: bestDirect,
          action: "base_pass",
          description: `Direct fill: ${bestDirect.code} (${bestDirect.name})`
        }
      ],
      instruction: `Use single pen: ${bestDirect.code} - ${bestDirect.name}`
    };
  }

  let bestRecipe: MarkerRecipe = {
    r: bestDirect.r,
    g: bestDirect.g,
    b: bestDirect.b,
    hex: bestDirect.hex,
    lab: bestDirect.lab ?? rgbToLab(bestDirect.r, bestDirect.g, bestDirect.b),
    deltaE: minDirectD,
    technique: "single",
    steps: [
      {
        marker: bestDirect,
        action: "base_pass",
        description: `Direct fill: ${bestDirect.code} (${bestDirect.name})`
      }
    ],
    instruction: `Best direct pen: ${bestDirect.code} - ${bestDirect.name}`
  };
  let lowestDelta = minDirectD;

  // 2. Check Colorless Blender Tints (if target is lighter than the direct match)
  const targetLuminance = 0.299 * targetR + 0.587 * targetG + 0.114 * targetB;
  if (targetLuminance > 180) {
    for (const m of activeMarkers) {
      const tint = simulateBlenderTint(m, 0.45);
      const d = deltaE(targetLab, tint.lab);
      if (d < lowestDelta) {
        lowestDelta = d;
        bestRecipe = {
          r: tint.r,
          g: tint.g,
          b: tint.b,
          hex: tint.hex,
          lab: tint.lab,
          deltaE: d,
          technique: "blend_tint",
          steps: [
            {
              marker: m,
              action: "base_pass",
              description: `Light stroke of ${m.code} (${m.name})`
            },
            {
              marker: blenderMarker ?? {
                id: "blender_0",
                code: "0",
                name: "Colorless Blender",
                hex: "#ffffff",
                r: 255,
                g: 255,
                b: 255
              },
              action: "dilute_blender",
              description: `Feather immediately with Colorless Blender (0) to tint toward paper white`
            }
          ],
          instruction: `Feather ${m.code} with Colorless Blender (0)`
        };
      }
    }
  }

  // 3. Two-Pass Layering (Base pass of Marker A + Glaze pass of Marker B)
  // Prune search space: only test pairs that have reasonable combined luminance
  for (let i = 0; i < activeMarkers.length; i++) {
    const base = activeMarkers[i];
    // Base cannot be darker than the target
    if (base.r < targetR - 30 && base.g < targetG - 30 && base.b < targetB - 30) continue;

    for (let j = 0; j < activeMarkers.length; j++) {
      if (i === j) continue;
      const glaze = activeMarkers[j];

      const sim = simulateMarkerLayer(base, glaze);
      const d = deltaE(targetLab, sim.lab);

      if (d < lowestDelta) {
        lowestDelta = d;
        bestRecipe = {
          r: sim.r,
          g: sim.g,
          b: sim.b,
          hex: sim.hex,
          lab: sim.lab,
          deltaE: d,
          technique: "layer",
          steps: [
            {
              marker: base,
              action: "base_pass",
              description: `Base layer: 1 even pass of ${base.code} (${base.name})`
            },
            {
              marker: glaze,
              action: "glaze_pass",
              description: `Top glaze: Layer 1 light pass of ${glaze.code} (${glaze.name}) over dry base`
            }
          ],
          instruction: `Base ${base.code} (${base.name}), then glaze ${glaze.code} (${glaze.name})`
        };
      }
    }
  }

  return bestRecipe;
}

/**
 * Builds the entire achievable marker gamut space from active markers,
 * including single fills, blender tints, and key 2-pass glazes.
 */
export function buildAchievableMarkerGamut(
  activeMarkers: MarkerSwatch[]
): MarkerRecipe[] {
  const gamut: MarkerRecipe[] = [];

  // 1. All active single pens
  for (const m of activeMarkers) {
    gamut.push({
      r: m.r,
      g: m.g,
      b: m.b,
      hex: m.hex,
      lab: m.lab ?? rgbToLab(m.r, m.g, m.b),
      deltaE: 0,
      technique: "single",
      steps: [{ marker: m, action: "base_pass", description: `Fill ${m.code}` }],
      instruction: `${m.code} (${m.name})`
    });
  }

  // 2. High-value optical pairings (subsampled for interactive frame rates)
  const sampleStep = activeMarkers.length > 80 ? 3 : 1;
  for (let i = 0; i < activeMarkers.length; i += sampleStep) {
    for (let j = i + 1; j < activeMarkers.length; j += sampleStep) {
      const base = activeMarkers[i];
      const glaze = activeMarkers[j];
      const sim = simulateMarkerLayer(base, glaze);

      gamut.push({
        r: sim.r,
        g: sim.g,
        b: sim.b,
        hex: sim.hex,
        lab: sim.lab,
        deltaE: 0,
        technique: "layer",
        steps: [
          { marker: base, action: "base_pass", description: `Base ${base.code}` },
          { marker: glaze, action: "glaze_pass", description: `Glaze ${glaze.code}` }
        ],
        instruction: `Base ${base.code}, Glaze ${glaze.code}`
      });
    }
  }

  return gamut;
}