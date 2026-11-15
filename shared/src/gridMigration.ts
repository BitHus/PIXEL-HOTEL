// Save migration 13 -> 14 (step BG1, the cell grid): rooms are whole cells and floor furniture
// stands on cells. Every placed floor item moves to the nearest valid cell footprint; wall items
// stay where they are (they are free along the back wall band); whatever no longer fits goes back
// to the bag. Pure.

import { canPlace, footprintSize, getFurnitureType, nearestValidPlacement, snapToSurface, snapToWallBand } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { roomAtLevel, type Room } from './room.ts';
import type { FurnitureItem } from './types.ts';

export interface GridMigration {
  state: GameState;
  /** Items that were placed before and are in the bag now. */
  returned: number;
}

/** Counts items that stand in a room (not in the bag). */
export function placedCount(items: readonly FurnitureItem[]): number {
  return items.filter((i) => i.roomId !== null).length;
}

export function snapItemsToGrid(state: GameState): GridMigration {
  // Rooms first: the sizes come from the cell data now.
  const rooms: Room[] = state.rooms.map((r) => {
    try {
      return roomAtLevel(r, r.level);
    } catch {
      return r;
    }
  });
  let items: FurnitureItem[] = state.items.map((i) => ({ ...i }));
  const before = placedCount(items);
  const toBag = (uid: number): void => {
    items = items.map((i) => (i.uid === uid ? { ...i, roomId: null, onItemUid: null } : i));
  };
  const put = (uid: number, x: number, y: number): void => {
    items = items.map((i) => (i.uid === uid ? { ...i, x, y } : i));
  };

  for (const room of rooms) {
    const mine = items.filter((i) => i.roomId === room.id);
    const typeOf = (i: FurnitureItem) => getFurnitureType(i.typeId);
    // Placed so far in this room (the others are taken out until their turn).
    let standing = items.filter((i) => i.roomId !== room.id);
    const settled = (): FurnitureItem[] => standing;
    const settle = (i: FurnitureItem, x: number, y: number): void => {
      put(i.uid, x, y);
      standing = [...standing, { ...i, x, y }];
    };

    // Floor items on the floor, the counter first (it can never be picked up), then back to front.
    const floor = mine
      .filter((i) => i.onItemUid === null && !typeOf(i).wall)
      .sort((a, b) => Number(typeOf(b).noPickup === true) - Number(typeOf(a).noPickup === true) || a.y - b.y || a.x - b.x || a.uid - b.uid);
    for (const i of floor) {
      const t = typeOf(i);
      const pose = nearestValidPlacement(room, settled(), t, i.facing, { x: i.x, y: i.y - footprintSize(t, i.facing).d / 2 });
      if (pose) settle(i, pose.x, pose.y);
      else if (t.noPickup) settle(i, i.x, i.y);
      else toBag(i.uid);
    }

    // Wall items keep their place when they still hang on a band; else the nearest band spot.
    for (const i of mine.filter((o) => typeOf(o).wall)) {
      const t = typeOf(i);
      if (canPlace(room, settled(), t, i.x, i.y, i.facing)) settle(i, i.x, i.y);
      else {
        const p = snapToWallBand(room, i.x, i.y);
        if (canPlace(room, settled(), t, p.x, p.y, i.facing)) settle(i, p.x, p.y);
        else toBag(i.uid);
      }
    }

    // Riders go on the nearest free cell of the surface they stood on.
    for (const i of mine.filter((o) => o.onItemUid !== null)) {
      const t = typeOf(i);
      const surface = standing.find((s) => s.uid === i.onItemUid);
      const spot = surface ? snapToSurface(room, standing, t, i.x, i.y, i.facing) : null;
      if (spot && spot.onItemUid === i.onItemUid) {
        put(i.uid, spot.x, spot.y);
        standing = [...standing, { ...i, x: spot.x, y: spot.y }];
      } else toBag(i.uid);
    }
  }

  return { state: { ...state, rooms, items }, returned: Math.max(0, before - placedCount(items)) };
}
