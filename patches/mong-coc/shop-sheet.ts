/**
 * Sheet shop drawing đài móng cọc:
 * mặt bằng · mặt cắt A-A / B-B · nổ thép · bảng thống kê.
 */

import { outlineToSvgPath, shapeLabel } from './geometry'
import { kgPerMeter, normalizeInputs } from './calc'
import type { BarGroup, PileCapCalcResult, PileCapInputs, Point, VariableBar } from './types'

const SHEET_W = 1680
const SHEET_H = 1188 // ~A2 landscape ratio @ ~150 dpi logic

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function hDim(x1: number, x2: number, y: number, label: string | number): string {
  const a = Math.min(x1, x2)
  const b = Math.max(x1, x2)
  if (b - a < 4) return ''
  const mid = (a + b) / 2
  return `<g class="dim">
    <line x1="${a}" y1="${y}" x2="${b}" y2="${y}" stroke="#222"/>
    <line x1="${a}" y1="${y - 4}" x2="${a}" y2="${y + 4}" stroke="#222"/>
    <line x1="${b}" y1="${y - 4}" x2="${b}" y2="${y + 4}" stroke="#222"/>
    <text x="${mid}" y="${y - 4}" text-anchor="middle" font-size="11" fill="#222">${esc(String(label))}</text>
  </g>`
}

function vDim(x: number, y1: number, y2: number, label: string | number): string {
  const a = Math.min(y1, y2)
  const b = Math.max(y1, y2)
  if (b - a < 4) return ''
  const mid = (a + b) / 2
  return `<g class="dim">
    <line x1="${x}" y1="${a}" x2="${x}" y2="${b}" stroke="#222"/>
    <line x1="${x - 4}" y1="${a}" x2="${x + 4}" y2="${a}" stroke="#222"/>
    <line x1="${x - 4}" y1="${b}" x2="${x + 4}" y2="${b}" stroke="#222"/>
    <text x="${x + 12}" y="${mid}" font-size="11" fill="#222" text-anchor="middle"
      dominant-baseline="middle" transform="rotate(-90 ${x + 12} ${mid})">${esc(String(label))}</text>
  </g>`
}

