import { PDFDocument, PDFFont, PDFPage, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  STOCK_M,
  computeModel,
  effectiveZones,
  parseBeamSize,
  weightPerMeter,
  type ComputedSlabModel,
  type ScheduleRow,
} from "../calc";
import {
  beamFacesAtAlongDirect,
  beamOuterFaces,
  beamOuterFacesAtSpan,
  beamSectionOnAxis,
  beamSegSideFaces,
  beamSegments,
  isBeamSegOmitted,
  planBeamBleed,
  rectDiagonalHatchSegments,
  rectOpeningDiagonals,
  sortAxes,
  stripRebarBarSegments,
  stripRebarPressMarks,
  SLAB_REBAR_HOOK_MM,
} from "../grid";
import type { GridAxis, PlanBeam, RebarZone, SlabProject } from "../types";
import { buildBeamFrameScene, projectSceneToSvg } from "../view3d";

const PAGE_W = 1684;
const PAGE_H = 1191;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.45, 0.45, 0.45);
const AXIS_LINE = rgb(0.28, 0.28, 0.28);
/** Chỉ thép dùng nét đỏ; dầm / khung / tim trục = đen. */
const REBAR_RED = rgb(0.86, 0.15, 0.15);
/** Đường khoảng rải thép sàn (⊥ phương thanh). */
const DIST_BLUE = rgb(0.15, 0.39, 0.92);
const REBAR_MARK_R = 4.8;
/** Vòng số hiệu trục PDF: bán kính + khoảng hở khỏi da dầm. */
const AXIS_BUBBLE_R = 5.5;
const AXIS_BUBBLE_GAP = 10;
const AXIS_BUBBLE_OFFSET = AXIS_BUBBLE_R + AXIS_BUBBLE_GAP;
/** Da dầm phía trong (hướng vào ô sàn): nét đứt đều. */
const BEAM_INNER_DASH = [3.2, 2];
/** Tim trục: gạch–chấm–gạch–chấm liên tục. */
const AXIS_CENTERLINE_DASH = [7, 1.6, 1.2, 1.6];
/** Nét da dầm (mỏng hơn khung ngoài). */
const BEAM_STROKE = 0.55;

type KitFont = {
  unitsPerEm: number;
  layout: (text: string) => {
    glyphs: Array<{
      advanceWidth: number;
      cbox: { minX: number; minY: number; maxX: number; maxY: number };
    }>;
  };
};

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  boldKit: KitFont;
  project: SlabProject;
  model: ComputedSlabModel;
};

function ty(yTop: number) {
  return PAGE_H - yTop;
}

function line(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w = 0.7,
  color = BLACK,
  dashArray?: number[],
) {
  ctx.page.drawLine({
    start: { x: x1, y: ty(y1) },
    end: { x: x2, y: ty(y2) },
    thickness: w,
    color,
    ...(dashArray ? { dashArray } : {}),
  });
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.8) {
  ctx.page.drawRectangle({
    x,
    y: ty(y + h),
    width: w,
    height: h,
    borderColor: BLACK,
    borderWidth: t,
  });
}

function textSimple(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size = 8,
  bold = false,
  align: "left" | "center" | "right" = "left",
  color = BLACK,
) {
  const font = bold ? ctx.fontBold : ctx.font;
  const width = font.widthOfTextAtSize(str, size);
  let tx = x;
  if (align === "center") tx = x - width / 2;
  if (align === "right") tx = x - width;
  ctx.page.drawText(str, {
    x: tx,
    y: ty(y) - size * 0.78,
    size,
    font,
    color,
  });
  return width;
}

/** Căn giữa tâm theo bbox mực (dùng cho số trong vòng thép / trục). */
function textInkCentered(
  ctx: Ctx,
  str: string,
  cx: number,
  cy: number,
  size: number,
  color = BLACK,
  bold = true,
) {
  const font = bold ? ctx.fontBold : ctx.font;
  const kit = ctx.boldKit;
  const scale = size / kit.unitsPerEm;
  const glyphs = kit.layout(str).glyphs;
  let pen = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const g of glyphs) {
    const b = g.cbox;
    minX = Math.min(minX, pen + b.minX);
    maxX = Math.max(maxX, pen + b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
    pen += g.advanceWidth;
  }
  if (!Number.isFinite(minX)) {
    const width = font.widthOfTextAtSize(str, size);
    ctx.page.drawText(str, {
      x: cx - width / 2,
      y: ty(cy) - size * 0.37,
      size,
      font,
      color,
    });
    return;
  }
  const inkCx = ((minX + maxX) / 2) * scale;
  const inkCy = ((minY + maxY) / 2) * scale;
  const opticalNudge = size * 0.04;
  ctx.page.drawText(str, {
    x: cx - inkCx,
    y: ty(cy) - inkCy - opticalNudge,
    size,
    font,
    color,
  });
}

/** Số hiệu trục: căn giữa tâm vòng. */
function textInAxisBubble(ctx: Ctx, str: string, cx: number, cy: number, size = 6.5) {
  textInkCentered(ctx, str, cx, cy, size, BLACK, true);
}

/** Mũi tên đầu đường khoảng rải (hướng từ tip về phía thân). tip=(tx,ty) → về (hx,hy). */
function drawDistArrow(ctx: Ctx, tipX: number, tipY: number, towardX: number, towardY: number) {
  const dx = towardX - tipX;
  const dy = towardY - tipY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ah = 5.5;
  const aw = 3.2;
  const bx = tipX + ux * ah;
  const by = tipY + uy * ah;
  const px = -uy;
  const py = ux;
  const path =
    `M ${tipX} ${ty(tipY)} ` +
    `L ${bx + px * aw} ${ty(by + py * aw)} ` +
    `L ${bx - px * aw} ${ty(by - py * aw)} Z`;
  ctx.page.drawSvgPath(path, { color: DIST_BLUE });
}

/**
 * Số hiệu thép: vòng STT + Ødia a spacing trên 1 hàng (đỏ, không đậm).
 * dir = phương thanh — chữ song song thanh (X ngang / Y dọc).
 * (cx,cy) = tâm vòng (đã offset khỏi nét thép).
 */
function drawRebarCallout(
  ctx: Ctx,
  cx: number,
  cy: number,
  stt: number,
  dia: number,
  spacing: number,
  dir: "X" | "Y" = "X",
) {
  const r = REBAR_MARK_R;
  const color = REBAR_RED;
  ctx.page.drawCircle({
    x: cx,
    y: ty(cy),
    size: r,
    borderColor: color,
    borderWidth: 0.35,
  });
  const sttStr = String(stt);
  const sttSize = 5.6;
  const sttW = ctx.font.widthOfTextAtSize(sttStr, sttSize);
  ctx.page.drawText(sttStr, {
    x: cx - sttW / 2,
    y: ty(cy) - sttSize * 0.35,
    size: sttSize,
    font: ctx.font,
    color,
  });

  const label = `Ø${dia}a${spacing}`;
  const labelSize = 6.2;
  const labelW = ctx.font.widthOfTextAtSize(label, labelSize);
  const gap = 2.5;
  if (dir === "X") {
    ctx.page.drawText(label, {
      x: cx + r + gap,
      y: ty(cy) - labelSize * 0.35,
      size: labelSize,
      font: ctx.font,
      color,
    });
  } else {
    // Dọc theo thanh Y: chữ xoay -90°, chạy xuống trang từ dưới vòng
    ctx.page.drawText(label, {
      x: cx - labelSize * 0.35,
      y: ty(cy + r + gap),
      size: labelSize,
      font: ctx.font,
      color,
      rotate: degrees(-90),
    });
  }
  return { labelW, gap };
}

