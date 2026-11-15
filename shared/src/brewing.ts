// Brewing (step 9t): a brewing barrel (FurnitureType.brews) turns crops into mugs of a drink in
// real time (recipes in shared/data/drinks.json). Pure: the time is passed in. A brew only keeps
// the barrel's uid and the time it is ready, so it goes on while the game is closed and survives a
// save and reload. Crops in and mugs out go through applyChange (ledger reason 'brew').

import { getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { getDrinkType, isDrinkId } from './materials.ts';
import type { DrinkId, FurnitureItem, MaterialId } from './types.ts';

/** What is in a barrel: the drink and when it is ready (ms, the same clock as `now`). */
export interface Brew {
  barrelUid: number;
  drink: DrinkId;
  readyAt: number;
}

/** How long a drink takes, ms. */
export function brewMs(drink: DrinkId): number {
  return getDrinkType(drink).minutes * 60_000;
}

export function brewOf(brews: readonly Brew[], barrelUid: number): Brew | undefined {
  return brews.find((b) => b.barrelUid === barrelUid);
}

export function brewReady(brew: Brew, now: number): boolean {
  return now >= brew.readyAt;
}

/** ms until the brew is ready (0 when ready). */
export function brewReadyInMs(brew: Brew, now: number): number {
  return Math.max(0, brew.readyAt - now);
}

/** The barrels placed in the tavern, in uid order. */
export function barrels(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && getFurnitureType(i.typeId).brews === true).sort((a, b) => a.uid - b.uid);
}

function placedBarrel(state: GameState, uid: number): FurnitureItem | undefined {
  return barrels(state.items, state.tavern.roomId).find((i) => i.uid === uid);
}

function withBrews(state: GameState, brews: Brew[]): GameState {
  return { ...state, tavern: { ...state.tavern, brews } };
}

/**
 * Starts a brew in an empty barrel that stands in the tavern: the crops leave the bag. Null if it
 * is not such a barrel, it is in use, it is not a drink, or the crops are short.
 */
export function startBrew(state: GameState, barrelUid: number, drink: string, at: number): GameState | null {
  if (!isDrinkId(drink) || !placedBarrel(state, barrelUid) || brewOf(state.tavern.brews, barrelUid)) return null;
  const type = getDrinkType(drink);
  const used: Partial<Record<MaterialId, number>> = {};
  for (const [id, n] of Object.entries(type.inputs) as [MaterialId, number][]) used[id] = -n;
  const paid = applyChange(state, { reason: 'brew', materials: used, note: `brewing ${drink}` }, at);
  return paid && withBrews(paid, [...paid.tavern.brews, { barrelUid, drink, readyAt: at + brewMs(drink) }]);
}

/** Collects the mugs of a ready brew into the bag; the barrel is empty again. Null if not ready. */
export function collectBrew(state: GameState, barrelUid: number, at: number): { state: GameState; drink: DrinkId; mugs: number } | null {
  const brew = brewOf(state.tavern.brews, barrelUid);
  if (!brew || !brewReady(brew, at) || !placedBarrel(state, barrelUid)) return null;
  const mugs = getDrinkType(brew.drink).mugs;
  const got = applyChange(state, { reason: 'brew', materials: { [brew.drink]: mugs }, note: `collected ${brew.drink}` }, at);
  if (!got) return null;
  return { state: withBrews(got, got.tavern.brews.filter((b) => b.barrelUid !== barrelUid)), drink: brew.drink, mugs };
}

/**
 * A brew whose barrel the player no longer owns (it was sold at the stall) gives its crops back.
 * A barrel in the bag keeps its brew. Run it when the items change.
 */
export function returnOrphanBrews(state: GameState, at: number): GameState {
  let next = state;
  for (const brew of state.tavern.brews) {
    if (state.items.some((i) => i.uid === brew.barrelUid)) continue;
    const inputs = getDrinkType(brew.drink).inputs;
    const r = applyChange(next, { reason: 'brew', materials: inputs, notFound: inputs, note: `barrel gone: ${brew.drink}` }, at);
    if (r) next = withBrews(r, r.tavern.brews.filter((b) => b.barrelUid !== brew.barrelUid));
  }
  return next;
}
