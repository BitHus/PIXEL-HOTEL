// Gain popups (step BG3 part B): what a call gave (a gains list from the GameAPI) floats above the
// avatar's head as small icons with "x3", in one row, rank-coloured, with a sparkle for ultra_rare
// and legendary. At most POPUP_MAX show at once (the rest wait in a queue), each for POPUP_MS.
// Rendering only: the numbers come from the API. A real-time age (performance.now()), so a hidden
// page never piles popups up. Settings "Popups" switches them off.

import { GEMS_GAIN_ID, GOLD_GAIN_ID, POPUP_MAX, POPUP_MS, sparkles, type Gain, type GainList, type Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { gainIconUrl } from './itemIcon.ts';
import { rankClassOf } from './rank.ts';

interface Shown {
  node: HTMLElement;
  born: number;
}

export interface GainPopups {
  /** Queues a gains list. Ignored when popups are off or the page is hidden. */
  show(gains: GainList): void;
  setEnabled(on: boolean): void;
  /** True while popups are switched on (Settings). */
  enabled(): boolean;
  clear(): void;
  /** Call every frame. head = the screen point above the avatar's head (CSS px), or null. */
  update(head: Point | null): void;
  /** What shows now and what waits (for tests). */
  counts(): { shown: number; queued: number };
}

/** One chip: the icon and "x3" (rank-coloured border, a sparkle on ultra_rare and legendary). */
export function gainChip(g: Gain): HTMLElement {
  const chip = el('div', `gain-chip ${rankClassOf(g.rank)}`);
  const img = el('img');
  img.src = gainIconUrl(g.itemId, g.itemId === GEMS_GAIN_ID || g.itemId === GOLD_GAIN_ID ? undefined : g.rank);
  img.alt = '';
  img.draggable = false;
  chip.append(img, el('span', '', g.count > 1 ? `x${g.count}` : ''));
  if (sparkles(g.rank)) {
    chip.classList.add('sparkle');
    for (let i = 0; i < 4; i++) chip.appendChild(el('span', `sparkle-star s${i}`));
  }
  return chip;
}

export function createGainPopups(parent: HTMLElement, enabled: boolean): GainPopups {
  const layer = el('div', 'popup-layer');
  parent.appendChild(layer);
  let on = enabled;
  let queue: Gain[] = [];
  let shown: Shown[] = [];

  const fill = (now: number): void => {
    while (shown.length < POPUP_MAX && queue.length > 0) {
      const g = queue.shift()!;
      const node = gainChip(g);
      node.classList.add('gain-popup');
      layer.appendChild(node);
      shown.push({ node, born: now });
    }
  };

  return {
    show(gains) {
      if (!on || document.hidden) return;
      queue.push(...gains.filter((g) => g.count > 0));
    },
    enabled() {
      return on;
    },
    setEnabled(next) {
      on = next;
      if (!on) this.clear();
    },
    clear() {
      for (const s of shown) s.node.remove();
      shown = [];
      queue = [];
    },
    update(head) {
      const now = performance.now();
      for (const s of shown.filter((x) => now - x.born >= POPUP_MS)) s.node.remove();
      shown = shown.filter((s) => now - s.born < POPUP_MS);
      fill(now);
      layer.hidden = head === null;
      if (!head) return;
      // One row, centred above the head, rising a little while it lives; chips side by side.
      const widths = shown.map((s) => s.node.offsetWidth || 36);
      const total = widths.reduce((a, w) => a + w, 0) + 4 * Math.max(0, shown.length - 1);
      let x = head.x - total / 2;
      shown.forEach((s, i) => {
        const k = (now - s.born) / POPUP_MS;
        const rise = 14 + 18 * k;
        s.node.style.transform = `translate(${Math.round(x)}px, ${Math.round(head.y - rise - 26)}px)`;
        s.node.style.opacity = k > 0.75 ? String(Math.max(0, (1 - k) / 0.25)) : '1';
        x += (widths[i] ?? 36) + 4;
      });
    },
    counts() {
      return { shown: shown.length, queued: queue.length };
    },
  };
}