/** Mặt bằng trong khung (ox, oy, w, h). */
function drawPlan(
  inputs: PileCapInputs,
  result: PileCapCalcResult,
  ox: number,
  oy: number,
  w: number,
  h: number,
): string {
  const g = result.geometry
  const pad = 56
  const box = g.bbox
  const scale = Math.min((w - 2 * pad) / Math.max(box.width, 1), (h - 2 * pad - 36) / Math.max(box.height, 1))
  const tx = (x: number) => ox + pad + (x - box.minX) * scale
  const ty = (y: number) => oy + h - pad - (y - box.minY) * scale

  const path = outlineToSvgPath(g.outline.map((p) => ({ x: tx(p.x), y: ty(p.y) })))
  const piles = g.piles
    .map(
      (p) =>
        `<circle cx="${tx(p.x)}" cy="${ty(p.y)}" r="${(g.pileDia / 2) * scale}" fill="none" stroke="#666" stroke-width="1.4" stroke-dasharray="5 3"/>
         <circle cx="${tx(p.x)}" cy="${ty(p.y)}" r="2" fill="#666"/>`,
    )
    .join('')

  const col = `<rect x="${tx(g.columnCenter.x - g.xCol / 2)}" y="${ty(g.columnCenter.y + g.yCol / 2)}"
    width="${g.xCol * scale}" height="${g.yCol * scale}" fill="none" stroke="#111" stroke-width="2"/>`

  // Section cut lines A-A (horizontal through center) and B-B (vertical)
  const cutY = ty(0)
  const cutX = tx(0)
  const cuts = `
    <line x1="${tx(box.minX) - 8}" y1="${cutY}" x2="${tx(box.maxX) + 8}" y2="${cutY}" stroke="#c0392b" stroke-width="1.2" stroke-dasharray="8 4"/>
    <text x="${tx(box.maxX) + 14}" y="${cutY - 4}" font-size="12" fill="#c0392b" font-weight="700">A</text>
    <text x="${tx(box.maxX) + 14}" y="${cutY + 14}" font-size="12" fill="#c0392b" font-weight="700">A</text>
    <line x1="${cutX}" y1="${ty(box.maxY) - 8}" x2="${cutX}" y2="${ty(box.minY) + 8}" stroke="#1f4e79" stroke-width="1.2" stroke-dasharray="8 4"/>
    <text x="${cutX + 6}" y="${ty(box.maxY) - 12}" font-size="12" fill="#1f4e79" font-weight="700">B</text>
    <text x="${cutX - 14}" y="${ty(box.maxY) - 12}" font-size="12" fill="#1f4e79" font-weight="700">B</text>`

  const linesY = result.barsY
    .map(
      (b) =>
        `<line x1="${tx(b.station)}" y1="${ty(b.start)}" x2="${tx(b.station)}" y2="${ty(b.end)}" stroke="#1f4e79" stroke-width="1.15"/>`,
    )
    .join('')
  const linesX = result.barsX
    .map(
      (b) =>
        `<line x1="${tx(b.start)}" y1="${ty(b.station)}" x2="${tx(b.end)}" y2="${ty(b.station)}" stroke="#c0392b" stroke-width="1.15"/>`,
    )
    .join('')

  const dims =
    hDim(tx(box.minX), tx(box.maxX), ty(box.minY) + 22, Math.round(box.width)) +
    vDim(tx(box.maxX) + 28, ty(box.minY), ty(box.maxY), Math.round(box.height))

  return `<g id="plan">
    <text x="${ox + 8}" y="${oy + 18}" font-size="14" font-weight="700">MẶT BẰNG ĐÀI — ${esc(inputs.name)}</text>
    <text x="${ox + 8}" y="${oy + 36}" font-size="11" fill="#555">${esc(shapeLabel(inputs.pileCount))} · ${esc(g.dimNote)}</text>
    <rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="none" stroke="#bbb"/>
    <path d="${path}" fill="rgba(90,100,110,0.06)" stroke="#444" stroke-width="2"/>
    ${piles}${col}${linesY}${linesX}${cuts}${dims}
    <g font-size="11">
      <line x1="${ox + 12}" y1="${oy + h - 28}" x2="${ox + 40}" y2="${oy + h - 28}" stroke="#c0392b" stroke-width="2"/>
      <text x="${ox + 46}" y="${oy + h - 24}" fill="#c0392b">FaX</text>
      <line x1="${ox + 90}" y1="${oy + h - 28}" x2="${ox + 118}" y2="${oy + h - 28}" stroke="#1f4e79" stroke-width="2"/>
      <text x="${ox + 124}" y="${oy + h - 24}" fill="#1f4e79">FaY</text>
    </g>
  </g>`
}

/**
 * Mặt cắt đứng qua đài: cắt ngang (A-A, theo X) hoặc dọc (B-B, theo Y).
 * Hiện 2 lớp thép + cọc + cột.
 */
