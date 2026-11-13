// The hotbar (step 5): one row of HOTBAR_SLOTS square slots, centered at the bottom, in a dark
// wood frame. Icons only; a small count in the corner for stacks. A slot whose type is not in
// the inventory (or cannot go in this room) is dimmed. The last used slot gets a bright border.
// Tap a slot: place that item (main.ts). Long-press a slot: empty it. Keys 1-6 tap a slot.

import { HOTBAR_SLOTS } from '@pixel-hotel/shared';
import { el, typing } from './dom.ts';
import { furnitureIconUrl } from './itemIcon.ts';
import { attachPress } from './press.ts';

export interface HotbarHooks {
  onTap(index: number): void;
  onHold(index: number): void;
}

export interface HotbarSlotView {
  typeId: string | null;
  count: number;
  /** False when it cannot be placed now (none left, or wrong room). */
  usable: boolean;
  name: string;
}

export interface Hotbar {
  readonly el: HTMLElement;
  refresh(slots: readonly HotbarSlotView[]): void;
  setHidden(hidden: boolean): void;
  setSelected(index: number | null): void;
  /** Highlights the slots while an item is being put in the hotbar. */
  setChoosing(on: boolean): void;
}

export function createHotbar(parent: HTMLElement, hooks: HotbarHooks): Hotbar {
  const bar = el('div', 'frame hotbar');
  const slots: { root: HTMLElement; img: HTMLImageElement; count: HTMLElement }[] = [];
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const root = el('div', 'slot hotbar-slot');
    root.dataset.index = String(i);
    root.setAttribute('role', 'button');
    const img = el('img', 'slot-icon');
    img.alt = '';
    img.draggable = false;
    const count = el('span', 'slot-count');
    root.append(img, count);
    attachPress(root, { onTap: () => hooks.onTap(i), onHold: () => hooks.onHold(i) });
    bar.appendChild(root);
    slots.push({ root, img, count });
  }
  parent.appendChild(bar);

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e) || bar.hidden) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= HOTBAR_SLOTS) hooks.onTap(n - 1);
  });

  return {
    el: bar,
    refresh(views) {
      views.forEach((v, i) => {
        const s = slots[i];
        if (!s) return;
        s.img.hidden = v.typeId === null;
        if (v.typeId !== null) s.img.src = furnitureIconUrl(v.typeId);
        s.count.textContent = v.count > 1 ? String(v.count) : '';
        s.root.classList.toggle('dim', v.typeId !== null && !v.usable);
        s.root.title = v.typeId === null ? 'Empty slot' : `${v.name} (${v.count})`;
      });
    },
    setHidden(hidden) {
      bar.hidden = hidden;
    },
    setSelected(index) {
      slots.forEach((s, i) => s.root.classList.toggle('selected', i === index));
    },
    setChoosing(on) {
      bar.classList.toggle('choosing', on);
    },
  };
}
