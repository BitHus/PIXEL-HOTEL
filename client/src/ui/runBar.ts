// The run bag (step 9): in the dungeon it takes the hotbar's place at the bottom center. 12 slots
// (materials as stacks with a count, each furniture item in its own slot), the gold found on this
// run, and the potion button (also the Q key) with how many potions are left. Step 9b: the food
// button (also the E key) next to it eats from the lunch box, with how many are left. In the mine
// (step 9c) the food button is a Leave button (walk out now with everything); ore stacks in the bag.

import './runHud.css';
import { setRank } from './rank.ts';
import { RUN_BAG_SLOTS, getFoodType, getFurnitureType, getMaterialType, type DungeonRun } from '@pixel-hotel/shared';
import { el, iconButton, textButton, typing } from './dom.ts';
import { furnitureIconUrl, gemIconUrl, materialIconUrl } from './itemIcon.ts';
import { pixelIcon } from './pixelIcons.ts';
import { confirmBuy } from './confirmBuy.ts';

export interface RunBar {
  readonly el: HTMLElement;
  refresh(run: DungeonRun): void;
  setHidden(hidden: boolean): void;
}

export function createRunBar(parent: HTMLElement, onPotion: () => void, onEat: () => void, onLeave: () => void, onAbandon?: () => void): RunBar {
  const bar = el('div', 'frame run-bar');
  bar.hidden = true;
  const grid = el('div', 'run-slots');
  const slots: { root: HTMLElement; img: HTMLImageElement; count: HTMLElement }[] = [];
  for (let i = 0; i < RUN_BAG_SLOTS + 4; i++) { // MG-7: up to 4 more slots with the Satchel / Pack mule skills (hidden past the run's limit)
    const root = el('div', 'slot run-slot');
    const img = el('img', 'slot-icon');
    img.alt = '';
    img.draggable = false;
    const count = el('span', 'slot-count');
    root.append(img, count);
    grid.appendChild(root);
    slots.push({ root, img, count });
  }
  // The bag is a small pill (bag icon + used/12); a tap opens the 12 slots above it (a drawer), a second tap closes it.
  const bagBtn = el('button', 'run-bag-pill') as HTMLButtonElement;
  bagBtn.type = 'button';
  bagBtn.title = 'Run bag: tap to see what you carry';
  bagBtn.setAttribute('aria-expanded', 'false');
  const bagCount = el('span', 'run-bag-count', '0/12');
  bagBtn.append(pixelIcon('bag'), bagCount);
  const drawer = el('div', 'frame run-drawer');
  drawer.hidden = true;
  const lunchHint = el('div', 'run-hint');
  drawer.append(grid, lunchHint);
  bagBtn.addEventListener('click', () => {
    drawer.hidden = !drawer.hidden;
    bagBtn.classList.toggle('open', !drawer.hidden);
    bagBtn.setAttribute('aria-expanded', String(!drawer.hidden));
  });
  const side = el('div', 'run-side');
  const gold = el('div', 'run-gold');
  const goldText = el('span', '', '0');
  gold.append(pixelIcon('coin'), goldText);
  gold.title = 'Gold found on this run (half is lost if you die)';
  // The gems picked up on this run (step BG4): shown in the crypt and the mine; kept on Leave, half lost on death in the crypt.
  const gems = el('div', 'run-gold run-gems');
  const gemImg = el('img');
  gemImg.src = gemIconUrl();
  gemImg.alt = '';
  gemImg.draggable = false;
  const gemText = el('span', '', '0');
  gems.append(gemImg, gemText);
  gems.title = 'Gems found on this run (the crypt: half is lost if you die)';
  const potion = iconButton('potion', 'Drink a potion (Q)', onPotion, 'potion-btn');
  const potionCount = el('span', 'btn-badge', '0');
  potion.append(potionCount, el('span', 'key-hint', 'Q'));
  const food = iconButton('food', 'Eat from the lunch box (E)', onEat, 'potion-btn food-btn');
  const foodCount = el('span', 'btn-badge', '0');
  food.append(foodCount, el('span', 'key-hint', 'E'));
  const leave = textButton('Leave', onLeave, 'run-leave');
  leave.title = 'Walk out of the mine now, with everything';
  // Crypt: a clear Abandon button (only shown when the coder wires onAbandon). It always asks first.
  const abandon = textButton('Abandon', () => {
    void confirmBuy(parent, {
      name: 'Leave without the stairs',
      title: 'Abandon run?',
      detail: 'You leave the crypt now. Like a defeat, you lose half the gold you found on this run (and the bag). Your wallet and xp are safe. To keep everything, walk to the stairs and choose Leave.',
      price: null,
      noPrice: true,
      yes: 'Abandon',
    }).then((ok) => ok && onAbandon?.());
  }, 'run-leave run-abandon');
  abandon.title = 'Give up this run: half the run gold is lost';
  abandon.hidden = true;
  const buttons = el('div', 'run-buttons');
  buttons.append(potion, food, leave, abandon);
  side.append(gold, gems);
  bar.append(bagBtn, side, buttons, drawer);
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
      const limit = run.player.bagSlots ?? RUN_BAG_SLOTS;
      slots.forEach((s, i) => {
        s.root.hidden = i >= limit;
        const item = run.bag.slots[i];
        s.root.classList.toggle('empty', !item);
        setRank(s.root, !item ? null : item.kind === 'material' ? item.id : item.typeId);
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
      const used = run.bag.slots.filter(Boolean).length;
      bagCount.textContent = `${used}/${limit}`;
      bagBtn.classList.toggle('full', used >= limit);
      goldText.textContent = String(run.bag.gold);
      gemText.textContent = String(run.bag.gems);
      const p = run.player;
      potionCount.textContent = String(p.potions);
      potion.disabled = p.potions <= 0 || p.hp >= p.maxHp || run.status !== 'active';
      const mine = run.place === 'mine';
      food.hidden = mine;
      leave.hidden = !mine;
      abandon.hidden = mine || !onAbandon;
      abandon.disabled = run.status !== 'active';
      leave.disabled = run.status !== 'active';
      gold.hidden = mine;
      foodCount.textContent = String(p.food.length);
      food.disabled = p.food.length === 0 || run.status !== 'active';
      lunchHint.hidden = mine || p.food.length > 0;
      lunchHint.textContent = 'Lunch box empty: pack cooked food at the tavern door before a run.';
      food.classList.toggle('empty', p.food.length === 0);
      food.title = p.food.length === 0 ? 'The lunch box is empty: pack cooked food at the door next time' : `Eat (E): ${p.food.map((id) => getFoodType(id).name).join(', ')}`;
    },
    setHidden(hidden) {
      bar.hidden = hidden;
      if (hidden) {
        drawer.hidden = true;
        bagBtn.classList.remove('open');
      }
    },
  };
}
