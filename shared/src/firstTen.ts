// ONBOARD-1: the steps, their texts and pointer targets are DATA (shared/data/guide.json). Update that file, then docs/GUIDE-UPDATE.md, when a first-ten-minutes flow changes.
import guideData from '../data/guide.json';

export type FirstTenStep =
  | 'walk' | 'menu' | 'pour' | 'serve' | 'coins' | 'barrel' | 'collect' | 'load' | 'stove' | 'farm' | 'plant' | 'harvest' | 'build' | 'wall' | 'dungeon' | 'mine' | 'lakeside' | 'fish';

/** What the animated pointer sits on (see guide.json _help). */
export type GuideTarget =
  | { kind: 'floor' | 'guest' | 'stand' | 'coins' | 'none' }
  | { kind: 'furniture'; typeId: string }
  | { kind: 'ui'; label: string };

export interface GuideStepData {
  id: FirstTenStep;
  target: GuideTarget;
  text: string;
}

export const GUIDE_STEPS: readonly GuideStepData[] = guideData.steps as GuideStepData[];
export const FIRST_TEN_STEPS: readonly FirstTenStep[] = GUIDE_STEPS.map((s) => s.id);

/** The goal line for a step; {Tap}/{tap}/{hold} read right for touch and for mouse. */
export function guideText(step: FirstTenStep, touch: boolean): string {
  const raw = GUIDE_STEPS.find((s) => s.id === step)?.text ?? '';
  return raw
    .replaceAll('{Tap}', touch ? 'Tap' : 'Click')
    .replaceAll('{tap}', touch ? 'tap' : 'click')
    .replaceAll('{hold}', touch ? 'hold your finger on' : 'hold the mouse button on');
}

export function guideTargetOf(step: FirstTenStep): GuideTarget {
  return GUIDE_STEPS.find((s) => s.id === step)?.target ?? { kind: 'none' };
}

/** Done line shown when a step ticks off. */
export const FIRST_TEN_DONE_TEXT: string = guideData.done;
export const FIRST_TEN_ALL_DONE_TEXT: string = guideData.allDone;

/** What the world looks like now (the client fills it; this file never reads the game). */
export interface GuideContext {
  /** A brew is ready to collect. */
  brewReady: boolean;
  /** A seated guest has an open order. */
  guestWaiting: boolean;
  /** The avatar waits at the taps to pour. */
  pouring: boolean;
  /** The tray holds a mug a waiting guest wants. */
  trayServes: boolean;
  /** Coins lie on a table. */
  coinsOnTable: boolean;
  /** The mine is open (player level high enough); the mine step waits until then. */
  mineOpen: boolean;
}

/** What the world shows about the steps that have no event of their own (the client fills it; polled). */
export interface GuideWorld {
  /** The avatar has walked. */
  walked: boolean;
  /** A stove holds a batch. */
  cooking: boolean;
  /** The player stands in the farm. */
  inFarm: boolean;
  /** Build mode is on. */
  buildOn: boolean;
  /** A dungeon run is on. */
  inDungeon: boolean;
  /** The run on screen is a mine visit. */
  inMine: boolean;
  /** The player stands at the lakeside. */
  inLakeside: boolean;
}

/** Steps the world state proves are done (walk, stove, farm, build, dungeon); the client sends each as an event. */
export function guideAutoEvents(w: GuideWorld): FirstTenStep[] {
  const out: FirstTenStep[] = [];
  if (w.walked) out.push('walk');
  if (w.cooking) out.push('stove');
  if (w.inFarm) out.push('farm');
  if (w.buildOn) out.push('build');
  if (w.inDungeon && !w.inMine) out.push('dungeon');
  if (w.inMine) out.push('mine');
  if (w.inLakeside) out.push('lakeside');
  return out;
}

/** Steps that cannot be done yet (they are skipped as the goal until they can be). */
export function guideWaiting(s: FirstTenState, c: GuideContext): FirstTenStep[] {
  const w: FirstTenStep[] = [];
  if (!c.guestWaiting && !c.pouring) w.push('pour');
  if (!c.guestWaiting && !c.trayServes) w.push('serve');
  if (!c.coinsOnTable) w.push('coins');
  if (!(s.done.includes('collect') || c.brewReady)) w.push('collect', 'load');
  // The mine opens at a player level: until then its step waits and the tutorial shows nothing for it (other helpers stay hidden only while a goal shows).
  if (!c.mineOpen) w.push('mine');
  return w;
}

/** Where the pointer goes for the goal step: the stand while the avatar waits to pour (else the guest to tap first); serve = the guest the tray can serve. */
export function guidePointerKind(step: FirstTenStep, c: GuideContext): GuideTarget {
  const t = guideTargetOf(step);
  if (t.kind === 'stand') return c.pouring ? t : { kind: 'guest' };
  return t;
}

// The first ten minutes (FP-1): a short, skippable, guided opening in a new game. Pure: the client keeps the state (device storage, no save bump) and
// feeds events; this file knows the steps, their texts and which one to show. It never blocks play: a step can be done in any order, and a step that has
// to wait (a brew that is not ready) is skipped for the goal until it can be done.

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

/**
 * The stored tutorial state. TUT-2: nothing stored (an old save, a new device, cleared site data) or unreadable text = the tutorial has never run here, so it STARTS
 * (FIRST_TEN_NEW). A stored state is kept as it is: Continue resumes at the saved step, and a finished or skipped tutorial stays done.
 */
export function parseFirstTen(text: string | null): FirstTenState {
  let o: Record<string, unknown>;
  try {
    const raw: unknown = text === null ? null : JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return { ...FIRST_TEN_NEW };
    o = raw as Record<string, unknown>;
  } catch {
    return { ...FIRST_TEN_NEW };
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

/** Replay (Settings): the guide starts again from step 1; the machine tips stay seen. */
export function firstTenReplay(s: FirstTenState): FirstTenState {
  return { active: true, skipped: false, done: [], tips: s.tips };
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

/** The "one more done" toast fires only when the step that ticked is the goal the card shows (or it was the last one); other steps tick off silently. */
export function firstTenToastDue(before: FirstTenState, step: FirstTenStep, waiting: readonly FirstTenStep[] = []): boolean {
  if (!before.active || before.done.includes(step)) return false;
  return firstTenGoal(before, waiting) === step || firstTenFinished(firstTenEvent(before, step));
}

/** A machine tip is due the first time only; returns the new state and whether to show it. */
export function machineTipOnce(s: FirstTenState, tip: MachineTip): { state: FirstTenState; show: boolean } {
  if (s.tips.includes(tip)) return { state: s, show: false };
  return { state: { ...s, tips: [...s.tips, tip] }, show: true };
}

/** TUT-2: the state a game starts with. A NEW GAME always starts the tutorial fresh (machine tips seen before stay seen); Continue reads what was stored. */
export function firstTenOpen(stored: string | null, newGame: boolean): FirstTenState {
  return newGame ? { ...FIRST_TEN_NEW, tips: parseFirstTen(stored).tips } : parseFirstTen(stored);
}
