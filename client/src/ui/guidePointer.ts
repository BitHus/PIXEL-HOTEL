// ONBOARD-1: the animated pointer of the first-steps guide: a pulsing ring with a bobbing arrow over the exact thing to tap or hold.
// It only draws; game/guideWorld.ts says where. It never takes the pointer (CSS pointer-events none) and goes calm under Reduce effects.

import type { Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import './guide.css';
import './highlight.css';

/** Ring size around a target box: the box plus 8 px, at least 44 (touch size), at most 120 so a wide panel card stays a frame, not a wall. */
export function ringSize(w: number, h: number): { w: number; h: number } {
  const s = (n: number): number => Math.round(Math.min(120, Math.max(44, n + 8)) / 2) * 2;
  return { w: s(w), h: s(h) };
}

/** Distance (css px) the edge arrow keeps from the screen edge, and extra room for the top card and the bottom hotbar. */
const EDGE_MARGIN = 56;
const EDGE_TOP = 40;
const EDGE_BOTTOM = 60;

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
  // R16: the ring is the shared highlight (highlight.css): four hollow cream corner brackets, sized to the target, 2 step breathing.
  const ring = el('div', 'guide-ring pk-hl pk-hl-pulse');
  const hand = el('div', 'guide-hand');
  // A1c: the arrow is a small inline SVG (outline + fill), not CSS border triangles. R16: cream fill, tan shade on the right, stepped tip; no yellow.
  hand.innerHTML = '<svg viewBox="-1 -1 17 20" width="16" height="20" shape-rendering="crispEdges" aria-hidden="true"><path d="M4 0H11V8H15V10H13V12H11V14H10V16H9V18H6V16H5V14H4V12H2V10H0V8H4Z" fill="#ead4aa" stroke="#181425" stroke-width="2" stroke-linejoin="miter"/><rect x="8" y="1" width="3" height="8" fill="#e4a672"/></svg>';
  root.append(ring, hand);
  parent.appendChild(root);
  let shown = false;
  let lx = Number.NaN;
  let ly = Number.NaN;
  let lrot = Number.NaN;
  let edge = false;
  let scrolled: HTMLElement | null = null;
  let lsize = '';
  let flip = false;
  const set = (p: Point | null, size?: { w: number; h: number }): void => {
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
    // RUN 12: a target OFF the screen (the camera lock centres the avatar, the bar can lie left of the view): no ring half cut off, an arrow at the edge pointing the way.
    const m = EDGE_MARGIN;
    const off = w > 0 && h > 0 && (p.x < 0 || p.x > w || p.y < 0 || p.y > h);
    let px = p.x;
    let py = p.y;
    let rot = 0;
    if (off) {
      px = Math.min(Math.max(p.x, m), Math.max(m, w - m));
      py = Math.min(Math.max(p.y, m + EDGE_TOP), Math.max(m + EDGE_TOP, h - m - EDGE_BOTTOM));
      // The arrow normally points DOWN (0 deg); it turns to point from the clamped spot toward the real target.
      rot = (Math.atan2(-(p.x - px), p.y - py) * 180) / Math.PI;
    }
    if (off !== edge) {
      root.classList.toggle('edge', off);
      edge = off;
    }
    if (rot !== lrot) {
      root.style.setProperty('--edge-rot', `${Math.round(rot)}deg`);
      lrot = rot;
    }
    const x = Math.round(Math.min(Math.max(px, 0), w > 0 ? w : px) * dpr) / dpr;
    const y = Math.round(Math.min(Math.max(py, 0), h > 0 ? h : py) * dpr) / dpr;
    if (x !== lx || y !== ly) {
      root.style.transform = `translate(${x}px, ${y}px)`;
      lx = x;
      ly = y;
    }
    const sz = size ?? { w: 44, h: 44 };
    const key = `${sz.w}x${sz.h}`;
    if (key !== lsize) {
      root.style.setProperty('--hl-w', `${sz.w}px`);
      root.style.setProperty('--hl-h', `${sz.h}px`);
      ring.style.setProperty('--hl-w', `${sz.w}px`);
      ring.style.setProperty('--hl-h', `${sz.h}px`);
      lsize = key;
    }
    // Near the top edge the arrow would leave the screen: it flips under the ring and points up.
    const wantFlip = !off && y < sz.h / 2 + 40;
    if (wantFlip !== flip) {
      root.classList.toggle('flip', wantFlip);
      flip = wantFlip;
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
      // RUN 12: a card scrolled out of its panel list (the wall step pointed at the screen bottom): scroll it into view once per target.
      if (scrolled !== t) {
        scrolled = t;
        if (t.closest('.panel-body, .card-grid')) t.scrollIntoView({ block: 'nearest' });
      }
      // A1d: the exact centre of the button's own box (the old +8 px pushed the ring off it), measured against the layer's inner box (border and CSS scale included).
      const sx = parent.offsetWidth > 0 ? o.width / parent.offsetWidth : 1;
      const sy = parent.offsetHeight > 0 ? o.height / parent.offsetHeight : 1;
      set(
        { x: (r.left - o.left - parent.clientLeft * sx + r.width / 2) / (sx || 1), y: (r.top - o.top - parent.clientTop * sy + r.height / 2) / (sy || 1) },
        ringSize(r.width / (sx || 1), r.height / (sy || 1)),
      );
    },
    get visible() {
      return shown;
    },
  };
}
