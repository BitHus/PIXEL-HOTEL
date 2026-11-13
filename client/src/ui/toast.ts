// A short message at the top center (save notices, refused actions).

import { TOAST_MS } from '@pixel-hotel/shared';
import { el } from './dom.ts';

export type Toast = (text: string) => void;

export function createToast(parent: HTMLElement): Toast {
  const box = el('div', 'frame toast');
  box.hidden = true;
  box.setAttribute('role', 'status');
  parent.appendChild(box);
  let timer = 0;
  return (text) => {
    box.textContent = text;
    box.hidden = false;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => (box.hidden = true), TOAST_MS);
  };
}
