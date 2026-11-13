import { describe, expect, it } from 'vitest';
import { countInInventory, furnitureStacks, materialStacks, nextInventoryUid } from './inventory.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { confirmPlacing, startNewPlacing } from './placing.ts';
import { pickUpItem } from './furniture.ts';

const owner = { ownerId: 1, newUid: () => 999 };

describe('inventory stacks', () => {
  const s = applyChange(createNewPlayer(), { reason: 'debug', addFurniture: ['chair', 'table', 'chair', 'rug', 'chair'] }, 5)!;

  it('adds new items to the inventory with fresh uids and logs them', () => {
    expect(s.items.map((i) => [i.uid, i.typeId, i.roomId])).toEqual([
      [1, 'chair', null],
      [2, 'table', null],
      [3, 'chair', null],
      [4, 'rug', null],
      [5, 'chair', null],
    ]);
    expect(s.nextUid).toBe(6);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'debug', goldDelta: 0, furnitureUids: [1, 2, 3, 4, 5] });
  });

  it('stacks furniture by type with the right counts', () => {
    expect(furnitureStacks(s.items)).toEqual([
      { typeId: 'chair', count: 3 },
      { typeId: 'table', count: 1 },
      { typeId: 'rug', count: 1 },
    ]);
    expect(countInInventory(s.items, 'chair')).toBe(3);
    expect(countInInventory(s.items, 'bed')).toBe(0);
  });

  it('stacks materials with their counts and leaves out empty ones', () => {
    expect(materialStacks({ wood: 4, cloth: 2 })).toEqual([
      { id: 'wood', qty: 4 },
      { id: 'cloth', qty: 2 },
    ]);
    expect(materialStacks({ crystal: 1, wood: 0 })).toEqual([{ id: 'crystal', qty: 1 }]);
    const used = applyChange(s, { reason: 'craft', materials: { wood: -4, cloth: -1 } }, 6)!;
    expect(used.player.materials).toEqual({ cloth: 1 });
    expect(applyChange(s, { reason: 'craft', materials: { wood: -5 } }, 6)).toBeNull();
    expect(applyChange(s, { reason: 'catalog', gold: -101 }, 6)).toBeNull();
  });

  it('placing takes an item out of the inventory; picking up puts it back', () => {
    const room = s.rooms[0]!;
    const uid = nextInventoryUid(s.items, 'chair')!;
    expect(uid).toBe(1);
    const placed = confirmPlacing(room, s.items, startNewPlacing('chair', { x: 100, y: 100 }, uid), owner)!;
    expect(placed).toHaveLength(s.items.length); // no new item was created
    expect(placed.find((i) => i.uid === uid)?.roomId).toBe(room.id);
    expect(countInInventory(placed, 'chair')).toBe(2);
    expect(furnitureStacks(placed)[0]).toEqual({ typeId: 'chair', count: 2 });
    const back = pickUpItem(placed, uid);
    expect(back.find((i) => i.uid === uid)).toMatchObject({ roomId: null, onItemUid: null });
    expect(countInInventory(back, 'chair')).toBe(3);
  });
});

