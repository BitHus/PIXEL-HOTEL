import { describe, expect, it } from 'vitest';
import { DEFAULT_NEW_PLAYER, configForChoice, createNewPlayer, styleKey } from './newPlayer.ts';
import { CLOTHING, cleanDisplayName, lookAllowed, selectableClothing } from './clothing.ts';
import { shapesFor } from './room.ts';
import { HOTBAR_SLOTS, SHOP_START_ITEMS, START_LOOK } from './config.ts';
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

describe('a new player from character creation (step 7b)', () => {
  const look = { skin: 4, hair: 10, hairStyle: 'ponytail', top: 'vest', shirt: 13, bottoms: 'skirt', legs: 5, shoes: 25 };
  const choice = { name: '  Ada  Lovely 7 ', look, hotelShape: 'l_shape', shopShape: 'plus' };

  it('uses the chosen shapes, look and name', () => {
    const config = configForChoice(choice)!;
    const s = createNewPlayer(config, 5);
    expect(s.player.name).toBe('Ada Lovely 7');
    expect(s.look).toEqual(look);
    expect(s.rooms.find((r) => r.id === s.player.hotelRoomId)).toMatchObject({ shape: 'l_shape', level: 1, kind: 'hotel' });
    expect(s.rooms.find((r) => r.id === s.player.shopRoomId)).toMatchObject({ shape: 'plus', level: 1, kind: 'shop' });
    expect(s.player.unlockedClothing).toEqual([]);
    expect(s.playerCreated).toBe(false); // the API sets it once the player is made
  });

  it('refuses names that are not clean, clothing that is not free, and shapes for the wrong room', () => {
    expect(configForChoice({ ...choice, name: '' })).toBeNull();
    expect(configForChoice({ ...choice, name: 'a'.repeat(17) })).toBeNull();
    expect(configForChoice({ ...choice, name: 'hi<script>' })).toBeNull();
    expect(configForChoice({ ...choice, look: { ...look, hairStyle: 'mohawk' } })).toBeNull();
    expect(configForChoice({ ...choice, look: { ...look, shirt: 999 } })).toBeNull();
    expect(configForChoice({ ...choice, hotelShape: 'square_shop' })).toBeNull();
    expect(configForChoice({ ...choice, shopShape: 'square' })).toBeNull();
    expect(cleanDisplayName('Émile 2')).toBe('Émile 2');
  });

  it('only free clothing is selectable at the start', () => {
    expect(selectableClothing('hair').map((c) => c.id)).toEqual(['short', 'long', 'ponytail', 'buzz']);
    expect(selectableClothing('top').map((c) => c.id)).toEqual(['t_shirt', 'long_sleeve', 'vest']);
    expect(selectableClothing('bottoms').map((c) => c.id)).toEqual(['trousers', 'shorts', 'skirt']);
    for (const c of CLOTHING.filter((x) => !x.free)) expect(selectableClothing(c.slot).some((x) => x.id === c.id)).toBe(false);
    // Unlocked later (catalog or dungeon): then it shows.
    expect(selectableClothing('hair', ['mohawk']).map((c) => c.id)).toContain('mohawk');
    expect(lookAllowed(START_LOOK)).toBe(true);
  });

  it('every shop shape has a counter (with room behind it) and a stall_table that fit', () => {
    for (const shape of shapesFor('shop')) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape.id }, 0);
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
      const shop = s.items.filter((i) => i.roomId === room.id);
      expect(shop.map((i) => i.typeId).sort(), shape.id).toEqual(['counter', 'stall_table']);
      for (const i of shop) {
        const others = s.items.filter((o) => o.uid !== i.uid);
        expect(canPlace(room, others, getFurnitureType(i.typeId), i.x, i.y, i.facing), `${shape.id} ${i.typeId}`).toBe(true);
      }
    }
  });
});
