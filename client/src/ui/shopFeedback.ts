// Shop feedback in the HTML overlay (step 7): the floating "+12 gold" with a coin above the till
// when a customer pays (it rises and fades over SALE_FLOAT_MS), the coins at the till, and the
// quest card. (The "while you were away" summary is gone since step 9d: nothing sells offline.)

import { CUSTOMER_PAY_MS, HINTS, QUEST_CARD_POP_MS, SALE_FLOAT_MS, type Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

interface Float {
  el: HTMLElement;
  world: Point;
  age: number;
}

export interface SaleFloats {
  add(world: Point, gold: number): void;
  clear(): void;
  /** Moves the floats; toScreen maps a world point to CSS px. */
  update(dtMs: number, toScreen: (p: Point) => Point): void;
}

export function createSaleFloats(parent: HTMLElement): SaleFloats {
  const layer = el('div', 'bubble-layer');
  parent.appendChild(layer);
  let floats: Float[] = [];
  return {
    add(world, gold) {
      const f = el('div', 'sale-float');
      f.append(pixelIcon('coin'), el('span', '', `+${gold} gold`));
      layer.appendChild(f);
      floats.push({ el: f, world, age: 0 });
    },
    clear() {
      for (const f of floats) f.el.remove();
      floats = [];
    },
    update(dtMs, toScreen) {
      for (const f of floats) f.age += dtMs;
      for (const f of floats.filter((x) => x.age >= SALE_FLOAT_MS)) f.el.remove();
      floats = floats.filter((f) => f.age < SALE_FLOAT_MS);
      for (const f of floats) {
        const k = f.age / SALE_FLOAT_MS;
        const s = toScreen(f.world);
        // A quick pop, then it rises 40 px and fades in the second half.
        const scale = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : k < 0.2 ? 1.1 - ((k - 0.12) / 0.08) * 0.1 : 1;
        f.el.style.transform = `translate(${Math.round(s.x - f.el.offsetWidth / 2)}px, ${Math.round(s.y - f.el.offsetHeight - 40 * k)}px) scale(${scale.toFixed(2)})`;
        f.el.style.opacity = String(k < 0.5 ? 1 : 1 - (k - 0.5) * 2);
      }
    },
  };
}

export interface TillCoins {
  /** The till animation while a customer pays (coins hop out of the till), CUSTOMER_PAY_MS long. */
  add(world: Point): void;
  /**
   * Moves the animations; `waiting` is the till's world point while a customer waits to pay and
   * nobody stands behind the counter (a bobbing coin marker shows there), else null.
   */
  update(dtMs: number, toScreen: (p: Point) => Point, waiting: Point | null): void;
}

export function createTillCoins(parent: HTMLElement): TillCoins {
  const layer = el('div', 'bubble-layer');
  parent.appendChild(layer);
  const marker = el('div', 'bubble till-marker tail');
  marker.append(pixelIcon('coin'), el('span', '', '!'));
  marker.title = 'A customer is waiting: tap the counter';
  marker.hidden = true;
  layer.appendChild(marker);
  let anims: Float[] = [];
  const place = (e: HTMLElement, s: Point): void => {
    e.style.transform = `translate(${Math.round(s.x - e.offsetWidth / 2)}px, ${Math.round(s.y - e.offsetHeight)}px)`;
  };
  return {
    add(world) {
      const a = el('div', 'till-coins');
      for (let i = 0; i < 3; i++) {
        const c = el('span', `till-coin c${i}`);
        c.appendChild(pixelIcon('coin'));
        a.appendChild(c);
      }
      a.style.setProperty('--pay-ms', `${CUSTOMER_PAY_MS}ms`);
      layer.appendChild(a);
      anims.push({ el: a, world, age: 0 });
    },
    update(dtMs, toScreen, waiting) {
      for (const a of anims) a.age += dtMs;
      for (const a of anims.filter((x) => x.age >= CUSTOMER_PAY_MS)) a.el.remove();
      anims = anims.filter((a) => a.age < CUSTOMER_PAY_MS);
      for (const a of anims) place(a.el, toScreen(a.world));
      marker.hidden = waiting === null;
      if (waiting) {
        const s = toScreen(waiting);
        place(marker, { x: s.x, y: s.y - 4 });
      }
    },
  };
}

export interface HintBox {
  /** The current quest (null = none). A new one shows at once. */
  set(text: string | null): void;
  /** Shows the current quest again, or hides it when it shows (the quest button). */
  toggle(): void;
  /** While a panel is open the card steps aside (it opens where the panels open). */
  setCovered(covered: boolean): void;
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
  const box = el('div', 'frame quest-card');
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
      box.style.top = `${a.bottom - p.top + 6}px`;
    }
  };
  window.addEventListener('resize', place);
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
    if (showing) hide();
  });
  return {
    set(next) {
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
    setCovered(c) {
      covered = c;
      draw();
    },
    onChange(listener) {
      listeners.push(listener);
      listener(quest, showing);
    },
  };
}
