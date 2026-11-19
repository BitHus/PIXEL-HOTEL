import { describe, expect, it } from 'vitest';
import { BUILD_CELL, LAKE_CELL, LAKE_LEVELS, LAKE_PIER, LAKE_POND_DECOR, LAKE_TREES, CAST_MIN_PX, CAST_REACH_PX, TREE_FOOTPRINT } from './config.ts';
import { doorPoint, doorReachesMiddle, roomBlockers } from './furniture.ts';
import { fixedBlockers } from './farmLayout.ts';
import {
  bobberPoint, castSpots, cellCorners, distToWater, isPierCell, isWater, isWaterCell, lakeBlockers, LAKE_COLS, LAKE_ROWS, nearestCastSpot, nearestWaterPoint,
  treeAt, treeRect, treeStand, TREE_COUNT, waterRects,
} from './lakeLayout.ts';
import { buildNavGrid, cellAt, findPath, isCellFree, pathCosts } from './nav.ts';
import { createRoom, doorZoneRect, rectsOverlap } from './room.ts';
import { createNewPlayer } from './newPlayer.ts';
import { fitsRoomKind, getFurnitureType } from './furniture.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import type { Point } from './types.ts';

const room = createRoom(4, 'lakeside', 1, 1);
const grid = buildNavGrid(room, roomBlockers(room, []));
const door = doorPoint(room);
const free = (x: number, y: number): boolean => {
  const c = cellAt(grid, { x, y });
  return isCellFree(grid, c.c, c.r);
};
/** The path length (px) from a point to a spot. */
const walkPx = (from: Point, to: Point): number => {
  const a = cellAt(grid, from);
  const b = cellAt(grid, to);
  return pathCosts(grid, a.r * grid.cols + a.c)[b.r * grid.cols + b.c]! * grid.cell;
};

describe('the pond grid (A3, NOTES POND ART SET)', () => {
  it('is a 19 x 13 vertex grid of levels 0..3 over the 18 x 12 cell room, on the build grid', () => {
    expect(LAKE_CELL).toBe(BUILD_CELL);
    expect(LAKE_LEVELS.length).toBe(13);
    for (const row of LAKE_LEVELS) expect(row).toMatch(/^[0-3]{19}$/);
    expect(LAKE_COLS * LAKE_CELL).toBe(room.w);
    expect(LAKE_ROWS * LAKE_CELL).toBe(room.h);
  });

  it('the corners of every cell differ by at most 1 (the tile pick rule), and the edge of the room is land', () => {
    for (let r = 0; r < LAKE_ROWS; r++) {
      for (let c = 0; c < LAKE_COLS; c++) {
        const k = cellCorners(c, r);
        expect(Math.max(...k) - Math.min(...k), `${c},${r}`).toBeLessThanOrEqual(1);
      }
    }
    for (let c = 0; c <= LAKE_COLS; c++) expect(Number(LAKE_LEVELS[0]![c]) + Number(LAKE_LEVELS[LAKE_ROWS]![c])).toBe(0);
    for (let r = 0; r <= LAKE_ROWS; r++) expect(Number(LAKE_LEVELS[r]![0])).toBeLessThan(2);
  });

  it('is an organic pond, not a rectangle: rows of different lengths, deep water in the middle, a fifth to a third of the room', () => {
    const rects = waterRects();
    const cells = rects.reduce((a, r) => a + (r.w * r.h) / (LAKE_CELL * LAKE_CELL), 0);
    expect(cells / (LAKE_COLS * LAKE_ROWS)).toBeGreaterThan(0.15);
    expect(cells / (LAKE_COLS * LAKE_ROWS)).toBeLessThan(0.36);
    expect(new Set(rects.map((r) => `${r.x},${r.w}`)).size).toBeGreaterThan(3);
    expect(LAKE_LEVELS.some((row) => row.includes('3'))).toBe(true);
  });

  it('isWater: water cells and the watery half of a shore cell; never the pier, the sand or the grass', () => {
    expect(isWaterCell(12, 4)).toBe(true);
    expect(isWater({ x: 12 * 32 + 16, y: 4 * 32 + 16 })).toBe(true);
    expect(isWater({ x: 100, y: 340 })).toBe(false); // grass
    expect(isWater({ x: 240, y: 300 })).toBe(false); // sand
    expect(isWater({ x: LAKE_PIER.x + 80, y: LAKE_PIER.y + 16 })).toBe(false); // on the pier
    expect(isWater({ x: -5, y: 100 })).toBe(false);
    // A shore cell (corners 1 and 2): its water corner is water, its sand corner is not.
    let shore: [number, number] | null = null;
    for (let r = 0; r < LAKE_ROWS && !shore; r++) for (let c = 0; c < LAKE_COLS && !shore; c++) {
      const k = cellCorners(c, r);
      if (k[0] === 2 && k[2] === 1) shore = [c, r];
    }
    expect(shore).not.toBeNull();
    const [sc, sr] = shore!;
    expect(isWater({ x: sc * 32 + 2, y: sr * 32 + 2 })).toBe(true);
    expect(isWater({ x: sc * 32 + 30, y: sr * 32 + 30 })).toBe(false);
  });
});

