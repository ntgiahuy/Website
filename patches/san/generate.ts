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
  beamDrawRange,
  planBeamBleed,
  rectDiagonalHatchSegments,
  rectOpeningDiagonals,
  sortAxes,
  stripRebarBarSegments,
  SLAB_REBAR_HOOK_MM,
} from "../grid";
import type { PlanBeam, RebarZone, SlabProject } from "../types";

const PAGE_W = 1684;
const PAGE_H = 1191;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.45, 0.45, 0.45);
const REBAR_RED = rgb(0.86, 0.15, 0.15);
/** Vòng số hiệu trục PDF: bán kính + khoảng hở khỏi da dầm. */
const AXIS_BUBBLE_R = 7;
const AXIS_BUBBLE_GAP = 12;
const AXIS_BUBBLE_OFFSET = AXIS_BUBBLE_R + AXIS_BUBBLE_GAP;

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
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
    color: BLACK,
  });
  return width;
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
  textSimple(ctx, label, (lo + hi) / 2, y - 1, size, false, "center");
}

function dimV(ctx: Ctx, x: number, y1: number, y2: number, label: string, size = 6.5) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  line(ctx, x, lo, x, hi, 0.45);
  line(ctx, x - 3, lo, x + 3, lo, 0.45);
  line(ctx, x - 3, hi, x + 3, hi, 0.45);
  textSimple(ctx, label, x + 6, (lo + hi) / 2, size, false, "left");
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

  rect(ctx, x0, y0, pw, ph, 1.1);

  const toX = (mm: number) => x0 + mm * s;
  const toY = (mm: number) => y0 + (project.planHeight - mm) * s;

  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const bleed = planBeamBleed(project, axesX, axesY);
  const edgeLeft = toX(bleed.xMin);
  const edgeBottom = toY(bleed.yMin);

  for (const ax of axesX) {
    const x = toX(ax.pos);
    const by = edgeBottom + AXIS_BUBBLE_OFFSET;
    for (const span of axisInteriorSegmentsX(project, axesX, axesY, ax.pos)) {
      line(ctx, x, toY(span.hi), x, toY(span.lo), 0.35);
    }
    ctx.page.drawCircle({
      x,
      y: ty(by),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.8,
    });
    textSimple(ctx, ax.name, x, by + 2.5, 7, true, "center");
  }
  for (const ay of axesY) {
    const y = toY(ay.pos);
    const bx = edgeLeft - AXIS_BUBBLE_OFFSET;
    for (const span of axisInteriorSegmentsY(project, axesX, axesY, ay.pos)) {
      line(ctx, toX(span.lo), y, toX(span.hi), y, 0.35);
    }
    ctx.page.drawCircle({
      x: bx,
      y: ty(y),
      size: AXIS_BUBBLE_R,
      borderColor: BLACK,
      borderWidth: 0.8,
    });
    textSimple(ctx, ay.name, bx, y + 2.5, 7, true, "center");
  }

  for (const b of project.beams) {
    drawBeam(ctx, b, toX, toY, s);
  }

  for (const ls of project.lowSlabs ?? []) {
    const x0 = ls.x;
    const y0 = ls.y;
    const x1 = ls.x + ls.w;
    const y1 = ls.y + ls.h;
    rect(ctx, toX(x0), toY(y1), ls.w * s, ls.h * s, 0.6);
    for (const seg of rectDiagonalHatchSegments(x0, y0, x1, y1, 200)) {
      line(ctx, toX(seg.xA), toY(seg.yA), toX(seg.xB), toY(seg.yB), 0.45);
    }
    textSimple(ctx, ls.name || "ST", toX((x0 + x1) / 2), toY((y0 + y1) / 2), 6, false, "center");
  }

  for (const o of project.openings ?? []) {
    const x0 = o.x;
    const y0 = o.y;
    const x1 = o.x + o.w;
    const y1 = o.y + o.h;
    rect(ctx, toX(x0), toY(y1), o.w * s, o.h * s, 0.7);
    const [d1, d2] = rectOpeningDiagonals(x0, y0, x1, y1);
    line(ctx, toX(d1.xA), toY(d1.yA), toX(d1.xB), toY(d1.yB), 0.7, BLACK, [5, 3]);
    line(ctx, toX(d2.xA), toY(d2.yA), toX(d2.xB), toY(d2.yB), 0.7, BLACK, [5, 3]);
    textSimple(ctx, o.name || "Ô", toX((x0 + x1) / 2), toY((y0 + y1) / 2), 6, false, "center");
  }

  // Thép từ dầm biên → dầm biên (trừ lớp BV); cắt tại da dầm / ô thủng / sàn thấp
  const hook = SLAB_REBAR_HOOK_MM;
  for (const bar of stripRebarBarSegments(project, axesX, axesY)) {
    if (bar.dir === "X") {
      line(ctx, toX(bar.x0), toY(bar.y), toX(bar.x1), toY(bar.y), 0.7, REBAR_RED);
      line(ctx, toX(bar.x0), toY(bar.y), toX(bar.x0), toY(bar.y - hook), 0.7, REBAR_RED);
      line(ctx, toX(bar.x1), toY(bar.y), toX(bar.x1), toY(bar.y - hook), 0.7, REBAR_RED);
    } else {
      line(ctx, toX(bar.x), toY(bar.y0), toX(bar.x), toY(bar.y1), 0.7, REBAR_RED);
      line(ctx, toX(bar.x), toY(bar.y0), toX(bar.x + hook), toY(bar.y0), 0.7, REBAR_RED);
      line(ctx, toX(bar.x), toY(bar.y1), toX(bar.x + hook), toY(bar.y1), 0.7, REBAR_RED);
    }
  }

  for (const z of zones) {
    const zx1 = toX(Math.min(z.x1, z.x2));
    const zx2 = toX(Math.max(z.x1, z.x2));
    const zy1 = toY(Math.max(z.y1, z.y2));
    const zy2 = toY(Math.min(z.y1, z.y2));
    ctx.page.drawRectangle({
      x: zx1,
      y: ty(zy2),
      width: zx2 - zx1,
      height: zy2 - zy1,
      borderColor: GRAY,
      borderWidth: 0.45,
      borderDashArray: [3, 2],
    });
  }

  dimH(ctx, x0, x0 + pw, y0 + ph + AXIS_BUBBLE_OFFSET + AXIS_BUBBLE_R + 6, `${Math.round(project.planWidth)}`);
  dimV(ctx, x0 - AXIS_BUBBLE_OFFSET - AXIS_BUBBLE_R - 6, y0, y0 + ph, `${Math.round(project.planHeight)}`);
  textSimple(ctx, "MẶT BẰNG CỐT THÉP SÀN", ox + maxW / 2, oy - 16, 11, true, "center");
  textSimple(
    ctx,
    `TL: 1/${project.info.drawingScale}`,
    ox + maxW / 2,
    oy - 4,
    8,
    false,
    "center",
  );

  return y0 + ph + AXIS_BUBBLE_OFFSET + AXIS_BUBBLE_R + 20;
}

