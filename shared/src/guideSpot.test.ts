import { describe, expect, it } from 'vitest';
import { guideFloorSpot } from './guideSpot.ts';
import { cellAt, isCellFree, type NavGrid } from './nav.ts';

const grid = (rows: string[]): NavGrid => ({
  cols: rows[0]!.length, rows: rows.length, cell: 32,
  blocked: rows.flatMap((r) => [...r].map((ch) => ch === '#')),
});

describe('guideFloorSpot', () => {
  const g = grid(['..........', '..........', '..........', '..........', '..........', '..........', '..........']);
  it('picks a free cell 2 to 4 cells away', () => {
    const p = guideFloorSpot(g, { x: 48, y: 112 }, { x: 160, y: 112 })!;
    const a = cellAt(g, { x: 48, y: 112 });
    const s = cellAt(g, p);
    expect(isCellFree(g, s.c, s.r)).toBe(true);
    const d = Math.max(Math.abs(s.c - a.c), Math.abs(s.r - a.r));
    expect(d).toBeGreaterThanOrEqual(2);
    expect(d).toBeLessThanOrEqual(4);
    expect(p.x).toBeGreaterThan(48); // leans toward the middle
  });
  it('never picks a cell behind a wall of blocks', () => {
    const w = grid(['..#.....', '..#.....', '..#.....', '..#.....']);
    const p = guideFloorSpot(w, { x: 48, y: 48 }, { x: 200, y: 48 });
    if (p) expect(cellAt(w, p).c).toBeLessThan(2);
  });
  it('is null when the avatar stands on a blocked cell', () => {
    expect(guideFloorSpot(grid(['#..', '...', '...']), { x: 16, y: 16 }, { x: 48, y: 48 })).toBeNull();
  });
});
