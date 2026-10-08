/**
 * SVG mặt bằng đài móng cọc — thép biến thiên X/Y.
 * Đồng bộ phong cách `ShopDrawing` / `Schematic` của app móng đơn.
 */

import type { PileCapCalcResult, PileCapInputs } from './types'
import { outlineToSvgPath } from './geometry'

export { renderPileCapSvg } from './svg'

const STEEL_X = '#c0392b'
const STEEL_Y = '#1f4e79'
const CONCRETE = '#5d6d7e'
const PILE = '#7f8c8d'
const COL = '#2c3e50'

export interface PileCapPreviewProps {
  inputs: PileCapInputs
  result: PileCapCalcResult
  /** Chiều rộng khung SVG (px). */
  width?: number
  height?: number
  showBarsX?: boolean
  showBarsY?: boolean
  showDims?: boolean
}

export function PileCapPreview({
  inputs,
  result,
  width = 640,
  height = 560,
  showBarsX = true,
  showBarsY = true,
  showDims = true,
}: PileCapPreviewProps) {
  const { geometry, barsX, barsY, errors } = result
  const pad = 80
  const box = geometry.bbox
  const scale = Math.min(
    (width - 2 * pad) / Math.max(box.width, 1),
    (height - 2 * pad) / Math.max(box.height, 1),
  )
  const tx = (x: number) => pad + (x - box.minX) * scale
  const ty = (y: number) => height - pad - (y - box.minY) * scale

  const pathD = outlineToSvgPath(
    geometry.outline.map((p) => ({ x: tx(p.x), y: ty(p.y) })),
  )

  const uniqX = new Set(barsX.map((b) => b.lengthKey)).size
  const uniqY = new Set(barsY.map((b) => b.lengthKey)).size

  return (
    <div className="pile-cap-preview">
      {errors.length > 0 && (
        <ul className="pile-cap-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Mặt bằng đài móng cọc ${inputs.name}`}
      >
        <rect x={0} y={0} width={width} height={height} fill="#fafafa" />
        <text x={pad} y={28} fontSize={14} fontWeight={700} fill="#222">
          {inputs.name} — đài {inputs.pileCount} cọc
          {inputs.pileCount === 3 ? ' (lục giác)' : ''} · ∅{inputs.pileDia} · α=
          {inputs.alpha}
        </text>
        <text x={pad} y={48} fontSize={11} fill="#555">
          Thép biến thiên: X {uniqX} cỡ dài · Y {uniqY} cỡ dài · cover {inputs.coverBase} mm
        </text>

        {/* Đài */}
        <path d={pathD} fill="rgba(93,109,126,0.08)" stroke={CONCRETE} strokeWidth={2} />

        {/* Cọc */}
        {geometry.piles.map((p, i) => (
          <g key={`pile-${i}`}>
            <circle
              cx={tx(p.x)}
              cy={ty(p.y)}
              r={(geometry.pileDia / 2) * scale}
              fill="none"
              stroke={PILE}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <circle cx={tx(p.x)} cy={ty(p.y)} r={2.5} fill={PILE} />
          </g>
        ))}

        {/* Cột */}
        <rect
          x={tx(geometry.columnCenter.x - geometry.xCol / 2)}
          y={ty(geometry.columnCenter.y + geometry.yCol / 2)}
          width={geometry.xCol * scale}
          height={geometry.yCol * scale}
          fill="none"
          stroke={COL}
          strokeWidth={2}
        />

        {/* Thép Y (dưới / nét xanh) */}
        {showBarsY &&
          barsY.map((b, i) => (
            <line
              key={`y-${i}`}
              x1={tx(b.station)}
              y1={ty(b.start)}
              x2={tx(b.station)}
              y2={ty(b.end)}
              stroke={STEEL_Y}
              strokeWidth={1.25}
              opacity={0.85}
            />
          ))}

        {/* Thép X (nét đỏ) */}
        {showBarsX &&
          barsX.map((b, i) => (
            <line
              key={`x-${i}`}
              x1={tx(b.start)}
              y1={ty(b.station)}
              x2={tx(b.end)}
              y2={ty(b.station)}
              stroke={STEEL_X}
              strokeWidth={1.25}
              opacity={0.9}
            />
          ))}

        {showDims && (
          <g fontSize={10} fill="#333">
            <text x={tx(box.minX)} y={ty(box.minY) + 18}>
              B={Math.round(box.width)}
            </text>
            <text x={tx(box.maxX) + 6} y={ty((box.minY + box.maxY) / 2)}>
              H={Math.round(box.height)}
            </text>
            <text x={tx(0) - 10} y={ty(0) + 4} fill="#888">
              +
            </text>
          </g>
        )}

        {/* Chú thích */}
        <g transform={`translate(${width - 170}, ${height - 70})`} fontSize={11}>
          <line x1={0} y1={0} x2={28} y2={0} stroke={STEEL_X} strokeWidth={2} />
          <text x={34} y={4} fill={STEEL_X}>
            FaX (biến thiên)
          </text>
          <line x1={0} y1={20} x2={28} y2={20} stroke={STEEL_Y} strokeWidth={2} />
          <text x={34} y={24} fill={STEEL_Y}>
            FaY (biến thiên)
          </text>
          <circle cx={10} cy={42} r={8} fill="none" stroke={PILE} strokeDasharray="4 3" />
          <text x={34} y={46} fill={PILE}>
            Cọc
          </text>
        </g>
      </svg>
    </div>
  )
}

