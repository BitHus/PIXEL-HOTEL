// Every change to gold, materials or owned furniture goes through applyChange and is written to
// the ledger (brief section 9). Pure: the time is passed in.

import type { GameState } from './gameState.ts';
import { getFurnitureType } from './furniture.ts';
import { addSeen } from './seen.ts';
import type { FurnitureItem, LedgerReason, MaterialId } from './types.ts';

export interface Change {
  reason: LedgerReason;
  /** Gold added (negative = spent). */
  gold?: number;
  /** Materials added (negative = used). */
  materials?: Partial<Record<MaterialId, number>>;
  /** New furniture items (type ids), added to the inventory. */
  addFurniture?: string[];
  /** Furniture items (uids) taken out of the game state (put on a shop slot). Must be in the inventory. */
  removeFurniture?: number[];
  /** Furniture items put back into the inventory with their old uid (taken off a shop slot). */
  returnFurniture?: { uid: number; typeId: string }[];
  /**
   * Of the materials added: how many are NOT new finds (things that only come back: food brought
   * home from a run). Everything else the player gains counts as found in the Book (Player.seen).
   */
  notFound?: Partial<Record<MaterialId, number>>;
  note?: string;
}

/** Changes with these reasons only move things the player already has (off a shop slot): no finds. */
const NO_FIND_REASONS: readonly LedgerReason[] = ['shelf'];

/**
 * Applies a change and writes it to the ledger. Null if gold or a material would go below 0, or a
 * furniture change does not fit (removing an item that is not in the inventory, returning a uid
 * that exists).
 */
export function applyChange(state: GameState, change: Change, at: number): GameState | null {
  const p = state.player;
  const gold = p.wallet.gold + (change.gold ?? 0);
  if (gold < 0 || !Number.isInteger(gold)) return null;
  const materials = { ...p.materials };
  for (const [id, n] of Object.entries(change.materials ?? {}) as [MaterialId, number][]) {
    const next = (materials[id] ?? 0) + n;
    if (next < 0 || !Number.isInteger(next)) return null;
    if (next === 0) delete materials[id];
    else materials[id] = next;
  }
  let nextUid = state.nextUid;
  const added: FurnitureItem[] = (change.addFurniture ?? []).map((typeId) => ({
    uid: nextUid++,
    typeId,
    ownerId: p.id,
    roomId: null,
    x: 0,
    y: 0,
    facing: getFurnitureType(typeId).facings[0] ?? 'down',
    onItemUid: null,
  }));
  const remove = new Set(change.removeFurniture ?? []);
  for (const uid of remove) {
    if (!state.items.some((i) => i.uid === uid && i.roomId === null)) return null;
  }
  const returned: FurnitureItem[] = (change.returnFurniture ?? []).map(({ uid, typeId }) => ({
    uid,
    typeId,
    ownerId: p.id,
    roomId: null,
    x: 0,
    y: 0,
    facing: getFurnitureType(typeId).facings[0] ?? 'down',
    onItemUid: null,
  }));
  if (returned.some((r) => state.items.some((i) => i.uid === r.uid))) return null;
  const last = state.ledger[state.ledger.length - 1];
  const addedUids = [...added, ...returned].map((i) => i.uid);
  const entry = {
    id: (last?.id ?? 0) + 1,
    at,
    playerId: p.id,
    reason: change.reason,
    goldDelta: change.gold ?? 0,
    ...(change.materials ? { materials: { ...change.materials } } : {}),
    ...(addedUids.length > 0 ? { furnitureUids: addedUids } : {}),
    ...(remove.size > 0 ? { removedUids: [...remove] } : {}),
    ...(change.note ? { note: change.note } : {}),
  };
  // The Book (step 9e): every gain is a find.
  let seen = p.seen;
  if (!NO_FIND_REASONS.includes(change.reason)) {
    for (const [id, n] of Object.entries(change.materials ?? {}) as [MaterialId, number][]) {
      const found = n - (change.notFound?.[id] ?? 0);
      if (found > 0) seen = addSeen(seen, id, found, at);
    }
    for (const item of added) seen = addSeen(seen, item.typeId, 1, at);
  }
  return {
    ...state,
    player: { ...p, wallet: { gold }, materials, seen },
    items: [...state.items.filter((i) => !remove.has(i.uid)), ...returned, ...added],
    nextUid,
    ledger: [...state.ledger, entry],
  };
}
