// 3e FOOD STASH (owner 19 Nov). Pure functions on plain data; the time is passed in. Built like the taps (taps.ts).
//
// - A STASH PIECE (FurnitureType.stash: the serving hatch, a floor piece in the tavern) has STASH_SLOTS slots. Each slot holds plates of
//   ONE cooked dish, at most STASH_CAP. ONE CLICK moves a dish from the bag into the stash (addToStash: as many as fit, into the slot that
//   holds it or the first empty one) and a click on a slot gives its plates back (unloadStash 'all'). Ledger reason 'stash' (no finds, no gains).
// - A DISH is on the menu only while a stash slot holds at least one plate (tavern.ts menuRows); the menu stock is the plates in the stash.
//   An order only counts a plate as spoken for (stashStockFor), it does not take it; the stove still cooks into the bag.
// - SERVING A DISH: the avatar walks to the stash piece (stashStop) and takes one plate onto the tray (tavern.ts pourOrder). If the stash ran
//   empty meanwhile the order stays open and the result says empty.
// - A slot whose piece left the tavern gives its plates back to the bag (returnOrphanStash).

import { STASH_CAP, STASH_SLOTS } from './config.ts';
import { getFurnitureType, standPointFor } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { FOOD_TYPES, isFoodId } from './materials.ts';
import { forget, remember } from './slotMemo.ts';
import { spokenFor } from './taps.ts';
import { defaultMenuEntry, type Guest, type TavernState } from './tavern.ts';
import type { FurnitureItem, MaterialId, Point } from './types.ts';

/** One stash slot that holds plates. Empty slots are not stored. */
export interface StashSlot {
  pieceUid: number;
  /** 0 .. STASH_SLOTS - 1 */
  slot: number;
  dish: MaterialId;
  plates: number;
}

/** The stash pieces placed in the tavern, in uid order. */
export function stashPieces(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && getFurnitureType(i.typeId).stash === true).sort((a, b) => a.uid - b.uid);
}

export function stashSlotOf(stash: readonly StashSlot[], pieceUid: number, slot: number): StashSlot | undefined {
  return stash.find((s) => s.pieceUid === pieceUid && s.slot === slot);
}

/** The plates of a dish in the whole stash. */
export function platesInStash(stash: readonly StashSlot[], dish: string): number {
  return stash.reduce((n, s) => n + (s.dish === dish ? s.plates : 0), 0);
}

/** What a new order of this dish can still count on: the plates in the stash minus the open orders (not below 0). */
export function stashStockFor(tavern: Pick<TavernState, 'stash' | 'guests'>, dish: string, guests: readonly Guest[] = tavern.guests): number {
  return Math.max(0, platesInStash(tavern.stash, dish) - spokenFor(guests, dish));
}

export function setStashSlot(stash: readonly StashSlot[], next: StashSlot): StashSlot[] {
  const rest = stash.filter((s) => !(s.pieceUid === next.pieceUid && s.slot === next.slot));
  return next.plates > 0 ? [...rest, next].sort((a, b) => a.pieceUid - b.pieceUid || a.slot - b.slot) : rest;
}

function pieceOn(state: GameState, pieceUid: number): FurnitureItem | undefined {
  return stashPieces(state.items, state.tavern.roomId).find((i) => i.uid === pieceUid);
}

/** How many plates of a dish could go into this slot now (bag stock, room in the slot, same dish). 0 when it cannot take any. */
export function stashLoadRoom(state: GameState, pieceUid: number, slot: number, dish: string): number {
  if (!isFoodId(dish) || !pieceOn(state, pieceUid) || !Number.isInteger(slot) || slot < 0 || slot >= STASH_SLOTS) return 0;
  const s = stashSlotOf(state.tavern.stash, pieceUid, slot);
  if (s && s.dish !== dish) return 0;
  return Math.max(0, Math.min(state.player.materials[dish as MaterialId] ?? 0, STASH_CAP - (s?.plates ?? 0)));
}

/** Moves qty plates of one dish from the bag into a stash slot. Null for a bad dish, piece, slot or qty, another dish in the slot, too few in the bag or a full slot. */
export function loadStash(state: GameState, pieceUid: number, slot: number, dish: string, qty: number, at: number): GameState | null {
  if (!Number.isInteger(qty) || qty < 1 || stashLoadRoom(state, pieceUid, slot, dish) < qty) return null;
  const s = stashSlotOf(state.tavern.stash, pieceUid, slot);
  const paid = applyChange(state, { reason: 'stash', materials: { [dish as MaterialId]: -qty }, note: `put ${qty} x ${dish} in the stash` }, at);
  if (!paid) return null;
  const stash = setStashSlot(paid.tavern.stash, { pieceUid, slot, dish: dish as MaterialId, plates: (s?.plates ?? 0) + qty });
  // A dish put out for the guests with no menu choice yet goes ON the menu (the player put it there to sell it); a choice made before stays.
  const menu = paid.tavern.menu[dish as MaterialId] ? paid.tavern.menu : { ...paid.tavern.menu, [dish]: { ...defaultMenuEntry(dish as MaterialId), on: true } };
  return { ...paid, tavern: { ...paid.tavern, stash, menu, lastLoaded: remember(paid.tavern.lastLoaded, 'stash', pieceUid, slot, dish as MaterialId) } };
}