function drawSection(
  inputs: PileCapInputs,
  result: PileCapCalcResult,
  axis: 'AA' | 'BB',
  ox: number,
  oy: number,
  w: number,
  h: number,
): string {
  const g = result.geometry
  const box = g.bbox
  const padL = 50
  const padR = 40
  const padT = 48
  const padB = 40
  const spanMm = axis === 'AA' ? box.width : box.height
  const scale = Math.min((w - padL - padR) / Math.max(spanMm, 1), (h - padT - padB) / (inputs.hCap + 700))

  const z0 = oy + padT + 80 // top of cap in SVG (will flip: higher Z = smaller y)
  const x0 = ox + padL
  const toX = (mm: number) => {
    if (axis === 'AA') return x0 + (mm - box.minX) * scale
    return x0 + (mm - box.minY) * scale
  }
  const toY = (zMm: number) => z0 + (inputs.hCap - zMm) * scale

  const lo = axis === 'AA' ? box.minX : box.minY
  const hi = axis === 'AA' ? box.maxX : box.maxY
  const yTop = toY(inputs.hCap)
  const yBot = toY(0)

  // Cap body rectangle (approx bbox for AA/BB — hex shows as trapezoid for AA through center)
  let capPoly = ''
  if (axis === 'AA' && g.shape === 'hexagon') {
    // Horizontal chord at y=0 for top & use outline extremes for bottom strip — simplified: use bbox
    const pts: Point[] = [
      { x: lo, y: 0 },
      { x: hi, y: 0 },
      { x: hi, y: inputs.hCap },
      { x: lo, y: inputs.hCap },
    ]
    // Better: sample outline chords at mid — for AA through y=0, width varies; use full bbox for clarity
    void pts
  }

  const cap = `<rect x="${toX(lo)}" y="${yTop}" width="${(hi - lo) * scale}" height="${inputs.hCap * scale}"
    fill="rgba(140,150,160,0.12)" stroke="#333" stroke-width="1.6"/>`

  // Column stub on top
  const colW = axis === 'AA' ? g.xCol : g.yCol
  const colX0 = toX(-colW / 2)
  const colH = 350
  const column = `<rect x="${colX0}" y="${yTop - colH * scale}" width="${colW * scale}" height="${colH * scale}"
    fill="rgba(44,62,80,0.12)" stroke="#111" stroke-width="1.5"/>`

  // Piles under cut
  const pilesOnCut = g.piles.filter((p) => {
    const t = axis === 'AA' ? Math.abs(p.y) : Math.abs(p.x)
    return t < g.pileDia * 0.65 // near cut plane
  })
  const pileBodies = (pilesOnCut.length ? pilesOnCut : g.piles.slice(0, 2))
    .map((p) => {
      const cx = toX(axis === 'AA' ? p.x : p.y)
      const r = (g.pileDia / 2) * scale
      const yP0 = yBot
      const yP1 = yBot + 550 * scale
      return `<rect x="${cx - r}" y="${yP0}" width="${2 * r}" height="${yP1 - yP0}" fill="none" stroke="#666" stroke-width="1.2" stroke-dasharray="4 3"/>`
    })
    .join('')

  // Rebar dots / lines in section
  const cover = inputs.coverBase
  const dBot = inputs.bottomLayerX ? inputs.dFaX : inputs.dFaY
  const dTop = inputs.bottomLayerX ? inputs.dFaY : inputs.dFaX
  const zBot = cover + dBot / 2
  const zTop = zBot + Math.max(dBot, dTop)

  // Bars parallel to cut appear as lines; bars perpendicular as dots
  const barsPar: VariableBar[] = axis === 'AA' ? result.barsX : result.barsY
  const barsPerp: VariableBar[] = axis === 'AA' ? result.barsY : result.barsX

  const parLines = barsPar
    .filter((_, i) => i % Math.max(1, Math.floor(barsPar.length / 8)) === 0 || i === barsPar.length - 1)
    .map((b) => {
      const z = b.layer === 'bottom' ? zBot : zTop
      const color = b.direction === 'X' ? '#c0392b' : '#1f4e79'
      // In AA, X bars run along X — show as horizontal line at layer z
      const x1 = toX(b.start)
      const x2 = toX(b.end)
      return `<line x1="${x1}" y1="${toY(z)}" x2="${x2}" y2="${toY(z)}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`
    })
    .join('')

  const dots = barsPerp
    .map((b) => {
      const z = b.layer === 'bottom' ? zBot : zTop
      const color = b.direction === 'X' ? '#c0392b' : '#1f4e79'
      const cx = toX(b.station)
      const r = Math.max(2.2, ((b.direction === 'X' ? inputs.dFaX : inputs.dFaY) / 2) * scale * 0.9)
      // Only show dots inside section span
      if (cx < toX(lo) - 2 || cx > toX(hi) + 2) return ''
      return `<circle cx="${cx}" cy="${toY(z)}" r="${r}" fill="${color}"/>`
    })
    .join('')

  // Hook callouts
  const hookBot = inputs.hookedBottom
    ? `móc dưới ${inputs.hookBottomLeft}+${inputs.hookBottomRight}`
    : 'dưới thẳng'
  const hookTop = inputs.hookedTop
    ? `móc trên ${inputs.hookTopLeft}+${inputs.hookTopRight}`
    : 'trên thẳng'

  const title = axis === 'AA' ? 'MẶT CẮT A-A' : 'MẶT CẮT B-B'
  const sub =
    axis === 'AA'
      ? `Cắt ngang · nét = FaX · chấm = FaY · ${hookBot} · ${hookTop}`
      : `Cắt dọc · nét = FaY · chấm = FaX · ${hookBot} · ${hookTop}`

  return `<g id="section-${axis}">
    <text x="${ox + 8}" y="${oy + 18}" font-size="14" font-weight="700">${title}</text>
    <text x="${ox + 8}" y="${oy + 34}" font-size="10" fill="#555">${esc(sub)}</text>
    <rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="none" stroke="#bbb"/>
    ${cap}${column}${pileBodies}${parLines}${dots}
    ${hDim(toX(lo), toX(hi), yBot + 18, Math.round(spanMm))}
    ${vDim(toX(hi) + 22, yTop, yBot, inputs.hCap)}
    <text x="${toX(lo) + 4}" y="${yTop - 6}" font-size="10" fill="#333">H=${inputs.hCap}</text>
    ${capPoly}
  </g>`
}

