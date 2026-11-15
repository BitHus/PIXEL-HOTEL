import { describe, expect, it } from 'vitest';
import { tavernAppeal } from './appeal.ts';
import { createNewPlayer } from './newPlayer.ts';
import { guestIntervalMs } from './tavern.ts';
import type { FurnitureItem } from './types.ts';

describe('tavern appeal (section 9)', () => {
  const room = { ...createNewPlayer(undefined, 0).rooms[1]! };
  const item = (typeId: string, uid: number): FurnitureItem => ({ uid, typeId, ownerId: 1, roomId: room.id, x: 0, y: 0, facing: 'down', onItemUid: null });

  it('counts each type at most 3 times, adds the styles, and never exceeds 100', () => {
    expect(tavernAppeal(room, [item('counter', 1)])).toBe(8);
    const banners = [1, 2, 3, 4, 5].map((u) => item('banner', u));
    expect(tavernAppeal(room, banners)).toBe(18);
    expect(tavernAppeal({ ...room, floorStyle: 'wood_planks', wallStyle: 'brick' }, banners)).toBe(26);
    const lots = ['sign', 'banner', 'display_case', 'shop_rug', 'counter', 'lamp', 'plant'].flatMap((t, k) =>
      [0, 1, 2, 3].map((n) => item(t, k * 10 + n)),
    );
    expect(tavernAppeal({ ...room, floorStyle: 'red_carpet', wallStyle: 'plaster' }, lots)).toBe(100);
  });

  it('stalls, shelves and cases still count as decor (S1)', () => {
    // The display case has appeal 6; the table and the shelf have none (as before). Placing them is still fine.
    expect(tavernAppeal(room, [item('display_case', 1)])).toBe(6);
    expect(tavernAppeal(room, [item('stall_table', 1), item('shelf', 2), item('display_case', 3)])).toBe(6);
  });

  it('the guest interval shrinks as appeal rises (the rate stays as in 9t)', () => {
    expect(guestIntervalMs(0)).toBe(45_000);
    expect(guestIntervalMs(100)).toBe(22_500);
    for (let a = 0; a < 100; a += 10) expect(guestIntervalMs(a + 10)).toBeLessThan(guestIntervalMs(a));
  });
});
