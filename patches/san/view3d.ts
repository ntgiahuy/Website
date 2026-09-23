/**
 * Phối cảnh dầm sàn — nét liền (cạnh nhìn thấy) / nét đứt mảnh (che khuất) /
 * xoá đoạn line xuyên qua thân dầm/cột khác.
 */
import {
  bayKindAt,
  baySlabExtent,
  beamSegSideFaces,
  beamSegments,
  isBeamSegOmitted,
  sortAxes,
} from "./grid";
import type { PlanBeam, SlabProject } from "./types";

export type Pt3 = { x: number; y: number; z: number };
export type Pt2 = { x: number; y: number };

export type Face3 = {
  pts: Pt3[];
  kind: "solid" | "hatch";
};

export type DrawEdge = {
  a: Pt3;
  b: Pt3;
  style: "solid" | "dashed";
};

export type LevelMark3 = {
  at: Pt3;
  elevText: string;
  hsText: string;
};

export type Scene3D = {
  faces: Face3[];
  edges: DrawEdge[];
  openingXs: Array<[Pt3, Pt3]>;
  marks: LevelMark3[];
  title: string;
  subtitle: string;
};

type Solid = {
  id: string;
  corners: Pt3[];
  faces: Face3[];
  edgeDefs: Array<{ a: Pt3; b: Pt3; f0: number; f1: number }>;
  min: Pt3;
  max: Pt3;
};

const EPS = 2;

function parseBH(size?: string): { b: number; h: number } {
  const m = (size ?? "").trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)/);
  return m ? { b: Number(m[1]), h: Number(m[2]) } : { b: 220, h: 500 };
}

export function projectIso(p: Pt3): Pt2 & { depth: number } {
  const cos = Math.sqrt(3) / 2;
  const sin = 0.5;
  return {
    x: (p.x - p.y) * cos,
    y: -p.z + (p.x + p.y) * sin,
    depth: p.x + p.y + p.z * 0.4,
  };
}

function faceDepth(face: Face3): number {
  let s = 0;
  for (const p of face.pts) s += projectIso(p).depth;
  return s / Math.max(face.pts.length, 1);
}

function faceNormal(face: Face3): Pt3 {
  const a = face.pts[0];
  const b = face.pts[1];
  const c = face.pts[2];
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  return {
    x: uy * vz - uz * vy,
    y: uz * vx - ux * vz,
    z: ux * vy - uy * vx,
  };
}

function outwardNormal(face: Face3, center: Pt3): Pt3 {
  const n = faceNormal(face);
  const o = face.pts[0];
  const into = (center.x - o.x) * n.x + (center.y - o.y) * n.y + (center.z - o.z) * n.z;
  if (into > 0) return { x: -n.x, y: -n.y, z: -n.z };
  return n;
}

function faceFrontFacing(face: Face3, center: Pt3): boolean {
  const n = outwardNormal(face, center);
  return n.x + n.y + n.z > 0;
}

