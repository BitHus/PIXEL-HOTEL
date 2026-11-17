// Every sprite PNG in assets/sprites/<kind>/ must fit its piece (docs/PLAN-SPRITES.md, docs/PLAN-ART-UPGRADE.md section 0). A missing sprite is never an error.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES, CROP_TYPES, FURNITURE_TYPES, footprintSize, getClothing, STYLE_TYPES, getFurnitureType, getGear, getPiece, isMaterialId, type Facing,
} from '@pixel-hotel/shared';
import { SPRITE_KINDS, neededFacings, parseSpritePath, type SpriteKind } from './spriteIndex.ts';

const root = join(import.meta.dirname, '..', 'assets', 'sprites');
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const filesOf = (kind: SpriteKind): string[] => (existsSync(join(root, kind)) ? readdirSync(join(root, kind)).filter((f) => f.endsWith('.png')) : []);
const sizeOf = (kind: SpriteKind, file: string): { w: number; h: number; header: number[] } => {
  const b = readFileSync(join(root, kind, file));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), header: [...b.subarray(0, 8)] };
};
const known = (fn: () => unknown): boolean => {
  try {
    return !!fn();
  } catch {
    return false;
  }
};

describe('the kinds', () => {
  it('every folder in assets/sprites is a known kind', () => {
    for (const dir of readdirSync(root)) expect(SPRITE_KINDS as readonly string[], dir).toContain(dir);
  });
  it('ids of furniture and materials never meet, so assets/sprites/icons/<id>.png is unambiguous', () => {
    for (const t of FURNITURE_TYPES) expect(isMaterialId(t.id), t.id).toBe(false);
  });
});

describe('furniture sprite files', () => {
  for (const file of filesOf('furniture')) {
    it(`${file} has a valid name, a PNG header and the right size`, () => {
      const name = parseSpritePath(`furniture/${file}`);
      expect(name, 'file name').not.toBeNull();
      const cut = name!.id.lastIndexOf('_');
      if (!known(() => getFurnitureType(name!.id)) && cut > 0 && known(() => getFurnitureType(name!.id.slice(0, cut)))) {
        const strip = sizeOf('furniture', file);
        expect(strip.header).toEqual(PNG_SIGNATURE);
        const tag = name!.id.slice(cut + 1);
        if (tag === 'cold' || tag === 'ready') {
          // OA-5 state body `<typeId>_cold|ready.png`: replaces the body, so every frame is as wide as the footprint (a ready strip has 2 or more
          // frames in a row, cold is one) and as tall as a body may be.
          const type = getFurnitureType(name!.id.slice(0, cut));
          const fp = footprintSize(type, 'down');
          expect(strip.w % fp.w, 'a whole number of frames, each as wide as the footprint').toBe(0);
          if (tag === 'cold') expect(strip.w, 'cold = one frame').toBe(fp.w);
          else expect(strip.w / fp.w, 'ready = at least 2 frames').toBeGreaterThanOrEqual(2);
          expect(strip.h, 'height').toBeGreaterThanOrEqual(fp.d);
          expect(strip.h, 'height').toBeLessThanOrEqual(fp.d + type.height + 8);
          return;
        }
        // Any other animation strip `<typeId>_<tag>.png` (stove_fire, tap_stand_lever): equal frames in a row, no footprint rule.
        expect(strip.w % strip.h === 0 || strip.w > strip.h, 'a row of frames').toBe(true);
        return;
      }
      const type = getFurnitureType(name!.id); // throws for an unknown id
      expect(neededFacings(type), 'facing allowed').toContain(name!.variant);
      const { w, h, header } = sizeOf('furniture', file);
      expect(header).toEqual(PNG_SIGNATURE);
      const fp = footprintSize(type, name!.variant as Facing);
      expect(w, 'width = footprint width').toBe(fp.w);
      expect(h, 'height').toBeGreaterThanOrEqual(fp.d);
      // Footprint depth + the piece's height + at most 8 px of overhang.
      expect(h, 'height').toBeLessThanOrEqual(fp.d + type.height + 8);
    });
  }
});

describe('icon, block, floor, wall and plant sprite files', () => {
  const SIZES: Record<'icons' | 'blocks' | 'floors' | 'walls', [number, number]> = { icons: [32, 32], blocks: [32, 32], floors: [64, 64], walls: [64, 64] };
  it('checks every file of the other kinds below (none yet is fine)', () => {
    expect(true).toBe(true);
  });
  const idOk = (kind: SpriteKind, id: string): boolean => {
    if (kind === 'icons') return known(() => getFurnitureType(id)) || isMaterialId(id) || !!getClothing(id) || known(() => getPiece(id as never)) || known(() => getGear(id as never)) || ['key', 'gems', 'gold'].includes(id);
    if (kind === 'blocks') return BLOCK_TYPES.some((b) => b.id === id);
    if (kind === 'plants') return CROP_TYPES.some((c) => c.id === id || c.seed === id) || BLOCK_TYPES.some((b) => b.id === id || b.seedId === id);
    return STYLE_TYPES.some((s) => s.id === id);
  };
  for (const kind of ['icons', 'blocks', 'floors', 'walls', 'plants'] as const) {
    for (const file of filesOf(kind)) {
      it(`${kind}/${file} has a valid name, a known id, a PNG header and the right size`, () => {
        const ref = parseSpritePath(`${kind}/${file}`);
        expect(ref, 'file name').not.toBeNull();
        expect(idOk(kind, ref!.id), `unknown id ${ref!.id}`).toBe(true);
        const { w, h, header } = sizeOf(kind, file);
        expect(header).toEqual(PNG_SIGNATURE);
        if (kind === 'plants') {
          expect(w).toBe(32);
          expect([32, 48]).toContain(h);
        } else {
          expect([w, h]).toEqual(SIZES[kind]);
        }
      });
    }
  }
});

describe('outdoors sprite files (dungeon, actors, lake; C11)', () => {
  it('the three kinds are known (no files yet is fine)', () => {
    for (const k of ['dungeon', 'actors', 'lake']) expect(SPRITE_KINDS as readonly string[]).toContain(k);
  });
  for (const kind of ['dungeon', 'actors', 'lake'] as const) {
    for (const file of filesOf(kind)) {
      it(`${kind}/${file} has a valid name, a PNG header and a size in whole art pixels`, () => {
        expect(parseSpritePath(`${kind}/${file}`), 'file name').not.toBeNull();
        const { w, h, header } = sizeOf(kind, file);
        expect(header).toEqual(PNG_SIGNATURE);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
      });
    }
  }
});
