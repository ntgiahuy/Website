/**
 * Mô hình 3D bố trí thép đài móng cọc (lục giác).
 * Xuất scene JSON cho Three.js / SVG isometric.
 */

import type { PileCapCalcResult, PileCapInputs, Point, VariableBar } from './types'

function almostSquare(i: PileCapInputs): boolean {
  return Math.abs(i.alphaX - i.alphaY) < 1e-6
}

export type Pt3 = { x: number; y: number; z: number }

export type Bar3D = {
  direction: 'X' | 'Y'
  /** Tâm thanh (mm). */
  a: Pt3
  b: Pt3
  d: number
  length: number
  clearLen: number
  layer: 'bottom' | 'top'
}

export type Scene3D = {
  title: string
  subtitle: string
  /** Đỉnh mặt trên đài (z = hCap), CCW. */
  capTop: Pt3[]
  /** Đỉnh mặt dưới đài (z = 0). */
  capBottom: Pt3[]
  hCap: number
  piles: { x: number; y: number; dia: number; embed: number }[]
  column: { x: number; y: number; w: number; d: number; h: number }
  bars: Bar3D[]
  bbox: { min: Pt3; max: Pt3 }
}

/** Lớp thép dưới / trên trong chiều dày đài (mm từ đáy). */
function layerZ(hCap: number, cover: number, dBar: number, isBottom: boolean): number {
  if (isBottom) return cover + dBar / 2
  return hCap - cover - dBar / 2
}

function barsTo3D(bars: VariableBar[], d: number, z: number): Bar3D[] {
  return bars.map((b) => {
    if (b.direction === 'X') {
      return {
        direction: 'X',
        a: { x: b.start, y: b.station, z },
        b: { x: b.end, y: b.station, z },
        d,
        length: b.length,
        clearLen: b.clearLen,
        layer: b.layer,
      }
    }
    return {
      direction: 'Y',
      a: { x: b.station, y: b.start, z },
      b: { x: b.station, y: b.end, z },
      d,
      length: b.length,
      clearLen: b.clearLen,
      layer: b.layer,
    }
  })
}

export function buildPileCapScene3D(inputs: PileCapInputs, result: PileCapCalcResult): Scene3D {
  const g = result.geometry
  const h = inputs.hCap
  const cover = inputs.coverBase

  // Lớp dưới = phương bottomLayerX; lớp trên = phương còn lại (cách ~1Ø).
  const zBotX = layerZ(h, cover, inputs.dFaX, true)
  const zBotY = layerZ(h, cover, inputs.dFaY, true)
  // Hai lớp đế: chồng nhau — lớp dưới + lớp trên lệch Ø.
  const zLower = Math.min(zBotX, zBotY)
  const zUpper = zLower + Math.max(inputs.dFaX, inputs.dFaY)

  const dBot = inputs.bottomLayerX ? inputs.dFaX : inputs.dFaY
  const dTop = inputs.bottomLayerX ? inputs.dFaY : inputs.dFaX
  const bars: Bar3D[] = [
    ...barsTo3D(result.barsBottom, dBot, zLower),
    ...barsTo3D(result.barsTop, dTop, zUpper),
  ]

  const toTop = (p: Point): Pt3 => ({ x: p.x, y: p.y, z: h })
  const toBot = (p: Point): Pt3 => ({ x: p.x, y: p.y, z: 0 })

  const embed = Math.min(100, h * 0.1)
  const colH = Math.max(400, h * 0.6)

  const allX = [
    ...g.outline.map((p) => p.x),
    ...g.piles.map((p) => p.x),
    ...bars.flatMap((b) => [b.a.x, b.b.x]),
  ]
  const allY = [
    ...g.outline.map((p) => p.y),
    ...g.piles.map((p) => p.y),
    ...bars.flatMap((b) => [b.a.y, b.b.y]),
  ]
  const allZ = [0, h, colH, -600]

  const uniqX = new Set(result.barsX.map((b) => b.lengthKey)).size
  const uniqY = new Set(result.barsY.map((b) => b.lengthKey)).size
  const shape =
    inputs.pileCount === 3
      ? 'lục giác'
      : inputs.pileCount === 2
        ? 'chữ nhật'
        : almostSquare(inputs)
          ? 'vuông'
          : 'chữ nhật'

  return {
    title: `${inputs.name} — đài ${inputs.pileCount} cọc (${shape}) 3D`,
    subtitle: `X ${uniqX} cỡ · Y ${uniqY} cỡ · H=${h} · ∅${inputs.pileDia} αX=${inputs.alphaX} αY=${inputs.alphaY} · móc dưới≠trên`,
    capTop: g.outline.map(toTop),
    capBottom: g.outline.map(toBot),
    hCap: h,
    piles: g.piles.map((p) => ({
      x: p.x,
      y: p.y,
      dia: g.pileDia,
      embed,
    })),
    column: {
      x: g.columnCenter.x,
      y: g.columnCenter.y,
      w: g.xCol,
      d: g.yCol,
      h: colH,
    },
    bars,
    bbox: {
      min: { x: Math.min(...allX), y: Math.min(...allY), z: Math.min(...allZ) },
      max: { x: Math.max(...allX), y: Math.max(...allY), z: Math.max(...allZ) },
    },
  }
}

