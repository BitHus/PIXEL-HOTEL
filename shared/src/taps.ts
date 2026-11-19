// Beer taps (step T1). Pure functions on plain data; the time is passed in.
//
// - A TAP STAND (FurnitureType.taps, standing ON the bar) has TAP_SLOTS taps. Each tap holds mugs of ONE brewed drink, at most TAP_CAP.
//   Load moves mugs from the bag onto a tap, Unload gives them back (ledger reason 'tap', no finds, no gain popups).
// - A DRINK is on the menu only while it is on a tap with at least one mug (tavern.ts menuRows); dishes still come from the bag.
// - SERVING A DRINK: the avatar goes to the taps and POURS (POUR_MS); the pour takes one mug off the tap and puts it in the avatar's hands
//   (pourOrder). An order only counts a mug as spoken for (stockFor), it does not take it; if the tap is empty when the avatar pours
//   (the player unloaded it), the order stays open and the avatar goes on.
// - A tap whose stand left the tavern (picked up, sold) gives its mugs back to the bag (returnOrphanTaps).

import { TAP_CAP, TAP_SLOTS } from './config.ts';
import { bonusesOf, tapCapOf } from './skillRules.ts';
import { getFurnitureType, behindPoint } from './furniture.ts';
import { footprintCenter } from './placing.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { DRINK_TYPES, isDrinkId } from './materials.ts';
import type { Guest, TavernState } from './tavern.ts';
import type { FurnitureItem, MaterialId, Point } from './types.ts';

/** One tap that holds mugs. Empty taps are not stored. */
export interface Tap {
  standUid: number;
  /** 0 .. TAP_SLOTS - 1 */
  slot: number;
  drink: MaterialId;
  mugs: number;
}

/** The tap stands placed ON the bar in the tavern, in uid order. */
export function tapStands(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && i.onItemUid !== null && getFurnitureType(i.typeId).taps === true).sort((a, b) => a.uid - b.uid);
}

export function tapOf(taps: readonly Tap[], standUid: number, slot: number): Tap | undefined {
  return taps.find((t) => t.standUid === standUid && t.slot === slot);
}

/** The mugs of a drink on all taps. */
export function mugsOnTaps(taps: readonly Tap[], drink: string): number {
  return taps.reduce((n, t) => n + (t.drink === drink ? t.mugs : 0), 0);
}

/** The mugs of a drink guests have ordered and the player has not poured yet. */
export function spokenFor(guests: readonly Guest[], drink: string): number {
  return guests.filter((g) => g.phase === 'order' && g.order?.item === drink).length;
}

/** What a new order of this drink can still count on: the mugs on the taps minus the open orders (not below 0). `guests` lets a step pass its own list. */
export function stockFor(tavern: Pick<TavernState, 'taps' | 'guests'>, drink: string, guests: readonly Guest[] = tavern.guests): number {
  return Math.max(0, mugsOnTaps(tavern.taps, drink) - spokenFor(guests, drink));
}

function standOn(state: GameState, standUid: number): FurnitureItem | undefined {
  return tapStands(state.items, state.tavern.roomId).find((i) => i.uid === standUid);
}

function withTaps(state: GameState, taps: Tap[]): GameState {
  return { ...state, tavern: { ...state.tavern, taps } };
}

export function setTap(taps: readonly Tap[], next: Tap): Tap[] {
  const rest = taps.filter((t) => !(t.standUid === next.standUid && t.slot === next.slot));
  return next.mugs > 0 ? [...rest, next].sort((a, b) => a.standUid - b.standUid || a.slot - b.slot) : rest;
}

/** How many mugs of a drink the player could put on this tap now (bag stock, room on the tap, same drink). 0 when it cannot take any. */
export function loadRoom(state: GameState, standUid: number, slot: number, drink: string): number {
  if (!isDrinkId(drink) || !standOn(state, standUid) || !Number.isInteger(slot) || slot < 0 || slot >= TAP_SLOTS) return 0;
  const tap = tapOf(state.tavern.taps, standUid, slot);
  if (tap && tap.drink !== drink) return 0;
  return Math.max(0, Math.min(state.player.materials[drink as MaterialId] ?? 0, tapCapOf(bonusesOf(state.player)) - (tap?.mugs ?? 0)));
}

/**
 * Moves qty mugs of one drink from the bag onto a tap of a stand on the bar. Null when: not a drink, no such stand or slot, the tap holds
 * another drink, qty is not a whole number from 1, the bag has fewer, or the tap would hold more than TAP_CAP.
 */
export function loadTap(state: GameState, standUid: number, slot: number, drink: string, qty: number, at: number): GameState | null {
  if (!Number.isInteger(qty) || qty < 1 || loadRoom(state, standUid, slot, drink) < qty) return null;
  const tap = tapOf(state.tavern.taps, standUid, slot);
  const paid = applyChange(state, { reason: 'tap', materials: { [drink as MaterialId]: -qty }, note: `loaded ${qty} x ${drink} on a tap` }, at);
  return paid && withTaps(paid, setTap(paid.tavern.taps, { standUid, slot, drink: drink as MaterialId, mugs: (tap?.mugs ?? 0) + qty }));
}

