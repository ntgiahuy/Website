import type { GridAxis, PlanBeam, SlabInfo, SlabProject } from "./types";
import { uid } from "./utils";

/** Thụt thép sàn khỏi da dầm (fallback nếu cover chưa có). */
export const SLAB_REBAR_FACE_INSET_MM = 50;

/** Lớp bảo vệ (mm) — sắt trừ da dầm biên. */
export function slabCoverMm(project: SlabProject): number {
  const c = Number(project.info.cover);
  return Number.isFinite(c) && c >= 0 ? Math.round(c) : SLAB_REBAR_FACE_INSET_MM;
}

export function formatBeamSize(b: number, h: number): string {
  return `${Math.max(1, Math.round(b))}x${Math.max(1, Math.round(h))}`;
}

export type BeamSection = { bw: number; b1: number };

function parseSizeStr(size?: string): { b: number; h: number } {
  const m = (size ?? "").trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)/);
  return m ? { b: Number(m[1]), h: Number(m[2]) } : { b: 220, h: 500 };
}

/** Tiết diện dầm theo phương + trục (B1: mép thấp/trái → tim). */
export function beamSectionOnAxis(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axis: GridAxis,
): BeamSection {
  const fallback =
    beamDir === "Y"
      ? project.info.beamSizeX || formatBeamSize(project.info.beamB, project.info.beamH)
      : project.info.beamSizeY || formatBeamSize(project.info.beamB, project.info.beamH);
  const beam = (project.beams ?? []).find(
    (b) => b.axisId === axis.id || (b.direction === beamDir && Math.abs(b.axis - axis.pos) < 0.5),
  );
  const { b: bw } = parseSizeStr(beam?.size ?? fallback);
  const b1 = Number.isFinite(beam?.offset)
    ? (beam!.offset as number)
    : Number.isFinite(project.info.beamB1)
      ? project.info.beamB1
      : bw / 2;
  return { bw, b1 };
}

/**
 * Da dầm (mép ngoài) theo trục vuông góc với phương dầm.
 * B1 đo từ mép lo (trái/dưới) đến tim → [axis - b1, axis + (bw - b1)].
 */
export function beamOuterFaces(axisPos: number, sec: BeamSection): { lo: number; hi: number } {
  return { lo: axisPos - sec.b1, hi: axisPos + (sec.bw - sec.b1) };
}

/**
 * B1 theo vị trí trục trên lưới:
 * - biên đầu: tim = da ngoài lo (B1 = 0)
 * - biên cuối: tim = da ngoài hi (B1 = B)
 * - giữa: tim = tâm dầm (B1 = B/2)
 */
export function beamOffsetForAxisIndex(bw: number, index: number, count: number): number {
  const B = Math.max(1, Math.round(bw) || 1);
  if (count <= 1) return Math.round(B / 2);
  if (index <= 0) return 0;
  if (index >= count - 1) return B;
  return Math.round(B / 2);
}

/**
 * Ghép dầm → chỉ số trục: axisId → trùng vị trí → cùng thứ tự (khi số dầm = số trục) → gần nhất.
 * Quan trọng khi đổi nhịp: vị trí trục đã đổi, không còn khớp pos cũ.
 */
function resolveBeamAxisIndex(
  beam: PlanBeam,
  axes: GridAxis[],
  peersSorted: PlanBeam[],
): number {
  if (!axes.length) return -1;
  if (beam.axisId) {
    const byId = axes.findIndex((a) => a.id === beam.axisId);
    if (byId >= 0) return byId;
  }
  const byPos = axes.findIndex((a) => Math.abs(a.pos - beam.axis) < 0.5);
  if (byPos >= 0) return byPos;
  if (peersSorted.length === axes.length) {
    const peerIdx = peersSorted.findIndex((p) => p.id === beam.id);
    if (peerIdx >= 0) return peerIdx;
  }
  let best = 0;
  let bestDist = Math.abs(axes[0].pos - beam.axis);
  for (let i = 1; i < axes.length; i++) {
    const d = Math.abs(axes[i].pos - beam.axis);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Đưa dầm theo tim trục (axisId / vị trí) và chỉnh B1 biên / giữa.
 * Gọi sau khi đổi khoảng cách / số lượng trục.
 */
export function syncBeamsToAxes(project: SlabProject): SlabProject {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);

  const peersY = (project.beams ?? [])
    .filter((b) => b.direction === "Y")
    .slice()
    .sort((a, b) => a.axis - b.axis || a.name.localeCompare(b.name));
  const peersX = (project.beams ?? [])
    .filter((b) => b.direction === "X")
    .slice()
    .sort((a, b) => a.axis - b.axis || a.name.localeCompare(b.name));

  const beams = (project.beams ?? []).map((b) => {
    if (b.direction === "Y") {
      const idx = resolveBeamAxisIndex(b, axesX, peersY);
      if (idx < 0) return { ...b, start: 0, end: Hplan };
      const ax = axesX[idx];
      const { b: bw } = parseSizeStr(b.size);
      return {
        ...b,
        axis: ax.pos,
        axisId: ax.id,
        offset: beamOffsetForAxisIndex(bw, idx, axesX.length),
        start: 0,
        end: Hplan,
      };
    }

    const idx = resolveBeamAxisIndex(b, axesY, peersX);
    if (idx < 0) return { ...b, start: 0, end: W };
    const ay = axesY[idx];
    const { b: bw } = parseSizeStr(b.size);
    return {
      ...b,
      axis: ay.pos,
      axisId: ay.id,
      offset: beamOffsetForAxisIndex(bw, idx, axesY.length),
      start: 0,
      end: W,
    };
  });

  return { ...project, beams };
}

/** Đoạn dầm đứng (phương Y): kéo đầu đến da dầm ngang tại hai đầu. */
export function verticalBeamSegExtent(
  project: SlabProject,
  y0: number,
  y1: number,
  axesY: GridAxis[],
): { yLo: number; yHi: number } {
  const loAxis = Math.min(y0, y1);
  const hiAxis = Math.max(y0, y1);
  const aLo = axesY.find((a) => Math.abs(a.pos - loAxis) < 0.5) ?? { id: "", name: "", pos: loAxis };
  const aHi = axesY.find((a) => Math.abs(a.pos - hiAxis) < 0.5) ?? { id: "", name: "", pos: hiAxis };
  const faceLo = beamOuterFaces(loAxis, beamSectionOnAxis(project, "X", aLo));
  const faceHi = beamOuterFaces(hiAxis, beamSectionOnAxis(project, "X", aHi));
  return { yLo: faceLo.lo, yHi: faceHi.hi };
}

/** Đoạn dầm ngang (phương X): kéo đầu đến da dầm đứng tại hai đầu. */
export function horizontalBeamSegExtent(
  project: SlabProject,
  x0: number,
  x1: number,
  axesX: GridAxis[],
): { xLo: number; xHi: number } {
  const loAxis = Math.min(x0, x1);
  const hiAxis = Math.max(x0, x1);
  const aLo = axesX.find((a) => Math.abs(a.pos - loAxis) < 0.5) ?? { id: "", name: "", pos: loAxis };
  const aHi = axesX.find((a) => Math.abs(a.pos - hiAxis) < 0.5) ?? { id: "", name: "", pos: hiAxis };
  const faceLo = beamOuterFaces(loAxis, beamSectionOnAxis(project, "Y", aLo));
  const faceHi = beamOuterFaces(hiAxis, beamSectionOnAxis(project, "Y", aHi));
  return { xLo: faceLo.lo, xHi: faceHi.hi };
}

/**
 * Phạm vi thép sàn trong ô: giữa da trong hai dầm, thụt insetMm (mặc định = lớp BV).
 * Không kéo thép xuyên qua thân dầm.
 */
export function bayRebarExtent(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  ix: number,
  iy: number,
  insetMm?: number,
): { x0: number; x1: number; y0: number; y1: number; mx: number; my: number } {
  const inset = insetMm ?? slabCoverMm(project);
  const slab = baySlabExtent(project, axesX, axesY, ix, iy);
  const x0 = slab.x0 + inset;
  const x1c = Math.max(x0, slab.x1 - inset);
  const y0 = slab.y0 + inset;
  const y1c = Math.max(y0, slab.y1 - inset);
  return {
    x0,
    x1: x1c,
    y0,
    y1: y1c,
    mx: (x0 + x1c) / 2,
    my: (y0 + y1c) / 2,
  };
}

/** Hình chữ nhật cắt thép: ô thủng + sàn thấp (cắt tại mí da). */
export function rebarCutRects(
  project: SlabProject,
): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const out: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const o of project.openings ?? []) {
    out.push({ x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h });
  }
  for (const o of project.lowSlabs ?? []) {
    out.push({ x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h });
  }
  return out;
}

