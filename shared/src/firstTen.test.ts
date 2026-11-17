import { describe, expect, it } from 'vitest';
import { FIRST_TEN_NEW, FIRST_TEN_OFF, FIRST_TEN_STEPS, GUIDE_STEPS, firstTenEvent, firstTenFinished, firstTenGoal, firstTenOpen, firstTenReplay, firstTenSkip, firstTenStepNumber, firstTenToastDue, guideAutoEvents, guidePointerKind, guideTargetOf, guideText, guideWaiting, machineTipOnce, parseFirstTen, type GuideContext } from './firstTen.ts';
import { getFurnitureType } from './furniture.ts';
import { FIRST_GUEST_DELAY_MS } from './config.ts';

const quiet: GuideContext = { brewReady: false, guestWaiting: false, pouring: false, trayServes: false, coinsOnTable: false, mineOpen: true };

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
    // TUT-2: nothing stored or unreadable = the tutorial never ran here, so it starts.
    expect(parseFirstTen(null)).toEqual(FIRST_TEN_NEW);
    expect(parseFirstTen('nonsense')).toEqual(FIRST_TEN_NEW);
    expect(parseFirstTen('{"active":true,"done":["menu","bogus"],"tips":["tap"]}')).toEqual({ active: true, skipped: false, done: ['menu'], tips: ['tap'] });
  });
  it('replay starts again from step 1 and keeps the machine tips', () => {
    const done = firstTenEvent(FIRST_TEN_NEW, 'walk');
    const r = firstTenReplay({ ...firstTenSkip(done), tips: ['tap'] });
    expect(r).toEqual({ active: true, skipped: false, done: [], tips: ['tap'] });
  });
});

describe('tutorial state machine (TUT-2: new game, Continue, finished, skipped)', () => {
  const stored = (st: object): string => JSON.stringify(st);
  it('a new game always starts the tutorial, whatever was stored before', () => {
    const finished = stored({ ...FIRST_TEN_OFF, done: [...FIRST_TEN_STEPS], tips: ['tap'] });
    for (const old of [null, 'junk', finished, stored(firstTenSkip(FIRST_TEN_NEW))]) {
      const s = firstTenOpen(old, true);
      expect(s).toMatchObject({ active: true, skipped: false, done: [] });
      expect(firstTenGoal(s)).toBe('walk');
    }
    expect(firstTenOpen(finished, true).tips).toEqual(['tap']);
  });
  it('Continue resumes at the saved step and never restarts at step 1', () => {
    let s = FIRST_TEN_NEW;
    for (const k of ['walk', 'menu', 'pour', 'serve'] as const) s = firstTenEvent(s, k);
    const back = firstTenOpen(stored(s), false);
    expect(back.done).toEqual(['walk', 'menu', 'pour', 'serve']);
    expect(firstTenGoal(back)).toBe('coins');
  });
  it('Continue with nothing stored (an old save) starts the tutorial', () => {
    expect(firstTenGoal(firstTenOpen(null, false))).toBe('walk');
  });
  it('a finished or skipped tutorial stays done after Continue', () => {
    let s = FIRST_TEN_NEW;
    for (const k of FIRST_TEN_STEPS) s = firstTenEvent(s, k);
    expect(firstTenOpen(stored(s), false).active).toBe(false);
    expect(firstTenGoal(firstTenOpen(stored(s), false))).toBeNull();
    const skipped = firstTenOpen(stored(firstTenSkip(FIRST_TEN_NEW)), false);
    expect(skipped).toMatchObject({ active: false, skipped: true });
    expect(firstTenGoal(skipped)).toBeNull();
  });
  it('the mine step waits until the mine is open and then shows again', () => {
    let s = FIRST_TEN_NEW;
    for (const k of FIRST_TEN_STEPS.filter((x) => x !== 'mine' && x !== 'lakeside' && x !== 'fish')) s = firstTenEvent(s, k);
    const waiting = guideWaiting(s, { ...quiet, mineOpen: false });
    expect(waiting).toContain('mine');
    expect(firstTenGoal(s, waiting)).toBe('lakeside');
    expect(firstTenGoal(firstTenEvent(firstTenEvent(s, 'lakeside'), 'fish'), waiting)).toBeNull();
    expect(firstTenGoal(firstTenEvent(firstTenEvent(s, 'lakeside'), 'fish'), guideWaiting(s, quiet))).toBe('mine');
  });
  it('the world proves farm, mine and lakeside steps', () => {
    const w = { walked: false, cooking: false, inFarm: false, buildOn: false, inDungeon: false, inMine: false, inLakeside: false };
    expect(guideAutoEvents({ ...w, inDungeon: true })).toEqual(['dungeon']);
    expect(guideAutoEvents({ ...w, inDungeon: true, inMine: true })).toEqual(['mine']);
    expect(guideAutoEvents({ ...w, inLakeside: true })).toEqual(['lakeside']);
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
    for (const id of ['walk', 'menu', 'pour', 'serve', 'coins', 'barrel', 'load', 'stove', 'farm', 'plant', 'harvest', 'build', 'wall', 'dungeon', 'mine', 'lakeside', 'fish']) expect(FIRST_TEN_STEPS).toContain(id);
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
    const none = { walked: false, cooking: false, inFarm: false, buildOn: false, inDungeon: false, inMine: false, inLakeside: false };
    expect(guideAutoEvents(none)).toEqual([]);
    expect(guideAutoEvents({ ...none, walked: true, cooking: true, inFarm: true, buildOn: true, inDungeon: true })).toEqual(['walk', 'stove', 'farm', 'build', 'dungeon']);
    expect(guideAutoEvents({ ...none, inFarm: true })).toEqual(['farm']);
  });
});

describe('RUN 5: the step count follows the goal text', () => {
  it('a step done out of order does not push the count past the goal shown', () => {
    // walk and stove done, menu (step 2) is still the goal: the card must say 2/18, not 3/18.
    const s = firstTenEvent(firstTenEvent(FIRST_TEN_NEW, 'walk'), 'stove');
    const goal = firstTenGoal(s);
    expect(goal).toBe('menu');
    expect(firstTenStepNumber(goal!)).toBe(2);
    for (const [i, k] of FIRST_TEN_STEPS.entries()) expect(firstTenStepNumber(k)).toBe(i + 1);
  });
});

describe('RUN 5: phone short lines', () => {
  it('every step has a short line that fits the folded phone card', () => {
    for (const s of GUIDE_STEPS) {
      expect(s.short, s.id).toBeTruthy();
      expect(guideText(s.id, true, true).length, s.id).toBeLessThanOrEqual(32);
    }
    expect(guideText('menu', true, true)).toBe('Tap the register');
    expect(guideText('menu', false, true)).toBe('Click the register');
    expect(guideText('menu', true)).toContain('serve, set prices, sell');
  });
});
