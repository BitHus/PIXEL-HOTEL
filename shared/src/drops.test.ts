import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DROP_CAP_PER_ROOM,
  DROP_MAGNET_FAST_PX,
  DROP_MAGNET_PX,
  DROP_PICKUP_DELAY_MS,
  DROP_POP_HEIGHT_PX,
  DROP_POP_MS,
  DROP_SCATTER_MAX_PX,
  DROP_SCATTER_MIN_PX,
  DUNGEON_TICK_MS,
} from './config.ts';
import { dropsLoot, inMagnet, magnetStep, nextDropId, popHeight, scatterArc, spawnDrops, stepDrops, type Drop } from './drops.ts';
import type { Point } from './types.ts';

const TICK = DUNGEON_TICK_MS;
const yes = (): boolean => true;

/** Steps drops for ms (100 ms ticks) with the avatar at `at`; returns the drops left and all picked. */
function run(drops: Drop[], at: Point | ((t: number) => Point), ms: number, take: (d: Drop) => boolean = yes) {
  const picked: Drop[] = [];
  const full: Drop[] = [];
  let left = drops;
  for (let t = 0; t < ms; t += TICK) {
    const s = stepDrops(left, typeof at === 'function' ? at(t) : at, TICK, take);
    left = s.drops;
    picked.push(...s.picked);
    full.push(...s.full);
  }
  return { left, picked, full };
}

