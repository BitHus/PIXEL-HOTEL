import { describe, expect, it } from 'vitest';
import { OFFLINE_MAX_MS } from './config.ts';
import { applyStyle, buyCatalog, catalogPrice, isStyleUnlocked, unlockStyle, upgradeCost, upgradeRoom } from './economy.ts';
import { canPickUp, canPlace, footprintRect, getFurnitureType } from './furniture.ts';
import { applyChange } from './ledger.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { doorRect, doorZoneRect, rectsTouch } from './room.ts';
import { seededRng } from './rng.ts';
import { putOnShelf } from './shop.ts';
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
    expect(room2).toMatchObject({ level: 2, w: 704, h: 384 });
    expect(s.player.wallet.gold).toBe(1800);
    expect(doorRect(room2).x).toBe(704 / 2 - 32);
    expect(doorRect(room2).y).toBe(384);
    expect(s.items.filter((i) => i.roomId === shopId)).toEqual(before);
    expect(upgradeCost(room2)).toBe(800);
    s = upgradeRoom(s, shopId, 2)!;
    expect(s.rooms.find((r) => r.id === shopId)).toMatchObject({ level: 3, w: 832, h: 448 });
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
    s = { ...s, items: s.items.map((i) => (i.uid === crate.uid ? { ...i, roomId: hotel.id, x: 352, y: 470 } : i)) };
    s = upgradeRoom(s, hotel.id, 1)!;
    const grown = s.rooms.find((r) => r.id === hotel.id)!;
    expect(rectsTouch(footprintRect({ x: 352, y: 470, facing: 'down' }, getFurnitureType('crate')), doorZoneRect(grown))).toBe(true);
    expect(s.items.find((i) => i.uid === crate.uid)?.roomId).toBeNull();
  });
});

describe('the counter', () => {
  it('cannot be picked up, and there is always exactly one', () => {
    let s = rich(5000);
    const counter = s.items.find((i) => i.typeId === 'counter')!;
    expect(canPickUp(counter)).toBe(false);
    expect(buyCatalog(s, 'counter', 1)).toBeNull();
    s = upgradeRoom(upgradeRoom(s, s.player.shopRoomId, 1)!, s.player.shopRoomId, 2)!;
    expect(s.items.filter((i) => i.typeId === 'counter')).toHaveLength(1);
    expect(s.items.find((i) => i.typeId === 'counter')?.roomId).toBe(s.player.shopRoomId);
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
        { x: 120, y: 260 },
        { x: 300, y: 200 },
        { x: 160, y: 300 },
      ];
      const inv = s.items.filter((i) => i.roomId === null);
      let k = 0;
      for (const item of inv) {
        const spot = spots.find((p) => canPlace(room, s.items.filter((o) => o.uid !== item.uid), getFurnitureType(item.typeId), p.x, p.y, 'down'));
        expect(spot, `${shape} ${item.typeId}`).toBeDefined();
        s = { ...s, items: s.items.map((i) => (i.uid === item.uid ? { ...i, roomId: hotel, x: spot!.x, y: spot!.y } : i)) };
        k++;
      }
      expect(k).toBe(2);
      const before = s.items.map((i) => ({ ...i }));
      s = upgradeRoom(s, hotel, 1)!;
      s = upgradeRoom(s, hotel, 2)!;
      expect(s.rooms.find((r) => r.id === hotel)).toMatchObject({ shape, level: 3 });
      expect(s.items).toEqual(before);
      const shopId = s.player.shopRoomId;
      const shopBefore = s.items.filter((i) => i.roomId === shopId);
      s = upgradeRoom(s, shopId, 3)!;
      expect(s.items.filter((i) => i.roomId === shopId)).toEqual(shopBefore);
    }
  });
});
