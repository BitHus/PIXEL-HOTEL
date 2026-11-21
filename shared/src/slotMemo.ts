// 3e REFILL LOOP: what a tap or stash slot held last. A tap or stash slot that runs dry is not stored any more (taps.ts, stash.ts keep
// only slots with something in them), so 'Refill all' and the empty marker need to know what WAS there. Loading remembers it, serving the
// last one keeps it, unloading by hand (the player chose to empty it) and a piece that leaves the tavern forget it. Pure, no deps.

import type { MaterialId } from './types.ts';

export type SlotKind = 'tap' | 'stash';

/** The key of one slot in TavernState.lastLoaded. */
export function memoKey(kind: SlotKind, pieceUid: number, slot: number): string {
  return `${kind}:${pieceUid}:${slot}`;
}

/** The memo with this slot set to `item`. */
export function remember(memo: Readonly<Record<string, MaterialId>> | undefined, kind: SlotKind, pieceUid: number, slot: number, item: MaterialId): Record<string, MaterialId> {
  return { ...(memo ?? {}), [memoKey(kind, pieceUid, slot)]: item };
}

/** The memo without this slot (or without every slot of the piece when slot is omitted). */
export function forget(memo: Readonly<Record<string, MaterialId>> | undefined, kind: SlotKind, pieceUid: number, slot?: number): Record<string, MaterialId> {
  const out: Record<string, MaterialId> = {};
  const prefix = `${kind}:${pieceUid}:`;
  for (const [k, v] of Object.entries(memo ?? {})) {
    if (slot === undefined ? k.startsWith(prefix) : k === memoKey(kind, pieceUid, slot)) continue;
    out[k] = v;
  }
  return out;
}

/** What the slot held last, if it is remembered. */
export function recalled(memo: Readonly<Record<string, MaterialId>> | undefined, kind: SlotKind, pieceUid: number, slot: number): MaterialId | undefined {
  return memo?.[memoKey(kind, pieceUid, slot)];
}
