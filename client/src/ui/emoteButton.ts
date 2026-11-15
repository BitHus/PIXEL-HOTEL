// The emote button and its small menu (step 9g-1): a button in the side column and a five-button menu (wave, dance, laugh, cheer, sleep).
// Styles: .emote-btn / .emote-menu in ui.css. The click only asks; what plays is decided by api.emote (the avatar must stand still).

import { EMOTE_KINDS, EMOTE_LABELS, type EmoteKind } from '@pixel-hotel/shared';
import { el, iconButton } from './dom.ts';

export interface EmoteButton {
  readonly button: HTMLButtonElement;
  readonly menu: HTMLElement;
  /** Marks the playing emote on the button and its menu (null = none). */
  setActive(kind: EmoteKind | null): void;
  close(): void;
}

export function createEmoteButton(parent: HTMLElement, onPick: (kind: EmoteKind) => void): EmoteButton {
  const menu = el('div', 'frame emote-menu');
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  const items = new Map<EmoteKind, HTMLButtonElement>();
  for (const kind of EMOTE_KINDS) {
    const b = el('button', 'btn', EMOTE_LABELS[kind].slice(0, 4));
    b.type = 'button';
    b.title = EMOTE_LABELS[kind];
    b.setAttribute('aria-label', EMOTE_LABELS[kind]);
    b.setAttribute('role', 'menuitem');
    b.addEventListener('click', () => {
      menu.hidden = true;
      onPick(kind);
    });
    items.set(kind, b);
    menu.appendChild(b);
  }
  const button = iconButton('smile', 'Emote', () => (menu.hidden = !menu.hidden), 'emote-btn room-only');
  button.setAttribute('aria-haspopup', 'true');
  parent.appendChild(menu);
  return {
    button,
    menu,
    setActive(kind) {
      button.classList.toggle('on', kind !== null);
      for (const [k, b] of items) b.classList.toggle('on', k === kind);
    },
    close() {
      menu.hidden = true;
    },
  };
}
