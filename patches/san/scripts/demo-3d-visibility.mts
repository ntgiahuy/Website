/**
 * Demo: nét liền đậm (nhìn thấy) vs nét gạch nhạt (che khuất) trên phối cảnh 3D.
 */
import { writeFileSync, mkdirSync } from "fs";
import { createSampleS1 } from "../sample.ts";
import { applyAxesToProject, baySlabExtent, beamsFromAxes, sortAxes } from "../grid.ts";
import { buildBeamFrameScene, projectSceneToSvg } from "../view3d.ts";
import { uid } from "../utils.ts";
import type { GridAxis, PlanBeam, SlabProject } from "../types.ts";
import { Resvg } from "/tmp/node_modules/@resvg/resvg-js/index.js";

function axis(name: string, pos: number): GridAxis {
  return { id: uid("ax"), name, pos };
}

function buildProject(): SlabProject {
  const axesX = [axis("1", 0), axis("2", 3300), axis("3", 6600), axis("4", 9900), axis("5", 13200)];
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
    info: { ...createSampleS1().info, name: "Lầu 2", beamCountX: 5, beamCountY: 2 },
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
        return { ...b, offset: idx === 0 ? 0 : idx === ax.length - 1 ? bw : Math.round(bw / 2), size: "220x500" };
      }
      const idx = ay.findIndex((a) => a.id === b.axisId || Math.abs(a.pos - b.axis) < 1);
      return { ...b, offset: idx === 0 ? 0 : idx === ay.length - 1 ? bw : Math.round(bw / 2), size: "220x500" };
    }),
  };
  const bay = (ix: number) => baySlabExtent(p, ax, ay, ix, 0);
  const b0 = bay(0);
  const b2 = bay(2);
  p = {
    ...p,
    openings: [{ id: uid("op"), name: "Thang", x: b2.x0, y: b2.y0, w: b2.x1 - b2.x0, h: b2.y1 - b2.y0 }],
    lowSlabs: [{
      id: uid("ls"), name: "Lõm",
      x: b0.x0, y: b0.y0, w: (b0.x1 - b0.x0) * 0.4, h: (b0.y1 - b0.y0) * 0.35, drop: 150,
    }],
  };
  return p;
}

const project = buildProject();
const scene = buildBeamFrameScene(project);
scene.marks = [];
const solidN = scene.edges.filter((e) => e.style === "solid").length;
const dashedN = scene.edges.filter((e) => e.style === "dashed").length;
console.log({ solid: solidN, dashed: dashedN, total: scene.edges.length });

const view = projectSceneToSvg(scene, { width: 1100, height: 640, pad: 36 });
const polys = view.polygons.map((p) =>
  `<polygon points="${p.points}" fill="${p.kind === "hatch" ? "url(#h)" : "#ffffff"}" stroke="none"/>`,
).join("\n");
const lines = view.edges.map((e) => {
  const sw = e.style === "solid" ? 1.85 : 0.7;
  const col = e.style === "solid" ? "#111111" : "#a1a1aa";
  const dash = e.style === "dashed" ? ' stroke-dasharray="4.5 2.8"' : "";
  return `<line x1="${e.x1.toFixed(2)}" y1="${e.y1.toFixed(2)}" x2="${e.x2.toFixed(2)}" y2="${e.y2.toFixed(2)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"${dash}/>`;
}).join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <defs><pattern id="h" patternUnits="userSpaceOnUse" width="5" height="5"><circle cx="1" cy="1" r="0.55" fill="#6b7280"/></pattern></defs>
  ${polys}
  ${lines}
  <text x="${view.width / 2}" y="${view.height - 22}" text-anchor="middle" fill="#111" font-size="15" font-weight="700" text-decoration="underline">${view.title}</text>
  <text x="${view.width / 2}" y="${view.height - 6}" text-anchor="middle" fill="#52525b" font-size="11">Nhìn thấy: nét liền đậm · Che khuất: nét gạch nhạt</text>
</svg>`;

mkdirSync("/workspace/artifacts", { recursive: true });
mkdirSync("/opt/cursor/artifacts", { recursive: true });
writeFileSync("/workspace/artifacts/demo-3d-net-lien-dut.svg", svg);
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1400 } }).render().asPng();
writeFileSync("/workspace/artifacts/demo-3d-net-lien-dut.png", png);
writeFileSync("/opt/cursor/artifacts/demo-3d-net-lien-dut.png", png);
console.log("wrote", png.length);
