// The item menu (build mode only): tap or long-press a placed item and a small menu pops up
// above it: Move, Rotate, Pick up, with an info card on the side showing the item's name.
// main.ts closes it when the player taps elsewhere or leaves build mode.

import type { FurnitureType, Rect } from '@pixel-hotel/shared';
import { anchorAbove } from './anchorAbove.ts';

export interface ItemMenuHooks {
  onMove(uid: number): void;
  onRotate(uid: number): void;
  onPickUp(uid: number): void;
}

export interface ItemMenu {
  /** The uid of the item the menu is open for, or null. */
  readonly uid: number | null;
  open(uid: number, type: FurnitureType): void;
  close(): void;
  /** Keeps the menu above the item (screen rect); call every frame. */
  follow(item: Rect | null): void;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

export function createItemMenu(parent: HTMLElement, hooks: ItemMenuHooks): ItemMenu {
  const menu = document.createElement('div');
  menu.className = 'float-bar item-menu';
  const card = document.createElement('div');
  card.className = 'item-card';
  const name = document.createElement('div');
  name.className = 'item-name';
  card.append(name);
  const buttons = document.createElement('div');
  buttons.className = 'item-buttons';

  let uid: number | null = null;
  const act = (f: (uid: number) => void) => () => {
    if (uid !== null) f(uid);
  };
  const pickUp = button('Pick up', act(hooks.onPickUp));
  buttons.append(button('Move', act(hooks.onMove)), button('Rotate', act(hooks.onRotate)), pickUp);
  menu.append(buttons, card);
  menu.hidden = true;
  parent.appendChild(menu);

  window.addEventListener('keydown', (e) => {
    if (uid !== null && e.key === 'Escape') self.close();
  });

  const self: ItemMenu = {
    get uid() {
      return uid;
    },
    open(next, type) {
      uid = next;
      name.textContent = type.name;
      // The shop counter can be moved and rotated, never picked up.
      pickUp.hidden = type.noPickup === true;
      menu.hidden = false;
    },
    close() {
      uid = null;
      menu.hidden = true;
    },
    follow(item) {
      if (uid === null) return;
      if (!item) return self.close();
      anchorAbove(menu, item);
    },
  };
  return self;
}
