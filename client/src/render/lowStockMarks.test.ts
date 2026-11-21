import { describe, expect, it } from 'vitest';
import { lowStockDotAt } from './lowStockMarks.ts';

describe('low-stock dot', () => {
  it('sits centred over the piece, `lift` px above its anchor, on whole pixels', () => {
    expect(lowStockDotAt({ x: 208.4, y: 192 }, 50)).toEqual({ x: 208, y: 142 });
  });
});
