// The economy (brief sections 5 and 9, step 7). Every gold or item change goes through
// applyChange (ledger.ts), which writes the ledger entry. Pure: time and rng are passed in.
//
// - Catalog: furniture with inCatalog = true costs baseValue * 3 and goes into the bag.
// - Styles: buying one unlocks it forever (unlockStyle); applying an unlocked style to one of the
//   player's rooms is free and can be done any time (applyStyle, no ledger entry: nothing is
//   paid or given).
// - Room upgrade: level 2 costs 300, level 3 costs 800 (each room). The room switches to the next
//   level of its shape (whose floor contains the old one), every item keeps its position, the door
//   moves to the new level's door, and an item standing in the new door zone goes back to the
//   inventory (with what stands on it).
// - Shop catch-up: customers.ts catchUpShop (step 9d: it only fills the queue; no gold).

import { CATALOG_PRICE_MULT, FARM_UPGRADE_COST, ROOM_MAX_LEVEL, ROOM_UPGRADE_COST, type RoomLevel } from './config.ts';
import { growPlots } from './farm.ts';
import { noPlaceRects } from './farmLayout.ts';
import { FURNITURE_TYPES, doorReachesMiddle, footprintRect, getFurnitureType, pickUpItem, roomBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { BLOCK_TYPES, getBlockType } from './blockTypes.ts';
import { blocksOverlapping } from './blocks.ts';
import { doorZoneRect, paintFloorCells, paintWholeFloor, rectsOverlap, roomAtLevel, type Room } from './room.ts';
import { returnOrphanLoot } from './shop.ts';
import { findStyle, stylePrice } from './styles.ts';
import { GEAR_TYPES, type ShopGearId } from './gear.ts';
import { styleKey } from './newPlayer.ts';
import type { StyleKind } from './types.ts';

/** Catalog price of a furniture type: baseValue * 3. */
export function catalogPrice(typeId: string): number {
  return getFurnitureType(typeId).baseValue * CATALOG_PRICE_MULT;
}

/** The furniture types in the catalog. */
export function catalogTypes() {
  return FURNITURE_TYPES.filter((t) => t.inCatalog);
}

/** Buys one catalog item into the bag. Null if it is not in the catalog or the gold is short. */
export function buyCatalog(state: GameState, typeId: string, at: number): GameState | null {
  const t = FURNITURE_TYPES.find((x) => x.id === typeId);
  if (!t?.inCatalog) return null;
  return applyChange(state, { reason: 'catalog', gold: -catalogPrice(typeId), addFurniture: [typeId], note: `bought ${typeId}` }, at);
}

export function isStyleUnlocked(state: GameState, kind: StyleKind, id: string): boolean {
  return state.player.unlockedStyles.includes(styleKey(kind, id));
}

/**
 * Buys a catalog style (baseValue * 3) and unlocks it forever. Null if it is unknown, not in the
 * catalog, already unlocked, or the gold is short.
 */
export function unlockStyle(state: GameState, kind: StyleKind, id: string, at: number): GameState | null {
  const style = findStyle(kind, id);
  if (!style?.inCatalog || isStyleUnlocked(state, kind, id)) return null;
  const next = applyChange(state, { reason: 'style', gold: -stylePrice(style), note: `unlocked ${kind} ${id}` }, at);
  if (!next) return null;
  return { ...next, player: { ...next.player, unlockedStyles: [...next.player.unlockedStyles, styleKey(kind, id)] } };
}

/** Puts an unlocked style on one of the player's rooms. Free. Null if not unlocked or no such room. */
export function applyStyle(state: GameState, roomId: number, kind: StyleKind, id: string): GameState | null {
  if (!isStyleUnlocked(state, kind, id)) return null;
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || room.kind === 'lakeside') return null;
  // A whole-floor style clears the painted cells (step BG1).
  const changed: Room = kind === 'floor' ? paintWholeFloor(room, id) : { ...room, wallStyle: id };
  return { ...state, rooms: state.rooms.map((r) => (r.id === roomId ? changed : r)) };
}

/** The gold the next upgrade of this room costs, or null at the top level. */
export function upgradeCost(room: Room): number | null {
  // The lakeside is not upgradeable (step 9f).
  if (room.kind === 'lakeside' || room.level >= ROOM_MAX_LEVEL) return null;
  const to = (room.level + 1) as 2 | 3;
  return room.kind === 'farm' ? FARM_UPGRADE_COST[to] : ROOM_UPGRADE_COST[to];
}

/**
 * Paints the floor cells in a rectangle of cells (corners inclusive) with an unlocked floor style
 * (step BG1). Free. Null if the style is not unlocked, there is no such room, or no cell of the
 * rectangle is floor.
 */
export function paintFloor(state: GameState, roomId: number, a: { c: number; r: number }, b: { c: number; r: number }, id: string): GameState | null {
  if (!isStyleUnlocked(state, 'floor', id)) return null;
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || room.kind === 'lakeside') return null;
  const changed = paintFloorCells(room, a, b, id);
  if (changed === room) return null;
  return { ...state, rooms: state.rooms.map((r) => (r.id === roomId ? changed : r)) };
}

