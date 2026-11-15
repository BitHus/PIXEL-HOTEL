import { describe, expect, it } from 'vitest';
import { AWAY_ORDERS_MAX, FURNITURE_TYPES, footprintRect, getFurnitureType, SAVE_BACKUP_KEY, countInInventory, saveKey, toSaveText, createNewPlayer } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

const openOrderCount = (t: { guests: readonly { phase: string; order: unknown }[] }): number => t.guests.filter((g) => g.phase === 'order' && g.order).length;

let t = 1000;
const clock = (): number => t;

async function filledGame() {
  const storage = memoryStorage();
  const { api } = LocalGameAPI.open(storage, clock);
  api.debugGiveFurniture(FURNITURE_TYPES.filter((t) => t.category === 'home_furniture' && t.inCatalog).map((t) => t.id));
  return { storage, api };
}

describe('LocalGameAPI', () => {
  it('a new game has an empty room and an empty furniture inventory', async () => {
    const { api, notice } = LocalGameAPI.open(memoryStorage(), clock);
    expect(notice).toBeNull();
    const player = await api.getPlayer();
    const room = await api.enterRoom(player.hotelRoomId);
    expect(room.items).toEqual([]);
    const inv = await api.getInventory();
    expect(inv.furniture).toEqual([]);
    expect(inv.materials).toEqual({ wood: 4, cloth: 2 });
    expect(player.wallet.gold).toBe(100);
  });

  it('the test helper adds one of each of the 12 home items', async () => {
    const { api } = await filledGame();
    const inv = await api.getInventory();
    expect(inv.furniture).toHaveLength(12);
    expect(new Set(inv.furniture.map((i) => i.typeId)).size).toBe(12);
  });

  it('placing takes the item out of the inventory, picking up returns it', async () => {
    const { api } = await filledGame();
    await api.enterRoom(1);
    const chair = (await api.getInventory()).furniture.find((i) => i.typeId === 'chair')!;
    const placed = await api.placeItem(chair.uid, { center: { x: 100, y: 100 }, facing: 'down', snap: true });
    expect(placed?.find((i) => i.uid === chair.uid)?.roomId).toBe(1);
    expect(countInInventory((await api.getInventory()).furniture, 'chair')).toBe(0);
    // An invalid spot is refused and changes nothing.
    const sofa = (await api.getInventory()).furniture.find((i) => i.typeId === 'sofa')!;
    expect(await api.placeItem(sofa.uid, { center: { x: -500, y: 100 }, facing: 'down', snap: true })).toBeNull();
    const back = await api.pickUpItem(chair.uid);
    expect(back?.find((i) => i.uid === chair.uid)?.roomId).toBeNull();
    expect(countInInventory((await api.getInventory()).furniture, 'chair')).toBe(1);
  });

  it('lies in the bed from the nearest side, and stands next to it when the bed is moved', async () => {
    const { api } = await filledGame();
    await api.enterRoom(1); // avatar in the door zone (288, ~360)
    const bed = (await api.getInventory()).furniture.find((i) => i.typeId === 'bed')!;
    await api.placeItem(bed.uid, { center: { x: 160, y: 160 }, facing: 'down', snap: true });
    const r = await api.sit(bed.uid);
    expect(r?.seat.pose).toBe('lie');
    t += 60_000; // long arrived
    // Out of bed (fix after 9e): the next walk starts NEXT to the bed, on the side it goes to,
    // not in the middle of the bed (the avatar walked on under the bed's drawing and was gone).
    const from = (await api.walk({ x: 400, y: 200 }))![0]!;
    const fp = footprintRect({ x: 160, y: 200, facing: 'down' }, getFurnitureType('bed'));
    expect(from.x >= fp.x && from.x <= fp.x + fp.w && from.y >= fp.y && from.y <= fp.y + fp.h).toBe(false);
    expect(from.x).toBeGreaterThan(fp.x + fp.w); // to the right, where it is going
    expect(Math.hypot(from.x - r!.seat.x, from.y - r!.seat.y)).toBeLessThan(64);
    // Lie down again, then nudge the bed: the avatar stands next to it on a free spot.
    await api.sit(bed.uid);
    t += 60_000;
    await api.moveItem(bed.uid, { center: { x: 176, y: 160 }, facing: 'down', snap: true });
    const stood = (await api.walk({ x: 288, y: 300 }))![0]!;
    expect(stood).not.toEqual({ x: r!.seat.x, y: r!.seat.y });
    expect(Math.hypot(stood.x - r!.seat.x, stood.y - r!.seat.y)).toBeLessThan(64);
    // Not an item with seats: refused.
    const table = (await api.getInventory()).furniture.find((i) => i.typeId === 'table')!;
    await api.placeItem(table.uid, { center: { x: 160, y: 260 }, facing: 'down', snap: true });
    expect(await api.sit(table.uid)).toBeNull();
  });

  it('the bag: hotbar and bag slots, a placed hotbar type keeps its slot, materials stay out of the hotbar', async () => {
    const { api } = await filledGame();
    await api.enterRoom(1);
    let inv = await api.getInventory();
    expect(inv.bag.furniture.slice(0, 3)).toEqual(['chair', 'sofa', 'table']);
    expect(inv.bag.furniture).toHaveLength(36);
    expect(inv.bag.materials.slice(0, 2)).toEqual(['wood', 'cloth']);
    // Chair to the hotbar: it leaves the bag.
    await api.moveSlot({ area: 'furniture', index: 0 }, { area: 'hotbar', index: 3 });
    inv = await api.getInventory();
    expect(inv.hotbar[3]).toBe('chair');
    expect(inv.bag.furniture[0]).toBeNull();
    // Place the only chair: the hotbar slot keeps it (dimmed), and Pick up brings it back there.
    const chair = inv.furniture.find((i) => i.typeId === 'chair')!;
    await api.placeItem(chair.uid, { center: { x: 100, y: 100 }, facing: 'down', snap: true });
    expect((await api.getInventory()).hotbar[3]).toBe('chair');
    await api.pickUpItem(chair.uid);
    inv = await api.getInventory();
    expect(inv.hotbar[3]).toBe('chair');
    expect(inv.bag.furniture.includes('chair')).toBe(false);
    // Materials cannot go in the hotbar.
    expect(await api.moveSlot({ area: 'materials', index: 0 }, { area: 'hotbar', index: 0 })).toBeNull();
    // Sort packs the tab in catalog order; hotbarToBag puts the chair in the first free slot.
    await api.moveSlot({ area: 'furniture', index: 1 }, { area: 'furniture', index: 30 });
    const sorted = await api.tidyBag('furniture', 'sort');
    expect(sorted.bag.furniture.slice(0, 2)).toEqual(['sofa', 'table']);
    const back = await api.hotbarToBag(3);
    expect(back?.hotbar[3]).toBeNull();
    expect(back?.bag.furniture[11]).toBe('chair');
  });

  it('each room keeps its own furniture', async () => {
    const { api } = await filledGame();
    await api.enterRoom(1);
    const rug = (await api.getInventory()).furniture.find((i) => i.typeId === 'rug')!;
    await api.placeItem(rug.uid, { center: { x: 120, y: 120 }, facing: 'down', snap: true });
    expect((await api.enterRoom(2)).items.map((i) => i.typeId).sort()).toEqual(['bar_stool', 'bar_stool', 'brewing_barrel', 'counter', 'round_table', 'stall_table', 'stove']);
    expect((await api.enterRoom(1)).items.map((i) => i.uid)).toEqual([rug.uid]);
  });

  it('saving and loading gives an identical state (a reload keeps everything)', async () => {
    const { api, storage } = await filledGame();
    await api.enterRoom(1);
    const lamp = (await api.getInventory()).furniture.find((i) => i.typeId === 'lamp')!;
    await api.placeItem(lamp.uid, { center: { x: 200, y: 150 }, facing: 'down', snap: true });
    await api.moveSlot({ area: 'furniture', index: 0 }, { area: 'hotbar', index: 0 });
    await api.setLook({ skin: 31, hair: 2, hairStyle: 'ponytail', top: 'vest', shirt: 13, bottoms: 'skirt', legs: 5, shoes: 25 });
    const reloaded = LocalGameAPI.open(storage, clock);
    expect(reloaded.notice).toBeNull();
    expect(reloaded.api.snapshot()).toEqual(api.snapshot());
  });

  it('export then import gives an identical state', async () => {
    const { api } = await filledGame();
    await api.moveSlot({ area: 'furniture', index: 11 }, { area: 'hotbar', index: 2 });
    const file = api.exportSave();
    const other = LocalGameAPI.open(memoryStorage(), clock).api;
    expect(other.importSave(file)).toEqual({ ok: true });
    expect(other.snapshot()).toEqual(api.snapshot());
    // The game before the import became the backup.
    expect(other.hasBackup()).toBe(true);
    expect(other.importSave('not json')).toMatchObject({ ok: false });
  });

  it('loads the automatic backup when the save is damaged', async () => {
    const { api, storage } = await filledGame();
    storage.set(SAVE_BACKUP_KEY, api.exportSave());
    storage.set(saveKey(), '{broken');
    const r = LocalGameAPI.open(storage, clock);
    expect(r.notice).toMatch(/backup/);
    expect(r.api.snapshot()).toEqual(api.snapshot());
  });

  it('updates a version 1 save and fills its bag layout from the inventory', () => {
    const storage = memoryStorage();
    const { bag: _bag, ...v1 } = createNewPlayer(undefined, 1);
    storage.set(saveKey(1), JSON.stringify({ version: 1, savedAt: 1, state: v1 }));
    const r = LocalGameAPI.open(storage, clock);
    expect(r.notice).toMatch(/updated/);
    expect(r.api.snapshot().bag.materials.slice(0, 2)).toEqual(['wood', 'cloth']);
  });

  it('resets with a message when the save version is too old to migrate', () => {
    const storage = memoryStorage();
    const old = toSaveText(createNewPlayer(), 1).replace(/"version":\d+/, '"version":0');
    storage.set(saveKey(), old);
    const r = LocalGameAPI.open(storage, clock);
    expect(r.notice).toMatch(/new game/i);
    expect(r.api.snapshot().items.filter((i) => i.roomId !== 2)).toEqual([]);
  });

  it('chat cleans the text and tells the listeners', async () => {
    const { api } = LocalGameAPI.open(memoryStorage(), clock);
    const heard: string[] = [];
    api.onChat((l) => heard.push(l.text));
    expect(await api.chat('   ')).toBeNull();
    expect((await api.chat(' hello  there '))?.text).toBe('hello there');
    expect(heard).toEqual(['hello there']);
  });

  it('walks from where the avatar is by now', async () => {
    const { api } = LocalGameAPI.open(memoryStorage(), clock);
    const room = await api.enterRoom(1);
    const start = room.avatars[0]!;
    const path = await api.walk({ x: start.x, y: start.y - 128 });
    expect(path?.[0]).toEqual({ x: start.x, y: start.y });
    t += 500; // 64 px at 128 px/s
    const next = await api.walk({ x: start.x, y: start.y });
    expect(next?.[0]?.y).toBeCloseTo(start.y - 64);
  });
});

