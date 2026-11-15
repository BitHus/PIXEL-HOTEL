import { describe, expect, it } from 'vitest';
import { barCoinPoint, registerPoint } from './bar.ts';
import { createNewPlayer } from './newPlayer.ts';
import { getFurnitureType } from './furniture.ts';

describe('the bar', () => {
  it('has a coin point on top of the counter, and none without one', () => {
    const bar = createNewPlayer(undefined, 0).items.find((i) => i.typeId === 'counter')!;
    const p = barCoinPoint(bar)!;
    expect(p.y).toBe(bar.y - 16 - 32 - 12); // above the bar's top (32 px)
    expect(Math.abs(p.x - bar.x)).toBe(32);
    expect(barCoinPoint(undefined)).toBeNull();
  });

  it('the register on the bar is where collected coins fly to (step T1); none without one', () => {
    const s = createNewPlayer(undefined, 0);
    const reg = s.items.find((i) => i.typeId === 'register')!;
    const p = registerPoint(s.items, s.tavern.roomId)!;
    expect(p.x).toBe(reg.x);
    expect(p.y).toBeLessThan(reg.y - 16 - 32); // above the bar's top
    expect(registerPoint(s.items.filter((i) => i.typeId !== 'register'), s.tavern.roomId)).toBeNull();
    expect(registerPoint(s.items, 999)).toBeNull();
  });
});
