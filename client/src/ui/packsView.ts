// The Packs tab of the Catalog (step BG8): one card per pack with its picture, its gem price, how many things it gives,
// ALL the possible contents with the rank odds in percent (the fairness rule: the odds are shown before buying), and for
// clothes packs how many pieces are still missing (duplicates are possible). Below the cards: the player's spare pieces,
// each sold for gold with one tap. Rendering only: every number comes from shared/ (packOdds, piecesMissing, spareValue).

import { PACK_TYPES, RANK_NAMES, getClothing, packOdds, piecesMissing, spareValue, type PackItem, type PackType } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { clothingIconUrl, materialIconUrl, packIconUrl } from './itemIcon.ts';
import { iconBox, priceTag } from './panelShell.ts';
import { pixelIcon } from './pixelIcons.ts';
import { rankClassOf, rankName } from './rank.ts';
import type { MaterialId } from '@pixel-hotel/shared';

/** What the cards need to know about the player. */
export interface PacksData {
  gems: number;
  unlocked: readonly string[];
  spares: Readonly<Record<string, number>>;
}

export interface PacksHooks {
  /** Asks first (confirmBuy), then opens. */
  open(pack: PackType): void;
  /** Sells one spare piece. */
  sell(clothingId: string): void;
}

/** 88.2 -> "88.2", 80 -> "80", 0.5 -> "0.5". */
export function percentText(p: number): string {
  const r = Math.round(p * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

function itemImg(i: PackItem): string {
  return i.kind === 'clothing' ? clothingIconUrl(i.id) : materialIconUrl(i.id as MaterialId, i.rank);
}

function chip(i: PackItem, owned: boolean): HTMLElement {
  const c = el('span', `pack-chip ${rankClassOf(i.rank)}${owned ? ' owned' : ''}`);
  const img = el('img', 'pack-chip-icon');
  img.src = itemImg(i);
  img.alt = '';
  img.draggable = false;
  c.append(img, el('span', 'pack-chip-name', owned ? `${i.name} ✓` : i.name));
  return c;
}

function packCard(pack: PackType, d: PacksData, hooks: PacksHooks): HTMLElement {
  const card = el('div', 'pack-card inset');
  const head = el('div', 'pack-head');
  const info = el('div', 'pack-info');
  info.append(
    el('div', 'catalog-name', pack.name),
    el('div', 'catalog-sub', `Gives ${pack.rolls} things.`),
    priceTag(pack.gemPrice, d.gems, 'gems'),
  );
  head.append(iconBox(packIconUrl(pack.icon), 'pack-icon'), info);
  card.appendChild(head);

  const odds = el('div', 'pack-odds');
  for (const row of packOdds(pack)) {
    const line = el('div', 'pack-odds-row');
    const label = el('div', 'pack-odds-label');
    label.append(rankName('span', 'pack-rank', RANK_NAMES[row.rank], row.items[0]!.id), el('span', 'pack-percent', percentText(row.percent)));
    // The rank colour of the name comes from the first item of the rank (a piece of clothing or a material: same rank).
    line.append(label);
    const chips = el('div', 'pack-chips');
    for (const i of row.items) chips.appendChild(chip(i, i.kind === 'clothing' && d.unlocked.includes(i.id)));
    line.appendChild(chips);
    odds.appendChild(line);
  }
  card.appendChild(odds);

  const miss = piecesMissing({ unlockedClothing: [...d.unlocked] }, pack);
  if (miss.total > 0) {
    card.appendChild(el('div', 'catalog-sub pack-note', `You still miss ${miss.missing} of ${miss.total} pieces. Duplicates are possible: extra copies are kept as spares and sell for gold.`));
  }

  const short = pack.gemPrice - d.gems;
  const btn = textButton(short > 0 ? `Need ${short} more gem${short === 1 ? '' : 's'}` : `Open for ${pack.gemPrice} gems`, () => hooks.open(pack), 'pack-open');
  btn.disabled = short > 0;
  card.appendChild(btn);
  return card;
}

function spareRow(id: string, n: number, hooks: PacksHooks): HTMLElement {
  const c = getClothing(id)!;
  const row = el('div', 'pack-spare');
  const img = el('img', 'pack-chip-icon');
  img.src = clothingIconUrl(id);
  img.alt = '';
  img.draggable = false;
  const sell = textButton('', () => hooks.sell(id), 'pack-sell');
  sell.append(`Sell 1 for ${spareValue(id)}`, pixelIcon('coin'));
  row.append(img, rankName('span', 'pack-spare-name', `${c.name} ×${n}`, id), sell);
  return row;
}

/** Fills the Packs tab. */
export function drawPacks(list: HTMLElement, d: PacksData, hooks: PacksHooks): void {
  for (const pack of PACK_TYPES) list.appendChild(packCard(pack, d, hooks));
  const spares = Object.entries(d.spares).filter(([id, n]) => n > 0 && getClothing(id));
  const box = el('div', 'pack-card inset pack-spares');
  box.appendChild(el('div', 'catalog-name', 'Your spares'));
  if (spares.length === 0) {
    box.appendChild(el('div', 'catalog-sub', 'A piece of clothing a pack gives you twice is kept here as a spare. Spares sell for gold.'));
  } else {
    for (const [id, n] of spares) box.appendChild(spareRow(id, n, hooks));
  }
  list.appendChild(box);
}
