/**
 * Demo: ô hình thang — thép biến thiên cả phương X và Y.
 */
import { writeFileSync, mkdirSync } from "fs";
import { Resvg } from "fs-extra-skip";
import { createSampleS1 } from "../sample.ts";
import { computeModel, planDisplayMark, effectiveZones } from "../calc.ts";
import {
  applyAxesToProject,
  patchBeamSegShift,
  sortAxes,
  stripRebarBarSegments,
  rebarBarStraightLenMm,
  buildMergedDistRanges,
  hooksForRebarBar,
  baySlabExtentMaxEnvelope,
  beamSegSideFaces,
} from "../grid.ts";

let p = createSampleS1();
p = {
  ...p,
  layoutPreset: "simple2",
  info: {
    ...p.info,
    name: "Sàn S1 — thang: biến thiên X+Y",
    showDistRange: true,
    optimizeCut: true,
    optimizeCutMode: "avoidZones",
    lapMul: 40,
  },
};
const ax = sortAxes(p.axesX ?? []);
const ay = sortAxes(p.axesY ?? []);
const left = (p.beams ?? []).find(
  (b) => b.direction === "Y" && Math.abs(b.axis - (ax[0]?.pos ?? 0)) < 1,
)!;
const bot = (p.beams ?? []).find(
  (b) => b.direction === "X" && Math.abs(b.axis - (ay[0]?.pos ?? 0)) < 1,
)!;
// Thang / đa giác lệch: biên trái + đáy → cả X và Y biến thiên L
p = patchBeamSegShift(p, left.id, 0, { s0: -350, s1: 450 });
p = patchBeamSegShift(p, bot.id, 0, { s0: -200, s1: 280 });
p = patchBeamSegShift(p, bot.id, 1, { s0: 280, s1: -180 });
p = applyAxesToProject(p);

const axesX = sortAxes(p.axesX ?? []);
const axesY = sortAxes(p.axesY ?? []);
const zones = effectiveZones(p);
const bars = stripRebarBarSegments(p, axesX, axesY);
const xBars = bars.filter((b) => b.dir === "X");
const yBars = bars.filter((b) => b.dir === "Y");
const xL = xBars.map(rebarBarStraightLenMm);
const yL = yBars.map(rebarBarStraightLenMm);
const model = computeModel(p);
const bottom = model.schedule.filter((r) => r.layer === "bottom");

console.log(
  "X",
  xBars.length,
  Math.round(Math.min(...xL)),
  "→",
  Math.round(Math.max(...xL)),
);
console.log(
  "Y",
  yBars.length,
  Math.round(Math.min(...yL)),
  "→",
  Math.round(Math.max(...yL)),
);
console.log(
  bottom.map((r) => `${r.mark}(${planDisplayMark(r)}) ${r.direction} L=${r.barLength}×${r.qtyEach}`),
);

const markKeyOf = (bar: (typeof bars)[number]) => {
  const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
  const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
  const hits = zones.filter((z) => {
    if (z.direction !== bar.dir) return false;
    const zx0 = Math.min(z.x1, z.x2);
    const zx1 = Math.max(z.x1, z.x2);
    const zy0 = Math.min(z.y1, z.y2);
    const zy1 = Math.max(z.y1, z.y2);
    return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
  });
  const z = hits.find((h) => h.layer === "bottom") ?? hits[0];
  const hooks = hooksForRebarBar(p, bar, zones);
  if (!z) return "";
  return `${z.mark}|${z.dia}|${z.spacing}|${z.direction}|H${hooks.left}/${hooks.right}`;
};

const distX = buildMergedDistRanges(
  p, axesX, axesY, xBars, markKeyOf, undefined, zones,
  { extentMode: "max", placeAt: "longest" },
);
const distY = buildMergedDistRanges(
  p, axesX, axesY, yBars, markKeyOf, undefined, zones,
  { extentMode: "max", placeAt: "longest" },
);

const maxBay = baySlabExtentMaxEnvelope(p, axesX, axesY, 0, 0);
const lf = beamSegSideFaces(left, 0);

const W = 1000;
const H = 720;
const pad = 48;
const allX = [
  ...xBars.flatMap((b) => [b.x0, b.x1]),
  ...yBars.map((b) => b.x),
  lf.lo0, lf.hi0, lf.lo1, lf.hi1,
];
const allY = [
  ...xBars.map((b) => b.y),
  ...yBars.flatMap((b) => [b.y0, b.y1]),
];
const xMin = Math.min(...allX) - 150;
const xMax = Math.max(...allX) + 150;
const yMin = Math.min(...allY) - 150;
const yMax = Math.max(...allY) + 150;
const s = Math.min((W - 2 * pad) / (xMax - xMin), (H - 2 * pad - 80) / (yMax - yMin));
const X = (mm: number) => pad + (mm - xMin) * s;
const Y = (mm: number) => H - pad - 50 - (mm - yMin) * s;

