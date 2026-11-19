import { describe, expect, it } from 'vitest';
import { OFFLINE_MAX_MS } from './config.ts';
import { applyStyle, buyCatalog, catalogPrice, isStyleUnlocked, paintFloor, unlockStyle, upgradeCost, upgradeRoom } from './economy.ts';
import { canPickUp, canPlace, footprintRect, getFurnitureType, pickUpItem, poseAtCell } from './furniture.ts';
import { legacyStart } from './tavernTest.ts';
import { applyChange } from './ledger.ts';
import { kitchenZone, rectInZone } from './kitchen.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { dominantFloorStyle, doorRect, doorZoneRect, floorStyleAt, rectsOverlap } from './room.ts';
import { seededRng } from './rng.ts';
import { ledgerGold } from './testState.ts';
import type { GameState } from './gameState.ts';

const fresh = (): GameState => createNewPlayer(undefined, 0);
const rich = (gold: number): GameState => applyChange(fresh(), { reason: 'debug', gold }, 0)!;

describe('catalog', () => {
  it('costs baseValue * 3 and puts the item in the bag', () => {
    expect(catalogPrice('shelf')).toBe(30);
    const s = buyCatalog(fresh(), 'shelf', 1)!;
    expect(s.player.wallet.gold).toBe(70);
    expect(s.items.filter((i) => i.typeId === 'shelf' && i.roomId === null)).toHaveLength(1);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'catalog', goldDelta: -30 });
  });

  it('refuses items that are not in the catalog, and never lets gold go negative', () => {
    expect(buyCatalog(fresh(), 'counter', 1)).toBeNull();
    expect(buyCatalog(fresh(), 'stall_table', 1)).toBeNull();
    let s = fresh();
    for (let i = 0; i < 20; i++) s = buyCatalog(s, 'display_case', 1) ?? s;
    expect(s.player.wallet.gold).toBe(100);
    s = fresh();
    for (let i = 0; i < 20; i++) s = buyCatalog(s, 'chair', 1) ?? s;
    expect(s.player.wallet.gold).toBeGreaterThanOrEqual(0);
    expect(s.player.wallet.gold).toBe(100 - 6 * 15);
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
  });
});

describe('styles', () => {
  it('painting cells (BG1): one cell or a rectangle with an unlocked floor, free, only own style rules', () => {
    let s = unlockStyle(fresh(), 'floor', 'wood_planks', 1)!;
    const hotel = s.player.hotelRoomId;
    const gold = s.player.wallet.gold;
    // A style you do not own cannot be painted.
    expect(paintFloor(fresh(), hotel, { c: 1, r: 1 }, { c: 1, r: 1 }, 'wood_planks')).toBeNull();
    s = paintFloor(s, hotel, { c: 1, r: 1 }, { c: 1, r: 1 }, 'wood_planks')!;
    s = paintFloor(s, hotel, { c: 5, r: 8 }, { c: 3, r: 6 }, 'wood_planks')!; // a rectangle, corners in any order
    const room = s.rooms.find((r) => r.id === hotel)!;
    expect(floorStyleAt(room, 1, 1)).toBe('wood_planks');
    expect(floorStyleAt(room, 4, 7)).toBe('wood_planks');
    expect(floorStyleAt(room, 0, 0)).toBe('bare');
    expect(Object.keys(room.floorCells!)).toHaveLength(1 + 9);
    expect(s.player.wallet.gold).toBe(gold); // free
    // Nothing on the floor in the rectangle (outside the room): refused.
    expect(paintFloor(s, hotel, { c: 90, r: 90 }, { c: 91, r: 91 }, 'wood_planks')).toBeNull();
    // A whole-floor style clears the painted cells; the lakeside cannot be painted.
    const whole = applyStyle(s, hotel, 'floor', 'bare')!.rooms.find((r) => r.id === hotel)!;
    expect(whole.floorCells).toBeUndefined();
    expect(paintFloor(s, s.player.lakesideRoomId, { c: 1, r: 1 }, { c: 1, r: 1 }, 'wood_planks')).toBeNull();
  });

  it('the shop appeal follows the floor style that covers most cells', () => {
    let s = unlockStyle(rich(500), 'floor', 'wood_planks', 1)!;
    const shop = s.player.shopRoomId;
    s = paintFloor(s, shop, { c: 0, r: 6 }, { c: 17, r: 10 }, 'wood_planks')!; // 18 x 5 of the 18 x 10 cells of the main floor (it starts 6 rows down, under the kitchen): half; the kitchen keeps its stone
    expect(dominantFloorStyle(s.rooms.find((r) => r.id === shop)!)).toBe('bare');
    s = paintFloor(s, shop, { c: 0, r: 11 }, { c: 4, r: 11 }, 'wood_planks')!;
    expect(dominantFloorStyle(s.rooms.find((r) => r.id === shop)!)).toBe('wood_planks');
  });

  it('a new player has only the bare styles', () => {
    const s = fresh();
    expect(s.player.unlockedStyles).toEqual(['floor:bare', 'wall:bare']);
  });

  it('buying a style unlocks it forever and applying it costs nothing', () => {
    let s = unlockStyle(fresh(), 'floor', 'wood_planks', 1)!;
    expect(s.player.wallet.gold).toBe(70);
    expect(isStyleUnlocked(s, 'floor', 'wood_planks')).toBe(true);
    expect(unlockStyle(s, 'floor', 'wood_planks', 2)).toBeNull();
    const hotel = s.player.hotelRoomId;
    const shop = s.player.shopRoomId;
    for (let k = 0; k < 5; k++) {
      s = applyStyle(s, hotel, 'floor', 'wood_planks')!;
      s = applyStyle(s, shop, 'floor', 'wood_planks')!;
      s = applyStyle(s, hotel, 'floor', 'bare')!;
    }
    expect(s.player.wallet.gold).toBe(70);
    expect(s.rooms.find((r) => r.id === shop)?.floorStyle).toBe('wood_planks');
    expect(applyStyle(s, hotel, 'wall', 'brick')).toBeNull();
    expect(unlockStyle(fresh(), 'floor', 'bare', 1)).toBeNull();
    expect(unlockStyle(fresh(), 'floor', 'nope', 1)).toBeNull();
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
  });
});

