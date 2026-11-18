// KITCHEN WALL (owner 18 Nov, replaces the attached kitchen room): the tavern's kitchen zone (shared/data/roomShapes.json "kitchen") is
// walled off. The zone itself is the INSIDE (stove, barrels, prep tables, pantry, sink, hatch); a ring of wall cells one cell wide stands
// around it wherever there is floor, with ONE doorway cell. Guests never enter (npcNav.guestZones); the wall blocks walking and
// placing like a fixed thing (farmLayout.fixedBlockers / noPlaceRects). Pure.

import { BUILD_CELL } from './config.ts';
import { getRoomShape, rectInsideFloor, type Room } from './room.ts';
import type { Rect } from './types.ts';

export interface KitchenWall {
  /** The inside of the kitchen (the zone) in world px. */
  inside: Rect;
  /** The wall cells (one cell each), without the doorway. */
  walls: Rect[];
  /** The doorway: one cell in the ring, the only way in. Null when no ring cell has floor on both sides (the wall is then left open). */
  door: Rect | null;
}

const cell = (c: number, r: number): Rect => ({ x: c * BUILD_CELL, y: r * BUILD_CELL, w: BUILD_CELL, h: BUILD_CELL });

/** The wall ring of a tavern's kitchen zone, or null (not a tavern, or a shape without a zone). */
export function kitchenWall(room: Room | undefined): KitchenWall | null {
  if (!room || room.kind !== 'shop') return null;
  const z = getRoomShape(room.shape).kitchen?.[room.level - 1];
  if (!z) return null;
  const onFloor = (c: number, r: number): boolean => rectInsideFloor(room, cell(c, r));
  const x0 = z.x - 1;
  const x1 = z.x + z.w;
  const y0 = z.y - 1;
  const y1 = z.y + z.h;
  const ring: { c: number; r: number }[] = [];
  for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) if (c === x0 || c === x1 || r === y0 || r === y1) ring.push({ c, r });
  const floorRing = ring.filter((p) => onFloor(p.c, p.r));
  // Doorway candidates: not a corner, floor on the outside too. South middle first, then the other south cells, west, east, north.
  const midX = z.x + Math.floor(z.w / 2);
  const cands: { c: number; r: number; out: { c: number; r: number } }[] = [];
  for (let k = 0; k < z.w; k++) cands.push({ c: midX + (k % 2 === 0 ? k / 2 : -(k + 1) / 2), r: y1, out: { c: 0, r: y1 + 1 } });
  for (let r = y1 - 1; r > y0; r--) cands.push({ c: x0, r, out: { c: x0 - 1, r } }, { c: x1, r, out: { c: x1 + 1, r } });
  for (let c = z.x; c < z.x + z.w; c++) cands.push({ c, r: y0, out: { c, r: y0 - 1 } });
  const pick = cands.find((p) => {
    if (p.c < z.x && p.r === y1) return false;
    if (p.c >= z.x + z.w && p.r === y1) return false;
    const out = p.r === y1 || p.r === y0 ? { c: p.c, r: p.out.r } : p.out;
    return onFloor(p.c, p.r) && onFloor(out.c, out.r);
  });
  const door = pick ? cell(pick.c, pick.r) : null;
  const walls = floorRing.filter((p) => !(pick && p.c === pick.c && p.r === pick.r)).map((p) => cell(p.c, p.r));
  return { inside: { x: z.x * BUILD_CELL, y: z.y * BUILD_CELL, w: z.w * BUILD_CELL, h: z.h * BUILD_CELL }, walls, door };
}

/** The wall cells as blockers and no-place rects (empty when there is no kitchen). */
export function kitchenWallRects(room: Room): Rect[] {
  return kitchenWall(room)?.walls ?? [];
}
