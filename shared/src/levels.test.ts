import { describe, expect, it } from 'vitest';
import { addXp, attackBonusAt, LEVEL_TOTAL_XP, levelForXp, MAX_LEVEL, maxHpAt, xpForNextLevel } from './levels.ts';

describe('levels (section 10, SK-2 cap 30)', () => {
  it('levels 2 to 12 keep 15 .. 1400 (no save moves); 13 to 30 follow the longer curve up to 18750', () => {
    expect(MAX_LEVEL).toBe(30);
    expect(LEVEL_TOTAL_XP).toHaveLength(30);
    expect(LEVEL_TOTAL_XP.slice(1, 12)).toEqual([15, 40, 80, 140, 220, 320, 450, 620, 830, 1090, 1400]);
    expect(LEVEL_TOTAL_XP.slice(12)).toEqual([1740, 2120, 2540, 3010, 3530, 4110, 4750, 5460, 6250, 7130, 8110, 9200, 10410, 11750, 13240, 14890, 16720, 18750]);
    for (let i = 1; i < LEVEL_TOTAL_XP.length; i++) expect(LEVEL_TOTAL_XP[i]! - LEVEL_TOTAL_XP[i - 1]!, `step ${i + 1}`).toBeGreaterThan(i > 1 ? LEVEL_TOTAL_XP[i - 1]! - LEVEL_TOTAL_XP[i - 2]! - 1 : 0);
    expect(levelForXp(619)).toBe(8);
    expect(levelForXp(1400)).toBe(12);
    expect(levelForXp(1739)).toBe(12);
    expect(levelForXp(1740)).toBe(13);
    expect(levelForXp(18750)).toBe(30);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(14)).toBe(1);
    expect(levelForXp(15)).toBe(2);
    expect(levelForXp(450)).toBe(8);
    expect(xpForNextLevel(1)).toBe(15);
    expect(xpForNextLevel(8)).toBe(620);
    expect(xpForNextLevel(12)).toBe(1740);
    expect(xpForNextLevel(30)).toBeNull();
  });

  it('addXp returns the new level, never above 30; a level 12 save with 1400 xp stays level 12', () => {
    const p = { id: 1, xp: 10, level: 1 };
    expect(addXp(p, 5)).toEqual({ id: 1, xp: 15, level: 2 });
    expect(addXp(p, 100)).toMatchObject({ xp: 110, level: 4 });
    expect(addXp(p, 1_000_000)).toMatchObject({ level: 30 });
    expect(addXp(addXp(p, 1_000_000), 5).level).toBe(30);
    expect(addXp({ id: 1, xp: 1400, level: 12 }, 0).level).toBe(12);
    expect(addXp(p, -5)).toMatchObject({ xp: 10, level: 1 });
  });

  it('up to 12: +3 max hp per level and +1 attack per even level; after 12 only +1 max hp per level, no attack', () => {
    expect(maxHpAt(1)).toBe(30);
    expect(maxHpAt(8)).toBe(51);
    expect(maxHpAt(12)).toBe(63);
    expect(maxHpAt(13)).toBe(64);
    expect(maxHpAt(30)).toBe(81);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(attackBonusAt)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
    expect([13, 14, 20, 30].map(attackBonusAt)).toEqual([6, 6, 6, 6]);
  });
});
