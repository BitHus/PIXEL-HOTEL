import { describe, expect, it } from 'vitest';
import { addXp, attackBonusAt, LEVEL_TOTAL_XP, levelForXp, MAX_LEVEL, maxHpAt, xpForNextLevel } from './levels.ts';

describe('levels (section 10)', () => {
  it('has the thresholds 15, 40, 80, 140, 220, 320, 450 for levels 2 to 8', () => {
    expect(MAX_LEVEL).toBe(8);
    expect(LEVEL_TOTAL_XP.slice(1)).toEqual([15, 40, 80, 140, 220, 320, 450]);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(14)).toBe(1);
    expect(levelForXp(15)).toBe(2);
    expect(levelForXp(449)).toBe(7);
    expect(levelForXp(450)).toBe(8);
    expect(xpForNextLevel(1)).toBe(15);
    expect(xpForNextLevel(8)).toBeNull();
  });

  it('addXp returns the new level, never above 8', () => {
    const p = { id: 1, xp: 10, level: 1 };
    expect(addXp(p, 5)).toEqual({ id: 1, xp: 15, level: 2 });
    expect(addXp(p, 100)).toMatchObject({ xp: 110, level: 4 });
    expect(addXp(p, 100000)).toMatchObject({ level: 8 });
    expect(addXp(addXp(p, 100000), 5).level).toBe(8);
    expect(addXp(p, -5)).toMatchObject({ xp: 10, level: 1 });
  });

  it('every level gives +3 max hp and every even level +1 attack', () => {
    expect(maxHpAt(1)).toBe(30);
    expect(maxHpAt(8)).toBe(51);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(attackBonusAt)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});
