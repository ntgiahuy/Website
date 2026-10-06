/**
 * Cắt thép sàn tối ưu — thép cây thương mại dài nhất 11,7 m.
 * Nối chồng 30D / 35D / 40D.
 *
 * Cắt tránh vùng: ưu tiên đoạn 11,7 m; mối nối trong vùng cho phép;
 * số hiệu đoạn theo chiều dài lớn → bé: 1a, 1b, 1c…
 */
import type { LapMul, OptimizeCutMode, RebarLayer, RebarZone, SlabProject } from "./types";
import type { RebarBarSeg } from "./grid";
import { rebarBarStraightLenMm } from "./grid";

/** Chiều dài thép cây max (mm). */
export const STOCK_BAR_MM = 11700;

/** Phi tối thiểu (mm) để áp dụng cắt tối ưu. Nhỏ hơn → giữ nguyên chiều dài. */
export const OPTIMIZE_CUT_MIN_DIA = 10;

export function isOptimizeCutOn(project: SlabProject): boolean {
  return project.info.optimizeCut !== false;
}

/**
 * Cắt thép sàn tối ưu chỉ khi bật tùy chọn và đường kính ≥ Ø10.
 * Sắt nhỏ hơn phi 10: không cắt — để nguyên chiều dài.
 */
export function shouldOptimizeCut(project: SlabProject, dia: number): boolean {
  return isOptimizeCutOn(project) && (Number(dia) || 0) >= OPTIMIZE_CUT_MIN_DIA;
}

export function optimizeCutModeOf(project: SlabProject): OptimizeCutMode {
  return project.info.optimizeCutMode === "byStock" ? "byStock" : "avoidZones";
}

export function lapMulOf(project: SlabProject): LapMul {
  const v = project.info.lapMul;
  return v === 30 || v === 35 || v === 40 ? v : 40;
}

export function lapLengthMm(dia: number, mul: LapMul = 40): number {
  return Math.max(0, Math.round((Number(dia) || 0) * mul));
}

export type StockPiece = {
  /** Chiều dài phát triển (thẳng + móc đầu/cuối nếu có). */
  barLength: number;
  /** Chiều dài đoạn thẳng (mm). */
  straightMm: number;
  leftHook: number;
  rightHook: number;
  shape: "hooked" | "straight";
  /** Thứ tự dọc thanh gốc (0 = đầu). */
  geomIndex: number;
  /** Đầu–cuối trên thanh gốc (mm). */
  t0: number;
  t1: number;
};

type Interval = { lo: number; hi: number };

function mergeIntervals(list: Interval[]): Interval[] {
  if (!list.length) return [];
  const sorted = [...list].sort((a, b) => a.lo - b.lo);
  const out: Interval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.lo <= last.hi + 1) last.hi = Math.max(last.hi, cur.hi);
    else out.push({ ...cur });
  }
  return out;
}

function complementIntervals(lo: number, hi: number, blocked: Interval[]): Interval[] {
  const m = mergeIntervals(blocked.filter((b) => b.hi > lo && b.lo < hi));
  const out: Interval[] = [];
  let x = lo;
  for (const b of m) {
    const a = Math.max(lo, b.lo);
    const c = Math.min(hi, b.hi);
    if (a > x + 1) out.push({ lo: x, hi: a });
    x = Math.max(x, c);
  }
  if (hi > x + 1) out.push({ lo: x, hi });
  return out;
}

/** Giao thanh với vùng top (cùng phương) → khoảng trên trục thanh [0..L]. */
export function topZoneIntervalsOnBar(bar: RebarBarSeg, topZones: RebarZone[]): Interval[] {
  const L = rebarBarStraightLenMm(bar);
  if (L < 2) return [];
  const tops = topZones.filter((z) => z.layer === "top" && z.direction === bar.dir);
  const hit: Interval[] = [];
  for (const z of tops) {
    const zx0 = Math.min(z.x1, z.x2);
    const zx1 = Math.max(z.x1, z.x2);
    const zy0 = Math.min(z.y1, z.y2);
    const zy1 = Math.max(z.y1, z.y2);
    if (bar.dir === "X") {
      if (bar.y < zy0 - 1 || bar.y > zy1 + 1) continue;
      const a0 = Math.min(bar.x0, bar.x1);
      const lo = Math.max(0, Math.min(zx0, zx1) - a0);
      const hi = Math.min(L, Math.max(zx0, zx1) - a0);
      if (hi - lo > 20) hit.push({ lo, hi });
    } else {
      if (bar.x < zx0 - 1 || bar.x > zx1 + 1) continue;
      const a0 = Math.min(bar.y0, bar.y1);
      const lo = Math.max(0, Math.min(zy0, zy1) - a0);
      const hi = Math.min(L, Math.max(zy0, zy1) - a0);
      if (hi - lo > 20) hit.push({ lo, hi });
    }
  }
  return mergeIntervals(hit);
}

