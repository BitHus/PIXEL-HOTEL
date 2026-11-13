// The catalog (step 7, Catalog button in the right-edge column): three tabs, Home, Shop and
// Decor (floor and wall styles), each a list of rows with an icon, the name, where it goes, the
// price and Buy. Buying furniture puts it in the bag; buying a style unlocks it forever (it then
// shows "Owned"; apply it in the Room panel). Buy is greyed out when the gold is short.

import {
  STYLE_TYPES,
  catalogPrice,
  catalogTypes,
  stylePrice,
  styleKey,
  type FurnitureType,
  type StyleKind,
  type StyleType,
} from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { furnitureIconUrl } from './itemIcon.ts';
import { pixelIcon } from './pixelIcons.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export type CatalogTab = 'home' | 'shop' | 'decor';

export interface CatalogHooks {
  buyItem(typeId: string): void;
  buyStyle(kind: StyleKind, id: string): void;
}

export interface CatalogPanel {
  readonly el: HTMLElement;
  refresh(gold: number, unlocked: readonly string[]): void;
}

const TABS: [CatalogTab, string][] = [
  ['home', 'Home'],
  ['shop', 'Shop'],
  ['decor', 'Decor'],
];

const WHERE: Record<FurnitureType['placeIn'], string> = { hotel: 'Hotel room', shop: 'Shop', both: 'Hotel or shop' };

export function createCatalogPanel(parent: HTMLElement, hooks: CatalogHooks): CatalogPanel {
  const panel = el('div', 'frame panel catalog-panel');
  const tabs = el('div', 'tabs');
  const list = el('div', 'catalog-list');
  panel.append(el('h2', 'panel-title', 'Catalog'), tabs, list);
  parent.appendChild(panel);

  let tab: CatalogTab = 'home';
  let gold = 0;
  let unlocked: readonly string[] = [];
  const tabButtons = TABS.map(([t, label]) => {
    const b = textButton(label, () => {
      tab = t;
      draw();
    }, 'tab');
    tabs.appendChild(b);
    return [t, b] as const;
  });

  const priceTag = (price: number): HTMLElement => {
    const p = el('span', 'catalog-price');
    p.append(pixelIcon('coin'), el('span', '', String(price)));
    return p;
  };

  const row = (img: string, name: string, sub: string, price: number, owned: boolean, buy: () => void): HTMLElement => {
    const r = el('div', 'catalog-row');
    const box = el('div', 'slot');
    const i = el('img', 'slot-icon');
    i.src = img;
    i.alt = '';
    box.appendChild(i);
    const info = el('div', 'catalog-info');
    info.append(el('div', 'catalog-name', name), el('div', 'catalog-sub', sub), priceTag(price));
    const b = textButton(owned ? 'Owned' : 'Buy', buy);
    b.disabled = owned || gold < price;
    r.append(box, info, b);
    return r;
  };

  const furnitureRow = (t: FurnitureType): HTMLElement =>
    row(furnitureIconUrl(t.id), t.name, WHERE[t.placeIn], catalogPrice(t.id), false, () => hooks.buyItem(t.id));

  const styleRow = (s: StyleType): HTMLElement =>
    row(
      stylePreviewUrl(s.kind, s.id),
      s.name,
      s.kind === 'floor' ? 'Floor' : 'Wall',
      stylePrice(s),
      unlocked.includes(styleKey(s.kind, s.id)),
      () => hooks.buyStyle(s.kind, s.id),
    );

  const draw = (): void => {
    for (const [t, b] of tabButtons) b.classList.toggle('on', t === tab);
    list.replaceChildren();
    if (tab === 'decor') {
      for (const s of STYLE_TYPES.filter((x) => x.inCatalog)) list.appendChild(styleRow(s));
      return;
    }
    const category = tab === 'home' ? 'home_furniture' : 'shop_furniture';
    for (const t of catalogTypes().filter((x) => x.category === category)) list.appendChild(furnitureRow(t));
  };

  return {
    el: panel,
    refresh(g, u) {
      gold = g;
      unlocked = u;
      draw();
    },
  };
}
