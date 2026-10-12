/**
 * Demo PDF: dầm biên lệch → bảng TK 1a/1b/1c; mặt bằng planMark=1.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createSampleS1 } from "../sample.ts";
import { computeModel, planDisplayMark } from "../calc.ts";
import {
  applyAxesToProject,
  patchBeamSegShift,
  sortAxes,
  stripRebarBarSegments,
  rebarBarStraightLenMm,
} from "../grid.ts";
import { generateSlabPdf } from "../generate.ts";

let p = createSampleS1();
p = {
  ...p,
  layoutPreset: "simple2",
  info: {
    ...p.info,
    name: "Sàn S1 — demo dầm lệch",
    optimizeCut: true,
    optimizeCutMode: "avoidZones",
    lapMul: 40,
  },
};
const ax = sortAxes(p.axesX ?? []);
const left = (p.beams ?? []).find(
  (b) => b.direction === "Y" && Math.abs(b.axis - (ax[0]?.pos ?? 0)) < 1,
);
if (!left) throw new Error("missing left edge beam");
p = patchBeamSegShift(p, left.id, 0, { s0: -300, s1: 500 });
p = applyAxesToProject(p);

const model = computeModel(p);
const bottomX = model.schedule.filter(
  (r) => r.layer === "bottom" && r.direction === "X",
);
console.log(
  "schedule bottom X:",
  bottomX.map((r) => ({
    pdf: r.mark,
    plan: planDisplayMark(r),
    L: r.barLength,
    qty: r.qtyEach,
  })),
);

const axesX = sortAxes(p.axesX ?? []);
const axesY = sortAxes(p.axesY ?? []);
const bars = stripRebarBarSegments(p, axesX, axesY).filter((b) => b.dir === "X");
console.log(
  "X bars L range",
  Math.min(...bars.map(rebarBarStraightLenMm)),
  "→",
  Math.max(...bars.map(rebarBarStraightLenMm)),
);

const regular = readFileSync("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf");
const boldPath = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf";
const bold = readFileSync(
  (() => {
    try {
      readFileSync(boldPath);
      return boldPath;
    } catch {
      return "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
    }
  })(),
);

const bytes = await generateSlabPdf(p, {
  regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
  bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
});

mkdirSync("/workspace/artifacts", { recursive: true });
const pdfPath = "/workspace/artifacts/demo-bien-thien-1abc.pdf";
writeFileSync(pdfPath, Buffer.from(bytes));
console.log("pdf", pdfPath, bytes.byteLength);

// SVG minh họa: thanh X biến thiên L, nhãn họ "1"
const W = 900;
const H = 560;
const pad = 60;
const xMin = Math.min(...bars.map((b) => b.x0));
const xMax = Math.max(...bars.map((b) => b.x1));
const yMin = Math.min(...bars.map((b) => b.y));
const yMax = Math.max(...bars.map((b) => b.y));
const sx = (W - 2 * pad) / Math.max(1, xMax - xMin + 800);
const sy = (H - 2 * pad) / Math.max(1, yMax - yMin + 400);
const s = Math.min(sx, sy);
const X = (mm: number) => pad + (mm - xMin + 200) * s;
const Y = (mm: number) => H - pad - (mm - yMin + 100) * s;

const planLabel = planDisplayMark(bottomX[0] ?? { mark: "1", planMark: "1" });
const lines = bars
  .map((b, i) => {
    const y = Y(b.y);
    return `<line x1="${X(b.x0).toFixed(1)}" y1="${y.toFixed(1)}" x2="${X(b.x1).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#ef4444" stroke-width="1.6"/>`;
  })
  .join("\n");

// Label one callout "1" in the middle of the band
const midBar = bars[Math.floor(bars.length / 2)]!;
const cx = (X(midBar.x0) + X(midBar.x1)) / 2;
const cy = Y(midBar.y) - 18;

const legend = bottomX
  .map(
    (r) =>
      `PDF TK: <b>${r.mark}</b> · L=${r.barLength} · SL=${r.qtyEach} &nbsp;→&nbsp; minh họa: <b>${planDisplayMark(r)}</b>`,
  )
  .join("<br/>");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 90}" viewBox="0 0 ${W} ${H + 90}">
  <rect width="100%" height="100%" fill="#0b1220"/>
  <text x="${pad}" y="28" fill="#e2e8f0" font-family="sans-serif" font-size="16" font-weight="700">Minh họa mặt bằng — số hiệu họ ${planLabel} (không 1a/1b)</text>
  <text x="${pad}" y="48" fill="#94a3b8" font-family="sans-serif" font-size="12">Dầm biên lệch Dịch đầu/cuối · thép phương X biến thiên chiều dài</text>
  <g transform="translate(0,10)">
    ${lines}
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="11" fill="#0b1220" stroke="#f87171" stroke-width="1.5"/>
    <text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" fill="#f87171" font-family="sans-serif" font-size="12" font-weight="700">${planLabel}</text>
    <text x="${(cx + 16).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="#f87171" font-family="sans-serif" font-size="11">Ø10a150</text>
  </g>
  <foreignObject x="${pad}" y="${H + 20}" width="${W - 2 * pad}" height="70">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#cbd5e1;font:12px sans-serif;line-height:1.5">${legend}</div>
  </foreignObject>
</svg>`;

const svgPath = "/workspace/artifacts/demo-bien-thien-minh-hoa.svg";
writeFileSync(svgPath, svg);
console.log("svg", svgPath);