/** Gives mugs back to the bag: qty (a whole number from 1 to what the tap holds) or all of them. Null for an empty tap or a bad qty. */
export function unloadTap(state: GameState, standUid: number, slot: number, qty: number | 'all', at: number): GameState | null {
  const tap = tapOf(state.tavern.taps, standUid, slot);
  if (!tap) return null;
  const n = qty === 'all' ? tap.mugs : qty;
  if (!Number.isInteger(n) || n < 1 || n > tap.mugs) return null;
  const got = applyChange(state, { reason: 'tap', materials: { [tap.drink]: n }, notFound: { [tap.drink]: n }, note: `unloaded ${n} x ${tap.drink} from a tap` }, at);
  return got && withTaps(got, setTap(got.tavern.taps, { ...tap, mugs: tap.mugs - n }));
}

/** A tap whose stand is not on the bar of the tavern any more gives its mugs back (run it when the items change). */
export function returnOrphanTaps(state: GameState, at: number): GameState {
  let next = state;
  const standing = new Set(tapStands(state.items, state.tavern.roomId).map((i) => i.uid));
  for (const tap of state.tavern.taps) {
    if (standing.has(tap.standUid)) continue;
    const r = applyChange(next, { reason: 'tap', materials: { [tap.drink]: tap.mugs }, notFound: { [tap.drink]: tap.mugs }, note: `tap stand gone: ${tap.drink}` }, at);
    if (r) next = withTaps(r, r.tavern.taps.filter((t) => !(t.standUid === tap.standUid && t.slot === tap.slot)));
  }
  return next;
}

/** The tap the avatar pours from for a drink: the fullest one first is NOT used; the first one in stand and slot order that holds a mug. */
export function tapFor(taps: readonly Tap[], drink: string): Tap | undefined {
  return taps.find((t) => t.drink === drink && t.mugs > 0);
}

/** Where the avatar stands to pour at a stand: behind the bar, level with the stand (world px). */
export function pourPoint(bar: FurnitureItem, stand: FurnitureItem): Point {
  const b = behindPoint(bar, getFurnitureType(bar.typeId));
  const c = footprintCenter(stand, stand.typeId);
  return bar.facing === 'down' || bar.facing === 'up' ? { x: c.x, y: b.y } : { x: b.x, y: c.y };
}

/** The bar (the counter) of the tavern. */
export function barOf(state: GameState): FurnitureItem | undefined {
  return state.items.find((i) => i.roomId === state.tavern.roomId && getFurnitureType(i.typeId).servedFromBehind === true);
}

/** The stand the next pour for a drink comes from, with its pour point; null when no tap holds the drink or the stand is not on a bar. */
export function pourStop(state: GameState, drink: string): { tap: Tap; stand: FurnitureItem; at: Point } | null {
  const tap = tapFor(state.tavern.taps, drink);
  const stand = tap ? tapStands(state.items, state.tavern.roomId).find((i) => i.uid === tap.standUid) : undefined;
  // MODULAR BAR: the piece the stand stands on (its own staff side), else any piece.
  const bar = state.items.find((i) => i.uid === stand?.onItemUid && getFurnitureType(i.typeId).servedFromBehind === true) ?? barOf(state);
  if (!tap || !stand || !bar) return null;
  return { tap, stand, at: pourPoint(bar, stand) };
}

/** One tap as the Taps panel shows it. */
export interface TapCard {
  standUid: number;
  slot: number;
  /** The drink on it, or null for an empty tap. */
  drink: MaterialId | null;
  mugs: number;
  cap: number;
  /** What can be loaded onto it now: the drinks in the bag that fit (an empty tap: any; a tap with a drink: that one), with how many fit. */
  options: { drink: MaterialId; inBag: number; fits: number }[];
}

/** The cards of the Taps panel: every tap of every stand on the bar, from the taps and the bag (pure, tested). */
export function tapCards(standUids: readonly number[], taps: readonly Tap[], materials: Partial<Record<MaterialId, number>>, capMax = TAP_CAP): TapCard[] {
  const drinksInBag = DRINK_TYPES.filter((d) => (materials[d.id] ?? 0) > 0);
  return standUids.flatMap((standUid) =>
    Array.from({ length: TAP_SLOTS }, (_, slot): TapCard => {
      const tap = tapOf(taps, standUid, slot);
      const mugs = tap?.mugs ?? 0;
      const options = drinksInBag
        .filter((d) => !tap || tap.drink === d.id)
        .map((d) => ({ drink: d.id as MaterialId, inBag: materials[d.id] ?? 0, fits: Math.max(0, Math.min(materials[d.id] ?? 0, capMax - mugs)) }))
        .filter((o) => o.fits > 0);
      return { standUid, slot, drink: tap?.drink ?? null, mugs, cap: capMax, options };
    }),
  );
}
