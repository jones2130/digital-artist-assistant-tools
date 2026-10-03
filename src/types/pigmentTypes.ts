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