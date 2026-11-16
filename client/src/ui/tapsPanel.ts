// The Taps panel (step T1): opened by tapping a tap stand on the bar. Each tap of each stand shows its drink, the mugs left
// (of TAP_CAP) and a level bar. Load moves mugs of ONE drink from the bag onto the tap (a number with - / + or Fill); Unload gives
// them back. A drink is on the menu only while a tap holds it. The numbers come from shared/src/taps.ts (tapCards, tested).

import { TAP_CAP, getMaterialType, tapCards, type MaterialId, type Tap, type TapCard } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';
import { iconBox, panelShell } from './panelShell.ts';
import { rankName } from './rank.ts';

/** A row of TAP_CAP little mugs, the first `mugs` of them full (UI round 5). Low = the last few mugs, shown red. */
export function mugGauge(mugs: number, cap: number = TAP_CAP): HTMLElement {
  const g = el('div', 'mug-gauge' + (mugs > 0 && mugs <= TAP_LOW_MUGS ? ' low' : ''));
  g.setAttribute('role', 'img');
  g.setAttribute('aria-label', `${mugs} of ${cap} mugs`);
  for (let i = 0; i < cap; i++) g.append(el('i', i < mugs ? 'on' : ''));
  return g;
}

/** A tap with this many mugs or fewer shows the red level bar. */
const TAP_LOW_MUGS = 3;

export const TAPS_HINT = 'Load a tap with a brewed drink: guests can only order a drink that is on a tap.';
export const TAP_EMPTY_TEXT = 'Tap is empty';

export interface TapsHooks {
  /** Move qty mugs of a drink from the bag onto a tap. */
  load(standUid: number, slot: number, drink: MaterialId, qty: number): void;
  /** Give qty mugs (or all) back to the bag. */
  unload(standUid: number, slot: number, qty: number | 'all'): void;
}

export interface TapsPanel {
  readonly el: HTMLElement;
  /** The stands on the bar, the taps and the bag (call when any of them changed). */
  update(standUids: readonly number[], taps: readonly Tap[], materials: Partial<Record<MaterialId, number>>): void;
}

export function createTapsPanel(parent: HTMLElement, hooks: TapsHooks): TapsPanel {
  const shell = panelShell(parent, 'workshop-panel taps-panel', 'Taps');
  const list = el('div', 'catalog-list');
  shell.body.append(list);
  let stands: readonly number[] = [];
  let taps: readonly Tap[] = [];
  let materials: Partial<Record<MaterialId, number>> = {};
  /** What the player picked per tap: the drink and the number to load. */
  const picked = new Map<string, { drink: MaterialId; qty: number }>();

  const card = (c: TapCard, n: number): HTMLElement => {
    const key = `${c.standUid}:${c.slot}`;
    // The artist's classes (ui.css, ART-T1): .tap-row (+ .empty) > slot, .tap-head (.tap-name, .tap-count), .tap-level (+ .low) > .tap-fill (--fill-pct), .tap-actions.
    const row = el('div', `tap-row tap-card${c.mugs === 0 ? ' empty' : ''}`);
    const head = el('div', 'tap-head');
    const name = c.drink ? rankName('span', 'tap-name', `Tap ${n}: ${getMaterialType(c.drink).name}`, c.drink) : el('span', 'tap-name', `Tap ${n}: empty`);
    head.append(name, el('span', 'tap-count', `${c.mugs}/${TAP_CAP}`));
    const level = mugGauge(c.mugs);
    level.classList.add('tap-level-gauge');

    const controls = el('div', 'tap-controls tap-actions');
    controls.append(el('p', 'tap-hint', c.mugs > 0 ? `${c.mugs} of ${TAP_CAP} mugs left.` : `${TAP_EMPTY_TEXT}. A guest who wants this drink waits until you load it.`));
    // Load: the drink (an empty tap lets you choose), a number and the buttons.
    const opt = c.options.find((o) => o.drink === picked.get(key)?.drink) ?? c.options[0];
    if (opt) {
      const pick = picked.get(key);
      const qty = Math.min(opt.fits, Math.max(1, pick && pick.drink === opt.drink ? pick.qty : opt.fits));
      if (c.options.length > 1) {
        const chips = el('div', 'tap-chips');
        for (const o of c.options) {
          const chip = textButton(`${getMaterialType(o.drink).name} (${o.inBag})`, () => {
            picked.set(key, { drink: o.drink, qty: Math.min(o.fits, 12) });
            draw();
          }, o.drink === opt.drink ? 'on' : '');
          chips.append(chip);
        }
        controls.append(chips);
      }
      const minus = textButton('-', () => { picked.set(key, { drink: opt.drink, qty: qty - 1 }); draw(); }, 'cook-step');
      const plus = textButton('+', () => { picked.set(key, { drink: opt.drink, qty: qty + 1 }); draw(); }, 'cook-step');
      minus.disabled = qty <= 1;
      plus.disabled = qty >= opt.fits;
      const step = el('div', 'menu-price');
      step.append(minus, el('span', 'menu-price-num', `${qty} mug${qty === 1 ? '' : 's'}`), plus);
      const load = textButton('Load', () => { picked.delete(key); hooks.load(c.standUid, c.slot, opt.drink, qty); });
      const fillBtn = textButton('Fill', () => { picked.delete(key); hooks.load(c.standUid, c.slot, opt.drink, opt.fits); });
      controls.append(step, load, fillBtn);
    } else if (c.mugs < TAP_CAP) {
      controls.append(el('div', 'catalog-sub', c.mugs === 0 ? 'No brewed drink in your bag. Brew one at a barrel and collect it.' : 'No more of this drink in your bag.'));
    }
    if (c.mugs > 0) {
      controls.append(textButton('Unload 1', () => hooks.unload(c.standUid, c.slot, 1)), textButton('Unload all', () => hooks.unload(c.standUid, c.slot, 'all')));
    }
    row.append(iconBox(c.drink ? materialIconUrl(c.drink) : materialIconUrl('root_ale'), c.drink ? '' : 'dim'), head, level, controls);
    return row;
  };

  const draw = (): void => {
    const cards = tapCards(stands, taps, materials);
    if (cards.length === 0) {
      list.replaceChildren(el('div', 'panel-info', 'There is no tap stand on your bar. Buy one in the catalog (Tavern) and put it on the bar.'));
      return;
    }
    const perStand = new Map<number, number>();
    list.replaceChildren(
      el('div', 'panel-info', TAPS_HINT),
      ...cards.map((c) => {
        perStand.set(c.standUid, (perStand.get(c.standUid) ?? 0) + 1);
        const n = stands.indexOf(c.standUid) * (cards.length / stands.length) + perStand.get(c.standUid)!;
        return card(c, n);
      }),
    );
  };

  draw();
  return {
    el: shell.el,
    update(s, t, m) { stands = s; taps = t; materials = m; draw(); },
  };
}
