/**
 * Hình học 4 dạng đài móng cọc theo sơ đồ khuyến nghị:
 *  1) 2 cọc — chữ nhật: (α+1)∅ × (∅+300), s=α∅
 *  2) 3 cọc — lục giác: đáy (α+1)∅+300, đỉnh ∅+300, 60°
 *  3) 4 cọc — vuông/chữ nhật: cạnh (α+1)∅+300, s=α∅
 *  4) 5 cọc — vuông/chữ nhật + cọc giữa: cạnh √(2α+1)·∅+300
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

function dedupeSorted(vals: number[], eps = 0.05): number[] {
  if (vals.length === 0) return vals
  const out = [vals[0]]
  for (let i = 1; i < vals.length; i++) {
    if (Math.abs(vals[i] - out[out.length - 1]) > eps) out.push(vals[i])
  }
  return out
}

export function intersectHorizontal(poly: Point[], y: number): number[] {
  const xs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dy = b.y - a.y
    if (Math.abs(dy) < EPS) continue
    const t = (y - a.y) / dy
    if (t < -EPS || t > 1 + EPS) continue
    const x = a.x + t * (b.x - a.x)
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

export function horizontalChord(
  poly: Point[],
  y: number,
  cover: number,
): { start: number; end: number } | null {
  const xs = intersectHorizontal(poly, y)
  if (xs.length < 2) return null
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

function resolvedAlphas(i: Pick<PileCapInputs, 'alpha' | 'alphaX' | 'alphaY'>): {
  ax: number
  ay: number
} {
  const ax = Number.isFinite(i.alphaX) && i.alphaX > 0 ? i.alphaX : i.alpha
  const ay = Number.isFinite(i.alphaY) && i.alphaY > 0 ? i.alphaY : i.alpha
  return { ax, ay }
}

/**
 * Lục giác đài 3 cọc khớp sơ đồ:
 * - Đáy dài Wbot = (α+1)∅ + 2·clear
 * - Đỉnh ngắn Wtop = ∅ + 2·clear
 * - Cạnh nghiêng 60° (tam giác đều cắt góc đều)
 * - 3 cọc tại đỉnh tam giác đều cạnh s = α∅
 */
export function hexagonOutline3(
  pileDia: number,
  alpha: number,
  edgeClear: number,
): { piles: Point[]; outline: Point[]; spacing: number; dimNote: string } {
  const s = alpha * pileDia
  const H = (Math.sqrt(3) / 2) * s
  const piles: Point[] = [
    { x: -s / 2, y: -H / 3 },
    { x: s / 2, y: -H / 3 },
    { x: 0, y: (2 * H) / 3 },
  ]

  const Wbot = (alpha + 1) * pileDia + 2 * edgeClear
  const Wtop = pileDia + 2 * edgeClear
  // Cắt góc đều: short flat = Wtop, long side = Wbot
  // Tam giác ngoài cạnh S = Wbot + 2*Wtop (vì flat ngắn = đoạn cắt a trên mỗi cạnh)
  const aCut = Wtop
  const S = Wbot + 2 * aCut
  const Ht = (Math.sqrt(3) / 2) * S
  // Đỉnh tam giác ngoài, centroid tại 0
  const A = { x: 0, y: (2 * Ht) / 3 } // top
  const B = { x: S / 2, y: -Ht / 3 } // BR
  const C = { x: -S / 2, y: -Ht / 3 } // BL

  const along = (from: Point, to: Point, dist: number): Point => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist }
  }

  // Hexagon CCW: bottom long → BR short → top short → BL short
  const outline = ensureCcw([
    along(C, B, aCut), // bottom-left of long side
    along(B, C, aCut), // bottom-right of long side
    along(B, A, aCut), // lower end of BR short / start of right long
    along(A, B, aCut), // right end of top short
    along(A, C, aCut), // left end of top short
    along(C, A, aCut), // upper end of BL short
  ])

  return {
    piles,
    outline,
    spacing: s,
    dimNote: `3 cọc lục giác: đáy ${(alpha + 1)}∅+${2 * edgeClear}, đỉnh ∅+${2 * edgeClear}, s=${alpha}∅, 60°`,
  }
}

export function layout2(
  pileDia: number,
  alpha: number,
  edgeClear: number,
): { piles: Point[]; outline: Point[]; spacingX: number; spacingY: number; dimNote: string } {
  const s = alpha * pileDia
  const w = (alpha + 1) * pileDia
  const h = pileDia + 2 * edgeClear
  const piles = [
    { x: -s / 2, y: 0 },
    { x: s / 2, y: 0 },
  ]
  return {
    piles,
    outline: ensureCcw(rectOutline(w, h)),
    spacingX: s,
    spacingY: 0,
    dimNote: `2 cọc chữ nhật: ${(alpha + 1)}∅ × (∅+${2 * edgeClear}), s=${alpha}∅`,
  }
}

