import type { PileCapInputs } from './types'
import { DEFAULT_PILE_CAP } from './calc'

const base = (): PileCapInputs => ({ ...DEFAULT_PILE_CAP })

/** Hình 1 — 2 cọc chữ nhật. */
export const SAMPLE_2: PileCapInputs = {
  ...base(),
  pileCount: 2,
  pileDia: 400,
  alpha: 3,
  alphaX: 3,
  alphaY: 3,
  name: 'MC-2C',
  dFaX: 16,
  aFaX: 150,
  dFaY: 14,
  aFaY: 200,
  hookedBottom: true,
  hookBottomLeft: 100,
  hookBottomRight: 100,
  hookedTop: true,
  hookTopLeft: 120,
  hookTopRight: 120,
  minClearLen: 0,
}

/** Hình 2 — 3 cọc lục giác (thép biến thiên). */
export const SAMPLE_HEX3: PileCapInputs = {
  ...base(),
  pileCount: 3,
  pileDia: 400,
  alpha: 3,
  alphaX: 3,
  alphaY: 3,
  hCap: 900,
  xCol: 400,
  yCol: 500,
  dFaX: 16,
  aFaX: 150,
  dFaY: 16,
  aFaY: 150,
  hookedBottom: true,
  hookBottomLeft: 100,
  hookBottomRight: 100,
  hookedTop: true,
  hookTopLeft: 150,
  hookTopRight: 150,
  minClearLen: 200,
  name: 'MC-3C',
  qty: 4,
}

/** Hình 3 — 4 cọc vuông. */
export const SAMPLE_4_SQUARE: PileCapInputs = {
  ...base(),
  pileCount: 4,
  pileDia: 400,
  alpha: 3,
  alphaX: 3,
  alphaY: 3,
  name: 'MC-4C',
  hookedBottom: true,
  hookBottomLeft: 100,
  hookBottomRight: 100,
  hookedTop: false,
  hookTopLeft: 0,
  hookTopRight: 0,
  minClearLen: 0,
}

/** Hình 3b — 4 cọc chữ nhật (αX ≠ αY). */
export const SAMPLE_4_RECT: PileCapInputs = {
  ...SAMPLE_4_SQUARE,
  alphaX: 3,
  alphaY: 2.5,
  name: 'MC-4C-CN',
  dFaX: 18,
  aFaX: 150,
  dFaY: 16,
  aFaY: 180,
}

/** Hình 4 — 5 cọc vuông. */
export const SAMPLE_5: PileCapInputs = {
  ...base(),
  pileCount: 5,
  pileDia: 400,
  alpha: 3,
  alphaX: 3,
  alphaY: 3,
  name: 'MC-5C',
  dFaX: 16,
  aFaX: 150,
  dFaY: 16,
  aFaY: 150,
  hookedBottom: true,
  hookBottomLeft: 100,
  hookBottomRight: 100,
  hookedTop: true,
  hookTopLeft: 80,
  hookTopRight: 80,
  minClearLen: 0,
}

export const ALL_SAMPLES: PileCapInputs[] = [
  SAMPLE_2,
  SAMPLE_HEX3,
  SAMPLE_4_SQUARE,
  SAMPLE_4_RECT,
  SAMPLE_5,
]
