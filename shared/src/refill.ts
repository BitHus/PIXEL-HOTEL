// 3e REFILL LOOP (owner 19 Nov, like a real tavern): taps and the food stash run down with every serve and the player refills them.
// Pure: 'Refill all' for the taps and for the stash (from the bag, each slot with what it holds or held last), the low-stock marks on the
// pieces in the world (REFILL_LOW_AT or fewer left, or run dry), and the tap number the 'Tap N is empty' toast names.

import { REFILL_LOW_AT, STASH_SLOTS, TAP_SLOTS } from './config.ts';
import type { GameState } from './gameState.ts';
import { recalled } from './slotMemo.ts';
import { bagDishes, loadStash, stashCards, stashLoadRoom, stashPieces, stashSlotOf, type StashCard, type StashSlot } from './stash.ts';
import type { MaterialId } from './types.ts';
import { loadRoom, loadTap, tapOf, tapStands } from './taps.ts';

/** Every slot of every stand or stash piece, in panel order. */
function slotsOf(uids: readonly number[], n: number): { uid: number; slot: number }[] {
  return uids.flatMap((uid) => Array.from({ length: n }, (_, slot) => ({ uid, slot })));
}

/**
 * REFILL ALL (taps): every tap that holds a drink, or ran dry and remembers it, is topped up from the bag (as many as fit). Empty taps the
 * player never loaded (or emptied by hand) stay empty. Returns the state and how many mugs moved (0 = nothing to do, the same state).
 */
export function refillTaps(state: GameState, at: number): { state: GameState; moved: number } {
  let s = state;
  let moved = 0;
  for (const { uid, slot } of slotsOf(tapStands(state.items, state.tavern.roomId).map((i) => i.uid), TAP_SLOTS)) {
    const drink = tapOf(s.tavern.taps, uid, slot)?.drink ?? recalled(s.tavern.lastLoaded, 'tap', uid, slot);
    if (!drink) continue;
    const n = loadRoom(s, uid, slot, drink);
    const next = n > 0 ? loadTap(s, uid, slot, drink, n, at) : null;
    if (next) {
      s = next;
      moved += n;
    }
  }
  return { state: s, moved };
}

/** REFILL ALL (stash): the same for the stash slots and the cooked dishes in the bag. */
export function refillStash(state: GameState, at: number): { state: GameState; moved: number } {
  let s = state;
  let moved = 0;
  for (const { uid, slot } of slotsOf(stashPieces(state.items, state.tavern.roomId).map((i) => i.uid), STASH_SLOTS)) {
    const dish = stashSlotOf(s.tavern.stash, uid, slot)?.dish ?? recalled(s.tavern.lastLoaded, 'stash', uid, slot);
    if (!dish) continue;
    const n = stashLoadRoom(s, uid, slot, dish);
    const next = n > 0 ? loadStash(s, uid, slot, dish, n, at) : null;
    if (next) {
      s = next;
      moved += n;
    }
  }
  return { state: s, moved };
}

/** One piece that needs a refill: 'empty' = a slot ran dry (it remembers what it held), 'low' = a slot has REFILL_LOW_AT or fewer left. */
export interface LowStockMark {
  uid: number;
  kind: 'tap' | 'stash';
  level: 'low' | 'empty';
}

/** The low-stock marks for the world (one per piece, the worst slot wins). Pieces with nothing loaded and nothing remembered get none. */
export function lowStockMarks(state: GameState, lowAt: number = REFILL_LOW_AT): LowStockMark[] {
  const t = state.tavern;
  const out: LowStockMark[] = [];
  const mark = (uid: number, kind: 'tap' | 'stash', counts: (number | null)[]): void => {
    // null = an empty slot that remembers its item (ran dry); a number = what a loaded slot holds.
    if (counts.some((c) => c === null)) out.push({ uid, kind, level: 'empty' });
    else if (counts.some((c) => c !== null && c <= lowAt)) out.push({ uid, kind, level: 'low' });
  };
  for (const stand of tapStands(state.items, t.roomId)) {
    const counts = Array.from({ length: TAP_SLOTS }, (_, slot) => {
      const tap = tapOf(t.taps, stand.uid, slot);
      return tap ? tap.mugs : recalled(t.lastLoaded, 'tap', stand.uid, slot) ? null : undefined;
    }).filter((c): c is number | null => c !== undefined);
    mark(stand.uid, 'tap', counts);
  }
  for (const piece of stashPieces(state.items, t.roomId)) {
    const counts = Array.from({ length: STASH_SLOTS }, (_, slot) => {
      const s = stashSlotOf(t.stash, piece.uid, slot);
      return s ? s.plates : recalled(t.lastLoaded, 'stash', piece.uid, slot) ? null : undefined;
    }).filter((c): c is number | null => c !== undefined);
    mark(piece.uid, 'stash', counts);
  }
  return out;
}

/** The tap's number as the Taps panel counts it (1 = the first tap of the first stand in uid order), for 'Tap N is empty'. 0 = not a tap on the bar. */
export function tapNumber(state: GameState, standUid: number, slot: number): number {
  const i = tapStands(state.items, state.tavern.roomId).findIndex((s) => s.uid === standUid);
  return i < 0 || slot < 0 || slot >= TAP_SLOTS ? 0 : i * TAP_SLOTS + slot + 1;
}

/** One slot of the Stash panel: the card plus what it held last (an empty slot that ran dry) and whether it is low. */
export interface StashSlotView extends StashCard {
  /** An empty slot that ran dry remembers its dish (shown dim, 'Refill all' fills it again). */
  remembered: MaterialId | null;
  low: boolean;
}

/**
 * The Stash panel (3e, owner 19 Nov: slots on top, the cooked dishes in the bag below, one click each way): every slot, the bag's dishes, and
 * whether 'Refill all' would move anything (a loaded or remembered slot with room whose dish is in the bag). Pure, tested.
 */
export function stashView(
  pieceUids: readonly number[],
  stash: readonly StashSlot[],
  lastLoaded: Readonly<Record<string, MaterialId>> | undefined,
  materials: Partial<Record<MaterialId, number>>,
  lowAt: number = REFILL_LOW_AT,
): { slots: StashSlotView[]; bag: { dish: MaterialId; inBag: number }[]; canRefill: boolean } {
  const slots = stashCards(pieceUids, stash).map((c): StashSlotView => {
    const remembered = c.dish ? null : recalled(lastLoaded, 'stash', c.pieceUid, c.slot) ?? null;
    return { ...c, remembered, low: c.dish !== null && c.plates <= lowAt };
  });
  const canRefill = slots.some((s) => {
    const dish = s.dish ?? s.remembered;
    return dish !== null && s.plates < s.cap && (materials[dish] ?? 0) > 0;
  });
  return { slots, bag: bagDishes(materials), canRefill };
}
