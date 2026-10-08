/** Shop drawing thép móng cọc — domain model (mở rộng từ móng đơn `ntgiahuy/mong`). */

export type PileCount = 2 | 3 | 4 | 5

export interface Point {
  x: number
  y: number
}

/** Đoạn thép một phương sau khi cắt theo biên đa giác. */
export interface VariableBar {
  /** Vị trí station (mm): y cho thanh phương X, x cho thanh phương Y. */
  station: number
  /** Đầu gần hơn theo phương thanh (mm). */
  start: number
  /** Đầu xa hơn theo phương thanh (mm). */
  end: number
  /** Chiều dài đoạn thẳng trong bê tông = end − start (mm). */
  clearLen: number
  /** Chiều dài thống kê = clearLen + móc (mm). */
  length: number
  /** Phân nhóm để gộp bảng thống kê (mm, đã làm tròn). */
  lengthKey: number
}

export interface BarGroup {
  direction: 'X' | 'Y'
  d: number
  spacing: number
  length: number
  clearLen: number
  n1: number
  shape: 'straight' | 'u'
  segs: number[]
  label: string
  /** Các thanh gốc tạo nên nhóm (cùng lengthKey). */
  bars: VariableBar[]
}

export interface PileCapInputs {
  /** Số cọc: 3 → đài lục giác (quan trọng nhất); 2/4/5 → đài chữ nhật/vuông. */
  pileCount: PileCount
  /** Đường kính cọc ∅ (mm). */
  pileDia: number
  /**
   * Hệ số khoảng cách cọc α (thường 2 hoặc 3).
   * s = α × pileDia (tim–tim).
   */
  alpha: number
  /**
   * Phần bê tông nhô ngoài mép cọc mỗi phía (mm).
   * Công thức điển hình dùng 150 → tổng +300 mm trên cạnh.
   */
  edgeClear: number
  /** Chiều cao đài (mm). */
  hCap: number
  /** Cột trên đài: cạnh X / Y (mm). */
  xCol: number
  yCol: number
  /** Lớp bảo vệ đế (mm). */
  coverBase: number
  /** Thép phương X (thanh song song trục X). */
  dFaX: number
  aFaX: number
  /** Thép phương Y (thanh song song trục Y). */
  dFaY: number
  aFaY: number
  /** Lớp dưới là phương X? (giống móng đơn). */
  bottomLayerX: boolean
  hooked: boolean
  hookLeft: number
  hookRight: number
  name: string
  qty: number
  axisXName: string
  axisYName: string
}

export interface PileCapGeometry {
  pileCount: PileCount
  pileDia: number
  alpha: number
  spacing: number
  edgeClear: number
  /** Tim các cọc (gốc = centroid cụm cọc). */
  piles: Point[]
  /** Đỉnh biên đài, CCW, khép kín (điểm đầu = điểm cuối không lặp). */
  outline: Point[]
  bbox: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number }
  /** Tâm cột (= centroid). */
  columnCenter: Point
  xCol: number
  yCol: number
}

export interface PileCapCalcResult {
  errors: string[]
  geometry: PileCapGeometry
  barsX: VariableBar[]
  barsY: VariableBar[]
  groups: BarGroup[]
  byDia: { d: number; kg: number; lengthM: number; bars117: number }[]
  concreteCap: number
  formworkCap: number
  concreteCapExpr: string
  formworkCapExpr: string
}