/** Trừ các khoảng cut khỏi [lo,hi]; giữ phần còn lại. */
export function subtract1D(
  lo: number,
  hi: number,
  cuts: Array<{ lo: number; hi: number }>,
): Array<{ lo: number; hi: number }> {
  if (hi - lo < 1) return [];
  let segs: Array<{ lo: number; hi: number }> = [{ lo, hi }];
  for (const c of cuts) {
    const cLo = Math.min(c.lo, c.hi);
    const cHi = Math.max(c.lo, c.hi);
    const next: Array<{ lo: number; hi: number }> = [];
    for (const s of segs) {
      if (cHi <= s.lo + 0.5 || cLo >= s.hi - 0.5) {
        next.push(s);
        continue;
      }
      if (cLo > s.lo + 0.5) next.push({ lo: s.lo, hi: Math.min(s.hi, cLo) });
      if (cHi < s.hi - 0.5) next.push({ lo: Math.max(s.lo, cHi), hi: s.hi });
    }
    segs = next.filter((s) => s.hi - s.lo > 1);
  }
  return segs;
}

export type RebarBarSeg =
  | { dir: "X"; x0: number; x1: number; y: number }
  | { dir: "Y"; y0: number; y1: number; x: number };

/**
 * Thép ô sàn: từ da dầm biên trừ lớp BV; nếu gặp ô thủng / sàn thấp thì cắt tại mí da.
 * Mỗi ô: 1 cây phương X + 1 cây phương Y (có thể bị tách thành nhiều đoạn).
 */
export function bayRebarBarSegments(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  ix: number,
  iy: number,
): RebarBarSeg[] {
  const { x0, x1, y0, y1, mx, my } = bayRebarExtent(project, axesX, axesY, ix, iy);
  if (x1 - x0 < 2 || y1 - y0 < 2) return [];
  const cuts = rebarCutRects(project);
  const hCuts = cuts
    .filter((r) => my > Math.min(r.y0, r.y1) + 0.5 && my < Math.max(r.y0, r.y1) - 0.5)
    .map((r) => ({ lo: Math.min(r.x0, r.x1), hi: Math.max(r.x0, r.x1) }));
  const vCuts = cuts
    .filter((r) => mx > Math.min(r.x0, r.x1) + 0.5 && mx < Math.max(r.x0, r.x1) - 0.5)
    .map((r) => ({ lo: Math.min(r.y0, r.y1), hi: Math.max(r.y0, r.y1) }));

  const out: RebarBarSeg[] = [];
  for (const s of subtract1D(x0, x1, hCuts)) {
    out.push({ dir: "X", x0: s.lo, x1: s.hi, y: my });
  }
  for (const s of subtract1D(y0, y1, vCuts)) {
    out.push({ dir: "Y", y0: s.lo, y1: s.hi, x: mx });
  }
  return out;
}

/**
 * Thép liên tục theo nhịp: từ dầm biên → dầm biên (trừ lớp BV),
 * cắt tại da dầm trung gian + mí da ô thủng / sàn thấp.
 */
