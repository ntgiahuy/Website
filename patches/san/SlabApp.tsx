"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  Box,
  Check,
  ChevronRight,
  Download,
  FilePlus,
  FolderOpen,
  Minus,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Panel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SlabPreview } from "@/components/slab/SlabPreview";
import {
  computeModel,
  effectiveZones,
  parseBeamSize,
} from "@/lib/calc";
import {
  addBeam,
  addOrUpdateBeamType,
  applyAxesToProject,
  applyAxisCount,
  applyBeamCounts,
  applyBeamDimsToAll,
  applyBeamTypeToBeams,
  axisSpan,
  baySlabExtent,
  beamSegments,
  bumpBeamTypeName,
  equalizeAxisSpans,
  ensureBeamsSplitBays,
  isBeamSegOmitted,
  patchBeam,
  patchBeamOnAxis,
  patchBeamSegShift,
  getBeamSegShift,
  patchBeamType,
  patchBeamTypeDim,
  rectNearlyEquals,
  removeAxis,
  removeBeam,
  removeBeamSegments,
  removeBeamType,
  renameAxis,
  setAxisSpan,
  setPlanSize,
  sortAxes,
  suggestNextBeamTypeName,
  syncBeamInfo,
  syncBeamsToAxes,
  insertBeamInBay,
  patchBeamSelectedSegShiftsContinuous,
} from "@/lib/grid";
import { withBasePath } from "@/lib/base-path";
import { downloadPdf, generateSlabPdf } from "@/lib/pdf/generate";
import {
  SHOP_SAN_FILENAME,
  parseProjectFile,
  serializeProjectFile,
} from "@/lib/project-file";
import { createEmptyProject, createSampleS1 } from "@/lib/sample";
import {
  DIAMETERS,
  SPACING_OPTIONS,
  TABS,
  type LayoutPreset,
  type LowSlabRebarMode,
  type PlanSelection,
  type RebarDir,
  type RebarLayer,
  type RebarZone,
  type SlabProject,
  type TabId,
} from "@/lib/types";
import { uid } from "@/lib/utils";

const STORE_KEY = "thep-san-project-v1";

function draftZone(mark = "MC 1-1"): RebarZone {
  return {
    id: uid("zone"),
    mark,
    layer: "bottom",
    direction: "X",
    dia: 10,
    spacing: 200,
    leftHook: 50,
    rightHook: 50,
    x1: 110,
    y1: 110,
    x2: 5890,
    y2: 4390,
    cover: 50,
    showSpacing: true,
    spacingSymbol: "a",
  };
}

