import { describe, expect, it } from 'vitest';
import { AVATAR_RADIUS, NAV_CELL } from './config.ts';
import { pathLength } from './avatar.ts';
import { buildNavGrid, findPath, inflateRect, isCellFree, segmentTouchesRect } from './nav.ts';
import { createRoom } from './room.ts';
import type { Point, Rect } from './types.ts';

const room = createRoom(1, 'hotel', 1, 1); // 576 x 384

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

const wallA: Rect = { x: 200, y: 0, w: 16, h: 300 }; // gap at the bottom
const wallB: Rect = { x: 360, y: 84, w: 16, h: 300 }; // gap at the top
const from = { x: 100, y: 100 };
const to = { x: 500, y: 100 };

describe('buildNavGrid', () => {
  it('covers the floor with NAV_CELL cells, all free in an empty room', () => {
    const grid = buildNavGrid(room, []);
    expect(grid.cols).toBe(room.w / NAV_CELL);
    expect(grid.rows).toBe(room.h / NAV_CELL);
    expect(grid.blocked.every((b) => !b)).toBe(true);
  });

  it('blocks cells that overlap a blocker grown by the avatar radius', () => {
    const grid = buildNavGrid(room, [{ x: 100, y: 100, w: 20, h: 20 }]);
    // Grown rect runs 96..124: cells 12..15 (96..128) are blocked, 11 and 16 are free.
    expect(isCellFree(grid, 13, 13)).toBe(false);
    expect(isCellFree(grid, 12, 13)).toBe(false);
    expect(isCellFree(grid, 15, 13)).toBe(false);
    expect(isCellFree(grid, 11, 13)).toBe(true);
    expect(isCellFree(grid, 16, 13)).toBe(true);
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

  it('never gets closer to a blocker than the avatar radius', () => {
    const blockers = [wallA, wallB, { x: 260, y: 150, w: 40, h: 40 }];
    const grid = buildNavGrid(room, blockers);
    for (const target of [to, { x: 300, y: 350 }, { x: 540, y: 30 }, { x: 250, y: 40 }]) {
      const path = findPath(grid, from, target);
      expect(path).not.toBeNull();
      for (const p of samples(path!)) {
        for (const b of blockers) expect(distToRect(p, b)).toBeGreaterThanOrEqual(AVATAR_RADIUS - 1e-9);
      }
    }
  });

  it('smoothing never cuts through a blocker', () => {
    const blockers = [wallA, wallB, { x: 100, y: 200, w: 60, h: 20 }];
    const grid = buildNavGrid(room, blockers);
    const path = findPath(grid, { x: 40, y: 360 }, to)!;
    expect(path.length).toBeGreaterThan(2);
    for (let i = 1; i < path.length; i++) {
      for (const b of blockers) {
        expect(segmentTouchesRect(path[i - 1]!, path[i]!, inflateRect(b, AVATAR_RADIUS - 0.01))).toBe(false);
      }
    }
  });

  it('never squeezes through a gap of 12 px', () => {
    // Two bars with a 12 px gap between them, across the whole room, at every alignment.
    for (let y = 176; y < 184; y++) {
      const blockers = [
        { x: 280, y: 0, w: 16, h: y },
        { x: 280, y: y + 12, w: 16, h: 384 - y - 12 },
      ];
      expect(findPath(buildNavGrid(room, blockers), from, to), `gap at ${y}`).toBeNull();
    }
  });

  it('a gap of 24 px between two items is walkable at every 4 px alignment (owner, after 9d)', () => {
    for (let y = 160; y <= 192; y += 4) {
      const blockers = [
        { x: 280, y: 0, w: 16, h: y },
        { x: 280, y: y + 24, w: 16, h: 384 - y - 24 },
      ];
      const path = findPath(buildNavGrid(room, blockers), from, to);
      expect(path, `gap at ${y}`).not.toBeNull();
      // And it really goes through the gap.
      expect(samples(path!).some((p) => p.x > 280 && p.x < 296 && p.y > y && p.y < y + 24)).toBe(true);
    }
  });

  it('finds a path across the biggest room quickly', () => {
    const big = createRoom(2, 'hotel', 3, 1); // 832 x 576: 104 x 72 cells
    const blockers = Array.from({ length: 12 }, (_, i) => ({ x: 60 + i * 60, y: i % 2 ? 0 : 120, w: 20, h: 440 }));
    const grid = buildNavGrid(big, blockers);
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) expect(findPath(grid, { x: 20, y: 300 }, { x: 810, y: 300 })).not.toBeNull();
    expect((Date.now() - t0) / 20).toBeLessThan(50);
  });

  it('an unreachable target returns null', () => {
    const grid = buildNavGrid(room, [{ x: 280, y: 0, w: 16, h: 384 }]);
    expect(findPath(grid, from, to)).toBeNull();
  });

  it('a blocked target walks to the nearest free spot', () => {
    const block = { x: 400, y: 60, w: 80, h: 80 };
    const grid = buildNavGrid(room, [block]);
    const path = findPath(grid, from, { x: 440, y: 100 })!;
    expect(path).not.toBeNull();
    const end = path[path.length - 1]!;
    expect(distToRect(end, block)).toBeGreaterThanOrEqual(AVATAR_RADIUS);
    expect(distToRect(end, block)).toBeLessThan(AVATAR_RADIUS + NAV_CELL);
  });

  it('a tap outside the floor walks to the nearest free spot on the floor', () => {
    const path = findPath(buildNavGrid(room, []), from, { x: 100, y: -40 })!;
    expect(path[path.length - 1]).toEqual({ x: 100, y: 4 });
  });
});
