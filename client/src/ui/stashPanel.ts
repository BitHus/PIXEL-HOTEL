// The Food stash panel (3e, owner 19 Nov): opened by tapping the serving hatch. The stash slots on top, the cooked dishes in the bag below.
// ONE CLICK moves a dish each way (a dish in the bag = into the stash, as many as fit; a slot = all its plates back to the bag); no stepper, no Fill.
// A dish is on the menu only while a slot holds it. Refill all tops up every slot that holds or held a dish. The numbers: shared/src/refill.ts stashView.

import { getMaterialType, stashView, type MaterialId, type StashSlot } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';
import { helpFold, iconBox, panelShell } from './panelShell.ts';
import { rankName } from './rank.ts';

export const STASH_HINT = 'Guests can only order a dish that is in the food stash. Tap a dish in your bag to put it out; tap a slot to take it back. Refill when a slot runs low.';
export const STASH_EMPTY_TEXT = 'The food stash has none';

export interface StashHooks {
  /** One click on a dish in the bag: into the stash (as many as fit). */
  put(dish: MaterialId): void;
  /** One click on a slot: all its plates back to the bag. */
  take(pieceUid: number, slot: number): void;
  /** Refill all: every slot with (or that had) a dish, from the bag. */
  refillAll(): void;
}

export interface StashPanel {
  readonly el: HTMLElement;
  update(pieceUids: readonly number[], stash: readonly StashSlot[], lastLoaded: Readonly<Record<string, MaterialId>> | undefined, materials: Partial<Record<MaterialId, number>>): void;
}

export function createStashPanel(parent: HTMLElement, hooks: StashHooks): StashPanel {
  const shell = panelShell(parent, 'workshop-panel taps-panel stash-panel', 'Food stash');
  const list = el('div', 'catalog-list');
  shell.body.append(list);
  let args: Parameters<StashPanel['update']> = [[], [], undefined, {}];

  const draw = (): void => {
    const [pieces, stash, memo, materials] = args;
    if (pieces.length === 0) {
      list.replaceChildren(el('div', 'panel-info', 'There is no serving hatch in your tavern. Place one (Bag or Catalog, Tavern) to serve dishes.'));
      return;
    }
    const v = stashView(pieces, stash, memo, materials);
    // The artist's classes: .stash-slots > .stash-slot (+ .empty, .low, .dry) > icon, .stash-name, .stash-count; .stash-bag > .stash-dish.
    const slots = el('div', 'stash-slots');
    v.slots.forEach((s, i) => {
      const dish = s.dish ?? s.remembered;
      const label = s.dish ? `${getMaterialType(s.dish).name}` : s.remembered ? `${getMaterialType(s.remembered).name}: empty` : 'Empty';
      const b = textButton('', () => s.dish && hooks.take(s.pieceUid, s.slot), `stash-slot tap-row${s.dish ? '' : ' empty'}${s.low ? ' low' : ''}${s.remembered ? ' dry' : ''}`);
      b.disabled = !s.dish;
      b.title = s.dish ? `Slot ${i + 1}: take ${s.plates} back to the bag` : `Slot ${i + 1}: tap a dish below to put it here`;
      b.replaceChildren(
        iconBox(materialIconUrl(dish ?? 'roasted_turnip'), dish && s.dish ? '' : 'dim'),
        s.dish ? rankName('span', 'stash-name', label, s.dish) : el('span', 'stash-name', label),
        el('span', 'stash-count', `${s.plates}/${s.cap}`),
      );
      slots.append(b);
    });
    const refill = textButton('Refill all', () => hooks.refillAll(), 'primary stash-refill');
    refill.hidden = !v.canRefill;
    const bag = el('div', 'stash-bag');
    if (v.bag.length === 0) bag.append(el('div', 'catalog-sub', 'No cooked dishes in your bag. Cook some at a stove and collect them.'));
    for (const d of v.bag) {
      const b = textButton('', () => hooks.put(d.dish), 'stash-dish');
      b.title = `Put ${getMaterialType(d.dish).name} in the stash`;
      b.replaceChildren(iconBox(materialIconUrl(d.dish)), rankName('span', 'stash-name', getMaterialType(d.dish).name, d.dish), el('span', 'stash-count', `x${d.inBag}`));
      bag.append(b);
    }
    list.replaceChildren(helpFold(STASH_HINT), slots, refill, el('div', 'catalog-sub stash-bag-head', 'In your bag'), bag);
  };

  draw();
  return {
    el: shell.el,
    update(...a) { args = a; draw(); },
  };
}
