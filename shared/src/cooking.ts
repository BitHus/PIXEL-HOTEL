// Cooking (brief section 10b, step K1): a stove (FurnitureType.cooks) in the tavern turns crops into dishes in
// REAL TIME (recipes in shared/data/food.json). Pure: the time is passed in. A stove holds one batch at a time:
// 1 to STOVE_BATCH_MAX dishes of one recipe, all ready after the recipe's cookMs (the time is per batch, not per
// dish). A Cook only keeps the stove's uid, the recipe, the count and the time it is ready, so it goes on while the
// game is closed and survives a save and reload. Nothing is collected by itself: the player taps the stove.
// Inputs out and dishes in go through applyChange (ledger reason 'cook'), exactly once each.

import { COOK_MS, PREP_BONUS, PREP_TABLE_ID, STOVE_BATCH_MAX } from './config.ts';
import { footprintRect, getFurnitureType } from './furniture.ts';
import { kitchenRect, type Room } from './room.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { FOOD_TYPES, getFoodType, isFoodId, type FoodType } from './materials.ts';
import type { FoodId, FurnitureItem, MaterialId, Rect } from './types.ts';

export { FOOD_TYPES };

/** What is on a stove: the recipe, how many dishes, and when they are ready (ms, the same clock as `now`). */
export interface Cook {
  stoveUid: number;
  food: FoodId;
  qty: number;
  readyAt: number;
  /** Extra dishes the kitchen's prep tables add to this batch (step T1b); absent = 0. They cost no crops. */
  bonus?: number;
}

/** How long one batch of a recipe takes, ms: its own cookMs, else the default for its rank. */
export function cookMs(food: FoodType): number {
  return food.cookMs ?? COOK_MS[food.rank];
}

export function cookOf(cooks: readonly Cook[], stoveUid: number): Cook | undefined {
  return cooks.find((c) => c.stoveUid === stoveUid);
}

export function cookReady(cook: Cook, now: number): boolean {
  return now >= cook.readyAt;
}

/** ms until the batch is ready (0 when ready). */
export function cookReadyInMs(cook: Cook, now: number): number {
  return Math.max(0, cook.readyAt - now);
}

/** The stoves placed in the tavern, in uid order. */
export function stoves(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && getFurnitureType(i.typeId).cooks === true).sort((a, b) => a.uid - b.uid);
}

function placedStove(state: GameState, uid: number): FurnitureItem | undefined {
  return stoves(state.items, state.tavern.roomId).find((i) => i.uid === uid);
}

function withCooks(state: GameState, cooks: Cook[]): GameState {
  return { ...state, tavern: { ...state.tavern, cooks } };
}

const inside = (a: Rect, z: Rect): boolean => a.x >= z.x && a.y >= z.y && a.x + a.w <= z.x + z.w && a.y + a.h <= z.y + z.h;
/** True when two footprints share an edge (cell-adjacent, not diagonal). */
function touching(a: Rect, b: Rect): boolean {
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  return (overlapY > 0 && (a.x + a.w === b.x || b.x + b.w === a.x)) || (overlapX > 0 && (a.y + a.h === b.y || b.y + b.h === a.y));
}

/**
 * The dishes a stove adds to every batch (step T1b, config PREP_BONUS): each prep table that is INSIDE the kitchen zone and cell-adjacent to the stove adds
 * perTable, at most max. A stove outside the zone still cooks, without the bonus.
 */
export function prepBonus(items: readonly FurnitureItem[], room: Room, stove: FurnitureItem): number {
  const zone = kitchenRect(room);
  if (!zone || stove.roomId !== room.id) return 0;
  const stoveRect = footprintRect(stove, getFurnitureType(stove.typeId));
  if (!inside(stoveRect, zone)) return 0;
  const tables = items.filter((i) => i.roomId === room.id && i.onItemUid === null && i.typeId === PREP_TABLE_ID && inside(footprintRect(i, getFurnitureType(i.typeId)), zone) && touching(footprintRect(i, getFurnitureType(i.typeId)), stoveRect));
  return Math.min(PREP_BONUS.max, tables.length * PREP_BONUS.perTable);
}

