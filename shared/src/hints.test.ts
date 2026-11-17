import { describe, expect, it } from 'vitest';
import { CONTEXT_HINTS, SEED_HINT, hintDue, hintMs } from './hints.ts';
import { getFurnitureType } from './furniture.ts';
import { readingMs } from './text.ts';

describe('hints (VG-1)', () => {
  it('every hint sits on a real furniture type with a unique key', () => {
    const keys = new Set(CONTEXT_HINTS.map((h) => h.key));
    expect(keys.size).toBe(CONTEXT_HINTS.length);
    expect(keys.has(SEED_HINT.key)).toBe(false);
    for (const h of CONTEXT_HINTS) expect(getFurnitureType(h.typeId)).toBeTruthy();
  });
  it('shows a hint once per thing', () => {
    expect(hintDue(['stove'], [])?.key).toBe('stove');
    expect(hintDue(['stove'], ['stove'])).toBeNull();
    expect(hintDue([], [])).toBeNull();
    expect(hintDue(['stove', 'register'], ['register'])?.key).toBe('stove');
  });
  it('stays at reading pace', () => {
    expect(hintMs('a b c')).toBe(readingMs('a b c'));
  });
});
