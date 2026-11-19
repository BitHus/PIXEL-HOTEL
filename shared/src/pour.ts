// Hands-on pouring (step G2): hold the tap to fill the mug, release near full for a perfect pour. Pure rules; the drink is never lost.

import { POUR_HOLD_CAP_MS, POUR_MAX_FILL, POUR_TIP_RATE } from './config.ts';
import { pourFullMsOf, pourRangeOf } from './skillRules.ts';
import type { Bonuses } from './stats.ts';

/** The fill of the mug after `heldMs` of holding: 0..POUR_MAX_FILL, 1 = full. */
export function pourFill(heldMs: number, bonuses?: Bonuses): number {
  if (!Number.isFinite(heldMs) || heldMs <= 0) return 0;
  return Math.min(POUR_MAX_FILL, heldMs / pourFullMsOf(bonuses));
}

export type PourGrade = 'under' | 'perfect' | 'over';

export function pourGrade(heldMs: number, bonuses?: Bonuses): PourGrade {
  const f = pourFill(heldMs, bonuses);
  const [lo, hi] = pourRangeOf(bonuses);
  return f < lo ? 'under' : f > hi ? 'over' : 'perfect';
}

/** The extra coins for a perfect pour of an order priced `price` (0 otherwise). */
export function pourTip(perfect: boolean, price: number): number {
  return perfect ? Math.max(1, Math.round(price * POUR_TIP_RATE)) : 0;
}

/** A held time limited to the safety cap (and never negative or NaN). */
export function pourHeldClamp(heldMs: number): number {
  return Number.isFinite(heldMs) ? Math.min(POUR_HOLD_CAP_MS, Math.max(0, heldMs)) : 0;
}

/** Which tap of a stand a press uses: ok + slot, or why not ('other' = that tap holds another drink, 'empty' = no mugs there). */
export type PourPick = { ok: true; slot: number } | { ok: false; why: 'other'; drink: string } | { ok: false; why: 'empty' };

/**
 * The tap a press on a stand uses for the ordered `drink`. `side` is the tap the finger is nearest to (0 = left). The drink on exactly one
 * tap of the stand: that tap, wherever the press is. On both taps: the nearest one. On none: the pressed tap says what it holds (or that it is empty).
 */
export function pickPourTap(taps: readonly { standUid: number; slot: number; drink: string; mugs: number }[], standUid: number, drink: string, side: number): PourPick {
  const here = taps.filter((t) => t.standUid === standUid && t.mugs > 0);
  const match = here.filter((t) => t.drink === drink);
  if (match.length === 1) return { ok: true, slot: match[0]!.slot };
  if (match.length > 1) return { ok: true, slot: (match.find((t) => t.slot === side) ?? match[0]!).slot };
  const pressed = here.find((t) => t.slot === side) ?? here[0];
  return pressed ? { ok: false, why: 'other', drink: pressed.drink } : { ok: false, why: 'empty' };
}
