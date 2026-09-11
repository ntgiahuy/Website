"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
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
} from "@/lib/calc";
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
    leftHook: 60,
    rightHook: 60,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const W = project.planWidth;
    const H = project.planHeight;
    const prefix = project.info.beamNamePrefix || "D";
    const beams = [
      { id: uid("beam"), name: `${prefix}1`, size: project.info.beamSizeX, direction: "Y" as const, axis: 0, start: 0, end: H, offset: 110 },
      { id: uid("beam"), name: `${prefix}2`, size: project.info.beamSizeX, direction: "Y" as const, axis: W / 2, start: 0, end: H, offset: 110 },
      { id: uid("beam"), name: `${prefix}3`, size: project.info.beamSizeX, direction: "Y" as const, axis: W, start: 0, end: H, offset: 110 },
      { id: uid("beam"), name: `${prefix}4`, size: project.info.beamSizeY, direction: "X" as const, axis: 0, start: 0, end: W, offset: 110 },
      { id: uid("beam"), name: `${prefix}5`, size: project.info.beamSizeY, direction: "X" as const, axis: H, start: 0, end: W, offset: 110 },
    ];
    persist({ ...project, beams });
    setStatus("Đã gán dầm vào mặt bằng.");
  }

  function insertOpening() {
    persist({
      ...project,
      openings: [
        ...project.openings,
        {
          id: uid("op"),
          name: `Ô${project.openings.length + 1}`,
          x: project.planWidth / 2 - 400,
          y: project.planHeight / 2 - 400,
          w: 800,
          h: 800,
        },
      ],
    });
    setStatus("Đã chèn ô thủng.");
  }

  function insertLowSlab() {
    persist({
      ...project,
      lowSlabs: [
        ...project.lowSlabs,
        {
          id: uid("low"),
          name: `ST${project.lowSlabs.length + 1}`,
          x: 200,
          y: 200,
          w: 1500,
          h: 1500,
          drop: project.info.lowSlabDrop,
        },
      ],
    });
    setStatus("Đã chèn sàn thấp.");
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

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(220px,300px)_minmax(0,1fr)]">
        <div className="overflow-auto border-b border-zinc-800 bg-zinc-900 p-3">
          {tab === "plan" && (
            <div className="flex flex-wrap gap-3">
              <Panel title="1. Thông tin sàn" className="min-w-[300px] flex-1">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Tên sàn">
                    <Input value={project.info.name} onChange={(e) => patchInfo({ name: e.target.value })} />
                  </Field>
                  <Field label="Chiều dày sàn (mm)">
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
                  <Field label="Lớp bảo vệ thép (mm)">
                    <Input
                      type="number"
                      value={project.info.cover}
                      onChange={(e) => patchInfo({ cover: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Tên dầm">
                    <Input
                      value={project.info.beamNamePrefix}
                      onChange={(e) => patchInfo({ beamNamePrefix: e.target.value })}
                    />
                  </Field>
                  <Field label="Chiều cao Text">
                    <Input
                      type="number"
                      value={project.info.textHeight}
                      onChange={(e) => patchInfo({ textHeight: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Kích thước Dầm X">
                    <Input
                      value={project.info.beamSizeX}
                      onChange={(e) => patchInfo({ beamSizeX: e.target.value })}
                    />
                  </Field>
                  <Field label="Kích thước Dầm Y">
                    <Input
                      value={project.info.beamSizeY}
                      onChange={(e) => patchInfo({ beamSizeY: e.target.value })}
                    />
                  </Field>
                  <Field label="Bề rộng sàn (mm)">
                    <Input
                      type="number"
                      value={project.planWidth}
                      onChange={(e) => persist({ ...project, planWidth: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Chiều dài sàn (mm)">
                    <Input
                      type="number"
                      value={project.planHeight}
                      onChange={(e) => persist({ ...project, planHeight: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Chênh cao độ sàn thấp (mm)">
                    <Input
                      type="number"
                      value={project.info.lowSlabDrop}
                      onChange={(e) => patchInfo({ lowSlabDrop: Number(e.target.value) || 0 })}
                    />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" className="text-amber-300" onClick={assignAllBeams}>
                    Gán toàn bộ dầm vào mặt bằng…
                  </Button>
                  <Button variant="secondary" size="sm" onClick={insertOpening}>
                    Chèn Ô thủng
                  </Button>
                  <Button variant="secondary" size="sm" onClick={insertLowSlab}>
                    Chèn Sàn thấp
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
              </Panel>
            </div>
          )}

          {tab === "draw" && (
            <div className="flex flex-wrap gap-3">
              <Panel title="1. Vẽ thép sàn" className="min-w-[320px] flex-1">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Số hiệu thép">
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
                      className="h-8 w-full rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
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
                      className="h-8 w-full rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
                      value={zoneForm.spacing}
                      onChange={(e) => setZoneForm({ ...zoneForm, spacing: Number(e.target.value) })}
                    >
                      {SPACING_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Móc thép trái">
                    <Input
                      type="number"
                      value={zoneForm.leftHook}
                      onChange={(e) => setZoneForm({ ...zoneForm, leftHook: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Móc thép phải">
                    <Input
                      type="number"
                      value={zoneForm.rightHook}
                      onChange={(e) => setZoneForm({ ...zoneForm, rightHook: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Ký hiệu khoảng rải">
                    <Input
                      value={zoneForm.spacingSymbol}
                      onChange={(e) => setZoneForm({ ...zoneForm, spacingSymbol: e.target.value })}
                    />
                  </Field>
                  <Field label="Dày lớp bảo vệ">
                    <Input
                      type="number"
                      value={zoneForm.cover}
                      onChange={(e) => setZoneForm({ ...zoneForm, cover: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Lớp thép">
                    <select
                      className="h-8 w-full rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
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
                      className="h-8 w-full rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm"
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
                  <Button size="sm" variant="secondary" className="text-amber-300" onClick={() => setStatus(`Thống kê: ${model.schedule.length} số hiệu · ${model.totalWeight.toFixed(1)} kg`)}>
                    Thống kê thép sàn
                  </Button>
                </div>
              </Panel>
              <Panel title="Danh sách vùng thép" className="w-56">
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
            </div>
          )}

          {tab === "economy2" && (
            <Panel title="1. Bố trí thép 2 lớp tiết kiệm" className="max-w-3xl">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Thép lớp dưới">
                  <Input
                    value={project.economy2.bottomSpec}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, bottomSpec: e.target.value } })}
                  />
                </Field>
                <Field label="Móc thép dưới">
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
                <Field label="Móc thép trên">
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
                <Field label="Móc thép cấu tạo">
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
                <Field label="Chiều cao Text">
                  <Input
                    type="number"
                    value={project.economy2.textHeight}
                    onChange={(e) => persist({ ...project, economy2: { ...project.economy2, textHeight: Number(e.target.value) || 0 } })}
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
            <div className="flex flex-wrap gap-3">
              <Panel title="1. Bố trí thép 2 lớp đơn giản" className="min-w-[300px] flex-1">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Field label="Thép lớp dưới">
                    <Input
                      value={project.simple2.bottomSpec}
                      onChange={(e) => persist({ ...project, simple2: { ...project.simple2, bottomSpec: e.target.value } })}
                    />
                  </Field>
                  <Field label="Móc thép dưới">
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
                  <Field label="Móc thép trên">
                    <Input
                      type="number"
                      value={project.simple2.topHook}
                      onChange={(e) => persist({ ...project, simple2: { ...project.simple2, topHook: Number(e.target.value) || 0 } })}
                    />
                  </Field>
                  <Field label="Chiều cao Text thép">
                    <Input
                      type="number"
                      value={project.simple2.textHeight}
                      onChange={(e) => persist({ ...project, simple2: { ...project.simple2, textHeight: Number(e.target.value) || 0 } })}
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
            <Panel title="5. Mặt cắt sàn" className="max-w-xl">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <Field label="Vị trí cắt (mm)">
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
            <Panel title="2. Mô hình 3D" className="max-w-xl">
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
              <div className="grid grid-cols-2 gap-2">
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

        <div className="min-h-0 overflow-hidden">
          <SlabPreview project={project} show3d={project.show3d && tab === "model3d"} />
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
