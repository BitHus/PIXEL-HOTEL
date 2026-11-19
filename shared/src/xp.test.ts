// SK-2: the xp table and grantXp.
import { describe, expect, it } from 'vitest';
import { createNewPlayer } from './newPlayer.ts';
import { applyChange } from './ledger.ts';
import { grantXp, xpFor, XP_TABLE } from './xp.ts';

describe('xp from every loop (xp.json)', () => {
  it('gives the plan numbers per event', () => {
    expect(xpFor({ t: 'order' })).toBe(2);
    expect(xpFor({ t: 'order', perfect: true })).toBe(3);
    expect(xpFor({ t: 'brew' })).toBe(4);
    expect(xpFor({ t: 'cook', dishes: 3 })).toBe(3);
    expect((['common', 'rare', 'ultra_rare', 'legendary'] as const).map((rank) => xpFor({ t: 'harvest', rank }))).toEqual([1, 3, 8, 20]);
    expect((['common', 'rare', 'ultra_rare', 'legendary'] as const).map((rank) => xpFor({ t: 'fish', rank }))).toEqual([2, 5, 12, 30]);
    expect(xpFor({ t: 'splice_first' })).toBe(15);
    expect(xpFor({ t: 'tree' })).toBe(2);
    expect(xpFor({ t: 'ore', qty: 3 })).toBe(3);
    expect(xpFor({ t: 'rare_block' })).toBe(10);
    expect(xpFor({ t: 'mine_exit' })).toBe(5);
    expect(xpFor({ t: 'floor_exit' })).toBe(5);
    expect(xpFor({ t: 'book_entry', count: 2 })).toBe(4);
    expect(xpFor({ t: 'claim' })).toBe(10);
    expect(xpFor({ t: 'cook', dishes: -2 })).toBe(0);
    for (const v of Object.values(XP_TABLE)) if (typeof v === 'number') expect(Number.isInteger(v) && v >= 0).toBe(true);
  });
  it('grantXp adds xp and levels up; the old state is untouched', () => {
    const s = createNewPlayer(undefined, 0);
    const a = grantXp(s, { t: 'splice_first' }, 1);
    expect(a.player).toMatchObject({ xp: s.player.xp + 15, level: 2 });
    expect(s.player.xp).toBe(0);
    expect(grantXp(s, { t: 'cook', dishes: 0 }, 1)).toBe(s);
  });
  it('a NEW Book entry (first find of an id, through the ledger) gives 2 xp; a repeat, the start kit and debug grants give none', () => {
    const s = createNewPlayer(undefined, 0);
    const a = applyChange(s, { reason: 'chop', materials: { resin: 1, amber: 1 } }, 1)!;
    expect(a.player.xp).toBe(4);
    expect(applyChange(a, { reason: 'chop', materials: { resin: 1 } }, 2)!.player.xp).toBe(4);
    expect(applyChange(s, { reason: 'start', materials: { resin: 1 } }, 1)!.player.xp).toBe(0);
    expect(applyChange(s, { reason: 'debug', materials: { resin: 1 } }, 1)!.player.xp).toBe(0);
  });
});
