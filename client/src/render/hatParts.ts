// Hats (step 9g-1, B2): 12 hats drawn in code as boxes on the head of the box avatar (avatarParts.ts); the avatar shape is not
// changed and the hats only sit on the head layer. Pure data first (hatBoxes), so the Avatar panel, the room sprite and the
// contact sheet share it. Boxes use the avatar's coordinates: origin = the FEET, y negative (the head spans y -60..-46, hair
// reaches -61, a mohawk -63). Draw them after the hair. `locked` = the grey silhouette shown for a hat the player does not own.
// Palette only (shared/palette.ts). Rendering only.

import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import type { Facing3, Part } from './avatarParts.ts';

export const HAT_IDS = [
  'straw_hat', 'wool_cap', 'cook_cap', 'feather_cap', 'tavern_keeper_hat', 'fisher_hat',
  'skull_cap', 'flower_crown', 'knight_helm', 'gold_crown', 'sunken_crown_hat', 'miner_lamp_cap',
] as const;
export type HatId = (typeof HAT_IDS)[number];

const c = (i: number): string => PALETTE[i] ?? PALETTE[0];
const LOCKED = PALETTE[22];

/** Head width and left edge by facing (front/back 14 px, side 12 px, matching the hair boxes). */
function frame(f: Facing3): { x0: number; w: number; side: boolean } {
  return f === 'right' ? { x0: -6, w: 12, side: true } : { x0: -7, w: 14, side: false };
}

