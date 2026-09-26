import type {
  BeamSegShift,
  BeamTypeDef,
  GridAxis,
  PlanBeam,
  RebarZone,
  SlabInfo,
  SlabProject,
} from "./types";
import { uid } from "./utils";

/** Thụt thép sàn khỏi da dầm (fallback nếu cover chưa có). */
export const SLAB_REBAR_FACE_INSET_MM = 50;

/** Lớp bảo vệ (mm) — khoảng hở đầu thép so với da dầm = Dày lớp bảo vệ. */
export function slabCoverMm(project: SlabProject): number {
  const c = Number(project.info?.cover);
  if (Number.isFinite(c) && c >= 0) return Math.round(c);
  const fromZones = (project.zones ?? [])
    .map((z) => Number(z.cover))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (fromZones.length) return Math.round(Math.max(...fromZones));
  return SLAB_REBAR_FACE_INSET_MM;
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
    (b) =>
      !b.free &&
      (b.axisId === axis.id || (b.direction === beamDir && Math.abs(b.axis - axis.pos) < 0.5)),
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

/** Dịch đoạn dầm (mặc định 0). */
export function getBeamSegShift(beam: PlanBeam, segIndex: number): BeamSegShift {
  const raw = beam.segShifts?.[segIndex];
  const s0 = Number(raw?.s0);
  const s1 = Number(raw?.s1);
  return {
    s0: Number.isFinite(s0) ? s0 : 0,
    s1: Number.isFinite(s1) ? s1 : 0,
  };
}

/** Mặt bên đoạn dầm sau khi cộng B1 + dịch (có thể xéo: mặt đầu ≠ mặt cuối). */
export function beamSegSideFaces(
  beam: PlanBeam,
  segIndex: number,
): { lo0: number; hi0: number; lo1: number; hi1: number } {
  const { b: bw } = parseSizeStr(beam.size);
  const b1 = Number.isFinite(beam.offset) ? (beam.offset as number) : bw / 2;
  const { s0, s1 } = getBeamSegShift(beam, segIndex);
  const lo0 = beam.axis - b1 + s0;
  const lo1 = beam.axis - b1 + s1;
  return { lo0, hi0: lo0 + bw, lo1, hi1: lo1 + bw };
}

/** Tim mặt bên trung bình đoạn (dùng cho ô sàn chữ nhật). */
export function beamSegAvgOuterFaces(
  beam: PlanBeam,
  segIndex: number,
): { lo: number; hi: number } {
  const f = beamSegSideFaces(beam, segIndex);
  return { lo: (f.lo0 + f.lo1) / 2, hi: (f.hi0 + f.hi1) / 2 };
}

/** Ghi dịch đoạn dầm đang chọn (song song hoặc từng đầu — dầm xéo). */
export function patchBeamSegShift(
  project: SlabProject,
  beamId: string,
  segIndex: number,
  patch: { shift?: number; s0?: number; s1?: number },
): SlabProject {
  const beams = (project.beams ?? []).map((b) => {
    if (b.id !== beamId) return b;
    const segs = beamSegments(project, b);
    const n = Math.max(segs.length, segIndex + 1, b.segShifts?.length ?? 0);
    const next: BeamSegShift[] = Array.from({ length: n }, (_, i) => getBeamSegShift(b, i));
    const cur = next[segIndex] ?? { s0: 0, s1: 0 };
    if (patch.shift !== undefined) {
      const v = Math.round(Number(patch.shift) || 0);
      next[segIndex] = { s0: v, s1: v };
    } else {
      next[segIndex] = {
        s0: patch.s0 !== undefined ? Math.round(Number(patch.s0) || 0) : cur.s0,
        s1: patch.s1 !== undefined ? Math.round(Number(patch.s1) || 0) : cur.s1,
      };
    }
    return { ...b, segShifts: next };
  });
  return { ...project, beams };
}

/**
 * Áp dịch cho các đoạn đã chọn: `shift` = song song từng đoạn;
 * `s0`/`s1` = cả dải đoạn (min→max index trên mỗi thanh) thành **một đường xéo thẳng**
 * (nội suy tuyến tính theo tim trục), không phải mỗi đoạn tự s0/s1 riêng.
 */
export function patchBeamSelectedSegShiftsContinuous(
  project: SlabProject,
  selections: Array<{ beamId: string; segIndex: number }>,
  patch: { shift?: number; s0?: number; s1?: number },
): SlabProject {
  if (selections.length === 0) return project;

  // Nhóm chỉ số đoạn theo thanh
  const byBeam = new Map<string, number[]>();
  for (const s of selections) {
    const list = byBeam.get(s.beamId) ?? [];
    list.push(s.segIndex);
    byBeam.set(s.beamId, list);
  }

  const beams = (project.beams ?? []).map((b) => {
    const rawIdx = byBeam.get(b.id);
    if (!rawIdx || rawIdx.length === 0) return b;
    const segs = beamSegments(project, b);
    if (segs.length === 0) return b;

    const sorted = [...new Set(rawIdx.map((i) => Math.max(0, Math.floor(i))))].sort((a, c) => a - c);
    const iMin = Math.max(0, sorted[0]);
    const iMax = Math.min(segs.length - 1, sorted[sorted.length - 1]);
    // Lấy cả dải liên tục giữa đoạn đầu–cuối đã chọn để khớp tại trục giữa
    const from = iMin;
    const to = iMax;
    const n = Math.max(segs.length, to + 1, b.segShifts?.length ?? 0);
    const next: BeamSegShift[] = Array.from({ length: n }, (_, i) => getBeamSegShift(b, i));

    if (patch.shift !== undefined) {
      const v = Math.round(Number(patch.shift) || 0);
      for (let i = from; i <= to; i++) next[i] = { s0: v, s1: v };
      return { ...b, segShifts: next };
    }

    const first = segs[from];
    const last = segs[to];
    if (!first || !last) return b;
    const pos0 = first.a0.pos;
    const pos1 = last.a1.pos;
    const span = pos1 - pos0;
    const startShift =
      patch.s0 !== undefined ? Math.round(Number(patch.s0) || 0) : getBeamSegShift(b, from).s0;
    const endShift =
      patch.s1 !== undefined ? Math.round(Number(patch.s1) || 0) : getBeamSegShift(b, to).s1;

    const lerpAt = (pos: number) => {
      if (Math.abs(span) < 1e-6) return startShift;
      const t = (pos - pos0) / span;
      const u = Math.min(1, Math.max(0, t));
      return Math.round(startShift + (endShift - startShift) * u);
    };

    for (let i = from; i <= to; i++) {
      const seg = segs[i];
      if (!seg) continue;
      next[i] = { s0: lerpAt(seg.a0.pos), s1: lerpAt(seg.a1.pos) };
    }
    return { ...b, segShifts: next };
  });

  return { ...project, beams };
}

/**
 * Áp dịch cho mọi đoạn của một (hoặc nhiều) thanh dầm — dùng khi Shift chọn nhiều.
 * `shift` = song song cả thanh; `s0`/`s1` = một đường xéo thẳng suốt thanh (không từng đoạn riêng).
 */
export function patchBeamAllSegShifts(
  project: SlabProject,
  beamIds: string | string[],
  patch: { shift?: number; s0?: number; s1?: number },
): SlabProject {
  const ids = Array.isArray(beamIds) ? beamIds : [beamIds];
  if (ids.length === 0) return project;
  const selections: Array<{ beamId: string; segIndex: number }> = [];
  for (const id of ids) {
    const beam = (project.beams ?? []).find((b) => b.id === id);
    if (!beam) continue;
    const segs = beamSegments(project, beam);
    for (let i = 0; i < Math.max(segs.length, 1); i++) {
      selections.push({ beamId: id, segIndex: i });
    }
  }
  return patchBeamSelectedSegShiftsContinuous(project, selections, patch);
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
    .filter((b) => b.direction === "Y" && !b.free)
    .slice()
    .sort((a, b) => a.axis - b.axis || a.name.localeCompare(b.name));
  const peersX = (project.beams ?? [])
    .filter((b) => b.direction === "X" && !b.free)
    .slice()
    .sort((a, b) => a.axis - b.axis || a.name.localeCompare(b.name));

  const beams = (project.beams ?? []).map((b) => {
    if (b.free) {
      // Dầm chèn giữa ô: giữ tim / B1, chỉ khớp đầu–cuối với khổ mặt bằng
      return {
        ...b,
        axisId: undefined,
        free: true,
        start: 0,
        end: b.direction === "Y" ? Hplan : W,
        segShifts: b.segShifts,
        omitSegKeys: b.omitSegKeys,
      };
    }
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
        segShifts: b.segShifts,
        omitSegKeys: b.omitSegKeys,
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
      segShifts: b.segShifts,
      omitSegKeys: b.omitSegKeys,
    };
  });

  return { ...project, beams };
}

/**
 * Mặt ngoài dầm tại tọa độ dọc theo thanh — nội suy dịch/xéo theo trục giao.
 * Không gọi beamSegments (tránh vòng lặp khi tính lo/hi đoạn).
 */
export function beamFacesAtAlongDirect(
  beam: PlanBeam,
  alongMm: number,
  perpAxes: GridAxis[],
): { lo: number; hi: number } {
  const sorted = sortAxes(perpAxes);
  const bLo = Math.min(beam.start, beam.end);
  const bHi = Math.max(beam.start, beam.end);
  const crosses = sorted.filter((a) => a.pos >= bLo - 0.5 && a.pos <= bHi + 0.5);
  if (crosses.length < 2) {
    const { b: bw } = parseSizeStr(beam.size);
    const b1 = Number.isFinite(beam.offset) ? (beam.offset as number) : bw / 2;
    const { s0, s1 } = getBeamSegShift(beam, 0);
    const mid = (s0 + s1) / 2;
    const lo = beam.axis - b1 + mid;
    return { lo, hi: lo + bw };
  }
  let segIndex = 0;
  for (let i = 0; i < crosses.length - 1; i++) {
    const mid = (crosses[i].pos + crosses[i + 1].pos) / 2;
    if (alongMm < mid) {
      segIndex = i;
      break;
    }
    segIndex = i;
  }
  const a0 = crosses[segIndex];
  const a1 = crosses[segIndex + 1];
  return beamSegFacesAtAlong(beam, segIndex, alongMm, a0.pos, a1.pos);
}

/**
 * Da dầm trên một trục tại vị trí dọc theo dầm ngược phương (tính lệch/xéo).
 * Không có dầm trên trục → bề dày 0 tại tim trục.
 */
