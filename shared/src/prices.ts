// The price rule of the tavern's menu (brief section 9): a guest has a tolerance and orders when the
// price is at most baseValue * tolerance. Pure.

import { REACTION_BIG_SMILE_MAX, REACTION_SHRUG_MAX, SHOP_PRICE_MAX } from './config.ts';
import type { Reaction } from './types.ts';

/** A price is whole gold from 1 to SHOP_PRICE_MAX. */
export function validPrice(price: number): boolean {
  return Number.isInteger(price) && price >= 1 && price <= SHOP_PRICE_MAX;
}

export interface Decision {
  buy: boolean;
  reaction: Reaction;
}

/**
 * Buys if price <= baseValue * tolerance. Reactions: bought at price <= 0.7 * baseValue *
 * tolerance: big smile (too cheap); bought higher: smile; refused at price <= 1.15 * baseValue *
 * tolerance: shrug; refused higher: frown.
 */
export function decide(price: number, baseValue: number, tolerance: number): Decision {
  const limit = baseValue * tolerance;
  if (price <= limit) return { buy: true, reaction: price <= REACTION_BIG_SMILE_MAX * limit ? 'big_smile' : 'smile' };
  return { buy: false, reaction: price <= REACTION_SHRUG_MAX * limit ? 'shrug' : 'frown' };
}
