// ONBOARD-1: the animated pointer of the first-steps guide: a pulsing ring with a bobbing arrow over the exact thing to tap or hold.
// It only draws; game/guideWorld.ts says where. It never takes the pointer (CSS pointer-events none) and goes calm under Reduce effects.

import type { Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import './guide.css';

export interface GuidePointer {
  /** A point in the UI layer's own pixels (null = hide). */
  place(p: Point | null): void;
  /** The pointer sits over the centre of a button or other element (null = hide). */
  placeOn(target: HTMLElement | null): void;
  readonly visible: boolean;
}

export function createGuidePointer(parent: HTMLElement, calm: () => boolean): GuidePointer {
  const root = el('div', 'guide-pointer');
  root.setAttribute('aria-hidden', 'true');
  root.append(el('div', 'guide-ring'), el('div', 'guide-hand'));
  parent.appendChild(root);
  let shown = false;
  let lx = Number.NaN;
  let ly = Number.NaN;
  const set = (p: Point | null): void => {
    if (p === null || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      if (shown) {
        root.classList.remove('on');
        shown = false;
      }
      return;
    }
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (x !== lx || y !== ly) {
      root.style.transform = `translate(${x}px, ${y}px)`;
      lx = x;
      ly = y;
    }
    root.classList.toggle('calm', calm());
    if (!shown) {
      root.classList.add('on');
      shown = true;
    }
  };
  return {
    place: set,
    placeOn(t) {
      if (!t || t.offsetParent === null) return set(null);
      const r = t.getBoundingClientRect();
      const o = parent.getBoundingClientRect();
      if (r.width === 0) return set(null);
      set({ x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 + 8 });
    },
    get visible() {
      return shown;
    },
  };
}
