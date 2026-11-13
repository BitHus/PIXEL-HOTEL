import { describe, expect, it } from 'vitest';
import { shownSlots } from './bagPanel.ts';

const slots = (filled: number[], length = 36): (string | null)[] => Array.from({ length }, (_, i) => (filled.includes(i) ? 'x' : null));

describe('shownSlots', () => {
  it('shows one empty row for an empty bag', () => {
    expect(shownSlots(slots([]), 6)).toBe(6);
    expect(shownSlots(slots([]), 9)).toBe(9);
  });
  it('shows the rows up to the last filled slot plus one empty row', () => {
    expect(shownSlots(slots([0, 1]), 6)).toBe(12);
    expect(shownSlots(slots([5]), 6)).toBe(12);
    expect(shownSlots(slots([6]), 6)).toBe(18);
    expect(shownSlots(slots([0, 20]), 9)).toBe(36);
  });
  it('never shows more slots than the bag has', () => {
    expect(shownSlots(slots([35]), 6)).toBe(36);
    expect(shownSlots(slots([36], 37), 6)).toBe(37);
  });
});
