// The Bag (step 5): the full inventory in a panel with a grid of slots and two tabs, Furniture
// and Materials. Furniture is stacked by type; materials are stacks with a count and cannot be
// placed. Tap a furniture slot: start placing it (the panel closes). Long-press a slot (or drag
// it with the mouse) and drop it on a hotbar slot to put it in the hotbar; dropped anywhere
// else, the next tap on a hotbar slot puts it there.

import {
  BAG_MIN_SLOTS,
  getFurnitureType,
  getMaterialType,
  type FurnitureStack,
  type MaterialStack,
  type Point,
} from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { attachPress } from './press.ts';

export interface BagHooks {
  onPlace(typeId: string): void;
  /** A carried item was dropped on hotbar slot `index`. */
  onAssign(index: number, typeId: string): void;
  /** Carrying (choosing a hotbar slot) started or ended. */
  onCarry(on: boolean): void;
}

export interface BagPanel {
  readonly el: HTMLElement;
  /** The furniture type waiting for a hotbar slot, or null. */
  readonly carrying: string | null;
  endCarry(): void;
  refresh(furniture: readonly FurnitureStack[], materials: readonly MaterialStack[]): void;
}

type Tab = 'furniture' | 'materials';
const HINT = 'Tap to place. Hold and drag to the hotbar.';

export function createBagPanel(parent: HTMLElement, hooks: BagHooks): BagPanel {
  const panel = el('div', 'frame panel bag-panel');
  const tabs = el('div', 'tabs');
  const grid = el('div', 'slot-grid');
  const info = el('div', 'panel-info', HINT);
  let tab: Tab = 'furniture';
  const furnitureTab = textButton('Furniture', () => setTab('furniture'), 'tab');
  const materialsTab = textButton('Materials', () => setTab('materials'), 'tab');
  tabs.append(furnitureTab, materialsTab);
  panel.append(el('h2', 'panel-title', 'Bag'), tabs, grid, info);
  parent.appendChild(panel);

  let furniture: readonly FurnitureStack[] = [];
  let materials: readonly MaterialStack[] = [];
  let carrying: string | null = null;
  const ghost = el('img', 'carry-ghost');
  ghost.hidden = true;
  ghost.alt = '';
  parent.appendChild(ghost);

  const setTab = (next: Tab): void => {
    tab = next;
    endCarry();
    draw();
  };

  const moveGhost = (p: Point): void => {
    ghost.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  };
  const onMove = (e: PointerEvent): void => moveGhost({ x: e.clientX, y: e.clientY });
  // While dragging with a finger, the page must not scroll.
  const noScroll = (e: TouchEvent): void => {
    if (ghost.hidden === false) e.preventDefault();
  };
  const onUp = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    ghost.hidden = true;
    const slot = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.hotbar-slot');
    const index = slot ? Number(slot.dataset.index) : NaN;
    if (carrying !== null && Number.isInteger(index)) {
      const typeId = carrying;
      endCarry();
      hooks.onAssign(index, typeId);
    } else if (carrying !== null) {
      info.textContent = 'Now tap a hotbar slot.';
    }
  };
  window.addEventListener('touchmove', noScroll, { passive: false });

  /** Starts carrying (the pressed slot stays in the DOM: redrawing mid-gesture would lose the touch). */
  const startCarry = (typeId: string, at: Point, from: HTMLElement): void => {
    grid.querySelectorAll('.selected').forEach((e) => e.classList.remove('selected'));
    carrying = typeId;
    from.classList.add('selected');
    ghost.src = furnitureIconUrl(typeId);
    ghost.hidden = false;
    moveGhost(at);
    info.textContent = `${getFurnitureType(typeId).name}: drop it on a hotbar slot.`;
    hooks.onCarry(true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  function endCarry(): void {
    if (carrying === null) return;
    carrying = null;
    ghost.hidden = true;
    info.textContent = HINT;
    draw();
    hooks.onCarry(false);
  }

  const slot = (icon: string | null, count: number, title: string): HTMLElement => {
    const s = el('div', 'slot');
    s.setAttribute('role', 'button');
    s.title = title;
    if (icon) {
      const img = el('img', 'slot-icon');
      img.src = icon;
      img.alt = '';
      img.draggable = false;
      s.appendChild(img);
    } else {
      s.classList.add('empty');
    }
    if (count > 1) s.appendChild(el('span', 'slot-count', String(count)));
    return s;
  };

  function draw(): void {
    furnitureTab.classList.toggle('on', tab === 'furniture');
    materialsTab.classList.toggle('on', tab === 'materials');
    grid.replaceChildren();
    let used = 0;
    if (tab === 'furniture') {
      for (const f of furniture) {
        const name = getFurnitureType(f.typeId).name;
        const s = slot(furnitureIconUrl(f.typeId), f.count, `${name} (${f.count})`);
        s.classList.toggle('selected', carrying === f.typeId);
        attachPress(s, {
          onTap: () => {
            endCarry();
            hooks.onPlace(f.typeId);
          },
          onHold: (at) => startCarry(f.typeId, at, s),
        });
        grid.appendChild(s);
        used++;
      }
    } else {
      for (const m of materials) {
        const type = getMaterialType(m.id);
        const s = slot(materialIconUrl(m.id), m.qty, `${type.name} x${m.qty}`);
        const show = (): void => void (info.textContent = `${type.name} x${m.qty} (worth ${type.baseValue} gold each). Materials cannot be placed.`);
        attachPress(s, { onTap: show, onHold: show });
        grid.appendChild(s);
        used++;
      }
    }
    for (; used < BAG_MIN_SLOTS; used++) grid.appendChild(slot(null, 0, ''));
  }

  draw();
  return {
    el: panel,
    get carrying() {
      return carrying;
    },
    endCarry,
    refresh(f, m) {
      furniture = f;
      materials = m;
      if (carrying !== null && !f.some((s) => s.typeId === carrying)) endCarry();
      draw();
    },
  };
}
