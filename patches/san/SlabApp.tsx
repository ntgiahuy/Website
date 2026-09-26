"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Check,
  ChevronRight,
  Download,
  FilePlus,
  FolderOpen,
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
  applyAxesToProject,
  applyAxisCount,
  applyBeamCounts,
  applyBeamDimsToAll,
  axisSpan,
  baySlabExtent,
  beamSegments,
  equalizeAxisSpans,
  patchBeam,
  patchBeamOnAxis,
  rectNearlyEquals,
  removeAxis,
  removeBeam,
  renameAxis,
  setAxisSpan,
  setPlanSize,
  sortAxes,
  syncBeamInfo,
  syncBeamsToAxes,
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
  const [error, setError] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState<RebarZone>(() => draftZone());
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [planSelection, setPlanSelection] = useState<PlanSelection | null>(null);
  const [axisDirTab, setAxisDirTab] = useState<"X" | "Y">("X");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedBeamPanelRef = useRef<HTMLDivElement>(null);
  const selectedBayPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = parseProjectFile(JSON.parse(raw));
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
    setProject(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
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
    return {
      lx: xs[ix + 1].pos - xs[ix].pos,
      ly: ys[iy + 1].pos - ys[iy].pos,
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
    return {
      id: beam.id,
      name: `${beam.name} · ${seg.a0.name}–${seg.a1.name} · ${beam.direction === "Y" ? "đứng" : "ngang"}`,
      length: seg.span,
      axis: beam.axis,
      start: seg.lo,
      end: seg.hi,
      segIndex: seg.index,
      spanAxisIndex: seg.spanAxisIndex,
      B: parsed.b,
      H: parsed.h,
      B1: Number.isFinite(beam.offset) ? (beam.offset as number) : Math.round(parsed.b / 2),
      direction: beam.direction,
    };
  }

  function patchSelectedBaySpan(which: "lx" | "ly", value: number) {
    if (planSelection?.kind !== "bay") return;
    const v = Math.max(500, Math.round(value) || 500);
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

  function handlePlanSelect(sel: PlanSelection | null) {
    setPlanSelection(sel);
    if (!sel) return;
    if (sel.kind === "beam") {
      setTab("beams");
    } else if (sel.kind === "bay") setTab("draw");
    else if (sel.kind === "axis") setTab("axes");
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
        axesX: equalizeAxisSpans(project.axesX, spans.lx),
        axesY: equalizeAxisSpans(project.axesY, spans.ly),
      });
      persist(next);
      setStatus(`Đã áp dụng Lx=${Math.round(spans.lx)}, Ly=${Math.round(spans.ly)} cho mọi ô sàn.`);
      return;
    }
    const info = selectedBeamInfo();
    if (!info || planSelection?.kind !== "beam") return;
    let next = applyBeamDimsToAll(project, {
      beamB: info.B,
      beamH: info.H,
      beamB1: info.B1,
    });
    // Áp dụng chiều dài cho các dầm cùng phương — không đụng trục
    next = {
      ...next,
      beams: next.beams.map((b) => {
        if (b.direction !== info.direction) return b;
        const lo = Math.min(b.start, b.end);
        return { ...b, start: lo, end: lo + info.length };
      }),
    };
    persist(next);
    setStatus(
      `Đã áp dụng L=${Math.round(info.length)}, B=${info.B}, H=${info.H}, B1=${info.B1} cho các dầm cùng phương.`,
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
    persist({ ...project, layoutPreset: "manual", zones: [...project.zones, z] });
    setSelectedZoneId(z.id);
    setStatus(`Đã thêm ${z.mark}`);
  }

  function editZone() {
    if (!selectedZoneId) return;
    persist({
      ...project,
      layoutPreset: "manual",
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
  function setSelectedBayKind(kind: "normal" | "opening" | "low") {
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
    persist({
      ...project,
      openings,
      lowSlabs: [
        ...lowSlabs,
        {
          id: uid("low"),
          name: `ST${lowSlabs.length + 1}`,
          x,
          y,
          w,
          h,
          drop: project.info.lowSlabDrop,
        },
      ],
    });
    setTab("draw");
    setStatus(`Đã đặt ô ${bayName} thành sàn thấp (hạ ${project.info.lowSlabDrop ?? 0} mm).`);
  }

  function insertOpening() {
    setSelectedBayKind("opening");
  }

  function insertLowSlab() {
    setSelectedBayKind("low");
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
          {status && <span className="text-xs text-emerald-400">{status}</span>}
          {error && <span className="max-w-xs text-xs text-red-400">{error}</span>}
        </div>
      </header>

      <nav className="flex gap-0.5 overflow-x-auto border-b border-zinc-800 bg-zinc-900 px-2 py-1">
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
      </nav>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(140px,32vh)_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-auto border-b border-zinc-800 bg-zinc-900 p-3 lg:border-b-0 lg:border-r">
          {tab === "plan" && (
            <div className="flex flex-col gap-3">
              <Panel title="1. Thông tin sàn" className="min-w-0 w-full">
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
                      onChange={(e) => patchInfo({ cover: Number(e.target.value) || 0 })}
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
                    Nhấp ô sàn trên bản vẽ để mở <b className="text-sky-300">4. Vẽ thép sàn</b>; nhấp đoạn dầm để mở{" "}
                    <b className="text-emerald-400">3. Số liệu dầm</b>.
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
              <Panel title="2. Số liệu trục" className="min-w-0 w-full">
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
              <Panel title="3. Số liệu dầm" className="min-w-0 w-full">
                <div className="flex flex-col gap-2.5">
                  <Field label="Tên dầm" wide>
                    <Input
                      value={project.info.beamNamePrefix}
                      onChange={(e) => patchInfo({ beamNamePrefix: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="mt-3 rounded border border-zinc-700 bg-zinc-950/60 p-2">
                  <div className="mb-2 text-xs font-semibold text-sky-300">Số liệu dầm</div>
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
                </div>
                <div className="mt-3 rounded border border-zinc-700 bg-zinc-950/60 p-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-sky-300">Danh sách dầm</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => persist(addBeam(project, "Y"))}>
                        <Plus /> Thêm dầm đứng
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => persist(addBeam(project, "X"))}>
                        <Plus /> Thêm dầm ngang
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 space-y-1.5 overflow-auto">
                    {(project.beams ?? []).length === 0 && (
                      <p className="text-[11px] text-zinc-500">Chưa có dầm. Thêm dầm hoặc nhập số lượng ở trên.</p>
                    )}
                    {(project.beams ?? []).flatMap((b) => {
                      const segs = beamSegments(project, b);
                      if (segs.length === 0) {
                        return [
                          <div
                            key={b.id}
                            className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-700 px-1.5 py-1"
                          >
                            <span className="min-w-0 flex-1 text-xs text-zinc-400">
                              {b.name} · {b.direction === "Y" ? "đứng" : "ngang"} · chưa có đoạn
                            </span>
                            <Button
                              size="sm"
                              variant="danger"
                              className="px-1"
                              onClick={() => persist(removeBeam(project, b.id))}
                            >
                              <Trash2 />
                            </Button>
                          </div>,
                        ];
                      }
                      return segs.map((seg) => {
                        const selected =
                          planSelection?.kind === "beam" &&
                          planSelection.beamId === b.id &&
                          planSelection.segIndex === seg.index;
                        return (
                          <div
                            key={`${b.id}-s${seg.index}`}
                            className={`flex flex-wrap items-center gap-1.5 rounded border px-1.5 py-1 ${
                              selected ? "border-emerald-600 bg-emerald-950/40" : "border-zinc-700"
                            }`}
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left text-xs text-zinc-200 hover:text-sky-300"
                              onClick={() =>
                                handlePlanSelect({ kind: "beam", beamId: b.id, segIndex: seg.index })
                              }
                            >
                              {b.name} · {seg.a0.name}–{seg.a1.name} · {b.direction === "Y" ? "đứng" : "ngang"} · L=
                              {Math.round(seg.span)}
                            </button>
                            <Input
                              type="number"
                              className="w-20"
                              title="Vị trí tim dầm (mm)"
                              value={Math.round(b.axis)}
                              onChange={(e) =>
                                persist(patchBeam(project, b.id, { axis: Number(e.target.value) || 0 }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="danger"
                              className="px-1"
                              onClick={() => {
                                if (planSelection?.kind === "beam" && planSelection.beamId === b.id) {
                                  setPlanSelection(null);
                                }
                                persist(removeBeam(project, b.id));
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        );
                      });
                    })}
                  </div>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-amber-300"
                    onClick={() => setStatus(`Thống kê dầm: ${project.beams.length} thanh.`)}
                  >
                    Thống kê Dầm ({project.beams.length})
                  </Button>
                </div>

                {planSelection?.kind === "beam" && selectedBeamInfo() && (
                  <div
                    ref={selectedBeamPanelRef}
                    className="mt-3 rounded border border-sky-700/60 bg-sky-950/30 p-2"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-sky-300">Dầm đang chọn</div>
                      <Button size="sm" variant="secondary" onClick={() => setPlanSelection(null)}>
                        Bỏ chọn
                      </Button>
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
              <Panel title="4. Vẽ thép sàn" className="min-w-0 flex-1">
                <div className="flex flex-col gap-2.5">
                  <Field label="Số hiệu thép" wide>
                    <Input value={zoneForm.mark} onChange={(e) => setZoneForm({ ...zoneForm, mark: e.target.value })} />
                  </Field>
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
                      onChange={(e) => setZoneForm({ ...zoneForm, leftHook: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Móc thép phải" unit="mm">
                    <Input
                      type="number"
                      value={zoneForm.rightHook}
                      onChange={(e) => setZoneForm({ ...zoneForm, rightHook: Number(e.target.value) || 0 })}
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
                      onChange={(e) => setZoneForm({ ...zoneForm, cover: Number(e.target.value) || 0 })}
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
                    checked={zoneForm.showSpacing}
                    onCheckedChange={(v) => setZoneForm({ ...zoneForm, showSpacing: Boolean(v) })}
                  />
                  Hiện / Ẩn khoảng rải t
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
                  <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-500" onClick={() => void exportPdf()}>
                    Vẽ thép sàn (PDF)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={planSelection?.kind === "bay" && selectedBayKind() === "opening" ? "border-sky-500 text-sky-300" : undefined}
                    onClick={insertOpening}
                    title="Chọn ô sàn rồi đặt thành ô thủng (X nét đứt)"
                  >
                    Ô thủng
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={planSelection?.kind === "bay" && selectedBayKind() === "low" ? "border-sky-500 text-sky-300" : undefined}
                    onClick={insertLowSlab}
                    title="Chọn ô sàn rồi đặt thành sàn thấp (gạch chéo)"
                  >
                    Sàn thấp
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={planSelection?.kind === "bay" && selectedBayKind() === "normal" ? "border-sky-500 text-sky-300" : undefined}
                    onClick={() => setSelectedBayKind("normal")}
                    title="Đặt lại ô đang chọn thành sàn thường"
                    disabled={planSelection?.kind !== "bay"}
                  >
                    Sàn thường
                  </Button>
                  <Button size="sm" variant="secondary" className="text-amber-300" onClick={() => setStatus(`Thống kê: ${model.schedule.length} số hiệu · ${model.totalWeight.toFixed(1)} kg`)}>
                    Thống kê thép sàn
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Chọn ô sàn → chọn loại: <b className="text-zinc-400">Sàn thường</b> / <b className="text-zinc-400">Ô thủng</b> /{" "}
                  <b className="text-zinc-400">Sàn thấp</b> (đổi lại được nếu chèn nhầm).
                </p>
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
            <Panel title="5. Bố trí thép 2 lớp tiết kiệm" className="max-w-3xl">
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
                <Button size="sm" variant="secondary" className="text-amber-300" onClick={() => void exportPdf()}>
                  Thống kê thép sàn
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPreset("manual")}>
                  Vẽ thép sàn từng thanh
                </Button>
              </div>
            </Panel>
          )}

          {tab === "simple2" && (
            <div className="flex flex-col gap-3">
              <Panel title="6. Bố trí thép 2 lớp đơn giản" className="min-w-0 flex-1">
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
                  <Button size="sm" variant="secondary" onClick={assignAllBeams}>
                    Copy Mặt bằng dầm
                  </Button>
                  <Button size="sm" variant="secondary" className="text-amber-300" onClick={applySimple2}>
                    Thép lớp dưới / trên
                  </Button>
                  <Button size="sm" variant="secondary" className="text-amber-300" onClick={() => void exportPdf()}>
                    Thống kê thép sàn
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPreset("manual")}>
                    Vẽ thép sàn từng thanh
                  </Button>
                </div>
              </Panel>
              <Panel title="Mặt cắt" className="w-64">
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
                <Button
                  size="sm"
                  className="mt-3 w-full text-emerald-400"
                  variant="secondary"
                  onClick={() => {
                    setTab("section");
                    setStatus("Đã tạo mặt cắt sàn.");
                  }}
                >
                  Tạo mặt cắt sàn
                </Button>
              </Panel>
            </div>
          )}

          {tab === "section" && (
            <Panel title="7. Mặt cắt sàn" className="max-w-xl">
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
            <Panel title="8. Mô hình 3D" className="max-w-xl">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="text-emerald-400"
                  variant="secondary"
                  onClick={() => {
                    persist({ ...project, show3d: true });
                    setStatus("Đã tạo mô hình 3D.");
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
                <Button size="sm" variant="secondary" onClick={() => setStatus("Top view")}>
                  Top
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
          <div className="min-h-0 flex-1 overflow-hidden">
            <SlabPreview
              project={project}
              show3d={project.show3d && tab === "model3d"}
              interactive={tab === "plan" || tab === "axes" || tab === "beams" || tab === "draw"}
              selection={planSelection}
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
