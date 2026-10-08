/**
 * Kiểm tra 4 dạng đài + 2 lớp thép độc lập.
 * Usage: npm test
 */

import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function loadTs(rel) {
  return import(pathToFileURL(path.join(__dirname, rel)).href)
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

const { buildGeometry, hexagonOutline3, horizontalChord, bboxOf } = await loadTs('geometry.ts')
const { computePileCap, DEFAULT_PILE_CAP, normalizeInputs } = await loadTs('calc.ts')
const { SAMPLE_2, SAMPLE_HEX3, SAMPLE_4_SQUARE, SAMPLE_4_RECT, SAMPLE_5, ALL_SAMPLES } =
  await loadTs('sample.ts')
const { renderPileCapSvg } = await loadTs('svg.ts')
const { buildPileCapScene3D, renderIsoSvg } = await loadTs('view3d.ts')
const { renderShopSheet, renderScheduleOnly } = await loadTs('shop-sheet.ts')

// --- Hexagon textbook dims ---
const hex = hexagonOutline3(400, 3, 150)
assert(hex.outline.length === 6, `hex 6 verts (got ${hex.outline.length})`)
// Cạnh đáy / đỉnh theo sơ đồ (bbox rộng hơn vì cạnh nghiêng).
const botEdge = hex.outline.filter((p) => Math.abs(p.y - Math.min(...hex.outline.map((q) => q.y))) < 1)
const topEdge = hex.outline.filter((p) => Math.abs(p.y - Math.max(...hex.outline.map((q) => q.y))) < 1)
const botW = Math.max(...botEdge.map((p) => p.x)) - Math.min(...botEdge.map((p) => p.x))
const topW = Math.max(...topEdge.map((p) => p.x)) - Math.min(...topEdge.map((p) => p.x))
assert(Math.abs(botW - 1900) < 1, `hex bottom edge (α+1)D+300 = 1900 (got ${botW.toFixed(1)})`)
assert(Math.abs(topW - 700) < 1, `hex top edge D+300 = 700 (got ${topW.toFixed(1)})`)
assert(hex.piles.length === 3, '3 piles')

// --- Hình 1: 2 cọc chữ nhật ---
const g2 = buildGeometry(SAMPLE_2)
assert(g2.pileCount === 2 && g2.piles.length === 2, '2-pile count')
assert(g2.shape === 'rectangle', '2-pile rectangle')
assert(Math.abs(g2.bbox.width - 1600) < 1, `2-pile W=(α+1)D=1600 (got ${g2.bbox.width})`)
assert(Math.abs(g2.bbox.height - 700) < 1, `2-pile H=D+300=700 (got ${g2.bbox.height})`)
const r2 = computePileCap(SAMPLE_2)
assert(r2.errors.length === 0, `2-pile no errors: ${r2.errors.join('; ')}`)
assert(new Set(r2.barsX.map((b) => b.lengthKey)).size === 1, '2-pile X uniform')
assert(new Set(r2.barsY.map((b) => b.lengthKey)).size === 1, '2-pile Y uniform')
assert(r2.barsBottom[0]?.layer === 'bottom', 'bottom layer tagged')
assert(r2.barsTop[0]?.layer === 'top', 'top layer tagged')

// --- Hình 2: 3 cọc lục giác biến thiên + móc khác lớp ---
const r3 = computePileCap(SAMPLE_HEX3)
assert(r3.geometry.shape === 'hexagon', '3-pile hexagon')
assert(r3.geometry.piles.length === 3, '3 piles')
const u3x = new Set(r3.barsX.map((b) => b.lengthKey)).size
const u3y = new Set(r3.barsY.map((b) => b.lengthKey)).size
assert(u3x >= 2, `3-pile variable X (${u3x})`)
assert(u3y >= 2, `3-pile variable Y (${u3y})`)
assert(SAMPLE_HEX3.hookBottomLeft !== SAMPLE_HEX3.hookTopLeft, 'hooks bottom≠top in sample')
// Bottom layer uses bottom hooks in length
const botL = r3.barsBottom[0]
const topL = r3.barsTop[0]
assert(botL && topL, 'both layers have bars')
assert(
  Math.abs(botL.length - botL.clearLen - 200) < 1,
  `bottom hooks 100+100 in length (L-clear=${botL.length - botL.clearLen})`,
)
assert(
  Math.abs(topL.length - topL.clearLen - 300) < 1,
  `top hooks 150+150 in length (L-clear=${topL.length - topL.clearLen})`,
)
assert(!r3.errors.some((e) => e.includes('không đủ')), `3-pile hard ok: ${r3.errors.join('; ')}`)

// Chord shorter near top
const midY = (r3.geometry.bbox.minY + r3.geometry.bbox.maxY) / 2
const nearTop = r3.geometry.bbox.maxY - 100
const { horizontalChord: hChord } = await loadTs('geometry.ts')
const cMid = hChord(r3.geometry.outline, midY, 50)
const cTop = hChord(r3.geometry.outline, nearTop, 50)
assert(cMid && cTop && cMid.end - cMid.start > cTop.end - cTop.start, 'X shorter near top')

// --- Hình 3: 4 cọc vuông ---
const r4 = computePileCap(SAMPLE_4_SQUARE)
assert(r4.geometry.piles.length === 4, '4 piles')
assert(Math.abs(r4.geometry.bbox.width - r4.geometry.bbox.height) < 1, '4-pile square')
assert(Math.abs(r4.geometry.bbox.width - 1900) < 1, `4-pile side (α+1)D+300=1900 (got ${r4.geometry.bbox.width})`)
assert(new Set(r4.barsX.map((b) => b.lengthKey)).size === 1, '4-sq X uniform')
assert(new Set(r4.barsY.map((b) => b.lengthKey)).size === 1, '4-sq Y uniform')
assert(r4.errors.length === 0, `4-sq errors: ${r4.errors.join('; ')}`)

// --- Hình 3b: 4 cọc chữ nhật ---
const r4r = computePileCap(SAMPLE_4_RECT)
assert(r4r.geometry.bbox.width !== r4r.geometry.bbox.height, '4-pile rectangle W≠H')
assert(r4r.errors.length === 0, `4-rect errors: ${r4r.errors.join('; ')}`)

// --- Hình 4: 5 cọc ---
const r5 = computePileCap(SAMPLE_5)
assert(r5.geometry.piles.length === 5, '5 piles')
const expected5 = Math.sqrt(2 * 3 + 1) * 400 + 300
assert(Math.abs(r5.geometry.bbox.width - expected5) < 1, `5-pile side √(2α+1)D+300=${expected5.toFixed(1)} (got ${r5.geometry.bbox.width.toFixed(1)})`)
assert(r5.errors.length === 0, `5-pile errors: ${r5.errors.join('; ')}`)

// normalize old fields (không kèm field móc mới)
const migrated = normalizeInputs({
  pileCount: 3,
  pileDia: 400,
  alpha: 3,
  hooked: true,
  hookLeft: 90,
  hookRight: 110,
})
assert(migrated.hookBottomLeft === 90 && migrated.hookTopRight === 110, 'migrate old hooks')

// 3D scene
const scene = buildPileCapScene3D(SAMPLE_HEX3, r3)
assert(scene.bars.length === r3.barsBottom.length + r3.barsTop.length, '3d bar count')
assert(renderIsoSvg(scene).includes('<svg'), 'iso svg')

// --- Write demo catalog ---
const outDir = path.join(__dirname, 'demo')
fs.mkdirSync(outDir, { recursive: true })

const cards = []
for (const sample of ALL_SAMPLES) {
  const res = computePileCap(sample)
  const svg = renderPileCapSvg(sample, res, 520, 460)
  const file = `${sample.name.toLowerCase()}.svg`
  fs.writeFileSync(path.join(outDir, file), svg)
  if (sample.pileCount === 3) {
    fs.writeFileSync(path.join(outDir, 'hex3.svg'), svg)
    fs.writeFileSync(path.join(outDir, 'scene3d.json'), JSON.stringify(buildPileCapScene3D(sample, res), null, 2))
    fs.writeFileSync(path.join(outDir, 'iso3d.svg'), renderIsoSvg(buildPileCapScene3D(sample, res)))
  }
  const rows = res.groups
    .slice(0, 8)
    .map(
      (g) =>
        `<tr><td>${g.layer}</td><td>${g.direction}</td><td>${g.n1}</td><td>${g.length}</td><td>${g.segs.join(' + ')}</td></tr>`,
    )
    .join('')
  cards.push(`<section class="card">
  <h2>${sample.name} — ${res.geometry.dimNote}</h2>
  ${svg}
  <table><thead><tr><th>Lớp</th><th>Phương</th><th>n₁</th><th>L</th><th>Đoạn</th></tr></thead>
  <tbody>${rows}${res.groups.length > 8 ? `<tr><td colspan="5">… +${res.groups.length - 8} nhóm</td></tr>` : ''}</tbody></table>
  <p>BT ${res.concreteCap} m³ · VK ${res.formworkCap} m² · X ${new Set(res.barsX.map(b=>b.lengthKey)).size} cỡ · Y ${new Set(res.barsY.map(b=>b.lengthKey)).size} cỡ</p>
</section>`)
}

const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"/>
<title>4 dạng đài móng cọc — shop thép 2 lớp</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#fafafa;color:#222}
.card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:20px 0}
table{border-collapse:collapse;margin-top:10px;font-size:12px}
th,td{border:1px solid #ccc;padding:4px 8px}
th{background:#f0f0f0}
.note{max-width:900px;line-height:1.5;color:#444}
a{color:#1f4e79}
</style></head><body>
<h1>Shop thép móng cọc — 4 hình theo sơ đồ khuyến nghị</h1>
<p class="note">
Hình 1: 2 cọc chữ nhật · Hình 2: 3 cọc lục giác (thép biến thiên) ·
Hình 3: 4 cọc vuông/chữ nhật · Hình 4: 5 cọc vuông/chữ nhật.<br/>
Hai lớp thép: Ø, khoảng a, đầu móc lớp dưới có thể khác lớp trên.<br/>
<a href="./view3d.html">Mô hình 3D Three.js</a> · <a href="./iso3d.svg">Isometric SVG</a>
</p>
${cards.join('\n')}
</body></html>`
fs.writeFileSync(path.join(outDir, 'index.html'), html)

// Full shop sheet for hexagonal 3-pile (primary demo)
const shopSvg = renderShopSheet(SAMPLE_HEX3, r3)
assert(shopSvg.includes('MẶT BẰNG'), 'shop has plan')
assert(shopSvg.includes('MẶT CẮT A-A'), 'shop has section AA')
assert(shopSvg.includes('MẶT CẮT B-B'), 'shop has section BB')
assert(shopSvg.includes('BẢNG THỐNG KÊ CỐT THÉP'), 'shop has schedule')
assert(shopSvg.includes('TỔNG HỢP CỐT THÉP'), 'shop has summary table')
assert(shopSvg.includes('TÊN CẤU KIỆN'), 'shop has element name column')
assert(shopSvg.includes(SAMPLE_HEX3.name), 'schedule uses foundation name not D1')
fs.writeFileSync(path.join(outDir, 'shop-mc-3c.svg'), shopSvg)

const schedOnly = renderScheduleOnly(SAMPLE_HEX3, r3)
assert(schedOnly.includes(SAMPLE_HEX3.name), 'schedule-only has foundation name')
assert(!schedOnly.includes('>D1<'), 'schedule-only has no hardcoded D1')
fs.writeFileSync(path.join(outDir, 'schedule-mc-3c.svg'), schedOnly)

// Also sheets for 2/4/5
for (const sample of [SAMPLE_2, SAMPLE_4_SQUARE, SAMPLE_5]) {
  const res = computePileCap(sample)
  fs.writeFileSync(
    path.join(outDir, `shop-${sample.name.toLowerCase()}.svg`),
    renderShopSheet(sample, res),
  )
}
console.log('Wrote demo catalog + shop sheets')

if (failed) {
  console.error(`\n${failed} failure(s)`)
  process.exit(1)
}
console.log('\nAll checks passed.')
