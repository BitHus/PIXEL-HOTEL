import { describe, expect, it } from 'vitest';
import { ENEMY_WINDUP_MS, MIMIC_WAKE_MS, PLAYER_DUNGEON_SPEED } from '../config.ts';
import { seededRng } from '../rng.ts';
import type { Rng } from '../types.ts';
import { blockCenter } from './grid.ts';
import { combatStats, newRun, type DungeonInput, type DungeonRun } from './run.ts';
import { distance, exitChoices, step } from './step.ts';
import { B, enemyAt, openMap, testRun } from './testRun.ts';

/** Steps a run in 100 ms steps for ms milliseconds, with the inputs at the start. */
function run(r: DungeonRun, inputs: DungeonInput[], ms: number, rng: Rng = seededRng(1)): DungeonRun {
  let s = step(r, inputs, 0, rng);
  for (let t = 0; t < ms; t += 100) s = step(s, [], 100, rng);
  return s;
}
const hits = (r: DungeonRun) => r.events.filter((e) => e.t === 'hit');
const start = blockCenter(5, 5);

describe('step: walking', () => {
  it('walks to a clicked point at 80 px per second', () => {
    const r0 = testRun({ at: start });
    const r1 = run(r0, [{ t: 'click_point', x: start.x + 160, y: start.y }], 1000);
    expect(r1.player.x).toBeCloseTo(start.x + PLAYER_DUNGEON_SPEED, 5);
    const r2 = run(r1, [], 1000);
    expect(r2.player.x).toBeCloseTo(start.x + 160, 5);
    expect(r2.timeMs).toBe(2000);
  });

  it('is deterministic: same run, inputs and rng seed give the same result', () => {
    const play = () => {
      const rng = seededRng(5);
      let r = newRun({ seed: 1234, round: 2, xp: 0, gear: [], potions: 2 });
      for (let k = 0; k < 300; k++) {
        const e = r.enemies[0];
        const input: DungeonInput[] = k % 5 === 0 && e ? [{ t: 'click_enemy', id: e.id }] : [];
        r = step(r, input, 100, rng);
        if (r.status !== 'active') break;
      }
      return r;
    };
    expect(play()).toEqual(play());
  });

  it('keeps the rest of dtMs for the next step (fixed 100 ms ticks)', () => {
    const r = step(testRun({ at: start }), [{ t: 'click_point', x: start.x + 160, y: start.y }], 250, seededRng(1));
    expect(r.timeMs).toBe(200);
    expect(r.carryMs).toBe(50);
    expect(step(r, [], 50, seededRng(1)).timeMs).toBe(300);
  });
});

