// The Cask panel (step K2b): opened by tapping a keg rack in the tavern. A rack has CASK_SLOTS slots; each is a card: a free slot lets you pick a
// brewed drink from the bag and a number of mugs (Fill), a ripening slot shows the drink, the mugs, a bar along the way to the top tier the rack allows (CEL-5: vintage, reserve in a level 2 cellar), the tier chip
// and Collect. Collecting early gives fresh mugs. Words and numbers: ui/caskText.ts (tested). Classes are the artist's (ui.css, ART-K2).

import { CASK_SLOTS, DRINK_TYPES, getDrinkType, getMaterialType, isBaseDrinkId, type BaseDrinkId, type Cask, type MaterialId } from '@pixel-hotel/shared';
import { CASK_EARLY_TEXT, CASK_HINT, caskSlotViews, caskStatusText, tierLabel, type CaskSlotView } from './caskText.ts';
import { el, textButton } from './dom.ts';
import { caskIconUrl } from './itemIcon.ts';
import { iconBox, panelShell } from './panelShell.ts';
import { rankName } from './rank.ts';

export interface CaskHooks {
  /** Put qty fresh mugs of a drink from the bag into a slot of the rack. */
  fill(rackUid: number, slot: number, drink: BaseDrinkId, qty: number): void;
  /** Collect a slot (the mugs at their current tier). */
  collect(rackUid: number, slot: number): void;
}

export interface CaskPanel {
  readonly el: HTMLElement;
  /** The rack the panel is about (set before showing it). */
  open(rackUid: number): void;
  readonly rackUid: number | null;
  /** The casks of the tavern and the bag (call when either changed). */
  update(casks: readonly Cask[], materials: Partial<Record<MaterialId, number>>, caps?: Readonly<Record<number, 'vintage' | 'reserve'>>, slots?: number): void;
  /** Moves the bars on (about once a second while the panel is open). */
  tick(): void;
}

export function createCaskPanel(parent: HTMLElement, hooks: CaskHooks, now: () => number = Date.now): CaskPanel {
  const shell = panelShell(parent, 'workshop-panel cask-panel', 'Keg rack');
  const list = el('div', 'catalog-list cask-list');
  shell.body.append(el('div', 'panel-info', CASK_HINT), list);
  let uid: number | null = null;
  let casks: readonly Cask[] = [];
  let caps: Readonly<Record<number, 'vintage' | 'reserve'>> = {};
  let slotCount: number = CASK_SLOTS;
  let materials: Partial<Record<MaterialId, number>> = {};
  /** What the player picked per free slot: the drink and the number of mugs. */
  const picked = new Map<number, { drink: BaseDrinkId; qty: number }>();

  const card = (v: CaskSlotView, rack: number): HTMLElement => {
    const row = el('div', `cask-card${v.cask ? '' : ' empty'}`);
    if (v.cask) {
      const d = getMaterialType(v.cask.drink);
      const head = el('div', 'tap-head');
      head.append(rankName('span', 'tap-name', `${v.cask.mugs} x ${d.name}`, v.cask.drink), el('span', `cask-tier tier-${v.tier}`, tierLabel(v.tier)));
      const bar = el('div', 'cask-bar');
      const fill = el('div', 'cask-fill');
      fill.style.setProperty('--fill-pct', `${Math.round(v.progress * 100)}%`);
      bar.append(fill);
      const actions = el('div', 'tap-actions');
      actions.append(el('div', 'catalog-sub', caskStatusText(v) + (v.tier === 'fresh' ? ` ${CASK_EARLY_TEXT}` : '')), textButton('Collect', () => hooks.collect(rack, v.slot)));
      row.append(iconBox(caskIconUrl(v.cask.drink, v.tier)), head, bar, actions);
      return row;
    }
    row.append(iconBox(caskIconUrl('root_ale', 'fresh'), 'dim'), el('div', 'tap-head', `Slot ${v.slot + 1}: free`));
    const options = DRINK_TYPES.filter((d): d is typeof d & { id: BaseDrinkId } => isBaseDrinkId(d.id) && (materials[d.id] ?? 0) > 0);
    if (options.length === 0) {
      row.append(el('div', 'catalog-sub', 'No brewed drink in your bag. Brew one at a barrel and collect it.'));
      return row;
    }
    const pick = picked.get(v.slot);
    const opt = options.find((d) => d.id === pick?.drink) ?? options[0]!;
    const max = Math.min(materials[opt.id] ?? 0, getDrinkType(opt.id).mugs);
    const qty = Math.min(max, Math.max(1, pick && pick.drink === opt.id ? pick.qty : max));
    const controls = el('div', 'tap-actions');
    if (options.length > 1) {
      const chips = el('div', 'tap-chips');
      for (const o of options) {
        chips.append(textButton(`${o.name} (${materials[o.id]})`, () => { picked.set(v.slot, { drink: o.id, qty: 99 }); draw(); }, o.id === opt.id ? 'on' : ''));
      }
      controls.append(chips);
    }
    const minus = textButton('-', () => { picked.set(v.slot, { drink: opt.id, qty: qty - 1 }); draw(); }, 'cook-step');
    const plus = textButton('+', () => { picked.set(v.slot, { drink: opt.id, qty: qty + 1 }); draw(); }, 'cook-step');
    minus.disabled = qty <= 1;
    plus.disabled = qty >= max;
    const step = el('div', 'menu-price');
    step.append(minus, el('span', 'menu-price-num', `${qty} mug${qty === 1 ? '' : 's'}`), plus);
    controls.append(step, textButton('Fill', () => { picked.delete(v.slot); hooks.fill(rack, v.slot, opt.id, qty); }));
    row.append(controls);
    return row;
  };

  const draw = (): void => {
    if (uid === null) {
      list.replaceChildren();
      return;
    }
    const rack = uid;
    list.replaceChildren(...caskSlotViews(casks, rack, now(), caps[rack] ?? 'vintage', slotCount).map((v) => card(v, rack)));
  };

  draw();
  return {
    el: shell.el,
    open(u) { uid = u; picked.clear(); draw(); },
    get rackUid() { return uid; },
    update(c, m, k = {}, n = CASK_SLOTS) { casks = c; materials = m; caps = k; slotCount = n; draw(); },
    tick() {
      // Only occupied cards change with time; free slots keep the player's picked number (a redraw keeps it in `picked`).
      if (casks.some((c) => c.rackUid === uid)) draw();
    },
  };
}
