// The first-ten-minutes guide (FP-1): one small goal card at the top with a Skip button, each step ticks off by itself, and one-time machine tips.
// State lives in device storage (FIRST_TEN_KEY), not in the save. It never blocks play: it only shows text. Classes: .frame, .btn (ui.css); the card
// has its own class .first-ten for the artist to style; until then it is placed with inline style.

import {
  FIRST_TEN_ALL_DONE_TEXT, FIRST_TEN_DONE_TEXT, FIRST_TEN_KEY, FIRST_TEN_NEW, FIRST_TEN_STEPS, MACHINE_TIP_TEXT, firstTenEvent,
  firstTenFinished, firstTenGoal, firstTenReplay, firstTenSkip, guideText, firstTenToastDue, machineTipOnce, parseFirstTen, type FirstTenState, type FirstTenStep, type MachineTip,
} from '@pixel-hotel/shared';
import type { SaveStorage } from '../api/saveStorage.ts';
import { el, textButton } from './dom.ts';
import type { Toast } from './toast.ts';

export interface FirstTenGuide {
  /** A brand new game: starts the guide fresh. */
  begin(): void;
  /** A step happened (any order). */
  event(step: FirstTenStep): void;
  /** The first touch of a machine: a one-time tooltip (also when the guide is skipped). */
  tip(tip: MachineTip): void;
  /** Redraws; `waiting` = steps that cannot be done yet (they are skipped as the goal); `visible` = false hides the card (other rooms). */
  refresh(waiting: readonly FirstTenStep[], visible: boolean): void;
  /** Settings: start the guide again from step 1. */
  replay(): void;
  /** The step the card shows now (null = none), for the pointer. */
  goal(): FirstTenStep | null;
  readonly state: FirstTenState;
}

/** True on a touch screen: the texts say Tap/hold your finger, else Click/hold the mouse button. */
const isTouch = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function createFirstTenGuide(parent: HTMLElement, storage: SaveStorage, toast: Toast): FirstTenGuide {
  let state = parseFirstTen(storage.get(FIRST_TEN_KEY));
  let waiting: readonly FirstTenStep[] = [];
  let visible = true;
  const save = (): void => void storage.set(FIRST_TEN_KEY, JSON.stringify(state));
  const card = el('div', 'frame first-ten');
  card.setAttribute('role', 'status');
  // Placement and look are in skin.css (.first-ten): top centre on a wide screen, between the info panel and the button column on a phone.
  const count = el('span', 'first-ten-count');
  const text = el('span', 'first-ten-text');
  const pips = el('span', 'first-ten-pips');
  for (let i = 0; i < FIRST_TEN_STEPS.length; i++) pips.appendChild(el('i'));
  const body = el('span', 'first-ten-body');
  const head = el('span', 'first-ten-head', 'First steps');
  body.append(head, text);
  const skip = textButton('Skip', () => {
    state = firstTenSkip(state);
    save();
    draw();
  }, 'small first-ten-skip');
  card.append(count, body, skip);
  body.appendChild(pips);
  card.hidden = true;
  // Phone: the card is ONE line plus the step count; a tap on it opens the whole text and Skip (skin.css .first-ten:not(.expanded)).
  card.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('.first-ten-skip')) return;
    card.classList.toggle('expanded');
    announce();
  });
  parent.appendChild(card);

  function draw(): void {
    const goal = firstTenGoal(state, waiting);
    card.hidden = !visible || goal === null;
    // Stack order: the orders strip is above the card; when it shows, the card sits right under it.
    const strip = document.querySelector<HTMLElement>('.orders-strip:not([hidden])');
    card.style.top = strip ? `${strip.offsetTop + strip.offsetHeight + 6}px` : '';
    if (goal === null) {
      announce();
      return;
    }
    count.textContent = `${state.done.length + 1}/${FIRST_TEN_STEPS.length}`;
    text.textContent = guideText(goal, isTouch());
    pips.querySelectorAll('i').forEach((p, i) => p.classList.toggle('done', i < state.done.length));
    card.setAttribute('aria-label', `First steps, ${count.textContent}`);
    announce();
  }
  /** Tells the layout where the card ends (--ft-bottom, px from the top of the UI): panels and the quest card start below it. */
  function announce(): void {
    parent.style.setProperty('--ft-bottom', card.hidden ? '0px' : `${card.offsetTop + card.offsetHeight + 6}px`);
    window.dispatchEvent(new Event('first-ten-layout'));
  }
  window.addEventListener('resize', announce);
  draw();
  return {
    begin() {
      state = { ...FIRST_TEN_NEW };
      save();
      draw();
    },
    replay() {
      state = firstTenReplay(state);
      save();
      draw();
    },
    goal() {
      return visible ? firstTenGoal(state, waiting) : null;
    },
    event(step) {
      const next = firstTenEvent(state, step);
      if (next === state) return;
      const due = firstTenToastDue(state, step, waiting);
      state = next;
      save();
      if (due) toast(firstTenFinished(state) ? FIRST_TEN_ALL_DONE_TEXT : FIRST_TEN_DONE_TEXT);
      draw();
    },
    tip(tip) {
      const r = machineTipOnce(state, tip);
      if (!r.show) return;
      state = r.state;
      save();
      toast(MACHINE_TIP_TEXT[tip]);
    },
    refresh(w, v) {
      waiting = w;
      visible = v;
      draw();
    },
    get state() {
      return state;
    },
  };
}
