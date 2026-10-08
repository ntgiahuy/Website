import type { PileCapInputs } from './types'
import { DEFAULT_PILE_CAP } from './calc'

/** Mẫu đài 3 cọc lục giác — α=3, ∅400 (s=1200). */
export const SAMPLE_HEX3: PileCapInputs = {
  ...DEFAULT_PILE_CAP,
  pileCount: 3,
  pileDia: 400,
  alpha: 3,
  edgeClear: 150,
  hCap: 900,
  xCol: 400,
  yCol: 500,
  dFaX: 16,
  aFaX: 150,
  dFaY: 16,
  aFaY: 150,
  hooked: true,
  hookLeft: 100,
  hookRight: 100,
  name: 'MC-3C',
  qty: 4,
}

/** Mẫu đài 4 cọc vuông (tham chiếu). */
export const SAMPLE_RECT4: PileCapInputs = {
  ...DEFAULT_PILE_CAP,
  pileCount: 4,
  pileDia: 400,
  alpha: 3,
  name: 'MC-4C',
  hooked: false,
}
