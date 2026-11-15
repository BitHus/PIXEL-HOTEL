// Step BG4: gems from every source through the GameAPI. Every call that gives items also returns its gems
// (in the gains list), and the ledger adds up to the wallet.
import { describe, expect, it } from 'vitest';
import {
  AXE_COOLDOWN_MS,
  BLOCK_HIT_COOLDOWN_MS,
  FISH_TICK_MS,
  GEMS_GAIN_ID,
  GEM_RANK_MULT,
  GEMS,
  SEED_GROW_MS,
  TREE_HITS,
  addSeen,
  applyChange,
  createNewPlayer,
  enemyKey,
  newRun,
  saveKey,
  seededRng,
  toSaveText,
  treeStand,
  type BlockResult,
  type DungeonRun,
  type FishInput,
  type GainList,
  type GameState,
  type Rng,
} from '@pixel-hotel/shared';
import { blockCenter } from '../../../shared/src/dungeon/grid.ts';
import { openMap } from '../../../shared/src/dungeon/testRun.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;
/** Every chance hits, every amount is the minimum. */
const low: Rng = () => 0;

function fresh(extra: Partial<GameState> = {}): GameState {
  return { ...createNewPlayer(undefined, 0), playerCreated: true, ...extra };
}

function open(state: GameState, rng: Rng = low) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return LocalGameAPI.open(storage, clock, rng).api;
}

const gemsIn = (gains: GainList): number => gains.filter((g) => g.itemId === GEMS_GAIN_ID).reduce((a, g) => a + g.count, 0);
/** The ledger's gem deltas add up to the wallet. */
const ledgerAdds = (api: LocalGameAPI): void => {
  const s = api.snapshot();
  expect(s.ledger.reduce((a, e) => a + (e.gemsDelta ?? 0), 0)).toBe(s.player.wallet.gems);
};

async function goTo(api: LocalGameAPI, p: { x: number; y: number }): Promise<void> {
  expect(await api.walk(p)).not.toBeNull();
  t += 30_000;
}

