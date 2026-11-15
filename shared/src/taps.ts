// Taps (step T1): a tap stand (FurnitureType.taps) on the bar holds TAP_SLOTS taps; each tap holds mugs of ONE drink (at most
// TAP_CAP), loaded from the bag. A DRINK is on the menu only while a tap holds a mug that no open order has claimed; a dish still
// comes from the bag. Pouring one mug (the serve chain's pour step) takes it off the tap. Pure; mugs move through applyChange
// (ledger 'tap_load' and 'tap_unload').

import { TAP_CAP, TAP_SLOTS } from './config.ts';
import { getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { isDrinkId } from './materials.ts';
import type { TavernState } from './tavern.ts';
import type { DrinkId, FurnitureItem } from './types.ts';

/** A tap with mugs in it (an empty tap is not stored). */
export interface Tap {
  standUid: number;
  slot: number;
  drink: DrinkId;
  mugs: number;
}

/** One tap as the Taps panel shows it (empty ones too). */
export interface TapView {
  standUid: number;
  slot: number;
  drink: DrinkId | null;
  mugs: number;
  cap: number;
}

/** The tap stands placed in the tavern, in uid order. */
export function tapStands(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && getFurnitureType(i.typeId).taps === true).sort((a, b) => a.uid - b.uid);
}

function standPlaced(state: GameState, uid: number): boolean {
  return tapStands(state.items, state.tavern.roomId).some((i) => i.uid === uid);
}

/** The taps that count: those on a stand that is placed in the tavern (a stand in the bag keeps its mugs, they just do not serve). */
export function activeTaps(state: GameState): Tap[] {
  return state.tavern.taps.filter((t) => standPlaced(state, t.standUid)).sort((a, b) => a.standUid - b.standUid || a.slot - b.slot);
}

/** Every tap of every placed stand (TAP_SLOTS per stand), empty ones as drink null. */
export function tapViews(state: GameState): TapView[] {
  const out: TapView[] = [];
  for (const stand of tapStands(state.items, state.tavern.roomId)) {
    for (let slot = 0; slot < TAP_SLOTS; slot++) {
      const t = state.tavern.taps.find((x) => x.standUid === stand.uid && x.slot === slot);
      out.push({ standUid: stand.uid, slot, drink: t?.drink ?? null, mugs: t?.mugs ?? 0, cap: TAP_CAP });
    }
  }
  return out;
}

/** Mugs of a drink on the active taps. */
export function tapMugs(state: GameState, drink: string): number {
  return activeTaps(state).reduce((n, t) => n + (t.drink === drink ? t.mugs : 0), 0);
}

/** Open orders for a drink whose mug has not been poured yet (the one in the player's hands is poured). */
export function pendingDrinkOrders(tavern: TavernState, drink: string): number {
  return tavern.guests.filter((g) => g.phase === 'order' && g.order?.item === drink && tavern.holding?.guestId !== g.id).length;
}

/** Mugs a new guest may still order: on the taps minus the open orders waiting for a pour. */
export function drinkStock(state: GameState, drink: string): number {
  return Math.max(0, tapMugs(state, drink) - pendingDrinkOrders(state.tavern, drink));
}

function withTaps(state: GameState, taps: Tap[]): GameState {
  return { ...state, tavern: { ...state.tavern, taps } };
}

/** How many more mugs a tap takes of a drink (0 when it holds another drink or is full). */
export function tapRoom(state: GameState, standUid: number, slot: number, drink: string): number {
  const t = state.tavern.taps.find((x) => x.standUid === standUid && x.slot === slot);
  if (t && t.drink !== drink) return 0;
  return TAP_CAP - (t?.mugs ?? 0);
}

/**
 * Moves qty mugs of one drink from the bag into a tap of a placed stand (ledger 'tap_load'). Null if the stand is not placed in
 * the tavern, the slot does not exist, it is not a drink, the tap holds another drink, it would hold more than TAP_CAP, or the bag
 * has too few.
 */