/** Chiếu isometric đơn giản (mm → px logic). */
export function projectIso(p: Pt3, scale = 0.12, ox = 420, oy = 380): { x: number; y: number } {
  const cos = Math.sqrt(3) / 2
  const sin = 0.5
  return {
    x: ox + (p.x - p.y) * cos * scale,
    y: oy - (p.z * scale + (p.x + p.y) * sin * scale),
  }
}

export function renderIsoSvg(scene: Scene3D, width = 900, height = 720): string {
  const scale = 0.11
  const ox = width * 0.48
  const oy = height * 0.62
  const p = (pt: Pt3) => projectIso(pt, scale, ox, oy)

  const poly = (pts: Pt3[], fill: string, stroke: string, sw = 1.5, opacity = 1) => {
    const d = pts.map((pt, i) => {
      const q = p(pt)
      return `${i === 0 ? 'M' : 'L'} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`
    }).join(' ')
    return `<path d="${d} Z" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${sw}"/>`
  }

  // Edges of cap (vertical)
  let edges = ''
  for (let i = 0; i < scene.capTop.length; i++) {
    const a = p(scene.capBottom[i])
    const b = p(scene.capTop[i])
    edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#5d6d7e" stroke-width="1.2"/>`
  }

  // Piles (cylinders as ellipses + sides)
  let piles = ''
  for (const pile of scene.piles) {
    const r = pile.dia / 2
    const topZ = 0
    const botZ = -600
    const steps = 16
    const ring = (z: number) => {
      const pts: string[] = []
      for (let i = 0; i <= steps; i++) {
        const ang = (i / steps) * Math.PI * 2
        const q = p({ x: pile.x + r * Math.cos(ang), y: pile.y + r * Math.sin(ang), z })
        pts.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`)
      }
      return pts.join(' ')
    }
    piles += `<polyline points="${ring(topZ)}" fill="none" stroke="#7f8c8d" stroke-width="1.2" stroke-dasharray="5 3"/>`
    piles += `<polyline points="${ring(botZ)}" fill="none" stroke="#95a5a6" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`
    // vertical generators
    for (const ang of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const a = p({ x: pile.x + r * Math.cos(ang), y: pile.y + r * Math.sin(ang), z: topZ })
      const b = p({ x: pile.x + r * Math.cos(ang), y: pile.y + r * Math.sin(ang), z: botZ })
      piles += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#95a5a6" stroke-width="0.8" opacity="0.5"/>`
    }
  }

  // Column
  const cw = scene.column.w / 2
  const cd = scene.column.d / 2
  const cz0 = scene.hCap
  const cz1 = scene.hCap + scene.column.h
  const colCorners: Pt3[] = [
    { x: scene.column.x - cw, y: scene.column.y - cd, z: cz0 },
    { x: scene.column.x + cw, y: scene.column.y - cd, z: cz0 },
    { x: scene.column.x + cw, y: scene.column.y + cd, z: cz0 },
    { x: scene.column.x - cw, y: scene.column.y + cd, z: cz0 },
  ]
  const colTop = colCorners.map((c) => ({ ...c, z: cz1 }))
  let column = poly(colCorners, 'rgba(44,62,80,0.15)', '#2c3e50', 1.5)
  column += poly(colTop, 'rgba(44,62,80,0.25)', '#2c3e50', 1.5)
  for (let i = 0; i < 4; i++) {
    const a = p(colCorners[i])
    const b = p(colTop[i])
    column += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#2c3e50" stroke-width="1.4"/>`
  }

  // Bars — sort by depth for painter's algorithm
  const barEls = [...scene.bars]
    .map((bar) => {
      const mid = {
        x: (bar.a.x + bar.b.x) / 2,
        y: (bar.a.y + bar.b.y) / 2,
        z: (bar.a.z + bar.b.z) / 2,
      }
      const depth = mid.x + mid.y + mid.z * 0.4
      return { bar, depth }
    })
    .sort((u, v) => u.depth - v.depth)
    .map(({ bar }) => {
      const a = p(bar.a)
      const b = p(bar.b)
      const color = bar.direction === 'X' ? '#c0392b' : '#1f4e79'
      const sw = Math.max(1.6, bar.d * scale * 0.45)
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${color}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" opacity="0.92"/>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f7f8fa"/>
  <text x="28" y="32" font-size="16" font-weight="700" fill="#222">${scene.title}</text>
  <text x="28" y="54" font-size="12" fill="#555">${scene.subtitle}</text>
  ${piles}
  ${poly(scene.capBottom, 'rgba(93,109,126,0.12)', '#7f8c8d', 1)}
  ${edges}
  ${poly(scene.capTop, 'rgba(93,109,126,0.08)', '#5d6d7e', 1.6, 0.9)}
  ${barEls}
  ${column}
  <g transform="translate(28, ${height - 70})" font-size="12">
    <line x1="0" y1="0" x2="36" y2="0" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/>
    <text x="44" y="4" fill="#c0392b">FaX lớp dưới (biến thiên)</text>
    <line x1="0" y1="22" x2="36" y2="22" stroke="#1f4e79" stroke-width="4" stroke-linecap="round"/>
    <text x="44" y="26" fill="#1f4e79">FaY lớp trên (biến thiên)</text>
    <line x1="0" y1="44" x2="36" y2="44" stroke="#7f8c8d" stroke-width="2" stroke-dasharray="5 3"/>
    <text x="44" y="48" fill="#7f8c8d">Cọc ∅</text>
  </g>
</svg>`
}
