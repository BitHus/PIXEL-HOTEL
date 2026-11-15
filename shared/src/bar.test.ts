import { describe, expect, it } from 'vitest';
import { barCoinPoint } from './bar.ts';
import { createNewPlayer } from './newPlayer.ts';
import { getFurnitureType } from './furniture.ts';

describe('the bar', () => {
  it('has a coin point on top of the counter, and none without one', () => {
    const bar = createNewPlayer(undefined, 0).items.find((i) => i.typeId === 'counter')!;
    const p = barCoinPoint(bar)!;
    expect(p.y).toBe(bar.y - getFurnitureType('counter').height);
    expect(Math.abs(p.x - bar.x)).toBe(21);
    expect(barCoinPoint(undefined)).toBeNull();
  });
});
