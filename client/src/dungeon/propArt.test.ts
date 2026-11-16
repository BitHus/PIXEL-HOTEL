import { describe, expect, it } from 'vitest';
import { drawDecor, drawProp, propLight, PROP_INFO, PROP_KINDS } from './propArt.ts';

describe('propArt', () => {
  it('draws every kind and variant without throwing, with content', () => {
    for (const k of PROP_KINDS) {
      for (let v = 0; v < PROP_INFO[k].variants + 1; v++) {
        const p = drawProp(k, v, 123);
        expect(p.children.length).toBeGreaterThan(0);
      }
    }
  });
  it('unknown kinds fall back to a box and drawDecor is the same hook', () => {
    expect(drawProp('nope').children.length).toBe(1);
    expect(drawDecor).toBe(drawProp);
  });
  it('glow kinds expose a light', () => {
    expect(propLight('brazier_big')?.flicker).toBe(true);
    expect(propLight('barrel')).toBeUndefined();
  });
});
