// The waiter's tray in the avatar's hands (ART-1, replaces the COD-1 placeholder): a round steel tray seen from the front at a slight angle (a flat
// ellipse with a rim and a highlight, round whatever the facing), a hand under it (skin and a short sleeve) so the arm reads as held OUT, and up to
// TRAY_MAX mugs standing on it with a small shadow each. Endesga 32 colours. Bottom middle at (0, 0) = the hand, like every held thing
// (AvatarSprite.setHeld). Facing-free: the avatar sprite shifts the hand a few px sideways for left and right.

import { Container, Graphics } from 'pixi.js';
import { TRAY_MAX, type MaterialId } from '@pixel-hotel/shared';
import { drawGood } from './slotGoods.ts';

import { TRAY_MUG_GAP, TRAY_MUG_SCALE } from "./markerSize.ts";
const MUG_SCALE = TRAY_MUG_SCALE;
const MUG_GAP = TRAY_MUG_GAP;
// Endesga 32 (shared/palette.ts holds the list): outline, steel ramp, skin, sleeve.
const OUTLINE = 0x3e2731;
const STEEL_DARK = 0x5a6988;
const STEEL = 0x8b9bb4;
const STEEL_LIGHT = 0xc0cbdc;
const SKIN = 0xe4a672;
const SKIN_DARK = 0xb86f50;
const SLEEVE = 0x733e39;

/** A tray with these mugs on it (first mug on the left). Empty list = null (nothing is held). */
export function drawTray(mugs: readonly MaterialId[]): Container | null {
  if (mugs.length === 0) return null;
  const root = new Container();
  const n = Math.min(mugs.length, TRAY_MAX);
  const half = Math.max(8, Math.round((n * MUG_GAP + 6) / 2)); // half the tray width
  const g = new Graphics();
  // The arm held out: a sleeve stub and the hand, under the tray's middle.
  g.rect(-2, 0, 5, 4).fill(SLEEVE).stroke({ width: 0 });
  g.rect(-2, -2, 5, 3).fill(SKIN);
  g.rect(-2, -1, 5, 1).fill(SKIN_DARK);
  g.rect(-3, -2, 1, 6).fill(OUTLINE);
  g.rect(3, -2, 1, 6).fill(OUTLINE);
  // The tray: dark rim underneath (thickness), the steel top, a light edge top-left (light from the top left).
  g.ellipse(0, -2, half + 1, 4).fill(OUTLINE);
  g.ellipse(0, -3, half, 3).fill(STEEL_DARK);
  g.ellipse(0, -4, half - 1, 2).fill(STEEL);
  g.rect(-half + 3, -5, Math.max(2, Math.floor(half / 2)), 1).fill(STEEL_LIGHT);
  root.addChild(g);
  for (let k = 0; k < n; k++) {
    const x = Math.round((k - (n - 1) / 2) * MUG_GAP);
    const shadow = new Graphics();
    shadow.ellipse(x, -4, 4, 1).fill({ color: OUTLINE, alpha: 0.45 });
    root.addChild(shadow);
    const mug = drawGood({ kind: 'material', id: mugs[k]!, qty: 1 });
    mug.scale.set(MUG_SCALE);
    mug.position.set(x, -4);
    root.addChild(mug);
  }
  return root;
}
