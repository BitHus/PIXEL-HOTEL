// Every change to gold, materials or owned furniture goes through applyChange and is written to
// the ledger (brief section 9). Pure: the time is passed in.

import type { GameState } from './gameState.ts';
import { getFurnitureType } from './furniture.ts';
import type { FurnitureItem, LedgerReason, MaterialId } from './types.ts';

export interface Change {
  reason: LedgerReason;
  /** Gold added (negative = spent). */
  gold?: number;
  /** Materials added (negative = used). */
  materials?: Partial<Record<MaterialId, number>>;
  /** New furniture items (type ids), added to the inventory. */
  addFurniture?: string[];
  note?: string;
}

/** Applies a change and writes it to the ledger. Null if gold or a material would go below 0. */
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
  const last = state.ledger[state.ledger.length - 1];
  const entry = {
    id: (last?.id ?? 0) + 1,
    at,
    playerId: p.id,
    reason: change.reason,
    goldDelta: change.gold ?? 0,
    ...(change.materials ? { materials: { ...change.materials } } : {}),
    ...(added.length > 0 ? { furnitureUids: added.map((i) => i.uid) } : {}),
    ...(change.note ? { note: change.note } : {}),
  };
  return {
    ...state,
    player: { ...p, wallet: { gold }, materials },
    items: [...state.items, ...added],
    nextUid,
    ledger: [...state.ledger, entry],
  };
}
