// Folds the oldest ledger entries into per-reason counters (GameState.quests.folded) so the ledger stays small and achievements keep counting. Pure.

import type { GameState } from './gameState.ts';
import type { LedgerEntry } from './types.ts';

export type Folded = Record<string, { n: number; made: number }>;

/** True when a ledger entry put something in the bag (a collected batch, a catch). */
export const entryMade = (e: LedgerEntry): boolean => Object.values(e.materials ?? {}).some((v) => (v ?? 0) > 0);
/** A dungeon or mine entry that ended in death or a carry-out (bank.ts writes the status last in the note). */
export const entryDead = (e: LedgerEntry): boolean => (e.note ?? '').endsWith(' dead');

/** Keeps the newest `keep` entries; the older ones are added to quests.folded under their reason (and reason:dead). */
export function foldLedger(state: GameState, keep: number): GameState {
  if (state.ledger.length <= keep) return state;
  const cut = state.ledger.length - keep;
  const folded: Folded = {};
  for (const [k, v] of Object.entries(state.quests.folded ?? {})) folded[k] = { ...v };
  const add = (key: string, made: boolean): void => {
    const f = (folded[key] ??= { n: 0, made: 0 });
    f.n++;
    if (made) f.made++;
  };
  for (const e of state.ledger.slice(0, cut)) {
    const made = entryMade(e);
    add(e.reason, made);
    if (entryDead(e)) add(`${e.reason}:dead`, made);
  }
  return { ...state, ledger: state.ledger.slice(cut), quests: { ...state.quests, folded } };
}
