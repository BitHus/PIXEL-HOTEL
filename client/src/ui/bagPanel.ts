// The Bag (step 5), laid out as in docs/UI-REFERENCE.md section 4:
//   icon tabs on the top edge (Furniture, Materials; the open tab is raised and shows its name),
//   a parchment panel with the hotbar row and the bag grid, each in its own inset section with a
//   diamond divider between, and Sort and Stack in a slim strip below. The grid shows the rows
//   up to the last filled slot plus one empty row (shownSlots), not all BAG_SLOTS. No gold here:
//   the info panel shows it (UI polish step).
// Every slot (also the main hotbar's) has data-area / data-index (bag.ts SlotRef).
//   Tap a furniture stack: start placing it (main.ts closes the panel).
//   Move a stack: drag it (mouse), or long-press it and drag (touch). Dropped on a slot, it moves
//   there (two full slots swap). Dropped anywhere else, it stays picked up: tap the target slot.
//   Materials cannot be placed: a tap picks them up, then tap the target slot.
//   Tap the picked-up slot again (or switch tabs, or close the bag) to put it back down.

import {
  BAG_COLUMNS,
  BAG_COLUMNS_PHONE,
  HOTBAR_SLOTS,
  canMoveBetween,
  getFurnitureType,
  getMaterialType,
  isMaterialId,
  type BagTab,
  type Point,
  type SlotLayout,
  type SlotRef,
} from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { panelShell, tabBar } from './panelShell.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';
import { attachPress } from './press.ts';

export interface BagHooks {
  /** A furniture stack was tapped. */
  onPlace(typeId: string): void;
  onMove(from: SlotRef, to: SlotRef): void;
  onTidy(tab: BagTab, how: 'sort' | 'stack'): void;
  /** A stack was picked up (true) or put down (false); the main hotbar shows it can take it. */
  onCarry(on: boolean): void;
}

export interface BagContents {
  layout: SlotLayout;
  /** How many of a furniture type / material the inventory holds. */
  count(id: string): number;
  /** False when a furniture type cannot be placed now (none left, or not in this room). */
  usable(typeId: string): boolean;
}

export interface BagPanel {
  readonly el: HTMLElement;
  /** The frame that holds the close button. */
  readonly frame: HTMLElement;
  /** True while a stack is picked up. */
  readonly carrying: boolean;
  /** A tap on a slot outside the panel (the main hotbar) while a stack is picked up. */
  dropOn(to: SlotRef): void;
  endCarry(): void;
  refresh(contents: BagContents): void;
}

const TABS: readonly (readonly [BagTab, IconName, string])[] = [
  ['furniture', 'chair', 'Furniture'],
  ['materials', 'wood', 'Materials'],
];
const HINT: Record<BagTab, string> = {
  furniture: 'Tap to place. Drag (or hold) to move.',
  materials: 'Materials are sold in the shop. Tap one, then a slot, to move it.',
};

const sameRef = (a: SlotRef, b: SlotRef): boolean => a.area === b.area && a.index === b.index;

/** The slot reference of a slot element (any element inside it), or null. */
export function slotRefOf(target: Element | null): SlotRef | null {
  const s = target?.closest<HTMLElement>('[data-area]');
  if (!s) return null;
  const area = s.dataset.area;
  const index = Number(s.dataset.index);
  if ((area !== 'hotbar' && area !== 'furniture' && area !== 'materials') || !Number.isInteger(index)) return null;
  return { area, index };
}

/** How many slots of a tab to show: the rows up to the last filled slot plus one empty row. */
export function shownSlots(ids: readonly (string | null)[], cols: number): number {
  let last = -1;
  ids.forEach((id, i) => {
    if (id !== null) last = i;
  });
  const rows = Math.floor(last / cols) + 2;
  return Math.min(ids.length, rows * cols);
}

