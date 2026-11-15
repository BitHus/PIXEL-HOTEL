import { describe, expect, it } from 'vitest';
import { ICON_SHAPES, PALETTE, RANK_COLORS, iconGroups, paletteColor, type Icon } from '@pixel-hotel/shared';
import { ICON_SIZE, drawnShapes, iconPixels } from './iconPixels.ts';

const at = (px: (string | null)[], x: number, y: number): string | null => px[y * ICON_SIZE + x] ?? null;
const filled = (px: (string | null)[]): number => px.filter((c) => c !== null).length;

describe('iconPixels', () => {
  it('draws every shape in the shared list', () => {
    expect(drawnShapes()).toEqual([...ICON_SHAPES]);
  });

  for (const shape of ICON_SHAPES) {
    it(`${shape}: readable, inside the square, with an outline`, () => {
      const px = iconPixels({ shape, colors: ['orange', 'gold'] });
      expect(px.length).toBe(ICON_SIZE * ICON_SIZE);
      expect(filled(px)).toBeGreaterThan(60);
      expect(filled(px)).toBeLessThan(ICON_SIZE * ICON_SIZE * 0.85);
      // The outer ring stays free (the rank frame goes there).
      for (let i = 0; i < ICON_SIZE; i++) {
        for (const [x, y] of [[i, 0], [i, ICON_SIZE - 1], [0, i], [ICON_SIZE - 1, i]] as const) expect(at(px, x, y), `${shape} ${x},${y}`).toBeNull();
      }
      expect(px).toContain(paletteColor('outline'));
    });
  }

  it('is deterministic and only whole pixels (no alpha, no smoothing)', () => {
    const icon: Icon = { shape: 'gem', colors: ['cyan', 'sky'] };
    expect(iconPixels(icon)).toEqual(iconPixels(icon));
    for (const c of iconPixels(icon)) if (c) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('light from the top-left: the top-left edge of a block is lighter than its bottom-right edge', () => {
    const px = iconPixels({ shape: 'block', colors: ['clay', 'sand'] });
    const lum = (hex: string): number => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    // The front face spans x 5..26, y 10..26: its left edge column vs its right edge column.
    expect(lum(at(px, 5, 20)!)).toBeGreaterThan(lum(at(px, 26, 20)!));
  });

  it('colours change the pixels, the shape alone does not make two items the same', () => {
    expect(iconPixels({ shape: 'ore', colors: ['clay', 'orange'] })).not.toEqual(iconPixels({ shape: 'ore', colors: ['steel', 'slate'] }));
    expect(iconPixels({ shape: 'ore', colors: ['clay', 'orange'] })).not.toEqual(iconPixels({ shape: 'root', colors: ['orange', 'green'] }));
  });

  it('a rank puts a 1 px frame in the rank colour and leaves the shape alone', () => {
    const icon: Icon = { shape: 'bar', colors: ['orange', 'gold'] };
    const plain = iconPixels(icon);
    const framed = iconPixels(icon, 'legendary');
    expect(at(framed, 0, 0)).toBe(PALETTE[RANK_COLORS.legendary]);
    expect(at(framed, ICON_SIZE - 1, 13)).toBe(PALETTE[RANK_COLORS.legendary]);
    expect(framed.filter((c, i) => c !== plain[i]).length).toBe(ICON_SIZE * 4 - 4);
    expect(iconPixels(icon, 'common')[0]).toBe(PALETTE[RANK_COLORS.common]);
  });

  it('every item of a group draws differently (shape + colours are not the only difference)', () => {
    for (const [group, items] of Object.entries(iconGroups())) {
      const seen = new Set<string>();
      for (const { id, icon } of items) {
        const sig = iconPixels(icon).join('');
        expect(seen.has(sig), `${group}/${id}`).toBe(false);
        seen.add(sig);
      }
    }
  });
});
