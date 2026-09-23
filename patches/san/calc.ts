import type {
  RebarDir,
  RebarLayer,
  RebarZone,
  SlabProject,
} from "./types";
import { rebarLayerMark } from "./types";
import {
  ensureAxes,
  groupTypicalRebarBars,
  hooksForRebarBar,
  rebarBarStraightLenMm,
  slabDistRangeForBar,
  buildMergedDistRanges,
  sortAxes,
  stripRebarBarSegments,
  type RebarBarSeg,
} from "./grid";
import { createSampleS1 } from "./sample";
import { uid } from "./utils";

const STOCK_M = 11.7;

/** kg/m theo d²/162.2 */
export function weightPerMeter(dia: number) {
  return (dia * dia) / 162.2;
}

/** Parse "10a200" | "10/200" | "Ø10a150" → { dia, spacing }. */
export function parseSteelSpec(spec: string): { dia: number; spacing: number } | null {
  const s = spec.trim().toLowerCase().replace(/ø/g, "").replace(/\s+/g, "");
  const m = s.match(/^(\d{1,2})[a\/x×-](\d{2,4})$/i);
  if (!m) return null;
  const dia = Number(m[1]);
  const spacing = Number(m[2]);
  if (!Number.isFinite(dia) || !Number.isFinite(spacing) || dia < 4 || spacing < 50) return null;
  return { dia, spacing };
}

export function formatSteelSpec(dia: number, spacing: number) {
  return `${dia}a${spacing}`;
}

export function parseBeamSize(size: string): { b: number; h: number } {
  const m = size.trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/);
  if (!m) return { b: 220, h: 400 };
  return { b: Number(m[1]), h: Number(m[2]) };
}

export interface ScheduleRow {
  mark: string;
  layer: RebarLayer;
  direction: RebarDir;
  dia: number;
  spacing: number;
  barLength: number;
  leftHook: number;
  rightHook: number;
  qtyEach: number;
  qtyMembers: number;
  qtyTotal: number;
  totalM: number;
  weight: number;
  shape: "hooked" | "straight";
  note: string;
}

export interface DiaSummary {
  dia: number;
  lengthM: number;
  weight: number;
}

export interface ComputedSlabModel {
  schedule: ScheduleRow[];
  byDia: DiaSummary[];
  totalWeight: number;
  planWidth: number;
  planHeight: number;
  thickness: number;
}

function zoneSpanMm(zone: RebarZone): { length: number; width: number } {
  const dx = Math.abs(zone.x2 - zone.x1);
  const dy = Math.abs(zone.y2 - zone.y1);
  if (zone.direction === "X") {
    return { length: Math.max(dx - 2 * zone.cover, 0), width: Math.max(dy - 2 * zone.cover, 0) };
  }
  return { length: Math.max(dy - 2 * zone.cover, 0), width: Math.max(dx - 2 * zone.cover, 0) };
}

/**
 * Số lượng thanh = chiều dài khoảng rải / khoảng cách a (làm tròn).
 * Khớp bảng thống kê: 1 CK = L_khoảng_rải / a.
 */
export function barsFromDistLength(distMm: number, spacing: number) {
  if (spacing <= 0 || distMm <= 0) return 0;
  return Math.max(1, Math.round(distMm / spacing));
}

/** @deprecated dùng barsFromDistLength — giữ alias cho chỗ gọi cũ. */
function barCount(width: number, spacing: number) {
  return barsFromDistLength(width, spacing);
}

function barDevelopedLength(straight: number, leftHook: number, rightHook: number) {
  return Math.round(straight + leftHook + rightHook);
}

export function scheduleFromZone(zone: RebarZone, quantity: number): ScheduleRow | null {
  const { length, width } = zoneSpanMm(zone);
  if (length < 50 || width < 50) return null;
  const qtyEach = barsFromDistLength(width, zone.spacing);
  const barLength = barDevelopedLength(length, zone.leftHook, zone.rightHook);
  const qtyTotal = qtyEach * Math.max(1, quantity);
  const totalM = (barLength * qtyTotal) / 1000;
  const weight = totalM * weightPerMeter(zone.dia);
  const hooked = zone.leftHook > 0 || zone.rightHook > 0;
  return {
    mark: zone.mark,
    layer: zone.layer,
    direction: zone.direction,
    dia: zone.dia,
    spacing: zone.spacing,
    barLength,
    leftHook: zone.leftHook,
    rightHook: zone.rightHook,
    qtyEach,
    qtyMembers: Math.max(1, quantity),
    qtyTotal,
    totalM,
    weight,
    shape: hooked ? "hooked" : "straight",
    note: zone.note ?? `${zone.layer} ${zone.direction}`,
  };
}

