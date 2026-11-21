// OB-8 wiring: dig-mine ore and crypt kill drops land on the ground, the magnet takes them into the bag, leaving
// sweeps them up, death in the crypt loses them. The totals do not change, only the route into the bag.

import { describe, expect, it } from 'vitest';
import { DIG_COLS, PICKAXE_COOLDOWN_MS } from '../config.ts';
import type { Drop } from '../drops.ts';
import { seededRng } from '../rng.ts';
import { blockCenter } from './grid.ts';
import type { MineBlockId } from './mineBlocks.ts';
import { newDigRun, type DungeonRun } from './run.ts';
import { step } from './step.ts';
import { B, enemyAt, testRun } from './testRun.ts';

const idx = (c: number, r: number): number => r * DIG_COLS + c;

/** A dig run with an open row (10..12, 10) and these ore blocks to the east (13.., 10). */
function digRun(ores: MineBlockId[]): DungeonRun {
  const r0 = newDigRun({ seed: 7, xp: 0, gear: [], potions: 0 });
  const kinds = r0.dig!.kinds.map((k) => (k === '' ? 'stone' : k)) as (MineBlockId | '')[];
  for (const c of [10, 11, 12]) kinds[idx(c, 10)] = '';
  ores.forEach((k, i) => (kinds[idx(13 + i, 10)] = k));
  const blocks = kinds.map((k) => (k === '' ? 'floor' : 'wall')) as ('floor' | 'wall')[];
  const at = blockCenter(12, 10);
  return { ...r0, enemies: [], dig: { ...r0.dig!, kinds, hazards: [], rare: [] }, map: { ...r0.map, blocks, exit: { c: 40, r: 60 }, spawn: at }, player: { ...r0.player, x: at.x, y: at.y } };
}

/** Digs the ore row east, one block after the other; `wait` = ms of standing still after each break. */
function digAll(r0: DungeonRun, n: number, wait: number): DungeonRun {
  let r = r0;
  const s = seededRng(5);
  for (let i = 0; i < n; i++) {
    const cell = idx(13 + i, 10);
    for (let k = 0; k < 80 && r.dig!.kinds[cell] !== ''; k++) r = step(r, [{ t: 'click_dig', c: 13 + i, r: 10 }], PICKAXE_COOLDOWN_MS, s);
    if (wait > 0) r = step(r, [], wait, s);
  }
  return r;
}

const total = (bag: DungeonRun['bag'], id: string): number => bag.slots.reduce((a, x) => a + (x.kind === 'material' && x.id === id ? x.qty : 0), 0);

describe('ground drops in a run (OB-8 J2)', () => {
  it('parity: the same ore is banked whether the magnet takes it or the leave sweep does', () => {
    const ores: MineBlockId[] = ['coal', 'copper', 'iron', 'coal', 'copper'];
    const picked = step(digAll(digRun(ores), ores.length, 1500), [{ t: 'leave' }], 0, seededRng(1));
    const swept = step(digAll(digRun(ores), ores.length, 0), [{ t: 'leave' }], 0, seededRng(1));
    for (const id of ['coal', 'copper_ore', 'iron_ore']) {
      expect(total(picked.banked, id), id).toBe(total(swept.banked, id));
      expect(total(picked.banked, id), id).toBeGreaterThan(0);
    }
    expect(picked.drops).toEqual([]);
    expect(swept.drops).toEqual([]);
  });

  it('every drop event reaches the bag exactly once (no duplicates, nothing missing)', () => {
    const ores: MineBlockId[] = ['coal', 'copper', 'iron'];
    let r = digRun(ores);
    const s = seededRng(3);
    const dropped = new Map<string, number>();
    const looted = new Map<string, number>();
    const count = (x: DungeonRun): void => {
      for (const e of x.events) {
        if (e.t === 'drop') dropped.set(e.item, (dropped.get(e.item) ?? 0) + e.qty);
        if (e.t === 'loot') looted.set(e.item, (looted.get(e.item) ?? 0) + e.qty);
      }
    };
    for (let i = 0; i < ores.length; i++) {
      for (let k = 0; k < 80 && r.dig!.kinds[idx(13 + i, 10)] !== ''; k++) {
        r = step(r, [{ t: 'click_dig', c: 13 + i, r: 10 }], PICKAXE_COOLDOWN_MS, s);
        count(r);
      }
    }
    for (let k = 0; k < 20; k++) {
      r = step(r, [], 100, s);
      count(r);
    }
    expect(r.drops).toEqual([]);
    expect([...looted.entries()].sort()).toEqual([...dropped.entries()].sort());
  });

  it('a crypt kill drop lands at the enemy and the magnet brings it in', () => {
    const at = { x: 3 * B + 16, y: 3 * B + 16 };
    let r = testRun({ at, enemies: [enemyAt(1, at.x + 24, at.y, 'slime', 1)] });
    const zero = (): number => 0; // the drop chance and the table roll both hit
    r = step(r, [{ t: 'click_enemy', id: 1 }], 0, zero);
    r = step(r, [], 100, zero);
    expect(r.events.some((e) => e.t === 'kill') || r.enemies.length === 0).toBe(true);
    expect(r.drops?.length ?? 0).toBeGreaterThan(0);
    const item = r.drops![0]!.item;
    r = step(r, [], 1500, zero);
    expect(r.drops).toEqual([]);
    expect(r.bag.slots.length + r.bag.gold).toBeGreaterThan(0);
    expect(item).not.toBe('gold');
  });

  it('death in the crypt loses the drops on the floor', () => {
    const lying: Drop = { id: 1, item: 'bone', qty: 2, rank: 'common', x: 300, y: 300, vx: 0, vy: 0, ageMs: 0, state: 'rest' };
    const r = step({ ...testRun(), drops: [lying] }, [{ t: 'abandon' }], 0, seededRng(1));
    expect(r.status).toBe('dead');
    expect(r.drops).toEqual([]);
    expect(total(r.lost, 'bone')).toBe(2);
    expect(total(r.banked, 'bone')).toBe(0);
  });

  it('a saved run from before drops (no drops field) steps as before', () => {
    const r = testRun();
    expect('drops' in r).toBe(false);
    const next = step(r, [], 500, seededRng(1));
    expect(next.drops ?? []).toEqual([]);
  });
});