export function stripRebarBarSegments(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
): RebarBarSeg[] {
  const cover = slabCoverMm(project);
  const cuts = rebarCutRects(project);
  const out: RebarBarSeg[] = [];

  // Phương X (thanh ngang): mỗi hàng ô
  for (let iy = 0; iy < axesY.length - 1; iy++) {
    let xLo = Infinity;
    let xHi = -Infinity;
    let yLo = Infinity;
    let yHi = -Infinity;
    const beamGaps: Array<{ lo: number; hi: number }> = [];
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      const slab = baySlabExtent(project, axesX, axesY, ix, iy);
      xLo = Math.min(xLo, slab.x0);
      xHi = Math.max(xHi, slab.x1);
      yLo = Math.min(yLo, slab.y0);
      yHi = Math.max(yHi, slab.y1);
      if (ix < axesX.length - 2) {
        const next = baySlabExtent(project, axesX, axesY, ix + 1, iy);
        // Khe thân dầm giữa hai ô (da trong trái của ô sau − da trong phải của ô trước)
        if (next.x0 > slab.x1 + 0.5) beamGaps.push({ lo: slab.x1, hi: next.x0 });
      }
    }
    if (!(xHi > xLo && yHi > yLo)) continue;
    const my = (yLo + yHi) / 2;
    const barLo = xLo + cover;
    const barHi = xHi - cover;
    const hCuts = [
      ...beamGaps,
      ...cuts
        .filter((r) => my > Math.min(r.y0, r.y1) + 0.5 && my < Math.max(r.y0, r.y1) - 0.5)
        .map((r) => ({ lo: Math.min(r.x0, r.x1), hi: Math.max(r.x0, r.x1) })),
    ];
    for (const s of subtract1D(barLo, barHi, hCuts)) {
      out.push({ dir: "X", x0: s.lo, x1: s.hi, y: my });
    }
  }

  // Phương Y (thanh đứng): mỗi cột ô
  for (let ix = 0; ix < axesX.length - 1; ix++) {
    let xLo = Infinity;
    let xHi = -Infinity;
    let yLo = Infinity;
    let yHi = -Infinity;
    const beamGaps: Array<{ lo: number; hi: number }> = [];
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      const slab = baySlabExtent(project, axesX, axesY, ix, iy);
      xLo = Math.min(xLo, slab.x0);
      xHi = Math.max(xHi, slab.x1);
      yLo = Math.min(yLo, slab.y0);
      yHi = Math.max(yHi, slab.y1);
      if (iy < axesY.length - 2) {
        const next = baySlabExtent(project, axesX, axesY, ix, iy + 1);
        if (next.y0 > slab.y1 + 0.5) beamGaps.push({ lo: slab.y1, hi: next.y0 });
      }
    }
    if (!(xHi > xLo && yHi > yLo)) continue;
    const mx = (xLo + xHi) / 2;
    const barLo = yLo + cover;
    const barHi = yHi - cover;
    const vCuts = [
      ...beamGaps,
      ...cuts
        .filter((r) => mx > Math.min(r.x0, r.x1) + 0.5 && mx < Math.max(r.x0, r.x1) - 0.5)
        .map((r) => ({ lo: Math.min(r.y0, r.y1), hi: Math.max(r.y0, r.y1) })),
    ];
    for (const s of subtract1D(barLo, barHi, vCuts)) {
      out.push({ dir: "Y", y0: s.lo, y1: s.hi, x: mx });
    }
  }

  return out;
}

/**
 * Các đoạn tim trục đứng chỉ trong lòng ô sàn (giữa da trong dầm).
 * Không vẽ khi tim trùng thân dầm đứng.
 */
export function axisInteriorSegmentsX(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  axisPos: number,
): { lo: number; hi: number }[] {
  const spans: { lo: number; hi: number }[] = [];
  const eps = 0.5;
  for (let ix = 0; ix < axesX.length - 1; ix++) {
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      const slab = baySlabExtent(project, axesX, axesY, ix, iy);
      if (axisPos > slab.x0 + eps && axisPos < slab.x1 - eps && slab.y1 > slab.y0 + eps) {
        spans.push({ lo: slab.y0, hi: slab.y1 });
      }
    }
  }
  return mergeAxisSpans(spans);
}

/**
 * Các đoạn tim trục ngang chỉ trong lòng ô sàn (giữa da trong dầm).
 * Không vẽ khi tim trùng thân dầm ngang.
 */
export function axisInteriorSegmentsY(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  axisPos: number,
): { lo: number; hi: number }[] {
  const spans: { lo: number; hi: number }[] = [];
  const eps = 0.5;
  for (let ix = 0; ix < axesX.length - 1; ix++) {
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      const slab = baySlabExtent(project, axesX, axesY, ix, iy);
      if (axisPos > slab.y0 + eps && axisPos < slab.y1 - eps && slab.x1 > slab.x0 + eps) {
        spans.push({ lo: slab.x0, hi: slab.x1 });
      }
    }
  }
  return mergeAxisSpans(spans);
}

function mergeAxisSpans(spans: { lo: number; hi: number }[]): { lo: number; hi: number }[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.lo - b.lo);
  const out: { lo: number; hi: number }[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].lo <= last.hi + 0.5) last.hi = Math.max(last.hi, sorted[i].hi);
    else out.push({ ...sorted[i] });
  }
  return out;
}

/** Phần dầm nhô ngoài khung plan (mm) — dùng neo vòng số hiệu ngoài da dầm. */
export function planBeamBleed(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  let xMin = 0;
  let xMax = project.planWidth;
  let yMin = 0;
  let yMax = project.planHeight;
  for (const ax of axesX) {
    const f = beamOuterFaces(ax.pos, beamSectionOnAxis(project, "Y", ax));
    xMin = Math.min(xMin, f.lo);
    xMax = Math.max(xMax, f.hi);
  }
  for (const ay of axesY) {
    const f = beamOuterFaces(ay.pos, beamSectionOnAxis(project, "X", ay));
    yMin = Math.min(yMin, f.lo);
    yMax = Math.max(yMax, f.hi);
  }
  return { xMin, xMax, yMin, yMax };
}

/**
 * Phạm vi ô sàn theo mép dầm (da trong): giữa hai da dầm đứng / ngang,
 * không lấy từ tim trục.
 */
export function baySlabExtent(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  ix: number,
  iy: number,
): { x0: number; x1: number; y0: number; y1: number; mx: number; my: number } {
  const ax0 = axesX[ix];
  const ax1 = axesX[ix + 1];
  const ay0 = axesY[iy];
  const ay1 = axesY[iy + 1];
  const left = beamOuterFaces(ax0.pos, beamSectionOnAxis(project, "Y", ax0));
  const right = beamOuterFaces(ax1.pos, beamSectionOnAxis(project, "Y", ax1));
  const bottom = beamOuterFaces(ay0.pos, beamSectionOnAxis(project, "X", ay0));
  const top = beamOuterFaces(ay1.pos, beamSectionOnAxis(project, "X", ay1));
  const x0 = left.hi;
  const x1 = Math.max(x0, right.lo);
  const y0 = bottom.hi;
  const y1 = Math.max(y0, top.lo);
  return {
    x0,
    x1,
    y0,
    y1,
    mx: (x0 + x1) / 2,
    my: (y0 + y1) / 2,
  };
}

