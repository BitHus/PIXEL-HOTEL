import { describe, expect, it } from 'vitest';
import { createRoom, kitchenWall } from '@pixel-hotel/shared';
import { wallCellLooks } from './kitchenWallArt.ts';

describe('kitchen wall pieces', () => {
  it('flags the neighbours of every partition cell and marks exactly one doorway', () => {
    const kw = kitchenWall(createRoom(1, 'shop', 1, 1, 'square_shop'))!;
    const looks = wallCellLooks(kw);
    expect(looks.length).toBe(kw.walls.length + (kw.door ? 1 : 0));
    expect(looks.filter((l) => l.door).length).toBe(kw.door ? 1 : 0);
    // the partition is ONE row: nothing above or below a piece, neighbours only left and right
    for (const l of looks) expect(l.look.n || l.look.s).toBe(false);
    expect(looks.some((l) => l.look.e || l.look.w)).toBe(true);
  });
});
