// The Cooking panel (step 9b): opened by tapping the cooking pot on the farm. Same style as the
// Workshop's Crafting tab: one row per recipe (shared/data/food.json) with what it does, the
// ingredients with how many you have (short ones in red), how many you have cooked, and Cook
// (greyed out without all ingredients). Food stacks in the bag and goes into the dungeon in the
// lunch box (picked when you enter).

import { rankName } from './rank.ts';
import { FOOD_TYPES, getMaterialType, type FoodEffect, type FoodType, type MaterialId, type Player } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';
import { iconBox, panelShell } from './panelShell.ts';

export interface CookingPanel {
  readonly el: HTMLElement;
  refresh(player: Player): void;
}

/** What a food does in the dungeon, in words. */
export function foodEffectText(e: FoodEffect): string {
  switch (e.kind) {
    case 'heal':
      return `Heals ${e.amount} hp.`;
    case 'attack':
      return `+${e.amount} attack for the rest of the run.`;
    case 'max_hp':
      return `+${e.amount} max hp for the rest of the run.`;
    case 'attack_cooldown':
      return `Faster hits (every ${e.amount} ms) for the rest of the run.`;
  }
}

export function createCookingPanel(parent: HTMLElement, cook: (food: FoodType) => void): CookingPanel {
  const shell = panelShell(parent, 'workshop-panel cooking-panel', 'Cooking pot');
  const panel = shell.el;
  const list = el('div', 'catalog-list');
  shell.body.append(list);

  const row = (f: FoodType, p: Player): HTMLElement => {
    const r = el('div', 'catalog-row');
    const slot = iconBox(materialIconUrl(f.id));
    const needs = el('div', 'recipe-needs');
    let ok = true;
    for (const [id, n] of Object.entries(f.inputs) as [MaterialId, number][]) {
      const have = p.materials[id] ?? 0;
      if (have < n) ok = false;
      needs.append(el('span', have < n ? 'need short' : 'need', `${getMaterialType(id).name} ${have}/${n}`));
    }
    const owned = p.materials[f.id] ?? 0;
    const info = el('div', 'catalog-info');
    info.append(rankName('div', 'catalog-name', owned > 0 ? `${f.name} (${owned})` : f.name, f.id), el('div', 'catalog-sub', foodEffectText(f.effect)), needs);
    const b = textButton('Cook', () => cook(f));
    b.disabled = !ok;
    r.append(slot, info, b);
    return r;
  };

  return {
    el: panel,
    refresh(p) {
      list.replaceChildren(
        el('div', 'panel-info', 'Cook crops from your farm. Take food into the dungeon in your lunch box (up to 3).'),
        ...FOOD_TYPES.map((f) => row(f, p)),
      );
    },
  };
}