/** Đoạn chéo trong hình chữ nhật (clip) theo hằng số x−y = c — nét sàn thấp /. */
export function rectDiagonalHatchSegments(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  spacingMm = 220,
): Array<{ xA: number; yA: number; xB: number; yB: number }> {
  const loX = Math.min(x0, x1);
  const hiX = Math.max(x0, x1);
  const loY = Math.min(y0, y1);
  const hiY = Math.max(y0, y1);
  const w = hiX - loX;
  const h = hiY - loY;
  if (w < 1 || h < 1) return [];
  const step = Math.max(40, spacingMm);
  const out: Array<{ xA: number; yA: number; xB: number; yB: number }> = [];
  // Đường x − y = c, hướng (1,1): góc dưới-trái → trên-phải trên bản vẽ
  const cMin = loX - hiY;
  const cMax = hiX - loY;
  for (let c = cMin; c <= cMax + 0.5; c += step) {
    // Giao với 4 cạnh
    const pts: Array<{ x: number; y: number }> = [];
    const push = (x: number, y: number) => {
      if (x >= loX - 0.5 && x <= hiX + 0.5 && y >= loY - 0.5 && y <= hiY + 0.5) {
        pts.push({ x: Math.min(hiX, Math.max(loX, x)), y: Math.min(hiY, Math.max(loY, y)) });
      }
    };
    // cạnh trái x=loX → y = loX - c
    push(loX, loX - c);
    // cạnh phải x=hiX → y = hiX - c
    push(hiX, hiX - c);
    // cạnh dưới y=loY → x = c + loY
    push(c + loY, loY);
    // cạnh trên y=hiY → x = c + hiY
    push(c + hiY, hiY);
    // Khử trùng
    const uniq: Array<{ x: number; y: number }> = [];
    for (const p of pts) {
      if (!uniq.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.5)) uniq.push(p);
    }
    if (uniq.length >= 2) {
      out.push({ xA: uniq[0].x, yA: uniq[0].y, xB: uniq[1].x, yB: uniq[1].y });
    }
  }
  return out;
}

/** Hai đường chéo góc ô — ký hiệu ô thủng. */
export function rectOpeningDiagonals(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [{ xA: number; yA: number; xB: number; yB: number }, { xA: number; yA: number; xB: number; yB: number }] {
  const loX = Math.min(x0, x1);
  const hiX = Math.max(x0, x1);
  const loY = Math.min(y0, y1);
  const hiY = Math.max(y0, y1);
  return [
    { xA: loX, yA: loY, xB: hiX, yB: hiY },
    { xA: loX, yA: hiY, xB: hiX, yB: loY },
  ];
}

/** Ô (ix,iy) có hình chữ nhật gần trùng với rect (mm). */
export function rectNearlyEquals(
  a: { x: number; y: number; w: number; h: number },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tol = 50,
): boolean {
  return (
    Math.abs(a.x - Math.min(x0, x1)) < tol &&
    Math.abs(a.y - Math.min(y0, y1)) < tol &&
    Math.abs(a.w - Math.abs(x1 - x0)) < tol &&
    Math.abs(a.h - Math.abs(y1 - y0)) < tol
  );
}

/** Chiều dài móc thép sàn trên mặt bằng (mm). */
export const SLAB_REBAR_HOOK_MM = 50;

/** Đọc B / H / B1 từ info (kèm fallback chuỗi beamSize cũ). */
export function beamDims(info: SlabInfo): { B: number; H: number; B1: number } {
  const fromStr = (size?: string) => {
    const m = (size ?? "").trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)/);
    return m ? { b: Number(m[1]), h: Number(m[2]) } : { b: 220, h: 500 };
  };
  const parsed = fromStr(info.beamSizeX || info.beamSizeY);
  const B = Number.isFinite(info.beamB) && info.beamB > 0 ? info.beamB : parsed.b;
  const H = Number.isFinite(info.beamH) && info.beamH > 0 ? info.beamH : parsed.h;
  const B1 =
    Number.isFinite(info.beamB1) && info.beamB1 >= 0 ? info.beamB1 : Math.round(B / 2);
  return { B, H, B1 };
}

/** Đồng bộ kích thước dầm (B/H/B1/size). Không gắn beamCount với số trục. */
export function syncBeamInfo(info: SlabInfo, _axesXLen?: number, _axesYLen?: number): SlabInfo {
  const { B, H, B1 } = beamDims(info);
  const size = formatBeamSize(B, H);
  return {
    ...info,
    beamB: B,
    beamH: H,
    beamB1: B1,
    beamSizeX: size,
    beamSizeY: size,
    beamCountX: Math.max(0, Math.round(info.beamCountX ?? 0)),
    beamCountY: Math.max(0, Math.round(info.beamCountY ?? 0)),
  };
}