function applyPresetZones(project: SlabProject): RebarZone[] {
  if (project.layoutPreset === "manual") return project.zones;

  const pad = Math.max(...project.beams.map((b) => parseBeamSize(b.size).b / 2), 110);
  const cover = Math.max(0, Math.round(Number(project.info.cover) || 0));
  const W = project.planWidth;
  const H = project.planHeight;
  const box = { x1: pad, y1: pad, x2: W - pad, y2: H - pad, cover };

  if (project.layoutPreset === "simple2") {
    const bot = parseSteelSpec(project.simple2.bottomSpec) ?? { dia: 10, spacing: 150 };
    const top = parseSteelSpec(project.simple2.topSpec) ?? { dia: 10, spacing: 150 };
    const bh = project.simple2.bottomHook;
    const th = project.simple2.topHook;
    return [
      {
        id: "preset-simple2-bot-x",
        mark: rebarLayerMark("bottom"),
        layer: "bottom",
        direction: "X",
        dia: bot.dia,
        spacing: bot.spacing,
        leftHook: bh,
        rightHook: bh,
        ...box,
        showSpacing: true,
        spacingSymbol: "a",
        note: "Lớp dưới X",
      },
      {
        id: "preset-simple2-bot-y",
        mark: rebarLayerMark("bottom"),
        layer: "bottom",
        direction: "Y",
        dia: bot.dia,
        spacing: bot.spacing,
        leftHook: bh,
        rightHook: bh,
        ...box,
        showSpacing: true,
        spacingSymbol: "a",
        note: "Lớp dưới Y",
      },
      {
        id: "preset-simple2-top-x",
        mark: rebarLayerMark("top"),
        layer: "top",
        direction: "X",
        dia: top.dia,
        spacing: top.spacing,
        leftHook: th,
        rightHook: th,
        ...box,
        showSpacing: true,
        spacingSymbol: "a",
        note: "Lớp trên X",
      },
      {
        id: "preset-simple2-top-y",
        mark: rebarLayerMark("top"),
        layer: "top",
        direction: "Y",
        dia: top.dia,
        spacing: top.spacing,
        leftHook: th,
        rightHook: th,
        ...box,
        showSpacing: true,
        spacingSymbol: "a",
        note: "Lớp trên Y",
      },
    ];
  }

  // economy2
  const bot = parseSteelSpec(project.economy2.bottomSpec) ?? { dia: 10, spacing: 200 };
  const top = parseSteelSpec(project.economy2.topSpec) ?? { dia: 10, spacing: 150 };
  const st = parseSteelSpec(project.economy2.structuralSpec) ?? { dia: 6, spacing: 150 };
  const bh = project.economy2.bottomHook;
  const th = project.economy2.topHook;
  const sh = project.economy2.structuralHook;
  const shortIsX = W <= H;
  const hatDir: RebarDir = project.economy2.hatAlongShort ? (shortIsX ? "X" : "Y") : shortIsX ? "Y" : "X";
  /** KC đến tim 1/n — từ tim dầm ra mỗi phía L/n (L = nhịp tim−tim). */
  const n = Math.max(1, Math.round(Number(project.economy2.distToCenter) || 4));

  const zones: RebarZone[] = [
    {
      id: "preset-economy2-bot-x",
      mark: rebarLayerMark("bottom"),
      layer: "bottom",
      direction: "X",
      dia: bot.dia,
      spacing: bot.spacing,
      leftHook: bh,
      rightHook: bh,
      ...box,
      showSpacing: true,
      spacingSymbol: "a",
      note: "Lớp dưới X",
    },
    {
      id: "preset-economy2-bot-y",
      mark: rebarLayerMark("bottom"),
      layer: "bottom",
      direction: "Y",
      dia: bot.dia,
      spacing: bot.spacing,
      leftHook: bh,
      rightHook: bh,
      ...box,
      showSpacing: true,
      spacingSymbol: "a",
      note: "Lớp dưới Y",
    },
    {
      id: "preset-economy2-ct",
      mark: rebarLayerMark("structural"),
      layer: "structural",
      direction: hatDir === "X" ? "Y" : "X",
      dia: st.dia,
      spacing: st.spacing,
      leftHook: sh,
      rightHook: sh,
      ...box,
      showSpacing: true,
      spacingSymbol: "a",
      note: "Thép cấu tạo",
    },
  ];

  // Thép mũ: không trải full nhịp như lớp dưới — mỗi tim dầm (trục đỡ)
  // kéo dài L_trái/n + L_phải/n theo phương thanh.
  const supportAxes =
    hatDir === "X" ? sortAxes(project.axesX ?? []) : sortAxes(project.axesY ?? []);
  for (let i = 0; i < supportAxes.length; i++) {
    const ax = supportAxes[i]!;
    const prev = supportAxes[i - 1];
    const next = supportAxes[i + 1];
    const leftExt = prev ? (ax.pos - prev.pos) / n : 0;
    const rightExt = next ? (next.pos - ax.pos) / n : 0;
    if (leftExt + rightExt < 50) continue;

    if (hatDir === "X") {
      const x1 = Math.max(box.x1, ax.pos - leftExt);
      const x2 = Math.min(box.x2, ax.pos + rightExt);
      if (x2 - x1 < 50) continue;
      zones.push({
        id: `preset-economy2-hat-${i}`,
        mark: rebarLayerMark("top"),
        layer: "top",
        direction: "X",
        dia: top.dia,
        spacing: top.spacing,
        leftHook: th,
        rightHook: th,
        x1,
        y1: box.y1,
        x2,
        y2: box.y2,
        // Chiều dài mũ = đúng từ tim ± L/n (không trừ cover thêm).
        cover: 0,
        showSpacing: true,
        spacingSymbol: "a",
        note: "Thép mũ",
      });
    } else {
      const y1 = Math.max(box.y1, ax.pos - leftExt);
      const y2 = Math.min(box.y2, ax.pos + rightExt);
      if (y2 - y1 < 50) continue;
      zones.push({
        id: `preset-economy2-hat-${i}`,
        mark: rebarLayerMark("top"),
        layer: "top",
        direction: "Y",
        dia: top.dia,
        spacing: top.spacing,
        leftHook: th,
        rightHook: th,
        x1: box.x1,
        y1,
        x2: box.x2,
        y2,
        cover: 0,
        showSpacing: true,
        spacingSymbol: "a",
        note: "Thép mũ",
      });
    }
  }
  return zones;
}

