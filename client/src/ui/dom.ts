// Tiny DOM helpers for the HTML UI overlay. Every button uses the shared frame style (ui.css).

import { pixelIcon, type IconName } from './pixelIcons.ts';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** A framed text button. */
export function textButton(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** A framed square icon button; `title` is the tooltip (desktop) and the accessible name. */
export function iconButton(icon: IconName, title: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', `btn icon-btn ${cls}`.trim());
  b.type = 'button';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.appendChild(pixelIcon(icon));
  b.addEventListener('click', onClick);
  return b;
}

/** True when a key event comes from a text field (game keys are ignored then). */
export function typing(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);
}
