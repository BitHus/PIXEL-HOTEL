// The catalog (step 7, Catalog button): four icon tabs on the panel's top edge, Home, Shop, Decor
// (floor and wall styles) and Seeds (step 9b). Each tab is a grid of cards (UI polish step: 2
// columns on a phone, 3 on a wide screen): a big icon, the name and the price. A tap on a card
// opens the "Buy this?" panel, which has the details (and, for seeds, Buy 1 and the pack of
// SEED_PACK). A card whose price is too high is dimmed with the price in red. A small tag shows
// only when the thing cannot go in the room the player is in, or when a style is already owned.

import { rankName } from './rank.ts';
import {
  HATS,
  STYLE_TYPES,
  hatCatalogPrice,
  getCropType,
  seedGrowMs,
  seedsForSale,
  type BlockType,
  type CropType,
  type SeedId,
  blockPrice,
  catalogBlocks,
  catalogPrice,
  catalogTypes,
  fitsRoomKind,
  stylePrice,
  styleKey,
  type FurnitureType,
  type PackType,
  type Room,
  type StyleKind,
  type StyleType,
} from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { clothingIconUrl, furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { gemImg, panelShell, priceTag, tabBar } from './panelShell.ts';
import { pixelIcon } from './pixelIcons.ts';
import { setRank } from './rank.ts';
import { drawPacks, type PacksData } from './packsView.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export type CatalogTab = 'home' | 'shop' | 'decor' | 'blocks' | 'seeds' | 'clothes' | 'packs';

export interface CatalogHooks {
  buyItem(typeId: string): void;
  buyStyle(kind: StyleKind, id: string): void;
  /** Asks first; the confirm panel offers 1 or a pack. */
  buySeeds(seed: SeedId): void;
  /** Asks first; the confirm panel offers 1 or a pack (step BG5). */
  buyBlock(id: string): void;
  /** The Clothes tab (step 9g-1): asks first, then buys the hat. */
  buyHat(hatId: string): void;
  /** The Packs tab (step BG8): asks first, then opens the pack. */
  openPack(pack: PackType): void;
  /** Sells one spare piece of clothing. */
}

export interface CatalogPanel {
  readonly el: HTMLElement;
  /** `packs.owned` (optional): how many of each thing the player holds in the bag, for the "Own N" badge. */
  refresh(gold: number, unlocked: readonly string[], room: Room, packs?: PacksData): void;
}

const TABS = [
  ['home', 'chair', 'Home'],
  ['shop', 'food', 'Tavern'],
  ['decor', 'house', 'Decor'],
  ['blocks', 'bricks', 'Blocks'],
  ['seeds', 'sprout', 'Seeds'],
  ['clothes', 'shirt', 'Clothes'],
  ['packs', 'gems', 'Packs'],
] as const;

/** Where a furniture type goes, in words (for the confirm panel). */
export const WHERE: Record<FurnitureType['placeIn'], string> = { hotel: 'the hotel room', shop: 'the tavern', both: 'the hotel room or the tavern' };

/** How long a seed takes to be fully grown, in words (step BG6: by rank, config SEED_GROW_MS). */
export function growText(c: CropType): string {
  const min = Math.round(seedGrowMs(c.seed) / 60_000);
  return min >= 60 ? `${min / 60} h` : `${min} min`;
}

export function createCatalogPanel(parent: HTMLElement, hooks: CatalogHooks): CatalogPanel {
  const shell = panelShell(parent, 'catalog-panel', 'Catalog');
  const purse = el('div', 'purse-strip');
  const sortBar = el('div', 'sort-bar');
  const searchRow = el('div', 'catalog-search');
  const search = el('input', 'catalog-search-input') as HTMLInputElement;
  search.type = 'search';
  search.placeholder = 'Search by name';
  search.setAttribute('aria-label', 'Search the catalog');
  search.autocomplete = 'off';
  search.addEventListener('keydown', (e) => e.stopPropagation());
  search.addEventListener('input', () => {
    draw();
    applySort();
  });
  searchRow.append(search, purse);
  const empty = el('div', 'catalog-empty');
  empty.hidden = true;
  const emptyText = el('div', 'catalog-empty-text');
  const clear = el('button', 'btn small', 'Clear search');
  clear.type = 'button';
  clear.addEventListener('click', () => {
    search.value = '';
    draw();
    applySort();
  });
  empty.append(el('div', 'catalog-empty-icon'), emptyText, clear);
  const count = el('span', 'catalog-count');
  const note = el('div', 'panel-info');
  const list = el('div', 'card-grid');
  shell.body.append(searchRow, sortBar, note, list, empty);
  let sort: 'shelf' | 'cheap' | 'afford' = 'shelf';
  const SORTS = [
    ['shelf', 'Shelf'],
    ['cheap', 'Cheapest'],
    ['afford', 'I can afford'],
  ] as const;
  for (const [id, label] of SORTS) {
    const b = el('button', 'btn small sort-btn', label);
    b.type = 'button';
    b.dataset.sort = id;
    b.addEventListener('click', () => {
      sort = id;
      draw();
      applySort();
    });
    sortBar.appendChild(b);
  }
  sortBar.appendChild(count);
  /** Cards of the tab in the order they were made, with what sorting needs. */
  let made: { node: HTMLElement; price: number; owned: boolean; name: string }[] = [];

  let tab: CatalogTab = 'home';
  let gold = 0;
  let unlocked: readonly string[] = [];
  let room: Room | null = null;
  let packsData: PacksData = { gems: 0, unlocked: [], spares: {} };
  let ownedCounts: Readonly<Record<string, number>> = {};
  const markTab = tabBar(shell.tabs, TABS, (t) => {
    tab = t;
    draw();
    applySort();
    shell.body.scrollTop = 0;
  });

  /** One card: tag (or none), big icon, name, price. `owned` cards cannot be bought. */
  const card = (img: string, name: string, price: number, tag: string | null, owned: boolean, buy: () => void, rankId: string | null = null, own = 0): HTMLElement => {
    const c = el('button', `shop-card${owned ? ' owned' : gold < price ? ' poor' : ''}`);
    if (rankId !== null) setRank(c, rankId);
    c.type = 'button';
    const icon = el('img', 'shop-card-icon');
    icon.src = img;
    icon.alt = '';
    icon.draggable = false;
    c.append(icon, rankId === null ? el('span', 'shop-card-name', name) : rankName('span', 'shop-card-name', name, rankId), owned ? el('span', 'shop-card-owned', 'Owned') : priceTag(price, gold));
    if (!owned && gold < price) c.appendChild(el('span', 'shop-card-short', `Need ${price - gold} more`));
    if (own > 0 && !owned) c.appendChild(el('span', 'shop-card-own', `Own ${own}`));
    if (!owned) c.appendChild(el('span', 'shop-card-buy', gold < price ? 'Too dear' : 'Buy'));
    made.push({ node: c, price, owned, name });
    c.setAttribute('aria-label', owned ? `${name}, owned` : `${name}, ${price}`);
    if (tag) c.appendChild(el('span', 'shop-card-tag plate', tag));
    c.disabled = owned;
    c.addEventListener('click', buy);
    return c;
  };

  const furnitureCard = (t: FurnitureType): HTMLElement => {
    const fits = room === null || fitsRoomKind(t, room);
    return card(furnitureIconUrl(t.id), t.name, catalogPrice(t.id), fits ? null : t.placeIn === 'shop' ? 'Tavern only' : 'Not here', false, () => hooks.buyItem(t.id), t.id, ownedCounts[t.id] ?? 0);
  };

  const styleCard = (s: StyleType): HTMLElement =>
    card(stylePreviewUrl(s.kind, s.id), s.name, stylePrice(s), room?.kind === 'farm' || room?.kind === 'lakeside' ? 'Not here' : s.kind === 'floor' ? 'Floor' : 'Wall', unlocked.includes(styleKey(s.kind, s.id)), () =>
      hooks.buyStyle(s.kind, s.id),
    );

  const seedCard = (c: CropType): HTMLElement => card(materialIconUrl(c.seed), c.seedName, c.seedPrice ?? 0, null, false, () => hooks.buySeeds(c.seed), c.seed, ownedCounts[c.seed] ?? 0);

  const blockCard = (b: BlockType): HTMLElement => card(materialIconUrl(b.id), b.name, blockPrice(b.id), `${b.hardness} hit${b.hardness === 1 ? '' : 's'}`, false, () => hooks.buyBlock(b.id), b.id, ownedCounts[b.id] ?? 0);

  const hatCard = (id: string): HTMLElement => {
    const h = HATS.find((x) => x.id === id)!;
    return card(clothingIconUrl(id), h.name, hatCatalogPrice(id) ?? 0, 'Hat', packsData.unlocked.includes(id), () => hooks.buyHat(id), id);
  };

  const draw = (): void => {
    markTab(tab);
    list.replaceChildren();
    made = [];
    // The purse: what you can spend here (gems on the Packs tab, gold elsewhere), so a price is easy to judge.
    purse.replaceChildren(el('span', 'purse-label', 'Your purse'), tab === 'packs' ? gemImg() : pixelIcon('coin'), el('span', 'purse-amount', String(tab === 'packs' ? packsData.gems : gold)));
    sortBar.hidden = tab === 'packs';
    searchRow.hidden = tab === 'packs';
    for (const b of sortBar.children) b.classList.toggle('on', (b as HTMLElement).dataset.sort === sort);
    note.hidden = tab !== 'seeds' && tab !== 'blocks' && tab !== 'packs' && tab !== 'clothes';
    list.classList.toggle('pack-list', tab === 'packs');
    // RUN 5: a search looks through every tab but Packs, so a name is found wherever it is sold.
    if (tab !== 'packs' && search.value.trim() !== '') {
      note.hidden = true;
      for (const [t] of TABS) if (t !== 'packs') addCards(t);
      return;
    }
    if (tab === 'blocks') note.textContent = 'Select a block in the hotbar, tap a free cell to place it, tap a block to punch it. More kinds drop from punching.';
    if (tab === 'packs') note.textContent = 'Packs cost gems, which you only earn by playing. The odds and everything a pack can give are on its card. Duplicates are possible.';
    if (tab === 'seeds') note.textContent = `Plant seeds in the soil of your farm and punch them when grown. The glowcap spore (${getCropType('glowcap').name}) only drops in the dungeon.`;
    if (tab === 'clothes') note.textContent = 'Hats for your avatar: wear them in the Avatar panel. Rarer hats cannot be bought: find them while you play.';
    addCards(tab);
  };

  /** The cards of one tab, appended to the list. */
  const addCards = (t: CatalogTab): void => {
    if (t === 'blocks') for (const b of catalogBlocks()) list.appendChild(blockCard(b));
    else if (t === 'packs') drawPacks(list, packsData, { open: hooks.openPack });
    else if (t === 'seeds') for (const c of seedsForSale()) list.appendChild(seedCard(c));
    else if (t === 'clothes') for (const h of HATS.filter((x) => hatCatalogPrice(x.id) !== null)) list.appendChild(hatCard(h.id));
    else if (t === 'decor') for (const s of STYLE_TYPES.filter((x) => x.inCatalog)) list.appendChild(styleCard(s));
    else {
      const categories = t === 'home' ? ['home_furniture', 'suite_furniture'] : ['shop_furniture'];
      for (const f of catalogTypes().filter((x) => categories.includes(x.category))) list.appendChild(furnitureCard(f));
    }
  };

  /** Applies the chosen sort to the cards just made (Shelf keeps the data order). */
  const applySort = (): void => {
    const q = tab === 'packs' ? '' : search.value.trim().toLowerCase();
    let shown = 0;
    for (const m of made) {
      const hit = q === '' || m.name.toLowerCase().includes(q);
      m.node.hidden = !hit;
      if (hit) shown += 1;
    }
    emptyText.textContent = q === '' ? 'Nothing for sale here yet. More things come as you play.' : `Nothing matches "${search.value.trim()}".`;
    clear.hidden = q === '';
    empty.hidden = tab === 'packs' || shown > 0;
    count.textContent = made.length === 0 ? '' : q === '' ? `${made.length} things` : `${shown} of ${made.length}`;
    if (sort === 'shelf' || made.length === 0) return;
    const short = (price: number): number => Number(gold < price);
    const rows = [...made].sort((a, b) => Number(a.owned) - Number(b.owned) || (sort === 'cheap' ? a.price - b.price : short(a.price) - short(b.price) || b.price - a.price));
    for (const r of rows) list.appendChild(r.node);
  };

  return {
    el: shell.el,
    refresh(g, u, r, packs) {
      if (packs) {
        packsData = packs;
        ownedCounts = packs.owned ?? ownedCounts;
      }
      gold = g;
      unlocked = u;
      room = r;
      draw();
      applySort();
    },
  };
}
