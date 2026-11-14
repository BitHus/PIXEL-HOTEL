import { getMaterialType } from './materials.ts';
import { describe, expect, it } from 'vitest';
import { craft, getRecipe, RECIPES } from './crafting.ts';
import { getFurnitureType } from './furniture.ts';
import { isStyleUnlocked } from './economy.ts';
import { createNewPlayer } from './newPlayer.ts';
import { findStyle } from './styles.ts';
import type { GameState } from './gameState.ts';
import type { MaterialId } from './types.ts';

function withMaterials(m: Partial<Record<MaterialId, number>>): GameState {
  const s = createNewPlayer();
  return { ...s, player: { ...s.player, materials: m } };
}

describe('recipes (section 10)', () => {
  it('has the 7 recipes with the ingredients of section 10, and one trophy per enemy type (step 9e)', () => {
    expect(RECIPES.map((r) => r.id)).toEqual(['bone_chair', 'skull_lamp', 'coffin_table', 'wall_torch', 'bone_throne', 'crypt_flagstones', 'bone_wall', 'slime_jar', 'bat_wing_fan', 'skull_trophy', 'mimic_chest', 'kings_banner']);
    expect(getRecipe('coffin_table').inputs).toEqual({ bone: 12, wood: 4, cloth: 2 });
    expect(getRecipe('bone_throne').inputs).toEqual({ throne_piece: 5 });
    expect(getRecipe('crypt_flagstones')).toMatchObject({ makesKind: 'floor', inputs: { bone: 8, crystal: 2 } });
    expect(getRecipe('bone_wall')).toMatchObject({ makesKind: 'wall', inputs: { bone: 10, cloth: 4 } });
    for (const r of RECIPES) {
      if (r.makesKind === 'furniture') expect(getFurnitureType(r.makes).inCatalog).toBe(false);
      else expect(findStyle(r.makesKind, r.makes)?.inCatalog).toBe(false);
    }
  });

  it('crafting costs more than the item sells for (not the throne: its pieces only come from the boss)', () => {
    for (const r of RECIPES.filter((x) => x.makesKind === 'furniture' && x.id !== 'bone_throne')) {
      const cost = Object.entries(r.inputs).reduce((a, [id, n]) => a + getMaterialType(id as MaterialId).baseValue * (n ?? 0), 0);
      expect(cost).toBeGreaterThanOrEqual(getFurnitureType(r.makes).baseValue);
    }
  });

  it('makes furniture from the materials, through the ledger', () => {
    const s = withMaterials({ bone: 7, wood: 2 });
    const next = craft(getRecipe('bone_chair'), s, 5)!;
    expect(next.player.materials).toEqual({ bone: 1 });
    expect(next.items.filter((i) => i.typeId === 'bone_chair' && i.roomId === null)).toHaveLength(1);
    expect(next.ledger.at(-1)).toMatchObject({ reason: 'craft', materials: { bone: -6, wood: -2 } });
  });

  it('fails without all ingredients', () => {
    expect(craft(getRecipe('bone_chair'), withMaterials({ bone: 5, wood: 2 }), 0)).toBeNull();
    expect(craft(getRecipe('bone_throne'), withMaterials({ throne_piece: 4 }), 0)).toBeNull();
  });

  it('a style recipe unlocks the style forever (once)', () => {
    const next = craft(getRecipe('bone_wall'), withMaterials({ bone: 20, cloth: 8 }), 0)!;
    expect(isStyleUnlocked(next, 'wall', 'bone_wall')).toBe(true);
    expect(next.player.materials).toEqual({ bone: 10, cloth: 4 });
    expect(craft(getRecipe('bone_wall'), next, 0)).toBeNull();
  });
});