export function effectiveZones(project: SlabProject): RebarZone[] {
  return applyPresetZones(project);
}

/**
 * 1 CK từ khoảng rải đã gộp: ô kề nhau cùng số hiệu → 1 L;
 * 1 CK = Σ round(L_gộp / a) cho các dải thuộc zone.
 */
export function qtyEachFromDistRanges(
  project: SlabProject,
  zone: RebarZone,
  bars?: RebarBarSeg[],
): number {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  if (axesX.length < 2 || axesY.length < 2) {
    const { width } = zoneSpanMm(zone);
    return barsFromDistLength(width, zone.spacing);
  }
  const segs = bars ?? stripRebarBarSegments(project, axesX, axesY);
  const zx0 = Math.min(zone.x1, zone.x2);
  const zx1 = Math.max(zone.x1, zone.x2);
  const zy0 = Math.min(zone.y1, zone.y2);
  const zy1 = Math.max(zone.y1, zone.y2);
  const zoneKey = `${zone.mark}|${zone.dia}|${zone.spacing}|${zone.direction}`;
  const markKeyOf = (bar: RebarBarSeg) => {
    if (bar.dir !== zone.direction) return "";
    const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
    const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
    if (mx < zx0 - 1 || mx > zx1 + 1 || my < zy0 - 1 || my > zy1 + 1) return "";
    return zoneKey;
  };
  const merged = buildMergedDistRanges(
    project,
    axesX,
    axesY,
    segs,
    markKeyOf,
    undefined,
    effectiveZones(project),
  );
  const mine = merged.filter((m) => m.markKey === zoneKey);
  if (mine.length) {
    return Math.max(
      1,
      mine.reduce((s, m) => s + barsFromDistLength(m.lenMm, zone.spacing), 0),
    );
  }
  const { width } = zoneSpanMm(zone);
  return barsFromDistLength(width, zone.spacing);
}

