import { tavernSeats } from './tavern.ts';
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
    expect(s.player.wallet).toEqual({ gold: 100, gems: 0 });
    expect(s.player.materials).toEqual({ wood: 4, cloth: 2 });
    expect(s.player.gear).toEqual([]);
    expect(s.player.potions).toBe(0);
  });

  it('unlocks only the bare floor and bare wall, used in both rooms (the farm and the lakeside have grass and a hedge)', () => {
    expect(s.player.unlockedStyles).toEqual([styleKey('floor', 'bare'), styleKey('wall', 'bare')]);
    for (const r of s.rooms.filter((x) => x.kind !== 'farm' && x.kind !== 'lakeside')) expect([r.floorStyle, r.wallStyle]).toEqual(['bare', 'bare']);
    expect(s.rooms.find((r) => r.kind === 'farm')).toMatchObject({ floorStyle: 'grass', wallStyle: 'hedge' });
    expect(s.rooms.find((r) => r.kind === 'lakeside')).toMatchObject({ floorStyle: 'grass', wallStyle: 'hedge' });
  });

  it('has an empty level 1 hotel room (576x384) and a level 1 shop room (576x320)', () => {
    const hotel = s.rooms.find((r) => r.id === s.player.hotelRoomId);
    const shop = s.rooms.find((r) => r.id === s.player.shopRoomId);
    expect(hotel).toMatchObject({ kind: 'hotel', level: 1, w: 576, h: 384, ownerId: s.player.id });
    expect(shop).toMatchObject({ kind: 'shop', level: 1, w: 576, h: 320, ownerId: s.player.id });
    expect(s.rooms).toHaveLength(4);
    // Step 9f: a level 1 lakeside (576x384) with 8 whole trees.
    expect(s.rooms.find((r) => r.id === s.player.lakesideRoomId)).toMatchObject({ kind: 'lakeside', level: 1, w: 576, h: 384 });
    expect(s.lakeside.trees).toEqual(Array.from({ length: 8 }, () => ({ hits: 0, felledAt: null })));
    expect(s.player.biggest).toEqual({});
    // Step BG6: a level 1 farm (576x384) with a patch of soil cells and no plants.
    expect(s.rooms.find((r) => r.id === s.player.farmRoomId)).toMatchObject({ kind: 'farm', level: 1, w: 576, h: 384, plants: {} });
    expect(Object.values(s.rooms.find((r) => r.id === s.player.farmRoomId)!.floorCells ?? {})).toEqual(Array.from({ length: 12 }, () => 'soil'));
    expect(s.currentRoomId).toBe(hotel?.id);
  });

  it('has an empty hotel room, nothing in the inventory, and an empty hotbar', () => {
    expect(s.items.filter((i) => i.roomId === s.player.hotelRoomId)).toEqual([]);
    expect(s.items.filter((i) => i.roomId === null)).toEqual([]);
    expect(s.hotbar).toEqual(Array(HOTBAR_SLOTS).fill(null));
  });

  it('puts the bar, a bar stool in front of it, a round table with 2 stools, a brewing barrel and a stove in the shop, at their fixed spots; no stall table (S3)', () => {
    const shop = s.items.filter((i) => i.roomId === s.player.shopRoomId);
    expect(shop.map((i) => i.typeId).sort()).toEqual(['bar_stool', 'bar_stool', 'bar_stool', 'brewing_barrel', 'counter', 'register', 'round_table', 'stove', 'tap_stand']);
    for (const start of SHOP_START_ITEMS.filter((x) => x.typeId === 'counter')) {
      expect(shop.find((i) => i.typeId === start.typeId)).toMatchObject({ x: start.x, y: start.y, facing: start.facing });
    }
    const shopRoom = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
    for (const i of shop) {
      const others = s.items.filter((o) => o.uid !== i.uid);
      expect(canPlace(shopRoom, others, getFurnitureType(i.typeId), i.x, i.y, i.facing), i.typeId).toBe(true);
    }
  });

  it('starts a tavern with no guests yet, no shop state, and no hints done', () => {
    expect('shop' in s).toBe(false);
    expect(s.tavern).toMatchObject({ roomId: s.player.shopRoomId, guests: [], nextGuestId: -1, updatedAt: 1234 });
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
    expect(s.look).toEqual({ ...look, hairStyle: 'long', top: 'tunic', bottoms: 'trousers' }); // CH1: only drawn pieces
    expect(s.rooms.find((r) => r.id === s.player.hotelRoomId)).toMatchObject({ shape: 'l_shape', level: 1, kind: 'hotel' });
    expect(s.rooms.find((r) => r.id === s.player.shopRoomId)).toMatchObject({ shape: 'plus', level: 1, kind: 'shop' });
    expect(s.player.unlockedClothing).toEqual([]);
    expect(s.playerCreated).toBe(false); // the API sets it once the player is made
  });

  it('names the tavern (ONBOARD-1): derived from the player name; a given clean name still wins, same rules as the display name', () => {
    expect(createNewPlayer(configForChoice(choice)!, 1).player.innName).toBe("Ada Lovely 7's Tavern");
    expect(createNewPlayer(configForChoice({ ...choice, innName: '   ' })!, 1).player.innName).toBe("Ada Lovely 7's Tavern");
    expect(createNewPlayer(configForChoice({ ...choice, innName: '  The  Gilded Mug 2 ' })!, 1).player.innName).toBe('The Gilded Mug 2');
    expect(configForChoice({ ...choice, innName: 'a'.repeat(17) })).toBeNull();
    expect(configForChoice({ ...choice, innName: 'Inn<b>' })).toBeNull();
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
    expect(selectableClothing('top').map((c) => c.id)).toEqual(['t_shirt', 'long_sleeve', 'vest', 'tunic']);
    expect(selectableClothing('bottoms').map((c) => c.id)).toEqual(['trousers', 'shorts', 'skirt']);
    for (const c of CLOTHING.filter((x) => !x.free && !x.starter)) expect(selectableClothing(c.slot).some((x) => x.id === c.id)).toBe(false);
    // Unlocked later (catalog or dungeon): then it shows.
    expect(selectableClothing('hair', ['mohawk']).map((c) => c.id)).toContain('mohawk');
    expect(lookAllowed(START_LOOK)).toBe(true);
  });

  it('every shop shape has a counter (with room behind it) and a round table with three stools that fit (no stool at the bar)', () => {
    for (const shape of shapesFor('shop')) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape.id }, 0);
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
      const shop = s.items.filter((i) => i.roomId === room.id);
      expect(shop.map((i) => i.typeId).sort(), shape.id).toEqual(['bar_stool', 'bar_stool', 'bar_stool', 'brewing_barrel', 'counter', 'register', 'round_table', 'stove', 'tap_stand']);
      // Three seats (S3, G2): all three stools stand at the round table (uid 2).
      expect(tavernSeats(s.items, room.id).map((x) => x.tableUid), shape.id).toEqual([2, 2, 2]);
      for (const i of shop) {
        const others = s.items.filter((o) => o.uid !== i.uid);
        expect(canPlace(room, others, getFurnitureType(i.typeId), i.x, i.y, i.facing), `${shape.id} ${i.typeId}`).toBe(true);
      }
    }
  });
});
