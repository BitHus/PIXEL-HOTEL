// A run in the player's game (brief sections 9 and 10): startRun pays the dungeon key (free when
// the player has less than DUNGEON_KEY_COST gold) and takes the potions along; finishRun banks what
// the run kept (gold, materials and furniture through the ledger, reason 'dungeon_bank'), adds the
// xp (kept even after death) and gives back the potions not drunk.
// Step 9b: the lunch box. startRun takes up to LUNCH_BOX_MAX food items out of the bag (ledger
// 'lunch_box'); finishRun gives back the food not eaten (after death the box is lost: step.ts empties it).

import { DUNGEON_KEY_COST, LUNCH_BOX_MAX, MINE_UNLOCK_LEVEL } from '../config.ts';
import { isFoodId } from '../materials.ts';
import type { GameState } from '../gameState.ts';
import { addXp } from '../levels.ts';
import { applyChange } from '../ledger.ts';
import type { FoodId, MaterialId } from '../types.ts';
import { newMineRun, newRun, type DungeonRoundId, type DungeonRun } from './run.ts';

/** True if the next run is free (the player has less gold than the key costs). */
export function runIsFree(state: GameState): boolean {
  return state.player.wallet.gold < DUNGEON_KEY_COST;
}

/**
 * What actually goes in the lunch box: the asked food in order, at most LUNCH_BOX_MAX, only food
 * the player has (each unit once).
 */
export function packLunch(state: GameState, lunch: readonly string[]): FoodId[] {
  const left = { ...state.player.materials };
  const out: FoodId[] = [];
  for (const id of lunch) {
    if (out.length >= LUNCH_BOX_MAX || !isFoodId(id) || (left[id] ?? 0) <= 0) continue;
    left[id] = (left[id] ?? 0) - 1;
    out.push(id);
  }
  return out;
}

export function startRun(
  state: GameState,
  seed: number,
  at: number,
  round?: DungeonRoundId,
  lunch: readonly string[] = [],
): { state: GameState; run: DungeonRun } {
  let s = state;
  if (!runIsFree(s)) s = applyChange(s, { reason: 'dungeon_key', gold: -DUNGEON_KEY_COST, note: 'dungeon key' }, at) ?? s;
  const food = packLunch(s, lunch);
  if (food.length > 0) {
    const used: Partial<Record<MaterialId, number>> = {};
    for (const id of food) used[id] = (used[id] ?? 0) - 1;
    s = applyChange(s, { reason: 'lunch_box', materials: used, note: 'lunch box' }, at) ?? s;
  }
  const p = s.player;
  const run = newRun({ seed, ...(round ? { round } : {}), xp: p.xp, gear: p.gear, potions: p.potions, food });
  return { state: { ...s, player: { ...p, potions: 0 } }, run };
}

/**
 * Starts a mine visit (section 10c, step 9c): free, the potions go along, the visit counter goes up
 * (mithril rocks from visit MITHRIL_FROM_VISIT on). Null below MINE_UNLOCK_LEVEL.
 */
export function startMine(state: GameState, seed: number): { state: GameState; run: DungeonRun } | null {
  const p = state.player;
  if (p.level < MINE_UNLOCK_LEVEL) return null;
  const visit = p.mineVisits + 1;
  const run = newMineRun({ seed, xp: p.xp, gear: p.gear, potions: p.potions, visit });
  return { state: { ...state, player: { ...p, potions: 0, mineVisits: visit } }, run };
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
  // The food not eaten comes home (empty after death).
  for (const id of run.player.food) materials[id] = (materials[id] ?? 0) + 1;
  const banked =
    applyChange(
      state,
      { reason: run.place === 'mine' ? 'mine_bank' : 'dungeon_bank', gold: run.banked.gold, materials, addFurniture: furniture, note: `${run.place === 'mine' ? 'mine visit' : 'dungeon run'} ${run.status}` },
      at,
    ) ?? state;
  const player = addXp(banked.player, run.xpGained);
  return { ...banked, player: { ...player, potions: player.potions + run.player.potions } };
}
