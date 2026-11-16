// The first-ten-minutes guide (FP-1): one small goal card at the top with a Skip button, each step ticks off by itself, and one-time machine tips.
// State lives in device storage (FIRST_TEN_KEY), not in the save. It never blocks play: it only shows text. Classes: .frame, .btn (ui.css); the card
// has its own class .first-ten for the artist to style; until then it is placed with inline style.

import {
  FIRST_TEN_ALL_DONE_TEXT, FIRST_TEN_DONE_TEXT, FIRST_TEN_KEY, FIRST_TEN_NEW, FIRST_TEN_STEPS, FIRST_TEN_TEXT, MACHINE_TIP_TEXT, firstTenEvent,
  firstTenFinished, firstTenGoal, firstTenSkip, machineTipOnce, parseFirstTen, type FirstTenState, type FirstTenStep, type MachineTip,
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
  readonly state: FirstTenState;
}

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
  parent.appendChild(card);

  function draw(): void {
    const goal = firstTenGoal(state, waiting);
    card.hidden = !visible || goal === null;
    if (goal === null) return;
    count.textContent = `${state.done.length + 1}/${FIRST_TEN_STEPS.length}`;
    text.textContent = FIRST_TEN_TEXT[goal];
    pips.querySelectorAll('i').forEach((p, i) => p.classList.toggle('done', i < state.done.length));
    card.setAttribute('aria-label', `First steps, ${count.textContent}`);
  }
  draw();
  return {
    begin() {
      state = { ...FIRST_TEN_NEW };
      save();
      draw();
    },
    event(step) {
      const next = firstTenEvent(state, step);
      if (next === state) return;
      state = next;
      save();
      toast(firstTenFinished(state) ? FIRST_TEN_ALL_DONE_TEXT : FIRST_TEN_DONE_TEXT);
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
