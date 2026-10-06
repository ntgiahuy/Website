import { PDFDocument, PDFFont, PDFPage, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  STOCK_M,
  compareScheduleMarks,
  computeModel,
  economy2TopZones,
  effectiveZones,
  parseBeamSize,
  weightPerMeter,
  barsFromDistLength,
  type ComputedSlabModel,
  type ScheduleRow,
} from "../calc";
import {
  cutPiecesWithMarks,
  isCutSegmentMark,
  isOptimizeCutOn,
  spliceWorldPoints,
} from "../cut-optimize";
import {
  beamSegSideFaces,
  beamSegments,
  beamFaceDashStyle,
  clippedBeamFaceParts,
  isBeamSegOmitted,
  planBeamBleed,
  rectDiagonalHatchSegments,
  rectOpeningDiagonals,
  sortAxes,
  stripRebarBarSegments,
  stripRebarPressMarks,
  slabDistRangeForBar,
  buildMergedDistRanges,
  hooksForRebarBar,
  rebarBarStraightLenMm,
  rebarHookSegments,
  typicalLayeredRebarBars,
  faceChainAlongX,
  faceChainAlongY,
  hookDrawMm,
  zoneForRebarBar,
  distRangeJunctionsOnBars,
  ensureSectionCuts,
  sectionCutAtMm,
  bayKindAt,
  baySlabExtent,
  beamOuterFacesAtAlong,
  beamFacesAtAlongDirect,
  findBeamOnAxis,
  slabCoverMm,
  type RebarBarSeg,
} from "../grid";
import type { GridAxis, PlanBeam, RebarLayer, RebarZone, SlabProject } from "../types";

/** Khổ A1 ngang (mm → pt @ 72dpi): 841×594 mm. */
const PAGE_W = Math.round((841 * 72) / 25.4); // 2384
const PAGE_H = Math.round((594 * 72) / 25.4); // 1684
const BLACK = rgb(0, 0, 0);
/** Tiêu đề khung tên shop drawing. */
const SHOP_TITLE = "SHOP DRAWING THÉP SÀN (BY GIAHUY.NET)";
const GRAY = rgb(0.45, 0.45, 0.45);
const AXIS_LINE = rgb(0.28, 0.28, 0.28);
/** Chỉ thép dùng nét đỏ; dầm / khung / tim trục = đen. */
const REBAR_RED = rgb(0.86, 0.15, 0.15);
/** Đường khoảng rải thép sàn (⊥ phương thanh). */
const DIST_BLUE = rgb(0.15, 0.39, 0.92);
const REBAR_MARK_R = 4.8;
/** Vòng số hiệu trục PDF: bán kính + khoảng hở khỏi da dầm. */
const AXIS_BUBBLE_R = 5.5;
/** Da dầm / mặt cắt → đường dim dầm·sàn (gần hình nhất). */
const DIM_FROM_EDGE = 12;
/** Khoảng cách giữa các chuỗi dim ngang. */
const DIM_CHAIN_GAP_X = 14;
/** Khoảng cách chuỗi dim đứng (số xoay cần rộng hơn). */
const DIM_CHAIN_GAP_Y = 20;
/** Mép dim ngoài cùng → mép vòng số hiệu. */
const DIM_TO_BUBBLE = 8;
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

function rect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  t = 0.8,
  fill?: ReturnType<typeof rgb>,
) {
  ctx.page.drawRectangle({
    x,
    y: ty(y + h),
    width: w,
    height: h,
    borderColor: BLACK,
    borderWidth: t,
    ...(fill ? { color: fill } : {}),
  });
}

/** Tô hình chữ nhật không viền (bê tông liền khối trên mặt cắt). */
function fillRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: ReturnType<typeof rgb>,
) {
  if (w <= 0 || h <= 0) return;
  ctx.page.drawRectangle({
    x,
    y: ty(y + h),
    width: w,
    height: h,
    color: fill,
  });
}

/** Tô nhẹ tiết diện bê tông trên mặt cắt (để đọc rõ B / Hs / H). */
const CONCRETE_FILL = rgb(0.92, 0.92, 0.92);

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

/** Chiều cao tam giác đầu khoảng rải — dùng rút nét thân. */
const DIST_END_AH = 7;

/**
 * pdf-lib drawSvgPath: translate(x,y) rồi scale(1,-1) (Y SVG ↓).
 * Neo (0, PAGE_H) + tọa độ top-left → đúng vị trí trang PDF.
 */
function drawSvgTopLeft(
  ctx: Ctx,
  pathTopLeft: string,
  color: ReturnType<typeof rgb>,
) {
  ctx.page.drawSvgPath(pathTopLeft, {
    x: 0,
    y: PAGE_H,
    color,
    borderWidth: 0,
  });
}

/**
 * Đầu/cuối khoảng rải (đối xứng 2 đầu):
 * gạch dày ⊥ tại tip + tam giác đặc đỉnh tại tip, đáy hướng vào trong.
 */
function drawDistEndCap(ctx: Ctx, tipX: number, tipY: number, fromX: number, fromY: number) {
  const dx = tipX - fromX;
  const dy = tipY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; // hướng ra ngoài (từ giữa → tip)
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  /** Khớp minh họa UI: gạch dày + mũi tên tam giác. */
  const ah = DIST_END_AH;
  const aw = 3.5;
  const capHalf = 5.5;
  const capThick = 2.1;

  // Gạch ngang dày tại tip (vuông góc đường khoảng rải), kéo vào trong
  const ox = -ux * capThick;
  const oy = -uy * capThick;
  const capPath =
    `M ${tipX - px * capHalf} ${tipY - py * capHalf} ` +
    `L ${tipX + px * capHalf} ${tipY + py * capHalf} ` +
    `L ${tipX + px * capHalf + ox} ${tipY + py * capHalf + oy} ` +
    `L ${tipX - px * capHalf + ox} ${tipY - py * capHalf + oy} Z`;
  drawSvgTopLeft(ctx, capPath, DIST_BLUE);

  // Tam giác đặc: đỉnh tại tip (ra ngoài), đáy hướng vào trong
  const bx = tipX - ux * ah;
  const by = tipY - uy * ah;
  const tri =
    `M ${tipX} ${tipY} ` +
    `L ${bx + px * aw} ${by + py * aw} ` +
    `L ${bx - px * aw} ${by - py * aw} Z`;
  drawSvgTopLeft(ctx, tri, DIST_BLUE);
}

/**
 * Chấm giao khoảng rải ∩ thanh thép (hình 2): kim cương trong vòng tròn.
 * PDF nền trắng → viền/kim cương đen cho nổi.
 * (cx,cy) = tọa độ PDF top-left → ty khi vẽ.
 */
function drawDistBarJunction(ctx: Ctx, cx: number, cy: number) {
  /** PDF: nhỏ gấp 3 so với kích thước cũ (r=2.8 → size 5.6). */
  const r = 2.8 / 3;
  const d = r * 0.72;
  ctx.page.drawCircle({
    x: cx,
    y: ty(cy),
    size: r * 2,
    borderColor: BLACK,
    borderWidth: 0.85 / 3,
  });
  // Kim cương đặc — tâm đúng giao khoảng rải ∩ thép (SVG top-left)
  const path =
    `M ${cx} ${cy - d} ` +
    `L ${cx + d} ${cy} ` +
    `L ${cx} ${cy + d} ` +
    `L ${cx - d} ${cy} Z`;
  drawSvgTopLeft(ctx, path, BLACK);
}

/**
 * Số hiệu thép: vòng STT + Ødia a spacing trên 1 hàng (đỏ, không đậm).
 * dir = phương thanh — chữ song song thanh (X ngang / Y dọc).
 * (cx,cy) = tâm vòng (đã offset khỏi nét thép).
 * `scale` — thu nhỏ (mặt cắt dùng 0.5).
 */
