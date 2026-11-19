// Test helpers for the tavern (not part of the game, not exported from the index).

import { SHOP_TICK_MS, TAVERN_START_ITEMS } from './config.ts';
import { getRoomShape, roomAtLevel, type Room } from './room.ts';
import { collectBrew } from './brewing.ts';
import { itemBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { deliverOrder, stepTavern, type TavernEvent, type TavernWorld } from './guests.ts';
import { buildNavGrid } from './nav.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { loadRoom, loadTap } from './taps.ts';
import { clearDish, collectCoins, openOrders, pourOrder, requestServe } from './tavern.ts';
import type { Facing, Rng } from './types.ts';

let gridFor: { items: GameState['items']; grid: TavernWorld['grid'] } | null = null;

/** The tavern world; the nav grid is only rebuilt when the items changed. */
export function tavernWorld(s: GameState, playerHere = true): TavernWorld {
  const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  if (gridFor?.items !== s.items) gridFor = { items: s.items, grid: buildNavGrid(room, itemBlockers(s.items, room.id)) };
  // TF: the rules tests of table guests run with bar guests off (guestsBar.test.ts turns them on itself).
  return { room, items: s.items, grid: gridFor.grid, playerHere, barGuests: false };
}

/**
 * The tavern start the rules tests were written with, before step S3: two stools at the round table (no third stool), an empty menu setting
 * (drinks on, dishes off). The real new game (3 seats, the early dish on, 7 mugs) is tested in newPlayer.test.ts and tavernStart.test.ts.
 */
/** CEL-2: a new game has its stove and barrel in the kitchen room; the rules tests of the tavern machines use the old layout (both back in the tavern at the shape's old spots). */
export function withTavernMachines(s: GameState): GameState {
  const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  const start = getRoomShape(room.shape).shopStart;
  return {
    ...s,
    items: s.items.map((i) => {
      if (i.typeId !== 'stove' && i.typeId !== 'brewing_barrel') return i;
      const at = start?.[i.typeId];
      const old = TAVERN_START_ITEMS.find((t) => t.typeId === i.typeId)!;
      return { ...i, roomId: room.id, x: at?.x ?? old.x, y: at?.y ?? old.y };
    }),
  };
}

/** A new game's tavern spots per shape on save 41 (before the modular bar and the kitchen above, 19 Nov): only the old-save tests use them. */
const SAVE41_START: Record<string, Record<'counter' | 'table' | 'stool_left' | 'stool_right' | 'stool_front' | 'brewing_barrel' | 'stove', [number, number]>> = {
  square_shop: { counter: [80, 256], table: [192, 288], stool_left: [144, 288], stool_right: [240, 288], stool_front: [208, 320], brewing_barrel: [48, 384], stove: [160, 384] },
  long: { counter: [80, 448], table: [192, 480], stool_left: [144, 480], stool_right: [240, 480], stool_front: [208, 512], brewing_barrel: [16, 640], stove: [96, 640] },
  l_shape: { counter: [80, 384], table: [192, 416], stool_left: [144, 416], stool_right: [240, 416], stool_front: [208, 448], brewing_barrel: [48, 512], stove: [160, 512] },
  plus: { counter: [80, 256], table: [192, 288], stool_left: [144, 288], stool_right: [240, 288], stool_front: [208, 320], brewing_barrel: [48, 384], stove: [128, 384] },
  wide_hall: { counter: [80, 192], table: [192, 224], stool_left: [144, 224], stool_right: [240, 224], stool_front: [208, 256], brewing_barrel: [48, 320], stove: [160, 320] },
};

/**
 * A new game as createNewPlayer made it on save 41 (the tests of OLD saves start from it): the tavern in the old geometry (no annexAbove, the kitchen annex
 * below), the 3-cell counter with the register and a tap stand (7 root ale on its first tap), the table with 3 stools, the barrel and the stove in the annex;
 * uids 1..9 in the old order.
 */
export function save41Start(shopShape = 'square_shop', at = 0): GameState {
  const base = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape }, at);
  const now = base.rooms.find((r) => r.id === base.tavern.roomId)!;
  const { annexAbove: _above, ...flat } = now;
  const room = roomAtLevel(flat as Room, now.level);
  const p = SAVE41_START[shopShape]!;
  const it = (uid: number, typeId: string, [x, y]: [number, number], facing: Facing = 'down', onItemUid: number | null = null): GameState['items'][number] => ({ uid, typeId, ownerId: base.player.id, roomId: room.id, x, y, facing, onItemUid });
  const items = [
    it(1, 'counter', p.counter),
    it(2, 'table', p.table),
    it(3, 'bar_stool', p.stool_left, 'right'),
    it(4, 'bar_stool', p.stool_right, 'left'),
    it(5, 'bar_stool', p.stool_front, 'up'),
    it(6, 'brewing_barrel', p.brewing_barrel),
    it(7, 'stove', p.stove),
    it(8, 'register', [p.counter[0] - 32, p.counter[1]], 'down', 1),
    it(9, 'tap_stand', p.counter, 'down', 1),
  ];
  const { bar: _b, chair: _c, ...seen } = base.player.seen;
  return {
    ...base,
    rooms: base.rooms.map((r) => (r.id === room.id ? room : r)),
    items,
    nextUid: 10,
    player: { ...base.player, seen: { ...seen, counter: seen.counter ?? { count: 1, firstSeenAt: at }, bar_stool: { count: 3, firstSeenAt: at } } },
    tavern: { ...base.tavern, taps: [{ ...base.tavern.taps[0]!, standUid: 9 }] },
  };
}

