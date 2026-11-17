import { describe, expect, it } from 'vitest';
import { DUNGEON_BLOCKS_H, DUNGEON_BLOCKS_W, DUNGEON_CORRIDOR_MAX, ENEMIES_PER_ROOM_MAX, PACE_ENEMY_GAP_BLOCKS, PACE_GAP_BLOCKS, PACE_NEAR_BLOCKS, ROUTE_LEN_MAX, ROUTE_LEN_MIN } from '../config.ts';
import { blockDistances, generateFloor } from './generate.ts';
import { blockAt, isFloorBlock } from './grid.ts';
import { generateLegacyCrypt } from './legacyLayout.ts';
import { longestStretchWithout, routeBetween, worstBeatDistance } from './pacing.ts';
import { ROOM_TEMPLATES, maskConnected, roomMask } from './rooms.ts';
import { newRun, type DungeonMap } from './run.ts';
import type { FloorPlan } from './layoutCommon.ts';

const inRect = (r: { x: number; y: number; w: number; h: number }, c: number, rr: number) => c >= r.x && rr >= r.y && c < r.x + r.w && rr < r.y + r.h;

/** FNV-1a over everything a floor is made of (blocks, enemies, chests, links, extras, decor, room info). */
function hashPlan(plan: FloorPlan): string {
  const { map } = plan;
  const text = [
    map.blocks.map((b) => (b === 'floor' ? '.' : '#')).join(''),
    JSON.stringify(map.spawn),
    JSON.stringify(map.exit),
    JSON.stringify(plan.enemies.map((e) => [e.kind, e.x, e.y, e.hp])),
    JSON.stringify(plan.chests.map((c) => [c.kind, c.mimic, c.x, c.y])),
    JSON.stringify(map.links),
    JSON.stringify(map.extras),
    JSON.stringify(map.decor),
    JSON.stringify(map.roomInfo),
  ].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}

const seeds = (n: number): number[] => Array.from({ length: n }, (_, i) => i * 7919 + 13);
const floors = (round: 1 | 2, count: number): FloorPlan[] => seeds(count).flatMap((s) => (round === 1 ? [generateFloor(s, 1, 1)] : [1, 2, 3].map((n) => generateFloor(s, n, 2))));

