// MODULAR BAR (19 Nov): tile picking and the 41 -> 42 conversion of the old counter.
import { describe, expect, it } from 'vitest';
import { barTileFor, barTiles, convertCounters } from './modularBar.ts';
import { createNewPlayer } from './newPlayer.ts';
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
});