describe('room upgrades (section 5)', () => {
  it('costs 300 then 800, grows right and down, keeps positions, moves the door', () => {
    let s = rich(2000);
    const shopId = s.player.shopRoomId;
    const before = s.items.filter((i) => i.roomId === shopId).map((i) => ({ ...i }));
    const room1 = s.rooms.find((r) => r.id === shopId)!;
    expect(upgradeCost(room1)).toBe(300);
    s = upgradeRoom(s, shopId, 1)!;
    const room2 = s.rooms.find((r) => r.id === shopId)!;
    expect(room2).toMatchObject({ level: 2, w: 704, h: 576 }); // 22 x 12 cells of main floor + the kitchen annex (9 x 6 cells) above it
    expect(s.player.wallet.gold).toBe(1800);
    expect(doorRect(room2).x).toBe(704 / 2 - 32);
    expect(doorRect(room2).y).toBe(576);
    // KITCHEN-ABOVE (19 Nov): the annex sits on top and keeps its height, so EVERYTHING keeps its place (the annex grows to the right, the main floor right and down).
    expect(s.items.filter((i) => i.roomId === shopId)).toEqual(before);
    expect(upgradeCost(room2)).toBe(800);
    s = upgradeRoom(s, shopId, 2)!;
    expect(s.rooms.find((r) => r.id === shopId)).toMatchObject({ level: 3, w: 832, h: 640 });
    expect(s.player.wallet.gold).toBe(1000);
    expect(upgradeRoom(s, shopId, 3)).toBeNull();
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
  });

  it('refuses without enough gold', () => {
    const s = fresh();
    expect(upgradeRoom(s, s.player.hotelRoomId, 1)).toBeNull();
  });

  it('an item in the new door zone goes back to the inventory', () => {
    let s = applyChange(rich(500), { reason: 'debug', addFurniture: ['crate'] }, 0)!;
    const hotel = s.rooms.find((r) => r.id === s.player.hotelRoomId)!;
    // Put the crate where the level 2 door zone will be (only possible by hand: it is off the old floor).
    const crate = s.items.find((i) => i.typeId === 'crate')!;
    s = { ...s, items: s.items.map((i) => (i.uid === crate.uid ? { ...i, roomId: hotel.id, x: 368, y: 448 } : i)) };
    s = upgradeRoom(s, hotel.id, 1)!;
    const grown = s.rooms.find((r) => r.id === hotel.id)!;
    expect(rectsOverlap(footprintRect({ x: 368, y: 448, facing: 'down' }, getFurnitureType('crate')), doorZoneRect(grown))).toBe(true);
    expect(s.items.find((i) => i.uid === crate.uid)?.roomId).toBeNull();
  });
});

