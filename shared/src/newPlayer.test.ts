import { describe, expect, it } from 'vitest';
import { createNewPlayer, styleKey } from './newPlayer.ts';
import { HOTBAR_SLOTS, SHOP_START_ITEMS } from './config.ts';
import { canPlace, getFurnitureType } from './furniture.ts';

describe('createNewPlayer (brief section 9)', () => {
  const s = createNewPlayer(undefined, 1234);

  it('gives level 1, 0 xp, 100 gold, 4 wood and 2 cloth, nothing else', () => {
    expect(s.player.level).toBe(1);
    expect(s.player.xp).toBe(0);
    expect(s.player.wallet).toEqual({ gold: 100 });
    expect(s.player.materials).toEqual({ wood: 4, cloth: 2 });
    expect(s.player.gear).toEqual([]);
    expect(s.player.potions).toBe(0);
  });

  it('unlocks only the bare floor and bare wall, used in both rooms', () => {
    expect(s.player.unlockedStyles).toEqual([styleKey('floor', 'bare'), styleKey('wall', 'bare')]);
    for (const r of s.rooms) expect([r.floorStyle, r.wallStyle]).toEqual(['bare', 'bare']);
  });

  it('has an empty level 1 hotel room (576x384) and a level 1 shop room (576x320)', () => {
    const hotel = s.rooms.find((r) => r.id === s.player.hotelRoomId);
    const shop = s.rooms.find((r) => r.id === s.player.shopRoomId);
    expect(hotel).toMatchObject({ kind: 'hotel', level: 1, w: 576, h: 384, ownerId: s.player.id });
    expect(shop).toMatchObject({ kind: 'shop', level: 1, w: 576, h: 320, ownerId: s.player.id });
    expect(s.rooms).toHaveLength(2);
    expect(s.currentRoomId).toBe(hotel?.id);
  });

  it('has an empty hotel room, nothing in the inventory, and an empty hotbar', () => {
    expect(s.items.filter((i) => i.roomId === s.player.hotelRoomId)).toEqual([]);
    expect(s.items.filter((i) => i.roomId === null)).toEqual([]);
    expect(s.hotbar).toEqual(Array(HOTBAR_SLOTS).fill(null));
  });

  it('puts exactly one counter and one stall_table in the shop, at their fixed spots', () => {
    const shop = s.items.filter((i) => i.roomId === s.player.shopRoomId);
    expect(shop.map((i) => i.typeId).sort()).toEqual(['counter', 'stall_table']);
    for (const start of SHOP_START_ITEMS) {
      expect(shop.find((i) => i.typeId === start.typeId)).toMatchObject({ x: start.x, y: start.y, facing: start.facing });
    }
    const shopRoom = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
    for (const i of shop) {
      const others = s.items.filter((o) => o.uid !== i.uid);
      expect(canPlace(shopRoom, others, getFurnitureType(i.typeId), i.x, i.y, i.facing), i.typeId).toBe(true);
    }
  });

  it('starts an empty shop with the first customer 10 s away, and no hints done', () => {
    expect(s.shop).toMatchObject({ roomId: s.player.shopRoomId, slots: [], customers: [], nextCustomerInMs: 10_000, updatedAt: 1234 });
    expect(s.hintsDone).toBe(0);
  });

  it('puts the starting wood and cloth in the first two Materials slots of a 36-slot bag', () => {
    expect(s.bag.materials.slice(0, 3)).toEqual(['wood', 'cloth', null]);
    expect(s.bag.materials).toHaveLength(36);
    expect(s.bag.furniture.every((x) => x === null)).toBe(true);
  });

  it('writes the start gold and materials to the ledger', () => {
    expect(s.ledger).toEqual([
      { id: 1, at: 1234, playerId: s.player.id, reason: 'start', goldDelta: 100, materials: { wood: 4, cloth: 2 } },
    ]);
  });
});