/** The slot ONE CLICK on a dish in the bag fills: the first slot that holds that dish and has room, else the first empty slot. Null = no room. */
export function stashTarget(state: GameState, dish: string): { pieceUid: number; slot: number; fits: number } | null {
  const pieces = stashPieces(state.items, state.tavern.roomId);
  const all = pieces.flatMap((p) => Array.from({ length: STASH_SLOTS }, (_, slot) => ({ pieceUid: p.uid, slot })));
  const fit = (t: { pieceUid: number; slot: number }) => ({ ...t, fits: stashLoadRoom(state, t.pieceUid, t.slot, dish) });
  const same = all.filter((t) => stashSlotOf(state.tavern.stash, t.pieceUid, t.slot)?.dish === dish).map(fit).find((t) => t.fits > 0);
  if (same) return same;
  const empty = all.filter((t) => !stashSlotOf(state.tavern.stash, t.pieceUid, t.slot)).map(fit).find((t) => t.fits > 0);
  return empty ?? null;
}

/** ONE CLICK (owner 19 Nov): the dish goes from the bag into the stash, as many plates as fit in its slot. Null when nothing can move. */
export function addToStash(state: GameState, dish: string, at: number): { state: GameState; pieceUid: number; slot: number; moved: number } | null {
  const t = stashTarget(state, dish);
  if (!t) return null;
  const next = loadStash(state, t.pieceUid, t.slot, dish, t.fits, at);
  return next ? { state: next, pieceUid: t.pieceUid, slot: t.slot, moved: t.fits } : null;
}

/** Gives plates back to the bag: qty (1 .. what the slot holds) or all. Unloading by hand forgets the slot (no empty marker). Null for an empty slot or a bad qty. */
export function unloadStash(state: GameState, pieceUid: number, slot: number, qty: number | 'all', at: number): GameState | null {
  const s = stashSlotOf(state.tavern.stash, pieceUid, slot);
  if (!s) return null;
  const n = qty === 'all' ? s.plates : qty;
  if (!Number.isInteger(n) || n < 1 || n > s.plates) return null;
  const got = applyChange(state, { reason: 'stash', materials: { [s.dish]: n }, notFound: { [s.dish]: n }, note: `took ${n} x ${s.dish} from the stash` }, at);
  if (!got) return null;
  const left = s.plates - n;
  const lastLoaded = left === 0 ? forget(got.tavern.lastLoaded, 'stash', pieceUid, slot) : got.tavern.lastLoaded ?? {};
  return { ...got, tavern: { ...got.tavern, stash: setStashSlot(got.tavern.stash, { ...s, plates: left }), lastLoaded } };
}

/** A slot whose piece is not in the tavern any more gives its plates back (run it when the items change). */
export function returnOrphanStash(state: GameState, at: number): GameState {
  let next = state;
  const standing = new Set(stashPieces(state.items, state.tavern.roomId).map((i) => i.uid));
  for (const s of state.tavern.stash) {
    if (standing.has(s.pieceUid)) continue;
    const r = applyChange(next, { reason: 'stash', materials: { [s.dish]: s.plates }, notFound: { [s.dish]: s.plates }, note: `stash gone: ${s.dish}` }, at);
    if (r) next = { ...r, tavern: { ...r.tavern, stash: r.tavern.stash.filter((x) => !(x.pieceUid === s.pieceUid && x.slot === s.slot)), lastLoaded: forget(r.tavern.lastLoaded, 'stash', s.pieceUid) } };
  }
  return next;
}

/** The slot a plate of a dish is taken from: the first one in piece and slot order that holds one. */
export function stashFor(stash: readonly StashSlot[], dish: string): StashSlot | undefined {
  return stash.find((s) => s.dish === dish && s.plates > 0);
}

/** Where the avatar fetches a plate of a dish: the stand point of the piece holding it; null when no slot holds it or the piece is gone. */
export function stashStop(state: GameState, dish: string): { slot: StashSlot; piece: FurnitureItem; at: Point } | null {
  const slot = stashFor(state.tavern.stash, dish);
  const piece = slot ? pieceOn(state, slot.pieceUid) : undefined;
  if (!slot || !piece) return null;
  return { slot, piece, at: standPointFor(piece, getFurnitureType(piece.typeId)) };
}

/** Takes ONE plate of a dish out of the stash (the serve). Null when no slot holds it. `ranDry` = that slot is empty now (the refill toast). */
export function takePlate(stash: readonly StashSlot[], dish: string): { stash: StashSlot[]; from: StashSlot; ranDry: boolean } | null {
  const from = stashFor(stash, dish);
  if (!from) return null;
  return { stash: setStashSlot(stash, { ...from, plates: from.plates - 1 }), from, ranDry: from.plates === 1 };
}

/** One slot as the Stash panel shows it. */
export interface StashCard {
  pieceUid: number;
  slot: number;
  /** The dish in it, or null for an empty slot. */
  dish: MaterialId | null;
  plates: number;
  cap: number;
}

/** The slot cards of the Stash panel: every slot of every stash piece (pure, tested). */
export function stashCards(pieceUids: readonly number[], stash: readonly StashSlot[]): StashCard[] {
  return pieceUids.flatMap((pieceUid) =>
    Array.from({ length: STASH_SLOTS }, (_, slot): StashCard => {
      const s = stashSlotOf(stash, pieceUid, slot);
      return { pieceUid, slot, dish: s?.dish ?? null, plates: s?.plates ?? 0, cap: STASH_CAP };
    }),
  );
}

/** The cooked dishes in the bag, in data order (the Stash panel's lower list). */
export function bagDishes(materials: Partial<Record<MaterialId, number>>): { dish: MaterialId; inBag: number }[] {
  return FOOD_TYPES.filter((f) => (materials[f.id as MaterialId] ?? 0) > 0).map((f) => ({ dish: f.id as MaterialId, inBag: materials[f.id as MaterialId] ?? 0 }));
}
