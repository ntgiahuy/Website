/**
 * Bố trí thép đế đài móng cọc — chiều dài biến thiên theo biên đa giác.
 *
 * Khác móng đơn (một lenMeshX / lenMeshY cố định): mỗi station cắt chord
 * với outline (lục giác hoặc chữ nhật) rồi + móc.
 */

import {
  bboxOf,
  horizontalChord,
  verticalChord,
} from './geometry'
import type { Point, VariableBar } from './types'

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

/**
 * Station lưới trong [lo, hi], mép trong cover — giống meshStations móng đơn
 * nhưng theo khoảng tuyệt đối (không giả định gốc = 0).
 */
export function meshStationsInRange(
  lo: number,
  hi: number,
  cover: number,
  spacing: number,
): number[] {
  const span = hi - lo
  const clear = span - 2 * cover
  if (clear <= 0 || spacing <= 0) return [(lo + hi) / 2]
  const pts: number[] = []
  for (let i = 0; ; i++) {
    const p = lo + cover + i * spacing
    if (p > hi - cover + 0.5) break
    pts.push(p)
    if (i > 10000) break
  }
  if (pts.length === 0) pts.push((lo + hi) / 2)
  if (pts.length === 1) pts.push(Math.max(pts[0], hi - cover))
  return pts
}

export interface MeshOptions {
  cover: number
  spacing: number
  hooked: boolean
  hookLeft: number
  hookRight: number
  /** Làm tròn chiều dài thống kê (mm). */
  roundStep?: number
}

/**
 * Thanh phương X (song song trục X): station = y, cắt ngang outline.
 */
export function barsDirectionX(outline: Point[], opt: MeshOptions): VariableBar[] {
  const box = bboxOf(outline)
  const stations = meshStationsInRange(box.minY, box.maxY, opt.cover, opt.spacing)
  const hookL = opt.hooked ? Math.max(0, opt.hookLeft) : 0
  const hookR = opt.hooked ? Math.max(0, opt.hookRight) : 0
  const step = opt.roundStep ?? 10
  const bars: VariableBar[] = []

  for (const y of stations) {
    const chord = horizontalChord(outline, y, opt.cover)
    if (!chord) continue
    const clearLen = chord.end - chord.start
    const length = clearLen + hookL + hookR
    bars.push({
      station: y,
      start: chord.start,
      end: chord.end,
      clearLen,
      length,
      lengthKey: roundTo(length, step),
    })
  }
  return bars
}

/**
 * Thanh phương Y (song song trục Y): station = x, cắt dọc outline.
 */
export function barsDirectionY(outline: Point[], opt: MeshOptions): VariableBar[] {
  const box = bboxOf(outline)
  const stations = meshStationsInRange(box.minX, box.maxX, opt.cover, opt.spacing)
  const hookL = opt.hooked ? Math.max(0, opt.hookLeft) : 0
  const hookR = opt.hooked ? Math.max(0, opt.hookRight) : 0
  const step = opt.roundStep ?? 10
  const bars: VariableBar[] = []

  for (const x of stations) {
    const chord = verticalChord(outline, x, opt.cover)
    if (!chord) continue
    const clearLen = chord.end - chord.start
    const length = clearLen + hookL + hookR
    bars.push({
      station: x,
      start: chord.start,
      end: chord.end,
      clearLen,
      length,
      lengthKey: roundTo(length, step),
    })
  }
  return bars
}

/** Gộp thanh cùng lengthKey → số lượng cho bảng thống kê. */
export function groupByLength(bars: VariableBar[]): Map<number, VariableBar[]> {
  const map = new Map<number, VariableBar[]>()
  for (const b of bars) {
    const list = map.get(b.lengthKey) ?? []
    list.push(b)
    map.set(b.lengthKey, list)
  }
  return map
}
