import { describe, expect, it } from 'vitest';
import { canCook, cook, FOOD_TYPES } from './cooking.ts';
import { createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { lootCategory } from './shop.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { MaterialId } from './types.ts';

const withGoods = (m: Partial<Record<MaterialId, number>>) => applyChange(createNewPlayer(undefined, 0), { reason: 'debug', materials: m }, 0)!;

describe('cooking (section 10b)', () => {
  it('has the five recipes from food.json', () => {
    expect(FOOD_TYPES.map((f) => [f.id, f.inputs, f.effect])).toEqual([
      ['roasted_turnip', { turnip: 1 }, { kind: 'heal', amount: 8 }],
      ['potato_stew', { potato: 2, turnip: 1 }, { kind: 'heal', amount: 15 }],
      ['carrot_soup', { carrot: 2, potato: 1 }, { kind: 'attack', amount: 1 }],
      ['pumpkin_pie', { pumpkin: 1, carrot: 1 }, { kind: 'max_hp', amount: 10 }],
      ['glowcap_broth', { glowcap: 1, potato: 1 }, { kind: 'attack_cooldown', amount: 300 }],
    ]);
  });

  it('needs every ingredient', () => {
    const s = withGoods({ potato: 2 });
    expect(canCook(FOOD_TYPES[1]!, s)).toBe(false);
    expect(cook(s, 'potato_stew', 1)).toBeNull();
    expect(cook(withGoods({ potato: 1, turnip: 1 }), 'potato_stew', 1)).toBeNull();
  });

  it('uses the ingredients exactly once and puts the food in the bag; the ledger adds up', () => {
    const s = withGoods({ potato: 3, turnip: 2 });
    const once = cook(s, 'potato_stew', 1)!;
    expect(once.player.materials).toMatchObject({ potato: 1, turnip: 1, potato_stew: 1 });
    expect(cook(once, 'potato_stew', 2)).toBeNull();
    expect(once.ledger.at(-1)).toMatchObject({ reason: 'cook', materials: { potato_stew: 1, potato: -2, turnip: -1 } });
    expect(ledgerMaterials(once)).toEqual(once.player.materials);
    expect(ledgerGold(once)).toBe(once.player.wallet.gold);
  });

  it('crops and food are shop goods in the food category; seeds count as materials', () => {
    expect(lootCategory({ kind: 'material', id: 'turnip', qty: 1 })).toBe('food');
    expect(lootCategory({ kind: 'material', id: 'potato_stew', qty: 1 })).toBe('food');
    expect(lootCategory({ kind: 'material', id: 'turnip_seed', qty: 1 })).toBe('materials');
    expect(lootCategory({ kind: 'material', id: 'bone', qty: 1 })).toBe('materials');
  });
});