/** Nổ thép U / thẳng cho các nhóm (tối đa n nhóm dài nhất). */
function drawBarSchedule(
  groups: BarGroup[],
  ox: number,
  oy: number,
  w: number,
  h: number,
  maxBars = 10,
): string {
  const list = groups.slice(0, maxBars)
  const rowH = Math.min(72, (h - 50) / Math.max(list.length, 1))
  let body = ''
  list.forEach((g, i) => {
    const y = oy + 44 + i * rowH
    const mark = i + 1
    const hooked = g.shape === 'u' && g.segs.length === 3
    const scale = 0.08
    const bx = ox + 70
    const by = y + rowH * 0.55
    let shape = ''
    if (hooked) {
      const [hl, mid, hr] = g.segs
      const L = mid * scale
      const hL = Math.min(28, hl * scale)
      const hR = Math.min(28, hr * scale)
      shape = `<path d="M ${bx} ${by - hL} L ${bx} ${by} L ${bx + L} ${by} L ${bx + L} ${by - hR}"
        fill="none" stroke="#222" stroke-width="2"/>
        <text x="${bx - 4}" y="${by - hL / 2}" font-size="9" text-anchor="end">${hl}</text>
        <text x="${bx + L / 2}" y="${by + 12}" font-size="9" text-anchor="middle">${mid}</text>
        <text x="${bx + L + 4}" y="${by - hR / 2}" font-size="9">${hr}</text>`
    } else {
      const L = g.length * scale
      shape = `<line x1="${bx}" y1="${by}" x2="${bx + L}" y2="${by}" stroke="#222" stroke-width="2"/>
        <text x="${bx + L / 2}" y="${by - 6}" font-size="9" text-anchor="middle">${g.length}</text>`
    }
    body += `<g>
      <text x="${ox + 14}" y="${y + 16}" font-size="12" font-weight="700">${mark}</text>
      <text x="${ox + 36}" y="${y + 16}" font-size="11">${esc(g.label)}</text>
      <text x="${ox + w - 12}" y="${y + 16}" font-size="11" text-anchor="end">n₁=${g.n1}</text>
      ${shape}
    </g>`
  })
  const more =
    groups.length > maxBars
      ? `<text x="${ox + 14}" y="${oy + h - 10}" font-size="11" fill="#666">… còn ${groups.length - maxBars} nhóm (xem bảng thống kê)</text>`
      : ''

  return `<g id="bar-boom">
    <text x="${ox + 8}" y="${oy + 18}" font-size="14" font-weight="700">NỔ THÉP ĐẾ (theo nhóm L)</text>
    <text x="${ox + 8}" y="${oy + 34}" font-size="10" fill="#555">U = móc + đoạn thẳng + móc · lớp dưới/trên tách móc</text>
    <rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="none" stroke="#bbb"/>
    ${body}${more}
  </g>`
}

