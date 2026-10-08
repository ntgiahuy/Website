/**
 * Bố trí thép đế đài móng cọc — 2 lớp độc lập (Ø, a, móc).
 * Lục giác: chiều dài biến thiên; chữ nhật/vuông: gần như đều.
 */

import { bboxOf, horizontalChord, verticalChord } from './geometry'
import type { Point, VariableBar } from './types'

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

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
  layer: 'bottom' | 'top'
  direction: 'X' | 'Y'
  roundStep?: number
  minClearLen?: number
}

function finalizeBar(
  station: number,
  start: number,
  end: number,
  opt: MeshOptions,
): VariableBar | null {
  const clearLen = end - start
  const minClear = opt.minClearLen ?? 0
  if (minClear > 0 && clearLen < minClear) return null
  const hookL = opt.hooked ? Math.max(0, opt.hookLeft) : 0
  const hookR = opt.hooked ? Math.max(0, opt.hookRight) : 0
  const step = opt.roundStep ?? 10
  const length = clearLen + hookL + hookR
  return {
    station,
    start,
    end,
    clearLen,
    length,
    lengthKey: roundTo(length, step),
    layer: opt.layer,
    direction: opt.direction,
  }
}

/** Thanh phương X (song song trục X): station = y. */
export function barsDirectionX(outline: Point[], opt: MeshOptions): VariableBar[] {
  const box = bboxOf(outline)
  const stations = meshStationsInRange(box.minY, box.maxY, opt.cover, opt.spacing)
  const bars: VariableBar[] = []
  for (const y of stations) {
    const chord = horizontalChord(outline, y, opt.cover)
    if (!chord) continue
    const bar = finalizeBar(y, chord.start, chord.end, { ...opt, direction: 'X' })
    if (bar) bars.push(bar)
  }
  return bars
}

/** Thanh phương Y (song song trục Y): station = x. */
export function barsDirectionY(outline: Point[], opt: MeshOptions): VariableBar[] {
  const box = bboxOf(outline)
  const stations = meshStationsInRange(box.minX, box.maxX, opt.cover, opt.spacing)
  const bars: VariableBar[] = []
  for (const x of stations) {
    const chord = verticalChord(outline, x, opt.cover)
    if (!chord) continue
    const bar = finalizeBar(x, chord.start, chord.end, { ...opt, direction: 'Y' })
    if (bar) bars.push(bar)
  }
  return bars
}

export function groupByLength(bars: VariableBar[]): Map<number, VariableBar[]> {
  const map = new Map<number, VariableBar[]>()
  for (const b of bars) {
    const list = map.get(b.lengthKey) ?? []
    list.push(b)
    map.set(b.lengthKey, list)
  }
  return map
}
