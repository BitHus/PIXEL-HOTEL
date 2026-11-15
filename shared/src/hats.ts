// Hats (step 9g-1): buying a catalog hat. Other hats come from events (Book rewards today; the rest are wired by their own events).
// Pure: the clock is passed in; gold goes through the ledger (reason 'catalog').

import { applyChange } from './ledger.ts';
import { hatCatalogPrice, getClothing } from './clothing.ts';
import type { GameState } from './gameState.ts';

/** Buys a catalog hat for baseValue * 3 gold and unlocks it. Null = not sold, already owned, or not enough gold. */
export function buyHat(state: GameState, id: string, at: number): GameState | null {
  const price = hatCatalogPrice(id);
  if (price === null || !getClothing(id)) return null;
  if (state.player.unlockedClothing.includes(id)) return null;
  return applyChange(state, { reason: 'catalog', gold: -price, addClothing: [id], note: `hat ${id}` }, at);
}
