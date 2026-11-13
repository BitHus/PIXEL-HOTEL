// A coin flying across the screen (the new-game intro, step 7b): from a screen point to another in
// an arc, then it calls back (and is gone). HTML over the canvas, so it stays sharp.

import type { Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

export function flyCoin(parent: HTMLElement, from: Point, to: Point, ms: number, onArrive: () => void): void {
  const c = el('div', 'fly-coin');
  c.appendChild(pixelIcon('coin'));
  parent.appendChild(c);
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
  const at = (p: Point, scale: number): Keyframe => ({ transform: `translate(${Math.round(p.x - 10)}px, ${Math.round(p.y - 10)}px) scale(${scale})` });
  const anim = c.animate([at(from, 0.6), at(mid, 1.2), at(to, 0.8)], { duration: ms, easing: 'ease-in', fill: 'forwards' });
  anim.onfinish = () => {
    c.remove();
    onArrive();
  };
}
