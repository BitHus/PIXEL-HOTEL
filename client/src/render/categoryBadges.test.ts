import { describe, expect, it } from 'vitest';
import { BADGE_CATEGORIES, BADGE_ROWS } from './categoryBadges.ts';

describe('categoryBadges', () => {
  it('has 12 x 12 rows for every category', () => {
    for (const c of BADGE_CATEGORIES) {
      expect(BADGE_ROWS[c].length, c).toBe(12);
      for (const r of BADGE_ROWS[c]) expect(r.length, c).toBe(12);
    }
  });
});
