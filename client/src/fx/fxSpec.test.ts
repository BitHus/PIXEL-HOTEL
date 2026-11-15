import { describe, expect, it } from 'vitest';
import { ENEMY_CHASE_RANGE, ENEMY_WINDUP_MS, FX_HIT_STOP_MS, FX_LOW_HP_FRACTION, HIT_SHAKE_PX, HURT_SHAKE_PX, type RunEvent } from '@pixel-hotel/shared';
import { aggroStarted, directionTo, fxSpec, isBigHit, isLowHp, killBits, type FxContext, type FxSpec } from './fxSpec.ts';

const ctx = (over: Partial<FxContext> = {}): FxContext => ({
  reduce: false,
  player: { x: 0, y: 0 },
  attackMin: 4,
  attackMax: 6,
  enemy: (id) => (id === 1 ? { kind: 'slime', mimic: false, x: 30, y: 0 } : id === 2 ? { kind: 'bat', mimic: false, x: 0, y: 40 } : null),
  rock: (id) => (id === 9 ? { x: 64, y: 64 } : null),
  ...over,
});
const types = (s: FxSpec[]): string[] => s.map((x) => x.t);

describe('fxSpec: hit', () => {
  it('a plain hit: number, hit-stop, shake, squash, knockback away from the player, sparks, sound', () => {
    const s = fxSpec({ t: 'hit', enemyId: 1, damage: 4 }, ctx());
    expect(types(s)).toEqual(['floatText', 'hitStop', 'shake', 'squash', 'knockback', 'sparks', 'sound']);
    expect(s.find((x) => x.t === 'hitStop')).toEqual({ t: 'hitStop', ms: FX_HIT_STOP_MS });
    expect(s.find((x) => x.t === 'shake')).toMatchObject({ px: HIT_SHAKE_PX });
    expect(s.find((x) => x.t === 'knockback')).toMatchObject({ dx: 1, dy: 0 });
    expect(s.find((x) => x.t === 'floatText')).toMatchObject({ text: '-4', style: 'damage' });
  });
  it('a hit at the top of the attack range is big; a one-number range never is', () => {
    expect(fxSpec({ t: 'hit', enemyId: 1, damage: 6 }, ctx()).find((x) => x.t === 'floatText')).toMatchObject({ style: 'big' });
    expect(isBigHit(6, 4, 6)).toBe(true);
    expect(isBigHit(5, 4, 6)).toBe(false);
    expect(isBigHit(5, 5, 5)).toBe(false);
  });
  it('an enemy that is already gone still gets its number (above the head) and sound but no view effects', () => {
    const s = fxSpec({ t: 'hit', enemyId: 99, damage: 4 }, ctx());
    expect(types(s)).toEqual(['floatText', 'hitStop', 'shake', 'sound']);
    expect(s[0]).toMatchObject({ at: null });
  });
});