/** Tên trục X tiếp theo: 1,2,3… */
export function nextAxisNameX(axes: GridAxis[]): string {
  const nums = axes
    .map((a) => Number.parseInt(a.name, 10))
    .filter((n) => Number.isFinite(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

/** Tên trục Y tiếp theo: A,B,…Z,AA… */
export function nextAxisNameY(axes: GridAxis[]): string {
  const toNum = (s: string) => {
    const t = s.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(t)) return 0;
    let n = 0;
    for (const ch of t) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  };
  const fromNum = (n: number) => {
    let x = Math.max(1, n);
    let out = "";
    while (x > 0) {
      const r = (x - 1) % 26;
      out = String.fromCharCode(65 + r) + out;
      x = Math.floor((x - 1) / 26);
    }
    return out;
  };
  const nums = axes.map((a) => toNum(a.name)).filter((n) => n > 0);
  return fromNum((nums.length ? Math.max(...nums) : 0) + 1);
}

export function sortAxes(axes: GridAxis[]): GridAxis[] {
  return [...axes].sort((a, b) => a.pos - b.pos);
}

export function defaultAxesX(width = 6000): GridAxis[] {
  const mid = Math.round(width / 2);
  return [
    { id: uid("ax"), name: "1", pos: 0 },
    { id: uid("ax"), name: "2", pos: mid },
    { id: uid("ax"), name: "3", pos: width },
  ];
}

export function defaultAxesY(height = 4500): GridAxis[] {
  return [
    { id: uid("ay"), name: "A", pos: 0 },
    { id: uid("ay"), name: "B", pos: height },
  ];
}

export function planSizeFromAxes(axesX: GridAxis[], axesY: GridAxis[]) {
  const xs = sortAxes(axesX);
  const ys = sortAxes(axesY);
  return {
    planWidth: xs.length ? xs[xs.length - 1].pos : 0,
    planHeight: ys.length ? ys[ys.length - 1].pos : 0,
  };
}

/** Khoảng cách nhịp giữa trục (i-1) và i (i=0 → vị trí gốc). */
export function axisSpan(axes: GridAxis[], index: number): number {
  const sorted = sortAxes(axes);
  if (index <= 0) return sorted[0]?.pos ?? 0;
  return Math.max(0, sorted[index].pos - sorted[index - 1].pos);
}

export function renameAxis(axes: GridAxis[], id: string, name: string): GridAxis[] {
  return axes.map((a) => (a.id === id ? { ...a, name } : a));
}

export function removeAxis(axes: GridAxis[], id: string): GridAxis[] {
  const next = sortAxes(axes.filter((a) => a.id !== id));
  return next.length >= 2 ? next : axes;
}

export function setAxisSpan(axes: GridAxis[], index: number, spanMm: number): GridAxis[] {
  const sorted = sortAxes(axes);
  if (index <= 0 || index >= sorted.length) return sorted;
  const span = Math.max(0, spanMm);
  const delta = span - (sorted[index].pos - sorted[index - 1].pos);
  return sorted.map((a, i) => (i >= index ? { ...a, pos: a.pos + delta } : a));
}

/**
 * Đặt số lượng trục / dầm: giữ kích thước tổng, chia đều nhịp.
 * Tái dùng id/tên trục cũ khi còn.
 */
export function setAxisCount(
  axes: GridAxis[],
  count: number,
  totalMm: number,
  dir: "X" | "Y",
): GridAxis[] {
  const n = Math.max(2, Math.floor(count) || 2);
  const sorted = sortAxes(axes);
  const total = Math.max(500, totalMm || sorted[sorted.length - 1]?.pos || 6000);
  const span = Math.round(total / (n - 1));
  const out: GridAxis[] = [];
  for (let i = 0; i < n; i++) {
    const prev = sorted[i];
    let name = prev?.name;
    if (!name) {
      name = dir === "X" ? nextAxisNameX(out) : nextAxisNameY(out);
    }
    out.push({
      id: prev?.id ?? uid(dir === "X" ? "ax" : "ay"),
      name,
      pos: i === n - 1 ? total : i * span,
    });
  }
  return out;
}

function parseSize(size: string): { b: number; h: number } {
  const m = size.trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)/);
  return m ? { b: Number(m[1]), h: Number(m[2]) } : { b: 220, h: 500 };
}

export function beamsFromAxes(project: SlabProject): PlanBeam[] {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  const prefix = project.info.beamNamePrefix || "D";
  const { B, H, B1 } = beamDims(project.info);
  const defaultSize = formatBeamSize(B, H);
  const prev = project.beams ?? [];
  const findPrev = (direction: PlanBeam["direction"], axisId: string, axis: number) =>
    prev.find((b) => b.axisId === axisId) ||
    prev.find((b) => b.direction === direction && Math.abs(b.axis - axis) < 0.5);

  const beams: PlanBeam[] = [];
  let n = 1;
  const usedNames = new Set<string>();
  const nextName = (preferred?: string) => {
    if (preferred && preferred.trim() && !usedNames.has(preferred)) {
      usedNames.add(preferred);
      return preferred;
    }
    let name = `${prefix}${n++}`;
    while (usedNames.has(name)) name = `${prefix}${n++}`;
    usedNames.add(name);
    return name;
  };

  for (const ax of axesX) {
    const old = findPrev("Y", ax.id, ax.pos);
    const dims = old ? parseSize(old.size) : { b: B, h: H };
    const idx = axesX.findIndex((a) => a.id === ax.id);
    beams.push({
      id: old?.id ?? uid("beam"),
      name: nextName(old?.name),
      size: old ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: "Y",
      axis: ax.pos,
      axisId: ax.id,
      start: 0,
      end: Hplan,
      offset: beamOffsetForAxisIndex(dims.b, idx, axesX.length),
    });
  }
  for (const ay of axesY) {
    const old = findPrev("X", ay.id, ay.pos);
    const dims = old ? parseSize(old.size) : { b: B, h: H };
    const idx = axesY.findIndex((a) => a.id === ay.id);
    beams.push({
      id: old?.id ?? uid("beam"),
      name: nextName(old?.name),
      size: old ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: "X",
      axis: ay.pos,
      axisId: ay.id,
      start: 0,
      end: W,
      offset: beamOffsetForAxisIndex(dims.b, idx, axesY.length),
    });
  }
  return beams;
}

/** Cập nhật kích thước một dầm theo trục (giữ các dầm khác). */
export function patchBeamOnAxis(
  project: SlabProject,
  dir: PlanBeam["direction"],
  axisIndex: number,
  dims: { beamB?: number; beamH?: number; beamB1?: number },
): SlabProject {
  const axes = sortAxes(dir === "Y" ? project.axesX : project.axesY);
  const axis = axes[axisIndex];
  if (!axis) return project;
  const current = (project.beams ?? []).find(
    (b) => b.axisId === axis.id || (b.direction === dir && Math.abs(b.axis - axis.pos) < 0.5),
  );
  const parsed = parseSize(current?.size ?? formatBeamSize(project.info.beamB, project.info.beamH));
  const B = dims.beamB ?? parsed.b;
  const H = dims.beamH ?? parsed.h;
  const B1 =
    dims.beamB1 ??
    beamOffsetForAxisIndex(B, axisIndex, axes.length);
  const size = formatBeamSize(B, H);
  const beams = (project.beams?.length ? project.beams : []).map((b) => {
    const match = b.axisId === axis.id || (b.direction === dir && Math.abs(b.axis - axis.pos) < 0.5);
    return match ? { ...b, size, offset: B1, axisId: axis.id, axis: axis.pos } : b;
  });
  return { ...project, beams };
}

