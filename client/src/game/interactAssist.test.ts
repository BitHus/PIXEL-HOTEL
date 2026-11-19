// Misclick-proof: which pick a tap uses (the click and the hover share chooseTap).
import { describe, expect, it } from 'vitest';
import { INTERACT_PRIORITY, type FurnitureItem } from '@pixel-hotel/shared';
import { chooseTap, samePick } from './interactAssist.ts';
import type { InteractPick } from './tapForgive.ts';

const item = (uid: number): FurnitureItem => ({ uid, typeId: 'chair', ownerId: 1, roomId: 2, x: 0, y: 0, facing: 'down', onItemUid: null });
const itemPick = (uid: number, priority: number, hit = true): InteractPick => ({
  ref: { kind: 'item', item: item(uid) }, bounds: { x: 0, y: 0, w: 10, h: 10 }, state: { kind: 'seat' }, priority, label: 'Sit', hit,
});
const guestPick = (id: number, hit: boolean): InteractPick => ({
  ref: { kind: 'guest', id, world: { x: 0, y: 0 } }, bounds: { x: 0, y: 0, w: 10, h: 10 }, state: { kind: 'guest', ready: true }, priority: INTERACT_PRIORITY.urgent, label: 'Serve', hit,
});

describe('chooseTap', () => {
  it('an urgent thing that is hit beats the exact hit under it (a guest with an order on a stool)', () => {
    const stool = itemPick(1, INTERACT_PRIORITY.seat);
    expect(chooseTap(stool, guestPick(7, true), false)?.ref.kind).toBe('guest');
  });
  it('a near miss never beats an exact useful hit', () => {
    expect(chooseTap(itemPick(1, INTERACT_PRIORITY.seat), guestPick(7, false), false)?.ref.kind).toBe('item');
  });
  it('no useful exact hit: the forgiven pick, unless a door wins', () => {
    expect(chooseTap(null, guestPick(7, false), false)?.ref.kind).toBe('guest');
    expect(chooseTap(null, guestPick(7, false), true)).toBeNull();
    expect(chooseTap(null, null, false)).toBeNull();
  });
});

describe('samePick', () => {
  it('matches by item uid or guest id', () => {
    expect(samePick(itemPick(1, 1), itemPick(1, 3))).toBe(true);
    expect(samePick(itemPick(1, 1), itemPick(2, 1))).toBe(false);
    expect(samePick(guestPick(7, true), guestPick(7, false))).toBe(true);
    expect(samePick(guestPick(7, true), itemPick(7, 1))).toBe(false);
    expect(samePick(null, itemPick(1, 1))).toBe(false);
  });
});
