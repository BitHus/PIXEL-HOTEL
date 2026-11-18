// The hotbar (step 5): one row of HOTBAR_SLOTS square slots, centered at the bottom, in a dark
// wood frame. Icons only; a small count in the corner for stacks. A slot whose type is not in
// the inventory (or cannot go in this room) is dimmed. The last used slot gets a bright border.
// Tap a slot: place that item, or (step 9b) pick that seed for planting (main.ts). Long-press a slot: move it back to the bag. Keys 1-6
// tap a slot. Slots carry data-area="hotbar" so a stack dragged from the bag can drop on them.

import { setRank } from './rank.ts';
import { HOTBAR_SLOTS, isMaterialId } from '@pixel-hotel/shared';
import { el, typing } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
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
  const bar = el('div', 'ui-hud hotbar');
  // The name plate above the selected slot (a pure view of the slot names the client already passes).
  const plate = el('div', 'plate hotbar-name');
  plate.hidden = true;
  plate.setAttribute('aria-hidden', 'true');
  let selected: number | null = null;
  const names: string[] = [];
  plate.style.transform = 'translateX(-50%)';
  const showName = (): void => {
    const n = selected === null ? '' : (names[selected] ?? '');
    plate.textContent = n;
    plate.hidden = n === '';
    // Centred over the chosen slot (the bar is the plate's offset parent).
    const slot = selected === null ? undefined : slots[selected]?.root;
    if (slot) plate.style.left = `${slot.offsetLeft + slot.offsetWidth / 2}px`;
  };
  const slots: { root: HTMLElement; img: HTMLImageElement; count: HTMLElement }[] = [];
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const root = el('div', 'slot hotbar-slot');
    root.dataset.area = 'hotbar';
    root.dataset.index = String(i);
    root.setAttribute('role', 'button');
    const img = el('img', 'slot-icon');
    img.alt = '';
    img.draggable = false;
    const count = el('span', 'slot-count');
    root.append(el('span', 'slot-key', String(i + 1)), img, count);
    attachPress(root, { onTap: () => hooks.onTap(i), onHold: () => hooks.onHold(i) });
    // Press feedback under 100 ms: the slot sinks while the finger is down (skin.css .pressed).
    const release = (): void => root.classList.remove('pressed');
    root.addEventListener('pointerdown', () => root.classList.add('pressed'));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(ev, release);
    bar.appendChild(root);
    root.classList.add('is-empty');
    slots.push({ root, img, count });
  }
  bar.appendChild(plate);
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
        if (v.typeId !== null) s.img.src = isMaterialId(v.typeId) ? materialIconUrl(v.typeId) : furnitureIconUrl(v.typeId);
        // Every stack shows its count: seeds always (also 1), furniture from 2.
        s.count.textContent = v.typeId !== null && (v.count > 1 || (isMaterialId(v.typeId) && v.count > 0)) ? String(v.count) : '';
        s.root.classList.toggle('dim', v.typeId !== null && !v.usable);
        setRank(s.root, v.typeId);
        s.root.title = v.typeId === null ? 'Empty slot' : `${v.name} (${v.count})`;
        s.root.classList.toggle('is-empty', v.typeId === null);
        names[i] = v.typeId === null ? '' : v.count > 1 ? `${v.name} x${v.count}` : v.name;
      });
      showName();
    },
    setHidden(hidden) {
      bar.hidden = hidden;
    },
    setSelected(index) {
      slots.forEach((s, i) => {
        const was = s.root.classList.contains('selected');
        s.root.classList.toggle('selected', i === index);
        // A short stepped pop on the newly chosen slot (skin.css .just-selected).
        if (i === index && !was) {
          s.root.classList.remove('just-selected');
          void s.root.offsetWidth;
          s.root.classList.add('just-selected');
        }
      });
      selected = index;
      showName();
    },
    setChoosing(on) {
      bar.classList.toggle('choosing', on);
    },
  };
}
