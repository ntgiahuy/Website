/**
 * Tính shop thép đài móng cọc — 4 dạng đài, 2 lớp thép độc lập.
 */

import { buildGeometry, polygonArea, shapeLabel } from './geometry'
import { barsDirectionX, barsDirectionY, groupByLength, roundTo } from './rebar'
import type { BarGroup, PileCapCalcResult, PileCapInputs, VariableBar } from './types'

export const DIAMETERS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32]

export const DEFAULT_PILE_CAP: PileCapInputs = {
  pileCount: 3,
  pileDia: 400,
  alpha: 3,
  alphaX: 3,
  alphaY: 3,
  edgeClear: 150,
  hCap: 800,
  xCol: 400,
  yCol: 400,
  coverBase: 50,
  bottomLayerX: true,
  dFaX: 16,
  aFaX: 150,
  dFaY: 16,
  aFaY: 150,
  hookedBottom: true,
  hookBottomLeft: 100,
  hookBottomRight: 100,
  hookedTop: true,
  hookTopLeft: 150,
  hookTopRight: 150,
  minClearLen: 200,
  name: 'MC1',
  qty: 1,
  axisXName: '1',
  axisYName: 'A',
}

const STEEL_DENSITY = 7850

export function kgPerMeter(d: number): number {
  return (Math.PI / 4) * (d / 1000) ** 2 * STEEL_DENSITY
}

