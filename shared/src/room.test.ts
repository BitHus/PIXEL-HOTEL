import { describe, expect, it } from 'vitest';
import { DOOR_WIDTH, DOOR_ZONE_H, DOOR_ZONE_W, ROOM_GRID, SIDE_BORDER, WALL_BAND } from './config.ts';
import {
  ROOM_SHAPES,
  borderRects,
  createRoom,
  doorRect,
  doorX,
  doorY,
  doorZoneRect,
  floorRect,
  floorRects,
  rectInside,
  rectInsideFloor,
  rectsOverlap,
  roomAtLevel,
  roomBoundsRect,
  shapesFor,
  wallBands,
  type Room,
} from './room.ts';

const LEVELS = [1, 2, 3] as const;
const allRooms: Room[] = ROOM_SHAPES.flatMap((s) =>
  LEVELS.map((level) => createRoom(1, s.kind === 'shop' ? 'shop' : 'hotel', level, 1, s.id)),
);
const area = (rects: { w: number; h: number }[]): number => rects.reduce((a, r) => a + r.w * r.h, 0);

describe('room shapes (step 7b)', () => {
  it('has square (hotel and shop), long, L-shape, plus and wide hall, each with 3 levels', () => {
    expect(ROOM_SHAPES.map((s) => s.id)).toEqual(['square', 'square_shop', 'long', 'l_shape', 'plus', 'wide_hall', 'farm']);
    for (const s of ROOM_SHAPES) expect(s.levels).toHaveLength(3);
    expect(shapesFor('hotel').map((s) => s.id)).not.toContain('square_shop');
    expect(shapesFor('shop').map((s) => s.id)).not.toContain('square');
  });

  it('the squares are the old rectangles', () => {
    expect(createRoom(7, 'hotel', 1, 3)).toMatchObject({ id: 7, shape: 'square', w: 576, h: 384, floorStyle: 'bare', wallStyle: 'bare' });
    expect(createRoom(8, 'shop', 3, 3)).toMatchObject({ shape: 'square_shop', w: 832, h: 448 });
    expect(doorX(createRoom(1, 'hotel', 2, 1))).toBe(352);
  });

  it('level 1 floors have about the same area, all on the 16 px grid, rectangles never overlap', () => {
    for (const s of ROOM_SHAPES) {
      const a = area(s.levels[0]!.rects);
      expect(a, s.id).toBeGreaterThan(170_000);
      expect(a, s.id).toBeLessThan(235_000);
      for (const l of s.levels) {
        for (const r of l.rects) for (const v of [r.x, r.y, r.w, r.h]) expect(v % ROOM_GRID, s.id).toBe(0);
        l.rects.forEach((r, i) => l.rects.slice(i + 1).forEach((q) => expect(rectsOverlap(r, q), s.id).toBe(false)));
      }
    }
  });

  it("every level's floor contains the previous level's floor", () => {
    for (const s of ROOM_SHAPES) {
      for (const level of [2, 3] as const) {
        const now = createRoom(1, 'hotel', level, 1, s.id);
        for (const r of s.levels[level - 2]!.rects) expect(rectInsideFloor(now, r), `${s.id} ${level}`).toBe(true);
      }
    }
  });
});