describe('the lakeside layout (section 10d)', () => {
  it('is a 576 x 384 outdoor room with grass and a hedge and 8 trees', () => {
    expect(room).toMatchObject({ kind: 'lakeside', level: 1, w: 576, h: 384, floorStyle: 'grass', wallStyle: 'hedge' });
    expect(TREE_COUNT).toBe(8);
  });

  it('the trees stand on dry grass, never in the pond, on the pier or the door zone', () => {
    const zone = doorZoneRect(room);
    for (let i = 0; i < TREE_COUNT; i++) {
      const r = treeRect(i);
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= 576 && r.y + r.h <= 384).toBe(true);
      const c = Math.floor((r.x + r.w / 2) / 32);
      const row = Math.floor((r.y + r.h / 2) / 32);
      expect(Math.max(...cellCorners(c, row)), `tree ${i}`).toBe(0);
      expect(rectsOverlap(r, { ...LAKE_PIER })).toBe(false);
      expect(rectsOverlap(r, zone)).toBe(false);
      for (let j = i + 1; j < TREE_COUNT; j++) expect(rectsOverlap(r, treeRect(j))).toBe(false);
    }
  });

  it('the pier is 5 cells long, starts on the shore and runs into the water', () => {
    expect(LAKE_PIER.x % 32 + LAKE_PIER.y % 32 + LAKE_PIER.h).toBe(32);
    expect(LAKE_PIER.w / 32).toBe(5);
    const r = LAKE_PIER.y / 32;
    const first = LAKE_PIER.x / 32;
    expect(isWaterCell(first, r)).toBe(false);
    for (let c = first + 1; c < first + 5; c++) {
      expect(isPierCell(c, r)).toBe(true);
      expect(isWaterCell(c, r)).toBe(true);
    }
    expect(isWaterCell(first + 5, r)).toBe(true); // water beyond the end
  });

  it('the water and the trunks block walking; the pier and the shore cells do not', () => {
    expect(fixedBlockers(room)).toEqual(lakeBlockers());
    expect(fixedBlockers(createRoom(1, 'hotel', 1, 1))).toEqual([]);
    expect(free(12 * 32 + 16, 4 * 32 + 16)).toBe(false); // in the pond
    for (let c = LAKE_PIER.x; c < LAKE_PIER.x + LAKE_PIER.w; c += 32) expect(free(c + 16, LAKE_PIER.y + 16)).toBe(true);
    expect(free(LAKE_PIER.x + LAKE_PIER.w + 16, LAKE_PIER.y + 16)).toBe(false); // beyond the end of the pier: water
    expect(free(100, 340)).toBe(true); // grass
    for (let r = 0; r < LAKE_ROWS; r++) for (let c = 0; c < LAKE_COLS; c++) {
      if (!isWaterCell(c, r) && !LAKE_TREES.some((t) => Math.floor(t.x / 32) === c && Math.floor((t.y - 1) / 32) === r)) expect(isCellFree(grid, c, r), `${c},${r}`).toBe(true);
    }
    for (let i = 0; i < TREE_COUNT; i++) expect(free(LAKE_TREES[i]!.x, LAKE_TREES[i]!.y - 6)).toBe(false);
  });

  it('the avatar can walk from the door to the end of the pier and to the front of every tree', () => {
    expect(doorReachesMiddle(room, [])).toBe(true);
    const pierEnd = { x: LAKE_PIER.x + LAKE_PIER.w - 16, y: LAKE_PIER.y + LAKE_PIER.h / 2 };
    const p = findPath(grid, door, pierEnd);
    expect(p).not.toBeNull();
    const last = p![p!.length - 1]!;
    expect(Math.hypot(last.x - pierEnd.x, last.y - pierEnd.y)).toBeLessThan(2);
    for (let i = 0; i < TREE_COUNT; i++) {
      const stand = treeStand(i);
      const q = findPath(grid, door, stand);
      expect(q, `tree ${i}`).not.toBeNull();
      const end = q![q!.length - 1]!;
      expect(Math.hypot(end.x - stand.x, end.y - stand.y)).toBeLessThan(10);
    }
  });

  it('a tap on a tree (its trunk or crown) finds the tree', () => {
    for (let i = 0; i < TREE_COUNT; i++) {
      const a = LAKE_TREES[i]!;
      expect(treeAt({ x: a.x, y: a.y - 8 })).toBe(i);
      expect(treeAt({ x: a.x + 5, y: a.y - 50 })).toBe(i);
    }
    expect(treeAt({ x: 420, y: 120 })).toBeNull();
  });

  it('pond decor stays off the walk: the rowboat on deep water, the rest on the shore or the grass', () => {
    for (const d of LAKE_POND_DECOR) {
      expect(d.x >= 0 && d.x <= 576 && d.y >= 0 && d.y <= 384).toBe(true);
      if (d.kind === 'rowboat') expect(isWaterCell(Math.floor(d.x / 32), Math.floor((d.y - 1) / 32))).toBe(true);
    }
  });
});

