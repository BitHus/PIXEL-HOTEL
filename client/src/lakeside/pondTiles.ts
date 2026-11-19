// POND (A3, docs/NOTES.md POND ART SET): which tile of the corner-mask (Wang) sheets a lakeside cell shows. Pure; the art
// sheets are client/src/assets/sprites/lake/tiles_*.png (4 x 4 cells of 32 px, mask order). The grass-sand sheet is the CUT one
// (tools/pond-shore-cut.mjs: its grass is transparent), so the room's own grass floor shows around the pond, never tile grass.

/** The three transition sheets, by the lower level of a cell (0 grass-sand, 1 sand-water, 2 shallow-deep). */
export const POND_SHEETS = ['tiles_grass_sand_cut', 'tiles_sand_water', 'tiles_shallow_deep'] as const;
export type PondSheet = (typeof POND_SHEETS)[number];

export interface PondTile {
  sheet: PondSheet;
  /** 0..15: bit 1 NW, 2 NE, 4 SE, 8 SW set when that corner is the UPPER terrain (the lower level number). */
  idx: number;
  /** Solid water cells animate with the drift strip of this water; rim tiles stay still. */
  drift: 'shallow' | 'deep' | null;
}

/**
 * The tile for a cell with corner levels [NW, NE, SE, SW] (0 grass, 1 sand, 2 shallow, 3 deep), or null for plain grass (the
 * floor shows). Throws when the corners differ by more than 1 (the grid is checked by the tests).
 */
export function pickPondTile(corners: readonly [number, number, number, number]): PondTile | null {
  const lo = Math.min(...corners);
  const hi = Math.max(...corners);
  if (hi - lo > 1) throw new Error(`pond cell corners differ by more than 1: ${corners.join(',')}`);
  if (lo === hi) {
    if (lo <= 0) return null;
    if (lo === 1) return { sheet: 'tiles_grass_sand_cut', idx: 0, drift: null };
    if (lo === 2) return { sheet: 'tiles_sand_water', idx: 0, drift: 'shallow' };
    return { sheet: 'tiles_shallow_deep', idx: 0, drift: 'deep' };
  }
  const idx = corners.reduce((m, v, i) => m | ((v === lo ? 1 : 0) << i), 0);
  return { sheet: POND_SHEETS[lo]!, idx, drift: null };
}

/** The source rectangle of tile `idx` in a 4 x 4 sheet of `size` px cells. */
export function tileFrame(idx: number, size = 32): { x: number; y: number; w: number; h: number } {
  return { x: (idx % 4) * size, y: Math.floor(idx / 4) * size, w: size, h: size };
}

/** The drift frame of a solid water cell: its own phase (a hash of the cell) so the pond does not blink in unison. */
export function driftFrame(c: number, r: number, clockMs: number, frames = 4, frameMs = 250): number {
  const phase = ((c * 73856093) ^ (r * 19349663)) >>> 0;
  return (Math.floor(clockMs / frameMs) + phase) % frames;
}
