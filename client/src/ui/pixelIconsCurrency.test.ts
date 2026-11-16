import { describe, expect, it } from 'vitest';
import { PALETTE } from '@pixel-hotel/shared';
import { CURRENCY_ICONS } from './pixelIconsCurrency.ts';

describe('currency icons', () => {
  for (const [name, map] of Object.entries(CURRENCY_ICONS)) {
    it(`${name} is a 16 x 16 map with known colours, all Endesga 32`, () => {
      expect(map.rows).toHaveLength(16);
      for (const row of map.rows) {
        expect([...row]).toHaveLength(16);
        for (const ch of row) if (ch !== '.') expect(Object.keys(map.colors)).toContain(ch);
      }
      for (const c of Object.values(map.colors)) expect(PALETTE).toContain(c);
    });
  }
});

import { gemIconName, goldIconName } from './pixelIconsCurrency.ts';
describe('amount icons', () => {
  it('grow with the amount', () => {
    expect([1, 9, 10, 49, 50, 199, 200].map(goldIconName)).toEqual(['coin', 'coin', 'coins', 'coins', 'purse', 'purse', 'purseBig']);
    expect([1, 4, 5].map(gemIconName)).toEqual(['gem', 'gem', 'gems']);
  });
});