export function axisBeamFacesAtAlong(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axis: GridAxis,
  alongMm: number,
): { lo: number; hi: number } {
  const beam = findBeamOnAxis(project, beamDir, axis);
  if (!beam) return { lo: axis.pos, hi: axis.pos };
  const perp = sortAxes(beamDir === "Y" ? project.axesY ?? [] : project.axesX ?? []);
  return beamFacesAtAlongDirect(beam, alongMm, perp);
}

/** Đoạn dầm đứng (phương Y): kéo đầu đến da dầm ngang tại hai đầu (theo lệch/xéo tại tim X). */
export function verticalBeamSegExtent(
  project: SlabProject,
  y0: number,
  y1: number,
  axesY: GridAxis[],
  alongXMm?: number,
): { yLo: number; yHi: number } {
  const loAxis = Math.min(y0, y1);
  const hiAxis = Math.max(y0, y1);
  const aLo = axesY.find((a) => Math.abs(a.pos - loAxis) < 0.5) ?? { id: "", name: "", pos: loAxis };
  const aHi = axesY.find((a) => Math.abs(a.pos - hiAxis) < 0.5) ?? { id: "", name: "", pos: hiAxis };
  const along = Number.isFinite(alongXMm) ? (alongXMm as number) : (loAxis + hiAxis) / 2;
  const faceLo = axisBeamFacesAtAlong(project, "X", aLo, along);
  const faceHi = axisBeamFacesAtAlong(project, "X", aHi, along);
  return { yLo: faceLo.lo, yHi: faceHi.hi };
}

/** Đoạn dầm ngang (phương X): kéo đầu đến da dầm đứng tại hai đầu (theo lệch/xéo tại tim Y). */
export function horizontalBeamSegExtent(
  project: SlabProject,
  x0: number,
  x1: number,
  axesX: GridAxis[],
  alongYMm?: number,
): { xLo: number; xHi: number } {
  const loAxis = Math.min(x0, x1);
  const hiAxis = Math.max(x0, x1);
  const aLo = axesX.find((a) => Math.abs(a.pos - loAxis) < 0.5) ?? { id: "", name: "", pos: loAxis };
  const aHi = axesX.find((a) => Math.abs(a.pos - hiAxis) < 0.5) ?? { id: "", name: "", pos: hiAxis };
  const along = Number.isFinite(alongYMm) ? (alongYMm as number) : (loAxis + hiAxis) / 2;
  const faceLo = axisBeamFacesAtAlong(project, "Y", aLo, along);
  const faceHi = axisBeamFacesAtAlong(project, "Y", aHi, along);
  return { xLo: faceLo.lo, xHi: faceHi.hi };
}

/** Trừ các khoảng cắt khỏi [from, to] → các đoạn còn lại (mm). */
export function subtractIntervals(
  from: number,
  to: number,
  cuts: Array<{ lo: number; hi: number }>,
): Array<[number, number]> {
  let parts: Array<[number, number]> = [[Math.min(from, to), Math.max(from, to)]];
  const sorted = [...cuts].sort((a, b) => a.lo - b.lo);
  for (const c of sorted) {
    const next: Array<[number, number]> = [];
    for (const [a, b] of parts) {
      const clo = Math.max(a, c.lo);
      const chi = Math.min(b, c.hi);
      if (clo >= chi - 0.5) {
        next.push([a, b]);
        continue;
      }
      if (a < clo - 0.5) next.push([a, clo]);
      if (chi < b - 0.5) next.push([chi, b]);
    }
    parts = next;
  }
  return parts.filter(([a, b]) => b - a > 2);
}

/**
 * Khoảng dọc theo dầm cần cắt (thân dầm giao phương xuyên qua).
 * beam Y (đứng): cuts theo Y tại faceX; beam X (ngang): cuts theo X tại faceY.
 */
export function crossBodyCutsAlong(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  face0: number,
  face1: number,
  along0: number,
  along1: number,
): Array<{ lo: number; hi: number }> {
  const cuts: Array<{ lo: number; hi: number }> = [];
  const faceLo = Math.min(face0, face1);
  const faceHi = Math.max(face0, face1);
  const aLo = Math.min(along0, along1);
  const aHi = Math.max(along0, along1);
  const faceMid = (face0 + face1) / 2;
  const crossDir: PlanBeam["direction"] = beamDir === "Y" ? "X" : "Y";
  const perpAxes =
    crossDir === "X" ? sortAxes(project.axesX ?? []) : sortAxes(project.axesY ?? []);

  for (const other of project.beams ?? []) {
    if (other.direction !== crossDir) continue;
    for (const seg of beamSegments(project, other)) {
      if (isBeamSegOmitted(other, seg.a0.id, seg.a1.id)) continue;
      const s0 = Math.min(seg.lo, seg.hi);
      const s1 = Math.max(seg.lo, seg.hi);
      if (faceHi < s0 - 2 || faceLo > s1 + 2) continue;
      const alongOnOther = Math.min(s1, Math.max(s0, faceMid));
      const body = beamFacesAtAlongDirect(other, alongOnOther, perpAxes);
      if (body.hi - body.lo < 1) continue;
      if (body.hi < aLo - 2 || body.lo > aHi + 2) continue;
      cuts.push({ lo: body.lo, hi: body.hi });
    }
  }
  return cuts;
}

export type BeamFaceStrokeStyle = "solid" | "dashed";

/**
 * Các đoạn nét da dầm đã cắt chỗ giao thân (giống PDF).
 * Y-beam: face = X, along = Y; X-beam: face = Y, along = X.
 */
export function clippedBeamFaceParts(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  face0: number,
  face1: number,
  along0: number,
  along1: number,
): Array<{ faceA: number; faceB: number; alongA: number; alongB: number }> {
  const cuts = crossBodyCutsAlong(project, beamDir, face0, face1, along0, along1);
  const parts = subtractIntervals(along0, along1, cuts);
  const span = along1 - along0;
  if (Math.abs(span) < 1e-6) return [];
  return parts.map(([a0, a1]) => {
    const t0 = (a0 - along0) / span;
    const t1 = (a1 - along0) / span;
    return {
      faceA: face0 + t0 * (face1 - face0),
      faceB: face0 + t1 * (face1 - face0),
      alongA: a0,
      alongB: a1,
    };
  });
}

/**
 * Da dầm biên ngoài cùng (trùng bleed) → nét liền (không sàn che phía ngoài);
 * da trong hướng vào ô sàn → nét đứt.
 */
export function beamFaceDashStyle(
  beamDir: PlanBeam["direction"],
  face0: number,
  face1: number,
  bleed: { xMin: number; xMax: number; yMin: number; yMax: number },
  epsMm = 2,
): BeamFaceStrokeStyle {
  const mid = (face0 + face1) / 2;
  if (beamDir === "Y") {
    if (Math.abs(mid - bleed.xMin) <= epsMm || Math.abs(mid - bleed.xMax) <= epsMm) return "solid";
  } else if (Math.abs(mid - bleed.yMin) <= epsMm || Math.abs(mid - bleed.yMax) <= epsMm) {
    return "solid";
  }
  return "dashed";
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

/** Hình chữ nhật cắt thép: ô thủng + sàn thấp chế độ cắt (mí da — nới thêm cover khi cắt). */
export function rebarCutRects(
  project: SlabProject,
): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const out: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const o of project.openings ?? []) {
    out.push({ x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h });
  }
  for (const o of project.lowSlabs ?? []) {
    if ((o.rebarMode ?? "press") !== "cut") continue;
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
 * Thép ô sàn: từ da dầm biên trừ lớp BV; cắt tại ô thủng / sàn thấp chế độ cắt.
 * Sàn thấp nhấn: thép như sàn thường. Mỗi ô: 1 cây X + 1 cây Y (có thể tách đoạn).
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

/** Loại ô: sàn thường / ô thủng / sàn thấp. */
export function bayKindAt(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  ix: number,
  iy: number,
): "normal" | "opening" | "low" {
  const { x0, x1, y0, y1 } = baySlabExtent(project, axesX, axesY, ix, iy);
  if ((project.openings ?? []).some((o) => rectNearlyEquals(o, x0, y0, x1, y1))) return "opening";
  if ((project.lowSlabs ?? []).some((o) => rectNearlyEquals(o, x0, y0, x1, y1))) return "low";
  return "normal";
}

/** Ô còn bố trí thép liên tục: sàn thường, hoặc sàn thấp chế độ nhấn (không cắt). */
export function bayHasSlabRebar(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  ix: number,
  iy: number,
): boolean {
  const kind = bayKindAt(project, axesX, axesY, ix, iy);
  if (kind === "opening") return false;
  if (kind === "low") {
    const { x0, x1, y0, y1 } = baySlabExtent(project, axesX, axesY, ix, iy);
    const ls = (project.lowSlabs ?? []).find((o) => rectNearlyEquals(o, x0, y0, x1, y1));
    return (ls?.rebarMode ?? "press") !== "cut";
  }
  return true;
}

/**
 * Dầm độc lập: cả hai bên đều không còn thép sàn liên tục (ô thủng / sàn thấp cắt)
 * → không bố trí thép trên thân dầm.
 * Sàn thấp nhấn coi như sàn thường. Dầm tiếp giáp ô cắt một bên vẫn có thép
 * trên thân dầm (cắt tại mí da − lớp BV).
 */
export function independentBeamGaps(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  along: "X" | "Y",
  stripIndex: number,
): Array<{ lo: number; hi: number }> {
  const gaps: Array<{ lo: number; hi: number }> = [];
  if (along === "X") {
    const iy = stripIndex;
    for (let ix = 0; ix < axesX.length - 2; ix++) {
      if (
        bayHasSlabRebar(project, axesX, axesY, ix, iy) ||
        bayHasSlabRebar(project, axesX, axesY, ix + 1, iy)
      ) {
        continue;
      }
      const a = baySlabExtent(project, axesX, axesY, ix, iy);
      const b = baySlabExtent(project, axesX, axesY, ix + 1, iy);
      if (b.x0 > a.x1 + 0.5) gaps.push({ lo: a.x1, hi: b.x0 });
    }
  } else {
    const ix = stripIndex;
    for (let iy = 0; iy < axesY.length - 2; iy++) {
      if (
        bayHasSlabRebar(project, axesX, axesY, ix, iy) ||
        bayHasSlabRebar(project, axesX, axesY, ix, iy + 1)
      ) {
        continue;
      }
      const a = baySlabExtent(project, axesX, axesY, ix, iy);
      const b = baySlabExtent(project, axesX, axesY, ix, iy + 1);
      if (b.y0 > a.y1 + 0.5) gaps.push({ lo: a.y1, hi: b.y0 });
    }
  }
  return gaps;
}

/** Khoảng lòng ô còn bố trí thép (sàn thường + sàn thấp) trên một hàng/cột. */
export function normalBaySpansAlongStrip(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  along: "X" | "Y",
  stripIndex: number,
): Array<{ lo: number; hi: number }> {
  const spans: Array<{ lo: number; hi: number }> = [];
  if (along === "X") {
    const iy = stripIndex;
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      if (!bayHasSlabRebar(project, axesX, axesY, ix, iy)) continue;
      const e = baySlabExtent(project, axesX, axesY, ix, iy);
      spans.push({ lo: e.x0, hi: e.x1 });
    }
  } else {
    const ix = stripIndex;
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      if (!bayHasSlabRebar(project, axesX, axesY, ix, iy)) continue;
      const e = baySlabExtent(project, axesX, axesY, ix, iy);
      spans.push({ lo: e.y0, hi: e.y1 });
    }
  }
  return spans;
}

