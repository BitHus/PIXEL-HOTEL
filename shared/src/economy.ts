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
// - Shop catch-up: walking customers pay at once, then simulateShop does the maths.

import { CATALOG_PRICE_MULT, FARM_UPGRADE_COST, OFFLINE_MAX_MS, ROOM_MAX_LEVEL, ROOM_UPGRADE_COST, type RoomLevel } from './config.ts';
import { growPlots } from './farm.ts';
import { noPlaceRects } from './farmLayout.ts';
import { settleCustomers } from './customers.ts';
import { FURNITURE_TYPES, footprintRect, getFurnitureType, pickUpItem } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { doorZoneRect, rectsOverlap, rectsTouch, roomAtLevel, type Room } from './room.ts';
import { returnOrphanLoot, shopAppeal, simulateShop } from './shop.ts';
import { findStyle, stylePrice } from './styles.ts';
import { GEAR_TYPES, type ShopGearId } from './gear.ts';
import { styleKey } from './newPlayer.ts';
import type { Rng, SaleRecord, StyleKind } from './types.ts';

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
  if (!room) return null;
  const changed: Room = kind === 'floor' ? { ...room, floorStyle: id } : { ...room, wallStyle: id };
  return { ...state, rooms: state.rooms.map((r) => (r.id === roomId ? changed : r)) };
}

/** The gold the next upgrade of this room costs, or null at the top level. */
export function upgradeCost(room: Room): number | null {
  if (room.level >= ROOM_MAX_LEVEL) return null;
  const to = (room.level + 1) as 2 | 3;
  return room.kind === 'farm' ? FARM_UPGRADE_COST[to] : ROOM_UPGRADE_COST[to];
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
    if (rectsTouch(fp, zone) || plots.some((r) => rectsOverlap(fp, r))) items = pickUpItem(items, i.uid);
  }
  const farm = grown.kind === 'farm' && paid.farm.roomId === roomId ? growPlots(paid.farm, level) : paid.farm;
  return returnOrphanLoot({ ...paid, rooms: paid.rooms.map((r) => (r.id === roomId ? grown : r)), items, farm }, at);
}

export interface CatchUp {
  state: GameState;
  /** ms simulated (capped at OFFLINE_MAX_MS); the real gap may be longer. */
  simulatedMs: number;
  sales: SaleRecord[];
  total: number;
}

/**
 * Catches the shop up to `at` without walking: customers in the shop pay at once (or leave), then
 * simulateShop runs the customers for the gap (at most 8 hours). Every sale's gold goes through
 * the ledger (reason 'sale').
 */
export function catchUpShop(state: GameState, at: number, rng: Rng, maxMs?: number): CatchUp {
  const settled = settleCustomers(state, at);
  let s = settled.state;
  const room = s.rooms.find((r) => r.id === s.shop.roomId);
  const gap = Math.max(0, at - s.shop.updatedAt);
  if (!room) return { state: s, simulatedMs: 0, sales: settled.sales, total: sum(settled.sales) };
  const sim = simulateShop(s.shop, shopAppeal(room, s.items), maxMs === undefined ? gap : Math.min(gap, maxMs), rng);
  s = { ...s, shop: { ...sim.shop, updatedAt: at } };
  for (const sale of sim.sales) {
    const next = applyChange(s, { reason: 'sale', gold: sale.price, note: `sold: ${sale.typeId}` }, sale.at);
    if (next) s = next;
  }
  const sales = [...settled.sales, ...sim.sales];
  return { state: s, simulatedMs: Math.min(gap, maxMs ?? OFFLINE_MAX_MS, OFFLINE_MAX_MS), sales, total: sum(sales) };
}

function sum(sales: readonly SaleRecord[]): number {
  return sales.reduce((a, s) => a + s.price, 0);
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
