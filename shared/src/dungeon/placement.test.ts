import { describe, expect, it } from 'vitest';
import { generateFloor } from './generate.ts';
import { blockAt } from './grid.ts';
import { cobwebCorner, floorFn, isOpenBlock, torchAllowed } from './placement.ts';

const seeds = Array.from({ length: 100 }, (_, i) => i * 7919 + 13);
const plans = seeds.flatMap((s) => [generateFloor(s, 1, 1), generateFloor(s, 2, 2)]);

describe('prop placement (OA-9, 100 seeds)', () => {
  it('a campfire always stands on an open block (never in or against a wall)', () => {
    let seen = 0;
    for (const { map } of plans) {
      const floor = floorFn(map);
      for (const d of map.decor ?? []) {
        if (d.kind !== 'campfire') continue;
        seen++;
        expect(isOpenBlock(floor, d), `seed ${map.seed} ${d.c},${d.r}`).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('a cobweb is always in a corner', () => {
    let seen = 0;
    for (const { map } of plans) {
      const floor = floorFn(map);
      for (const d of map.decor ?? []) {
        if (d.kind !== 'cobweb') continue;
        seen++;
        expect(cobwebCorner(floor, d), `seed ${map.seed} ${d.c},${d.r}`).not.toBeNull();
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('no prop stands on a chest block, and the floor records its chest blocks', () => {
    for (const { map, chests } of plans) {
      const cells = (map.chestBlocks ?? []).map((b) => `${b.c},${b.r}`);
      expect(cells.length).toBe(chests.length);
      for (const c of chests) expect(cells).toContain(`${blockAt(c).c},${blockAt(c).r}`);
      for (const d of map.decor ?? []) expect(cells, `seed ${map.seed}`).not.toContain(`${d.c},${d.r}`);
    }
  });

  it('a torch is never allowed above a chest block', () => {
    expect(torchAllowed({ c: 3, r: 4 }, [{ c: 3, r: 4 }])).toBe(false);
    expect(torchAllowed({ c: 3, r: 5 }, [{ c: 3, r: 4 }])).toBe(true);
  });
});