describe('gems come back in the gains list of every source', () => {
  it('chopping a tree', async () => {
    t = 1000;
    const api = open(fresh());
    await api.enterRoom((await api.getPlayer()).lakesideRoomId);
    await goTo(api, treeStand(0));
    let last: GainList = [];
    for (let i = 0; i < TREE_HITS; i++) {
      const r = (await api.chopTree(0))!;
      last = r.gains;
      t += AXE_COOLDOWN_MS;
    }
    expect(gemsIn(last)).toBe(GEMS.chop.min * GEM_RANK_MULT.common);
    expect((await api.getPlayer()).wallet.gems).toBe(gemsIn(last));
    ledgerAdds(api);
  });

  it('catching a fish: the gems in the gains are the wallet change, whatever the seed', async () => {
    for (const seed of [11, 12, 13, 14]) {
      t = 1000;
      const api = open(fresh(), seededRng(seed));
      await api.enterRoom((await api.getPlayer()).lakesideRoomId);
      await api.castAt({ x: 500, y: 100 });
      t += 60_000;
      await api.fishStart();
      let held = false;
      let got: GainList | null = null;
      for (let k = 0; k < 2000 && !got; k++) {
        const cur = (await api.fishStep([], 0))!.session;
        const inputs: FishInput[] = [];
        if (cur.phase === 'bite') inputs.push({ t: 'tap' });
        if (cur.phase === 'reel') {
          const want = cur.boxPos + cur.boxVel * 0.15 < cur.fishPos;
          if (want !== held) {
            held = want;
            inputs.push({ t: want ? 'press' : 'release' });
          }
        }
        const u = (await api.fishStep(inputs, FISH_TICK_MS))!;
        if (u.session.phase === 'done') got = u.gains;
      }
      expect(got).not.toBeNull();
      expect((await api.getPlayer()).wallet.gems).toBe(gemsIn(got!));
      ledgerAdds(api);
    }
  });

  it('harvesting a plant', async () => {
    t = 1000;
    const api = open(applyChange(fresh(), { reason: 'debug', materials: { turnip_seed: 1 } }, 0)!);
    await api.enterRoom((await api.getPlayer()).farmRoomId);
    const until = async (call: () => Promise<BlockResult>): Promise<BlockResult> => {
      for (let i = 0; i < 6; i++) {
        const r = await call();
        if (r.kind !== 'walk') return r;
        t += 20_000;
      }
      throw new Error('never arrived');
    };
    await until(() => api.plantSeed(2, 2, 'turnip_seed'));
    t += SEED_GROW_MS.common + BLOCK_HIT_COOLDOWN_MS + 1;
    const h = await until(() => api.hitPlant(2, 2));
    expect(h.kind).toBe('harvested');
    if (h.kind !== 'harvested') return;
    expect(gemsIn(h.gains)).toBe(GEMS.harvest.min * GEM_RANK_MULT.common);
    expect((await api.getPlayer()).wallet.gems).toBe(gemsIn(h.gains));
    ledgerAdds(api);
  });

  it('breaking a block', async () => {
    t = 1000;
    const s = applyChange(fresh(), { reason: 'debug', materials: { dirt: 3 } }, 0)!;
    const api = open(s);
    await api.enterRoom(s.player.hotelRoomId);
    await api.placeBlock(9, 9, 'dirt');
    t += BLOCK_HIT_COOLDOWN_MS + 1;
    const r = await api.hitBlock(9, 9);
    expect(r.kind).toBe('broken');
    if (r.kind !== 'broken') return;
    expect(gemsIn(r.gains)).toBeGreaterThan(0);
    ledgerAdds(api);
  });

  it('a quest: takeGains hands over the gems once; the ledger says quest', async () => {
    t = 1000;
    const api = open(fresh());
    expect(await api.takeGains()).toEqual([]);
    await api.buyCatalog('chair'); // finishes the first quest
    const gains = await api.takeGains();
    expect(gains).toEqual([{ itemId: GEMS_GAIN_ID, count: GEMS.quest.min, rank: 'common' }]);
    expect(await api.takeGains()).toEqual([]);
    expect(api.snapshot().ledger.some((e) => e.reason === 'quest' && e.gemsDelta === GEMS.quest.min)).toBe(true);
    ledgerAdds(api);
  });

  it('a Book reward: the claim carries the gold, the gems and the gains', async () => {
    t = 1000;
    const s = fresh();
    const seen = addSeen(addSeen(s.player.seen, enemyKey('slime'), 1, 4000), enemyKey('bat'), 0, 4000);
    const api = open({ ...s, player: { ...s.player, seen } });
    const claim = await api.claimBookReward('enemies', 25);
    expect(claim).toMatchObject({ gems: GEMS.book.min, gains: [{ itemId: GEMS_GAIN_ID, count: GEMS.book.min }] });
    expect(claim!.gold).toBeGreaterThan(0);
    expect(await api.claimBookReward('enemies', 25)).toBeNull();
    ledgerAdds(api);
  });
});

describe('gems in a run through the GameAPI', () => {
  const handRun = (patch: Partial<DungeonRun> = {}): DungeonRun => {
    const run = newRun({ seed: 3, round: 1, xp: 0, gear: [], potions: 0 });
    const at = blockCenter(3, 3);
    return { ...run, map: openMap(), enemies: [], chests: [], player: { ...run.player, x: at.x, y: at.y }, ...patch };
  };

  it('a chest drops a pile, picking it up is a gain, Leave banks it through the ledger', async () => {
    t = 1000;
    const chest = { id: 1, kind: 'wooden' as const, mimic: false, opened: false, ...blockCenter(3, 3) };
    const api = open(fresh({ run: handRun({ chests: [chest] }) }));
    await api.dungeonResume();
    const gains: GainList = [];
    for (let k = 0; k < 6; k++) gains.push(...(await api.dungeonAdvance(100))!.gains);
    expect(gemsIn(gains)).toBe(GEMS.chest.min);
    const run = (await api.getRun())!.run;
    expect(run.bag.gems).toBe(GEMS.chest.min);
    // Not in the wallet until the run is banked.
    expect((await api.getPlayer()).wallet.gems).toBe(0);
    ledgerAdds(api);
  });

  it('Leave banks the bag gems through the ledger (one entry, once)', async () => {
    t = 1000;
    const api = open(fresh({ run: handRun({ status: 'exit_choice', bag: { slots: [], gold: 0, gems: 4 } }) }));
    await api.dungeonResume();
    const end = (await api.dungeonInput({ t: 'choose_exit', choice: 'leave' }))!;
    expect(end.result).toMatchObject({ status: 'left', banked: { gems: 4 } });
    expect((await api.getPlayer()).wallet.gems).toBe(4);
    expect(api.snapshot().ledger.filter((e) => e.reason === 'dungeon_bank' && e.gemsDelta === 4)).toHaveLength(1);
    ledgerAdds(api);
  });
});
