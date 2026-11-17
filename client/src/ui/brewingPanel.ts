// The Brewing panel (step 9t part C): opened by tapping a brewing barrel in the tavern. A barrel brews ONE drink at a time in
// real time (shared/data/drinks.json). Empty: one card per recipe (icon, name, the crops with what you own, short ones grey,
// time, mugs, value of one mug) and a Brew button. Brewing: the drink, a progress bar and the time left. Ready: Collect (the
// mugs never reach the bag by themselves). More barrels = more brews at once.

import { brewCards, brewMs, brewReadyInMs, getDrinkType, getMaterialType, type Brew, type BrewCard, type MaterialId } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';
import { helpFold, iconBox, panelShell, reasonLine } from './panelShell.ts';
import { rankName } from './rank.ts';
import { cookTimeText, needChip, shortText, vesselBar } from './cookingPanel.ts';

export interface BrewingHooks {
  /** Start a brew of `drink` in the open barrel. */
  start(barrelUid: number, drink: BrewCard['id']): void;
  /** Collect the finished brew of the open barrel. */
  collect(barrelUid: number): void;
}

export interface BrewingPanel {
  readonly el: HTMLElement;
  /** The barrel the panel is about (set before showing it). */
  open(barrelUid: number): void;
  readonly barrelUid: number | null;
  /** What the player owns (call after the bag changed). */
  refresh(materials: Partial<Record<MaterialId, number>>): void;
  /** What brews now (all barrels) and the clock they are read against. */
  setBrews(brews: readonly Brew[]): void;
  /** Counts the time down (about once a second while the panel is open). */
  tick(): void;
}

export function createBrewingPanel(parent: HTMLElement, hooks: BrewingHooks, now: () => number = Date.now): BrewingPanel {
  const shell = panelShell(parent, 'workshop-panel brewing-panel', 'Brewing barrel');
  const top = el('div', 'cook-top');
  const list = el('div', 'catalog-list');
  shell.body.append(top, list);
  let uid: number | null = null;
  let materials: Partial<Record<MaterialId, number>> = {};
  let brews: readonly Brew[] = [];

  const card = (c: BrewCard): HTMLElement => {
    const d = getDrinkType(c.id);
    const row = el('div', `catalog-row recipe-card${c.can ? ' ready' : ' cant'}`);
    const needs = el('div', 'recipe-needs');
    for (const i of c.inputs) needs.append(needChip(i.id, i.have, i.need));
    const info = el('div', 'catalog-info');
    const owned = materials[c.id] ?? 0;
    info.append(
      rankName('div', 'catalog-name', owned > 0 ? `${d.name} (${owned})` : d.name, c.id),
      el('div', 'catalog-sub', `${c.mugs} mugs, ${cookTimeText(brewMs(c.id))}. One mug is worth ${c.value} gold.${d.tip > 0 ? ' Guests tip extra.' : ''}`),
      needs,
    );
    const b = textButton('Brew', () => uid !== null && hooks.start(uid, c.id), c.can ? 'primary' : '');
    b.disabled = !c.can;
    row.append(iconBox(materialIconUrl(c.id)), info, b);
    if (!c.can) row.append(reasonLine(shortText(c.inputs)));
    return row;
  };

  const render = (): void => {
    const mine = uid === null ? undefined : brews.find((b) => b.barrelUid === uid);
    if (mine) {
      const d = getDrinkType(mine.drink);
      const left = brewReadyInMs(mine, now());
      const box = el('div', `panel-info cook-state${left > 0 ? '' : ' ready'}`);
      box.append(el('div', 'catalog-name', `${d.mugs} mugs of ${d.name}`));
      if (left > 0) {
        box.append(vesselBar('tankard', (1 - left / brewMs(mine.drink)) * 100, iconBox(materialIconUrl(mine.drink))), el('div', 'catalog-sub', `Brewing: ready in ${cookTimeText(left)}. It brews while the game is closed too.`));
      } else {
        box.append(el('div', 'catalog-sub ready-text', 'Ready!'), textButton('Collect', () => uid !== null && hooks.collect(uid), 'primary collect-btn'));
      }
      top.replaceChildren(box);
      list.replaceChildren();
      return;
    }
    top.replaceChildren(helpFold('A barrel brews one drink at a time. Nothing is collected for you: tap the barrel when it is ready. More barrels brew more at once. Put the mugs on the menu (tap the bar) so guests can order them.'));
    list.replaceChildren(...brewCards(materials).map(card));
  };

  return {
    el: shell.el,
    get barrelUid() { return uid; },
    open(u) { uid = u; render(); },
    refresh(m) { materials = m; render(); },
    setBrews(b) { brews = b; render(); },
    tick() { if (uid !== null && brews.some((b) => b.barrelUid === uid)) render(); },
  };
}