/**
 * Upgrades a room one level: pays the cost, grows it to the new size (right and down; positions
 * stay), and sends items that touch the new door zone back to the inventory (the counter, which
 * can never be picked up, stays). Null at level 3 or without enough gold.
 */
export function upgradeRoom(state: GameState, roomId: number, at: number): GameState | null {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const cost = upgradeCost(room);
  if (cost === null) return null;
  const paid = applyChange(state, { reason: 'room_upgrade', gold: -cost, note: `room ${roomId} to level ${room.level + 1}` }, at);
  if (!paid) return null;
  const level = (room.level + 1) as RoomLevel;
  // The next level of the room's shape: its floor contains the old one, so every item still fits.
  const grown: Room = roomAtLevel(room, level);
  // The new door zone, and on a farm the new plots, must be free: what stands there goes back.
  const zone = doorZoneRect(grown);
  const plots = noPlaceRects(grown);
  let items = paid.items;
  for (const i of paid.items) {
    const t = getFurnitureType(i.typeId);
    if (i.roomId !== roomId || i.onItemUid !== null || t.wall || t.noPickup) continue;
    const fp = footprintRect(i, t);
    if (rectsOverlap(fp, zone) || plots.some((r) => rectsOverlap(fp, r))) items = pickUpItem(items, i.uid);
  }
  const farm = grown.kind === 'farm' && paid.farm.roomId === roomId ? growPlots(paid.farm, level) : paid.farm;
  let next = returnOrphanLoot({ ...paid, rooms: paid.rooms.map((r) => (r.id === roomId ? grown : r)), items, farm }, at);
  // Blocks (step BG5) on the new door zone or plots go back to the bag; if the door still cannot reach
  // the middle of the grown room, all of its blocks do.
  const room2 = next.rooms.find((r) => r.id === roomId) ?? grown;
  const hit = [...blocksOverlapping(room2, zone), ...plots.flatMap((p) => blocksOverlapping(room2, p))];
  next = returnBlocks(next, roomId, hit, at);
  const room3 = next.rooms.find((r) => r.id === roomId) ?? grown;
  if (!doorReachesMiddle(room3, roomBlockers(room3, next.items))) {
    next = returnBlocks(next, roomId, Object.keys(room3.blocks).map((k) => {
      const [c, r] = k.split(',').map(Number) as [number, number];
      return { c, r, id: room3.blocks[k]!.id as string };
    }), at);
  }
  return next;
}

/**
 * Buys in the Blacksmith (brief section 10): health potions while the player carries fewer than
 * the carry limit (weapons and armor come from the forge since step 9c). Null at the potion limit
 * or when the gold is short.
 */
export function buyGear(state: GameState, id: ShopGearId, at: number): GameState | null {
  const g = GEAR_TYPES.find((x) => x.id === id);
  const p = state.player;
  if (!g || p.potions >= g.carryMax) return null;
  const next = applyChange(state, { reason: 'potion', gold: -g.price, note: 'bought health_potion' }, at);
  return next && { ...next, player: { ...next.player, potions: p.potions + 1 } };
}

/** Takes these blocks out of a room's layer and puts them back in the bag (ledger 'block_return'). */
function returnBlocks(state: GameState, roomId: number, cells: { c: number; r: number; id: string }[], at: number): GameState {
  if (cells.length === 0) return state;
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return state;
  const blocks = { ...room.blocks };
  const back: Record<string, number> = {};
  for (const b of cells) {
    if (!blocks[`${b.c},${b.r}`]) continue;
    delete blocks[`${b.c},${b.r}`];
    back[b.id] = (back[b.id] ?? 0) + 1;
  }
  const given = applyChange(state, { reason: 'block_return', materials: back, notFound: back, note: `room ${roomId} changed` }, at);
  if (!given) return state;
  return { ...given, rooms: given.rooms.map((r) => (r.id === roomId ? { ...r, blocks } : r)) };
}

/** Catalog price of a block: baseValue * 3. */
export function blockPrice(id: string): number {
  return getBlockType(id).baseValue * CATALOG_PRICE_MULT;
}

/** The blocks the Catalog sells. */
export function catalogBlocks() {
  return BLOCK_TYPES.filter((b) => b.inCatalog);
}

/** Buys blocks from the Catalog into the bag. Null if the block is not sold or the gold is short. */
export function buyBlocks(state: GameState, id: string, qty: number, at: number): GameState | null {
  const b = BLOCK_TYPES.find((x) => x.id === id);
  if (!b || !b.inCatalog || !Number.isInteger(qty) || qty < 1) return null;
  return applyChange(state, { reason: 'catalog', gold: -blockPrice(id) * qty, materials: { [b.id]: qty }, note: `bought ${qty} ${id}` }, at);
}
