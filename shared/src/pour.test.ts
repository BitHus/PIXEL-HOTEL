import { describe, expect, it } from 'vitest';
import { POUR_FULL_MS, POUR_MAX_FILL, POUR_TIP_RATE } from './config.ts';
import { pourFill, pourGrade, pourTip } from './pour.ts';

describe('hands-on pour', () => {
  it('fills with the hold and caps', () => {
    expect(pourFill(0)).toBe(0);
    expect(pourFill(POUR_FULL_MS)).toBe(1);
    expect(pourFill(1e9)).toBe(POUR_MAX_FILL);
    expect(pourFill(NaN)).toBe(0);
  });
  it('grades under, perfect, over', () => {
    expect(pourGrade(100)).toBe('under');
    expect(pourGrade(POUR_FULL_MS)).toBe('perfect');
    expect(pourGrade(POUR_FULL_MS * 1.3)).toBe('over');
  });
  it('tip only when perfect and stays small', () => {
    expect(pourTip(false, 20)).toBe(0);
    expect(pourTip(true, 20)).toBe(2);
    expect(pourTip(true, 1)).toBe(1);
    expect(POUR_TIP_RATE).toBeLessThanOrEqual(0.1);
  });
});
