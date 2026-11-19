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
  const ring = el('div', 'guide-ring');
  // Crisp pixel ring: a stepped octagon outline (gold with a dark edge), no blur, no glow.
  ring.innerHTML = '<svg viewBox="-1 -1 46 46" width="44" height="44" shape-rendering="crispEdges" aria-hidden="true"><path fill-rule="evenodd" d="M12 0H32V4H40V12H44V32H40V40H32V44H12V40H4V32H0V12H4V4H12ZM12 4H32V8H36V12H40V32H36V36H32V40H12V36H8V32H4V12H8V8H12Z" fill="#fee761" stroke="#3e2731" stroke-width="1"/></svg>';
  const hand = el('div', 'guide-hand');
  // A1c: the arrow is a small inline SVG (outline + fill), not CSS border triangles: those collapsed into a filled yellow block when another rule touched box-sizing or size.
  hand.innerHTML = '<svg viewBox="-1 -1 17 20" width="16" height="20" shape-rendering="crispEdges" aria-hidden="true"><path d="M4 0H11V8H15V10H13V12H11V14H10V16H9V18H6V16H5V14H4V12H2V10H0V8H4Z" fill="#fee761" stroke="#3e2731" stroke-width="2" stroke-linejoin="miter"/><rect x="8" y="1" width="2" height="8" fill="#feae34"/></svg>';
  root.append(ring, hand);
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
    // A1d: whole DEVICE pixels (not CSS px) and never outside the layer, so the ring cannot slide off a phone edge.
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const x = Math.round(Math.min(Math.max(p.x, 0), w > 0 ? w : p.x) * dpr) / dpr;
    const y = Math.round(Math.min(Math.max(p.y, 0), h > 0 ? h : p.y) * dpr) / dpr;
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
      if (r.width === 0 || r.height === 0) return set(null);
      // A1d: the exact centre of the button's own box (the old +8 px pushed the ring off it), measured against the layer's inner box (border and CSS scale included).
      const sx = parent.offsetWidth > 0 ? o.width / parent.offsetWidth : 1;
      const sy = parent.offsetHeight > 0 ? o.height / parent.offsetHeight : 1;
      set({ x: (r.left - o.left - parent.clientLeft * sx + r.width / 2) / (sx || 1), y: (r.top - o.top - parent.clientTop * sy + r.height / 2) / (sy || 1) });
    },
    get visible() {
      return shown;
    },
  };
}