type SchedRow = {
  mark: string
  group: BarGroup
  n1: number
  nTotal: number
  totalM: number
  kg: number
}

/** Số hiệu dạng 1a, 1b… (theo lớp/phương) giống shop dầm/móng. */
function buildScheduleRows(inputs: PileCapInputs, groups: BarGroup[]): SchedRow[] {
  const qty = Math.max(1, Math.round(inputs.qty))
  const keyOrder: string[] = []
  const byKey = new Map<string, BarGroup[]>()
  for (const g of groups) {
    const key = `${g.layer}|${g.direction}|${g.d}`
    if (!byKey.has(key)) {
      byKey.set(key, [])
      keyOrder.push(key)
    }
    byKey.get(key)!.push(g)
  }
  const rows: SchedRow[] = []
  keyOrder.forEach((key, ki) => {
    const list = byKey.get(key)!
    const major = ki + 1
    list.forEach((g, ji) => {
      const mark = list.length === 1 ? String(major) : `${major}${String.fromCharCode(97 + ji)}`
      const nTotal = g.n1 * qty
      const totalM = (g.length * nTotal) / 1000
      const kg = totalM * kgPerMeter(g.d)
      rows.push({ mark, group: g, n1: g.n1, nTotal, totalM, kg })
    })
  })
  return rows
}

function drawBarShapeMini(g: BarGroup, x: number, y: number, maxW: number): string {
  const hooked = g.shape === 'u' && g.segs.length === 3
  const mid = hooked ? g.segs[1] : g.length
  const scale = Math.min(0.055, (maxW - 36) / Math.max(mid, 1))
  if (hooked) {
    const [hl, clear, hr] = g.segs
    const L = clear * scale
    const hL = Math.min(16, Math.max(8, hl * scale * 0.35))
    const hR = Math.min(16, Math.max(8, hr * scale * 0.35))
    return `<g>
      <path d="M ${x} ${y - hL} L ${x} ${y} L ${x + L} ${y} L ${x + L} ${y - hR}" fill="none" stroke="#111" stroke-width="1.4"/>
      <text x="${x - 2}" y="${y - hL / 2}" font-size="7" text-anchor="end">${hl}</text>
      <text x="${x + L / 2}" y="${y + 9}" font-size="7" text-anchor="middle">${clear}</text>
      <text x="${x + L + 2}" y="${y - hR / 2}" font-size="7">${hr}</text>
    </g>`
  }
  const L = g.length * scale
  return `<g>
    <line x1="${x}" y1="${y}" x2="${x + L}" y2="${y}" stroke="#111" stroke-width="1.4"/>
    <text x="${x + L / 2}" y="${y - 4}" font-size="7" text-anchor="middle">${g.length}</text>
  </g>`
}

/**
 * Bảng thống kê giống shop dầm/móng:
 * TÊN CẤU KIỆN (dọc = tên móng) | SỐ HIỆU | HÌNH DẠNG | Ø | DÀI 1 | C.KIỆN | SỐ THANH | TỔNG DÀI | KG
 * + bảng TỔNG HỢP CỐT THÉP bên phải.
 */
