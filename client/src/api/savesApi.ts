// LocalGameAPI helpers: saving tools. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  SAVE_BACKUP_KEY,
  createNewPlayer,
  peekSave,
  readSave,
  toSaveText,
} from '@pixel-hotel/shared';
import { type SaveResult } from './apiShared.ts';
import type { SavePeek, SaveProblem } from '@pixel-hotel/shared';
import type { SaveStorage } from './saveStorage.ts';
import type { LocalGameAPI } from './localGameAPI.ts';

export function problemMessage(problem: SaveProblem): string {
  switch (problem) {
    case 'bad_json':
    case 'not_a_save':
      return 'That is not a Pixel Hotel save file.';
    case 'too_new':
      return 'That save is from a newer version of the game.';
    case 'too_old':
      return 'That save is from an old version that cannot be updated.';
    case 'invalid':
      return 'That save file is damaged.';
  }
}

/**
 * The title screen's hook (UI round 4): is there a saved game to continue? Call it BEFORE LocalGameAPI.open (open always writes a save).
 * `canContinue` = the save reads and the character was made: show Continue (with playerName, innName, level, savedAt) and New game;
 * else show only New game. Choosing New game on an existing save: open the API, then api.newGame() (the old save becomes the backup).
 */
export function peekSavedGame(storage: SaveStorage): SavePeek {
  return peekSave((key) => storage.get(key));
}

export const savesApi = {
  exportSave(h: LocalGameAPI): string {
    return toSaveText(h.state, h.now());
  },

  importSave(h: LocalGameAPI, text: string): SaveResult {
    const r = readSave(text);
    if (!r.ok) return { ok: false, message: problemMessage(r.problem) };
    h.storage.set(SAVE_BACKUP_KEY, h.exportSave());
    h.commit(r.state);
    h.runPaused = r.state.run !== null;
    return { ok: true };
  },

  hasBackup(h: LocalGameAPI): boolean {
    const b = h.storage.get(SAVE_BACKUP_KEY);
    return b !== null && readSave(b).ok;
  },

  restoreBackup(h: LocalGameAPI): SaveResult {
    const b = h.storage.get(SAVE_BACKUP_KEY);
    const r = b !== null ? readSave(b) : null;
    if (!r) return { ok: false, message: 'There is no backup yet.' };
    if (!r.ok) return { ok: false, message: problemMessage(r.problem) };
    h.storage.set(SAVE_BACKUP_KEY, h.exportSave());
    h.commit(r.state);
    return { ok: true };
  },

  newGame(h: LocalGameAPI): void {
    h.storage.set(SAVE_BACKUP_KEY, h.exportSave());
    h.commit(createNewPlayer(undefined, h.now()));
    h.runPaused = false;
  },
};
