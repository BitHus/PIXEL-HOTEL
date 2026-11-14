// The shelf panel (step 7): opens in play mode when the player taps a table, shelf or case in the
// shop. One card per slot: the item's icon and name, the last 5 sale prices of that item type,
// Take (back to the bag), and a price row (− / coin + number / +). An empty slot has "Put item": it lists what the bag
// holds (materials and furniture) to choose from; the price starts at the last sale price of that
// type, else its base value.

import { rankName } from './rank.ts';
import {
  getFurnitureType,
  isMaterialId,
  lootTypeId,
  materialStacks,
  typeBaseValue,
  typeName,
  furnitureStacks,
  type FurnitureItem,
  type Inventory,
  type ShelfSlotRef,
  type ShopView,
  type StockPick,
} from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { panelShell } from './panelShell.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface ShelfHooks {
  put(slot: ShelfSlotRef, pick: StockPick, price: number): void;
  take(slot: ShelfSlotRef): void;
  setPrice(slot: ShelfSlotRef, price: number): void;
}

export interface ShelfPanel {
  readonly el: HTMLElement;
  /** The table, shelf or case the panel is for (null = none). */
  readonly uid: number | null;
  show(item: FurnitureItem): void;
  /** Redraws with the current shop and bag (also while closed: it is cheap). */
  refresh(shop: ShopView, inventory: Inventory): void;
  clear(): void;
}

function icon(typeId: string): HTMLImageElement {
  const img = el('img', 'slot-icon');
  img.src = isMaterialId(typeId) ? materialIconUrl(typeId) : furnitureIconUrl(typeId);
  img.alt = '';
  return img;
}

export function createShelfPanel(parent: HTMLElement, hooks: ShelfHooks): ShelfPanel {
  const shell = panelShell(parent, 'shelf-panel', 'Shelf');
  const panel = shell.el;
  const title = shell.title;
  const sub = el('div', 'panel-info shelf-sub');
  const body = el('div', 'shelf-rows');
  shell.body.append(sub, body);

  let item: FurnitureItem | null = null;
  let shop: ShopView | null = null;
  let inv: Inventory | null = null;
  /** The empty slot whose "Put item" list is open. */
  let choosing: number | null = null;

  const draw = (): void => {
    body.replaceChildren();
    if (!item || !shop || !inv) return;
    const type = getFurnitureType(item.typeId);
    title.textContent = type.name;
    const filled = shop.slots.filter((x) => x.shelfUid === item!.uid && x.loot).length;
    sub.textContent = `${filled} of ${type.slots} slots for sale`;
    for (let index = 0; index < type.slots; index++) {
      const ref = { shelfUid: item.uid, index };
      const slot = shop.slots.find((x) => x.shelfUid === item!.uid && x.index === index);
      const card = el('div', `shelf-card${slot?.loot ? '' : ' empty'}`);
      const box = el('div', `slot${slot?.loot ? '' : ' empty'}`);
      box.style.gridArea = 'icon';
      card.appendChild(box);
      if (slot?.loot) {
        const id = lootTypeId(slot.loot);
        box.appendChild(icon(id));
        const history = shop.saleHistory[id] ?? [];
        const name = rankName('div', 'shelf-name', typeName(id), id);
        const hist = el('div', 'shelf-history', history.length ? `Sold for ${history.join(', ')}` : 'Not sold yet');
        const take = textButton('Take', () => hooks.take(ref), 'shelf-take');
        take.title = 'Take it back to the bag';
        const price = el('div', 'price-row');
        const input = el('input', 'price-input');
        input.type = 'number';
        input.inputMode = 'numeric';
        input.min = '1';
        input.value = String(slot.price);
        input.setAttribute('aria-label', `Price of ${typeName(id)} in gold`);
        const send = (p: number): void => {
          const v = Math.max(1, Math.round(p));
          if (Number.isFinite(v) && v !== slot.price) hooks.setPrice(ref, v);
        };
        input.addEventListener('change', () => send(Number(input.value)));
        input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
        const field = el('label', 'price-field');
        field.append(pixelIcon('coin'), input);
        const minus = textButton('−', () => send(slot.price - 1), 'step');
        minus.setAttribute('aria-label', 'Lower the price');
        const plus = textButton('+', () => send(slot.price + 1), 'step');
        plus.setAttribute('aria-label', 'Raise the price');
        price.append(el('span', 'price-label', 'Price'), minus, field, plus);
        card.append(name, hist, take, price);
      } else {
        const name = el('div', 'shelf-name', 'Empty slot');
        const hist = el('div', 'shelf-history', 'Put something up for sale');
        const put = textButton(choosing === index ? 'Close' : 'Put item', () => {
          choosing = choosing === index ? null : index;
          draw();
        }, 'shelf-take');
        card.append(name, hist, put);
        if (choosing === index) {
          const pick = chooser(ref);
          pick.style.gridArea = 'price';
          card.appendChild(pick);
        }
      }
      body.appendChild(card);
    }
  };

  /** What the bag holds, to put on the slot. */
  const chooser = (ref: ShelfSlotRef): HTMLElement => {
    const grid = el('div', 'shelf-choose');
    const picks: { id: string; count: number; pick: StockPick }[] = [
      ...materialStacks(inv!.materials).map((m) => ({ id: m.id, count: m.qty, pick: { kind: 'material', id: m.id } as StockPick })),
      ...furnitureStacks(inv!.furniture).map((f) => ({ id: f.typeId, count: f.count, pick: { kind: 'furniture', typeId: f.typeId } as StockPick })),
    ];
    if (picks.length === 0) grid.appendChild(el('div', 'panel-info', 'Your bag is empty.'));
    for (const p of picks) {
      const b = el('button', 'slot');
      b.type = 'button';
      b.title = typeName(p.id);
      b.append(icon(p.id), el('span', 'slot-count', String(p.count)));
      b.addEventListener('click', () => {
        choosing = null;
        const last = shop?.saleHistory[p.id]?.at(-1);
        hooks.put(ref, p.pick, last ?? typeBaseValue(p.id));
      });
      grid.appendChild(b);
    }
    return grid;
  };

  return {
    el: panel,
    get uid() {
      return item?.uid ?? null;
    },
    show(next) {
      if (item?.uid !== next.uid) choosing = null;
      item = next;
      draw();
    },
    refresh(s, i) {
      shop = s;
      inv = i;
      // Do not redraw under a price being typed.
      if (panel.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return;
      draw();
    },
    clear() {
      item = null;
      choosing = null;
      body.replaceChildren();
    },
  };
}
