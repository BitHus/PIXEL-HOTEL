import { describe, expect, it } from 'vitest';
import { cellCorners, LAKE_COLS, LAKE_ROWS } from '@pixel-hotel/shared';
import { driftFrame, pickPondTile, tileFrame } from './pondTiles.ts';

describe('pond tile pick (NOTES POND ART SET)', () => {
  it('solid cells: grass = no tile (the floor shows), sand, shallow and deep water (the water ones drift)', () => {
    expect(pickPondTile([0, 0, 0, 0])).toBeNull();
    expect(pickPondTile([1, 1, 1, 1])).toEqual({ sheet: 'tiles_grass_sand_cut', idx: 0, drift: null });
    expect(pickPondTile([2, 2, 2, 2])).toEqual({ sheet: 'tiles_sand_water', idx: 0, drift: 'shallow' });
    expect(pickPondTile([3, 3, 3, 3])).toEqual({ sheet: 'tiles_shallow_deep', idx: 0, drift: 'deep' });
  });

  it('mixed cells: the sheet of the lower level, a bit per corner (NW 1, NE 2, SE 4, SW 8) where the corner is that level', () => {
    expect(pickPondTile([0, 1, 1, 1])).toEqual({ sheet: 'tiles_grass_sand_cut', idx: 1, drift: null });
    expect(pickPondTile([1, 1, 2, 2])).toEqual({ sheet: 'tiles_sand_water', idx: 3, drift: null });
    expect(pickPondTile([3, 2, 3, 2])).toEqual({ sheet: 'tiles_shallow_deep', idx: 10, drift: null });
    expect(() => pickPondTile([0, 2, 2, 2])).toThrow();
  });

  it('every cell of the lakeside grid has a valid tile', () => {
    for (let r = 0; r < LAKE_ROWS; r++) for (let c = 0; c < LAKE_COLS; c++) {
      const t = pickPondTile(cellCorners(c, r));
      if (t) expect(t.idx >= 0 && t.idx <= 15).toBe(true);
    }
  });

  it('tile frames and drift phases', () => {
    expect(tileFrame(0)).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    expect(tileFrame(7)).toEqual({ x: 96, y: 32, w: 32, h: 32 });
    expect(tileFrame(15)).toEqual({ x: 96, y: 96, w: 32, h: 32 });
    const a = driftFrame(3, 4, 0);
    expect(driftFrame(3, 4, 250)).toBe((a + 1) % 4);
    const phases = new Set(Array.from({ length: 12 }, (_, i) => driftFrame(i, 2, 0)));
    expect(phases.size).toBeGreaterThan(1);
  });
});