function drawBeam(
  ctx: Ctx,
  b: PlanBeam,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
  s: number,
) {
  const { project } = ctx;
  const { b: bw } = parseBeamSize(b.size);
  const b1 = Number.isFinite(b.offset) ? (b.offset as number) : bw / 2;
  const { lo, hi } = beamDrawRange(project, b);

  if (b.direction === "Y") {
    const xAxis = toX(b.axis);
    const yTop = toY(hi);
    const yBot = toY(lo);
    rect(ctx, xAxis - b1 * s, yTop, bw * s, yBot - yTop, 0.85);
    textVertical(ctx, `${b.name}(${b.size})`, xAxis - b1 * s + bw * s + 8, (yTop + yBot) / 2, 5.5, false);
  } else {
    const yTop = toY(b.axis + (bw - b1));
    rect(ctx, toX(lo), yTop, (hi - lo) * s, bw * s, 0.85);
    textSimple(ctx, `${b.name}(${b.size})`, toX((lo + hi) / 2), yTop - 8, 5.5, false, "center");
  }
}

function drawShops(ctx: Ctx, yStart: number, rows: ScheduleRow[]) {
  let y = yStart;
  textSimple(ctx, "SHOP NỔ THÉP SÀN", 40, y, 11, true);
  y += 18;
  const colW = 260;
  const rowH = 52;
  rows.forEach((row, i) => {
    const col = i % 3;
    const r = Math.floor(i / 3);
    const x = 36 + col * (colW + 16);
    const yy = y + r * (rowH + 10);
    rect(ctx, x, yy, colW, rowH, 0.7);
    textSimple(ctx, row.mark, x + 8, yy + 10, 8, true);
    textSimple(
      ctx,
      `Ø${row.dia}a${row.spacing} · ${row.layer} · ${row.direction}`,
      x + 70,
      yy + 10,
      7,
    );
    drawShape(ctx, row, x + 8, yy + 16, colW - 16, 28);
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
  dimV(ctx, x + W - 8, sy, sy + slabT, `${project.info.thickness}`);
  textSimple(ctx, `Lớp BV ${project.info.cover}`, x + W / 2, sy + slabT + beamH + 14, 7, false, "center");
  return sy + slabT + beamH + 28;
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
    "SỐ HIỆU",
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
    textSimple(ctx, row.mark, mid(1), ry + rowH / 2 + 2, 7, false, "center");
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
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const model = computeModel(project);
  const zones = effectiveZones(project);
  const ctx: Ctx = { page, font, fontBold, project, model };

  ctx.page.drawRectangle({
    x: 16,
    y: 16,
    width: PAGE_W - 32,
    height: PAGE_H - 32,
    borderColor: BLACK,
    borderWidth: 1.05,
  });

  const title = `${project.info.name} (SL=${project.info.quantity}; dày=${project.info.thickness}mm; ${Math.round(project.planWidth)}×${Math.round(project.planHeight)})`;
  textSimple(ctx, title, PAGE_W / 2, 36, 14, true, "center");
  textSimple(
    ctx,
    `Bê tông ${project.info.concreteGrade} · Thép ${project.info.steelGrade} · Lớp BV ${project.info.cover}mm · GiaHuy.Net Shop thép sàn`,
    PAGE_W / 2,
    52,
    8,
    false,
    "center",
  );

  const planBottom = drawPlan(ctx, 40, 72, 780, 420, zones);
  drawSection(ctx, 860, 72);

  let y = Math.max(planBottom, 520);
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
