// CEL-2 (docs/PLAN-CELLAR.md): where the working pieces may stand. Brewing barrels, stoves and prep tables work in the tavern
// (old layouts) and in the attached KITCHEN room; keg racks work in the tavern and in the CELLAR room. Taps, the register and
// the bar stay in the tavern. Pure.

import type { GameState } from './gameState.ts';

type RoomsOf = Pick<GameState, 'tavern' | 'player'>;

/** True when `roomId` is one of `rooms` (a single id or a list); items in the bag (null) are never in a room. */
export function inRooms(roomId: number | null, rooms: number | readonly number[]): boolean {
  if (roomId === null) return false;
  return typeof rooms === 'number' ? roomId === rooms : rooms.includes(roomId);
}

/** The rooms where barrels, stoves and prep tables work: the tavern and the kitchen room (when it exists). */
export function kitchenRoomIds(state: RoomsOf): number[] {
  const k = state.player.kitchenRoomId;
  return k === undefined ? [state.tavern.roomId] : [state.tavern.roomId, k];
}

/** The rooms where keg racks work: the tavern and the cellar room (when it is built). */
export function cellarRoomIds(state: RoomsOf): number[] {
  const c = state.player.cellarRoomId;
  return c === undefined ? [state.tavern.roomId] : [state.tavern.roomId, c];
}

/** The tavern plus the attached rooms: where the owner's tavern work happens (the client opens the machine panels there). */
export function tavernWorkRoomIds(state: RoomsOf): number[] {
  return [...new Set([...kitchenRoomIds(state), ...cellarRoomIds(state)])];
}
