// Gains (step BG3): what a GameAPI call gave the player, as a plain list the client can show
// (a popup above the avatar's head). Pure: the lists are worked out from state changes and run
// events; nothing here draws or reads a clock. Gold is not a gain (the wallet shows it).

import type { GameState } from './gameState.ts';
import { GEMS_GAIN_ID } from './config.ts';
import { rankOf } from './ranks.ts';
import type { LedgerReason, Rank } from './types.ts';
import type { RunEvent } from './dungeon/run.ts';

export interface Gain {
  /** A material, food, fish, ore or furniture type id (or a gear / potion id from the shops). */
  itemId: string;
  count: number;
  rank: Rank;
}

export type GainList = Gain[];

/** Ledger reasons whose items are not new: already shown (the run bag, popups at the find) or only moved. */
const NOT_GAINS: readonly LedgerReason[] = ['dungeon_bank', 'lunch_box', 'shelf', 'tavern_order', 'tap_load', 'tap_unload', 'block_return'];

/** One gain; the rank is the item type's unless given (a drop that rolled a rank). */
export function gain(itemId: string, count = 1, rank: Rank = rankOf(itemId)): Gain {
  return { itemId, count, rank };
}

/** Adds lists together: the same item and rank become one entry (order of first appearance). Empty and non-positive counts drop out. */
export function mergeGains(...lists: readonly (readonly Gain[])[]): GainList {
  const out: GainList = [];
  for (const list of lists) {
    for (const g of list) {
      if (!(g.count > 0)) continue;
      const same = out.find((o) => o.itemId === g.itemId && o.rank === g.rank);
      if (same) same.count += g.count;
      else out.push({ ...g });
    }
  }
  return out;
}

/**
 * What the ledger entries written between two states gave: materials added and new furniture
 * (positive amounts only). Moves like banking a run or taking goods off a shelf are not gains.
 */
export function gainsSince(before: GameState, after: GameState): GainList {
  const list: GainList = [];
  for (const e of after.ledger.slice(before.ledger.length)) {
    if (NOT_GAINS.includes(e.reason)) continue;
    for (const [id, n] of Object.entries(e.materials ?? {})) if (n > 0) list.push(gain(id, n));
    // Gems (step BG5) are a gain with the id 'gems'.
    if ((e.gemsDelta ?? 0) > 0) list.push({ itemId: GEMS_GAIN_ID, count: e.gemsDelta!, rank: 'common' });
    // Clothing copies (step BG8): a new piece or a spare, with the piece's rank.
    for (const [id, n] of Object.entries(e.clothing ?? {})) if (n > 0) list.push(gain(id, n));
    for (const uid of e.furnitureUids ?? []) {
      const item = after.items.find((i) => i.uid === uid);
      if (item) list.push(gain(item.typeId));
    }
  }
  return mergeGains(list);
}

/**
 * What the dungeon or mine gave in one step: its 'loot' events (chest, kill drop, mimic, boss,
 * rock) minus what did not fit in the run bag ('left_behind').
 */
export function gainsFromRunEvents(events: readonly RunEvent[]): GainList {
  const found: GainList = [];
  const left: GainList = [];
  for (const e of events) {
    // Gold is not an item: the run bag and the wallet show it.
    // Gems count when the player picks them up (step BG4): the pile on the floor is not a gain yet.
    if (e.t === 'gem_pickup') found.push({ itemId: GEMS_GAIN_ID, count: e.qty, rank: 'common' });
    else if (e.t === 'loot' && e.item !== 'gold') found.push(gain(e.item, e.qty, e.rank ?? rankOf(e.item)));
    else if (e.t === 'left_behind') left.push(e.item.kind === 'material' ? gain(e.item.id, e.item.qty) : gain(e.item.typeId));
  }
  const merged = mergeGains(found);
  for (const l of left) {
    // A left-behind drop that rolled a rank was found with that rank: take it off the same item.
    const g = merged.find((m) => m.itemId === l.itemId);
    if (g) g.count -= l.count;
  }
  return merged.filter((g) => g.count > 0);
}

/**
 * What a run bag holds, as a gains list (step BG3b): the items in its slots and its gems. The client shows it above
 * the head when a run is banked and the room opens again. Gold is not a gain. Furniture and materials take their
 * type's rank.
 */
export function bagGains(bag: { slots: readonly ({ kind: 'material'; id: string; qty: number } | { kind: 'furniture'; typeId: string })[]; gems: number }): GainList {
  const list: GainList = bag.slots.map((s) => (s.kind === 'material' ? gain(s.id, s.qty) : gain(s.typeId)));
  if (bag.gems > 0) list.push({ itemId: GEMS_GAIN_ID, count: bag.gems, rank: 'common' });
  return mergeGains(list);
}
