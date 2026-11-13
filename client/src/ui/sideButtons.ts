// Right edge: small square icon buttons stacked vertically: (Quest), Bag, Build, (Dungeon), Catalog,
// Workshop, Room, Avatar, Chat, Settings. In the dungeon only Chat and Settings stay (CSS
// .in-dungeon hides the buttons marked room-only).
// Each panel button toggles its panel (Build toggles build mode, buildMode.ts). Keys: I (bag), C (catalog), Enter (chat), Escape closes the open panel.

import { el, iconButton, typing } from './dom.ts';
import type { PanelName, Panels } from './panels.ts';
import type { IconName } from './pixelIcons.ts';

const BUTTONS: [PanelName, IconName, string][] = [
  ['bag', 'bag', 'Bag (I)'],
  ['catalog', 'book', 'Catalog (C)'],
  ['workshop', 'workshop', 'Workshop: crafting and the Blacksmith'],
  ['room', 'house', 'Room'],
  ['avatar', 'avatar', 'Avatar'],
  ['chat', 'chat', 'Chat (Enter)'],
  ['settings', 'gear', 'Settings'],
];

/**
 * The right-edge column. Later steps add their buttons here (see CLAUDE.md, UI layout rule).
 * `extra` buttons (Build) go right after the Bag button.
 */
export function createSideButtons(parent: HTMLElement, panels: Panels, extra: readonly HTMLElement[] = []): HTMLElement {
  const col = el('div', 'side-buttons');
  const buttons = new Map<PanelName, HTMLButtonElement>();
  for (const [name, icon, title] of BUTTONS) {
    const b = iconButton(icon, title, () => panels.toggle(name), name === 'chat' || name === 'settings' ? '' : 'room-only');
    buttons.set(name, b);
    col.appendChild(b);
    if (name === 'bag') col.append(...extra);
  }
  parent.appendChild(col);
  panels.onChange(() => {
    for (const [name, b] of buttons) b.classList.toggle('on', panels.open === name);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    // In the dungeon only Escape (close a panel) works here.
    if (col.closest('.in-dungeon') && e.key !== 'Escape') return;
    if (e.key === 'Escape' && panels.open !== null) panels.close();
    else if (e.key.toLowerCase() === 'i') panels.toggle('bag');
    else if (e.key.toLowerCase() === 'c') panels.toggle('catalog');
    else return;
    e.preventDefault();
  });
  return col;
}