/** Áp dụng B/H của một dầm cho toàn bộ; B1 biên/giữa theo lưới trục. */
export function applyBeamDimsToAll(
  project: SlabProject,
  dims: { beamB: number; beamH: number; beamB1: number },
): SlabProject {
  const size = formatBeamSize(dims.beamB, dims.beamH);
  const beams = (project.beams?.length ? project.beams : []).map((b) => ({
    ...b,
    size,
  }));
  const info = syncBeamInfo({
    ...project.info,
    beamB: dims.beamB,
    beamH: dims.beamH,
    beamB1: dims.beamB1,
  });
  return syncBeamsToAxes({ ...project, info, beams });
}

/** Đặt cùng một nhịp (mm) cho mọi khoảng giữa trục theo phương X hoặc Y. */
export function equalizeAxisSpans(
  axes: GridAxis[],
  spanMm: number,
): GridAxis[] {
  const sorted = sortAxes(axes);
  if (sorted.length < 2) return sorted;
  const span = Math.max(500, Math.round(spanMm) || 500);
  let pos = sorted[0].pos;
  return sorted.map((a, i) => {
    if (i === 0) return a;
    pos += span;
    return { ...a, pos };
  });
}

export function ensureAxes(project: SlabProject): SlabProject {
  const axesX =
    project.axesX && project.axesX.length >= 2
      ? sortAxes(project.axesX)
      : defaultAxesX(project.planWidth || 6000);
  const axesY =
    project.axesY && project.axesY.length >= 2
      ? sortAxes(project.axesY)
      : defaultAxesY(project.planHeight || 4500);
  const size = planSizeFromAxes(axesX, axesY);
  const info = syncBeamInfo({
    ...project.info,
    // Giữ nguyên số dầm; không đồng bộ theo số trục
    beamCountX: project.info.beamCountX ?? project.beams?.filter((b) => b.direction === "Y").length ?? 0,
    beamCountY: project.info.beamCountY ?? project.beams?.filter((b) => b.direction === "X").length ?? 0,
  });
  return { ...project, info, axesX, axesY, ...size };
}

/** Cập nhật trục + kích thước mặt bằng; dầm theo tim trục (biên / giữa). */
export function applyAxesToProject(project: SlabProject): SlabProject {
  const withAxes = ensureAxes(project);
  const size = planSizeFromAxes(withAxes.axesX, withAxes.axesY);
  const info = syncBeamInfo(withAxes.info);
  return syncBeamsToAxes({
    ...withAxes,
    info,
    ...size,
    beams: withAxes.beams ?? [],
  });
}

/**
 * Đổi số lượng trục theo phương và đồng bộ dầm trên tim trục đó.
 * - Trục X → dầm đứng (direction Y) tại từng tim trục X
 * - Trục Y → dầm ngang (direction X) tại từng tim trục Y
 * Dầm phương còn lại giữ nguyên; tái dùng tên/kích thước dầm cũ theo thứ tự.
 */
export function applyAxisCount(
  project: SlabProject,
  dir: "X" | "Y",
  count: number,
): SlabProject {
  const n = Math.max(2, Math.floor(count) || 2);
  const nextAxes =
    dir === "X"
      ? {
          axesX: setAxisCount(project.axesX ?? [], n, project.planWidth || 6000, "X"),
          axesY: project.axesY,
        }
      : {
          axesX: project.axesX,
          axesY: setAxisCount(project.axesY ?? [], n, project.planHeight || 4500, "Y"),
        };
  const withAxes = applyAxesToProject({ ...project, ...nextAxes });
  const axesX = sortAxes(withAxes.axesX ?? []);
  const axesY = sortAxes(withAxes.axesY ?? []);
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  const { B, H, B1 } = beamDims(withAxes.info);
  const defaultSize = formatBeamSize(B, H);
  const prefix = withAxes.info.beamNamePrefix || "D";

  const beamDir: PlanBeam["direction"] = dir === "X" ? "Y" : "X";
  const axes = dir === "X" ? axesX : axesY;
  const existing = (withAxes.beams ?? [])
    .filter((b) => b.direction === beamDir)
    .sort((a, b) => a.axis - b.axis);
  const keptOther = (withAxes.beams ?? [])
    .filter((b) => b.direction !== beamDir)
    .map((b) => ({
      ...b,
      start: 0,
      end: b.direction === "Y" ? Hplan : W,
    }));

  const usedNames = new Set(keptOther.map((b) => b.name).filter(Boolean));
  let nameIdx = 1;
  const nextName = (preferred?: string) => {
    if (preferred && preferred.trim() && !usedNames.has(preferred)) {
      usedNames.add(preferred);
      return preferred;
    }
    let name = `${prefix}${nameIdx++}`;
    while (usedNames.has(name)) name = `${prefix}${nameIdx++}`;
    usedNames.add(name);
    return name;
  };

  const synced: PlanBeam[] = axes.map((ax, i) => {
    const prev = existing[i];
    const dims = prev ? parseSize(prev.size) : { b: B, h: H };
    const bw = dims.b;
    return {
      id: prev?.id ?? uid("beam"),
      name: nextName(prev?.name),
      size: prev ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: beamDir,
      axis: ax.pos,
      axisId: ax.id,
      start: 0,
      end: beamDir === "Y" ? Hplan : W,
      offset: beamOffsetForAxisIndex(bw, i, axes.length),
    };
  });

  const beams = dir === "X" ? [...synced, ...keptOther] : [...keptOther, ...synced];
  return {
    ...withAxes,
    beams,
    info: syncBeamInfo({
      ...withAxes.info,
      beamCountX: beams.filter((b) => b.direction === "Y").length,
      beamCountY: beams.filter((b) => b.direction === "X").length,
    }),
  };
}

