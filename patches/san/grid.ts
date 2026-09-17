import type { GridAxis, PlanBeam, SlabInfo, SlabProject } from "./types";
import { uid } from "./utils";

/** Thép sàn thụt vào từ da dầm (mm). */
export const SLAB_REBAR_FACE_INSET_MM = 50;

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

/** Phạm vi thép sàn trong ô: nằm trên dầm, thụt 50mm từ da dầm ngoài. */
export function bayRebarExtent(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
  ix: number,
  iy: number,
  insetMm = SLAB_REBAR_FACE_INSET_MM,
): { x0: number; x1: number; y0: number; y1: number; mx: number; my: number } {
  const ax0 = axesX[ix];
  const ax1 = axesX[ix + 1];
  const ay0 = axesY[iy];
  const ay1 = axesY[iy + 1];
  const left = beamOuterFaces(ax0.pos, beamSectionOnAxis(project, "Y", ax0));
  const right = beamOuterFaces(ax1.pos, beamSectionOnAxis(project, "Y", ax1));
  const bottom = beamOuterFaces(ay0.pos, beamSectionOnAxis(project, "X", ay0));
  const top = beamOuterFaces(ay1.pos, beamSectionOnAxis(project, "X", ay1));
  const x0 = left.lo + insetMm;
  const x1 = right.hi - insetMm;
  const y0 = bottom.lo + insetMm;
  const y1 = top.hi - insetMm;
  return {
    x0,
    x1: Math.max(x0, x1),
    y0,
    y1: Math.max(y0, y1),
    mx: (ax0.pos + ax1.pos) / 2,
    my: (ay0.pos + ay1.pos) / 2,
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
    beams.push({
      id: old?.id ?? uid("beam"),
      name: nextName(old?.name),
      size: old ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: "Y",
      axis: ax.pos,
      axisId: ax.id,
      start: 0,
      end: Hplan,
      offset: Number.isFinite(old?.offset) ? (old!.offset as number) : B1,
    });
  }
  for (const ay of axesY) {
    const old = findPrev("X", ay.id, ay.pos);
    const dims = old ? parseSize(old.size) : { b: B, h: H };
    beams.push({
      id: old?.id ?? uid("beam"),
      name: nextName(old?.name),
      size: old ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: "X",
      axis: ay.pos,
      axisId: ay.id,
      start: 0,
      end: W,
      offset: Number.isFinite(old?.offset) ? (old!.offset as number) : B1,
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
  const B1 = dims.beamB1 ?? current?.offset ?? Math.round(B / 2);
  const size = formatBeamSize(B, H);
  const beams = (project.beams?.length ? project.beams : []).map((b) => {
    const match = b.axisId === axis.id || (b.direction === dir && Math.abs(b.axis - axis.pos) < 0.5);
    return match ? { ...b, size, offset: B1, axisId: axis.id, axis: axis.pos } : b;
  });
  return { ...project, beams };
}

/** Áp dụng B/H/B1 của một dầm cho toàn bộ dầm trên mặt bằng. */
export function applyBeamDimsToAll(
  project: SlabProject,
  dims: { beamB: number; beamH: number; beamB1: number },
): SlabProject {
  const size = formatBeamSize(dims.beamB, dims.beamH);
  const beams = (project.beams?.length ? project.beams : []).map((b) => ({
    ...b,
    size,
    offset: dims.beamB1,
  }));
  const info = syncBeamInfo({
    ...project.info,
    beamB: dims.beamB,
    beamH: dims.beamH,
    beamB1: dims.beamB1,
  });
  return { ...project, info, beams };
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

/** Cập nhật trục + kích thước mặt bằng — không đụng danh sách dầm. */
export function applyAxesToProject(project: SlabProject): SlabProject {
  const withAxes = ensureAxes(project);
  const size = planSizeFromAxes(withAxes.axesX, withAxes.axesY);
  const info = syncBeamInfo(withAxes.info);
  return {
    ...withAxes,
    info,
    ...size,
    beams: withAxes.beams ?? [],
  };
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
    return {
      id: prev?.id ?? uid("beam"),
      name: nextName(prev?.name),
      size: prev ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: beamDir,
      axis: ax.pos,
      axisId: ax.id,
      start: 0,
      end: beamDir === "Y" ? Hplan : W,
      offset: Number.isFinite(prev?.offset) ? (prev!.offset as number) : B1,
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
  const { B, H, B1 } = beamDims(project.info);
  const prefix = project.info.beamNamePrefix || "D";
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  return {
    id: uid("beam"),
    name: `${prefix}${index}`,
    size: formatBeamSize(B, H),
    direction,
    axis: axisPos,
    start: 0,
    end: direction === "Y" ? Hplan : W,
    offset: B1,
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