/**
 * The tavern the RULES tests were written against (before the compact start of 18 Nov and the modular bar + kitchen above of 19 Nov): an OLD-geometry
 * square tavern (no annexAbove: the kitchen annex below the main floor) with the old 3-cell counter at (80, 96) carrying the register and a tap stand, the
 * table at (448, 224) with two stools, the barrel and the stove in the annex below; uids 1..9 as a new game had them (the front stool, uid 5, is not there).
 * The rules are geometry-free (every bar piece is served from behind; the legacy counter is still a valid type until a save migrates), so these tests keep
 * checking the guests, taps and tray. The real new game (modular bar, kitchen above, 6 seats) is tested in newPlayer.test.ts, tavernStart.test.ts,
 * kitchenAnnex.test.ts and modularBar.test.ts.
 */
export function legacyStart(): GameState {
  const base = createNewPlayer(undefined, 0);
  const now = base.rooms.find((r) => r.id === base.tavern.roomId)!;
  const { annexAbove: _above, ...flat } = now;
  const room = roomAtLevel(flat as Room, now.level);
  const at = { ownerId: base.player.id, roomId: room.id, onItemUid: null, facing: 'down' as Facing };
  const items: GameState['items'] = [
    { uid: 1, typeId: 'counter', x: 80, y: 96, ...at },
    { uid: 2, typeId: 'table', x: 448, y: 224, ...at },
    { uid: 3, typeId: 'bar_stool', x: 400, y: 224, ...at, facing: 'right' },
    { uid: 4, typeId: 'bar_stool', x: 496, y: 224, ...at, facing: 'left' },
    { uid: 6, typeId: 'brewing_barrel', x: 48, y: 384, ...at },
    { uid: 7, typeId: 'stove', x: 160, y: 384, ...at },
    { uid: 8, typeId: 'register', x: 48, y: 96, ...at, onItemUid: 1 },
    { uid: 9, typeId: 'tap_stand', x: 80, y: 96, ...at, onItemUid: 1 },
  ];
  // The start barrel holds a ready brew again and the taps are empty (as before step T1: the ale is collected from the barrel).
  return { ...base, rooms: base.rooms.map((r) => (r.id === room.id ? room : r)), items, nextUid: 10, tavern: { ...base.tavern, menu: {}, taps: [], brews: [{ barrelUid: 6, drink: 'root_ale', readyAt: 0 }] } };
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