describe('fxSpec: the other events', () => {
  it('enemy_hit: number, hit-stop, hard shake, edge pulse, hurt sound', () => {
    const s = fxSpec({ t: 'enemy_hit', enemyId: 1, damage: 3 }, ctx());
    expect(types(s)).toEqual(['floatText', 'hitStop', 'shake', 'edgePulse', 'sound']);
    expect(s.find((x) => x.t === 'shake')).toMatchObject({ px: HURT_SHAKE_PX });
  });
  it('enemy_miss is only a text', () => {
    expect(types(fxSpec({ t: 'enemy_miss', enemyId: 1 }, ctx()))).toEqual(['floatText']);
  });
  it('windup: a telegraph for the whole wind-up and a sound', () => {
    expect(fxSpec({ t: 'windup', enemyId: 1 }, ctx())).toEqual([{ t: 'telegraph', enemyId: 1, ms: ENEMY_WINDUP_MS }, { t: 'sound', name: 'windup' }]);
  });
  it('kill: a burst of the right bits, a fade and a sound', () => {
    const slime = fxSpec({ t: 'kill', enemyId: 1, kind: 'slime', xp: 3, mimic: false }, ctx());
    expect(types(slime)).toEqual(['burst', 'fadeOut', 'sound']);
    expect(slime[0]).toMatchObject({ bits: 'goo' });
    expect(fxSpec({ t: 'kill', enemyId: 2, kind: 'bat', xp: 3, mimic: false }, ctx())[0]).toMatchObject({ bits: 'feather' });
    expect(killBits('skeleton', false)).toBe('bone');
    expect(killBits('bone_king', false)).toBe('bone');
    expect(killBits('skeleton', true)).toBe('debris');
  });
  it('chest: open + sound; loot: a pop, and the rank ping only for things (gold has the coin)', () => {
    expect(types(fxSpec({ t: 'chest', chestId: 3 }, ctx()))).toEqual(['chestOpen', 'sound']);
    expect(fxSpec({ t: 'loot', item: 'wood', qty: 2 }, ctx())).toEqual([{ t: 'lootPop', rank: 'common' }, { t: 'sound', name: 'found', rank: 'common' }]);
    expect(fxSpec({ t: 'loot', item: 'gold', qty: 5 }, ctx())).toEqual([{ t: 'lootPop', rank: 'common' }]);
    expect(fxSpec({ t: 'loot', item: 'x', qty: 1, rank: 'legendary' }, ctx())[1]).toEqual({ t: 'sound', name: 'found', rank: 'legendary' });
  });
  it('level up and stairs are sounds; a mine swing and a broken rock throw debris', () => {
    expect(fxSpec({ t: 'level_up', level: 2 }, ctx())).toEqual([{ t: 'sound', name: 'levelUp' }]);
    expect(fxSpec({ t: 'stairs', floor: 2, healed: 3 }, ctx())).toEqual([{ t: 'sound', name: 'stairs' }]);
    expect(fxSpec({ t: 'swing', rockId: 9, hits: 1 }, ctx())[0]).toMatchObject({ t: 'burst', bits: 'debris', count: 3 });
    const broken = fxSpec({ t: 'rock_broken', rockId: 9 }, ctx())[0] as Extract<FxSpec, { t: 'burst' }>;
    expect(broken.count).toBeGreaterThan(3);
  });
  it('events without an effect give nothing', () => {
    expect(fxSpec({ t: 'left' }, ctx())).toEqual([]);
    expect(fxSpec({ t: 'exit' }, ctx())).toEqual([]);
  });
});

describe('reduce effects', () => {
  it('keeps only float texts and sounds for every event', () => {
    const events: RunEvent[] = [
      { t: 'hit', enemyId: 1, damage: 6 }, { t: 'enemy_hit', enemyId: 1, damage: 3 }, { t: 'windup', enemyId: 1 },
      { t: 'kill', enemyId: 1, kind: 'slime', xp: 3, mimic: false }, { t: 'chest', chestId: 3 }, { t: 'loot', item: 'wood', qty: 1 },
      { t: 'swing', rockId: 9, hits: 1 }, { t: 'rock_broken', rockId: 9 }, { t: 'died' }, { t: 'mimic', enemyId: 1, chestId: 3 },
    ];
    for (const e of events) {
      for (const s of fxSpec(e, ctx({ reduce: true }))) expect(['floatText', 'sound'], e.t).toContain(s.t);
    }
    expect(fxSpec({ t: 'hit', enemyId: 1, damage: 6 }, ctx({ reduce: true })).some((s) => s.t === 'floatText')).toBe(true);
  });
});

describe('small helpers', () => {
  it('aggro starts when the distance crosses the chase range inward, not before, not while inside', () => {
    expect(aggroStarted(ENEMY_CHASE_RANGE + 10, ENEMY_CHASE_RANGE - 1)).toBe(true);
    expect(aggroStarted(ENEMY_CHASE_RANGE - 5, ENEMY_CHASE_RANGE - 20)).toBe(false);
    expect(aggroStarted(ENEMY_CHASE_RANGE + 10, ENEMY_CHASE_RANGE + 5)).toBe(false);
    expect(aggroStarted(null, 10)).toBe(false);
  });
  it('low hp is under the fraction and above 0', () => {
    expect(isLowHp(8, 30)).toBe(true);
    expect(isLowHp(Math.ceil(30 * FX_LOW_HP_FRACTION), 30)).toBe(false);
    expect(isLowHp(0, 30)).toBe(false);
  });
  it('directionTo is a unit vector or zero', () => {
    expect(directionTo({ x: 0, y: 0 }, { x: 0, y: 5 })).toEqual({ dx: 0, dy: 1 });
    expect(directionTo({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ dx: 0, dy: 0 });
  });
});
