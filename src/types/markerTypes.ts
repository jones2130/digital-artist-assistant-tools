export interface MarkerSwatch {
  id: string;
  code: string;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  family?: string;
  lab?: [number, number, number];
  transmittance?: [number, number, number]; // Spectral/Dye light transmission [0..1]
  legacy?: Record<string, string>;
}

export type MarkerTechnique = "single" | "layer" | "blend_tint";

export interface MarkerStep {
  marker: MarkerSwatch;
  action: "base_pass" | "glaze_pass" | "dilute_blender";
  description: string;
}

export interface MarkerRecipe {
  r: number;
  g: number;
  b: number;
  hex: string;
  lab: [number, number, number];
  deltaE: number;
  technique: MarkerTechnique;
  steps: MarkerStep[];
  instruction: string;
}