/** Giữ đoạn thép còn giao với ít nhất một ô có thép (thường/thấp), kể cả phần kéo sang thân dầm. */
export function keepSegmentsTouchingNormalBays(
  segs: Array<{ lo: number; hi: number }>,
  normalSpans: Array<{ lo: number; hi: number }>,
): Array<{ lo: number; hi: number }> {
  if (normalSpans.length === 0) return [];
  return segs.filter((s) =>
    normalSpans.some((n) => s.hi > n.lo + 0.5 && s.lo < n.hi - 0.5),
  );
}

/** Mọi khe thân dầm trung gian trên hàng/cột (để loại đoạn thép chỉ nằm trên thân dầm). */
export function allIntermediateBeamGaps(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  along: "X" | "Y",
  stripIndex: number,
): Array<{ lo: number; hi: number }> {
  const gaps: Array<{ lo: number; hi: number }> = [];
  if (along === "X") {
    const iy = stripIndex;
    for (let ix = 0; ix < axesX.length - 2; ix++) {
      const a = baySlabExtent(project, axesX, axesY, ix, iy);
      const b = baySlabExtent(project, axesX, axesY, ix + 1, iy);
      if (b.x0 > a.x1 + 0.5) gaps.push({ lo: a.x1, hi: b.x0 });
    }
  } else {
    const ix = stripIndex;
    for (let iy = 0; iy < axesY.length - 2; iy++) {
      const a = baySlabExtent(project, axesX, axesY, ix, iy);
      const b = baySlabExtent(project, axesX, axesY, ix, iy + 1);
      if (b.y0 > a.y1 + 0.5) gaps.push({ lo: a.y1, hi: b.y0 });
    }
  }
  return gaps;
}

/** Bỏ các đoạn nằm trọn trong thân dầm (không kéo thép “trên” dầm độc lập / khe dầm). */
export function dropSegmentsInsideGaps(
  segs: Array<{ lo: number; hi: number }>,
  gaps: Array<{ lo: number; hi: number }>,
): Array<{ lo: number; hi: number }> {
  return segs.filter((s) => {
    const mid = (s.lo + s.hi) / 2;
    // Đoạn ngắn nằm gọn trong một khe dầm
    if (gaps.some((g) => s.lo >= g.lo - 1 && s.hi <= g.hi + 1)) return false;
    // Đoạn chủ yếu nằm trên thân dầm (trung điểm trong khe và dài ≤ bề rộng dầm + cover)
    if (gaps.some((g) => mid > g.lo && mid < g.hi && s.hi - s.lo <= g.hi - g.lo + 2)) return false;
    return true;
  });
}

/** Nới khoảng cắt thêm cover — thép thụt vào khỏi da dầm / mí ô đặc biệt bằng lớp BV. */
export function expandCutsByCover(
  cuts: Array<{ lo: number; hi: number }>,
  coverMm: number,
): Array<{ lo: number; hi: number }> {
  const c = Math.max(0, coverMm);
  return cuts.map((cut) => ({ lo: cut.lo - c, hi: cut.hi + c }));
}

/**
 * Thép liên tục từ dầm biên đầu → dầm biên cuối:
 * điểm đầu/cuối = da dầm ngoài ± lớp bảo vệ (cover), theo đúng vị trí dầm lệch/xéo tại tim thanh.
 * Cắt tại ô thủng / sàn thấp chế độ cắt: mép = mí da ± cover.
 * Sàn thấp nhấn: thép chạy xuyên ô như sàn thường (nhấn tại dầm quanh ô).
 * Không bố trí thép trên dầm độc lập (cả hai bên đều không có thép liên tục).
 */
export function stripRebarBarSegments(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
): RebarBarSeg[] {
  const cover = slabCoverMm(project);
  const cuts = rebarCutRects(project);
  const out: RebarBarSeg[] = [];
  if (axesX.length < 2 || axesY.length < 2) return out;

  const axFirst = axesX[0];
  const axLast = axesX[axesX.length - 1];
  const ayFirst = axesY[0];
  const ayLast = axesY[axesY.length - 1];

  // Thanh ngang (phương X): mỗi hàng ô — đầu/cuối móc theo da dầm biên tại Y = tim thanh
  for (let iy = 0; iy < axesY.length - 1; iy++) {
    let yLo = Infinity;
    let yHi = -Infinity;
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      const slab = baySlabExtent(project, axesX, axesY, ix, iy);
      yLo = Math.min(yLo, slab.y0);
      yHi = Math.max(yHi, slab.y1);
    }
    if (!(yHi > yLo)) continue;
    const my = (yLo + yHi) / 2;
    const leftOuter = beamOuterFacesAtAlong(project, "Y", axFirst, my).lo;
    const rightOuter = beamOuterFacesAtAlong(project, "Y", axLast, my).hi;
    const xBarLo = leftOuter + cover;
    const xBarHi = rightOuter - cover;
    if (!(xBarHi - xBarLo > 1)) continue;
    const bandLo = yLo + 1;
    const bandHi = yHi - 1;
    const obstacleCuts = expandCutsByCover(
      cuts
        .filter((r) => Math.min(r.y1, r.y0) < bandHi && Math.max(r.y1, r.y0) > bandLo)
        .map((r) => ({ lo: Math.min(r.x0, r.x1), hi: Math.max(r.x0, r.x1) })),
      cover,
    );
    // Chỉ cắt hết thân dầm khi cả hai bên đều không có sàn thường
    const indep = independentBeamGaps(project, axesX, axesY, "X", iy);
    const normals = normalBaySpansAlongStrip(project, axesX, axesY, "X", iy);
    const segs = keepSegmentsTouchingNormalBays(
      dropSegmentsInsideGaps(subtract1D(xBarLo, xBarHi, [...obstacleCuts, ...indep]), indep),
      normals,
    );
    for (const s of segs) {
      out.push({ dir: "X", x0: s.lo, x1: s.hi, y: my });
    }
  }

  // Thanh đứng (phương Y): mỗi cột ô — đầu/cuối móc theo da dầm biên tại X = tim thanh
  for (let ix = 0; ix < axesX.length - 1; ix++) {
    let xLo = Infinity;
    let xHi = -Infinity;
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      const slab = baySlabExtent(project, axesX, axesY, ix, iy);
      xLo = Math.min(xLo, slab.x0);
      xHi = Math.max(xHi, slab.x1);
    }
    if (!(xHi > xLo)) continue;
    const mx = (xLo + xHi) / 2;
    const bottomOuter = beamOuterFacesAtAlong(project, "X", ayFirst, mx).lo;
    const topOuter = beamOuterFacesAtAlong(project, "X", ayLast, mx).hi;
    const yBarLo = bottomOuter + cover;
    const yBarHi = topOuter - cover;
    if (!(yBarHi - yBarLo > 1)) continue;
    const bandLo = xLo + 1;
    const bandHi = xHi - 1;
    const obstacleCuts = expandCutsByCover(
      cuts
        .filter((r) => Math.min(r.x1, r.x0) < bandHi && Math.max(r.x1, r.x0) > bandLo)
        .map((r) => ({ lo: Math.min(r.y0, r.y1), hi: Math.max(r.y0, r.y1) })),
      cover,
    );
    const indep = independentBeamGaps(project, axesX, axesY, "Y", ix);
    const normals = normalBaySpansAlongStrip(project, axesX, axesY, "Y", ix);
    const segs = keepSegmentsTouchingNormalBays(
      dropSegmentsInsideGaps(subtract1D(yBarLo, yBarHi, [...obstacleCuts, ...indep]), indep),
      normals,
    );
    for (const s of segs) {
      out.push({ dir: "Y", y0: s.lo, y1: s.hi, x: mx });
    }
  }

  // Sàn thấp chế độ cắt: bố trí thép riêng trong ô + lên thân dầm quanh ô (tách với sàn thường)
  out.push(...cutLowSlabRebarSegments(project, axesX, axesY));
  return out;
}

/**
 * Thép riêng cho từng ô sàn thấp chế độ cắt:
 * chạy trong lòng ô và lên thân dầm biên của ô (da ngoài ± lớp BV).
 * Lệch ½ khoảng rải so với thép sàn thường để không chồng 2 lớp trên thân dầm.
 */
export function cutLowSlabRebarSegments(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
): RebarBarSeg[] {
  const cover = slabCoverMm(project);
  const offset = cutLowRebarOffsetMm(project);
  const out: RebarBarSeg[] = [];
  if (axesX.length < 2 || axesY.length < 2) return out;

  for (const ls of project.lowSlabs ?? []) {
    if ((ls.rebarMode ?? "press") !== "cut") continue;

    let ix = -1;
    let iy = -1;
    for (let j = 0; j < axesY.length - 1 && iy < 0; j++) {
      for (let i = 0; i < axesX.length - 1; i++) {
        const slab = baySlabExtent(project, axesX, axesY, i, j);
        if (rectNearlyEquals(ls, slab.x0, slab.y0, slab.x1, slab.y1)) {
          ix = i;
          iy = j;
          break;
        }
      }
    }
    if (ix < 0 || iy < 0) continue;

    const ax0 = axesX[ix];
    const ax1 = axesX[ix + 1];
    const ay0 = axesY[iy];
    const ay1 = axesY[iy + 1];
    const slab = baySlabExtent(project, axesX, axesY, ix, iy);
    const mx = (slab.x0 + slab.x1) / 2;
    const my = (slab.y0 + slab.y1) / 2;

    // Lệch 1 bên trong lòng ô (tránh trùng vị trí với thép sàn thường trên dầm chung)
    const yBar = clampCutLowOffset(my, offset, slab.y0 + cover, slab.y1 - cover);
    const xBar = clampCutLowOffset(mx, offset, slab.x0 + cover, slab.x1 - cover);

    // Lên thân dầm lệch/xéo: da ngoài tại đúng tim thanh ± lớp BV
    const left = beamOuterFacesAtAlong(project, "Y", ax0, yBar);
    const right = beamOuterFacesAtAlong(project, "Y", ax1, yBar);
    const bottom = beamOuterFacesAtAlong(project, "X", ay0, xBar);
    const top = beamOuterFacesAtAlong(project, "X", ay1, xBar);
    const x0 = left.lo + cover;
    const x1 = right.hi - cover;
    const y0 = bottom.lo + cover;
    const y1 = top.hi - cover;

    if (x1 - x0 > 1) out.push({ dir: "X", x0, x1, y: yBar });
    if (y1 - y0 > 1) out.push({ dir: "Y", y0, y1, x: xBar });
  }
  return out;
}

