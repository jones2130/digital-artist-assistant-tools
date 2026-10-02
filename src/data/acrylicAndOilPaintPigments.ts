import type { Pigment } from "../types/pigmentTypes";
import { rgbToLab } from "../utils/colorMath";
import { computePigmentAbsorption } from "../utils/paintMixer";

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