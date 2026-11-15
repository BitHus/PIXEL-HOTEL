// Test helpers for the tavern (not part of the game, not exported from the index).

import { SHOP_TICK_MS } from './config.ts';
import { collectBrew } from './brewing.ts';
import { itemBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { deliverOrder, stepTavern, type TavernEvent, type TavernWorld } from './guests.ts';
import { buildNavGrid } from './nav.ts';
import { createNewPlayer } from './newPlayer.ts';
import { clearDish, collectCoins, openOrders, pickUpOrder, requestServe } from './tavern.ts';
import type { Facing, Rng } from './types.ts';

let gridFor: { items: GameState['items']; grid: TavernWorld['grid'] } | null = null;

/** The tavern world; the nav grid is only rebuilt when the items changed. */
export function tavernWorld(s: GameState, playerHere = true): TavernWorld {
  const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  if (gridFor?.items !== s.items) gridFor = { items: s.items, grid: buildNavGrid(room, itemBlockers(s.items, room.id)) };
  return { room, items: s.items, grid: gridFor.grid, playerHere };
}

/** A new game whose start barrel was emptied: 6 root ale in the bag (on the menu at 9 gold). */
export function withAle(): GameState {
  const s = createNewPlayer(undefined, 0);
  return collectBrew(s, s.items.find((i) => i.typeId === 'brewing_barrel')!.uid, 0)!.state;
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
    const picked = asked && pickUpOrder(asked);
    s = (picked && deliverOrder(picked.state, rng)?.state) ?? s;
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
