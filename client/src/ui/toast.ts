// A short message just above the hotbar (save notices, refused actions, sales). It stays at
// reading pace (readingMs: at least 4 s plus 0.35 s per word), then fades out slowly
// (TEXT_FADE_MS). A tap on it hides it at once.

import { TEXT_FADE_MS, readingMs } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { gemImg } from './panelShell.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';

/** The banner's look from its words (a pure view choice: the text is all the caller gives). good = gold edge, warn = crimson edge. */
export function toastKind(text: string): { icon: IconName | 'gem'; tone: 'good' | 'warn' | 'info' } {
  const t = text.toLowerCase();
  if (/not enough|cannot|can't|nothing|refused|too |no .* left|need more|you need|full|blocked|not grown|opens at/.test(t)) return { icon: 'refused', tone: 'warn' };
  if (/gem/.test(t)) return { icon: 'gem', tone: 'good' };
  if (/gold|sold|coin/.test(t)) return { icon: 'coin', tone: 'good' };
  if (/book|recipe/.test(t)) return { icon: 'book', tone: 'good' };
  if (/level|unlocked|new /.test(t)) return { icon: 'level', tone: 'good' };
  return { icon: 'journal', tone: 'info' };
}

/** An optional button in the toast (BG8: "Wear it"). A tap on it runs `run` and hides the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export type Toast = ((text: string, action?: ToastAction) => void) & {
  /** Hides the toast at once (call on a room change so a stale tutorial line does not stay). */
  clear?: () => void;
};

/** The avatar's screen column and its head and feet y (CSS px), so the toast can stay clear of it; null = unknown. */
export type ToastAvoid = () => { x: number; top: number; bottom: number } | null;

export function createToast(parent: HTMLElement, avoid?: ToastAvoid): Toast {
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
  const show: Toast = (text, action) => {
    const kind = toastKind(text);
    box.className = `frame toast toast-${kind.tone}`;
    const icon = kind.icon === 'gem' ? gemImg() : pixelIcon(kind.icon);
    icon.classList.add('toast-icon');
    box.replaceChildren(icon, el('span', 'toast-text', text));
    if (action) {
      const b = el('button', 'btn toast-action', action.label);
      b.type = 'button';
      b.addEventListener('click', () => {
        action.run();
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
        box.hidden = true;
      });
      box.append(b);
    }
    // A plain toast never swallows a tap meant for the game under it; only a toast with a button takes taps (tap forgiveness, 18 Nov).
    box.style.pointerEvents = action ? 'auto' : 'none';
    box.hidden = false;
    box.classList.remove('fading');
    // Clear of the avatar when possible: if the toast would cover it, it moves to the top band (skin.css .toast-top).
    box.classList.remove('toast-top');
    const a = avoid?.() ?? null;
    if (a) {
      const r = box.getBoundingClientRect();
      if (a.x > r.left - 16 && a.x < r.right + 16 && a.bottom > r.top - 8 && a.top < r.bottom + 8) box.classList.add('toast-top');
    }
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    showTimer = window.setTimeout(hide, readingMs(text));
  };
  show.clear = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    box.hidden = true;
  };
  return show;
}
