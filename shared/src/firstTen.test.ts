import { describe, expect, it } from 'vitest';
import { FIRST_TEN_NEW, FIRST_TEN_OFF, FIRST_TEN_STEPS, GUIDE_STEPS, firstTenEvent, firstTenFinished, firstTenGoal, firstTenReplay, firstTenSkip, firstTenToastDue, guideAutoEvents, guidePointerKind, guideTargetOf, guideText, guideWaiting, machineTipOnce, parseFirstTen, type GuideContext } from './firstTen.ts';
import { getFurnitureType } from './furniture.ts';
import { FIRST_GUEST_DELAY_MS } from './config.ts';

const quiet: GuideContext = { brewReady: false, guestWaiting: false, pouring: false, trayServes: false, coinsOnTable: false };

describe('first ten minutes', () => {
  it('shows one goal at a time, in order', () => {
    expect(firstTenGoal(FIRST_TEN_NEW)).toBe('walk');
    expect(firstTenGoal(firstTenEvent(FIRST_TEN_NEW, 'walk'))).toBe('menu');
  });
  it('lets steps be done in any order and skips waiting ones', () => {
    const s = firstTenEvent(FIRST_TEN_NEW, 'serve');
    expect(s.done).toEqual(['serve']);
    expect(firstTenGoal(s, ['barrel', 'collect', 'load'])).toBe('walk');
    expect(firstTenGoal(firstTenEvent(s, 'walk'), ['collect', 'load'])).toBe('menu');
  });
  it('ends when everything is done, and ignores repeats', () => {
    let s = FIRST_TEN_NEW;
    for (const k of FIRST_TEN_STEPS) s = firstTenEvent(s, k);
    expect(firstTenFinished(s)).toBe(true);
    expect(s.active).toBe(false);
    expect(firstTenGoal(s)).toBeNull();
    expect(firstTenEvent(FIRST_TEN_NEW, 'menu')).toEqual(firstTenEvent(firstTenEvent(FIRST_TEN_NEW, 'menu'), 'menu'));
  });
  it('skip turns it off for good and events then do nothing', () => {
    const s = firstTenSkip(FIRST_TEN_NEW);
    expect(s).toMatchObject({ active: false, skipped: true });
    expect(firstTenEvent(s, 'walk')).toBe(s);
    expect(firstTenGoal(s)).toBeNull();
  });
  it('toasts only when the ticked step is the goal on the card', () => {
    expect(firstTenToastDue(FIRST_TEN_NEW, 'walk')).toBe(true);
    expect(firstTenToastDue(FIRST_TEN_NEW, 'menu')).toBe(false);
    expect(firstTenToastDue(FIRST_TEN_NEW, 'menu', ['walk'])).toBe(true);
    expect(firstTenToastDue(firstTenEvent(FIRST_TEN_NEW, 'walk'), 'walk')).toBe(false);
    expect(firstTenToastDue(FIRST_TEN_OFF, 'walk')).toBe(false);
    let s = FIRST_TEN_NEW;
    for (const k of FIRST_TEN_STEPS.slice(0, -1)) s = firstTenEvent(s, k);
    expect(firstTenToastDue(s, FIRST_TEN_STEPS[FIRST_TEN_STEPS.length - 1]!)).toBe(true);
  });
  it('shows each machine tip once', () => {
    const a = machineTipOnce(FIRST_TEN_OFF, 'stove');
    expect(a.show).toBe(true);
    expect(machineTipOnce(a.state, 'stove').show).toBe(false);
    expect(machineTipOnce(a.state, 'tap').show).toBe(true);
  });
  it('parses stored text defensively', () => {
    expect(parseFirstTen(null)).toEqual(FIRST_TEN_OFF);
    expect(parseFirstTen('nonsense')).toEqual(FIRST_TEN_OFF);
    expect(parseFirstTen('{"active":true,"done":["menu","bogus"],"tips":["tap"]}')).toEqual({ active: true, skipped: false, done: ['menu'], tips: ['tap'] });
  });
  it('replay starts again from step 1 and keeps the machine tips', () => {
    const done = firstTenEvent(FIRST_TEN_NEW, 'walk');
    const r = firstTenReplay({ ...firstTenSkip(done), tips: ['tap'] });
    expect(r).toEqual({ active: true, skipped: false, done: [], tips: ['tap'] });
  });
});