/** Nửa khoảng rải thép (mm) — dùng để lệch thép sàn thấp cắt. */
export function cutLowRebarOffsetMm(project: SlabProject): number {
  const fromZone = (project.zones ?? []).find((z) => Number(z.spacing) >= 50);
  if (fromZone) return Math.max(40, Math.round(Number(fromZone.spacing) / 2));
  const spec = project.simple2?.bottomSpec ?? project.economy2?.bottomSpec ?? "";
  const m = String(spec).match(/a\s*(\d+)/i);
  if (m) return Math.max(40, Math.round(Number(m[1]) / 2));
  return 75;
}

function clampCutLowOffset(center: number, offset: number, lo: number, hi: number): number {
  if (hi - lo < 2) return center;
  const prefer = center + offset;
  if (prefer >= lo && prefer <= hi) return prefer;
  const other = center - offset;
  if (other >= lo && other <= hi) return other;
  return Math.min(hi, Math.max(lo, prefer));
}

export type RebarPressMark = {
  x: number;
  y: number;
  drop: number;
  /** Phương thanh thép bị nhấn */
  dir: "X" | "Y";
};

/**
 * Điểm nhấn thép tại thân dầm quanh ô sàn thấp chế độ nhấn.
 * Độ nhấn = chênh cao độ sàn thấp (`drop`).
 */
export function stripRebarPressMarks(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
): RebarPressMark[] {
  const bars = stripRebarBarSegments(project, axesX, axesY);
  const marks: RebarPressMark[] = [];
  const eps = 1;

  for (let iy = 0; iy < axesY.length - 1; iy++) {
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      if (bayKindAt(project, axesX, axesY, ix, iy) !== "low") continue;
      const slab = baySlabExtent(project, axesX, axesY, ix, iy);
      const ls = (project.lowSlabs ?? []).find((o) =>
        rectNearlyEquals(o, slab.x0, slab.y0, slab.x1, slab.y1),
      );
      if (!ls || (ls.rebarMode ?? "press") === "cut") continue;
      const drop = Math.max(0, Math.round(Number(ls.drop) || Number(project.info.lowSlabDrop) || 0));
      if (drop <= 0) continue;

      const { x0, x1, y0, y1 } = slab;
      type BeamGap = { lo: number; hi: number; along: "X" | "Y"; mid: number };
      const beams: BeamGap[] = [];

      if (ix > 0) {
        const prev = baySlabExtent(project, axesX, axesY, ix - 1, iy);
        if (x0 > prev.x1 + 0.5) beams.push({ lo: prev.x1, hi: x0, along: "X", mid: (prev.x1 + x0) / 2 });
      } else {
        const faces = beamOuterFacesAtSpan(project, "Y", axesX[0], iy);
        if (x0 > faces.lo + 0.5) beams.push({ lo: faces.lo, hi: x0, along: "X", mid: (faces.lo + x0) / 2 });
      }
      if (ix < axesX.length - 2) {
        const next = baySlabExtent(project, axesX, axesY, ix + 1, iy);
        if (next.x0 > x1 + 0.5) beams.push({ lo: x1, hi: next.x0, along: "X", mid: (x1 + next.x0) / 2 });
      } else {
        const ax = axesX[axesX.length - 1];
        const faces = beamOuterFacesAtSpan(project, "Y", ax, iy);
        if (faces.hi > x1 + 0.5) beams.push({ lo: x1, hi: faces.hi, along: "X", mid: (x1 + faces.hi) / 2 });
      }
      if (iy > 0) {
        const prev = baySlabExtent(project, axesX, axesY, ix, iy - 1);
        if (y0 > prev.y1 + 0.5) beams.push({ lo: prev.y1, hi: y0, along: "Y", mid: (prev.y1 + y0) / 2 });
      } else {
        const faces = beamOuterFacesAtSpan(project, "X", axesY[0], ix);
        if (y0 > faces.lo + 0.5) beams.push({ lo: faces.lo, hi: y0, along: "Y", mid: (faces.lo + y0) / 2 });
      }
      if (iy < axesY.length - 2) {
        const next = baySlabExtent(project, axesX, axesY, ix, iy + 1);
        if (next.y0 > y1 + 0.5) beams.push({ lo: y1, hi: next.y0, along: "Y", mid: (y1 + next.y0) / 2 });
      } else {
        const ay = axesY[axesY.length - 1];
        const faces = beamOuterFacesAtSpan(project, "X", ay, ix);
        if (faces.hi > y1 + 0.5) beams.push({ lo: y1, hi: faces.hi, along: "Y", mid: (y1 + faces.hi) / 2 });
      }

      for (const beam of beams) {
        if (beam.along === "X") {
          for (const bar of bars) {
            if (bar.dir !== "X") continue;
            if (bar.y < y0 - eps || bar.y > y1 + eps) continue;
            if (bar.x0 < beam.mid && bar.x1 > beam.mid) {
              marks.push({ x: beam.mid, y: bar.y, drop, dir: "X" });
            }
          }
        } else {
          for (const bar of bars) {
            if (bar.dir !== "Y") continue;
            if (bar.x < x0 - eps || bar.x > x1 + eps) continue;
            if (bar.y0 < beam.mid && bar.y1 > beam.mid) {
              marks.push({ x: bar.x, y: beam.mid, drop, dir: "Y" });
            }
          }
        }
      }
    }
  }
  return marks;
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
/** Dầm gắn trục (nếu có) — dùng kèm dịch đoạn. */
export function findBeamOnAxis(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axis: GridAxis,
): PlanBeam | undefined {
  return (project.beams ?? []).find(
    (b) =>
      !b.free &&
      b.direction === beamDir &&
      (b.axisId === axis.id || Math.abs(b.axis - axis.pos) < 0.5),
  );
}

/**
 * Mặt ngoài dầm tại một nhịp (có tính dịch đoạn).
 * spanIndex: với dầm đứng = chỉ số ô theo Y; dầm ngang = chỉ số ô theo X.
 * Đoạn đã xóa / không có dầm → bề dày 0 (ô hai bên liền nhau).
 */
export function beamOuterFacesAtSpan(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axis: GridAxis,
  spanIndex: number,
): { lo: number; hi: number } {
  if (!beamCoversOrthogonalSpan(project, beamDir, axis, spanIndex)) {
    return { lo: axis.pos, hi: axis.pos };
  }
  const beam = findBeamOnAxis(project, beamDir, axis)!;
  return beamSegAvgOuterFaces(beam, spanIndex);
}

/** Khóa đoạn dầm giữa hai trục giao. */
export function beamSegKey(a0Id: string, a1Id: string): string {
  return `${a0Id}|${a1Id}`;
}

export function isBeamSegOmitted(beam: PlanBeam, a0Id: string, a1Id: string): boolean {
  const keys = beam.omitSegKeys ?? [];
  if (keys.length === 0) return false;
  return keys.includes(beamSegKey(a0Id, a1Id)) || keys.includes(beamSegKey(a1Id, a0Id));
}

/** Dầm còn thân trên nhịp ô (spanIndex) hay đã bị xóa đoạn? */
export function beamCoversOrthogonalSpan(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axis: GridAxis,
  spanIndex: number,
): boolean {
  const beam = findBeamOnAxis(project, beamDir, axis);
  if (!beam) return false;
  const perp = sortAxes(beamDir === "Y" ? project.axesY ?? [] : project.axesX ?? []);
  const a0 = perp[spanIndex];
  const a1 = perp[spanIndex + 1];
  if (!a0 || !a1) return false;
  const bLo = Math.min(beam.start, beam.end);
  const bHi = Math.max(beam.start, beam.end);
  if (a0.pos < bLo - 0.5 || a1.pos > bHi + 0.5) return false;
  return !isBeamSegOmitted(beam, a0.id, a1.id);
}

/**
 * Nội suy mặt bên đoạn dầm tại vị trí dọc theo đoạn (alongMm giữa seg.lo..seg.hi).
 * Dầm xéo: lo/hi thay đổi tuyến tính từ đầu → cuối.
 */
export function beamSegFacesAtAlong(
  beam: PlanBeam,
  segIndex: number,
  alongMm: number,
  segLo: number,
  segHi: number,
): { lo: number; hi: number } {
  const f = beamSegSideFaces(beam, segIndex);
  const span = segHi - segLo;
  const t = span > 1e-6 ? (alongMm - segLo) / span : 0.5;
  const u = Math.min(1, Math.max(0, t));
  return {
    lo: f.lo0 + (f.lo1 - f.lo0) * u,
    hi: f.hi0 + (f.hi1 - f.hi0) * u,
  };
}

/**
 * Mặt ngoài dầm tại tọa độ dọc theo dầm (mm) — nội suy dịch/xéo đoạn chứa điểm đó.
 * Dầm đứng: alongMm = Y; dầm ngang: alongMm = X.
 */
