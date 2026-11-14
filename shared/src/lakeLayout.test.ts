import { describe, expect, it } from 'vitest';
import { LAKE_PIER, LAKE_TREES, LAKE_WATER, CAST_MIN_PX, CAST_REACH_PX, TREE_FOOTPRINT } from './config.ts';
import { doorPoint, doorReachesMiddle, roomBlockers } from './furniture.ts';
import { fixedBlockers } from './farmLayout.ts';
import { bobberPoint, castSpots, distToWater, isWater, lakeBlockers, nearestCastSpot, nearestWaterPoint, treeAt, treeRect, treeStand, TREE_COUNT, waterRects } from './lakeLayout.ts';
import { buildNavGrid, cellAt, findPath, isCellFree } from './nav.ts';
import { createRoom, doorZoneRect, rectsOverlap } from './room.ts';
import { createNewPlayer } from './newPlayer.ts';
import { fitsRoomKind, getFurnitureType } from './furniture.ts';
import { FURNITURE_TYPES } from './furniture.ts';

const room = createRoom(4, 'lakeside', 1, 1);
const grid = buildNavGrid(room, roomBlockers(room, []));
const door = doorPoint(room);

describe('the lakeside layout (section 10d)', () => {
  it('is a 576 x 384 outdoor room with grass and a hedge; the lake is about a third of it', () => {
    expect(room).toMatchObject({ kind: 'lakeside', level: 1, w: 576, h: 384, floorStyle: 'grass', wallStyle: 'hedge' });
    const water = waterRects().reduce((a, r) => a + r.w * r.h, 0);
    expect(water / (576 * 384)).toBeGreaterThan(0.25);
    expect(water / (576 * 384)).toBeLessThan(0.36);
    expect(TREE_COUNT).toBe(8);
  });

  it('the water and the trees are on the floor, the trees never in the water, the pier or the door zone', () => {
    for (const w of LAKE_WATER) expect(w.x >= 0 && w.y >= 0 && w.x + w.w <= 576 && w.y + w.h <= 384).toBe(true);
    const zone = doorZoneRect(room);
    for (let i = 0; i < TREE_COUNT; i++) {
      const r = treeRect(i);
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= 576 && r.y + r.h <= 384).toBe(true);
      expect(waterRects().some((w) => rectsOverlap(r, w))).toBe(false);
      expect(rectsOverlap(r, { ...LAKE_PIER })).toBe(false);
      expect(rectsOverlap(r, zone)).toBe(false);
      for (let j = i + 1; j < TREE_COUNT; j++) expect(rectsOverlap(r, treeRect(j))).toBe(false);
    }
  });

  it('the water and the trunks block walking; the pier does not', () => {
    expect(fixedBlockers(room)).toEqual(lakeBlockers());
    expect(fixedBlockers(createRoom(1, 'hotel', 1, 1))).toEqual([]);
    const free = (x: number, y: number): boolean => {
      const c = cellAt(grid, { x, y });
      return isCellFree(grid, c.c, c.r);
    };
    expect(free(420, 100)).toBe(false); // in the lake
    expect(free(300, 168)).toBe(true); // on the pier
    expect(free(340, 168)).toBe(true); // out on the pier
    expect(free(420, 168)).toBe(false); // beyond the end of the pier: water
    expect(free(100, 340)).toBe(true); // grass
    for (let i = 0; i < TREE_COUNT; i++) expect(free(LAKE_TREES[i]!.x, LAKE_TREES[i]!.y - 6)).toBe(false);
    expect(isWater({ x: 420, y: 100 })).toBe(true);
    expect(isWater({ x: 300, y: 168 })).toBe(false);
  });

  it('the avatar can walk from the door to the end of the pier and to the front of every tree', () => {
    expect(doorReachesMiddle(room, [])).toBe(true);
    const pierEnd = { x: LAKE_PIER.x + LAKE_PIER.w - 12, y: LAKE_PIER.y + LAKE_PIER.h / 2 };
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

  it('cast spots are free cells next to the water, on the shore and on the pier', () => {
    const spots = castSpots(grid);
    expect(spots.length).toBeGreaterThan(20);
    for (const p of spots) {
      const c = cellAt(grid, p);
      expect(isCellFree(grid, c.c, c.r)).toBe(true);
      expect(distToWater(p)).toBeLessThanOrEqual(CAST_REACH_PX);
    }
    expect(spots.some((p) => p.x > LAKE_PIER.x + 40 && p.y > LAKE_PIER.y && p.y < LAKE_PIER.y + LAKE_PIER.h)).toBe(true);
    expect(spots.some((p) => p.x < 288 && (p.y < LAKE_PIER.y || p.y > LAKE_PIER.y + LAKE_PIER.h))).toBe(true); // the shore beside the pier
  });

  it('tapping the water: the nearest cast spot that can be reached; the pier for water beside it', () => {
    // A tap in the water just above the pier's end: the pier end is nearest.
    const target = { x: 340, y: 130 };
    const spot = nearestCastSpot(grid, door, target)!;
    expect(spot).not.toBeNull();
    expect(Math.hypot(spot.x - target.x, spot.y - target.y)).toBeLessThan(60);
    expect(spot.y).toBeGreaterThan(LAKE_PIER.y);
    expect(distToWater(spot)).toBeLessThanOrEqual(CAST_REACH_PX);
    // Far in the lake: still a spot on the shore or the pier.
    const far = nearestCastSpot(grid, door, { x: 540, y: 60 })!;
    expect(distToWater(far)).toBeLessThanOrEqual(CAST_REACH_PX);
    // From inside a blocked cell there is no way.
    expect(nearestCastSpot(grid, { x: 420, y: 100 }, target)).toBeNull();
    // The nearest water point to a point on land is in the water.
    expect(isWater(nearestWaterPoint({ x: 100, y: 100 }))).toBe(true);
  });

  it('the bobber lands in the water, at least CAST_MIN_PX out from the avatar, also for a tap at its feet', () => {
    for (const spot of castSpots(grid)) {
      for (const tap of [{ x: spot.x, y: spot.y - 10 }, { x: 330, y: 120 }, { x: 540, y: 60 }, { x: spot.x + 3, y: spot.y + 3 }]) {
        const b = bobberPoint(spot, tap);
        expect(isWater(b), `${spot.x},${spot.y} -> ${tap.x},${tap.y}`).toBe(true);
      }
    }
    const spot = nearestCastSpot(grid, door, { x: 330, y: 130 })!;
    const b = bobberPoint(spot, { x: 330, y: 130 });
    expect(Math.hypot(b.x - spot.x, b.y - spot.y)).toBeGreaterThanOrEqual(CAST_MIN_PX - 0.001);
    // A far tap keeps the tapped water point.
    expect(bobberPoint(spot, { x: 520, y: 80 })).toEqual({ x: 520, y: 80 });
  });

  it('the lakeside takes no furniture (not buildable in v1) and cannot be upgraded or restyled', () => {
    for (const t of FURNITURE_TYPES) expect(fitsRoomKind(t, room), t.id).toBe(false);
    expect(fitsRoomKind(getFurnitureType('chair'), createRoom(1, 'hotel', 1, 1))).toBe(true);
    const s = createNewPlayer(undefined, 0);
    expect(s.rooms.find((r) => r.kind === 'lakeside')).toBeDefined();
    expect(TREE_FOOTPRINT.w).toBeGreaterThan(0);
  });
});
