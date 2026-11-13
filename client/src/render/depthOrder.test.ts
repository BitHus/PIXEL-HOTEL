import { describe, expect, it } from 'vitest';
import { compareDepth, type DepthKey } from './depthOrder.ts';

describe('compareDepth', () => {
  it('sorts by y, then x, then uid', () => {
    const keys: DepthKey[] = [
      { y: 50, x: 10, uid: 3 },
      { y: 20, x: 90, uid: 1 },
      { y: 50, x: 5, uid: 9 },
      { y: 50, x: 10, uid: 2 },
    ];
    const sorted = [...keys].sort(compareDepth);
    expect(sorted).toEqual([
      { y: 20, x: 90, uid: 1 },
      { y: 50, x: 5, uid: 9 },
      { y: 50, x: 10, uid: 2 },
      { y: 50, x: 10, uid: 3 },
    ]);
  });
});
