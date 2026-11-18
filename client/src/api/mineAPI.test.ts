// Step 9c: the mine and the forge through the GameAPI (LocalGameAPI).
import { describe, expect, it } from 'vitest';
import { DIG_COLS, DIG_DEPTH_MAX, MINE_HINT, PICKAXE_COOLDOWN_MS, applyChange, blockAt, createNewPlayer, mergeGains, saveKey, seededRng, toSaveText, type DungeonRun, type GainList, type GameState } from '@pixel-hotel/shared';
import { ledgerGold, ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;

function player(level: number, extra: Partial<GameState> = {}): GameState {
  const s = applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold: 400 }, 0)!;
  return { ...s, playerCreated: true, player: { ...s.player, level, xp: level >= 3 ? 40 : 0 }, ...extra };
}

function open(state: GameState) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return LocalGameAPI.open(storage, clock, seededRng(3)).api;
}

describe('the mine through the GameAPI', () => {
  it('is locked below level 3; its hint shows from level 3 and goes when you go in', async () => {
    expect(await open(player(2)).mineStart()).toBeNull();
    expect(await open(player(2, { hintsDone: MINE_HINT })).currentHint()).toBeNull();
    const api = open(player(3, { hintsDone: MINE_HINT }));
    expect(await api.currentHint()).toMatch(/mine/);
    const run = await api.mineStart();
    expect(run?.place).toBe('mine');
    expect(await api.mineStart()).toBeNull(); // one at a time
    expect(await api.currentHint()).not.toMatch(/mine/); // the next quest (splicing) shows instead
    expect((await api.getPlayer()).wallet.gold).toBe(500); // free
  });

  it('digs a block, leaves with the ore (no lantern timer), smelts, forges, and the dungeon feels it', async () => {
    const api = open(player(3));
    const run = (await api.mineStart())!;
    expect(run.dig).toBeDefined();
    expect(run.lanternEndsAt).toBeNull();
    expect(run.maxFloors).toBe(DIG_DEPTH_MAX);
    // Put a coal block right next to the player (a saved run resumes in the API: Resume first).
    const at = blockAt(run.player);
    const cell = at.r * DIG_COLS + at.c + 1;
    const kinds = run.dig!.kinds.slice();
    kinds[cell] = 'coal';
    const blocks = run.map.blocks.slice();
    blocks[cell] = 'wall';
    const seeded: DungeonRun = { ...run, enemies: [], dig: { ...run.dig!, kinds, hazards: [], rare: [] }, map: { ...run.map, blocks } };
    const api2 = open({ ...api.snapshot(), run: seeded });
    await api2.dungeonResume();
    const gains: GainList = [];
    for (let k = 0; k < 30; k++) {
      const u = await api2.dungeonInput({ t: 'click_dig', c: at.c + 1, r: at.r });
      gains.push(...(u?.gains ?? []));
      if (u?.run.dig?.kinds[cell] === '') break;
      gains.push(...((await api2.dungeonAdvance(PICKAXE_COOLDOWN_MS))?.gains ?? []));
    }
    expect(mergeGains(gains).find((g) => g.itemId === 'coal')?.count).toBeGreaterThanOrEqual(1);
    expect((await api2.getRun())!.run.dig!.kinds[cell]).toBe('');
    // A long time passes: no lantern, the run is still going. Leave banks everything.
    expect((await api2.dungeonAdvance(10 * 60 * 1000))?.result).toBeNull();
    const end = await api2.dungeonInput({ t: 'leave' });
    expect(end?.result).toMatchObject({ status: 'left', place: 'mine', lanternOut: false });
    expect((await api2.getPlayer()).materials.coal ?? 0).toBeGreaterThanOrEqual(1);
    const s2 = api2.snapshot();
    expect(ledgerGold(s2)).toBe(s2.player.wallet.gold);
    expect(ledgerMaterials(s2)).toEqual(s2.player.materials);
    // Smelt and forge (with enough ore given for the test).
    const s = s2;
    const rich = applyChange(s, { reason: 'debug', materials: { copper_ore: 12 } }, t)!;
    const forge = open(rich);
    for (let i = 0; i < 4; i++) expect(await forge.smelt('copper_bar')).toEqual([{ itemId: 'copper_bar', count: 1, rank: expect.any(String) }]);
    expect(await forge.smelt('copper_bar')).toBeNull();
    expect(await forge.forge('iron_sword')).toBeNull(); // needs the copper sword first
    expect(await forge.forge('copper_sword')).toEqual([{ itemId: 'copper_sword', count: 1, rank: 'common' }]);
    expect((await forge.getPlayer()).gear).toEqual(['copper_sword']);
    const dungeon = await forge.dungeonStart();
    expect(dungeon?.player).toMatchObject({ attackMin: 5 + 1, attackMax: 7 + 1 }); // level 3: +1 from level 2
    const end2 = forge.snapshot();
    expect(ledgerGold(end2)).toBe(end2.player.wallet.gold);
    expect(ledgerMaterials(end2)).toEqual(end2.player.materials);
  });
});
