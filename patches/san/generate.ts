import { PDFDocument, PDFFont, PDFPage, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  STOCK_M,
  computeModel,
  effectiveZones,
  parseBeamSize,
  type ComputedSlabModel,
  type ScheduleRow,
} from "../calc";
import {
  axisInteriorSegmentsX,
  axisInteriorSegmentsY,
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
import type { PlanBeam, RebarZone, SlabProject } from "../types";
import { buildBeamFrameScene, projectSceneToSvg } from "../view3d";

const PAGE_W = 1684;
const PAGE_H = 1191;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.45, 0.45, 0.45);
const AXIS_DASH = rgb(0.35, 0.35, 0.35);
/** Chỉ thép dùng nét đỏ; dầm / khung / tim trục = đen. */
const REBAR_RED = rgb(0.86, 0.15, 0.15);
const REBAR_MARK_R = 5.2;
/** Vòng số hiệu trục PDF: bán kính + khoảng hở khỏi da dầm. */
const AXIS_BUBBLE_R = 5.5;
const AXIS_BUBBLE_GAP = 10;
const AXIS_BUBBLE_OFFSET = AXIS_BUBBLE_R + AXIS_BUBBLE_GAP;

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

/** Số thứ tự thép trong vòng tròn đỏ + Ødia a spacing. */
function drawRebarCallout(
  ctx: Ctx,
  cx: number,
  cy: number,
  stt: number,
  dia: number,
  spacing: number,
) {
  ctx.page.drawCircle({
    x: cx,
    y: ty(cy),
    size: REBAR_MARK_R,
    borderColor: REBAR_RED,
    borderWidth: 0.75,
  });
  textInkCentered(ctx, String(stt), cx, cy, 6.2, REBAR_RED, true);
  textSimple(ctx, `Ø${dia}a${spacing}`, cx + REBAR_MARK_R + 3, cy + 2, 6.5, true, "left", REBAR_RED);
}