/** Tạo dầm mới theo phương (Y = dầm đứng / theo trục X). */
export function createBeam(
  project: SlabProject,
  direction: PlanBeam["direction"],
  axisPos: number,
  index: number,
): PlanBeam {
  const { B, H } = beamDims(project.info);
  const prefix = project.info.beamNamePrefix || "D";
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  const axes = direction === "Y" ? axesX : axesY;
  let axisIdx = axes.findIndex((a) => Math.abs(a.pos - axisPos) < 0.5);
  if (axisIdx < 0 && axes.length) {
    axisIdx = 0;
    let best = Math.abs(axes[0].pos - axisPos);
    for (let i = 1; i < axes.length; i++) {
      const d = Math.abs(axes[i].pos - axisPos);
      if (d < best) {
        best = d;
        axisIdx = i;
      }
    }
  }
  const axis = axisIdx >= 0 ? axes[axisIdx] : undefined;
  return {
    id: uid("beam"),
    name: `${prefix}${index}`,
    size: formatBeamSize(B, H),
    direction,
    axis: axis?.pos ?? axisPos,
    axisId: axis?.id,
    start: 0,
    end: direction === "Y" ? Hplan : W,
    offset: beamOffsetForAxisIndex(B, Math.max(0, axisIdx), Math.max(1, axes.length)),
  };
}

/**
 * Đổi số lượng dầm theo phương — không thêm/bớt trục.
 * Phương X (UI): dầm đứng (direction Y). Phương Y: dầm ngang (direction X).
 */
export function applyBeamCounts(
  project: SlabProject,
  countX?: number,
  countY?: number,
): SlabProject {
  const base = ensureAxes(project);
  const cx = Math.max(0, Math.round(countX ?? base.info.beamCountX ?? 0));
  const cy = Math.max(0, Math.round(countY ?? base.info.beamCountY ?? 0));
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(base.axesX, base.axesY);
  const { B, H, B1 } = beamDims(base.info);
  const size = formatBeamSize(B, H);
  const prefix = base.info.beamNamePrefix || "D";

  const existingY = (base.beams ?? [])
    .filter((b) => b.direction === "Y")
    .sort((a, b) => a.axis - b.axis);
  const existingX = (base.beams ?? [])
    .filter((b) => b.direction === "X")
    .sort((a, b) => a.axis - b.axis);

  const place = (n: number, i: number, total: number) =>
    n <= 1 ? Math.round(total / 2) : Math.round((total * i) / (n - 1));

  const nextY: PlanBeam[] = [];
  for (let i = 0; i < cx; i++) {
    const axisPos = place(cx, i, W);
    const prev = existingY[i];
    if (prev) {
      nextY.push({ ...prev, axis: axisPos, start: 0, end: Hplan });
    } else {
      nextY.push({
        id: uid("beam"),
        name: `${prefix}${nextY.length + existingX.length + 1}`,
        size,
        direction: "Y",
        axis: axisPos,
        start: 0,
        end: Hplan,
        offset: B1,
      });
    }
  }

  const nextX: PlanBeam[] = [];
  for (let i = 0; i < cy; i++) {
    const axisPos = place(cy, i, Hplan);
    const prev = existingX[i];
    if (prev) {
      nextX.push({ ...prev, axis: axisPos, start: 0, end: W });
    } else {
      nextX.push({
        id: uid("beam"),
        name: `${prefix}${nextY.length + nextX.length + 1}`,
        size,
        direction: "X",
        axis: axisPos,
        start: 0,
        end: W,
        offset: B1,
      });
    }
  }

  // Đánh lại tên nếu trùng / thiếu
  const beams = [...nextY, ...nextX].map((b, i) => ({
    ...b,
    name: b.name?.trim() ? b.name : `${prefix}${i + 1}`,
  }));

  return {
    ...base,
    info: syncBeamInfo({ ...base.info, beamCountX: cx, beamCountY: cy }),
    beams,
  };
}

/** Chèn thêm trục X — không thêm dầm. */
export function insertSlabBayX(project: SlabProject, spanMm = 3000): SlabProject {
  const base = ensureAxes(project);
  const axesX = sortAxes(base.axesX);
  const last = axesX[axesX.length - 1];
  const nextX = [
    ...axesX,
    {
      id: uid("ax"),
      name: nextAxisNameX(axesX),
      pos: (last?.pos ?? 0) + Math.max(500, spanMm),
    },
  ];
  return applyAxesToProject({ ...base, axesX: nextX });
}

/** Chèn thêm trục Y — không thêm dầm. */
export function insertSlabBayY(project: SlabProject, spanMm = 3000): SlabProject {
  const base = ensureAxes(project);
  const axesY = sortAxes(base.axesY);
  const last = axesY[axesY.length - 1];
  const nextY = [
    ...axesY,
    {
      id: uid("ay"),
      name: nextAxisNameY(axesY),
      pos: (last?.pos ?? 0) + Math.max(500, spanMm),
    },
  ];
  return applyAxesToProject({ ...base, axesY: nextY });
}

/** Phạm vi vẽ dầm theo chiều dài: kéo đầu tới da dầm ngược phương nếu có. */
export function beamDrawRange(
  project: SlabProject,
  beam: PlanBeam,
): { lo: number; hi: number } {
  let lo = Math.min(beam.start, beam.end);
  let hi = Math.max(beam.start, beam.end);
  const perp = (project.beams ?? []).filter((b) => b.direction !== beam.direction);
  for (const p of perp) {
    const pLo = Math.min(p.start, p.end);
    const pHi = Math.max(p.start, p.end);
    if (beam.axis < pLo - 1 || beam.axis > pHi + 1) continue;
    const { b: bw } = parseSize(p.size);
    const b1 = Number.isFinite(p.offset) ? (p.offset as number) : bw / 2;
    const faces = beamOuterFaces(p.axis, { bw, b1 });
    const half = Math.max(faces.hi - faces.lo, bw) / 2 + 80;
    if (Math.abs(p.axis - lo) <= half) lo = Math.min(lo, faces.lo);
    if (Math.abs(p.axis - hi) <= half) hi = Math.max(hi, faces.hi);
  }
  return { lo, hi };
}

/** Một đoạn dầm giữa hai trục vuông góc liên tiếp. */
export type BeamSegment = {
  index: number;
  /** Đầu / cuối vẽ (da dầm giao). */
  lo: number;
  hi: number;
  /** Nhịp tim giữa hai trục (mm). */
  span: number;
  /** Chỉ số trục xa hơn trong mảng trục vuông góc (để setAxisSpan). */
  spanAxisIndex: number;
  a0: GridAxis;
  a1: GridAxis;
};

