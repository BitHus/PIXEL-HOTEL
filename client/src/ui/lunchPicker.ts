// The lunch box picker (step 9b) in the dungeon's "Enter this?" panel: up to LUNCH_BOX_MAX food
// items for the run, next to the potions. The box's slots show what goes in (tap one to take it
// out); under it the food in the bag with counts (tap to put one in). Food not eaten comes home;
// after death it is lost.

import { FOOD_TYPES, LUNCH_BOX_MAX, getFoodType, type FoodId, type MaterialId } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { foodEffectText } from './cookingPanel.ts';
import { materialIconUrl } from './itemIcon.ts';

export interface LunchPicker {
  readonly el: HTMLElement;
  chosen(): FoodId[];
}

/** `max` = the box size (Pack lunch adds one: lunchBoxMaxOf(skills)). */
export function createLunchPicker(materials: Partial<Record<MaterialId, number>>, max: number = LUNCH_BOX_MAX): LunchPicker {
  const root = el('div', 'lunch-picker');
  const chosen: FoodId[] = [];
  const icon = (id: FoodId, count: number | null, onTap: () => void): HTMLElement => {
    const slot = el('div', 'slot');
    const img = el('img', 'slot-icon');
    img.src = materialIconUrl(id);
    img.alt = '';
    slot.append(img);
    if (count !== null) slot.append(el('span', 'slot-count', String(count)));
    const f = getFoodType(id);
    slot.title = `${f.name}: ${foodEffectText(f.effect)}`;
    slot.addEventListener('click', onTap);
    return slot;
  };
  const draw = (): void => {
    const owned = FOOD_TYPES.filter((f) => (materials[f.id] ?? 0) > 0);
    if (owned.length === 0) {
      root.replaceChildren(el('div', 'catalog-sub', 'Lunch box: no food yet. Cook on a stove in your tavern.'));
      return;
    }
    const box = el('div', 'lunch-box');
    for (let i = 0; i < max; i++) {
      const id = chosen[i];
      if (id) box.append(icon(id, null, () => (chosen.splice(i, 1), draw())));
      else box.append(el('div', 'slot empty'));
    }
    const left = el('div', 'lunch-food');
    for (const f of owned) {
      const n = (materials[f.id] ?? 0) - chosen.filter((c) => c === f.id).length;
      if (n <= 0) continue;
      left.append(
        icon(f.id, n, () => {
          if (chosen.length < max) chosen.push(f.id);
          draw();
        }),
      );
    }
    root.replaceChildren(el('div', 'catalog-name', `Lunch box (${chosen.length}/${max}): tap food to take it`), box, left);
  };
  draw();
  return { el: root, chosen: () => [...chosen] };
}
