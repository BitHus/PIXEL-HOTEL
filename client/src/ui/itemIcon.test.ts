import { describe, expect, it } from 'vitest';
import { fitRects, iconCanvasSize } from './itemIcon.ts';

describe('fitRects', () => {
  it('centers small art without scaling it up', () => {
    expect(fitRects([[-5, -10, 10, 10, '#000']], 64)).toEqual([[27, 27, 10, 10, '#000']]);
  });
  it('scales big art down to fit, on whole pixels', () => {
    const out = fitRects([[0, 0, 128, 64, '#000'], [0, 0, 1, 1, '#fff']], 64);
    expect(out[0]).toEqual([0, 16, 64, 32, '#000']);
    expect(out[1]?.[2]).toBe(1); // tiny rects keep 1 px
  });
});

describe('iconCanvasSize', () => {
  it('is as big as the art, so the art fills the icon', () => {
    expect(iconCanvasSize([[-1, -1, 18, 18, '#000']])).toBe(18);
    expect(iconCanvasSize([[0, 0, 40, 10, '#000'], [0, 10, 40, 20, '#000']])).toBe(40);
  });
  it('is never bigger than the icon canvas', () => {
    expect(iconCanvasSize([[0, 0, 128, 64, '#000']])).toBe(64);
    expect(iconCanvasSize([])).toBe(1);
  });
});
