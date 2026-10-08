/** Shop drawing thép móng cọc — 4 dạng đài + 2 lớp thép độc lập. */

export type PileCount = 2 | 3 | 4 | 5

export interface Point {
  x: number
  y: number
}

/** Đoạn thép một phương sau khi cắt theo biên đa giác. */
export interface VariableBar {
  /** Vị trí station (mm): y cho thanh phương X, x cho thanh phương Y. */
  station: number
  start: number
  end: number
  clearLen: number
  length: number
  lengthKey: number
  layer: 'bottom' | 'top'
  direction: 'X' | 'Y'
}

export interface BarGroup {
  direction: 'X' | 'Y'
  layer: 'bottom' | 'top'
  d: number
  spacing: number
  length: number
  clearLen: number
  n1: number
  shape: 'straight' | 'u'
  segs: number[]
  label: string
  bars: VariableBar[]
}

/**
 * Input đài móng cọc.
 *
 * Hình 1: 2 cọc — chữ nhật
 * Hình 2: 3 cọc — lục giác (thép biến thiên X & Y)
 * Hình 3: 4 cọc — vuông (αX=αY) hoặc chữ nhật (αX≠αY)
 * Hình 4: 5 cọc — vuông/chữ nhật + cọc giữa
 *
 * Hai lớp thép đế: mỗi lớp = một phương (X hoặc Y), có Ø / a / móc riêng.
 */
export interface PileCapInputs {
  pileCount: PileCount
  /** Đường kính cọc ∅ (mm). */
  pileDia: number
  /**
   * Hệ số khoảng cách α (dùng chung nếu không tách αX/αY).
   * s = α × pileDia.
   */
  alpha: number
  /**
   * α theo phương X / Y — đài 4 & 5 chữ nhật khi khác nhau.
   * Mặc định = alpha. Đài 2 & 3 chỉ dùng alpha (hoặc alphaX cho trục chính).
   */
  alphaX: number
  alphaY: number
  /**
   * Phần bê tông nhô ngoài mép cọc mỗi phía (mm).
   * Sơ đồ điển hình 150 → tổng +300 mm.
   */
  edgeClear: number
  hCap: number
  xCol: number
  yCol: number
  coverBase: number

  /** Lớp dưới là phương X? (lớp trên = phương còn lại). */
  bottomLayerX: boolean

  /** Thép phương X. */
  dFaX: number
  aFaX: number
  /** Thép phương Y. */
  dFaY: number
  aFaY: number

  /** Móc lớp dưới (có thể khác lớp trên). */
  hookedBottom: boolean
  hookBottomLeft: number
  hookBottomRight: number
  /** Móc lớp trên. */
  hookedTop: boolean
  hookTopLeft: number
  hookTopRight: number

  /** Bỏ thanh có đoạn thẳng &lt; minClearLen (mm). 0 = không lọc. */
  minClearLen: number

  name: string
  qty: number
  axisXName: string
  axisYName: string
}

export interface PileCapGeometry {
  pileCount: PileCount
  pileDia: number
  alpha: number
  alphaX: number
  alphaY: number
  /** s theo X (tim–tim). */
  spacingX: number
  /** s theo Y (tim–tim); đài 2 = 0; đài 3 = spacing cạnh tam giác. */
  spacingY: number
  edgeClear: number
  shape: 'rectangle' | 'hexagon'
  piles: Point[]
  outline: Point[]
  bbox: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number }
  columnCenter: Point
  xCol: number
  yCol: number
  /** Ghi chú kích thước theo sơ đồ khuyến nghị. */
  dimNote: string
}

export interface PileCapCalcResult {
  errors: string[]
  geometry: PileCapGeometry
  barsX: VariableBar[]
  barsY: VariableBar[]
  barsBottom: VariableBar[]
  barsTop: VariableBar[]
  groups: BarGroup[]
  byDia: { d: number; kg: number; lengthM: number; bars117: number }[]
  concreteCap: number
  formworkCap: number
  concreteCapExpr: string
  formworkCapExpr: string
}
