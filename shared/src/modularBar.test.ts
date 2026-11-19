// MODULAR BAR (19 Nov): tile picking and the 41 -> 42 conversion of the old counter.
import { describe, expect, it } from 'vitest';
import { barTileFor, barTiles, convertCounters } from './modularBar.ts';
import { createNewPlayer } from './newPlayer.ts';
import type { GameState } from './gameState.ts';
import { save41Start } from './tavernTest.ts';

const n = (e: boolean, w: boolean, no: boolean, s: boolean) => ({ e, w, n: no, s });

describe('barTileFor (autotile by neighbours)', () => {
  it('a left-right run: ends and the middle; turned up = the staff back', () => {
    expect(barTileFor(n(true, false, false, false), 'down').tile).toBe('hendl');
    expect(barTileFor(n(true, true, false, false), 'down').tile).toBe('hmid');
    expect(barTileFor(n(false, true, false, false), 'down').tile).toBe('hendr');
    expect(barTileFor(n(false, false, false, false), 'down').tile).toBe('hendl');
    expect(barTileFor(n(true, true, false, false), 'up').tile).toBe('hback');
  });
  it('an up-down run, mirrored only for the straight piece facing left; corners by their two arms; a T keeps its through-run', () => {
    expect(barTileFor(n(false, false, true, true), 'right')).toEqual({ tile: 'vmid', mirror: false });
    expect(barTileFor(n(false, false, true, true), 'left')).toEqual({ tile: 'vmid', mirror: true });
    expect(barTileFor(n(false, false, false, true), 'right').tile).toBe('vendn');
    expect(barTileFor(n(false, false, true, false), 'right').tile).toBe('vends');
    expect(barTileFor(n(true, false, false, true), 'down').tile).toBe('cse');
    expect(barTileFor(n(false, true, false, true), 'down').tile).toBe('csw');
    expect(barTileFor(n(true, false, true, false), 'down').tile).toBe('cne');
    expect(barTileFor(n(false, true, true, false), 'down').tile).toBe('cnw');
    expect(barTileFor(n(true, true, false, true), 'down').tile).toBe('hmid');
  });
  it('the new game bar: hendl, 4 x hmid, hendr', () => {
    const s = createNewPlayer(undefined, 0);
    const t = barTiles(s.items, s.tavern.roomId);
    const pieces = s.items.filter((i) => i.typeId === 'bar').sort((a, b) => a.x - b.x);
    expect(pieces.map((p) => t.get(p.uid)!.tile)).toEqual(['hendl', 'hmid', 'hmid', 'hmid', 'hmid', 'hendr']);
  });
});

describe('convertCounters (migration 41 -> 42)', () => {
  it('the 3-cell counter becomes 3 bar pieces on its cells (uid kept in the middle), the register and tap stand stay on their cells, nothing else changes', () => {
    const before = save41Start();
    const after = convertCounters(before, 5);
    expect(after.items.some((i) => i.typeId === 'counter')).toBe(false);
    const pieces = after.items.filter((i) => i.typeId === 'bar').sort((a, b) => a.x - b.x);
    expect(pieces.map((p) => p.x)).toEqual([48, 80, 112]);
    expect(pieces[1]!.uid).toBe(1);
    for (const r of after.items.filter((i) => i.typeId === 'register' || i.typeId === 'tap_stand')) {
      const under = after.items.find((i) => i.uid === r.onItemUid)!;
      expect(under.typeId).toBe('bar');
      expect(under.x).toBe(r.x);
    }
    expect(after.tavern.taps).toEqual(before.tavern.taps);
    expect(after.ledger.at(-1)).toMatchObject({ reason: 'tavern_gift' });
    expect(after.player.seen.bar).toBeDefined();
    expect(convertCounters(after, 6)).toBe(after);
  });

  it('an old save with a counter_ext, a counter in the bag, a bar guest and bar mess: pieces keep their cells, riders and guests follow, the bag counter becomes a piece', () => {
    const before = save41Start();
    const counter = before.items.find((i) => i.typeId === 'counter')!;
    const ext = { uid: 90, typeId: 'counter_ext', ownerId: counter.ownerId, roomId: counter.roomId, x: counter.x + 80, y: counter.y, facing: counter.facing, onItemUid: null };
    const spare = { uid: 91, typeId: 'counter', ownerId: counter.ownerId, roomId: null, x: 0, y: 0, facing: 'down' as const, onItemUid: null };
    const c = Math.floor(ext.x / 32);
    const r = Math.floor(counter.y / 32) + 1;
    const guest = { id: -5, barSpot: { barUid: 90, c, r } } as unknown as GameState['tavern']['guests'][number];
    const mess = { seatUid: 90, seatIndex: 1000 + r * 1000 + c } as unknown as GameState['tavern']['mess'][number];
    const withOld: GameState = { ...before, nextUid: Math.max(before.nextUid, 92), items: [...before.items, ext, spare], tavern: { ...before.tavern, guests: [guest], mess: [mess] } };
    const after = convertCounters(withOld, 5);
    expect(after.items.some((i) => i.typeId === 'counter' || i.typeId === 'counter_ext')).toBe(false);
    expect(after.items.find((i) => i.uid === 90)).toMatchObject({ typeId: 'bar', x: ext.x, y: ext.y });
    expect(after.items.find((i) => i.uid === 91)).toMatchObject({ typeId: 'bar', roomId: null });
    expect(after.tavern.guests[0]!.barSpot!.barUid).toBe(90);
    expect(after.tavern.mess[0]!.seatUid).toBe(90);
    expect(after.items.filter((i) => i.typeId === 'bar' && i.roomId !== null)).toHaveLength(4);
  });
});