/** Cùng Ø + khoảng cách + chiều dài → cùng số hiệu. */
function rebarSpecKey(dia: number, spacing: number, lengthMm: number) {
  return `${dia}|${spacing}|${Math.round(lengthMm)}`;
}

function barSegLengthMm(bar: {
  dir: "X" | "Y";
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
}): number {
  if (bar.dir === "X") return Math.abs((bar.x1 ?? 0) - (bar.x0 ?? 0));
  return Math.abs((bar.y1 ?? 0) - (bar.y0 ?? 0));
}

type RebarSttInfo = { stt: number; dia: number; spacing: number; lengthMm: number };

/**
 * Gán STT 1,2,3… theo (Ø, a, chiều dài).
 * Cùng bộ → cùng số; khác dài hoặc khác Ø → số khác.
 */
function buildRebarSttRegistry(
  entries: Array<{ dia: number; spacing: number; lengthMm: number }>,
): Map<string, RebarSttInfo> {
  const uniq = new Map<string, { dia: number; spacing: number; lengthMm: number }>();
  for (const e of entries) {
    const len = Math.round(e.lengthMm);
    if (!(len > 0)) continue;
    const key = rebarSpecKey(e.dia, e.spacing, len);
    if (!uniq.has(key)) uniq.set(key, { dia: e.dia, spacing: e.spacing, lengthMm: len });
  }
  const sorted = [...uniq.values()].sort(
    (a, b) =>
      a.dia - b.dia ||
      a.spacing - b.spacing ||
      a.lengthMm - b.lengthMm,
  );
  const map = new Map<string, RebarSttInfo>();
  sorted.forEach((e, i) => {
    map.set(rebarSpecKey(e.dia, e.spacing, e.lengthMm), {
      stt: i + 1,
      dia: e.dia,
      spacing: e.spacing,
      lengthMm: e.lengthMm,
    });
  });
  return map;
}

/** STT theo mark (shop/bảng) — theo Ø+a+chiều dài phát triển của mark. */
function rebarSttByMark(schedule: ScheduleRow[]): Map<string, RebarSttInfo> {
  const bySpec = buildRebarSttRegistry(
    schedule.map((r) => ({ dia: r.dia, spacing: r.spacing, lengthMm: r.barLength })),
  );
  const map = new Map<string, RebarSttInfo>();
  for (const row of schedule) {
    if (map.has(row.mark)) continue;
    const info = bySpec.get(rebarSpecKey(row.dia, row.spacing, row.barLength)) ?? {
      stt: map.size + 1,
      dia: row.dia,
      spacing: row.spacing,
      lengthMm: Math.round(row.barLength),
    };
    map.set(row.mark, info);
  }
  return map;
}

/** Khoảng dung sai chiều dài (mm / tỷ lệ) để khớp thanh mặt bằng ↔ thống kê. */
const STT_LEN_ABS_TOL = 350;
const STT_LEN_REL_TOL = 0.1;

function lengthsCloseForStt(a: number, b: number): boolean {
  const d = Math.abs(a - b);
  return d <= STT_LEN_ABS_TOL || d / Math.max(a, b, 1) <= STT_LEN_REL_TOL;
}

/**
 * Chiều dài canonical: nếu gần một dòng thống kê cùng Ø+a+phương thì lấy dài thống kê;
 * không thì giữ chiều dài hình học (thanh cắt / đoạn ngắn → STT riêng).
 */
function canonicalBarLengthMm(
  geoLen: number,
  schedule: ScheduleRow[],
  dia: number,
  spacing: number,
  dir: "X" | "Y",
): number {
  const geo = Math.round(geoLen);
  const sameDir = schedule.filter(
    (r) => r.dia === dia && r.spacing === spacing && r.direction === dir,
  );
  const pool = sameDir.length
    ? sameDir
    : schedule.filter((r) => r.dia === dia && r.spacing === spacing);
  if (!pool.length) return geo;
  const best = pool.reduce((a, b) =>
    Math.abs(a.barLength - geo) <= Math.abs(b.barLength - geo) ? a : b,
  );
  if (lengthsCloseForStt(best.barLength, geo)) return Math.round(best.barLength);
  return geo;
}

/** Registry STT: thống kê + các chiều dài thanh mặt bằng không khớp thống kê. */
function unifiedSttRegistry(
  schedule: ScheduleRow[],
  bars: Array<{
    dir: "X" | "Y";
    x0?: number;
    x1?: number;
    y?: number;
    y0?: number;
    y1?: number;
    x?: number;
  }>,
  zones: RebarZone[],
): Map<string, RebarSttInfo> {
  const entries: Array<{ dia: number; spacing: number; lengthMm: number }> = schedule.map(
    (r) => ({ dia: r.dia, spacing: r.spacing, lengthMm: r.barLength }),
  );
  for (const bar of bars) {
    const spec = steelSpecForBar(zones, schedule, bar);
    const geo = barSegLengthMm(bar);
    const len = canonicalBarLengthMm(geo, schedule, spec.dia, spec.spacing, bar.dir);
    entries.push({ dia: spec.dia, spacing: spec.spacing, lengthMm: len });
  }
  return buildRebarSttRegistry(entries);
}

/** STT mặt bằng: cùng Ø+a+dài (canonical) → cùng số; đoạn ngắn khác dài → số mới. */
function sttInfoForPlanBar(
  schedule: ScheduleRow[],
  registry: Map<string, RebarSttInfo>,
  zones: RebarZone[],
  bar: { dir: "X" | "Y"; x0?: number; x1?: number; y?: number; y0?: number; y1?: number; x?: number },
): RebarSttInfo {
  const spec = steelSpecForBar(zones, schedule, bar);
  const geoLen = barSegLengthMm(bar);
  const len = canonicalBarLengthMm(geoLen, schedule, spec.dia, spec.spacing, bar.dir);
  const info = registry.get(rebarSpecKey(spec.dia, spec.spacing, len));
  if (info) return info;
  return {
    stt: registry.size + 1,
    dia: spec.dia,
    spacing: spec.spacing,
    lengthMm: len,
  };
}

