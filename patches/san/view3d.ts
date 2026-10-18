/**
 * Phối cảnh dầm sàn — nét liền (cạnh nhìn thấy) / nét đứt mảnh (che khuất) /
 * xoá đoạn line xuyên qua thân dầm/cột khác.
 */
import {
  bayKindAt,
  baySlabExtent,
  beamOuterFacesAtAlong,
  beamSegSideFaces,
  beamSegments,
  findBeamOnAxis,
  isBeamSegOmitted,
  planBeamBleed,
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

/**
 * Hướng nhìn isometric: depth tăng theo +X/+Y/+Z → camera ở phía (+1,+1,+0.4).
 * Mặt hướng về camera (nhìn thấy) khi pháp tuyến ngoài cùng chiều camera.
 */
function faceFrontFacing(face: Face3, center: Pt3): boolean {
  const n = outwardNormal(face, center);
  return n.x + n.y + 0.4 * n.z > 0;
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

/** Cạnh nhìn thấy (có ≥1 mặt trước + không bị che) → liền; ngược lại → gạch. */
function classifyEdge(
  a: Pt3, b: Pt3, face0: Face3, face1: Face3, center: Pt3, occluders: Face3[],
): "solid" | "dashed" {
  const f0 = faceFrontFacing(face0, center);
  const f1 = faceFrontFacing(face1, center);
  // Hai mặt sau (quay lưng camera) → cạnh khuất
  if (!f0 && !f1) return "dashed";
  // Silhouette / cạnh mặt trước: kiểm tra che khuất dọc cạnh
  let hit = 0;
  const samples = 5;
  for (let i = 1; i < samples; i++) {
    if (isPointOccluded(lerp(a, b, i / samples), occluders)) hit += 1;
  }
  if (hit >= Math.ceil((samples - 1) * 0.6)) return "dashed";
  return "solid";
}

function styleByOcclusion(a: Pt3, b: Pt3, occluders: Face3[]): "solid" | "dashed" {
  let hit = 0;
  const samples = 5;
  for (let i = 1; i < samples; i++) {
    if (isPointOccluded(lerp(a, b, i / samples), occluders)) hit += 1;
  }
  return hit >= Math.ceil((samples - 1) * 0.6) ? "dashed" : "solid";
}

function nearlySameEdge(a: Pt3, b: Pt3, c: Pt3, d: Pt3): boolean {
  const tol = 36;
  return (dist2(a, c) < tol && dist2(b, d) < tol) || (dist2(a, d) < tol && dist2(b, c) < tol);
}

/** Điểm alongMm có nằm trên đoạn dầm đã omit không (giao với trục vuông góc). */
function isBeamSegOmittedAcross(project: SlabProject, beam: PlanBeam, crossPos: number): boolean {
  for (const seg of beamSegments(project, beam)) {
    if (crossPos < seg.lo - 0.5 || crossPos > seg.hi + 0.5) continue;
    return isBeamSegOmitted(beam, seg.a0.id, seg.a1.id);
  }
  // Ngoài thân dầm (start/end) — không đặt cột
  const bLo = Math.min(beam.start, beam.end);
  const bHi = Math.max(beam.start, beam.end);
  if (crossPos < bLo - 0.5 || crossPos > bHi + 0.5) return true;
  return false;
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
  /**
   * Cột xuyên sàn như bản vẽ 3D DẦM SÀN LẦU 2:
   * stub trên mặt sàn +50cm, dưới mặt sàn −100cm (nhô khỏi đáy dầm).
   */
  const COL_ABOVE_SLAB_MM = 500;
  const COL_BELOW_SLAB_MM = 1000;
  const zColTop = zTop + COL_ABOVE_SLAB_MM;
  const zColBot = zTop - COL_BELOW_SLAB_MM;
  const bleed = planBeamBleed(project, axesX, axesY);

  /** Trục đầu/cuối nhịp ngắn (ban công console) — không dựng stub cột, chỉ khung dầm. */
  const cantileverTipAxis = (axes: typeof axesX, idx: number): boolean => {
    if (axes.length < 3) return false;
    const spans: number[] = [];
    for (let i = 1; i < axes.length; i++) spans.push(axes[i].pos - axes[i - 1].pos);
    const avg = spans.reduce((a, b) => a + b, 0) / Math.max(spans.length, 1);
    if (idx === 0 && spans[0] < avg * 0.55) return true;
    if (idx === axes.length - 1 && spans[spans.length - 1] < avg * 0.55) return true;
    return false;
  };

  // Cột tại giao dầm (và 4 góc khung): footprint = giao tiết diện hai dầm giao nhau.
  let ci = 0;
  for (let iAx = 0; iAx < axesX.length; iAx++) {
    const ax = axesX[iAx];
    if (cantileverTipAxis(axesX, iAx)) continue;
    for (let iAy = 0; iAy < axesY.length; iAy++) {
      const ay = axesY[iAy];
      if (cantileverTipAxis(axesY, iAy)) continue;
      const beamY = findBeamOnAxis(project, "Y", ax);
      const beamX = findBeamOnAxis(project, "X", ay);
      if (!beamY || !beamX) continue;
      if (isBeamSegOmittedAcross(project, beamY, ay.pos)) continue;
      if (isBeamSegOmittedAcross(project, beamX, ax.pos)) continue;
      const fx = beamOuterFacesAtAlong(project, "Y", ax, ay.pos);
      const fy = beamOuterFacesAtAlong(project, "X", ay, ax.pos);
      let x0 = Math.min(fx.lo, fx.hi);
      let x1 = Math.max(fx.lo, fx.hi);
      let y0 = Math.min(fy.lo, fy.hi);
      let y1 = Math.max(fy.lo, fy.hi);
      // Fallback nếu da trùng (dầm omit): ô vuông quanh giao tim.
      if (x1 - x0 < 40) {
        const half = Math.max(150, Math.round(parseBH(beamY.size).b / 2));
        x0 = ax.pos - half;
        x1 = ax.pos + half;
      }
      if (y1 - y0 < 40) {
        const half = Math.max(150, Math.round(parseBH(beamX.size).b / 2));
        y0 = ay.pos - half;
        y1 = ay.pos + half;
      }
      solids.push(rectSolid(`col-${ci}`, x0, y0, x1, y1, zColBot, zColTop));
      ci += 1;
    }
  }

  // Góc khung bleed: chỉ thêm stub cột khi không phải đầu console (ban công).
  const tipX0 = cantileverTipAxis(axesX, 0);
  const tipX1 = cantileverTipAxis(axesX, axesX.length - 1);
  const tipY0 = cantileverTipAxis(axesY, 0);
  const tipY1 = cantileverTipAxis(axesY, axesY.length - 1);
  const cornerPts: Array<[number, number, boolean]> = [
    [bleed.xMin, bleed.yMin, tipX0 || tipY0],
    [bleed.xMax, bleed.yMin, tipX1 || tipY0],
    [bleed.xMin, bleed.yMax, tipX0 || tipY1],
    [bleed.xMax, bleed.yMax, tipX1 || tipY1],
  ];
  for (const [cx, cy, skip] of cornerPts) {
    if (skip) continue;
    const already = solids.some(
      (s) =>
        s.id.startsWith("col-") &&
        cx >= s.min.x - 2 &&
        cx <= s.max.x + 2 &&
        cy >= s.min.y - 2 &&
        cy <= s.max.y + 2,
    );
    if (already) continue;
    let bw = 300;
    for (const b of project.beams ?? []) {
      if (b.free) continue;
      bw = Math.max(bw, parseBH(b.size).b);
    }
    const half = Math.round(bw / 2);
    const x0 = cx <= bleed.xMin + 1 ? cx : cx - Math.min(half * 2, bw);
    const x1 = cx <= bleed.xMin + 1 ? cx + Math.min(half * 2, bw) : cx;
    const y0 = cy <= bleed.yMin + 1 ? cy : cy - Math.min(half * 2, bw);
    const y1 = cy <= bleed.yMin + 1 ? cy + Math.min(half * 2, bw) : cy;
    solids.push(rectSolid(`col-${ci++}`, x0, y0, x1, y1, zColBot, zColTop));
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
      const id = `beam-${bi++}`;
      if (beam.direction === "Y") {
        solids.push(makeSolid(id,
          [{ x: lo0, y: lo, z: z0 }, { x: hi0, y: lo, z: z0 }, { x: hi1, y: hi, z: z0 }, { x: lo1, y: hi, z: z0 }],
          [{ x: lo0, y: lo, z: z1 }, { x: hi0, y: lo, z: z1 }, { x: hi1, y: hi, z: z1 }, { x: lo1, y: hi, z: z1 }],
        ));
      } else {
        solids.push(makeSolid(id,
          [{ x: lo, y: lo0, z: z0 }, { x: hi, y: lo0, z: z0 }, { x: hi, y: hi1, z: z0 }, { x: lo, y: hi1, z: z0 }],
          [{ x: lo, y: lo0, z: z1 }, { x: hi, y: lo0, z: z1 }, { x: hi, y: hi1, z: z1 }, { x: lo, y: hi1, z: z1 }],
        ));
      }
    }
  }

  // Sàn thấp: khối 3D lõm (trước khi rút cạnh / occlusion) — như khay ướt trên bản vẽ Lầu 2.
  const slabThk = Math.max(80, Math.round(Number(project.info.thickness) || 100));
  let li = 0;
  for (const ls of project.lowSlabs ?? []) {
    const drop = Math.max(50, Math.round(Number(ls.drop) || Number(project.info.lowSlabDrop) || 200));
    const zSurf = zTop - drop;
    const zBot = zSurf - slabThk;
    const x0 = ls.x;
    const y0 = ls.y;
    const x1 = ls.x + ls.w;
    const y1 = ls.y + ls.h;
    if (!(x1 - x0 > 40 && y1 - y0 > 40)) continue;
    solids.push(rectSolid(`low-${li++}`, x0, y0, x1, y1, zBot, zSurf));
    hatchFaces.push({
      pts: [
        { x: x0, y: y0, z: zSurf + 1 },
        { x: x1, y: y0, z: zSurf + 1 },
        { x: x1, y: y1, z: zSurf + 1 },
        { x: x0, y: y1, z: zSurf + 1 },
      ],
      kind: "hatch",
    });
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
  const isVerticalEdge = (a: Pt3, b: Pt3) =>
    Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS && Math.abs(a.z - b.z) > EPS;

  for (const s of solids) {
    const isBeam = s.id.startsWith("beam-");
    const c = solidCenter(s);
    for (const ed of s.edgeDefs) {
      // Không vẽ cạnh đứng thân dầm — stub cột tại giao đã thể hiện.
      if (isBeam && isVerticalEdge(ed.a, ed.b)) continue;
      // Phân biệt theo hướng nhìn: mặt trước + không che → liền đậm; khuất → gạch nhạt.
      const style0 = classifyEdge(
        ed.a,
        ed.b,
        s.faces[ed.f0],
        s.faces[ed.f1],
        c,
        occluderFaces,
      );
      const parts = clipEdgeOutsideSolids(ed.a, ed.b, solids, s.id);
      for (const [p0, p1] of parts) {
        let style: "solid" | "dashed" = style0;
        if (style === "solid") {
          style = styleByOcclusion(p0, p1, occluderFaces);
        }
        rawEdges.push({ a: p0, b: p1, style });
      }
    }
  }

  // Gộp cạnh trùng: ưu tiên nét liền (silhouette nhìn thấy).
  const edges: DrawEdge[] = [];
  for (const e of rawEdges) {
    const hit = edges.findIndex((o) => nearlySameEdge(e.a, e.b, o.a, o.b));
    if (hit < 0) edges.push(e);
    else if (e.style === "solid") edges[hit].style = "solid";
  }

  // Mặt sàn ô thường; ô thủng → cầu thang U (như 3D DẦM SÀN LẦU 2); sàn thấp → khay lõm + chấm.
  // Không viền nét liền mặt sàn — tránh ghi đè cạnh dầm (phải giữ nét đứt).
  const deckFaces: Face3[] = [];
  const stairEdges: DrawEdge[] = [];
  let openingDrawn = false;
  if (axesX.length >= 2 && axesY.length >= 2) {
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      for (let iy = 0; iy < axesY.length - 1; iy++) {
        const bay = baySlabExtent(project, axesX, axesY, ix, iy);
        let kind = bayKindAt(project, axesX, axesY, ix, iy);
        // Ô thủng / sàn thấp khớp gần đúng lòng ô (không chỉ equals khít).
        if (kind === "normal") {
          const bw = bay.x1 - bay.x0;
          const bh = bay.y1 - bay.y0;
          const area = Math.max(bw * bh, 1);
          for (const o of project.openings ?? []) {
            const ox0 = Math.max(bay.x0, o.x);
            const oy0 = Math.max(bay.y0, o.y);
            const ox1 = Math.min(bay.x1, o.x + o.w);
            const oy1 = Math.min(bay.y1, o.y + o.h);
            if (ox1 > ox0 && oy1 > oy0 && ((ox1 - ox0) * (oy1 - oy0)) / area > 0.45) {
              kind = "opening";
              break;
            }
          }
          if (kind === "normal") {
            let lowCover = 0;
            for (const o of project.lowSlabs ?? []) {
              const ox0 = Math.max(bay.x0, o.x);
              const oy0 = Math.max(bay.y0, o.y);
              const ox1 = Math.min(bay.x1, o.x + o.w);
              const oy1 = Math.min(bay.y1, o.y + o.h);
              if (ox1 > ox0 && oy1 > oy0) lowCover += (ox1 - ox0) * (oy1 - oy0);
            }
            if (lowCover / area > 0.45) kind = "low";
          }
        }
        if (kind === "opening") {
          const inset = Math.min(80, Math.max(25, Math.min(bay.x1 - bay.x0, bay.y1 - bay.y0) * 0.06));
          const x0 = bay.x0 + inset;
          const x1 = bay.x1 - inset;
          const y0 = bay.y0 + inset;
          const y1 = bay.y1 - inset;
          if (x1 - x0 > 40 && y1 - y0 > 40) {
            const stair = buildUStair(x0, y0, x1, y1, zTop);
            stairEdges.push(...stair.edges);
            hatchFaces.push(...stair.hatchFaces);
            openingDrawn = true;
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
      }
    }
  }

  // Fallback opening không khớp bay: vẫn vẽ cầu thang U.
  if (!openingDrawn) {
    for (const o of project.openings ?? []) {
      const x0 = o.x;
      const y0 = o.y;
      const x1 = o.x + o.w;
      const y1 = o.y + o.h;
      if (x1 - x0 > 40 && y1 - y0 > 40) {
        const stair = buildUStair(x0, y0, x1, y1, zTop);
        stairEdges.push(...stair.edges);
        hatchFaces.push(...stair.hatchFaces);
      }
    }
  }
  // Cầu thang: cũng phân biệt nhìn thấy / che khuất theo hướng nhìn.
  for (const e of stairEdges) {
    edges.push({
      a: e.a,
      b: e.b,
      style: e.style === "dashed" ? "dashed" : styleByOcclusion(e.a, e.b, occluderFaces),
    });
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
    title: `3D DẦM SÀN ${floorName.toUpperCase()}`,
    subtitle: `TL: 1/${project.info.drawingScale || 100}`,
  };
}

/**
 * Cầu thang chữ U trong ô thủng (như 3D DẦM SÀN LẦU 2):
 * hai vế + chiếu nghỉ giữa, bậc có mặt chấm, đi xuống khỏi mặt sàn.
 */
function buildUStair(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zTop: number,
): { edges: DrawEdge[]; hatchFaces: Face3[] } {
  const edges: DrawEdge[] = [];
  const hatchFaces: Face3[] = [];
  const push = (a: Pt3, b: Pt3) => {
    if (dist2(a, b) > 4) edges.push({ a, b, style: "solid" });
  };
  const hatchQuad = (a: Pt3, b: Pt3, c: Pt3, d: Pt3) => {
    hatchFaces.push({ pts: [a, b, c, d], kind: "hatch" });
  };
  const w = x1 - x0;
  const d = y1 - y0;
  // Chiều dài nhà phố thường dọc X → vế thang chạy theo X, chiếu nghỉ sát biên xa.
  const alongX = w >= d * 0.85;
  const steps = Math.max(7, Math.min(11, Math.round((alongX ? w : d) / 420)));
  const totalDrop = Math.max(1600, Math.min(3000, Math.round(Math.max(w, d) * 0.7)));
  const zBot = zTop - totalDrop;
  const zLand = zTop - Math.round(totalDrop * 0.42);
  const riser = (zTop - zLand) / steps;
  const riser2 = (zLand - zBot) / steps;

  // Khung ô thủng sát mặt sàn (viền lỗ thang).
  const zRim = zTop + 2;
  push({ x: x0, y: y0, z: zRim }, { x: x1, y: y0, z: zRim });
  push({ x: x1, y: y0, z: zRim }, { x: x1, y: y1, z: zRim });
  push({ x: x1, y: y1, z: zRim }, { x: x0, y: y1, z: zRim });
  push({ x: x0, y: y1, z: zRim }, { x: x0, y: y0, z: zRim });

  if (alongX) {
    // Vế 1 (y nhỏ) đi xuống +X → chiếu nghỉ sát x1; vế 2 (y lớn) xuống −X.
    const yA0 = y0;
    const yA1 = y0 + d * 0.4;
    const yB0 = y1 - d * 0.4;
    const yB1 = y1;
    const gap = Math.max(40, (yB0 - yA1) * 0.15);
    const landX0 = x0 + w * 0.62;
    const landX1 = x1;
    // Chiếu nghỉ (chấm)
    hatchQuad(
      { x: landX0, y: yA0, z: zLand + 1 },
      { x: landX1, y: yA0, z: zLand + 1 },
      { x: landX1, y: yB1, z: zLand + 1 },
      { x: landX0, y: yB1, z: zLand + 1 },
    );
    push({ x: landX0, y: yA0, z: zLand }, { x: landX1, y: yA0, z: zLand });
    push({ x: landX1, y: yA0, z: zLand }, { x: landX1, y: yB1, z: zLand });
    push({ x: landX1, y: yB1, z: zLand }, { x: landX0, y: yB1, z: zLand });
    push({ x: landX0, y: yB1, z: zLand }, { x: landX0, y: yA0, z: zLand });
    // Cạnh đứng chiếu nghỉ
    push({ x: landX0, y: yA0, z: zLand }, { x: landX0, y: yA0, z: zLand - 80 });
    push({ x: landX1, y: yA0, z: zLand }, { x: landX1, y: yA0, z: zLand - 80 });
    push({ x: landX1, y: yB1, z: zLand }, { x: landX1, y: yB1, z: zLand - 80 });
    push({ x: landX0, y: yB1, z: zLand }, { x: landX0, y: yB1, z: zLand - 80 });

    const runLen = landX0 - x0;
    for (let i = 0; i < steps; i++) {
      const xa = x0 + (runLen * i) / steps;
      const xb = x0 + (runLen * (i + 1)) / steps;
      const zHi = zTop - riser * i;
      const zLo = zTop - riser * (i + 1);
      // Mặt bậc (chấm) + mũi bậc
      hatchQuad(
        { x: xa, y: yA0, z: zLo + 1 },
        { x: xb, y: yA0, z: zLo + 1 },
        { x: xb, y: yA1 - gap, z: zLo + 1 },
        { x: xa, y: yA1 - gap, z: zLo + 1 },
      );
      push({ x: xa, y: yA0, z: zHi }, { x: xa, y: yA0, z: zLo });
      push({ x: xa, y: yA1 - gap, z: zHi }, { x: xa, y: yA1 - gap, z: zLo });
      push({ x: xa, y: yA0, z: zLo }, { x: xb, y: yA0, z: zLo });
      push({ x: xa, y: yA1 - gap, z: zLo }, { x: xb, y: yA1 - gap, z: zLo });
      push({ x: xa, y: yA0, z: zLo }, { x: xa, y: yA1 - gap, z: zLo });
      push({ x: xb, y: yA0, z: zLo }, { x: xb, y: yA1 - gap, z: zLo });
    }
    // Lan can / mép vế 1
    push({ x: x0, y: yA0, z: zTop }, { x: landX0, y: yA0, z: zLand });
    push({ x: x0, y: yA1 - gap, z: zTop }, { x: landX0, y: yA1 - gap, z: zLand });

    for (let i = 0; i < steps; i++) {
      const xa = landX0 - (runLen * i) / steps;
      const xb = landX0 - (runLen * (i + 1)) / steps;
      const zHi = zLand - riser2 * i;
      const zLo = zLand - riser2 * (i + 1);
      hatchQuad(
        { x: xb, y: yB0 + gap, z: zLo + 1 },
        { x: xa, y: yB0 + gap, z: zLo + 1 },
        { x: xa, y: yB1, z: zLo + 1 },
        { x: xb, y: yB1, z: zLo + 1 },
      );
      push({ x: xa, y: yB0 + gap, z: zHi }, { x: xa, y: yB0 + gap, z: zLo });
      push({ x: xa, y: yB1, z: zHi }, { x: xa, y: yB1, z: zLo });
      push({ x: xa, y: yB0 + gap, z: zLo }, { x: xb, y: yB0 + gap, z: zLo });
      push({ x: xa, y: yB1, z: zLo }, { x: xb, y: yB1, z: zLo });
      push({ x: xa, y: yB0 + gap, z: zLo }, { x: xa, y: yB1, z: zLo });
      push({ x: xb, y: yB0 + gap, z: zLo }, { x: xb, y: yB1, z: zLo });
    }
    push({ x: landX0, y: yB0 + gap, z: zLand }, { x: x0, y: yB0 + gap, z: zBot });
    push({ x: landX0, y: yB1, z: zLand }, { x: x0, y: yB1, z: zBot });
  } else {
    // Vế chạy theo Y (chiếu nghỉ sát y1)
    const xA0 = x0;
    const xA1 = x0 + w * 0.4;
    const xB0 = x1 - w * 0.4;
    const xB1 = x1;
    const gap = Math.max(40, (xB0 - xA1) * 0.15);
    const landY0 = y0 + d * 0.62;
    const landY1 = y1;
    hatchQuad(
      { x: xA0, y: landY0, z: zLand + 1 },
      { x: xB1, y: landY0, z: zLand + 1 },
      { x: xB1, y: landY1, z: zLand + 1 },
      { x: xA0, y: landY1, z: zLand + 1 },
    );
    push({ x: xA0, y: landY0, z: zLand }, { x: xA0, y: landY1, z: zLand });
    push({ x: xA0, y: landY1, z: zLand }, { x: xB1, y: landY1, z: zLand });
    push({ x: xB1, y: landY1, z: zLand }, { x: xB1, y: landY0, z: zLand });
    push({ x: xB1, y: landY0, z: zLand }, { x: xA0, y: landY0, z: zLand });

    const runLen = landY0 - y0;
    for (let i = 0; i < steps; i++) {
      const ya = y0 + (runLen * i) / steps;
      const yb = y0 + (runLen * (i + 1)) / steps;
      const zHi = zTop - riser * i;
      const zLo = zTop - riser * (i + 1);
      hatchQuad(
        { x: xA0, y: ya, z: zLo + 1 },
        { x: xA1 - gap, y: ya, z: zLo + 1 },
        { x: xA1 - gap, y: yb, z: zLo + 1 },
        { x: xA0, y: yb, z: zLo + 1 },
      );
      push({ x: xA0, y: ya, z: zHi }, { x: xA0, y: ya, z: zLo });
      push({ x: xA1 - gap, y: ya, z: zHi }, { x: xA1 - gap, y: ya, z: zLo });
      push({ x: xA0, y: ya, z: zLo }, { x: xA0, y: yb, z: zLo });
      push({ x: xA1 - gap, y: ya, z: zLo }, { x: xA1 - gap, y: yb, z: zLo });
      push({ x: xA0, y: ya, z: zLo }, { x: xA1 - gap, y: ya, z: zLo });
      push({ x: xA0, y: yb, z: zLo }, { x: xA1 - gap, y: yb, z: zLo });
    }
    push({ x: xA0, y: y0, z: zTop }, { x: xA0, y: landY0, z: zLand });
    push({ x: xA1 - gap, y: y0, z: zTop }, { x: xA1 - gap, y: landY0, z: zLand });

    for (let i = 0; i < steps; i++) {
      const ya = landY0 - (runLen * i) / steps;
      const yb = landY0 - (runLen * (i + 1)) / steps;
      const zHi = zLand - riser2 * i;
      const zLo = zLand - riser2 * (i + 1);
      hatchQuad(
        { x: xB0 + gap, y: yb, z: zLo + 1 },
        { x: xB1, y: yb, z: zLo + 1 },
        { x: xB1, y: ya, z: zLo + 1 },
        { x: xB0 + gap, y: ya, z: zLo + 1 },
      );
      push({ x: xB0 + gap, y: ya, z: zHi }, { x: xB0 + gap, y: ya, z: zLo });
      push({ x: xB1, y: ya, z: zHi }, { x: xB1, y: ya, z: zLo });
      push({ x: xB0 + gap, y: ya, z: zLo }, { x: xB0 + gap, y: yb, z: zLo });
      push({ x: xB1, y: ya, z: zLo }, { x: xB1, y: yb, z: zLo });
      push({ x: xB0 + gap, y: ya, z: zLo }, { x: xB1, y: ya, z: zLo });
      push({ x: xB0 + gap, y: yb, z: zLo }, { x: xB1, y: yb, z: zLo });
    }
    push({ x: xB0 + gap, y: landY0, z: zLand }, { x: xB0 + gap, y: y0, z: zBot });
    push({ x: xB1, y: landY0, z: zLand }, { x: xB1, y: y0, z: zBot });
  }
  return { edges, hatchFaces };
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
  // Sàn thấp / bậc thang (hatch) vẽ sau mặt đặc để chấm không bị mặt sàn che.
  projectedFaces.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "hatch" ? 1 : -1;
    return a.depth - b.depth;
  });

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
