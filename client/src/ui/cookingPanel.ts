// The Cooking panel (step K1): opened by tapping a stove in the tavern. A stove cooks ONE batch at a time (1 to
// STOVE_BATCH_MAX dishes of one recipe) in real time. Empty: pick how many dishes (the stepper), then Cook on a recipe
// row (shared/data/food.json: what it does, the crops with how many you have, short ones in red, how long it takes).
// Cooking: what is on the stove and the time left. Ready: Collect (the dishes never reach the bag by themselves).
// Dishes stack in the bag, go on the menu and the stall, and into the dungeon in the lunch box.

import { rankName } from './rank.ts';
import {
  FOOD_TYPES, STOVE_BATCH_MAX, cookMs, cookReadyInMs, getFoodType, getMaterialType, maxBatchWith,
  cookYield, type Cook, type FoodEffect, type FoodType, type MaterialId, type Player,
} from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';
import { iconBox, panelShell } from './panelShell.ts';

export interface CookingHooks {
  /** Start a batch of `qty` dishes on the open stove. */
  start(stoveUid: number, food: FoodType, qty: number): void;
  /** Collect the finished batch of the open stove. */
  collect(stoveUid: number): void;
}

export interface CookingPanel {
  readonly el: HTMLElement;
  /** The stove the panel is about (set before showing it), or null. */
  open(stoveUid: number): void;
  readonly stoveUid: number | null;
  refresh(player: Player): void;
  /** What cooks now (all stoves); call after anything changed. */
  setCooks(cooks: readonly Cook[]): void;
  /** The prep bonus of the open stove (step T1): extra dishes per batch from prep tables next to it in the kitchen zone. */
  setBonus(bonus: number): void;
  /** Counts the time down (call about once a second while the panel is open). */
  tick(): void;
}

/** A time left or needed as text: "20 s", "1 min", "2 min 5 s". */
export function cookTimeText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 === 0 ? `${m} min` : `${m} min ${s % 60} s`;
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

/** An ingredient chip: its picture and have/need; red when short (UI round 5). */
export function needChip(id: MaterialId, have: number, need: number): HTMLElement {
  const chip = el('span', have < need ? 'need short' : 'need');
  const img = el('img', 'need-icon');
  img.src = materialIconUrl(id);
  img.alt = '';
  chip.append(img, el('span', '', `${getMaterialType(id).name} ${have}/${need}`));
  return chip;
}

/** A progress bar drawn as a vessel (a pot or a tankard) that fills in stepped segments; icon sits at its left. */
export function vesselBar(kind: 'pot' | 'tankard', pct: number, icon: HTMLElement): HTMLElement {
  const v = el('div', `vessel ${kind}`);
  const track = el('div', 'vessel-track');
  const fill = el('div', 'vessel-fill');
  fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  track.append(fill);
  v.append(icon, track, el('span', 'vessel-pct', `${Math.round(pct)}%`));
  return v;
}

export function createCookingPanel(parent: HTMLElement, hooks: CookingHooks): CookingPanel {
  const shell = panelShell(parent, 'workshop-panel cooking-panel', 'Stove');
  const panel = shell.el;
  const top = el('div', 'cook-top');
  const list = el('div', 'catalog-list');
  shell.body.append(top, list);
  let uid: number | null = null;
  let player: Player | null = null;
  let cooks: readonly Cook[] = [];
  let qty = 1;
  let bonus = 0;

  const row = (f: FoodType, p: Player): HTMLElement => {
    const can0 = maxBatchWith(p.materials, f) >= 1;
    const r = el('div', `catalog-row recipe-card${can0 ? ' ready' : ' cant'}`);
    const slot = iconBox(materialIconUrl(f.id));
    const needs = el('div', 'recipe-needs');
    for (const [id, n] of Object.entries(f.inputs) as [MaterialId, number][]) {
      const have = p.materials[id] ?? 0;
      needs.append(needChip(id, have, n));
    }
    const owned = p.materials[f.id] ?? 0;
    const info = el('div', 'catalog-info');
    info.append(
      rankName('div', 'catalog-name', owned > 0 ? `${f.name} (${owned})` : f.name, f.id),
      el('div', 'catalog-sub', `${foodEffectText(f.effect)} Ready in ${cookTimeText(cookMs(f))}.`),
      needs,
    );
    const can = maxBatchWith(p.materials, f);
    const n = Math.min(qty, can);
    const b = textButton(n > 1 ? `Cook x${n}` : 'Cook', () => uid !== null && hooks.start(uid, f, n), can0 ? 'primary' : '');
    b.disabled = can < 1;
    r.append(slot, info, b);
    return r;
  };

  const render = (): void => {
    const mine = uid === null ? undefined : cooks.find((c) => c.stoveUid === uid);
    if (mine) {
      const food = getFoodType(mine.food);
      const left = cookReadyInMs(mine, Date.now());
      const box = el('div', `panel-info cook-state${left > 0 ? '' : ' ready'}`);
      box.append(el('div', 'catalog-name', `${cookYield(mine)} x ${food.name}`));
      if ((mine.bonus ?? 0) > 0) box.append(el('div', 'catalog-sub', `${mine.qty} from the crops and ${mine.bonus} from the prep table${mine.bonus === 1 ? '' : 's'}.`));
      if (left > 0) {
        const total = cookMs(food);
        box.append(vesselBar('pot', (1 - left / total) * 100, iconBox(materialIconUrl(food.id))), el('div', 'catalog-sub', `Cooking: ready in ${cookTimeText(left)}. It cooks while the game is closed too.`));
      } else {
        box.append(el('div', 'catalog-sub ready-text', 'Ready!'), textButton('Collect', () => uid !== null && hooks.collect(uid), 'primary collect-btn'));
      }
      top.replaceChildren(box);
      list.replaceChildren();
      return;
    }
    const step = el('div', 'panel-info cook-batch');
    const minus = textButton('-', () => { qty = Math.max(1, qty - 1); render(); }, 'cook-step');
    const plus = textButton('+', () => { qty = Math.min(STOVE_BATCH_MAX, qty + 1); render(); }, 'cook-step');
    minus.disabled = qty <= 1;
    plus.disabled = qty >= STOVE_BATCH_MAX;
    step.append(el('span', 'cook-qty-label', 'Dishes in this batch'), minus, el('span', 'cook-qty', bonus > 0 ? `${qty} + ${bonus}` : String(qty)), plus);
    top.replaceChildren(step, el('div', 'panel-info', bonus > 0 ? `Prep tables next to this stove add ${bonus} dish${bonus === 1 ? '' : 'es'} to every batch, free.` : 'A prep table next to a stove in the kitchen corner adds a dish to every batch (the kitchen is the warm tint while you place things).'), el('div', 'panel-info', `A stove cooks one batch at a time, up to ${STOVE_BATCH_MAX} dishes of one recipe. Nothing is collected for you: tap the stove when it is ready. Use crops from your bag; take dishes into the dungeon in your lunch box (up to 3), or serve them to guests.`));
    list.replaceChildren(...(player ? FOOD_TYPES.map((f) => row(f, player!)) : []));
  };

  return {
    el: panel,
    get stoveUid() { return uid; },
    open(u) { uid = u; render(); },
    refresh(p) { player = p; render(); },
    setCooks(c) { cooks = c; render(); },
    setBonus(b) { bonus = b; render(); },
    tick() { if (uid !== null && cooks.some((c) => c.stoveUid === uid)) render(); },
  };
}
