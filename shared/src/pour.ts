// Hands-on pouring (step G2): hold the tap to fill the mug, release near full for a perfect pour. Pure rules; the drink is never lost.

import { POUR_FULL_MS, POUR_MAX_FILL, POUR_PERFECT_RANGE, POUR_TIP_RATE } from './config.ts';

/** The fill of the mug after `heldMs` of holding: 0..POUR_MAX_FILL, 1 = full. */
export function pourFill(heldMs: number): number {
  if (!Number.isFinite(heldMs) || heldMs <= 0) return 0;
  return Math.min(POUR_MAX_FILL, heldMs / POUR_FULL_MS);
}

export type PourGrade = 'under' | 'perfect' | 'over';

export function pourGrade(heldMs: number): PourGrade {
  const f = pourFill(heldMs);
  return f < POUR_PERFECT_RANGE[0] ? 'under' : f > POUR_PERFECT_RANGE[1] ? 'over' : 'perfect';
}

/** The extra coins for a perfect pour of an order priced `price` (0 otherwise). */
export function pourTip(perfect: boolean, price: number): number {
  return perfect ? Math.max(1, Math.round(price * POUR_TIP_RATE)) : 0;
}
