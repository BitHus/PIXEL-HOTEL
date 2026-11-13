// The Workshop (step 9, one button in the right-edge column, two tabs so the column stays short):
// - Crafting: the 7 recipes (shared/data/recipes.json). Each row: what it makes, the ingredients
//   with how many you have (short ones in red), and Craft (greyed out without all ingredients).
//   Furniture goes into the bag; a floor or wall is unlocked forever (then it shows "Owned").
// - Blacksmith: health potions (carry at most 3). Buying asks first (confirmBuy, in main.ts).
// - Forge (step 9c, docs/UI-REFERENCE.md "Mine"): smelting on the left (3 ore + a small fee -> 1
//   bar), the gear upgrade tree on the right: Sword, Armor and Pickaxe, each tier in a row, the
//   current tier highlighted, the next one with its bars and a Forge button. On a phone the two
//   parts stack.

import {
  FORGE,
  GEAR_PIECES,
  GEAR_TYPES,
    nextPiece,
  ownedPiece,
  type BarId,
  type GearPiece,
  type GearSlot,
  RECIPES,
  findStyle,
  getFurnitureType,
  getMaterialType,
  styleKey,
  type GearType,
  type MaterialId,
  type Player,
  type Recipe,
} from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export type WorkshopTab = 'crafting' | 'blacksmith' | 'forge';

export interface WorkshopHooks {
  craft(recipe: Recipe): void;
  buy(gear: GearType): void;
  smelt(bar: BarId): void;
  forge(piece: GearPiece): void;
}

export interface WorkshopPanel {
  readonly el: HTMLElement;
  refresh(player: Player): void;
}

const SLOT_ICON: Record<GearSlot, IconName> = { weapon: 'sword', armor: 'armor', pickaxe: 'hammer' };
const SLOT_NAME: Record<GearSlot, string> = { weapon: 'Sword', armor: 'Armor', pickaxe: 'Pickaxe' };
/** What you have before the first tier of each slot. */
const START_PIECE: Record<GearSlot, [string, string]> = {
  weapon: ['Starting sword', 'Hits for 4 to 6.'],
  armor: ['No armor', 'Every hit counts in full.'],
  pickaxe: ['Basic pickaxe', 'Mines copper and iron.'],
};

export function recipeName(r: Recipe): string {
  if (r.makesKind === 'furniture') return getFurnitureType(r.makes).name;
  return findStyle(r.makesKind, r.makes)?.name ?? r.makes;
}

export function gearEffect(g: GearType): string {
  return `Heals ${g.heal} hp at once (Q in the dungeon). Carry up to ${g.carryMax}.`;
}

/** What a forge piece does, in words. */
export function pieceEffect(g: GearPiece): string {
  if (g.slot === 'weapon') return `Hits for ${g.attackMin} to ${g.attackMax}.`;
  if (g.slot === 'armor') return `Every hit you take does ${g.damageReduction} less (at least ${g.minDamage}).`;
  return `Each swing counts ${g.hitsPerSwing}.${g.minesMithril ? ' Mines mithril.' : ''}`;
}

const barsText = (bars: GearPiece['bars']): [BarId, number][] => Object.entries(bars) as [BarId, number][];

