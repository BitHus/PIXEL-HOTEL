// Step BG7: splicing through the GameAPI (LocalGameAPI): plant, splice, wrong pair, wait, harvest, the hint, the Book.
import { describe, expect, it } from 'vitest';
import { BLOCK_HIT_COOLDOWN_MS, SPLICE_HINT, applyChange, createNewPlayer, pairKey, saveKey, seededRng, spliceGrowMs, toSaveText, type BlockResult, type GameAPI, type GameState } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;

function open() {
  const s0 = createNewPlayer(undefined, 0);
  const s: GameState = { ...applyChange(s0, { reason: 'debug', materials: { dirt_seed: 4, turnip_seed: 4, glass_seed: 2 } }, 0)!, playerCreated: true, hintsDone: SPLICE_HINT };
  const storage = memoryStorage({ [saveKey()]: toSaveText(s, 0) });
  return LocalGameAPI.open(storage, clock, seededRng(9)).api;
}

async function until(call: () => Promise<BlockResult>): Promise<BlockResult> {
  for (let i = 0; i < 6; i++) {
    const r = await call();
    if (r.kind !== 'walk') return r;
    t += 20_000;
  }
  throw new Error('never arrived');
}

describe('splicing through the GameAPI', () => {
  it('plant, splice, a wrong pair does nothing, wait, harvest the new seed, find the recipe', async () => {
    t = 1000;
    const api: GameAPI = open();
    const p = await api.getPlayer();
    await api.enterRoom(p.farmRoomId);
    expect(await api.currentHint()).toMatch(/Splice/);
    expect(await until(() => api.plantSeed(3, 2, 'dirt_seed'))).toMatchObject({ kind: 'planted' });
    // Nothing to splice on an empty cell.
    expect(await api.spliceSeed(4, 2, 'turnip_seed')).toEqual({ kind: 'refused', problem: 'no_plant' });
    // A pair that is not in the table, and the same seed twice: nothing happens, nothing is lost.
    expect(await until(() => api.spliceSeed(3, 2, 'glass_seed'))).toEqual({ kind: 'refused', problem: 'nothing_happens' });
    expect(await until(() => api.spliceSeed(3, 2, 'dirt_seed'))).toEqual({ kind: 'refused', problem: 'nothing_happens' });
    expect((await api.getPlayer()).materials).toMatchObject({ dirt_seed: 3, glass_seed: 2 });
    // The real pair.
    expect(await until(() => api.spliceSeed(3, 2, 'turnip_seed'))).toMatchObject({ kind: 'spliced' });
    expect((await api.getPlayer()).materials.turnip_seed).toBe(3);
    expect(await api.currentHint()).toBeNull(); // the splice quest is done
    expect(await api.spliceSeed(3, 2, 'turnip_seed')).toEqual({ kind: 'refused', problem: 'already_spliced' });
    // Not ripe yet: punching leaves it alone.
    t += BLOCK_HIT_COOLDOWN_MS + 1;
    expect(await until(() => api.hitPlant(3, 2))).toMatchObject({ kind: 'unripe' });
    // Wait for it, harvest: the new seed (clay) and the recipe.
    t += spliceGrowMs('dirt_seed', 'turnip_seed') + 1;
    const h = await until(() => api.hitPlant(3, 2));
    expect(h).toMatchObject({ kind: 'harvested', recipe: pairKey('dirt_seed', 'turnip_seed') });
    if (h.kind !== 'harvested') return;
    expect(h.gains.find((g) => g.itemId === 'clay_seed')?.count).toBe(1);
    const after = await api.getPlayer();
    expect(after.splicesFound).toEqual([pairKey('dirt_seed', 'turnip_seed')]);
    expect(after.materials.clay_seed).toBe(1);
  });
});
