/**
 * Unit check: chèn dầm giữa ô phải thêm trục và tách ô độc lập.
 * 1 dầm → ô đó thành 2; X + Y → 4 ô từ 1 ô gốc.
 */
import { createEmptyProject } from "../lib/sample";
import { applyAxesToProject, insertBeamInBay, sortAxes } from "../lib/grid";
import { uid } from "../lib/utils";

const type = { name: "D1", size: "220x500", offset: 110 };

function bayCount(p: { axesX?: { length: number }; axesY?: { length: number } }) {
  const nx = Math.max(0, (p.axesX?.length ?? 1) - 1);
  const ny = Math.max(0, (p.axesY?.length ?? 1) - 1);
  return { nx, ny, total: nx * ny };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Một ô duy nhất 6000×4500 để kiểm tra 1→2 và 1→4. */
function oneBayProject() {
  const base = createEmptyProject();
  return applyAxesToProject({
    ...base,
    axesX: [
      { id: uid("ax"), name: "1", pos: 0 },
      { id: uid("ax"), name: "2", pos: 6000 },
    ],
    axesY: [
      { id: uid("ay"), name: "A", pos: 0 },
      { id: uid("ay"), name: "C", pos: 4500 },
    ],
    beams: [],
  });
}

{
  const p = oneBayProject();
  const before = bayCount(p);
  console.log("1-bay before", before);
  assert(before.total === 1, "fixture must be 1 bay");

  const pX = insertBeamInBay(p, 0, 0, "X", type);
  const afterX = bayCount(pX);
  console.log("after X", afterX);
  assert(afterX.total === 2, `1 beam X → 2 ô, got ${afterX.total}`);
  assert(afterX.nx === 2 && afterX.ny === 1, "2×1 after X");
  assert(
    (pX.beams ?? []).some((b) => !b.free && b.direction === "Y" && !!b.axisId),
    "new vertical beam must be axis-tied (not free)",
  );
  const midX = sortAxes(pX.axesX)[1]?.pos;
  assert(
    !(pX.beams ?? []).some((b) => b.free && midX !== undefined && Math.abs(b.axis - midX) < 1),
    "no free beam at new X axis",
  );

  const pXY = insertBeamInBay(pX, 0, 0, "Y", type);
  const afterXY = bayCount(pXY);
  console.log("after X then Y", afterXY);
  assert(afterXY.total === 4, `X+Y → 4 ô, got ${afterXY.total}`);
  assert(afterXY.nx === 2 && afterXY.ny === 2, "2×2 after X+Y");
  assert(
    (pXY.beams ?? []).some((b) => !b.free && b.direction === "X" && !!b.axisId),
    "new horizontal beam must be axis-tied",
  );
}

{
  // UI tick cả X và Y trên cùng ô
  let both = oneBayProject();
  both = insertBeamInBay(both, 0, 0, "X", type);
  both = insertBeamInBay(both, 0, 0, "Y", type);
  const c = bayCount(both);
  console.log("both methods", c);
  assert(c.total === 4, `tick X+Y → 4 ô, got ${c.total}`);
}

{
  // Sample mặc định: tách 1 trong nhiều ô → +1 theo phương
  const p = createEmptyProject();
  const before = bayCount(p);
  const pX = insertBeamInBay(p, 0, 0, "X", type);
  const after = bayCount(pX);
  console.log("sample before/after X", before, after);
  assert(after.nx === before.nx + 1, "adds one X gap");
  assert(after.ny === before.ny, "Y gaps unchanged");
  assert(after.total === before.total + before.ny, "splits one column of bays");
}

console.log("OK — insert splits independent bays");
