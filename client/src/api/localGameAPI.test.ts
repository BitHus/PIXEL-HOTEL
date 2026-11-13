import { describe, expect, it } from 'vitest';
import { SAVE_BACKUP_KEY, countInInventory, saveKey, toSaveText, createNewPlayer } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;

async function filledGame() {
  const storage = memoryStorage();
  const { api } = LocalGameAPI.open(storage, clock);
  await api.debugGiveTestFurniture();
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

  it('Give test furniture adds one of each of the 12 home items', async () => {
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

  it('each room keeps its own furniture', async () => {
    const { api } = await filledGame();
    await api.enterRoom(1);
    const rug = (await api.getInventory()).furniture.find((i) => i.typeId === 'rug')!;
    await api.placeItem(rug.uid, { center: { x: 120, y: 120 }, facing: 'down', snap: true });
    expect((await api.enterRoom(2)).items).toEqual([]);
    expect((await api.enterRoom(1)).items.map((i) => i.uid)).toEqual([rug.uid]);
  });

  it('saving and loading gives an identical state (a reload keeps everything)', async () => {
    const { api, storage } = await filledGame();
    await api.enterRoom(1);
    const lamp = (await api.getInventory()).furniture.find((i) => i.typeId === 'lamp')!;
    await api.placeItem(lamp.uid, { center: { x: 200, y: 150 }, facing: 'down', snap: true });
    await api.setHotbarSlot(0, 'chair');
    await api.setLook({ skin: 1, hair: 2, hairStyle: 0, shirt: 3, legs: 4, shoes: 5 });
    const reloaded = LocalGameAPI.open(storage, clock);
    expect(reloaded.notice).toBeNull();
    expect(reloaded.api.snapshot()).toEqual(api.snapshot());
  });

  it('export then import gives an identical state', async () => {
    const { api } = await filledGame();
    await api.setHotbarSlot(2, 'bed');
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

  it('resets with a message when the save version is too old to migrate', () => {
    const storage = memoryStorage();
    const old = toSaveText(createNewPlayer(), 1).replace(/"version":\d+/, '"version":0');
    storage.set(saveKey(), old);
    const r = LocalGameAPI.open(storage, clock);
    expect(r.notice).toMatch(/new game/i);
    expect(r.api.snapshot().items).toEqual([]);
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
