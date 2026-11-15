// The Taps panel (step T1c): opened by tapping the tap stand on the bar (or the Taps button of the bar's Menu tab). Every tap of every tap
// stand is a row: the drink and its mugs (n / TAP_CAP), a level bar, and what you can do: Load (an empty tap offers each drink you
// carry; a tap that holds a drink takes more of THAT drink) and Unload (gives the mugs back to the bag). Guests only order a drink that
// stands on a tap. The rules are in shared/src/taps.ts; this file only draws them and calls the hooks. Classes: docs and ui.css (ART-T1).

import { DRINK_TYPES, TAPS_HINT, getDrinkType, type DrinkId, type MaterialId, type TapView } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { iconBox, panelShell } from './panelShell.ts';
import { rankName } from './rank.ts';

export interface TapsHooks {
  /** Move qty mugs of a drink from the bag into this tap. */
  load(standUid: number, slot: number, drink: DrinkId, qty: number): void;
  /** Give the mugs of this tap back to the bag (qty omitted = all). */
  unload(standUid: number, slot: number, qty?: number): void;
}

export interface TapsPanel {
  readonly el: HTMLElement;
  /** Redraw with every tap and what the player carries. */
  update(taps: readonly TapView[], materials: Partial<Record<MaterialId, number>>): void;
}

/** A tap with this many mugs or fewer shows the red level bar. */
const LOW_MUGS = 3;

export function createTapsPanel(parent: HTMLElement, hooks: TapsHooks): TapsPanel {
  const shell = panelShell(parent, 'workshop-panel taps-panel', 'Taps');
  const top = el('p', 'tap-hint', TAPS_HINT);
  const list = el('div', 'taps-list');
  shell.body.append(top, list);
  let taps: readonly TapView[] = [];
  let materials: Partial<Record<MaterialId, number>> = {};

  const bag = (id: string): number => materials[id as MaterialId] ?? 0;

  const row = (t: TapView, k: number, many: boolean): HTMLElement => {
    const empty = t.drink === null;
    const r = el('div', `tap-row${empty ? ' empty' : ''}`);
    const head = el('div', 'tap-head');
    const name = empty ? el('span', 'tap-name', many ? `Tap ${k + 1}: empty` : 'Empty tap') : rankName('span', 'tap-name', getDrinkType(t.drink!).name, t.drink!);
    head.append(name, el('span', 'tap-count', `${t.mugs}/${t.cap}`));
    const level = el('div', `tap-level${t.mugs > 0 && t.mugs <= LOW_MUGS ? ' low' : ''}`);
    const fill = el('div', 'tap-fill');
    fill.style.setProperty('--fill-pct', `${Math.round((t.mugs / t.cap) * 100)}%`);
    level.append(fill);
    const actions = el('div', 'tap-actions');
    if (empty) {
      const options = DRINK_TYPES.filter((d) => bag(d.id) > 0);
      for (const d of options) actions.append(textButton(`Load ${d.name} (${bag(d.id)})`, () => hooks.load(t.standUid, t.slot, d.id, Math.min(bag(d.id), t.cap))));
      if (options.length === 0) actions.append(el('span', 'tap-hint', 'No drinks in your bag. Brew some at the barrel.'));
    } else {
      const room = t.cap - t.mugs;
      const more = Math.min(bag(t.drink!), room);
      const one = textButton('+1', () => hooks.load(t.standUid, t.slot, t.drink!, 1));
      one.disabled = more < 1;
      const fillBtn = textButton(`Fill (${more})`, () => hooks.load(t.standUid, t.slot, t.drink!, more));
      fillBtn.disabled = more < 1;
      actions.append(one, fillBtn, textButton('Unload', () => hooks.unload(t.standUid, t.slot)));
    }
    r.append(iconBox(empty ? furnitureIconUrl('tap_stand') : materialIconUrl(t.drink!)), head, level, actions);
    return r;
  };

  const draw = (): void => {
    const stands = new Set(taps.map((t) => t.standUid)).size;
    if (taps.length === 0) {
      list.replaceChildren(el('div', 'panel-info', 'There is no tap stand on your bar. Buy one in the Catalog (Tavern) and put it on the bar.'));
      return;
    }
    list.replaceChildren(...taps.map((t, k) => row(t, k, taps.length > 1 || stands > 1)));
  };

  draw();
  return {
    el: shell.el,
    update(t, m) {
      taps = t;
      materials = m;
      draw();
    },
  };
}
