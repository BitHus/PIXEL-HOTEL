// Step 9b: the farm, cooking and the lunch box through the GameAPI (LocalGameAPI).
import { describe, expect, it } from 'vitest';
import { BLOCK_HIT_COOLDOWN_MS, FARM_HINT, applyChange, SEED_GROW_MS, createNewPlayer, saveKey, seededRng, toSaveText, type GameState } from '@pixel-hotel/shared';
import { ledgerGold, ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import type { BlockResult, GameAPI } from '@pixel-hotel/shared';
import { memoryStorage } from './saveStorage.ts';

const MIN = 60_000;
let t = 1000;
const clock = (): number => t;

function fresh(extra: Partial<GameState> = {}): GameState {
  const s = createNewPlayer(undefined, 0);
  return { ...s, playerCreated: true, ...extra };
}

function open(state: GameState) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { storage, api: LocalGameAPI.open(storage, clock, seededRng(4)).api };
}

/** Runs a request; when the avatar has to walk closer first, time passes and it asks again (like the client does). */
async function until(call: () => Promise<BlockResult>): Promise<BlockResult> {
  for (let i = 0; i < 6; i++) {
    const r = await call();
    if (r.kind !== 'walk') return r;
    t += 20_000;
  }
  throw new Error('never arrived');
}
const plantAt = (api: GameAPI, c: number, r: number, seed: 'turnip_seed' | 'potato_seed'): Promise<BlockResult> => until(() => api.plantSeed(c, r, seed));
const punch = (api: GameAPI, c: number, r: number): Promise<BlockResult> => {
  t += BLOCK_HIT_COOLDOWN_MS + 1;
  return until(() => api.hitPlant(c, r));
};

