/**
 * Biến thiên L theo dầm lệch → PDF thống kê 1a/1b/1c; planMark = "1".
 */
import { createSampleS1 } from "../sample.ts";
import { computeModel, planDisplayMark } from "../calc.ts";
import { applyAxesToProject, patchBeamSegShift, sortAxes } from "../grid.ts";

let p = createSampleS1();
p = { ...p, layoutPreset: "simple2" };
const ax = sortAxes(p.axesX ?? []);
const left = (p.beams ?? []).find(
  (b) => b.direction === "Y" && Math.abs(b.axis - (ax[0]?.pos ?? 0)) < 1,
);
if (!left) throw new Error("missing left edge beam");
p = patchBeamSegShift(p, left.id, 0, { s0: -300, s1: 500 });
p = applyAxesToProject(p);

const m = computeModel(p);
const bottomX = m.schedule.filter((r) => r.layer === "bottom" && r.direction === "X");
console.log(
  "PDF TK (mark) / minh họa (planMark):",
  bottomX.map((r) => ({
    pdfStt: r.mark,
    plan: planDisplayMark(r),
    L: r.barLength,
    qty: r.qtyEach,
  })),
);

const marks = bottomX.map((r) => r.mark);
const plans = [...new Set(bottomX.map((r) => planDisplayMark(r)))];
const hasAbc = marks.some((mk) => /^\d+[a-c]$/i.test(mk));
const planOk = plans.length === 1 && /^\d+$/.test(plans[0]!);

if (!hasAbc || bottomX.length < 2) {
  console.error("FAIL: PDF TK cần 1a/1b/1c", marks);
  process.exit(1);
}
if (!planOk) {
  console.error("FAIL: minh họa cần planMark = số họ", plans);
  process.exit(1);
}
console.log("OK — PDF thống kê 1a/1b/1c, mặt bằng planMark=1");
