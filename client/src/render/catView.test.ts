import { describe, expect, it } from 'vitest';
import { CAT_STRIPS, catFrameIndex, catStripOf } from './catView.ts';

describe('catView (CAT HOOK)', () => {
  it('follow uses the walk strip', () => {
    expect(catStripOf('follow')).toBe('walk');
    expect(catStripOf('sleep')).toBe('sleep');
  });
  it('frames loop over the strip length with the strip timing', () => {
    const w = CAT_STRIPS.walk;
    expect(catFrameIndex('walk', 0)).toBe(0);
    expect(catFrameIndex('walk', w.ms)).toBe(1);
    expect(catFrameIndex('walk', w.ms * w.frames)).toBe(0);
    expect(catFrameIndex('sit', 0, 1)).toBe(0);
    expect(catFrameIndex('sleep', -5)).toBe(0);
  });
});
