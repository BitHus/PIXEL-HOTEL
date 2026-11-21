// The Menu panel's rules (step 9t part C), pure: the price stepper, the On/Off switch, the price hint with its face, and
// the line that says how to fill an empty menu. The panel only shows what these return.

import { MENU_FACE_TOLERANCE, MENU_PRICE_MAX_MULT, MENU_PRICE_STEP } from './config.ts';
import type { GameState } from './gameState.ts';
import { menuEntry, menuRows, setMenu } from './tavern.ts';
import { decide } from './prices.ts';
import { getMaterialType } from './materials.ts';
import type { MaterialId, Reaction } from './types.ts';

/** How far one tap on + or - moves a price: 10% of the baseValue, at least 1. */
export function priceStep(baseValue: number): number {
  return Math.max(1, Math.round(baseValue * MENU_PRICE_STEP));
}

/** The highest price the stepper reaches. */
export function priceCeiling(baseValue: number): number {
  return Math.max(1, Math.ceil(baseValue * MENU_PRICE_MAX_MULT));
}

/** The price after one tap of + (dir 1) or - (dir -1), kept between 1 and the ceiling. */
export function stepPrice(price: number, baseValue: number, dir: 1 | -1): number {
  return Math.min(priceCeiling(baseValue), Math.max(1, price + dir * priceStep(baseValue)));
}

/** Flips a drink or dish on or off the menu. Null if it is not servable. */
export function toggleMenu(state: GameState, id: string): GameState | null {
  const on = menuRows(state).find((r) => r.id === id)?.on ?? menuEntry(state.tavern, id as MaterialId).on;
  return setMenu(state, id, { on: !on });
}

/** Moves a price one step (the same rule as stepPrice). Null if it is not servable. */
export function stepMenuPrice(state: GameState, id: string, dir: 1 | -1): GameState | null {
  const base = getMaterialType(id as MaterialId).baseValue;
  return setMenu(state, id, { price: stepPrice(menuEntry(state.tavern, id as MaterialId).price, base, dir) });
}

export interface PriceHint {
  /** The face an average guest makes at this price (the four faces of section 9). */
  face: Reaction;
  text: string;
}

/** What a price means to guests: the face of a guest with the middle tolerance, and one short line. */
export function priceHint(price: number, baseValue: number): PriceHint {
  const face = decide(price, baseValue, MENU_FACE_TOLERANCE).reaction;
  const text: Record<Reaction, string> = {
    big_smile: 'Very cheap: every guest takes it, but you give gold away.',
    smile: 'A fair price: most guests take it.',
    shrug: 'A bit high: some guests will not take it.',
    frown: 'Too high: most guests say no.',
  };
  return { face, text: text[face] };
}

/** True when no drink or dish can be ordered now (nothing on the menu in stock). */
export function menuIsEmpty(state: GameState): boolean {
  return !menuRows(state).some((r) => r.on && r.stock > 0);
}

/** The line the Menu panel shows when the menu is empty: how to fill it. */
export const EMPTY_MENU_HELP = 'Guests ask "Nothing to drink?". Brew a drink at a barrel and load it on a tap (tap the tap stand), or cook a dish at a stove and put it in the serving hatch (the food stash), then switch it on here.';
