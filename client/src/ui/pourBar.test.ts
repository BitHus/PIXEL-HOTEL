import { describe, expect, it } from 'vitest';
import { pourBarShouldShow } from './pourBar.ts';

describe('pour bar', () => {
  it('shows only while waiting, no panel and not released', () => {
    expect(pourBarShouldShow({ waiting: true, panelOpen: false, released: false })).toBe(true);
    expect(pourBarShouldShow({ waiting: false, panelOpen: false, released: false })).toBe(false);
    expect(pourBarShouldShow({ waiting: true, panelOpen: true, released: false })).toBe(false);
    expect(pourBarShouldShow({ waiting: true, panelOpen: false, released: true })).toBe(false);
  });
});
