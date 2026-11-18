// CEL-2/CEL-4 (docs/PLAN-CELLAR.md): the attached KITCHEN and CELLAR rooms. Pure.
//
// - The kitchen is NOT a room any more (owner 18 Nov): a walled area of the tavern (kitchenWall.ts); dissolveKitchenRoom is migration 36 -> 37.
// - The cellar is built with gold from player level CELLAR_UNLOCK_LEVEL (buildCellar, ledger 'build', 1 free keg rack); an old save that owns a
//   keg rack gets it free (migration), racks moved in. Racks allowed per level: CELLAR_RACK_MAX_BY_LEVEL (furniture.ts canPlace).
// - Brews, cooks and casks are keyed by furniture uid, so moving a machine between rooms changes nothing about a batch in progress.

import { BUILD_CELL, CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL, CELLAR_UNLOCK_LEVEL, type RoomLevel } from './config.ts';
import { footprintRect, getFurnitureType, nearestValidPlacement, pickUpItem, ridersOf } from './furniture.ts';
import { isBarPiece } from './barExtension.ts';
import { kitchenZone } from './kitchen.ts';
import { noPlaceRects } from './farmLayout.ts';
import { rectsOverlap } from './room.ts';
import type { BlockCell } from './blockTypes.ts';
import type { GameState } from './gameState.ts';
import { clearDoorSpots } from './innDoorClear.ts';
import { applyChange } from './ledger.ts';
import { returnOrphanBrews } from './brewing.ts';
import { returnOrphanCasks } from './casks.ts';
import { returnOrphanCooks } from './cooking.ts';
import { createRoom, type Room } from './room.ts';
import type { FurnitureItem, MaterialId, Player } from './types.ts';

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
 * Migration 36 -> 37 (owner 18 Nov): the kitchen is no longer a room but a walled area of the tavern (kitchenWall.ts). A save with a kitchen
 * room gets it dissolved: its pieces move into the tavern's kitchen zone (nearest free cells), the room goes, Player.kitchenRoomId goes.
 * Whatever stands or lies on the new wall ring or doorway cells of the tavern moves to the nearest free cell (else the bag; blocks go back
 * to the bag). Brews, cooks and casks are keyed by furniture uid, so batches in progress stay exact. The player standing in the kitchen
 * room is put in the tavern.
 */
export function dissolveKitchenRoom(state: GameState): GameState {
  const legacy = state.player as Player & { kitchenRoomId?: number };
  const kid = legacy.kitchenRoomId;
  const { kitchenRoomId: _k, ...playerRest } = legacy;
  let next: GameState = { ...state, player: playerRest as Player };
  const tavern = next.rooms.find((r) => r.id === next.tavern.roomId);
  if (!tavern) return next;
  // 1. the wall ring and doorway of the tavern must be empty
  const wall = noPlaceRects(tavern);
  let items = next.items;
  const inWall = (i: FurnitureItem): boolean => {
    const fp = footprintRect(i, getFurnitureType(i.typeId));
    return wall.some((w) => rectsOverlap(fp, w));
  };
  for (const it of next.items.filter((i) => i.roomId === tavern.id && i.onItemUid === null && !getFurnitureType(i.typeId).wall && inWall(i)).sort((a, b) => a.uid - b.uid)) {
    const type = getFurnitureType(it.typeId);
    if (isBarPiece(type)) continue; // the bar never leaves; the shapes' start spots keep it clear of the wall
    const riders = ridersOf(items, it.uid);
    const rest = items.filter((i) => i.uid !== it.uid && !riders.some((r) => r.uid === i.uid));
    const pose = nearestValidPlacement(tavern, rest, type, it.facing, { x: it.x, y: it.y - BUILD_CELL / 2 });
    if (!pose) {
      items = pickUpItem(items, it.uid);
      continue;
    }
    const dx = pose.x - it.x;
    const dy = pose.y - it.y;
    items = items.map((i) => (i.uid === it.uid ? { ...i, x: pose.x, y: pose.y, facing: pose.facing } : riders.some((r) => r.uid === i.uid) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
  }
  next = { ...next, items };
  // blocks standing in the wall cells go back to the bag
  const back: Partial<Record<MaterialId, number>> = {};
  const blocks: Record<string, BlockCell[]> = {};
  for (const [key, stack] of Object.entries(tavern.blocks ?? {})) {
    const [c, r] = key.split(',').map(Number) as [number, number];
    const cellRect = { x: c * BUILD_CELL, y: r * BUILD_CELL, w: BUILD_CELL, h: BUILD_CELL };
    if (wall.some((w) => rectsOverlap(cellRect, w))) for (const b of stack) back[b.id as MaterialId] = (back[b.id as MaterialId] ?? 0) + 1;
    else blocks[key] = stack;
  }
  if (Object.keys(back).length > 0) {
    const given = applyChange(next, { reason: 'block_place', materials: back, note: 'the kitchen wall' }, next.tavern.updatedAt);
    if (given) next = { ...given, rooms: given.rooms.map((r) => (r.id === tavern.id ? { ...r, blocks } : r)) };
  }
  // 2. move the kitchen room's items into the tavern's kitchen zone
  if (kid !== undefined) {
    const zone = kitchenZone(tavern);
    const want = zone ? { x: zone.x + zone.w / 2, y: zone.y + zone.h - BUILD_CELL } : { x: tavern.w / 2, y: 96 };
    let its = next.items;
    const floor = its.filter((i) => i.roomId === kid && i.onItemUid === null).sort((a, b) => a.uid - b.uid);
    for (const it of floor) {
      const type = getFurnitureType(it.typeId);
      const riders = ridersOf(its, it.uid);
      const rest = its.filter((i) => i.uid !== it.uid && !riders.some((r) => r.uid === i.uid));
      const pose = type.wall ? null : nearestValidPlacement(tavern, rest, type, it.facing, want);
      if (!pose) {
        its = pickUpItem(its, it.uid);
        continue;
      }
      const dx = pose.x - it.x;
      const dy = pose.y - it.y;
      its = its.map((i) => (i.uid === it.uid ? { ...i, roomId: tavern.id, x: pose.x, y: pose.y, facing: pose.facing } : riders.some((r) => r.uid === i.uid) ? { ...i, roomId: tavern.id, x: i.x + dx, y: i.y + dy } : i));
    }
    // anything left in the room (wall items) goes to the bag
    its = its.map((i) => (i.roomId === kid ? { ...i, roomId: null, onItemUid: null } : i));
    next = { ...next, items: its, rooms: next.rooms.filter((r) => r.id !== kid), currentRoomId: next.currentRoomId === kid ? tavern.id : next.currentRoomId };
  }
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
