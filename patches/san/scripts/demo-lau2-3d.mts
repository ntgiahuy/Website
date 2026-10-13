/**
 * Demo: mô hình 3D DẦM SÀN LẦU 2 — khớp bản vẽ NPD S.00.06.
 * 2×5 cột, 4 nhịp; góc trước sàn thấp; nhịp 2 hai khay lõm; nhịp 3 thang U.
 */
import { writeFileSync, mkdirSync } from "fs";
import { createSampleS1 } from "../sample.ts";
import {
  applyAxesToProject,
  baySlabExtent,
  beamsFromAxes,
  sortAxes,
} from "../grid.ts";
import { buildBeamFrameScene, projectSceneToSvg } from "../view3d.ts";
import { uid } from "../utils.ts";
import type { GridAxis, PlanBeam, SlabProject } from "../types.ts";

function axis(name: string, pos: number): GridAxis {
  return { id: uid("ax"), name, pos };
}

function buildLau2(): SlabProject {
  // 4 nhịp × 3300 = 13200; ngang 4500 — đúng 2×5 cột như bản vẽ Lầu 2.
  const axesX = [
    axis("1", 0),
    axis("2", 3300),
    axis("3", 6600),
    axis("4", 9900),
    axis("5", 13200),
  ];
  const axesY = [axis("A", 0), axis("B", 4500)];

  let p: SlabProject = {
    ...createSampleS1(),
    planWidth: 13200,
    planHeight: 4500,
    axesX,
    axesY,
    beams: [],
    openings: [],
    lowSlabs: [],
    zones: [],
    show3d: true,
    info: {
      ...createSampleS1().info,
      name: "Lầu 2",
      thickness: 100,
      beamB: 220,
      beamH: 500,
      beamB1: 0,
      beamSizeX: "220x500",
      beamSizeY: "220x500",
      beamCountX: axesX.length,
      beamCountY: axesY.length,
      lowSlabDrop: 200,
      floorElevationM: 8.05,
      drawingScale: 100,
    },
  };
  p = { ...p, beams: beamsFromAxes(p) };
  p = applyAxesToProject(p);

  const ax = sortAxes(p.axesX ?? []);
  const ay = sortAxes(p.axesY ?? []);
  const bw = 220;
  p = {
    ...p,
    beams: (p.beams ?? []).map((b: PlanBeam) => {
      if (b.free) return b;
      if (b.direction === "Y") {
        const idx = ax.findIndex((a) => a.id === b.axisId || Math.abs(a.pos - b.axis) < 1);
        const offset = idx === 0 ? 0 : idx === ax.length - 1 ? bw : Math.round(bw / 2);
        return { ...b, offset, size: "220x500" };
      }
      const idx = ay.findIndex((a) => a.id === b.axisId || Math.abs(a.pos - b.axis) < 1);
      const offset = idx === 0 ? 0 : idx === ay.length - 1 ? bw : Math.round(bw / 2);
      return { ...b, offset, size: "220x500" };
    }),
  };

  const bay = (ix: number) => baySlabExtent(p, ax, ay, ix, 0);
  const b0 = bay(0);
  const b1 = bay(1);
  const b2 = bay(2);

  // Góc trước-trái (phía A): khay lõm nhỏ trong nhịp 1.
  const cornerW = (b0.x1 - b0.x0) * 0.38;
  const cornerH = (b0.y1 - b0.y0) * 0.36;
  // Nhịp 2: hai khay lõm cạnh nhau (suốt chiều ngang ô), tách khe mỏng.
  const gap = 80;
  const split = b1.x0 + (b1.x1 - b1.x0) * 0.55;

  p = {
    ...p,
    openings: [
      {
        id: uid("op"),
        name: "Thang",
        x: b2.x0,
        y: b2.y0,
        w: b2.x1 - b2.x0,
        h: b2.y1 - b2.y0,
      },
    ],
    lowSlabs: [
      {
        id: uid("ls"),
        name: "Góc lõm",
        x: b0.x0,
        y: b0.y0,
        w: cornerW,
        h: cornerH,
        drop: 150,
      },
      {
        id: uid("ls"),
        name: "WC",
        x: b1.x0,
        y: b1.y0,
        w: split - b1.x0 - gap / 2,
        h: b1.y1 - b1.y0,
        drop: 200,
      },
      {
        id: uid("ls"),
        name: "Lõm",
        x: split + gap / 2,
        y: b1.y0,
        w: b1.x1 - split - gap / 2,
        h: b1.y1 - b1.y0,
        drop: 150,
      },
    ],
  };
  return p;
}

const project = buildLau2();
const scene = buildBeamFrameScene(project);
// Bản vẽ NPD không có mũi cao độ trên phối cảnh 3D.
scene.marks = [];
const view = projectSceneToSvg(scene, { width: 1100, height: 640, pad: 36 });

const hatchPolys = view.polygons
  .filter((p) => p.kind === "hatch")
  .map((p) => `<polygon points="${p.points}" fill="url(#lowHatch3d)" stroke="none" />`)
  .join("\n");
const solidPolys = view.polygons
  .filter((p) => p.kind === "solid")
  .map((p) => `<polygon points="${p.points}" fill="#ffffff" stroke="none" />`)
  .join("\n");
const edgeLines = view.edges
  .map((e) => {
    const sw = e.style === "solid" ? 1.45 : 0.55;
    const col = e.style === "solid" ? "#0a0a0a" : "#9ca3af";
    const dash = e.style === "dashed" ? ' stroke-dasharray="3.5 2.2"' : "";
    return `<line x1="${e.x1.toFixed(2)}" y1="${e.y1.toFixed(2)}" x2="${e.x2.toFixed(2)}" y2="${e.y2.toFixed(2)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"${dash} />`;
  })
  .join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <defs>
    <pattern id="lowHatch3d" patternUnits="userSpaceOnUse" width="5" height="5">
      <circle cx="1" cy="1" r="0.55" fill="#6b7280"/>
      <circle cx="3.5" cy="3.2" r="0.45" fill="#9ca3af"/>
    </pattern>
  </defs>
  ${solidPolys}
  ${hatchPolys}
  ${edgeLines}
  <text x="${view.width / 2}" y="${view.height - 22}" text-anchor="middle" fill="#111" font-size="16" font-weight="700" font-family="sans-serif" text-decoration="underline">${view.title}</text>
  <text x="${view.width / 2}" y="${view.height - 6}" text-anchor="middle" fill="#374151" font-size="11" font-family="sans-serif">${view.subtitle}</text>
</svg>`;

mkdirSync("/workspace/artifacts", { recursive: true });
mkdirSync("/opt/cursor/artifacts", { recursive: true });
const svgPath = "/workspace/artifacts/demo-lau2-3d.svg";
writeFileSync(svgPath, svg);
writeFileSync("/opt/cursor/artifacts/demo-lau2-3d.svg", svg);

import { Resvg } from "/tmp/san-export/node_modules/@resvg/resvg-js/index.js";
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1400 } });
const png = resvg.render().asPng();
writeFileSync("/workspace/artifacts/demo-lau2-3d.png", png);
writeFileSync("/opt/cursor/artifacts/demo-lau2-3d.png", png);

console.log("wrote", svgPath, "png", png.length);
console.log({
  title: scene.title,
  edges: scene.edges.length,
  faces: scene.faces.length,
  hatch: scene.faces.filter((f) => f.kind === "hatch").length,
  openings: project.openings?.length,
  lowSlabs: project.lowSlabs?.length,
  beams: project.beams?.length,
  axesX: project.axesX?.length,
  axesY: project.axesY?.length,
});