function drawTable(
  inputs: PileCapInputs,
  result: PileCapCalcResult,
  ox: number,
  oy: number,
  w: number,
  h: number,
): string {
  const qty = Math.max(1, Math.round(inputs.qty))
  const rows = buildScheduleRows(inputs, result.groups)
  const name = (inputs.name || 'MÓNG').trim()

  // Column widths matching classic sheet
  const cName = 28
  const cMark = 36
  const cShape = 150
  const cDia = 28
  const cLen = 52
  const cQty = 28
  const cN1 = 36
  const cNtot = 40
  const cTotM = 48
  const cKg = 48
  const schedW = cName + cMark + cShape + cDia + cLen + cQty + cN1 + cNtot + cTotM + cKg

  const headerH = 32
  const rowH = Math.min(20, Math.max(14, (h - 70) / Math.max(rows.length, 1)))
  const maxRows = Math.max(1, Math.floor((h - 70) / rowH))
  const shown = rows.slice(0, maxRows)
  const gridH = headerH + shown.length * rowH
  const ty0 = oy + 22

  const colX = [ox]
  ;[cName, cMark, cShape, cDia, cLen, cQty, cN1, cNtot, cTotM, cKg].reduce((x, cw) => {
    colX.push(x + cw)
    return x + cw
  }, ox)

  const mid = (i: number) => (colX[i] + colX[i + 1]) / 2

  let grid = `<rect x="${ox}" y="${ty0}" width="${schedW}" height="${gridH}" fill="#fff" stroke="#111" stroke-width="1.1"/>`
  for (let i = 1; i < colX.length - 1; i++) {
    grid += `<line x1="${colX[i]}" y1="${ty0}" x2="${colX[i]}" y2="${ty0 + gridH}" stroke="#111" stroke-width="0.6"/>`
  }
  grid += `<line x1="${ox}" y1="${ty0 + headerH}" x2="${ox + schedW}" y2="${ty0 + headerH}" stroke="#111" stroke-width="0.9"/>`

  // Header: TÊN CẤU KIỆN spans; SỐ THANH has subcols
  const headers = [
    { i: 0, t: 'TÊN CẤU KIỆN' },
    { i: 1, t: 'SỐ HIỆU' },
    { i: 2, t: 'HÌNH DẠNG & KÍCH THƯỚC (mm)' },
    { i: 3, t: 'Ø' },
    { i: 4, t: 'CHIỀU DÀI 1 THANH (mm)' },
    { i: 5, t: 'C.KIỆN' },
    { i: 6, t: 'SỐ THANH' },
    { i: 8, t: 'TỔNG CHIỀU DÀI (m)' },
    { i: 9, t: 'TỔNG TRỌNG LƯỢNG (kg)' },
  ]
  let head = ''
  // merge header for SỐ THANH over cols 6-7
  head += `<line x1="${colX[6]}" y1="${ty0 + headerH / 2}" x2="${colX[8]}" y2="${ty0 + headerH / 2}" stroke="#111" stroke-width="0.5"/>`
  head += `<text x="${mid(6) + cN1 / 2}" y="${ty0 + 11}" font-size="7.5" font-weight="700" text-anchor="middle">SỐ THANH</text>`
  head += `<text x="${mid(6)}" y="${ty0 + 26}" font-size="7" text-anchor="middle">MỘT CK</text>`
  head += `<text x="${mid(7)}" y="${ty0 + 26}" font-size="7" text-anchor="middle">TOÀN BỘ</text>`
  for (const { i, t } of headers) {
    if (i === 6) continue
    const fs = i === 2 || i === 4 || i === 8 || i === 9 ? 6.5 : 7.5
    head += `<text x="${mid(i)}" y="${ty0 + headerH / 2 + 3}" font-size="${fs}" font-weight="700" text-anchor="middle">${esc(t)}</text>`
  }

  let body = ''
  shown.forEach((r, i) => {
    const y = ty0 + headerH + i * rowH
    body += `<line x1="${colX[1]}" y1="${y + rowH}" x2="${ox + schedW}" y2="${y + rowH}" stroke="#333" stroke-width="0.35"/>`
    body += `<text x="${mid(1)}" y="${y + rowH / 2 + 3}" font-size="8" font-weight="700" text-anchor="middle">${esc(r.mark)}</text>`
    body += drawBarShapeMini(r.group, colX[2] + 14, y + rowH * 0.55, cShape - 8)
    body += `<text x="${mid(3)}" y="${y + rowH / 2 + 3}" font-size="8" text-anchor="middle">${r.group.d}</text>`
    body += `<text x="${mid(4)}" y="${y + rowH / 2 + 3}" font-size="8" text-anchor="middle">${r.group.length}</text>`
    body += `<text x="${mid(5)}" y="${y + rowH / 2 + 3}" font-size="8" text-anchor="middle">${qty}</text>`
    body += `<text x="${mid(6)}" y="${y + rowH / 2 + 3}" font-size="8" text-anchor="middle">${r.n1}</text>`
    body += `<text x="${mid(7)}" y="${y + rowH / 2 + 3}" font-size="8" text-anchor="middle">${r.nTotal}</text>`
    body += `<text x="${mid(8)}" y="${y + rowH / 2 + 3}" font-size="8" text-anchor="middle">${r.totalM.toFixed(2)}</text>`
    body += `<text x="${mid(9)}" y="${y + rowH / 2 + 3}" font-size="8" text-anchor="middle">${r.kg.toFixed(2)}</text>`
  })

  // Vertical foundation name in first column (replaces D1)
  const nameY = ty0 + headerH + (shown.length * rowH) / 2
  const nameCell = `
    <text x="${mid(0)}" y="${nameY}" font-size="12" font-weight="800" text-anchor="middle"
      dominant-baseline="middle" transform="rotate(-90 ${mid(0)} ${nameY})">${esc(name)}</text>`

  // —— Summary table (right) ——
  const dias = result.byDia.slice().sort((a, b) => a.d - b.d)
  const labW = 120
  const colW = 56
  const sumW = labW + Math.max(dias.length, 1) * colW
  const sumRowH = 22
  const sumH = 4 * sumRowH
  const sx = ox + schedW + 16
  const sy = ty0

  let sum = `<text x="${sx + sumW / 2}" y="${oy + 14}" font-size="12" font-weight="800" text-anchor="middle">TỔNG HỢP CỐT THÉP</text>`
  sum += `<rect x="${sx}" y="${sy}" width="${sumW}" height="${sumH}" fill="#fff" stroke="#111" stroke-width="1.1"/>`
  sum += `<line x1="${sx + labW}" y1="${sy}" x2="${sx + labW}" y2="${sy + sumH}" stroke="#111" stroke-width="0.6"/>`
  for (let i = 1; i < Math.max(dias.length, 1); i++) {
    sum += `<line x1="${sx + labW + i * colW}" y1="${sy}" x2="${sx + labW + i * colW}" y2="${sy + sumH}" stroke="#111" stroke-width="0.5"/>`
  }
  const labels = ['ĐƯỜNG KÍNH (mm)', 'CHIỀU DÀI (m)', 'TRỌNG LƯỢNG (kg)', 'SỐ THANH 11.7m']
  labels.forEach((lb, i) => {
    if (i > 0) sum += `<line x1="${sx}" y1="${sy + i * sumRowH}" x2="${sx + sumW}" y2="${sy + i * sumRowH}" stroke="#111" stroke-width="0.45"/>`
    sum += `<text x="${sx + 6}" y="${sy + i * sumRowH + 15}" font-size="8">${esc(lb)}</text>`
  })
  let kgLe10 = 0
  let kgLe18 = 0
  let kgGt18 = 0
  dias.forEach((d, i) => {
    const cx = sx + labW + i * colW + colW / 2
    sum += `<text x="${cx}" y="${sy + 15}" font-size="9" font-weight="700" text-anchor="middle">Ø${d.d}</text>`
    sum += `<text x="${cx}" y="${sy + sumRowH + 15}" font-size="8.5" text-anchor="middle">${d.lengthM.toFixed(2)}</text>`
    sum += `<text x="${cx}" y="${sy + 2 * sumRowH + 15}" font-size="8.5" text-anchor="middle">${d.kg.toFixed(2)}</text>`
    const stock = d.d <= 10 ? '—' : String(d.bars117)
    sum += `<text x="${cx}" y="${sy + 3 * sumRowH + 15}" font-size="8.5" text-anchor="middle">${stock}</text>`
    if (d.d <= 10) kgLe10 += d.kg
    if (d.d <= 18) kgLe18 += d.kg
    if (d.d > 18) kgGt18 += d.kg
  })
  const fy = sy + sumH + 16
  sum += `<text x="${sx}" y="${fy}" font-size="9" font-weight="700">NHÓM Ø≤10 (kg): ${kgLe10.toFixed(2)}</text>`
  sum += `<text x="${sx}" y="${fy + 14}" font-size="9" font-weight="700">NHÓM 10&lt;Ø≤18 (kg): ${(kgLe18 - kgLe10).toFixed(2)}</text>`
  sum += `<text x="${sx}" y="${fy + 28}" font-size="9" font-weight="700">NHÓM Ø&gt;18 (kg): ${kgGt18.toFixed(2)}</text>`

  const more =
    rows.length > shown.length
      ? `<text x="${ox}" y="${ty0 + gridH + 12}" font-size="9" fill="#666">… còn ${rows.length - shown.length} dòng (đủ nhóm trong dữ liệu)</text>`
      : ''

  return `<g id="schedule">
    <text x="${ox + schedW / 2}" y="${oy + 14}" font-size="13" font-weight="800" text-anchor="middle">BẢNG THỐNG KÊ CỐT THÉP</text>
    ${grid}${head}${body}${nameCell}
    ${sum}${more}
  </g>`
}

