// Migration 40 -> 41 (owner 19 Nov): the stove is a 2 x 1 range; old one-cell stoves are placed validly, else the bag.
import { describe, expect, it } from 'vitest';
import { canPlace, getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { readSave } from './save.ts';
import { widenStoves } from './stoveWide.ts';
import { withItem } from './tavernTest.ts';

const stoveType = getFurnitureType('stove');

function save40(mutate: (s: GameState) => GameState = (s) => s, shape = 'square_shop'): GameState {
  const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape }, 0);
  // An old stove stood on ONE cell: x = the cell's centre (144 = cell 4).
  const old = { ...s, items: s.items.map((i) => (i.typeId === 'stove' ? { ...i, x: 144, y: 384 } : i)) };
  const r = readSave(JSON.stringify({ version: 40, savedAt: 1, state: mutate(old) }));
  if (!r.ok) throw new Error(r.problem);
  return r.state;
}

describe('stove 2 x 1 (save 40 -> 41)', () => {
  it('the stove is 64 x 32', () => {
    expect(stoveType.w).toBe(64);
    expect(stoveType.d).toBe(32);
  });

  it('an old stove keeps its cell and grows to the right, on a valid pose; nothing else moves', () => {
    const s = save40();
    const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    expect(stove).toMatchObject({ x: 160, y: 384, roomId: room.id });
    expect(canPlace(room, s.items.filter((i) => i.uid !== stove.uid), stoveType, stove.x, stove.y, stove.facing)).toBe(true);
  });

  it('grows to the left when the right neighbour is taken', () => {
    const s = save40((st) => withItem(st, 90, 'bar_stool', 176, 384));
    expect(s.items.find((i) => i.typeId === 'stove')).toMatchObject({ x: 128, y: 384 });
    expect(s.items.find((i) => i.uid === 90)).toMatchObject({ x: 176, y: 384 });
  });

  it('goes to the nearest free cell, else the bag, when both sides are taken', () => {
    const s = save40((st) => withItem(withItem(st, 90, 'bar_stool', 176, 384), 91, 'bar_stool', 112, 384));
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    expect(stove.roomId).toBe(room.id);
    expect(canPlace(room, s.items.filter((i) => i.uid !== stove.uid), stoveType, stove.x, stove.y, stove.facing)).toBe(true);
    // widenStoves on a room with no space at all puts the stove in the bag.
    const crammed: GameState = { ...s, rooms: s.rooms.map((r) => (r.id === room.id ? { ...r, w: 32, h: 32 } : r)) };
    expect(widenStoves(crammed).items.some((i) => i.typeId === 'stove' && i.roomId !== null)).toBe(false);
  });

  it('a stove already on a valid 2-cell pose is left alone (running the step twice changes nothing)', () => {
    const s = save40();
    expect(widenStoves(s)).toEqual(s);
  });
});