/**
 * Vùng được phép đặt mối nối trên thanh:
 * - Lớp dưới / cấu tạo: trong vùng thép mũ (top) economy2
 * - Lớp trên: ngoài vùng thép mũ
 */
export function allowedSpliceIntervals(
  bar: RebarBarSeg,
  layer: RebarLayer,
  topZones: RebarZone[],
): Interval[] {
  const L = rebarBarStraightLenMm(bar);
  const inside = topZoneIntervalsOnBar(bar, topZones);
  if (layer === "top") return complementIntervals(0, L, inside);
  return inside.length ? inside : [{ lo: 0, hi: L }];
}

/** Cắt theo 11,7 m — chiều dài đoạn thẳng từng cây (mm), thứ tự dọc thanh. */
export function splitStraightByStock(
  straightMm: number,
  stockMm = STOCK_BAR_MM,
  lapMm = 0,
): number[] {
  const L = Math.max(0, Math.round(straightMm));
  if (L <= stockMm) return L > 0 ? [L] : [];
  const advance = Math.max(100, stockMm - Math.max(0, Math.round(lapMm) || 0));
  const pieces: number[] = [];
  let covered = 0;
  while (covered < L - 0.5) {
    const remain = L - covered;
    if (remain <= stockMm + 0.5) {
      pieces.push(Math.round(remain));
      break;
    }
    pieces.push(stockMm);
    covered += advance;
  }
  return pieces;
}

/**
 * Cắt tránh vùng — ưu tiên đoạn đúng 11,7 m; mối nối trong vùng cho phép.
 * Trả về điểm cắt (mm từ đầu) theo thứ tự dọc thanh.
 */
export function splicePositionsPreferStock(
  straightMm: number,
  stockMm: number,
  allowed: Interval[],
): number[] {
  const L = Math.max(0, Math.round(straightMm));
  if (L <= stockMm) return [];
  const windows = mergeIntervals(allowed.filter((a) => a.hi > a.lo));
  const cuts: number[] = [];
  let start = 0;
  const minPiece = Math.min(stockMm * 0.5, 3000);

  while (L - start > stockMm + 1) {
    const ideal = start + stockMm;
    let cut: number | null = null;

    // 1) Ưu tiên đúng 11,7 m nếu điểm nối nằm trong vùng cho phép
    for (const w of windows) {
      if (ideal >= w.lo - 0.5 && ideal <= w.hi + 0.5 && ideal < L - 150) {
        cut = ideal;
        break;
      }
    }

    // 2) Đoạn dài nhất ≤ 11,7 m kết thúc trong vùng cho phép (lớn → gần 11,7 m)
    if (cut == null) {
      let bestLen = -1;
      for (const w of windows) {
        const lo = Math.max(w.lo, start + minPiece);
        const hi = Math.min(w.hi, start + stockMm, L - 150);
        if (hi < lo) continue;
        const cand = hi; // dài nhất có thể trong cửa sổ
        const len = cand - start;
        if (len > bestLen) {
          bestLen = len;
          cut = cand;
        }
      }
    }

    // 3) Fallback: cắt tại 11,7 m
    if (cut == null) cut = Math.min(ideal, L - 150);

    cuts.push(Math.round(cut));
    start = Math.round(cut);
  }
  return cuts;
}

/** @deprecated alias — dùng splicePositionsPreferStock */
export function splicePositionsMm(
  straightMm: number,
  stockMm: number,
  allowed: Interval[],
): number[] {
  return splicePositionsPreferStock(straightMm, stockMm, allowed);
}

