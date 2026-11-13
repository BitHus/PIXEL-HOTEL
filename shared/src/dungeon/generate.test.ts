import { describe, expect, it } from 'vitest';
import { BOSS_HP_FLOOR_SCALING, DUNGEON_BLOCKS_H, DUNGEON_BLOCKS_W, ENEMIES, WOODEN_CHESTS_MAX, WOODEN_CHESTS_MIN } from '../config.ts';
import { findPath } from '../nav.ts';
import { blockDistances, enemyHp, generateFloor } from './generate.ts';
import { blockAt, blockCenter, dungeonNavGrid, isFloorBlock } from './grid.ts';
import type { BlockRect } from './run.ts';

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);
const center = (r: BlockRect) => ({ c: r.x + Math.floor(r.w / 2), r: r.y + Math.floor(r.h / 2) });
const inRoom = (room: BlockRect, b: { c: number; r: number }) => b.c >= room.x && b.c < room.x + room.w && b.r >= room.y && b.r < room.y + room.h;

describe('generateFloor (section 10)', () => {
  it('same seed gives the same floor; another seed or floor gives another', () => {
    expect(generateFloor(42, 1, 2)).toEqual(generateFloor(42, 1, 2));
    expect(generateFloor(42, 1, 2).map.blocks).not.toEqual(generateFloor(43, 1, 2).map.blocks);
    expect(generateFloor(42, 1, 2).map.blocks).not.toEqual(generateFloor(42, 2, 2).map.blocks);
  });

  it('is 40 x 40 blocks with rooms of 4 to 8 blocks that never overlap', () => {
    for (const round of [1, 2] as const) {
      for (const seed of SEEDS) {
        const { map } = generateFloor(seed, 1, round);
        expect(map.cols).toBe(DUNGEON_BLOCKS_W);
        expect(map.rows).toBe(DUNGEON_BLOCKS_H);
        expect(map.blocks).toHaveLength(40 * 40);
        const [min, max] = round === 1 ? [3, 4] : [5, 8];
        expect(map.rooms.length).toBeGreaterThanOrEqual(min);
        expect(map.rooms.length).toBeLessThanOrEqual(max);
        for (const [i, a] of map.rooms.entries()) {
          expect(a.w).toBeGreaterThanOrEqual(4);
          expect(a.w).toBeLessThanOrEqual(8);
          expect(a.h).toBeGreaterThanOrEqual(4);
          expect(a.h).toBeLessThanOrEqual(8);
          for (const b of map.rooms.slice(i + 1)) {
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            expect(overlap).toBe(false);
          }
        }
        // The outer ring is wall.
        for (let k = 0; k < 40; k++) {
          expect(isFloorBlock(map, k, 0) || isFloorBlock(map, 0, k) || isFloorBlock(map, k, 39) || isFloorBlock(map, 39, k)).toBe(false);
        }
      }
    }
  });

  it('every room is connected and the exit is reachable (blocks and nav grid)', () => {
    for (const round of [1, 2] as const) {
      for (const seed of SEEDS) {
        for (const n of [1, 2, 3]) {
          const { map } = generateFloor(seed, n, round);
          const s = blockAt(map.spawn);
          const dist = blockDistances(map, s.c, s.r);
          for (const room of map.rooms) {
            for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) expect(dist[r * map.cols + c]).toBeGreaterThanOrEqual(0);
          }
          expect(isFloorBlock(map, map.exit.c, map.exit.r)).toBe(true);
          const exit = blockCenter(map.exit.c, map.exit.r);
          const path = findPath(dungeonNavGrid(map), map.spawn, exit);
          expect(path?.at(-1)).toEqual(exit);
          expect(inRoom(map.rooms[0]!, map.exit)).toBe(false);
        }
      }
    }
  });

  it('round 1 has only slimes, no mimics and no boss', () => {
    for (const seed of SEEDS) {
      const plan = generateFloor(seed, 1, 1);
      for (const e of plan.enemies) expect(e.kind).toBe('slime');
      for (const c of plan.chests) expect(c.mimic).toBe(false);
    }
  });

  it('round 2 has all enemy kinds, mimics, and the Bone King only on floor 3 with a golden chest at the exit', () => {
    const kinds = new Set<string>();
    let mimics = 0;
    for (const seed of SEEDS) {
      for (const n of [1, 2]) {
        const plan = generateFloor(seed, n, 2);
        for (const e of plan.enemies) kinds.add(e.kind);
        mimics += plan.chests.filter((c) => c.mimic).length;
      }
      const boss = generateFloor(seed, 3, 2);
      expect(boss.enemies.filter((e) => e.kind === 'bone_king')).toHaveLength(1);
      const king = boss.enemies.find((e) => e.kind === 'bone_king')!;
      expect(king.hp).toBe(BOSS_HP_FLOOR_SCALING ? 90 : 60);
      const exitRoom = boss.map.rooms.find((r) => inRoom(r, boss.map.exit))!;
      expect(inRoom(exitRoom, blockAt(king))).toBe(true);
      const golden = boss.chests.filter((c) => c.kind === 'golden');
      expect(golden).toHaveLength(1);
      const g = blockAt(golden[0]!);
      expect(Math.abs(g.c - boss.map.exit.c) + Math.abs(g.r - boss.map.exit.r)).toBe(1);
    }
    expect([...kinds].sort()).toEqual(['bat', 'skeleton', 'slime']);
    expect(mimics).toBeGreaterThan(0);
  });

  it('places 0 to 2 enemies per room (none in the spawn room), 3 to 5 wooden chests, golden about 40%', () => {
    let golden = 0;
    const floors = 400;
    for (let seed = 0; seed < floors; seed++) {
      const plan = generateFloor(seed, 1, 2);
      const [spawnRoom, ...others] = plan.map.rooms;
      for (const e of plan.enemies) expect(inRoom(spawnRoom!, blockAt(e))).toBe(false);
      for (const c of plan.chests) expect(inRoom(spawnRoom!, blockAt(c))).toBe(false);
      for (const room of others) expect(plan.enemies.filter((e) => inRoom(room, blockAt(e))).length).toBeLessThanOrEqual(2);
      const wooden = plan.chests.filter((c) => c.kind === 'wooden').length;
      expect(wooden).toBeGreaterThanOrEqual(WOODEN_CHESTS_MIN);
      expect(wooden).toBeLessThanOrEqual(WOODEN_CHESTS_MAX);
      golden += plan.chests.filter((c) => c.kind === 'golden').length;
      // Nothing shares a block, and nothing stands on the exit.
      const spots = [...plan.enemies, ...plan.chests].map((t) => `${blockAt(t).c},${blockAt(t).r}`);
      expect(new Set(spots).size).toBe(spots.length);
      expect(spots).not.toContain(`${plan.map.exit.c},${plan.map.exit.r}`);
    }
    expect(golden / floors).toBeGreaterThan(0.33);
    expect(golden / floors).toBeLessThan(0.47);
  });

  it('enemies never start on the player or near the spawn block', () => {
    for (const seed of SEEDS) {
      for (const round of [1, 2] as const) {
        const { map, enemies } = generateFloor(seed, 1, round);
        for (const e of enemies) expect(Math.hypot(e.x - map.spawn.x, e.y - map.spawn.y)).toBeGreaterThan(64);
      }
    }
  });

  it('scales enemy hp by 25% per floor, rounded up', () => {
    expect(enemyHp('slime', 1)).toBe(8);
    expect(enemyHp('slime', 2)).toBe(10);
    expect(enemyHp('skeleton', 3)).toBe(18);
    expect(enemyHp('bat', 2)).toBe(Math.ceil(6 * 1.25));
    expect(enemyHp('bone_king', 3)).toBe(90);
    for (const e of generateFloor(5, 2, 2).enemies) expect(e.hp).toBe(Math.ceil(ENEMIES[e.kind].hp * 1.25));
  });
});
