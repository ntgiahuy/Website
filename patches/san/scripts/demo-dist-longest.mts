/**
 * Demo: khoảng rải khi dầm lệch — 1 nét thẳng như sàn CN, neo tại điểm dài nhất.
 */
import { writeFileSync, mkdirSync } from "fs";
import { createSampleS1 } from "../sample.ts";
import {
  applyAxesToProject,
  patchBeamSegShift,
  sortAxes,
  stripRebarBarSegments,
  rebarBarStraightLenMm,
  buildMergedDistRanges,
  hooksForRebarBar,
  baySlabExtent,
  baySlabExtentMaxEnvelope,
} from "../grid.ts";
import { effectiveZones } from "../calc.ts";

let p = createSampleS1();
p = {
  ...p,
  layoutPreset: "simple2",
  info: {
    ...p.info,
    name: "Sàn S1 — khoảng rải dầm lệch",
    showDistRange: true,
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

const axesX = sortAxes(p.axesX ?? []);
const axesY = sortAxes(p.axesY ?? []);
const zones = effectiveZones(p);
const bars = stripRebarBarSegments(p, axesX, axesY).filter((b) => b.dir === "X");

const avgBay = baySlabExtent(p, axesX, axesY, 0, 0);
const maxBay = baySlabExtentMaxEnvelope(p, axesX, axesY, 0, 0);
console.log("bay0 avg", avgBay);
console.log("bay0 max", maxBay);

const markKeyOf = (bar: (typeof bars)[number]) => {
  const mx = (bar.x0 + bar.x1) / 2;
  const my = bar.y;
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
  if (z) return `${z.mark}|${z.dia}|${z.spacing}|${z.direction}|H${hooks.left}/${hooks.right}`;
  return `${bar.dir}|10|150|H${hooks.left}/${hooks.right}`;
};

const oldKeyWithL = (bar: (typeof bars)[number]) => {
  const hooks = hooksForRebarBar(p, bar, zones);
  const len = Math.round(rebarBarStraightLenMm(bar) + hooks.left + hooks.right);
  return `L${len}`;
};

const mergedOld = buildMergedDistRanges(p, axesX, axesY, bars, oldKeyWithL, undefined, zones);
const mergedNew = buildMergedDistRanges(
  p,
  axesX,
  axesY,
  bars,
  markKeyOf,
  undefined,
  zones,
  { extentMode: "max", placeAt: "longest" },
);

console.log(
  "old merged count",
  mergedOld.length,
  mergedOld.map((m) => ({ len: Math.round(m.lenMm), x: Math.round(m.xA), y0: Math.round(m.yA), y1: Math.round(m.yB) })),
);
console.log(
  "new merged count",
  mergedNew.length,
  mergedNew.map((m) => ({ len: Math.round(m.lenMm), x: Math.round(m.xA), y0: Math.round(m.yA), y1: Math.round(m.yB) })),
);

const lens = bars.map(rebarBarStraightLenMm);
const maxL = Math.max(...lens);
const longest = bars.filter((b) => rebarBarStraightLenMm(b) >= maxL - 0.5);
const longestMid =
  longest.reduce((s, b) => s + (b.x0 + b.x1) / 2, 0) / Math.max(1, longest.length);
console.log("X bars", bars.length, "L", Math.min(...lens), "→", maxL, "longestMid", Math.round(longestMid));

// —— SVG minh họa ——
const W = 960;
const H = 620;
const pad = 50;
const allX = bars.flatMap((b) => [b.x0, b.x1]);
const allY = bars.map((b) => b.y);
const xMin = Math.min(...allX, maxBay.x0) - 200;
const xMax = Math.max(...allX, maxBay.x1) + 200;
const yMin = Math.min(...allY, maxBay.y0) - 200;
const yMax = Math.max(...allY, maxBay.y1) + 200;
const s = Math.min((W - 2 * pad) / (xMax - xMin), (H - 2 * pad - 40) / (yMax - yMin));
const X = (mm: number) => pad + (mm - xMin) * s;
const Y = (mm: number) => H - pad - (mm - yMin) * s;

// Skew left beam faces
const leftBeam = left;
const seg = { s0: -300, s1: 500 };
const bw = 220;
const lo0 = 0 - 0 + seg.s0;
const hi0 = lo0 + bw;
const lo1 = 0 - 0 + seg.s1;
const hi1 = lo1 + bw;
const yBot = 0;
const yTop = 4500;

const barLines = bars
  .map((b) => {
    const isLong = rebarBarStraightLenMm(b) >= maxL - 0.5;
    return `<line x1="${X(b.x0).toFixed(1)}" y1="${Y(b.y).toFixed(1)}" x2="${X(b.x1).toFixed(1)}" y2="${Y(b.y).toFixed(1)}" stroke="${isLong ? "#f87171" : "#ef4444"}" stroke-width="${isLong ? 2.2 : 1.4}" opacity="0.95"/>`;
  })
  .join("\n");

const dist = mergedNew[0];
const distSvg = dist
  ? (() => {
      const xA = X(dist.xA);
      const yA = Y(dist.yA);
      const xB = X(dist.xB);
      const yB = Y(dist.yB);
      const midX = (xA + xB) / 2;
      const midY = (yA + yB) / 2;
      const cap = 8;
      const junctions = dist.junctions
        .map(
          (j) =>
            `<circle cx="${X(j.x).toFixed(1)}" cy="${Y(j.y).toFixed(1)}" r="2.2" fill="none" stroke="#fff" stroke-width="0.8"/><polygon points="${X(j.x)},${Y(j.y) - 2} ${X(j.x) + 2},${Y(j.y)} ${X(j.x)},${Y(j.y) + 2} ${X(j.x) - 2},${Y(j.y)}" fill="#fff"/>`,
        )
        .join("");
      return `
      <line x1="${xA}" y1="${yA}" x2="${xB}" y2="${yB}" stroke="#2563eb" stroke-width="2"/>
      <rect x="${xA - cap}" y="${yA - 2}" width="${cap * 2}" height="4" fill="#2563eb"/>
      <rect x="${xB - cap}" y="${yB - 2}" width="${cap * 2}" height="4" fill="#2563eb"/>
      ${junctions}
      <text x="${midX + 10}" y="${midY}" fill="#60a5fa" font-family="DejaVu Sans,sans-serif" font-size="14" font-weight="700">${Math.round(dist.lenMm)}</text>
      <line x1="${xA}" y1="${midY}" x2="${(xA + 36).toFixed(1)}" y2="${midY}" stroke="#2563eb" stroke-width="1.5" marker-end="url(#arrow)"/>
      `;
    })()
  : "";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#2563eb"/>
    </marker>
    <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" stroke-width="1" opacity="0.35"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="#0b1220"/>
  <text x="${pad}" y="28" fill="#e2e8f0" font-family="DejaVu Sans,sans-serif" font-size="16" font-weight="700">Khoảng rải khi dầm lệch — thẳng như sàn chữ nhật, tại điểm dài nhất</text>
  <text x="${pad}" y="48" fill="#94a3b8" font-family="DejaVu Sans,sans-serif" font-size="12">Dầm biên trái Dịch đầu/cuối · 1 đường xanh (không tách theo L) · neo giữa thanh dài nhất</text>

  <!-- skew zone -->
  <polygon points="${X(lo0).toFixed(1)},${Y(yBot).toFixed(1)} ${X(hi0).toFixed(1)},${Y(yBot).toFixed(1)} ${X(hi1).toFixed(1)},${Y(yTop).toFixed(1)} ${X(lo1).toFixed(1)},${Y(yTop).toFixed(1)}" fill="#86efac" opacity="0.18"/>
  <!-- max envelope hatch -->
  <rect x="${X(maxBay.x0).toFixed(1)}" y="${Y(maxBay.y1).toFixed(1)}" width="${(X(maxBay.x1) - X(maxBay.x0)).toFixed(1)}" height="${(Y(maxBay.y0) - Y(maxBay.y1)).toFixed(1)}" fill="url(#hatch)" stroke="#64748b" stroke-width="0.8" opacity="0.9"/>

  ${barLines}
  ${distSvg}

  <text x="${pad}" y="${H - 18}" fill="#94a3b8" font-family="DejaVu Sans,sans-serif" font-size="11">
    Trước: ${mergedOld.length} đường (tách theo L) → Sau: ${mergedNew.length} đường · Lmax=${Math.round(maxL)} · x≈${Math.round(dist?.xA ?? 0)} (điểm dài nhất)
  </text>
</svg>`;

mkdirSync("/workspace/artifacts", { recursive: true });
const svgPath = "/workspace/artifacts/demo-khoang-rai-dam-lech.svg";
writeFileSync(svgPath, svg);
console.log("svg", svgPath);
