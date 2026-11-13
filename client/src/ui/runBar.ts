// The run bag (step 9): in the dungeon it takes the hotbar's place at the bottom center. 12 slots
// (materials as stacks with a count, each furniture item in its own slot), the gold found on this
// run, and the potion button (also the Q key) with how many potions are left. Step 9b: the food
// button (also the E key) next to it eats from the lunch box, with how many are left.

import { RUN_BAG_SLOTS, getFoodType, getFurnitureType, getMaterialType, type DungeonRun } from '@pixel-hotel/shared';
import { el, iconButton, typing } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface RunBar {
  readonly el: HTMLElement;
  refresh(run: DungeonRun): void;
  setHidden(hidden: boolean): void;
}

export function createRunBar(parent: HTMLElement, onPotion: () => void, onEat: () => void): RunBar {
  const bar = el('div', 'frame run-bar');
  bar.hidden = true;
  const grid = el('div', 'run-slots');
  const slots: { root: HTMLElement; img: HTMLImageElement; count: HTMLElement }[] = [];
  for (let i = 0; i < RUN_BAG_SLOTS; i++) {
    const root = el('div', 'slot run-slot');
    const img = el('img', 'slot-icon');
    img.alt = '';
    img.draggable = false;
    const count = el('span', 'slot-count');
    root.append(img, count);
    grid.appendChild(root);
    slots.push({ root, img, count });
  }
  const side = el('div', 'run-side');
  const gold = el('div', 'run-gold');
  const goldText = el('span', '', '0');
  gold.append(pixelIcon('coin'), goldText);
  gold.title = 'Gold found on this run (half is lost if you die)';
  const potion = iconButton('potion', 'Drink a potion (Q)', onPotion, 'potion-btn');
  const potionCount = el('span', 'btn-badge', '0');
  potion.appendChild(potionCount);
  const food = iconButton('food', 'Eat from the lunch box (E)', onEat, 'potion-btn food-btn');
  const foodCount = el('span', 'btn-badge', '0');
  food.appendChild(foodCount);
  side.append(gold, potion, food);
  bar.append(grid, side);
  parent.appendChild(bar);

  window.addEventListener('keydown', (e) => {
    if (bar.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    const k = e.key.toLowerCase();
    if (k !== 'q' && k !== 'e') return;
    e.preventDefault();
    if (k === 'q') onPotion();
    else onEat();
  });

  return {
    el: bar,
    refresh(run) {
      slots.forEach((s, i) => {
        const item = run.bag.slots[i];
        s.root.classList.toggle('empty', !item);
        s.img.hidden = !item;
        if (!item) {
          s.count.textContent = '';
          s.root.title = 'Empty';
          return;
        }
        if (item.kind === 'material') {
          s.img.src = materialIconUrl(item.id);
          s.count.textContent = item.qty > 1 ? String(item.qty) : '';
          s.root.title = `${getMaterialType(item.id).name} x${item.qty}`;
        } else {
          s.img.src = furnitureIconUrl(item.typeId);
          s.count.textContent = '';
          s.root.title = getFurnitureType(item.typeId).name;
        }
      });
      goldText.textContent = String(run.bag.gold);
      const p = run.player;
      potionCount.textContent = String(p.potions);
      potion.disabled = p.potions <= 0 || p.hp >= p.maxHp || run.status !== 'active';
      foodCount.textContent = String(p.food.length);
      food.disabled = p.food.length === 0 || run.status !== 'active';
      food.title = p.food.length === 0 ? 'The lunch box is empty' : `Eat (E): ${p.food.map((id) => getFoodType(id).name).join(', ')}`;
    },
    setHidden(hidden) {
      bar.hidden = hidden;
    },
  };
}
