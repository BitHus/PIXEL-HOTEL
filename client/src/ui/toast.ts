// A short message just above the hotbar (save notices, refused actions, sales). It stays at
// reading pace (readingMs: at least 4 s plus 0.35 s per word), then fades out slowly
// (TEXT_FADE_MS). A tap on it hides it at once.

import { TEXT_FADE_MS, readingMs } from '@pixel-hotel/shared';
import { el } from './dom.ts';

/** An optional button in the toast (BG8: "Wear it"). A tap on it runs `run` and hides the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export type Toast = (text: string, action?: ToastAction) => void;

export function createToast(parent: HTMLElement): Toast {
  const box = el('div', 'frame toast');
  box.hidden = true;
  box.setAttribute('role', 'status');
  box.style.setProperty('--fade-ms', `${TEXT_FADE_MS}ms`);
  parent.appendChild(box);
  let showTimer = 0;
  let hideTimer = 0;
  const hide = (): void => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    box.classList.add('fading');
    hideTimer = window.setTimeout(() => (box.hidden = true), TEXT_FADE_MS);
  };
  box.addEventListener('pointerdown', (e) => {
    // A tap on the action button is a click on it, not "hide".
    if (e.target instanceof HTMLElement && e.target.closest('.toast-action')) return;
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    box.hidden = true;
  });
  return (text, action) => {
    box.textContent = text;
    if (action) {
      const b = el('button', 'btn toast-action', action.label);
      b.type = 'button';
      b.addEventListener('click', () => {
        action.run();
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
        box.hidden = true;
      });
      box.append(' ', b);
    }
    box.hidden = false;
    box.classList.remove('fading');
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    showTimer = window.setTimeout(hide, readingMs(text));
  };
}