const maxXL = Math.max(...xL);
const maxYL = Math.max(...yL);
const xLines = xBars
  .map((b) => {
    const long = rebarBarStraightLenMm(b) >= maxXL - 1;
    return `<line x1="${X(b.x0).toFixed(1)}" y1="${Y(b.y).toFixed(1)}" x2="${X(b.x1).toFixed(1)}" y2="${Y(b.y).toFixed(1)}" stroke="${long ? "#f87171" : "#ef4444"}" stroke-width="${long ? 2 : 1.2}" opacity="0.9"/>`;
  })
  .join("\n");
const yLines = yBars
  .map((b) => {
    const long = rebarBarStraightLenMm(b) >= maxYL - 1;
    return `<line x1="${X(b.x).toFixed(1)}" y1="${Y(b.y0).toFixed(1)}" x2="${X(b.x).toFixed(1)}" y2="${Y(b.y1).toFixed(1)}" stroke="${long ? "#38bdf8" : "#0ea5e9"}" stroke-width="${long ? 2 : 1.2}" opacity="0.85"/>`;
  })
  .join("\n");

const distSvg = [...distX, ...distY]
  .map((d, i) => {
    const xA = X(d.xA);
    const yA = Y(d.yA);
    const xB = X(d.xB);
    const yB = Y(d.yB);
    const midX = (xA + xB) / 2;
    const midY = (yA + yB) / 2;
    const alongY = Math.abs(d.yB - d.yA) >= Math.abs(d.xB - d.xA);
    return `<line x1="${xA}" y1="${yA}" x2="${xB}" y2="${yB}" stroke="#2563eb" stroke-width="2.2"/>
      <text x="${midX + (alongY ? 8 : 0)}" y="${midY + (alongY ? 0 : -8)}" fill="#60a5fa" font-family="DejaVu Sans,sans-serif" font-size="13" font-weight="700">${Math.round(d.lenMm)}</text>`;
  })
  .join("\n");

const schedRows = bottom
  .map(
    (r) =>
      `<tr><td style="padding:2px 8px;color:#f8fafc">${r.mark}</td><td style="padding:2px 8px;color:#94a3b8">${planDisplayMark(r)}</td><td style="padding:2px 8px;color:#e2e8f0">${r.direction}</td><td style="padding:2px 8px;color:#e2e8f0">${r.barLength}</td><td style="padding:2px 8px;color:#e2e8f0">${r.qtyEach}</td></tr>`,
  )
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#0b1220"/>
  <text x="${pad}" y="26" fill="#e2e8f0" font-family="DejaVu Sans,sans-serif" font-size="16" font-weight="700">Ô hình thang — thép biến thiên cả phương X và Y</text>
  <text x="${pad}" y="46" fill="#94a3b8" font-family="DejaVu Sans,sans-serif" font-size="12">Đỏ = phương X · Cyan = phương Y · Xanh dương = khoảng rải tại điểm dài nhất</text>

  <polygon points="${X(lf.lo0).toFixed(1)},${Y(0).toFixed(1)} ${X(lf.hi0).toFixed(1)},${Y(0).toFixed(1)} ${X(lf.hi1).toFixed(1)},${Y(4500).toFixed(1)} ${X(lf.lo1).toFixed(1)},${Y(4500).toFixed(1)}" fill="#86efac" opacity="0.16"/>
  <rect x="${X(maxBay.x0).toFixed(1)}" y="${Y(maxBay.y1).toFixed(1)}" width="${(X(maxBay.x1) - X(maxBay.x0)).toFixed(1)}" height="${(Y(maxBay.y0) - Y(maxBay.y1)).toFixed(1)}" fill="none" stroke="#64748b" stroke-width="0.8" stroke-dasharray="4 3"/>

  ${yLines}
  ${xLines}
  ${distSvg}

  <foreignObject x="${pad}" y="${H - 95}" width="520" height="90">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#94a3b8;font:11px DejaVu Sans,sans-serif">
      <div style="margin-bottom:4px">X: L ${Math.round(Math.min(...xL))}→${Math.round(Math.max(...xL))} · Y: L ${Math.round(Math.min(...yL))}→${Math.round(Math.max(...yL))} · distX=${distX.length} distY=${distY.length}</div>
      <table style="border-collapse:collapse"><tr style="color:#64748b"><th align="left">PDF</th><th align="left">MB</th><th align="left">P</th><th align="left">L</th><th align="left">SL</th></tr>${schedRows}</table>
    </div>
  </foreignObject>
</svg>`;

mkdirSync("/workspace/artifacts", { recursive: true });
mkdirSync("/opt/cursor/artifacts", { recursive: true });
const svgPath = "/workspace/artifacts/demo-xy-vary-polygon.svg";
writeFileSync(svgPath, svg);
console.log("wrote", svgPath);
