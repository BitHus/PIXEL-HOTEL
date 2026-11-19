// TAP FORGIVENESS (owner 18 Nov): a generous, pure hit test. A tap that misses every thing picks the NEAREST target within a tolerance; a real hit always
// beats a near miss; a tap far from everything picks nothing (the caller walks, as before). Works in any one coordinate space (screen px for items and
// guests, world px for the dungeon). Rendering and the client only feed rectangles; no rule of the game lives here.

import { TAP_MIN_SIZE_PX, TAP_TOLERANCE_PX } from './config.ts';
import type { Point, Rect } from './types.ts';

/** Something a tap can pick: its drawn bounds, and its depth (a bigger y is in front). */
export interface TapTarget<T = unknown> {
  /** Anything the caller wants back (an item, a guest id...). */
  ref: T;
  /** The drawn bounds (the sprite, not only the footprint). */
  bounds: Rect;
  /** Depth: the foot y; the one in front (bigger) wins ties. */
  depth: number;
}

export interface TapPick<T> {
  target: TapTarget<T>;
  /** True = the point is inside the drawn bounds (a real hit); false = a near miss within the tolerance. */
  hit: boolean;
  /** Distance from the point to the target's visual centre, px. */
  distance: number;
}

/** The tolerance radius for the input kind: a finger (coarse pointer) is less exact than a mouse. */
export function tapTolerance(touch: boolean): number {
  return touch ? TAP_TOLERANCE_PX.touch : TAP_TOLERANCE_PX.mouse;
}

/** The smallest a target counts as: on a phone at least a 44 px touch box. */
export function tapMinSize(touch: boolean): number {
  return touch ? TAP_MIN_SIZE_PX.touch : TAP_MIN_SIZE_PX.mouse;
}

/** The bounds grown (around their centre) to at least `min` px in each direction. */
export function atLeast(r: Rect, min: number): Rect {
  const w = Math.max(r.w, min);
  const h = Math.max(r.h, min);
  return { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h };
}

/** The centre of a rect. */
export function centerOf(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Distance from a point to a rect (0 inside). */
export function distanceToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

const inside = (p: Point, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/**
 * Picks the target for a tap at `p`.
 * 1. A real hit (inside the drawn bounds, grown to `minSize`) beats every near miss. Among real hits: the nearest visual centre, then the one in front.
 * 2. Else the nearest visual centre among the targets whose (grown) bounds are within `tolerance` of the point; ties go to the one in front.
 * 3. Else null: the tap picks nothing (the caller walks).
 */
export function pickTap<T>(p: Point, targets: readonly TapTarget<T>[], opts: { tolerance: number; minSize: number }): TapPick<T> | null {
  let best: TapPick<T> | null = null;
  const better = (a: TapPick<T>, b: TapPick<T>): boolean => {
    if (a.hit !== b.hit) return a.hit;
    if (Math.abs(a.distance - b.distance) > 1) return a.distance < b.distance;
    return a.target.depth > b.target.depth;
  };
  for (const target of targets) {
    const grown = atLeast(target.bounds, opts.minSize);
    const reach = distanceToRect(p, grown);
    if (reach > opts.tolerance) continue;
    const c = centerOf(target.bounds);
    const pick: TapPick<T> = { target, hit: inside(p, grown), distance: Math.hypot(p.x - c.x, p.y - c.y) };
    if (best === null || better(pick, best)) best = pick;
  }
  return best;
}

/**
 * A2: pieces that are small or sit on something else: wall items, small decor on a surface (freeOnSurface), anything standing on a surface, and
 * floor decor you can walk over (rugs excluded: they are big and the real sprite hit finds them). In BUILD mode a tap uses these with a touch-sized
 * box and a tolerance, so a candle on the bar or a banner on the wall can be selected and dragged, not only hit pixel-exactly.
 */
export function isTinyPiece(type: { wall?: boolean; freeOnSurface?: boolean; blocks?: boolean; w: number; d: number }, onItemUid: number | null): boolean {
  if (type.wall || type.freeOnSurface || onItemUid !== null) return true;
  return type.blocks === false && type.w <= 32 && type.d <= 32;
}