/** Đổi danh sách điểm cắt → các đoạn {t0,t1,straight}. */
export function segmentsFromCuts(
  straightMm: number,
  cuts: number[],
): Array<{ t0: number; t1: number; straightMm: number }> {
  const L = Math.max(0, Math.round(straightMm));
  const pts = [0, ...cuts.map((c) => Math.round(c)).filter((c) => c > 0 && c < L), L];
  pts.sort((a, b) => a - b);
  const uniq = pts.filter((v, i) => i === 0 || v > pts[i - 1]!);
  const out: Array<{ t0: number; t1: number; straightMm: number }> = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const t0 = uniq[i]!;
    const t1 = uniq[i + 1]!;
    if (t1 - t0 > 1) out.push({ t0, t1, straightMm: t1 - t0 });
  }
  return out.length ? out : L > 0 ? [{ t0: 0, t1: L, straightMm: L }] : [];
}

export function stockPiecesForStraight(
  straightMm: number,
  leftHook: number,
  rightHook: number,
  opts: {
    on: boolean;
    mode: OptimizeCutMode;
    stockMm?: number;
    lapMm: number;
    cutsMm?: number[];
  },
): StockPiece[] {
  const straight = Math.max(0, Math.round(straightMm));
  const lh = Math.max(0, Math.round(leftHook) || 0);
  const rh = Math.max(0, Math.round(rightHook) || 0);
  const stockMm = opts.stockMm ?? STOCK_BAR_MM;

  if (!opts.on || straight <= stockMm) {
    const hooked = lh > 0 || rh > 0;
    return [
      {
        barLength: Math.round(straight + lh + rh),
        straightMm: straight,
        leftHook: lh,
        rightHook: rh,
        shape: hooked ? "hooked" : "straight",
        geomIndex: 0,
        t0: 0,
        t1: straight,
      },
    ];
  }

  let segs: Array<{ t0: number; t1: number; straightMm: number }>;
  const lap = Math.max(0, Math.round(opts.lapMm) || 0);
  if (opts.mode === "avoidZones" && opts.cutsMm && opts.cutsMm.length) {
    // Đoạn hình học theo điểm cắt; mỗi mối nối cộng thêm chiều dài nối (lap = n·D)
    segs = segmentsFromCuts(straight, opts.cutsMm).map((seg, i, arr) =>
      i < arr.length - 1 && lap > 0
        ? { ...seg, straightMm: seg.straightMm + lap }
        : seg,
    );
  } else {
    // byStock: splitStraightByStock đã trừ lap khi tiến (advance = stock − lap)
    // → tổng L đoạn = L thẳng + (số nối)·lap
    const lens = splitStraightByStock(straight, stockMm, lap);
    segs = [];
    let t = 0;
    for (const s of lens) {
      segs.push({ t0: t, t1: t + s, straightMm: s });
      t += s;
    }
  }

  return segs.map((seg, i) => {
    const left = i === 0 ? lh : 0;
    const right = i === segs.length - 1 ? rh : 0;
    const hooked = left > 0 || right > 0;
    return {
      barLength: Math.round(seg.straightMm + left + right),
      straightMm: seg.straightMm,
      leftHook: left,
      rightHook: right,
      shape: (hooked ? "hooked" : "straight") as "hooked" | "straight",
      geomIndex: i,
      t0: seg.t0,
      t1: seg.t1,
    };
  });
}

/**
 * Gán số hiệu 1a, 1b, 1c… theo chiều dài lớn → bé trong một họ thanh.
 * `familyNum` = 1, 2, 3…
 */
export function marksForPieces(familyNum: number, pieces: StockPiece[]): string[] {
  const ranked = pieces
    .map((p, i) => ({ i, len: p.barLength }))
    .sort((a, b) => b.len - a.len || a.i - b.i);
  const letter = new Array<string>(pieces.length);
  ranked.forEach((r, rank) => {
    letter[r.i] = String.fromCharCode(97 + rank); // a, b, c…
  });
  return pieces.map((_, i) => `${familyNum}${letter[i]}`);
}

