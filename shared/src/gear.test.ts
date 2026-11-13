import { describe, expect, it } from 'vitest';
import { buyGear } from './economy.ts';
import { getPiece, ownedArmor, ownedPickaxe, ownedWeapon, POTION } from './gear.ts';
import { FORGE, canForge, forgePiece, nextPiece, smelt } from './forge.ts';
import { createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { combatStats } from './dungeon/run.ts';
import { lootCategory } from './shop.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';
import type { MaterialId } from './types.ts';

function rich(gold = 1000, materials: Partial<Record<MaterialId, number>> = {}): GameState {
  return applyChange(createNewPlayer(), { reason: 'debug', gold: gold - 100, materials }, 0)!;
}
const addsUp = (s: GameState): void => {
  expect(ledgerGold(s)).toBe(s.player.wallet.gold);
  expect(ledgerMaterials(s)).toEqual(s.player.materials);
};

describe('the Blacksmith (section 10, after step 9c: potions only)', () => {
  it('sells potions, at most 3', () => {
    expect(POTION).toMatchObject({ price: 20, heal: 15, cooldownMs: 1000, carryMax: 3 });
    let s = rich();
    for (let i = 0; i < 3; i++) s = buyGear(s, 'health_potion', i)!;
    expect(s.player.potions).toBe(3);
    expect(s.player.wallet.gold).toBe(940);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'potion', goldDelta: -20 });
    expect(buyGear(s, 'health_potion', 4)).toBeNull();
    // Swords and armor are no longer for sale.
    expect(buyGear(rich(), 'iron_sword' as never, 1)).toBeNull();
  });
});

describe('the forge (section 10c)', () => {
  it('has the tiers of section 10c', () => {
    expect(getPiece('copper_sword')).toMatchObject({ attackMin: 5, attackMax: 7, needs: null, bars: { copper_bar: 4 } });
    expect(getPiece('iron_sword')).toMatchObject({ attackMin: 7, attackMax: 9, needs: 'copper_sword', bars: { iron_bar: 5 } });
    expect(getPiece('mithril_sword')).toMatchObject({ attackMin: 9, attackMax: 12, needs: 'iron_sword', bars: { mithril_bar: 5 } });
    expect(getPiece('leather_armor')).toMatchObject({ damageReduction: 1, needs: null, bars: { copper_bar: 3 } });
    expect(getPiece('iron_armor')).toMatchObject({ damageReduction: 2, needs: 'leather_armor', bars: { iron_bar: 5 } });
    expect(getPiece('mithril_armor')).toMatchObject({ damageReduction: 3, needs: 'iron_armor', bars: { mithril_bar: 5 } });
    expect(getPiece('steel_pickaxe')).toMatchObject({ hitsPerSwing: 2, minesMithril: true, bars: { iron_bar: 5, copper_bar: 2 } });
    expect(FORGE.smelting).toEqual([
      { bar: 'copper_bar', ore: 'copper_ore', fee: 2 },
      { bar: 'iron_bar', ore: 'iron_ore', fee: 4 },
      { bar: 'mithril_bar', ore: 'mithril_ore', fee: 8 },
    ]);
  });

  it('smelting needs 3 ore and the fee, through the ledger', () => {
    expect(smelt(rich(1000, { copper_ore: 2 }), 'copper_bar', 1)).toBeNull();
    expect(smelt(rich(1, { iron_ore: 3 }), 'iron_bar', 1)).toBeNull();
    const s = smelt(rich(100, { copper_ore: 7 }), 'copper_bar', 1)!;
    expect(s.player.materials).toMatchObject({ copper_ore: 4, copper_bar: 1 });
    expect(s.player.wallet.gold).toBe(98);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'smelt', goldDelta: -2 });
    addsUp(s);
  });

  it('an upgrade needs the piece before it and replaces it', () => {
    let s = rich(100, { copper_bar: 9, iron_bar: 10 });
    expect(canForge(s, 'iron_sword')).toBe(false); // no copper sword yet
    expect(forgePiece(s, 'iron_sword', 1)).toBeNull();
    s = forgePiece(s, 'copper_sword', 1)!;
    expect(s.player.gear).toEqual(['copper_sword']);
    expect(forgePiece(s, 'copper_sword', 2)).toBeNull(); // not twice
    s = forgePiece(s, 'iron_sword', 2)!;
    expect(s.player.gear).toEqual(['iron_sword']);
    expect(nextPiece(s.player.gear, 'weapon')?.id).toBe('mithril_sword');
    expect(forgePiece(s, 'mithril_sword', 3)).toBeNull(); // no mithril bars
    s = forgePiece(s, 'leather_armor', 3)!;
    expect(s.player.gear).toEqual(['iron_sword', 'leather_armor']);
    expect(s.player.materials).toMatchObject({ copper_bar: 2, iron_bar: 5 });
    s = forgePiece(s, 'steel_pickaxe', 4)!;
    expect(ownedPickaxe(s.player.gear)?.id).toBe('steel_pickaxe');
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'forge', materials: { iron_bar: -5, copper_bar: -2 } });
    addsUp(s);
  });

  it('old saves keep their bought iron sword and leather armor as those tiers', () => {
    expect(ownedWeapon(['iron_sword'])?.attackMin).toBe(7);
    expect(ownedArmor(['leather_armor'])?.damageReduction).toBe(1);
    expect(nextPiece(['iron_sword', 'leather_armor'], 'armor')?.id).toBe('iron_armor');
  });

  it('the dungeon uses the attack range and damage reduction of the tier', () => {
    expect(combatStats(1, [])).toMatchObject({ attackMin: 4, attackMax: 6, damageReduction: 0 });
    expect(combatStats(1, ['copper_sword'])).toMatchObject({ attackMin: 5, attackMax: 7 });
    expect(combatStats(1, ['mithril_sword', 'mithril_armor'])).toMatchObject({ attackMin: 9, attackMax: 12, damageReduction: 3, minDamage: 1 });
  });

  it('ore, bars and gems are shop goods in the materials category', () => {
    for (const id of ['copper_ore', 'iron_bar', 'gem'] as const) expect(lootCategory({ kind: 'material', id, qty: 1 })).toBe('materials');
  });
});
