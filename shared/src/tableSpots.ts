// OA-2 / OA-12: where a guest's dish, mug and coins lie on a table. The spot is the point of the table's TOP FACE nearest to the seat.
// For a rectangular table the top face is its floor footprint (drawn lifted by the table height), inset TABLE_SPOT_INSET_PX. A round
// table's footprint is deeper than the top face is drawn (the art is an ellipse at the front of the square), so a type may give
// `topFace` (dx, dy from the anchor, w, d: the safe area of the drawn top in footprint coordinates); spots then stay inside that.
// Pure, no rendering.

import { TABLE_SPOT_INSET_PX } from './config.ts';
import { footprintRect } from './furniture.ts';
import type { FurnitureItem, FurnitureType, Point, Rect } from './types.ts';

/** The area spots may fall in, and the inset kept from its edge. */
export function tableTopArea(item: Pick<FurnitureItem, 'x' | 'y' | 'facing'>, type: FurnitureType): { rect: Rect; inset: number } {
  if (type.topFace) {
    const t = type.topFace;
    return { rect: { x: item.x + t.dx, y: item.y + t.dy, w: t.w, h: t.d }, inset: 0 };
  }
  return { rect: footprintRect(item, type), inset: TABLE_SPOT_INSET_PX };
}

function clampInto(v: number, lo: number, size: number, inset: number): number {
  if (size < 2 * inset || size <= 0) return lo + size / 2;
  return Math.min(lo + size - inset, Math.max(lo + inset, v));
}

/** The spot on a table for a seat at `seat`: the nearest point of the top area. */
export function plateSlot(seat: Point, item: Pick<FurnitureItem, 'x' | 'y' | 'facing'>, type: FurnitureType): Point {
  const { rect, inset } = tableTopArea(item, type);
  return { x: clampInto(seat.x, rect.x, rect.w, inset), y: clampInto(seat.y, rect.y, rect.h, inset) };
}

/** One spot per seat of the same table (the seats' own positions), in the seats' order. */
export function plateSlots(seats: readonly Point[], item: Pick<FurnitureItem, 'x' | 'y' | 'facing'>, type: FurnitureType): Point[] {
  return seats.map((s) => plateSlot(s, item, type));
}
