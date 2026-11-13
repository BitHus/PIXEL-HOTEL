import { describe, expect, it } from 'vitest';
import { generateFloor } from '@pixel-hotel/shared';
import { FogMemory, blockIndex, litBlocks } from './fog.ts';

const { map } = generateFloor(7, 1, 2);

describe('fog', () => {
  it('lights the blocks whose middle is within 224 px', () => {
    const p = { x: 656, y: 656 }; // the middle of block (20, 20)
    const lit = litBlocks(map, p);
    expect(lit.has(blockIndex(map, p))).toBe(true);
    expect(lit.has(blockIndex(map, { x: 656 + 7 * 32, y: 656 }))).toBe(true);
    expect(lit.has(blockIndex(map, { x: 656 + 8 * 32, y: 656 }))).toBe(false);
    expect(lit.has(blockIndex(map, { x: 656 + 5 * 32, y: 656 + 5 * 32 }))).toBe(false);
  });

  it('remembers seen blocks after the player walks on', () => {
    const fog = new FogMemory();
    expect(fog.update(map, { x: 100, y: 100 })).toBe(true);
    expect(fog.update(map, { x: 101, y: 101 })).toBe(false);
    fog.update(map, { x: 1000, y: 1000 });
    expect(fog.isLit(map, { x: 100, y: 100 })).toBe(false);
    expect(fog.isSeen(map, { x: 100, y: 100 })).toBe(true);
    expect(fog.isSeen(map, { x: 600, y: 100 })).toBe(false);
  });
});
