import { describe, expect, it } from 'vitest';
import { FURNITURE_TYPES, footprintRect, type ArtBox, type Facing } from '@pixel-hotel/shared';
import { boxesForFacing } from './furnitureArt.ts';

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
