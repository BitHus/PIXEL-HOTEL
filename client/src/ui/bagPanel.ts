// The Bag (step 5), laid out as in docs/UI-REFERENCE.md section 4:
//   icon tabs on top (Furniture, Materials; the open tab is wider and shows its name),
//   a parchment panel with the hotbar row on top, a line, and the bag grid (BAG_SLOTS slots,
//   empty ones visible), Sort and Stack buttons beside it, and the gold strip under it.
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
import { el, iconButton } from './dom.ts';
import { shortNumber } from './format.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
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
  gold: number;
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

const TABS: [BagTab, IconName, string][] = [
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

export function createBagPanel(parent: HTMLElement, hooks: BagHooks): BagPanel {
  const root = el('div', 'panel bag');
  root.style.setProperty('--bag-cols', String(BAG_COLUMNS));
  root.style.setProperty('--bag-cols-phone', String(BAG_COLUMNS_PHONE));
  const tabRow = el('div', 'bag-tabs');
  const frame = el('div', 'frame bag-frame');
  const hotbarRow = el('div', 'bag-grid bag-hotbar-row');
  const grid = el('div', 'bag-grid');
  const info = el('div', 'panel-info bag-info');
  frame.append(hotbarRow, el('div', 'bag-line'), grid, info);
  const tools = el('div', 'bag-tools');
  tools.append(
    iconButton('sort', 'Sort', () => hooks.onTidy(tab, 'sort')),
    iconButton('stack', 'Stack (merge equal items)', () => hooks.onTidy(tab, 'stack')),
  );
  const body = el('div', 'bag-body');
  body.append(frame, tools);
  const goldText = el('span', '', '0');
  const gold = el('div', 'frame bag-gold');
  gold.append(pixelIcon('coin'), goldText);
  root.append(tabRow, body, gold);
  parent.appendChild(root);

  let tab: BagTab = 'furniture';
  let contents: BagContents | null = null;
  let carry: SlotRef | null = null;

  const tabButtons = TABS.map(([name, icon, label]) => {
    const b = iconButton(icon, label, () => setTab(name), 'bag-tab');
    b.appendChild(el('span', 'bag-tab-name', label));
    tabRow.appendChild(b);
    return [name, b] as const;
  });

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
    for (const [name, b] of tabButtons) b.classList.toggle('on', name === tab);
    if (carry === null) info.textContent = HINT[tab];
    if (!contents) return;
    const l = contents.layout;
    hotbarSlots.forEach((s, i) => fillSlot(s, l.hotbar[i] ?? null, i + 1));
    const ids = l.bag[tab];
    if (gridSlots.length !== ids.length || grid.dataset.tab !== tab) {
      grid.dataset.tab = tab;
      gridSlots = ids.map((_, i) => makeSlot({ area: tab, index: i }));
      grid.replaceChildren(...gridSlots);
    }
    gridSlots.forEach((s, i) => fillSlot(s, ids[i] ?? null, null));
    goldText.textContent = shortNumber(contents.gold);
    gold.title = `${contents.gold} gold`;
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