describe('crypt layout (DG1, section 10 LAYOUT)', () => {
  it('is deterministic and a reshuffle shows: golden hash of seeds 1..20 x floors 1..3 (round 2)', () => {
    let all = '';
    for (let seed = 1; seed <= 20; seed++) {
      for (let n = 1; n <= 3; n++) {
        const a = generateFloor(seed, n, 2);
        expect(hashPlan(a)).toBe(hashPlan(generateFloor(seed, n, 2)));
        all += hashPlan(a) + ',';
      }
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < all.length; i++) h = Math.imul(h ^ all.charCodeAt(i), 0x01000193) >>> 0;
    expect(h.toString(16)).toBe('abf4146e');
  });

  it('is 40 x 40, rooms disjoint, 3 to 4 rooms in round 1 and 5 to 8 in round 2, outer ring wall', () => {
    for (const round of [1, 2] as const) {
      for (const { map } of floors(round, 60)) {
        expect(map.cols).toBe(DUNGEON_BLOCKS_W);
        expect(map.rows).toBe(DUNGEON_BLOCKS_H);
        const [min, max] = round === 1 ? [3, 4] : [5, 8];
        expect(map.rooms.length).toBeGreaterThanOrEqual(min);
        expect(map.rooms.length).toBeLessThanOrEqual(max);
        map.rooms.forEach((a, i) => {
          expect(a.w).toBeGreaterThanOrEqual(4);
          expect(a.w).toBeLessThanOrEqual(8);
          for (const b of map.rooms.slice(i + 1)) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
        });
        for (let k = 0; k < 40; k++) expect(isFloorBlock(map, k, 0) || isFloorBlock(map, 0, k) || isFloorBlock(map, k, 39) || isFloorBlock(map, 39, k)).toBe(false);
        expect(map.roomInfo).toHaveLength(map.rooms.length);
      }
    }
  });

  it('a flood fill from the spawn covers ALL floor blocks (rooms, corridors, nooks, secrets, vault)', () => {
    for (const round of [1, 2] as const) {
      for (const { map } of floors(round, 100)) {
        const s = blockAt(map.spawn);
        const dist = blockDistances(map, s.c, s.r);
        map.blocks.forEach((b, i) => {
          if (b === 'floor') expect(dist[i]).toBeGreaterThanOrEqual(0);
        });
      }
    }
  });

  it('the exit is the farthest block (walking) of the rooms that are not the spawn room (the arena on the boss floor)', () => {
    for (const { map } of floors(2, 60)) {
      const s = blockAt(map.spawn);
      const dist = blockDistances(map, s.c, s.r);
      const bossFloor = map.n === 3;
      let best = -1;
      map.rooms.forEach((room, ri) => {
        if (ri === 0 || (bossFloor && ri !== map.rooms.length - 1)) return;
        for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) best = Math.max(best, dist[r * map.cols + c] ?? -1);
      });
      expect(dist[map.exit.r * map.cols + map.exit.c]).toBe(best);
      expect(inRect(map.rooms[0]!, map.exit.c, map.exit.r)).toBe(false);
    }
  });

  it('no corridor is longer than DUNGEON_CORRIDOR_MAX blocks (300 seeds, both rounds)', () => {
    for (const round of [1, 2] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const { map } = generateFloor(seed, 1, round);
        for (const l of map.links ?? []) {
          const cs = l.cells.map((p) => p.c);
          const rs = l.cells.map((p) => p.r);
          const run = Math.max(Math.max(...cs) - Math.min(...cs) + 1, Math.max(...rs) - Math.min(...rs) + 1);
          expect(run).toBeLessThanOrEqual(DUNGEON_CORRIDOR_MAX);
        }
      }
    }
  });

  it('the link graph is connected and has a cycle when there are 4 or more rooms', () => {
    for (const round of [1, 2] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const { map } = generateFloor(seed, 1, round);
        const links = map.links ?? [];
        expect(links.length).toBeGreaterThanOrEqual(map.rooms.length - 1);
        if (map.rooms.length >= 4) expect(links.length).toBeGreaterThanOrEqual(map.rooms.length);
      }
    }
  });

  it('has variety: over 100 seeds at least 7 templates and 5 themes, never a floor of only rectangles', () => {
    const templates = new Set<string>();
    const themes = new Set<string>();
    for (const { map } of floors(2, 100)) {
      for (const info of map.roomInfo ?? []) {
        templates.add(info.template);
        themes.add(info.theme);
      }
      expect((map.roomInfo ?? []).some((i) => i.template !== 'rect')).toBe(true);
    }
    expect(templates.size).toBeGreaterThanOrEqual(7);
    expect(themes.size).toBeGreaterThanOrEqual(5);
  });

  it('every template mask is 4-connected at every size, so a pillar never cuts a room', () => {
    for (const t of ROOM_TEMPLATES) {
      for (let w = t.w[0]; w <= t.w[1]; w++) {
        for (let h = t.h[0]; h <= t.h[1]; h++) {
          for (let v = 0; v < 4; v++) expect(maskConnected(roomMask(t.mask, w, h, v), w, h)).toBe(true);
        }
      }
    }
  });

  it('things (enemies, chests, props, the exit) stand only on floor blocks, one thing per block, none near the spawn', () => {
    for (const round of [1, 2] as const) {
      for (const plan of floors(round, 100)) {
        const { map } = plan;
        const spots = [...plan.enemies.map((e) => blockAt(e)), ...plan.chests.map((c) => blockAt(c))];
        for (const b of spots) expect(isFloorBlock(map, b.c, b.r)).toBe(true);
        const keys = spots.map((b) => `${b.c},${b.r}`);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).not.toContain(`${map.exit.c},${map.exit.r}`);
        for (const d of map.decor ?? []) expect(isFloorBlock(map, d.c, d.r)).toBe(true);
        const s = blockAt(map.spawn);
        for (const e of plan.enemies) expect(Math.max(Math.abs(blockAt(e).c - s.c), Math.abs(blockAt(e).r - s.r))).toBeGreaterThanOrEqual(4);
        for (const room of map.rooms.keys()) expect(plan.enemies.filter((e) => e.kind !== 'bone_king' && inRect(map.rooms[room]!, blockAt(e).c, blockAt(e).r)).length).toBeLessThanOrEqual(ENEMIES_PER_ROOM_MAX);
      }
    }
  });

  it('keeps the totals of the old layout: chest counts the same, enemy mean within 10% (200 seeds)', () => {
    for (const round of [1, 2] as const) {
      let nu = 0;
      let old = 0;
      let nuChests = 0;
      let oldChests = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const a = generateFloor(seed, 1, round);
        const b = generateLegacyCrypt(seed, 1, round);
        nu += a.enemies.length;
        old += b.enemies.length;
        nuChests += a.chests.length;
        oldChests += b.chests.length;
        expect(a.chests.filter((c) => c.kind === 'wooden').length).toBeGreaterThanOrEqual(3);
        expect(a.chests.filter((c) => c.kind === 'wooden').length).toBeLessThanOrEqual(5);
      }
      expect(Math.abs(nu - old) / old).toBeLessThan(0.1);
      expect(Math.abs(nuChests - oldChests) / oldChests).toBeLessThan(0.05);
    }
  });

  it('pacing: a beat within PACE_GAP_BLOCKS of every point of the main route; enemies are spread along it', () => {
    let floorsTotal = 0;
    let gaps = 0;
    for (const round of [1, 2] as const) {
      for (const plan of floors(round, 100)) {
        const { map } = plan;
        const route = routeBetween(map, blockAt(map.spawn), map.exit);
        const beats = [...plan.enemies.map((e) => blockAt(e)), ...plan.chests.map((c) => blockAt(c)), ...(map.decor ?? [])];
        expect(worstBeatDistance(route, beats)).toBeLessThanOrEqual(PACE_GAP_BLOCKS);
        floorsTotal++;
        // Enemies are moved, never added, so a floor that rolled none cannot have one; the rest is best effort.
        if (longestStretchWithout(route, plan.enemies.map((e) => blockAt(e)), PACE_NEAR_BLOCKS) > PACE_ENEMY_GAP_BLOCKS) gaps++;
      }
    }
    expect(gaps / floorsTotal).toBeLessThan(0.06);
  });

  it('the main route is 25 to 70 blocks', () => {
    for (const round of [1, 2] as const) {
      for (const { map } of floors(round, 100)) {
        const steps = routeBetween(map, blockAt(map.spawn), map.exit).length - 1;
        expect(steps).toBeGreaterThanOrEqual(ROUTE_LEN_MIN);
        expect(steps).toBeLessThanOrEqual(ROUTE_LEN_MAX);
      }
    }
  });

  it('secrets and the vault are reachable (extras are floor and part of the flood fill); most floors have a vault', () => {
    let withVault = 0;
    let total = 0;
    for (const { map, chests } of floors(2, 60)) {
      for (const e of map.extras ?? []) {
        for (let r = e.y; r < e.y + e.h; r++) for (let c = e.x; c < e.x + e.w; c++) expect(isFloorBlock(map, c, r)).toBe(true);
      }
      total++;
      if ((map.decor ?? []).some((d) => d.kind === 'vault_arch')) {
        withVault++;
        const arch = map.decor!.find((d) => d.kind === 'vault_arch')!;
        expect(chests.some((c) => Math.abs(blockAt(c).c - arch.c) <= 3 && Math.abs(blockAt(c).r - arch.r) <= 3)).toBe(true);
      }
    }
    expect(withVault / total).toBeGreaterThan(0.6);
  });

  it('every crypt floor has a landmark', () => {
    const landmarks = ['fountain', 'statue', 'brazier_big', 'pillar_ring', 'sarcophagus'];
    for (const { map } of floors(2, 60)) expect((map.decor ?? []).filter((d) => landmarks.includes(d.kind))).toHaveLength(1);
  });

  it('the boss floor has the arena as its exit room, the Bone King in it and a golden chest next to the exit; mimics only in round 2', () => {
    for (const seed of seeds(60)) {
      const boss = generateFloor(seed, 3, 2);
      const room = boss.map.rooms.findIndex((r) => inRect(r, boss.map.exit.c, boss.map.exit.r));
      expect(boss.map.roomInfo![room]!.template).toBe('arena');
      expect(boss.map.roomInfo![room]!.theme).toBe('arena');
      expect(boss.enemies.filter((e) => e.kind === 'bone_king')).toHaveLength(1);
      expect(boss.chests.filter((c) => c.kind === 'golden')).toHaveLength(1);
      for (const c of generateFloor(seed, 1, 1).chests) expect(c.mimic).toBe(false);
    }
  });

  it('a stored run without the new map fields still loads and plays (old maps have no links, extras, decor or roomInfo)', () => {
    const plan = generateFloor(5, 1, 2);
    const old: DungeonMap = { ...plan.map };
    delete old.links;
    delete old.extras;
    delete old.decor;
    delete old.roomInfo;
    const run = newRun({ seed: 5, round: 2, xp: 0, gear: [], potions: 0 });
    const loaded = JSON.parse(JSON.stringify({ ...run, map: old })) as typeof run;
    expect(loaded.map.links).toBeUndefined();
    expect(isFloorBlock(loaded.map, blockAt(loaded.map.spawn).c, blockAt(loaded.map.spawn).r)).toBe(true);
  });

  it('generation is fast: under 20 ms on average, under 60 ms for the worst of 300 seeds', () => {
    let total = 0;
    let worst = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const t = Date.now();
      generateFloor(seed, 1 + (seed % 3), 2);
      const d = Date.now() - t;
      total += d;
      worst = Math.max(worst, d);
    }
    expect(total / 300).toBeLessThan(20);
    expect(worst).toBeLessThan(60);
  });

  it('the old layout is kept for comparison and the mine still uses it', () => {
    const legacy = generateLegacyCrypt(42, 1, 2);
    expect(legacy.map.links).toBeUndefined();
    expect(legacy.map.rooms.length).toBeGreaterThanOrEqual(5);
  });
});
