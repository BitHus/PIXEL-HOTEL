// Casks (step K2): the keg rack (FurnitureType.casks) holds CASK_SLOTS casks. A cask is a batch of FRESH mugs of one brewed drink put in from the bag; it
// ripens in REAL TIME (the time is passed in; a closed game counts) and becomes AGED, then VINTAGE (config RIPEN_AFTER_MIN by the rank of the plain
// drink). Collecting gives the mugs at their CURRENT tier (fresh when too early) and frees the slot. Nothing is collected by itself. The tier items are
// plain drink ids (`root_ale_aged`, materials.ts), so taps, the menu, the ledger and the Book work with them unchanged. Mugs move through applyChange
// (ledger 'cask_fill' and 'cask_collect').

import { RESERVE_MIN_CELLAR_LEVEL, RIPEN_AFTER_MIN } from './config.ts';
import { bonusesOf, caskSlotsOf } from './skillRules.ts';
import { getFurnitureType } from './furniture.ts';
import { cellarRoomIds, inRooms } from './workRooms.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { getDrinkType, isBaseDrinkId } from './materials.ts';
import type { BaseDrinkId, DrinkId, DrinkTier, FurnitureItem } from './types.ts';

/** Mugs of one drink ripening in a slot of a keg rack (a free slot is not stored). */
export interface Cask {
  rackUid: number;
  slot: number;
  drink: BaseDrinkId;
  mugs: number;
  /** The time (ms, the same clock as `at`) the mugs went in. */
  startedAt: number;
}

export type CaskTier = 'fresh' | DrinkTier;

/** The keg racks placed in the tavern, in uid order. */
export function kegRacks(items: readonly FurnitureItem[], roomId: number | readonly number[]): FurnitureItem[] {
  return items.filter((i) => inRooms(i.roomId, roomId) && getFurnitureType(i.typeId).casks === true).sort((a, b) => a.uid - b.uid);
}

function rackPlaced(state: GameState, uid: number): boolean {
  return kegRacks(state.items, cellarRoomIds(state)).some((i) => i.uid === uid);
}

function withCasks(state: GameState, casks: Cask[]): GameState {
  return { ...state, tavern: { ...state.tavern, casks } };
}

export function caskOf(casks: readonly Cask[], rackUid: number, slot: number): Cask | undefined {
  return casks.find((c) => c.rackUid === rackUid && c.slot === slot);
}

/** The minutes after which a mug of this drink is aged, vintage and reserve (by the rank of the PLAIN drink). */
export function ripenMinutes(drink: BaseDrinkId): { aged: number; vintage: number; reserve: number } {
  return RIPEN_AFTER_MIN[getDrinkType(drink).rank];
}

/** The highest tier a rack gives (CEL-5): reserve only from a cellar of level RESERVE_MIN_CELLAR_LEVEL; a level 1 cellar and a rack in the tavern stop at vintage. */
export type CaskCap = 'vintage' | 'reserve';
export function rackTierCap(state: Pick<GameState, 'items' | 'rooms'>, rackUid: number): CaskCap {
  const room = state.rooms.find((r) => r.id === state.items.find((i) => i.uid === rackUid)?.roomId);
  return room?.kind === 'cellar' && room.level >= RESERVE_MIN_CELLAR_LEVEL ? 'reserve' : 'vintage';
}

/**
 * The tier a cask is at, at time `at`: fresh below the aged mark, aged from it (the exact millisecond counts), vintage from the vintage mark, reserve from the
 * reserve mark when the rack allows it (`cap`, default reserve).
 */
export function caskTier(cask: Cask, at: number, cap: CaskCap = 'reserve'): CaskTier {
  const m = ripenMinutes(cask.drink);
  const elapsed = at - cask.startedAt;
  if (elapsed >= m.reserve * 60_000 && cap === 'reserve') return 'reserve';
  return elapsed >= m.vintage * 60_000 ? 'vintage' : elapsed >= m.aged * 60_000 ? 'aged' : 'fresh';
}

/** ms until the next tier the rack allows (0 when the cask is at its top tier); `elapsed` ms since it was filled. */
export function nextTierInMs(drink: BaseDrinkId, elapsed: number, cap: CaskCap = 'reserve'): number {
  const m = ripenMinutes(drink);
  const marks = [m.aged, m.vintage, ...(cap === 'reserve' ? [m.reserve] : [])].map((x) => x * 60_000);
  const next = marks.find((x) => x > elapsed);
  return next === undefined ? 0 : next - elapsed;
}

/** The item a cask gives at its current tier. */
export function caskItem(cask: Cask, at: number, cap: CaskCap = 'reserve'): DrinkId {
  const tier = caskTier(cask, at, cap);
  return tier === 'fresh' ? cask.drink : (`${cask.drink}_${tier}` as DrinkId);
}

