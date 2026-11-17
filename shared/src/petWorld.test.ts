import { describe, expect, it } from 'vitest';
import { buildNavGrid } from './nav.ts';
import { petBasketPoint, petHit, petLivesHere, petWorldOf } from './petWorld.ts';
import type { Room } from './room.ts';
import type { FurnitureItem } from './types.ts';

const item = (uid: number, typeId: string, roomId: number, x: number, y: number): FurnitureItem => ({ uid, typeId, ownerId: 1, roomId, x, y, facing: 'down', onItemUid: null });
const room = { id: 1, kind: 'hotel', level: 1, shape: 'square', w: 320, h: 320, floorStyle: 'bare', wallStyle: 'bare' } as unknown as Room;

describe('petWorld', () => {
  it('lives where a basket stands in this room, and only once adopted', () => {
    const items = [item(1, 'pet_basket', 1, 100, 200), item(2, 'pet_basket', 2, 50, 50)];
    expect(petBasketPoint(items, 1)).toEqual({ x: 100, y: 190 });
    expect(petBasketPoint(items, 3)).toBeNull();
    expect(petLivesHere(true, items, 1)).toBe(true);
    expect(petLivesHere(false, items, 1)).toBe(false);
    expect(petLivesHere(true, items, 3)).toBe(false);
  });
  it('free follows the nav grid', () => {
    const grid = buildNavGrid(room, [{ x: 96, y: 96, w: 32, h: 32 }]);
    const w = petWorldOf(grid, { x: 0, y: 0 }, null);
    expect(w.free({ x: 112, y: 112 })).toBe(false);
    expect(w.free({ x: 200, y: 200 })).toBe(true);
    expect(w.free({ x: -10, y: 10 })).toBe(false);
  });
  it('a tap hits a box around the cat', () => {
    const cat = { x: 100, y: 100 };
    expect(petHit(cat, { x: 100, y: 85 })).toBe(true);
    expect(petHit(cat, { x: 130, y: 85 })).toBe(false);
    expect(petHit(cat, { x: 100, y: 60 })).toBe(false);
  });
});
