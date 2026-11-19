// Migration 40 -> 41 (owner 19 Nov: 'the stove is like 1 block big, how do you cook on that'): the stove is a 2 x 1 cell kitchen range (furniture.json w 64).
// An old stove stood on ONE cell (anchor x = that cell's centre); the new footprint is two cells with the anchor on the cell line between them. Pure.
import { kitchenZone, rectInZone } from './kitchen.ts';
import { canPlace, footprintRect, getFurnitureType, nearestValidPlacement, pickUpItem } from './furniture.ts';
import { BUILD_CELL } from './config.ts';
import type { GameState } from './gameState.ts';
import type { FurnitureItem } from './types.ts';

/**
 * Every stove keeps its cell and grows over the free neighbour: first to the right, then to the left (same row), else the nearest free spot of the same room,
 * else it goes to the bag (cooks keyed by uid stay; a stove in the bag hands its batch back through returnOrphanCooks on the next sync, like any picked-up stove).
 * A stove already on a valid 2-cell pose (new data) is left alone.
 */
export function widenStoves(state: GameState): GameState {
  let items = state.items;
  const type = getFurnitureType('stove');
  for (const stove of state.items.filter((i) => i.typeId === 'stove' && i.onItemUid === null && i.roomId !== null).sort((a, b) => a.uid - b.uid)) {
    const room = state.rooms.find((r) => r.id === stove.roomId);
    if (!room) continue;
    const rest = items.filter((i) => i.uid !== stove.uid);
    if (canPlace(room, rest, type, stove.x, stove.y, stove.facing)) continue; // already on a valid 2-cell pose
    // A stove that stood in the kitchen annex stays inside it when it can.
    const zone = kitchenZone(room);
    const wasIn = rectInZone(zone, footprintRect(stove, getFurnitureType('stove')));
    const tries = [stove.x + BUILD_CELL / 2, stove.x - BUILD_CELL / 2];
    const fits = (x: number): boolean => canPlace(room, rest, type, x, stove.y, stove.facing);
    const spot = (wasIn ? tries.find((x) => fits(x) && rectInZone(zone, footprintRect({ x, y: stove.y, facing: stove.facing }, type))) : undefined) ?? tries.find(fits);
    const pose = spot !== undefined ? { x: spot, y: stove.y, facing: stove.facing } : nearestValidPlacement(room, rest, type, stove.facing, { x: stove.x, y: stove.y });
    if (!pose) {
      items = pickUpItem(items, stove.uid);
      continue;
    }
    items = items.map((i: FurnitureItem) => (i.uid === stove.uid ? { ...i, x: pose.x, y: pose.y, facing: pose.facing } : i));
  }
  return { ...state, items };
}
