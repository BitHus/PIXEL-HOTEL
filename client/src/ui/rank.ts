// Rank colours in the UI (step 9e): the slot border and the name colour everywhere an item is
// shown. The colours come from config RANK_COLORS (palette indices) and are put on the UI root as
// CSS variables (--rank-common ...); ui.css uses them through the classes rank-<rank>.

import { PALETTE, RANKS, RANK_COLORS, rankOf, type Rank } from '@pixel-hotel/shared';

/** Puts the rank colours on the UI root (once, at start). */
export function applyRankColors(root: HTMLElement): void {
  for (const r of RANKS) root.style.setProperty(`--rank-${r}`, PALETTE[RANK_COLORS[r]] ?? '#000000');
}

export function rankClassOf(rank: Rank): string {
  return `rank-${rank}`;
}

/** Marks an element (a slot or a name) with the rank of an item id; null clears it. */
export function setRank(el: HTMLElement, id: string | null, rank: Rank | null = id === null ? null : rankOf(id)): void {
  for (const r of RANKS) el.classList.toggle(rankClassOf(r), r === rank);
}

/** A name in its rank colour. */
export function rankName(tag: 'div' | 'span', cls: string, text: string, id: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = `${cls} rank-name`.trim();
  e.textContent = text;
  setRank(e, id);
  return e;
}
