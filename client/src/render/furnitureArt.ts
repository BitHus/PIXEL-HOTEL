// Placeholder furniture art from boxes (brief section 7). The boxes in furniture.json describe
// the 'down' facing; 'right' and 'up' are the same boxes turned on the floor, and 'left' is
// 'right' mirrored. Each box is a front face (w by h, darker) with a top face (w by d,
// lighter) above it, with a 1 px dark warm outline around the whole item.

import { Graphics } from 'pixi.js';
import { PALETTE, paletteColor, type ArtBox, type Facing, type FurnitureType, type Rect } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { SIT_DROP } from './avatarParts.ts';
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

/**
 * The PixelLab bar pieces are flat: counter.png is 39 px tall with a top face of about 13 rows (front edge at row 14, so 25 px high), counter_ext.png 32 tall (front edge 12, 20 high). Their code boxes
 * say 40, which floated the register and the tap stands 12 px over the bar. Items stand at the top face near its front edge: 28 and 23.
 */
export const SPRITE_SURFACE_HEIGHT: Readonly<Record<string, number>> = { counter: 28, counter_ext: 23, bar: 28 };

/** Height of the top that items on this surface stand on, in px. */
export function surfaceHeight(type: FurnitureType): number {
  const fixed = SPRITE_SURFACE_HEIGHT[type.id];
  if (fixed !== undefined) return fixed;
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
    const topY = b.dy - b.z - b.h - b.d;
    const frontY = b.dy - b.z - b.h;
    const front = shade(color, FRONT_SHADE);
    if (b.d > 0) out.push([b.dx, topY, b.w, b.d, color]);
    if (b.h > 0) out.push([b.dx, frontY, b.w, b.h, front]);
    detail(out, b, color, front, topY, frontY);
  }
  return out;
}

/** A small deterministic number per box, so knots and grain sit in the same place every frame. */
function hash(b: ArtBox): number {
  return Math.abs((b.dx * 73856093) ^ (b.dy * 19349663) ^ (b.z * 83492791) ^ (b.w * 2654435761)) >>> 0;
}

/**
 * Surface detail on one box (drawn inside its faces, so the silhouette and outline stay the same):
 * - flat things (rugs, cloth): an inset border band and a lighter inner field;
 * - wide tops: plank seams along the long side, with an offset every other plank;
 * - fronts: vertical board lines, a lit edge under the top and a dark foot line.
 * Small boxes (legs, knobs) stay plain.
 */
function detail(out: ArtRect[], b: ArtBox, color: string, front: string, topY: number, frontY: number): void {
  const seam = shade(color, 0.86);
  const lit = shade(color, 1.18);
  const h = hash(b);
  if (b.h === 0 && b.d >= 16 && b.w >= 16) {
    // Rug / flat cover: a woven border and a fringe of short stripes on the two short ends.
    out.push([b.dx + 2, topY + 2, b.w - 4, 1, lit], [b.dx + 2, topY + b.d - 3, b.w - 4, 1, seam]);
    out.push([b.dx + 2, topY + 2, 1, b.d - 4, lit], [b.dx + b.w - 3, topY + 2, 1, b.d - 4, seam]);
    for (let x = b.dx + 3; x < b.dx + b.w - 3; x += 4) out.push([x, topY, 1, 1, seam], [x, topY + b.d - 1, 1, 1, lit]);
    return;
  }
  if (b.d >= 8 && b.w >= 12) {
    // Top: plank seams every 4 px across the depth, each plank's seam shifted a little.
    for (let y = topY + 4, i = 0; y < topY + b.d - 1; y += 4, i++) {
      const shift = (h >> (i % 8)) % 5;
      out.push([b.dx + 1, y, b.w - 2, 1, seam]);
      const nx = b.dx + 3 + ((shift * 7 + i * 5) % Math.max(1, b.w - 6));
      out.push([nx, y - 2, 1, 2, seam]);
    }
    out.push([b.dx + 1, topY + 1, Math.max(1, b.w - 2), 1, lit]);
  }
  if (b.h >= 6 && b.w >= 8) {
    // Front: a lit lip under the top, vertical boards every 8 px, a dark foot line.
    out.push([b.dx + 1, frontY, b.w - 2, 1, shade(color, 0.95)]);
    for (let x = b.dx + 7; x < b.dx + b.w - 3; x += 8) out.push([x, frontY + 2, 1, b.h - 3, shade(front, 0.88)]);
    out.push([b.dx + 1, frontY + b.h - 2, b.w - 2, 1, shade(front, 0.8)]);
    if (b.w >= 16 && b.h >= 8) out.push([b.dx + 3 + (h % Math.max(1, b.w - 8)), frontY + 3 + (h % Math.max(1, b.h - 6)), 2, 1, shade(front, 0.75)]);
  }
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

/** How high the seat of this type is above the floor: the top of the tallest box under its first seat spot (0 without seats, px). */
export function seatHeight(type: FurnitureType): number {
  const s = type.seats[0];
  if (!s) return 0;
  const under = artBoxes(type).filter((b) => b.role === undefined && s.dx >= b.dx && s.dx <= b.dx + b.w && s.dy > b.dy - b.d && s.dy <= b.dy);
  return Math.max(0, ...under.map((b) => b.z + b.h));
}

/** How many px higher than the standard seated pose (SIT_DROP) this type's seat is: the avatar is raised by it. */
export function seatLiftFor(type: FurnitureType): number {
  return Math.max(0, seatHeight(type) - SIT_DROP);
}

/**
 * R14: the lift of a piece standing on a surface at its own y. The bar pieces draw a top face only about 12 px deep (heights 26..37 above the anchor row) over a 32 px deep
 * footprint, so a free rider (mug, candle: FS1, any point of the footprint) used to float up to 23 px over the bar when it stood at the back of the footprint. For the bar the
 * feet follow the drawn top face: lift = 28 at the front edge, 5 at the back (feet height 28 .. 37). Other surfaces keep their one height. Per-cell riders (register, taps) stand at the front.
 */
export function riderLift(under: { typeId: string; y: number } | undefined, underType: FurnitureType | undefined, riderY: number): number {
  if (!under || !underType) return 0;
  const h = surfaceHeight(underType);
  if (underType.id !== 'bar') return h;
  const depth = Math.min(32, Math.max(0, under.y - riderY));
  return Math.round(h - (depth * (h - 5)) / 32);
}