/** Gộp dòng thống kê trùng số hiệu + Ø + a + L + móc (nhiều vùng mũ cùng loại). */
function mergeScheduleRows(rows: ScheduleRow[]): ScheduleRow[] {
  const map = new Map<string, ScheduleRow>();
  for (const r of rows) {
    const k = [
      r.mark,
      r.layer,
      r.direction,
      r.dia,
      r.spacing,
      r.barLength,
      r.leftHook,
      r.rightHook,
      r.shape,
    ].join("|");
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r });
      continue;
    }
    cur.qtyEach += r.qtyEach;
    cur.qtyTotal += r.qtyTotal;
    cur.totalM += r.totalM;
    cur.weight += r.weight;
  }
  return [...map.values()];
}

export function computeModel(project: SlabProject): ComputedSlabModel {
  const zones = effectiveZones(project);
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const bars =
    axesX.length >= 2 && axesY.length >= 2
      ? stripRebarBarSegments(project, axesX, axesY)
      : [];
  const schedule: ScheduleRow[] = [];
  const qtyMembers = Math.max(1, project.info.quantity);

  for (const z of zones) {
    // Thép mũ (economy2 top): vẫn theo vùng chữ nhật L/n — không dùng dải full-nhịp.
    if (project.layoutPreset === "economy2" && z.layer === "top") {
      const row = scheduleFromZone(z, project.info.quantity);
      if (!row) continue;
      const qtyEach = barsFromDistLength(zoneSpanMm(z).width, z.spacing);
      const qtyTotal = qtyEach * qtyMembers;
      const totalM = (row.barLength * qtyTotal) / 1000;
      schedule.push({
        ...row,
        qtyEach,
        qtyMembers,
        qtyTotal,
        totalM,
        weight: totalM * weightPerMeter(row.dia),
      });
      continue;
    }

    const zx0 = Math.min(z.x1, z.x2);
    const zx1 = Math.max(z.x1, z.x2);
    const zy0 = Math.min(z.y1, z.y2);
    const zy1 = Math.max(z.y1, z.y2);
    const zoneBars = bars.filter((bar) => {
      if (bar.dir !== z.direction) return false;
      const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
      const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
      return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
    });

    if (!zoneBars.length) {
      const row = scheduleFromZone(z, project.info.quantity);
      if (!row) continue;
      const qtyEach = qtyEachFromDistRanges(project, z, bars);
      const qtyTotal = qtyEach * qtyMembers;
      const totalM = (row.barLength * qtyTotal) / 1000;
      schedule.push({
        ...row,
        qtyEach,
        qtyMembers,
        qtyTotal,
        totalM,
        weight: totalM * weightPerMeter(row.dia),
      });
      continue;
    }

    // Mỗi nhóm chiều dài (biến thiên) → 1 dòng thống kê; SL = số thanh trong nhóm.
    const groups = groupTypicalRebarBars(project, zoneBars, zones);
    for (const g of groups) {
      if (g.typical.dir !== z.direction) continue;
      const lengths = g.bars.map(rebarBarStraightLenMm).sort((a, b) => a - b);
      const straight = lengths[Math.floor((lengths.length - 1) / 2)] ?? rebarBarStraightLenMm(g.typical);
      const hooks = hooksForRebarBar(project, g.typical, zones);
      const barLength = barDevelopedLength(straight, hooks.left, hooks.right);
      const qtyEach = Math.max(1, g.bars.length);
      const qtyTotal = qtyEach * qtyMembers;
      const totalM = (barLength * qtyTotal) / 1000;
      const hooked = hooks.left > 0 || hooks.right > 0;
      schedule.push({
        mark: z.mark,
        layer: z.layer,
        direction: z.direction,
        dia: z.dia,
        spacing: z.spacing,
        barLength,
        leftHook: hooks.left,
        rightHook: hooks.right,
        qtyEach,
        qtyMembers,
        qtyTotal,
        totalM,
        weight: totalM * weightPerMeter(z.dia),
        shape: hooked ? "hooked" : "straight",
        note: z.note ?? `${z.layer} ${z.direction}`,
      });
    }
  }
  const merged = mergeScheduleRows(schedule);
  merged.sort((a, b) => a.mark.localeCompare(b.mark, "vi") || a.barLength - b.barLength);

  const byDiaMap = new Map<number, DiaSummary>();
  for (const r of merged) {
    const cur = byDiaMap.get(r.dia) ?? { dia: r.dia, lengthM: 0, weight: 0 };
    cur.lengthM += r.totalM;
    cur.weight += r.weight;
    byDiaMap.set(r.dia, cur);
  }
  const byDia = [...byDiaMap.values()].sort((a, b) => a.dia - b.dia);
  const totalWeight = byDia.reduce((s, d) => s + d.weight, 0);

  return {
    schedule: merged,
    byDia,
    totalWeight,
    planWidth: project.planWidth,
    planHeight: project.planHeight,
    thickness: project.info.thickness,
  };
}

