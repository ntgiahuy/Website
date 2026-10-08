/**
 * Hình học đài móng cọc theo sơ đồ điển hình (α, ∅, +300 mm).
 * Đài 3 cọc → lục giác (tam giác đều cắt góc); 2/4/5 → chữ nhật/vuông.
 */

import type { PileCapGeometry, PileCapInputs, PileCount, Point } from './types'

const EPS = 1e-6

export function almostEqual(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps
}

export function polygonArea(poly: Point[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/** Đảm bảo outline theo chiều CCW. */
export function ensureCcw(poly: Point[]): Point[] {
  if (polygonArea(poly) >= 0) return poly.slice()
  return poly.slice().reverse()
}

export function bboxOf(poly: Point[]): PileCapGeometry['bbox'] {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of poly) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

export function rectOutline(width: number, height: number, cx = 0, cy = 0): Point[] {
  const hx = width / 2
  const hy = height / 2
  return [
    { x: cx - hx, y: cy - hy },
    { x: cx + hx, y: cy - hy },
    { x: cx + hx, y: cy + hy },
    { x: cx - hx, y: cy + hy },
  ]
}

/**
 * Giao đoạn thẳng vô hạn theo phương ngang (y = const) với cạnh đa giác.
 * Trả về các hoành độ x đã sắp xếp.
 */
export function intersectHorizontal(poly: Point[], y: number): number[] {
  const xs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dy = b.y - a.y
    if (Math.abs(dy) < EPS) {
      // Cạnh ngang: bỏ qua (không tạo chord ổn định); đỉnh sẽ bắt ở cạnh nghiêng.
      continue
    }
    const t = (y - a.y) / dy
    if (t < -EPS || t > 1 + EPS) continue
    const x = a.x + t * (b.x - a.x)
    // Chỉ nhận khi y nằm trong khoảng mở của cạnh theo quy ước half-open
    // để tránh đếm đôi tại đỉnh: cạnh "sở hữu" đầu dưới.
    const yLo = Math.min(a.y, b.y)
    const yHi = Math.max(a.y, b.y)
    if (y < yLo - EPS || y > yHi + EPS) continue
    if (almostEqual(y, yHi) && !almostEqual(y, yLo)) continue
    xs.push(x)
  }
  xs.sort((u, v) => u - v)
  return dedupeSorted(xs)
}

export function intersectVertical(poly: Point[], x: number): number[] {
  const ys: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x
    if (Math.abs(dx) < EPS) continue
    const t = (x - a.x) / dx
    if (t < -EPS || t > 1 + EPS) continue
    const y = a.y + t * (b.y - a.y)
    const xLo = Math.min(a.x, b.x)
    const xHi = Math.max(a.x, b.x)
    if (x < xLo - EPS || x > xHi + EPS) continue
    if (almostEqual(x, xHi) && !almostEqual(x, xLo)) continue
    ys.push(y)
  }
  ys.sort((u, v) => u - v)
  return dedupeSorted(ys)
}

function dedupeSorted(vals: number[], eps = 0.05): number[] {
  if (vals.length === 0) return vals
  const out = [vals[0]]
  for (let i = 1; i < vals.length; i++) {
    if (Math.abs(vals[i] - out[out.length - 1]) > eps) out.push(vals[i])
  }
  return out
}

/**
 * Chord bên trong đa giác dọc theo đường ngang y (sau lớp BV: thu hẹp cover).
 * Trả về [xStart, xEnd] hoặc null nếu không cắt được đoạn đủ dài.
 */
export function horizontalChord(
  poly: Point[],
  y: number,
  cover: number,
): { start: number; end: number } | null {
  const xs = intersectHorizontal(poly, y)
  if (xs.length < 2) return null
  // Lấy cặp ngoài cùng (đài đặc, một vùng).
  const start = xs[0] + cover
  const end = xs[xs.length - 1] - cover
  if (end - start < 1) return null
  return { start, end }
}

export function verticalChord(
  poly: Point[],
  x: number,
  cover: number,
): { start: number; end: number } | null {
  const ys = intersectVertical(poly, x)
  if (ys.length < 2) return null
  const start = ys[0] + cover
  const end = ys[ys.length - 1] - cover
  if (end - start < 1) return null
  return { start, end }
}

/** Hai đầu đoạn phẳng ngoài mỗi cọc (vuông góc tia từ tâm). */
function pileFlatEnds(pile: Point, outwardR: number, flatLen: number): [Point, Point] {
  const len = Math.hypot(pile.x, pile.y)
  if (len < EPS) {
    return [
      { x: -flatLen / 2, y: -outwardR },
      { x: flatLen / 2, y: -outwardR },
    ]
  }
  const ux = pile.x / len
  const uy = pile.y / len
  const cx = pile.x + ux * outwardR
  const cy = pile.y + uy * outwardR
  const px = -uy
  const py = ux
  return [
    { x: cx - (px * flatLen) / 2, y: cy - (py * flatLen) / 2 },
    { x: cx + (px * flatLen) / 2, y: cy + (py * flatLen) / 2 },
  ]
}

function angleOf(p: Point): number {
  return Math.atan2(p.y, p.x)
}

/**
 * Lục giác đài 3 cọc: 3 đoạn ngắn (D+2·clear) ngoài mỗi cọc,
 * nối với 3 cạnh dài song song cạnh tam giác tim cọc.
 * Khớp sơ đồ: đáy (α+1)D+300, đỉnh D+300, góc 60°.
 */
