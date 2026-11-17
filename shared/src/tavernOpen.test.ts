import { describe, expect, it } from 'vitest';
import { SHOP_TICK_MS } from './config.ts';
import { catchUpTavern, stepTavern } from './guests.ts';
import { seededRng } from './rng.ts';
import { nothingOrderable, setTavernOpen, tavernOpen } from './tavern.ts';
import { tavernWorld, withAle } from './tavernTest.ts';

const MIN = 60_000;

describe('OPEN / CLOSED sign (OA-14)', () => {
  it('is open by default; closing stores a flag, opening removes it (no SAVE bump)', () => {
    const s = withAle();
    expect(tavernOpen(s.tavern)).toBe(true);
    const closed = setTavernOpen(s, false);
    expect(tavernOpen(closed.tavern)).toBe(false);
    expect(setTavernOpen(closed, true).tavern).toEqual(s.tavern);
    expect(setTavernOpen(s, true)).toBe(s);
  });

  it('a closed tavern gets no new guests, an open one does', () => {
    const run = (open: boolean): number => {
      let s = setTavernOpen(withAle(), open);
      const rng = seededRng(4);
      for (let t = 0; t < 3 * MIN; t += SHOP_TICK_MS) s = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, rng, t).state;
      return s.tavern.guests.length + (s.tavern.nextGuestId < -1 ? 1 : 0);
    };
    expect(run(true)).toBeGreaterThan(0);
    expect(run(false)).toBe(0);
  });

  it('nobody comes while away when closed', () => {
    const s = withAle();
    const at = s.tavern.updatedAt + 2 * 60 * MIN;
    expect(catchUpTavern(s, tavernWorld(s), at, seededRng(3)).arrived).toBeGreaterThan(0);
    const closed = setTavernOpen(s, false);
    expect(catchUpTavern(closed, tavernWorld(closed), at, seededRng(3)).arrived).toBe(0);
  });

  it('nothingOrderable: every row off or out of stock', () => {
    expect(nothingOrderable([])).toBe(true);
    expect(nothingOrderable([{ on: true, stock: 0 }, { on: false, stock: 5 }])).toBe(true);
    expect(nothingOrderable([{ on: true, stock: 1 }])).toBe(false);
  });
});
