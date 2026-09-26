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
  /** Số dầm / trục theo phương X (1, 2, 3…). */
  beamCountX: number;
  /** Số dầm / trục theo phương Y (A, B, C…). */
  beamCountY: number;
  /** Chiều cao dầm H (mm). */
  beamH: number;
  /** Chiều rộng dầm B (mm). */
  beamB: number;
  /**
   * Lệch trục B1 (mm): từ mép trái dầm đến tim trục.
   * 0 = tim trùng mép trái, B/2 = cân giữa.
   */
  beamB1: number;
  /** Chuỗi tương thích cũ "BxH" — đồng bộ từ beamB × beamH. */
  beamSizeX: string;
  beamSizeY: string;
  lowSlabDrop: number;
  concreteGrade: string;
  steelGrade: string;
  drawingScale: number;
}

/** Trục lưới mặt bằng (mm). X: 1,2,3… — Y: A,B,C… */
export interface GridAxis {
  id: string;
  name: string;
  /** Vị trí tuyệt đối từ gốc (mm). */
  pos: number;
}

/** Dầm trên mặt bằng (mm). */
export interface PlanBeam {
  id: string;
  name: string;
  size: string;
  direction: RebarDir;
  /** Tim trục theo phương vuông góc với hướng dầm. */
  axis: number;
  /** Id trục gắn với dầm (để giữ kích thước khi dựng lại lưới). */
  axisId?: string;
  /**
   * Dầm chèn giữa ô — không gắn trục lưới.
   * `syncBeamsToAxes` giữ nguyên `axis` / `offset`, không gán axisId.
   */
  free?: boolean;
  /** Đầu / cuối theo hướng dầm. */
  start: number;
  end: number;
  /**
   * Lệch trục B1 (mm): khoảng từ mép trái dầm đến tim trục.
   * Vẽ: mép trái = axis − B1, mép phải = axis + (B − B1).
   */
  offset: number;
  /**
   * Dịch từng đoạn dầm so với tim (mm), theo thứ tự đoạn giữa 2 trục giao.
   * s0 = dịch tại đầu đoạn (a0), s1 = tại cuối (a1).
   * Dầm đứng (Y): + sang phải (+X). Dầm ngang (X): + lên trên (+Y).
   * s0 ≠ s1 → dầm xéo.
   */
  segShifts?: BeamSegShift[];
  /**
   * Đoạn đã xóa (không vẽ, ô sàn hai bên coi như liền): khóa `${a0.id}|${a1.id}`.
   */
  omitSegKeys?: string[];
}

/** Dịch đoạn dầm tại hai đầu (mm). */
export interface BeamSegShift {
  s0: number;
  s1: number;
}

/**
 * Đối tượng đang chọn trên mặt bằng:
 * - bay: ô sàn giữa hai cặp trục
 * - beam: một đoạn dầm giữa hai trục giao (không phải cả thanh đầu→cuối)
 * - axis: số hiệu / nhịp trục (X hoặc Y)
 */
export type PlanSelection =
  | { kind: "bay"; ix: number; iy: number }
  | { kind: "beam"; beamId: string; segIndex: number }
  | { kind: "axis"; dir: "X" | "Y"; axisId: string };

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
  /**
   * Cách bố trí thép tại sàn thấp:
   * - press (nhấn): thép chạy như sàn thường, nhấn xuống tại dầm quanh ô bằng `drop`
   * - cut (cắt): cắt thép độc lập với sàn thường (như ô thủng)
   */
  rebarMode?: LowSlabRebarMode;
}

export type LowSlabRebarMode = "press" | "cut";

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

/** Loại dầm đã lưu (D1, D2…) — dùng để gán tên/kích thước cho đoạn trên mặt bằng. */
export interface BeamTypeDef {
  id: string;
  name: string;
  size: string;
  /** Lệch trục B1 (mm). */
  offset: number;
}

export interface SlabProject {
  info: SlabInfo;
  /** Kích thước mặt bằng theo trục ngoài cùng (mm). */
  planWidth: number;
  planHeight: number;
  /** Trục phương X (đứng) — tên 1, 2, 3… */
  axesX: GridAxis[];
  /** Trục phương Y (ngang) — tên A, B, C… */
  axesY: GridAxis[];
  beams: PlanBeam[];
  /** Danh sách loại dầm (D1, D2…) người dùng thêm bằng nút Thêm. */
  beamTypes?: BeamTypeDef[];
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
  | "axes"
  | "beams"
  | "draw"
  | "economy2"
  | "simple2"
  | "section"
  | "model3d"
  | "info";

export const TABS: { id: TabId; label: string }[] = [
  { id: "plan", label: "Thông tin sàn" },
  { id: "axes", label: "Số liệu trục" },
  { id: "beams", label: "Số liệu dầm" },
  { id: "draw", label: "Vẽ thép sàn" },
  { id: "economy2", label: "Thép 2 lớp tiết kiệm" },
  { id: "simple2", label: "Thép 2 lớp đơn giản" },
  { id: "section", label: "Mặt cắt" },
  { id: "model3d", label: "Mô hình 3D" },
  { id: "info", label: "Thông tin xuất" },
];
