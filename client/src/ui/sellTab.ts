// The Sell tab of the bar's panel (step S2): what the player owns and the trader buys, one row each: picture, name, count, gold for one
// piece, and Sell 1 / Sell all. NEVER automatic: a row only sells when its button is tapped. The rules are in shared/src/trader.ts;
// whether a sale asks first (more than 5 pieces, ultra rare or legendary, a hotbar item) is decided by the caller with sellWarning.

import { SELL_CONFIRM_QTY, type MaterialId, type SellRow } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { clothingIconUrl, furnitureIconUrl, materialIconUrl } from './itemIcon.ts';
import { iconBox } from './panelShell.ts';
import { rankName } from './rank.ts';

export interface SellHooks {
  /** The player tapped Sell 1 (qty 1) or Sell all (qty = count) on this row. */
  sell(row: SellRow, qty: number): void;
}

export const SELL_EMPTY_HELP = 'Nothing to sell right now. Things you gather, dig, catch or find can be sold here when you do not need them.';
export const SELL_INTRO = 'Sell what you do not need. Nothing sells by itself; it only sells when you tap a button. Using a thing for cooking, brewing or crafting is worth more than selling it.';

export function sellRowIcon(r: SellRow): string {
  if (r.kind === 'furniture') return furnitureIconUrl(r.id, r.rank);
  if (r.kind === 'clothing') return clothingIconUrl(r.id);
  return materialIconUrl(r.id as MaterialId, r.rank);
}

/** One row of the tab. */
export function sellRow(r: SellRow, hooks: SellHooks): HTMLElement {
  const row = el('div', 'catalog-row sell-row');
  const info = el('div', 'catalog-info');
  info.append(rankName('div', 'catalog-name', `${r.name} (${r.count})`, r.id), el('div', 'catalog-sub', `${r.unit} gold each.${r.inHotbar ? ' It is in your hotbar.' : ''}`));
  const buttons = el('div', 'sell-buttons');
  buttons.append(textButton(r.count === 1 ? `Sell ${r.unit}` : 'Sell 1', () => hooks.sell(r, 1)));
  if (r.count > 1) buttons.append(textButton(`Sell all ${r.unit * r.count}`, () => hooks.sell(r, r.count)));
  row.append(iconBox(sellRowIcon(r)), info, buttons);
  return row;
}

/** The whole tab: a line of help, then the rows (or the empty text). */
export function sellTabContent(rows: readonly SellRow[], hooks: SellHooks): HTMLElement[] {
  if (rows.length === 0) return [el('div', 'panel-info', SELL_EMPTY_HELP)];
  return [el('div', 'panel-info', SELL_INTRO), ...rows.map((r) => sellRow(r, hooks))];
}

/** The line of the "Sell this?" question: why it asks (all the reasons that apply). */
export function sellDetail(r: Pick<SellRow, 'rank' | 'inHotbar' | 'unit'>, qty: number): string {
  const why: string[] = [];
  if (r.rank === 'ultra_rare' || r.rank === 'legendary') why.push('It is a very rare thing: you may want it for crafting.');
  if (r.inHotbar) why.push('It is in your hotbar.');
  if (qty > SELL_CONFIRM_QTY) why.push(`That is ${qty} pieces at once.`);
  return `${why.join(' ')} ${r.unit} gold each, and it cannot be undone.`.trim();
}
