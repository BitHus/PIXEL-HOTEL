// CEL-2/CEL-4 (docs/PLAN-CELLAR.md): the attached KITCHEN and CELLAR rooms. Pure.
//
// - The kitchen is free: a new game has it with the start stove and barrel inside (newPlayer.ts); an old save gets it from migration 35 -> 36
//   (addKitchenRoom: stove, barrel, prep tables, pantry, sink and hatch move in at the nearest free cells, what does not fit goes to the bag).
// - The cellar is built with gold from player level CELLAR_UNLOCK_LEVEL (buildCellar, ledger 'build', 1 free keg rack); an old save that owns a
//   keg rack gets it free (migration), racks moved in. Racks allowed per level: CELLAR_RACK_MAX_BY_LEVEL (furniture.ts canPlace).
// - Brews, cooks and casks are keyed by furniture uid, so moving a machine between rooms changes nothing about a batch in progress.

import { CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL, CELLAR_UNLOCK_LEVEL, type RoomLevel } from './config.ts';
import { getFurnitureType, isKitchenPiece, nearestValidPlacement, pickUpItem, ridersOf } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { clearDoorSpots } from './innDoorClear.ts';
import { applyChange } from './ledger.ts';
import { returnOrphanBrews } from './brewing.ts';
import { returnOrphanCasks } from './casks.ts';
import { returnOrphanCooks } from './cooking.ts';
import { createRoom, type Room } from './room.ts';
import type { FurnitureItem, Player } from './types.ts';