describe('room geometry for every shape and level', () => {
  for (const room of allRooms) {
    describe(`${room.shape} level ${room.level}`, () => {
      it('the door is on a bottom edge and the door zone is inside the floor', () => {
        const d = doorRect(room);
        expect(d.w).toBe(DOOR_WIDTH);
        // Floor above the whole door, nothing under it.
        expect(rectInsideFloor(room, { x: d.x, y: d.y - ROOM_GRID, w: d.w, h: ROOM_GRID })).toBe(true);
        expect(rectInsideFloor(room, { x: d.x, y: d.y, w: d.w, h: 1 })).toBe(false);
        const dz = doorZoneRect(room);
        expect(rectInsideFloor(room, dz)).toBe(true);
        expect(dz).toEqual({ x: doorX(room) - DOOR_ZONE_W / 2, y: doorY(room) - DOOR_ZONE_H, w: DOOR_ZONE_W, h: DOOR_ZONE_H });
      });

      it('a wall band above every floor edge that faces up, outside the floor', () => {
        const bands = wallBands(room);
        expect(bands.length).toBeGreaterThan(0);
        for (const b of bands) {
          expect(b.h).toBe(WALL_BAND);
          expect(rectInsideFloor(room, { x: b.x, y: b.y + b.h, w: b.w, h: ROOM_GRID })).toBe(true);
          for (const f of floorRects(room)) expect(rectsOverlap(b, f)).toBe(false);
        }
      });

      it('borders are 16 px, never on the floor or a band, with a gap at the door', () => {
        const borders = borderRects(room);
        const bands = wallBands(room);
        for (const r of borders) {
          expect(r.h).toBe(SIDE_BORDER);
          for (const f of [...floorRects(room), ...bands]) expect(rectsOverlap(r, f)).toBe(false);
          expect(rectsOverlap(r, doorRect(room))).toBe(false);
        }
        // Under the floor next to the door there is a border.
        const d = doorRect(room);
        expect(borders.some((r) => r.y === d.y && r.x + r.w === d.x)).toBe(true);
        expect(borders.some((r) => r.y === d.y && r.x === d.x + d.w)).toBe(true);
      });

      it('the bounds hold the floor, the bands and the borders', () => {
        const b = roomBoundsRect(room);
        for (const r of [floorRect(room), ...wallBands(room), ...borderRects(room)]) expect(rectInside(r, b)).toBe(true);
      });
    });
  }

  it('an L-shaped room has a wall band at its inner step', () => {
    const l = createRoom(1, 'hotel', 1, 1, 'l_shape');
    expect(wallBands(l)).toEqual([
      { x: 0, y: -WALL_BAND, w: 320, h: WALL_BAND },
      { x: 320, y: 192 - WALL_BAND, w: 320, h: WALL_BAND },
    ]);
  });

  it('roomAtLevel switches to the next level of the same shape', () => {
    const p = createRoom(3, 'shop', 1, 1, 'plus');
    expect(roomAtLevel(p, 2)).toMatchObject({ id: 3, shape: 'plus', level: 2, w: 736, h: 512 });
  });
});

describe('rectInsideFloor', () => {
  const room = createRoom(1, 'hotel', 1, 1);

  it('accepts the floor itself and rectangles inside it', () => {
    expect(rectInsideFloor(room, floorRect(room))).toBe(true);
    expect(rectInsideFloor(room, { x: 10, y: 10, w: 64, h: 56 })).toBe(true);
    expect(rectInsideFloor(room, { x: 0, y: 0, w: 0, h: 0 })).toBe(true);
  });

  it('reports rectangles outside or crossing an edge as outside', () => {
    const outside = [
      { x: -100, y: 10, w: 50, h: 50 },
      { x: 600, y: 10, w: 50, h: 50 },
      { x: 10, y: -60, w: 50, h: 50 },
      { x: 10, y: 400, w: 50, h: 50 },
      { x: -1, y: 10, w: 50, h: 50 },
      { x: 540, y: 10, w: 40, h: 50 },
      { x: 10, y: -1, w: 50, h: 50 },
      { x: 10, y: 340, w: 50, h: 50 },
      wallBands(room)[0]!,
      doorRect(room),
      { x: -10, y: -10, w: 700, h: 500 },
    ];
    for (const r of outside) expect(rectInsideFloor(room, r)).toBe(false);
  });

  it('in an L-shape: inside across both parts, outside in the cut-out corner', () => {
    const l = createRoom(1, 'hotel', 1, 1, 'l_shape');
    expect(rectInsideFloor(l, { x: 300, y: 300, w: 60, h: 40 })).toBe(true); // across the seam
    expect(rectInsideFloor(l, { x: 300, y: 170, w: 60, h: 40 })).toBe(false); // pokes into the cut-out
    expect(rectInsideFloor(l, { x: 400, y: 50, w: 40, h: 40 })).toBe(false); // in the cut-out
  });
});

describe('rectsOverlap', () => {
  it('needs shared area; a shared edge is not an overlap', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsOverlap(a, { x: 20, y: 20, w: 1, h: 1 })).toBe(false);
  });
});
