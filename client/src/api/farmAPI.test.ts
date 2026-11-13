// Step 9b: the farm, cooking and the lunch box through the GameAPI (LocalGameAPI).
import { describe, expect, it } from 'vitest';
import { FARM_HINT, createNewPlayer, plotCenter, saveKey, seededRng, toSaveText, type GameState } from '@pixel-hotel/shared';
import { ledgerGold, ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
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

describe('the farm through the GameAPI', () => {
  it('travel to the farm, plant turnips, come back later, harvest, cook a stew, eat it in the dungeon', async () => {
    t = 1000;
    const { api, storage } = open(fresh());
    const p = await api.getPlayer();
    // Travel to the farm: grass, a hedge, 6 empty plots.
    const farmRoom = await api.enterRoom(p.farmRoomId);
    expect(farmRoom.room).toMatchObject({ kind: 'farm', floorStyle: 'grass', wallStyle: 'hedge' });
    expect((await api.getFarm()).plots).toHaveLength(6);
    // Seeds from the catalog go into the hotbar.
    expect(await api.buySeeds('turnip_seed', 5)).toBe(true);
    expect(await api.buySeeds('potato_seed', 3)).toBe(true);
    const inv = await api.getInventory();
    expect(inv.hotbar.slice(0, 2)).toEqual(['turnip_seed', 'potato_seed']);
    expect((await api.getPlayer()).wallet.gold).toBe(100 - 20 - 18);
    // Walk to a plot and plant.
    expect(await api.walk(plotCenter(0))).not.toBeNull();
    for (let i = 0; i < 3; i++) expect(await api.plant(i, 'turnip_seed')).not.toBeNull();
    expect(await api.plant(0, 'turnip_seed')).toBeNull(); // not twice
    for (let i = 3; i < 6; i++) expect(await api.plant(i, 'potato_seed')).not.toBeNull();
    expect(api.snapshot().hintsDone).toBe(0); // the first hints are not this one
    expect(await api.harvest(0)).toBeNull(); // not ripe yet
    // Close the game and come back 20 minutes later: still growing by time.
    t += 20 * MIN;
    const again = LocalGameAPI.open(storage, clock, seededRng(9)).api;
    let crops = 0;
    for (let i = 0; i < 6; i++) {
      const h = await again.harvest(i);
      expect(h).not.toBeNull();
      expect(h!.qty).toBeGreaterThanOrEqual(1);
      expect(h!.qty).toBeLessThanOrEqual(2);
      crops += h!.qty;
    }
    const m = (await again.getPlayer()).materials;
    expect((m.turnip ?? 0) + (m.potato ?? 0)).toBe(crops);
    // Cook a stew: 2 potatoes + 1 turnip (3 potato plots give at least 3).
    expect(await again.cook('potato_stew')).toBe(true);
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
    await api.plant(0, 'turnip_seed');
    expect(await api.currentHint()).toBeNull();
  });

  it('the cooking pot blocks walking; plots do not', async () => {
    t = 1000;
    const { api } = open(fresh());
    await api.enterRoom((await api.getPlayer()).farmRoomId);
    const onPlot = await api.walk(plotCenter(2));
    expect(onPlot?.at(-1)).toEqual(plotCenter(2));
    const toPot = await api.walk({ x: 464, y: 110 });
    const end = toPot?.at(-1);
    expect(end && !(end.x > 448 && end.x < 480 && end.y > 96 && end.y < 120)).toBe(true);
  });
});