describe('step: the player attacks', () => {
  it('each click is one hit; clicks during the 350 ms cooldown are ignored', () => {
    const e = enemyAt(1, start.x + 30, start.y, 'slime', 999);
    const rng = seededRng(2);
    let r = testRun({ at: start, enemies: [e] });
    r = step(r, [{ t: 'click_enemy', id: 1 }], 0, rng);
    expect(hits(r)).toHaveLength(1);
    r = step(r, [], 200, rng);
    r = step(r, [{ t: 'click_enemy', id: 1 }], 100, rng); // at 200 ms: ignored
    expect(hits(r)).toHaveLength(0);
    r = step(r, [], 50, rng);
    r = step(r, [{ t: 'click_enemy', id: 1 }], 0, rng); // at 350 ms: a hit
    expect(hits(r)).toHaveLength(1);
    r = step(r, [], 1000, rng); // no auto-attack
    expect(hits(r)).toHaveLength(0);
  });

  it('walks next to a far enemy and hits once when it gets there', () => {
    const e = enemyAt(1, start.x + 150, start.y, 'slime', 999);
    let r = step(testRun({ at: start, enemies: [e] }), [{ t: 'click_enemy', id: 1 }], 0, seededRng(1));
    expect(hits(r)).toHaveLength(0);
    let total = 0;
    for (let k = 0; k < 30; k++) {
      r = step(r, [], 100, seededRng(k));
      total += hits(r).length;
    }
    expect(total).toBe(1);
    expect(distance(r.player, r.enemies[0]!)).toBeLessThanOrEqual(40);
  });

  it('damage stays inside the ranges; the iron sword hits 7-9 (step 9c); levels add to both ends', () => {
    const seen = (gear: ('iron_sword' | 'leather_armor')[], xp = 0) => {
      const ds = new Set<number>();
      const rng = seededRng(11);
      let r = testRun({ at: start, gear, xp, enemies: [enemyAt(1, start.x + 20, start.y, 'slime', 1e9)] });
      for (let k = 0; k < 300; k++) {
        r = step(r, [{ t: 'click_enemy', id: 1 }], 400, rng);
        for (const h of hits(r)) if (h.t === 'hit') ds.add(h.damage);
        r = { ...r, player: { ...r.player, hp: r.player.maxHp } };
      }
      return [...ds].sort();
    };
    expect(seen([])).toEqual([4, 5, 6]);
    expect(seen(['iron_sword'])).toEqual([7, 8, 9]);
    expect(seen(['iron_sword'], 40)).toEqual([10, 8, 9]); // level 3: +1 (sorted as text)
    expect(combatStats(4, [])).toMatchObject({ attackMin: 6, attackMax: 8, maxHp: 39 });
  });
});

describe('step: enemies', () => {
  const tooFar = (id: number) => (r: DungeonRun) => r.events.some((e) => e.t === 'enemy_miss' && e.enemyId === id);

  it('winds up 300 ms when within 40 px, then hits for 2-3 (slime) if the player stayed', () => {
    let r = testRun({ at: start, enemies: [enemyAt(1, start.x + 30, start.y)] });
    r = step(r, [], 100, seededRng(1));
    expect(r.events).toContainEqual({ t: 'windup', enemyId: 1 });
    expect(r.enemies[0]!.windupMs).toBe(ENEMY_WINDUP_MS);
    r = step(r, [], 200, seededRng(1));
    expect(r.player.hp).toBe(30);
    r = step(r, [], 100, seededRng(1));
    const dmg = 30 - r.player.hp;
    expect(dmg).toBeGreaterThanOrEqual(2);
    expect(dmg).toBeLessThanOrEqual(3);
  });

  it('misses if the player is more than 48 px away at the end of the wind-up', () => {
    let r = testRun({ at: start, enemies: [enemyAt(1, start.x + 38, start.y)] });
    r = step(r, [], 100, seededRng(1)); // wind-up starts
    r = step(r, [{ t: 'click_point', x: start.x - 100, y: start.y }], 300, seededRng(1));
    expect(distance(r.player, r.enemies[0]!)).toBeGreaterThan(48);
    expect(r.player.hp).toBe(30);
    // With a slow sidestep that keeps the player within 48 px it hits.
    let s = testRun({ at: start, enemies: [enemyAt(1, start.x + 38, start.y)] });
    s = step(s, [], 100, seededRng(1));
    s = step(s, [], 300, seededRng(1));
    expect(s.player.hp).toBeLessThan(30);
    expect(tooFar(1)(r) || r.player.hp === 30).toBe(true);
  });

  it('waits for its attack cooldown after an attack', () => {
    let r = testRun({ at: start, enemies: [enemyAt(1, start.x + 30, start.y)] });
    const windups: number[] = [];
    for (let t = 0; t < 5000; t += 100) {
      r = step(r, [], 100, seededRng(t));
      if (r.events.some((e) => e.t === 'windup')) windups.push(r.timeMs);
      r = { ...r, player: { ...r.player, hp: 30 } };
    }
    // Wind-up 300 ms, the hit, then the slime's 1600 ms cooldown before the next wind-up.
    expect(windups.slice(0, 3)).toEqual([100, 2000, 3900]);
  });

  it('chases within 192 px and idles beyond; skeletons move 64 px per second', () => {
    const near = testRun({ at: start, enemies: [enemyAt(1, start.x + 150, start.y, 'skeleton')] });
    const far = testRun({ at: start, enemies: [enemyAt(1, start.x + 200, start.y, 'skeleton')] });
    expect(run(near, [], 1000).enemies[0]!.x).toBeCloseTo(start.x + 150 - 64, 5);
    expect(run(far, [], 1000).enemies[0]!.x).toBe(start.x + 200);
  });

  it('never walks onto the player', () => {
    const r = run(testRun({ at: start, enemies: [enemyAt(1, start.x + 150, start.y, 'skeleton', 999)] }), [], 4000);
    expect(distance(r.player, r.enemies[0]!)).toBeGreaterThanOrEqual(24 - 1e-9);
  });

  it('chases around walls with the nav grid', () => {
    // A wall column between the player and the enemy, open below row 5.
    const map = openMap(12, 12);
    const blocks = [...map.blocks];
    for (let rr = 1; rr < 6; rr++) blocks[rr * 12 + 6] = 'wall';
    const m = { ...map, blocks };
    const e = enemyAt(1, blockCenter(7, 3).x, blockCenter(7, 3).y, 'skeleton', 999);
    const r = run(testRun({ map: m, at: blockCenter(4, 3), enemies: [e] }), [], 6000);
    expect(distance(r.player, r.enemies[0]!)).toBeLessThanOrEqual(48);
  });

  it('a wooden mimic turns into a skeleton when walked onto; killing it gives golden chest loot', () => {
    const chest = { id: 3, kind: 'wooden' as const, mimic: true, opened: false, x: start.x + 64, y: start.y };
    let r = run(testRun({ at: start, chests: [chest] }), [{ t: 'click_point', x: chest.x, y: chest.y }], 1000);
    expect(r.chests).toHaveLength(0);
    const m = r.enemies[0]!;
    expect(m).toMatchObject({ kind: 'skeleton', mimic: true, hp: 12 });
    r = { ...r, enemies: [{ ...m, hp: 1 }] };
    r = step(r, [{ t: 'click_enemy', id: m.id }], 0, seededRng(4));
    expect(r.events).toContainEqual({ t: 'kill', enemyId: m.id, kind: 'skeleton', xp: 8, mimic: true });
    expect(r.events.filter((e) => e.t === 'loot').length).toBeGreaterThanOrEqual(3);
  });
});

