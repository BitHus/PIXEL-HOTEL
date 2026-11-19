// The first-ten-minutes guide (FP-1): one small goal card at the top with a Skip button, each step ticks off by itself, and one-time machine tips.
// State lives in device storage (FIRST_TEN_KEY), not in the save. It never blocks play: it only shows text. Classes: .frame, .btn (ui.css); the card
// has its own class .first-ten for the artist to style; until then it is placed with inline style.

import {
  FIRST_TEN_ALL_DONE_TEXT, FIRST_TEN_DONE_TEXT, FIRST_TEN_KEY, FIRST_TEN_NEW, FIRST_TEN_STEPS, MACHINE_TIP_TEXT, firstTenEvent,
  firstTenFinished, firstTenGoal, firstTenOpen, firstTenProgress, firstTenReplay, firstTenSkip, guideCardText, firstTenToastDue, machineTipOnce, type FirstTenState, type FirstTenStep, type GuideStock, type MachineTip,
} from '@pixel-hotel/shared';
import type { SaveStorage } from '../api/saveStorage.ts';
import { el, textButton } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';
import type { Toast } from './toast.ts';

export interface FirstTenGuide {
  /** A brand new game: starts the guide fresh. */
  begin(): void;
  /** A step happened (any order). */
  event(step: FirstTenStep): void;
  /** The first touch of a machine: a one-time tooltip (also when the guide is skipped). */
  tip(tip: MachineTip): void;
  /** Redraws; `waiting` = steps that cannot be done yet (they are skipped as the goal); `visible` = false hides the card (other rooms). */
  refresh(waiting: readonly FirstTenStep[], visible: boolean, stock?: GuideStock): void;
  /** Settings: start the guide again from step 1. */
  replay(): void;
  /** The step the card shows now (null = none), for the pointer. */
  goal(): FirstTenStep | null;
  readonly state: FirstTenState;
}

/** True on a touch screen: the texts say Tap/hold your finger, else Click/hold the mouse button. */
const isTouch = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** The phone layout of the card (skin.css: one folded line under 680 px). */
const isPhone = (): boolean => typeof matchMedia === 'function' && matchMedia('(max-width: 680px)').matches;

/** DECLUTTER: `idle.guideAllowed()` = the player stood idle for GUIDE_IDLE_MS (no walk, no panel); `onGuideChange` redraws. Without it the card always shows. */
export interface GuideIdle {
  guideAllowed(): boolean;
  onGuideChange(listener: () => void): void;
}

export function createFirstTenGuide(parent: HTMLElement, storage: SaveStorage, toast: Toast, newGame = false, idle?: GuideIdle): FirstTenGuide {
  let state = firstTenOpen(storage.get(FIRST_TEN_KEY), newGame);
  let waiting: readonly FirstTenStep[] = [];
  let visible = true;
  let stock: GuideStock | undefined;
  const save = (): void => void storage.set(FIRST_TEN_KEY, JSON.stringify(state));
  const card = el('div', 'ui-panel first-ten');
  card.setAttribute('role', 'status');
  // Placement and look are in skin.css (.first-ten): top centre on a wide screen, between the info panel and the button column on a phone.
  const count = el('span', 'first-ten-count');
  const text = el('span', 'first-ten-text');
  const pips = el('span', 'first-ten-pips');
  for (let i = 0; i < FIRST_TEN_STEPS.length; i++) pips.appendChild(el('i'));
  const body = el('span', 'first-ten-body');
  const head = el('span', 'first-ten-head', 'First steps');
  body.append(head, text);
  // DECLUTTER: the card is one line plus dots; Skip is a small x (44 px touch box, declutter.css).
  const skip = textButton('×', () => {
    state = firstTenSkip(state);
    save();
    draw();
  }, 'small first-ten-skip');
  skip.title = 'Skip the first steps';
  skip.setAttribute('aria-label', 'Skip the first steps');
  const icon = pixelIcon('quest');
  icon.classList.add('first-ten-icon');
  card.append(icon, body, count, skip);
  body.appendChild(pips);
  card.hidden = true;
  // Phone: the card is ONE line plus the step count; a tap on it opens the whole text and Skip (skin.css .first-ten:not(.expanded)).
  card.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('.first-ten-skip')) return;
    card.classList.toggle('expanded');
    draw();
  });
  parent.appendChild(card);

  function draw(): void {
    const goal = firstTenGoal(state, waiting);
    card.hidden = !visible || goal === null || (idle !== undefined && !idle.guideAllowed());
    // Stack order on a wide screen: the orders strip is above the card; when it shows, the card sits right under it (on a phone the rail is at the bottom, the card stays in the top band).
    const strip = document.querySelector<HTMLElement>('.orders-strip:not([hidden])');
    card.style.top = strip && !isPhone() ? `${strip.offsetTop + strip.offsetHeight + 6}px` : '';
    if (goal === null) {
      announce();
      return;
    }
    count.textContent = `${firstTenProgress(state)}/${FIRST_TEN_STEPS.length}`;
    // RUN 5: a folded card on a phone shows the step's short line (never cut off); a tap on the card shows the whole text.
    // A1e: when something real blocks the step (no crops, no mugs, no gold) the card says how to fix that instead.
    text.textContent = guideCardText(goal, stock, isTouch(), isPhone() && !card.classList.contains('expanded'));
    pips.querySelectorAll('i').forEach((p, i) => p.classList.toggle('done', state.done.includes(FIRST_TEN_STEPS[i]!)));
    card.setAttribute('aria-label', `First steps, ${count.textContent}`);
    announce();
  }
  /** Tells the layout where the card ends (--ft-bottom, px from the top of the UI): panels and the quest card start below it. */
  function announce(): void {
    parent.style.setProperty('--ft-bottom', card.hidden || !isPhone() ? '0px' : `${card.offsetTop + card.offsetHeight + 6}px`);
    window.dispatchEvent(new Event('first-ten-layout'));
  }
  window.addEventListener('resize', draw);
  idle?.onGuideChange(draw);
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
    refresh(w, v, s) {
      stock = s;
      waiting = w;
      visible = v;
      draw();
    },
    get state() {
      return state;
    },
  };
}
