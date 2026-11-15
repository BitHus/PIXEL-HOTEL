// Placeholder furniture art from boxes (brief section 7). The boxes in furniture.json describe
// the 'down' facing; 'right' and 'up' are the same boxes turned on the floor, and 'left' is
// 'right' mirrored. Each box is a front face (w by h, darker) with a top face (w by d,
// lighter) above it, with a 1 px dark warm outline around the whole item.

import { Graphics } from 'pixi.js';
import { PALETTE, paletteColor, type ArtBox, type Facing, type FurnitureType, type Rect } from '@pixel-hotel/shared';
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
 * The room art wears the colours of the item's icon (the picture in the bag and the catalog): the
 * first two box colours of the type become the icon's main and accent colour; others stay.
 */
function iconTint(type: FurnitureType): Map<number, string> {
  const map = new Map<number, string>();
  const order: number[] = [];
  for (const b of artBoxes(type)) if (!order.includes(b.color)) order.push(b.color);
  const [a, b] = type.icon.colors;
  if (order[0] !== undefined && a) map.set(order[0], paletteColor(a));
  if (order[1] !== undefined) map.set(order[1], paletteColor(b ?? a!));
  return map;
}

/**
 * The rectangles that draw an item facing this way (before mirroring), in draw order: the dark
 * outline of every box first, then each box's top face and front face. Used for the room
 * sprites and the small inventory icons.
 */
export function furnitureRects(type: FurnitureType, facing: Facing, role?: ArtBox['role'], outlines = true): ArtRect[] {
  const all = boxesForFacing(type, facing).boxes;
  const boxes = role === undefined ? all : all.filter((b) => b.role === role);
  const tint = iconTint(type);
  const out: ArtRect[] = [];
  if (outlines) {
    for (const b of boxes) {
      const [x, y, w, h] = [b.dx, b.dy - b.z - b.h - b.d, b.w, b.h + b.d];
      if (w > 0 && h > 0) out.push([x - 1, y - 1, w + 2, h + 2, DARK_WARM]);
    }
  }
  for (const b of boxes) {
    const color = tint.get(b.color) ?? PALETTE[b.color] ?? PALETTE[0];
    if (b.w <= 0) continue;
    if (b.d > 0) out.push([b.dx, b.dy - b.z - b.h - b.d, b.w, b.d, color]);
    if (b.h > 0) out.push([b.dx, b.dy - b.z - b.h, b.w, b.h, shade(color, FRONT_SHADE)]);
  }
  return out;
}

/**
 * Draws the item with the anchor at (0, 0). Mirror it with scale.x = -1 for 'left'. With a role,
 * only the boxes of that role (the 'cover' blanket drawn again over a lying avatar).
 */
export function drawFurniture(type: FurnitureType, facing: Facing, role?: ArtBox['role']): Graphics {
  const g = new Graphics();
  for (const [x, y, w, h, c] of iconStylePixels(furnitureRects(type, facing, role, false))) g.rect(x, y, w, h).fill(c);
  return g;
}

/**
 * The icon look (iconPixels.ts) on the item's rectangles: light from the top-left (a lighter edge
 * where the pixel above or to the left is empty, a darker one below or to the right), then ONE 1 px
 * dark warm outline around the whole silhouette. Returns row runs as rectangles.
 */
export function iconStylePixels(rects: readonly ArtRect[]): ArtRect[] {
  if (rects.length === 0) return [];
  const x0 = Math.min(...rects.map((r) => r[0])) - 1;
  const y0 = Math.min(...rects.map((r) => r[1])) - 1;
  const x1 = Math.max(...rects.map((r) => r[0] + r[2])) + 1;
  const y1 = Math.max(...rects.map((r) => r[1] + r[3])) + 1;
  const w = x1 - x0;
  const h = y1 - y0;
  const flat: (string | null)[] = new Array<string | null>(w * h).fill(null);
  for (const [rx, ry, rw, rh, c] of rects) {
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) flat[(y - y0) * w + (x - x0)] = c;
  }
  const at = (x: number, y: number): string | null => (x < 0 || y < 0 || x >= w || y >= h ? null : flat[y * w + x]!);
  const out: ArtRect[] = [];
  for (let y = 0; y < h; y++) {
    let runStart = 0;
    let runColor: string | null = null;
    for (let x = 0; x <= w; x++) {
      let c: string | null = null;
      if (x < w) {
        const here = at(x, y);
        if (here) c = !at(x, y + 1) || !at(x + 1, y) ? shade(here, 0.78) : !at(x, y - 1) || !at(x - 1, y) ? shade(here, 1.25) : here;
        else if (at(x, y - 1) || at(x, y + 1) || at(x - 1, y) || at(x + 1, y)) c = DARK_WARM;
      }
      if (c !== runColor) {
        if (runColor) out.push([x0 + runStart, y0 + y, x - runStart, 1, runColor]);
        runStart = x;
        runColor = c;
      }
    }
  }
  return out;
}

/** The floor rectangles (relative to the anchor, mirroring applied) of the boxes with this role. */
export function roleFloorRects(type: FurnitureType, facing: Facing, role: NonNullable<ArtBox['role']>): Rect[] {
  const { boxes, mirror } = boxesForFacing(type, facing);
  return boxes
    .filter((b) => b.role === role)
    .map((b) => ({ x: mirror ? -(b.dx + b.w) : b.dx, y: b.dy - b.d, w: b.w, h: b.d }));
}