export function layout4(
  pileDia: number,
  alphaX: number,
  alphaY: number,
  edgeClear: number,
): { piles: Point[]; outline: Point[]; spacingX: number; spacingY: number; dimNote: string } {
  const sx = alphaX * pileDia
  const sy = alphaY * pileDia
  const w = (alphaX + 1) * pileDia + 2 * edgeClear
  const h = (alphaY + 1) * pileDia + 2 * edgeClear
  const piles = [
    { x: -sx / 2, y: -sy / 2 },
    { x: sx / 2, y: -sy / 2 },
    { x: sx / 2, y: sy / 2 },
    { x: -sx / 2, y: sy / 2 },
  ]
  const shape = almostEqual(w, h) ? 'vuông' : 'chữ nhật'
  return {
    piles,
    outline: ensureCcw(rectOutline(w, h)),
    spacingX: sx,
    spacingY: sy,
    dimNote: `4 cọc ${shape}: ${(alphaX + 1)}∅+${2 * edgeClear} × ${(alphaY + 1)}∅+${2 * edgeClear}, sX=${alphaX}∅, sY=${alphaY}∅`,
  }
}

export function layout5(
  pileDia: number,
  alphaX: number,
  alphaY: number,
  edgeClear: number,
): { piles: Point[]; outline: Point[]; spacingX: number; spacingY: number; dimNote: string } {
  // Sơ đồ: cạnh ngoài = √(2α+1)·∅ + 300
  const w = Math.sqrt(2 * alphaX + 1) * pileDia + 2 * edgeClear
  const h = Math.sqrt(2 * alphaY + 1) * pileDia + 2 * edgeClear
  // Tim cọc góc: cách mép = ∅/2 + clear → khoảng cách giữa 2 cọc góc
  const sx = Math.max(0, w - pileDia - 2 * edgeClear)
  const sy = Math.max(0, h - pileDia - 2 * edgeClear)
  const piles = [
    { x: -sx / 2, y: -sy / 2 },
    { x: sx / 2, y: -sy / 2 },
    { x: sx / 2, y: sy / 2 },
    { x: -sx / 2, y: sy / 2 },
    { x: 0, y: 0 },
  ]
  const shape = almostEqual(w, h) ? 'vuông' : 'chữ nhật'
  return {
    piles,
    outline: ensureCcw(rectOutline(w, h)),
    spacingX: sx,
    spacingY: sy,
    dimNote: `5 cọc ${shape}: √(2α+1)·∅+${2 * edgeClear}, cọc giữa + 4 góc`,
  }
}

export function buildGeometry(
  i: Pick<
    PileCapInputs,
    'pileCount' | 'pileDia' | 'alpha' | 'alphaX' | 'alphaY' | 'edgeClear' | 'xCol' | 'yCol'
  >,
): PileCapGeometry {
  const { pileCount, pileDia, edgeClear, xCol, yCol } = i
  const { ax, ay } = resolvedAlphas(i)
  const alpha = i.alpha

  if (pileCount === 3) {
    const { piles, outline, spacing, dimNote } = hexagonOutline3(pileDia, ax, edgeClear)
    return {
      pileCount,
      pileDia,
      alpha,
      alphaX: ax,
      alphaY: ay,
      spacingX: spacing,
      spacingY: spacing,
      edgeClear,
      shape: 'hexagon',
      piles,
      outline,
      bbox: bboxOf(outline),
      columnCenter: { x: 0, y: 0 },
      xCol,
      yCol,
      dimNote,
    }
  }

  let layout: ReturnType<typeof layout2>
  if (pileCount === 2) layout = layout2(pileDia, ax, edgeClear)
  else if (pileCount === 4) layout = layout4(pileDia, ax, ay, edgeClear)
  else layout = layout5(pileDia, ax, ay, edgeClear)

  return {
    pileCount,
    pileDia,
    alpha,
    alphaX: ax,
    alphaY: ay,
    spacingX: layout.spacingX,
    spacingY: layout.spacingY,
    edgeClear,
    shape: 'rectangle',
    piles: layout.piles,
    outline: layout.outline,
    bbox: bboxOf(layout.outline),
    columnCenter: { x: 0, y: 0 },
    xCol,
    yCol,
    dimNote: layout.dimNote,
  }
}

export function outlineToSvgPath(outline: Point[]): string {
  if (outline.length === 0) return ''
  const [p0, ...rest] = outline
  let d = `M ${p0.x} ${p0.y}`
  for (const p of rest) d += ` L ${p.x} ${p.y}`
  return `${d} Z`
}

export function shapeLabel(count: PileCount): string {
  switch (count) {
    case 2:
      return '2 cọc · chữ nhật'
    case 3:
      return '3 cọc · lục giác'
    case 4:
      return '4 cọc · vuông/chữ nhật'
    case 5:
      return '5 cọc · vuông/chữ nhật'
  }
}
