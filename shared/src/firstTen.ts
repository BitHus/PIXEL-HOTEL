// The first ten minutes (FP-1): a short, skippable, guided opening in a new game. Pure: the client keeps the state (device storage, no save bump) and
// feeds events; this file knows the steps, their texts and which one to show. It never blocks play: a step can be done in any order, and a step that has
// to wait (a brew that is not ready) is skipped for the goal until it can be done.

export const FIRST_TEN_STEPS = ['barrel', 'collect', 'load', 'menu', 'serve', 'coins'] as const;
export type FirstTenStep = (typeof FIRST_TEN_STEPS)[number];

/** The one on-screen goal for each step. */
export const FIRST_TEN_TEXT: Record<FirstTenStep, string> = {
  barrel: 'Tap the brewing barrel and start a brew.',
  collect: 'Collect the mugs when the brew is ready.',
  load: 'Open a tap stand and load the mugs on it.',
  menu: 'Tap the register to open the menu.',
  serve: 'Tap a guest who waits to serve the first order.',
  coins: 'Tap the coins on the table.',
};

/** Done line shown when a step ticks off. */
export const FIRST_TEN_DONE_TEXT = 'Nice, that is one more done.';
export const FIRST_TEN_ALL_DONE_TEXT = 'You know the tavern now. Have fun, innkeeper!';

/** One-time tooltips on the first touch of a machine, never again. */
export const MACHINE_TIPS = ['barrel', 'stove', 'tap'] as const;
export type MachineTip = (typeof MACHINE_TIPS)[number];
export const MACHINE_TIP_TEXT: Record<MachineTip, string> = {
  barrel: 'The barrel turns crops into mugs of drink. Pick a drink, start it, and collect it when it is ready.',
  stove: 'The stove cooks crops into dishes. Start a batch; tap the stove again to collect it.',
  tap: 'Drinks are poured from the taps. Load mugs on one so guests can order them.',
};

export interface FirstTenState {
  /** False = never started (an old save) or ended. */
  active: boolean;
  skipped: boolean;
  done: FirstTenStep[];
  /** Machine tips already shown. */
  tips: MachineTip[];
}

export const FIRST_TEN_NEW: FirstTenState = { active: true, skipped: false, done: [], tips: [] };
export const FIRST_TEN_OFF: FirstTenState = { active: false, skipped: false, done: [], tips: [] };

export function parseFirstTen(text: string | null): FirstTenState {
  let o: Record<string, unknown> = {};
  try {
    const raw: unknown = text === null ? null : JSON.parse(text);
    if (typeof raw === 'object' && raw !== null) o = raw as Record<string, unknown>;
  } catch {
    o = {};
  }
  const list = <T extends string>(v: unknown, all: readonly T[]): T[] => (Array.isArray(v) ? all.filter((k) => v.includes(k)) : []);
  return {
    active: o.active === true,
    skipped: o.skipped === true,
    done: list(o.done, FIRST_TEN_STEPS),
    tips: list(o.tips, MACHINE_TIPS),
  };
}

/** The step ticks off (any order). Unknown or already done = the same state. */
export function firstTenEvent(s: FirstTenState, step: FirstTenStep): FirstTenState {
  if (!s.active || s.done.includes(step)) return s;
  const done = FIRST_TEN_STEPS.filter((k) => k === step || s.done.includes(k));
  return { ...s, done, active: done.length < FIRST_TEN_STEPS.length };
}

/** Skip: the guide goes away for good. */
export function firstTenSkip(s: FirstTenState): FirstTenState {
  return s.active ? { ...s, active: false, skipped: true } : s;
}

/** The goal to show now: the first step not done and not waiting; null when none is left (or the guide is off). */
export function firstTenGoal(s: FirstTenState, waiting: readonly FirstTenStep[] = []): FirstTenStep | null {
  if (!s.active) return null;
  return FIRST_TEN_STEPS.find((k) => !s.done.includes(k) && !waiting.includes(k)) ?? null;
}

/** True when every step is done (the guide ended by itself). */
export function firstTenFinished(s: FirstTenState): boolean {
  return FIRST_TEN_STEPS.every((k) => s.done.includes(k));
}

/** A machine tip is due the first time only; returns the new state and whether to show it. */
export function machineTipOnce(s: FirstTenState, tip: MachineTip): { state: FirstTenState; show: boolean } {
  if (s.tips.includes(tip)) return { state: s, show: false };
  return { state: { ...s, tips: [...s.tips, tip] }, show: true };
}
