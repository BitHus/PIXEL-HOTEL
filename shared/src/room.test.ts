import { describe, expect, it } from 'vitest';
import { DOOR_WIDTH, DOOR_ZONE_H, DOOR_ZONE_W, ROOM_SIZES, SIDE_BORDER, WALL_BAND } from './config.ts';
import {
  bottomBorderRects,
  createRoom,
  doorRect,
  doorZoneRect,
  floorRect,
  rectInsideFloor,
  roomBoundsRect,
  wallBandRect,
} from './room.ts';

const rooms = ([1, 2, 3] as const).flatMap((level) => [
  createRoom(1, 'hotel', level, 1),
  createRoom(2, 'shop', level, 1),
]);

describe('createRoom', () => {
  it('uses the sizes from config and the bare styles', () => {
    const r = createRoom(7, 'hotel', 1, 3);
    expect(r).toMatchObject({ id: 7, w: 576, h: 384, floorStyle: 'bare', wallStyle: 'bare' });
    expect(createRoom(8, 'shop', 3, 3)).toMatchObject(ROOM_SIZES.shop[3]);
  });
});

describe('room rectangles', () => {
  for (const room of rooms) {
    describe(`${room.kind} level ${room.level}`, () => {
      it('door zone is inside the floor and touches the bottom edge', () => {
        const dz = doorZoneRect(room);
        expect(rectInsideFloor(room, dz)).toBe(true);
        expect(dz.y + dz.h).toBe(room.h);
        expect(dz.w).toBe(DOOR_ZONE_W);
        expect(dz.h).toBe(DOOR_ZONE_H);
        expect(dz.x + dz.w / 2).toBe(room.w / 2);
      });

      it('door is a centered opening in the bottom border', () => {
        const d = doorRect(room);
        expect(d).toEqual({ x: room.w / 2 - DOOR_WIDTH / 2, y: room.h, w: DOOR_WIDTH, h: SIDE_BORDER });
        const [l, r] = bottomBorderRects(room);
        expect(l.x + l.w).toBe(d.x);
        expect(r.x).toBe(d.x + d.w);
        expect(r.x + r.w).toBe(room.w);
      });

      it('wall band is 64 px above the floor, bounds include the borders', () => {
        expect(wallBandRect(room)).toEqual({ x: 0, y: -WALL_BAND, w: room.w, h: WALL_BAND });
        expect(roomBoundsRect(room)).toEqual({
          x: -SIDE_BORDER,
          y: -WALL_BAND,
          w: room.w + 2 * SIDE_BORDER,
          h: room.h + WALL_BAND + SIDE_BORDER,
        });
      });
    });
  }
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
      wallBandRect(room),
      doorRect(room),
      { x: -10, y: -10, w: 700, h: 500 },
    ];
    for (const r of outside) expect(rectInsideFloor(room, r)).toBe(false);
  });
});
