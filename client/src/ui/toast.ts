// A short message just above the hotbar (save notices, refused actions, sales). It stays at
// reading pace (readingMs: at least 4 s plus 0.35 s per word), then fades out slowly
// (TEXT_FADE_MS). A tap on it hides it at once.

import { TEXT_FADE_MS, readingMs } from '@pixel-hotel/shared';
import { el } from './dom.ts';

export type Toast = (text: string) => void;

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
  box.addEventListener('pointerdown', () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    box.hidden = true;
  });
  return (text) => {
    box.textContent = text;
    box.hidden = false;
    box.classList.remove('fading');
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    showTimer = window.setTimeout(hide, readingMs(text));
  };
}
