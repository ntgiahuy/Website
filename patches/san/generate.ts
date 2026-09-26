import { PDFDocument, PDFFont, PDFPage, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  STOCK_M,
  computeModel,
  effectiveZones,
  parseBeamSize,
  weightPerMeter,
  barsFromDistLength,
  type ComputedSlabModel,
  type ScheduleRow,
} from "../calc";
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
  type RebarBarSeg,
} from "../grid";
import type { GridAxis, PlanBeam, RebarLayer, RebarZone, SlabProject } from "../types";

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
  const groups = new Map<number, ScheduleRow & { stt: number }>();
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
    const prev = groups.get(info.stt);
    if (!prev) {
      groups.set(info.stt, { ...row, stt: info.stt });
      continue;
    }
    // Chỉ gộp khi cùng Ø+a+dài+móc (STT đã khóa móc) — cộng số thanh 1 CK
    const qtyEach = prev.qtyEach + row.qtyEach;
    const qtyMembers = Math.max(prev.qtyMembers, row.qtyMembers);
    const qtyTotal = qtyEach * qtyMembers;
    const totalM = (prev.barLength * qtyTotal) / 1000;
    groups.set(info.stt, {
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

  for (const info of registry.values()) {
    if (groups.has(info.stt)) continue;
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
    groups.set(info.stt, {
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

  return [...groups.values()].sort((a, b) => a.stt - b.stt);
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
  /** Zone thuộc lớp đang vẽ (structural gộp vào lớp dưới). */
  const layerZones = zones.filter((z) =>
    layer === "top" ? z.layer === "top" : z.layer === "bottom" || z.layer === "structural",
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

  // Số hiệu trên từng cây điển hình (STT chung 2 lớp)
  const CALL_GAP = 8;
  const sttRegistry = unifiedSttRegistry(project, ctx.model.schedule, allDrawBars, rebarZones);
  for (const bar of drawBars) {
    const info = sttInfoForPlanBar(project, ctx.model.schedule, sttRegistry, rebarZones, bar);
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
      if (alongY) {
        textSimple(ctx, label, (pxA + pxB) / 2 + 5, (pyA + pyB) / 2, 5.5, false, "left", DIST_BLUE);
      } else {
        textSimple(ctx, label, (pxA + pxB) / 2, (pyA + pyB) / 2 - 6, 5.5, false, "center", DIST_BLUE);
      }
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
  const titleY = dimBottomY + 18;
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
function buildPdfScheduleRows(ctx: Ctx): Array<ScheduleRow & { stt: number }> {
  const { project, model } = ctx;
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const zones = effectiveZones(project);
  const bars = stripRebarBarSegments(project, axesX, axesY);
  const drawBars = typicalLayeredRebarBars(project, bars, zones);
  const registry = unifiedSttRegistry(project, model.schedule, drawBars, zones);
  return scheduleRowsByStt(
    model.schedule,
    registry,
    drawBars,
    zones,
    project,
    project.info.cover || 50,
  );
}


/** Đoạn mặt cắt dọc theo đường cắt (mm thế giới). */
type SectionAlongSeg =
  | { kind: "beam"; lo: number; hi: number; h: number; name: string }
  | { kind: "slab"; lo: number; hi: number; drop: number; label?: string }
  | { kind: "opening"; lo: number; hi: number; label?: string };

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
function buildSectionAlongSegs(
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

/**
 * Đường chỉ sắt trên mặt cắt: nét dẫn từ điểm trên thép → vòng STT + Ødia a spacing.
 */
function drawSectionRebarLeader(
  ctx: Ctx,
  tipX: number,
  tipY: number,
  labelCx: number,
  labelCy: number,
  stt: number,
  dia: number,
  spacing: number,
) {
  const r = REBAR_MARK_R;
  // Elbow: tip → ngang → tâm vòng
  const midX = tipX + (labelCx - tipX) * 0.35;
  line(ctx, tipX, tipY, midX, labelCy, 0.5, REBAR_RED);
  line(ctx, midX, labelCy, labelCx - r - 1.5, labelCy, 0.5, REBAR_RED);
  // Chấm neo tại tip
  ctx.page.drawCircle({ x: tipX, y: ty(tipY), size: 1.2, color: REBAR_RED });
  drawRebarCallout(ctx, labelCx, labelCy, stt, dia, spacing, "X");
}

/** STT + Ø + a theo lớp/phương từ bảng thống kê PDF. */
function sectionSteelCallout(
  ctx: Ctx,
  layer: "bottom" | "top",
  dir: "X" | "Y",
): { stt: number; dia: number; spacing: number } | null {
  const zones = effectiveZones(ctx.project);
  const z = zones.find((zone) =>
    layer === "top"
      ? zone.layer === "top" && zone.direction === dir
      : (zone.layer === "bottom" || zone.layer === "structural") && zone.direction === dir,
  );
  if (!z) return null;
  const rows = buildPdfScheduleRows(ctx);
  const row =
    rows.find(
      (r) =>
        r.direction === dir &&
        (layer === "top" ? r.layer === "top" : r.layer === "bottom" || r.layer === "structural") &&
        r.dia === z.dia &&
        r.spacing === z.spacing,
    ) ??
    rows.find((r) => r.dia === z.dia && r.spacing === z.spacing && r.direction === dir) ??
    rows.find((r) => r.dia === z.dia && r.spacing === z.spacing);
  return {
    stt: row?.stt ?? 1,
    dia: z.dia,
    spacing: z.spacing,
  };
}

/**
 * Mặt cắt thép sàn đúng tỉ lệ mặt bằng: từ trục đầu → trục cuối,
 * đủ dầm / ô thủng / sàn thấp trên đường cắt.
 * `cutDir` X → MẶT CẮT A-A; Y → MẶT CẮT B-B.
 * `planS` = cùng hệ số tỉ lệ với bản vẽ mặt bằng.
 */
function drawRebarSectionCut(
  ctx: Ctx,
  x: number,
  y: number,
  maxW: number,
  cutDir: "X" | "Y",
  planS: number,
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

  textSimple(ctx, title, x + maxW / 2, y + 2, 8.5, true, "center");
  textSimple(ctx, sub, x + maxW / 2, y + 14, 6.2, false, "center", GRAY);

  const { segs, along0, along1, axes } = buildSectionAlongSegs(project, cutDir, at);
  const spanMm = Math.max(along1 - along0, 1);
  const padL = 28;
  const padR = 48;
  const drawW = maxW - padL - padR;
  // Một tỉ lệ s cho cả nhịp + B dầm + dày sàn + H dầm (đúng tỉ lệ 3 kích thước)
  const s = Math.min(planS, drawW / spanMm);
  const usedW = spanMm * s;
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
  // Chừa chỗ đường chỉ sắt phía trên mặt sàn
  const sy = y + 42;
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

  for (const seg of segs) {
    const x0 = toAlong(seg.lo);
    const x1 = toAlong(seg.hi);
    const w = Math.max(x1 - x0, 0.5);
    if (seg.kind === "beam") {
      // H = chiều cao tổng từ mặt sàn trên xuống đáy dầm (cùng tỉ lệ với B và Hs)
      const bh = seg.h * s;
      rect(ctx, x0, slabTopY, w, bh, 0.85, CONCRETE_FILL);
      // Ranh dày sàn trong thân dầm
      if (slabT < bh - 0.5) {
        line(ctx, x0, slabBotY, x1, slabBotY, 0.45, GRAY);
      }
      if (seg.name) {
        textSimple(ctx, seg.name, (x0 + x1) / 2, slabTopY + bh + 8, 5.5, false, "center", GRAY);
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
    // Sàn thường / sàn thấp — Hs cùng tỉ lệ s
    const dropPx = seg.drop > 0 ? seg.drop * s : 0;
    const top = slabTopY + dropPx;
    rect(ctx, x0, top, w, slabT, 0.85, CONCRETE_FILL);
    if (seg.drop > 0) {
      line(ctx, x0, slabTopY, x0, top + slabT, 0.75);
      line(ctx, x1, slabTopY, x1, top + slabT, 0.75);
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
        top + slabT + 9,
        6,
        false,
        "center",
        GRAY,
      );
    }
  }

  // Chấm thép ⊥ mặt cắt + nét dọc thanh song song trong đoạn sàn
  const zones = effectiveZones(project);
  const perpDir: "X" | "Y" = cutDir === "X" ? "Y" : "X";
  const hasBot = zones.some(
    (z) => (z.layer === "bottom" || z.layer === "structural") && z.direction === perpDir,
  );
  const hasTop = zones.some((z) => z.layer === "top" && z.direction === perpDir);
  const hasBotLong = zones.some(
    (z) => (z.layer === "bottom" || z.layer === "structural") && z.direction === cutDir,
  );
  const hasTopLong = zones.some((z) => z.layer === "top" && z.direction === cutDir);

  /** Đoạn sàn đầu tiên đủ rộng — neo đường chỉ sắt. */
  let leaderSlab: { x0: number; x1: number; yBot: number; yTop: number } | null = null;

  for (const seg of segs) {
    if (seg.kind !== "slab") continue;
    const x0 = toAlong(seg.lo) + 2;
    const x1 = toAlong(seg.hi) - 2;
    if (x1 - x0 < 4) continue;
    const dropPx = seg.drop > 0 ? seg.drop * s : 0;
    const top = slabTopY + dropPx;
    const yBot = top + slabT * 0.35;
    const yTopR = top + slabT * 0.65;
    if (hasBotLong) line(ctx, x0, yBot, x1, yBot, 0.55, REBAR_RED);
    if (hasTopLong) line(ctx, x0, yTopR, x1, yTopR, 0.55, REBAR_RED);
    const n = Math.max(2, Math.min(14, Math.floor((x1 - x0) / 12)));
    for (let i = 0; i < n; i++) {
      const px = x0 + ((x1 - x0) * i) / Math.max(1, n - 1);
      if (hasBot) {
        ctx.page.drawCircle({ x: px, y: ty(yBot), size: 1.6, color: REBAR_RED });
      }
      if (hasTop) {
        ctx.page.drawCircle({
          x: px,
          y: ty(yTopR),
          size: 1.6,
          borderColor: REBAR_RED,
          borderWidth: 0.6,
        });
      }
    }
    if (!leaderSlab && x1 - x0 > 28) {
      leaderSlab = { x0, x1, yBot, yTop: yTopR };
    }
  }

  // Đường chỉ sắt: số hiệu · Ø · khoảng cách (lớp dưới / lớp trên)
  if (leaderSlab) {
    const mid = (leaderSlab.x0 + leaderSlab.x1) / 2;
    const botInfo = hasBot ? sectionSteelCallout(ctx, "bottom", perpDir) : null;
    const topInfo = hasTop ? sectionSteelCallout(ctx, "top", perpDir) : null;
    const longBot = hasBotLong ? sectionSteelCallout(ctx, "bottom", cutDir) : null;
    const longTop = hasTopLong ? sectionSteelCallout(ctx, "top", cutDir) : null;

    // Lớp dưới (chấm đặc) — chỉ lên trên bên trái
    if (botInfo) {
      const tipX = mid - Math.min(24, (leaderSlab.x1 - leaderSlab.x0) * 0.2);
      drawSectionRebarLeader(
        ctx,
        tipX,
        leaderSlab.yBot,
        tipX - 36,
        slabTopY - 16,
        botInfo.stt,
        botInfo.dia,
        botInfo.spacing,
      );
    }
    // Lớp trên (chấm rỗng) — chỉ lên trên bên phải
    if (topInfo) {
      const tipX = mid + Math.min(24, (leaderSlab.x1 - leaderSlab.x0) * 0.2);
      drawSectionRebarLeader(
        ctx,
        tipX,
        leaderSlab.yTop,
        tipX + 42,
        slabTopY - 16,
        topInfo.stt,
        topInfo.dia,
        topInfo.spacing,
      );
    }
    // Thanh song song mặt cắt (nét ngang): chỉ khi khác Øa với thép ⊥ cùng lớp
    const sameSpec = (
      a: { dia: number; spacing: number } | null,
      b: { dia: number; spacing: number } | null,
    ) => !!a && !!b && a.dia === b.dia && a.spacing === b.spacing;
    if (longBot && !sameSpec(longBot, botInfo)) {
      drawSectionRebarLeader(
        ctx,
        mid,
        leaderSlab.yBot,
        mid - 10,
        slabTopY - 30,
        longBot.stt,
        longBot.dia,
        longBot.spacing,
      );
    }
    if (longTop && !sameSpec(longTop, topInfo)) {
      drawSectionRebarLeader(
        ctx,
        mid,
        leaderSlab.yTop,
        mid + 18,
        slabTopY - 30,
        longTop.stt,
        longTop.dia,
        longTop.spacing,
      );
    }
  }

  // Bong bóng trục đầu → cuối dưới mặt cắt
  const axisBubbleY = slabTopY + beamH + dropS + 22;
  for (const ax of axes) {
    const px = toAlong(ax.pos);
    line(ctx, px, slabTopY, px, axisBubbleY - AXIS_BUBBLE_R, 0.35, AXIS_LINE, AXIS_CENTERLINE_DASH);
    ctx.page.drawCircle({
      x: px,
      y: ty(axisBubbleY),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.65,
    });
    textInAxisBubble(ctx, ax.name, px, axisBubbleY, 6);
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
   * Dim ngang dưới vòng trục:
   * 1) dim tim trục
   * 2) dưới đó: dim bề rộng dầm (B) + lòng sàn
   */
  const DIM_GAP = 11;
  let yDim = axisBubbleY + AXIS_BUBBLE_R + 7;
  const axisMarksMm = axes.map((a) => a.pos);
  if (axisMarksMm.length >= 2) {
    dimHChain(ctx, axisMarksMm, yDim, toAlong, 5.5);
    yDim += DIM_GAP;
  }
  if (faceMarksMm.length >= 2) {
    dimHChain(ctx, faceMarksMm, yDim, toAlong, 5.2);
    yDim += DIM_GAP;
  }

  textSimple(
    ctx,
    `TL 1/${project.info.drawingScale || 100} · Lớp BV ${project.info.cover}`,
    x + maxW / 2,
    yDim + 2,
    6.2,
    false,
    "center",
    GRAY,
  );
  return yDim + 16;
}

/** A-A trên, B-B dưới — cùng tỉ lệ mặt bằng; nằm trên bảng thống kê. */
function drawSectionCutsAboveSchedule(
  ctx: Ctx,
  x: number,
  y: number,
  maxW: number,
  planS: number,
): number {
  const gap = 10;
  const bottomA = drawRebarSectionCut(ctx, x, y, maxW, "X", planS);
  const bottomB = drawRebarSectionCut(ctx, x, bottomA + gap, maxW, "Y", planS);
  return bottomB;
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

  /**
   * Một trang: Lớp dưới (trên) + Lớp trên (dưới) cùng cột trái;
   * phải: Mặt cắt A-A → B-B (xếp dọc, đúng tỉ lệ MB) → Thống kê → Tổng hợp.
   */
  const leftX = 36;
  const planW = 780;
  const gap = 10;
  const topY = 62;
  const bottomLimit = PAGE_H - 28;
  // Chia đôi chiều cao còn lại cho 2 mặt bằng (kèm dim + tiêu đề)
  const stackBudget = bottomLimit - topY - gap;
  // Chừa chỗ cột phải: 2 mặt cắt xếp dọc + bảng TK — thu planH nếu cần
  let planH = Math.max(200, Math.min(320, Math.floor(stackBudget / 2) - 95));
  const planS = planScale(project, planW, planH);

  const rightX = 860;
  const rightW = 780;
  // Ước lượng chiều cao 2 mặt cắt (B/Hs/H cùng tỉ lệ mặt bằng)
  const estSecH = (() => {
    const maxBeam = Math.max(
      parseBeamSize(project.info.beamSizeX || `${project.info.beamB || 200}x${project.info.beamH || 500}`).h,
      parseBeamSize(project.info.beamSizeY || `${project.info.beamB || 200}x${project.info.beamH || 500}`).h,
      project.info.beamH || 500,
    );
    const maxDrop = Math.max(
      0,
      ...(project.lowSlabs ?? []).map((ls) => ls.drop || 0),
    );
    const one =
      42 +
      maxBeam * planS +
      maxDrop * planS +
      22 +
      AXIS_BUBBLE_R +
      7 +
      11 + // dim trục
      11 + // dim B + sàn
      18;
    return one * 2 + 10;
  })();
  const scheduleReserve = 240;
  if (topY + estSecH + scheduleReserve > bottomLimit) {
    const overflow = topY + estSecH + scheduleReserve - bottomLimit;
    planH = Math.max(160, planH - Math.ceil(overflow / 2));
  }
  const planSFinal = planScale(project, planW, planH);

  const afterBottom = drawPlan(ctx, leftX, topY, planW, planH, zones, "bottom");
  drawPlan(ctx, leftX, afterBottom + gap, planW, planH, zones, "top");

  const afterSections = drawSectionCutsAboveSchedule(ctx, rightX, 62, rightW, planSFinal);
  const table = drawScheduleTable(ctx, rightX, afterSections + 10);
  drawSummaryTable(ctx, rightX, afterSections + 10 + table.h + 14);

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