/** Gộp dòng thống kê cùng STT + thêm STT chỉ có trên mặt bằng (thanh ngắn/cắt). */
function scheduleRowsByStt(
  schedule: ScheduleRow[],
  registry: Map<string, RebarSttInfo>,
  bars: Array<{
    dir: "X" | "Y";
    x0?: number;
    x1?: number;
    y?: number;
    y0?: number;
    y1?: number;
    x?: number;
  }>,
  zones: RebarZone[],
  hookMm = 50,
): Array<ScheduleRow & { stt: number }> {
  const sttMap = rebarSttByMark(schedule);
  const groups = new Map<number, ScheduleRow & { stt: number }>();
  for (const row of schedule) {
    const fromReg = registry.get(rebarSpecKey(row.dia, row.spacing, row.barLength));
    const info =
      fromReg ??
      sttMap.get(row.mark) ?? {
        stt: groups.size + 1,
        dia: row.dia,
        spacing: row.spacing,
        lengthMm: Math.round(row.barLength),
      };
    const prev = groups.get(info.stt);
    if (!prev) {
      groups.set(info.stt, { ...row, stt: info.stt });
      continue;
    }
    groups.set(info.stt, {
      ...prev,
      qtyMembers: prev.qtyMembers + row.qtyMembers,
      qtyTotal: prev.qtyTotal + row.qtyTotal,
      totalM: prev.totalM + row.totalM,
      weight: prev.weight + row.weight,
      note: [prev.note, row.note].filter(Boolean).join(" · ") || prev.note,
    });
  }

  // Đếm thanh mặt bằng theo key STT
  const barCounts = new Map<string, { count: number; dir: "X" | "Y" }>();
  for (const bar of bars) {
    const spec = steelSpecForBar(zones, schedule, bar);
    const len = canonicalBarLengthMm(
      barSegLengthMm(bar),
      schedule,
      spec.dia,
      spec.spacing,
      bar.dir,
    );
    const key = rebarSpecKey(spec.dia, spec.spacing, len);
    const cur = barCounts.get(key) ?? { count: 0, dir: bar.dir };
    cur.count += 1;
    cur.dir = bar.dir;
    barCounts.set(key, cur);
  }

  for (const info of registry.values()) {
    if (groups.has(info.stt)) continue;
    const key = rebarSpecKey(info.dia, info.spacing, info.lengthMm);
    const hit = barCounts.get(key);
    const hook = 0;
    const qty = Math.max(1, hit?.count ?? 1);
    const totalM = (info.lengthMm * qty) / 1000;
    groups.set(info.stt, {
      mark: `MB-${info.stt}`,
      layer: "bottom",
      direction: hit?.dir ?? "X",
      dia: info.dia,
      spacing: info.spacing,
      barLength: info.lengthMm,
      leftHook: hook,
      rightHook: hook,
      qtyEach: qty,
      qtyMembers: 1,
      qtyTotal: qty,
      totalM,
      weight: totalM * weightPerMeter(info.dia),
      shape: "straight",
      note: "Đoạn mặt bằng (cắt/ngắn)",
      stt: info.stt,
    });
  }

  return [...groups.values()].sort((a, b) => a.stt - b.stt);
}

/** Ø+a cho một thanh: zone cùng phương phủ tâm thanh. */
function steelSpecForBar(
  zones: RebarZone[],
  schedule: ScheduleRow[],
  bar: { dir: "X" | "Y"; x0?: number; x1?: number; y?: number; y0?: number; y1?: number; x?: number },
): { dia: number; spacing: number } {
  const mx = bar.dir === "X" ? ((bar.x0 ?? 0) + (bar.x1 ?? 0)) / 2 : (bar.x ?? 0);
  const my = bar.dir === "X" ? (bar.y ?? 0) : ((bar.y0 ?? 0) + (bar.y1 ?? 0)) / 2;
  const hits = zones.filter((z) => {
    if (z.direction !== bar.dir) return false;
    const zx0 = Math.min(z.x1, z.x2);
    const zx1 = Math.max(z.x1, z.x2);
    const zy0 = Math.min(z.y1, z.y2);
    const zy1 = Math.max(z.y1, z.y2);
    return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
  });
  const z = hits.find((h) => h.layer === "bottom") ?? hits[0];
  if (z) return { dia: z.dia, spacing: z.spacing };
  const row = schedule.find((r) => r.direction === bar.dir) ?? schedule[0];
  return { dia: row?.dia ?? 10, spacing: row?.spacing ?? 150 };
}

function textVertical(ctx: Ctx, str: string, cx: number, yMid: number, size = 11, bold = true) {
  const font = bold ? ctx.fontBold : ctx.font;
  const width = font.widthOfTextAtSize(str, size);
  ctx.page.drawText(str, {
    x: cx - size * 0.35,
    y: ty(yMid) - width / 2,
    size,
    font,
    color: BLACK,
    rotate: degrees(90),
  });
}

function dimH(ctx: Ctx, x1: number, x2: number, y: number, label: string, size = 6.5) {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  line(ctx, lo, y, hi, y, 0.45);
  line(ctx, lo, y - 3, lo, y + 3, 0.45);
  line(ctx, hi, y - 3, hi, y + 3, 0.45);
  // Số nằm ngang — song song đường dim ngang
  textSimple(ctx, label, (lo + hi) / 2, y - 1, size, false, "center");
}

function dimV(
  ctx: Ctx,
  x: number,
  y1: number,
  y2: number,
  label: string,
  size = 6.5,
  /** Phía đặt số so với đường dim (ngoài bản vẽ). */
  labelSide: "left" | "right" = "left",
) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  line(ctx, x, lo, x, hi, 0.45);
  line(ctx, x - 3, lo, x + 3, lo, 0.45);
  line(ctx, x - 3, hi, x + 3, hi, 0.45);
  // Số xoay dọc — song song đường dim đứng
  const tx = labelSide === "left" ? x - 5 : x + 5;
  textVertical(ctx, label, tx, (lo + hi) / 2, size, false);
}

/** Chuỗi dim ngang theo các mốc mm (thế giới → PDF qua toX). */
function dimHChain(
  ctx: Ctx,
  marksMm: number[],
  y: number,
  toX: (mm: number) => number,
  size = 5.5,
) {
  for (let i = 0; i < marksMm.length - 1; i++) {
    const a = marksMm[i];
    const b = marksMm[i + 1];
    const mm = Math.round(Math.abs(b - a));
    if (mm < 1) continue;
    dimH(ctx, toX(a), toX(b), y, String(mm), size);
  }
}

/** Chuỗi dim đứng theo các mốc mm (thế giới → PDF qua toY). */
function dimVChain(
  ctx: Ctx,
  marksMm: number[],
  x: number,
  toY: (mm: number) => number,
  size = 5.5,
  labelSide: "left" | "right" = "left",
) {
  for (let i = 0; i < marksMm.length - 1; i++) {
    const a = marksMm[i];
    const b = marksMm[i + 1];
    const mm = Math.round(Math.abs(b - a));
    if (mm < 1) continue;
    dimV(ctx, x, toY(a), toY(b), String(mm), size, labelSide);
  }
}

/** Da dầm tại trục (fallback tiết diện nếu đoạn bị bỏ). */
function facesAtAxisSpan(
  project: SlabProject,
  beamDir: PlanBeam["direction"],
  axis: GridAxis,
  spanIndex: number,
): { lo: number; hi: number } {
  const f = beamOuterFacesAtSpan(project, beamDir, axis, spanIndex);
  if (Math.abs(f.hi - f.lo) >= 1) return f;
  return beamOuterFaces(axis.pos, beamSectionOnAxis(project, beamDir, axis));
}

