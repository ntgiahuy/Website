/**
 * Kiểm tra hình học lục giác + thép biến thiên (chạy bằng Node).
 * Usage: node --experimental-strip-types test-geometry.mjs
 * (file này tự chứa logic tối thiểu — không phụ thuộc bundler)
 */

import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function loadTs(rel) {
  const url = pathToFileURL(path.join(__dirname, rel)).href
  return import(url)
}

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed++
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const { buildGeometry, hexagonOutline3, horizontalChord, verticalChord, bboxOf } =
  await loadTs('geometry.ts')
const { barsDirectionX, barsDirectionY } = await loadTs('rebar.ts')
const { computePileCap, DEFAULT_PILE_CAP } = await loadTs('calc.ts')
const { SAMPLE_HEX3 } = await loadTs('sample.ts')
const { renderPileCapSvg } = await loadTs('svg.ts')

// --- Hexagon 3 piles ---
const { piles, outline, spacing } = hexagonOutline3(400, 3, 150)
assert(piles.length === 3, '3 pile centers')
assert(outline.length === 6, `hexagon has 6 vertices (got ${outline.length})`)
assert(Math.abs(spacing - 1200) < 0.1, 's = α·D = 1200')

const box = bboxOf(outline)
// Đáy tham chiếu ≈ (α+1)D+300 = 1900 — cho phép sai số do cấu trúc flat hướng tâm
assert(box.width > 1600 && box.width < 2300, `bbox width plausible (${box.width.toFixed(1)})`)
assert(box.height > 1400 && box.height < 2200, `bbox height plausible (${box.height.toFixed(1)})`)

// Chord giữa đài phải dài hơn chord gần đỉnh
const midY = (box.minY + box.maxY) / 2
const nearTop = box.maxY - 80
const cMid = horizontalChord(outline, midY, 50)
const cTop = horizontalChord(outline, nearTop, 50)
assert(!!cMid && !!cTop, 'horizontal chords exist')
assert(cMid.end - cMid.start > cTop.end - cTop.start, 'X-bars shorter near top of hexagon')

const midX = 0
const sideX = box.minX + 120
const vMid = verticalChord(outline, midX, 50)
const vSide = verticalChord(outline, sideX, 50)
assert(!!vMid, 'vertical chord at center')
if (vSide) {
  assert(vMid.end - vMid.start > vSide.end - vSide.start, 'Y-bars shorter near slanted edge')
}

const barsX = barsDirectionX(outline, {
  cover: 50,
  spacing: 150,
  hooked: true,
  hookLeft: 100,
  hookRight: 100,
})
const barsY = barsDirectionY(outline, {
  cover: 50,
  spacing: 150,
  hooked: true,
  hookLeft: 100,
  hookRight: 100,
})
const uniqX = new Set(barsX.map((b) => b.lengthKey)).size
const uniqY = new Set(barsY.map((b) => b.lengthKey)).size
assert(barsX.length >= 4, `enough X bars (${barsX.length})`)
assert(barsY.length >= 4, `enough Y bars (${barsY.length})`)
assert(uniqX >= 2, `variable X lengths (${uniqX} groups)`)
assert(uniqY >= 2, `variable Y lengths (${uniqY} groups)`)

// --- computePileCap ---
const res = computePileCap(SAMPLE_HEX3)
assert(res.errors.filter((e) => !e.includes('kỳ vọng')).length === 0, `no hard errors: ${res.errors.join('; ')}`)
assert(res.geometry.pileCount === 3, 'geometry pileCount 3')
assert(res.groups.length >= 4, `schedule groups from variable bars (${res.groups.length})`)
assert(res.concreteCap > 0, `concrete ${res.concreteCap}`)

// Rectangle 4-pile: lengths should be uniform (1 group each dir)
const rect = computePileCap({ ...DEFAULT_PILE_CAP, pileCount: 4, hooked: false })
const gx = new Set(rect.barsX.map((b) => b.lengthKey)).size
const gy = new Set(rect.barsY.map((b) => b.lengthKey)).size
assert(gx === 1, `rect4 uniform X (got ${gx})`)
assert(gy === 1, `rect4 uniform Y (got ${gy})`)

const svg = renderPileCapSvg(SAMPLE_HEX3, res)
assert(svg.includes('<svg'), 'svg renders')
assert(svg.includes('lục giác'), 'svg title mentions lục giác')

// Write demo artifact
const outDir = path.join(__dirname, 'demo')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'hex3.svg'), svg)

const scheduleRows = res.groups
  .map(
    (g) =>
      `<tr><td>${g.direction}</td><td>${g.label}</td><td>${g.n1}</td><td>${g.length}</td><td>${g.segs.join(' + ')}</td></tr>`,
  )
  .join('\n')

const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"/><title>Demo đài móng cọc lục giác</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;background:#fff;color:#222}
  table{border-collapse:collapse;margin-top:16px}
  th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}
  th{background:#f0f0f0}
  .note{max-width:720px;line-height:1.5;color:#444}
</style></head><body>
<h1>Shop thép móng cọc — đài 3 cọc lục giác</h1>
<p class="note">Thép phương X và Y cắt theo biên lục giác → mỗi station một chiều dài (biến thiên).
Khác móng đơn hình chữ nhật (một <code>lenMeshX</code> / <code>lenMeshY</code>).</p>
${svg}
<h2>Bảng nhóm thép đế (gộp theo L)</h2>
<table>
<thead><tr><th>Phương</th><th>Nhãn</th><th>n₁</th><th>L (mm)</th><th>Đoạn</th></tr></thead>
<tbody>${scheduleRows}</tbody>
</table>
<p>BT đài: ${res.concreteCap} m³ · VK: ${res.formworkCap} m²</p>
</body></html>`
fs.writeFileSync(path.join(outDir, 'index.html'), html)
console.log('Wrote demo/index.html and demo/hex3.svg')

if (failed) {
  console.error(`\n${failed} failure(s)`)
  process.exit(1)
}
console.log('\nAll checks passed.')
