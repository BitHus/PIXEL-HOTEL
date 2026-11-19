import { describe, expect, it } from 'vitest';
import { barMarkersWanted, markerRect } from './barSpotMarkers.ts';

describe('bar spot markers', () => {
  it('sit under the feet in whole px', () => {
    expect(markerRect({ x: 100.4, y: 80 })).toEqual({ x: 88, y: 72, w: 24, h: 10 });
  });
  it('show only for bar guests walking in or while placing, never when the feature is off', () => {
    const base = { enabled: true, inTavern: true, walkingIn: false, placing: false };
    expect(barMarkersWanted(base)).toBe(false);
    expect(barMarkersWanted({ ...base, walkingIn: true })).toBe(true);
    expect(barMarkersWanted({ ...base, placing: true })).toBe(true);
    expect(barMarkersWanted({ ...base, placing: true, enabled: false })).toBe(false);
    expect(barMarkersWanted({ ...base, placing: true, inTavern: false })).toBe(false);
  });
});
