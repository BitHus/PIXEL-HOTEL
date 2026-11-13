// The save file (step 5): { version, savedAt, state } as JSON. The same text is written to
// storage and used for Export / Import. Old versions are migrated step by step with MIGRATIONS;
// a version without a migration path is refused ('too_old'), and the caller resets with a message.

import { HOTBAR_SLOTS, SAVE_KEY_PREFIX, SAVE_VERSION, SHOP_START_ITEMS } from './config.ts';
import { canPlace, getFurnitureType } from './furniture.ts';
import { emptyBag } from './bag.ts';
import { addShopStartItems } from './newPlayer.ts';
import { emptyShop } from './shop.ts';
import type { Player } from './types.ts';
import type { GameState } from './gameState.ts';

export interface SaveFile {
  version: number;
  savedAt: number;
  state: GameState;
}

export type SaveProblem = 'bad_json' | 'not_a_save' | 'too_old' | 'too_new' | 'invalid';

export type LoadResult =
  | { ok: true; state: GameState; version: number; migrated: boolean }
  | { ok: false; problem: SaveProblem; version?: number };

/**
 * Migrations: MIGRATIONS[n] turns a version n state into a version n + 1 state. Add one each
 * time SAVE_VERSION goes up.
 */
export const MIGRATIONS: Record<number, (state: unknown) => unknown> = {
  // 1 -> 2: the bag got a slot layout. It starts empty; arrangeState fills it from the inventory.
  1: (state) => (isObject(state) ? { ...state, bag: emptyBag() } : state),
  // 2 -> 3 (step 7): the shop (empty, first customer 10 s after it gets stock), the hints, and the
  // shop's counter and stall_table (an old shop had none).
  2: (state) => {
    if (!isObject(state) || !isObject(state.player) || !Array.isArray(state.items) || !Array.isArray(state.rooms)) return state;
    const player = state.player as unknown as Player;
    const s = { ...state, shop: emptyShop(player.shopRoomId, 0), hintsDone: 0 } as unknown as GameState;
    try {
      return addShopStartItems(s);
    } catch {
      return state;
    }
  },
  // 3 -> 4: the counter moved away from the back wall, so the player can stand behind it. A counter
  // still on the old start spot moves to the new one when that is free.
  3: (state) => {
    if (!isObject(state) || !Array.isArray(state.items) || !Array.isArray(state.rooms)) return state;
    try {
      const s = state as unknown as GameState;
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId);
      const counter = s.items.find((i) => i.typeId === 'counter' && i.roomId === s.player.shopRoomId);
      const to = SHOP_START_ITEMS.find((i) => i.typeId === 'counter');
      if (!room || !counter || !to || counter.x !== 176 || counter.y !== 40 || counter.facing !== 'down') return state;
      const others = s.items.filter((i) => i.uid !== counter.uid);
      if (!canPlace(room, others, getFurnitureType('counter'), to.x, to.y, 'down')) return state;
      return { ...s, items: s.items.map((i) => (i.uid === counter.uid ? { ...i, x: to.x, y: to.y } : i)) };
    } catch {
      return state;
    }
  },
  // 4 -> 5 (step 7b): rooms get a shape (the old rectangle = 'square' / 'square_shop'), the look
  // gets clothing ids (the old look = short hair, long sleeves, trousers), unlockedClothing starts
  // empty.
  4: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms) || !isObject(state.look) || !isObject(state.player)) return state;
    const rooms = state.rooms.map((r) =>
      isObject(r) && typeof r.shape !== 'string' ? { ...r, shape: r.kind === 'shop' ? 'square_shop' : 'square' } : r,
    );
    const look = { ...state.look, hairStyle: 'short', top: 'long_sleeve', bottoms: 'trousers' };
    // A save that already has a player skips character creation and the intro.
    return { ...state, rooms, look, player: { ...state.player, unlockedClothing: [] }, playerCreated: true };
  },
  // 5 -> 6 (step 9): no dungeon run in progress.
  5: (state) => (isObject(state) ? { ...state, run: null } : state),
};

/** The storage key for a save version. */
export function saveKey(version = SAVE_VERSION): string {
  return `${SAVE_KEY_PREFIX}${version}`;
}

/** The save text for a state. */
export function toSaveText(state: GameState, savedAt: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt, state };
  return JSON.stringify(file);
}

/** Reads a save text: checks the version, migrates old ones, and checks the shape. */
export function readSave(text: string): LoadResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'bad_json' };
  }
  if (!isObject(file) || typeof file.version !== 'number' || !Number.isInteger(file.version) || !('state' in file)) {
    return { ok: false, problem: 'not_a_save' };
  }
  const version = file.version;
  if (version > SAVE_VERSION) return { ok: false, problem: 'too_new', version };
  let state: unknown = file.state;
  for (let v = version; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return { ok: false, problem: 'too_old', version };
    state = migrate(state);
  }
  if (!isGameState(state)) return { ok: false, problem: 'invalid', version };
  return { ok: true, state, version, migrated: version !== SAVE_VERSION };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

const isInt = (x: unknown): boolean => typeof x === 'number' && Number.isInteger(x);

/** A shape check of a loaded state (enough to catch a wrong or damaged file). */
export function isGameState(x: unknown): x is GameState {
  if (!isObject(x)) return false;
  const p = x.player;
  if (!isObject(p) || !isInt(p.id) || !isObject(p.wallet) || !isInt(p.wallet.gold) || !isObject(p.materials)) return false;
  if (!isObject(x.look) || !Array.isArray(x.rooms) || x.rooms.length === 0) return false;
  if (!x.rooms.every((r) => isObject(r) && isInt(r.id) && (r.kind === 'hotel' || r.kind === 'shop') && typeof r.shape === 'string')) return false;
  if (typeof x.look.hairStyle !== 'string' || typeof x.look.top !== 'string' || typeof x.look.bottoms !== 'string') return false;
  if (!Array.isArray(p.unlockedClothing) || typeof x.playerCreated !== 'boolean') return false;
  if (!Array.isArray(x.items) || !x.items.every((i) => isObject(i) && isInt(i.uid) && typeof i.typeId === 'string')) return false;
  if (!Array.isArray(x.hotbar) || x.hotbar.length !== HOTBAR_SLOTS) return false;
  if (!x.hotbar.every((h) => h === null || typeof h === 'string')) return false;
  const bag = x.bag;
  if (!isObject(bag) || !isSlotList(bag.furniture) || !isSlotList(bag.materials)) return false;
  if (!isInt(x.currentRoomId) || !x.rooms.some((r) => isObject(r) && r.id === x.currentRoomId)) return false;
  if (!isObject(x.shop) || !Array.isArray(x.shop.slots) || !Array.isArray(x.shop.customers) || !isObject(x.shop.saleHistory)) return false;
  if (typeof x.shop.nextCustomerInMs !== 'number' || typeof x.shop.updatedAt !== 'number' || !isInt(x.hintsDone)) return false;
  if (x.run !== null && !(isObject(x.run) && isObject(x.run.map) && isObject(x.run.player) && Array.isArray(x.run.enemies))) return false;
  return isInt(x.nextUid) && Array.isArray(x.ledger);
}

function isSlotList(x: unknown): boolean {
  return Array.isArray(x) && x.every((h) => h === null || typeof h === 'string');
}
