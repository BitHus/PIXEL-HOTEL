import { describe, expect, it } from 'vitest';
import { BUILD_CELL, NAV_CELL } from './config.ts';
import { pathLength } from './avatar.ts';
import { buildNavGrid, cellRect, findPath, isCellFree, segmentTouchesRect } from './nav.ts';
import { createRoom } from './room.ts';
import type { Point, Rect } from './types.ts';

const room = createRoom(1, 'hotel', 1, 1); // 18 x 12 cells (576 x 384)

/** Distance from a point to a rectangle (0 inside). */
function distToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Points every 0.5 px along the path. */
function samples(path: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    for (let k = 0; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

const wallA: Rect = { x: 192, y: 0, w: 32, h: 288 }; // one column, gap at the bottom (rows 9..11)
const wallB: Rect = { x: 352, y: 96, w: 32, h: 288 }; // one column, gap at the top (rows 0..2)
const from = { x: 100, y: 100 };
const to = { x: 500, y: 100 };

describe('buildNavGrid (BG1: the nav grid is the build grid)', () => {
  it('covers the floor with BUILD_CELL cells, all free in an empty room', () => {
    expect(NAV_CELL).toBe(BUILD_CELL);
    const grid = buildNavGrid(room, []);
    expect(grid.cell).toBe(32);
    expect(grid.cols).toBe(18);
    expect(grid.rows).toBe(12);
    expect(grid.blocked.every((b) => !b)).toBe(true);
  });

  it('blocks every cell a blocker touches (no avatar radius); a cell it only touches at the edge stays free', () => {
    const grid = buildNavGrid(room, [{ x: 100, y: 100, w: 20, h: 20 }]); // inside cell (3, 3)
    expect(isCellFree(grid, 3, 3)).toBe(false);
    for (const [c, r] of [[2, 3], [4, 3], [3, 2], [3, 4], [2, 2], [4, 4]] as const) expect(isCellFree(grid, c, r)).toBe(true);
    // A whole-cell blocker blocks exactly its cells, also when it fills them to the edge.
    const two = buildNavGrid(room, [{ x: 64, y: 64, w: 64, h: 32 }]);
    expect(two.blocked.filter(Boolean)).toHaveLength(2);
    expect(isCellFree(two, 2, 2)).toBe(false);
    expect(isCellFree(two, 3, 2)).toBe(false);
    expect(isCellFree(two, 4, 2)).toBe(true);
  });
});

describe('findPath', () => {
  it('goes straight in an empty room', () => {
    const path = findPath(buildNavGrid(room, []), from, to);
    expect(path).toEqual([from, to]);
  });

  it('a path around one rectangle is shorter than around two', () => {
    const one = findPath(buildNavGrid(room, [wallA]), from, to);
    const two = findPath(buildNavGrid(room, [wallA, wallB]), from, to);
    expect(one).not.toBeNull();
    expect(two).not.toBeNull();
    expect(pathLength(one!)).toBeLessThan(pathLength(two!));
    expect(pathLength(one!)).toBeGreaterThan(Math.hypot(to.x - from.x, to.y - from.y));
  });

  it('never enters a blocked cell', () => {
    const blockers = [wallA, wallB, { x: 256, y: 128, w: 32, h: 64 }];
    const grid = buildNavGrid(room, blockers);
    for (const target of [to, { x: 300, y: 350 }, { x: 540, y: 30 }, { x: 250, y: 40 }]) {
      const path = findPath(grid, from, target);
      expect(path).not.toBeNull();
      for (const p of samples(path!)) {
        expect(isCellFree(grid, Math.floor(p.x / grid.cell), Math.floor(p.y / grid.cell)), `${p.x},${p.y}`).toBe(true);
      }
    }
  });

  it('smoothing never cuts through a blocked cell', () => {
    const blockers = [wallA, wallB, { x: 96, y: 192, w: 64, h: 32 }];
    const grid = buildNavGrid(room, blockers);
    const path = findPath(grid, { x: 40, y: 360 }, to)!;
    expect(path.length).toBeGreaterThan(2);
    for (let i = 1; i < path.length; i++) {
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          if (!isCellFree(grid, c, r)) expect(segmentTouchesRect(path[i - 1]!, path[i]!, cellRect(grid, c, r))).toBe(false);
        }
      }
    }
  });

  it('a gap of ONE free cell is walkable, at every row of the wall', () => {
    for (let row = 1; row <= 9; row++) {
      const y = row * 32;
      const blockers = [
        { x: 288, y: 0, w: 32, h: y },
        { x: 288, y: y + 32, w: 32, h: 384 - y - 32 },
      ];
      const path = findPath(buildNavGrid(room, blockers), from, to);
      expect(path, `gap at row ${row}`).not.toBeNull();
      // And it really goes through the gap.
      expect(samples(path!).some((p) => p.x > 288 && p.x < 320 && p.y > y && p.y < y + 32), `gap at row ${row}`).toBe(true);
    }
  });

  it('a gap that is not a whole free cell never works: blockers off the grid block whole cells', () => {
    // 40 px between two bars: whichever way they sit, the cells they touch leave no free cell between them.
    for (let y = 160; y < 192; y += 4) {
      const blockers = [
        { x: 288, y: 0, w: 32, h: y },
        { x: 288, y: y + 40, w: 32, h: 384 - y - 40 },
      ];
      const path = findPath(buildNavGrid(room, blockers), from, to);
      const open = Math.floor((y + 40) / 32) - Math.ceil(y / 32); // whole cells strictly between
      expect(path === null, `gap at ${y}`).toBe(open < 1);
    }
  });

  it('finds a path across the biggest room quickly', () => {
    const big = createRoom(2, 'hotel', 3, 1); // 26 x 18 cells
    const blockers = Array.from({ length: 12 }, (_, i) => ({ x: 64 + i * 64, y: i % 2 ? 0 : 128, w: 32, h: 448 }));
    const grid = buildNavGrid(big, blockers);
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) expect(findPath(grid, { x: 20, y: 300 }, { x: 810, y: 300 })).not.toBeNull();
    expect((Date.now() - t0) / 20).toBeLessThan(50);
  });

  it('an unreachable target returns null', () => {
    const grid = buildNavGrid(room, [{ x: 288, y: 0, w: 32, h: 384 }]);
    expect(findPath(grid, from, to)).toBeNull();
  });

  it('a blocked target walks to the centre of the nearest free cell', () => {
    const block = { x: 384, y: 64, w: 96, h: 96 };
    const grid = buildNavGrid(room, [block]);
    const path = findPath(grid, from, { x: 430, y: 110 })!;
    expect(path).not.toBeNull();
    const end = path[path.length - 1]!;
    const c = { c: Math.floor(end.x / 32), r: Math.floor(end.y / 32) };
    expect(isCellFree(grid, c.c, c.r)).toBe(true);
    expect(end).toEqual({ x: c.c * 32 + 16, y: c.r * 32 + 16 });
    expect(distToRect(end, block)).toBeCloseTo(16, 5);
  });

  it('a tap outside the floor walks to the nearest free cell on the floor', () => {
    const path = findPath(buildNavGrid(room, []), from, { x: 100, y: -40 })!;
    expect(path[path.length - 1]).toEqual({ x: 112, y: 16 });
  });
});
