// Rarity in the HTML UI (OB-8 RARITY-UI): one helper for the rank word in its rank colour, used by popups and slots.
// The colours are the --rank-<rank> CSS variables (ui/rank.ts applyRankColors, from RANK_COLORS); the words and the
// glow/beam levels come from shared/src/rarityView.ts. CSS for .rarity-chip is the ui/artist's (HOOK); without it the
// chip is a plain word in the rank colour (rank-name rank-<rank> classes already exist in ui.css).

import { rarityLabel, sparkles, withRarity, type Rank } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { rankClassOf } from './rank.ts';

/** A small word ('Rare') in the rank colour. */
export function rarityChip(rank: Rank): HTMLElement {
  const chip = el('span', `rarity-chip rank-name ${rankClassOf(rank)}`, rarityLabel(rank));
  chip.dataset.rank = rank;
  if (sparkles(rank)) chip.classList.add('rarity-sparkle');
  return chip;
}

/** Marks an element with its rarity for screen readers and hover ('Iron ore (Rare)'); common items keep just the name. */
export function markRarity(node: HTMLElement, name: string, rank: Rank): void {
  node.dataset.rank = rank;
  const label = withRarity(name, rank);
  node.setAttribute('aria-label', label);
  node.title = label;
}
