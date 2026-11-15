import { describe, expect, it } from 'vitest';
import { applyChange } from './ledger.ts';
import { EMPTY_MENU_HELP, menuIsEmpty, priceCeiling, priceHint, priceStep, stepMenuPrice, stepPrice, toggleMenu } from './menuEdit.ts';
import { createNewPlayer } from './newPlayer.ts';
import { menuEntry, menuOffers, menuRows } from './tavern.ts';
import type { GameState } from './gameState.ts';

const fresh = (): GameState => createNewPlayer(undefined, 1000);
const give = (s: GameState, m: Record<string, number>): GameState => applyChange(s, { reason: 'debug', materials: m }, 1000)!;

describe('the Menu panel rules (step 9t C)', () => {
  it('the stepper moves by 10% of the baseValue, at least 1, between 1 and 3 x the baseValue', () => {
    expect(priceStep(9)).toBe(1);
    expect(priceStep(140)).toBe(14);
    expect(stepPrice(9, 9, 1)).toBe(10);
    expect(stepPrice(1, 9, -1)).toBe(1);
    expect(stepPrice(priceCeiling(9), 9, 1)).toBe(27);
    expect(stepPrice(100, 140, -1)).toBe(86);
  });

  it('on/off: drinks start on, dishes start off (a new game has the early dish roasted turnip on, S3); the switch flips and is saved in the menu', () => {
    let s = give({ ...fresh(), tavern: { ...fresh().tavern, menu: {} } }, { root_ale: 3, roasted_turnip: 2 });
    const on = (id: string) => menuRows(s).find((r) => r.id === id)!.on;
    expect([on('root_ale'), on('roasted_turnip')]).toEqual([true, false]);
    s = toggleMenu(s, 'roasted_turnip')!;
    s = toggleMenu(s, 'root_ale')!;
    expect([on('root_ale'), on('roasted_turnip')]).toEqual([false, true]);
    expect(menuOffers(s).map((o) => o.id)).toEqual(['roasted_turnip']);
    expect(toggleMenu(s, 'turnip')).toBeNull(); // a crop is not servable
  });

  it('the price stepper changes the price on the menu; the entry keeps its on/off', () => {
    let s = give(fresh(), { root_ale: 3 });
    s = stepMenuPrice(s, 'root_ale', 1)!;
    s = stepMenuPrice(s, 'root_ale', 1)!;
    expect(menuEntry(s.tavern, 'root_ale')).toEqual({ on: true, price: 11 });
    for (let i = 0; i < 40; i++) s = stepMenuPrice(s, 'root_ale', -1)!;
    expect(menuEntry(s.tavern, 'root_ale').price).toBe(1);
    expect(stepMenuPrice(s, 'turnip', 1)).toBeNull();
  });

  it('out of stock means off the menu (guests cannot order it), though the row stays when it was set', () => {
    let s = give(fresh(), { root_ale: 1 });
    expect(menuOffers(s)).toHaveLength(1);
    s = applyChange(s, { reason: 'debug', materials: { root_ale: -1 } }, 1000)!;
    expect(menuOffers(s)).toEqual([]);
    expect(menuIsEmpty(s)).toBe(true);
    expect(EMPTY_MENU_HELP).toMatch(/brew/i);
    expect(EMPTY_MENU_HELP).toMatch(/cook/i);
    s = toggleMenu(s, 'root_ale')!; // set once: the row stays with stock 0
    expect(menuRows(s).find((r) => r.id === 'root_ale')?.stock).toBe(0);
  });

  it('the price hint shows the four faces from cheap to too high', () => {
    expect([priceHint(2, 10).face, priceHint(10, 10).face, priceHint(12, 10).face, priceHint(30, 10).face]).toEqual(['big_smile', 'smile', 'shrug', 'frown']);
    expect(priceHint(10, 10).text.length).toBeGreaterThan(10);
  });
});
