import { describe, expect, it } from 'vitest';
import { barCoinPoint, barSurfaceHeight } from './bar.ts';
import { createNewPlayer } from './newPlayer.ts';
import { getFurnitureType } from './furniture.ts';

describe('the bar', () => {
  it('the coins start on the register that stands on the bar, above the bar top', () => {
    const s = createNewPlayer(undefined, 0);
    const bar = s.items.find((i) => i.typeId === 'counter')!;
    const register = s.items.find((i) => i.typeId === 'register')!;
    const p = barCoinPoint(bar, s.items)!;
    expect(p.x).toBe(register.x);
    expect(p.y).toBeLessThan(register.y - barSurfaceHeight(bar));
    expect(barSurfaceHeight(bar)).toBe(32);
  });
  it('without a register on the bar it is the middle of the bar top; none without a bar', () => {
    const s = createNewPlayer(undefined, 0);
    const bar = s.items.find((i) => i.typeId === 'counter')!;
    expect(barCoinPoint(bar, s.items.filter((i) => i.typeId !== 'register'))).toEqual({ x: bar.x, y: bar.y - barSurfaceHeight(bar) });
    expect(barCoinPoint(bar)).toEqual({ x: bar.x, y: bar.y - 32 });
    expect(barCoinPoint(undefined)).toBeNull();
  });
  it('the counter data has no till box any more: its art is the bar alone and its height follows', () => {
    const t = getFurnitureType('counter');
    expect('boxes' in t.art && t.art.boxes).toHaveLength(3);
    expect(t.height).toBe(64);
  });
});