export function hexagonOutline3(
  pileDia: number,
  alpha: number,
  edgeClear: number,
): { piles: Point[]; outline: Point[]; spacing: number } {
  const s = alpha * pileDia
  const H = (Math.sqrt(3) / 2) * s
  const piles: Point[] = [
    { x: -s / 2, y: -H / 3 },
    { x: s / 2, y: -H / 3 },
    { x: 0, y: (2 * H) / 3 },
  ]
  const R = pileDia / 2 + edgeClear
  const flatLen = pileDia + 2 * edgeClear

  // 6 đỉnh = 2 đầu × 3 flat, sắp theo góc quanh gốc.
  const ends: Point[] = []
  for (const p of piles) {
    const [a, b] = pileFlatEnds(p, R, flatLen)
    ends.push(a, b)
  }
  ends.sort((u, v) => angleOf(u) - angleOf(v))

  // Loại gần trùng sau sắp góc.
  const outline: Point[] = []
  for (const p of ends) {
    const last = outline[outline.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.5) outline.push(p)
  }
  if (outline.length >= 2) {
    const f = outline[0]
    const l = outline[outline.length - 1]
    if (Math.hypot(f.x - l.x, f.y - l.y) < 0.5) outline.pop()
  }

  return { piles, outline: ensureCcw(outline), spacing: s }
}

export function pilesForCount(
  count: PileCount,
  pileDia: number,
  alpha: number,
): { piles: Point[]; spacing: number; outlineW: number; outlineH: number } {
  const s = alpha * pileDia
  const clear = 150 // dùng trong công thức cạnh điển hình; edgeClear thật truyền ở buildGeometry

  if (count === 2) {
    const piles = [
      { x: -s / 2, y: 0 },
      { x: s / 2, y: 0 },
    ]
    // (α+1)∅  ×  (∅+300)
    return {
      piles,
      spacing: s,
      outlineW: (alpha + 1) * pileDia,
      outlineH: pileDia + 2 * clear,
    }
  }

  if (count === 4) {
    const piles = [
      { x: -s / 2, y: -s / 2 },
      { x: s / 2, y: -s / 2 },
      { x: s / 2, y: s / 2 },
      { x: -s / 2, y: s / 2 },
    ]
    const side = (alpha + 1) * pileDia + 2 * clear
    return { piles, spacing: s, outlineW: side, outlineH: side }
  }

  if (count === 5) {
    const piles = [
      { x: -s / 2, y: -s / 2 },
      { x: s / 2, y: -s / 2 },
      { x: s / 2, y: s / 2 },
      { x: -s / 2, y: s / 2 },
      { x: 0, y: 0 },
    ]
    // √(2α+1)·∅ + 300
    const side = Math.sqrt(2 * alpha + 1) * pileDia + 2 * clear
    return { piles, spacing: s, outlineW: side, outlineH: side }
  }

  // count === 3 — kích thước tham chiếu; outline thật từ hexagonOutline3
  const H = (Math.sqrt(3) / 2) * s
  const piles = [
    { x: -s / 2, y: -H / 3 },
    { x: s / 2, y: -H / 3 },
    { x: 0, y: (2 * H) / 3 },
  ]
  return {
    piles,
    spacing: s,
    outlineW: (alpha + 1) * pileDia + 2 * clear,
    outlineH: H + pileDia + 2 * clear,
  }
}

export function buildGeometry(i: Pick<
  PileCapInputs,
  'pileCount' | 'pileDia' | 'alpha' | 'edgeClear' | 'xCol' | 'yCol'
>): PileCapGeometry {
  const { pileCount, pileDia, alpha, edgeClear, xCol, yCol } = i

  if (pileCount === 3) {
    const { piles, outline, spacing } = hexagonOutline3(pileDia, alpha, edgeClear)
    const bbox = bboxOf(outline)
    return {
      pileCount,
      pileDia,
      alpha,
      spacing,
      edgeClear,
      piles,
      outline,
      bbox,
      columnCenter: { x: 0, y: 0 },
      xCol,
      yCol,
    }
  }

  const layout = pilesForCount(pileCount, pileDia, alpha)
  // Cạnh dùng edgeClear thật (không cố định 150 trong pilesForCount cho outline).
  let w = layout.outlineW
  let h = layout.outlineH
  if (pileCount === 2) {
    w = (alpha + 1) * pileDia
    h = pileDia + 2 * edgeClear
  } else if (pileCount === 4) {
    w = h = (alpha + 1) * pileDia + 2 * edgeClear
  } else if (pileCount === 5) {
    w = h = Math.sqrt(2 * alpha + 1) * pileDia + 2 * edgeClear
  }
  const outline = ensureCcw(rectOutline(w, h))
  return {
    pileCount,
    pileDia,
    alpha,
    spacing: layout.spacing,
    edgeClear,
    piles: layout.piles,
    outline,
    bbox: bboxOf(outline),
    columnCenter: { x: 0, y: 0 },
    xCol,
    yCol,
  }
}

/** Chuỗi path SVG từ outline (đơn vị mm). */
export function outlineToSvgPath(outline: Point[]): string {
  if (outline.length === 0) return ''
  const [p0, ...rest] = outline
  let d = `M ${p0.x} ${p0.y}`
  for (const p of rest) d += ` L ${p.x} ${p.y}`
  return `${d} Z`
}
