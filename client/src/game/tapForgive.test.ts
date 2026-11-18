// Tap forgiveness in the client: which pieces can be picked by a near miss, and the nearest one wins (the maths is shared/src/tapPick.test.ts).
import { describe, expect, it } from 'vitest';
import type { FurnitureItem } from '@pixel-hotel/shared';
import { createTapForgive, isTapUseful } from './tapForgive.ts';

const item = (uid: number, typeId: string, x: number, y: number): FurnitureItem => ({ uid, typeId, ownerId: 1, roomId: 2, x, y, facing: 'down', onItemUid: null });

describe('isTapUseful', () => {
  it('bar, register, taps, stove, barrel, keg rack, chair can be picked; a rug or a plain table cannot', () => {
    for (const id of ['counter', 'register', 'tap_stand', 'stove', 'brewing_barrel', 'keg_rack', 'chair']) expect(isTapUseful(id), id).toBe(true);
    for (const id of ['rug', 'round_table']) expect(isTapUseful(id), id).toBe(false);
  });
});

describe('createTapForgive', () => {
  const bounds: Record<number, { x: number; y: number; w: number; h: number }> = { 1: { x: 100, y: 100, w: 60, h: 60 }, 2: { x: 300, y: 100, w: 60, h: 60 } };
  const st = {
    items: [item(1, 'stove', 130, 160), item(2, 'brewing_barrel', 330, 160), item(3, 'rug', 500, 160)],
    room: { id: 2 },
    shown: { x: 0, y: 0, zoom: 1 },
  };
  const g = createTapForgive({
    st: st as never,
    itemViews: { screenBounds: (uid: number) => bounds[uid] ?? { x: 480, y: 140, w: 60, h: 20 } } as never,
    late: { guestFeet: () => [{ id: 7, x: 220, y: 200 }] } as never,
  });
  it('a tap just beside the stove picks the stove, beside the barrel the barrel', () => {
    expect(g.nearTap({ x: 90, y: 130 })).toMatchObject({ kind: 'item', item: { typeId: 'stove' } });
    expect(g.nearTap({ x: 372, y: 130 })).toMatchObject({ kind: 'item', item: { typeId: 'brewing_barrel' } });
  });
  it('a tap on a guest body or just above the head picks the guest', () => {
    expect(g.nearTap({ x: 220, y: 170 })).toMatchObject({ kind: 'guest', id: 7 });
    expect(g.nearTap({ x: 220, y: 125 })).toMatchObject({ kind: 'guest', id: 7 });
  });
  it('a tap far from everything and a tap beside a rug pick nothing (the avatar walks)', () => {
    expect(g.nearTap({ x: 600, y: 400 })).toBeNull();
    expect(g.nearTap({ x: 515, y: 190 })).toBeNull();
  });
});
