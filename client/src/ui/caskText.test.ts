// Step K2b: the Cask panel's pure text and slot views.
import { describe, expect, it } from 'vitest';
import { CASK_SLOTS, ripenMinutes, type Cask } from '@pixel-hotel/shared';
import { caskSlotViews, caskStatusText, tierLabel } from './caskText.ts';

const cask: Cask = { rackUid: 5, slot: 1, drink: 'root_ale', mugs: 4, startedAt: 1000 };

describe('cask slot views', () => {
  it('always gives CASK_SLOTS slots and marks the free ones', () => {
    const v = caskSlotViews([cask], 5, 1000);
    expect(v).toHaveLength(CASK_SLOTS);
    expect(v[0]!.cask).toBeNull();
    expect(caskStatusText(v[0]!)).toBe('Free slot.');
    expect(v[1]!.cask).toBe(cask);
  });
  it('ignores casks of another rack', () => {
    expect(caskSlotViews([cask], 6, 1000).every((s) => s.cask === null)).toBe(true);
  });
  it('switches tier exactly at the boundary and counts down', () => {
    const m = ripenMinutes('root_ale');
    const before = caskSlotViews([cask], 5, 1000 + m.aged * 60_000 - 1)[1]!;
    const at = caskSlotViews([cask], 5, 1000 + m.aged * 60_000)[1]!;
    expect(before.tier).toBe('fresh');
    expect(before.nextInMs).toBe(1);
    expect(at.tier).toBe('aged');
    expect(caskStatusText(at)).toContain('Vintage in');
    const done = caskSlotViews([cask], 5, 1000 + m.vintage * 60_000)[1]!;
    expect(done.tier).toBe('vintage');
    expect(done.progress).toBe(1);
    expect(caskStatusText(done)).toContain('ready to collect');
    expect(tierLabel('vintage')).toBe('Vintage');
  });
});