describe('the farm through the GameAPI', () => {
  it('travel to the farm, plant turnips, come back later, harvest, cook a stew, eat it in the dungeon', async () => {
    t = 1000;
    const { api, storage } = open(fresh());
    const p = await api.getPlayer();
    // Travel to the farm: grass, a hedge, a patch of 12 soil cells.
    const farmRoom = await api.enterRoom(p.farmRoomId);
    expect(farmRoom.room).toMatchObject({ kind: 'farm', floorStyle: 'grass', wallStyle: 'hedge' });
    expect(await api.getFarm()).toMatchObject({ ripe: 0, growing: 0, free: 12 });
    // Seeds from the catalog go into the hotbar.
    expect(await api.buySeeds('turnip_seed', 5)).toEqual([{ itemId: 'turnip_seed', count: 5, rank: 'common' }]);
    expect(await api.buySeeds('potato_seed', 3)).not.toBeNull();
    const inv = await api.getInventory();
    expect(inv.hotbar.slice(0, 2)).toEqual(['turnip_seed', 'potato_seed']);
    expect((await api.getPlayer()).wallet.gold).toBe(100 - 20 - 18);
    // Plant: the soil patch is cells (2..7, 2..3). A far cell walks the avatar closer first.
    for (const c of [2, 3, 4]) expect(await plantAt(api, c, 2, 'turnip_seed')).toMatchObject({ kind: 'planted' });
    expect(await api.plantSeed(2, 2, 'turnip_seed')).toEqual({ kind: 'refused', problem: 'taken' }); // not twice
    for (const c of [2, 3, 4]) expect(await plantAt(api, c, 3, 'potato_seed')).toMatchObject({ kind: 'planted' });
    expect(api.snapshot().hintsDone).toBe(0); // the first hints are not this one
    expect(await api.getFarm()).toMatchObject({ ripe: 0, growing: 6, free: 6 });
    // A punch on a young plant leaves it alone and says how long is left.
    const young = await punch(api, 2, 2);
    expect(young).toMatchObject({ kind: 'unripe' });
    expect(young.kind === 'unripe' && young.leftMs).toBeGreaterThan(0);
    expect(await api.getFarm()).toMatchObject({ growing: 6 });
    // Close the game and come back 20 minutes later: still growing by time.
    t += 20 * MIN;
    const again = LocalGameAPI.open(storage, clock, seededRng(9)).api;
    expect(await again.getFarm()).toMatchObject({ ripe: 6, growing: 0 });
    let crops = 0;
    for (const [c, r] of [[2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3]] as const) {
      const h = await punch(again, c, r);
      expect(h.kind).toBe('harvested');
      if (h.kind !== 'harvested') return;
      const crop = h.gains.find((g) => g.itemId === 'turnip' || g.itemId === 'potato')!;
      expect(crop.count).toBeGreaterThanOrEqual(2);
      expect(crop.count).toBeLessThanOrEqual(4);
      crops += crop.count;
      expect(h.room.plants[`${c},${r}`]).toBeUndefined(); // the cell is free again
    }
    expect(await again.getFarm()).toMatchObject({ ripe: 0, growing: 0, free: 12 });
    const m = (await again.getPlayer()).materials;
    expect((m.turnip ?? 0) + (m.potato ?? 0)).toBe(crops);
    // Cook a stew in the tavern (step K1): 2 potatoes + 1 turnip (the 3 potato plants gave at least 6); it takes a minute.
    const stove = (await again.enterRoom((await again.getPlayer()).shopRoomId)).items.find((i) => i.typeId === 'stove')!;
    expect(await again.startCook(stove.uid, 'potato_stew', 1)).toBe(true);
    expect(await again.collectCook(stove.uid)).toBeNull(); // not ready yet
    t += MIN;
    expect((await again.collectCook(stove.uid))?.gains).toEqual([{ itemId: 'potato_stew', count: 1, rank: expect.any(String) }]); // the ingredients used are not gains
    expect((await again.getPlayer()).materials.potato_stew).toBe(1);
    const food = 'potato_stew';
    // Into the dungeon with the food in the lunch box; eat it to heal.
    const run = await again.dungeonStart([food]);
    expect(run?.player.food).toEqual([food]);
    expect((await again.getPlayer()).materials[food]).toBeUndefined();
    const s = again.snapshot();
    s.run = { ...s.run!, player: { ...s.run!.player, hp: 5 } };
    const { api: inRun } = open(s);
    await inRun.dungeonResume();
    const ate = await inRun.dungeonInput({ t: 'eat' });
    expect(ate?.run.player.hp).toBe(5 + 15);
    expect(ate?.run.player.food).toEqual([]);
    const end = inRun.snapshot();
    expect(ledgerGold(end)).toBe(end.player.wallet.gold);
    expect(ledgerMaterials(end)).toEqual(end.player.materials);
  });

  it('planting finishes the farm quest when it shows', async () => {
    t = 1000;
    const { api } = open(fresh({ hintsDone: FARM_HINT }));
    expect(await api.currentHint()).toMatch(/turnip/);
    await api.buySeeds('turnip_seed', 1);
    await api.enterRoom((await api.getPlayer()).farmRoomId);
    await plantAt(api, 2, 2, 'turnip_seed');
    // The next quest is the pack quest (step BG9).
    expect(await api.currentHint()).toMatch(/pack/i);
  });

  it('seeds only go on soil in a farm; out of reach walks; a block seed grows blocks', async () => {
    t = 1000;
    const s = fresh();
    const { api } = open(applyChange(s, { reason: 'debug', materials: { dirt_seed: 2, turnip_seed: 2 } }, 0)!);
    // The hotel refuses seeds.
    expect(await api.plantSeed(5, 5, 'turnip_seed')).toEqual({ kind: 'refused', problem: 'wrong_room' });
    const p = await api.getPlayer();
    await api.enterRoom(p.farmRoomId);
    expect(await api.plantSeed(12, 8, 'turnip_seed')).toEqual({ kind: 'refused', problem: 'no_soil' }); // grass
    expect((await api.plantSeed(7, 3, 'dirt_seed')).kind).toBe('walk'); // too far from the door
    expect(await api.hitPlant(7, 3)).toEqual({ kind: 'refused', problem: 'no_plant' });
    const planted = await plantAt(api, 7, 3, 'dirt_seed' as never);
    expect(planted).toMatchObject({ kind: 'planted' });
    t += SEED_GROW_MS.common;
    const h = await punch(api, 7, 3);
    expect(h).toMatchObject({ kind: 'harvested' });
    if (h.kind !== 'harvested') return;
    expect(h.gains.find((g) => g.itemId === 'dirt')!.count).toBeGreaterThanOrEqual(2); // a block seed grows dirt blocks
    const end = api.snapshot();
    expect(ledgerGold(end)).toBe(end.player.wallet.gold);
    expect(ledgerMaterials(end)).toEqual(end.player.materials);
  });

  it('a plant blocks walking; bare soil does not; the old cooking pot spot is free (step K1)', async () => {
    t = 1000;
    const { api } = open(fresh());
    await api.buySeeds('turnip_seed', 1);
    await api.enterRoom((await api.getPlayer()).farmRoomId);
    const onSoil = await api.walk({ x: 5 * 32 + 16, y: 3 * 32 + 16 });
    expect(onSoil?.at(-1)).toEqual({ x: 5 * 32 + 16, y: 3 * 32 + 16 });
    await plantAt(api, 5, 3, 'turnip_seed');
    t += 20_000;
    const onPlant = await api.walk({ x: 5 * 32 + 16, y: 3 * 32 + 16 });
    const end = onPlant?.at(-1);
    expect(end && Math.floor(end.x / 32) === 5 && Math.floor(end.y / 32) === 3).toBe(false); // it stops next to the plant
    const toPot = await api.walk({ x: 464, y: 110 });
    expect(toPot?.at(-1)).toEqual({ x: 464, y: 110 }); // where the pot stood: you can walk right there now
  });
});
