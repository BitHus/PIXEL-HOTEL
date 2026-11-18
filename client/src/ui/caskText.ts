// Step K2b: the words and numbers of the Cask panel (pure, tested). The panel itself (caskPanel.ts) only draws them.

import { CASK_SLOTS, caskTier, nextTierInMs, ripenMinutes, type Cask, type CaskCap, type CaskTier } from '@pixel-hotel/shared';
import { cookTimeText } from './cookingPanel.ts';

export const CASK_HINT = 'A cask ripens brewed mugs in real time, also while the game is closed. Aged, vintage and (from a level 2 cellar) reserve mugs sell for more. Nothing is collected for you.';
/** CEL-6: shown as a locked chip on a rack that cannot reach reserve. */
export const CASK_RESERVE_LOCKED_TEXT = 'Reserve needs a cellar of level 2.';
export const CASK_EARLY_TEXT = 'Not ripe yet: collecting now gives fresh mugs again.';
export const CASK_OLD_SAVE_TOAST = 'Keg racks hold casks now: put brewed mugs in one to ripen them.';

/** What one slot of a rack shows. */
export interface CaskSlotView {
  slot: number;
  cask: Cask | null;
  tier: CaskTier;
  /** 0..1 along the way to the top tier the rack allows. */
  progress: number;
  /** ms to the next tier (0 when at the top or free). */
  nextInMs: number;
  /** The highest tier this rack gives. */
  cap: CaskCap;
}

export function tierLabel(t: CaskTier): string {
  return t === 'fresh' ? 'Fresh' : t === 'aged' ? 'Aged' : t === 'vintage' ? 'Vintage' : 'Reserve';
}

/** The line under a slot's bar. */
export function caskStatusText(v: CaskSlotView): string {
  if (!v.cask) return 'Free slot.';
  if (v.nextInMs === 0) return `${tierLabel(v.tier)}: ready to collect.`;
  const next: CaskTier = v.tier === 'fresh' ? 'aged' : v.tier === 'aged' ? 'vintage' : 'reserve';
  return `${tierLabel(next)} in ${cookTimeText(v.nextInMs)}.`;
}

/** The three (CASK_SLOTS) slots of one rack at time `at`, free ones too. */
export function caskSlotViews(casks: readonly Cask[], rackUid: number, at: number, cap: CaskCap = 'vintage', slots = CASK_SLOTS): CaskSlotView[] {
  const out: CaskSlotView[] = [];
  for (let slot = 0; slot < slots; slot++) {
    const cask = casks.find((c) => c.rackUid === rackUid && c.slot === slot) ?? null;
    if (!cask) {
      out.push({ slot, cask: null, tier: 'fresh', progress: 0, nextInMs: 0, cap });
      continue;
    }
    const m = ripenMinutes(cask.drink);
    const elapsed = Math.max(0, at - cask.startedAt);
    const tier = caskTier(cask, at, cap);
    out.push({ slot, cask, tier, progress: Math.min(1, elapsed / ((cap === 'reserve' ? m.reserve : m.vintage) * 60_000)), nextInMs: nextTierInMs(cask.drink, elapsed, cap), cap });
  }
  return out;
}
