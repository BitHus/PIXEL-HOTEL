import { describe, expect, it } from 'vitest';
import { PALETTE } from '@pixel-hotel/shared';
import { UI_ICONS } from './pixelIconsUi.ts';

describe('UI-2 icons', () => {
  for (const [name, map] of Object.entries(UI_ICONS)) {
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
