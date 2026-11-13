// Positions a floating HTML element (absolute, inside #ui) centered just above a screen rect,
// or just below it when there is no room above, and keeps it inside the screen.

import { MENU_EDGE_PX, MENU_GAP_PX, type Rect } from '@pixel-hotel/shared';

export function anchorAbove(el: HTMLElement, target: Rect): void {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const sw = window.innerWidth;
  const sh = window.innerHeight;
  let top = target.y - MENU_GAP_PX - h;
  if (top < MENU_EDGE_PX) top = target.y + target.h + MENU_GAP_PX;
  top = Math.min(Math.max(top, MENU_EDGE_PX), sh - MENU_EDGE_PX - h);
  let left = target.x + target.w / 2 - w / 2;
  left = Math.min(Math.max(left, MENU_EDGE_PX), sw - MENU_EDGE_PX - w);
  el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}
