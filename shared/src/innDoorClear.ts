// Clearing Inn door spots (step MB-2): when a room gets door spots it did not have (save 26 -> 27, or a room upgrade that moves them), everything
// that stands on a spot goes back to the bag: floor furniture (with what rides on it), blocks, and plants (their seed comes back). Wall items
// hang on the wall band, so one that overlaps a doorway goes back too. Pure; the ledger gets one 'door_spot' entry per room.

import { footprintRect, getFurnitureType, pickUpItem } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { innDoorSpotRects, innDoorwayRects } from './innDoors.ts';
import { applyChange } from './ledger.ts';
import { rectsOverlap, type Room } from './room.ts';
import { blocksOverlapping } from './blocks.ts';
import { plantsOverlapping } from './farm.ts';

export interface DoorSpotReturn {
  state: GameState;
  /** How many things went back (furniture, blocks, plants). */
  moved: number;
}

/** Puts everything on the door spots of this room (as it is in `state.rooms`) back in the bag. The counter never moves. */
export function clearDoorSpots(state: GameState, roomId: number, at: number): DoorSpotReturn {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return { state, moved: 0 };
  const spots = innDoorSpotRects(room);
  const doorways = innDoorwayRects(room);
  if (spots.length === 0) return { state, moved: 0 };
  let moved = 0;
  let items = state.items;
  for (const i of state.items) {
    if (i.roomId !== roomId || i.onItemUid !== null) continue;
    const t = getFurnitureType(i.typeId);
    if (t.noPickup) continue;
    const fp = footprintRect(i, t);
    if ((t.wall ? doorways : spots).some((z) => rectsOverlap(fp, z))) {
      const before = items;
      items = pickUpItem(items, i.uid);
      moved += items.filter((x, k) => x.roomId !== before[k]!.roomId).length;
    }
  }
  let next: GameState = { ...state, items };
  const blocks: Record<string, number> = {};
  const seeds: Record<string, number> = {};
  const blockLayer = { ...room.blocks };
  const plantLayer = { ...room.plants };
  for (const spot of spots) {
    for (const b of blocksOverlapping(room, spot)) {
      if (!blockLayer[`${b.c},${b.r}`]) continue;
      delete blockLayer[`${b.c},${b.r}`];
      blocks[b.id] = (blocks[b.id] ?? 0) + 1;
      moved++;
    }
    for (const p of plantsOverlapping(room, spot)) {
      if (!plantLayer[`${p.c},${p.r}`]) continue;
      delete plantLayer[`${p.c},${p.r}`];
      seeds[p.seed] = (seeds[p.seed] ?? 0) + 1;
      moved++;
    }
  }
  const back = { ...blocks };
  for (const [k, n] of Object.entries(seeds)) back[k] = (back[k] ?? 0) + n;
  if (Object.keys(back).length > 0) {
    const given = applyChange(next, { reason: 'door_spot', materials: back, notFound: back, note: `room ${roomId}: Inn door spots` }, at);
    // The bag could not take them: leave blocks and plants where they are (nothing is lost).
    if (!given) return { state: next, moved: moved - Object.values(back).reduce((a, n) => a + n, 0) };
    next = given;
  }
  const changed: Room = { ...room, blocks: blockLayer, plants: plantLayer };
  next = { ...next, rooms: next.rooms.map((r) => (r.id === roomId ? changed : r)) };
  return { state: next, moved };
}