/**
 * Chuỗi mốc da dầm + lòng sàn theo phương X (dầm đứng trên axesX).
 * [lo0, hi0, lo1, hi1, …] → đoạn hi−lo = B dầm; lo(i+1)−hi(i) = bề rộng sàn.
 */
function faceChainAlongX(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
): number[] {
  if (axesX.length === 0) return [];
  const spanIy = Math.max(0, Math.min(axesY.length - 2, Math.floor((axesY.length - 1) / 2)));
  const pts: number[] = [];
  for (const ax of axesX) {
    const f = facesAtAxisSpan(project, "Y", ax, spanIy);
    const lo = Math.min(f.lo, f.hi);
    const hi = Math.max(f.lo, f.hi);
    if (pts.length === 0 || Math.abs(pts[pts.length - 1] - lo) > 0.5) pts.push(lo);
    else pts[pts.length - 1] = lo;
    pts.push(hi);
  }
  return pts;
}

/** Chuỗi mốc da dầm + lòng sàn theo phương Y (dầm ngang trên axesY). */
function faceChainAlongY(
  project: SlabProject,
  axesX: GridAxis[],
  axesY: GridAxis[],
): number[] {
  if (axesY.length === 0) return [];
  const spanIx = Math.max(0, Math.min(axesX.length - 2, Math.floor((axesX.length - 1) / 2)));
  const pts: number[] = [];
  for (const ay of axesY) {
    const f = facesAtAxisSpan(project, "X", ay, spanIx);
    const lo = Math.min(f.lo, f.hi);
    const hi = Math.max(f.lo, f.hi);
    if (pts.length === 0 || Math.abs(pts[pts.length - 1] - lo) > 0.5) pts.push(lo);
    else pts[pts.length - 1] = lo;
    pts.push(hi);
  }
  return pts;
}

function drawShape(ctx: Ctx, row: ScheduleRow, x: number, y: number, w: number, h: number) {
  const midY = y + h * 0.58;
  const x0 = x + 10;
  const x1 = x + w - 10;
  const hook = Math.min(h * 0.5, 12);
  line(ctx, x0, midY, x1, midY, 1.05);
  if (row.leftHook > 0) {
    line(ctx, x0, midY, x0, midY - hook, 1.05);
  }
  if (row.rightHook > 0) {
    line(ctx, x1, midY, x1, midY - hook, 1.05);
  }
  const straight = row.barLength - row.leftHook - row.rightHook;
  textSimple(ctx, String(straight), (x0 + x1) / 2, midY - 9, 5.8, false, "center");
  if (row.leftHook > 0) textSimple(ctx, String(row.leftHook), x0 - 2, y + 2, 5.2);
  if (row.rightHook > 0) textSimple(ctx, String(row.rightHook), x1 - 14, y + 2, 5.2);
}

function fmtNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0";
  const t = n.toFixed(digits);
  return t.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function planScale(project: SlabProject, maxW: number, maxH: number) {
  const sx = maxW / Math.max(project.planWidth, 1);
  const sy = maxH / Math.max(project.planHeight, 1);
  return Math.min(sx, sy);
}

