"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { effectiveZones, parseBeamSize } from "@/lib/calc";
import {
  axisInteriorSegmentsX,
  axisInteriorSegmentsY,
  baySlabExtent,
  beamDrawRange,
  beamSegments,
  planBeamBleed,
  rectDiagonalHatchSegments,
  rectOpeningDiagonals,
  sortAxes,
  stripRebarBarSegments,
  SLAB_REBAR_HOOK_MM,
} from "@/lib/grid";
import type { PlanSelection, SlabProject } from "@/lib/types";

type Anchor = { leftPct: number; topPct: number };

/** Bán kính vòng số hiệu trục (px SVG). */
const AXIS_BUBBLE_R = 11;
/** Khoảng hở giữa da dầm ngoài và vòng số hiệu. */
const AXIS_BUBBLE_GAP = 28;
/** Tâm vòng số hiệu cách da dầm ngoài. */
const AXIS_BUBBLE_OFFSET = AXIS_BUBBLE_R + AXIS_BUBBLE_GAP;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function SlabPreview({
  project,
  show3d,
  selection = null,
  onSelect,
  interactive = false,
  editPanel = null,
}: {
  project: SlabProject;
  show3d?: boolean;
  selection?: PlanSelection | null;
  onSelect?: (sel: PlanSelection | null) => void;
  /** Cho phép nhấp chọn ô sàn / đoạn dầm / số hiệu trục trên bản vẽ. */
  interactive?: boolean;
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
  const pad = Math.max(72, AXIS_BUBBLE_OFFSET + AXIS_BUBBLE_R + 16 + bleedMm * 0.04);
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
    onSelect?.(sel);
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
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-zinc-950 p-4">
        <svg viewBox="0 0 640 360" className="h-full w-full">
          <defs>
            <linearGradient id="slabFace" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f3f46" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
          </defs>
          <polygon
            points="120,220 420,160 560,210 260,280"
            fill="url(#slabFace)"
            stroke="#79b8ff"
            strokeWidth="1.5"
          />
          <polygon points="120,220 260,280 260,300 120,240" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <polygon points="260,280 560,210 560,230 260,300" fill="#09090b" stroke="#52525b" strokeWidth="1" />
          {zones.slice(0, 4).map((z, i) => {
            const y = 175 + i * 8;
            return (
              <line
                key={z.id}
                x1={160 + i * 12}
                y1={y}
                x2={480 - i * 8}
                y2={y - 28}
                stroke={z.layer === "top" ? "#fbbf24" : "#34d399"}
                strokeWidth="1.2"
              />
            );
          })}
          <text x="320" y="330" textAnchor="middle" fill="#a1a1aa" fontSize="12">
            Mô hình 3D sàn {project.info.name} — {project.info.thickness} mm
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
            className={interactive ? "cursor-pointer" : undefined}
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
  for (const beam of project.beams ?? []) {
    const { b: bw } = parseBeamSize(beam.size);
    const b1 = Number.isFinite(beam.offset) ? (beam.offset as number) : bw / 2;
    const segs = beamSegments(project, beam);
    const full = beamDrawRange(project, beam);

    // Thân dầm liên tục (không tô cả thanh khi chọn — chỉ tô đoạn)
    if (beam.direction === "Y") {
      beamNodes.push(
        <g key={`${beam.id}-body`}>
          <rect
            x={X(beam.axis) - b1 * s}
            y={Y(full.hi)}
            width={bw * s}
            height={(full.hi - full.lo) * s}
            fill="#27272a"
            stroke="#a1a1aa"
            strokeWidth={1}
            pointerEvents="none"
          />
        </g>,
      );
    } else {
      beamNodes.push(
        <g key={`${beam.id}-body`}>
          <rect
            x={X(full.lo)}
            y={Y(beam.axis + (bw - b1))}
            width={(full.hi - full.lo) * s}
            height={bw * s}
            fill="#27272a"
            stroke="#a1a1aa"
            strokeWidth={1}
            pointerEvents="none"
          />
        </g>,
      );
    }

    for (const seg of segs) {
      const active =
        selection?.kind === "beam" && selection.beamId === beam.id && selection.segIndex === seg.index;
      const lo = seg.lo;
      const hi = seg.hi;
      if (beam.direction === "Y") {
        beamNodes.push(
          <g key={`${beam.id}-s${seg.index}`}>
            <rect
              x={X(beam.axis) - Math.max(b1, bw / 2) * s - 10}
              y={Y(hi)}
              width={Math.max(bw * s, 18) + 20}
              height={(hi - lo) * s}
              fill="transparent"
              className={interactive ? "cursor-pointer" : undefined}
              pointerEvents={interactive ? "all" : "none"}
              onClick={(e) => {
                if (!interactive || !onSelect) return;
                e.stopPropagation();
                pick({ kind: "beam", beamId: beam.id, segIndex: seg.index }, e);
              }}
            />
            {active && (
              <>
                <rect
                  x={X(beam.axis) - b1 * s}
                  y={Y(hi)}
                  width={bw * s}
                  height={(hi - lo) * s}
                  fill="rgba(52,211,153,0.45)"
                  stroke="#34d399"
                  strokeWidth={2}
                  pointerEvents="none"
                />
                {(() => {
                  const tx = X(beam.axis) + (bw - b1) * s + 10;
                  const ty = Y((lo + hi) / 2);
                  return (
                    <text
                      x={tx}
                      y={ty}
                      fill="#6ee7b7"
                      fontSize="10"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(-90 ${tx} ${ty})`}
                      pointerEvents="none"
                    >
                      {beam.name} · {seg.a0.name}-{seg.a1.name} · L={Math.round(seg.span)}
                    </text>
                  );
                })()}
              </>
            )}
          </g>,
        );
      } else {
        beamNodes.push(
          <g key={`${beam.id}-s${seg.index}`}>
            <rect
              x={X(lo)}
              y={Y(beam.axis + (bw - b1)) - 10}
              width={(hi - lo) * s}
              height={Math.max(bw * s, 18) + 20}
              fill="transparent"
              className={interactive ? "cursor-pointer" : undefined}
              pointerEvents={interactive ? "all" : "none"}
              onClick={(e) => {
                if (!interactive || !onSelect) return;
                e.stopPropagation();
                pick({ kind: "beam", beamId: beam.id, segIndex: seg.index }, e);
              }}
            />
            {active && (
              <>
                <rect
                  x={X(lo)}
                  y={Y(beam.axis + (bw - b1))}
                  width={(hi - lo) * s}
                  height={bw * s}
                  fill="rgba(52,211,153,0.45)"
                  stroke="#34d399"
                  strokeWidth={2}
                  pointerEvents="none"
                />
                <text
                  x={X((lo + hi) / 2)}
                  y={Y(beam.axis + (bw - b1)) - 6}
                  textAnchor="middle"
                  fill="#6ee7b7"
                  fontSize="10"
                  fontWeight="700"
                  pointerEvents="none"
                >
                  {beam.name} · {seg.a0.name}-{seg.a1.name} · L={Math.round(seg.span)}
                </text>
              </>
            )}
          </g>,
        );
      }
    }
  }

  const statusText = !interactive
    ? `${project.info.name} · ${project.beams.length} dầm · ${axesX.length - 1}×${axesY.length - 1} ô`
    : !selection
      ? "Nhấp ô sàn, dầm hoặc số hiệu trục trên bản vẽ để chỉnh kích thước tại chỗ."
      : selection.kind === "bay"
        ? `Ô sàn: ${axesX[selection.ix]?.name ?? "?"}–${axesX[selection.ix + 1]?.name ?? "?"} / ${axesY[selection.iy]?.name ?? "?"}–${axesY[selection.iy + 1]?.name ?? "?"}`
        : selection.kind === "beam"
          ? (() => {
              const beam = project.beams.find((b) => b.id === selection.beamId);
              if (!beam) return `Đoạn dầm: ${selection.beamId}`;
              const seg = beamSegments(project, beam)[selection.segIndex];
              return seg
                ? `Đoạn dầm: ${beam.name} · ${seg.a0.name}–${seg.a1.name}`
                : `Đoạn dầm: ${beam.name}`;
            })()
          : `Trục ${selection.dir}: ${
              (selection.dir === "X" ? axesX : axesY).find((a) => a.id === selection.axisId)?.name ?? "?"
            }`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <div className="flex h-full min-h-0 items-center justify-center p-1 sm:p-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-full w-full"
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
              const cy = Y(outerBottom) + AXIS_BUBBLE_OFFSET;
              const stroke = active ? "#79b8ff" : "#52525b";
              const sw = active ? 1.2 : 0.6;
              const interior = axisInteriorSegmentsX(project, axesX, axesY, ax.pos);
              return (
                <g key={`ax-${ax.id}`}>
                  {/* Tim chỉ trong lòng ô sàn — không vẽ xuyên / chạm thân dầm */}
                  {interior.map((span, i) => (
                    <line
                      key={`ax-span-${ax.id}-${i}`}
                      x1={cx}
                      y1={Y(span.hi)}
                      x2={cx}
                      y2={Y(span.lo)}
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeDasharray="3 3"
                      pointerEvents="none"
                    />
                  ))}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={AXIS_BUBBLE_R}
                    fill={active ? "#1e3a5f" : "#0d1117"}
                    stroke="#79b8ff"
                    strokeWidth={active ? 2 : 1.2}
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
                    y={cy + 4}
                    textAnchor="middle"
                    fill="#79b8ff"
                    fontSize="11"
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
              const cx = X(outerLeft) - AXIS_BUBBLE_OFFSET;
              const cy = Y(ay.pos);
              const stroke = active ? "#fbbf24" : "#52525b";
              const sw = active ? 1.2 : 0.6;
              const interior = axisInteriorSegmentsY(project, axesX, axesY, ay.pos);
              return (
                <g key={`ay-${ay.id}`}>
                  {/* Tim chỉ trong lòng ô sàn — không vẽ xuyên / chạm thân dầm */}
                  {interior.map((span, i) => (
                    <line
                      key={`ay-span-${ay.id}-${i}`}
                      x1={X(span.lo)}
                      y1={cy}
                      x2={X(span.hi)}
                      y2={cy}
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeDasharray="3 3"
                      pointerEvents="none"
                    />
                  ))}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={AXIS_BUBBLE_R}
                    fill={active ? "#5b3b0a" : "#0d1117"}
                    stroke="#fbbf24"
                    strokeWidth={active ? 2 : 1.2}
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
                    y={cy + 4}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize="11"
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
              const hook = SLAB_REBAR_HOOK_MM;
              const stroke = "#ef4444";
              return bars.map((bar, i) => {
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
                        opacity="0.95"
                      />
                      <line
                        x1={X(bar.x0)}
                        y1={Y(bar.y)}
                        x2={X(bar.x0)}
                        y2={Y(bar.y - hook)}
                        stroke={stroke}
                        strokeWidth="1.6"
                        opacity="0.95"
                      />
                      <line
                        x1={X(bar.x1)}
                        y1={Y(bar.y)}
                        x2={X(bar.x1)}
                        y2={Y(bar.y - hook)}
                        stroke={stroke}
                        strokeWidth="1.6"
                        opacity="0.95"
                      />
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
                      opacity="0.95"
                    />
                    <line
                      x1={X(bar.x)}
                      y1={Y(bar.y0)}
                      x2={X(bar.x + hook)}
                      y2={Y(bar.y0)}
                      stroke={stroke}
                      strokeWidth="1.6"
                      opacity="0.95"
                    />
                    <line
                      x1={X(bar.x)}
                      y1={Y(bar.y1)}
                      x2={X(bar.x + hook)}
                      y2={Y(bar.y1)}
                      stroke={stroke}
                      strokeWidth="1.6"
                      opacity="0.95"
                    />
                  </g>
                );
              });
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
