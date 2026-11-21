import { describe, expect, it } from 'vitest';
import { blockCellTap, mayBreak } from './punchMode.ts';

describe('OB-4 punch mode', () => {
  it('punch on: a tap on a block or plant hits it; stacking or planting the selected item stays a place', () => {
    expect(blockCellTap({ punchMode: true, stackOrPlant: false })).toBe('hit');
    expect(blockCellTap({ punchMode: true, stackOrPlant: true })).toBe('place');
  });
  it('chill (punch off): never hits; placing is unchanged; the tap falls through (null)', () => {
    expect(blockCellTap({ punchMode: false, stackOrPlant: false })).toBeNull();
    expect(blockCellTap({ punchMode: false, stackOrPlant: true })).toBe('place');
  });
  it('a run (dungeon, mine) always breaks whatever the toggle says', () => {
    expect(mayBreak(false, true)).toBe(true);
    expect(mayBreak(false, false)).toBe(false);
    expect(mayBreak(true, false)).toBe(true);
  });
});