function round(n: number, digits = 2): number {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

/** Chuẩn hoá input (αX/αY, móc 2 lớp) — tương thích field cũ nếu có. */
export function normalizeInputs(raw: Partial<PileCapInputs> & Record<string, unknown>): PileCapInputs {
  const old = raw as {
    hooked?: boolean
    hookLeft?: number
    hookRight?: number
  }
  const merged: PileCapInputs = { ...DEFAULT_PILE_CAP, ...(raw as Partial<PileCapInputs>) }

  if (!Number.isFinite(merged.alphaX) || merged.alphaX <= 0) merged.alphaX = merged.alpha
  if (!Number.isFinite(merged.alphaY) || merged.alphaY <= 0) merged.alphaY = merged.alpha

  // Field cũ (một cặp móc) → áp cho cả hai lớp khi chưa khai báo field mới.
  if (typeof old.hooked === 'boolean') {
    if (!('hookedBottom' in raw)) merged.hookedBottom = old.hooked
    if (!('hookedTop' in raw)) merged.hookedTop = old.hooked
  }
  if (typeof old.hookLeft === 'number') {
    if (!('hookBottomLeft' in raw)) merged.hookBottomLeft = old.hookLeft
    if (!('hookTopLeft' in raw)) merged.hookTopLeft = old.hookLeft
  }
  if (typeof old.hookRight === 'number') {
    if (!('hookBottomRight' in raw)) merged.hookBottomRight = old.hookRight
    if (!('hookTopRight' in raw)) merged.hookTopRight = old.hookRight
  }

  merged.hookedBottom = !!merged.hookedBottom
  merged.hookedTop = !!merged.hookedTop
  merged.hookBottomLeft = Math.max(0, merged.hookBottomLeft)
  merged.hookBottomRight = Math.max(0, merged.hookBottomRight)
  merged.hookTopLeft = Math.max(0, merged.hookTopLeft)
  merged.hookTopRight = Math.max(0, merged.hookTopRight)
  merged.minClearLen = Math.max(0, merged.minClearLen ?? 0)
  return merged
}

function validate(i: PileCapInputs): string[] {
  const errors: string[] = []
  if (![2, 3, 4, 5].includes(i.pileCount)) errors.push('Số cọc phải là 2, 3, 4 hoặc 5.')
  if (!(i.pileDia > 0)) errors.push('Đường kính cọc phải > 0.')
  if (!(i.alpha >= 2 && i.alpha <= 4)) errors.push('α thường lấy 2–3 (cho phép 2–4).')
  if (!(i.alphaX >= 2 && i.alphaX <= 4)) errors.push('αX không hợp lệ.')
  if (!(i.alphaY >= 2 && i.alphaY <= 4)) errors.push('αY không hợp lệ.')
  if (!(i.edgeClear >= 50)) errors.push('Phần nhô mép cọc (edgeClear) nên ≥ 50 mm.')
  if (!(i.hCap > 0)) errors.push('Chiều cao đài phải > 0.')
  if (!(i.xCol > 0 && i.yCol > 0)) errors.push('Kích thước cột phải > 0.')
  if (!(i.coverBase > 0)) errors.push('Lớp bảo vệ phải > 0.')
  if (!(i.aFaX > 0 && i.aFaY > 0)) errors.push('Khoảng thép a phải > 0.')
  if (!(i.dFaX > 0 && i.dFaY > 0)) errors.push('Đường kính thép phải > 0.')
  if (!(i.qty >= 1)) errors.push('Số lượng cấu kiện ≥ 1.')
  if (i.hookedBottom && (i.hookBottomLeft < 0 || i.hookBottomRight < 0)) {
    errors.push('Móc lớp dưới không hợp lệ.')
  }
  if (i.hookedTop && (i.hookTopLeft < 0 || i.hookTopRight < 0)) {
    errors.push('Móc lớp trên không hợp lệ.')
  }
  return errors
}

function groupsFromBars(
  bars: VariableBar[],
  d: number,
  spacing: number,
  hooked: boolean,
  hookLeft: number,
  hookRight: number,
): BarGroup[] {
  if (bars.length === 0) return []
  const direction = bars[0].direction
  const layer = bars[0].layer
  const map = groupByLength(bars)
  const hookL = hooked ? Math.max(0, hookLeft) : 0
  const hookR = hooked ? Math.max(0, hookRight) : 0
  const groups: BarGroup[] = []

  for (const [lengthKey, list] of [...map.entries()].sort((a, b) => b[0] - a[0])) {
    const clearLen = roundTo(list[0].clearLen, 10)
    const length = lengthKey
    const segs = hooked ? [roundTo(hookL, 10), clearLen, roundTo(hookR, 10)] : [length]
    const layerTag = layer === 'bottom' ? 'dưới' : 'trên'
    groups.push({
      direction,
      layer,
      d,
      spacing,
      length,
      clearLen,
      n1: list.length,
      shape: hooked ? 'u' : 'straight',
      segs,
      label: `Fa${direction}/${layerTag} Ø${d}a${spacing} L=${length}`,
      bars: list,
    })
  }
  return groups
}

export function computePileCap(raw: PileCapInputs | Partial<PileCapInputs>): PileCapCalcResult {
  const i = normalizeInputs(raw as PileCapInputs)
  const errors = validate(i)
  const geometry = buildGeometry(i)

  if (geometry.outline.length < 3) errors.push('Không tạo được biên đài.')
  if (i.coverBase * 2 >= Math.min(geometry.bbox.width, geometry.bbox.height)) {
    errors.push('Lớp bảo vệ quá lớn so với kích thước đài.')
  }

  const botDir: 'X' | 'Y' = i.bottomLayerX ? 'X' : 'Y'
  const topDir: 'X' | 'Y' = i.bottomLayerX ? 'Y' : 'X'

  const optBottom = {
    cover: i.coverBase,
    hooked: i.hookedBottom,
    hookLeft: i.hookBottomLeft,
    hookRight: i.hookBottomRight,
    layer: 'bottom' as const,
    minClearLen: i.minClearLen,
  }
  const optTop = {
    cover: i.coverBase,
    hooked: i.hookedTop,
    hookLeft: i.hookTopLeft,
    hookRight: i.hookTopRight,
    layer: 'top' as const,
    minClearLen: i.minClearLen,
  }

  const make = (dir: 'X' | 'Y', layer: 'bottom' | 'top') => {
    const opt = layer === 'bottom' ? optBottom : optTop
    const spacing = dir === 'X' ? i.aFaX : i.aFaY
    if (dir === 'X') return barsDirectionX(geometry.outline, { ...opt, spacing, direction: 'X' })
    return barsDirectionY(geometry.outline, { ...opt, spacing, direction: 'Y' })
  }

  const barsBottom = make(botDir, 'bottom')
  const barsTop = make(topDir, 'top')
  const barsX = botDir === 'X' ? barsBottom : barsTop
  const barsY = botDir === 'Y' ? barsBottom : barsTop

  if (barsX.length < 2) errors.push(`Phương X (${shapeLabel(i.pileCount)}): không đủ thanh.`)
  if (barsY.length < 2) errors.push(`Phương Y (${shapeLabel(i.pileCount)}): không đủ thanh.`)

  if (i.pileCount === 3) {
    const uniqX = new Set(barsX.map((b) => b.lengthKey)).size
    const uniqY = new Set(barsY.map((b) => b.lengthKey)).size
    if (uniqX < 2) errors.push('Phương X lục giác: kỳ vọng nhiều chiều dài.')
    if (uniqY < 2) errors.push('Phương Y lục giác: kỳ vọng nhiều chiều dài.')
  }

  const dBot = botDir === 'X' ? i.dFaX : i.dFaY
  const aBot = botDir === 'X' ? i.aFaX : i.aFaY
  const dTop = topDir === 'X' ? i.dFaX : i.dFaY
  const aTop = topDir === 'X' ? i.aFaX : i.aFaY

  const groups = [
    ...groupsFromBars(
      barsBottom,
      dBot,
      aBot,
      i.hookedBottom,
      i.hookBottomLeft,
      i.hookBottomRight,
    ),
    ...groupsFromBars(barsTop, dTop, aTop, i.hookedTop, i.hookTopLeft, i.hookTopRight),
  ]

  const qty = Math.max(1, Math.round(i.qty))
  const byMap = new Map<number, { d: number; kg: number; lengthM: number; bars117: number }>()
  for (const g of groups) {
    const totalM = (g.length * g.n1 * qty) / 1000
    const kg = totalM * kgPerMeter(g.d)
    const cur = byMap.get(g.d) ?? { d: g.d, kg: 0, lengthM: 0, bars117: 0 }
    cur.kg += kg
    cur.lengthM += totalM
    byMap.set(g.d, cur)
  }
  const byDia = [...byMap.values()]
    .sort((a, b) => a.d - b.d)
    .map((x) => ({
      d: x.d,
      kg: round(x.kg, 2),
      lengthM: round(x.lengthM, 2),
      bars117: Math.ceil(x.lengthM / 11.7),
    }))

  const areaMm2 = Math.abs(polygonArea(geometry.outline))
  const areaM2 = areaMm2 / 1e6
  const h = i.hCap / 1000
  const concreteCap = round(areaM2 * h, 3)
  let perim = 0
  for (let k = 0; k < geometry.outline.length; k++) {
    const a = geometry.outline[k]
    const b = geometry.outline[(k + 1) % geometry.outline.length]
    perim += Math.hypot(b.x - a.x, b.y - a.y)
  }
  const formworkCap = round((perim / 1000) * h, 2)

  return {
    errors,
    geometry,
    barsX,
    barsY,
    barsBottom,
    barsTop,
    groups,
    byDia,
    concreteCap,
    formworkCap,
    concreteCapExpr: `=diện_tích_đài×H  —  ${areaM2.toFixed(3)}×${h}=${concreteCap} m³`,
    formworkCapExpr: `=chu_vi×H  —  ${(perim / 1000).toFixed(3)}×${h}=${formworkCap} m²`,
  }
}