/** Điểm nối trên mặt bằng (tọa độ mm). */
export function spliceWorldPoints(
  bar: RebarBarSeg,
  cutsMm: number[],
): Array<{ x: number; y: number }> {
  const L = rebarBarStraightLenMm(bar);
  const out: Array<{ x: number; y: number }> = [];
  for (const c of cutsMm) {
    if (c <= 0 || c >= L) continue;
    out.push(pointOnBar(bar, c / L));
  }
  return out;
}

function pointOnBar(bar: RebarBarSeg, t01: number): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, t01));
  if (bar.dir === "X") {
    const x0 = Math.min(bar.x0, bar.x1);
    const x1 = Math.max(bar.x0, bar.x1);
    return { x: x0 + (x1 - x0) * t, y: bar.y };
  }
  const y0 = Math.min(bar.y0, bar.y1);
  const y1 = Math.max(bar.y0, bar.y1);
  return { x: bar.x, y: y0 + (y1 - y0) * t };
}

/** Nhãn đoạn trên mặt bằng: midpoint + số hiệu. */
export type CutPlanLabel = {
  mark: string;
  x: number;
  y: number;
  dir: "X" | "Y";
};

export function segmentLabelsForBar(
  bar: RebarBarSeg,
  pieces: StockPiece[],
  marks: string[],
): CutPlanLabel[] {
  const L = rebarBarStraightLenMm(bar);
  if (L < 2) return [];
  return pieces.map((p, i) => {
    const midT = (p.t0 + p.t1) / 2 / L;
    const pt = pointOnBar(bar, midT);
    return { mark: marks[i] ?? String(i + 1), x: pt.x, y: pt.y, dir: bar.dir };
  });
}

/** Tính điểm cắt cho 1 thanh theo chế độ hiện tại. */
export function planCutsForBar(
  project: SlabProject,
  bar: RebarBarSeg,
  layer: RebarLayer,
  dia: number,
  topZones: RebarZone[],
): number[] {
  if (!shouldOptimizeCut(project, dia)) return [];
  const straight = rebarBarStraightLenMm(bar);
  if (straight <= STOCK_BAR_MM) return [];
  const lap = lapLengthMm(dia, lapMulOf(project));
  const mode = optimizeCutModeOf(project);
  if (mode === "byStock") {
    const segs = splitStraightByStock(straight, STOCK_BAR_MM, lap);
    const cuts: number[] = [];
    let acc = 0;
    for (let i = 0; i < segs.length - 1; i++) {
      acc += segs[i]!;
      cuts.push(acc);
    }
    return cuts;
  }
  const allowed = allowedSpliceIntervals(bar, layer, topZones);
  return splicePositionsPreferStock(straight, STOCK_BAR_MM, allowed);
}

/** Tách thanh thành pieces + marks (1a,1b…) — dùng chung preview/PDF/thống kê. */
export function cutPiecesWithMarks(
  project: SlabProject,
  bar: RebarBarSeg,
  layer: RebarLayer,
  dia: number,
  leftHook: number,
  rightHook: number,
  topZones: RebarZone[],
  familyNum: number,
): { pieces: StockPiece[]; marks: string[]; cuts: number[] } {
  const straight = rebarBarStraightLenMm(bar);
  const optOn = shouldOptimizeCut(project, dia);
  const cuts = planCutsForBar(project, bar, layer, dia, topZones);
  const pieces = stockPiecesForStraight(straight, leftHook, rightHook, {
    on: optOn,
    mode: optimizeCutModeOf(project),
    lapMm: lapLengthMm(dia, lapMulOf(project)),
    cutsMm: cuts,
  });
  // Chỉ đánh 1a, 1b… khi nối ≥ 2 đoạn; thanh đơn giữ số hiệu cũ (ở lịch/PDF).
  const marks = pieces.length > 1 ? marksForPieces(familyNum, pieces) : [];
  return { pieces, marks, cuts };
}

/** Số hiệu đoạn cắt tối ưu: 1a, 1b, 2a… */
export function isCutSegmentMark(mark: string): boolean {
  return /^\d+[a-z]+$/i.test(String(mark || "").trim());
}
