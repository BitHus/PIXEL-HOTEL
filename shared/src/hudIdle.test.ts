import { describe, expect, it } from 'vitest';
import { GUIDE_IDLE_MS, HUD_FADE_AFTER_MS } from './config.ts';
import { guideShown, hudFaded, type HudIdleInput } from './hudIdle.ts';

const base: HudIdleInput = { now: 10_000, lastTapAt: 0, lastWalkAt: 0, lastChangeAt: 0, panelOpen: false, toastShowing: false, pouring: false, pressing: false, editing: false };

describe('hudFaded', () => {
  it('fades after the idle time and not before', () => {
    expect(hudFaded({ ...base, now: HUD_FADE_AFTER_MS - 1 })).toBe(false);
    expect(hudFaded({ ...base, now: HUD_FADE_AFTER_MS })).toBe(true);
  });
  it('a tap or a change brings it back', () => {
    expect(hudFaded({ ...base, lastTapAt: 9_000 })).toBe(false);
    expect(hudFaded({ ...base, lastChangeAt: 9_000 })).toBe(false);
  });
  it('walking does not count as activity', () => {
    expect(hudFaded({ ...base, lastWalkAt: 9_999 })).toBe(true);
  });
  it('never fades a panel, a toast, a pour, a press or editing', () => {
    for (const k of ['panelOpen', 'toastShowing', 'pouring', 'pressing', 'editing'] as const) expect(hudFaded({ ...base, [k]: true })).toBe(false);
  });
});

describe('guideShown', () => {
  it('shows after the idle time', () => {
    expect(guideShown({ ...base, now: GUIDE_IDLE_MS - 1 }, false)).toBe(false);
    expect(guideShown({ ...base, now: GUIDE_IDLE_MS }, false)).toBe(true);
  });
  it('hides while walking, with a panel or a finger down; walking resets the wait', () => {
    expect(guideShown(base, true)).toBe(false);
    expect(guideShown({ ...base, panelOpen: true }, false)).toBe(false);
    expect(guideShown({ ...base, pressing: true }, false)).toBe(false);
    expect(guideShown({ ...base, lastWalkAt: 8_000 }, false)).toBe(false);
  });
});