function drawPlan(
  ctx: Ctx,
  ox: number,
  oy: number,
  maxW: number,
  maxH: number,
  zones: RebarZone[],
) {
  const { project } = ctx;
  const s = planScale(project, maxW, maxH);
  const pw = project.planWidth * s;
  const ph = project.planHeight * s;
  const x0 = ox + (maxW - pw) / 2;
  const y0 = oy;

  const toX = (mm: number) => x0 + mm * s;
  const toY = (mm: number) => y0 + (project.planHeight - mm) * s;

  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const bleed = planBeamBleed(project, axesX, axesY);
  const edgeLeft = toX(bleed.xMin);
  const edgeRight = toX(bleed.xMax);
  const edgeBottom = toY(bleed.yMin);
  const edgeTop = toY(bleed.yMax);

  // Khung ngoài sàn (da dầm biên) — nét liền
  rect(ctx, edgeLeft, edgeTop, edgeRight - edgeLeft, edgeBottom - edgeTop, 1.0);

  // —— Tim trục: nét gạch–chấm liên tục xuyên mặt bằng ——
  for (let i = 0; i < axesX.length; i++) {
    const ax = axesX[i];
    const x = toX(ax.pos);
    const by = edgeBottom + AXIS_BUBBLE_OFFSET;
    line(ctx, x, edgeTop, x, edgeBottom, 0.4, AXIS_LINE, AXIS_CENTERLINE_DASH);
    line(ctx, x, by - AXIS_BUBBLE_R, x, edgeBottom, 0.35, BLACK, [2, 1.5]);
    ctx.page.drawCircle({
      x,
      y: ty(by),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.7,
    });
    textInAxisBubble(ctx, ax.name, x, by);
  }
  for (let i = 0; i < axesY.length; i++) {
    const ay = axesY[i];
    const y = toY(ay.pos);
    const bx = edgeLeft - AXIS_BUBBLE_OFFSET;
    line(ctx, edgeLeft, y, edgeRight, y, 0.4, AXIS_LINE, AXIS_CENTERLINE_DASH);
    line(ctx, bx + AXIS_BUBBLE_R, y, edgeLeft, y, 0.35, BLACK, [2, 1.5]);
    ctx.page.drawCircle({
      x: bx,
      y: ty(y),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.7,
    });
    textInAxisBubble(ctx, ay.name, bx, y);
  }

  // —— Dầm: da ngoài (biên sàn) nét liền; da trong (vào ô) nét đứt (không ghi tên dầm) ——
  for (const b of project.beams) {
    drawBeam(ctx, b, toX, toY, bleed);
  }

  for (const ls of project.lowSlabs ?? []) {
    const lx0 = ls.x;
    const ly0 = ls.y;
    const lx1 = ls.x + ls.w;
    const ly1 = ls.y + ls.h;
    rect(ctx, toX(lx0), toY(ly1), ls.w * s, ls.h * s, 0.55);
    for (const seg of rectDiagonalHatchSegments(lx0, ly0, lx1, ly1, 200)) {
      line(ctx, toX(seg.xA), toY(seg.yA), toX(seg.xB), toY(seg.yB), 0.4, GRAY);
    }
    textSimple(
      ctx,
      `${ls.name || "ST"}${(ls.rebarMode ?? "press") === "cut" ? " · cắt" : " · nhấn"}`,
      toX((lx0 + lx1) / 2),
      toY((ly0 + ly1) / 2),
      6,
      false,
      "center",
    );
  }

  for (const o of project.openings ?? []) {
    const ox0 = o.x;
    const oy0 = o.y;
    const ox1 = o.x + o.w;
    const oy1 = o.y + o.h;
    rect(ctx, toX(ox0), toY(oy1), o.w * s, o.h * s, 0.65);
    const [d1, d2] = rectOpeningDiagonals(ox0, oy0, ox1, oy1);
    line(ctx, toX(d1.xA), toY(d1.yA), toX(d1.xB), toY(d1.yB), 0.7, BLACK, [5, 3]);
    line(ctx, toX(d2.xA), toY(d2.yA), toX(d2.xB), toY(d2.yB), 0.7, BLACK, [5, 3]);
    textSimple(ctx, o.name || "Ô", toX((ox0 + ox1) / 2), toY((oy0 + oy1) / 2), 6.5, true, "center");
  }

  // —— Thép sàn (chỉ nét đỏ) + vòng STT + Øa ——
  const hook = SLAB_REBAR_HOOK_MM;
  const pressAmber = rgb(0.9, 0.55, 0.1);
  const bars = stripRebarBarSegments(project, axesX, axesY);
  for (const bar of bars) {
    if (bar.dir === "X") {
      line(ctx, toX(bar.x0), toY(bar.y), toX(bar.x1), toY(bar.y), 0.55, REBAR_RED);
      line(ctx, toX(bar.x0), toY(bar.y), toX(bar.x0), toY(bar.y - hook), 0.55, REBAR_RED);
      line(ctx, toX(bar.x1), toY(bar.y), toX(bar.x1), toY(bar.y - hook), 0.55, REBAR_RED);
    } else {
      line(ctx, toX(bar.x), toY(bar.y0), toX(bar.x), toY(bar.y1), 0.55, REBAR_RED);
      line(ctx, toX(bar.x), toY(bar.y0), toX(bar.x + hook), toY(bar.y0), 0.55, REBAR_RED);
      line(ctx, toX(bar.x), toY(bar.y1), toX(bar.x + hook), toY(bar.y1), 0.55, REBAR_RED);
    }
  }
  const tick = 70;
  for (const m of stripRebarPressMarks(project, axesX, axesY)) {
    if (m.dir === "X") {
      line(ctx, toX(m.x), toY(m.y - tick), toX(m.x), toY(m.y + tick), 0.55, pressAmber);
      line(ctx, toX(m.x - tick * 0.35), toY(m.y + tick * 0.55), toX(m.x), toY(m.y + tick), 0.55, pressAmber);
      line(ctx, toX(m.x + tick * 0.35), toY(m.y + tick * 0.55), toX(m.x), toY(m.y + tick), 0.55, pressAmber);
    } else {
      line(ctx, toX(m.x - tick), toY(m.y), toX(m.x + tick), toY(m.y), 0.55, pressAmber);
      line(ctx, toX(m.x + tick * 0.55), toY(m.y - tick * 0.35), toX(m.x + tick), toY(m.y), 0.55, pressAmber);
      line(ctx, toX(m.x + tick * 0.55), toY(m.y + tick * 0.35), toX(m.x + tick), toY(m.y), 0.55, pressAmber);
    }
    textSimple(ctx, `↓${m.drop}`, toX(m.x) + 4, toY(m.y) - 4, 5.5, false, "left");
  }

  // Số hiệu trên từng thanh: đỏ; dài giống thống kê → cùng STT; đoạn ngắn → STT mới
  const CALL_GAP = 8;
  const sttRegistry = unifiedSttRegistry(ctx.model.schedule, bars, zones);
  for (const bar of bars) {
    const info = sttInfoForPlanBar(ctx.model.schedule, sttRegistry, zones, bar);
    const label = `Ø${info.dia}a${info.spacing}`;
    const labelW = ctx.font.widthOfTextAtSize(label, 6.2);
    const gap = 2.5;
    const rowLen = REBAR_MARK_R * 2 + gap + labelW;

    if (bar.dir === "X") {
      const midX = toX((bar.x0 + bar.x1) / 2);
      const barY = toY(bar.y);
      // Cụm [vòng|Øa] căn giữa thanh, đặt phía dưới thanh (không chạm)
      const cy = barY + REBAR_MARK_R + CALL_GAP;
      const cx = midX - rowLen / 2 + REBAR_MARK_R;
      drawRebarCallout(ctx, cx, cy, info.stt, info.dia, info.spacing, "X");
    } else {
      const midY = toY((bar.y0 + bar.y1) / 2);
      const barX = toX(bar.x);
      // Cụm dọc căn giữa thanh, đặt bên phải thanh (không chạm)
      const cx = barX + REBAR_MARK_R + CALL_GAP;
      const cy = midY - rowLen / 2 + REBAR_MARK_R;
      drawRebarCallout(ctx, cx, cy, info.stt, info.dia, info.spacing, "Y");
    }
  }

  // —— Khoảng rải thép sàn: đường xanh ⊥ phương thanh (đầu mũi tên) ——
  const distZones = zones.filter((z) => z.showSpacing);
  for (let zi = 0; zi < distZones.length; zi++) {
    const z = distZones[zi];
    const zx0 = Math.min(z.x1, z.x2);
    const zx1 = Math.max(z.x1, z.x2);
    const zy0 = Math.min(z.y1, z.y2);
    const zy1 = Math.max(z.y1, z.y2);
    const nudge =
      (z.layer === "top" ? 1 : z.layer === "structural" ? -1 : 0) * 120 + (zi % 3) * 40;
    let xA: number;
    let yA: number;
    let xB: number;
    let yB: number;
    let lenMm: number;
    if (z.direction === "X") {
      // Thanh ngang → khoảng rải dọc Y
      const mx = (zx0 + zx1) / 2 + nudge;
      xA = mx;
      yA = zy0;
      xB = mx;
      yB = zy1;
      lenMm = zy1 - zy0;
    } else {
      // Thanh đứng → khoảng rải ngang X
      const my = (zy0 + zy1) / 2 + nudge;
      xA = zx0;
      yA = my;
      xB = zx1;
      yB = my;
      lenMm = zx1 - zx0;
    }
    if (!(lenMm > 1)) continue;
    const pxA = toX(xA);
    const pyA = toY(yA);
    const pxB = toX(xB);
    const pyB = toY(yB);
    line(ctx, pxA, pyA, pxB, pyB, 1.1, DIST_BLUE);
    drawDistArrow(ctx, pxA, pyA, pxB, pyB);
    drawDistArrow(ctx, pxB, pyB, pxA, pyA);
    // Chấm trắng tại giao với thanh thép cùng zone (giống bản CAD)
    for (const bar of bars) {
      if (bar.dir === "X" && z.direction === "X") {
        // Thanh ngang cắt đường khoảng rải đứng tại (mx, bar.y)
        if (bar.y < zy0 - 1 || bar.y > zy1 + 1) continue;
        const bx0 = Math.min(bar.x0, bar.x1);
        const bx1 = Math.max(bar.x0, bar.x1);
        if (xA < bx0 - 1 || xA > bx1 + 1) continue;
        ctx.page.drawCircle({
          x: toX(xA),
          y: ty(toY(bar.y)),
          size: 2.0,
          color: rgb(1, 1, 1),
          borderColor: DIST_BLUE,
          borderWidth: 0.65,
        });
      } else if (bar.dir === "Y" && z.direction === "Y") {
        if (bar.x < zx0 - 1 || bar.x > zx1 + 1) continue;
        const by0 = Math.min(bar.y0, bar.y1);
        const by1 = Math.max(bar.y0, bar.y1);
        if (yA < by0 - 1 || yA > by1 + 1) continue;
        ctx.page.drawCircle({
          x: toX(bar.x),
          y: ty(toY(yA)),
          size: 2.0,
          color: rgb(1, 1, 1),
          borderColor: DIST_BLUE,
          borderWidth: 0.65,
        });
      }
    }
    const label = String(Math.round(lenMm));
    if (z.direction === "X") {
      textSimple(ctx, label, (pxA + pxB) / 2 + 6, (pyA + pyB) / 2, 6.5, true, "left", DIST_BLUE);
    } else {
      textSimple(ctx, label, (pxA + pxB) / 2, (pyA + pyB) / 2 - 8, 6.5, true, "center", DIST_BLUE);
    }
  }

  // —— Đường dim: da dầm + lòng sàn · tim trục · tổng ——
  const DIM_GAP = 11;
  const faceX = faceChainAlongX(project, axesX, axesY);
  const faceY = faceChainAlongY(project, axesX, axesY);
  const axisXMarks = axesX.map((a) => a.pos);
  const axisYMarks = axesY.map((a) => a.pos);

  // Ngang (phương X): dưới vòng trục — sát trong → ngoài
  let yDim = edgeBottom + AXIS_BUBBLE_OFFSET + AXIS_BUBBLE_R + 6;
  if (faceX.length >= 2) {
    dimHChain(ctx, faceX, yDim, toX, 5.2); // B dầm + bề rộng sàn
    yDim += DIM_GAP;
  }
  if (axisXMarks.length >= 2) {
    dimHChain(ctx, axisXMarks, yDim, toX, 5.5); // tim trục
    yDim += DIM_GAP;
  }
  dimH(ctx, toX(bleed.xMin), toX(bleed.xMax), yDim, `${Math.round(bleed.xMax - bleed.xMin)}`, 6.5);
  const dimBottomY = yDim;

  // Đứng (phương Y): trái vòng trục — sát trong → ngoài (x giảm)
  let xDim = edgeLeft - AXIS_BUBBLE_OFFSET - AXIS_BUBBLE_R - 6;
  if (faceY.length >= 2) {
    dimVChain(ctx, faceY, xDim, toY, 5.2, "left");
    xDim -= DIM_GAP;
  }
  if (axisYMarks.length >= 2) {
    dimVChain(ctx, axisYMarks, xDim, toY, 5.5, "left");
    xDim -= DIM_GAP;
  }
  dimV(
    ctx,
    xDim,
    toY(bleed.yMin),
    toY(bleed.yMax),
    `${Math.round(bleed.yMax - bleed.yMin)}`,
    6.5,
    "left",
  );

  // Tiêu đề + tỉ lệ: dưới bản vẽ, hở khỏi số dim ngang
  const titleY = dimBottomY + 28;
  textSimple(ctx, "MẶT BẰNG CỐT THÉP SÀN", ox + maxW / 2, titleY, 12, true, "center");
  textSimple(ctx, `TL: 1/${project.info.drawingScale}`, ox + maxW / 2, titleY + 14, 8, false, "center");

  return titleY + 24;
}