/**
 * Chia dầm thành các đoạn giữa các trục vuông góc nằm trên thanh.
 * Chọn / tô sáng / sửa L theo từng đoạn, không lấy cả đầu→cuối.
 */
export function beamSegments(project: SlabProject, beam: PlanBeam): BeamSegment[] {
  const bLo = Math.min(beam.start, beam.end);
  const bHi = Math.max(beam.start, beam.end);
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);

  if (beam.direction === "Y") {
    const crosses = axesY
      .map((a, fullIndex) => ({ a, fullIndex }))
      .filter(({ a }) => a.pos >= bLo - 0.5 && a.pos <= bHi + 0.5);
    const out: BeamSegment[] = [];
    for (let i = 0; i < crosses.length - 1; i++) {
      const a0 = crosses[i].a;
      const a1 = crosses[i + 1].a;
      const { yLo, yHi } = verticalBeamSegExtent(project, a0.pos, a1.pos, axesY);
      out.push({
        index: i,
        lo: yLo,
        hi: yHi,
        span: a1.pos - a0.pos,
        spanAxisIndex: crosses[i + 1].fullIndex,
        a0,
        a1,
      });
    }
    return out;
  }

  const crosses = axesX
    .map((a, fullIndex) => ({ a, fullIndex }))
    .filter(({ a }) => a.pos >= bLo - 0.5 && a.pos <= bHi + 0.5);
  const out: BeamSegment[] = [];
  for (let i = 0; i < crosses.length - 1; i++) {
    const a0 = crosses[i].a;
    const a1 = crosses[i + 1].a;
    const { xLo, xHi } = horizontalBeamSegExtent(project, a0.pos, a1.pos, axesX);
    out.push({
      index: i,
      lo: xLo,
      hi: xHi,
      span: a1.pos - a0.pos,
      spanAxisIndex: crosses[i + 1].fullIndex,
      a0,
      a1,
    });
  }
  return out;
}

/** Thêm một dầm theo phương (không thêm trục). */
export function addBeam(
  project: SlabProject,
  direction: PlanBeam["direction"],
): SlabProject {
  const base = ensureAxes(project);
  const beams = [...(base.beams ?? [])];
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(base.axesX, base.axesY);
  const same = beams.filter((b) => b.direction === direction);
  const axisPos =
    direction === "Y"
      ? Math.round(W / 2 + same.length * 300)
      : Math.round(Hplan / 2 + same.length * 300);
  const beam = createBeam(base, direction, axisPos, beams.length + 1);
  beams.push(beam);
  const beamCountX = beams.filter((b) => b.direction === "Y").length;
  const beamCountY = beams.filter((b) => b.direction === "X").length;
  return {
    ...base,
    beams,
    info: syncBeamInfo({ ...base.info, beamCountX, beamCountY }),
  };
}

/** Xóa dầm theo id (không xóa trục). */
export function removeBeam(project: SlabProject, beamId: string): SlabProject {
  const beams = (project.beams ?? []).filter((b) => b.id !== beamId);
  return {
    ...project,
    beams,
    info: syncBeamInfo({
      ...project.info,
      beamCountX: beams.filter((b) => b.direction === "Y").length,
      beamCountY: beams.filter((b) => b.direction === "X").length,
    }),
  };
}

/** Cập nhật một dầm theo id. */
export function patchBeam(
  project: SlabProject,
  beamId: string,
  patch: Partial<PlanBeam>,
): SlabProject {
  const beams = (project.beams ?? []).map((b) => (b.id === beamId ? { ...b, ...patch } : b));
  return { ...project, beams };
}

/**
 * Đổi bề rộng / chiều dài sàn: giữ số trục & số dầm, chia đều vị trí theo kích thước mới.
 * - Đổi bề rộng → chia đều trục X + dầm đứng (Y) trên 0…W; kéo dài dầm ngang full W
 * - Đổi chiều dài → chia đều trục Y + dầm ngang (X) trên 0…H; kéo dài dầm đứng full H
 * Chỉ tái bố trí phương đang đổi (giữ nhịp lệch của phương kia).
 */
export function setPlanSize(
  project: SlabProject,
  widthMm: number,
  heightMm: number,
): SlabProject {
  const prevW = project.planWidth || 0;
  const prevH = project.planHeight || 0;
  const W = Math.max(500, Math.round(widthMm) || 500);
  const H = Math.max(500, Math.round(heightMm) || 500);
  const widthChanged = W !== prevW;
  const heightChanged = H !== prevH;
  if (!widthChanged && !heightChanged) return project;

  const axesX = widthChanged
    ? setAxisCount(project.axesX ?? [], project.axesX?.length ?? 2, W, "X")
    : sortAxes(project.axesX ?? []);
  const axesY = heightChanged
    ? setAxisCount(project.axesY ?? [], project.axesY?.length ?? 2, H, "Y")
    : sortAxes(project.axesY ?? []);

  const beamsY = (project.beams ?? [])
    .filter((b) => b.direction === "Y")
    .sort((a, b) => a.axis - b.axis);
  const beamsX = (project.beams ?? [])
    .filter((b) => b.direction === "X")
    .sort((a, b) => a.axis - b.axis);

  const place = (n: number, i: number, total: number) =>
    n <= 1 ? Math.round(total / 2) : Math.round((total * i) / (n - 1));

  const yPos = new Map(
    beamsY.map((b, i) => [
      b.id,
      {
        ...b,
        axis: widthChanged ? place(beamsY.length, i, W) : b.axis,
        start: 0,
        end: H,
      },
    ]),
  );
  const xPos = new Map(
    beamsX.map((b, i) => [
      b.id,
      {
        ...b,
        axis: heightChanged ? place(beamsX.length, i, H) : b.axis,
        start: 0,
        end: W,
      },
    ]),
  );

  const beams = (project.beams ?? []).map((b) =>
    b.direction === "Y" ? (yPos.get(b.id) ?? b) : (xPos.get(b.id) ?? b),
  );

  return {
    ...project,
    planWidth: W,
    planHeight: H,
    axesX,
    axesY,
    beams,
  };
}
