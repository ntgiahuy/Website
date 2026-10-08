/** Sinh SVG mặt bằng đài móng cọc (không phụ thuộc React). */

import { outlineToSvgPath } from './geometry'
import type { PileCapCalcResult, PileCapInputs } from './types'

const STEEL_X = '#c0392b'
const STEEL_Y = '#1f4e79'
const CONCRETE = '#5d6d7e'
const PILE = '#7f8c8d'
const COL = '#2c3e50'

export function renderPileCapSvg(
  inputs: PileCapInputs,
  result: PileCapCalcResult,
  width = 640,
  height = 560,
): string {
  const { geometry, barsX, barsY } = result
  const pad = 80
  const box = geometry.bbox
  const scale = Math.min(
    (width - 2 * pad) / Math.max(box.width, 1),
    (height - 2 * pad) / Math.max(box.height, 1),
  )
  const tx = (x: number) => pad + (x - box.minX) * scale
  const ty = (y: number) => height - pad - (y - box.minY) * scale
  const pathD = outlineToSvgPath(
    geometry.outline.map((p) => ({ x: tx(p.x), y: ty(p.y) })),
  )

  const pileCircles = geometry.piles
    .map(
      (p) =>
        `<circle cx="${tx(p.x)}" cy="${ty(p.y)}" r="${(geometry.pileDia / 2) * scale}" fill="none" stroke="${PILE}" stroke-width="1.5" stroke-dasharray="6 4"/>`,
    )
    .join('')

  const linesX = barsX
    .map(
      (b) =>
        `<line x1="${tx(b.start)}" y1="${ty(b.station)}" x2="${tx(b.end)}" y2="${ty(b.station)}" stroke="${STEEL_X}" stroke-width="1.25"/>`,
    )
    .join('')
  const linesY = barsY
    .map(
      (b) =>
        `<line x1="${tx(b.station)}" y1="${ty(b.start)}" x2="${tx(b.station)}" y2="${ty(b.end)}" stroke="${STEEL_Y}" stroke-width="1.25"/>`,
    )
    .join('')

  const uniqX = new Set(barsX.map((b) => b.lengthKey)).size
  const uniqY = new Set(barsY.map((b) => b.lengthKey)).size
  const shapeNote = inputs.pileCount === 3 ? ' (lục giác)' : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${pad}" y="28" font-size="14" font-weight="700" fill="#222">${inputs.name} — đài ${inputs.pileCount} cọc${shapeNote} · ∅${inputs.pileDia} · α=${inputs.alpha}</text>
  <text x="${pad}" y="48" font-size="11" fill="#555">Thép biến thiên: X ${uniqX} cỡ dài · Y ${uniqY} cỡ dài</text>
  <path d="${pathD}" fill="rgba(93,109,126,0.08)" stroke="${CONCRETE}" stroke-width="2"/>
  ${pileCircles}
  <rect x="${tx(geometry.columnCenter.x - geometry.xCol / 2)}" y="${ty(geometry.columnCenter.y + geometry.yCol / 2)}" width="${geometry.xCol * scale}" height="${geometry.yCol * scale}" fill="none" stroke="${COL}" stroke-width="2"/>
  ${linesY}
  ${linesX}
</svg>`
}
