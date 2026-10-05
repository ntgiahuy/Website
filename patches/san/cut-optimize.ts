/**
 * Cắt thép sàn tối ưu — thép cây thương mại dài nhất 11,7 m.
 * Nối chồng 30D / 35D / 40D.
 */
import type { LapMul, OptimizeCutMode, RebarLayer, RebarZone, SlabProject } from "./types";
import type { RebarBarSeg } from "./grid";
import { rebarBarStraightLenMm } from "./grid";

/** Chiều dài thép cây max (mm). */
export const STOCK_BAR_MM = 11700;

export function isOptimizeCutOn(project: SlabProject): boolean {
  return project.info.optimizeCut !== false;
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
  leftHook: number;
  rightHook: number;
  shape: "hooked" | "straight";
  /** Vị trí mối nối trên thanh gốc (mm từ đầu), nếu là điểm cắt. */
  spliceAtMm?: number;
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

/** Cắt theo 11,7 m — trả về chiều dài đoạn thẳng từng cây (mm). */
export function splitStraightByStock(
  straightMm: number,
  stockMm = STOCK_BAR_MM,
  lapMm = 0,
): number[] {
  const L = Math.max(0, Math.round(straightMm));
  if (L <= stockMm) return L > 0 ? [L] : [];
  const advance = Math.max(100, stockMm - Math.max(0, lapMulSafe(lapMm)));
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

function lapMulSafe(lapMm: number) {
  return Math.max(0, Math.round(lapMm) || 0);
}

/**
 * Điểm cắt (mm từ đầu thanh) — mỗi đoạn ≤ stock; ưu tiên nằm trong vùng cho phép.
 */
export function splicePositionsMm(
  straightMm: number,
  stockMm: number,
  allowed: Interval[],
): number[] {
  const L = Math.max(0, Math.round(straightMm));
  if (L <= stockMm) return [];
  const windows = mergeIntervals(allowed.filter((a) => a.hi > a.lo));
  const cuts: number[] = [];
  let start = 0;
  while (start + stockMm < L - 1) {
    const ideal = start + stockMm;
    const minAt = start + Math.min(stockMm * 0.45, stockMm - 200);
    const maxAt = Math.min(L - 200, start + stockMm);
    let best: number | null = null;
    let bestDist = Infinity;
    for (const w of windows) {
      const lo = Math.max(w.lo, minAt);
      const hi = Math.min(w.hi, maxAt);
      if (hi < lo) continue;
      const cand = Math.min(hi, Math.max(lo, ideal));
      const d = Math.abs(cand - ideal);
      if (d < bestDist) {
        bestDist = d;
        best = cand;
      }
    }
    const at = best ?? ideal;
    cuts.push(Math.round(at));
    start = Math.round(at);
  }
  return cuts;
}

/** Đổi danh sách điểm cắt → chiều dài đoạn thẳng. */
export function segmentsFromCuts(straightMm: number, cuts: number[]): number[] {
  const L = Math.max(0, Math.round(straightMm));
  const pts = [0, ...cuts.map((c) => Math.round(c)).filter((c) => c > 0 && c < L), L];
  pts.sort((a, b) => a - b);
  const uniq = pts.filter((v, i) => i === 0 || v > pts[i - 1]!);
  const out: number[] = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const d = uniq[i + 1]! - uniq[i]!;
    if (d > 1) out.push(d);
  }
  return out.length ? out : L > 0 ? [L] : [];
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
    /** Điểm cắt sẵn (avoidZones); bỏ trống → byStock. */
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
        leftHook: lh,
        rightHook: rh,
        shape: hooked ? "hooked" : "straight",
      },
    ];
  }

  const segs =
    opts.mode === "avoidZones" && opts.cutsMm?.length
      ? segmentsFromCuts(straight, opts.cutsMm)
      : splitStraightByStock(straight, stockMm, opts.lapMm);

  return segs.map((s, i) => {
    const left = i === 0 ? lh : 0;
    const right = i === segs.length - 1 ? rh : 0;
    const hooked = left > 0 || right > 0;
    return {
      barLength: Math.round(s + left + right),
      leftHook: left,
      rightHook: right,
      shape: (hooked ? "hooked" : "straight") as "hooked" | "straight",
    };
  });
}

/** Điểm nối trên mặt bằng (tọa độ mm) để vẽ minh họa. */
export function spliceWorldPoints(
  bar: RebarBarSeg,
  cutsMm: number[],
): Array<{ x: number; y: number }> {
  const L = rebarBarStraightLenMm(bar);
  const out: Array<{ x: number; y: number }> = [];
  for (const c of cutsMm) {
    if (c <= 0 || c >= L) continue;
    const t = c / L;
    if (bar.dir === "X") {
      const x0 = Math.min(bar.x0, bar.x1);
      const x1 = Math.max(bar.x0, bar.x1);
      out.push({ x: x0 + (x1 - x0) * t, y: bar.y });
    } else {
      const y0 = Math.min(bar.y0, bar.y1);
      const y1 = Math.max(bar.y0, bar.y1);
      out.push({ x: bar.x, y: y0 + (y1 - y0) * t });
    }
  }
  return out;
}

/** Tính điểm cắt cho 1 thanh theo chế độ hiện tại. */
export function planCutsForBar(
  project: SlabProject,
  bar: RebarBarSeg,
  layer: RebarLayer,
  dia: number,
  topZones: RebarZone[],
): number[] {
  if (!isOptimizeCutOn(project)) return [];
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
  return splicePositionsMm(straight, STOCK_BAR_MM, allowed);
}