export function beamOuterFacesAtAlong(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axis: GridAxis,
  alongMm: number,
): { lo: number; hi: number } {
  const beam = findBeamOnAxis(project, beamDir, axis);
  if (!beam) return { lo: axis.pos, hi: axis.pos };
  const perp = sortAxes(beamDir === "Y" ? project.axesY ?? [] : project.axesX ?? []);
  // Tìm đoạn chứa alongMm để tôn trọng omitSegKeys
  const bLo = Math.min(beam.start, beam.end);
  const bHi = Math.max(beam.start, beam.end);
  const crosses = perp.filter((a) => a.pos >= bLo - 0.5 && a.pos <= bHi + 0.5);
  if (crosses.length >= 2) {
    let segIndex = 0;
    for (let i = 0; i < crosses.length - 1; i++) {
      const mid = (crosses[i].pos + crosses[i + 1].pos) / 2;
      if (alongMm < mid) {
        segIndex = i;
        break;
      }
      segIndex = i;
    }
    const a0 = crosses[segIndex];
    const a1 = crosses[segIndex + 1];
    if (isBeamSegOmitted(beam, a0.id, a1.id)) {
      return { lo: axis.pos, hi: axis.pos };
    }
  }
  return beamFacesAtAlongDirect(beam, alongMm, perp);
}

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
  // Dầm đứng: đoạn theo hàng iy; dầm ngang: đoạn theo cột ix
  const left = beamOuterFacesAtSpan(project, "Y", ax0, iy);
  const right = beamOuterFacesAtSpan(project, "Y", ax1, iy);
  const bottom = beamOuterFacesAtSpan(project, "X", ay0, ix);
  const top = beamOuterFacesAtSpan(project, "X", ay1, ix);
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

/** Inset khoảng rải từ mí dầm trong (mm). */
export const SLAB_DIST_RANGE_INSET_MM = 50;

export type DistRangeSeg = {
  xA: number;
  yA: number;
  xB: number;
  yB: number;
  lenMm: number;
};

/**
 * Đường khoảng rải thép sàn cho một thanh: nét ⊥ qua giữa thanh;
 * đầu/cuối = mí dầm trong ± inset (mặc định 50mm vào lòng sàn).
 * Thanh X → khoảng rải theo Y (ô chứa thanh); thanh Y → theo X.
 */
export function slabDistRangeForBar(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  bar: RebarBarSeg,
  insetMm: number = SLAB_DIST_RANGE_INSET_MM,
): DistRangeSeg | null {
  if (axesX.length < 2 || axesY.length < 2) return null;
  const inset = Math.max(0, Math.round(insetMm));

  if (bar.dir === "X") {
    const mx = (bar.x0 + bar.x1) / 2;
    let yLo = Infinity;
    let yHi = -Infinity;
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      for (let ix = 0; ix < axesX.length - 1; ix++) {
        const s = baySlabExtent(project, axesX, axesY, ix, iy);
        if (bar.y >= s.y0 - 1 && bar.y <= s.y1 + 1) {
          yLo = Math.min(yLo, s.y0);
          yHi = Math.max(yHi, s.y1);
        }
      }
    }
    if (!(yHi > yLo)) return null;
    const yA = yLo + inset;
    const yB = yHi - inset;
    if (!(yB - yA > 1)) return null;
    return { xA: mx, yA, xB: mx, yB, lenMm: yB - yA };
  }

  const my = (bar.y0 + bar.y1) / 2;
  let xLo = Infinity;
  let xHi = -Infinity;
  for (let iy = 0; iy < axesY.length - 1; iy++) {
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      const s = baySlabExtent(project, axesX, axesY, ix, iy);
      if (bar.x >= s.x0 - 1 && bar.x <= s.x1 + 1) {
        xLo = Math.min(xLo, s.x0);
        xHi = Math.max(xHi, s.x1);
      }
    }
  }
  if (!(xHi > xLo)) return null;
  const xA = xLo + inset;
  const xB = xHi - inset;
  if (!(xB - xA > 1)) return null;
  return { xA, yA: my, xB, yB: my, lenMm: xB - xA };
}

export type MergedDistRange = DistRangeSeg & {
  dir: "X" | "Y";
  /** Điểm giao với từng thanh thuộc dải (vẽ chấm). */
  junctions: Array<{ x: number; y: number }>;
  markKey: string;
};

type DistRangePiece = DistRangeSeg & {
  dir: "X" | "Y";
  markKey: string;
  /** Chỉ số ô dọc theo phương khoảng rải (ix với thanh Y; iy với thanh X). */
  bayIndex: number;
  /** Hàng/cột vuông góc — chỉ gộp trong cùng strip. */
  stripKey: number;
  junction: { x: number; y: number };
};

function bayIndexForBar(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  bar: RebarBarSeg,
): { bayIndex: number; stripKey: number } | null {
  if (bar.dir === "Y") {
    const my = (bar.y0 + bar.y1) / 2;
    let ix = -1;
    let iy = -1;
    for (let j = 0; j < axesY.length - 1; j++) {
      for (let i = 0; i < axesX.length - 1; i++) {
        const s = baySlabExtent(project, axesX, axesY, i, j);
        if (bar.x >= s.x0 - 1 && bar.x <= s.x1 + 1 && my >= s.y0 - 1 && my <= s.y1 + 1) {
          ix = i;
          iy = j;
          break;
        }
      }
      if (ix >= 0) break;
    }
    if (ix < 0) {
      // Thanh đứng xuyên nhiều hàng: lấy cột theo X
      for (let i = 0; i < axesX.length - 1; i++) {
        const s = baySlabExtent(project, axesX, axesY, i, 0);
        if (bar.x >= s.x0 - 1 && bar.x <= s.x1 + 1) {
          ix = i;
          break;
        }
      }
      iy = 0;
    }
    if (ix < 0) return null;
    return { bayIndex: ix, stripKey: iy };
  }
  const mx = (bar.x0 + bar.x1) / 2;
  let ix = -1;
  let iy = -1;
  for (let j = 0; j < axesY.length - 1; j++) {
    for (let i = 0; i < axesX.length - 1; i++) {
      const s = baySlabExtent(project, axesX, axesY, i, j);
      if (mx >= s.x0 - 1 && mx <= s.x1 + 1 && bar.y >= s.y0 - 1 && bar.y <= s.y1 + 1) {
        ix = i;
        iy = j;
        break;
      }
    }
    if (iy >= 0) break;
  }
  if (iy < 0) {
    for (let j = 0; j < axesY.length - 1; j++) {
      const s = baySlabExtent(project, axesX, axesY, 0, j);
      if (bar.y >= s.y0 - 1 && bar.y <= s.y1 + 1) {
        iy = j;
        break;
      }
    }
    ix = 0;
  }
  if (iy < 0) return null;
  return { bayIndex: iy, stripKey: ix };
}

/**
 * Gộp khoảng rải: ô sàn kề nhau liên tiếp cùng số hiệu → 1 đường
 * từ điểm đầu khoảng rải đầu tiên đến điểm cuối khoảng rải cuối.
 */
