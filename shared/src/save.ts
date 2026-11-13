// The save file (step 5): { version, savedAt, state } as JSON. The same text is written to
// storage and used for Export / Import. Old versions are migrated step by step with MIGRATIONS;
// a version without a migration path is refused ('too_old'), and the caller resets with a message.

import { HOTBAR_SLOTS, SAVE_KEY_PREFIX, SAVE_VERSION } from './config.ts';
import { emptyBag } from './bag.ts';
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
  if (!x.rooms.every((r) => isObject(r) && isInt(r.id) && (r.kind === 'hotel' || r.kind === 'shop'))) return false;
  if (!Array.isArray(x.items) || !x.items.every((i) => isObject(i) && isInt(i.uid) && typeof i.typeId === 'string')) return false;
  if (!Array.isArray(x.hotbar) || x.hotbar.length !== HOTBAR_SLOTS) return false;
  if (!x.hotbar.every((h) => h === null || typeof h === 'string')) return false;
  const bag = x.bag;
  if (!isObject(bag) || !isSlotList(bag.furniture) || !isSlotList(bag.materials)) return false;
  if (!isInt(x.currentRoomId) || !x.rooms.some((r) => isObject(r) && r.id === x.currentRoomId)) return false;
  return isInt(x.nextUid) && Array.isArray(x.ledger);
}

function isSlotList(x: unknown): boolean {
  return Array.isArray(x) && x.every((h) => h === null || typeof h === 'string');
}
