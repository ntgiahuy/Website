"use client";

import { useMemo, type ReactNode } from "react";
import { effectiveZones, parseBeamSize } from "@/lib/calc";
import type { SlabProject } from "@/lib/types";

export function SlabPreview({
  project,
  show3d,
}: {
  project: SlabProject;
  show3d?: boolean;
}) {
  const zones = useMemo(() => effectiveZones(project), [project]);
  const W = 640;
  const H = 420;
  const pad = 36;
  const sx = (W - pad * 2) / Math.max(project.planWidth, 1);
  const sy = (H - pad * 2) / Math.max(project.planHeight, 1);
  const s = Math.min(sx, sy);
  const ox = pad + (W - pad * 2 - project.planWidth * s) / 2;
  const oy = pad + (H - pad * 2 - project.planHeight * s) / 2;
  const X = (mm: number) => ox + mm * s;
  const Y = (mm: number) => oy + (project.planHeight - mm) * s;

  if (show3d) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-zinc-950 p-4">
        <svg viewBox="0 0 640 360" className="h-full w-full max-h-[340px]">
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
          <polygon
            points="120,220 260,280 260,300 120,240"
            fill="#18181b"
            stroke="#52525b"
            strokeWidth="1"
          />
          <polygon
            points="260,280 560,210 560,230 260,300"
            fill="#09090b"
            stroke="#52525b"
            strokeWidth="1"
          />
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

  return (
    <div className="flex h-full min-h-[280px] items-center justify-center bg-zinc-950 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full max-h-[400px]">
        <rect
          x={X(0)}
          y={Y(project.planHeight)}
          width={project.planWidth * s}
          height={project.planHeight * s}
          fill="#111113"
          stroke="#79b8ff"
          strokeWidth="1.5"
        />
        {project.beams.map((b) => {
          const { b: bw } = parseBeamSize(b.size);
          if (b.direction === "Y") {
            return (
              <rect
                key={b.id}
                x={X(b.axis) - (bw * s) / 2}
                y={Y(Math.max(b.start, b.end))}
                width={bw * s}
                height={Math.abs(b.end - b.start) * s}
                fill="#27272a"
                stroke="#a1a1aa"
                strokeWidth="1"
              />
            );
          }
          return (
            <rect
              key={b.id}
              x={X(Math.min(b.start, b.end))}
              y={Y(b.axis) - (bw * s) / 2}
              width={Math.abs(b.end - b.start) * s}
              height={bw * s}
              fill="#27272a"
              stroke="#a1a1aa"
              strokeWidth="1"
            />
          );
        })}
        {zones.map((z) => {
          const x1 = Math.min(z.x1, z.x2);
          const x2 = Math.max(z.x1, z.x2);
          const y1 = Math.min(z.y1, z.y2);
          const y2 = Math.max(z.y1, z.y2);
          const color =
            z.layer === "top" ? "#fbbf24" : z.layer === "structural" ? "#a78bfa" : "#34d399";
          const lines: ReactNode[] = [];
          const step = Math.max(z.spacing, 80);
          if (z.direction === "X") {
            for (let y = y1 + z.cover; y <= y2 - z.cover; y += step) {
              lines.push(
                <line
                  key={`${z.id}-y${y}`}
                  x1={X(x1 + z.cover)}
                  y1={Y(y)}
                  x2={X(x2 - z.cover)}
                  y2={Y(y)}
                  stroke={color}
                  strokeWidth="0.9"
                  opacity="0.85"
                />,
              );
            }
          } else {
            for (let x = x1 + z.cover; x <= x2 - z.cover; x += step) {
              lines.push(
                <line
                  key={`${z.id}-x${x}`}
                  x1={X(x)}
                  y1={Y(y1 + z.cover)}
                  x2={X(x)}
                  y2={Y(y2 - z.cover)}
                  stroke={color}
                  strokeWidth="0.9"
                  opacity="0.85"
                />,
              );
            }
          }
          return (
            <g key={z.id}>
              <rect
                x={X(x1)}
                y={Y(y2)}
                width={(x2 - x1) * s}
                height={(y2 - y1) * s}
                fill="none"
                stroke={color}
                strokeDasharray="4 3"
                strokeWidth="1"
              />
              {lines}
              <text
                x={X((x1 + x2) / 2)}
                y={Y((y1 + y2) / 2)}
                textAnchor="middle"
                fill={color}
                fontSize="11"
                fontWeight="700"
              >
                {z.mark}
              </text>
            </g>
          );
        })}
        <text x={W / 2} y={18} textAnchor="middle" fill="#79b8ff" fontSize="13" fontWeight="700">
          {project.info.name} · {Math.round(project.planWidth)}×{Math.round(project.planHeight)} ×{" "}
          {project.info.thickness}mm
        </text>
      </svg>
    </div>
  );
}
