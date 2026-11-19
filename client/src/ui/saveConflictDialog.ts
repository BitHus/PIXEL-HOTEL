// The save conflict question (ON-5): this device and the cloud both changed since the last sync. Shows both saves by time, the newest is the
// preselected default; the player picks which one to keep (the other is replaced) or decides later. Reuses the confirm panel look.

import { newestSide } from '@pixel-hotel/shared';
import { saveTime } from './accountText.ts';
import { el, textButton } from './dom.ts';

export type ConflictChoice = 'local' | 'cloud' | null;

let open: ((c: ConflictChoice) => void) | null = null;

export function askSaveConflict(parent: HTMLElement, localAt: number, remoteAt: number): Promise<ConflictChoice> {
  open?.(null);
  return new Promise((resolve) => {
    const shade = el('div', 'confirm-shade');
    const box = el('div', 'ui-panel confirm-panel conflict-panel');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const finish = (c: ConflictChoice): void => {
      if (open !== finish) return;
      open = null;
      window.removeEventListener('keydown', onKey, true);
      shade.remove();
      resolve(c);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      finish(null);
    };
    const newest = newestSide(localAt, remoteAt);
    const card = (side: 'local' | 'cloud', title: string, at: number): HTMLElement => {
      const c = el('div', `conflict-card inset${newest === side ? ' newest' : ''}`);
      c.append(el('div', 'catalog-name', title), el('div', 'catalog-sub', `Saved ${saveTime(at)}`), el('div', 'catalog-sub', newest === side ? 'Newest' : 'Older'));
      return c;
    };
    const keepLocal = textButton('Keep this device', () => finish('local'));
    const useCloud = textButton('Use the cloud save', () => finish('cloud'));
    const later = textButton('Decide later', () => finish(null));
    later.classList.add('quiet');
    const preferred = newest === 'local' ? keepLocal : useCloud;
    preferred.classList.add('primary', 'confirm-yes');
    const buttons = el('div', 'confirm-buttons conflict-buttons');
    buttons.append(later, keepLocal, useCloud);
    box.append(
      el('h2', 'panel-title plate', 'Two different saves'),
      el('p', 'panel-note', 'This device and the cloud both changed since they last matched. Pick the save to keep. The other one is replaced.'),
      card('local', 'This device', localAt),
      card('cloud', 'The cloud', remoteAt),
      buttons,
    );
    shade.appendChild(box);
    shade.addEventListener('pointerdown', (e) => {
      if (e.target === shade) finish(null);
    });
    parent.appendChild(shade);
    open = finish;
    window.addEventListener('keydown', onKey, true);
    preferred.focus();
  });
}
