import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BLOCK_STACK_MAX } from './config.ts';
import { blockProblem, blocksOverlapping, hitBlock, placeBlock, stackFull, stackPop, stackPush, type BlockContext } from './blocks.ts';
import { getBlockType, type BlockCell } from './blockTypes.ts';
import { plantProblem } from './farm.ts';
import { upgradeRoom } from './economy.ts';
import { doorReachesMiddle, roomBlockers } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { blockInCell, blockList, blockRects, blockStack, type Room } from './room.ts';
import { seededRng } from './rng.ts';
import { ledgerMaterials } from './testState.ts';

// Step ST1: Room.blocks holds a stack (1 to BLOCK_STACK_MAX, bottom first) per cell.
const free: BlockContext = { standing: [], from: null };
const rich = (): GameState => applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold: 1000, materials: { dirt: 60, stone: 60, planks: 10 } }, 0)!;
const roomOf = (s: GameState, id: number): Room => s.rooms.find((r) => r.id === id)!;
const put = (s: GameState, id: number, c: number, r: number, block: string, ctx = free): GameState => {
  const res = placeBlock(s, id, c, r, block, 10, ctx);
  if (!res.ok) throw new Error(`${block}@${c},${r}: ${res.problem}`);
  return res.state;
};
const cellOfBlock = (id: string): BlockCell => ({ id: id as BlockCell['id'], hits: 0, hitAt: 0 });

describe('stack helpers', () => {
  it('push adds on top, pop removes the top, full at BLOCK_STACK_MAX', () => {
    expect(BLOCK_STACK_MAX).toBe(3);
    const a = cellOfBlock('dirt');
    const b = cellOfBlock('stone');
    expect(stackPush([a], b)).toEqual([a, b]);
    expect(stackPop([a, b])).toEqual([a]);
    expect(stackPop([])).toEqual([]);
    expect(stackFull([a, a])).toBe(false);
    expect(stackFull([a, a, a])).toBe(true);
  });
  it('property: pushes then pops come back out in reverse order and never mutate the input', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('dirt', 'stone', 'planks'), { maxLength: 3 }), (ids) => {
        const cells = ids.map(cellOfBlock);
        let stack: BlockCell[] = [];
        for (const c of cells) {
          const before = stack;
          stack = stackPush(stack, c);
          expect(before.length).toBe(stack.length - 1);
        }
        const out: BlockCell[] = [];
        while (stack.length > 0) {
          out.push(stack[stack.length - 1]!);
          stack = stackPop(stack);
        }
        expect(out).toEqual([...cells].reverse());
      }),
    );
  });
});

describe('placing and breaking a stack', () => {
  it('stacks up to the max; the next one is refused as stack_full and costs nothing', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    s = put(put(put(s, id, 2, 2, 'dirt'), id, 2, 2, 'stone'), id, 2, 2, 'planks');
    expect(blockStack(roomOf(s, id), 2, 2).map((b) => b.id)).toEqual(['dirt', 'stone', 'planks']);
    expect(blockInCell(roomOf(s, id), 2, 2)!.id).toBe('planks'); // the top
    const before = ledgerMaterials(s);
    expect(placeBlock(s, id, 2, 2, 'dirt', 11, free)).toEqual({ ok: false, problem: 'stack_full' });
    expect(ledgerMaterials(s)).toEqual(before);
    expect(blockProblem(roomOf(s, id), s.items, getBlockType('dirt'), 2, 2, free)).toBe('stack_full');
  });
  it('the usual rules hold on top: an avatar standing still, reach, the door zone', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    s = put(s, id, 2, 2, 'dirt');
    expect(placeBlock(s, id, 2, 2, 'stone', 10, { standing: [{ x: 80, y: 80 }], from: null })).toEqual({ ok: false, problem: 'avatar' });
    expect(placeBlock(s, id, 2, 2, 'stone', 10, { standing: [], from: { x: 600, y: 600 } })).toEqual({ ok: false, problem: 'reach' });
    expect(placeBlock(s, id, 8, 10, 'dirt', 10, free)).toEqual({ ok: false, problem: 'door' });
  });
  it('a punch hits and breaks only the TOP block; the one below stays untouched', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    s = put(put(s, id, 2, 2, 'dirt'), id, 2, 2, 'planks');
    let at = 1000;
    let guard = 0;
    while (blockStack(roomOf(s, id), 2, 2).length === 2 && guard++ < 40) {
      const res = hitBlock(s, id, 2, 2, at, 0, seededRng(guard), null);
      if (!res.ok) throw new Error(res.problem);
      s = res.state;
      if (res.kind === 'cracked') expect(blockStack(roomOf(s, id), 2, 2)[0]).toMatchObject({ id: 'dirt', hits: 0 });
      at += 400;
    }
    expect(guard).toBeLessThanOrEqual(getBlockType('planks').hardness);
    expect(blockStack(roomOf(s, id), 2, 2).map((b) => b.id)).toEqual(['dirt']);
    guard = 0;
    while (blockStack(roomOf(s, id), 2, 2).length === 1 && guard++ < 40) {
      const res = hitBlock(s, id, 2, 2, at, 0, seededRng(guard), null);
      if (!res.ok) throw new Error(res.problem);
      s = res.state;
      at += 400;
    }
    expect(roomOf(s, id).blocks['2,2']).toBeUndefined();
    expect(ledgerMaterials(s)).toEqual(s.player.materials);
  });
  it('a stack blocks walking like one block; blockList lists each level; blockRects has one rect per cell', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    const open = roomBlockers(roomOf(s, id), s.items).length;
    s = put(put(s, id, 2, 2, 'dirt'), id, 2, 2, 'stone');
    const room = roomOf(s, id);
    expect(roomBlockers(room, s.items).length).toBe(open + 1);
    expect(blockList(room).map((b) => [b.c, b.r, b.level, b.block.id])).toEqual([[2, 2, 0, 'dirt'], [2, 2, 1, 'stone']]);
    expect(blockRects(room)).toHaveLength(1);
  });
  it('walling a row never shuts the door off from the middle (the refusal stays with stacks)', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    for (let pass = 0; pass < 2; pass++) {
      for (let c = 0; c < 18; c++) {
        const res = placeBlock(s, id, c, 9, 'dirt', 10, free);
        if (res.ok) s = res.state;
      }
    }
    const room = roomOf(s, id);
    expect(doorReachesMiddle(room, roomBlockers(room, s.items))).toBe(true);
  });
  it('a plant needs a single bottom host: fine on one block, refused (stacked) on two; no block goes on a plant', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    s = put(s, id, 2, 2, 'dirt');
    expect(plantProblem(roomOf(s, id), s.items, 2, 2, free, undefined, 'clay_seed')).toBeNull();
    s = put(s, id, 2, 2, 'stone');
    expect(plantProblem(roomOf(s, id), s.items, 2, 2, free, undefined, 'clay_seed')).toBe('stacked');
  });
  it('blocksOverlapping lists every level; an upgrade keeps the bag whole', () => {
    let s = rich();
    const id = s.player.hotelRoomId;
    s = put(put(put(s, id, 2, 2, 'dirt'), id, 2, 2, 'stone'), id, 2, 2, 'planks');
    expect(blocksOverlapping(roomOf(s, id), { x: 64, y: 64, w: 32, h: 32 }).map((b) => [b.id, b.level])).toEqual([['dirt', 0], ['stone', 1], ['planks', 2]]);
    const up = upgradeRoom(s, id, 5);
    if (up) expect(ledgerMaterials(up)).toEqual(up.player.materials);
  });
});