function drawRebarCallout(
  ctx: Ctx,
  cx: number,
  cy: number,
  stt: number | string,
  dia: number,
  spacing: number,
  dir: "X" | "Y" = "X",
  scale = 1,
) {
  const k = Math.max(0.25, scale);
  const r = REBAR_MARK_R * k;
  const color = REBAR_RED;
  ctx.page.drawCircle({
    x: cx,
    y: ty(cy),
    size: r,
    borderColor: color,
    borderWidth: 0.35 * k,
  });
  const sttStr = String(stt);
  const sttSize = (sttStr.length >= 3 ? 4.8 : 5.6) * k;
  const sttW = ctx.font.widthOfTextAtSize(sttStr, sttSize);
  ctx.page.drawText(sttStr, {
    x: cx - sttW / 2,
    y: ty(cy) - sttSize * 0.35,
    size: sttSize,
    font: ctx.font,
    color,
  });

  const label = `Ø${dia}a${spacing}`;
  const labelSize = 6.2 * k;
  const labelW = ctx.font.widthOfTextAtSize(label, labelSize);
  const gap = 2.5 * k;
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

/** Cùng Ø + a + chiều dài phát triển + móc trái/phải → cùng số hiệu. */
function rebarSpecKey(
  dia: number,
  spacing: number,
  lengthMm: number,
  leftHook = 0,
  rightHook = 0,
) {
  return `${dia}|${spacing}|${Math.round(lengthMm)}|H${Math.round(leftHook)}/${Math.round(rightHook)}`;
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

type RebarSttInfo = {
  stt: number;
  dia: number;
  spacing: number;
  lengthMm: number;
  leftHook: number;
  rightHook: number;
};

type SttEntry = {
  dia: number;
  spacing: number;
  lengthMm: number;
  leftHook: number;
  rightHook: number;
};

/**
 * Gán STT 1,2,3… theo (Ø, a, chiều dài phát triển, móc L/R).
 * Có móc ≠ không móc → số hiệu khác; khác dài / Ø → số khác.
 */
function buildRebarSttRegistry(entries: SttEntry[]): Map<string, RebarSttInfo> {
  const uniq = new Map<string, SttEntry>();
  for (const e of entries) {
    const len = Math.round(e.lengthMm);
    if (!(len > 0)) continue;
    const leftHook = Math.max(0, Math.round(Number(e.leftHook) || 0));
    const rightHook = Math.max(0, Math.round(Number(e.rightHook) || 0));
    const key = rebarSpecKey(e.dia, e.spacing, len, leftHook, rightHook);
    if (!uniq.has(key)) {
      uniq.set(key, { dia: e.dia, spacing: e.spacing, lengthMm: len, leftHook, rightHook });
    }
  }
  const sorted = [...uniq.values()].sort(
    (a, b) =>
      a.dia - b.dia ||
      a.spacing - b.spacing ||
      a.lengthMm - b.lengthMm ||
      a.leftHook - b.leftHook ||
      a.rightHook - b.rightHook,
  );
  const map = new Map<string, RebarSttInfo>();
  sorted.forEach((e, i) => {
    map.set(rebarSpecKey(e.dia, e.spacing, e.lengthMm, e.leftHook, e.rightHook), {
      stt: i + 1,
      dia: e.dia,
      spacing: e.spacing,
      lengthMm: e.lengthMm,
      leftHook: e.leftHook,
      rightHook: e.rightHook,
    });
  });
  return map;
}

/** STT theo mark (shop/bảng) — theo Ø+a+chiều dài+móc của mark. */
function rebarSttByMark(schedule: ScheduleRow[]): Map<string, RebarSttInfo> {
  const bySpec = buildRebarSttRegistry(
    schedule.map((r) => ({
      dia: r.dia,
      spacing: r.spacing,
      lengthMm: r.barLength,
      leftHook: r.leftHook,
      rightHook: r.rightHook,
    })),
  );
  const map = new Map<string, RebarSttInfo>();
  for (const row of schedule) {
    if (map.has(row.mark)) continue;
    const info = bySpec.get(
      rebarSpecKey(row.dia, row.spacing, row.barLength, row.leftHook, row.rightHook),
    ) ?? {
      stt: map.size + 1,
      dia: row.dia,
      spacing: row.spacing,
      lengthMm: Math.round(row.barLength),
      leftHook: Math.max(0, Math.round(Number(row.leftHook) || 0)),
      rightHook: Math.max(0, Math.round(Number(row.rightHook) || 0)),
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

function hooksCloseForStt(
  a: { left: number; right: number },
  b: { leftHook: number; rightHook: number },
): boolean {
  return (
    Math.round(a.left) === Math.round(Number(b.leftHook) || 0) &&
    Math.round(a.right) === Math.round(Number(b.rightHook) || 0)
  );
}

/**
 * Chiều dài canonical (phát triển): khớp dòng thống kê cùng Ø+a+phương+móc;
 * không thì giữ dài đã tính (thanh cắt / đoạn ngắn → STT riêng).
 */
function canonicalBarLengthMm(
  developedLen: number,
  schedule: ScheduleRow[],
  dia: number,
  spacing: number,
  dir: "X" | "Y",
  hooks: { left: number; right: number },
): number {
  const developed = Math.round(developedLen);
  let pool = schedule.filter(
    (r) => r.dia === dia && r.spacing === spacing && r.direction === dir,
  );
  const hookMatched = pool.filter((r) => hooksCloseForStt(hooks, r));
  if (hookMatched.length) pool = hookMatched;
  else if (!pool.length) {
    pool = schedule.filter((r) => r.dia === dia && r.spacing === spacing);
    const hm = pool.filter((r) => hooksCloseForStt(hooks, r));
    if (hm.length) pool = hm;
  }
  if (!pool.length) return developed;
  const best = pool.reduce((a, b) =>
    Math.abs(a.barLength - developed) <= Math.abs(b.barLength - developed) ? a : b,
  );
  // Chỉ canonical khi cùng kiểu móc — tránh gộp thanh có móc với thanh thẳng
  if (hooksCloseForStt(hooks, best) && lengthsCloseForStt(best.barLength, developed)) {
    return Math.round(best.barLength);
  }
  return developed;
}

type PlanBarLike = RebarBarSeg | {
  dir: "X" | "Y";
  x0?: number;
  x1?: number;
  y?: number;
  y0?: number;
  y1?: number;
  x?: number;
  layer?: import("../types").RebarLayer;
};

function planBarSttParts(
  project: SlabProject,
  schedule: ScheduleRow[],
  zones: RebarZone[],
  bar: PlanBarLike,
): SttEntry {
  const spec = steelSpecForBar(zones, schedule, bar);
  const hooks = hooksForRebarBar(project, bar as RebarBarSeg, zones);
  const geo = barSegLengthMm(bar);
  const developed = geo + hooks.left + hooks.right;
  const lengthMm = canonicalBarLengthMm(
    developed,
    schedule,
    spec.dia,
    spec.spacing,
    bar.dir,
    hooks,
  );
  return {
    dia: spec.dia,
    spacing: spec.spacing,
    lengthMm,
    leftHook: hooks.left,
    rightHook: hooks.right,
  };
}

/** Registry STT: thống kê + các thanh mặt bằng (kèm móc). */
function unifiedSttRegistry(
  project: SlabProject,
  schedule: ScheduleRow[],
  bars: PlanBarLike[],
  zones: RebarZone[],
): Map<string, RebarSttInfo> {
  const entries: SttEntry[] = schedule.map((r) => ({
    dia: r.dia,
    spacing: r.spacing,
    lengthMm: r.barLength,
    leftHook: r.leftHook,
    rightHook: r.rightHook,
  }));
  for (const bar of bars) {
    entries.push(planBarSttParts(project, schedule, zones, bar));
  }
  return buildRebarSttRegistry(entries);
}

/** STT mặt bằng: cùng Ø+a+dài phát triển+móc → cùng số. */
function sttInfoForPlanBar(
  project: SlabProject,
  schedule: ScheduleRow[],
  registry: Map<string, RebarSttInfo>,
  zones: RebarZone[],
  bar: PlanBarLike,
): RebarSttInfo {
  const parts = planBarSttParts(project, schedule, zones, bar);
  const key = rebarSpecKey(
    parts.dia,
    parts.spacing,
    parts.lengthMm,
    parts.leftHook,
    parts.rightHook,
  );
  const info = registry.get(key);
  if (info) return info;
  return {
    stt: registry.size + 1,
    dia: parts.dia,
    spacing: parts.spacing,
    lengthMm: parts.lengthMm,
    leftHook: parts.leftHook,
    rightHook: parts.rightHook,
  };
}

/** Gộp dòng thống kê cùng STT + thêm STT chỉ có trên mặt bằng (thanh ngắn/cắt). */
function scheduleRowsByStt(
  schedule: ScheduleRow[],
  registry: Map<string, RebarSttInfo>,
  bars: PlanBarLike[],
  zones: RebarZone[],
  project: SlabProject,
  _hookMm = 50,
): Array<ScheduleRow & { stt: number }> {
  const sttMap = rebarSttByMark(schedule);
  /** Không gộp khác lớp / khác phương — bảng TK phải có cả lớp dưới và lớp trên. */
  const groups = new Map<string, ScheduleRow & { stt: number }>();
  for (const row of schedule) {
    const fromReg = registry.get(
      rebarSpecKey(row.dia, row.spacing, row.barLength, row.leftHook, row.rightHook),
    );
    const info =
      fromReg ??
      sttMap.get(row.mark) ?? {
        stt: groups.size + 1,
        dia: row.dia,
        spacing: row.spacing,
        lengthMm: Math.round(row.barLength),
        leftHook: Math.max(0, Math.round(Number(row.leftHook) || 0)),
        rightHook: Math.max(0, Math.round(Number(row.rightHook) || 0)),
      };
    const gKey = `${info.stt}|${row.layer}|${row.direction}|${row.mark}`;
    const prev = groups.get(gKey);
    if (!prev) {
      groups.set(gKey, { ...row, stt: info.stt });
      continue;
    }
    // Chỉ gộp khi trùng STT + lớp + phương + mark — cộng số thanh 1 CK
    const qtyEach = prev.qtyEach + row.qtyEach;
    const qtyMembers = Math.max(prev.qtyMembers, row.qtyMembers);
    const qtyTotal = qtyEach * qtyMembers;
    const totalM = (prev.barLength * qtyTotal) / 1000;
    groups.set(gKey, {
      ...prev,
      qtyEach,
      qtyMembers,
      qtyTotal,
      totalM,
      weight: totalM * weightPerMeter(prev.dia),
      note: [prev.note, row.note].filter(Boolean).join(" · ") || prev.note,
    });
  }

  // 1 CK bổ sung / thanh ngắn: Σ (L khoảng rải / a) theo thanh mặt bằng cùng key
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const qtyByKey = new Map<string, { qty: number; dir: "X" | "Y" }>();
  for (const bar of bars) {
    const parts = planBarSttParts(project, schedule, zones, bar);
    const key = rebarSpecKey(
      parts.dia,
      parts.spacing,
      parts.lengthMm,
      parts.leftHook,
      parts.rightHook,
    );
    const dist = slabDistRangeForBar(
      project,
      axesX,
      axesY,
      bar as { dir: "X"; x0: number; x1: number; y: number } | { dir: "Y"; y0: number; y1: number; x: number },
    );
    const n = dist ? barsFromDistLength(dist.lenMm, parts.spacing) : 1;
    const cur = qtyByKey.get(key) ?? { qty: 0, dir: bar.dir };
    cur.qty += n;
    cur.dir = bar.dir;
    qtyByKey.set(key, cur);
  }

  const usedStts = new Set([...groups.values()].map((r) => r.stt));
  // Cắt tối ưu: schedule đã có đủ đoạn 1a/1b… — không thêm dòng MB-* từ thanh đầy đủ trên MB
  if (!isOptimizeCutOn(project)) {
    for (const info of registry.values()) {
      if (usedStts.has(info.stt)) continue;
      const key = rebarSpecKey(
        info.dia,
        info.spacing,
        info.lengthMm,
        info.leftHook,
        info.rightHook,
      );
      const hit = qtyByKey.get(key);
      const qty = Math.max(1, hit?.qty ?? 1);
      const totalM = (info.lengthMm * qty) / 1000;
      const hooked = info.leftHook > 0 || info.rightHook > 0;
      const mbKey = `${info.stt}|bottom|${hit?.dir ?? "X"}|MB-${info.stt}`;
      groups.set(mbKey, {
        mark: `MB-${info.stt}`,
        layer: "bottom",
        direction: hit?.dir ?? "X",
        dia: info.dia,
        spacing: info.spacing,
        barLength: info.lengthMm,
        leftHook: info.leftHook,
        rightHook: info.rightHook,
        qtyEach: qty,
        qtyMembers: 1,
        qtyTotal: qty,
        totalM,
        weight: totalM * weightPerMeter(info.dia),
        shape: hooked ? "hooked" : "straight",
        note: "Đoạn mặt bằng (cắt/ngắn)",
        stt: info.stt,
      });
    }
  }

  const layerOrder = (L: string) =>
    L === "bottom" ? 0 : L === "structural" ? 1 : L === "top" ? 2 : 3;
  return [...groups.values()].sort(
    (a, b) =>
      a.stt - b.stt ||
      layerOrder(a.layer) - layerOrder(b.layer) ||
      a.direction.localeCompare(b.direction),
  );
}

/** Ø+a cho một thanh: zone cùng phương phủ tâm thanh (ưu tiên đúng lớp nếu có). */
function steelSpecForBar(
  zones: RebarZone[],
  schedule: ScheduleRow[],
  bar: {
    dir: "X" | "Y";
    x0?: number;
    x1?: number;
    y?: number;
    y0?: number;
    y1?: number;
    x?: number;
    layer?: RebarLayer;
  },
): { dia: number; spacing: number } {
  const z = zoneForRebarBar({ zones } as SlabProject, bar as RebarBarSeg, zones);
  if (z) return { dia: z.dia, spacing: z.spacing };
  const row = schedule.find((r) => r.direction === bar.dir) ?? schedule[0];
  return { dia: row?.dia ?? 10, spacing: row?.spacing ?? 150 };
}

/**
 * Chữ xoay dọc 90° (CCW). `anchorX` = cạnh chữ gần đường dim:
 * - side left: anchorX là mép phải chữ (chữ nằm bên trái đường)
 * - side right: anchorX là mép trái chữ (chữ nằm bên phải đường)
 * Glyph rot90 kéo về −X từ origin ≈ mép phải.
 */
function textVerticalBeside(
  ctx: Ctx,
  str: string,
  anchorX: number,
  yMid: number,
  size: number,
  side: "left" | "right",
  bold = false,
) {
  const font = bold ? ctx.fontBold : ctx.font;
  const width = font.widthOfTextAtSize(str, size);
  // rot90: origin ≈ mép phải chữ; thân chữ kéo sang trái ~0.85·size
  const originX = side === "left" ? anchorX : anchorX + size * 0.85;
  ctx.page.drawText(str, {
    x: originX,
    y: ty(yMid) - width / 2,
    size,
    font,
    color: BLACK,
    rotate: degrees(90),
  });
}

/** @deprecated dùng textVerticalBeside cho dim; giữ cho chỗ gọi cũ nếu có */
function textVertical(ctx: Ctx, str: string, cx: number, yMid: number, size = 11, bold = true) {
  textVerticalBeside(ctx, str, cx - size * 0.35, yMid, size, "left", bold);
}

/** Chữ đứng xoay 90° canh giữa cột [colX .. colX+colW]. */
function textVerticalInColumn(
  ctx: Ctx,
  str: string,
  colX: number,
  colW: number,
  yMid: number,
  size: number,
  bold = true,
) {
  const font = bold ? ctx.fontBold : ctx.font;
  const textLen = font.widthOfTextAtSize(str, size);
  // rot90 CCW: origin ≈ mép phải chữ; thân chữ kéo sang −X ≈ 0.72·size
  const glyphH = size * 0.72;
  const originX = colX + (colW + glyphH) / 2;
  ctx.page.drawText(str, {
    x: originX,
    y: ty(yMid) - textLen / 2,
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
  // Số nằm ngang — hở phía trên đường dim (không đè lên nét)
  textSimple(ctx, label, (lo + hi) / 2, y - size - 3.5, size, false, "center");
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
  // Số hở khỏi đường dim của chính chuỗi này; DIM_CHAIN_GAP_Y đủ rộng để không đè hàng bên
  const clear = 4;
  const anchorX = labelSide === "left" ? x - clear : x + clear;
  textVerticalBeside(ctx, label, anchorX, (lo + hi) / 2, size, labelSide, false);
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
  // Số móc đối xứng: trong lòng móc, cách nét đứng ~2pt (trái left-align, phải right-align)
  if (row.leftHook > 0) textSimple(ctx, String(row.leftHook), x0 + 2, y + 2, 5.2, false, "left");
  if (row.rightHook > 0) textSimple(ctx, String(row.rightHook), x1 - 2, y + 2, 5.2, false, "right");
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

/** Bản vẽ mặt bằng theo lớp: bottom = Lớp dưới, top = Lớp trên. */
function drawPlan(
  ctx: Ctx,
  ox: number,
  oy: number,
  maxW: number,
  maxH: number,
  zones: RebarZone[],
  layer: "bottom" | "top" = "bottom",
) {
  const { project } = ctx;
  const planTitle =
    layer === "top" ? "MẶT BẰNG CỐT THÉP SÀN LỚP TRÊN" : "MẶT BẰNG CỐT THÉP SÀN LỚP DƯỚI";
  /**
   * Lớp dưới: chỉ thép chịu lực (không cấu tạo).
   * Lớp trên: thép mũ + thép cấu tạo (ngược phương mũ, economy2).
   */
  const layerZones = zones.filter((z) =>
    layer === "top"
      ? z.layer === "top" || z.layer === "structural"
      : z.layer === "bottom",
  );
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

  // —— Tim trục: nét gạch–chấm liên tục xuyên mặt bằng (bubble vẽ sau dim, ngoài cùng) ——
  for (let i = 0; i < axesX.length; i++) {
    const ax = axesX[i];
    const x = toX(ax.pos);
    line(ctx, x, edgeTop, x, edgeBottom, 0.4, AXIS_LINE, AXIS_CENTERLINE_DASH);
  }
  for (let i = 0; i < axesY.length; i++) {
    const ay = axesY[i];
    const y = toY(ay.pos);
    line(ctx, edgeLeft, y, edgeRight, y, 0.4, AXIS_LINE, AXIS_CENTERLINE_DASH);
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

  // —— Thép sàn lớp đang vẽ (chỉ nét đỏ) + vòng STT + Øa ——
  const pressAmber = rgb(0.9, 0.55, 0.1);
  const bars = stripRebarBarSegments(project, axesX, axesY);
  const rebarZones = effectiveZones(project);
  /** STT thống nhất cả 2 lớp; chỉ vẽ cây điển hình của lớp này. */
  const allDrawBars = typicalLayeredRebarBars(project, bars, rebarZones);
  const drawBars = allDrawBars.filter((b) => (b.layer ?? "bottom") === layer);
  for (const bar of drawBars) {
    const { left: leftHook, right: rightHook } = hooksForRebarBar(project, bar, rebarZones);
    if (bar.dir === "X") {
      line(ctx, toX(bar.x0), toY(bar.y), toX(bar.x1), toY(bar.y), 0.55, REBAR_RED);
    } else {
      line(ctx, toX(bar.x), toY(bar.y0), toX(bar.x), toY(bar.y1), 0.55, REBAR_RED);
    }
    for (const h of rebarHookSegments(
      bar,
      hookDrawMm(leftHook, s),
      hookDrawMm(rightHook, s),
      project.planWidth,
      project.planHeight,
    )) {
      line(ctx, toX(h.x1), toY(h.y1), toX(h.x2), toY(h.y2), 0.55, REBAR_RED);
    }
  }
  const tick = 70;
  // Ký hiệu nhấn chỉ trên thanh lớp đang vẽ
  const pressMarks = stripRebarPressMarks(project, axesX, axesY, layerZones);
  for (const m of pressMarks) {
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

  // Số hiệu trên từng cây / đoạn cắt (1a, 1b… khi bật cắt tối ưu)
  const CALL_GAP = 8;
  const sttRegistry = unifiedSttRegistry(project, ctx.model.schedule, allDrawBars, rebarZones);
  const optCut = isOptimizeCutOn(project);
  const topZonesEco = optCut ? economy2TopZones(project) : [];
  let cutFam = 1;
  for (const bar of drawBars) {
    const layer = (bar.layer ?? "bottom") as import("../types").RebarLayer;
    const zHit =
      rebarZones.find((zz) => zz.direction === bar.dir && zz.layer === layer) ??
      rebarZones.find((zz) => zz.direction === bar.dir);
    const dia = zHit?.dia ?? 10;
    const spacing = zHit?.spacing ?? 150;
    const hooks = hooksForRebarBar(project, bar, rebarZones);

    if (optCut) {
      const { pieces, marks, cuts } = cutPiecesWithMarks(
        project,
        bar,
        layer,
        dia,
        hooks.left,
        hooks.right,
        topZonesEco,
        cutFam,
      );
      if (pieces.length > 1) {
        // Ô vàng tại mối nối (toY = top-origin; ty() → PDF bottom-origin)
        for (const p of spliceWorldPoints(bar, cuts)) {
          const sx = toX(p.x) - 2.2;
          const sy = toY(p.y) - 2.2;
          ctx.page.drawRectangle({
            x: sx,
            y: ty(sy + 4.4),
            width: 4.4,
            height: 4.4,
            color: rgb(0.98, 0.75, 0.14),
            borderColor: rgb(0.55, 0.35, 0.05),
            borderWidth: 0.4,
          });
        }
        const L = rebarBarStraightLenMm(bar);
        const pool = ctx.model.schedule.filter(
          (r) =>
            isCutSegmentMark(r.mark) &&
            r.direction === bar.dir &&
            r.dia === dia &&
            r.spacing === spacing &&
            (r.layer === layer ||
              (layer === "top" && r.layer === "structural")),
        );
        // Nhiều thanh giống nhau dùng chung 1a/1b — chỉ tránh trùng trong 1 thanh
        const usedOnBar = new Set<string>();
        for (let i = 0; i < pieces.length; i++) {
          const p = pieces[i]!;
          const midT = L > 0 ? (p.t0 + p.t1) / 2 / L : 0.5;
          const matched = pool.find(
            (r) =>
              !usedOnBar.has(r.mark) &&
              Math.abs(r.barLength - p.barLength) <= 2 &&
              Math.round(r.leftHook) === Math.round(p.leftHook) &&
              Math.round(r.rightHook) === Math.round(p.rightHook),
          );
          const mark = matched?.mark ?? marks[i]!;
          if (matched) usedOnBar.add(matched.mark);
          const mx =
            bar.dir === "X"
              ? Math.min(bar.x0, bar.x1) + Math.abs(bar.x1 - bar.x0) * midT
              : bar.x;
          const my =
            bar.dir === "Y"
              ? Math.min(bar.y0, bar.y1) + Math.abs(bar.y1 - bar.y0) * midT
              : bar.y;
          const label = `Ø${dia}a${spacing}`;
          const labelW = ctx.font.widthOfTextAtSize(label, 6.2);
          const gap = 2.5;
          const rowLen = REBAR_MARK_R * 2 + gap + labelW;
          if (bar.dir === "X") {
            const midX = toX(mx);
            const barY = toY(my);
            const cy = barY + REBAR_MARK_R + CALL_GAP;
            const cx = midX - rowLen / 2 + REBAR_MARK_R;
            drawRebarCallout(ctx, cx, cy, mark, dia, spacing, "X");
          } else {
            const midY = toY(my);
            const barX = toX(mx);
            const cx = barX + REBAR_MARK_R + CALL_GAP;
            const cy = midY - rowLen / 2 + REBAR_MARK_R;
            drawRebarCallout(ctx, cx, cy, mark, dia, spacing, "Y");
          }
        }
        cutFam += 1;
        continue;
      }
    }

    const info = sttInfoForPlanBar(project, ctx.model.schedule, sttRegistry, rebarZones, bar);
    // Cắt tối ưu: số hiệu mặt bằng = mark thống kê (cùng Ø/L/hình → cùng số)
    let planMark: string | number = info.stt;
    if (optCut) {
      const developed = rebarBarStraightLenMm(bar) + hooks.left + hooks.right;
      const hit = ctx.model.schedule.find(
        (r) =>
          r.dia === dia &&
          r.spacing === spacing &&
          r.direction === bar.dir &&
          (r.layer === layer ||
            (layer === "top" && r.layer === "structural")) &&
          Math.abs(r.barLength - developed) <= 2 &&
          Math.round(r.leftHook) === Math.round(hooks.left) &&
          Math.round(r.rightHook) === Math.round(hooks.right),
      );
      if (hit) planMark = hit.mark;
    }
    const label = `Ø${info.dia}a${info.spacing}`;
    const labelW = ctx.font.widthOfTextAtSize(label, 6.2);
    const gap = 2.5;
    const rowLen = REBAR_MARK_R * 2 + gap + labelW;

    if (bar.dir === "X") {
      const midX = toX((bar.x0 + bar.x1) / 2);
      const barY = toY(bar.y);
      const cy = barY + REBAR_MARK_R + CALL_GAP;
      const cx = midX - rowLen / 2 + REBAR_MARK_R;
      drawRebarCallout(ctx, cx, cy, planMark, info.dia, info.spacing, "X");
    } else {
      const midY = toY((bar.y0 + bar.y1) / 2);
      const barX = toX(bar.x);
      const cx = barX + REBAR_MARK_R + CALL_GAP;
      const cy = midY - rowLen / 2 + REBAR_MARK_R;
      drawRebarCallout(ctx, cx, cy, planMark, info.dia, info.spacing, "Y");
    }
  }

  // —— Khoảng rải lớp đang vẽ ——
  const showDist =
    project.info.showDistRange !== false && layerZones.some((z) => z.showSpacing);
  if (showDist) {
    const markKeyOf = (bar: (typeof bars)[number]) => {
      const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
      const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
      const hits = layerZones.filter((z) => {
        if (z.direction !== bar.dir) return false;
        const zx0 = Math.min(z.x1, z.x2);
        const zx1 = Math.max(z.x1, z.x2);
        const zy0 = Math.min(z.y1, z.y2);
        const zy1 = Math.max(z.y1, z.y2);
        return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
      });
      const z = hits[0];
      const hooks = hooksForRebarBar(project, bar, rebarZones);
      const len = Math.round(rebarBarStraightLenMm(bar) + hooks.left + hooks.right);
      // Mỗi số hiệu (Ø+a+L+móc) một khoảng rải riêng trên PDF
      if (z) {
        return `${z.mark}|${z.dia}|${z.spacing}|${z.direction}|L${len}|H${hooks.left}/${hooks.right}`;
      }
      return "";
    };
    const merged = buildMergedDistRanges(
      project,
      axesX,
      axesY,
      bars,
      markKeyOf,
      undefined,
      layerZones,
    );
    for (const seg of merged) {
      const pxA = toX(seg.xA);
      const pyA = toY(seg.yA);
      const pxB = toX(seg.xB);
      const pyB = toY(seg.yB);
      const dx = pxB - pxA;
      const dy = pyB - pyA;
      const plen = Math.hypot(dx, dy) || 1;
      const ux = dx / plen;
      const uy = dy / plen;
      const inset = Math.min(DIST_END_AH, plen * 0.35);
      line(
        ctx,
        pxA + ux * inset,
        pyA + uy * inset,
        pxB - ux * inset,
        pyB - uy * inset,
        1.0,
        DIST_BLUE,
      );
      drawDistEndCap(ctx, pxA, pyA, pxB, pyB);
      drawDistEndCap(ctx, pxB, pyB, pxA, pyA);
      for (const j of distRangeJunctionsOnBars(seg, drawBars)) {
        drawDistBarJunction(ctx, toX(j.x), toY(j.y));
      }
      const label = String(Math.round(seg.lenMm));
      const alongY = Math.abs(seg.yB - seg.yA) >= Math.abs(seg.xB - seg.xA);
      const distSize = 5.5;
      if (alongY) {
        // Số bên phải đường khoảng rải đứng — hở khỏi nét
        textSimple(
          ctx,
          label,
          (pxA + pxB) / 2 + distSize + 5,
          (pyA + pyB) / 2,
          distSize,
          false,
          "left",
          DIST_BLUE,
        );
      } else {
        // Số phía trên đường khoảng rải ngang — hở khỏi nét
        textSimple(
          ctx,
          label,
          (pxA + pxB) / 2,
          (pyA + pyB) / 2 - distSize - 5,
          distSize,
          false,
          "center",
          DIST_BLUE,
        );
      }
    }
  }

  /**
   * Ngoài → vào: số hiệu trục → dim tổng → dim tim trục → dim dầm/sàn → hình vẽ.
   * Dim đặt sát hình trước; vòng số hiệu ngoài cùng.
   */
  const faceX = faceChainAlongX(project, axesX, axesY);
  const faceY = faceChainAlongY(project, axesX, axesY);
  const axisXMarks = axesX.map((a) => a.pos);
  const axisYMarks = axesY.map((a) => a.pos);

  // Ngang (X): sát hình → ngoài
  let yDim = edgeBottom + DIM_FROM_EDGE;
  if (faceX.length >= 2) {
    dimHChain(ctx, faceX, yDim, toX, 5.2); // B dầm + bề rộng sàn
    yDim += DIM_CHAIN_GAP_X;
  }
  if (axisXMarks.length >= 2) {
    dimHChain(ctx, axisXMarks, yDim, toX, 5.5); // tim trục
    yDim += DIM_CHAIN_GAP_X;
  }
  dimH(ctx, toX(bleed.xMin), toX(bleed.xMax), yDim, `${Math.round(bleed.xMax - bleed.xMin)}`, 6.5);
  yDim += DIM_TO_BUBBLE + AXIS_BUBBLE_R;
  const bubbleBottomY = yDim;

  // Đứng (Y): sát hình → trái (x giảm)
  let xDim = edgeLeft - DIM_FROM_EDGE;
  if (faceY.length >= 2) {
    dimVChain(ctx, faceY, xDim, toY, 5.2, "left");
    xDim -= DIM_CHAIN_GAP_Y;
  }
  if (axisYMarks.length >= 2) {
    dimVChain(ctx, axisYMarks, xDim, toY, 5.5, "left");
    xDim -= DIM_CHAIN_GAP_Y;
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
  xDim -= DIM_TO_BUBBLE + AXIS_BUBBLE_R;
  const bubbleLeftX = xDim;

  // Vòng số hiệu ngoài cùng + đường dẫn băng qua chuỗi dim
  for (let i = 0; i < axesX.length; i++) {
    const ax = axesX[i]!;
    const x = toX(ax.pos);
    line(ctx, x, bubbleBottomY - AXIS_BUBBLE_R, x, edgeBottom, 0.35, BLACK, [2, 1.5]);
    ctx.page.drawCircle({
      x,
      y: ty(bubbleBottomY),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.7,
    });
    textInAxisBubble(ctx, ax.name, x, bubbleBottomY);
  }
  for (let i = 0; i < axesY.length; i++) {
    const ay = axesY[i]!;
    const y = toY(ay.pos);
    line(ctx, bubbleLeftX + AXIS_BUBBLE_R, y, edgeLeft, y, 0.35, BLACK, [2, 1.5]);
    ctx.page.drawCircle({
      x: bubbleLeftX,
      y: ty(y),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.7,
    });
    textInAxisBubble(ctx, ay.name, bubbleLeftX, y);
  }

  // Tiêu đề + tỉ lệ: dưới vòng số hiệu
  const titleY = bubbleBottomY + AXIS_BUBBLE_R + 12;
  textSimple(ctx, planTitle, ox + maxW / 2, titleY, 10, true, "center");
  textSimple(ctx, `TL: 1/${project.info.drawingScale}`, ox + maxW / 2, titleY + 12, 7.5, false, "center");

  return titleY + 20;
}

/**
 * Vẽ một da dầm.
 * Da biên ngoài (solid): không cắt — nét liền suốt.
 * Da trong (dashed): cắt đoạn xuyên thân dầm giao.
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
  const parts = dash
    ? clippedBeamFaceParts(project, beamDir, face0, face1, along0, along1)
    : [{ faceA: face0, faceB: face1, alongA: along0, alongB: along1 }];
  for (const p of parts) {
    if (beamDir === "Y") {
      line(ctx, toX(p.faceA), toY(p.alongA), toX(p.faceB), toY(p.alongB), BEAM_STROKE, BLACK, dash);
    } else {
      line(ctx, toX(p.alongA), toY(p.faceA), toX(p.alongB), toY(p.faceB), BEAM_STROKE, BLACK, dash);
    }
  }
}

/**
 * Vẽ dầm đúng bề rộng B: da biên ngoài (dầm biên) nét liền, da trong nét đứt;
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

  for (const seg of segs) {
    if (isBeamSegOmitted(b, seg.a0.id, seg.a1.id)) continue;
    const { lo0, hi0, lo1, hi1 } = beamSegSideFaces(b, seg.index);
    const lo = seg.lo;
    const hi = seg.hi;
    const loDash =
      beamFaceDashStyle(b.direction, lo0, lo1, bleed) === "dashed" ? BEAM_INNER_DASH : undefined;
    const hiDash =
      beamFaceDashStyle(b.direction, hi0, hi1, bleed) === "dashed" ? BEAM_INNER_DASH : undefined;
    drawBeamFaceClipped(ctx, b.direction, lo0, lo1, lo, hi, toX, toY, loDash, project);
    drawBeamFaceClipped(ctx, b.direction, hi0, hi1, lo, hi, toX, toY, hiDash, project);
  }
}

/** Toàn bộ dòng thống kê PDF (gồm STT thanh ngắn trên mặt bằng). */
function buildPdfScheduleRows(ctx: Ctx): Array<ScheduleRow & { stt: number | string }> {
  const { project, model } = ctx;
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const zones = effectiveZones(project);
  const bars = stripRebarBarSegments(project, axesX, axesY);
  const drawBars = typicalLayeredRebarBars(project, bars, zones);
  const registry = unifiedSttRegistry(project, model.schedule, drawBars, zones);
  const rows = scheduleRowsByStt(
    model.schedule,
    registry,
    drawBars,
    zones,
    project,
    project.info.cover || 50,
  );
  // Cắt tối ưu: STT = mark (1a,1b,… rồi 2a,2b…); lớp dưới/trên số hiệu khác nhau
  if (isOptimizeCutOn(project)) {
    return rows
      .map((row) => ({
        ...row,
        stt: row.mark as unknown as number,
      }))
      .sort(
        (a, b) =>
          compareScheduleMarks(String(a.stt), String(b.stt)) ||
          a.direction.localeCompare(b.direction) ||
          b.barLength - a.barLength,
      );
  }
  return rows;
}

function scheduleLayerLabel(layer: ScheduleRow["layer"]): string {
  if (layer === "top") return "Lớp trên";
  if (layer === "structural") return "Lớp cấu tạo";
  return "Lớp dưới";
}

/** Tỉ lệ bản vẽ 1:N → hệ số pt PDF / mm thế giới. */
function scalePtPerMm(drawingScale: number): number {
  return 72 / (25.4 * Math.max(1, drawingScale));
}

/** Tỉ lệ mặt cắt thép sàn (phóng to hơn mặt bằng). */
const SECTION_DRAWING_SCALE = 75;


/** Đoạn mặt cắt dọc theo đường cắt (mm thế giới). */
export type SectionAlongSeg =
  | { kind: "beam"; lo: number; hi: number; h: number; name: string }
  | { kind: "slab"; lo: number; hi: number; drop: number; label?: string }
  | { kind: "opening"; lo: number; hi: number; label?: string };

/** Đoạn thép dọc mặt cắt: xuyên dầm liên tục; đầu neo (biên / ô thủng / cắt) + móc. */
export type SectionLongRebarRun = {
  loMm: number;
  hiMm: number;
  drop: number;
  /** Đầu trái kết thúc trong thân dầm (biên / ô thủng / lệch cao độ). */
  leftTerm: boolean;
  /** Đầu phải kết thúc trong thân dầm. */
  rightTerm: boolean;
};

/**
 * Độ thụt đầu thép vào thân dầm trên mặt cắt (mm).
 * Ít nhất bằng lớp BV; tăng tối thiểu ~0.4 B để thấy rõ trên TL nhỏ,
 * nhưng không vượt quá nửa bề rộng dầm.
 */
export function sectionTermPenMm(coverMm: number, beamWidthMm: number): number {
  const cover = Math.max(0, Math.round(coverMm));
  const bw = Math.max(0, beamWidthMm);
  if (bw < 2) return cover;
  const half = bw * 0.5 - 4;
  const want = Math.max(cover, Math.min(90, bw * 0.4));
  return Math.max(cover, Math.min(half, want));
}

/**
 * Gộp đoạn sàn cùng cao độ xuyên qua dầm giữa; đầu tại dầm biên /
 * kề ô thủng / lệch drop (sàn thấp cắt) → thụt vào thân dầm.
 */
export function buildSectionLongRebarRuns(
  segs: SectionAlongSeg[],
  coverMm: number,
): SectionLongRebarRun[] {
  const runs: SectionLongRebarRun[] = [];
  let i = 0;
  while (i < segs.length) {
    const seg = segs[i]!;
    if (seg.kind !== "slab") {
      i += 1;
      continue;
    }
    const drop = seg.drop;
    let lo = seg.lo;
    let hi = seg.hi;
    let leftTerm = false;
    let rightTerm = false;

    // Trái: dầm kề — nếu phía ngoài không phải sàn cùng drop → neo trong thân dầm
    if (i > 0 && segs[i - 1]!.kind === "beam") {
      const beam = segs[i - 1]!;
      const before = i > 1 ? segs[i - 2]! : null;
      const cont =
        before?.kind === "slab" && Math.abs(before.drop - drop) < 0.5;
      if (!cont) {
        const pen = sectionTermPenMm(coverMm, beam.hi - beam.lo);
        lo = beam.lo + pen;
        leftTerm = true;
      }
    }

    // Lan sang phải qua dầm + sàn cùng drop
    let j = i;
    while (
      j + 2 < segs.length &&
      segs[j + 1]!.kind === "beam" &&
      segs[j + 2]!.kind === "slab"
    ) {
      const next = segs[j + 2] as Extract<SectionAlongSeg, { kind: "slab" }>;
      if (Math.abs(next.drop - drop) > 0.5) break;
      hi = next.hi;
      j += 2;
    }

    // Phải: dầm kề sau dải — neo nếu không liên tục cùng drop
    if (j + 1 < segs.length && segs[j + 1]!.kind === "beam") {
      const beam = segs[j + 1]!;
      const after = j + 2 < segs.length ? segs[j + 2]! : null;
      const cont =
        after?.kind === "slab" && Math.abs(after.drop - drop) < 0.5;
      if (!cont) {
        const pen = sectionTermPenMm(coverMm, beam.hi - beam.lo);
        hi = beam.hi - pen;
        rightTerm = true;
      }
    }

    if (hi - lo > 1) {
      runs.push({ loMm: lo, hiMm: hi, drop, leftTerm, rightTerm });
    }
    i = j + 1;
  }
  return runs;
}

/** Dầm cắt ngang đường cắt (vuông góc mặt cắt). */
function crossBeamsOnCut(
  project: SlabProject,
  cutDir: "X" | "Y",
  at: number,
): Array<{ lo: number; hi: number; h: number; name: string }> {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const out: Array<{ lo: number; hi: number; h: number; name: string }> = [];
  const seen = new Set<string>();

  const pushBeam = (beam: PlanBeam, lo: number, hi: number) => {
    const w = hi - lo;
    if (w < 1) return;
    const key = `${Math.round(lo)}:${Math.round(hi)}:${beam.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const { h } = parseBeamSize(beam.size || "220x500");
    out.push({ lo, hi, h, name: beam.name || "" });
  };

  // Dầm gắn trục: cắt tại X → dầm phương X (trục Y); cắt tại Y → dầm phương Y (trục X)
  if (cutDir === "X") {
    for (const ay of axesY) {
      const beam = findBeamOnAxis(project, "X", ay);
      if (!beam) continue;
      const f = beamOuterFacesAtAlong(project, "X", ay, at);
      pushBeam(beam, f.lo, f.hi);
    }
  } else {
    for (const ax of axesX) {
      const beam = findBeamOnAxis(project, "Y", ax);
      if (!beam) continue;
      const f = beamOuterFacesAtAlong(project, "Y", ax, at);
      pushBeam(beam, f.lo, f.hi);
    }
  }

  // Dầm tự do / mọi dầm cùng phương cắt ngang đường cắt (bổ sung nếu chưa có)
  for (const beam of project.beams ?? []) {
    if (beam.direction !== cutDir) continue;
    const bLo = Math.min(beam.start, beam.end);
    const bHi = Math.max(beam.start, beam.end);
    if (at < bLo - 0.5 || at > bHi + 0.5) continue;
    const perp = sortAxes(cutDir === "X" ? axesY : axesX);
    const { lo, hi } = beamFacesAtAlongDirect(beam, at, perp);
    if (hi - lo < 1) {
      const { b: bw } = parseBeamSize(beam.size || "220x500");
      const b1 = Number.isFinite(beam.offset) ? beam.offset : bw / 2;
      pushBeam(beam, beam.axis - b1, beam.axis - b1 + bw);
    } else {
      pushBeam(beam, lo, hi);
    }
  }

  return out.sort((a, b) => a.lo - b.lo);
}

/**
 * Loại sàn tại điểm trên đường cắt (trong ô / trên dầm).
 * Trên thân dầm: nếu cả hai bên đều thủng → opening; nếu có sàn thấp → low; ngược lại normal.
 */
function deckAtCutPoint(
  project: SlabProject,
  cutDir: "X" | "Y",
  at: number,
  along: number,
): { kind: "normal" | "opening" | "low"; drop: number; label?: string } {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  if (axesX.length < 2 || axesY.length < 2) {
    return { kind: "normal", drop: 0 };
  }

  for (let ix = 0; ix < axesX.length - 1; ix++) {
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      const bay = baySlabExtent(project, axesX, axesY, ix, iy);
      // cutDir X → điểm (at=X, along=Y); cutDir Y → (along=X, at=Y)
      const px = cutDir === "X" ? at : along;
      const py = cutDir === "X" ? along : at;
      if (px < bay.x0 - 0.5 || px > bay.x1 + 0.5 || py < bay.y0 - 0.5 || py > bay.y1 + 0.5) {
        continue;
      }
      const kind = bayKindAt(project, axesX, axesY, ix, iy);
      if (kind === "opening") {
        const op = (project.openings ?? []).find((o) =>
          Math.abs(o.x - bay.x0) < 1 && Math.abs(o.y - bay.y0) < 1,
        );
        return { kind: "opening", drop: 0, label: op?.name || "Ô thủng" };
      }
      if (kind === "low") {
        const ls = (project.lowSlabs ?? []).find((o) =>
          Math.abs(o.x - bay.x0) < 1 && Math.abs(o.y - bay.y0) < 1,
        );
        const drop = Math.max(0, ls?.drop || project.info.lowSlabDrop || 0);
        return { kind: "low", drop, label: ls?.name || "ST" };
      }
      return { kind: "normal", drop: 0 };
    }
  }

  // Điểm nằm trên dầm / ngoài ô: lấy hai ô kề theo phương cắt
  if (cutDir === "X") {
    // at = X trên dầm đứng — xét ô trái/phải tại hàng chứa along
    let iy = 0;
    for (let j = 0; j < axesY.length - 1; j++) {
      const bay = baySlabExtent(project, axesX, axesY, 0, j);
      if (along >= bay.y0 - 0.5 && along <= bay.y1 + 0.5) {
        iy = j;
        break;
      }
    }
    let left: ReturnType<typeof bayKindAt> | null = null;
    let right: ReturnType<typeof bayKindAt> | null = null;
    let lowDrop = 0;
    let lowLabel: string | undefined;
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      const bay = baySlabExtent(project, axesX, axesY, ix, iy);
      const k = bayKindAt(project, axesX, axesY, ix, iy);
      if (bay.x1 <= at + 0.5) left = k;
      if (bay.x0 >= at - 0.5 && right == null) right = k;
      if (k === "low") {
        const ls = (project.lowSlabs ?? []).find((o) =>
          Math.abs(o.x - bay.x0) < 1 && Math.abs(o.y - bay.y0) < 1,
        );
        lowDrop = Math.max(lowDrop, ls?.drop || project.info.lowSlabDrop || 0);
        lowLabel = ls?.name || lowLabel;
      }
    }
    if (left === "opening" && right === "opening") {
      return { kind: "opening", drop: 0, label: "Ô thủng" };
    }
    if (left === "low" || right === "low") {
      return { kind: "low", drop: lowDrop, label: lowLabel };
    }
    return { kind: "normal", drop: 0 };
  }

  // cutDir Y — at = Y trên dầm ngang
  let ix = 0;
  for (let i = 0; i < axesX.length - 1; i++) {
    const bay = baySlabExtent(project, axesX, axesY, i, 0);
    if (along >= bay.x0 - 0.5 && along <= bay.x1 + 0.5) {
      ix = i;
      break;
    }
  }
  let below: ReturnType<typeof bayKindAt> | null = null;
  let above: ReturnType<typeof bayKindAt> | null = null;
  let lowDrop = 0;
  let lowLabel: string | undefined;
  for (let iy = 0; iy < axesY.length - 1; iy++) {
    const bay = baySlabExtent(project, axesX, axesY, ix, iy);
    const k = bayKindAt(project, axesX, axesY, ix, iy);
    if (bay.y1 <= at + 0.5) below = k;
    if (bay.y0 >= at - 0.5 && above == null) above = k;
    if (k === "low") {
      const ls = (project.lowSlabs ?? []).find((o) =>
        Math.abs(o.x - bay.x0) < 1 && Math.abs(o.y - bay.y0) < 1,
      );
      lowDrop = Math.max(lowDrop, ls?.drop || project.info.lowSlabDrop || 0);
      lowLabel = ls?.name || lowLabel;
    }
  }
  if (below === "opening" && above === "opening") {
    return { kind: "opening", drop: 0, label: "Ô thủng" };
  }
  if (below === "low" || above === "low") {
    return { kind: "low", drop: lowDrop, label: lowLabel };
  }
  return { kind: "normal", drop: 0 };
}

/**
 * Dựng dải mặt cắt từ trục đầu → trục cuối:
 * đủ mọi dầm cắt ngang, ô thủng, sàn thấp trên đường cắt.
 */
export function buildSectionAlongSegs(
  project: SlabProject,
  cutDir: "X" | "Y",
  at: number,
): { segs: SectionAlongSeg[]; along0: number; along1: number; axes: GridAxis[] } {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const bleed = planBeamBleed(project, axesX, axesY);
  const alongAxes = cutDir === "X" ? axesY : axesX;
  // Phạm vi: mép da dầm biên (để hiện đủ dầm đầu/cuối), gắn với trục đầu→cuối
  const along0 = cutDir === "X" ? bleed.yMin : bleed.xMin;
  const along1 = cutDir === "X" ? bleed.yMax : bleed.xMax;

  const beams = crossBeamsOnCut(project, cutDir, at).filter(
    (b) => b.hi > along0 - 0.5 && b.lo < along1 + 0.5,
  );

  // Mốc chia: đầu/cuối + mép mọi dầm + biên mọi ô trên đường cắt
  const marks = new Set<number>([along0, along1]);
  for (const b of beams) {
    marks.add(b.lo);
    marks.add(b.hi);
  }
  if (cutDir === "X") {
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      for (let ix = 0; ix < axesX.length - 1; ix++) {
        const bay = baySlabExtent(project, axesX, axesY, ix, iy);
        if (at < bay.x0 - 0.5 || at > bay.x1 + 0.5) continue;
        marks.add(bay.y0);
        marks.add(bay.y1);
      }
    }
  } else {
    for (let ix = 0; ix < axesX.length - 1; ix++) {
      for (let iy = 0; iy < axesY.length - 1; iy++) {
        const bay = baySlabExtent(project, axesX, axesY, ix, iy);
        if (at < bay.y0 - 0.5 || at > bay.y1 + 0.5) continue;
        marks.add(bay.x0);
        marks.add(bay.x1);
      }
    }
  }
  const sorted = [...marks].sort((a, b) => a - b);

  const segs: SectionAlongSeg[] = [];
  const beamAt = (mid: number) => beams.find((b) => mid >= b.lo - 0.5 && mid <= b.hi + 0.5);

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]!;
    const hi = sorted[i + 1]!;
    if (hi - lo < 0.5) continue;
    const mid = (lo + hi) / 2;
    const beam = beamAt(mid);
    if (beam) {
      segs.push({ kind: "beam", lo, hi, h: beam.h, name: beam.name });
      continue;
    }
    const deck = deckAtCutPoint(project, cutDir, at, mid);
    if (deck.kind === "opening") {
      segs.push({ kind: "opening", lo, hi, label: deck.label });
    } else {
      segs.push({
        kind: "slab",
        lo,
        hi,
        drop: deck.kind === "low" ? deck.drop : 0,
        label: deck.kind === "low" ? deck.label : undefined,
      });
    }
  }

  // Gộp đoạn cùng loại liền kề (trừ dầm giữ tách để đúng bề rộng)
  const merged: SectionAlongSeg[] = [];
  for (const s of segs) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.kind === s.kind &&
      s.kind !== "beam" &&
      prev.kind !== "beam" &&
      Math.abs(prev.hi - s.lo) < 0.5
    ) {
      if (prev.kind === "slab" && s.kind === "slab" && prev.drop === s.drop) {
        prev.hi = s.hi;
        continue;
      }
      if (prev.kind === "opening" && s.kind === "opening") {
        prev.hi = s.hi;
        continue;
      }
    }
    merged.push({ ...s });
  }

  return { segs: merged, along0, along1, axes: alongAxes };
}

/** Tỉ lệ số hiệu / đường chỉ trên mặt cắt (0.5 = nửa kích thước mặt bằng). */
const SECTION_CALLOUT_SCALE = 0.5;

/**
 * Đường chỉ sắt trên mặt cắt: nét đứng vuông góc → đường ngang 1 hàng;
 * vòng STT + Øa nằm TRÊN đường ngang (không đè line).
 * Thanh ngang = đúng bề rộng vòng STT + Øa; tip neo một đầu thanh ngang.
 * `shelfY` = cao độ đường ngang chung.
 */
function drawSectionRebarLeader(
  ctx: Ctx,
  tipX: number,
  tipY: number,
  labelCx: number,
  shelfY: number,
  stt: number | string,
  dia: number,
  spacing: number,
) {
  const k = SECTION_CALLOUT_SCALE;
  const r = REBAR_MARK_R * k;
  const label = `Ø${dia}a${spacing}`;
  const labelSize = 6.2 * k;
  const labelW = ctx.font.widthOfTextAtSize(label, labelSize);
  const gap = 2.5 * k;
  const rowW = r * 2 + gap + labelW;
  // Neo tip vào một đầu thanh ngang; nhãn nằm phía labelCx
  const labelOnLeft = labelCx <= tipX;
  const shelfLeft = labelOnLeft ? tipX - rowW : tipX;
  const shelfRight = labelOnLeft ? tipX : tipX + rowW;
  const circleCx = shelfLeft + r;
  // Vòng + chữ nằm trên đường ngang (hở rõ, không đè line)
  const calloutCy = shelfY - r - 3.5 * k;
  // Nét đứng vuông góc với đường ngang (không xéo)
  line(ctx, tipX, tipY, tipX, shelfY, 0.4, REBAR_RED);
  line(ctx, shelfLeft, shelfY, shelfRight, shelfY, 0.4, REBAR_RED);
  ctx.page.drawCircle({ x: tipX, y: ty(tipY), size: 1.2 * k, color: REBAR_RED });
  drawRebarCallout(ctx, circleCx, calloutCy, stt, dia, spacing, "X", k);
}

/** Đoạn thép mũ economy2 trên mặt cắt — chỉ vùng L/n, hở giữa nhịp. */
function buildEconomy2HatSectionRuns(
  project: SlabProject,
  alongDir: "X" | "Y",
): SectionLongRebarRun[] {
  const hats = effectiveZones(project).filter(
    (z) => z.layer === "top" && z.direction === alongDir,
  );
  const runs: SectionLongRebarRun[] = [];
  for (const z of hats) {
    const lo = alongDir === "X" ? Math.min(z.x1, z.x2) : Math.min(z.y1, z.y2);
    const hi = alongDir === "X" ? Math.max(z.x1, z.x2) : Math.max(z.y1, z.y2);
    if (hi - lo < 40) continue;
    runs.push({
      loMm: lo,
      hiMm: hi,
      drop: 0,
      leftTerm: true,
      rightTerm: true,
    });
  }
  return runs.sort((a, b) => a.loMm - b.loMm);
}

/** STT + Ø + a theo lớp/phương từ bảng thống kê PDF. */
function sectionSteelCallout(
  ctx: Ctx,
  layer: "bottom" | "top",
  dir: "X" | "Y",
): { stt: number | string; dia: number; spacing: number } | null {
  const zones = effectiveZones(ctx.project);
  const z = zones.find((zone) =>
    layer === "top"
      ? zone.layer === "top" && zone.direction === dir
      : (zone.layer === "bottom" || zone.layer === "structural") && zone.direction === dir,
  );
  if (!z) return null;
  const rows = buildPdfScheduleRows(ctx).filter(
    (r) =>
      r.direction === dir &&
      (layer === "top" ? r.layer === "top" : r.layer === "bottom" || r.layer === "structural") &&
      r.dia === z.dia &&
      r.spacing === z.spacing,
  );
  // Ưu tiên số thuần; nếu chỉ có đoạn nối thì lấy đoạn dài nhất (1a trước 1b…)
  const plain = rows.find((r) => !isCutSegmentMark(String(r.stt)));
  const row =
    plain ??
    [...rows].sort(
      (a, b) =>
        compareScheduleMarks(String(a.stt), String(b.stt)) || b.barLength - a.barLength,
    )[0] ??
    null;
  if (!row) {
    return { stt: 1, dia: z.dia, spacing: z.spacing };
  }
  return {
    stt: row.stt,
    dia: z.dia,
    spacing: z.spacing,
  };
}

/** Các đoạn nối (1a,1b…) cùng lớp + phương — dài → ngắn. */
function sectionCutPieceCallouts(
  ctx: Ctx,
  layer: "bottom" | "top",
  dir: "X" | "Y",
): Array<{ stt: string; dia: number; spacing: number; barLength: number }> {
  const zones = effectiveZones(ctx.project);
  const z = zones.find((zone) =>
    layer === "top"
      ? zone.layer === "top" && zone.direction === dir
      : (zone.layer === "bottom" || zone.layer === "structural") && zone.direction === dir,
  );
  if (!z) return [];
  return buildPdfScheduleRows(ctx)
    .filter(
      (r) =>
        r.direction === dir &&
        (layer === "top" ? r.layer === "top" : r.layer === "bottom" || r.layer === "structural") &&
        r.dia === z.dia &&
        r.spacing === z.spacing &&
        isCutSegmentMark(String(r.stt)),
    )
    .map((r) => ({
      stt: String(r.stt),
      dia: z.dia,
      spacing: z.spacing,
      barLength: r.barLength,
    }))
    .sort((a, b) => compareScheduleMarks(a.stt, b.stt) || b.barLength - a.barLength);
}

/**
 * Mặt cắt thép sàn: từ trục đầu → trục cuối,
 * đủ dầm / ô thủng / sàn thấp trên đường cắt.
 * `cutDir` X → MẶT CẮT A-A; Y → MẶT CẮT B-B.
 * `sectionS` = tỉ lệ mặt cắt (mặc định 1/75).
 */
function drawRebarSectionCut(
  ctx: Ctx,
  x: number,
  y: number,
  maxW: number,
  cutDir: "X" | "Y",
  sectionS: number,
): number {
  const { project, model } = ctx;
  const sections = ensureSectionCuts(project);
  const sec = sections.find((s) => s.direction === cutDir);
  const label = cutDir === "X" ? "A-A" : "B-B";
  const alongAxesAll = sortAxes(cutDir === "X" ? project.axesY ?? [] : project.axesX ?? []);
  const axisName =
    cutDir === "X"
      ? sortAxes(project.axesX ?? []).find((a) => a.id === sec?.axisId)?.name
      : sortAxes(project.axesY ?? []).find((a) => a.id === sec?.axisId)?.name;
  const at = sec ? sectionCutAtMm(project, sec) : 0;
  const title = `MẶT CẮT THÉP SÀN ${label}`;
  const axisSpanLabel =
    alongAxesAll.length >= 2
      ? `trục ${alongAxesAll[0]!.name}-${alongAxesAll[alongAxesAll.length - 1]!.name}`
      : "";
  const sub =
    cutDir === "X"
      ? `Cắt theo phương X · X=${at}${axisName ? ` (trục ${axisName})` : ""}${axisSpanLabel ? ` · ${axisSpanLabel}` : ""}`
      : `Cắt theo phương Y · Y=${at}${axisName ? ` (trục ${axisName})` : ""}${axisSpanLabel ? ` · ${axisSpanLabel}` : ""}`;

  const { segs, along0, along1, axes } = buildSectionAlongSegs(project, cutDir, at);
  const spanMm = Math.max(along1 - along0, 1);
  const padL = 28;
  const padR = 48;
  const drawW = maxW - padL - padR;
  // TL 1/75 đúng tỉ lệ; chỉ thu nhỏ khi nhịp dài hơn bề rộng khung vẽ
  const s = spanMm * sectionS <= drawW + 0.5 ? sectionS : drawW / spanMm;
  const usedW = spanMm * s;
  const scaleLabelN = Math.max(1, Math.round(72 / (25.4 * s)));
  const xBase = x + padL + (drawW - usedW) / 2;
  const toAlong = (mm: number) => xBase + (mm - along0) * s;

  const slabTmm = Math.max(model.thickness, 1);
  const maxBeamHmm = Math.max(
    1,
    ...segs.filter((g): g is Extract<SectionAlongSeg, { kind: "beam" }> => g.kind === "beam").map((g) => g.h),
    parseBeamSize(
      project.info.beamSizeX ||
        project.info.beamSizeY ||
        `${project.info.beamB || 200}x${project.info.beamH || 500}`,
    ).h,
  );
  const maxDropMm = Math.max(
    0,
    ...segs.filter((g): g is Extract<SectionAlongSeg, { kind: "slab" }> => g.kind === "slab").map((g) => g.drop),
  );
  // B (ngang) / Hs / H / drop — cùng hệ số s; không phóng lệch cao độ
  const slabT = slabTmm * s;
  const beamH = maxBeamHmm * s;
  const dropS = maxDropMm * s;
  // Chừa chỗ hàng số hiệu phía trên mặt cắt (vòng STT nằm trên đường ngang)
  const sy = y + 34;
  const slabTopY = sy;
  const slabBotY = sy + slabT;

  // Mặt sàn cao độ chuẩn (nét chuẩn)
  line(ctx, xBase - 4, slabTopY, toAlong(along1) + 4, slabTopY, 0.35, GRAY, [2, 2]);

  /** Mốc da dầm + lòng sàn (mm) để dim ngang dưới dim trục. */
  const faceMarksMm: number[] = [];
  for (const seg of segs) {
    if (faceMarksMm.length === 0 || Math.abs(faceMarksMm[faceMarksMm.length - 1]! - seg.lo) > 0.5) {
      faceMarksMm.push(seg.lo);
    }
    faceMarksMm.push(seg.hi);
  }

  /** Mép đoạn có kề dầm → không vẽ nét đứng cắt qua bề dày sàn (bê tông liền khối). */
  const abutsBeam = (mm: number) =>
    segs.some(
      (g) => g.kind === "beam" && (Math.abs(g.lo - mm) < 0.5 || Math.abs(g.hi - mm) < 0.5),
    );

  /** Đoạn kề mép dầm (sàn / ô thủng), nếu có. */
  const neighborAtFace = (faceMm: number, beamSeg: SectionAlongSeg) =>
    segs.find(
      (g) =>
        g !== beamSeg && (Math.abs(g.lo - faceMm) < 0.5 || Math.abs(g.hi - faceMm) < 0.5),
    );

  /**
   * Đỉnh nét đứng thân dầm tại một mép:
   * - Kề sàn → đáy sàn (không cắt qua bề dày sàn, bê tông liền khối)
   * - Kề ô thủng / mép ngoài → mặt sàn trên (để lộ cạnh dầm)
   */
  const stemTopAtFace = (faceMm: number, beamSeg: SectionAlongSeg) => {
    const neighbor = neighborAtFace(faceMm, beamSeg);
    if (neighbor?.kind === "slab") {
      const dropPx = neighbor.drop > 0 ? neighbor.drop * s : 0;
      return slabTopY + dropPx + slabT;
    }
    return slabTopY;
  };

  /**
   * Sàn thấp kề dầm: nét bậc (cạnh dầm lộ) từ line sàn cao độ chuẩn
   * xuống line mặt trên sàn thấp — nối với thân dầm bên dưới.
   */
  const drawLowSlabStepFace = (faceX: number, faceMm: number, beamSeg: SectionAlongSeg) => {
    const neighbor = neighborAtFace(faceMm, beamSeg);
    if (neighbor?.kind !== "slab" || !(neighbor.drop > 0)) return;
    const dropPx = neighbor.drop * s;
    if (dropPx < 0.5) return;
    const lowTop = slabTopY + dropPx;
    line(ctx, faceX, slabTopY, faceX, lowTop, 0.85);
  };

  for (const seg of segs) {
    const x0 = toAlong(seg.lo);
    const x1 = toAlong(seg.hi);
    const w = Math.max(x1 - x0, 0.5);
    if (seg.kind === "beam") {
      // H = chiều cao tổng từ mặt sàn trên xuống đáy dầm (cùng tỉ lệ với B và Hs)
      const bh = seg.h * s;
      const stemBot = slabTopY + bh;
      // Tô liền khối với sàn — không viền (tránh nét cắt qua bề dày sàn)
      fillRect(ctx, x0, slabTopY, w, bh, CONCRETE_FILL);
      // Mặt trên sàn liên tục qua vị trí dầm
      line(ctx, x0, slabTopY, x1, slabTopY, 0.85);
      // Sàn thấp: nét bậc từ line sàn trên → line mặt sàn thấp
      drawLowSlabStepFace(x0, seg.lo, seg);
      drawLowSlabStepFace(x1, seg.hi, seg);
      // Thân dầm dưới đáy sàn kề — không cắt qua bề dày sàn
      const leftStemTop = stemTopAtFace(seg.lo, seg);
      const rightStemTop = stemTopAtFace(seg.hi, seg);
      if (stemBot > leftStemTop + 0.5) {
        line(ctx, x0, leftStemTop, x0, stemBot, 0.85);
      }
      if (stemBot > rightStemTop + 0.5) {
        line(ctx, x1, rightStemTop, x1, stemBot, 0.85);
      }
      if (stemBot > Math.min(leftStemTop, rightStemTop) + 0.5) {
        line(ctx, x0, stemBot, x1, stemBot, 0.85);
      }
      if (seg.name) {
        textSimple(ctx, seg.name, (x0 + x1) / 2, stemBot + 8, 5.5, false, "center", GRAY);
      }
      continue;
    }
    if (seg.kind === "opening") {
      // Ô thủng: khung đúng chiều dày sàn + hai đường chéo
      const hOpen = Math.max(slabT, 2);
      rect(ctx, x0, slabTopY, w, hOpen, 0.55);
      line(ctx, x0, slabTopY, x1, slabTopY + hOpen, 0.55, GRAY);
      line(ctx, x0, slabTopY + hOpen, x1, slabTopY, 0.55, GRAY);
      if (seg.label) {
        textSimple(ctx, seg.label, (x0 + x1) / 2, slabTopY + hOpen + 8, 6, false, "center", GRAY);
      }
      continue;
    }
    // Sàn thường / sàn thấp — Hs cùng tỉ lệ s; không nét đứng tại mép kề dầm
    const dropPx = seg.drop > 0 ? seg.drop * s : 0;
    const top = slabTopY + dropPx;
    const bot = top + slabT;
    fillRect(ctx, x0, top, w, slabT, CONCRETE_FILL);
    line(ctx, x0, top, x1, top, 0.85);
    line(ctx, x0, bot, x1, bot, 0.85);
    if (!abutsBeam(seg.lo)) line(ctx, x0, top, x0, bot, 0.85);
    if (!abutsBeam(seg.hi)) line(ctx, x1, top, x1, bot, 0.85);
    if (seg.drop > 0) {
      // Bậc sàn thấp: nét đứng chỉ ở mép không kề dầm (kề dầm = bê tông liền khối)
      if (!abutsBeam(seg.lo)) line(ctx, x0, slabTopY, x0, bot, 0.75);
      if (!abutsBeam(seg.hi)) line(ctx, x1, slabTopY, x1, bot, 0.75);
      for (const hs of rectDiagonalHatchSegments(seg.lo, 0, seg.hi, Math.max(seg.drop, 1), 180)) {
        const ax = toAlong(hs.xA);
        const bx = toAlong(hs.xB);
        const ay = top + (hs.yA / Math.max(seg.drop, 1)) * slabT;
        const by = top + (hs.yB / Math.max(seg.drop, 1)) * slabT;
        line(ctx, ax, ay, bx, by, 0.35, GRAY);
      }
      textSimple(
        ctx,
        `${seg.label || "ST"} (-${Math.round(seg.drop)})`,
        (x0 + x1) / 2,
        bot + 9,
        6,
        false,
        "center",
        GRAY,
      );
    }
  }

  // Chấm thép ⊥ mặt cắt (trong đoạn sàn) + nét dọc xuyên dầm / neo + móc
  // cutDir X → cắt tại X, nhìn theo Y: nét dọc = thép Y, chấm = thép X
  // cutDir Y → cắt tại Y, nhìn theo X: nét dọc = thép X, chấm = thép Y
  const zones = effectiveZones(project);
  const coverMm = slabCoverMm(project);
  const alongDir: "X" | "Y" = cutDir === "X" ? "Y" : "X";
  const perpDir: "X" | "Y" = cutDir;
  const hasBot = zones.some(
    (z) => (z.layer === "bottom" || z.layer === "structural") && z.direction === perpDir,
  );
  const hasTop = zones.some((z) => z.layer === "top" && z.direction === perpDir);
  const hasBotLong = zones.some(
    (z) => (z.layer === "bottom" || z.layer === "structural") && z.direction === alongDir,
  );
  const hasTopLong = zones.some((z) => z.layer === "top" && z.direction === alongDir);
  const botLongZone = zones.find(
    (z) => (z.layer === "bottom" || z.layer === "structural") && z.direction === alongDir,
  );
  const topLongZone = zones.find((z) => z.layer === "top" && z.direction === alongDir);
  const botHookL = Math.max(0, Math.round(Number(botLongZone?.leftHook) || 0));
  const botHookR = Math.max(0, Math.round(Number(botLongZone?.rightHook) || 0));
  const topHookL = Math.max(0, Math.round(Number(topLongZone?.leftHook) || 0));
  const topHookR = Math.max(0, Math.round(Number(topLongZone?.rightHook) || 0));

  /** Đoạn sàn đầu tiên đủ rộng — neo đường chỉ sắt. */
  let leaderSlab: { x0: number; x1: number; yBot: number; yTop: number } | null = null;

  /** Cao độ thép trong bề dày sàn (y tăng xuống trang): trên gần mặt sàn, dưới gần đáy. */
  const yTopOf = (top: number) => top + slabT * 0.32;
  const yBotOf = (top: number) => top + slabT * 0.68;

  /** economy2: chấm lớp trên chỉ trong dải mũ (phương ⊥ mặt cắt). */
  const topPerpHats = zones.filter((z) => z.layer === "top" && z.direction === perpDir);
  const alongInTopPerpHat = (alongMm: number) => {
    if (project.layoutPreset !== "economy2") return true;
    if (!topPerpHats.length) return false;
    return topPerpHats.some((z) => {
      const lo = alongDir === "X" ? Math.min(z.x1, z.x2) : Math.min(z.y1, z.y2);
      const hi = alongDir === "X" ? Math.max(z.x1, z.x2) : Math.max(z.y1, z.y2);
      return alongMm >= lo - 1 && alongMm <= hi + 1;
    });
  };

  /**
   * Nét thép dọc: lớp dưới xuyên nhịp; lớp trên economy2 = từng đoạn mũ (hở giữa sàn).
   * Móc xuống: đầu móc vừa chạm đường đáy sàn (không vượt khỏi line sàn).
   */
  const botRuns = hasBotLong ? buildSectionLongRebarRuns(segs, coverMm) : [];
  const topRuns =
    hasTopLong
      ? project.layoutPreset === "economy2"
        ? buildEconomy2HatSectionRuns(project, alongDir)
        : buildSectionLongRebarRuns(segs, coverMm)
      : [];
  /** Móc từ cao độ thanh xuống vừa chạm đáy sàn (trừ nửa nét để không vượt line). */
  const drawHookToSlabBot = (x: number, yBar: number, slabBotY: number) => {
    const tipY = slabBotY - 0.35;
    if (tipY - yBar < 0.8) return;
    line(ctx, x, yBar, x, tipY, 0.7, REBAR_RED);
  };
  const drawLongRun = (
    run: SectionLongRebarRun,
    yBar: number,
    hookL: number,
    hookR: number,
    slabBotY: number,
  ) => {
    const x0 = toAlong(run.loMm);
    const x1 = toAlong(run.hiMm);
    if (x1 - x0 < 2) return;
    line(ctx, x0, yBar, x1, yBar, 0.55, REBAR_RED);
    if (run.leftTerm && hookL > 0) drawHookToSlabBot(x0, yBar, slabBotY);
    if (run.rightTerm && hookR > 0) drawHookToSlabBot(x1, yBar, slabBotY);
  };
  for (const run of botRuns) {
    const dropPx = run.drop > 0 ? run.drop * s : 0;
    const top = slabTopY + dropPx;
    // Lớp dưới: móc xuống vừa chạm đáy sàn
    drawLongRun(run, yBotOf(top), botHookL, botHookR, top + slabT);
  }
  for (const run of topRuns) {
    const dropPx = run.drop > 0 ? run.drop * s : 0;
    const top = slabTopY + dropPx;
    // Lớp trên: móc xuống vừa chạm đáy sàn
    drawLongRun(run, yTopOf(top), topHookL, topHookR, top + slabT);
  }

  // Chấm ⊥ vẽ SAU nét thép — lớp dưới dưới nét; lớp trên trên nét, vừa chạm (không hở).
  const DOT_R = 1.6 * 0.4;
  const DOT_BORDER = Math.max(0.22, 0.6 * 0.4);
  for (const seg of segs) {
    if (seg.kind !== "slab") continue;
    const x0 = toAlong(seg.lo) + 2;
    const x1 = toAlong(seg.hi) - 2;
    if (x1 - x0 < 4) continue;
    const dropPx = seg.drop > 0 ? seg.drop * s : 0;
    const top = slabTopY + dropPx;
    const yBot = yBotOf(top);
    const yTopR = yTopOf(top);
    const n = Math.max(2, Math.min(14, Math.floor((x1 - x0) / 12)));
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const alongMm = seg.lo + (seg.hi - seg.lo) * t;
      const px = x0 + (x1 - x0) * t;
      if (hasBot) {
        // Chấm đặc nằm dưới nét thép lớp dưới (mép trên vừa chạm nét)
        ctx.page.drawCircle({
          x: px,
          y: ty(yBot + DOT_R),
          size: DOT_R,
          color: REBAR_RED,
        });
      }
      if (hasTop && alongInTopPerpHat(alongMm)) {
        // Chấm rỗng nằm trên nét thép lớp trên — mép dưới vừa chạm (không hở)
        ctx.page.drawCircle({
          x: px,
          y: ty(yTopR - DOT_R - DOT_BORDER * 0.5),
          size: DOT_R,
          borderColor: REBAR_RED,
          borderWidth: DOT_BORDER,
        });
      }
    }
    if (!leaderSlab && x1 - x0 > 28) {
      leaderSlab = { x0, x1, yBot, yTop: yTopR };
    }
  }

  // Đường chỉ sắt — mọi số hiệu trên CÙNG một hàng ngang, chữ nằm trên line
  if (leaderSlab) {
    const mid = (leaderSlab.x0 + leaderSlab.x1) / 2;
    // Cao đường ngang / thanh đứng ≈ nửa so với trước
    const shelfY = slabTopY - 10;
    const botInfo = hasBot ? sectionSteelCallout(ctx, "bottom", perpDir) : null;
    const topInfo = hasTop ? sectionSteelCallout(ctx, "top", perpDir) : null;
    const longBotPieces = hasBotLong ? sectionCutPieceCallouts(ctx, "bottom", alongDir) : [];
    const longTopPieces = hasTopLong ? sectionCutPieceCallouts(ctx, "top", alongDir) : [];
    const longBot =
      longBotPieces.length > 0
        ? null
        : hasBotLong
          ? sectionSteelCallout(ctx, "bottom", alongDir)
          : null;
    const longTop =
      longTopPieces.length > 0
        ? null
        : hasTopLong
          ? sectionSteelCallout(ctx, "top", alongDir)
          : null;

    type LeaderJob = {
      tipX: number;
      tipY: number;
      labelCx: number;
      stt: number | string;
      dia: number;
      spacing: number;
    };
    const jobs: LeaderJob[] = [];

    if (botInfo) {
      const tipX = mid - Math.min(24, (leaderSlab.x1 - leaderSlab.x0) * 0.2);
      jobs.push({
        tipX,
        tipY: leaderSlab.yBot,
        labelCx: tipX - 18,
        stt: botInfo.stt,
        dia: botInfo.dia,
        spacing: botInfo.spacing,
      });
    }
    if (topInfo) {
      const tipX = mid + Math.min(24, (leaderSlab.x1 - leaderSlab.x0) * 0.2);
      jobs.push({
        tipX,
        tipY: leaderSlab.yTop,
        labelCx: tipX + 21,
        stt: topInfo.stt,
        dia: topInfo.dia,
        spacing: topInfo.spacing,
      });
    }

    const pushCutPieces = (
      pieces: Array<{ stt: string; dia: number; spacing: number; barLength: number }>,
      yBar: number,
      side: "left" | "right",
      runsForTips: SectionLongRebarRun[],
    ) => {
      if (pieces.length < 2) return;
      const total = pieces.reduce((s, p) => s + Math.max(1, p.barLength), 0);
      let acc = 0;
      // Neo tip theo từng đoạn mũ/thanh (không trải đều cả nhịp khi economy2)
      const spanLo = runsForTips.length
        ? Math.min(...runsForTips.map((r) => toAlong(r.loMm)))
        : leaderSlab.x0;
      const spanHi = runsForTips.length
        ? Math.max(...runsForTips.map((r) => toAlong(r.hiMm)))
        : leaderSlab.x1;
      for (const p of pieces) {
        const frac = (acc + p.barLength / 2) / total;
        acc += p.barLength;
        let tipX = spanLo + (spanHi - spanLo) * Math.min(0.92, Math.max(0.08, frac));
        // Gắn tip vào đoạn run gần nhất (mũ có khoảng hở giữa sàn)
        if (runsForTips.length) {
          let best = runsForTips[0]!;
          let bestD = Infinity;
          for (const r of runsForTips) {
            const cx = (toAlong(r.loMm) + toAlong(r.hiMm)) / 2;
            const d = Math.abs(cx - tipX);
            if (d < bestD) {
              bestD = d;
              best = r;
            }
          }
          tipX = (toAlong(best.loMm) + toAlong(best.hiMm)) / 2;
        }
        jobs.push({
          tipX,
          tipY: yBar,
          labelCx: side === "left" ? tipX - 14 : tipX + 17,
          stt: p.stt,
          dia: p.dia,
          spacing: p.spacing,
        });
      }
    };
    if (longBotPieces.length >= 2) {
      pushCutPieces(longBotPieces, leaderSlab.yBot, "left", botRuns);
    }
    if (longTopPieces.length >= 2) {
      pushCutPieces(longTopPieces, leaderSlab.yTop, "right", topRuns);
    }

    const sameSpec = (
      a: { dia: number; spacing: number } | null,
      b: { dia: number; spacing: number } | null,
    ) => !!a && !!b && a.dia === b.dia && a.spacing === b.spacing;
    if (longBot && !sameSpec(longBot, botInfo)) {
      jobs.push({
        tipX: mid,
        tipY: leaderSlab.yBot,
        labelCx: mid - 5,
        stt: longBot.stt,
        dia: longBot.dia,
        spacing: longBot.spacing,
      });
    }
    if (longTop && !sameSpec(longTop, topInfo)) {
      const tipX =
        topRuns.length === 1
          ? (toAlong(topRuns[0]!.loMm) + toAlong(topRuns[0]!.hiMm)) / 2
          : mid + 18;
      jobs.push({
        tipX,
        tipY: leaderSlab.yTop,
        labelCx: tipX + 17,
        stt: longTop.stt,
        dia: longTop.dia,
        spacing: longTop.spacing,
      });
    }

    // Tránh đè nhãn: sắp theo tipX, lệch labelCx nếu trùng (callout mặt cắt ×0.5)
    jobs.sort((a, b) => a.tipX - b.tipX);
    const minGap = 26;
    for (let i = 1; i < jobs.length; i++) {
      const prev = jobs[i - 1]!;
      const cur = jobs[i]!;
      if (cur.labelCx - prev.labelCx < minGap) {
        cur.labelCx = prev.labelCx + minGap;
      }
    }
    for (const j of jobs) {
      drawSectionRebarLeader(ctx, j.tipX, j.tipY, j.labelCx, shelfY, j.stt, j.dia, j.spacing);
    }
  }

  // Đường dẫn tim trục xuống vùng dim (bubble vẽ sau, ngoài cùng)
  const geomBottomY = slabTopY + beamH + dropS;
  for (const ax of axes) {
    const px = toAlong(ax.pos);
    line(ctx, px, slabTopY, px, geomBottomY + 4, 0.35, AXIS_LINE, AXIS_CENTERLINE_DASH);
  }

  // Dim đứng: Hs + H (phải)
  const dimX = toAlong(along1) + 14;
  dimV(ctx, dimX, slabTopY, slabBotY, `${Math.round(slabTmm)}`, 6, "right");
  if (beamH > slabT + 1) {
    dimV(ctx, dimX + 16, slabTopY, slabTopY + beamH, `${Math.round(maxBeamHmm)}`, 6, "right");
  }
  if (maxDropMm > 0 && dropS > 1) {
    dimV(
      ctx,
      dimX + 32,
      slabTopY,
      slabTopY + dropS,
      `${Math.round(maxDropMm)}`,
      5.5,
      "right",
    );
  }

  /**
   * Dim ngang dưới mặt cắt — ngoài → vào:
   * số hiệu trục → dim tim trục → dim B + lòng sàn → hình vẽ.
   */
  let yDim = geomBottomY + DIM_FROM_EDGE + 10;
  const axisMarksMm = axes.map((a) => a.pos);
  if (faceMarksMm.length >= 2) {
    dimHChain(ctx, faceMarksMm, yDim, toAlong, 5.2);
    yDim += DIM_CHAIN_GAP_X;
  }
  if (axisMarksMm.length >= 2) {
    dimHChain(ctx, axisMarksMm, yDim, toAlong, 5.5);
    yDim += DIM_CHAIN_GAP_X;
  }
  yDim += DIM_TO_BUBBLE + AXIS_BUBBLE_R;
  const axisBubbleY = yDim;
  for (const ax of axes) {
    const px = toAlong(ax.pos);
    line(ctx, px, geomBottomY + 4, px, axisBubbleY - AXIS_BUBBLE_R, 0.35, AXIS_LINE, AXIS_CENTERLINE_DASH);
    ctx.page.drawCircle({
      x: px,
      y: ty(axisBubbleY),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.65,
    });
    textInAxisBubble(ctx, ax.name, px, axisBubbleY, 6);
  }

  /**
   * Dưới vòng số hiệu (trên → dưới):
   * MẶT CẮT THÉP SÀN … → TL · Lớp BV → Cắt theo phương …
   */
  const titleY = axisBubbleY + AXIS_BUBBLE_R + 10;
  textSimple(ctx, title, x + maxW / 2, titleY, 8.5, true, "center");
  textSimple(
    ctx,
    `TL 1/${scaleLabelN} · Lớp BV ${project.info.cover}`,
    x + maxW / 2,
    titleY + 12,
    6.2,
    false,
    "center",
    GRAY,
  );
  textSimple(ctx, sub, x + maxW / 2, titleY + 24, 6.2, false, "center", GRAY);
  return titleY + 36;
}

/** A-A trên, B-B dưới — tỉ lệ mặt cắt 1/75 (dùng gần full bề rộng trang). */
function drawSectionCutsAboveSchedule(
  ctx: Ctx,
  x: number,
  y: number,
  maxW: number,
  sectionS: number,
): number {
  const gap = 14;
  const bottomA = drawRebarSectionCut(ctx, x, y, maxW, "X", sectionS);
  const bottomB = drawRebarSectionCut(ctx, x, bottomA + gap, maxW, "Y", sectionS);
  return bottomB;
}

function drawScheduleTable(ctx: Ctx, x: number, y: number) {
  const { project } = ctx;
  const rows = buildPdfScheduleRows(ctx);
  // Tên CK | Lớp (bằng cột Ø) | STT | …
  const cols = [
    { w: 36 },
    { w: 26 },
    { w: 36 },
    { w: 158 },
    { w: 26 },
    { w: 50 },
    { w: 26 },
    { w: 34 },
    { w: 38 },
    { w: 46 },
    { w: 48 },
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
    "LỚP",
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

  const layerKeyOf = (layer: ScheduleRow["layer"]) =>
    layer === "top" ? "top" : layer === "structural" ? "structural" : "bottom";

  rows.forEach((row, i) => {
    const ry = ty0 + headerH + i * rowH;
    const next = rows[i + 1];
    const layerBreak =
      !next || layerKeyOf(next.layer) !== layerKeyOf(row.layer);
    // Gộp cột LỚP theo nhóm lớp — kẻ ngang từ STT trở đi; hết nhóm thì kẻ cả cột LỚP
    line(ctx, layerBreak ? colX[1] : colX[2], ry + rowH, x + w, ry + rowH, 0.3);
    const sttLabel = String(row.stt);
    const sttSize = sttLabel.length >= 3 ? 6.2 : 7;
    textSimple(ctx, sttLabel, mid(2), ry + rowH / 2 + 2, sttSize, true, "center");
    drawShape(ctx, row, colX[3] + 2, ry + 1, cols[3].w - 4, rowH - 2);
    textSimple(ctx, String(row.dia), mid(4), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.barLength), mid(5), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.qtyMembers), mid(6), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.qtyEach), mid(7), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, String(row.qtyTotal), mid(8), ry + rowH / 2 + 2, 7, false, "center");
    textSimple(ctx, fmtNum(row.totalM), mid(9), ry + rowH / 2 + 2, 6.8, false, "center");
    textSimple(ctx, fmtNum(row.weight), mid(10), ry + rowH / 2 + 2, 6.8, false, "center");
  });
  if (rows.length === 0) {
    textSimple(ctx, "—", mid(2), ty0 + headerH + rowH / 2, 7, false, "center");
  }

  // TÊN CK: 1 chữ đứng đậm, canh giữa cột
  textVerticalInColumn(
    ctx,
    project.info.name || "SÀN",
    colX[0],
    cols[0].w,
    ty0 + headerH + (Math.max(rows.length, 1) * rowH) / 2,
    9,
    true,
  );

  // LỚP: 1 chữ đứng đậm / nhóm (Lớp dưới | Lớp trên), canh giữa cột
  let gi = 0;
  while (gi < rows.length) {
    const key = layerKeyOf(rows[gi]!.layer);
    let gj = gi + 1;
    while (gj < rows.length && layerKeyOf(rows[gj]!.layer) === key) gj++;
    const y0 = ty0 + headerH + gi * rowH;
    const y1 = ty0 + headerH + gj * rowH;
    const label = scheduleLayerLabel(rows[gi]!.layer);
    const span = Math.max(12, y1 - y0 - 4);
    let size = 8;
    while (size > 5.2 && ctx.fontBold.widthOfTextAtSize(label, size) > span) size -= 0.3;
    textVerticalInColumn(ctx, label, colX[1], cols[1].w, (y0 + y1) / 2, size, true);
    gi = gj;
  }

  return { w, h: 18 + h };
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
  return { w, h: fy + 10 - y };
}

/** Kích thước khối bảng TK + tổng hợp (cùng hàng) — để neo góc dưới phải. */
function scheduleSummaryBlockSize(ctx: Ctx): {
  schedW: number;
  schedH: number;
  sumW: number;
  sumH: number;
  blockW: number;
  blockH: number;
} {
  const rows = buildPdfScheduleRows(ctx);
  const schedW = 36 + 26 + 36 + 158 + 26 + 50 + 26 + 34 + 38 + 46 + 48;
  const schedH = 18 + 34 + Math.max(rows.length, 1) * 18;
  const dias = new Set(rows.map((r) => r.dia));
  const sumW = 138 + Math.max(dias.size, 1) * 78;
  const sumH = 18 + 4 * 24 + 12 + 10;
  const gap = 14;
  return {
    schedW,
    schedH,
    sumW,
    sumH,
    blockW: schedW + gap + sumW,
    blockH: Math.max(schedH, sumH),
  };
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

  const pagePad = 28;
  // Khung ngoài khổ A1
  ctx.page.drawRectangle({
    x: 16,
    y: 16,
    width: PAGE_W - 32,
    height: PAGE_H - 32,
    borderColor: BLACK,
    borderWidth: 1.35,
  });

  /**
   * Tiêu đề phía trên (không khung viền):
   * SHOP DRAWING… đậm lớn → gạch chân ngang bằng chân dấu ()
   * → tên sàn + dòng bê tông/thép/BV/A1 (cỡ = 2/3 tiêu đề = gấp đôi 1/3 cũ).
   */
  const shopSize = 28;
  const subSize = (shopSize / 3) * 2; // gấp đôi cỡ phụ trước đó (~18.7pt)
  const titleY = pagePad + 22;
  textSimple(ctx, SHOP_TITLE, PAGE_W / 2, titleY, shopSize, true, "center");

  // Chân gạch ≈ đáy dấu () (baseline textSimple + descent glyph + nửa nét)
  const underlineW = 1.1;
  const kitScale = shopSize / ctx.boldKit.unitsPerEm;
  let parenDescent = 0;
  for (const g of ctx.boldKit.layout("()").glyphs) {
    parenDescent = Math.max(parenDescent, -g.cbox.minY * kitScale);
  }
  const underlineY = titleY + shopSize * 0.78 + parenDescent + underlineW / 2 + 0.5;
  line(ctx, pagePad, underlineY, PAGE_W - pagePad, underlineY, underlineW);

  const projTitle = `${project.info.name} (SL=${project.info.quantity}; dày=${project.info.thickness}mm)`;
  const projY = underlineY + 16;
  textSimple(ctx, "1/1", pagePad, projY, subSize * 0.75, false, "left");
  textSimple(ctx, projTitle, PAGE_W / 2, projY, subSize, true, "center");

  const gradesY = projY + subSize + 12;
  textSimple(
    ctx,
    `Bê tông ${project.info.concreteGrade} · Thép ${project.info.steelGrade} · Lớp BV ${project.info.cover}mm · Khổ A1`,
    PAGE_W / 2,
    gradesY,
    subSize,
    false,
    "center",
  );

  /**
   * Một trang A1:
   * Hàng trên: Lớp dưới (trái) | Lớp trên (phải).
   * Dưới lớp dưới: Mặt cắt A-A → B-B.
   * Góc dưới phải: Bảng thống kê | Tổng hợp (cùng một hàng).
   */
  const marginX = pagePad;
  const gap = 14;
  const topY = gradesY + subSize + 18;
  const bottomLimit = PAGE_H - pagePad;
  const colW = Math.floor((PAGE_W - marginX * 2 - gap) / 2);
  const leftX = marginX;
  const rightX = marginX + colW + gap;

  const tableBlock = scheduleSummaryBlockSize(ctx);
  const tableGap = 14;

  // Chừa chỗ dưới cột trái cho 2 mặt cắt (+ dim trục / B+sàn)
  const estSecHFor = (s: number) => {
    const maxBeam = Math.max(
      parseBeamSize(
        project.info.beamSizeX || `${project.info.beamB || 200}x${project.info.beamH || 500}`,
      ).h,
      parseBeamSize(
        project.info.beamSizeY || `${project.info.beamB || 200}x${project.info.beamH || 500}`,
      ).h,
      project.info.beamH || 500,
    );
    const maxDrop = Math.max(0, ...(project.lowSlabs ?? []).map((ls) => ls.drop || 0));
    const one =
      34 +
      maxBeam * s +
      maxDrop * s +
      DIM_FROM_EDGE +
      10 +
      DIM_CHAIN_GAP_X * 2 +
      DIM_TO_BUBBLE +
      AXIS_BUBBLE_R * 2 +
      10 +
      36;
    return one * 2 + gap;
  };

  // Mặt cắt phóng to TL 1/75; mặt bằng fit còn lại
  const sectionS = scalePtPerMm(SECTION_DRAWING_SCALE);
  let planH = Math.max(
    220,
    Math.min(560, bottomLimit - topY - estSecHFor(sectionS) - gap - tableBlock.blockH - 28),
  );
  let planS = planScale(project, colW, planH);
  for (let i = 0; i < 5; i++) {
    const secH = estSecHFor(sectionS);
    const estPlanBlock = planH + 95;
    if (topY + estPlanBlock + gap + secH + 8 <= bottomLimit - tableBlock.blockH) break;
    planH = Math.max(180, planH - 40);
    planS = planScale(project, colW, planH);
  }

  const afterBottom = drawPlan(ctx, leftX, topY, colW, planH, zones, "bottom");
  const afterTop = drawPlan(ctx, rightX, topY, colW, planH, zones, "top");
  const afterPlans = Math.max(afterBottom, afterTop);

  // A-A / B-B dưới mặt bằng — full bề rộng 2 cột để giữ đúng TL 1/75
  const sectionW = PAGE_W - marginX * 2;
  drawSectionCutsAboveSchedule(ctx, leftX, afterPlans + gap, sectionW, sectionS);

  // Bảng TK + Tổng hợp: cùng hàng, neo góc dưới phải (trong khung trang)
  const tablesX = PAGE_W - pagePad - tableBlock.blockW;
  const tablesY = PAGE_H - pagePad - tableBlock.blockH;
  drawScheduleTable(ctx, tablesX, tablesY);
  drawSummaryTable(ctx, tablesX + tableBlock.schedW + tableGap, tablesY);

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
