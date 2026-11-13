// Placeholder furniture art from boxes (brief section 7). The boxes in furniture.json describe
// the 'down' facing; 'right' and 'up' are the same boxes turned on the floor, and 'left' is
// 'right' mirrored. Each box is a front face (w by h, darker) with a top face (w by d,
// lighter) above it, with a 1 px dark warm outline around the whole item.

import { Graphics } from 'pixi.js';
import { PALETTE, type ArtBox, type Facing, type FurnitureType } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { shade } from './colors.ts';

/** How much darker a box's front face is than its top face. */
const FRONT_SHADE = 0.72;

export function artBoxes(type: FurnitureType): ArtBox[] {
  return 'boxes' in type.art ? type.art.boxes : [];
}

/** One box turned from 'down' to 'right' (a quarter turn on the floor around the footprint center). */
function turnRight(b: ArtBox, type: FurnitureType): ArtBox {
  return { ...b, dx: b.dy - b.d + type.d / 2, w: b.d, dy: -b.dx - type.w / 2, d: b.w };
}

/** One box turned from 'down' to 'up' (half a turn). */
function turnUp(b: ArtBox, type: FurnitureType): ArtBox {
  return { ...b, dx: -b.dx - b.w, dy: -type.d - b.dy + b.d };
}

/**
 * The boxes to draw for a facing, in draw order (lowest first, then back to front), and
 * whether the drawing is mirrored (left = right mirrored).
 */
export function boxesForFacing(type: FurnitureType, facing: Facing): { boxes: ArtBox[]; mirror: boolean } {
  const base = artBoxes(type);
  const turned =
    facing === 'up' ? base.map((b) => turnUp(b, type)) : facing === 'down' ? base : base.map((b) => turnRight(b, type));
  const order = turned.map((b, i) => ({ b, i }));
  order.sort((p, q) => p.b.z - q.b.z || p.b.dy - p.b.d - (q.b.dy - q.b.d) || p.b.dy - q.b.dy || p.i - q.i);
  return { boxes: order.map((o) => o.b), mirror: facing === 'left' };
}

/** Height of the top that items on this surface stand on, in px. */
export function surfaceHeight(type: FurnitureType): number {
  return Math.max(0, ...artBoxes(type).map((b) => b.z + b.h));
}

/** One flat rectangle of an item drawing: x, y, w, h relative to the anchor, and a hex color. */
export type ArtRect = [x: number, y: number, w: number, h: number, color: string];

/**
 * The rectangles that draw an item facing this way (before mirroring), in draw order: the dark
 * outline of every box first, then each box's top face and front face. Used for the room
 * sprites and the small inventory icons.
 */
export function furnitureRects(type: FurnitureType, facing: Facing): ArtRect[] {
  const { boxes } = boxesForFacing(type, facing);
  const out: ArtRect[] = [];
  for (const b of boxes) {
    const [x, y, w, h] = [b.dx, b.dy - b.z - b.h - b.d, b.w, b.h + b.d];
    if (w > 0 && h > 0) out.push([x - 1, y - 1, w + 2, h + 2, DARK_WARM]);
  }
  for (const b of boxes) {
    const color = PALETTE[b.color] ?? PALETTE[0];
    if (b.w <= 0) continue;
    if (b.d > 0) out.push([b.dx, b.dy - b.z - b.h - b.d, b.w, b.d, color]);
    if (b.h > 0) out.push([b.dx, b.dy - b.z - b.h, b.w, b.h, shade(color, FRONT_SHADE)]);
  }
  return out;
}

/** Draws the item with the anchor at (0, 0). Mirror it with scale.x = -1 for 'left'. */
export function drawFurniture(type: FurnitureType, facing: Facing): Graphics {
  const g = new Graphics();
  for (const [x, y, w, h, c] of furnitureRects(type, facing)) g.rect(x, y, w, h).fill(c);
  return g;
}
