// The Workshop (step 9, one button in the right-edge column, two tabs so the column stays short):
// - Crafting: the 7 recipes (shared/data/recipes.json). Each row: what it makes, the ingredients
//   with how many you have (short ones in red), and Craft (greyed out without all ingredients).
//   Furniture goes into the bag; a floor or wall is unlocked forever (then it shows "Owned").
// - Blacksmith: the iron sword and leather armor (bought once, kept forever) and health potions
//   (carry at most 3). Buying asks first (confirmBuy, in main.ts).

import {
  GEAR_TYPES,
  RECIPES,
  findStyle,
  getFurnitureType,
  getMaterialType,
  styleKey,
  type GearType,
  type MaterialId,
  type Player,
  type Recipe,
  type ShopGearId,
} from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { furnitureIconUrl } from './itemIcon.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export type WorkshopTab = 'crafting' | 'blacksmith';

export interface WorkshopHooks {
  craft(recipe: Recipe): void;
  buy(gear: GearType): void;
}

export interface WorkshopPanel {
  readonly el: HTMLElement;
  refresh(player: Player): void;
}

const GEAR_ICON: Record<ShopGearId, IconName> = { iron_sword: 'sword', leather_armor: 'armor', health_potion: 'potion' };

export function recipeName(r: Recipe): string {
  if (r.makesKind === 'furniture') return getFurnitureType(r.makes).name;
  return findStyle(r.makesKind, r.makes)?.name ?? r.makes;
}

export function gearEffect(g: GearType): string {
  if (g.kind === 'weapon') return `Hits for ${g.attackMin} to ${g.attackMax} (bare hands 4 to 6).`;
  if (g.kind === 'armor') return `Every hit you take does ${g.damageReduction} less (at least ${g.minDamage}).`;
  return `Heals ${g.heal} hp at once (Q in the dungeon). Carry up to ${g.carryMax}.`;
}

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
    const sub = g.kind === 'potion' ? `${gearEffect(g)} You have ${p.potions}.` : gearEffect(g);
    info.append(el('div', 'catalog-name', g.name), el('div', 'catalog-sub', sub), price);
    const owned = g.kind !== 'potion' && p.gear.includes(g.id);
    const full = g.kind === 'potion' && p.potions >= g.carryMax;
    const b = textButton(owned ? 'Owned' : full ? 'Full' : 'Buy', () => hooks.buy(g));
    b.disabled = owned || full || p.wallet.gold < g.price;
    row.append(iconSlot(pixelIcon(GEAR_ICON[g.id])), info, b);
    return row;
  };

  const draw = (): void => {
    for (const [t, b] of tabButtons) b.classList.toggle('on', t === tab);
    list.replaceChildren();
    const p = player;
    if (!p) return;
    if (tab === 'crafting') {
      list.append(el('div', 'panel-info', 'Make crypt furniture and styles from the materials you bring back.'));
      for (const r of RECIPES) list.append(recipeRow(r, p));
    } else {
      list.append(el('div', 'panel-info', 'Gear is yours forever. Potions go with you into the dungeon.'));
      for (const g of GEAR_TYPES) list.append(gearRow(g, p));
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