function build(id: HatId, f: Facing3): Part[] {
  const { x0, w, side } = frame(f);
  const back = f === 'up';
  const cx = x0 + Math.floor(w / 2); // centre column
  const fr = x0 + w; // right edge
  switch (id) {
    case 'straw_hat':
      return [[x0 - 3, -58, w + 6, 2, c(3)], [x0 + 1, -65, w - 2, 8, c(3)], [x0 + 1, -61, w - 2, 1, c(8)], [x0 + 2, -64, 3, 2, c(2)]];
    case 'wool_cap':
      return [[x0, -64, w, 7, c(8)], [x0 + 2, -66, w - 4, 2, c(8)], [x0, -58, w, 2, c(29)], [cx - 1, -69, 3, 3, c(2)], [x0 + 2, -63, 2, 4, c(7)]];
    case 'cook_cap':
      return [[x0, -59, w, 3, c(19)], [x0 - 1, -68, w + 2, 9, c(19)], [x0 + 3, -67, 1, 7, c(20)], [cx + 1, -67, 1, 7, c(20)], [x0 - 1, -61, w + 2, 1, c(20)]];
    case 'feather_cap':
      return [[x0, -63, w, 6, c(13)], [x0 + 1, -65, w - 2, 2, c(12)], [x0 - 1, -58, w + 3, 2, c(13)],
        [fr - 4, -71, 2, 9, c(8)], [fr - 3, -73, 2, 4, c(29)], [fr - 5, -66, 1, 3, c(7)]];
    case 'tavern_keeper_hat':
      return [[x0 - 2, -58, w + 4, 2, c(5)], [x0 + 1, -66, w - 2, 9, c(5)], [x0 + 1, -61, w - 2, 2, c(10)], [x0 + 2, -65, 3, 2, c(4)], [cx - 1, -61, 3, 2, c(11)]];
    case 'fisher_hat':
      return [[x0 - 3, -58, w + 6, 2, c(17)], [x0 + 1, -64, w - 2, 7, c(16)], [x0 + 1, -61, w - 2, 1, c(2)], [x0 + 2, -63, 3, 2, c(17)],
        ...(back ? [] : [[x0 + 2, -57, 2, 3, c(19)] as Part, [x0 + 2, -54, 1, 1, c(20)] as Part])];
    case 'skull_cap':
      return [[x0, -64, w, 7, c(2)], [x0 + 1, -66, w - 2, 2, c(2)], [x0 + 1, -63, 2, 3, c(19)],
        ...(back ? [] : side ? [[fr - 5, -61, 2, 2, c(25)] as Part] : [[cx - 4, -61, 2, 2, c(25)] as Part, [cx + 2, -61, 2, 2, c(25)] as Part]),
        [x0, -58, w, 1, c(3)]];
    case 'flower_crown': {
      const out: Part[] = [[x0, -61, w, 2, c(13)], [x0 + 1, -61, w - 2, 1, c(12)]];
      const cols = [8, 11, 28, 19];
      for (let i = 0; i < 4; i++) {
        const x = x0 + 1 + i * Math.floor((w - 4) / 3);
        out.push([x, -64, 3, 3, c(cols[i]!)], [x + 1, -63, 1, 1, c(11)]);
      }
      return out;
    }
    case 'knight_helm':
      return [[x0 - 1, -66, w + 2, 11, c(20)], [x0, -66, w, 2, c(19)], [x0 - 1, -66, 2, 11, c(19)], [fr - 1, -64, 2, 9, c(21)],
        ...(back ? [] : [[x0 + (side ? 4 : 1), -58, w - (side ? 4 : 2), 2, c(25)] as Part, [cx - 1, -57, 1, 3, c(25)] as Part]),
        [cx - 1, -71, 3, 5, c(8)], [cx - 2, -69, 5, 2, c(7)]];
    case 'gold_crown':
      return [[x0, -61, w, 3, c(10)], [x0, -61, w, 1, c(11)],
        [x0, -65, 2, 4, c(10)], [cx - 1, -66, 3, 5, c(10)], [fr - 2, -65, 2, 4, c(10)],
        [x0, -65, 1, 1, c(11)], [cx - 1, -66, 1, 1, c(11)],
        ...(back ? [] : [[cx, -60, 2, 2, c(8)] as Part])];
    case 'sunken_crown_hat':
      return [[x0, -61, w, 3, c(16)], [x0, -61, w, 1, c(17)],
        [x0, -65, 2, 4, c(16)], [cx - 2, -67, 2, 6, c(17)], [cx + 1, -66, 2, 5, c(16)], [fr - 2, -64, 2, 3, c(17)],
        [x0 + 2, -63, 1, 3, c(13)], [fr - 4, -63, 1, 3, c(12)], [cx - 2, -68, 1, 1, c(18)],
        ...(back ? [] : [[cx - 1, -60, 2, 2, c(19)] as Part])];
    case 'miner_lamp_cap':
      return [[x0, -64, w, 7, c(9)], [x0 + 1, -65, w - 2, 2, c(10)], [x0 - 1, -58, w + 2, 2, c(1)],
        ...(back ? [] : side ? [[fr - 3, -65, 4, 4, c(22)] as Part, [fr, -64, 2, 2, c(11)] as Part] : [[cx - 2, -66, 5, 5, c(22)] as Part, [cx - 1, -65, 3, 3, c(11)] as Part])];
  }
}

/** The boxes of one hat for one facing; null for an unknown id. `locked` = one grey silhouette colour. */
export function hatBoxes(id: string, facing: Facing3, locked = false): Part[] | null {
  if (!(HAT_IDS as readonly string[]).includes(id)) return null;
  const ps = build(id as HatId, facing);
  return locked ? ps.map(([x, y, w, h]): Part => [x, y, w, h, LOCKED]) : ps;
}

/** A Container with the hat for `facing` (origin = the avatar's feet, same 1 px dark outline as the body), or null (no hat). */
export function hatPart(id: string, facing: Facing3 = 'down', locked = false): Container | null {
  const ps = hatBoxes(id, facing, locked);
  if (!ps) return null;
  const box = new Container();
  box.label = `hat:${id}`;
  const g = new Graphics();
  for (const [x, y, w, h] of ps) g.rect(x - 1, y - 1, w + 2, h + 2).fill(DARK_WARM);
  for (const [x, y, w, h, col] of ps) g.rect(x, y, w, h).fill(col);
  box.addChild(g);
  return box;
}