/**
 * Trừ các khoảng cắt khỏi [from, to] → các đoạn còn lại (mm).
 */
function subtractIntervals(
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
function crossBodyCutsAlong(
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
    crossDir === "X"
      ? sortAxes(project.axesX ?? [])
      : sortAxes(project.axesY ?? []);

  for (const other of project.beams ?? []) {
    if (other.direction !== crossDir) continue;
    for (const seg of beamSegments(project, other)) {
      if (isBeamSegOmitted(other, seg.a0.id, seg.a1.id)) continue;
      const s0 = Math.min(seg.lo, seg.hi);
      const s1 = Math.max(seg.lo, seg.hi);
      // Face của dầm đang vẽ có giao bề rộng “dọc” của dầm kia?
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

/**
 * Vẽ một da dầm, đã cắt đoạn xuyên thân dầm giao.
 * Y-beam: along = Y, face = X; X-beam: along = X, face = Y.
 */
function drawBeamFaceClipped(
  ctx: Ctx,
  beamDir: PlanBeam["direction"],
  face0: number,
  face1: number,
  along0: number,
  along1: number,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
  dash: number[] | undefined,
  project: SlabProject,
) {
  const cuts = crossBodyCutsAlong(project, beamDir, face0, face1, along0, along1);
  const parts = subtractIntervals(along0, along1, cuts);
  const span = along1 - along0;
  for (const [a0, a1] of parts) {
    if (Math.abs(span) < 1e-6) continue;
    const t0 = (a0 - along0) / span;
    const t1 = (a1 - along0) / span;
    const f0 = face0 + t0 * (face1 - face0);
    const f1 = face0 + t1 * (face1 - face0);
    if (beamDir === "Y") {
      line(ctx, toX(f0), toY(a0), toX(f1), toY(a1), BEAM_STROKE, BLACK, dash);
    } else {
      line(ctx, toX(a0), toY(f0), toX(a1), toY(f1), BEAM_STROKE, BLACK, dash);
    }
  }
}

/**
 * Vẽ dầm đúng bề rộng B: da ngoài nét liền, da trong nét đứt;
 * cắt nét tại chỗ giao thân dầm (không xuyên cắt qua nhau).
 */
function drawBeam(
  ctx: Ctx,
  b: PlanBeam,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
  bleed: { xMin: number; xMax: number; yMin: number; yMax: number },
) {
  const { project } = ctx;
  const segs = beamSegments(project, b);
  const eps = 2; // mm — nhận diện da trùng biên sàn

  for (const seg of segs) {
    if (isBeamSegOmitted(b, seg.a0.id, seg.a1.id)) continue;
    const { lo0, hi0, lo1, hi1 } = beamSegSideFaces(b, seg.index);
    const lo = seg.lo;
    const hi = seg.hi;
    if (b.direction === "Y") {
      const loMid = (lo0 + lo1) / 2;
      const hiMid = (hi0 + hi1) / 2;
      const loOuter = Math.abs(loMid - bleed.xMin) <= eps;
      const hiOuter = Math.abs(hiMid - bleed.xMax) <= eps;
      drawBeamFaceClipped(
        ctx,
        "Y",
        lo0,
        lo1,
        lo,
        hi,
        toX,
        toY,
        loOuter ? undefined : BEAM_INNER_DASH,
        project,
      );
      drawBeamFaceClipped(
        ctx,
        "Y",
        hi0,
        hi1,
        lo,
        hi,
        toX,
        toY,
        hiOuter ? undefined : BEAM_INNER_DASH,
        project,
      );
    } else {
      const loMid = (lo0 + lo1) / 2;
      const hiMid = (hi0 + hi1) / 2;
      const loOuter = Math.abs(loMid - bleed.yMin) <= eps;
      const hiOuter = Math.abs(hiMid - bleed.yMax) <= eps;
      drawBeamFaceClipped(
        ctx,
        "X",
        lo0,
        lo1,
        lo,
        hi,
        toX,
        toY,
        loOuter ? undefined : BEAM_INNER_DASH,
        project,
      );
      drawBeamFaceClipped(
        ctx,
        "X",
        hi0,
        hi1,
        lo,
        hi,
        toX,
        toY,
        hiOuter ? undefined : BEAM_INNER_DASH,
        project,
      );
    }
  }
}

/** Toàn bộ dòng thống kê PDF (gồm STT thanh ngắn trên mặt bằng). */
function buildPdfScheduleRows(ctx: Ctx): Array<ScheduleRow & { stt: number }> {
  const { project, model } = ctx;
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const zones = effectiveZones(project);
  const bars = stripRebarBarSegments(project, axesX, axesY);
  const registry = unifiedSttRegistry(model.schedule, bars, zones);
  return scheduleRowsByStt(
    model.schedule,
    registry,
    bars,
    zones,
    project.info.cover || 50,
  );
}

function drawShops(ctx: Ctx, yStart: number, _rows: ScheduleRow[]) {
  let y = yStart;
  textSimple(ctx, "SHOP NỔ THÉP SÀN", 40, y, 11, true);
  y += 18;
  const colW = 260;
  const rowH = 52;
  const ordered = buildPdfScheduleRows(ctx);
  ordered.forEach((row, i) => {
    const col = i % 3;
    const r = Math.floor(i / 3);
    const x = 36 + col * (colW + 16);
    const yy = y + r * (rowH + 10);
    rect(ctx, x, yy, colW, rowH, 0.7);
    drawRebarCallout(ctx, x + 14, yy + 12, row.stt, row.dia, row.spacing);
    textSimple(ctx, row.mark, x + 8, yy + 26, 6.5, false, "left");
    textSimple(
      ctx,
      `${row.layer} · ${row.direction}`,
      x + 70,
      yy + 26,
      6.5,
    );
    drawShape(ctx, row, x + 8, yy + 30, colW - 16, 18);
  });
  const rowsN = Math.ceil(Math.max(ordered.length, 1) / 3);
  return y + rowsN * (rowH + 10) + 8;
}

function drawSection(ctx: Ctx, x: number, y: number) {
  const { project, model } = ctx;
  const scale = 0.35;
  const slabT = Math.max(model.thickness * scale, 18);
  const beam = parseBeamSize(project.info.beamSizeX);
  const beamH = beam.h * scale * 0.45;
  const beamB = beam.b * scale * 0.55;
  const W = 220;
  textSimple(ctx, `MẶT CẮT ${project.sections[0]?.name ?? "1"}-1`, x + W / 2, y, 10, true, "center");
  const sy = y + 16;
  // slab
  rect(ctx, x + 20, sy, W - 40, slabT, 0.9);
  // beams under ends
  rect(ctx, x + 20 - beamB * 0.15, sy + slabT, beamB, beamH, 0.9);
  rect(ctx, x + W - 20 - beamB * 0.85, sy + slabT, beamB, beamH, 0.9);
  // rebar dots
  const n = 6;
  for (let i = 0; i < n; i++) {
    const px = x + 28 + ((W - 56) * i) / (n - 1);
    ctx.page.drawCircle({
      x: px,
      y: ty(sy + slabT * 0.35),
      size: 2.2,
      color: BLACK,
    });
    ctx.page.drawCircle({
      x: px,
      y: ty(sy + slabT * 0.72),
      size: 2.2,
      borderColor: BLACK,
      borderWidth: 0.6,
    });
  }
  dimV(ctx, x + W - 8, sy, sy + slabT, `${project.info.thickness}`, 6.5, "right");
  textSimple(ctx, `Lớp BV ${project.info.cover}`, x + W / 2, sy + slabT + beamH + 14, 7, false, "center");
  return sy + slabT + beamH + 28;
}

/** Phối cảnh dầm sàn isometric (hidden-line) — giống bản vẽ shop. */
function drawPhốiCảnh(ctx: Ctx, x: number, y: number, maxW: number, maxH: number) {
  const scene = buildBeamFrameScene(ctx.project);
  const view = projectSceneToSvg(scene, { width: maxW, height: maxH - 28, pad: 16 });
  const ox = x;
  const oy = y + 4;

  for (const poly of view.polygons) {
    const pts = poly.points.split(" ").map((pair) => {
      const [px, py] = pair.split(",").map(Number);
      return { x: ox + px, y: oy + py };
    });
    if (pts.length < 3) continue;
    const path =
      pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${ty(p.y)}`).join(" ") + " Z";
    // Chỉ tô trắng — nét cạnh vẽ riêng (liền / đứt)
    ctx.page.drawSvgPath(path, {
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
    if (poly.kind === "hatch") {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        for (let t = 0.2; t < 0.9; t += 0.25) {
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          ctx.page.drawCircle({ x: px, y: ty(py), size: 0.6, color: GRAY });
        }
      }
    }
  }

  for (const e of view.edges) {
    if (e.style === "dashed") {
      line(ctx, ox + e.x1, oy + e.y1, ox + e.x2, oy + e.y2, 0.45, GRAY, [3.2, 2]);
    } else {
      line(ctx, ox + e.x1, oy + e.y1, ox + e.x2, oy + e.y2, 0.95, BLACK);
    }
  }

  for (const ln of view.lines) {
    line(ctx, ox + ln.x1, oy + ln.y1, ox + ln.x2, oy + ln.y2, 0.65, GRAY, [4, 3]);
  }

  for (const m of view.marks) {
    const mx = ox + m.x;
    const my = oy + m.y;
    // Tam giác cao độ
    const path = `M ${mx - 5} ${ty(my)} L ${mx + 5} ${ty(my)} L ${mx} ${ty(my - 8)} Z`;
    ctx.page.drawSvgPath(path, { color: BLACK });
    line(ctx, mx, my, mx, my + 10, 0.6);
    textSimple(ctx, m.elevText, mx + 8, my - 2, 7, true, "left");
    textSimple(ctx, m.hsText, mx + 8, my + 10, 6.5, false, "left");
  }

  textSimple(ctx, view.title, x + maxW / 2, y + maxH - 14, 9, true, "center");
  textSimple(ctx, view.subtitle, x + maxW / 2, y + maxH - 2, 7, false, "center");
  return y + maxH;
}

function drawScheduleTable(ctx: Ctx, x: number, y: number) {
  const { project } = ctx;
  const rows = buildPdfScheduleRows(ctx);
  const cols = [
    { w: 36 },
    { w: 40 },
    { w: 168 },
    { w: 28 },
    { w: 52 },
    { w: 28 },
    { w: 36 },
    { w: 40 },
    { w: 48 },
    { w: 50 },
  ];
  const w = cols.reduce((s, c) => s + c.w, 0);
  const headerH = 34;
  const rowH = 18;
  const h = headerH + Math.max(rows.length, 1) * rowH;
  textSimple(ctx, "BẢNG THỐNG KÊ CỐT THÉP SÀN", x + w / 2, y + 2, 10.5, true, "center");
  const ty0 = y + 18;
  rect(ctx, x, ty0, w, h, 0.9);
  const colX: number[] = [];
  let cx = x;
  for (const c of cols) {
    colX.push(cx);
    cx += c.w;
  }
  const mid = (i: number) => colX[i] + cols[i].w / 2;
  for (let i = 1; i < cols.length; i++) line(ctx, colX[i], ty0, colX[i], ty0 + h, 0.4);
  line(ctx, x, ty0 + headerH, x + w, ty0 + headerH, 0.7);

  const headers = [
    "TÊN CK",
    "STT",
    "HÌNH DẠNG",
    "Ø",
    "DÀI 1",
    "SL CK",
    "1 CK",
    "TỔNG",
    "DÀI (m)",
    "KG",
  ];
  headers.forEach((lb, i) => textSimple(ctx, lb, mid(i), ty0 + headerH / 2 + 2, 6, false, "center"));

  rows.forEach((row, i) => {
    const ry = ty0 + headerH + i * rowH;
    line(ctx, colX[1], ry + rowH, x + w, ry + rowH, 0.3);
    textSimple(ctx, String(row.stt), mid(1), ry + rowH / 2 + 2, 7, true, "center");
    drawShape(ctx, row, colX[2] + 2, ry + 1, cols[2].w - 4, rowH - 2);
    textSimple(ctx, String(row.dia), mid(3), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.barLength), mid(4), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.qtyMembers), mid(5), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.qtyEach), mid(6), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.qtyTotal), mid(7), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, fmtNum(row.totalM), mid(8), ry + rowH / 2 + 2, 6.8, false, "center");
    textSimple(ctx, fmtNum(row.weight), mid(9), ry + rowH / 2 + 2, 6.8, false, "center");
  });
  if (rows.length === 0) {
    textSimple(ctx, "—", mid(1), ty0 + headerH + rowH / 2, 7, false, "center");
  }
  textVertical(
    ctx,
    project.info.name || "SÀN",
    mid(0),
    ty0 + headerH + (Math.max(rows.length, 1) * rowH) / 2,
    9,
    true,
  );
  return { w, h: h + 16 };
}

function drawSummaryTable(ctx: Ctx, x: number, y: number) {
  const { model } = ctx;
  const rows = buildPdfScheduleRows(ctx);
  const byDiaMap = new Map<number, { dia: number; lengthM: number; weight: number }>();
  for (const r of rows) {
    const cur = byDiaMap.get(r.dia) ?? { dia: r.dia, lengthM: 0, weight: 0 };
    cur.lengthM += r.totalM;
    cur.weight += r.weight;
    byDiaMap.set(r.dia, cur);
  }
  const dias = [...byDiaMap.values()].sort((a, b) => a.dia - b.dia);
  const totalWeight = dias.reduce((s, d) => s + d.weight, 0);
  const colW = 78;
  const labW = 138;
  const w = labW + Math.max(dias.length, 1) * colW;
  const rowH = 24;
  const nRows = 4;
  const gridH = nRows * rowH;
  textSimple(ctx, "TỔNG HỢP CỐT THÉP", x + w / 2, y + 2, 10.5, true, "center");
  const ty0 = y + 18;
  rect(ctx, x, ty0, w, gridH, 0.9);
  line(ctx, x + labW, ty0, x + labW, ty0 + gridH, 0.5);
  for (let i = 1; i < Math.max(dias.length, 1); i++) {
    line(ctx, x + labW + i * colW, ty0, x + labW + i * colW, ty0 + gridH, 0.45);
  }
  const labels = ["ĐƯỜNG KÍNH (mm):", "CHIỀU DÀI (m):", "TRỌNG LƯỢNG (kg):", "SỐ THANH 11.7m:"];
  labels.forEach((lb, i) => {
    if (i > 0) line(ctx, x, ty0 + i * rowH, x + w, ty0 + i * rowH, 0.4);
    textSimple(ctx, lb, x + 8, ty0 + i * rowH + 14, 7);
  });
  dias.forEach((d, i) => {
    const cx = x + labW + i * colW + colW / 2;
    textSimple(ctx, `Ø${d.dia}`, cx, ty0 + 14, 8, true, "center");
    textSimple(ctx, fmtNum(d.lengthM), cx, ty0 + rowH + 14, 7.5, false, "center");
    textSimple(ctx, fmtNum(d.weight), cx, ty0 + 2 * rowH + 14, 7.5, false, "center");
    const stock = d.dia <= 10 ? "—" : String(Math.ceil(d.lengthM / STOCK_M));
    textSimple(ctx, stock, cx, ty0 + 3 * rowH + 14, 7.5, false, "center");
  });
  if (dias.length === 0) {
    textSimple(ctx, "—", x + labW + colW / 2, ty0 + 14, 8, false, "center");
  }
  const fy = ty0 + gridH + 12;
  textSimple(ctx, `Tổng TL: ${fmtNum(totalWeight || model.totalWeight)} kg`, x + 8, fy, 8, true);
}

export async function generateSlabPdf(
  project: SlabProject,
  fonts: { regular: ArrayBuffer; bold: ArrayBuffer },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const kit = (fontkit as { default?: unknown }).default ?? fontkit;
  pdf.registerFontkit(kit as never);
  const font = await pdf.embedFont(fonts.regular);
  const fontBold = await pdf.embedFont(fonts.bold);
  const boldKit = (
    kit as { create: (data: Uint8Array) => KitFont }
  ).create(new Uint8Array(fonts.bold));
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const model = computeModel(project);
  const zones = effectiveZones(project);
  const ctx: Ctx = { page, font, fontBold, boldKit, project, model };

  ctx.page.drawRectangle({
    x: 16,
    y: 16,
    width: PAGE_W - 32,
    height: PAGE_H - 32,
    borderColor: BLACK,
    borderWidth: 1.05,
  });

  const title = `${project.info.name} (SL=${project.info.quantity}; dày=${project.info.thickness}mm)`;
  textSimple(ctx, "1/1", 28, 34, 8, false, "left");
  textSimple(ctx, title, PAGE_W - 36, 34, 11, true, "right");
  textSimple(
    ctx,
    `Bê tông ${project.info.concreteGrade} · Thép ${project.info.steelGrade} · Lớp BV ${project.info.cover}mm`,
    PAGE_W - 36,
    48,
    7.5,
    false,
    "right",
  );

  const planBottom = drawPlan(ctx, 40, 78, 780, 400, zones);
  const phoiBottom = drawPhốiCảnh(ctx, 860, 72, 780, 400);
  drawSection(ctx, 860, phoiBottom + 8);

  let y = Math.max(planBottom, phoiBottom) + 8;
  y = drawShops(ctx, y + 8, model.schedule);

  const estTableH = 56 + Math.max(model.schedule.length, 1) * 18 + 48;
  let tableY = y + 8;
  if (tableY + estTableH > PAGE_H - 28) {
    const page2 = pdf.addPage([PAGE_W, PAGE_H]);
    page2.drawRectangle({
      x: 16,
      y: 16,
      width: PAGE_W - 32,
      height: PAGE_H - 32,
      borderColor: BLACK,
      borderWidth: 1.05,
    });
    ctx.page = page2;
    tableY = 36;
  }
  const table = drawScheduleTable(ctx, 36, tableY);
  drawSummaryTable(ctx, 36 + table.w + 28, tableY);

  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
