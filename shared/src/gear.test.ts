import { describe, expect, it } from 'vitest';
import { buyGear } from './economy.ts';
import { getGear, POTION } from './gear.ts';
import { createNewPlayer } from './newPlayer.ts';
import type { GameState } from './gameState.ts';

function rich(gold = 1000): GameState {
  const s = createNewPlayer();
  return { ...s, player: { ...s.player, wallet: { gold } } };
}

describe('gear (section 10)', () => {
  it('has the prices and effects of section 10', () => {
    expect(getGear('iron_sword')).toMatchObject({ price: 150, attackMin: 6, attackMax: 8 });
    expect(getGear('leather_armor')).toMatchObject({ price: 120, damageReduction: 1, minDamage: 1 });
    expect(POTION).toMatchObject({ price: 20, heal: 15, cooldownMs: 1000, carryMax: 3 });
  });

  it('buyGear buys gear once, through the ledger', () => {
    const s = buyGear(rich(), 'iron_sword', 1)!;
    expect(s.player.gear).toEqual(['iron_sword']);
    expect(s.player.wallet.gold).toBe(850);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'blacksmith', goldDelta: -150 });
    expect(buyGear(s, 'iron_sword', 2)).toBeNull();
    expect(buyGear(rich(100), 'leather_armor', 1)).toBeNull();
  });

  it('potions cap at 3', () => {
    let s = rich();
    for (let i = 0; i < 3; i++) s = buyGear(s, 'health_potion', i)!;
    expect(s.player.potions).toBe(3);
    expect(s.player.wallet.gold).toBe(940);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'potion', goldDelta: -20 });
    expect(buyGear(s, 'health_potion', 4)).toBeNull();
  });
});
