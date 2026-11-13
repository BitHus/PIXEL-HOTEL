// The shelf panel (step 7): opens in play mode when the player taps a table, shelf or case in the
// shop. One row per slot: the item's icon and name, its price (− / number / +), Take back, and
// the last 5 sale prices of that item type. An empty slot has "Put item": it lists what the bag
// holds (materials and furniture) to choose from; the price starts at the last sale price of that
// type, else its base value.

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
  const panel = el('div', 'frame panel shelf-panel');
  const title = el('h2', 'panel-title', 'Shelf');
  const body = el('div', 'shelf-rows');
  panel.append(title, body);
  parent.appendChild(panel);

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
    for (let index = 0; index < type.slots; index++) {
      const ref = { shelfUid: item.uid, index };
      const slot = shop.slots.find((s) => s.shelfUid === item!.uid && s.index === index);
      const row = el('div', 'shelf-row');
      const box = el('div', `slot${slot?.loot ? '' : ' empty'}`);
      row.appendChild(box);
      if (slot?.loot) {
        const id = lootTypeId(slot.loot);
        box.appendChild(icon(id));
        const info = el('div', 'shelf-info');
        const history = shop.saleHistory[id] ?? [];
        info.append(el('div', 'shelf-name', typeName(id)), el('div', 'shelf-history', history.length ? `Sold for: ${history.join(', ')}` : 'Not sold yet'));
        const price = el('div', 'price-row');
        const input = el('input', 'price-input');
        input.type = 'number';
        input.inputMode = 'numeric';
        input.min = '1';
        input.value = String(slot.price);
        input.setAttribute('aria-label', `Price of ${typeName(id)}`);
        const send = (p: number): void => {
          const v = Math.max(1, Math.round(p));
          if (Number.isFinite(v) && v !== slot.price) hooks.setPrice(ref, v);
        };
        input.addEventListener('change', () => send(Number(input.value)));
        input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
        price.append(
          textButton('−', () => send(slot.price - 1), 'step'),
          input,
          textButton('+', () => send(slot.price + 1), 'step'),
          el('span', 'price-unit', 'gold'),
        );
        info.appendChild(price);
        row.append(info, textButton('Take', () => hooks.take(ref)));
      } else {
        const info = el('div', 'shelf-info');
        info.append(el('div', 'shelf-name', 'Empty'));
        row.append(info, textButton(choosing === index ? 'Close' : 'Put item', () => {
          choosing = choosing === index ? null : index;
          draw();
        }));
      }
      body.appendChild(row);
      if (choosing === index && !slot?.loot) body.appendChild(chooser(ref));
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
