// The quest card in the HTML overlay (step 7; the floating sale gold and the till coins went with the
// loot customers in step S1).

import { HINTS, QUEST_CARD_POP_MS, readingMs, type Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface HintBox {
  /** The current quest (null = none). A new one shows at once. */
  set(text: string | null): void;
  /** Shows the current quest again, or hides it when it shows (the quest button). */
  toggle(): void;
  /** While a panel is open the card steps aside (it opens where the panels open). */
  setCovered(covered: boolean): void;
  /** True = only the quest seal shows (the card shrinks so it never covers the room: the coder calls it when the player walks, or outside the tavern); false = the full card. It also shrinks by itself after the text was read. */
  setCompact(compact: boolean): void;
  /** OA-4: true while the first-steps guide runs: the quest card, button glow and nudges stay hidden (one guide at a time); false brings the pending quest back. */
  setHeld(held: boolean): void;
  /** Called when the quest or whether its card shows changes. */
  onChange(listener: (quest: string | null, showing: boolean) => void): void;
}

/**
 * The quest card (the first-run hints, HINTS): it opens from the quest button at the top of the
 * right-edge column, to its left, with a small tail pointing at the button. It shows "Quest 1 of
 * 3", the task, and "tap to hide". It stays until the player taps it; a hidden quest comes back
 * with the quest button (which blinks while a quest is going and its card is hidden) or when the
 * next quest comes. It pops in and out like the panels (scale 0.95 <-> 1 with a fade, QUEST_CARD_POP_MS,
 * smooth, from its own corner, so it never jumps; step 9d: it used to grow from 0.6 in 4 big steps
 * and fade out slowly, which stuttered). When the screen is too narrow
 * for it next to `avoid` (the top-left info column), it goes under that column instead (no tail).
 */
export function createHintBox(parent: HTMLElement, avoid: HTMLElement): HintBox {
  const box = el('div', 'ui-panel quest-card');
  box.setAttribute('role', 'status');
  box.style.setProperty('--pop-ms', `${QUEST_CARD_POP_MS}ms`);
  const head = el('div', 'quest-head');
  const step = el('span', '', '');
  head.append(pixelIcon('quest'), step);
  const text = el('div', 'quest-text');
  const more = el('div', 'quest-hide', 'tap to hide');
  box.append(head, text, more);
  box.hidden = true;
  parent.appendChild(box);
  /** The current quest, shown or not. */
  let quest: string | null = null;
  let showing = false;
  let covered = false;
  const dismissed = new Set<string>();
  const listeners: ((quest: string | null, showing: boolean) => void)[] = [];
  const changed = (): void => {
    for (const l of listeners) l(quest, showing);
  };
  let compactTimer = 0;
  const setCompact = (c: boolean): void => {
    window.clearTimeout(compactTimer);
    box.classList.toggle('compact', c);
    place();
  };
  const place = (): void => {
    if (box.hidden) return;
    box.classList.remove('below');
    box.style.top = '';
    // Layout boxes (offset*), not the screen rects: the pop-in animation scales the card.
    const p = parent.getBoundingClientRect();
    const a = avoid.getBoundingClientRect();
    const left = box.offsetLeft;
    const top = box.offsetTop;
    if (left < a.right - p.left + 6 && top < a.bottom - p.top) {
      box.classList.add('below');
      // Under the info column, and under the first-steps card when that one is lower (--ft-bottom, firstTenGuide.ts).
      const ft = Number.parseFloat(parent.style.getPropertyValue('--ft-bottom')) || 0;
      box.style.top = `${Math.max(a.bottom - p.top + 6, ft)}px`;
    }
  };
  window.addEventListener('resize', place);
  window.addEventListener('first-ten-layout', place);
  const draw = (): void => {
    box.classList.toggle('covered', covered);
    place();
  };
  const show = (): void => {
    const n = HINTS.indexOf(quest as (typeof HINTS)[number]);
    step.textContent = n >= 0 ? `Quest ${n + 1} of ${HINTS.length}` : 'Quest';
    text.textContent = quest ?? '';
    const wasOpen = !box.hidden && !box.classList.contains('closing');
    box.classList.remove('closing');
    box.hidden = false;
    showing = true;
    // A fresh card opens in full and shrinks to its seal after the player had time to read it.
    window.clearTimeout(compactTimer);
    box.classList.remove('compact');
    compactTimer = window.setTimeout(() => setCompact(true), readingMs(quest ?? '') + 4000);
    // Place it first (same frame), then pop in from its corner; an open card just changes its text.
    draw();
    if (!wasOpen) {
      box.classList.remove('opening');
      void box.offsetWidth;
      box.classList.add('opening');
    }
    changed();
  };
  const hide = (): void => {
    if (quest !== null) dismissed.add(quest);
    showing = false;
    box.classList.remove('opening');
    box.classList.add('closing');
    window.setTimeout(() => {
      if (box.classList.contains('closing')) {
        box.classList.remove('closing');
        box.hidden = true;
      }
    }, QUEST_CARD_POP_MS);
    changed();
  };
  box.addEventListener('click', () => {
    if (box.classList.contains('compact')) {
      setCompact(false);
      return;
    }
    if (showing) hide();
  });
  /** The quest the game wants shown; while held nothing shows. */
  let pending: string | null = null;
  let held = false;
  const api: HintBox = {
    set(next) {
      pending = next;
      apply(held ? null : next);
    },
    setHeld(h) {
      if (h === held) return;
      held = h;
      apply(held ? null : pending);
    },
    toggle() {
      if (quest === null) return;
      if (showing) {
        hide();
        return;
      }
      dismissed.delete(quest);
      show();
    },
    setCompact,
    setCovered(c) {
      covered = c;
      draw();
    },
    onChange(listener) {
      listeners.push(listener);
      listener(quest, showing);
    },
  };
  function apply(next: string | null): void {
    if (next === quest && (showing || dismissed.has(next ?? ''))) return;
    quest = next;
    if (next !== null && !dismissed.has(next)) {
      show();
      return;
    }
    showing = false;
    box.classList.remove('closing', 'opening');
    box.hidden = true;
    changed();
  }
  return api;
}
