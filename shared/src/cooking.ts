// Cooking (brief section 10b, step K1): a stove (FurnitureType.cooks) in the tavern turns crops into dishes in
// REAL TIME (recipes in shared/data/food.json). Pure: the time is passed in. A stove holds one batch at a time:
// 1 to STOVE_BATCH_MAX dishes of one recipe, all ready after the recipe's cookMs (the time is per batch, not per
// dish). A Cook only keeps the stove's uid, the recipe, the count and the time it is ready, so it goes on while the
// game is closed and survives a save and reload. Nothing is collected by itself: the player taps the stove.
// Inputs out and dishes in go through applyChange (ledger reason 'cook'), exactly once each.

import { bonusesOf, stoveBatchMaxOf } from './skillRules.ts';
import { COOK_MS, STOVE_BATCH_MAX } from './config.ts';
import { getFurnitureType } from './furniture.ts';
import { inRooms, kitchenRoomIds } from './workRooms.ts';
import { prepBonus } from './kitchen.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { FOOD_TYPES, getFoodType, isFoodId, type FoodType } from './materials.ts';
import type { FoodId, FurnitureItem, MaterialId } from './types.ts';

export { FOOD_TYPES };

/** What is on a stove: the recipe, how many dishes, and when they are ready (ms, the same clock as `now`). */
export interface Cook {
  stoveUid: number;
  food: FoodId;
  qty: number;
  /** Extra dishes from prep tables next to the stove inside the kitchen zone, fixed when the batch starts (step T1, kitchen.ts). Missing = 0. */
  bonus?: number;
  readyAt: number;
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
export function stoves(items: readonly FurnitureItem[], roomId: number | readonly number[]): FurnitureItem[] {
  return items.filter((i) => inRooms(i.roomId, roomId) && getFurnitureType(i.typeId).cooks === true).sort((a, b) => a.uid - b.uid);
}

function placedStove(state: GameState, uid: number): FurnitureItem | undefined {
  return stoves(state.items, kitchenRoomIds(state)).find((i) => i.uid === uid);
}

function withCooks(state: GameState, cooks: Cook[]): GameState {
  return { ...state, tavern: { ...state.tavern, cooks } };
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
export function maxBatchWith(materials: Partial<Record<MaterialId, number>>, food: FoodType, max = STOVE_BATCH_MAX): number {
  let n = 0;
  while (n < max && canCookWith(materials, food, n + 1)) n++;
  return n;
}

/**
 * Starts a batch on an empty stove that stands in the tavern: the crops leave the bag. Null if it is not such a
 * stove, it is in use, the recipe is unknown, qty is not a whole number from 1 to STOVE_BATCH_MAX, or the inputs
 * are short.
 */
export function startCook(state: GameState, stoveUid: number, food: string, qty: number, at: number): GameState | null {
  if (!isFoodId(food) || !Number.isInteger(qty) || qty < 1 || qty > stoveBatchMaxOf(bonusesOf(state.player))) return null;
  if (!placedStove(state, stoveUid) || cookOf(state.tavern.cooks, stoveUid)) return null;
  const type = getFoodType(food);
  const used: Partial<Record<MaterialId, number>> = {};
  for (const [id, n] of Object.entries(batchInputs(type, qty)) as [MaterialId, number][]) used[id] = -n;
  const paid = applyChange(state, { reason: 'cook', materials: used, note: `cooking ${qty} x ${food}` }, at);
  const bonus = prepBonus(state.items, state.rooms.find((r) => r.id === state.items.find((i) => i.uid === stoveUid)?.roomId), stoveUid);
  return paid && withCooks(paid, [...paid.tavern.cooks, { stoveUid, food, qty, ...(bonus > 0 ? { bonus } : {}), readyAt: at + cookMs(type) }]);
}

/** The dishes a batch gives: the count put in plus the prep bonus (step T1). */
export function cookYield(cook: Pick<Cook, 'qty' | 'bonus'>): number {
  return cook.qty + (cook.bonus ?? 0);
}

/** Collects the dishes of a ready batch into the bag; the stove is empty again. Null if not ready. `qty` is the whole yield. */
export function collectCook(state: GameState, stoveUid: number, at: number): { state: GameState; food: FoodId; qty: number } | null {
  const cook = cookOf(state.tavern.cooks, stoveUid);
  if (!cook || !cookReady(cook, at) || !placedStove(state, stoveUid)) return null;
  const got = applyChange(state, { reason: 'cook', materials: { [cook.food]: cookYield(cook) }, note: `collected ${cookYield(cook)} x ${cook.food}` }, at);
  if (!got) return null;
  return { state: withCooks(got, got.tavern.cooks.filter((c) => c.stoveUid !== stoveUid)), food: cook.food, qty: cookYield(cook) };
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

/** The tutorial's stove step (guide.json 'stove') gives the early dish's ingredient when the player has none: the first brew eats the starter crops (START_CROPS), so the cook step would find an empty bag. Null when a dish can be cooked already. */
export const TUTORIAL_COOK_CROPS = { turnip: 2 } as const;
export function tutorialCookSupplies(state: GameState, at: number): GameState | null {
  if (FOOD_TYPES.some((f) => canCook(f, state))) return null;
  return applyChange(state, { reason: 'start', materials: TUTORIAL_COOK_CROPS, note: 'tutorial cook' }, at);
}
