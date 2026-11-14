// Right edge: square icon buttons stacked vertically. Always there: (Quest), Map, Catalog, Build,
// Dungeon (main.ts adds Quest, Map, Build and Dungeon). The rest (Workshop, Room, Avatar, Chat,
// Settings) sits behind one "More" button that opens a small grid of icons with labels (UI
// polish step); on a wide screen (>= 900 px, ui.css) the grid dissolves and every button stands
// in the column. In the dungeon only Chat and Settings stay (CSS .in-dungeon hides the buttons
// marked room-only).
// The Bag button is NOT in the column (owner, after 9d): it is made here (`bag`) and main.ts puts
// it at the right end of the hotbar.
// Each panel button toggles its panel (Build toggles build mode, buildMode.ts). Keys: I (bag), C (catalog), Enter (chat), Escape closes the open panel.

import { el, iconButton, typing } from './dom.ts';
import type { PanelName, Panels } from './panels.ts';
import type { IconName } from './pixelIcons.ts';

/** [panel, icon, tooltip, short label in the More grid (null = always in the column, 'hotbar' = next to the hotbar)]. */
const BUTTONS: [PanelName, IconName, string, string | null][] = [
  ['bag', 'bag', 'Bag (I)', 'hotbar'],
  ['catalog', 'book', 'Catalog (C)', null],
  ['workshop', 'workshop', 'Workshop: crafting and the Blacksmith', 'Workshop'],
  ['room', 'house', 'Room', 'Room'],
  ['avatar', 'avatar', 'Avatar', 'Avatar'],
  ['chat', 'chat', 'Chat (Enter)', 'Chat'],
  ['settings', 'gear', 'Settings', 'Settings'],
];

/**
 * The right-edge column. Later steps add their buttons here (see CLAUDE.md, UI layout rule).
 * `extra` buttons (Build, Dungeon) go right after the Catalog button. `bag` is the Bag button for the hotbar.
 */
export function createSideButtons(parent: HTMLElement, panels: Panels, extra: readonly HTMLElement[] = []): { col: HTMLElement; bag: HTMLButtonElement } {
  const col = el('div', 'side-buttons');
  const buttons = new Map<PanelName, HTMLButtonElement>();
  const wrap = el('div', 'more-wrap');
  const menu = el('div', 'frame more-menu');
  const setMenu = (open: boolean): void => {
    menu.classList.toggle('open', open);
    mark();
  };
  const more = iconButton('more', 'More', () => setMenu(!menu.classList.contains('open')), 'more-btn');
  more.setAttribute('aria-haspopup', 'true');
  const mark = (): void => {
    let inMenu = false;
    for (const [name, b] of buttons) {
      const on = panels.open === name;
      b.classList.toggle('on', on);
      if (on && menu.contains(b)) inMenu = true;
    }
    more.classList.toggle('on', inMenu || menu.classList.contains('open'));
  };
  for (const [name, icon, title, label] of BUTTONS) {
    const b = iconButton(icon, title, () => {
      setMenu(false);
      panels.toggle(name);
    }, name === 'chat' || name === 'settings' ? '' : 'room-only');
    buttons.set(name, b);
    if (label === 'hotbar') {
      b.classList.add('hotbar-bag');
    } else if (label === null) {
      col.appendChild(b);
      col.append(...extra);
    } else {
      b.classList.add('more-item');
      b.appendChild(el('span', 'more-label', label));
      menu.appendChild(b);
    }
  }
  wrap.append(more, menu);
  col.appendChild(wrap);
  parent.appendChild(col);
  panels.onChange(mark);
  // A press anywhere else closes the grid.
  window.addEventListener('pointerdown', (e) => {
    if (menu.classList.contains('open') && !(e.target instanceof Node && wrap.contains(e.target))) setMenu(false);
  }, true);
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    // In the dungeon only Escape (close a panel) works here.
    if (col.closest('.in-dungeon') && e.key !== 'Escape') return;
    if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false);
    else if (e.key === 'Escape' && panels.open !== null) panels.close();
    else if (e.key.toLowerCase() === 'i') panels.toggle('bag');
    else if (e.key.toLowerCase() === 'c') panels.toggle('catalog');
    else return;
    e.preventDefault();
  });
  return { col, bag: buttons.get('bag')! };
}