describe('guide data (shared/data/guide.json, ONBOARD-1)', () => {
  it('has unique ids, a text and a known target for every step', () => {
    expect(new Set(FIRST_TEN_STEPS).size).toBe(FIRST_TEN_STEPS.length);
    for (const st of GUIDE_STEPS) {
      expect(st.text.length).toBeGreaterThan(10);
      expect(['floor', 'guest', 'stand', 'coins', 'none', 'furniture', 'ui']).toContain(st.target.kind);
      if (st.target.kind === 'furniture') expect(() => getFurnitureType(st.target.kind === 'furniture' ? st.target.typeId : '')).not.toThrow();
    }
  });
  it('covers walk, bar, taps, serve, coins, stove, farm, build and dungeon', () => {
    for (const id of ['walk', 'menu', 'pour', 'serve', 'coins', 'barrel', 'load', 'stove', 'farm', 'build', 'dungeon']) expect(FIRST_TEN_STEPS).toContain(id);
  });
  it('words touch and mouse differently and says tavern, never inn', () => {
    for (const st of GUIDE_STEPS) {
      const touch = guideText(st.id, true);
      const mouse = guideText(st.id, false);
      expect(touch).not.toMatch(/[{}]/);
      expect(mouse).not.toMatch(/[{}]/);
      expect(touch).not.toMatch(/click|mouse/i);
      expect(mouse).not.toMatch(/tap|finger/i);
      expect(`${touch} ${mouse}`).not.toMatch(/inn(keeper)?/i);
    }
  });
  it('every text can be read at reading pace in a short card (at most 120 characters)', () => {
    for (const st of GUIDE_STEPS) expect(guideText(st.id, true).length).toBeLessThanOrEqual(120);
  });
  it('the first coin can be tapped within 90 s of a new game (first guest + pour + walk)', () => {
    expect(FIRST_GUEST_DELAY_MS + 20_000).toBeLessThan(90_000);
  });
});

describe('guide waiting and pointer targets', () => {
  it('pour, serve and coins wait until they can be done', () => {
    expect(guideWaiting(FIRST_TEN_NEW, quiet)).toEqual(expect.arrayContaining(['pour', 'serve', 'coins', 'collect', 'load']));
    expect(guideWaiting(FIRST_TEN_NEW, { ...quiet, guestWaiting: true })).not.toContain('pour');
    expect(guideWaiting(FIRST_TEN_NEW, { ...quiet, brewReady: true })).not.toContain('collect');
    expect(guideWaiting(FIRST_TEN_NEW, { ...quiet, coinsOnTable: true })).not.toContain('coins');
    expect(guideWaiting(firstTenEvent(FIRST_TEN_NEW, 'collect'), quiet)).not.toContain('load');
  });
  it('the pointer sits on the guest first, then on the stand once the avatar waits to pour', () => {
    expect(guidePointerKind('pour', quiet).kind).toBe('guest');
    expect(guidePointerKind('pour', { ...quiet, pouring: true }).kind).toBe('stand');
    expect(guideTargetOf('menu')).toEqual({ kind: 'furniture', typeId: 'register' });
  });
  it('the world proves walk, stove, farm, build and dungeon', () => {
    const none = { walked: false, cooking: false, inFarm: false, buildOn: false, inDungeon: false };
    expect(guideAutoEvents(none)).toEqual([]);
    expect(guideAutoEvents({ walked: true, cooking: true, inFarm: true, buildOn: true, inDungeon: true })).toEqual(['walk', 'stove', 'farm', 'build', 'dungeon']);
    expect(guideAutoEvents({ ...none, inFarm: true })).toEqual(['farm']);
  });
});