export function SlabApp() {
  const [project, setProject] = useState<SlabProject>(() => createSampleS1());
  const [tab, setTab] = useState<TabId>("plan");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /** Phóng to / thu nhỏ bản vẽ preview (%). */
  const [previewZoomPct, setPreviewZoomPct] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState<RebarZone>(() => draftZone());
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [planSelection, setPlanSelection] = useState<PlanSelection | null>(null);
  /** Chọn nhiều dầm trên danh sách (Shift/Ctrl) để gán tên. */
  const [listSelectedIds, setListSelectedIds] = useState<string[]>([]);
  const [listAnchorId, setListAnchorId] = useState<string | null>(null);
  /** Chọn nhiều đoạn dầm trên bản vẽ (Shift/Ctrl) để gán tên. */
  const [beamMultiSelect, setBeamMultiSelect] = useState<
    Array<{ beamId: string; segIndex: number }>
  >([]);
  const [bulkBeamName, setBulkBeamName] = useState("");
  /** Chế độ chèn dầm vào giữa ô sàn (sau khi bấm Chèn dầm). */
  const [insertBeamMode, setInsertBeamMode] = useState(false);
  const [insertMethodX, setInsertMethodX] = useState(true);
  const [insertMethodY, setInsertMethodY] = useState(false);
  /** Khoảng từ mép ô đến tim dầm mới (mm); trống = giữa ô. */
  const [insertSplitMm, setInsertSplitMm] = useState("");
  const [axisDirTab, setAxisDirTab] = useState<"X" | "Y">("X");
  /** Chế độ thép khi đặt/sửa sàn thấp: nhấn | cắt */
  const [lowRebarMode, setLowRebarMode] = useState<LowSlabRebarMode>("press");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedBeamPanelRef = useRef<HTMLDivElement>(null);
  const selectedBayPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = ensureBeamsSplitBays(parseProjectFile(JSON.parse(raw)));
        setProject(parsed);
        if (parsed.zones[0]) {
          setZoneForm(parsed.zones[0]);
          setSelectedZoneId(parsed.zones[0].id);
        }
      }
    } catch {
      /* keep sample */
    }
  }, []);

  function persist(next: SlabProject) {
    // Dầm cắt qua ô phải có trục — tránh chọn ô sàn dính liền băng qua dầm
    const normalized = ensureBeamsSplitBays(next);
    setProject(normalized);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore quota */
    }
  }

  function patchInfo(partial: Partial<SlabProject["info"]>) {
    persist({ ...project, info: { ...project.info, ...partial } });
  }

  /** Cập nhật số liệu dầm (H/B/B1) và dựng lại dầm trên lưới. */
  function patchBeamDims(partial: Partial<Pick<SlabProject["info"], "beamH" | "beamB" | "beamB1">>) {
    const info = syncBeamInfo({ ...project.info, ...partial });
    persist(applyBeamDimsToAll({ ...project, info }, {
      beamB: info.beamB,
      beamH: info.beamH,
      beamB1: info.beamB1,
    }));
  }

  function patchBeamCount(dir: "X" | "Y", value: number) {
    const n = Math.max(0, Math.floor(value) || 0);
    persist(
      dir === "X"
        ? applyBeamCounts(project, n, project.info.beamCountY)
        : applyBeamCounts(project, project.info.beamCountX, n),
    );
  }

  /** Đổi số trục: chia đều vị trí và thêm dầm tại tim từng trục. */
  function patchAxisCount(dir: "X" | "Y", value: number) {
    persist(applyAxisCount(project, dir, value));
  }

  function selectedBaySpans() {
    if (planSelection?.kind !== "bay") return null;
    const xs = sortAxes(project.axesX);
    const ys = sortAxes(project.axesY);
    const { ix, iy } = planSelection;
    if (ix < 0 || ix >= xs.length - 1 || iy < 0 || iy >= ys.length - 1) return null;
    // Kích thước ô sàn đã chọn = lòng sàn giữa da dầm (baySlabExtent), không phải tim–tim trục
    const e = baySlabExtent(project, xs, ys, ix, iy);
    return {
      lx: e.x1 - e.x0,
      ly: e.y1 - e.y0,
      axisLx: xs[ix + 1].pos - xs[ix].pos,
      axisLy: ys[iy + 1].pos - ys[iy].pos,
      name: `${xs[ix].name}-${xs[ix + 1].name} / ${ys[iy].name}-${ys[iy + 1].name}`,
    };
  }

  function selectedBeamInfo() {
    if (planSelection?.kind !== "beam") return null;
    const beam = project.beams.find((b) => b.id === planSelection.beamId);
    if (!beam) return null;
    const segs = beamSegments(project, beam);
    const seg = segs[planSelection.segIndex];
    if (!seg) return null;
    const parsed = parseBeamSize(beam.size);
    const shift = getBeamSegShift(beam, seg.index);

    // Chọn nhiều đoạn cùng thanh → ô Dịch đầu/cuối = hai đầu dải đoạn (đường xéo liền)
    const sameBeamSegs = beamMultiSelect
      .filter((s) => s.beamId === beam.id)
      .map((s) => s.segIndex)
      .sort((a, c) => a - c);
    const multiOnBeam = sameBeamSegs.length > 1;
    let s0 = shift.s0;
    let s1 = shift.s1;
    if (multiOnBeam) {
      const i0 = sameBeamSegs[0];
      const i1 = sameBeamSegs[sameBeamSegs.length - 1];
      s0 = getBeamSegShift(beam, i0).s0;
      s1 = getBeamSegShift(beam, i1).s1;
    }

    return {
      id: beam.id,
      name: `${beam.name} · ${seg.a0.name}–${seg.a1.name} · ${beam.direction === "Y" ? "đứng" : "ngang"}${beam.free ? " · giữa ô" : ""}`,
      length: seg.span,
      axis: beam.axis,
      free: Boolean(beam.free),
      start: seg.lo,
      end: seg.hi,
      segIndex: seg.index,
      spanAxisIndex: seg.spanAxisIndex,
      B: parsed.b,
      H: parsed.h,
      B1: Number.isFinite(beam.offset) ? (beam.offset as number) : Math.round(parsed.b / 2),
      direction: beam.direction,
      s0,
      s1,
      /** Dịch song song khi hai đầu bằng nhau; nếu xéo lấy trung bình để hiển thị ô «Dịch đoạn». */
      shift: s0 === s1 ? s0 : Math.round((s0 + s1) / 2),
      multiOnBeam,
    };
  }

  function patchSelectedBaySpan(which: "lx" | "ly", value: number) {
    if (planSelection?.kind !== "bay") return;
    const spans = selectedBaySpans();
    if (!spans) return;
    // Ô nhập = kích thước lòng ô; đổi nhịp trục = giá trị mới + phần da dầm hai bên
    const clear = which === "lx" ? spans.lx : spans.ly;
    const axis = which === "lx" ? spans.axisLx : spans.axisLy;
    const inset = Math.max(0, axis - clear);
    const v = Math.max(500, Math.round(value) + inset);
    if (which === "lx") {
      persist(applyAxesToProject({ ...project, axesX: setAxisSpan(project.axesX, planSelection.ix + 1, v) }));
    } else {
      persist(applyAxesToProject({ ...project, axesY: setAxisSpan(project.axesY, planSelection.iy + 1, v) }));
    }
  }

  /** Đổi chiều dài đoạn dầm = đổi nhịp trục giữa hai đầu đoạn. */
  function patchSelectedBeamLength(value: number) {
    if (planSelection?.kind !== "beam") return;
    const info = selectedBeamInfo();
    if (!info) return;
    const v = Math.max(500, Math.round(value) || 500);
    if (info.direction === "Y") {
      persist(applyAxesToProject({ ...project, axesY: setAxisSpan(project.axesY, info.spanAxisIndex, v) }));
    } else {
      persist(applyAxesToProject({ ...project, axesX: setAxisSpan(project.axesX, info.spanAxisIndex, v) }));
    }
  }

  /** Đổi vị trí tim dầm (kèm trục) — luôn tách ô sàn theo dầm. */
  function patchSelectedFreeBeamAxis(value: number) {
    if (planSelection?.kind !== "beam") return;
    const beam = project.beams.find((b) => b.id === planSelection.beamId);
    if (!beam) return;
    const v = Math.max(0, Math.round(value) || 0);
    // Di chuyển tim + gắn trục (promote free) để ô sàn không dính liền qua dầm
    if (beam.free || !beam.axisId) {
      persist(ensureBeamsSplitBays(patchBeam(project, beam.id, { axis: v, free: undefined, axisId: undefined })));
      return;
    }
    const axesKey = beam.direction === "Y" ? "axesX" : "axesY";
    const axes = sortAxes(project[axesKey] ?? []).map((a) =>
      a.id === beam.axisId ? { ...a, pos: v } : a,
    );
    persist(
      applyAxesToProject({
        ...project,
        [axesKey]: axes,
        beams: project.beams.map((b) => (b.id === beam.id ? { ...b, axis: v } : b)),
      }),
    );
  }


  function patchSelectedBeamDims(dims: { beamB?: number; beamH?: number; beamB1?: number }) {
    if (planSelection?.kind !== "beam") return;
    const beam = project.beams.find((b) => b.id === planSelection.beamId);
    if (!beam) return;
    const parsed = parseBeamSize(beam.size);
    const B = dims.beamB ?? parsed.b;
    const H = dims.beamH ?? parsed.h;
    const patched = patchBeam(project, beam.id, {
      size: `${Math.round(B)}x${Math.round(H)}`,
      ...(dims.beamB1 !== undefined
        ? { offset: dims.beamB1 }
        : {}),
    });
    // Đổi B (không sửa B1 tay) → tính lại B1 biên/giữa theo lưới trục
    if (dims.beamB !== undefined && dims.beamB1 === undefined) {
      persist(syncBeamsToAxes(patched));
    } else {
      persist(patched);
    }
  }

  /** Dịch đoạn dầm: song song (shift) hoặc từng đầu (s0/s1 → dầm xéo).
   * Chọn nhiều đoạn → Dịch đầu/cuối = một đường xéo thẳng suốt dải đoạn đã chọn. */
  function patchSelectedBeamShift(patch: { shift?: number; s0?: number; s1?: number }) {
    if (planSelection?.kind !== "beam") return;
    const multi =
      beamMultiSelect.length > 0
        ? beamMultiSelect
        : [{ beamId: planSelection.beamId, segIndex: planSelection.segIndex }];
    const multiIds = [...new Set(multi.map((s) => s.beamId))];

    if (multi.length > 1) {
      // Nhiều đoạn: đầu/cuối → đường xéo liền; shift → song song cả dải
      persist(patchBeamSelectedSegShiftsContinuous(project, multi, patch));
      if (patch.shift !== undefined) {
        setStatus(
          multiIds.length > 1
            ? `Đã dịch song song ${multiIds.length} thanh / các đoạn đang chọn.`
            : "Đã dịch song song các đoạn đang chọn.",
        );
      } else {
        setStatus("Đã dịch đầu/cuối — các đoạn đã chọn thành một đường xéo thẳng liên tục.");
      }
      return;
    }

    persist(patchBeamSegShift(project, planSelection.beamId, planSelection.segIndex, patch));
  }

  /** Xóa đoạn dầm đang chọn (Shift/Ctrl chọn nhiều đoạn). */
  function deleteSelectedBeam() {
    const targets =
      beamMultiSelect.length > 0
        ? beamMultiSelect
        : planSelection?.kind === "beam"
          ? [{ beamId: planSelection.beamId, segIndex: planSelection.segIndex }]
          : [];
    if (targets.length === 0) return;
    const next = removeBeamSegments(project, targets);
    clearPlanSelection();
    persist(next);
    setStatus(
      targets.length === 1
        ? "Đã xóa 1 đoạn dầm — ô sàn hai bên đoạn liền nhau."
        : `Đã xóa ${targets.length} đoạn dầm — ô sàn hai bên mỗi đoạn liền nhau.`,
    );
  }


  /** Danh sách đoạn dầm theo thứ tự trái → phải, dưới → trên. */
  function listBeamsLeftToRight(): PlanSelection[] {
    type BeamSel = Extract<PlanSelection, { kind: "beam" }>;
    const list: BeamSel[] = [];
    const beams = [...(project.beams ?? [])].sort(
      (a, b) => a.axis - b.axis || a.name.localeCompare(b.name),
    );
    for (const b of beams) {
      const segs = beamSegments(project, b);
      for (const seg of segs) {
        if (isBeamSegOmitted(b, seg.a0.id, seg.a1.id)) continue;
        list.push({ kind: "beam", beamId: b.id, segIndex: seg.index });
      }
    }
    return list.sort((sa, sb) => {
      const ba = project.beams.find((b) => b.id === sa.beamId)!;
      const bb = project.beams.find((b) => b.id === sb.beamId)!;
      const sega = beamSegments(project, ba)[sa.segIndex];
      const segb = beamSegments(project, bb)[sb.segIndex];
      if (!sega || !segb) return 0;
      if (ba.direction === "Y" && bb.direction === "Y") {
        return ba.axis - bb.axis || sega.lo - segb.lo;
      }
      if (ba.direction === "X" && bb.direction === "X") {
        return sega.lo - segb.lo || ba.axis - bb.axis;
      }
      if (ba.direction !== bb.direction) return ba.direction === "Y" ? -1 : 1;
      return 0;
    });
  }

  /** Danh sách ô sàn theo thứ tự trái → phải, dưới → trên. */
  function listBaysLeftToRight(): PlanSelection[] {
    const xs = sortAxes(project.axesX);
    const ys = sortAxes(project.axesY);
    const list: PlanSelection[] = [];
    for (let iy = 0; iy < ys.length - 1; iy++) {
      for (let ix = 0; ix < xs.length - 1; ix++) {
        list.push({ kind: "bay", ix, iy });
      }
    }
    return list;
  }

  function sameSelection(a: PlanSelection, b: PlanSelection) {
    if (a.kind !== b.kind) return false;
    if (a.kind === "bay" && b.kind === "bay") return a.ix === b.ix && a.iy === b.iy;
    if (a.kind === "beam" && b.kind === "beam") {
      return a.beamId === b.beamId && a.segIndex === b.segIndex;
    }
    if (a.kind === "axis" && b.kind === "axis") {
      return a.dir === b.dir && a.axisId === b.axisId;
    }
    return false;
  }

  function selectedAxisInfo() {
    if (planSelection?.kind !== "axis") return null;
    const axes = sortAxes(planSelection.dir === "X" ? project.axesX : project.axesY);
    const index = axes.findIndex((a) => a.id === planSelection.axisId);
    if (index < 0) return null;
    return {
      dir: planSelection.dir,
      id: axes[index].id,
      name: axes[index].name,
      index,
      span: axisSpan(axes, index),
      spanLabel: index === 0 ? "Vị trí gốc" : "Khoảng cách từ trục trước",
    };
  }

  function patchSelectedAxisName(name: string) {
    if (planSelection?.kind !== "axis") return;
    if (planSelection.dir === "X") {
      updateAxesX(renameAxis(project.axesX, planSelection.axisId, name));
    } else {
      updateAxesY(renameAxis(project.axesY, planSelection.axisId, name));
    }
  }

  function patchSelectedAxisSpan(value: number) {
    if (planSelection?.kind !== "axis") return;
    const info = selectedAxisInfo();
    if (!info) return;
    const v = Math.max(0, Math.round(value) || 0);
    if (info.dir === "X") {
      if (info.index === 0) {
        const sorted = sortAxes(project.axesX);
        const delta = v - sorted[0].pos;
        updateAxesX(sorted.map((a) => ({ ...a, pos: a.pos + delta })));
      } else {
        updateAxesX(setAxisSpan(project.axesX, info.index, v));
      }
    } else if (info.index === 0) {
      const sorted = sortAxes(project.axesY);
      const delta = v - sorted[0].pos;
      updateAxesY(sorted.map((a) => ({ ...a, pos: a.pos + delta })));
    } else {
      updateAxesY(setAxisSpan(project.axesY, info.index, v));
    }
  }

  function clearPlanSelection() {
    setPlanSelection(null);
    setBeamMultiSelect([]);
    setListSelectedIds([]);
    setListAnchorId(null);
    setInsertBeamMode(false);
  }

  /** Loại dầm dùng khi chèn: ưu tiên dòng đã chọn trên danh sách. */
  function resolveInsertBeamType(): { name: string; size: string; offset: number } | null {
    const selectedTypes = (project.beamTypes ?? []).filter((t) => listSelectedIds.includes(t.id));
    const t = selectedTypes[0];
    if (t) {
      return {
        name: t.name,
        size: t.size || `${project.info.beamB}x${project.info.beamH}`,
        offset: Number.isFinite(t.offset)
          ? t.offset
          : Math.round((project.info.beamB || 220) / 2),
      };
    }
    const name = (bulkBeamName.trim() || project.info.beamNamePrefix || "").trim();
    if (!name) return null;
    return {
      name,
      size: `${project.info.beamB}x${project.info.beamH}`,
      offset: Number.isFinite(project.info.beamB1)
        ? project.info.beamB1
        : Math.round((project.info.beamB || 220) / 2),
    };
  }

  function toggleInsertBeamMode() {
    if (insertBeamMode) {
      setInsertBeamMode(false);
      setStatus("Đã tắt chế độ chèn dầm.");
      return;
    }
    if (!insertMethodX && !insertMethodY) {
      setStatus("Tick Phương X và/hoặc Phương Y trước khi chèn dầm.");
      return;
    }
    const type = resolveInsertBeamType();
    if (!type) {
      setStatus("Chọn loại dầm trên danh sách (hoặc nhập tên) rồi bấm Chèn dầm.");
      return;
    }
    // Đã chọn sẵn ô sàn → chèn ngay
    if (planSelection?.kind === "bay") {
      setInsertBeamMode(true);
      setTab("beams");
      insertBeamAtBay(planSelection.ix, planSelection.iy);
      return;
    }
    setInsertBeamMode(true);
    setTab("beams");
    setStatus(
      `Chèn dầm «${type.name}» (${[
        insertMethodX ? "Phương X" : null,
        insertMethodY ? "Phương Y" : null,
      ]
        .filter(Boolean)
        .join(" + ")}) — click vào Ô SÀN trên bản vẽ (không click vào thân dầm). Bấm lại Chèn dầm để hủy.`,
    );
  }

  function insertBeamAtBay(ix: number, iy: number) {
    const type = resolveInsertBeamType();
    if (!type) {
      setStatus("Chọn loại dầm trên danh sách trước khi chèn.");
      setInsertBeamMode(false);
      return;
    }
    if (!insertMethodX && !insertMethodY) {
      setStatus("Tick Phương X và/hoặc Phương Y.");
      return;
    }
    const raw = insertSplitMm.trim();
    const split =
      raw === "" ? undefined : Math.max(50, Math.round(Number(raw)) || 0);
    let next = project;
    if (insertMethodX) {
      next = insertBeamInBay(next, ix, iy, "X", type, split);
    }
    if (insertMethodY) {
      next = insertBeamInBay(next, ix, iy, "Y", type, split);
    }
    persist(next);
    const added = next.beams.filter((b) => !(project.beams ?? []).some((o) => o.id === b.id));
    if (added.length === 0) {
      setStatus(
        "Không chèn được — ô đã đầy dầm/trục hoặc quá hẹp. Thử ô khác, bỏ tick một phương, hoặc nhập khoảng cách trục khác «Giữa ô».",
      );
      return;
    }
    const last = added[added.length - 1];
    if (last) {
      const segs = beamSegments(next, last);
      const mid = segs[Math.floor(segs.length / 2)] ?? segs[0];
      if (mid) {
        setPlanSelection({ kind: "beam", beamId: last.id, segIndex: mid.index });
        setBeamMultiSelect([{ beamId: last.id, segIndex: mid.index }]);
      }
    }
    const nBayX = Math.max(0, (next.axesX?.length ?? 1) - 1);
    const nBayY = Math.max(0, (next.axesY?.length ?? 1) - 1);
    setStatus(
      `Đã chèn dầm «${type.name}» — thêm trục lưới, tách thành ${nBayX}×${nBayY} ô độc lập. Vẫn đang chèn: click ô khác hoặc bấm Chèn dầm để hủy.`,
    );
  }

  function handlePlanSelect(sel: PlanSelection | null, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
    if (!sel) {
      clearPlanSelection();
      return;
    }

    if (insertBeamMode && sel.kind === "bay") {
      insertBeamAtBay(sel.ix, sel.iy);
      return;
    }

    if (sel.kind === "beam") {
      setInsertBeamMode(false);
      setTab("beams");
      const ctrl = Boolean(e?.ctrlKey || e?.metaKey);
      const shift = Boolean(e?.shiftKey);
      const list = listBeamsLeftToRight().filter(
        (x): x is Extract<PlanSelection, { kind: "beam" }> => x.kind === "beam",
      );
      const sameSeg = (a: { beamId: string; segIndex: number }, b: { beamId: string; segIndex: number }) =>
        a.beamId === b.beamId && a.segIndex === b.segIndex;

      if (shift && (planSelection?.kind === "beam" || beamMultiSelect.length > 0)) {
        const anchor =
          planSelection?.kind === "beam"
            ? planSelection
            : beamMultiSelect[beamMultiSelect.length - 1];
        const aIdx = list.findIndex((x) => sameSeg(x, anchor));
        const bIdx = list.findIndex((x) => sameSeg(x, sel));
        if (aIdx >= 0 && bIdx >= 0) {
          const lo = Math.min(aIdx, bIdx);
          const hi = Math.max(aIdx, bIdx);
          setBeamMultiSelect(list.slice(lo, hi + 1).map((x) => ({ beamId: x.beamId, segIndex: x.segIndex })));
        } else {
          setBeamMultiSelect([sel]);
        }
        setPlanSelection(sel);
        // Giữ lựa chọn loại dầm trên danh sách (để Gán tên / Chèn dầm)
        return;
      }

      if (ctrl) {
        setBeamMultiSelect((prev) => {
          const exists = prev.some((x) => sameSeg(x, sel));
          if (exists) return prev.filter((x) => !sameSeg(x, sel));
          return [...prev, { beamId: sel.beamId, segIndex: sel.segIndex }];
        });
        setPlanSelection(sel);
        return;
      }

      // Click thường: chọn 1 đoạn — không cần Shift/Ctrl
      setPlanSelection(sel);
      setBeamMultiSelect([{ beamId: sel.beamId, segIndex: sel.segIndex }]);
      return;
    }

    setBeamMultiSelect([]);
    setPlanSelection(sel);
    if (sel.kind === "bay") setTab("draw");
    else if (sel.kind === "axis") setTab("axes");
  }

  /** Danh sách loại dầm đã lưu (D1, D2…). */
  function sortedBeamTypes() {
    return [...(project.beamTypes ?? [])];
  }

  function handleListTypeClick(typeId: string, e: ReactMouseEvent) {
    const types = sortedBeamTypes();
    const idx = types.findIndex((t) => t.id === typeId);
    if (idx < 0) return;
    const t = types[idx];

    if (e.shiftKey && listAnchorId) {
      e.preventDefault();
      const a = types.findIndex((x) => x.id === listAnchorId);
      if (a >= 0) {
        const lo = Math.min(a, idx);
        const hi = Math.max(a, idx);
        setListSelectedIds(types.slice(lo, hi + 1).map((x) => x.id));
        setBulkBeamName(types[lo].name);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setListSelectedIds((prev) => {
        if (prev.includes(typeId)) return prev.filter((id) => id !== typeId);
        return [...prev, typeId];
      });
      setListAnchorId(typeId);
      setBulkBeamName(t.name);
      return;
    }

    setListSelectedIds([typeId]);
    setListAnchorId(typeId);
    setBulkBeamName(t.name);
    // Đưa H/B/B1 của loại lên form để chỉnh
    const parsed = String(t.size || "").match(/^(\d+)\s*[x×]\s*(\d+)/i);
    if (parsed) {
      patchInfo({
        beamNamePrefix: t.name,
        beamB: Number(parsed[1]),
        beamH: Number(parsed[2]),
        beamB1: t.offset,
        beamSizeX: t.size,
        beamSizeY: t.size,
      });
    } else {
      patchInfo({ beamNamePrefix: t.name });
    }
  }

  /** Danh sách dầm mặt bằng (một dòng / thanh), sắp theo tim. */
  function sortedPlanBeams() {
    return [...(project.beams ?? [])].sort(
      (a, b) =>
        (a.direction === b.direction ? 0 : a.direction === "Y" ? -1 : 1) ||
        a.axis - b.axis ||
        a.name.localeCompare(b.name),
    );
  }

  function handleListBeamClick(beamId: string, e: ReactMouseEvent) {
    const beams = sortedPlanBeams();
    const idx = beams.findIndex((b) => b.id === beamId);
    if (idx < 0) return;

    if (e.shiftKey && listAnchorId) {
      e.preventDefault();
      const a = beams.findIndex((b) => b.id === listAnchorId);
      if (a >= 0) {
        const lo = Math.min(a, idx);
        const hi = Math.max(a, idx);
        const ids = beams.slice(lo, hi + 1).map((b) => b.id);
        setListSelectedIds(ids);
        setBeamMultiSelect([]);
        const first = beams[lo];
        const segs = beamSegments(project, first);
        setPlanSelection(
          segs[0] ? { kind: "beam", beamId: first.id, segIndex: segs[0].index } : null,
        );
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setListSelectedIds((prev) => {
        if (prev.includes(beamId)) return prev.filter((id) => id !== beamId);
        return [...prev, beamId];
      });
      setListAnchorId(beamId);
      setBeamMultiSelect([]);
      const beam = beams[idx];
      const segs = beamSegments(project, beam);
      if (segs[0]) setPlanSelection({ kind: "beam", beamId, segIndex: segs[0].index });
      return;
    }

    setListSelectedIds([beamId]);
    setListAnchorId(beamId);
    const beam = beams[idx];
    const segs = beamSegments(project, beam);
    handlePlanSelect(segs[0] ? { kind: "beam", beamId, segIndex: segs[0].index } : null);
  }

  function applyBulkBeamName() {
    const fromPlan = [...new Set(beamMultiSelect.map((s) => s.beamId))];
    // Ưu tiên: đoạn đã chọn trên bản vẽ; nếu chọn loại dầm trên list thì lấy tên loại
    const selectedTypes = (project.beamTypes ?? []).filter((t) => listSelectedIds.includes(t.id));
    const typeFromList = selectedTypes[0];
    const name = (bulkBeamName.trim() || typeFromList?.name || "").trim();
    if (!name) {
      setStatus("Nhập tên hoặc chọn loại trên danh sách, rồi click đoạn trên bản vẽ (không cần phím).");
      return;
    }
    const targetBeamIds =
      fromPlan.length > 0
        ? fromPlan
        : planSelection?.kind === "beam"
          ? [planSelection.beamId]
          : [];
    if (targetBeamIds.length === 0) {
      setStatus("Click đoạn dầm trên bản vẽ để gán tên — Shift/Ctrl chỉ khi chọn nhiều.");
      return;
    }
    const size = typeFromList?.size || `${project.info.beamB}x${project.info.beamH}`;
    const offset =
      typeFromList?.offset ??
      (Number.isFinite(project.info.beamB1) ? project.info.beamB1 : Math.round((project.info.beamB || 220) / 2));
    persist(applyBeamTypeToBeams(project, targetBeamIds, { name, size, offset }));
    setStatus(`Đã gán «${name}» cho ${targetBeamIds.length} dầm trên mặt bằng.`);
    setBulkBeamName("");
  }

  /** Nút Thêm: lưu loại dầm (D1, D2…) vào danh sách với H/B/B1 hiện tại. */
  function addBeamTypeFromForm() {
    const name = (project.info.beamNamePrefix || "").trim();
    if (!name) {
      setStatus("Nhập tên dầm (VD: D1) rồi bấm Thêm.");
      return;
    }
    const { beamB: B = 220, beamH: H = 500, beamB1: B1 = 110 } = project.info;
    const next = addOrUpdateBeamType(project, {
      name,
      size: `${Math.round(B)}x${Math.round(H)}`,
      offset: Math.round(B1),
    });
    const bumped = bumpBeamTypeName(name);
    persist({
      ...next,
      info: { ...next.info, beamNamePrefix: bumped },
    });
    setStatus(`Đã thêm loại dầm «${name}» vào danh sách.`);
  }

  useEffect(() => {
    if (tab !== "beams" || planSelection?.kind !== "beam") return;
    const id = window.setTimeout(() => {
      selectedBeamPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [tab, planSelection]);

  useEffect(() => {
    if (tab !== "draw" || planSelection?.kind !== "bay") return;
    const id = window.setTimeout(() => {
      selectedBayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [tab, planSelection]);

  /** Tiếp theo: dịch chọn dầm/ô sàn từ trái sang phải (lặp lại). */
  function selectNextPlanItem() {
    const preferBeams = !planSelection || planSelection.kind === "beam";
    const list = preferBeams ? listBeamsLeftToRight() : listBaysLeftToRight();
    if (!list.length) {
      setStatus("Chưa có đoạn dầm / ô sàn để chọn.");
      return;
    }
    if (!planSelection) {
      handlePlanSelect(list[0]);
      setStatus("Đã chọn phần tử đầu tiên (trái → phải).");
      return;
    }
    const idx = list.findIndex((item) => sameSelection(item, planSelection));
    const next = list[(idx < 0 ? 0 : idx + 1) % list.length];
    handlePlanSelect(next);
    setStatus(
      next.kind === "beam"
        ? `Đã chuyển sang đoạn dầm tiếp theo (${(idx < 0 ? 0 : idx + 1) % list.length + 1}/${list.length}).`
        : `Đã chuyển sang ô sàn tiếp theo (${(idx < 0 ? 0 : idx + 1) % list.length + 1}/${list.length}).`,
    );
  }

  /** Áp dụng thông số đang chọn cho các nhịp / dầm còn lại. */
  function applySelectionToAllSpans() {
    if (!planSelection) {
      setStatus("Hãy chọn một đoạn dầm hoặc ô sàn trước.");
      return;
    }
    if (planSelection.kind === "axis") {
      setStatus("Chọn ô sàn hoặc dầm để áp dụng cho các nhịp.");
      return;
    }
    if (planSelection.kind === "bay") {
      const spans = selectedBaySpans();
      if (!spans) return;
      const next = applyAxesToProject({
        ...project,
        axesX: equalizeAxisSpans(project.axesX, spans.axisLx),
        axesY: equalizeAxisSpans(project.axesY, spans.axisLy),
      });
      persist(next);
      setStatus(
        `Đã áp dụng Lx=${Math.round(spans.lx)}, Ly=${Math.round(spans.ly)} (lòng ô) cho mọi ô sàn.`,
      );
      return;
    }
    const info = selectedBeamInfo();
    if (!info || planSelection?.kind !== "beam") return;
    // Chỉ áp B/H/B1 — chiều dài đoạn luôn theo nhịp trục (đầu/cuối trên dầm ngược phương)
    const next = applyBeamDimsToAll(project, {
      beamB: info.B,
      beamH: info.H,
      beamB1: info.B1,
    });
    persist(next);
    setStatus(
      `Đã áp dụng B=${info.B}, H=${info.H}, B1=${info.B1} cho các dầm cùng phương (L theo nhịp trục).`,
    );
  }

  function setPreset(layoutPreset: LayoutPreset) {
    persist({ ...project, layoutPreset });
  }

  const model = computeModel(project);
  const zones = effectiveZones(project);

  async function exportPdf() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (typeof window !== "undefined" && window.GiaHuyMembership) {
        const ok = await window.GiaHuyMembership.requireActive({
          feature: "Xuất PDF",
          app: "san",
        });
        if (!ok) {
          setBusy(false);
          return;
        }
      }
      const fontRes = [
        fetch(withBasePath("/fonts/BeVietnamPro-Regular.ttf")),
        fetch(withBasePath("/fonts/BeVietnamPro-Bold.ttf")),
      ];
      const [regular, bold] = await Promise.all(fontRes.map((r) => r.then((x) => x.arrayBuffer())));
      const bytes = await generateSlabPdf(project, { regular, bold });
      downloadPdf(bytes, `KetCauSan_${project.info.name.replace(/\s+/g, "_")}.pdf`);
      setStatus("Đã xuất PDF A2.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xuất PDF thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectToDisk() {
    const text = serializeProjectFile(project);
    try {
      const w = window as unknown as {
        showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>;
      };
      const handle = await w.showSaveFilePicker?.({
        suggestedName: SHOP_SAN_FILENAME,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        setStatus("Đã Save As.");
        return;
      }
    } catch {
      /* fall through */
    }
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = SHOP_SAN_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Đã tải file JSON.");
  }

  async function openProjectFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const next = parseProjectFile(JSON.parse(text));
      persist(next);
      setSelectedZoneId(next.zones[0]?.id ?? null);
      if (next.zones[0]) setZoneForm(next.zones[0]);
      setStatus(`Đã mở ${file.name}`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file.");
    }
  }

  function addZone() {
    const z = { ...zoneForm, id: uid("zone") };
    persist({
      ...project,
      layoutPreset: "manual",
      info: { ...project.info, cover: z.cover },
      zones: [...project.zones, z],
    });
    setSelectedZoneId(z.id);
    setStatus(`Đã thêm ${z.mark}`);
  }

  function editZone() {
    if (!selectedZoneId) return;
    persist({
      ...project,
      layoutPreset: "manual",
      info: { ...project.info, cover: zoneForm.cover },
      zones: project.zones.map((z) => (z.id === selectedZoneId ? { ...zoneForm, id: selectedZoneId } : z)),
    });
    setStatus("Đã cập nhật vùng thép.");
  }

  function delZone() {
    if (!selectedZoneId) return;
    const next = project.zones.filter((z) => z.id !== selectedZoneId);
    persist({ ...project, layoutPreset: "manual", zones: next });
    setSelectedZoneId(next[0]?.id ?? null);
    if (next[0]) setZoneForm(next[0]);
    setStatus("Đã xóa vùng thép.");
  }

  function applySimple2() {
    setPreset("simple2");
    setStatus("Đã áp dụng bố trí 2 lớp đơn giản.");
  }

  function applyEconomy2() {
    setPreset("economy2");
    setStatus("Đã áp dụng bố trí 2 lớp tiết kiệm.");
  }

  function assignAllBeams() {
    persist(applyAxesToProject(project));
    setStatus("Đã gán dầm theo trục lưới.");
  }

  function updateAxesX(nextAxes: typeof project.axesX) {
    persist(applyAxesToProject({ ...project, axesX: nextAxes }));
  }

  function updateAxesY(nextAxes: typeof project.axesY) {
    persist(applyAxesToProject({ ...project, axesY: nextAxes }));
  }

  function selectedBayKind(): "normal" | "opening" | "low" {
    if (planSelection?.kind !== "bay") return "normal";
    const xs = sortAxes(project.axesX);
    const ys = sortAxes(project.axesY);
    const { x0, x1, y0, y1 } = baySlabExtent(project, xs, ys, planSelection.ix, planSelection.iy);
    if ((project.openings ?? []).some((o) => rectNearlyEquals(o, x0, y0, x1, y1))) return "opening";
    if ((project.lowSlabs ?? []).some((o) => rectNearlyEquals(o, x0, y0, x1, y1))) return "low";
    return "normal";
  }

  /** Đặt loại ô đang chọn: sàn thường / ô thủng / sàn thấp (sửa được nếu chèn nhầm). */
  function setSelectedBayKind(kind: "normal" | "opening" | "low", mode?: LowSlabRebarMode) {
    if (planSelection?.kind !== "bay") {
      setStatus("Chọn một ô sàn trên bản vẽ rồi chọn loại ô (thường / thủng / thấp).");
      setTab("draw");
      return;
    }
    const xs = sortAxes(project.axesX);
    const ys = sortAxes(project.axesY);
    const { x0, x1, y0, y1 } = baySlabExtent(project, xs, ys, planSelection.ix, planSelection.iy);
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const bayName = `${xs[planSelection.ix]?.name}-${ys[planSelection.iy]?.name}`;
    const openings = (project.openings ?? []).filter((o) => !rectNearlyEquals(o, x0, y0, x1, y1));
    const prevLow = (project.lowSlabs ?? []).find((o) => rectNearlyEquals(o, x0, y0, x1, y1));
    const lowSlabs = (project.lowSlabs ?? []).filter((o) => !rectNearlyEquals(o, x0, y0, x1, y1));

    if (kind === "normal") {
      persist({ ...project, openings, lowSlabs });
      setTab("draw");
      setStatus(`Đã đặt ô ${bayName} thành sàn thường.`);
      return;
    }
    if (kind === "opening") {
      persist({
        ...project,
        openings: [
          ...openings,
          { id: uid("op"), name: `Ô${openings.length + 1}`, x, y, w, h },
        ],
        lowSlabs,
      });
      setTab("draw");
      setStatus(`Đã đặt ô ${bayName} thành ô thủng.`);
      return;
    }
    const rebarMode = mode ?? lowRebarMode;
    const drop = prevLow?.drop ?? project.info.lowSlabDrop ?? 0;
    setLowRebarMode(rebarMode);
    persist({
      ...project,
      openings,
      lowSlabs: [
        ...lowSlabs,
        {
          id: prevLow?.id ?? uid("low"),
          name: prevLow?.name ?? `ST${lowSlabs.length + 1}`,
          x,
          y,
          w,
          h,
          drop,
          rebarMode,
        },
      ],
    });
    setTab("draw");
    const modeLabel = rebarMode === "cut" ? "cắt thép" : "nhấn thép";
    setStatus(`Đã đặt ô ${bayName} thành sàn thấp (${modeLabel}, hạ ${drop} mm).`);
  }

  function selectedLowRebarMode(): LowSlabRebarMode {
    if (planSelection?.kind !== "bay") return lowRebarMode;
    const xs = sortAxes(project.axesX);
    const ys = sortAxes(project.axesY);
    const { x0, x1, y0, y1 } = baySlabExtent(project, xs, ys, planSelection.ix, planSelection.iy);
    const ls = (project.lowSlabs ?? []).find((o) => rectNearlyEquals(o, x0, y0, x1, y1));
    return ls?.rebarMode === "cut" ? "cut" : ls ? "press" : lowRebarMode;
  }

  function setSelectedLowRebarMode(mode: LowSlabRebarMode) {
    setLowRebarMode(mode);
    if (selectedBayKind() === "low") {
      setSelectedBayKind("low", mode);
    }
  }

  function insertOpening() {
    setSelectedBayKind("opening");
  }

  function insertLowSlab() {
    setSelectedBayKind("low", lowRebarMode);
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-[#0d1117] px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <a href="https://giahuy.net" target="_blank" rel="noreferrer">
            <img
              src={withBasePath("/giahuy-logo.png")}
              alt="GiaHuy"
              width={171}
              height={47}
              className="h-10 w-auto sm:h-[44px]"
            />
          </a>
          <div className="min-w-0 border-l border-[#8b949e] pl-4">
            <div className="text-sm font-bold tracking-wide text-[#79b8ff] sm:text-base">
              Shop drawing thép sàn
            </div>
            <div className="text-[11px] leading-snug text-zinc-400">
              Bố trí thép sàn BTCT · thống kê · xuất PDF A2 (tham chiếu shop thép dầm).
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const next = createEmptyProject();
                persist(next);
                setZoneForm(next.zones[0] ?? draftZone());
                setSelectedZoneId(next.zones[0]?.id ?? null);
                setStatus("Đã tạo sàn mới.");
              }}
            >
              <FilePlus /> Mới
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                void openProjectFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen /> Open
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void saveProjectToDisk()}>
              <Save /> Save As
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                persist(project);
                setStatus("Đã lưu trên trình duyệt.");
              }}
            >
              <Save /> Lưu
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void exportPdf()}>
              <Download /> {busy ? "Đang xuất…" : "Xuất PDF"}
            </Button>
          </div>
          {(status || error) && (
            <div className="flex max-w-xl flex-col items-end gap-0.5 text-right">
              {status && <span className="text-xs text-emerald-400">{status}</span>}
              {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
          )}
        </div>
      </header>

      <nav className="flex items-center gap-0.5 overflow-x-auto border-b border-zinc-800 bg-zinc-900 px-2 py-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-t px-2.5 py-1.5 text-[12px] ${
              tab === t.id
                ? "bg-zinc-800 font-semibold text-sky-300"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        {/* Zoom bản vẽ — sau «Thông tin xuất» */}
        <div
          className="ml-1 flex shrink-0 items-center gap-1 border-l border-zinc-600 pl-2"
          title="Thu nhỏ / phóng to bản vẽ"
        >
          <button
            type="button"
            aria-label="Thu nhỏ"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            disabled={previewZoomPct <= 50}
            onClick={() => setPreviewZoomPct((z) => Math.max(50, z - 10))}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label="Đặt lại 100%"
            className="min-w-[3.25rem] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-center text-[12px] font-medium tabular-nums text-zinc-100 hover:border-zinc-500"
            onClick={() => setPreviewZoomPct(100)}
            title="Nhấp để đặt lại 100%"
          >
            {previewZoomPct}%
          </button>
          <button
            type="button"
            aria-label="Phóng to"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            disabled={previewZoomPct >= 300}
            onClick={() => setPreviewZoomPct((z) => Math.min(300, z + 10))}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </nav>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(140px,32vh)_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-auto border-b border-zinc-800 bg-zinc-900 p-3 lg:border-b-0 lg:border-r">
          {tab === "plan" && (
            <div className="flex flex-col gap-3">
              <Panel title="Thông tin sàn" className="min-w-0 w-full">
                <div className="flex flex-col gap-2.5">
                  <Field label="Tên sàn" wide>
                    <Input value={project.info.name} onChange={(e) => patchInfo({ name: e.target.value })} />
                  </Field>
                  <Field label="Chiều dày sàn" unit="mm">
                    <Input
                      type="number"
                      value={project.info.thickness}
                      onChange={(e) => patchInfo({ thickness: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Số lượng sàn">
                    <Input
                      type="number"
                      value={project.info.quantity}
                      onChange={(e) => patchInfo({ quantity: Number(e.target.value) || 1 })}
                    />
                  </Field>
                  <Field label="Lớp bảo vệ thép" unit="mm">
                    <Input
                      type="number"
                      value={project.info.cover}
                      onChange={(e) => {
                        const cover = Number(e.target.value) || 0;
                        persist({
                          ...project,
                          info: { ...project.info, cover },
                          zones: project.zones.map((z) => ({ ...z, cover })),
                        });
                        setZoneForm((f) => ({ ...f, cover }));
                      }}
                    />
                  </Field>
                  <Field label="Bề rộng sàn" unit="mm">
                    <Input
                      type="number"
                      value={project.planWidth}
                      onChange={(e) =>
                        persist(setPlanSize(project, Number(e.target.value) || 0, project.planHeight))
                      }
                    />
                  </Field>
                  <Field label="Chiều dài sàn" unit="mm">
                    <Input
                      type="number"
                      value={project.planHeight}
                      onChange={(e) =>
                        persist(setPlanSize(project, project.planWidth, Number(e.target.value) || 0))
                      }
                    />
                  </Field>
                  <Field label="Chênh cao độ sàn thấp" unit="mm">
                    <Input
                      type="number"
                      value={project.info.lowSlabDrop}
                      onChange={(e) => patchInfo({ lowSlabDrop: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Số lượng trục X">
                    <Input
                      type="number"
                      min={2}
                      value={project.axesX?.length ?? 2}
                      onChange={(e) => patchAxisCount("X", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Số lượng trục Y">
                    <Input
                      type="number"
                      min={2}
                      value={project.axesY?.length ?? 2}
                      onChange={(e) => patchAxisCount("Y", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Số lượng dầm X">
                    <Input
                      type="number"
                      min={0}
                      value={project.info.beamCountX ?? project.beams.filter((b) => b.direction === "Y").length}
                      onChange={(e) => patchBeamCount("X", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Số lượng dầm Y">
                    <Input
                      type="number"
                      min={0}
                      value={project.info.beamCountY ?? project.beams.filter((b) => b.direction === "X").length}
                      onChange={(e) => patchBeamCount("Y", Number(e.target.value))}
                    />
                  </Field>
                </div>

                <div className="mt-3 border-t border-zinc-700 pt-3">
                  <div className="mb-1.5 text-[11px] text-zinc-500">
                    Nhấp ô sàn trên bản vẽ để mở <b className="text-sky-300">Vẽ thép sàn</b>; nhấp đoạn dầm để mở{" "}
                    <b className="text-emerald-400">Số liệu dầm</b>.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      title="Chọn đoạn dầm / ô sàn tiếp theo (trái → phải)"
                      onClick={selectNextPlanItem}
                    >
                      <ChevronRight /> Tiếp theo
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      disabled={!planSelection}
                      onClick={applySelectionToAllSpans}
                    >
                      <Check /> Áp dụng cho các nhịp
                    </Button>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {tab === "axes" && (
            <div className="flex flex-col gap-3">
              <Panel title="Số liệu trục" className="min-w-0 w-full">
                <div className="mb-2 flex gap-0.5 border-b border-zinc-700">
                  {(
                    [
                      { id: "X" as const, label: "Trục phương X" },
                      { id: "Y" as const, label: "Trục phương Y" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAxisDirTab(t.id)}
                      className={`shrink-0 rounded-t px-2.5 py-1.5 text-[12px] ${
                        axisDirTab === t.id
                          ? "bg-zinc-800 font-semibold text-sky-300"
                          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {axisDirTab === "X" ? (
                  <div className="rounded border border-zinc-700 bg-zinc-950/60 p-2">
                    <div className="space-y-1.5">
                      {sortAxes(project.axesX ?? []).map((ax, i) => (
                        <div key={ax.id} className="flex min-w-0 flex-nowrap items-center gap-1.5">
                          <Input
                            className="w-12 max-w-12 shrink-0"
                            value={ax.name}
                            onChange={(e) => updateAxesX(renameAxis(project.axesX, ax.id, e.target.value))}
                          />
                          <Input
                            type="number"
                            className="min-w-0 w-auto flex-1"
                            title={i === 0 ? "Vị trí gốc (mm)" : "Khoảng cách từ trục trước (mm)"}
                            value={axisSpan(project.axesX, i)}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              if (i === 0) {
                                const sorted = sortAxes(project.axesX);
                                const delta = v - sorted[0].pos;
                                updateAxesX(sorted.map((a) => ({ ...a, pos: a.pos + delta })));
                              } else {
                                updateAxesX(setAxisSpan(project.axesX, i, v));
                              }
                            }}
                          />
                          <span className="shrink-0 text-[11px] text-zinc-500">mm</span>
                          <Button
                            variant="danger"
                            size="sm"
                            className="shrink-0 px-1.5"
                            disabled={(project.axesX?.length ?? 0) <= 2}
                            onClick={() => updateAxesX(removeAxis(project.axesX, ax.id))}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full"
                      onClick={() => {
                        patchAxisCount("X", (project.axesX?.length ?? 2) + 1);
                        setStatus("Đã thêm trục phương X (kèm dầm).");
                      }}
                    >
                      <Plus /> Thêm Trục phương X
                    </Button>
                  </div>
                ) : (
                  <div className="rounded border border-zinc-700 bg-zinc-950/60 p-2">
                    <div className="space-y-1.5">
                      {sortAxes(project.axesY ?? []).map((ay, i) => (
                        <div key={ay.id} className="flex min-w-0 flex-nowrap items-center gap-1.5">
                          <Input
                            className="w-12 max-w-12 shrink-0"
                            value={ay.name}
                            onChange={(e) => updateAxesY(renameAxis(project.axesY, ay.id, e.target.value))}
                          />
                          <Input
                            type="number"
                            className="min-w-0 w-auto flex-1"
                            title={i === 0 ? "Vị trí gốc (mm)" : "Khoảng cách từ trục trước (mm)"}
                            value={axisSpan(project.axesY, i)}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              if (i === 0) {
                                const sorted = sortAxes(project.axesY);
                                const delta = v - sorted[0].pos;
                                updateAxesY(sorted.map((a) => ({ ...a, pos: a.pos + delta })));
                              } else {
                                updateAxesY(setAxisSpan(project.axesY, i, v));
                              }
                            }}
                          />
                          <span className="shrink-0 text-[11px] text-zinc-500">mm</span>
                          <Button
                            variant="danger"
                            size="sm"
                            className="shrink-0 px-1.5"
                            disabled={(project.axesY?.length ?? 0) <= 2}
                            onClick={() => updateAxesY(removeAxis(project.axesY, ay.id))}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full"
                      onClick={() => {
                        patchAxisCount("Y", (project.axesY?.length ?? 2) + 1);
                        setStatus("Đã thêm trục phương Y (kèm dầm).");
                      }}
                    >
                      <Plus /> Thêm Trục phương Y
                    </Button>
                  </div>
                )}
              </Panel>
            </div>
          )}

          {tab === "beams" && (
            <div className="flex flex-col gap-3">
              <Panel title="Số liệu dầm" className="min-w-0 w-full">
                <div className="flex flex-col gap-2.5">
                  <Field label="Số lượng dầm theo phương X (dầm đứng)">
                    <Input
                      type="number"
                      min={0}
                      value={project.info.beamCountX ?? project.beams.filter((b) => b.direction === "Y").length}
                      onChange={(e) => patchBeamCount("X", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Số lượng dầm theo phương Y (dầm ngang)">
                    <Input
                      type="number"
                      min={0}
                      value={project.info.beamCountY ?? project.beams.filter((b) => b.direction === "X").length}
                      onChange={(e) => patchBeamCount("Y", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Chiều cao dầm H" unit="mm">
                    <Input
                      type="number"
                      value={project.info.beamH ?? 500}
                      onChange={(e) => patchBeamDims({ beamH: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Chiều rộng dầm B" unit="mm">
                    <Input
                      type="number"
                      value={project.info.beamB ?? 220}
                      onChange={(e) => patchBeamDims({ beamB: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Lệch trục B1" unit="mm">
                    <Input
                      type="number"
                      value={project.info.beamB1 ?? 110}
                      onChange={(e) => patchBeamDims({ beamB1: Number(e.target.value) || 0 })}
                    />
                  </Field>
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  B1 tự động: trục biên = da dầm ngoài (B1=0 hoặc B); trục giữa = tâm dầm (B1=B/2).
                  Đổi khoảng cách tim trục thì dầm theo tim. Kích thước:{" "}
                  {project.info.beamSizeX || `${project.info.beamB}x${project.info.beamH}`}.
                </p>
                <div className="mt-3 rounded border border-zinc-700 bg-zinc-950/60 p-2">
                  <div className="mb-2 text-xs font-semibold text-sky-300">Tạo dầm mới</div>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-end gap-1.5">
                      <Field label="Tên dầm">
                        <Input
                          className="w-24"
                          value={project.info.beamNamePrefix}
                          placeholder="VD: D1"
                          onChange={(e) => patchInfo({ beamNamePrefix: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addBeamTypeFromForm();
                            }
                          }}
                        />
                      </Field>
                      <Field label="H dầm" unit="mm">
                        <Input
                          type="number"
                          className="w-20"
                          value={project.info.beamH ?? 500}
                          onChange={(e) => patchBeamDims({ beamH: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Field label="B dầm" unit="mm">
                        <Input
                          type="number"
                          className="w-20"
                          value={project.info.beamB ?? 220}
                          onChange={(e) => patchBeamDims({ beamB: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Button size="sm" variant="success" onClick={addBeamTypeFromForm} title="Lưu vào danh sách">
                        <Plus /> Thêm
                      </Button>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Cùng tên D1 có thể thêm nhiều dòng với H/B khác nhau.
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded border border-zinc-700 bg-zinc-950/60 p-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-sky-300">Danh sách dầm</div>
                  </div>
                  <p className="mb-1.5 text-[10px] text-zinc-500">
                    Mỗi dòng: tên · H · B. Click đoạn để Gán tên (không cần phím); Shift/Ctrl chỉ khi chọn nhiều; hoặc Chèn dầm vào giữa ô.
                  </p>
                  <div className="mb-1.5 grid grid-cols-[minmax(2.5rem,1fr)_4rem_4rem_1.75rem] items-center gap-1.5 px-1.5 text-[10px] text-zinc-500">
                    <span className="truncate">Tên dầm</span>
                    <span className="text-center">H</span>
                    <span className="text-center">B</span>
                    <span />
                  </div>
                  <div className="max-h-64 space-y-1.5 overflow-auto">
                    {(project.beamTypes ?? []).length === 0 && (
                      <p className="text-[11px] text-zinc-500">
                        Chưa có loại dầm. Điền tên / H / B rồi bấm Thêm.
                      </p>
                    )}
                    {sortedBeamTypes().map((t) => {
                      const selected = listSelectedIds.includes(t.id);
                      const m = String(t.size || "").match(/^(\d+)\s*[x×]\s*(\d+)/i);
                      const bVal = m ? Number(m[1]) : 220;
                      const hVal = m ? Number(m[2]) : 500;
                      return (
                        <div
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleListTypeClick(t.id, e)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleListTypeClick(t.id, e as unknown as ReactMouseEvent);
                            }
                          }}
                          className={`grid cursor-pointer grid-cols-[minmax(2.5rem,1fr)_4rem_4rem_1.75rem] items-center gap-1.5 rounded border px-1.5 py-1 ${
                            selected ? "border-emerald-600 bg-emerald-950/40" : "border-zinc-700"
                          }`}
                        >
                          <Input
                            className="min-w-0 w-full whitespace-nowrap"
                            title="Tên dầm"
                            value={t.name}
                            onChange={(e) =>
                              persist(patchBeamType(project, t.id, { name: e.target.value }))
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                setListSelectedIds([t.id]);
                                setListAnchorId(t.id);
                                setBulkBeamName(t.name);
                              }
                            }}
                          />
                          <Input
                            type="number"
                            className="w-full"
                            title="H dầm (mm)"
                            value={hVal}
                            onChange={(e) =>
                              persist(patchBeamTypeDim(project, t.id, "H", Number(e.target.value) || 0))
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                setListSelectedIds([t.id]);
                                setListAnchorId(t.id);
                                setBulkBeamName(t.name);
                              }
                            }}
                          />
                          <Input
                            type="number"
                            className="w-full"
                            title="B dầm (mm)"
                            value={bVal}
                            onChange={(e) =>
                              persist(patchBeamTypeDim(project, t.id, "B", Number(e.target.value) || 0))
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                setListSelectedIds([t.id]);
                                setListAnchorId(t.id);
                                setBulkBeamName(t.name);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="danger"
                            className="h-8 w-7 shrink-0 px-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setListSelectedIds((prev) => prev.filter((id) => id !== t.id));
                              persist(removeBeamType(project, t.id));
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {(listSelectedIds.length > 0 || beamMultiSelect.length > 0 || insertBeamMode) && (
                    <div className="mt-2 flex flex-wrap items-end gap-2 rounded border border-amber-800/50 bg-amber-950/20 p-2">
                      <Field label="Gán tên dầm đã chọn" wide>
                        <Input
                          value={bulkBeamName}
                          placeholder="VD: D1"
                          onChange={(e) => setBulkBeamName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyBulkBeamName();
                          }}
                        />
                      </Field>
                      <Button size="sm" variant="success" onClick={applyBulkBeamName}>
                        <Check /> Gán tên
                      </Button>
                      <Button
                        size="sm"
                        variant={insertBeamMode ? "success" : "secondary"}
                        className={insertBeamMode ? "ring-1 ring-emerald-400" : undefined}
                        title="Chọn loại dầm + Phương X/Y, bấm Chèn dầm, rồi click ô sàn — thêm trục để tách ô độc lập"
                        onClick={toggleInsertBeamMode}
                      >
                        <Plus /> Chèn dầm
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setListSelectedIds([]);
                          setBeamMultiSelect([]);
                          setBulkBeamName("");
                          setInsertBeamMode(false);
                        }}
                      >
                        Bỏ chọn nhiều
                      </Button>
                      <div className="flex w-full flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                          <Checkbox
                            checked={insertMethodX}
                            onCheckedChange={(v) => setInsertMethodX(Boolean(v))}
                          />
                          Phương X
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                          <Checkbox
                            checked={insertMethodY}
                            onCheckedChange={(v) => setInsertMethodY(Boolean(v))}
                          />
                          Phương Y
                        </label>
                        <Field label="Khoảng cách trục (mm)">
                          <Input
                            type="number"
                            className="w-24"
                            placeholder="Giữa ô"
                            title="Khoảng từ mép ô đến tim dầm mới; để trống = giữa ô. Có thể sửa L sau khi chèn."
                            value={insertSplitMm}
                            onChange={(e) => setInsertSplitMm(e.target.value)}
                          />
                        </Field>
                      </div>
                      <p className="w-full text-[10px] text-zinc-500">
                        {(() => {
                          const typeCount = (project.beamTypes ?? []).filter((t) =>
                            listSelectedIds.includes(t.id),
                          ).length;
                          if (typeCount > 0) return `${typeCount} loại trên danh sách`;
                          if (beamMultiSelect.length > 0) return `${beamMultiSelect.length} đoạn trên bản vẽ`;
                          return "Chèn dầm";
                        })()}
                        {" · "}
                        {insertBeamMode
                          ? "Đang chèn — click Ô SÀN (không click thân dầm). Mỗi dầm thêm 1 trục → tách ô độc lập (X+Y → 4 ô)."
                          : "Click đoạn rồi Gán tên (không cần phím). Shift/Ctrl chỉ khi chọn nhiều — hoặc Chèn dầm giữa ô để tách ô."}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    title="Chọn đoạn dầm tiếp theo từ trái sang phải"
                    onClick={selectNextPlanItem}
                  >
                    <ChevronRight /> Tiếp theo
                  </Button>
                  <Button variant="success" size="sm" onClick={applySelectionToAllSpans}>
                    <Check /> Áp dụng cho các nhịp
                  </Button>
                  <Button variant="secondary" size="sm" className="text-amber-300" onClick={assignAllBeams}>
                    Gán toàn bộ dầm theo trục…
                  </Button>
                </div>

                {planSelection?.kind === "beam" && selectedBeamInfo() && (
                  <div
                    ref={selectedBeamPanelRef}
                    className="mt-3 rounded border border-sky-700/60 bg-sky-950/30 p-2"
                  >
                    <div className="mb-2 flex flex-col gap-1.5">
                      <div className="text-xs font-semibold text-sky-300">Dầm đang chọn</div>
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="danger"
                          title="Xóa đoạn đang chọn (Shift/Ctrl chọn nhiều đoạn)"
                          onClick={deleteSelectedBeam}
                        >
                          <Trash2 /> Xóa đoạn
                        </Button>
                        <Button size="sm" variant="secondary" onClick={clearPlanSelection}>
                          Bỏ chọn
                        </Button>
                      </div>
                    </div>
                    <p className="mb-2 text-[11px] text-zinc-400">{selectedBeamInfo()!.name}</p>
                    <div className="flex flex-col gap-2.5">
                      <Field label="Khoảng cách L" unit="mm">
                        <Input
                          type="number"
                          value={Math.round(selectedBeamInfo()!.length)}
                          onChange={(e) => patchSelectedBeamLength(Number(e.target.value))}
                        />
                      </Field>
                      {selectedBeamInfo()!.free && (
                        <Field
                          label={
                            selectedBeamInfo()!.direction === "Y"
                              ? "Tim X (giữa ô)"
                              : "Tim Y (giữa ô)"
                          }
                          unit="mm"
                        >
                          <Input
                            type="number"
                            value={Math.round(selectedBeamInfo()!.axis)}
                            onChange={(e) => patchSelectedFreeBeamAxis(Number(e.target.value))}
                          />
                        </Field>
                      )}
                      <Field label="Chiều cao H" unit="mm">
                        <Input
                          type="number"
                          value={selectedBeamInfo()!.H}
                          onChange={(e) => patchSelectedBeamDims({ beamH: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Field label="Chiều rộng B" unit="mm">
                        <Input
                          type="number"
                          value={selectedBeamInfo()!.B}
                          onChange={(e) => patchSelectedBeamDims({ beamB: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Field label="Lệch trục B1" unit="mm">
                        <Input
                          type="number"
                          value={selectedBeamInfo()!.B1}
                          onChange={(e) => patchSelectedBeamDims({ beamB1: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <Field
                        label={
                          selectedBeamInfo()!.direction === "Y"
                            ? "Dịch đoạn (+ phải)"
                            : "Dịch đoạn (+ trên)"
                        }
                        unit="mm"
                      >
                        <Input
                          type="number"
                          value={selectedBeamInfo()!.shift}
                          onChange={(e) =>
                            patchSelectedBeamShift({ shift: Number(e.target.value) || 0 })
                          }
                        />
                      </Field>
                      <Field
                        label={
                          selectedBeamInfo()!.direction === "Y"
                            ? "Dịch đầu (+ phải)"
                            : "Dịch đầu (+ trên)"
                        }
                        unit="mm"
                      >
                        <Input
                          type="number"
                          value={selectedBeamInfo()!.s0}
                          onChange={(e) =>
                            patchSelectedBeamShift({ s0: Number(e.target.value) || 0 })
                          }
                        />
                      </Field>
                      <Field
                        label={
                          selectedBeamInfo()!.direction === "Y"
                            ? "Dịch cuối (+ phải)"
                            : "Dịch cuối (+ trên)"
                        }
                        unit="mm"
                      >
                        <Input
                          type="number"
                          value={selectedBeamInfo()!.s1}
                          onChange={(e) =>
                            patchSelectedBeamShift({ s1: Number(e.target.value) || 0 })
                          }
                        />
                      </Field>
                      <p className="text-[10px] text-zinc-500">
                        {beamMultiSelect.length > 1
                          ? "Đang chọn nhiều — Dịch đầu/cuối tạo một đường xéo thẳng suốt các đoạn đã chọn (không lệch từng đoạn)."
                          : selectedBeamInfo()!.direction === "Y"
                            ? "Dịch đoạn: song song trái/phải. Đầu ≠ cuối → dầm xéo. Chọn nhiều đoạn → một đường xéo liền."
                            : "Dịch đoạn: song song lên/xuống. Đầu ≠ cuối → dầm xéo. Chọn nhiều đoạn → một đường xéo liền."}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        title="Chọn đoạn dầm tiếp theo (trái → phải)"
                        onClick={selectNextPlanItem}
                      >
                        <ChevronRight /> Tiếp theo
                      </Button>
                      <Button variant="success" size="sm" onClick={applySelectionToAllSpans}>
                        <Check /> Áp dụng cho các nhịp
                      </Button>
                    </div>
                  </div>
                )}

              </Panel>
            </div>
          )}


          {tab === "draw" && (
            <div className="flex flex-col gap-3">
              <Panel title="Vẽ thép sàn" className="min-w-0 flex-1">
                <div className="flex flex-col gap-2.5">
                  <Field label="Tỷ lệ bản vẽ">
                    <Input
                      type="number"
                      value={project.info.drawingScale}
                      onChange={(e) => patchInfo({ drawingScale: Number(e.target.value) || 100 })}
                    />
                  </Field>
                  <Field label="Đường kính thép">
                    <select
                      className="h-7 w-full min-w-0 rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
                      value={zoneForm.dia}
                      onChange={(e) => setZoneForm({ ...zoneForm, dia: Number(e.target.value) })}
                    >
                      {DIAMETERS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Khoảng rải thép (a)">
                    <select
                      className="h-7 w-full min-w-0 rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
                      value={zoneForm.spacing}
                      onChange={(e) => setZoneForm({ ...zoneForm, spacing: Number(e.target.value) })}
                    >
                      {SPACING_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Móc thép trái" unit="mm">
                    <Input
                      type="number"
                      value={zoneForm.leftHook}
                      onChange={(e) => {
                        const leftHook = Number(e.target.value) || 0;
                        const nextForm = { ...zoneForm, leftHook };
                        setZoneForm(nextForm);
                        if (selectedZoneId) {
                          persist({
                            ...project,
                            layoutPreset: "manual",
                            zones: project.zones.map((z) =>
                              z.id === selectedZoneId ? { ...nextForm, id: selectedZoneId } : z,
                            ),
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field label="Móc thép phải" unit="mm">
                    <Input
                      type="number"
                      value={zoneForm.rightHook}
                      onChange={(e) => {
                        const rightHook = Number(e.target.value) || 0;
                        const nextForm = { ...zoneForm, rightHook };
                        setZoneForm(nextForm);
                        if (selectedZoneId) {
                          persist({
                            ...project,
                            layoutPreset: "manual",
                            zones: project.zones.map((z) =>
                              z.id === selectedZoneId ? { ...nextForm, id: selectedZoneId } : z,
                            ),
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field label="Ký hiệu khoảng rải">
                    <Input
                      className="w-20"
                      value={zoneForm.spacingSymbol}
                      onChange={(e) => setZoneForm({ ...zoneForm, spacingSymbol: e.target.value })}
                    />
                  </Field>
                  <Field label="Dày lớp bảo vệ" unit="mm">
                    <Input
                      type="number"
                      value={zoneForm.cover}
                      onChange={(e) => {
                        const cover = Number(e.target.value) || 0;
                        const nextForm = { ...zoneForm, cover };
                        setZoneForm(nextForm);
                        // Đồng bộ cover → info + zone để khoảng hở tới da dầm đúng ngay trên bản vẽ
                        persist({
                          ...project,
                          info: { ...project.info, cover },
                          layoutPreset: "manual",
                          zones: selectedZoneId
                            ? project.zones.map((z) =>
                                z.id === selectedZoneId ? { ...nextForm, id: selectedZoneId } : z,
                              )
                            : project.zones.map((z) => ({ ...z, cover })),
                        });
                      }}
                    />
                  </Field>
                  <Field label="Lớp thép">
                    <select
                      className="h-7 w-full min-w-0 rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
                      value={zoneForm.layer}
                      onChange={(e) => setZoneForm({ ...zoneForm, layer: e.target.value as RebarLayer })}
                    >
                      <option value="bottom">Lớp dưới</option>
                      <option value="top">Lớp trên</option>
                      <option value="structural">Cấu tạo</option>
                    </select>
                  </Field>
                  <Field label="Phương">
                    <select
                      className="h-7 w-full min-w-0 rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
                      value={zoneForm.direction}
                      onChange={(e) => setZoneForm({ ...zoneForm, direction: e.target.value as RebarDir })}
                    >
                      <option value="X">X</option>
                      <option value="Y">Y</option>
                    </select>
                  </Field>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                  <Checkbox
                    checked={project.info.showDistRange !== false}
                    onCheckedChange={(v) => {
                      const on = Boolean(v);
                      setZoneForm({ ...zoneForm, showSpacing: on });
                      persist({
                        ...project,
                        info: { ...project.info, showDistRange: on },
                        zones: project.zones.map((z) => ({ ...z, showSpacing: on })),
                      });
                    }}
                  />
                  Hiện / Ẩn khoảng rải thép sàn
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={addZone}>
                    <Plus /> Thêm vùng
                  </Button>
                  <Button size="sm" variant="secondary" onClick={editZone} disabled={!selectedZoneId}>
                    Sửa
                  </Button>
                  <Button size="sm" variant="danger" onClick={delZone} disabled={!selectedZoneId}>
                    <Trash2 /> Xóa
                  </Button>
                </div>
              </Panel>
              <Panel title="Danh sách vùng thép" className="min-w-0 w-full">
                <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                  {(project.layoutPreset === "manual" ? project.zones : zones).map((z) => (
                    <li key={z.id}>
                      <button
                        type="button"
                        className={`w-full rounded px-2 py-1 text-left ${
                          selectedZoneId === z.id ? "bg-sky-900/50 text-sky-200" : "hover:bg-zinc-800"
                        }`}
                        onClick={() => {
                          setSelectedZoneId(z.id);
                          setZoneForm(z);
                          setPreset("manual");
                        }}
                      >
                        {z.mark} · Ø{z.dia}a{z.spacing} · {z.direction}
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>

              {planSelection?.kind === "bay" && selectedBaySpans() && (
                <div
                  ref={selectedBayPanelRef}
                  className="rounded border border-sky-700/60 bg-sky-950/30 p-2"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-sky-300">Ô sàn đang chọn trên bản vẽ</div>
                    <Button size="sm" variant="secondary" onClick={() => setPlanSelection(null)}>
                      Bỏ chọn
                    </Button>
                  </div>
                  <p className="mb-2 text-[11px] text-zinc-400">{selectedBaySpans()!.name}</p>
                  <div className="mb-2">
                    <div className="mb-1 text-[11px] text-zinc-500">Loại ô sàn</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ["normal", "Sàn thường"],
                          ["opening", "Ô thủng"],
                          ["low", "Sàn thấp"],
                        ] as const
                      ).map(([kind, label]) => {
                        const active = selectedBayKind() === kind;
                        return (
                          <Button
                            key={kind}
                            size="sm"
                            variant={active ? "default" : "secondary"}
                            className={active ? "bg-sky-700 text-white hover:bg-sky-600" : undefined}
                            onClick={() => setSelectedBayKind(kind)}
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                    {selectedBayKind() === "low" && (
                      <div className="mt-2 rounded border border-zinc-700/80 bg-zinc-950/50 p-2">
                        <div className="mb-1.5 text-[11px] text-zinc-500">Thép sàn thấp</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ["press", "Nhấn thép"],
                              ["cut", "Cắt thép"],
                            ] as const
                          ).map(([mode, label]) => {
                            const active = selectedLowRebarMode() === mode;
                            return (
                              <Button
                                key={mode}
                                size="sm"
                                variant={active ? "default" : "secondary"}
                                className={active ? "bg-amber-700 text-white hover:bg-amber-600" : undefined}
                                onClick={() => setSelectedLowRebarMode(mode)}
                                title={
                                  mode === "press"
                                    ? "Thép chạy như sàn thường; nhấn xuống tại dầm quanh ô bằng chênh cao độ"
                                    : "Tách với sàn thường; vẫn bố trí thép trong ô thấp và lên thân dầm quanh ô"
                                }
                              >
                                {label}
                              </Button>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
                          {selectedLowRebarMode() === "press"
                            ? "Nhấn: thép đi thẳng xuyên ô; tại dầm quanh ô nhấn xuống bằng chênh cao độ sàn thấp."
                            : "Cắt: tách với sàn thường; thép trong ô thấp + lên thân dầm, lệch ½ khoảng rải để không chồng sắt."}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <Field label="Khoảng cách Lx" unit="mm">
                      <Input
                        type="number"
                        value={Math.round(selectedBaySpans()!.lx)}
                        onChange={(e) => patchSelectedBaySpan("lx", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Khoảng cách Ly" unit="mm">
                      <Input
                        type="number"
                        value={Math.round(selectedBaySpans()!.ly)}
                        onChange={(e) => patchSelectedBaySpan("ly", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      title="Chọn ô sàn tiếp theo (trái → phải)"
                      onClick={selectNextPlanItem}
                    >
                      <ChevronRight /> Tiếp theo
                    </Button>
                    <Button variant="success" size="sm" onClick={applySelectionToAllSpans}>
                      <Check /> Áp dụng cho các nhịp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "economy2" && (
            <Panel title="Bố trí thép 2 lớp tiết kiệm" className="max-w-3xl">
              <div className="flex flex-col gap-2.5">
                <Field label="Thép lớp dưới">
                  <Input
                    value={project.economy2.bottomSpec}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, bottomSpec: e.target.value } })}
                  />
                </Field>
                <Field label="Móc thép dưới" unit="mm">
                  <Input
                    type="number"
                    value={project.economy2.bottomHook}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, bottomHook: Number(e.target.value) || 0 } })}
                  />
                </Field>
                <Field label="Thép lớp trên">
                  <Input
                    value={project.economy2.topSpec}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, topSpec: e.target.value } })}
                  />
                </Field>
                <Field label="Móc thép trên" unit="mm">
                  <Input
                    type="number"
                    value={project.economy2.topHook}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, topHook: Number(e.target.value) || 0 } })}
                  />
                </Field>
                <Field label="Thép cấu tạo">
                  <Input
                    value={project.economy2.structuralSpec}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, structuralSpec: e.target.value } })}
                  />
                </Field>
                <Field label="Móc thép cấu tạo" unit="mm">
                  <Input
                    type="number"
                    value={project.economy2.structuralHook}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, structuralHook: Number(e.target.value) || 0 } })}
                  />
                </Field>
                <Field label="KC đến tim 1/">
                  <Input
                    type="number"
                    value={project.economy2.distToCenter}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, distToCenter: Number(e.target.value) || 1 } })}
                  />
                </Field>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                <Checkbox
                  checked={project.economy2.hatAlongShort}
                  onCheckedChange={(v) => persist({ ...project, economy2: { ...project.economy2, hatAlongShort: Boolean(v) } })}
                />
                Thép mũ theo phương cạnh ngắn
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="text-amber-300" variant="secondary" onClick={applyEconomy2}>
                  Áp dụng bố trí tiết kiệm
                </Button>
              </div>
            </Panel>
          )}

          {tab === "simple2" && (
            <Panel title="Bố trí thép 2 lớp đơn giản" className="min-w-0 flex-1">
              <div className="flex flex-col gap-2.5">
                <Field label="Thép lớp dưới">
                  <Input
                    value={project.simple2.bottomSpec}
                    onChange={(e) => persist({ ...project, simple2: { ...project.simple2, bottomSpec: e.target.value } })}
                  />
                </Field>
                <Field label="Móc thép dưới" unit="mm">
                  <Input
                    type="number"
                    value={project.simple2.bottomHook}
                    onChange={(e) => persist({ ...project, simple2: { ...project.simple2, bottomHook: Number(e.target.value) || 0 } })}
                  />
                </Field>
                <Field label="Thép lớp trên">
                  <Input
                    value={project.simple2.topSpec}
                    onChange={(e) => persist({ ...project, simple2: { ...project.simple2, topSpec: e.target.value } })}
                  />
                </Field>
                <Field label="Móc thép trên" unit="mm">
                  <Input
                    type="number"
                    value={project.simple2.topHook}
                    onChange={(e) => persist({ ...project, simple2: { ...project.simple2, topHook: Number(e.target.value) || 0 } })}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="text-amber-300" onClick={applySimple2}>
                  Thép lớp dưới / trên
                </Button>
              </div>
            </Panel>
          )}

          {tab === "section" && (
            <Panel title="Mặt cắt sàn" className="max-w-xl">
              <div className="flex flex-col gap-2.5">
                <Field label="Tên mặt cắt">
                  <Input
                    value={project.sections[0]?.name ?? "1"}
                    onChange={(e) => {
                      const sections = [...project.sections];
                      if (!sections[0]) return;
                      sections[0] = { ...sections[0], name: e.target.value };
                      persist({ ...project, sections });
                    }}
                  />
                </Field>
                <Field label="Vị trí cắt" unit="mm">
                  <Input
                    type="number"
                    value={project.sections[0]?.at ?? 0}
                    onChange={(e) => {
                      const sections = [...project.sections];
                      if (!sections[0]) return;
                      sections[0] = { ...sections[0], at: Number(e.target.value) || 0 };
                      persist({ ...project, sections });
                    }}
                  />
                </Field>
              </div>
              <Button size="sm" className="mt-3" onClick={() => void exportPdf()}>
                Xuất PDF có mặt cắt
              </Button>
            </Panel>
          )}

          {tab === "model3d" && (
            <Panel title="Mô hình 3D" className="max-w-xl">
              <p className="mb-2 text-[11px] text-zinc-400">
                Phối cảnh isometric: cạnh nhìn thấy nét liền; cạnh che khuất (dưới sàn) nét đứt mảnh; đoạn line xuyên chỗ dầm chồng nhau được xoá.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="text-emerald-400"
                  variant="secondary"
                  onClick={() => {
                    persist({ ...project, show3d: true });
                    setStatus("Đã tạo phối cảnh dầm sàn 3D.");
                  }}
                >
                  <Box /> Tạo mô hình 3D
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-red-400"
                  onClick={() => {
                    persist({ ...project, show3d: false });
                    setStatus("Đã xóa mô hình 3D.");
                  }}
                >
                  Del
                </Button>
              </div>
            </Panel>
          )}

          {tab === "info" && (
            <Panel title="Thông tin xuất PDF" className="max-w-xl">
              <div className="flex flex-col gap-2.5">
                <Field label="Cấp bê tông">
                  <Input value={project.info.concreteGrade} onChange={(e) => patchInfo({ concreteGrade: e.target.value })} />
                </Field>
                <Field label="Loại thép">
                  <Input value={project.info.steelGrade} onChange={(e) => patchInfo({ steelGrade: e.target.value })} />
                </Field>
              </div>
              <div className="mt-3 rounded border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-300">
                <div>Số hiệu: <b className="text-sky-300">{model.schedule.length}</b></div>
                <div>Tổng TL: <b className="text-amber-300">{model.totalWeight.toFixed(1)} kg</b></div>
                <div className="mt-1 text-zinc-500">Trọng lượng = d²/162.2 · thanh kho 11.7 m (Ø&gt;10)</div>
              </div>
            </Panel>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          {tab === "axes" && (
            <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
              {!planSelection && (
                <div className="mb-1 text-[11px] text-zinc-500">
                  Nhấp số hiệu trục trên bản vẽ để chỉnh tại danh sách trục bên trái.
                </div>
              )}
              {planSelection?.kind === "axis" && selectedAxisInfo() && (
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-amber-300">
                    Trục {selectedAxisInfo()!.dir}: {selectedAxisInfo()!.spanLabel}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setPlanSelection(null)}>
                    Bỏ chọn
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            <SlabPreview
              project={project}
              show3d={project.show3d && tab === "model3d"}
              zoomPct={previewZoomPct}
              interactive={tab === "plan" || tab === "axes" || tab === "beams" || tab === "draw"}
              insertBeamMode={insertBeamMode}
              selection={planSelection}
              beamMultiSelect={beamMultiSelect}
              onSelect={handlePlanSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    GiaHuyMembership?: {
      requireActive: (opts: { feature: string; app?: string }) => Promise<boolean>;
    };
  }
}
