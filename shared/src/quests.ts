// First-run quests (step BG4): the hints in config HINTS are the game's quests. Finishing one pays gems
// (config GEMS.quest) through the ledger (reason 'quest'). Pure: the rng is passed in.

import { gemDrop } from './gems.ts';
import { applyChange } from './ledger.ts';
import { bonusesOf } from './skillRules.ts';
import type { GameState } from './gameState.ts';
import type { Rng } from './types.ts';

/**
 * Marks quest (hint) `index` done when it is the one showing (they go one at a time) and pays its gems.
 * Returns the same state when `index` is not the showing quest. The ledger entry has the reason 'quest'.
 */
export function completeQuest(state: GameState, index: number, at: number, rng: Rng): GameState {
  if (state.hintsDone !== index) return state;
  const gems = gemDrop('quest', 'common', rng, bonusesOf(state.player));
  const paid = gems > 0 ? applyChange(state, { reason: 'quest', gems, note: `quest ${index}` }, at) ?? state : state;
  return { ...paid, hintsDone: index + 1 };
}