export function buildMergedDistRanges(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  bars: RebarBarSeg[],
  markKeyOf: (bar: RebarBarSeg) => string,
  insetMm: number = SLAB_DIST_RANGE_INSET_MM,
): MergedDistRange[] {
  const pieces: DistRangePiece[] = [];
  for (const bar of bars) {
    const seg = slabDistRangeForBar(project, axesX, axesY, bar, insetMm);
    if (!seg) continue;
    const idx = bayIndexForBar(project, axesX, axesY, bar);
    if (!idx) continue;
    const markKey = markKeyOf(bar);
    if (!markKey) continue;
    const junction =
      bar.dir === "X"
        ? { x: (bar.x0 + bar.x1) / 2, y: bar.y }
        : { x: bar.x, y: (bar.y0 + bar.y1) / 2 };
    pieces.push({
      ...seg,
      dir: bar.dir,
      markKey,
      bayIndex: idx.bayIndex,
      stripKey: idx.stripKey,
      junction,
    });
  }

  // Nhóm theo phương + số hiệu + strip (cùng hàng/cột)
  const groups = new Map<string, DistRangePiece[]>();
  for (const p of pieces) {
    const key = `${p.dir}|${p.markKey}|${p.stripKey}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  const out: MergedDistRange[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.bayIndex - b.bayIndex);
    // Chạy liên tiếp theo bayIndex
    let run: DistRangePiece[] = [];
    const flush = () => {
      if (!run.length) return;
      const first = run[0];
      const last = run[run.length - 1];
      let xA: number;
      let yA: number;
      let xB: number;
      let yB: number;
      if (first.dir === "Y") {
        // Khoảng rải ngang: từ đầu trái → cuối phải
        xA = Math.min(...run.map((p) => Math.min(p.xA, p.xB)));
        xB = Math.max(...run.map((p) => Math.max(p.xA, p.xB)));
        const my = run.reduce((s, p) => s + p.yA, 0) / run.length;
        yA = my;
        yB = my;
      } else {
        // Khoảng rải đứng: từ dưới → trên
        yA = Math.min(...run.map((p) => Math.min(p.yA, p.yB)));
        yB = Math.max(...run.map((p) => Math.max(p.yA, p.yB)));
        const mx = run.reduce((s, p) => s + p.xA, 0) / run.length;
        xA = mx;
        xB = mx;
      }
      const lenMm = Math.hypot(xB - xA, yB - yA);
      if (lenMm > 1) {
        // Neo chấm hình 2 đúng giao đường khoảng rải (đã gộp) ∩ thép sàn
        const junctions = run.map((p) =>
          first.dir === "X"
            ? { x: xA, y: p.junction.y }
            : { x: p.junction.x, y: yA },
        );
        out.push({
          xA,
          yA,
          xB,
          yB,
          lenMm,
          dir: first.dir,
          markKey: first.markKey,
          junctions,
        });
      }
      run = [];
    };
    for (const p of group) {
      if (!run.length || p.bayIndex === run[run.length - 1].bayIndex + 1) {
        run.push(p);
      } else {
        flush();
        run.push(p);
      }
    }
    flush();
  }
  return out;
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

/** Chiều dài móc thép sàn trên mặt bằng (mm) — fallback khi zone không có. */
export const SLAB_REBAR_HOOK_MM = 50;

/** Móc mặc định theo preset (simple2 / economy2) khi không khớp zone. */
function presetHookFallbackMm(project: SlabProject): number {
  if (project.layoutPreset === "simple2") {
    return Math.max(0, Math.round(Number(project.simple2?.bottomHook) || 0));
  }
  if (project.layoutPreset === "economy2") {
    return Math.max(0, Math.round(Number(project.economy2?.bottomHook) || 0));
  }
  return SLAB_REBAR_HOOK_MM;
}

/**
 * Móc trái/phải theo vùng thép phủ tâm thanh (cùng phương).
 * Truyền `zones` = effectiveZones(project) để đúng Móc thép trái/phải (kể cả preset).
 * 0 = không vẽ móc.
 */
export function hooksForRebarBar(
  project: SlabProject,
  bar: RebarBarSeg,
  zones?: RebarZone[],
): { left: number; right: number } {
  const list = zones ?? project.zones ?? [];
  const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
  const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
  const hits = list.filter((z) => {
    if (z.direction !== bar.dir) return false;
    const zx0 = Math.min(z.x1, z.x2);
    const zx1 = Math.max(z.x1, z.x2);
    const zy0 = Math.min(z.y1, z.y2);
    const zy1 = Math.max(z.y1, z.y2);
    return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
  });
  const z = hits.find((h) => h.layer === "bottom") ?? hits[0];
  if (!z) {
    const h = presetHookFallbackMm(project);
    return { left: h, right: h };
  }
  return {
    left: Math.max(0, Math.round(Number(z.leftHook) || 0)),
    right: Math.max(0, Math.round(Number(z.rightHook) || 0)),
  };
}

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
  const { B, H } = beamDims(project.info);
  const defaultSize = formatBeamSize(B, H);
  const prev = project.beams ?? [];
  const findPrev = (direction: PlanBeam["direction"], axisId: string, axis: number) =>
    prev.find((b) => !b.free && b.axisId === axisId) ||
    prev.find((b) => !b.free && b.direction === direction && Math.abs(b.axis - axis) < 0.5);

  const beams: PlanBeam[] = [];
  const catalog = beamTypeNameSet(project);
  let typeIdx = 0;
  const pickName = (preferred?: string) => {
    const pref = normalizeBeamTypeName(preferred || "");
    if (pref && catalog.has(pref.toLowerCase())) return pref;
    const t = beamTypeAtIndex(project, typeIdx++);
    return t?.name || "—";
  };

  for (const ax of axesX) {
    const old = findPrev("Y", ax.id, ax.pos);
    const dims = old ? parseSize(old.size) : { b: B, h: H };
    const idx = axesX.findIndex((a) => a.id === ax.id);
    beams.push({
      id: old?.id ?? uid("beam"),
      name: pickName(old?.name),
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
      name: pickName(old?.name),
      size: old ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: "X",
      axis: ay.pos,
      axisId: ay.id,
      start: 0,
      end: W,
      offset: beamOffsetForAxisIndex(dims.b, idx, axesY.length),
    });
  }
  // Giữ dầm chèn giữa ô (không gắn trục) — tên vẫn chỉ trong danh sách
  for (const b of prev.filter((x) => x.free)) {
    beams.push({
      ...b,
      name: pickName(b.name),
      free: true,
      axisId: undefined,
      start: 0,
      end: b.direction === "Y" ? Hplan : W,
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
    (b) =>
      !b.free &&
      (b.axisId === axis.id || (b.direction === dir && Math.abs(b.axis - axis.pos) < 0.5)),
  );
  const parsed = parseSize(current?.size ?? formatBeamSize(project.info.beamB, project.info.beamH));
  const B = dims.beamB ?? parsed.b;
  const H = dims.beamH ?? parsed.h;
  const B1 =
    dims.beamB1 ??
    beamOffsetForAxisIndex(B, axisIndex, axes.length);
  const size = formatBeamSize(B, H);
  const beams = (project.beams?.length ? project.beams : []).map((b) => {
    if (b.free) return b;
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

/**
 * Ô sàn = khoảng giữa 4 dầm. Dầm free / lệch trục phải có trục tại tim
 * để tách ô (1 dầm cắt ngang → 2 ô; cắt ngang + dọc → 4 ô).
 */
export function ensureBeamsSplitBays(project: SlabProject): SlabProject {
  const base = ensureAxes(project);
  let axesX = sortAxes(base.axesX ?? []);
  let axesY = sortAxes(base.axesY ?? []);
  const beamsIn = base.beams ?? [];
  const tol = 1;

  const addAxisX = (pos: number) => {
    const p = Math.round(pos);
    if (axesX.some((a) => Math.abs(a.pos - p) <= tol)) return;
    axesX = sortAxes([...axesX, { id: uid("ax"), name: nextAxisNameX(axesX), pos: p }]);
  };
  const addAxisY = (pos: number) => {
    const p = Math.round(pos);
    if (axesY.some((a) => Math.abs(a.pos - p) <= tol)) return;
    axesY = sortAxes([...axesY, { id: uid("ay"), name: nextAxisNameY(axesY), pos: p }]);
  };

  for (const b of beamsIn) {
    if (b.direction === "Y") addAxisX(b.axis);
    else addAxisY(b.axis);
  }

  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  const snapped = beamsIn.map((b) => {
    const axes = b.direction === "Y" ? axesX : axesY;
    let best = axes[0];
    let bestD = Infinity;
    for (const a of axes) {
      const d = Math.abs(a.pos - b.axis);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    const { free: _free, ...rest } = b;
    return {
      ...rest,
      axisId: best.id,
      axis: best.pos,
      start: 0,
      end: b.direction === "Y" ? Hplan : W,
    };
  });

  // Một dầm / (phương + trục)
  const seen = new Set<string>();
  const dedup: PlanBeam[] = [];
  for (const b of snapped) {
    const k = `${b.direction}:${b.axisId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(b);
  }

  const size = planSizeFromAxes(axesX, axesY);
  return syncBeamsToAxes({
    ...base,
    axesX,
    axesY,
    ...size,
    beams: dedup,
    info: syncBeamInfo({
      ...base.info,
      beamCountX: dedup.filter((b) => b.direction === "Y").length,
      beamCountY: dedup.filter((b) => b.direction === "X").length,
    }),
  });
}

/** Cập nhật trục + kích thước mặt bằng; dầm theo tim trục (biên / giữa). */
export function applyAxesToProject(project: SlabProject): SlabProject {
  const withAxes = ensureAxes(project);
  const size = planSizeFromAxes(withAxes.axesX, withAxes.axesY);
  const info = syncBeamInfo(withAxes.info);
  const synced = syncBeamsToAxes({
    ...withAxes,
    info,
    ...size,
    beams: withAxes.beams ?? [],
  });
  // Dầm giữa ô / lệch trục → thêm trục để ô sàn không dính liền băng qua dầm
  return ensureBeamsSplitBays(synced);
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
  const withAxes = applyAxesToProject({
    ...project,
    ...nextAxes,
    // Bỏ dầm free — số trục mới quyết định ô; free sẽ bị ensureBeamsSplitBays thêm trục lệch
    beams: (project.beams ?? []).filter((b) => !b.free),
  });
  const axesX = sortAxes(withAxes.axesX ?? []);
  const axesY = sortAxes(withAxes.axesY ?? []);
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  const { B, H } = beamDims(withAxes.info);
  const defaultSize = formatBeamSize(B, H);
  const catalog = beamTypeNameSet(withAxes);

  const beamDir: PlanBeam["direction"] = dir === "X" ? "Y" : "X";
  const axes = dir === "X" ? axesX : axesY;
  const existing = (withAxes.beams ?? [])
    .filter((b) => b.direction === beamDir && !b.free)
    .sort((a, b) => a.axis - b.axis);
  const keptOther = (withAxes.beams ?? [])
    .filter((b) => b.direction !== beamDir)
    .map((b) => ({
      ...b,
      start: 0,
      end: b.direction === "Y" ? Hplan : W,
    }));

  const pickName = (i: number, preferred?: string) => {
    const pref = normalizeBeamTypeName(preferred || "");
    if (pref && catalog.has(pref.toLowerCase())) return pref;
    return beamTypeAtIndex(withAxes, i)?.name || "—";
  };

  const synced: PlanBeam[] = axes.map((ax, i) => {
    const prev = existing[i];
    const fromList = beamTypeAtIndex(withAxes, i);
    const dims = prev
      ? parseSize(prev.size)
      : fromList
        ? parseSize(fromList.size)
        : { b: B, h: H };
    const bw = dims.b;
    return {
      id: prev?.id ?? uid("beam"),
      name: pickName(i, prev?.name),
      size: prev
        ? formatBeamSize(dims.b, dims.h)
        : fromList?.size || defaultSize,
      direction: beamDir,
      axis: ax.pos,
      axisId: ax.id,
      start: 0,
      end: beamDir === "Y" ? Hplan : W,
      offset:
        prev && Number.isFinite(prev.offset)
          ? (prev.offset as number)
          : fromList && Number.isFinite(fromList.offset)
            ? (fromList.offset as number)
            : beamOffsetForAxisIndex(bw, i, axes.length),
    };
  });

  const beams = dir === "X" ? [...synced, ...keptOther] : [...keptOther, ...synced];
  return ensureBeamsSplitBays({
    ...withAxes,
    beams,
    info: syncBeamInfo({
      ...withAxes.info,
      beamCountX: beams.filter((b) => b.direction === "Y").length,
      beamCountY: beams.filter((b) => b.direction === "X").length,
    }),
  });
}

/** Tạo dầm mới theo phương (Y = dầm đứng / theo trục X). Tên lấy từ Danh sách dầm. */
export function createBeam(
  project: SlabProject,
  direction: PlanBeam["direction"],
  axisPos: number,
  index: number,
): PlanBeam {
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
  const fromList = beamTypeAtIndex(project, Math.max(0, index - 1));
  const { B: bDef, H: hDef } = beamDims(project.info);
  const size = fromList?.size || formatBeamSize(bDef, hDef);
  const parsed = parseSize(size);
  return {
    id: uid("beam"),
    name: fromList?.name || "—",
    size: formatBeamSize(parsed.b, parsed.h),
    direction,
    axis: axis?.pos ?? axisPos,
    axisId: axis?.id,
    start: 0,
    end: direction === "Y" ? Hplan : W,
    offset:
      fromList && Number.isFinite(fromList.offset)
        ? (fromList.offset as number)
        : beamOffsetForAxisIndex(parsed.b, Math.max(0, axisIdx), Math.max(1, axes.length)),
  };
}

/**
 * Đổi số lượng dầm theo phương — đồng bộ số trục + dầm trên tim
 * (mỗi dầm một trục → ô sàn tách đúng giữa các dầm).
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
  let next: SlabProject = base;
  if (cx >= 2) next = applyAxisCount(next, "X", cx);
  if (cy >= 2) next = applyAxisCount(next, "Y", cy);
  return ensureBeamsSplitBays(next);
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

/**
 * Chèn dầm vào giữa ô sàn (ix, iy) — thêm trục lưới để tách ô độc lập.
 * method "X" → dầm đứng + trục X mới (1 ô → 2 ô).
 * method "Y" → dầm ngang + trục Y mới (1 ô → 2 ô).
 * Cả X và Y → 4 ô. `splitMm`: khoảng từ mép đầu ô đến tim (mặc định giữa ô).
 */
export function insertBeamInBay(
  project: SlabProject,
  ix: number,
  iy: number,
  method: "X" | "Y",
  type: Pick<BeamTypeDef, "name" | "size" | "offset">,
  splitMm?: number,
): SlabProject {
  const base = ensureAxes(project);
  const axesX = sortAxes(base.axesX ?? []);
  const axesY = sortAxes(base.axesY ?? []);
  if (ix < 0 || ix >= axesX.length - 1 || iy < 0 || iy >= axesY.length - 1) return project;

  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  const parsed = parseSize(type.size || formatBeamSize(base.info.beamB, base.info.beamH));
  const bw = parsed.b;
  const name = (type.name || "").trim() || "D";
  const offset = Number.isFinite(type.offset) ? Math.round(type.offset) : Math.round(bw / 2);
  const minGap = Math.max(bw + 40, 120);

  const pickPos = (a0: number, a1: number, preferredFromStart: number, occupied: number[]) => {
    const span = a1 - a0;
    if (span < 100) return null as number | null;
    const fracs = [0.5, 0.35, 0.65, 0.25, 0.75, 0.4, 0.6];
    const candidates = [preferredFromStart, ...fracs.map((t) => Math.round(span * t))];
    for (const fromStart of candidates) {
      const pos = Math.min(a1 - 50, Math.max(a0 + 50, a0 + fromStart));
      if (occupied.every((p) => Math.abs(p - pos) >= minGap)) return pos;
    }
    return null;
  };

  if (method === "X") {
    const a0 = axesX[ix];
    const a1 = axesX[ix + 1];
    const span = a1.pos - a0.pos;
    if (span < 100) return project;
    const fromLeft =
      splitMm !== undefined && Number.isFinite(splitMm)
        ? Math.round(splitMm)
        : Math.round(span / 2);
    const occupied = axesX.map((a) => a.pos);
    const pos = pickPos(a0.pos, a1.pos, fromLeft, occupied);
    if (pos === null) return project;

    const neu: GridAxis = { id: uid("ax"), name: nextAxisNameX(axesX), pos };
    const nextX = sortAxes([...axesX, neu]);
    const axisIdx = nextX.findIndex((a) => a.id === neu.id);
    const beam: PlanBeam = {
      id: uid("beam"),
      name,
      size: formatBeamSize(parsed.b, parsed.h),
      direction: "Y",
      axis: neu.pos,
      axisId: neu.id,
      start: 0,
      end: Hplan,
      offset: beamOffsetForAxisIndex(bw, axisIdx, nextX.length),
    };
    if (Number.isFinite(type.offset) && axisIdx > 0 && axisIdx < nextX.length - 1) {
      beam.offset = offset;
    }
    // Bỏ dầm free trùng vị trí (chèn trước đó chưa tách ô)
    const kept = (base.beams ?? []).filter(
      (b) => !(b.free && b.direction === "Y" && Math.abs(b.axis - pos) < minGap),
    );
    const beams = [...kept, beam];
    const next = applyAxesToProject({ ...base, axesX: nextX, beams });
    return {
      ...next,
      info: syncBeamInfo({
        ...next.info,
        beamCountX: next.beams.filter((b) => b.direction === "Y").length,
        beamCountY: next.beams.filter((b) => b.direction === "X").length,
      }),
    };
  }

  // Phương Y: dầm ngang + trục Y mới → tách ô theo chiều cao
  const a0 = axesY[iy];
  const a1 = axesY[iy + 1];
  const span = a1.pos - a0.pos;
  if (span < 100) return project;
  const fromBottom =
    splitMm !== undefined && Number.isFinite(splitMm)
      ? Math.round(splitMm)
      : Math.round(span / 2);
  const occupied = axesY.map((a) => a.pos);
  const pos = pickPos(a0.pos, a1.pos, fromBottom, occupied);
  if (pos === null) return project;

  const neu: GridAxis = { id: uid("ay"), name: nextAxisNameY(axesY), pos };
  const nextY = sortAxes([...axesY, neu]);
  const axisIdx = nextY.findIndex((a) => a.id === neu.id);
  const beam: PlanBeam = {
    id: uid("beam"),
    name,
    size: formatBeamSize(parsed.b, parsed.h),
    direction: "X",
    axis: neu.pos,
    axisId: neu.id,
    start: 0,
    end: W,
    offset: beamOffsetForAxisIndex(bw, axisIdx, nextY.length),
  };
  if (Number.isFinite(type.offset) && axisIdx > 0 && axisIdx < nextY.length - 1) {
    beam.offset = offset;
  }
  const kept = (base.beams ?? []).filter(
    (b) => !(b.free && b.direction === "X" && Math.abs(b.axis - pos) < minGap),
  );
  const beams = [...kept, beam];
  const next = applyAxesToProject({ ...base, axesY: nextY, beams });
  return {
    ...next,
    info: syncBeamInfo({
      ...next.info,
      beamCountX: next.beams.filter((b) => b.direction === "Y").length,
      beamCountY: next.beams.filter((b) => b.direction === "X").length,
    }),
  };
}

/** Phạm vi vẽ dầm theo chiều dài: kéo đầu tới da dầm ngược phương nếu có (tính lệch/xéo). */
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
    // Tim dầm đang xét có nằm trên thân dầm ngược phương không?
    const alongOnPerp = beam.axis;
    if (alongOnPerp < pLo - 1 || alongOnPerp > pHi + 1) continue;
    const faces = beamFacesAtAlongDirect(
      p,
      alongOnPerp,
      sortAxes(p.direction === "Y" ? project.axesY ?? [] : project.axesX ?? []),
    );
    const half = Math.max(faces.hi - faces.lo, 1) / 2 + 80;
    // Gần đầu lo/hi của dầm đang xét (theo tim trục dầm ngược)
    if (Math.abs(p.axis - lo) <= half || faces.lo <= lo + half) lo = Math.min(lo, faces.lo);
    if (Math.abs(p.axis - hi) <= half || faces.hi >= hi - half) hi = Math.max(hi, faces.hi);
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
    // Tim X của dầm đứng — đầu/cuối đoạn bám da dầm ngang lệch/xéo tại đúng tim này
    const alongX = beam.axis;
    for (let i = 0; i < crosses.length - 1; i++) {
      const a0 = crosses[i].a;
      const a1 = crosses[i + 1].a;
      const { yLo, yHi } = verticalBeamSegExtent(project, a0.pos, a1.pos, axesY, alongX);
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
  // Tim Y của dầm ngang — đầu/cuối đoạn bám da dầm đứng lệch/xéo tại đúng tim này
  const alongY = beam.axis;
  for (let i = 0; i < crosses.length - 1; i++) {
    const a0 = crosses[i].a;
    const a1 = crosses[i + 1].a;
    const { xLo, xHi } = horizontalBeamSegExtent(project, a0.pos, a1.pos, axesX, alongY);
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

/** Thêm một dầm theo phương — tạo trục tại tim để tách ô sàn. */
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
  return ensureBeamsSplitBays({
    ...base,
    beams,
    info: syncBeamInfo({
      ...base.info,
      beamCountX: beams.filter((b) => b.direction === "Y").length,
      beamCountY: beams.filter((b) => b.direction === "X").length,
    }),
  });
}

/** Tăng số đuôi tên dầm: D1 → D2, DX → DX1, D → D1. */
export function bumpBeamTypeName(name: string): string {
  const raw = (name || "D").trim() || "D";
  const m = raw.match(/^(.*?)(\d+)$/);
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return `${raw}1`;
}

/** Chuẩn hóa tên loại dầm để so khớp (không phân biệt hoa thường / khoảng trắng). */
export function normalizeBeamTypeName(name: string): string {
  return (name || "").trim().replace(/\s+/g, " ");
}

/** Tập tên trong Danh sách dầm. */
export function beamTypeNameSet(project: SlabProject): Set<string> {
  return new Set(
    (project.beamTypes ?? [])
      .map((t) => normalizeBeamTypeName(t.name))
      .filter(Boolean)
      .map((n) => n.toLowerCase()),
  );
}

export function findBeamTypeByName(
  project: SlabProject,
  name: string,
): BeamTypeDef | undefined {
  const key = normalizeBeamTypeName(name).toLowerCase();
  if (!key) return undefined;
  return (project.beamTypes ?? []).find(
    (t) => normalizeBeamTypeName(t.name).toLowerCase() === key,
  );
}

/** Tên hiển thị trên mặt bằng: chỉ tên có trong Danh sách dầm. */
export function planBeamDisplayName(project: SlabProject, beamName: string): string {
  const t = findBeamTypeByName(project, beamName);
  return t ? normalizeBeamTypeName(t.name) : "—";
}

/**
 * Đồng bộ tên dầm trên mặt bằng với Danh sách dầm:
 * tên ngoài list được gán lại theo thứ tự list (xoay vòng).
 */
export function clampPlanBeamNamesToCatalog(project: SlabProject): SlabProject {
  const types = project.beamTypes ?? [];
  if (!types.length) {
    let changed = false;
    const beams = (project.beams ?? []).map((b) => {
      if (normalizeBeamTypeName(b.name) === "—") return b;
      changed = true;
      return { ...b, name: "—" };
    });
    return changed ? { ...project, beams } : project;
  }
  const catalog = beamTypeNameSet(project);
  let idx = 0;
  let changed = false;
  const beams = (project.beams ?? []).map((b) => {
    const pref = normalizeBeamTypeName(b.name);
    if (pref && catalog.has(pref.toLowerCase())) {
      const canon = findBeamTypeByName(project, pref)?.name ?? pref;
      if (canon !== b.name) changed = true;
      return canon === b.name ? b : { ...b, name: canon };
    }
    const t = types[((idx % types.length) + types.length) % types.length];
    idx += 1;
    changed = true;
    return { ...b, name: normalizeBeamTypeName(t.name) || t.name };
  });
  return changed ? { ...project, beams } : project;
}

/** Lấy loại dầm theo thứ tự danh sách (xoay vòng) — không tự tạo tên ngoài list. */
export function beamTypeAtIndex(
  project: SlabProject,
  index: number,
): Pick<BeamTypeDef, "name" | "size" | "offset"> | null {
  const types = project.beamTypes ?? [];
  if (!types.length) return null;
  const t = types[((index % types.length) + types.length) % types.length];
  return {
    name: normalizeBeamTypeName(t.name) || t.name,
    size: t.size,
    offset: t.offset,
  };
}

/** Tên gợi ý cho loại dầm tiếp theo (D1, D2…). */
export function suggestNextBeamTypeName(project: SlabProject): string {
  const types = project.beamTypes ?? [];
  if (types.length === 0) {
    const prefix = (project.info.beamNamePrefix || "D").replace(/\d+$/, "") || "D";
    return `${prefix}1`;
  }
  const last = types[types.length - 1]?.name || "D1";
  let next = bumpBeamTypeName(last);
  const used = beamTypeNameSet(project);
  while (used.has(next.toLowerCase())) next = bumpBeamTypeName(next);
  return next;
}

/**
 * Thêm loại dầm vào danh sách (nút Thêm).
 * Không cho trùng tên (không phân biệt hoa thường).
 * Trả về null nếu tên trống hoặc trùng.
 */
export function addOrUpdateBeamType(
  project: SlabProject,
  input: { name: string; size?: string; offset?: number },
): SlabProject | null {
  const name = normalizeBeamTypeName(input.name);
  if (!name) return null;
  if (beamTypeNameSet(project).has(name.toLowerCase())) return null;
  const { B, H, B1 } = beamDims(project.info);
  const size = (input.size || formatBeamSize(B, H)).trim() || formatBeamSize(B, H);
  const offset = Number.isFinite(input.offset as number)
    ? Math.round(input.offset as number)
    : Math.round(B1);
  const types = [...(project.beamTypes ?? [])];
  types.push({ id: uid("bt"), name, size, offset });
  return { ...project, beamTypes: types };
}

/** Đổi H hoặc B của một loại dầm (giữ thành phần còn lại trong size). */
export function patchBeamTypeDim(
  project: SlabProject,
  typeId: string,
  which: "H" | "B",
  value: number,
): SlabProject {
  const v = Math.max(1, Math.round(value) || 1);
  return {
    ...project,
    beamTypes: (project.beamTypes ?? []).map((t) => {
      if (t.id !== typeId) return t;
      const m = String(t.size || "").match(/^(\d+)\s*[x×]\s*(\d+)/i);
      const b = m ? Number(m[1]) : 220;
      const h = m ? Number(m[2]) : 500;
      const size = which === "B" ? formatBeamSize(v, h) : formatBeamSize(b, v);
      return { ...t, size };
    }),
  };
}

export function removeBeamType(project: SlabProject, typeId: string): SlabProject {
  return {
    ...project,
    beamTypes: (project.beamTypes ?? []).filter((t) => t.id !== typeId),
  };
}

export function patchBeamType(
  project: SlabProject,
  typeId: string,
  patch: Partial<BeamTypeDef>,
): SlabProject {
  const types = project.beamTypes ?? [];
  const prev = types.find((t) => t.id === typeId);
  if (!prev) return project;

  let nextName = prev.name;
  if (patch.name !== undefined) {
    const n = normalizeBeamTypeName(patch.name);
    if (!n) return project;
    const dup = types.some(
      (t) => t.id !== typeId && normalizeBeamTypeName(t.name).toLowerCase() === n.toLowerCase(),
    );
    if (dup) return project;
    nextName = n;
  }

  const nextTypes = types.map((t) =>
    t.id === typeId ? { ...t, ...patch, name: nextName } : t,
  );
  const oldKey = normalizeBeamTypeName(prev.name).toLowerCase();
  const beams =
    nextName !== prev.name
      ? (project.beams ?? []).map((b) =>
          normalizeBeamTypeName(b.name).toLowerCase() === oldKey ? { ...b, name: nextName } : b,
        )
      : project.beams;
  return { ...project, beamTypes: nextTypes, beams };
}

/** Gán loại dầm (tên + BxH + B1) cho các dầm mặt bằng theo id. */
export function applyBeamTypeToBeams(
  project: SlabProject,
  beamIds: string[],
  type: Pick<BeamTypeDef, "name" | "size" | "offset">,
): SlabProject {
  const ids = new Set(beamIds);
  const beams = (project.beams ?? []).map((b) => {
    if (!ids.has(b.id)) return b;
    return {
      ...b,
      name: type.name,
      size: type.size || b.size,
      offset: Number.isFinite(type.offset) ? type.offset : b.offset,
    };
  });
  return { ...project, beams };
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

/**
 * Gộp ô thủng / sàn thấp hai bên một nhịp (khi xóa 1 đoạn dầm).
 * beamDir Y + spanIndex=iy → gộp trái/phải hàng iy tại trục axisIndex.
 * beamDir X + spanIndex=ix → gộp dưới/trên cột ix tại trục axisIndex.
 */
function mergeSpecialBaysAtBeamSpan(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axisIndex: number,
  spanIndex: number,
): { openings: NonNullable<SlabProject["openings"]>; lowSlabs: NonNullable<SlabProject["lowSlabs"]> } {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  let openings = [...(project.openings ?? [])];
  let lowSlabs = [...(project.lowSlabs ?? [])];

  const takeMerge = <T extends { id: string; x: number; y: number; w: number; h: number }>(
    list: T[],
    left: { x0: number; y0: number; x1: number; y1: number },
    right: { x0: number; y0: number; x1: number; y1: number },
    merged: { x: number; y: number; w: number; h: number },
  ): T[] => {
    const leftHit = list.find((o) => rectNearlyEquals(o, left.x0, left.y0, left.x1, left.y1));
    const rightHit = list.find((o) => rectNearlyEquals(o, right.x0, right.y0, right.x1, right.y1));
    if (!leftHit && !rightHit) return list;
    const base = leftHit ?? rightHit!;
    return [
      ...list.filter((o) => o.id !== leftHit?.id && o.id !== rightHit?.id),
      { ...base, ...merged },
    ];
  };

  if (beamDir === "Y") {
    if (axisIndex <= 0 || axisIndex >= axesX.length - 1) return { openings, lowSlabs };
    if (spanIndex < 0 || spanIndex >= axesY.length - 1) return { openings, lowSlabs };
    const left = baySlabExtent(project, axesX, axesY, axisIndex - 1, spanIndex);
    const right = baySlabExtent(project, axesX, axesY, axisIndex, spanIndex);
    const y0 = Math.min(left.y0, right.y0);
    const y1 = Math.max(left.y1, right.y1);
    const merged = { x: left.x0, y: y0, w: right.x1 - left.x0, h: y1 - y0 };
    openings = takeMerge(openings, left, right, merged);
    lowSlabs = takeMerge(lowSlabs, left, right, merged);
  } else {
    if (axisIndex <= 0 || axisIndex >= axesY.length - 1) return { openings, lowSlabs };
    if (spanIndex < 0 || spanIndex >= axesX.length - 1) return { openings, lowSlabs };
    const bottom = baySlabExtent(project, axesX, axesY, spanIndex, axisIndex - 1);
    const top = baySlabExtent(project, axesX, axesY, spanIndex, axisIndex);
    const x0 = Math.min(bottom.x0, top.x0);
    const x1 = Math.max(bottom.x1, top.x1);
    const merged = { x: x0, y: bottom.y0, w: x1 - x0, h: top.y1 - bottom.y0 };
    openings = takeMerge(openings, bottom, top, merged);
    lowSlabs = takeMerge(lowSlabs, bottom, top, merged);
  }
  return { openings, lowSlabs };
}

/**
 * Xóa các đoạn dầm đã chọn (Shift/Ctrl chọn nhiều).
 * Không gỡ cả thanh/trục — chỉ bỏ đoạn; ô sàn hai bên đoạn coi như liền (bề dày dầm = 0 tại nhịp đó).
 */
export function removeBeamSegments(
  project: SlabProject,
  selections: Array<{ beamId: string; segIndex: number }>,
): SlabProject {
  if (!selections.length) return project;
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  let openings = [...(project.openings ?? [])];
  let lowSlabs = [...(project.lowSlabs ?? [])];
  let beams = [...(project.beams ?? [])];

  const byBeam = new Map<string, Set<number>>();
  for (const s of selections) {
    if (!byBeam.has(s.beamId)) byBeam.set(s.beamId, new Set());
    byBeam.get(s.beamId)!.add(s.segIndex);
  }

  for (const [beamId, segIdxs] of byBeam) {
    const bi = beams.findIndex((b) => b.id === beamId);
    if (bi < 0) continue;
    const beam = beams[bi];
    const segs = beamSegments(project, beam);
    const omit = new Set(beam.omitSegKeys ?? []);
    let axisIndex = (beam.direction === "Y" ? axesX : axesY).findIndex(
      (a) => a.id === beam.axisId || Math.abs(a.pos - beam.axis) < 0.5,
    );

    for (const segIndex of segIdxs) {
      const seg = segs[segIndex];
      if (!seg) continue;
      omit.add(beamSegKey(seg.a0.id, seg.a1.id));
      // spanIndex: dầm đứng → hàng iy = seg giữa axesY; dầm ngang → cột ix
      const perp = beam.direction === "Y" ? axesY : axesX;
      const spanIndex = perp.findIndex((a) => a.id === seg.a0.id);
      if (axisIndex >= 0 && spanIndex >= 0) {
        const merged = mergeSpecialBaysAtBeamSpan(
          { ...project, openings, lowSlabs, beams },
          beam.direction,
          axisIndex,
          spanIndex,
        );
        openings = merged.openings;
        lowSlabs = merged.lowSlabs;
      }
    }

    const remaining = segs.filter((s) => !omit.has(beamSegKey(s.a0.id, s.a1.id)) && !omit.has(beamSegKey(s.a1.id, s.a0.id)));
    if (remaining.length === 0) {
      beams = beams.filter((b) => b.id !== beamId);
    } else {
      beams[bi] = { ...beam, omitSegKeys: [...omit] };
    }
  }

  const next: SlabProject = {
    ...project,
    beams,
    openings,
    lowSlabs,
    info: syncBeamInfo({
      ...project.info,
      beamCountX: beams.filter((b) => b.direction === "Y").length,
      beamCountY: beams.filter((b) => b.direction === "X").length,
    }),
  };
  return syncBeamsToAxes(next);
}

/** Đoạn còn hiển thị / chọn được (bỏ đoạn đã xóa). */
export function activeBeamSegments(project: SlabProject, beam: PlanBeam): BeamSegment[] {
  return beamSegments(project, beam).filter((s) => !isBeamSegOmitted(beam, s.a0.id, s.a1.id));
}

/**
 * @deprecated Dùng removeBeamSegments — xóa theo đoạn, không gỡ cả trục.
 * Giữ lại để tương thích gọi cũ.
 */
export function removeBeamMergingAdjacentBays(
  project: SlabProject,
  beamId: string,
): SlabProject {
  const beam = (project.beams ?? []).find((b) => b.id === beamId);
  if (!beam) return project;
  const segs = activeBeamSegments(project, beam);
  return removeBeamSegments(
    project,
    segs.map((s) => ({ beamId, segIndex: s.index })),
  );
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
