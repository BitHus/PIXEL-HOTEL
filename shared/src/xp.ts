// SK-2 (docs/PLAN-SKILLTREE.md 2.1): xp from every loop. One event list, one table (shared/data/xp.json), one function that adds it. Pure; xp is never
// lost and the level never goes above MAX_LEVEL (levels.ts addXp). Crypt kills keep their own path (dungeon/step.ts kill -> run.xpGained -> bank).

import xpData from '../data/xp.json';
import type { GameState } from './gameState.ts';
import { addXp } from './levels.ts';
import type { Rank } from './types.ts';

export type XpEvent =
  /** A drink or dish handed to a guest (a perfect pour adds perfectPour). */
  | { t: 'order'; perfect?: boolean }
  | { t: 'brew' }
  | { t: 'cook'; dishes: number }
  | { t: 'harvest'; rank: Rank }
  /** The first time a splice result seed is made. */
  | { t: 'splice_first' }
  | { t: 'fish'; rank: Rank }
  | { t: 'tree' }
  /** Mine: ore dug (per piece), a rare block broken, the exit reached. */
  | { t: 'ore'; qty: number }
  | { t: 'rare_block' }
  | { t: 'mine_exit' }
  /** Crypt: a floor's exit reached (go deeper or leave). */
  | { t: 'floor_exit' }
  /** New Book entries (first time an id is seen). */
  | { t: 'book_entry'; count: number }
  /** A quest or achievement reward taken. */
  | { t: 'claim' };

export const XP_TABLE = xpData;

/** The xp one event gives (0 or more, whole). */
export function xpFor(e: XpEvent): number {
  const x = XP_TABLE;
  switch (e.t) {
    case 'order':
      return x.order + (e.perfect ? x.perfectPour : 0);
    case 'brew':
      return x.brew;
    case 'cook':
      return x.cookPerDish * Math.max(0, Math.floor(e.dishes));
    case 'harvest':
      return x.harvest[e.rank];
    case 'splice_first':
      return x.spliceFirst;
    case 'fish':
      return x.fish[e.rank];
    case 'tree':
      return x.tree;
    case 'ore':
      return x.ore * Math.max(0, Math.floor(e.qty));
    case 'rare_block':
      return x.rareBlock;
    case 'mine_exit':
      return x.mineExit;
    case 'floor_exit':
      return x.floorExit;
    case 'book_entry':
      return x.bookEntry * Math.max(0, Math.floor(e.count));
    case 'claim':
      return x.claim;
  }
}

/** Adds the xp of an event to the player (a level up happens by itself; `at` is kept for the server log later). */
export function grantXp(state: GameState, e: XpEvent, _at: number): GameState {
  const n = xpFor(e);
  return n > 0 ? { ...state, player: addXp(state.player, n) } : state;
}
