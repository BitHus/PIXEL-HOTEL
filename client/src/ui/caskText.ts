// Step K2b: the words and numbers of the Cask panel (pure, tested). The panel itself (caskPanel.ts) only draws them.

import { CASK_SLOTS, caskTier, ripenMinutes, type Cask, type CaskTier } from '@pixel-hotel/shared';
import { cookTimeText } from './cookingPanel.ts';

export const CASK_HINT = 'A cask ripens brewed mugs in real time, also while the game is closed. Aged and vintage mugs sell for more. Nothing is collected for you.';
export const CASK_EARLY_TEXT = 'Not ripe yet: collecting now gives fresh mugs again.';
export const CASK_OLD_SAVE_TOAST = 'Keg racks hold casks now: put brewed mugs in one to ripen them.';

/** What one slot of a rack shows. */
export interface CaskSlotView {
  slot: number;
  cask: Cask | null;
  tier: CaskTier;
  /** 0..1 along the way to vintage. */
  progress: number;
  /** ms to the next tier (0 when vintage or free). */
  nextInMs: number;
}

export function tierLabel(t: CaskTier): string {
  return t === 'fresh' ? 'Fresh' : t === 'aged' ? 'Aged' : 'Vintage';
}

/** The line under a slot's bar. */
export function caskStatusText(v: CaskSlotView): string {
  if (!v.cask) return 'Free slot.';
  if (v.tier === 'vintage') return 'Vintage: ready to collect.';
  const next = v.tier === 'fresh' ? 'aged' : 'vintage';
  return `${next === 'aged' ? 'Aged' : 'Vintage'} in ${cookTimeText(v.nextInMs)}.`;
}

/** The three (CASK_SLOTS) slots of one rack at time `at`, free ones too. */
export function caskSlotViews(casks: readonly Cask[], rackUid: number, at: number): CaskSlotView[] {
  const out: CaskSlotView[] = [];
  for (let slot = 0; slot < CASK_SLOTS; slot++) {
    const cask = casks.find((c) => c.rackUid === rackUid && c.slot === slot) ?? null;
    if (!cask) {
      out.push({ slot, cask: null, tier: 'fresh', progress: 0, nextInMs: 0 });
      continue;
    }
    const m = ripenMinutes(cask.drink);
    const elapsed = Math.max(0, at - cask.startedAt);
    const tier = caskTier(cask, at);
    const nextInMs = tier === 'vintage' ? 0 : (tier === 'fresh' ? m.aged : m.vintage) * 60_000 - elapsed;
    out.push({ slot, cask, tier, progress: Math.min(1, elapsed / (m.vintage * 60_000)), nextInMs });
  }
  return out;
}
