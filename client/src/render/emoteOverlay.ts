// The small symbols above an emoting avatar (step 9g-1): 'zzz' (sleep) and 'note' (laugh, dance), drawn from boxes with the
// 1 px dark warm outline like the avatar. Origin = the avatar's feet; the symbol floats above the head. Rendering only.

import { Graphics } from 'pixi.js';
import { PALETTE } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import type { EmotePose } from './emoteAnim.ts';
import type { Part } from './avatarParts.ts';

const CREAM = PALETTE[19] ?? '#fff';
const GOLD = PALETTE[10] ?? '#fc0';

/** A Z of `s` px (s >= 4): top bar, diagonal, bottom bar. */
function zBoxes(x: number, y: number, s: number, c: string): Part[] {
  const out: Part[] = [[x, y, s, 1, c], [x, y + s - 1, s, 1, c]];
  for (let i = 0; i < s - 2; i++) out.push([x + s - 2 - i, y + 1 + i, 1, 1, c]);
  return out;
}

/** The boxes of an overlay; `tMs` makes the zzz rise by steps. */
export function overlayBoxes(kind: NonNullable<EmotePose['overlay']>, tMs: number): Part[] {
  const step = Math.floor((((tMs % 1200) + 1200) % 1200) / 400); // 0..2
  if (kind === 'zzz') return [...zBoxes(8, -74 - step, 4, CREAM), ...zBoxes(13, -80 - step, 5, CREAM)];
  if (kind === 'note') {
    const y = -78 - (step === 1 ? 1 : 0);
    return [[10, y, 2, 6, GOLD], [8, y + 5, 3, 3, GOLD], [12, y, 3, 2, GOLD]];
  }
  return [[10, -76, 3, 3, PALETTE[8] ?? '#e43']]; // 'heart': a plain box until it has art
}

export function drawOverlay(g: Graphics, kind: NonNullable<EmotePose['overlay']> | null, tMs: number): void {
  g.clear();
  if (!kind) return;
  const ps = overlayBoxes(kind, tMs);
  for (const [x, y, w, h] of ps) g.rect(x - 1, y - 1, w + 2, h + 2).fill(DARK_WARM);
  for (const [x, y, w, h, c] of ps) g.rect(x, y, w, h).fill(c);
}
