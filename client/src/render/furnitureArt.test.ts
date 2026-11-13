import { describe, expect, it } from 'vitest';
import { FURNITURE_TYPES, LIE_HEAD_PX, footprintRect, headPoint, seatSpots, type ArtBox, type Facing } from '@pixel-hotel/shared';
import { boxesForFacing, roleFloorRects } from './furnitureArt.ts';

/** The floor rect of a box relative to the anchor. */
const floorOf = (b: ArtBox) => ({ x: b.dx, y: b.dy - b.d, w: b.w, h: b.d });

describe('furniture art', () => {
  it('every type is as tall as its boxes, and its boxes stay inside the footprint', () => {
    for (const t of FURNITURE_TYPES) {
      const boxes = boxesForFacing(t, 'down').boxes;
      expect(Math.max(...boxes.map((b) => -b.dy + b.z + b.h + b.d))).toBe(t.height);
      for (const facing of ['down', 'right', 'up'] as Facing[]) {
        const fp = footprintRect({ x: 0, y: 0, facing }, t);
        for (const b of boxesForFacing(t, facing).boxes) {
          const r = floorOf(b);
          expect(r.x >= fp.x && r.y >= fp.y && r.x + r.w <= fp.x + fp.w && r.y + r.h <= fp.y + fp.h, `${t.id} ${facing}`).toBe(true);
        }
      }
    }
  });

  it('left is right mirrored', () => {
    const chair = FURNITURE_TYPES.find((t) => t.id === 'chair')!;
    expect(boxesForFacing(chair, 'left')).toEqual({ ...boxesForFacing(chair, 'right'), mirror: true });
  });
});

describe('lying on the bed (step 5b)', () => {
  it('puts the head on the pillow in all four facings', () => {
    const bed = FURNITURE_TYPES.find((t) => t.id === 'bed')!;
    for (const facing of ['down', 'right', 'up', 'left'] as Facing[]) {
      const spot = seatSpots({ x: 0, y: 0, facing }, bed)[0]!;
      const head = headPoint(spot, LIE_HEAD_PX);
      const [pillow] = roleFloorRects(bed, facing, 'pillow');
      expect(pillow, facing).toBeDefined();
      // Inside the pillow, give or take a pixel or two at its back edge.
      const m = 2;
      const inside =
        head.x >= pillow!.x - m && head.x <= pillow!.x + pillow!.w + m && head.y >= pillow!.y - m && head.y <= pillow!.y + pillow!.h + m;
      expect(inside, `${facing}: head ${JSON.stringify(head)} pillow ${JSON.stringify(pillow)}`).toBe(true);
      // The blanket is there in every facing too.
      expect(roleFloorRects(bed, facing, 'cover')).toHaveLength(1);
    }
  });
});
