// Cooking (brief section 10b, step 9b): the farm's cooking pot turns crops into food (recipes in
// shared/data/food.json). Food stacks in the bag and goes into the dungeon in the lunch box. Goes
// through the ledger (reason 'cook'): the ingredients are used once, the food is added.

import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { FOOD_TYPES, type FoodType } from './materials.ts';
import type { FoodId, MaterialId } from './types.ts';

export { FOOD_TYPES };

/** True if the player has every ingredient. */
export function canCook(food: FoodType, state: GameState): boolean {
  return Object.entries(food.inputs).every(([id, n]) => (state.player.materials[id as MaterialId] ?? 0) >= (n ?? 0));
}

/** Cooks one food. Null without all ingredients. */
export function cook(state: GameState, id: FoodId, at: number): GameState | null {
  const food = FOOD_TYPES.find((f) => f.id === id);
  if (!food || !canCook(food, state)) return null;
  const materials: Partial<Record<MaterialId, number>> = { [food.id]: 1 };
  for (const [m, n] of Object.entries(food.inputs) as [MaterialId, number][]) materials[m] = (materials[m] ?? 0) - n;
  return applyChange(state, { reason: 'cook', materials, note: `cooked ${food.id}` }, at);
}
