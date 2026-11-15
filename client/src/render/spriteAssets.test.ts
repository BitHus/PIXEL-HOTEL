// Every sprite PNG in assets/sprites/furniture/ must fit its piece (docs/PLAN-SPRITES.md). A missing sprite is never an error.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { footprintSize, getFurnitureType } from '@pixel-hotel/shared';
import { neededFacings, parseSpriteName } from './spriteIndex.ts';

const dir = join(import.meta.dirname, '..', 'assets', 'sprites', 'furniture');
const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('furniture sprite files', () => {
  for (const file of files) {
    it(`${file} has a valid name, a PNG header and the right size`, () => {
      const name = parseSpriteName(file);
      expect(name, 'file name').not.toBeNull();
      const type = getFurnitureType(name!.id); // throws for an unknown id
      expect(neededFacings(type), 'facing allowed').toContain(name!.facing);
      const b = readFileSync(join(dir, file));
      expect([...b.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
      const w = b.readUInt32BE(16);
      const h = b.readUInt32BE(20);
      const fp = footprintSize(type, name!.facing);
      expect(w, 'width = footprint width').toBe(fp.w);
      expect(h, 'height').toBeGreaterThanOrEqual(fp.d);
      expect(h, 'height').toBeLessThanOrEqual(fp.d + type.height + 8);
    });
  }
});
