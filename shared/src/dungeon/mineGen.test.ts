import { describe, expect, it } from 'vitest';
import { DIG_COLS, DIG_DEPTH_MAX, DIG_EXIT_MIN_DIST, DIG_POCKETS_MAX, DIG_POCKETS_MIN, DIG_RARE_MAX, DIG_RARE_ROUTE_GAP, DIG_ROUTE_HITS_MAX, DIG_ROWS, DIG_SPAWN_CLEAR } from '../config.ts';
import { blockAt } from './grid.ts';
import { blockWeight, getMineBlock, MINE_BLOCKS, rareWeights, veinWeights } from './mineBlocks.ts';
import { blockSteps, cheapestRoute, generateDigMine } from './mineGen.ts';

const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 37);
const cellOf = (p: { x: number; y: number }): number => {
  const b = blockAt(p);
  return b.r * DIG_COLS + b.c;
};

describe('generateDigMine', () => {
  it('is deterministic: the same seed and depth give the same cave, another seed another', () => {
    const a = generateDigMine(42, 1);
    const b = generateDigMine(42, 1);
    expect(b.dig.kinds).toEqual(a.dig.kinds);
    expect(b.map.spawn).toEqual(a.map.spawn);
    expect(b.enemies).toEqual(a.enemies);
    expect(generateDigMine(43, 1).dig.kinds).not.toEqual(a.dig.kinds);
    expect(generateDigMine(42, 2).dig.kinds).not.toEqual(a.dig.kinds);
  });

  it('golden seed 1234, depth 1: the cave keeps its shape (repin only when generation changes on purpose)', () => {
    const p = generateDigMine(1234, 1);
    const counts: Record<string, number> = {};
    for (const k of p.dig.kinds) counts[k || 'open'] = (counts[k || 'open'] ?? 0) + 1;
    expect({ spawn: p.map.spawn, exit: p.map.exit, pockets: p.pockets.length, enemies: p.enemies.length, hazards: p.dig.hazards.length, counts }).toEqual({
      spawn: { x: 592, y: 240 },
      exit: { c: 37, r: 56 },
      pockets: 4,
      enemies: 4,
      hazards: 5,
      counts: { bedrock: 220, dirt: 82, clay: 56, stone: 2543, open: 75, copper: 43, iron: 24, coal: 29 },
    });
  });

  it('is a DIG_COLS x DIG_ROWS cave with a bedrock border, floor = open, open spawn and exit', () => {
    for (const seed of SEEDS) {
      const p = generateDigMine(seed, 1);
      expect(p.map.cols).toBe(DIG_COLS);
      expect(p.map.rows).toBe(DIG_ROWS);
      expect(p.map.dig).toBe(true);
      for (let c = 0; c < DIG_COLS; c++) {
        expect(p.dig.kinds[c]).toBe('bedrock');
        expect(p.dig.kinds[(DIG_ROWS - 1) * DIG_COLS + c]).toBe('bedrock');
      }
      for (let r = 0; r < DIG_ROWS; r++) {
        expect(p.dig.kinds[r * DIG_COLS]).toBe('bedrock');
        expect(p.dig.kinds[r * DIG_COLS + DIG_COLS - 1]).toBe('bedrock');
      }
      p.dig.kinds.forEach((k, i) => expect(p.map.blocks[i]).toBe(k === '' ? 'floor' : 'wall'));
      expect(p.dig.kinds[cellOf(p.map.spawn)]).toBe('');
      expect(p.dig.kinds[p.map.exit.r * DIG_COLS + p.map.exit.c]).toBe('');
      expect(p.chests).toEqual([]);
      expect(p.rocks).toEqual([]);
    }
  });

  it('has DIG_POCKETS_MIN to DIG_POCKETS_MAX pockets and the exit far from the spawn', () => {
    for (const seed of SEEDS) {
      const p = generateDigMine(seed, 1);
      expect(p.pockets.length).toBeGreaterThanOrEqual(DIG_POCKETS_MIN);
      expect(p.pockets.length).toBeLessThanOrEqual(DIG_POCKETS_MAX);
      const exit = p.map.exit.r * DIG_COLS + p.map.exit.c;
      expect(blockSteps(cellOf(p.map.spawn), exit)).toBeGreaterThanOrEqual(DIG_EXIT_MIN_DIST);
    }
  });

  it('always has a way to the exit that bare hands can dig: no hard block, no bedrock, cheap enough', () => {
    for (const seed of SEEDS) {
      for (const depth of [1, 4, DIG_DEPTH_MAX]) {
        const p = generateDigMine(seed, depth);
        const spawn = cellOf(p.map.spawn);
        const exit = p.map.exit.r * DIG_COLS + p.map.exit.c;
        const route = cheapestRoute(p.dig.kinds, spawn, exit)!;
        expect(route[0]).toBe(spawn);
        expect(route.at(-1)).toBe(exit);
        let hits = 0;
        for (const cell of route) {
          const k = p.dig.kinds[cell]!;
          if (k === '') continue;
          const b = getMineBlock(k);
          expect(b.unbreakable).toBeFalsy();
          expect(b.hard).toBeFalsy();
          hits += b.hits;
        }
        expect(hits).toBeLessThanOrEqual(DIG_ROUTE_HITS_MAX);
        expect(p.route).toEqual(route);
      }
    }
  });

  it('puts 0 to DIG_RARE_MAX rare blocks off the route (none at depth 1), far from the spawn', () => {
    let some = 0;
    for (const seed of SEEDS) {
      expect(generateDigMine(seed, 1).dig.rare).toEqual([]);
      const p = generateDigMine(seed, 4);
      expect(p.dig.rare.length).toBeLessThanOrEqual(DIG_RARE_MAX);
      if (p.dig.rare.length > 0) some++;
      for (const cell of p.dig.rare) {
        expect(getMineBlock(p.dig.kinds[cell] as 'crystal').rare).toBe(true);
        const near = Math.min(...p.route.map((r) => blockSteps(r, cell)));
        expect(near).toBeGreaterThanOrEqual(DIG_RARE_ROUTE_GAP);
        expect(blockSteps(cell, cellOf(p.map.spawn))).toBeGreaterThanOrEqual(DIG_SPAWN_CLEAR);
      }
      // no rare kind outside the rare list
      p.dig.kinds.forEach((k, i) => {
        if (k !== '' && getMineBlock(k).rare) expect(p.dig.rare).toContain(i);
      });
    }
    expect(some).toBeGreaterThan(SEEDS.length / 3);
  });

  it('keeps enemies and cave-ins in open pockets, never within DIG_SPAWN_CLEAR blocks of the spawn or on the exit', () => {
    let enemies = 0;
    let hazards = 0;
    for (const seed of SEEDS) {
      const p = generateDigMine(seed, 3);
      const spawn = cellOf(p.map.spawn);
      for (const e of p.enemies) {
        enemies++;
        expect(['slime', 'bat']).toContain(e.kind);
        expect(p.dig.kinds[cellOf(e)]).toBe('');
        expect(blockSteps(cellOf(e), spawn)).toBeGreaterThanOrEqual(DIG_SPAWN_CLEAR);
      }
      for (const h of p.dig.hazards) {
        hazards++;
        const cell = h.r * DIG_COLS + h.c;
        expect(p.dig.kinds[cell]).toBe('');
        expect(blockSteps(cell, spawn)).toBeGreaterThanOrEqual(DIG_SPAWN_CLEAR);
        expect(cell).not.toBe(p.map.exit.r * DIG_COLS + p.map.exit.c);
        expect(h.state).toBe('armed');
      }
    }
    expect(enemies).toBeGreaterThan(0);
    expect(hazards).toBeGreaterThan(0);
  });

  it('weights by depth: no mithril at depth 1, mithril and rare kinds later, copper thins out, iron grows', () => {
    const w = (id: string, depth: number): number => veinWeights(depth).find((v) => v.id === id)?.weight ?? 0;
    expect(w('mithril', 1)).toBe(0);
    expect(w('mithril', 2)).toBeGreaterThan(0);
    expect(w('mithril', 6)).toBeGreaterThan(w('mithril', 2));
    expect(w('copper', 6)).toBeLessThan(w('copper', 1));
    expect(w('iron', 6)).toBeGreaterThan(w('iron', 1));
    expect(rareWeights(1)).toEqual([]);
    expect(rareWeights(2).map((r) => r.id)).toEqual(['crystal']);
    expect(rareWeights(3).map((r) => r.id).sort()).toEqual(['crystal', 'diamond', 'gold_vein']);
    expect(blockWeight(getMineBlock('copper'), 999)).toBe(0); // never negative
    const count = (depth: number, id: string): number => SEEDS.reduce((a, s) => a + generateDigMine(s, depth).dig.kinds.filter((k) => k === id).length, 0);
    expect(count(1, 'mithril')).toBe(0);
    expect(count(5, 'mithril')).toBeGreaterThan(0);
    expect(count(1, 'stone')).toBeGreaterThan(count(1, 'coal'));
  });

  it('has the block table the plan lists', () => {
    expect(MINE_BLOCKS.map((b) => b.id)).toEqual(['stone', 'dirt', 'clay', 'coal', 'copper', 'iron', 'mithril', 'crystal', 'gold_vein', 'diamond', 'bedrock']);
    expect(MINE_BLOCKS.filter((b) => b.drop).every((b) => b.hits > 0)).toBe(true);
    expect(getMineBlock('diamond')).toMatchObject({ hits: 12, rank: 'ultra_rare' });
    expect(getMineBlock('coal').drop).toMatchObject({ item: 'coal' });
  });
});