describe('drops (OB-8)', () => {
  it('the pop arc is deterministic and lands within the scatter ring', () => {
    expect(scatterArc(7, 1, 3)).toEqual(scatterArc(7, 1, 3));
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e6 }), fc.integer({ min: 1, max: 8 }), (id, n) => {
        const { drops } = spawnDrops({ x: 100, y: 100 }, Array.from({ length: n }, () => ({ item: 'stone', qty: 1 })), id);
        const landed = run(drops, { x: 9999, y: 9999 }, DROP_POP_MS + TICK).left;
        for (const d of landed) {
          expect(d.state).toBe('rest');
          const dist = Math.hypot(d.x - 100, d.y - 100);
          expect(dist).toBeGreaterThanOrEqual(DROP_SCATTER_MIN_PX - 0.01);
          expect(dist).toBeLessThanOrEqual(DROP_SCATTER_MAX_PX + 0.01);
        }
      }),
    );
  });

  it('spawn gives ids from firstId, the item rank by default, skips empty items and caps the count', () => {
    const { drops, overflow } = spawnDrops({ x: 0, y: 0 }, [{ item: 'iron_ore', qty: 2 }, { item: 'stone', qty: 0 }, { item: 'gold', qty: 5, rank: 'rare' }], 10);
    expect(drops.map((d) => d.id)).toEqual([10, 11]);
    expect(drops[1]!.rank).toBe('rare');
    expect(drops[0]!.state).toBe('pop');
    expect(overflow).toEqual([]);
    const many = spawnDrops({ x: 0, y: 0 }, [{ item: 'stone', qty: 1 }, { item: 'coal', qty: 1 }], 1, 1);
    expect(many.drops).toHaveLength(1);
    expect(many.overflow).toEqual([{ item: 'coal', qty: 1 }]);
    expect(spawnDrops({ x: 0, y: 0 }, [{ item: 'stone', qty: 1 }], 1).drops).toHaveLength(Math.min(1, DROP_CAP_PER_ROOM));
    expect(nextDropId(drops, 3)).toBe(12);
    expect(nextDropId([], 3)).toBe(4);
  });

  it('the arc rises and is back on the ground after the pop', () => {
    expect(popHeight({ state: 'pop', ageMs: DROP_POP_MS / 2 })).toBeCloseTo(DROP_POP_HEIGHT_PX);
    expect(popHeight({ state: 'pop', ageMs: 0 })).toBe(0);
    expect(popHeight({ state: 'rest', ageMs: 50 })).toBe(0);
  });

  it('the magnet only pulls inside its radius and after the pickup delay', () => {
    const base: Drop = { id: 1, item: 'stone', qty: 1, rank: 'common', x: 0, y: 0, vx: 0, vy: 0, ageMs: DROP_PICKUP_DELAY_MS, state: 'rest' };
    expect(inMagnet(base, { x: DROP_MAGNET_PX - 1, y: 0 })).toBe(true);
    expect(inMagnet(base, { x: DROP_MAGNET_PX + 1, y: 0 })).toBe(false);
    expect(inMagnet({ ...base, ageMs: DROP_PICKUP_DELAY_MS - 1 }, { x: 1, y: 0 })).toBe(false);
    expect(inMagnet({ ...base, item: 'gem' }, { x: DROP_MAGNET_FAST_PX - 1, y: 0 })).toBe(true);
    expect(inMagnet({ ...base, full: true }, { x: 1, y: 0 })).toBe(false);
    // A drop far away just lies there.
    const far = run([base], { x: 500, y: 0 }, 2000);
    expect(far.picked).toEqual([]);
    expect(far.left[0]!.x).toBe(0);
  });

  it('a drop in reach is picked exactly once, never before the delay', () => {
    const { drops } = spawnDrops({ x: 50, y: 50 }, [{ item: 'copper_ore', qty: 2 }], 1);
    let takes = 0;
    const out = run(drops, { x: 60, y: 60 }, 3000, () => {
      takes++;
      return true;
    });
    expect(takes).toBe(1);
    expect(out.picked).toHaveLength(1);
    expect(out.left).toEqual([]);
    // Not before the delay.
    expect(run(drops, { x: 50, y: 50 }, DROP_PICKUP_DELAY_MS - TICK).picked).toEqual([]);
  });

  it('a fast avatar running past (up to 400 px/s) still picks each drop once, never twice', () => {
    fc.assert(
      fc.property(fc.integer({ min: 40, max: 400 }), fc.integer({ min: 1, max: 6 }), (speed, n) => {
        const { drops } = spawnDrops({ x: 200, y: 100 }, Array.from({ length: n }, (_, i) => ({ item: i % 2 ? 'gem' : 'stone', qty: 1 })), 1);
        const ids: number[] = [];
        const out = run(drops, (t) => ({ x: Math.min(200, 120 + (speed * t) / 1000), y: 100 }), 6000, (d) => {
          ids.push(d.id);
          return true;
        });
        expect(new Set(ids).size).toBe(ids.length);
        expect(out.picked.length + out.left.length).toBe(n);
        expect(out.left).toEqual([]);
      }),
    );
  });

  it('magnetStep never overshoots and gold and gems curve in', () => {
    const d: Drop = { id: 1, item: 'gem', qty: 1, rank: 'common', x: 0, y: 0, vx: 0, vy: 0, ageMs: 500, state: 'rest' };
    const near = magnetStep(d, { x: 3, y: 0 }, TICK);
    expect(near.x).toBe(3);
    const curved = magnetStep(d, { x: 60, y: 0 }, TICK);
    expect(curved.y).not.toBe(0);
    const straight = magnetStep({ ...d, item: 'stone' }, { x: 40, y: 0 }, TICK);
    expect(straight.y).toBe(0);
    expect(straight.x).toBeGreaterThan(0);
  });

  it('a full bag keeps the drop on the ground, reports it once, and it can be taken later', () => {
    const { drops } = spawnDrops({ x: 0, y: 0 }, [{ item: 'stone', qty: 1 }], 1);
    const out = run(drops, { x: 0, y: 0 }, 2000, () => false);
    expect(out.picked).toEqual([]);
    expect(out.full).toHaveLength(1);
    expect(out.left).toHaveLength(1);
    expect(out.left[0]!.full).toBe(true);
    // It stops flying: walking away leaves it where it lies.
    const away = run(out.left, { x: 30, y: 0 }, 1000);
    expect(away.picked).toEqual([]);
    // Walking onto it again offers it again.
    const back = run(away.left, away.left[0]!, TICK);
    expect(back.picked).toHaveLength(1);
  });

  it('the sweep turns drops into loot with their rank', () => {
    const { drops } = spawnDrops({ x: 0, y: 0 }, [{ item: 'iron_ore', qty: 3, rank: 'rare' }, { item: 'gem', qty: 1 }], 1);
    expect(dropsLoot(drops)).toEqual([
      { item: 'iron_ore', qty: 3, rank: 'rare' },
      { item: 'gem', qty: 1, rank: drops[1]!.rank },
    ]);
  });
});
