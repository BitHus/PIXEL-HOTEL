import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pourBarShouldShow } from './pourBar.ts';

describe('pour indicator', () => {
  it('shows only while waiting, no panel and not released', () => {
    expect(pourBarShouldShow({ waiting: true, panelOpen: false, released: false })).toBe(true);
    expect(pourBarShouldShow({ waiting: false, panelOpen: false, released: false })).toBe(false);
    expect(pourBarShouldShow({ waiting: true, panelOpen: true, released: false })).toBe(false);
    expect(pourBarShouldShow({ waiting: true, panelOpen: false, released: true })).toBe(false);
  });
  it('the render layer draws no second gauge', () => {
    const src = readFileSync(new URL('../render/pourFx.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/drawGauge|GAUGE/);
  });
});
