// The catalog (step 7, Catalog button): four icon tabs on the panel's top edge, Home, Shop, Decor
// (floor and wall styles) and Seeds (step 9b). Each tab is a grid of cards (UI polish step: 2
// columns on a phone, 3 on a wide screen): a big icon, the name and the price. A tap on a card
// opens the "Buy this?" panel, which has the details (and, for seeds, Buy 1 and the pack of
// SEED_PACK). A card whose price is too high is dimmed with the price in red. A small tag shows
// only when the thing cannot go in the room the player is in, or when a style is already owned.

import { rankName } from './rank.ts';
import {
  STYLE_TYPES,
  getCropType,
  seedsForSale,
  type CropType,
  type SeedId,
  catalogPrice,
  catalogTypes,
  fitsRoomKind,
  stylePrice,
  styleKey,
  type FurnitureType,
  type Room,
  type StyleKind,
  type StyleType,
} from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { panelShell, priceTag, tabBar } from './panelShell.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export type CatalogTab = 'home' | 'shop' | 'decor' | 'seeds';

export interface CatalogHooks {
  buyItem(typeId: string): void;
  buyStyle(kind: StyleKind, id: string): void;
  /** Asks first; the confirm panel offers 1 or a pack. */
  buySeeds(seed: SeedId): void;
}

export interface CatalogPanel {
  readonly el: HTMLElement;
  refresh(gold: number, unlocked: readonly string[], room: Room): void;
}

const TABS = [
  ['home', 'chair', 'Home'],
  ['shop', 'coin', 'Shop'],
  ['decor', 'house', 'Decor'],
  ['seeds', 'sprout', 'Seeds'],
] as const;

/** Where a furniture type goes, in words (for the confirm panel). */
export const WHERE: Record<FurnitureType['placeIn'], string> = { hotel: 'the hotel room', shop: 'the shop', both: 'the hotel room or the shop' };

export function growText(c: CropType): string {
  return c.growMinutes >= 60 ? `${c.growMinutes / 60} h` : `${c.growMinutes} min`;
}

export function createCatalogPanel(parent: HTMLElement, hooks: CatalogHooks): CatalogPanel {
  const shell = panelShell(parent, 'catalog-panel', 'Catalog');
  const note = el('div', 'panel-info');
  const list = el('div', 'card-grid');
  shell.body.append(note, list);

  let tab: CatalogTab = 'home';
  let gold = 0;
  let unlocked: readonly string[] = [];
  let room: Room | null = null;
  const markTab = tabBar(shell.tabs, TABS, (t) => {
    tab = t;
    draw();
    shell.body.scrollTop = 0;
  });

  /** One card: tag (or none), big icon, name, price. `owned` cards cannot be bought. */
  const card = (img: string, name: string, price: number, tag: string | null, owned: boolean, buy: () => void, rankId: string | null = null): HTMLElement => {
    const c = el('button', `shop-card${owned ? ' owned' : gold < price ? ' poor' : ''}`);
    c.type = 'button';
    const icon = el('img', 'shop-card-icon');
    icon.src = img;
    icon.alt = '';
    icon.draggable = false;
    c.append(icon, rankId === null ? el('span', 'shop-card-name', name) : rankName('span', 'shop-card-name', name, rankId), owned ? el('span', 'shop-card-owned', 'Owned') : priceTag(price, gold));
    if (tag) c.appendChild(el('span', 'shop-card-tag plate', tag));
    c.disabled = owned;
    c.addEventListener('click', buy);
    return c;
  };

  const furnitureCard = (t: FurnitureType): HTMLElement => {
    const fits = room === null || fitsRoomKind(t, room);
    return card(furnitureIconUrl(t.id), t.name, catalogPrice(t.id), fits ? null : t.placeIn === 'shop' ? 'Shop only' : 'Not here', false, () => hooks.buyItem(t.id), t.id);
  };

  const styleCard = (s: StyleType): HTMLElement =>
    card(stylePreviewUrl(s.kind, s.id), s.name, stylePrice(s), room?.kind === 'farm' ? 'Not here' : s.kind === 'floor' ? 'Floor' : 'Wall', unlocked.includes(styleKey(s.kind, s.id)), () =>
      hooks.buyStyle(s.kind, s.id),
    );

  const seedCard = (c: CropType): HTMLElement => card(materialIconUrl(c.seed), c.seedName, c.seedPrice ?? 0, null, false, () => hooks.buySeeds(c.seed), c.seed);

  const draw = (): void => {
    markTab(tab);
    list.replaceChildren();
    note.hidden = tab !== 'seeds';
    if (tab === 'seeds') {
      note.textContent = `Plant seeds on your farm. The glowcap spore (${getCropType('glowcap').name}) only drops in the dungeon.`;
      for (const c of seedsForSale()) list.appendChild(seedCard(c));
      return;
    }
    if (tab === 'decor') {
      for (const s of STYLE_TYPES.filter((x) => x.inCatalog)) list.appendChild(styleCard(s));
      return;
    }
    const category = tab === 'home' ? 'home_furniture' : 'shop_furniture';
    for (const t of catalogTypes().filter((x) => x.category === category)) list.appendChild(furnitureCard(t));
  };

  return {
    el: shell.el,
    refresh(g, u, r) {
      gold = g;
      unlocked = u;
      room = r;
      draw();
    },
  };
}
