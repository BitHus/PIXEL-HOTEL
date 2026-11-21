// 3e FOOD STASH: where the stash piece (the serving hatch) goes in a new tavern and in an old save (migration 43 -> 44).
// Pure: the free spot inside the kitchen annex nearest to the stove (any shape, no data per shape), facing down, that keeps the door, the
// bar's staff side, the hatch's own stand point and the stand points of the stoves, barrels and racks reachable.

import { BUILD_CELL } from './config.ts';
import { behindAllReachable, canPlace, footprintRect, getFurnitureType, poseAtCell, roomBlockers, standPointFor } from './furniture.ts';
import { footprintCenter } from './placing.ts';
import { kitchenZone, rectInZone } from './kitchen.ts';
import { innDoorSpots } from './innDoors.ts';
import { rectsOverlap, type Room } from './room.ts';
import type { FurnitureItem, Point, Rect } from './types.ts';

/** The furniture type that is the food stash (furniture.json: stash true). */
export const STASH_PIECE = 'serving_hatch';

/** The pose for a new stash piece in the tavern, or null when none fits. `near` = what it should stand close to (the stove). */
export function stashSpot(room: Room, items: readonly FurnitureItem[], near: Point | null): { x: number; y: number; facing: 'down' } | null {
  const type = getFurnitureType(STASH_PIECE);
  const zone = kitchenZone(room);
  const here = items.filter((i) => i.roomId === room.id);
  // The machines the player walks up to must stay reachable too.
  const stands = here
    .filter((i) => i.onItemUid === null && (() => { const t = getFurnitureType(i.typeId); return t.cooks === true || t.brews === true || t.casks === true || t.stash === true; })())
    .map((i) => standPointFor(i, getFurnitureType(i.typeId)));
  const cols = Math.floor(room.w / BUILD_CELL);
  const rows = Math.floor(room.h / BUILD_CELL);
  const target = near ?? (zone ? { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 } : { x: room.w / 2, y: room.h / 2 });
  const poses: { x: number; y: number; facing: 'down'; d: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pose = poseAtCell(type, 'down', col, row);
      const fp = footprintRect(pose, type);
      if (zone && !rectInZone(zone, fp)) continue;
      const c = footprintCenter(pose, type.id);
      poses.push({ x: pose.x, y: pose.y, facing: 'down', d: Math.hypot(c.x - target.x, 2 * (c.y - target.y)) }); // the same row as the stove first (a hatch tucked behind it reads badly)
    }
  }
  poses.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  // Never on an Inn door spot (the cellar stairs are in the annex's back wall). First pass: not touching a stove, so the cells beside it stay
  // free for a prep table (the T1 prep bonus); second pass: anywhere (a very full kitchen).
  const doors = innDoorSpots(room);
  const stoves = here.filter((i) => i.onItemUid === null && getFurnitureType(i.typeId).cooks === true).map((i) => footprintRect(i, getFurnitureType(i.typeId)));
  const grow = (r: Rect): Rect => ({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 });
  const free = poses.filter((p) => !doors.some((d) => rectsOverlap(d.spot, footprintRect(p, type))));
  const ordered = [...free.filter((p) => !stoves.some((s) => rectsOverlap(grow(s), footprintRect(p, type)))), ...free];
  for (const p of ordered) {
    if (!canPlace(room, here, type, p.x, p.y, p.facing)) continue;
    const blockers = [...roomBlockers(room, here), footprintRect(p, type)];
    if (![standPointFor(p, type), ...stands].every((sp) => standReachable(room, blockers, sp))) continue;
    const doorCells = doors.flatMap((d) => Array.from({ length: Math.round(d.spot.w / BUILD_CELL) }, (_, k) => ({ x: d.spot.x + k * BUILD_CELL + BUILD_CELL / 2, y: d.spot.y + BUILD_CELL / 2 })));
    if (!behindAllReachable(room, blockers, doorCells)) continue;
    return { x: p.x, y: p.y, facing: 'down' };
  }
  return null;
}

/** A stand point of a 2-cell piece lies on a cell edge: it counts as reachable when a free cell touching it (half a cell left, right, up or down) is reachable from the door. */
export function standReachable(room: Room, blockers: readonly Rect[], sp: Point): boolean {
  const h = BUILD_CELL / 2;
  return [sp, { x: sp.x - h, y: sp.y }, { x: sp.x + h, y: sp.y }, { x: sp.x, y: sp.y - h }, { x: sp.x, y: sp.y + h }].some((p) => behindAllReachable(room, blockers, [p]));
}
