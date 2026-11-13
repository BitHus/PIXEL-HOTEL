// A run in the player's game (brief sections 9 and 10): startRun pays the dungeon key (free when
// the player has less than DUNGEON_KEY_COST gold) and takes the potions along; finishRun banks what
// the run kept (gold, materials and furniture through the ledger, reason 'dungeon_bank'), adds the
// xp (kept even after death) and gives back the potions not drunk.

import { DUNGEON_KEY_COST } from '../config.ts';
import type { GameState } from '../gameState.ts';
import { addXp } from '../levels.ts';
import { applyChange } from '../ledger.ts';
import type { MaterialId } from '../types.ts';
import { newRun, type DungeonRoundId, type DungeonRun } from './run.ts';

/** True if the next run is free (the player has less gold than the key costs). */
export function runIsFree(state: GameState): boolean {
  return state.player.wallet.gold < DUNGEON_KEY_COST;
}

export function startRun(state: GameState, seed: number, at: number, round?: DungeonRoundId): { state: GameState; run: DungeonRun } {
  let s = state;
  if (!runIsFree(s)) s = applyChange(s, { reason: 'dungeon_key', gold: -DUNGEON_KEY_COST, note: 'dungeon key' }, at) ?? s;
  const p = s.player;
  const run = newRun({ seed, ...(round ? { round } : {}), xp: p.xp, gear: p.gear, potions: p.potions });
  return { state: { ...s, player: { ...p, potions: 0 } }, run };
}

/** Banks a finished run ('left' or 'dead'). Null while the run is still going. */
export function finishRun(state: GameState, run: DungeonRun, at: number): GameState | null {
  if (run.status !== 'left' && run.status !== 'dead') return null;
  const materials: Partial<Record<MaterialId, number>> = {};
  const furniture: string[] = [];
  for (const s of run.banked.slots) {
    if (s.kind === 'material') materials[s.id] = (materials[s.id] ?? 0) + s.qty;
    else furniture.push(s.typeId);
  }
  const banked =
    applyChange(
      state,
      { reason: 'dungeon_bank', gold: run.banked.gold, materials, addFurniture: furniture, note: `dungeon run ${run.status}` },
      at,
    ) ?? state;
  const player = addXp(banked.player, run.xpGained);
  return { ...banked, player: { ...player, potions: player.potions + run.player.potions } };
}