describe('the bar (MODULAR BAR, 19 Nov)', () => {
  it('pieces can be picked up and bought cheaply, but the tavern always keeps its last piece; the old counter is never sold', () => {
    let s = rich(5000);
    const pieces = () => s.items.filter((i) => i.typeId === 'bar' && i.roomId === s.player.shopRoomId);
    expect(pieces()).toHaveLength(6);
    expect(canPickUp(legacyStart().items.find((i) => i.typeId === 'counter')!)).toBe(false);
    expect(buyCatalog(s, 'counter', 1)).toBeNull();
    expect(buyCatalog(s, 'bar', 1)).not.toBeNull();
    // Take the pieces away one by one (riders go to the bag with theirs): the last one stays.
    while (pieces().length > 1) {
      const p = pieces()[0]!;
      expect(canPickUp(p, s.items)).toBe(true);
      s = { ...s, items: pickUpItem(s.items, p.uid) };
    }
    expect(canPickUp(pieces()[0]!, s.items)).toBe(false);
    s = upgradeRoom(upgradeRoom(s, s.player.shopRoomId, 1)!, s.player.shopRoomId, 2)!;
    expect(pieces()).toHaveLength(1);
  });
});

describe('room upgrades in shaped rooms (step 7b)', () => {
  it('L-shape and plus: items keep their places, the room switches to the next level of its shape', () => {
    for (const shape of ['l_shape', 'plus']) {
      let s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, hotelShape: shape, shopShape: shape }, 0);
      s = applyChange(s, { reason: 'debug', gold: 2000, addFurniture: ['table', 'chair'] }, 0)!;
      const hotel = s.player.hotelRoomId;
      const room = s.rooms.find((r) => r.id === hotel)!;
      // Put the table and chair somewhere valid in the hotel room.
      const spots = [
        { col: 3, row: 7 },
        { col: 8, row: 5 },
        { col: 4, row: 9 },
      ];
      const inv = s.items.filter((i) => i.roomId === null);
      let k = 0;
      for (const item of inv) {
        const type = getFurnitureType(item.typeId);
        const spot = spots.map((p) => poseAtCell(type, 'down', p.col, p.row)).find((p) => canPlace(room, s.items.filter((o) => o.uid !== item.uid), type, p.x, p.y, 'down'));
        expect(spot, `${shape} ${item.typeId}`).toBeDefined();
        s = { ...s, items: s.items.map((i) => (i.uid === item.uid ? { ...i, roomId: hotel, x: spot!.x, y: spot!.y } : i)) };
        k++;
      }
      expect(k).toBe(2);
      const before = s.items.map((i) => ({ ...i }));
      s = upgradeRoom(s, hotel, 1)!;
      s = upgradeRoom(s, hotel, 2)!;
      expect(s.rooms.find((r) => r.id === hotel)).toMatchObject({ shape, level: 3 });
      expect(s.items.filter((i) => i.roomId === hotel)).toEqual(before.filter((i) => i.roomId === hotel));
      const shopId = s.player.shopRoomId;
      const kitchen = new Set(['stove', 'brewing_barrel']); // the kitchen annex's contents move down with it
      const shopBefore = s.items.filter((i) => i.roomId === shopId && !kitchen.has(i.typeId));
      s = upgradeRoom(s, shopId, 3)!;
      expect(s.items.filter((i) => i.roomId === shopId && !kitchen.has(i.typeId))).toEqual(shopBefore);
      const kz = kitchenZone(s.rooms.find((r) => r.id === shopId));
      for (const i of s.items.filter((x) => x.roomId === shopId && kitchen.has(x.typeId))) expect(rectInZone(kz, footprintRect(i, getFurnitureType(i.typeId))), `${shape} ${i.typeId} in the annex`).toBe(true);
    }
  });
});
