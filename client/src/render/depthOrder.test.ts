import { describe, expect, it } from 'vitest';
import type { Avatar, FurnitureItem } from '@pixel-hotel/shared';
import { avatarDepthKey, compareDepth, itemDepthKey, type DepthKey } from './depthOrder.ts';

const avatar = (x: number, y: number): Avatar => ({
  id: 1,
  name: 'A',
  look: { skin: 0, hair: 0, hairStyle: 'short', top: 't_shirt', shirt: 0, bottoms: 'trousers', legs: 0, shoes: 0 },
  roomId: 1,
  x,
  y,
  facing: 'down',
  state: 'idle',
});
const item = (uid: number, typeId: string, x: number, y: number, onItemUid: number | null = null): FurnitureItem => ({
  uid,
  typeId,
  ownerId: 1,
  roomId: 1,
  x,
  y,
  facing: 'down',
  onItemUid,
});

/** Sorts named keys and returns the names in draw order. */
const order = (keys: Record<string, DepthKey>): string[] =>
  Object.entries(keys)
    .sort((a, b) => compareDepth(a[1], b[1]))
    .map(([k]) => k);

describe('compareDepth', () => {
  it('sorts by y, then x, then uid', () => {
    const keys: DepthKey[] = [
      { y: 50, x: 10, uid: 3 },
      { y: 20, x: 90, uid: 1 },
      { y: 50, x: 5, uid: 9 },
      { y: 50, x: 10, uid: 2 },
    ];
    const sorted = [...keys].sort(compareDepth);
    expect(sorted).toEqual([
      { y: 20, x: 90, uid: 1 },
      { y: 50, x: 5, uid: 9 },
      { y: 50, x: 10, uid: 2 },
      { y: 50, x: 10, uid: 3 },
    ]);
  });

  it('puts the avatar behind a sofa when its feet are above the sofa bottom, in front when below', () => {
    const sofa = item(5, 'sofa', 200, 200);
    expect(order({ sofa: itemDepthKey(sofa), avatar: avatarDepthKey(avatar(200, 199.5)) })).toEqual(['avatar', 'sofa']);
    expect(order({ sofa: itemDepthKey(sofa), avatar: avatarDepthKey(avatar(190, 170)) })).toEqual(['avatar', 'sofa']);
    expect(order({ sofa: itemDepthKey(sofa), avatar: avatarDepthKey(avatar(200, 200.5)) })).toEqual(['sofa', 'avatar']);
    expect(order({ sofa: itemDepthKey(sofa), avatar: avatarDepthKey(avatar(260, 230)) })).toEqual(['sofa', 'avatar']);
  });

  it('draws an item on a surface right after the item under it', () => {
    const table = item(1, 'table', 200, 200);
    const lamp = item(2, 'lamp', 210, 190, 1);
    const chair = item(3, 'chair', 150, 201);
    const behind = avatar(205, 195); // feet above the table bottom but below the lamp's own y
    expect(
      order({
        table: itemDepthKey(table),
        lamp: itemDepthKey(lamp, table),
        chair: itemDepthKey(chair),
        avatar: avatarDepthKey(behind),
      }),
    ).toEqual(['avatar', 'table', 'lamp', 'chair']);
  });

  it('draws a sitting avatar in front of its seat, or behind it when the seat faces up', () => {
    const chair = item(4, 'chair', 100, 100);
    const sitter = avatar(100, 84);
    expect(order({ chair: itemDepthKey(chair), avatar: avatarDepthKey(sitter, chair) })).toEqual(['chair', 'avatar']);
    const up = { ...chair, facing: 'up' as const };
    expect(order({ chair: itemDepthKey(up), avatar: avatarDepthKey(sitter, up) })).toEqual(['avatar', 'chair']);
  });

  it('draws a lying avatar right after its bed in every facing, before things in front of the bed', () => {
    for (const facing of ['down', 'right', 'up', 'left'] as const) {
      const bed = { ...item(5, 'bed', 100, 100), facing };
      const sleeper = { ...avatar(100, 70), state: 'lie' as const };
      const front = item(6, 'chair', 100, 140);
      expect(order({ front: itemDepthKey(front), bed: itemDepthKey(bed), avatar: avatarDepthKey(sleeper, bed) })).toEqual([
        'bed',
        'avatar',
        'front',
      ]);
    }
  });
});
