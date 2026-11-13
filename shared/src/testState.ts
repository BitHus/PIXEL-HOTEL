// Test helpers (not part of the game): a new player with a seeded state, and ledger checks.

import type { GameState } from './gameState.ts';
import type { MaterialId } from './types.ts';

/** Sum of the ledger's gold changes (must equal the wallet). */
export function ledgerGold(state: GameState): number {
  return state.ledger.reduce((a, e) => a + e.goldDelta, 0);
}

/** Sum of the ledger's material changes per material (must equal the bag's counts). */
export function ledgerMaterials(state: GameState): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = {};
  for (const e of state.ledger) {
    for (const [id, n] of Object.entries(e.materials ?? {}) as [MaterialId, number][]) {
      const v = (out[id] ?? 0) + n;
      if (v === 0) delete out[id];
      else out[id] = v;
    }
  }
  return out;
}
