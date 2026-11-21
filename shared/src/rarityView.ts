// Rarity shown everywhere (OB-8 RARITY-UI, docs/PLAN-OB-REWORK.md section 2): one look per rank for drops on the ground,
// pickup popups, slots and names. Pure data from RANK_COLORS (palette indices) and RANK_NAMES; the client draws it.

import { RANK_COLORS } from './config.ts';
import { PALETTE } from './palette.ts';
import { RANK_NAMES, sparkles } from './ranks.ts';
import type { Rank } from './types.ts';

export interface RarityStyle {
  rank: Rank;
  /** The rank word ('Rare'). */
  label: string;
  /** Palette index and its hex (from RANK_COLORS). */
  colorIndex: number;
  color: string;
  /** Drop glow ring under a ground drop: 0 = none (common), 1 = soft, 2 = strong. */
  glow: 0 | 1 | 2;
  /** A light beam above the drop (ultra rare and legendary). */
  beam: boolean;
  /** The existing sparkle (ultra rare and legendary). */
  sparkle: boolean;
}

const GLOW: Record<Rank, 0 | 1 | 2> = { common: 0, rare: 1, ultra_rare: 2, legendary: 2 };

/** The rank word shown next to a name ('Common', 'Rare', 'Ultra rare', 'Legendary'). */
export function rarityLabel(rank: Rank): string {
  return RANK_NAMES[rank];
}

/** How a rank looks on a drop, a popup or a slot. */
export function rarityStyle(rank: Rank): RarityStyle {
  const colorIndex = RANK_COLORS[rank];
  return { rank, label: rarityLabel(rank), colorIndex, color: PALETTE[colorIndex] ?? '#000000', glow: GLOW[rank], beam: sparkles(rank), sparkle: sparkles(rank) };
}

/** A drop or popup text with the rank word for anything above common ('Iron ore' -> 'Iron ore (Rare)'). */
export function withRarity(text: string, rank: Rank): string {
  return rank === 'common' ? text : `${text} (${rarityLabel(rank)})`;
}
