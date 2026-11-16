import { describe, expect, it } from 'vitest';
import { FIRST_TEN_NEW, FIRST_TEN_OFF, FIRST_TEN_STEPS, firstTenEvent, firstTenFinished, firstTenGoal, firstTenSkip, firstTenToastDue, machineTipOnce, parseFirstTen } from './firstTen.ts';

describe('first ten minutes', () => {
  it('shows one goal at a time, in order', () => {
    expect(firstTenGoal(FIRST_TEN_NEW)).toBe('barrel');
    expect(firstTenGoal(firstTenEvent(FIRST_TEN_NEW, 'barrel'))).toBe('collect');
  });
  it('lets steps be done in any order and skips waiting ones', () => {
    const s = firstTenEvent(FIRST_TEN_NEW, 'serve');
    expect(s.done).toEqual(['serve']);
    expect(firstTenGoal(s, ['barrel', 'collect', 'load'])).toBe('menu');
    expect(firstTenGoal(firstTenEvent(s, 'barrel'), ['collect', 'load'])).toBe('menu');
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
    expect(firstTenEvent(s, 'barrel')).toBe(s);
    expect(firstTenGoal(s)).toBeNull();
  });
  it('toasts only when the ticked step is the goal on the card', () => {
    expect(firstTenToastDue(FIRST_TEN_NEW, 'barrel')).toBe(true);
    expect(firstTenToastDue(FIRST_TEN_NEW, 'menu')).toBe(false);
    expect(firstTenToastDue(FIRST_TEN_NEW, 'menu', ['barrel', 'collect', 'load'])).toBe(true);
    expect(firstTenToastDue(firstTenEvent(FIRST_TEN_NEW, 'barrel'), 'barrel')).toBe(false);
    expect(firstTenToastDue(FIRST_TEN_OFF, 'barrel')).toBe(false);
    let s = FIRST_TEN_NEW;
    for (const k of FIRST_TEN_STEPS.slice(0, -1)) s = firstTenEvent(s, k);
    expect(firstTenToastDue(s, 'coins')).toBe(true);
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
});
