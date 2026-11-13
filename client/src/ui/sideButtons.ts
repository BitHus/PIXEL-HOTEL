// Right edge: small square icon buttons stacked vertically: Bag, Avatar, Chat, Settings. Each
// toggles its panel. Keys: I (bag), Enter (chat), Escape closes the open panel.

import { el, iconButton, typing } from './dom.ts';
import type { PanelName, Panels } from './panels.ts';
import type { IconName } from './pixelIcons.ts';

const BUTTONS: [PanelName, IconName, string][] = [
  ['bag', 'bag', 'Bag (I)'],
  ['avatar', 'avatar', 'Avatar'],
  ['chat', 'chat', 'Chat (Enter)'],
  ['settings', 'gear', 'Settings'],
];

/** The right-edge column. Later steps add their buttons here (see CLAUDE.md, UI layout rule). */
export function createSideButtons(parent: HTMLElement, panels: Panels): HTMLElement {
  const col = el('div', 'side-buttons');
  const buttons = new Map<PanelName, HTMLButtonElement>();
  for (const [name, icon, title] of BUTTONS) {
    const b = iconButton(icon, title, () => panels.toggle(name));
    buttons.set(name, b);
    col.appendChild(b);
  }
  parent.appendChild(col);
  panels.onChange(() => {
    for (const [name, b] of buttons) b.classList.toggle('on', panels.open === name);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (e.key === 'Escape' && panels.open !== null) panels.close();
    else if (e.key.toLowerCase() === 'i') panels.toggle('bag');
    else return;
    e.preventDefault();
  });
  return col;
}
