// The Menu panel (step 9t part C): opened by tapping the bar in play mode (when no guest or mess is on it). Two tabs:
//   Serve: the open orders (a guest's name-less row with the item's icon); a tap serves it (the existing serveGuest).
//   (The Sell tab of the trader is gone since 18 Nov: nothing is sold; gold comes from guests and the dungeon.)
//   Menu: every drink and dish the player owns or has set, each with an On/Off switch, a price stepper (- / +) and the stock;
//         out of stock = off the menu. The price hint (one of the four faces and a short line) sits under the price; the last
//         prices guests paid show beside it. An empty menu says how to fill it (brew, cook).
// The rules (step, switch, hint) are in shared/src/menuEdit.ts; this file only draws them.

import { EMPTY_MENU_HELP, MENU_HISTORY_LENGTH, TAP_CAP, isDrinkId, priceHint, priceCeiling, getMaterialType, type Guest, type MenuRowView, type MaterialId, type Tap } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { materialIconUrl } from './itemIcon.ts';
import { iconBox, panelShell, tabBar } from './panelShell.ts';
import { pixelIcon } from './pixelIcons.ts';
import { rankName } from './rank.ts';
import { TAPS_HINT, mugGauge } from './tapsPanel.ts';

export type MenuTab = 'serve' | 'menu';

export interface MenuHooks {
  /** Serve the order of this guest (the avatar fetches it). */
  serve(guestId: number): void;
  /** Switch a drink or dish on or off. */
  toggle(id: MaterialId, on: boolean): void;
  /** One tap of - (dir -1) or + (dir 1) on a price. */
  step(id: MaterialId, dir: 1 | -1): void;
  /** Open the Taps panel (step T1: drinks are served from the taps). */
  openTaps(): void;
}

export interface MenuPanel {
  readonly el: HTMLElement;
  /** The tab to show first when the panel opens. */
  setTab(tab: MenuTab): void;
  /** Redraw with the open orders (guests in phase 'order') and the menu rows. */
  update(orders: readonly Guest[], rows: readonly MenuRowView[], queued: readonly number[], taps?: readonly Tap[]): void;
}

/** A small picture for a gauge caption. */
function miniIcon(url: string): HTMLElement {
  const img = el('img', 'mini-icon');
  img.src = url;
  img.alt = '';
  return img;
}

