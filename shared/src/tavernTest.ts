// Test helpers for the tavern (not part of the game, not exported from the index).

import { SHOP_TICK_MS } from './config.ts';
import { collectBrew } from './brewing.ts';
import { itemBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { deliverOrder, stepTavern, type TavernEvent, type TavernWorld } from './guests.ts';
import { buildNavGrid } from './nav.ts';
import { createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { loadRoom, loadTap } from './taps.ts';
import { clearDish, collectCoins, openOrders, pourOrder, requestServe } from './tavern.ts';
import type { Facing, Rng } from './types.ts';

let gridFor: { items: GameState['items']; grid: TavernWorld['grid'] } | null = null;

/** The tavern world; the nav grid is only rebuilt when the items changed. */
export function tavernWorld(s: GameState, playerHere = true): TavernWorld {
  const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  if (gridFor?.items !== s.items) gridFor = { items: s.items, grid: buildNavGrid(room, itemBlockers(s.items, room.id)) };
  return { room, items: s.items, grid: gridFor.grid, playerHere };
}

/**
 * The tavern start the rules tests were written with, before step S3: two stools at the round table (no third stool), an empty menu setting
 * (drinks on, dishes off). The real new game (3 seats, the early dish on, 7 mugs) is tested in newPlayer.test.ts and tavernStart.test.ts.
 */
export function legacyStart(): GameState {
  const s = createNewPlayer(undefined, 0);
  const barStool = s.items.find((i) => i.typeId === 'bar_stool' && s.items.some((c) => c.typeId === 'round_table' && c.y + 32 === i.y))!; // the third (front) stool of the round table
  // The start barrel holds a ready brew again and the taps are empty (as before step T1: the ale is collected from the barrel).
  const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
  return { ...s, items: s.items.filter((i) => i.uid !== barStool.uid), tavern: { ...s.tavern, menu: {}, taps: [], brews: [{ barrelUid: barrel.uid, drink: 'root_ale', readyAt: 0 }] } };
}

/** The legacy start with its barrel emptied: 6 root ale LOADED ON THE FIRST TAP (on the menu at 9 gold; step T1). The start barrel gives 7 mugs; one goes back. */
export function withAle(): GameState {
  const s = legacyStart();
  const got = collectBrew(s, s.items.find((i) => i.typeId === 'brewing_barrel')!.uid, 0)!.state;
  const six = applyChange(got, { reason: 'debug', materials: { root_ale: -1 } }, 0)!;
  const stand = six.items.find((i) => i.typeId === 'tap_stand')!;
  return loadTap(six, stand.uid, 0, 'root_ale', 6, 0)!;
}

export function withItem(s: GameState, uid: number, typeId: string, x: number, y: number, facing: Facing = 'down'): GameState {
  return { ...s, items: [...s.items, { uid, typeId, ownerId: 1, roomId: s.tavern.roomId, x, y, facing, onItemUid: null }] };
}

/** A long table (4 x 1 cells: columns 1..4, row 7) with 3 stools above it: 3 more seats at one table (uids 50..53). */
export function withLongTable(s: GameState): GameState {
  s = withItem(s, 50, 'long_table', 96, 256);
  for (let k = 0; k < 3; k++) s = withItem(s, 51 + k, 'bar_stool', 48 + k * 32, 224);
  return s;
}

/** The player serves every open order at once (tap, pick up, put down). */
export function serveAll(s: GameState, rng: Rng): GameState {
  for (const g of openOrders(s.tavern)) {
    const asked = requestServe(s, g.id);
    const picked = asked && pourOrder(asked);
    s = (picked && !picked.empty && deliverOrder(picked.state, rng, g.id)?.state) || (picked ? picked.state : asked) || s;
  }
  return s;
}

/** Fills the first tap with root ale and the second with glowcap tonic from the bag, as far as the bag and TAP_CAP allow (the player keeps the taps full). */
export function refillTaps(s: GameState, at: number): GameState {
  const stand = s.items.find((i) => i.typeId === 'tap_stand' && i.roomId !== null);
  if (!stand) return s;
  for (const [slot, drink] of [[0, 'root_ale'], [1, 'glowcap_tonic']] as const) {
    const room = loadRoom(s, stand.uid, slot, drink);
    if (room > 0) s = loadTap(s, stand.uid, slot, drink, room, at) ?? s;
  }
  return s;
}

/** Steps the tavern from `from` for ms. `each` may change the state after every step. */
export function runTavern(
  s: GameState,
  from: number,
  ms: number,
  rng: Rng,
  playerHere = true,
  each?: (s: GameState, events: TavernEvent[], t: number) => GameState | void,
): GameState {
  for (let t = from + SHOP_TICK_MS; t <= from + ms; t += SHOP_TICK_MS) {
    const r = stepTavern(s, tavernWorld(s, playerHere), SHOP_TICK_MS, rng, t);
    s = each?.(r.state, r.events, t) ?? r.state;
  }
  return s;
}

/** The player takes all coins and clears all dishes. */
export function tidy(s: GameState, at: number): GameState {
  for (const m of s.tavern.mess) {
    s = collectCoins(s, m.id, at)?.state ?? s;
    s = clearDish(s, m.id) ?? s;
  }
  return s;
}
