// The POUR BAR (COD-1 e): a clear horizontal bar floating over the mug while the avatar waits at the taps and the player holds the stand.
// It fills with the mug (0 to POUR_MAX_FILL), the green window is the perfect range (POUR_PERFECT_RANGE) and the bar lights up while the
// fill is inside it. HTML over the canvas, never takes the pointer (a press on the bar is a press on the stand below it).
// Rendering only; the fill comes from pourControl (the pure rule is shared/src/pour.ts).

import { POUR_MAX_FILL, POUR_PERFECT_RANGE, type Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import './ordersStrip.css';

/** The HTML bar shows only while the avatar waits at the taps, no panel is open and the pour was not released (the world gauge in render/pourFx.ts is separate). */
export function pourBarShouldShow(s: { waiting: boolean; panelOpen: boolean; released: boolean }): boolean {
  return s.waiting && !s.panelOpen && !s.released;
}

export interface PourBar {
  /** Shows the empty bar (the avatar waits at the taps). */
  show(): void;
  /** The mug's fill now (0..POUR_MAX_FILL); the bar fills and shows when it is inside the perfect window. */
  setFill(fill: number): void;
  /** Hides it again. */
  hide(): void;
  /** Puts it over the mug: the screen point (CSS px) of the mug's top. */
  place(screen: Point): void;
  readonly visible: boolean;
}

export function createPourBar(parent: HTMLElement): PourBar {
  const root = el('div', 'pour-bar pour-bar-over');
  root.hidden = true;
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-label', 'Pour: hold the tap, let go in the green');
  const fill = el('div', 'pour-bar-fill');
  const mark = el('div', 'pour-bar-mark');
  mark.style.left = `${(POUR_PERFECT_RANGE[0] / POUR_MAX_FILL) * 100}%`;
  mark.style.width = `${((POUR_PERFECT_RANGE[1] - POUR_PERFECT_RANGE[0]) / POUR_MAX_FILL) * 100}%`;
  root.append(fill, mark);
  parent.appendChild(root);
  let shown = false;
  return {
    show() {
      shown = true;
      root.hidden = false;
      this.setFill(0);
    },
    setFill(f) {
      const clamped = Math.max(0, Math.min(POUR_MAX_FILL, f));
      fill.style.width = `${(clamped / POUR_MAX_FILL) * 100}%`;
      root.classList.toggle('in-window', clamped >= POUR_PERFECT_RANGE[0] && clamped <= POUR_PERFECT_RANGE[1]);
      root.setAttribute('aria-valuenow', String(Math.round((clamped / POUR_MAX_FILL) * 100)));
    },
    hide() {
      shown = false;
      root.hidden = true;
    },
    place(p) {
      root.style.left = `${Math.round(p.x)}px`;
      root.style.top = `${Math.round(p.y)}px`;
    },
    get visible() {
      return shown;
    },
  };
}