/** STT thép theo thứ tự bảng thống kê (cùng số hiệu → cùng STT). */
function rebarSttByMark(schedule: ScheduleRow[]): Map<string, { stt: number; dia: number; spacing: number }> {
  const map = new Map<string, { stt: number; dia: number; spacing: number }>();
  let n = 1;
  for (const row of schedule) {
    if (map.has(row.mark)) continue;
    map.set(row.mark, { stt: n++, dia: row.dia, spacing: row.spacing });
  }
  return map;
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

  // Khung ngoài sàn (da dầm biên) — nét đậm như bản vẽ minh họa
  rect(ctx, edgeLeft, edgeTop, edgeRight - edgeLeft, edgeBottom - edgeTop, 1.35);

  // —— Tim trục: nét gạch đứt (trục giữa xuyên sàn; biên chỉ đường dẫn vòng) ——
  for (let i = 0; i < axesX.length; i++) {
    const ax = axesX[i];
    const x = toX(ax.pos);
    const by = edgeBottom + AXIS_BUBBLE_OFFSET;
    const isEdge = i === 0 || i === axesX.length - 1;
    if (!isEdge) {
      line(ctx, x, edgeTop, x, edgeBottom, 0.4, AXIS_DASH, [3.5, 2.2]);
    }
    for (const span of axisInteriorSegmentsX(project, axesX, axesY, ax.pos)) {
      line(ctx, x, toY(span.hi), x, toY(span.lo), 0.45, AXIS_DASH, [3.5, 2.2]);
    }
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
    const isEdge = i === 0 || i === axesY.length - 1;
    if (!isEdge) {
      line(ctx, edgeLeft, y, edgeRight, y, 0.4, AXIS_DASH, [3.5, 2.2]);
    }
    for (const span of axisInteriorSegmentsY(project, axesX, axesY, ay.pos)) {
      line(ctx, toX(span.lo), y, toX(span.hi), y, 0.45, AXIS_DASH, [3.5, 2.2]);
    }
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

  // —— Dầm: 2 nét đen theo da (đúng bề rộng B), không dùng đỏ ——
  for (const b of project.beams) {
    drawBeam(ctx, b, toX, toY);
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
  for (const bar of stripRebarBarSegments(project, axesX, axesY)) {
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

  // Số hiệu thép: vòng tròn STT + Ødia a spacing (đỏ)
  const sttMap = rebarSttByMark(ctx.model.schedule);
  for (const z of zones) {
    const info = sttMap.get(z.mark) ?? {
      stt: sttMap.size + 1,
      dia: z.dia,
      spacing: z.spacing,
    };
    const mx = (Math.min(z.x1, z.x2) + Math.max(z.x1, z.x2)) / 2;
    const my = (Math.min(z.y1, z.y2) + Math.max(z.y1, z.y2)) / 2;
    // Tách 4 số hiệu (MC/MT × X/Y) khỏi tâm ô để không chồng
    const dy =
      z.direction === "X" ? (z.layer === "top" ? -20 : 18) : z.layer === "top" ? -36 : 36;
    const dx =
      z.direction === "Y" ? (z.layer === "top" ? 28 : -34) : z.layer === "top" ? -22 : 22;
    drawRebarCallout(ctx, toX(mx) + dx, toY(my) + dy, info.stt, info.dia, info.spacing);
  }

  dimH(ctx, x0, x0 + pw, edgeBottom + AXIS_BUBBLE_OFFSET + AXIS_BUBBLE_R + 8, `${Math.round(project.planWidth)}`);
  dimV(ctx, edgeLeft - AXIS_BUBBLE_OFFSET - AXIS_BUBBLE_R - 8, y0, y0 + ph, `${Math.round(project.planHeight)}`);

  // Tiêu đề mặt bằng + tỉ lệ (giữa phía trên khung vẽ)
  textSimple(ctx, "MẶT BẰNG CỐT THÉP SÀN", ox + maxW / 2, oy - 18, 12, true, "center");
  textSimple(ctx, `TL: 1/${project.info.drawingScale}`, ox + maxW / 2, oy - 5, 8, false, "center");

  return Math.max(edgeBottom, y0 + ph) + AXIS_BUBBLE_OFFSET + AXIS_BUBBLE_R + 22;
}

/**
 * Vẽ dầm đúng bề rộng B: 2 nét đen theo da (có lệch/xéo) + nhãn Name(BxH).
 */
function drawBeam(
  ctx: Ctx,
  b: PlanBeam,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
) {
  const { project } = ctx;
  const segs = beamSegments(project, b);
  let labelX = 0;
  let labelY = 0;
  let labelN = 0;

  for (const seg of segs) {
    if (isBeamSegOmitted(b, seg.a0.id, seg.a1.id)) continue;
    const { lo0, hi0, lo1, hi1 } = beamSegSideFaces(b, seg.index);
    const lo = seg.lo;
    const hi = seg.hi;
    if (b.direction === "Y") {
      // Hai da dọc theo thân (2 nét = đúng bề rộng B)
      line(ctx, toX(lo0), toY(lo), toX(lo1), toY(hi), 0.9, BLACK);
      line(ctx, toX(hi0), toY(lo), toX(hi1), toY(hi), 0.9, BLACK);
      labelX += toX(Math.max(hi0, hi1)) + 6;
      labelY += (toY(lo) + toY(hi)) / 2;
    } else {
      line(ctx, toX(lo), toY(lo0), toX(hi), toY(lo1), 0.9, BLACK);
      line(ctx, toX(lo), toY(hi0), toX(hi), toY(hi1), 0.9, BLACK);
      labelX += (toX(lo) + toX(hi)) / 2;
      labelY += toY(Math.max(hi0, hi1)) - 6;
    }
    labelN += 1;
  }
  if (labelN === 0) return;

  const lx = labelX / labelN;
  const ly = labelY / labelN;
  const tag = `${b.name}(${b.size})`;
  if (b.direction === "Y") {
    textVertical(ctx, tag, lx, ly, 5.8, false);
  } else {
    textSimple(ctx, tag, lx, ly, 5.8, false, "center");
  }
}

function drawShops(ctx: Ctx, yStart: number, rows: ScheduleRow[]) {
  let y = yStart;
  textSimple(ctx, "SHOP NỔ THÉP SÀN", 40, y, 11, true);
  y += 18;
  const colW = 260;
  const rowH = 52;
  const sttMap = rebarSttByMark(rows);
  rows.forEach((row, i) => {
    const col = i % 3;
    const r = Math.floor(i / 3);
    const x = 36 + col * (colW + 16);
    const yy = y + r * (rowH + 10);
    rect(ctx, x, yy, colW, rowH, 0.7);
    const info = sttMap.get(row.mark) ?? { stt: i + 1, dia: row.dia, spacing: row.spacing };
    drawRebarCallout(ctx, x + 14, yy + 12, info.stt, info.dia, info.spacing);
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
  const rowsN = Math.ceil(rows.length / 3);
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
  const { project, model } = ctx;
  const rows = model.schedule;
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

  const sttMap = rebarSttByMark(rows);
  rows.forEach((row, i) => {
    const ry = ty0 + headerH + i * rowH;
    line(ctx, colX[1], ry + rowH, x + w, ry + rowH, 0.3);
    const info = sttMap.get(row.mark) ?? { stt: i + 1, dia: row.dia, spacing: row.spacing };
    textSimple(ctx, String(info.stt), mid(1), ry + rowH / 2 + 2, 7, true, "center");
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
  textVertical(ctx, project.info.name || "SÀN", mid(0), ty0 + headerH + (Math.max(rows.length, 1) * rowH) / 2, 9, true);
  return { w, h: h + 16 };
}

function drawSummaryTable(ctx: Ctx, x: number, y: number) {
  const { model } = ctx;
  const dias = model.byDia;
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
  textSimple(ctx, `Tổng TL: ${fmtNum(model.totalWeight)} kg`, x + 8, fy, 8, true);
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
