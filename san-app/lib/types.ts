/** Shop drawing thép sàn — domain model */

export const DIAMETERS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25];
export const SPACING_OPTIONS = [100, 125, 150, 175, 200, 250, 300];

export type RebarLayer = "bottom" | "top" | "structural";
export type RebarDir = "X" | "Y";
export type LayoutPreset = "manual" | "simple2" | "economy2";
export type BarShapeKind = "straight" | "hooked" | "mesh";

export interface SlabInfo {
  name: string;
  thickness: number;
  quantity: number;
  cover: number;
  beamNamePrefix: string;
  textHeight: number;
  beamSizeX: string;
  beamSizeY: string;
  lowSlabDrop: number;
  concreteGrade: string;
  steelGrade: string;
  drawingScale: number;
}

/** Dầm trên mặt bằng (mm). */
export interface PlanBeam {
  id: string;
  name: string;
  size: string;
  direction: RebarDir;
  /** Tâm dầm theo phương vuông góc với hướng dầm. */
  axis: number;
  /** Đầu / cuối theo hướng dầm. */
  start: number;
  end: number;
  offset: number;
}

export interface Opening {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LowSlab {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  drop: number;
}

/** Một vùng rải thép (shop). */
export interface RebarZone {
  id: string;
  mark: string;
  layer: RebarLayer;
  direction: RebarDir;
  dia: number;
  spacing: number;
  leftHook: number;
  rightHook: number;
  /** Bao vùng rải (mm) — P1..P4. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cover: number;
  showSpacing: boolean;
  spacingSymbol: string;
  note?: string;
}

export interface Simple2Layer {
  bottomSpec: string;
  bottomHook: number;
  topSpec: string;
  topHook: number;
  textHeight: number;
}

export interface Economy2Layer {
  bottomSpec: string;
  bottomHook: number;
  topSpec: string;
  topHook: number;
  structuralSpec: string;
  structuralHook: number;
  distToCenter: number;
  textHeight: number;
  hatAlongShort: boolean;
}

export interface SectionCut {
  id: string;
  name: string;
  textHeight: number;
  /** Cắt theo phương X hoặc Y tại vị trí `at`. */
  direction: RebarDir;
  at: number;
  from: number;
  to: number;
}

export interface SlabProject {
  info: SlabInfo;
  /** Kích thước ô sàn mẫu (mm). */
  planWidth: number;
  planHeight: number;
  beams: PlanBeam[];
  openings: Opening[];
  lowSlabs: LowSlab[];
  zones: RebarZone[];
  simple2: Simple2Layer;
  economy2: Economy2Layer;
  sections: SectionCut[];
  layoutPreset: LayoutPreset;
  show3d: boolean;
}

export type TabId =
  | "plan"
  | "draw"
  | "economy2"
  | "simple2"
  | "section"
  | "model3d"
  | "info";

export const TABS: { id: TabId; label: string }[] = [
  { id: "plan", label: "1. Thông tin sàn" },
  { id: "draw", label: "2. Vẽ thép sàn" },
  { id: "economy2", label: "3. Thép 2 lớp tiết kiệm" },
  { id: "simple2", label: "4. Thép 2 lớp đơn giản" },
  { id: "section", label: "5. Mặt cắt" },
  { id: "model3d", label: "6. Mô hình 3D" },
  { id: "info", label: "Thông tin xuất" },
];
