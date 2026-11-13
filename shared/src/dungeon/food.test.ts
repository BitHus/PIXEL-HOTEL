import { describe, expect, it } from 'vitest';
import { createNewPlayer } from '../newPlayer.ts';
import { applyChange } from '../ledger.ts';
import { seededRng } from '../rng.ts';
import { ledgerGold, ledgerMaterials } from '../testState.ts';
import type { MaterialId } from '../types.ts';
import { finishRun, packLunch, startRun } from './bank.ts';
import { step } from './step.ts';
import { enemyAt, testRun } from './testRun.ts';
import type { DungeonRun } from './run.ts';

const withGoods = (m: Partial<Record<MaterialId, number>>) => applyChange(createNewPlayer(undefined, 0), { reason: 'debug', materials: m }, 0)!;
const eat = (r: DungeonRun): DungeonRun => step(r, [{ t: 'eat' }], 0, seededRng(1));

describe('the lunch box (section 10b)', () => {
  it('holds at most 3 food items, only food the player has', () => {
    const s = withGoods({ potato_stew: 2, roasted_turnip: 5, turnip: 4 });
    expect(packLunch(s, ['potato_stew', 'potato_stew', 'potato_stew', 'roasted_turnip'])).toEqual(['potato_stew', 'potato_stew', 'roasted_turnip']);
    expect(packLunch(s, ['turnip', 'roasted_turnip', 'roasted_turnip', 'roasted_turnip', 'roasted_turnip'])).toEqual([
      'roasted_turnip',
      'roasted_turnip',
      'roasted_turnip',
    ]);
    const { state, run } = startRun(s, 5, 1, 1, ['potato_stew', 'roasted_turnip', 'roasted_turnip', 'roasted_turnip']);
    expect(run.player.food).toEqual(['potato_stew', 'roasted_turnip', 'roasted_turnip']);
    expect(state.player.materials).toMatchObject({ potato_stew: 1, roasted_turnip: 3 });
    expect(ledgerMaterials(state)).toEqual(state.player.materials);
  });

  it('healing food heals and shares the potion cooldown', () => {
    let r = testRun({ potions: 1 });
    r = { ...r, player: { ...r.player, hp: 10, food: ['potato_stew', 'roasted_turnip'] } };
    r = eat(r);
    expect(r.player).toMatchObject({ hp: 25, food: ['roasted_turnip'] });
    expect(r.events).toEqual([{ t: 'eat', food: 'potato_stew', healed: 15, buff: null }]);
    // The cooldown (1 s) is shared with potions.
    expect(eat(r).player.hp).toBe(25);
    expect(step(r, [{ t: 'drink_potion' }], 0, seededRng(1)).player.potions).toBe(1);
    r = step(r, [], 1000, seededRng(1));
    expect(eat(r).player).toMatchObject({ hp: 30, food: [] });
  });

  it('does not eat healing food at full hp', () => {
    let r = testRun();
    r = { ...r, player: { ...r.player, food: ['roasted_turnip'] } };
    expect(eat(r).player.food).toEqual(['roasted_turnip']);
  });

  it('each buff applies once per run', () => {
    let r = testRun();
    r = { ...r, player: { ...r.player, food: ['carrot_soup', 'carrot_soup', 'pumpkin_pie', 'pumpkin_pie', 'glowcap_broth'] } };
    const before = r.player;
    r = eat(r);
    expect(r.player).toMatchObject({ attackMin: before.attackMin + 1, attackMax: before.attackMax + 1, buffs: ['attack'] });
    // The second soup does nothing now: the pie is next.
    r = eat(r);
    expect(r.player).toMatchObject({ maxHp: before.maxHp + 10, hp: before.hp + 10, attackMin: before.attackMin + 1 });
    r = eat(r);
    expect(r.player.attackCooldownMs).toBe(300);
    expect(r.player.food).toEqual(['carrot_soup', 'pumpkin_pie']);
    expect(eat(r).player).toEqual(r.player);
    expect(r.player.buffs).toEqual(['attack', 'max_hp', 'attack_cooldown']);
  });

  it('glowcap broth makes hits come every 300 ms', () => {
    let r = testRun({ enemies: [enemyAt(1, 100, 100, 'slime', 99)], at: { x: 80, y: 100 } });
    r = { ...r, player: { ...r.player, food: ['glowcap_broth'] } };
    r = eat(r);
    r = step(r, [{ t: 'click_enemy', id: 1 }], 0, seededRng(1));
    expect(r.player.attackReadyAt).toBe(r.timeMs + 300);
  });

  it('the max hp from a pie stays after a level up', () => {
    let r = testRun({ xp: 14, enemies: [enemyAt(1, 100, 100, 'slime', 1)], at: { x: 80, y: 100 } });
    r = { ...r, player: { ...r.player, food: ['pumpkin_pie'] } };
    r = eat(r);
    r = step(r, [{ t: 'click_enemy', id: 1 }], 0, seededRng(1));
    expect(r.player).toMatchObject({ level: 2, maxHp: 33 + 10, hp: 43 });
  });

  it('food in the lunch box is lost on death; uneaten food comes home after leaving', () => {
    const s = withGoods({ potato_stew: 2 });
    const started = startRun(s, 5, 1, 1, ['potato_stew', 'potato_stew']);
    let dead: DungeonRun = { ...started.run, player: { ...started.run.player, hp: 1 }, enemies: [enemyAt(1, started.run.player.x + 20, started.run.player.y, 'skeleton', 99)] };
    dead = step(dead, [], 3000, seededRng(1));
    expect(dead.status).toBe('dead');
    expect(dead.player.food).toEqual([]);
    expect(dead.lost.slots).toContainEqual({ kind: 'material', id: 'potato_stew', qty: 2 });
    const afterDeath = finishRun(started.state, dead, 2)!;
    expect(afterDeath.player.materials.potato_stew).toBeUndefined();

    const left: DungeonRun = { ...started.run, status: 'left', player: { ...started.run.player, food: ['potato_stew'] } };
    const home = finishRun(started.state, left, 2)!;
    expect(home.player.materials.potato_stew).toBe(1);
    for (const x of [afterDeath, home]) {
      expect(ledgerMaterials(x)).toEqual(x.player.materials);
      expect(ledgerGold(x)).toBe(x.player.wallet.gold);
    }
  });
});

describe('the glowcap spore', () => {
  it('drops from about 5% of opened chests', () => {
    let spores = 0;
    const n = 2000;
    for (let seed = 1; seed <= n; seed++) {
      const chest = { id: 1, kind: 'wooden' as const, mimic: false, opened: false, x: 80, y: 80 };
      const r = step(testRun({ at: { x: 80, y: 80 }, chests: [chest] }), [], 100, seededRng(seed));
      expect(r.chests[0]?.opened).toBe(true);
      if (r.bag.slots.some((s) => s.kind === 'material' && s.id === 'glowcap_spore')) spores++;
    }
    expect(spores / n).toBeGreaterThan(0.03);
    expect(spores / n).toBeLessThan(0.07);
  });
});
