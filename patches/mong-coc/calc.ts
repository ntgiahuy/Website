/**
 * Tính toán shop thép đài móng cọc — song song pipeline `compute()` của móng đơn.
 * Điểm khác: nhóm thép theo từng chiều dài biến thiên (không một lenMesh cố định).
 */

import { buildGeometry, polygonArea } from './geometry'
import { barsDirectionX, barsDirectionY, groupByLength, roundTo } from './rebar'
import type { BarGroup, PileCapCalcResult, PileCapInputs } from './types'

export const DIAMETERS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32]

export const DEFAULT_PILE_CAP: PileCapInputs = {
  pileCount: 3,
  pileDia: 400,
  alpha: 3,
  edgeClear: 150,
  hCap: 800,
  xCol: 400,
  yCol: 400,
  coverBase: 50,
  dFaX: 16,
  aFaX: 150,
  dFaY: 16,
  aFaY: 150,
  bottomLayerX: true,
  hooked: true,
  hookLeft: 100,
  hookRight: 100,
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

function validate(i: PileCapInputs): string[] {
  const errors: string[] = []
  if (![2, 3, 4, 5].includes(i.pileCount)) errors.push('Số cọc phải là 2, 3, 4 hoặc 5.')
  if (!(i.pileDia > 0)) errors.push('Đường kính cọc phải > 0.')
  if (!(i.alpha >= 2 && i.alpha <= 4)) errors.push('α thường lấy 2–3 (cho phép 2–4).')
  if (!(i.edgeClear >= 50)) errors.push('Phần nhô mép cọc (edgeClear) nên ≥ 50 mm.')
  if (!(i.hCap > 0)) errors.push('Chiều cao đài phải > 0.')
  if (!(i.xCol > 0 && i.yCol > 0)) errors.push('Kích thước cột phải > 0.')
  if (!(i.coverBase > 0)) errors.push('Lớp bảo vệ phải > 0.')
  if (!(i.aFaX > 0 && i.aFaY > 0)) errors.push('Khoảng thép a phải > 0.')
  if (!(i.qty >= 1)) errors.push('Số lượng cấu kiện ≥ 1.')
  if (i.hooked) {
    if (i.hookLeft < 0 || i.hookRight < 0) errors.push('Chiều dài móc không hợp lệ.')
  }
  return errors
}

function groupsFromBars(
  direction: 'X' | 'Y',
  bars: ReturnType<typeof barsDirectionX>,
  d: number,
  spacing: number,
  hooked: boolean,
  hookLeft: number,
  hookRight: number,
): BarGroup[] {
  const map = groupByLength(bars)
  const hookL = hooked ? Math.max(0, hookLeft) : 0
  const hookR = hooked ? Math.max(0, hookRight) : 0
  const groups: BarGroup[] = []

  for (const [lengthKey, list] of [...map.entries()].sort((a, b) => b[0] - a[0])) {
    const clearLen = roundTo(list[0].clearLen, 10)
    const length = lengthKey
    const segs = hooked
      ? [roundTo(hookL, 10), clearLen, roundTo(hookR, 10)]
      : [length]
    groups.push({
      direction,
      d,
      spacing,
      length,
      clearLen,
      n1: list.length,
      shape: hooked ? 'u' : 'straight',
      segs,
      label: `Fa${direction} Ø${d}a${spacing} L=${length}`,
      bars: list,
    })
  }
  return groups
}

export function computePileCap(i: PileCapInputs): PileCapCalcResult {
  const errors = validate(i)
  const geometry = buildGeometry(i)

  if (geometry.outline.length < 3) {
    errors.push('Không tạo được biên đài.')
  }
  if (i.coverBase * 2 >= Math.min(geometry.bbox.width, geometry.bbox.height)) {
    errors.push('Lớp bảo vệ quá lớn so với kích thước đài.')
  }

  const meshOpt = {
    cover: i.coverBase,
    spacing: 0,
    hooked: i.hooked,
    hookLeft: i.hookLeft,
    hookRight: i.hookRight,
  }

  const barsX = barsDirectionX(geometry.outline, { ...meshOpt, spacing: i.aFaX })
  const barsY = barsDirectionY(geometry.outline, { ...meshOpt, spacing: i.aFaY })

  if (barsX.length < 2) errors.push('Phương X: không đủ thanh sau khi cắt biên lục giác/đài.')
  if (barsY.length < 2) errors.push('Phương Y: không đủ thanh sau khi cắt biên lục giác/đài.')

  // Kiểm tra thép biến thiên thật sự trên đài 3 cọc.
  if (i.pileCount === 3) {
    const uniqX = new Set(barsX.map((b) => b.lengthKey)).size
    const uniqY = new Set(barsY.map((b) => b.lengthKey)).size
    if (uniqX < 2) errors.push('Phương X: kỳ vọng nhiều chiều dài trên lục giác (kiểm tra α, ∅, a).')
    if (uniqY < 2) errors.push('Phương Y: kỳ vọng nhiều chiều dài trên lục giác (kiểm tra α, ∅, a).')
  }

  const groupsX = groupsFromBars('X', barsX, i.dFaX, i.aFaX, i.hooked, i.hookLeft, i.hookRight)
  const groupsY = groupsFromBars('Y', barsY, i.dFaY, i.aFaY, i.hooked, i.hookLeft, i.hookRight)
  const groups = i.bottomLayerX ? [...groupsX, ...groupsY] : [...groupsY, ...groupsX]

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
  // Chu vi × chiều cao (gần đúng ván khuôn thành đài).
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
    groups,
    byDia,
    concreteCap,
    formworkCap,
    concreteCapExpr: `=diện_tích_đài×H  —  ${areaM2.toFixed(3)}×${h}=${concreteCap} m³`,
    formworkCapExpr: `=chu_vi×H  —  ${(perim / 1000).toFixed(3)}×${h}=${formworkCap} m²`,
  }
}
