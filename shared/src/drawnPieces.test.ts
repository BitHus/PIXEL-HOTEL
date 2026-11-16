// CH1: only drawn pieces are pickable; old looks map to the nearest drawn piece.
import { describe, expect, it } from 'vitest';
import { LOOK_COLORS, START_LOOK } from './config.ts';
import { CLOTHING, lookAllowed } from './clothing.ts';
import { DRAWN_PIECES, drawnLook, isDrawn, pickableClothing } from './drawnPieces.ts';
import { arrangeState, createNewPlayer } from './newPlayer.ts';
import type { AvatarLook } from './avatar.ts';

const old: AvatarLook = { skin: 30, hair: 5, hairStyle: 'mohawk', top: 'long_sleeve', shirt: 7, bottoms: 'skirt', legs: 23, shoes: 6 };

describe('drawn pieces', () => {
  it('every drawn piece is a real clothing piece of its slot', () => {
    for (const [slot, ids] of Object.entries(DRAWN_PIECES)) {
      for (const id of ids) {
        const c = CLOTHING.find((x) => x.id === id);
        expect(c, id).toBeDefined();
        expect(c!.slot).toBe(slot);
        
      }
    }
  });
  it('the pickers offer only drawn pieces, and a new player has at least one per slot', () => {
    for (const slot of ['hair', 'top', 'bottoms'] as const) {
      const list = pickableClothing(slot);
      expect(list.length, slot).toBeGreaterThan(0);
      for (const c of list) expect(isDrawn(slot, c.id)).toBe(true);
    }
    expect(pickableClothing('hat', ['straw_hat']).map((c) => c.id)).toContain('straw_hat');
  });
  it('maps an old look to drawn pieces and keeps colours', () => {
    const m = drawnLook(old);
    expect(m).toMatchObject({ hairStyle: 'short', top: 'tunic', bottoms: 'trousers', skin: 30, shirt: 7, legs: 23 });
    expect(drawnLook({ ...old, hairStyle: 'ponytail', top: 'vest' })).toMatchObject({ hairStyle: 'long', top: 'tunic' });
    expect(drawnLook({ ...old, top: 'jerkin' }).top).toBe('jerkin');
    expect(lookAllowed(m)).toBe(true);
  });
  it('leaves a drawn look alone (same object) and the start look is drawn', () => {
    const l = { ...START_LOOK } as AvatarLook;
    expect(drawnLook(l)).toBe(l);
    expect(isDrawn('top', START_LOOK.top)).toBe(true);
    expect(LOOK_COLORS.skin).toContain(START_LOOK.skin);
  });
  it('arrangeState (every load and commit) maps a saved look', () => {
    const s = createNewPlayer();
    expect(arrangeState({ ...s, look: old }).look).toMatchObject({ hairStyle: 'short', top: 'tunic', bottoms: 'trousers' });
  });
});
