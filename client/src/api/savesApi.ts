// LocalGameAPI helpers: saving tools. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  SAVE_BACKUP_KEY,
  createNewPlayer,
  readSave,
  toSaveText,
} from '@pixel-hotel/shared';
import { type SaveResult } from './apiShared.ts';
import type { SaveProblem } from '@pixel-hotel/shared';
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