function lerp(a: Pt3, b: Pt3, t: number): Pt3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function dist2(a: Pt3, b: Pt3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function solidCenter(s: Pick<Solid, "min" | "max">): Pt3 {
  return {
    x: (s.min.x + s.max.x) / 2,
    y: (s.min.y + s.max.y) / 2,
    z: (s.min.z + s.max.z) / 2,
  };
}

function makeSolid(id: string, bot: [Pt3, Pt3, Pt3, Pt3], top: [Pt3, Pt3, Pt3, Pt3]): Solid {
  const corners = [...bot, ...top];
  const faces: Face3[] = [
    { pts: [top[0], top[1], top[2], top[3]], kind: "solid" },
    { pts: [bot[0], bot[3], bot[2], bot[1]], kind: "solid" },
    { pts: [bot[0], bot[1], top[1], top[0]], kind: "solid" },
    { pts: [bot[1], bot[2], top[2], top[1]], kind: "solid" },
    { pts: [bot[2], bot[3], top[3], top[2]], kind: "solid" },
    { pts: [bot[3], bot[0], top[0], top[3]], kind: "solid" },
  ];
  const edgeDefs: Solid["edgeDefs"] = [
    { a: bot[0], b: bot[1], f0: 1, f1: 2 },
    { a: bot[1], b: bot[2], f0: 1, f1: 3 },
    { a: bot[2], b: bot[3], f0: 1, f1: 4 },
    { a: bot[3], b: bot[0], f0: 1, f1: 5 },
    { a: top[0], b: top[1], f0: 0, f1: 2 },
    { a: top[1], b: top[2], f0: 0, f1: 3 },
    { a: top[2], b: top[3], f0: 0, f1: 4 },
    { a: top[3], b: top[0], f0: 0, f1: 5 },
    { a: bot[0], b: top[0], f0: 2, f1: 5 },
    { a: bot[1], b: top[1], f0: 2, f1: 3 },
    { a: bot[2], b: top[2], f0: 3, f1: 4 },
    { a: bot[3], b: top[3], f0: 4, f1: 5 },
  ];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); maxZ = Math.max(maxZ, p.z);
  }
  return {
    id, corners, faces, edgeDefs,
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function rectSolid(id: string, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): Solid {
  const loX = Math.min(x0, x1), hiX = Math.max(x0, x1);
  const loY = Math.min(y0, y1), hiY = Math.max(y0, y1);
  const loZ = Math.min(z0, z1), hiZ = Math.max(z0, z1);
  return makeSolid(
    id,
    [
      { x: loX, y: loY, z: loZ }, { x: hiX, y: loY, z: loZ },
      { x: hiX, y: hiY, z: loZ }, { x: loX, y: hiY, z: loZ },
    ],
    [
      { x: loX, y: loY, z: hiZ }, { x: hiX, y: loY, z: hiZ },
      { x: hiX, y: hiY, z: hiZ }, { x: loX, y: hiY, z: hiZ },
    ],
  );
}

function inAabbOpen(p: Pt3, s: Solid, eps = EPS): boolean {
  return (
    p.x > s.min.x + eps && p.x < s.max.x - eps &&
    p.y > s.min.y + eps && p.y < s.max.y - eps &&
    p.z > s.min.z + eps && p.z < s.max.z - eps
  );
}

function inSolidOpen(p: Pt3, s: Solid, eps = EPS): boolean {
  if (!inAabbOpen(p, s, eps * 0.35)) return false;
  const c = solidCenter(s);
  for (const face of s.faces) {
    const n = outwardNormal(face, c);
    const len = Math.hypot(n.x, n.y, n.z) || 1;
    const o = face.pts[0];
    const d = ((p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z) / len;
    if (d > -eps) return false;
  }
  return true;
}

function clipEdgeOutsideSolids(a: Pt3, b: Pt3, solids: Solid[], selfId: string): Array<[Pt3, Pt3]> {
  const samples = 32;
  const inside: boolean[] = [];
  for (let i = 0; i <= samples; i++) {
    const p = lerp(a, b, i / samples);
    let inn = false;
    for (const s of solids) {
      if (s.id === selfId) continue;
      if (inSolidOpen(p, s, 1.2)) { inn = true; break; }
    }
    inside.push(inn);
  }
  const out: Array<[Pt3, Pt3]> = [];
  let runStart: number | null = null;
  for (let i = 0; i <= samples; i++) {
    const ok = !inside[i];
    if (ok && runStart === null) runStart = i;
    if ((!ok || i === samples) && runStart !== null) {
      const end = ok && i === samples ? i : i - 1;
      if (end > runStart) {
        const p0 = lerp(a, b, runStart / samples);
        const p1 = lerp(a, b, end / samples);
        if (dist2(p0, p1) > 9) out.push([p0, p1]);
      }
      runStart = null;
    }
  }
  return out;
}

function pointInPoly2(p: Pt2, poly: Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointOccluded(p: Pt3, faces: Face3[]): boolean {
  const proj = projectIso(p);
  for (const face of faces) {
    if (face.kind !== "solid") continue;
    const fd = faceDepth(face);
    if (fd < proj.depth + 12) continue;
    const poly = face.pts.map((q) => {
      const r = projectIso(q);
      return { x: r.x, y: r.y };
    });
    if (pointInPoly2({ x: proj.x, y: proj.y }, poly)) return true;
  }
  return false;
}

function classifyEdge(
  a: Pt3, b: Pt3, face0: Face3, face1: Face3, center: Pt3, occluders: Face3[],
): "solid" | "dashed" {
  const f0 = faceFrontFacing(face0, center);
  const f1 = faceFrontFacing(face1, center);
  if (f0 || f1) {
    const mid = lerp(a, b, 0.5);
    if (isPointOccluded(mid, occluders)) return "dashed";
    return "solid";
  }
  return "dashed";
}

function nearlySameEdge(a: Pt3, b: Pt3, c: Pt3, d: Pt3): boolean {
  const tol = 36;
  return (dist2(a, c) < tol && dist2(b, d) < tol) || (dist2(a, d) < tol && dist2(b, c) < tol);
}

export function floorElevationM(project: SlabProject): number {
  const v = Number(project.info.floorElevationM);
  return Number.isFinite(v) ? v : 8.05;
}

export function buildBeamFrameScene(project: SlabProject): Scene3D {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const solids: Solid[] = [];
  const hatchFaces: Face3[] = [];
  const openingXs: Array<[Pt3, Pt3]> = [];
  const marks: LevelMark3[] = [];

  const zTop = 0;
  /** Cột stub: +50cm trên mặt sàn, −1m dưới mặt sàn (mm mặt bằng 3D). */
  const COL_ABOVE_SLAB_MM = 500;
  const COL_BELOW_SLAB_MM = 1000;
  const zColTop = zTop + COL_ABOVE_SLAB_MM;
  const zColBot = zTop - COL_BELOW_SLAB_MM;

  let ci = 0;
  for (const ax of axesX) {
    for (const ay of axesY) {
      const beamsAt = (project.beams ?? []).filter(
        (b) =>
          !b.free &&
          ((b.direction === "Y" && Math.abs(b.axis - ax.pos) < 0.5) ||
            (b.direction === "X" && Math.abs(b.axis - ay.pos) < 0.5)),
      );
      if (beamsAt.length === 0) continue;
      let half = 150;
      for (const b of beamsAt) half = Math.max(half, parseBH(b.size).b / 2);
      half = Math.round(half);
      const x0 = ax.pos - half;
      const x1 = ax.pos + half;
      const y0 = ay.pos - half;
      const y1 = ay.pos + half;
      // Tách stub trên/dưới — tránh 1 cạnh đứng xuyên suốt thành “đường cột” lạ.
      if (COL_ABOVE_SLAB_MM > 1) {
        solids.push(rectSolid(`col-above-${ci}`, x0, y0, x1, y1, zTop, zColTop));
      }
      if (COL_BELOW_SLAB_MM > 1) {
        solids.push(rectSolid(`col-below-${ci}`, x0, y0, x1, y1, zColBot, zTop));
      }
      ci += 1;
    }
  }

  let bi = 0;
  for (const beam of project.beams ?? []) {
    const { h } = parseBH(beam.size);
    const z0 = zTop - h;
    const z1 = zTop;
    for (const seg of beamSegments(project, beam)) {
      if (isBeamSegOmitted(beam, seg.a0.id, seg.a1.id)) continue;
      const { lo0, hi0, lo1, hi1 } = beamSegSideFaces(beam, seg.index);
      const lo = seg.lo, hi = seg.hi;
      if (beam.direction === "Y") {
        solids.push(makeSolid(`beam-${bi++}`,
          [{ x: lo0, y: lo, z: z0 }, { x: hi0, y: lo, z: z0 }, { x: hi1, y: hi, z: z0 }, { x: lo1, y: hi, z: z0 }],
          [{ x: lo0, y: lo, z: z1 }, { x: hi0, y: lo, z: z1 }, { x: hi1, y: hi, z: z1 }, { x: lo1, y: hi, z: z1 }],
        ));
      } else {
        solids.push(makeSolid(`beam-${bi++}`,
          [{ x: lo, y: lo0, z: z0 }, { x: hi, y: lo0, z: z0 }, { x: hi, y: hi1, z: z0 }, { x: lo, y: hi1, z: z0 }],
          [{ x: lo, y: lo0, z: z1 }, { x: hi, y: lo0, z: z1 }, { x: hi, y: hi1, z: z1 }, { x: lo, y: hi1, z: z1 }],
        ));
      }
    }
  }

  const occluderFaces: Face3[] = [];
  const drawFaces: Face3[] = [];
  for (const s of solids) {
    const c = solidCenter(s);
    for (const f of s.faces) {
      occluderFaces.push(f);
      if (faceFrontFacing(f, c)) drawFaces.push(f);
    }
  }
  drawFaces.sort((a, b) => faceDepth(a) - faceDepth(b));

  const rawEdges: DrawEdge[] = [];
  const colSolids = solids.filter((s) => s.id.startsWith("col-"));
  const inColFootprint = (p: Pt3) =>
    colSolids.some(
      (s) =>
        p.x > s.min.x + EPS &&
        p.x < s.max.x - EPS &&
        p.y > s.min.y + EPS &&
        p.y < s.max.y - EPS,
    );
  const isVerticalEdge = (a: Pt3, b: Pt3) =>
    Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS && Math.abs(a.z - b.z) > EPS;

  for (const s of solids) {
    const isBeam = s.id.startsWith("beam-");
    const isColBelow = s.id.startsWith("col-below-");
    const isColAbove = s.id.startsWith("col-above-");
    for (const ed of s.edgeDefs) {
      // Bỏ cạnh đứng thân dầm trùng chân cột — tránh nét đứt chồng lên cột trên (nét liền).
      if (isBeam && isVerticalEdge(ed.a, ed.b) && inColFootprint(lerp(ed.a, ed.b, 0.5))) {
        continue;
      }
      // Phối cảnh sàn: dầm dưới sàn → đứt; cột trên → liền; cột dưới → đứt.
      let style0: "solid" | "dashed";
      if (isBeam || isColBelow) style0 = "dashed";
      else if (isColAbove) style0 = "solid";
      else {
        const c = solidCenter(s);
        style0 = classifyEdge(ed.a, ed.b, s.faces[ed.f0], s.faces[ed.f1], c, occluderFaces);
      }
      const parts = clipEdgeOutsideSolids(ed.a, ed.b, solids, s.id);
      for (const [p0, p1] of parts) {
        let style: "solid" | "dashed" = style0;
        if (style === "solid" && !isColAbove && isPointOccluded(lerp(p0, p1, 0.5), occluderFaces)) {
          style = "dashed";
        }
        rawEdges.push({ a: p0, b: p1, style });
      }
    }
  }

  const edges: DrawEdge[] = [];
  for (const e of rawEdges) {
    const hit = edges.findIndex((o) => nearlySameEdge(e.a, e.b, o.a, o.b));
    if (hit < 0) edges.push(e);
    else if (e.style === "solid") edges[hit].style = "solid";
  }

  // Mặt sàn các ô thường + hatch sàn thấp; ô thủng vẽ khung + chéo đẹp.
  // Cạnh mặt sàn (nằm trên dầm) — nét liền để đọc mặt bằng sàn.
  const deckFaces: Face3[] = [];
  if (axesX.length >= 2 && axesY.length >= 2) {
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      for (let iy = 0; iy < axesY.length - 1; iy++) {
        const bay = baySlabExtent(project, axesX, axesY, ix, iy);
        const kind = bayKindAt(project, axesX, axesY, ix, iy);
        if (kind === "opening") {
          const z = zTop + 6;
          const inset = Math.min(80, Math.max(25, Math.min(bay.x1 - bay.x0, bay.y1 - bay.y0) * 0.06));
          const x0 = bay.x0 + inset;
          const x1 = bay.x1 - inset;
          const y0 = bay.y0 + inset;
          const y1 = bay.y1 - inset;
          if (x1 - x0 > 40 && y1 - y0 > 40) {
            edges.push(
              { a: { x: x0, y: y0, z }, b: { x: x1, y: y0, z }, style: "solid" },
              { a: { x: x1, y: y0, z }, b: { x: x1, y: y1, z }, style: "solid" },
              { a: { x: x1, y: y1, z }, b: { x: x0, y: y1, z }, style: "solid" },
              { a: { x: x0, y: y1, z }, b: { x: x0, y: y0, z }, style: "solid" },
              { a: { x: x0, y: y0, z }, b: { x: x1, y: y1, z }, style: "solid" },
              { a: { x: x0, y: y1, z }, b: { x: x1, y: y0, z }, style: "solid" },
            );
            openingXs.push(
              [{ x: x0, y: y0, z }, { x: x1, y: y1, z }],
              [{ x: x0, y: y1, z }, { x: x1, y: y0, z }],
            );
          }
          continue;
        }
        if (kind === "low") continue;
        const z = zTop + 1;
        deckFaces.push({
          pts: [
            { x: bay.x0, y: bay.y0, z },
            { x: bay.x1, y: bay.y0, z },
            { x: bay.x1, y: bay.y1, z },
            { x: bay.x0, y: bay.y1, z },
          ],
          kind: "solid",
        });
        // Viền mặt sàn trên dầm — nét liền (ghi đè cạnh dầm đứt trùng mép)
        const deckEdge = (a: Pt3, b: Pt3) => {
          const ne: DrawEdge = { a, b, style: "solid" };
          const hit = edges.findIndex((o) => nearlySameEdge(a, b, o.a, o.b));
          if (hit < 0) edges.push(ne);
          else edges[hit].style = "solid";
        };
        deckEdge({ x: bay.x0, y: bay.y0, z }, { x: bay.x1, y: bay.y0, z });
        deckEdge({ x: bay.x1, y: bay.y0, z }, { x: bay.x1, y: bay.y1, z });
        deckEdge({ x: bay.x1, y: bay.y1, z }, { x: bay.x0, y: bay.y1, z });
        deckEdge({ x: bay.x0, y: bay.y1, z }, { x: bay.x0, y: bay.y0, z });
      }
    }
  }

  for (const ls of project.lowSlabs ?? []) {
    const drop = Math.max(0, ls.drop || project.info.lowSlabDrop || 0);
    const z = zTop - drop * 0.15;
    hatchFaces.push({
      pts: [
        { x: ls.x, y: ls.y, z }, { x: ls.x + ls.w, y: ls.y, z },
        { x: ls.x + ls.w, y: ls.y + ls.h, z }, { x: ls.x, y: ls.y + ls.h, z },
      ],
      kind: "hatch",
    });
  }

  // Không dùng opening từ project.openings thô nữa (đã vẽ theo ô bay ở trên).
  // Fallback nếu opening không khớp bay:
  for (const o of project.openings ?? []) {
    const already = openingXs.length > 0;
    if (already) break;
    const z = zTop + 6;
    const x0 = o.x;
    const y0 = o.y;
    const x1 = o.x + o.w;
    const y1 = o.y + o.h;
    edges.push(
      { a: { x: x0, y: y0, z }, b: { x: x1, y: y0, z }, style: "solid" },
      { a: { x: x1, y: y0, z }, b: { x: x1, y: y1, z }, style: "solid" },
      { a: { x: x1, y: y1, z }, b: { x: x0, y: y1, z }, style: "solid" },
      { a: { x: x0, y: y1, z }, b: { x: x0, y: y0, z }, style: "solid" },
      { a: { x: x0, y: y0, z }, b: { x: x1, y: y1, z }, style: "solid" },
      { a: { x: x0, y: y1, z }, b: { x: x1, y: y0, z }, style: "solid" },
    );
    openingXs.push(
      [{ x: x0, y: y0, z }, { x: x1, y: y1, z }],
      [{ x: x0, y: y1, z }, { x: x1, y: y0, z }],
    );
  }

  const elev = floorElevationM(project);
  const hs = Math.round(project.info.thickness || 100);
  if (axesX.length >= 2 && axesY.length >= 2) {
    const bay0 = baySlabExtent(project, axesX, axesY, 0, 0);
    marks.push({ at: { x: bay0.mx, y: bay0.my, z: zTop + 20 }, elevText: `+${elev.toFixed(3)}`, hsText: `Hs=${hs}` });
    if (axesX.length > 2 || axesY.length > 2) {
      const ix = Math.min(axesX.length - 2, 1);
      const iy = Math.min(axesY.length - 2, axesY.length > 2 ? 1 : 0);
      const bay1 = baySlabExtent(project, axesX, axesY, ix, iy);
      marks.push({ at: { x: bay1.mx, y: bay1.my, z: zTop + 20 }, elevText: `+${(elev - 0.05).toFixed(3)}`, hsText: `Hs=${hs}` });
    }
  }

  const floorName = (project.info.name || "SÀN").trim() || "SÀN";
  return {
    faces: [...deckFaces, ...drawFaces, ...hatchFaces],
    edges,
    openingXs,
    marks,
    title: `PHỐI CẢNH DẦM ${floorName.toUpperCase()}`,
    subtitle: `TL: 1/${project.info.drawingScale || 100}`,
  };
}

export type ProjectedScene = {
  polygons: Array<{ points: string; kind: Face3["kind"] }>;
  edges: Array<{ x1: number; y1: number; x2: number; y2: number; style: "solid" | "dashed" }>;
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  marks: Array<{ x: number; y: number; elevText: string; hsText: string }>;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  pad: number;
};

export function projectSceneToSvg(
  scene: Scene3D,
  opts?: { width?: number; height?: number; pad?: number },
): ProjectedScene {
  const pad = opts?.pad ?? 48;
  const targetW = opts?.width ?? 920;
  const targetH = opts?.height ?? 560;

  const projectedFaces = scene.faces.map((f) => {
    const pts = f.pts.map(projectIso);
    const depth = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
    return { kind: f.kind, pts, depth };
  });
  projectedFaces.sort((a, b) => a.depth - b.depth);

  const allPts = [
    ...projectedFaces.flatMap((f) => f.pts),
    ...scene.edges.flatMap((e) => [projectIso(e.a), projectIso(e.b)]),
    ...scene.openingXs.flatMap(([a, b]) => [projectIso(a), projectIso(b)]),
    ...scene.marks.map((m) => projectIso(m.at)),
  ];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((targetW - pad * 2) / spanX, (targetH - pad * 2 - 36) / spanY);
  const mapX = (x: number) => pad + (x - minX) * scale;
  const mapY = (y: number) => pad + (maxY - y) * scale;

  const polygons = projectedFaces.map((f) => ({
    kind: f.kind,
    points: f.pts.map((p) => `${mapX(p.x).toFixed(2)},${mapY(p.y).toFixed(2)}`).join(" "),
  }));

  const edgesSorted = [...scene.edges].sort((a, b) =>
    a.style === b.style ? 0 : a.style === "dashed" ? -1 : 1,
  );
  const edges = edgesSorted.map((e) => {
    const pa = projectIso(e.a), pb = projectIso(e.b);
    return { x1: mapX(pa.x), y1: mapY(pa.y), x2: mapX(pb.x), y2: mapY(pb.y), style: e.style };
  });

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  // Ô thủng đã nằm trong scene.edges (nét liền khung + chéo) — không vẽ lại nét đứt.

  const marks = scene.marks.map((m) => {
    const p = projectIso(m.at);
    return { x: mapX(p.x), y: mapY(p.y), elevText: m.elevText, hsText: m.hsText };
  });

  return {
    polygons, edges, lines, marks,
    title: scene.title, subtitle: scene.subtitle,
    width: pad * 2 + spanX * scale,
    height: pad * 2 + spanY * scale + 40,
    pad,
  };
}