/**
 * Puts qty mugs of one FRESH drink from the bag into a free slot of a keg rack that stands in the tavern (ledger 'cask_fill'); they start ripening at `at`.
 * Null if it is not such a rack or slot, the slot is taken, the drink is not a plain brewed drink, qty is not a whole number from 1 to one brew's mugs,
 * or the bag has fewer.
 */
export function fillCask(state: GameState, rackUid: number, slot: number, drink: string, qty: number, at: number): GameState | null {
  if (!isBaseDrinkId(drink) || !Number.isInteger(slot) || slot < 0 || slot >= caskSlotsOf(bonusesOf(state.player)) || !rackPlaced(state, rackUid)) return null;
  if (!Number.isInteger(qty) || qty < 1 || qty > getDrinkType(drink).mugs || caskOf(state.tavern.casks, rackUid, slot)) return null;
  const paid = applyChange(state, { reason: 'cask_fill', materials: { [drink]: -qty }, note: `cask: ${qty} x ${drink}` }, at);
  return paid && withCasks(paid, [...paid.tavern.casks, { rackUid, slot, drink, mugs: qty, startedAt: at }]);
}

/** Collects a cask: the mugs at the current tier go into the bag (ledger 'cask_collect') and the slot is free again. Null for an empty slot or a rack that is not placed. */
export function collectCask(state: GameState, rackUid: number, slot: number, at: number): { state: GameState; item: DrinkId; mugs: number; tier: CaskTier } | null {
  const cask = caskOf(state.tavern.casks, rackUid, slot);
  if (!cask || !rackPlaced(state, rackUid)) return null;
  const cap = rackTierCap(state, rackUid);
  const item = caskItem(cask, at, cap);
  const got = applyChange(state, { reason: 'cask_collect', materials: { [item]: cask.mugs }, note: `collected ${cask.mugs} x ${item}` }, at);
  return got && { state: withCasks(got, got.tavern.casks.filter((c) => c !== cask)), item, mugs: cask.mugs, tier: caskTier(cask, at, cap) };
}

/** One slot as the Cask panel shows it. */
export interface CaskView {
  rackUid: number;
  slot: number;
  /** The plain drink in it, or null for a free slot. */
  drink: BaseDrinkId | null;
  mugs: number;
  tier: CaskTier;
  /** CEL-5: the highest tier this rack allows (reserve only in a cellar of level 2 or more). */
  cap: CaskCap;
  /** ms until the next tier the rack allows (0 when at the top or free). */
  nextInMs: number;
  /** 0..1 along the way to the top tier the rack allows. */
  progress: number;
}

/** Every slot of every keg rack in the tavern (free ones too), with the tier at time `at`. */
export function caskViews(state: GameState, at: number): CaskView[] {
  const out: CaskView[] = [];
  for (const rack of kegRacks(state.items, cellarRoomIds(state))) {
    const slots = Math.max(caskSlotsOf(bonusesOf(state.player)), ...state.tavern.casks.filter((c) => c.rackUid === rack.uid).map((c) => c.slot + 1)); // a cask above the slots (after a respec) stays visible
    for (let slot = 0; slot < slots; slot++) {
      const cask = caskOf(state.tavern.casks, rack.uid, slot);
      const cap = rackTierCap(state, rack.uid);
      if (!cask) {
        out.push({ rackUid: rack.uid, slot, drink: null, mugs: 0, tier: 'fresh', cap, nextInMs: 0, progress: 0 });
        continue;
      }
      const m = ripenMinutes(cask.drink);
      const elapsed = Math.max(0, at - cask.startedAt);
      const tier = caskTier(cask, at, cap);
      out.push({ rackUid: rack.uid, slot, drink: cask.drink, mugs: cask.mugs, tier, cap, nextInMs: nextTierInMs(cask.drink, elapsed, cap), progress: Math.min(1, elapsed / ((cap === 'reserve' ? m.reserve : m.vintage) * 60_000)) });
    }
  }
  return out;
}

/** A cask on a rack the player no longer owns (sold from the bag) gives its mugs back, fresh (no find). A rack in the bag keeps its casks. Run it when the items change. */
export function returnOrphanCasks(state: GameState, at: number): GameState {
  let next = state;
  for (const cask of state.tavern.casks) {
    if (state.items.some((i) => i.uid === cask.rackUid)) continue;
    const r = applyChange(next, { reason: 'cask_collect', materials: { [cask.drink]: cask.mugs }, notFound: { [cask.drink]: cask.mugs }, note: `rack gone: ${cask.drink}` }, at);
    if (r) next = withCasks(r, r.tavern.casks.filter((c) => c !== cask));
  }
  return next;
}