describe('step: mimics and the last hit (step 9)', () => {
  it('a mimic opens like a chest, then waits MIMIC_WAKE_MS before its wind-up', () => {
    const chest = { id: 3, kind: 'wooden' as const, mimic: true, opened: false, x: start.x + 16, y: start.y };
    let r = step(testRun({ at: start, chests: [chest] }), [], 100, seededRng(1));
    expect(r.events).toContainEqual({ t: 'mimic', enemyId: 1003, chestId: 3 });
    let windupAt = -1;
    for (let k = 0; k < 20 && windupAt < 0; k++) {
      r = step(r, [], 100, seededRng(k));
      if (r.events.some((e) => e.t === 'windup')) windupAt = r.timeMs;
    }
    expect(windupAt).toBe(100 + MIMIC_WAKE_MS);
  });

  it('remembers what dealt the last hit', () => {
    let r = testRun({ at: start, enemies: [enemyAt(1, start.x + 30, start.y, 'bat', 99)] });
    expect(r.lastHitBy).toBeNull();
    r = { ...r, enemies: [{ ...r.enemies[0]!, windupMs: 100 }] };
    r = step(r, [], 100, seededRng(1));
    expect(r.lastHitBy).toBe('bat');
  });
});

describe('step: chests, xp, potions, exit, death', () => {
  it('opens a chest when walked onto and puts the loot in the bag', () => {
    const chest = { id: 1, kind: 'golden' as const, mimic: false, opened: false, x: start.x + 64, y: start.y };
    const r = run(testRun({ at: start, chests: [chest] }), [{ t: 'click_point', x: chest.x, y: chest.y }], 1000);
    expect(r.chests[0]!.opened).toBe(true);
    expect(r.bag.gold + r.bag.slots.length).toBeGreaterThan(0);
  });

  it('xp counts at the kill; a level up heals fully and adds max hp', () => {
    let r = testRun({ at: start, xp: 13, enemies: [enemyAt(1, start.x + 20, start.y, 'slime', 1)] });
    r = { ...r, player: { ...r.player, hp: 5 } };
    r = step(r, [{ t: 'click_enemy', id: 1 }], 0, seededRng(1));
    expect(r.xpGained).toBe(3);
    expect(r.player).toMatchObject({ level: 2, xp: 16, maxHp: 33, hp: 33, attackMin: 5, attackMax: 7 });
    expect(r.events).toContainEqual({ t: 'level_up', level: 2 });
  });

  it('potions heal 15, with 1 s between potions', () => {
    let r = testRun({ at: start, potions: 3 });
    r = { ...r, player: { ...r.player, hp: 5 } };
    r = step(r, [{ t: 'drink_potion' }], 500, seededRng(1));
    expect(r.player).toMatchObject({ hp: 20, potions: 2 });
    r = step(r, [{ t: 'drink_potion' }], 500, seededRng(1));
    expect(r.player).toMatchObject({ hp: 20, potions: 2 });
    r = step(r, [{ t: 'drink_potion' }], 0, seededRng(1));
    expect(r.player).toMatchObject({ hp: 30, potions: 1 });
  });

  it('the exit pauses the run until the player chooses; round 1 only offers leave', () => {
    const map = openMap();
    const exit = blockCenter(map.exit.c, map.exit.r);
    const far = enemyAt(1, blockCenter(9, 2).x, blockCenter(9, 2).y, 'skeleton', 99);
    let r = testRun({ at: blockCenter(map.exit.c - 1, map.exit.r), enemies: [far] });
    r = run(r, [{ t: 'click_point', x: exit.x, y: exit.y }], 1000);
    expect(r.status).toBe('exit_choice');
    const paused = step(r, [{ t: 'click_point', x: 100, y: 100 }], 5000, seededRng(1));
    expect(paused.timeMs).toBe(r.timeMs);
    expect(paused.player).toEqual(r.player);
    expect(paused.enemies).toEqual(r.enemies);
    expect(exitChoices(r)).toEqual(['deeper', 'leave', 'stay']);
    expect(exitChoices({ ...r, floor: 3 })).toEqual(['leave', 'stay']);
    expect(exitChoices(newRun({ seed: 1, round: 1, xp: 0, gear: [], potions: 0 }))).toEqual(['leave', 'stay']);
    // 'stay' goes on; standing on the exit does not ask again until the player steps off.
    const stayed = step(r, [{ t: 'choose_exit', choice: 'stay' }], 300, seededRng(1));
    expect(stayed.status).toBe('active');
    expect(stayed.timeMs).toBe(r.timeMs + 300);
  });

  it('leaving banks the bag and ends the run', () => {
    let r = testRun({ at: start });
    r = { ...r, status: 'exit_choice', bag: { slots: [{ kind: 'material', id: 'bone', qty: 4 }], gold: 30 } };
    r = step(r, [{ t: 'choose_exit', choice: 'leave' }], 0, seededRng(1));
    expect(r.status).toBe('left');
    expect(r.banked).toEqual({ slots: [{ kind: 'material', id: 'bone', qty: 4 }], gold: 30 });
    expect(r.bag).toEqual({ slots: [], gold: 0 });
  });

  it('going deeper keeps the bag, makes the next floor and heals 30% of max hp', () => {
    let r = newRun({ seed: 9, round: 2, xp: 0, gear: [], potions: 0 });
    r = { ...r, status: 'exit_choice', player: { ...r.player, hp: 10 }, bag: { slots: [{ kind: 'furniture', typeId: 'skull_lamp' }], gold: 12 } };
    const d = step(r, [{ t: 'choose_exit', choice: 'deeper' }], 0, seededRng(1));
    expect(d.status).toBe('active');
    expect(d.floor).toBe(2);
    expect(d.player.hp).toBe(19);
    expect(d.player).toMatchObject({ x: d.map.spawn.x, y: d.map.spawn.y });
    expect(d.bag).toEqual(r.bag);
    expect(d.map.n).toBe(2);
    const nearlyFull = step({ ...r, player: { ...r.player, hp: 28 } }, [{ t: 'choose_exit', choice: 'deeper' }], 0, seededRng(1));
    expect(nearlyFull.player.hp).toBe(30);
  });

  it('death clears the bag and halves the run gold; xp is kept', () => {
    let r = testRun({ at: start, enemies: [enemyAt(1, start.x + 30, start.y, 'skeleton', 99)] });
    r = { ...r, xpGained: 9, player: { ...r.player, hp: 1 }, bag: { slots: [{ kind: 'material', id: 'crystal', qty: 2 }], gold: 41 }, banked: { slots: [], gold: 5 } };
    r = run(r, [], 1000);
    expect(r.status).toBe('dead');
    expect(r.bag).toEqual({ slots: [], gold: 0 });
    expect(r.banked.gold).toBe(5 + 20);
    expect(r.lost).toEqual({ slots: [{ kind: 'material', id: 'crystal', qty: 2 }], gold: 21 });
    expect(r.xpGained).toBe(9);
    expect(step(r, [{ t: 'click_point', x: 10, y: 10 }], 1000, seededRng(1))).toMatchObject({ status: 'dead', timeMs: r.timeMs });
  });

  it('leather armor makes each hit 1 less, but at least 1', () => {
    const dmg = (gear: 'leather_armor'[]) => {
      const ds = new Set<number>();
      for (let s = 0; s < 60; s++) {
        let r = testRun({ at: start, gear, enemies: [enemyAt(1, start.x + 30, start.y, 'slime')] });
        r = step(r, [], 400, seededRng(s));
        ds.add(30 - r.player.hp);
      }
      return [...ds].sort();
    };
    expect(dmg([])).toEqual([2, 3]);
    expect(dmg(['leather_armor'])).toEqual([1, 2]);
  });

  it('killing the Bone King drops throne pieces and banks the bag', () => {
    let r = testRun({ at: start, floor: 3, enemies: [enemyAt(1, start.x + 20, start.y, 'bone_king', 1)] });
    r = { ...r, bag: { slots: [{ kind: 'material', id: 'wood', qty: 3 }], gold: 10 } };
    r = step(r, [{ t: 'click_enemy', id: 1 }], 0, seededRng(1));
    expect(r.bossDefeated).toBe(true);
    expect(r.bag).toEqual({ slots: [], gold: 0 });
    expect(r.banked.gold).toBe(10);
    const pieces = r.banked.slots.find((s) => s.kind === 'material' && s.id === 'throne_piece');
    expect(pieces && pieces.kind === 'material' && pieces.qty).toBeGreaterThanOrEqual(1);
    expect(r.xpGained).toBe(40);
  });
});

describe('step: a full random run', () => {
  it('never puts more than 12 slots in the bag and keeps hp in range', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = seededRng(seed);
      let r = newRun({ seed, round: 2, xp: 0, gear: [], potions: 0 });
      for (let k = 0; k < 400 && r.status === 'active'; k++) {
        const c = r.chests.find((x) => !x.opened);
        const e = r.enemies.find((x) => distance(x, r.player) < 60);
        const input: DungeonInput[] = e ? [{ t: 'click_enemy', id: e.id }] : c ? [{ t: 'click_point', x: c.x, y: c.y }] : [];
        r = step(r, input, 400, rng);
        expect(r.bag.slots.length).toBeLessThanOrEqual(12);
        expect(r.player.hp).toBeLessThanOrEqual(r.player.maxHp);
      }
    }
  });
});

void B;
