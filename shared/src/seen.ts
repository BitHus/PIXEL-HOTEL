// The collection book's memory (step 9e): Player.seen holds everything the player ever found, by
// id, with how many in total and when first. Pure. It is kept right in two places only: the one
// ledger function (applyChange: every material or furniture the player gains) and the kills of a
// finished run (finishRun). Enemies use the key 'enemy:<type>' (count = kills; an entry with count
// 0 = met, not killed yet).

import type { GameState } from './gameState.ts';
import type { SeenMap } from './types.ts';

export function enemyKey(type: string): string {
  return `enemy:${type}`;
}

/** Adds `count` finds of an id (count 0 = just seen). firstSeenAt stays the first time. */
export function addSeen(seen: SeenMap, id: string, count: number, at: number): SeenMap {
  const old = seen[id];
  return { ...seen, [id]: { count: (old?.count ?? 0) + Math.max(0, count), firstSeenAt: old?.firstSeenAt ?? at } };
}

export function addSeenAll(seen: SeenMap, finds: Readonly<Record<string, number | undefined>>, at: number): SeenMap {
  let out = seen;
  for (const [id, n] of Object.entries(finds)) if (n !== undefined && n >= 0) out = addSeen(out, id, n, at);
  return out;
}

export function isSeen(seen: SeenMap, id: string): boolean {
  return seen[id] !== undefined;
}

export function seenCount(seen: SeenMap, id: string): number {
  return seen[id]?.count ?? 0;
}

/**
 * Everything the player owns now, as finds: the materials, every furniture item (placed, in the
 * bag or on a shop slot) and the goods on the shop slots. For old saves (migration) and for a
 * new player's start items.
 */
export function ownedFinds(state: Pick<GameState, 'player' | 'items' | 'shop'>): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (id: string, n: number): void => {
    out[id] = (out[id] ?? 0) + n;
  };
  for (const [id, n] of Object.entries(state.player.materials)) if (n) add(id, n);
  for (const item of state.items) add(item.typeId, 1);
  for (const slot of state.shop.slots) {
    if (!slot.loot) continue;
    if (slot.loot.kind === 'material') add(slot.loot.id, slot.loot.qty);
    else add(slot.loot.typeId, 1);
  }
  return out;
}
