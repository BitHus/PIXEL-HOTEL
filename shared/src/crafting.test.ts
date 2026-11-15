import { getMaterialType } from './materials.ts';
import { describe, expect, it } from 'vitest';
import { canCraft, craft, getRecipe, RECIPES, recipesAt } from './crafting.ts';
import { BLOCK_TYPES } from './blockTypes.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import { isMaterialId } from './materials.ts';
import { RANKS } from './ranks.ts';
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
    expect(recipesAt('crafting').map((r) => r.id)).toEqual(['bone_chair', 'skull_lamp', 'coffin_table', 'wall_torch', 'bone_throne', 'crypt_flagstones', 'bone_wall', 'slime_jar', 'bat_wing_fan', 'skull_trophy', 'mimic_chest', 'kings_banner', 'fish_tank', 'mounted_fish', 'fishing_net', 'shell_lamp', 'driftwood_bench', 'anchor', 'pearl_chandelier', 'sunken_throne', 'lake_pebbles', 'reed_wall', 'spice_bundle', 'antler_mount']);
    expect(getRecipe('coffin_table').inputs).toEqual({ bone: 12, wood: 4, cloth: 2 });
    expect(getRecipe('bone_throne').inputs).toEqual({ throne_piece: 5 });
    expect(getRecipe('crypt_flagstones')).toMatchObject({ makesKind: 'floor', inputs: { bone: 8, crystal: 2 } });
    expect(getRecipe('bone_wall')).toMatchObject({ makesKind: 'wall', inputs: { bone: 10, cloth: 4 } });
    for (const r of recipesAt('crafting')) {
      if (r.makesKind === 'furniture') expect(getFurnitureType(r.makes).inCatalog).toBe(false);
      else expect(findStyle(r.makesKind, r.makes)?.inCatalog).toBe(false);
    }
  });

  it('crafting costs more than the item sells for (not the throne: its pieces only come from the boss)', () => {
    for (const r of RECIPES.filter((x) => x.makesKind === 'furniture' && x.id !== 'bone_throne')) { // also the carpentry pieces
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

describe('carpentry (step M-A, MA-1)', () => {
  const IDS = ['plank_stool', 'plank_bench', 'plank_table', 'stone_fireplace', 'glass_lamp', 'brick_oven', 'thatch_rug', 'clay_jug', 'stone_planter', 'lantern_post', 'glass_cabinet', 'brick_pillar'];
  const cells = (id: string) => { const t = getFurnitureType(id); return [t.w / 32, t.d / 32]; };

  it('has the 12 pieces of PLAN-1B with fixed ids and cell sizes, not in the catalog, one recipe each', () => {
    expect(recipesAt('carpentry').map((r) => r.id)).toEqual(IDS);
    expect(recipesAt('carpentry').map((r) => r.makes)).toEqual(IDS);
    expect(cells('plank_stool')).toEqual([1, 1]);
    expect(cells('plank_bench')).toEqual([2, 1]);
    expect(cells('plank_table')).toEqual([2, 2]);
    expect(cells('stone_fireplace')).toEqual([2, 1]);
    expect(cells('glass_lamp')).toEqual([1, 1]);
    expect(cells('brick_oven')).toEqual([2, 1]);
    expect(cells('thatch_rug')).toEqual([2, 2]);
    expect(cells('clay_jug')).toEqual([1, 1]);
    expect(cells('stone_planter')).toEqual([1, 1]);
    expect(cells('lantern_post')).toEqual([1, 1]);
    expect(cells('glass_cabinet')).toEqual([1, 2]);
    expect(cells('brick_pillar')).toEqual([1, 1]);
    for (const id of IDS) {
      const t = getFurnitureType(id);
      expect(t.inCatalog, id).toBe(false);
      expect(RANKS, id).toContain(t.rank);
      expect(FURNITURE_TYPES.filter((x) => x.id === id), id).toHaveLength(1);
    }
    expect(getFurnitureType('plank_stool').seats).toHaveLength(1);
    expect(getFurnitureType('plank_bench').seats).toHaveLength(2);
    expect(getFurnitureType('plank_table').surface).toBe(true);
    expect(getFurnitureType('clay_jug').onSurface).toBe(true);
    expect(getFurnitureType('thatch_rug').blocks).toBe(false);
    expect(getFurnitureType('brick_oven').placeIn).toBe('shop');
    for (const id of ['stone_fireplace', 'glass_lamp', 'lantern_post']) expect(getFurnitureType(id).light, id).toBeDefined();
  });

  it('every input exists; most are blocks; no gold; at least one block per recipe', () => {
    const blockIds = new Set<string>(BLOCK_TYPES.map((b) => b.id));
    for (const r of recipesAt('carpentry')) {
      for (const id of Object.keys(r.inputs)) expect(isMaterialId(id), id).toBe(true);
      expect(Object.keys(r.inputs).some((id) => blockIds.has(id)), r.id).toBe(true);
      expect(Object.keys(r.inputs), r.id).not.toContain('gold');
    }
  });

  it('RULE: a piece is worth no more than its ingredients (so crafting never beats the catalog or the trader)', () => {
    for (const r of recipesAt('carpentry')) {
      const cost = Object.entries(r.inputs).reduce((a, [id, n]) => a + getMaterialType(id as MaterialId).baseValue * (n ?? 0), 0);
      expect(getFurnitureType(r.makes).baseValue, r.id).toBeLessThanOrEqual(cost);
    }
  });

  it('recipes accept BLOCK ids as inputs and spend them through the ledger (blocks live in Player.materials)', () => {
    const r = getRecipe('plank_bench');
    expect(r.inputs).toEqual({ planks: 4, cloth: 1 });
    const s = withMaterials({ planks: 5, cloth: 1 });
    expect(canCraft(r, s)).toBe(true);
    expect(canCraft(r, withMaterials({ planks: 3, cloth: 1 }))).toBe(false);
    const next = craft(r, s, 7)!;
    expect(next.player.materials).toEqual({ planks: 1 });
    expect(next.items.filter((i) => i.typeId === 'plank_bench' && i.roomId === null)).toHaveLength(1);
    expect(next.ledger.at(-1)).toMatchObject({ reason: 'craft', materials: { planks: -4, cloth: -1 } });
    expect(next.player.wallet.gold).toBe(s.player.wallet.gold);
    expect(JSON.stringify(next.player.seen)).toContain('plank_bench');
  });

  it('every carpentry recipe can be crafted from exactly its inputs', () => {
    for (const r of recipesAt('carpentry')) {
      const next = craft(r, withMaterials({ ...r.inputs }), 1);
      expect(next, r.id).not.toBeNull();
      expect(next!.player.materials, r.id).toEqual({});
    }
  });
});