/** The next free room id. */
export function nextRoomId(rooms: readonly Room[]): number {
  return rooms.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

/** Why the cellar cannot be built now (null = it can). */
export type CellarProblem = 'built' | 'level' | 'gold' | 'no_tavern';

/** The same from the player alone (the Room panel has only the Player): built, level or gold. */
export function cellarBuildProblem(p: Pick<Player, 'level' | 'wallet' | 'cellarRoomId'>): Exclude<CellarProblem, 'no_tavern'> | null {
  if (p.cellarRoomId !== undefined) return 'built';
  if (p.level < CELLAR_UNLOCK_LEVEL) return 'level';
  if (p.wallet.gold < CELLAR_BUILD_COST) return 'gold';
  return null;
}

export function cellarProblem(state: GameState): CellarProblem | null {
  if (state.player.cellarRoomId !== undefined && !state.rooms.some((r) => r.id === state.player.cellarRoomId)) return cellarBuildProblem({ ...state.player, cellarRoomId: undefined });
  if (!state.rooms.some((r) => r.id === state.tavern.roomId)) return 'no_tavern';
  return cellarBuildProblem(state.player);
}

/** How many keg racks a cellar of this level takes. */
export function cellarRackCap(level: RoomLevel): number {
  return CELLAR_RACK_MAX_BY_LEVEL[level - 1] ?? 0;
}

/** Floor pieces of the tavern for which `want` is true, in uid order (what rides on them comes along). */
function movable(state: GameState, want: (typeId: string) => boolean): FurnitureItem[] {
  return state.items.filter((i) => i.roomId === state.tavern.roomId && i.onItemUid === null && want(i.typeId)).sort((a, b) => a.uid - b.uid);
}

/** Moves the items into `room` at the nearest free cells (starting near the middle of its back half); what does not fit goes to the bag. */
function moveInto(state: GameState, room: Room, list: readonly FurnitureItem[]): GameState {
  let items = state.items;
  for (const it of list) {
    const type = getFurnitureType(it.typeId);
    const riders = ridersOf(items, it.uid);
    const rest = items.filter((i) => i.uid !== it.uid && !riders.some((r) => r.uid === i.uid));
    const pose = nearestValidPlacement(room, rest, type, it.facing, { x: room.w / 2, y: Math.min(room.h - 96, 96) });
    if (!pose) {
      items = pickUpItem(items, it.uid);
      continue;
    }
    const dx = pose.x - it.x;
    const dy = pose.y - it.y;
    items = items.map((i) => (i.uid === it.uid ? { ...i, roomId: room.id, x: pose.x, y: pose.y, facing: pose.facing } : riders.some((r) => r.uid === i.uid) ? { ...i, roomId: room.id, x: i.x + dx, y: i.y + dy } : i));
  }
  return { ...state, items };
}

/** A batch whose machine went to the bag gives its crops back (the same rule as picking a machine up). */
function settleOrphans(state: GameState): GameState {
  const at = state.tavern.updatedAt;
  return returnOrphanCasks(returnOrphanCooks(returnOrphanBrews(state, at), at), at);
}

/**
 * Migration 35 -> 36 (and tests): the attached kitchen for a save that has none. Its level follows the tavern's (so an old layout fits);
 * the kitchen pieces of the tavern move in. A save that has a kitchen room already is left alone.
 */
export function addKitchenRoom(state: GameState): GameState {
  if (state.player.kitchenRoomId !== undefined && state.rooms.some((r) => r.id === state.player.kitchenRoomId)) return state;
  const tavern = state.rooms.find((r) => r.id === state.tavern.roomId);
  if (!tavern) return state;
  const room = createRoom(nextRoomId(state.rooms), 'kitchen', tavern.level, state.player.id);
  let next: GameState = { ...state, rooms: [...state.rooms, room], player: { ...state.player, kitchenRoomId: room.id } };
  next = moveInto(next, room, movable(next, isKitchenPiece));
  // The tavern got two new doors in its back wall: whatever stood there goes to the bag.
  next = clearDoorSpots(next, tavern.id, state.tavern.updatedAt).state;
  return settleOrphans(next);
}

/** Migration 35 -> 36: the cellar for a save that owns keg racks (free); the racks in the tavern move in, the level follows their number. */
export function addCellarForRacks(state: GameState): GameState {
  if (state.player.cellarRoomId !== undefined && state.rooms.some((r) => r.id === state.player.cellarRoomId)) return state;
  if (!state.items.some((i) => getFurnitureType(i.typeId).casks === true)) return state;
  const racks = movable(state, (t) => getFurnitureType(t).casks === true);
  const owned = state.items.filter((i) => getFurnitureType(i.typeId).casks === true).length;
  const level: RoomLevel = owned <= CELLAR_RACK_MAX_BY_LEVEL[0] ? 1 : owned <= CELLAR_RACK_MAX_BY_LEVEL[1] ? 2 : 3;
  const room = createRoom(nextRoomId(state.rooms), 'cellar', level, state.player.id);
  let next: GameState = { ...state, rooms: [...state.rooms, room], player: { ...state.player, cellarRoomId: room.id } };
  next = moveInto(next, room, racks);
  next = clearDoorSpots(next, state.tavern.roomId, state.tavern.updatedAt).state;
  return settleOrphans(next);
}

/**
 * Builds the cellar (CEL-4): needs player level CELLAR_UNLOCK_LEVEL and CELLAR_BUILD_COST gold (ledger 'build'). The new level 1 cellar comes with
 * one keg rack placed inside. Null when it cannot be built (see cellarProblem).
 */
export function buildCellar(state: GameState, at: number): GameState | null {
  if (cellarProblem(state) !== null) return null;
  const paid = applyChange(state, { reason: 'build', gold: -CELLAR_BUILD_COST, addFurniture: ['keg_rack'], note: 'the cellar' }, at);
  if (!paid) return null;
  const rack = paid.items[paid.items.length - 1]!;
  const room = createRoom(nextRoomId(paid.rooms), 'cellar', 1, paid.player.id);
  const next: GameState = { ...paid, rooms: [...paid.rooms, room], player: { ...paid.player, cellarRoomId: room.id } };
  const placed = moveInto(next, room, [{ ...rack, roomId: room.id }]);
  return clearDoorSpots(placed, state.tavern.roomId, at).state;
}
