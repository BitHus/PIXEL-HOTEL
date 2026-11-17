// SG5: the splice preview question. Two seed icons, "+", then the result icon (a found pair) or "?" (a new mix keeps its result hidden),
// the rank colour, the grow time, what it uses up, and Splice / Cancel. Built on ui/confirmBuy (same frame, Escape, tap outside).
// Lives in game/ (not ui/) while the ui worker owns client/src/ui; the CSS classes splice-row, splice-slot, splice-sign, splice-unknown,
// splice-rank, splice-extra are for the artist (SA1) to style.

import { RANK_NAMES, getMaterialType, isMaterialId, spliceDialogText, type SplicePreview } from '@pixel-hotel/shared';
import { confirmBuy } from '../ui/confirmBuy.ts';
import { el } from '../ui/dom.ts';
import { materialIconUrl } from '../ui/itemIcon.ts';
import { iconBox } from '../ui/panelShell.ts';
import { rankName, setRank } from '../ui/rank.ts';

const nameOf = (id: string): string => (isMaterialId(id) ? getMaterialType(id).name : id);

/** Asks about a splice; true = go ahead. Only call for a preview whose status is 'known' or 'new'. */
export async function askSplice(parent: HTMLElement, p: SplicePreview): Promise<boolean> {
  if (!p.uses) return false;
  const t = spliceDialogText(p);
  const [planted, hand] = p.uses;
  const row = el('div', 'splice-row');
  const seedSlot = (id: string): HTMLElement => {
    const s = iconBox(isMaterialId(id) ? materialIconUrl(id) : '', 'splice-slot');
    setRank(s, id);
    s.title = nameOf(id);
    return s;
  };
  const result = t.resultId ? seedSlot(t.resultId) : iconBox(el('span', 'splice-unknown', '?'), 'splice-slot');
  if (!t.resultId && t.rank) setRank(result, null, t.rank);
  row.append(seedSlot(planted), el('span', 'splice-sign', '+'), seedSlot(hand), el('span', 'splice-sign', '='), result);
  const extra = el('div', 'splice-extra');
  extra.append(row);
  if (t.rank) {
    const label = t.resultId ? rankName('div', 'splice-rank', `${nameOf(t.resultId)} (${RANK_NAMES[t.rank]})`, t.resultId) : el('div', 'splice-rank rank-name', `A ${RANK_NAMES[t.rank]} seed`);
    if (!t.resultId) setRank(label, null, t.rank);
    extra.append(label);
  }
  const ok = await confirmBuy(parent, {
    name: `${nameOf(planted)} + ${nameOf(hand)}`,
    detail: `Ready in ${t.growText}. Uses up 1 ${nameOf(hand)}. You get 1 new seed.`,
    price: null,
    yes: 'Splice',
    title: 'Splice these seeds?',
    extra,
  });
  return ok === true;
}