export function createWorkshopPanel(parent: HTMLElement, hooks: WorkshopHooks): WorkshopPanel {
  const panel = el('div', 'frame panel workshop-panel');
  const tabs = el('div', 'tabs');
  const list = el('div', 'catalog-list');
  panel.append(el('h2', 'panel-title', 'Workshop'), tabs, list);
  parent.appendChild(panel);
  let tab: WorkshopTab = 'crafting';
  let player: Player | null = null;
  const tabButtons = (
    [
      ['crafting', 'Crafting'],
      ['blacksmith', 'Blacksmith'],
      ['forge', 'Forge'],
    ] as const
  ).map(([t, label]) => {
    const b = textButton(label, () => {
      tab = t;
      draw();
    }, 'tab');
    tabs.appendChild(b);
    return [t, b] as const;
  });

  const iconSlot = (content: HTMLElement | SVGSVGElement): HTMLElement => {
    const box = el('div', 'slot');
    box.appendChild(content);
    return box;
  };
  const img = (src: string): HTMLImageElement => {
    const i = el('img', 'slot-icon');
    i.src = src;
    i.alt = '';
    return i;
  };

  const recipeRow = (r: Recipe, p: Player): HTMLElement => {
    const row = el('div', 'catalog-row');
    const icon = r.makesKind === 'furniture' ? img(furnitureIconUrl(r.makes)) : img(stylePreviewUrl(r.makesKind, r.makes));
    const info = el('div', 'catalog-info');
    const kind = r.makesKind === 'furniture' ? 'Furniture' : r.makesKind === 'floor' ? 'Floor, yours forever' : 'Wall, yours forever';
    const needs = el('div', 'recipe-needs');
    let ok = true;
    for (const [id, n] of Object.entries(r.inputs) as [MaterialId, number][]) {
      const have = p.materials[id] ?? 0;
      if (have < n) ok = false;
      const part = el('span', have < n ? 'need short' : 'need', `${getMaterialType(id).name} ${have}/${n}`);
      needs.append(part);
    }
    info.append(el('div', 'catalog-name', recipeName(r)), el('div', 'catalog-sub', kind), needs);
    const owned = r.makesKind !== 'furniture' && p.unlockedStyles.includes(styleKey(r.makesKind, r.makes));
    const b = textButton(owned ? 'Owned' : 'Craft', () => hooks.craft(r));
    b.disabled = owned || !ok;
    row.append(iconSlot(icon), info, b);
    return row;
  };

  const gearRow = (g: GearType, p: Player): HTMLElement => {
    const row = el('div', 'catalog-row');
    const info = el('div', 'catalog-info');
    const price = el('span', 'catalog-price');
    price.append(pixelIcon('coin'), el('span', '', String(g.price)));
    info.append(el('div', 'catalog-name', g.name), el('div', 'catalog-sub', `${gearEffect(g)} You have ${p.potions}.`), price);
    const full = p.potions >= g.carryMax;
    const b = textButton(full ? 'Full' : 'Buy', () => hooks.buy(g));
    b.disabled = full || p.wallet.gold < g.price;
    row.append(iconSlot(pixelIcon('potion')), info, b);
    return row;
  };

  const smeltRow = (bar: BarId, p: Player): HTMLElement => {
    const r = FORGE.smelting.find((x) => x.bar === bar)!;
    const row = el('div', 'catalog-row');
    const have = p.materials[r.ore] ?? 0;
    const needs = el('div', 'recipe-needs');
    needs.append(el('span', have < FORGE.orePerBar ? 'need short' : 'need', `${getMaterialType(r.ore).name} ${have}/${FORGE.orePerBar}`));
    const fee = el('span', p.wallet.gold < r.fee ? 'need short catalog-price' : 'need catalog-price');
    fee.append(pixelIcon('coin'), el('span', '', String(r.fee)));
    needs.append(fee);
    const info = el('div', 'catalog-info');
    const bars = p.materials[r.bar] ?? 0;
    info.append(el('div', 'catalog-name', bars > 0 ? `${getMaterialType(r.bar).name} (${bars})` : getMaterialType(r.bar).name), needs);
    const b = textButton('Smelt', () => hooks.smelt(r.bar));
    b.disabled = have < FORGE.orePerBar || p.wallet.gold < r.fee;
    row.append(iconSlot(img(materialIconUrl(r.bar))), info, b);
    return row;
  };

  /** One slot's upgrade path: the start piece, then each tier; the current one highlighted. */
  const tree = (slot: GearSlot, p: Player): HTMLElement => {
    const box = el('div', 'forge-tree');
    const title = el('h3', 'forge-slot');
    title.append(pixelIcon(SLOT_ICON[slot]), el('span', '', SLOT_NAME[slot]));
    box.append(title);
    const current = ownedPiece(p.gear, slot);
    const next = nextPiece(p.gear, slot);
    const tiers = GEAR_PIECES.filter((g) => g.slot === slot);
    const currentIndex = current ? tiers.findIndex((g) => g.id === current.id) : -1;
    const start = el('div', `forge-tier${current === null ? ' current' : ' done'}`);
    start.append(el('div', 'catalog-name', START_PIECE[slot][0]), el('div', 'catalog-sub', START_PIECE[slot][1]));
    box.append(start);
    tiers.forEach((g, i) => {
      const state = i === currentIndex ? 'current' : i < currentIndex ? 'done' : g === next ? 'next' : 'locked';
      const t = el('div', `forge-tier ${state}`);
      const info = el('div', 'catalog-info');
      info.append(el('div', 'catalog-name', state === 'current' ? `${g.name} (yours)` : g.name), el('div', 'catalog-sub', pieceEffect(g)));
      if (state === 'next' || state === 'locked') {
        const needs = el('div', 'recipe-needs');
        for (const [bar, n] of barsText(g.bars)) {
          const have = p.materials[bar] ?? 0;
          needs.append(el('span', have < n ? 'need short' : 'need', `${getMaterialType(bar).name} ${have}/${n}`));
        }
        info.append(needs);
      }
      t.append(info);
      if (state === 'next') {
        const b = textButton('Forge', () => hooks.forge(g));
        b.disabled = !canFor(g, p);
        t.append(b);
      }
      box.append(t);
    });
    return box;
  };
  const canFor = (g: GearPiece, p: Player): boolean =>
    barsText(g.bars).every(([bar, n]) => (p.materials[bar] ?? 0) >= n) && nextPiece(p.gear, g.slot)?.id === g.id;

  const draw = (): void => {
    // The Forge has two columns on a wide screen.
    panel.classList.toggle('wide', tab === 'forge');
    for (const [t, b] of tabButtons) b.classList.toggle('on', t === tab);
    list.replaceChildren();
    const p = player;
    if (!p) return;
    if (tab === 'crafting') {
      list.append(el('div', 'panel-info', 'Make crypt furniture and styles from the materials you bring back.'));
      for (const r of RECIPES) list.append(recipeRow(r, p));
    } else if (tab === 'blacksmith') {
      list.append(el('div', 'panel-info', 'Potions go with you into the dungeon and the mine. Swords and armor are made at the Forge.'));
      for (const g of GEAR_TYPES) list.append(gearRow(g, p));
    } else {
      const grid = el('div', 'forge-grid');
      const smelting = el('div', 'forge-smelt');
      smelting.append(el('h3', '', 'Smelting'), el('div', 'panel-info', `${FORGE.orePerBar} ore and a small fee make 1 bar.`));
      for (const r of FORGE.smelting) smelting.append(smeltRow(r.bar, p));
      const upgrades = el('div', 'forge-upgrades');
      upgrades.append(el('h3', '', 'Gear'), el('div', 'panel-info', 'Each piece replaces the one before it. Gear is yours forever.'));
      for (const slot of ['weapon', 'armor', 'pickaxe'] as const) upgrades.append(tree(slot, p));
      grid.append(smelting, upgrades);
      list.append(grid);
    }
  };

  return {
    el: panel,
    refresh(p) {
      player = p;
      draw();
    },
  };
}