/** Chỉ xuất 2 bảng thống kê (giống ảnh mẫu), tên cấu kiện = tên móng. */
export function renderScheduleOnly(raw: PileCapInputs, result: PileCapCalcResult): string {
  const inputs = normalizeInputs(raw)
  const rows = buildScheduleRows(inputs, result.groups)
  const rowH = 18
  const headerH = 34
  const schedH = 40 + headerH + rows.length * rowH + 20
  const w = 1100
  const h = Math.max(schedH, 220)
  const inner = drawTable(inputs, result, 16, 8, w - 32, h - 16)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${inner}
</svg>`
}

/** Sheet A2 ngang đầy đủ 4 khối. */
export function renderShopSheet(raw: PileCapInputs, result: PileCapCalcResult): string {
  const inputs = normalizeInputs(raw)
  const margin = 24
  const gap = 14
  const titleH = 52

  // Layout:
  // [ Plan 55% ] [ Section AA 45% ]
  // [ Section BB 30% ] [ Bar boom 35% ] [ Table 35% ]  -- bottom row
  // Top: plan + AA. Bottom: BB nhỏ + bảng TK rộng (đúng format shop).
  const topH = 480
  const botH = SHEET_H - titleH - margin * 2 - gap - topH
  const planW = 860
  const secAAW = SHEET_W - margin * 2 - gap - planW
  const secBBW = 360
  const tableW = SHEET_W - margin * 2 - gap - secBBW

  const plan = drawPlan(inputs, result, margin, titleH + margin, planW, topH)
  const secAA = drawSection(inputs, result, 'AA', margin + planW + gap, titleH + margin, secAAW, topH)
  const secBB = drawSection(
    inputs,
    result,
    'BB',
    margin,
    titleH + margin + topH + gap,
    secBBW,
    botH,
  )
  const table = drawTable(
    inputs,
    result,
    margin + secBBW + gap,
    titleH + margin + topH + gap,
    tableW,
    botH,
  )
  const uniqX = new Set(result.barsX.map((b) => b.lengthKey)).size
  const uniqY = new Set(result.barsY.map((b) => b.lengthKey)).size

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">
  <rect width="100%" height="100%" fill="#fff"/>
  <rect x="8" y="8" width="${SHEET_W - 16}" height="${SHEET_H - 16}" fill="none" stroke="#222" stroke-width="2"/>
  <text x="${margin}" y="36" font-size="20" font-weight="800" fill="#111">SHOP DRAWING THÉP ĐÀI MÓNG CỌC — ${esc(inputs.name)}</text>
  <text x="${margin}" y="54" font-size="12" fill="#444">${esc(shapeLabel(inputs.pileCount))} · ∅${inputs.pileDia} · αX=${inputs.alphaX} αY=${inputs.alphaY} · H=${inputs.hCap} · FaX Ø${inputs.dFaX}a${inputs.aFaX} · FaY Ø${inputs.dFaY}a${inputs.aFaY} · X ${uniqX} cỡ · Y ${uniqY} cỡ · SL=${inputs.qty}</text>
  <text x="${SHEET_W - margin}" y="36" font-size="12" text-anchor="end" fill="#666">GIAHUY.NET · demo mong-coc</text>
  ${plan}
  ${secAA}
  ${secBB}
  ${table}
</svg>`
}
