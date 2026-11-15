// Crafting crypt furniture and styles from materials (brief section 10), recipes in
// shared/data/recipes.json. A recipe that makes a style unlocks it forever. Goes through the
// ledger (reason 'craft'); fails (null) without all ingredients.

import recipeData from '../data/recipes.json';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { styleKey } from './newPlayer.ts';
import type { MaterialId } from './types.ts';

export interface Recipe {
  id: string;
  /** A furniture type id, or a style id. */
  makes: string;
  makesKind: 'furniture' | 'floor' | 'wall';
  /** Which Workshop tab lists it: 'carpentry' (MA-1: furniture made from blocks); without it, the Crafting tab. */
  station?: 'carpentry';
  /** Materials and BLOCK ids alike: blocks are stackable items in Player.materials (group 'block'), so canCraft and craft treat them like any material. */
  inputs: Partial<Record<MaterialId, number>>;
}

export const RECIPES = recipeData as Recipe[];

/** The recipes of one Workshop tab. */
export function recipesAt(station: 'carpentry' | 'crafting'): Recipe[] {
  return RECIPES.filter((r) => (r.station ?? 'crafting') === station);
}

export function getRecipe(id: string): Recipe {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) throw new Error(`unknown recipe ${id}`);
  return r;
}

/** True if the player has every ingredient (and does not already own the style it makes). */
export function canCraft(recipe: Recipe, state: GameState): boolean {
  if (recipe.makesKind !== 'furniture' && state.player.unlockedStyles.includes(styleKey(recipe.makesKind, recipe.makes))) return false;
  return Object.entries(recipe.inputs).every(([id, n]) => (state.player.materials[id as MaterialId] ?? 0) >= (n ?? 0));
}

/** Crafts one recipe: uses the materials, adds the furniture (or unlocks the style). Null if it cannot. */
export function craft(recipe: Recipe, state: GameState, at: number): GameState | null {
  if (!canCraft(recipe, state)) return null;
  const used = Object.fromEntries(Object.entries(recipe.inputs).map(([id, n]) => [id, -(n ?? 0)]));
  const furniture = recipe.makesKind === 'furniture';
  const next = applyChange(
    state,
    { reason: 'craft', materials: used, ...(furniture ? { addFurniture: [recipe.makes] } : {}), note: `crafted ${recipe.id}` },
    at,
  );
  if (!next || furniture) return next;
  const key = styleKey(recipe.makesKind as 'floor' | 'wall', recipe.makes);
  return { ...next, player: { ...next.player, unlockedStyles: [...next.player.unlockedStyles, key] } };
}