export function createBagPanel(parent: HTMLElement, hooks: BagHooks): BagPanel {
  const shell = panelShell(parent, 'bag');
  const root = shell.el;
  root.style.setProperty('--bag-cols', String(BAG_COLUMNS));
  root.style.setProperty('--bag-cols-phone', String(BAG_COLUMNS_PHONE));
  const tabRow = shell.tabs;
  const frame = shell.frame;
  const hotbarRow = el('div', 'tray bag-section bag-hotbar-row');
  const grid = el('div', 'tray bag-section bag-grid');
  const info = el('div', 'panel-info bag-info');
  shell.body.append(hotbarRow, el('div', 'divider'), grid, info);
  const tool = (icon: IconName, label: string, title: string, how: 'sort' | 'stack'): HTMLButtonElement => {
    const b = el('button', 'btn small');
    b.type = 'button';
    b.title = title;
    b.append(pixelIcon(icon), el('span', '', label));
    b.addEventListener('click', () => hooks.onTidy(tab, how));
    return b;
  };
  shell.strip.append(tool('sort', 'Sort', 'Sort', 'sort'), tool('stack', 'Stack', 'Stack (merge equal items)', 'stack'));
  // The grid has fewer columns on a phone (ui.css uses the same width).
  const phone = window.matchMedia('(max-width: 680px)');
  phone.addEventListener('change', () => draw());

  let tab: BagTab = 'furniture';
  let contents: BagContents | null = null;
  let carry: SlotRef | null = null;

  const markTab = tabBar(tabRow, TABS, (name) => setTab(name));

  const setTab = (next: BagTab): void => {
    endCarry();
    tab = next;
    draw();
  };

  // ---------- carrying (drag ghost) ----------
  const ghost = el('img', 'carry-ghost');
  ghost.hidden = true;
  ghost.alt = '';
  parent.appendChild(ghost);
  const moveGhost = (p: Point): void => {
    ghost.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  };
  const onMove = (e: PointerEvent): void => moveGhost({ x: e.clientX, y: e.clientY });
  // While dragging with a finger, the page must not scroll.
  window.addEventListener('touchmove', (e) => ghost.hidden || e.preventDefault(), { passive: false });
  const stopDrag = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    ghost.hidden = true;
  };
  const onCancel = (): void => stopDrag();
  const onUp = (e: PointerEvent): void => {
    stopDrag();
    const to = slotRefOf(document.elementFromPoint(e.clientX, e.clientY));
    if (carry && to && !sameRef(carry, to)) dropOn(to);
    else if (carry) info.textContent = 'Now tap the slot to put it in.';
  };

  const idAt = (ref: SlotRef): string | null => {
    if (!contents) return null;
    const l = contents.layout;
    return (ref.area === 'hotbar' ? l.hotbar : l.bag[ref.area])[ref.index] ?? null;
  };

  const nameOf = (id: string): string => (isMaterialId(id) ? getMaterialType(id).name : getFurnitureType(id).name);
  const iconOf = (id: string): string => (isMaterialId(id) ? materialIconUrl(id) : furnitureIconUrl(id));

  const startCarry = (ref: SlotRef, drag: Point | null): void => {
    const id = idAt(ref);
    if (id === null) return;
    carry = ref;
    markCarry();
    info.textContent = `${nameOf(id)}: ${drag ? 'drop it on a slot.' : 'now tap a slot.'}`;
    hooks.onCarry(ref.area !== 'materials');
    if (!drag) return;
    ghost.src = iconOf(id);
    ghost.hidden = false;
    moveGhost(drag);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  function endCarry(): void {
    if (carry === null) return;
    carry = null;
    stopDrag();
    info.textContent = HINT[tab];
    markCarry();
    hooks.onCarry(false);
  }

  function dropOn(to: SlotRef): void {
    const from = carry;
    if (!from) return;
    if (sameRef(from, to)) {
      endCarry();
      return;
    }
    if (!canMoveBetween(from.area, to.area)) {
      info.textContent = 'Materials cannot go in the hotbar.';
      return;
    }
    endCarry();
    hooks.onMove(from, to);
  }

  function markCarry(): void {
    root.querySelectorAll('.carried').forEach((e) => e.classList.remove('carried'));
    if (!carry) return;
    root.querySelector(`[data-area="${carry.area}"][data-index="${carry.index}"]`)?.classList.add('carried');
  }

  // ---------- slots ----------
  const tapSlot = (ref: SlotRef): void => {
    if (carry) return dropOn(ref);
    const id = idAt(ref);
    if (id === null) return;
    if (isMaterialId(id)) {
      startCarry(ref, null);
      info.textContent = `${nameOf(id)} x${contents?.count(id) ?? 0}, worth ${getMaterialType(id).baseValue} gold each. Tap a slot to move it.`;
    } else {
      hooks.onPlace(id);
    }
  };

  const makeSlot = (ref: SlotRef): HTMLElement => {
    const s = el('div', 'slot');
    s.dataset.area = ref.area;
    s.dataset.index = String(ref.index);
    s.setAttribute('role', 'button');
    attachPress(s, {
      onTap: () => tapSlot(ref),
      onHold: (at) => {
        if (carry && !sameRef(carry, ref)) return dropOn(ref);
        endCarry();
        startCarry(ref, at);
      },
    });
    return s;
  };

  const fillSlot = (s: HTMLElement, id: string | null, hotkey: number | null): void => {
    s.replaceChildren();
    s.classList.toggle('empty', id === null);
    s.classList.remove('dim');
    if (hotkey !== null) s.appendChild(el('span', 'slot-key', String(hotkey)));
    if (id === null || !contents) {
      s.title = 'Empty slot';
      return;
    }
    const img = el('img', 'slot-icon');
    img.src = iconOf(id);
    img.alt = '';
    img.draggable = false;
    s.appendChild(img);
    const n = contents.count(id);
    if (n > 1) s.appendChild(el('span', 'slot-count', String(n)));
    if (!isMaterialId(id)) s.classList.toggle('dim', !contents.usable(id));
    s.title = `${nameOf(id)} (${n})`;
  };

  const hotbarSlots = Array.from({ length: HOTBAR_SLOTS }, (_, i) => {
    const s = makeSlot({ area: 'hotbar', index: i });
    hotbarRow.appendChild(s);
    return s;
  });
  let gridSlots: HTMLElement[] = [];

  function draw(): void {
    markTab(tab);
    if (carry === null) info.textContent = HINT[tab];
    if (!contents) return;
    const l = contents.layout;
    hotbarSlots.forEach((s, i) => fillSlot(s, l.hotbar[i] ?? null, i + 1));
    const ids = l.bag[tab];
    const shown = shownSlots(ids, phone.matches ? BAG_COLUMNS_PHONE : BAG_COLUMNS);
    if (gridSlots.length !== shown || grid.dataset.tab !== tab) {
      grid.dataset.tab = tab;
      gridSlots = Array.from({ length: shown }, (_, i) => makeSlot({ area: tab, index: i }));
      grid.replaceChildren(...gridSlots);
    }
    gridSlots.forEach((s, i) => fillSlot(s, ids[i] ?? null, null));
    markCarry();
  }

  draw();
  return {
    el: root,
    frame,
    get carrying() {
      return carry !== null;
    },
    dropOn,
    endCarry,
    refresh(next) {
      contents = next;
      if (carry && idAt(carry) === null) endCarry();
      draw();
    },
  };
}