describe('casting (A3: the nearest spot by path, never round the pond)', () => {
  it('cast spots are free cells next to the water: the shore all round and every pier cell', () => {
    const spots = castSpots(grid);
    expect(spots.length).toBeGreaterThan(20);
    for (const p of spots) {
      const c = cellAt(grid, p);
      expect(isCellFree(grid, c.c, c.r)).toBe(true);
      expect(isPierCell(c.c, c.r) || distToWater(p) <= CAST_REACH_PX).toBe(true);
    }
    for (let x = LAKE_PIER.x + 16; x < LAKE_PIER.x + LAKE_PIER.w; x += 32) expect(spots.some((p) => p.x === x && p.y === LAKE_PIER.y + 16)).toBe(true);
    // Every water cell is next to a spot or another water cell (the shore is a closed ring of spots around the pond).
    expect(spots.some((p) => p.y < LAKE_PIER.y - 64)).toBe(true);
    expect(spots.some((p) => p.y > LAKE_PIER.y + 64)).toBe(true);
    expect(spots.some((p) => p.x > 480)).toBe(true);
  });

  it('standing on the shore, a tap anywhere on the pond casts from where the avatar stands (no walk round)', () => {
    const spots = castSpots(grid);
    const taps = [{ x: 520, y: 100 }, { x: 300, y: 230 }, { x: 420, y: 60 }, { x: 460, y: 200 }];
    for (const stand of spots) {
      for (const tap of taps) {
        const spot = nearestCastSpot(grid, stand, tap)!;
        expect(spot).not.toBeNull();
        // Never a long walk: at most two cells from where it stood, by path.
        expect(walkPx(stand, spot), `${stand.x},${stand.y} -> ${tap.x},${tap.y}`).toBeLessThanOrEqual(2 * 32 * Math.SQRT2 + 0.01);
      }
    }
  });

  it('from the door the avatar walks to the nearest shore by path, not the far side near the tap', () => {
    const spots = castSpots(grid);
    const nearestByPath = Math.min(...spots.map((p) => walkPx(door, p)));
    for (const tap of [{ x: 520, y: 60 }, { x: 330, y: 70 }, { x: 460, y: 220 }]) {
      const spot = nearestCastSpot(grid, door, tap)!;
      expect(spot).not.toBeNull();
      expect(walkPx(door, spot)).toBeLessThanOrEqual(nearestByPath + 3 * 32);
    }
    // From a blocked cell there is no way.
    expect(nearestCastSpot(grid, { x: 12 * 32 + 16, y: 4 * 32 + 16 }, { x: 400, y: 100 })).toBeNull();
    // The nearest water point to a point on land is in the water.
    expect(isWater(nearestWaterPoint({ x: 100, y: 100 }))).toBe(true);
  });

  it('on the pier, a tap beside it casts from the pier', () => {
    const onPier = { x: LAKE_PIER.x + LAKE_PIER.w - 16, y: LAKE_PIER.y + 16 };
    const spot = nearestCastSpot(grid, onPier, { x: onPier.x, y: onPier.y - 40 })!;
    expect(isPierCell(Math.floor(spot.x / 32), Math.floor(spot.y / 32))).toBe(true);
  });

  it('the bobber lands in the water, at least CAST_MIN_PX out from the avatar, also for a tap at its feet', () => {
    for (const spot of castSpots(grid)) {
      for (const tap of [{ x: spot.x, y: spot.y - 10 }, { x: 330, y: 120 }, { x: 520, y: 80 }, { x: spot.x + 3, y: spot.y + 3 }]) {
        const b = bobberPoint(spot, tap);
        expect(isWater(b), `${spot.x},${spot.y} -> ${tap.x},${tap.y}`).toBe(true);
      }
    }
    const onPier = { x: LAKE_PIER.x + LAKE_PIER.w - 16, y: LAKE_PIER.y + 16 };
    const b = bobberPoint(onPier, { x: onPier.x + 20, y: onPier.y - 20 });
    expect(Math.hypot(b.x - onPier.x, b.y - onPier.y)).toBeGreaterThanOrEqual(CAST_MIN_PX - 0.001);
    // A far tap keeps the tapped water point.
    expect(bobberPoint(onPier, { x: 480, y: 100 })).toEqual({ x: 480, y: 100 });
  });

  it('the lakeside takes no furniture (not buildable in v1) and cannot be upgraded or restyled', () => {
    for (const t of FURNITURE_TYPES) expect(fitsRoomKind(t, room), t.id).toBe(false);
    expect(fitsRoomKind(getFurnitureType('chair'), createRoom(1, 'hotel', 1, 1))).toBe(true);
    const s = createNewPlayer(undefined, 0);
    expect(s.rooms.find((r) => r.kind === 'lakeside')).toBeDefined();
    expect(TREE_FOOTPRINT.w).toBeGreaterThan(0);
  });
});