export function normalizeProject(raw: SlabProject): SlabProject {
  const base = createSampleS1();
  const rawInfo = raw.info ?? {};
  const parsed = parseBeamSize(
    (rawInfo as SlabProject["info"]).beamSizeX ||
      (rawInfo as SlabProject["info"]).beamSizeY ||
      base.info.beamSizeX,
  );
  const beamB =
    Number.isFinite((rawInfo as SlabProject["info"]).beamB) &&
    (rawInfo as SlabProject["info"]).beamB! > 0
      ? (rawInfo as SlabProject["info"]).beamB!
      : parsed.b;
  const beamH =
    Number.isFinite((rawInfo as SlabProject["info"]).beamH) &&
    (rawInfo as SlabProject["info"]).beamH! > 0
      ? (rawInfo as SlabProject["info"]).beamH!
      : parsed.h;
  const beamB1 =
    Number.isFinite((rawInfo as SlabProject["info"]).beamB1) &&
    (rawInfo as SlabProject["info"]).beamB1! >= 0
      ? (rawInfo as SlabProject["info"]).beamB1!
      : Math.round(beamB / 2);
  const sizeStr = `${beamB}x${beamH}`;
  const axesX = raw.axesX?.length ? raw.axesX : base.axesX;
  const axesY = raw.axesY?.length ? raw.axesY : base.axesY;
  const beamCountX =
    Number.isFinite((rawInfo as SlabProject["info"]).beamCountX) &&
    (rawInfo as SlabProject["info"]).beamCountX! >= 2
      ? Math.round((rawInfo as SlabProject["info"]).beamCountX!)
      : axesX.length;
  const beamCountY =
    Number.isFinite((rawInfo as SlabProject["info"]).beamCountY) &&
    (rawInfo as SlabProject["info"]).beamCountY! >= 2
      ? Math.round((rawInfo as SlabProject["info"]).beamCountY!)
      : axesY.length;

  const merged: SlabProject = {
    ...base,
    ...raw,
    info: {
      ...base.info,
      ...rawInfo,
      beamB,
      beamH,
      beamB1,
      beamCountX,
      beamCountY,
      beamSizeX: sizeStr,
      beamSizeY: sizeStr,
    },
    simple2: { ...base.simple2, ...raw.simple2 },
    economy2: { ...base.economy2, ...raw.economy2 },
    beams: raw.beams?.length ? raw.beams : base.beams,
    beamTypes: (() => {
      if (Array.isArray(raw.beamTypes) && raw.beamTypes.length > 0) {
        return raw.beamTypes
          .filter((t) => t && typeof t.name === "string" && t.name.trim())
          .map((t) => ({
            id: t.id || uid("bt"),
            name: String(t.name).trim(),
            size: String(t.size || sizeStr),
            offset: Number.isFinite(t.offset) ? Math.round(t.offset) : Math.round(beamB / 2),
          }));
      }
      // Dự án cũ: suy ra loại dầm từ tên dầm mặt bằng
      const beams = raw.beams?.length ? raw.beams : base.beams;
      const seen = new Set<string>();
      return beams
        .filter((b) => {
          const k = (b.name || "").trim().toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((b) => ({
          id: uid("bt"),
          name: b.name.trim(),
          size: b.size || sizeStr,
          offset: Number.isFinite(b.offset) ? Math.round(b.offset) : Math.round(beamB / 2),
        }));
    })(),
    zones: raw.zones ?? base.zones,
    openings: raw.openings ?? [],
    lowSlabs: (raw.lowSlabs ?? []).map((ls) => ({
      ...ls,
      drop: Number.isFinite(ls.drop) ? ls.drop : 200,
      rebarMode: ls.rebarMode === "cut" ? "cut" : "press",
    })),
    sections: raw.sections?.length ? raw.sections : base.sections,
    axesX,
    axesY,
  };
  return ensureAxes(merged);
}

export { STOCK_M };
