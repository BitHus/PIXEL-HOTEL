import { describe, expect, it } from 'vitest';
import { POUR_FULL_MS, POUR_MAX_FILL, POUR_TIP_RATE } from './config.ts';
import { pourFill, pourGrade, pourHeldClamp, pickPourTap, pourTip } from './pour.ts';
import { POUR_HOLD_CAP_MS } from './config.ts';

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

describe('pour presses', () => {
  const taps = [{ standUid: 1, slot: 0, drink: 'root_ale', mugs: 3 }, { standUid: 1, slot: 1, drink: 'mead', mugs: 2 }];
  it('caps the hold', () => {
    expect(pourHeldClamp(1e9)).toBe(POUR_HOLD_CAP_MS);
    expect(pourHeldClamp(-5)).toBe(0);
    expect(pourHeldClamp(NaN)).toBe(0);
  });
  it('the drink on exactly one tap: any press on the stand uses it', () => {
    expect(pickPourTap(taps, 1, 'root_ale', 1)).toEqual({ ok: true, slot: 0 });
    expect(pickPourTap(taps, 1, 'mead', 0)).toEqual({ ok: true, slot: 1 });
  });
  it('on both taps the nearest one; on none it says what the pressed tap holds', () => {
    const both = [{ standUid: 1, slot: 0, drink: 'mead', mugs: 1 }, { standUid: 1, slot: 1, drink: 'mead', mugs: 1 }];
    expect(pickPourTap(both, 1, 'mead', 1)).toEqual({ ok: true, slot: 1 });
    expect(pickPourTap(taps, 1, 'stout', 1)).toEqual({ ok: false, why: 'other', drink: 'mead' });
    expect(pickPourTap(taps, 2, 'mead', 0)).toEqual({ ok: false, why: 'empty' });
    expect(pickPourTap([{ standUid: 1, slot: 0, drink: 'mead', mugs: 0 }], 1, 'mead', 0)).toEqual({ ok: false, why: 'empty' });
  });
});