describe('LocalGameAPI tavern (step 7, S1: the shop is the tavern)', () => {
  const seq = (): (() => number) => {
    let k = 0;
    return () => ((k++ * 0.6180339887) % 1);
  };

  it('nobody sells loot to customers any more: no goods calls, no customer events, and the stall is plain decor', async () => {
    const { api } = LocalGameAPI.open(memoryStorage(), clock, seq());
    for (const gone of ['getShop', 'putOnShelf', 'takeFromShelf', 'setPrice', 'onShop', 'isServing']) expect(gone in api, gone).toBe(false);
    const table = (await api.enterRoom(2)).items.find((i) => i.typeId === 'stall_table')!;
    expect(getFurnitureType('stall_table')).not.toHaveProperty('slots');
    expect(await api.serve(table.uid)).toBeNull(); // only the bar is served from behind
    expect((await api.getTavern()).appeal).toBeGreaterThan(0);
  });

  it('gold comes from guests: a tavern left alone earns nothing, serving does', async () => {
    let now = 0;
    const { api } = LocalGameAPI.open(memoryStorage(), () => now, seq());
    const p = await api.getPlayer();
    await api.enterRoom(p.shopRoomId);
    const barrel = (await api.getItems()).find((i) => i.typeId === 'brewing_barrel')!;
    expect(await api.collectBrew(barrel.uid)).not.toBeNull();
    // Guests come and order, but with nobody serving the gold does not move.
    for (; now < 120_000; now += 100) api.update();
    expect((await api.getPlayer()).wallet.gold).toBe(100);
    const guest = (await api.getTavern()).guests.find((g) => g.phase === 'order');
    expect(guest).toBeDefined();
    expect(await api.serveGuest(guest!.id)).toBe(true);
    for (let k = 0; k < 600 && (await api.getTavern()).mess.every((m) => m.coins === 0); k++, now += 100) api.update();
    const mess = (await api.getTavern()).mess.find((m) => m.coins > 0)!;
    expect(mess).toBeDefined();
    expect(await api.tidyTable(mess.id, 'coins')).toBe(true);
    for (let k = 0; k < 300; k++, now += 100) api.update();
    expect((await api.getPlayer()).wallet.gold).toBeGreaterThan(100);
  });

  it('a closed game catches up the guests only: open orders wait, nothing is paid without the player', async () => {
    let now = 0;
    const storage = memoryStorage();
    const { api } = LocalGameAPI.open(storage, () => now, seq());
    const p = await api.getPlayer();
    await api.enterRoom(p.shopRoomId);
    now = 20 * 3600_000;
    const again = LocalGameAPI.open(storage, () => now, seq()).api;
    again.update();
    expect((await again.getPlayer()).wallet.gold).toBe(100);
    expect(openOrderCount(await again.getTavern())).toBeLessThanOrEqual(AWAY_ORDERS_MAX);
  });

  it('the counter cannot be picked up; the stall table can, and goes back to the bag as plain decor', async () => {
    const { api } = LocalGameAPI.open(memoryStorage(), clock);
    const items = (await api.enterRoom(2)).items;
    const counter = items.find((i) => i.typeId === 'counter')!;
    const table = items.find((i) => i.typeId === 'stall_table')!;
    expect(await api.pickUpItem(counter.uid)).toBeNull();
    expect(await api.pickUpItem(table.uid)).not.toBeNull();
    expect((await api.getInventory()).materials.wood).toBe(4); // nothing was on it
    expect((await api.getInventory()).furniture.some((f) => f.typeId === 'stall_table')).toBe(true);
  });

  it('an old save (version 21) with goods on the stall: they are back in the bag, with a notice, and nothing is lost', async () => {
    const base = createNewPlayer(undefined, 5);
    const { tavern, ...rest } = base;
    const { nextGuestId: _n, ...oldTavern } = tavern;
    const stall = base.items.find((i) => i.typeId === 'stall_table')!;
    const old = {
      ...rest,
      tavern: oldTavern,
      player: { ...rest.player, materials: { cloth: 2 } },
      shop: {
        roomId: tavern.roomId,
        slots: [{ shelfUid: stall.uid, index: 0, loot: { kind: 'material', id: 'wood', qty: 1 }, price: 5 }],
        nextCustomerInMs: 1000,
        saleHistory: {},
        customers: [],
        nextCustomerId: -4,
        updatedAt: 5,
        lastLines: {},
      },
    };
    const storage = memoryStorage();
    storage.set(saveKey(21), JSON.stringify({ version: 21, savedAt: 5, state: old }));
    const { api, notice } = LocalGameAPI.open(storage, clock);
    expect(notice).toMatch(/back in your bag/);
    const inv = await api.getInventory();
    expect(inv.materials).toEqual({ wood: 1, cloth: 2 }); // the bag had 2 cloth; the wood came off the stall
    expect((await api.getPlayer()).wallet.gold).toBe(100);
  });

  it('catalog, hints, styles and room upgrades', async () => {
    const { api } = LocalGameAPI.open(memoryStorage(), clock);
    expect(await api.currentHint()).toMatch(/Catalog/);
    const first = await api.buyCatalog('chair');
    expect(first?.first).toBe(true);
    expect(first?.gains).toEqual([{ itemId: 'chair', count: 1, rank: 'common' }]);
    expect(await api.currentHint()).toMatch(/Place/);
    expect((await api.buyCatalog('chair'))?.first).toBe(false);
    expect(await api.buyCatalog('counter')).toBeNull();
    await api.enterRoom(1);
    await api.placeItem(first!.uid, { center: { x: 100, y: 100 }, facing: 'down', snap: true });
    expect(await api.currentHint()).toMatch(/table/);
    expect(await api.buyStyle('floor', 'wood_planks')).toBe(true);
    expect((await api.getPlayer()).wallet.gold).toBe(100 - 15 - 15 - 30);
    expect((await api.applyStyle(1, 'floor', 'wood_planks'))?.floorStyle).toBe('wood_planks');
    expect(await api.applyStyle(1, 'wall', 'brick')).toBeNull();
    // Painting cells (step BG1): the unlocked style on one cell, and a style you do not own is refused.
    await api.applyStyle(1, 'floor', 'bare');
    const painted = await api.paintFloor(1, { c: 2, r: 2 }, { c: 3, r: 2 }, 'wood_planks');
    expect(painted?.floorCells).toEqual({ '2,2': 'wood_planks', '3,2': 'wood_planks' });
    expect(await api.paintFloor(1, { c: 2, r: 2 }, { c: 2, r: 2 }, 'stone_tiles')).toBeNull();
    expect(await api.upgradeRoom(1)).toBeNull();
  });
});
