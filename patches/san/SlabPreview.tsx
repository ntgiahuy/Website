"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { effectiveZones } from "@/lib/calc";
import {
  axisInteriorSegmentsX,
  axisInteriorSegmentsY,
  baySlabExtent,
  beamSegSideFaces,
  beamSegments,
  beamFaceDashStyle,
  clippedBeamFaceParts,
  getBeamSegShift,
  isBeamSegOmitted,
  planBeamBleed,
  planBeamDisplayName,
  rectDiagonalHatchSegments,
  rectOpeningDiagonals,
  sortAxes,
  stripRebarBarSegments,
  stripRebarPressMarks,
  buildMergedDistRanges,
  hooksForRebarBar,
  rebarHookSegments,
  typicalRebarBars,
} from "@/lib/grid";
import type { PlanSelection, SlabProject } from "@/lib/types";
import { buildBeamFrameScene, projectSceneToSvg } from "@/lib/view3d";

type Anchor = { leftPct: number; topPct: number };

/** Bán kính vòng số hiệu trục (px SVG). */
const AXIS_BUBBLE_R = 6;
/** Khoảng hở giữa da dầm ngoài và mép vòng (kề sàn, không chạm). */
const AXIS_BUBBLE_GAP = 12;
/** Tâm vòng số hiệu cách da dầm ngoài. */
const AXIS_BUBBLE_OFFSET = AXIS_BUBBLE_R + AXIS_BUBBLE_GAP;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function SlabPreview({
  project,
  show3d,
  zoomPct = 100,
  selection = null,
  beamMultiSelect = [],
  onSelect,
  interactive = false,
  insertBeamMode = false,
  editPanel = null,
}: {
  project: SlabProject;
  show3d?: boolean;
  /** Phóng to / thu nhỏ bản vẽ (100 = vừa khung). */
  zoomPct?: number;
  selection?: PlanSelection | null;
  /** Các đoạn dầm đang chọn (Ctrl/Shift) — tô nhấn trên bản vẽ. */
  beamMultiSelect?: Array<{ beamId: string; segIndex: number }>;
  onSelect?: (sel: PlanSelection | null, e?: MouseEvent) => void;
  /** Cho phép nhấp chọn ô sàn / đoạn dầm / số hiệu trục trên bản vẽ. */
  interactive?: boolean;
  /** Đang chèn dầm vào ô — ưu tiên click ô sàn, không bắt sự kiện trên thân dầm. */
  insertBeamMode?: boolean;
  /** Bảng chỉnh sửa kích thước hiển thị tại vị trí chọn. */
  editPanel?: ReactNode;
}) {
  const zones = useMemo(() => effectiveZones(project), [project]);
  const axesX = useMemo(() => sortAxes(project.axesX ?? []), [project.axesX]);
  const axesY = useMemo(() => sortAxes(project.axesY ?? []), [project.axesY]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const W = 640;
  const H = 420;
  const bleed = useMemo(() => planBeamBleed(project, axesX, axesY), [project, axesX, axesY]);
  const bleedMm = Math.max(
    0,
    -bleed.xMin,
    -bleed.yMin,
    bleed.xMax - project.planWidth,
    bleed.yMax - project.planHeight,
  );
  // Chừa chỗ: dầm nhô ngoài plan + vòng số hiệu + khe hở
  const pad = Math.max(48, AXIS_BUBBLE_OFFSET + AXIS_BUBBLE_R + 12 + bleedMm * 0.04);
  const sx = (W - pad * 2) / Math.max(project.planWidth, 1);
  const sy = (H - pad * 2) / Math.max(project.planHeight, 1);
  const s = Math.min(sx, sy);
  const ox = pad + (W - pad * 2 - project.planWidth * s) / 2;
  const oy = pad + (H - pad * 2 - project.planHeight * s) / 2;
  const X = (mm: number) => ox + mm * s;
  const Y = (mm: number) => oy + (project.planHeight - mm) * s;
  /** Da dầm ngoài cùng — neo vòng số hiệu / đường dẫn (không dính thân dầm). */
  const outerLeft = bleed.xMin;
  const outerBottom = bleed.yMin;

  function anchorFromSvg(svgX: number, svgY: number): Anchor {
    return {
      leftPct: clamp((svgX / W) * 100, 8, 78),
      topPct: clamp((svgY / H) * 100, 8, 72),
    };
  }

  function anchorFromSelection(sel: PlanSelection): Anchor {
    if (sel.kind === "bay") {
      const { x0, x1, y0, y1 } = baySlabExtent(project, axesX, axesY, sel.ix, sel.iy);
      return anchorFromSvg(X((x0 + x1) / 2), Y((y0 + y1) / 2));
    }
    if (sel.kind === "beam") {
      const beam = project.beams.find((b) => b.id === sel.beamId);
      if (!beam) return { leftPct: 50, topPct: 40 };
      const segs = beamSegments(project, beam);
      const seg = segs[sel.segIndex] ?? segs[0];
      if (!seg) return { leftPct: 50, topPct: 40 };
      if (beam.direction === "Y") {
        return anchorFromSvg(X(beam.axis) + 28, Y((seg.lo + seg.hi) / 2));
      }
      return anchorFromSvg(X((seg.lo + seg.hi) / 2), Y(beam.axis) - 28);
    }
    const axes = sel.dir === "X" ? axesX : axesY;
    const ax = axes.find((a) => a.id === sel.axisId);
    if (!ax) return { leftPct: 50, topPct: 40 };
    if (sel.dir === "X") return anchorFromSvg(X(ax.pos), Y(outerBottom) + AXIS_BUBBLE_OFFSET + 20);
    return anchorFromSvg(X(outerLeft) - AXIS_BUBBLE_OFFSET, Y(ax.pos));
  }

  function pick(sel: PlanSelection | null, e?: MouseEvent) {
    onSelect?.(sel, e);
    if (!sel) {
      setAnchor(null);
      return;
    }
    if (e && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setAnchor({
        leftPct: clamp(((e.clientX - r.left) / Math.max(r.width, 1)) * 100, 4, 72),
        topPct: clamp(((e.clientY - r.top) / Math.max(r.height, 1)) * 100, 4, 70),
      });
      return;
    }
    setAnchor(anchorFromSelection(sel));
  }

  useEffect(() => {
    if (!selection) {
      setAnchor(null);
      return;
    }
    setAnchor((prev) => prev ?? anchorFromSelection(selection));
    // Chỉ neo lại khi đổi đối tượng chọn (không theo mọi frame geometry).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.kind, selection && "beamId" in selection ? selection.beamId : null, selection && "segIndex" in selection ? selection.segIndex : null, selection && "axisId" in selection ? selection.axisId : null, selection && "ix" in selection ? selection.ix : null, selection && "iy" in selection ? selection.iy : null]);

  if (show3d) {
    const scene = buildBeamFrameScene(project);
    const view = projectSceneToSvg(scene, { width: 920, height: 540, pad: 40 });
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-zinc-900 p-3">
        <svg
          viewBox={`0 0 ${view.width} ${view.height}`}
          className="h-full w-full max-h-full rounded border border-zinc-700 bg-white"
          role="img"
          aria-label={view.title}
        >
          <defs>
            <pattern id="lowHatch3d" patternUnits="userSpaceOnUse" width="6" height="6">
              <circle cx="1.2" cy="1.2" r="0.7" fill="#9ca3af" />
            </pattern>
          </defs>
          {view.polygons.map((poly, i) => (
            <polygon
              key={`f-${i}`}
              points={poly.points}
              fill={poly.kind === "hatch" ? "url(#lowHatch3d)" : "#ffffff"}
              stroke="none"
            />
          ))}
          {view.edges.map((e, i) => (
            <line
              key={`e-${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.style === "solid" ? "#0a0a0a" : "#9ca3af"}
              strokeWidth={e.style === "solid" ? 1.45 : 0.55}
              strokeDasharray={e.style === "dashed" ? "3.5 2.2" : undefined}
              strokeLinecap="round"
            />
          ))}
          {view.lines.map((ln, i) => (
            <line
              key={`x-${i}`}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              stroke="#6b7280"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
          ))}
          {view.marks.map((m, i) => (
            <g key={`m-${i}`} transform={`translate(${m.x}, ${m.y})`}>
              <polygon points="-7,0 7,0 0,-10" fill="#111" />
              <line x1={0} y1={0} x2={0} y2={14} stroke="#111" strokeWidth={1} />
              <text x={10} y={-2} fill="#111" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                {m.elevText}
              </text>
              <text x={10} y={12} fill="#374151" fontSize="10" fontFamily="sans-serif">
                {m.hsText}
              </text>
            </g>
          ))}
          <text
            x={view.width / 2}
            y={view.height - 22}
            textAnchor="middle"
            fill="#111"
            fontSize="13"
            fontWeight="700"
            fontFamily="sans-serif"
          >
            {view.title}
          </text>
          <text
            x={view.width / 2}
            y={view.height - 8}
            textAnchor="middle"
            fill="#4b5563"
            fontSize="11"
            fontFamily="sans-serif"
          >
            {view.subtitle}
          </text>
        </svg>
      </div>
    );
  }

  const bayNodes: ReactNode[] = [];
  for (let ix = 0; ix < axesX.length - 1; ix++) {
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      const { x0, x1, y0, y1 } = baySlabExtent(project, axesX, axesY, ix, iy);
      const active = selection?.kind === "bay" && selection.ix === ix && selection.iy === iy;
      bayNodes.push(
        <g key={`bay-${ix}-${iy}`}>
          <rect
            x={X(x0)}
            y={Y(y1)}
            width={(x1 - x0) * s}
            height={(y1 - y0) * s}
            fill={active ? "rgba(56,189,248,0.18)" : interactive ? "rgba(39,39,42,0.35)" : "transparent"}
            stroke={active ? "#38bdf8" : "transparent"}
            strokeWidth={active ? 1.6 : 0}
            className={interactive ? (insertBeamMode ? "cursor-crosshair" : "cursor-pointer") : undefined}
            pointerEvents={interactive ? "all" : "none"}
            onClick={(e) => {
              if (!interactive || !onSelect) return;
              e.stopPropagation();
              pick({ kind: "bay", ix, iy }, e);
            }}
          />
          {active && (
            <text
              x={X((x0 + x1) / 2)}
              y={Y((y0 + y1) / 2)}
              textAnchor="middle"
              fill="#7dd3fc"
              fontSize="11"
              fontWeight="700"
              pointerEvents="none"
            >
              {axesX[ix].name}-{axesY[iy].name} · {Math.round(x1 - x0)}×{Math.round(y1 - y0)}
            </text>
          )}
        </g>,
      );
    }
  }

  const lowSlabNodes: ReactNode[] = (project.lowSlabs ?? []).map((ls) => {
    const x0 = ls.x;
    const y0 = ls.y;
    const x1 = ls.x + ls.w;
    const y1 = ls.y + ls.h;
    const segs = rectDiagonalHatchSegments(x0, y0, x1, y1, 200);
    return (
      <g key={`low-${ls.id}`} pointerEvents="none">
        <rect
          x={X(x0)}
          y={Y(y1)}
          width={ls.w * s}
          height={ls.h * s}
          fill="rgba(161,161,170,0.06)"
          stroke="#a1a1aa"
          strokeWidth={0.8}
        />
        {segs.map((seg, i) => (
          <line
            key={`low-hatch-${ls.id}-${i}`}
            x1={X(seg.xA)}
            y1={Y(seg.yA)}
            x2={X(seg.xB)}
            y2={Y(seg.yB)}
            stroke="#c4c4c8"
            strokeWidth={0.9}
            opacity={0.95}
          />
        ))}
        <text
          x={X((x0 + x1) / 2)}
          y={Y((y0 + y1) / 2) + 4}
          textAnchor="middle"
          fill="#d4d4d8"
          fontSize="10"
          fontWeight="600"
        >
          {ls.name || "ST"}
          {(ls.rebarMode ?? "press") === "cut" ? " · cắt" : " · nhấn"}
        </text>
      </g>
    );
  });

  const openingNodes: ReactNode[] = (project.openings ?? []).map((op) => {
    const x0 = op.x;
    const y0 = op.y;
    const x1 = op.x + op.w;
    const y1 = op.y + op.h;
    const [d1, d2] = rectOpeningDiagonals(x0, y0, x1, y1);
    return (
      <g key={`op-${op.id}`} pointerEvents="none">
        <rect
          x={X(x0)}
          y={Y(y1)}
          width={op.w * s}
          height={op.h * s}
          fill="rgba(24,24,27,0.55)"
          stroke="#e4e4e7"
          strokeWidth={1}
        />
        <line
          x1={X(d1.xA)}
          y1={Y(d1.yA)}
          x2={X(d1.xB)}
          y2={Y(d1.yB)}
          stroke="#e4e4e7"
          strokeWidth={1.2}
          strokeDasharray="6 4"
        />
        <line
          x1={X(d2.xA)}
          y1={Y(d2.yA)}
          x2={X(d2.xB)}
          y2={Y(d2.yB)}
          stroke="#e4e4e7"
          strokeWidth={1.2}
          strokeDasharray="6 4"
        />
        <text
          x={X((x0 + x1) / 2)}
          y={Y((y0 + y1) / 2) + 4}
          textAnchor="middle"
          fill="#fafafa"
          fontSize="10"
          fontWeight="700"
        >
          {op.name || "Ô"}
        </text>
      </g>
    );
  });

  const beamNodes: ReactNode[] = [];
  /** Nét da dầm: biên ngoài liền, da trong đứt; cắt chỗ giao. */
  const BEAM_SW = 0.85;
  const BEAM_DASH = "4 2.5";
  const BEAM_STROKE = "#c4c4c8";
  for (const beam of project.beams ?? []) {
    const segs = beamSegments(project, beam);

    for (const seg of segs) {
      if (isBeamSegOmitted(beam, seg.a0.id, seg.a1.id)) continue;
      const active =
        (selection?.kind === "beam" &&
          selection.beamId === beam.id &&
          selection.segIndex === seg.index) ||
        beamMultiSelect.some((s) => s.beamId === beam.id && s.segIndex === seg.index);
      const { lo0, hi0, lo1, hi1 } = beamSegSideFaces(beam, seg.index);
      const { s0, s1 } = getBeamSegShift(beam, seg.index);
      const lo = seg.lo;
      const hi = seg.hi;

      // Hit-area trong suốt (chọn đoạn) — không tô thân dầm
      const pts =
        beam.direction === "Y"
          ? [
              [X(lo0), Y(lo)],
              [X(hi0), Y(lo)],
              [X(hi1), Y(hi)],
              [X(lo1), Y(hi)],
            ]
          : [
              [X(lo), Y(lo0)],
              [X(lo), Y(hi0)],
              [X(hi), Y(hi1)],
              [X(hi), Y(lo1)],
            ];
      const points = pts.map(([px, py]) => `${px},${py}`).join(" ");
      const labelX =
        beam.direction === "Y" ? X(Math.max(hi0, hi1)) + 10 : X((lo + hi) / 2);
      const labelY =
        beam.direction === "Y" ? Y((lo + hi) / 2) : Y(Math.max(hi0, hi1)) - 6;

      const faceLines: ReactNode[] = [];
      const pushFace = (face0: number, face1: number, key: string) => {
        const style = beamFaceDashStyle(beam.direction, face0, face1, bleed);
        // Da biên ngoài: không cắt chỗ giao — giữ nét liền suốt đầu/cuối dầm
        const parts =
          style === "solid"
            ? [{ faceA: face0, faceB: face1, alongA: lo, alongB: hi }]
            : clippedBeamFaceParts(project, beam.direction, face0, face1, lo, hi);
        parts.forEach((p, i) => {
          const x1 = beam.direction === "Y" ? X(p.faceA) : X(p.alongA);
          const y1 = beam.direction === "Y" ? Y(p.alongA) : Y(p.faceA);
          const x2 = beam.direction === "Y" ? X(p.faceB) : X(p.alongB);
          const y2 = beam.direction === "Y" ? Y(p.alongB) : Y(p.faceB);
          faceLines.push(
            <line
              key={`${key}-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={active ? "#34d399" : BEAM_STROKE}
              strokeWidth={active ? 1.4 : BEAM_SW}
              strokeDasharray={style === "dashed" ? BEAM_DASH : undefined}
              strokeLinecap="square"
              pointerEvents="none"
            />,
          );
        });
      };
      pushFace(lo0, lo1, "lo");
      pushFace(hi0, hi1, "hi");

      beamNodes.push(
        <g key={`${beam.id}-s${seg.index}`}>
          <polygon
            points={points}
            fill={active ? "rgba(52,211,153,0.2)" : "transparent"}
            stroke="none"
            className={interactive && !insertBeamMode ? "cursor-pointer" : undefined}
            pointerEvents={interactive && !insertBeamMode ? "all" : "none"}
            onClick={(e) => {
              if (!interactive || insertBeamMode || !onSelect) return;
              e.stopPropagation();
              pick({ kind: "beam", beamId: beam.id, segIndex: seg.index }, e);
            }}
          />
          {faceLines}
          {active && (
            beam.direction === "Y" ? (
              <text
                x={labelX}
                y={labelY}
                fill="#6ee7b7"
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(-90 ${labelX} ${labelY})`}
                pointerEvents="none"
              >
                {planBeamDisplayName(project, beam.name)} · {seg.a0.name}-{seg.a1.name} · L={Math.round(seg.span)}
                {(s0 !== 0 || s1 !== 0) ? ` · Δ=${s0 === s1 ? s0 : `${s0}/${s1}`}` : ""}
              </text>
            ) : (
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                fill="#6ee7b7"
                fontSize="10"
                fontWeight="700"
                pointerEvents="none"
              >
                {planBeamDisplayName(project, beam.name)} · {seg.a0.name}-{seg.a1.name} · L={Math.round(seg.span)}
                {(s0 !== 0 || s1 !== 0) ? ` · Δ=${s0 === s1 ? s0 : `${s0}/${s1}`}` : ""}
              </text>
            )
          )}
        </g>,
      );
    }
  }

  const statusText = !interactive
    ? `${project.info.name} · ${project.beams.length} dầm · ${axesX.length - 1}×${axesY.length - 1} ô`
    : insertBeamMode
      ? "Đang chèn dầm — click ô sàn để thêm trục và tách ô độc lập (1 dầm → 2 ô; X+Y → 4 ô)."
      : !selection
      ? "Nhấp ô sàn, dầm hoặc số hiệu trục trên bản vẽ để chỉnh kích thước tại chỗ."
      : selection.kind === "bay"
        ? `Ô sàn: ${axesX[selection.ix]?.name ?? "?"}–${axesX[selection.ix + 1]?.name ?? "?"} / ${axesY[selection.iy]?.name ?? "?"}–${axesY[selection.iy + 1]?.name ?? "?"}`
        : selection.kind === "beam"
          ? (() => {
              const beam = project.beams.find((b) => b.id === selection.beamId);
              if (!beam) return `Đoạn dầm: ${selection.beamId}`;
              const label = planBeamDisplayName(project, beam.name);
              const seg = beamSegments(project, beam)[selection.segIndex];
              return seg
                ? `Đoạn dầm: ${label} · ${seg.a0.name}–${seg.a1.name}`
                : `Đoạn dầm: ${label}`;
            })()
          : `Trục ${selection.dir}: ${
              (selection.dir === "X" ? axesX : axesY).find((a) => a.id === selection.axisId)?.name ?? "?"
            }`;

  const zoom = Math.min(300, Math.max(50, zoomPct));
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [show3d]);

  const scale = zoom / 100;
  const canvasW = Math.max(1, Math.round(viewport.w * scale));
  const canvasH = Math.max(1, Math.round(viewport.h * scale));
  // Vùng cuộn ≥ viewport khi phóng to; khi thu nhỏ vẫn đủ chỗ căn giữa
  const scrollW = Math.max(viewport.w, canvasW);
  const scrollH = Math.max(viewport.h, canvasH);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-auto">
        <div
          className="box-border flex items-center justify-center p-1 sm:p-2"
          style={{
            width: scrollW || "100%",
            height: scrollH || "100%",
            minWidth: "100%",
            minHeight: "100%",
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={viewport.w ? canvasW : "100%"}
            height={viewport.h ? canvasH : "100%"}
            className="block shrink-0"
            preserveAspectRatio="xMidYMid meet"
            onClick={() => {
              if (interactive && onSelect) pick(null);
            }}
          >
            <rect
              x={X(0)}
              y={Y(project.planHeight)}
              width={project.planWidth * s}
              height={project.planHeight * s}
              fill="#111113"
              stroke="#79b8ff"
              strokeWidth="1.5"
              pointerEvents="none"
            />
            {bayNodes}
            {lowSlabNodes}
            {openingNodes}
            {axesX.map((ax) => {
              const active = selection?.kind === "axis" && selection.dir === "X" && selection.axisId === ax.id;
              const cx = X(ax.pos);
              const edgeY = Y(outerBottom);
              const cy = edgeY + AXIS_BUBBLE_OFFSET;
              const stroke = active ? "#79b8ff" : "#52525b";
              const sw = active ? 1.2 : 0.6;
              const interior = axisInteriorSegmentsX(project, axesX, axesY, ax.pos);
              return (
                <g key={`ax-${ax.id}`}>
                  {/* Tim trục: gạch–chấm liên tục trong lòng ô */}
                  {interior.map((span, i) => (
                    <line
                      key={`ax-span-${ax.id}-${i}`}
                      x1={cx}
                      y1={Y(span.hi)}
                      x2={cx}
                      y2={Y(span.lo)}
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeDasharray="7 2 1.5 2"
                      pointerEvents="none"
                    />
                  ))}
                  {/* Đường dẫn nét mảnh gạch đứt: mép vòng → da sàn ngoài */}
                  <line
                    x1={cx}
                    y1={cy - AXIS_BUBBLE_R}
                    x2={cx}
                    y2={edgeY}
                    stroke="#79b8ff"
                    strokeWidth={0.65}
                    strokeDasharray="2 1.75"
                    opacity={0.9}
                    pointerEvents="none"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={AXIS_BUBBLE_R}
                    fill={active ? "#1e3a5f" : "#0d1117"}
                    stroke="#79b8ff"
                    strokeWidth={active ? 1.5 : 0.95}
                    className={interactive ? "cursor-pointer" : undefined}
                    pointerEvents={interactive ? "all" : "none"}
                    onClick={(e) => {
                      if (!interactive || !onSelect) return;
                      e.stopPropagation();
                      pick({ kind: "axis", dir: "X", axisId: ax.id }, e);
                    }}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#79b8ff"
                    fontSize="8"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {ax.name}
                  </text>
                </g>
              );
            })}
            {axesY.map((ay) => {
              const active = selection?.kind === "axis" && selection.dir === "Y" && selection.axisId === ay.id;
              const edgeX = X(outerLeft);
              const cx = edgeX - AXIS_BUBBLE_OFFSET;
              const cy = Y(ay.pos);
              const stroke = active ? "#fbbf24" : "#52525b";
              const sw = active ? 1.2 : 0.6;
              const interior = axisInteriorSegmentsY(project, axesX, axesY, ay.pos);
              return (
                <g key={`ay-${ay.id}`}>
                  {/* Tim trục: gạch–chấm liên tục trong lòng ô */}
                  {interior.map((span, i) => (
                    <line
                      key={`ay-span-${ay.id}-${i}`}
                      x1={X(span.lo)}
                      y1={cy}
                      x2={X(span.hi)}
                      y2={cy}
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeDasharray="7 2 1.5 2"
                      pointerEvents="none"
                    />
                  ))}
                  {/* Đường dẫn nét mảnh gạch đứt: mép vòng → da sàn ngoài */}
                  <line
                    x1={cx + AXIS_BUBBLE_R}
                    y1={cy}
                    x2={edgeX}
                    y2={cy}
                    stroke="#fbbf24"
                    strokeWidth={0.65}
                    strokeDasharray="2 1.75"
                    opacity={0.9}
                    pointerEvents="none"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={AXIS_BUBBLE_R}
                    fill={active ? "#5b3b0a" : "#0d1117"}
                    stroke="#fbbf24"
                    strokeWidth={active ? 1.5 : 0.95}
                    className={interactive ? "cursor-pointer" : undefined}
                    pointerEvents={interactive ? "all" : "none"}
                    onClick={(e) => {
                      if (!interactive || !onSelect) return;
                      e.stopPropagation();
                      pick({ kind: "axis", dir: "Y", axisId: ay.id }, e);
                    }}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fbbf24"
                    fontSize="8"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {ay.name}
                  </text>
                </g>
              );
            })}
            {beamNodes}
            {(() => {
              const bars = stripRebarBarSegments(project, axesX, axesY);
              /** Chỉ vẽ 1 cây điển hình / dải thanh giống nhau kề nhau. */
              const drawBars = typicalRebarBars(project, bars, zones);
              const stroke = "#ef4444";
              const pressMarks = stripRebarPressMarks(project, axesX, axesY);
              const tick = 70;
              return (
                <>
                  {drawBars.map((bar, i) => {
                    const { left: leftHook, right: rightHook } = hooksForRebarBar(project, bar, zones);
                    const hooks = rebarHookSegments(
                      bar,
                      leftHook,
                      rightHook,
                      project.planWidth,
                      project.planHeight,
                    );
                    if (bar.dir === "X") {
                      return (
                        <g key={`rebar-x-${i}`} pointerEvents="none">
                          <line
                            x1={X(bar.x0)}
                            y1={Y(bar.y)}
                            x2={X(bar.x1)}
                            y2={Y(bar.y)}
                            stroke={stroke}
                            strokeWidth="1.6"
                            strokeLinecap="butt"
                            opacity="0.95"
                          />
                          {hooks.map((h, hi) => (
                            <line
                              key={`hx-${i}-${hi}`}
                              x1={X(h.x1)}
                              y1={Y(h.y1)}
                              x2={X(h.x2)}
                              y2={Y(h.y2)}
                              stroke={stroke}
                              strokeWidth="1.6"
                              strokeLinecap="butt"
                              opacity="0.95"
                            />
                          ))}
                        </g>
                      );
                    }
                    return (
                      <g key={`rebar-y-${i}`} pointerEvents="none">
                        <line
                          x1={X(bar.x)}
                          y1={Y(bar.y0)}
                          x2={X(bar.x)}
                          y2={Y(bar.y1)}
                          stroke={stroke}
                          strokeWidth="1.6"
                          strokeLinecap="butt"
                          opacity="0.95"
                        />
                        {hooks.map((h, hi) => (
                          <line
                            key={`hy-${i}-${hi}`}
                            x1={X(h.x1)}
                            y1={Y(h.y1)}
                            x2={X(h.x2)}
                            y2={Y(h.y2)}
                            stroke={stroke}
                            strokeWidth="1.6"
                            strokeLinecap="butt"
                            opacity="0.95"
                          />
                        ))}
                      </g>
                    );
                  })}
                  {pressMarks.map((m, i) => (
                    <g key={`press-${i}`} pointerEvents="none">
                      {/* Ký hiệu nhấn tại thân dầm: tick ⊥ thanh + ghi độ nhấn */}
                      {m.dir === "X" ? (
                        <>
                          <line
                            x1={X(m.x)}
                            y1={Y(m.y - tick)}
                            x2={X(m.x)}
                            y2={Y(m.y + tick)}
                            stroke="#f59e0b"
                            strokeWidth="1.4"
                            opacity="0.95"
                          />
                          <line
                            x1={X(m.x - tick * 0.35)}
                            y1={Y(m.y + tick * 0.55)}
                            x2={X(m.x)}
                            y2={Y(m.y + tick)}
                            stroke="#f59e0b"
                            strokeWidth="1.4"
                          />
                          <line
                            x1={X(m.x + tick * 0.35)}
                            y1={Y(m.y + tick * 0.55)}
                            x2={X(m.x)}
                            y2={Y(m.y + tick)}
                            stroke="#f59e0b"
                            strokeWidth="1.4"
                          />
                        </>
                      ) : (
                        <>
                          <line
                            x1={X(m.x - tick)}
                            y1={Y(m.y)}
                            x2={X(m.x + tick)}
                            y2={Y(m.y)}
                            stroke="#f59e0b"
                            strokeWidth="1.4"
                            opacity="0.95"
                          />
                          <line
                            x1={X(m.x + tick * 0.55)}
                            y1={Y(m.y - tick * 0.35)}
                            x2={X(m.x + tick)}
                            y2={Y(m.y)}
                            stroke="#f59e0b"
                            strokeWidth="1.4"
                          />
                          <line
                            x1={X(m.x + tick * 0.55)}
                            y1={Y(m.y + tick * 0.35)}
                            x2={X(m.x + tick)}
                            y2={Y(m.y)}
                            stroke="#f59e0b"
                            strokeWidth="1.4"
                          />
                        </>
                      )}
                      <text
                        x={X(m.x) + (m.dir === "X" ? 6 : 8)}
                        y={Y(m.y) + (m.dir === "X" ? -6 : 3)}
                        fill="#fbbf24"
                        fontSize="9"
                        fontWeight="600"
                      >
                        ↓{m.drop}
                      </text>
                    </g>
                  ))}
                  {/* Khoảng rải: ô kề nhau cùng số hiệu → 1 đường liên tục */}
                  {project.info.showDistRange !== false &&
                    zones.some((z) => z.showSpacing) &&
                    (() => {
                      const markKeyOf = (bar: (typeof bars)[number]) => {
                        const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
                        const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
                        const hits = zones.filter((z) => {
                          if (z.direction !== bar.dir) return false;
                          const zx0 = Math.min(z.x1, z.x2);
                          const zx1 = Math.max(z.x1, z.x2);
                          const zy0 = Math.min(z.y1, z.y2);
                          const zy1 = Math.max(z.y1, z.y2);
                          return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
                        });
                        const z = hits.find((h) => h.layer === "bottom") ?? hits[0];
                        if (z) return `${z.mark}|${z.dia}|${z.spacing}|${z.direction}`;
                        return `${bar.dir}|10|150`;
                      };
                      const merged = buildMergedDistRanges(project, axesX, axesY, bars, markKeyOf);
                      const typicalSet = new Set(
                        drawBars.map((b) =>
                          b.dir === "X" ? `X:${Math.round(b.y)}` : `Y:${Math.round(b.x)}`,
                        ),
                      );
                      const ah = 7; // ×0.5
                      const aw = 3.5;
                      const capHalf = 5.5;
                      const capThick = 2.1;
                      const endCap = (tx: number, tyPt: number, fromX: number, fromY: number, key: string) => {
                        const ex = tx - fromX;
                        const ey = tyPt - fromY;
                        const el = Math.hypot(ex, ey) || 1;
                        const euX = ex / el;
                        const euY = ey / el;
                        const epX = -euY;
                        const epY = euX;
                        const bx = tx - euX * ah;
                        const by = tyPt - euY * ah;
                        // Gạch dày kéo vào trong — tip = mí dầm − 50mm, không đè mí
                        const ox = -euX * capThick;
                        const oy = -euY * capThick;
                        return (
                          <g key={key}>
                            <polygon
                              points={
                                `${tx - epX * capHalf},${tyPt - epY * capHalf} ` +
                                `${tx + epX * capHalf},${tyPt + epY * capHalf} ` +
                                `${tx + epX * capHalf + ox},${tyPt + epY * capHalf + oy} ` +
                                `${tx - epX * capHalf + ox},${tyPt - epY * capHalf + oy}`
                              }
                              fill="#2563eb"
                            />
                            <polygon
                              points={`${tx},${tyPt} ${bx + epX * aw},${by + epY * aw} ${bx - epX * aw},${by - epY * aw}`}
                              fill="#2563eb"
                            />
                          </g>
                        );
                      };
                      return merged.map((seg, si) => {
                        const sxA = X(seg.xA);
                        const syA = Y(seg.yA);
                        const sxB = X(seg.xB);
                        const syB = Y(seg.yB);
                        const midX = (sxA + sxB) / 2;
                        const midY = (syA + syB) / 2;
                        const alongY = Math.abs(seg.yB - seg.yA) >= Math.abs(seg.xB - seg.xA);
                        const dx = sxB - sxA;
                        const dy = syB - syA;
                        const plen = Math.hypot(dx, dy) || 1;
                        const ux = dx / plen;
                        const uy = dy / plen;
                        const inset = Math.min(ah, plen * 0.35);
                        const jr = 3.2;
                        const jd = jr * 0.72;
                        // Chỉ chấm tại cây điển hình (không chấm thanh đã ẩn)
                        const junctions = seg.junctions.filter((j) =>
                          seg.dir === "X"
                            ? typicalSet.has(`X:${Math.round(j.y)}`)
                            : typicalSet.has(`Y:${Math.round(j.x)}`),
                        );
                        return (
                          <g key={`dist-${si}`} pointerEvents="none">
                            <line
                              x1={sxA + ux * inset}
                              y1={syA + uy * inset}
                              x2={sxB - ux * inset}
                              y2={syB - uy * inset}
                              stroke="#2563eb"
                              strokeWidth="1.0"
                            />
                            {endCap(sxA, syA, sxB, syB, `a-${si}`)}
                            {endCap(sxB, syB, sxA, syA, `b-${si}`)}
                            {junctions.map((j, ji) => (
                              <g key={`j-${si}-${ji}`}>
                                {/* Chấm hình 2: vòng trắng + kim cương tại giao khoảng rải ∩ thép sàn */}
                                <circle
                                  cx={X(j.x)}
                                  cy={Y(j.y)}
                                  r={jr}
                                  fill="none"
                                  stroke="#ffffff"
                                  strokeWidth="1.5"
                                />
                                <polygon
                                  points={`${X(j.x)},${Y(j.y) - jd} ${X(j.x) + jd},${Y(j.y)} ${X(j.x)},${Y(j.y) + jd} ${X(j.x) - jd},${Y(j.y)}`}
                                  fill="#ffffff"
                                />
                              </g>
                            ))}
                            <text
                              x={midX + (alongY ? 7 : 0)}
                              y={midY + (alongY ? 0 : -7)}
                              fill="#2563eb"
                              fontSize="9"
                              fontWeight="600"
                              textAnchor={alongY ? "start" : "middle"}
                            >
                              {Math.round(seg.lenMm)}
                            </text>
                          </g>
                        );
                      });
                    })()}
                </>
              );
            })()}
            <text x={W / 2} y={18} textAnchor="middle" fill="#79b8ff" fontSize="13" fontWeight="700">
              {project.info.name} · {Math.round(project.planWidth)}×{Math.round(project.planHeight)} ×{" "}
              {project.info.thickness}mm
            </text>
          </svg>
        </div>

        {interactive && selection && editPanel && anchor && (
          <div
            className="pointer-events-auto absolute z-30 w-[220px] -translate-x-1/2 rounded-lg border border-sky-500/50 bg-zinc-950/95 p-2.5 shadow-xl shadow-black/50 backdrop-blur-sm"
            style={{ left: `${anchor.leftPct}%`, top: `${anchor.topPct}%` }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {editPanel}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-500">{statusText}</div>
    </div>
  );
}