export function createMenuPanel(parent: HTMLElement, hooks: MenuHooks): MenuPanel {
  const shell = panelShell(parent, 'workshop-panel menu-panel', 'Bar');
  const list = el('div', 'catalog-list');
  shell.body.append(list);
  let tab: MenuTab = 'serve';
  let orders: readonly Guest[] = [];
  let rows: readonly MenuRowView[] = [];
  let queued: readonly number[] = [];
  let taps: readonly Tap[] = [];
  const mark = tabBar(
    shell.tabs,
    [['serve', 'food', 'Serve'], ['menu', 'coin', 'Menu']] as const,
    (t) => {
      tab = t;
      draw();
      shell.body.scrollTop = 0;
    },
  );

  const serveRow = (g: Guest): HTMLElement => {
    const row = el('div', 'catalog-row');
    const item = g.order!.item;
    const taken = queued.includes(g.id);
    const info = el('div', 'catalog-info');
    info.append(rankName('div', 'catalog-name', getMaterialType(item).name, item), el('div', 'catalog-sub', g.warned ? 'Waiting a long time!' : 'Waiting at a table.'));
    const b = textButton(taken ? 'On the way' : 'Serve', () => hooks.serve(g.id));
    b.disabled = taken;
    row.append(iconBox(materialIconUrl(item)), info, b);
    return row;
  };

  const menuRow = (r: MenuRowView): HTMLElement => {
    const row = el('div', `catalog-row menu-row${r.on && r.stock > 0 ? '' : ' off'}`);
    const hint = priceHint(r.price, r.baseValue);
    const info = el('div', 'catalog-info');
    const price = el('div', 'menu-price');
    const minus = textButton('-', () => hooks.step(r.id, -1), 'cook-step');
    const plus = textButton('+', () => hooks.step(r.id, 1), 'cook-step');
    minus.disabled = r.price <= 1;
    plus.disabled = r.price >= priceCeiling(r.baseValue);
    const num = el('span', 'menu-price-num');
    num.append(pixelIcon('coin'), el('b', '', String(r.price)));
    num.title = `${r.price} gold`;
    price.append(minus, num, plus);
    const hintLine = el('div', 'catalog-sub menu-hint');
    hintLine.append(pixelIcon(hint.face), el('span', '', ` ${hint.text}`));
    const last = r.history.slice(-MENU_HISTORY_LENGTH);
    info.append(
      rankName('div', 'catalog-name', isDrinkId(r.id) ? `${getMaterialType(r.id).name} (${r.stock} on tap)` : `${getMaterialType(r.id).name} (${r.stock})`, r.id),
      ...(isDrinkId(r.id) ? [mugGauge(Math.min(r.stock, TAP_CAP))] : []),
      el('div', 'catalog-sub', r.stock === 0 ? (isDrinkId(r.id) ? 'Not on a tap: load it to serve it.' : 'Out of stock: it is off the menu until you have more.') : `Worth ${r.baseValue} gold.`),
      price,
      hintLine,
      el('div', 'catalog-sub', last.length > 0 ? `Guests paid: ${last.join(', ')}` : 'Nobody paid for it yet.'),
    );
    const sw = textButton(r.on ? 'On' : 'Off', () => hooks.toggle(r.id, !r.on), `menu-switch${r.on ? ' on' : ''}`);
    sw.setAttribute('aria-pressed', String(r.on));
    sw.setAttribute('aria-label', `${getMaterialType(r.id).name}: ${r.on ? 'on the menu' : 'off the menu'}`);
    sw.title = r.on ? 'On the menu (tap to switch off)' : 'Off the menu (tap to switch on)';
    row.append(iconBox(materialIconUrl(r.id)), info, sw);
    return row;
  };

  const draw = (): void => {
    mark(tab);
    if (tab === 'serve') {
      const open = orders.filter((g) => g.phase === 'order' && g.order);
      list.replaceChildren(
        ...(open.length > 0
          ? open.map(serveRow)
          : [el('div', 'panel-info', 'No orders right now. Guests sit down and order after a moment; you can also tap a guest or the bubble above them.')]),
      );
      return;
    }
    const empty = !rows.some((r) => r.on && r.stock > 0);
    // The taps at a glance (step T1): what each holds, and a way to the Taps panel.
    const levels = el('div', 'panel-info tap-levels');
    const gauges = el('div', 'tap-levels-list');
    if (taps.length === 0) gauges.append(el('div', '', TAPS_HINT));
    for (const t of taps) {
      const g = el('div', 'tap-levels-item');
      const name = el('span', 'tap-levels-name');
      name.append(miniIcon(materialIconUrl(t.drink)), el('span', '', getMaterialType(t.drink).name), el('b', '', `${t.mugs}/${TAP_CAP}`));
      g.append(name, mugGauge(t.mugs));
      gauges.append(g);
    }
    levels.append(gauges, textButton('Taps', () => hooks.openTaps(), 'tap-levels-open'));
    list.replaceChildren(
      levels,
      ...(empty ? [el('div', 'panel-info', EMPTY_MENU_HELP)] : [el('div', 'panel-info', 'Guests order what is on the menu and in stock. If a price is too high they take something cheaper, or nothing.')]),
      ...rows.map(menuRow),
    );
  };

  draw();
  return {
    el: shell.el,
    setTab(t) { tab = t; draw(); },
    update(o, r, q, t) { orders = o; rows = r; queued = q; if (t) taps = t; draw(); },
  };
}
