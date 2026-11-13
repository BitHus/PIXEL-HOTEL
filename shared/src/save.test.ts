import { describe, expect, it } from 'vitest';
import { readSave, saveKey, toSaveText } from './save.ts';
import { arrangeState, createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { SAVE_VERSION } from './config.ts';

const state = applyChange(createNewPlayer(undefined, 1), { reason: 'debug', addFurniture: ['chair', 'rug'] }, 2)!;

describe('save files', () => {
  it('saving then loading gives an identical state', () => {
    const loaded = readSave(toSaveText(state, 3));
    expect(loaded).toEqual({ ok: true, state, version: SAVE_VERSION, migrated: false });
  });
  it('uses a versioned key', () => {
    expect(saveKey()).toBe(`pixel-hotel.save.v${SAVE_VERSION}`);
  });
  it('refuses broken, foreign, newer and unmigratable older files', () => {
    expect(readSave('{nope')).toEqual({ ok: false, problem: 'bad_json' });
    expect(readSave('{"hello":1}')).toEqual({ ok: false, problem: 'not_a_save' });
    expect(readSave(JSON.stringify({ version: SAVE_VERSION + 1, state }))).toMatchObject({ ok: false, problem: 'too_new' });
    expect(readSave(JSON.stringify({ version: 0, state }))).toMatchObject({ ok: false, problem: 'too_old' });
    expect(readSave(JSON.stringify({ version: SAVE_VERSION, state: { ...state, hotbar: [] } }))).toMatchObject({
      ok: false,
      problem: 'invalid',
    });
    expect(readSave(JSON.stringify({ version: SAVE_VERSION, state: { ...state, bag: null } }))).toMatchObject({ problem: 'invalid' });
  });
  it('migrates a version 1 save (no bag layout) to an empty layout that arrangeState fills', () => {
    const { bag: _bag, ...v1 } = state;
    const r = readSave(JSON.stringify({ version: 1, savedAt: 0, state: v1 }));
    expect(r).toMatchObject({ ok: true, version: 1, migrated: true });
    if (!r.ok) return;
    expect(r.state.bag.furniture.every((s) => s === null)).toBe(true);
    const arranged = arrangeState(r.state);
    expect(arranged.bag.furniture.slice(0, 2)).toEqual(['chair', 'rug']);
    expect(arranged.bag.materials.slice(0, 2)).toEqual(['wood', 'cloth']);
  });
});
