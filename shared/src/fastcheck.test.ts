import { test, expect } from 'vitest';
import fc from 'fast-check';
// Seed property example: fast-check is available for rule tests (nav, layout, splice).
test('fast-check works: sorting twice equals sorting once', () => {
  fc.assert(fc.property(fc.array(fc.integer()), (a) => {
    const s = [...a].sort((x, y) => x - y);
    expect([...s].sort((x, y) => x - y)).toEqual(s);
  }));
});