export function loadTap(state: GameState, standUid: number, slot: number, drink: string, qty: number, at: number): GameState | null {
  if (!isDrinkId(drink) || !Number.isInteger(qty) || qty < 1 || !Number.isInteger(slot) || slot < 0 || slot >= TAP_SLOTS) return null;
  if (!standPlaced(state, standUid) || qty > tapRoom(state, standUid, slot, drink)) return null;
  const moved = applyChange(state, { reason: 'tap_load', materials: { [drink]: -qty }, note: `tap: ${qty} x ${drink}` }, at);
  if (!moved) return null;
  const cur = moved.tavern.taps.find((x) => x.standUid === standUid && x.slot === slot);
  const next: Tap = { standUid, slot, drink, mugs: (cur?.mugs ?? 0) + qty };
  return withTaps(moved, [...moved.tavern.taps.filter((x) => x !== cur), next]);
}

/** Gives mugs of a tap back to the bag (qty omitted = all; ledger 'tap_unload'). Null if the tap is empty or qty is more than it holds. */
export function unloadTap(state: GameState, standUid: number, slot: number, at: number, qty?: number): GameState | null {
  const cur = state.tavern.taps.find((x) => x.standUid === standUid && x.slot === slot);
  if (!cur || !standPlaced(state, standUid)) return null;
  const n = qty ?? cur.mugs;
  if (!Number.isInteger(n) || n < 1 || n > cur.mugs) return null;
  const back = applyChange(state, { reason: 'tap_unload', materials: { [cur.drink]: n }, note: `tap: ${n} x ${cur.drink} back` }, at);
  if (!back) return null;
  const rest = cur.mugs - n;
  return withTaps(back, [...back.tavern.taps.filter((x) => x !== cur), ...(rest > 0 ? [{ ...cur, mugs: rest }] : [])]);
}

/** The pour: takes one mug of a drink off the first tap that holds it (the stand's uid says where the stream falls). Null when no active tap has one. */
export function pourMug(state: GameState, drink: string): { state: GameState; standUid: number; slot: number } | null {
  const tap = activeTaps(state).find((t) => t.drink === drink && t.mugs > 0);
  if (!tap) return null;
  const rest = tap.mugs - 1;
  const others = state.tavern.taps.filter((x) => x !== tap);
  return { state: withTaps(state, rest > 0 ? [...others, { ...tap, mugs: rest }] : others), standUid: tap.standUid, slot: tap.slot };
}

/**
 * A poured mug that was not served (the guest left, the walk was dropped) goes back on a tap: the one with that drink and room, else a free
 * tap of a placed stand, else (the tap is gone or full) into the bag (ledger 'tap_unload').
 */
export function refundMug(state: GameState, drink: string, at: number): GameState {
  if (!isDrinkId(drink)) return state;
  const tap = activeTaps(state).find((t) => t.drink === drink && t.mugs < TAP_CAP);
  if (tap) return withTaps(state, state.tavern.taps.map((t) => (t === tap ? { ...t, mugs: t.mugs + 1 } : t)));
  for (const v of tapViews(state)) {
    if (v.drink === null) return withTaps(state, [...state.tavern.taps, { standUid: v.standUid, slot: v.slot, drink, mugs: 1 }]);
  }
  return applyChange(state, { reason: 'tap_unload', materials: { [drink]: 1 }, note: `mug back: ${drink}` }, at) ?? state;
}

/** Taps of a stand the player no longer owns (sold from the bag) give their mugs back to the bag. A stand in the bag keeps its mugs. */
export function returnOrphanTaps(state: GameState, at: number): GameState {
  let next = state;
  for (const tap of state.tavern.taps) {
    if (state.items.some((i) => i.uid === tap.standUid)) continue;
    const r = applyChange(next, { reason: 'tap_unload', materials: { [tap.drink]: tap.mugs }, notFound: { [tap.drink]: tap.mugs }, note: `stand gone: ${tap.drink}` }, at);
    if (r) next = withTaps(r, r.tavern.taps.filter((x) => x !== tap));
  }
  return next;
}