/** The inputs of `qty` dishes of a recipe. */
export function batchInputs(food: FoodType, qty: number): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = {};
  for (const [id, n] of Object.entries(food.inputs) as [MaterialId, number][]) out[id] = (n ?? 0) * qty;
  return out;
}

/** True if the materials cover the inputs of `qty` dishes. */
export function canCookWith(materials: Partial<Record<MaterialId, number>>, food: FoodType, qty = 1): boolean {
  return Object.entries(batchInputs(food, qty)).every(([id, n]) => (materials[id as MaterialId] ?? 0) >= (n ?? 0));
}

/** True if the player has the inputs of `qty` dishes. */
export function canCook(food: FoodType, state: GameState, qty = 1): boolean {
  return canCookWith(state.player.materials, food, qty);
}

/** How many dishes of a recipe these materials allow, 0 to STOVE_BATCH_MAX. */
export function maxBatchWith(materials: Partial<Record<MaterialId, number>>, food: FoodType): number {
  let n = 0;
  while (n < STOVE_BATCH_MAX && canCookWith(materials, food, n + 1)) n++;
  return n;
}

/**
 * Starts a batch on an empty stove that stands in the tavern: the crops leave the bag. Null if it is not such a
 * stove, it is in use, the recipe is unknown, qty is not a whole number from 1 to STOVE_BATCH_MAX, or the inputs
 * are short.
 */
export function startCook(state: GameState, stoveUid: number, food: string, qty: number, at: number): GameState | null {
  if (!isFoodId(food) || !Number.isInteger(qty) || qty < 1 || qty > STOVE_BATCH_MAX) return null;
  if (!placedStove(state, stoveUid) || cookOf(state.tavern.cooks, stoveUid)) return null;
  const type = getFoodType(food);
  const used: Partial<Record<MaterialId, number>> = {};
  for (const [id, n] of Object.entries(batchInputs(type, qty)) as [MaterialId, number][]) used[id] = -n;
  const paid = applyChange(state, { reason: 'cook', materials: used, note: `cooking ${qty} x ${food}` }, at);
  const room = paid?.rooms.find((r) => r.id === paid.tavern.roomId);
  const stove = placedStove(state, stoveUid);
  const bonus = room && stove ? prepBonus(state.items, room, stove) : 0;
  return paid && withCooks(paid, [...paid.tavern.cooks, { stoveUid, food, qty, readyAt: at + cookMs(type), ...(bonus > 0 ? { bonus } : {}) }]);
}

/** Collects the dishes of a ready batch into the bag; the stove is empty again. Null if not ready. */
export function collectCook(state: GameState, stoveUid: number, at: number): { state: GameState; food: FoodId; qty: number } | null {
  const cook = cookOf(state.tavern.cooks, stoveUid);
  if (!cook || !cookReady(cook, at) || !placedStove(state, stoveUid)) return null;
  const qty = cook.qty + (cook.bonus ?? 0);
  const got = applyChange(state, { reason: 'cook', materials: { [cook.food]: qty }, note: `collected ${qty} x ${cook.food}` }, at);
  if (!got) return null;
  return { state: withCooks(got, got.tavern.cooks.filter((c) => c.stoveUid !== stoveUid)), food: cook.food, qty };
}

/**
 * A batch whose stove the player no longer owns (it was sold at the stall) gives its crops back. A stove in the bag
 * keeps its batch. Run it when the items change.
 */
export function returnOrphanCooks(state: GameState, at: number): GameState {
  let next = state;
  for (const cook of state.tavern.cooks) {
    if (state.items.some((i) => i.uid === cook.stoveUid)) continue;
    const inputs = batchInputs(getFoodType(cook.food), cook.qty);
    const r = applyChange(next, { reason: 'cook', materials: inputs, notFound: inputs, note: `stove gone: ${cook.food}` }, at);
    if (r) next = withCooks(r, r.tavern.cooks.filter((c) => c.stoveUid !== cook.stoveUid));
  }
  return next;
}
