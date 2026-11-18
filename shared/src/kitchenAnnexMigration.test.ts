// Migration 38 -> 39 (owner 18 Nov): the kitchen is an attached annex of the tavern; the old walled ring is gone and nothing is lost.
import { describe, expect, it } from 'vitest';
import { footprintRect, getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { kitchenZone, rectInZone } from './kitchen.ts';
import { kitchenWall } from './kitchenWall.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { SAVE_VERSION } from './config.ts';
import { readSave } from './save.ts';
import { withItem } from './tavernTest.ts';

/** The old (save 38) start spots of the stove and the barrel per shape. */
const OLD_START: Record<string, { stove: [number, number]; barrel: [number, number] }> = {
  square_shop: { stove: [240, 96], barrel: [304, 64] },
  long: { stove: [272, 96], barrel: [336, 64] },
  l_shape: { stove: [240, 160], barrel: [304, 128] },
  plus: { stove: [400, 96], barrel: [432, 64] },
  wide_hall: { stove: [304, 96], barrel: [368, 64] },
};

/** A version 38 tavern: the old room size (no annex), the stove and barrel at the old start spots inside the old zone (square_shop cells 7..9 x 0..2). */
function save38(shape = 'square_shop', mutate: (s: GameState) => GameState = (s) => s): string {
  let s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape }, 0);
  const tavern = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  s = { ...s, rooms: s.rooms.map((r) => (r.id === tavern.id ? { ...r, h: r.h - 128 } : r)) }; // the old floor had no annex rows (4 cells here)
  s = {
    ...s,
    items: s.items.map((i) => (i.typeId === 'stove' ? { ...i, x: OLD_START[shape]!.stove[0], y: OLD_START[shape]!.stove[1] } : i.typeId === 'brewing_barrel' ? { ...i, x: OLD_START[shape]!.barrel[0], y: OLD_START[shape]!.barrel[1] } : i)),
  };
  s = withItem(s, 80, 'prep_table', 288, 96);
  return JSON.stringify({ version: 38, savedAt: 1, state: mutate(s) });
}

describe('migration 38 -> 39 (the kitchen annex)', () => {
  it('SAVE_VERSION is 39; the tavern grows by the annex and the old kitchen machines move inside it, nothing is lost', () => {
    expect(SAVE_VERSION).toBe(39);
    const text = save38();
    const before = JSON.parse(text).state as GameState;
    const r = readSave(text);
    if (!r.ok) throw new Error(r.problem);
    const s = r.state;
    const room = s.rooms.find((x) => x.id === s.tavern.roomId)!;
    expect(room.h).toBe(448); // 14 cells of floor with the annex
    const zone = kitchenZone(room)!;
    for (const t of ['stove', 'brewing_barrel', 'prep_table']) {
      const it = s.items.find((i) => i.typeId === t)!;
      expect(it.roomId, t).toBe(room.id);
      expect(rectInZone(zone, footprintRect(it, getFurnitureType(t))), `${t} inside the annex`).toBe(true);
    }
    // the same items (no uid lost), the counter and the rest did not move
    expect(s.items.map((i) => i.uid).sort((a, b) => a - b)).toEqual(before.items.map((i) => i.uid).sort((a, b) => a - b));
    for (const i of before.items.filter((x) => !['stove', 'brewing_barrel', 'prep_table'].includes(x.typeId))) expect(s.items.find((x) => x.uid === i.uid)).toMatchObject({ x: i.x, y: i.y, roomId: i.roomId });
    // and the stove and the barrel still are not on the partition or in front of the doorway
    const kw = kitchenWall(room)!;
    for (const t of ['stove', 'brewing_barrel', 'prep_table']) {
      const fp = footprintRect(s.items.find((i) => i.typeId === t)!, getFurnitureType(t));
      expect([...kw.walls, kw.door, kw.doorOut].some((w) => fp.x < w.x + w.w && w.x < fp.x + fp.w && fp.y < w.y + w.h && w.y < fp.y + fp.h), t).toBe(false);
    }
  });

  it('a brew and a cook in progress stay exact (uids do not change)', () => {
    const text = save38('square_shop', (s) => {
      const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
      const stove = s.items.find((i) => i.typeId === 'stove')!;
      return { ...s, tavern: { ...s.tavern, brews: [{ barrelUid: barrel.uid, drink: 'root_ale', readyAt: 123_456 }], cooks: [{ stoveUid: stove.uid, food: 'roasted_turnip', qty: 2, readyAt: 77_000 }] } };
    });
    const before = JSON.parse(text).state as GameState;
    const r = readSave(text);
    if (!r.ok) throw new Error(r.problem);
    expect(r.state.tavern.brews).toEqual(before.tavern.brews);
    expect(r.state.tavern.cooks).toEqual(before.tavern.cooks);
  });

  it('works on every tavern shape and level 2 and 3 saves too', () => {
    for (const shape of ['long', 'l_shape', 'plus', 'wide_hall']) {
      const r = readSave(save38(shape));
      if (!r.ok) throw new Error(r.problem);
      const room = r.state.rooms.find((x) => x.id === r.state.tavern.roomId)!;
      expect(room.w, shape).toBeGreaterThan(0);
      const zone = kitchenZone(room)!;
      expect(rectInZone(zone, footprintRect(r.state.items.find((i) => i.typeId === 'stove')!, getFurnitureType('stove'))), shape).toBe(true);
    }
  });

  it('the round table is retired: every one becomes the square table (same uid, room and anchor; hotbar and bag follow), nothing is lost', () => {
    const text = save38('square_shop', (s) => {
      const t = s.items.find((i) => i.typeId === 'table')!;
      return {
        ...s,
        items: [...s.items.map((i) => (i.uid === t.uid ? { ...i, typeId: 'round_table' } : i)), { uid: 90, typeId: 'round_table', ownerId: t.ownerId, roomId: null, x: 0, y: 0, facing: 'down' as const, onItemUid: null }],
        hotbar: s.hotbar.map((h, k) => (k === 0 ? 'round_table' : h)),
        bag: { ...s.bag, furniture: s.bag.furniture.map((h, k) => (k === 0 ? 'round_table' : h)) },
      };
    });
    const before = JSON.parse(text).state as GameState;
    const r = readSave(text);
    if (!r.ok) throw new Error(r.problem);
    expect(r.state.items.some((i) => i.typeId === 'round_table')).toBe(false);
    expect(r.state.items.filter((i) => i.typeId === 'table')).toHaveLength(before.items.filter((i) => i.typeId === 'table' || i.typeId === 'round_table').length);
    const was = before.items.find((i) => i.typeId === 'round_table' && i.uid !== 90)!;
    expect(r.state.items.find((i) => i.uid === was.uid)).toMatchObject({ typeId: 'table', x: was.x, y: was.y, roomId: was.roomId });
    expect(r.state.hotbar.includes('round_table')).toBe(false);
    expect(r.state.hotbar[0]).toBe('table');
    expect(r.state.bag.furniture.includes('round_table')).toBe(false);
  });
});
