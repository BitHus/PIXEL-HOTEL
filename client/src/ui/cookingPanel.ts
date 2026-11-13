// The Cooking panel (step 9b): opened by tapping the cooking pot on the farm. Same style as the
// Workshop's Crafting tab: one row per recipe (shared/data/food.json) with what it does, the
// ingredients with how many you have (short ones in red), how many you have cooked, and Cook
// (greyed out without all ingredients). Food stacks in the bag and goes into the dungeon in the
// lunch box (picked when you enter).

import { FOOD_TYPES, getMaterialType, type FoodEffect, type FoodType, type MaterialId, type Player } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';

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
  const panel = el('div', 'frame panel workshop-panel cooking-panel');
  const list = el('div', 'catalog-list');
  panel.append(el('h2', 'panel-title', 'Cooking pot'), list);
  parent.appendChild(panel);

  const row = (f: FoodType, p: Player): HTMLElement => {
    const r = el('div', 'catalog-row');
    const slot = el('div', 'slot');
    const img = el('img', 'slot-icon');
    img.src = materialIconUrl(f.id);
    img.alt = '';
    slot.appendChild(img);
    const needs = el('div', 'recipe-needs');
    let ok = true;
    for (const [id, n] of Object.entries(f.inputs) as [MaterialId, number][]) {
      const have = p.materials[id] ?? 0;
      if (have < n) ok = false;
      needs.append(el('span', have < n ? 'need short' : 'need', `${getMaterialType(id).name} ${have}/${n}`));
    }
    const owned = p.materials[f.id] ?? 0;
    const info = el('div', 'catalog-info');
    info.append(el('div', 'catalog-name', owned > 0 ? `${f.name} (${owned})` : f.name), el('div', 'catalog-sub', foodEffectText(f.effect)), needs);
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
