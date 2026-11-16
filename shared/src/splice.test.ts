// Step BG7: splicing. The whole table (symmetric, one result per pair, reachable, ranks, values, items and icons),
// the rules (spliceSeed, spliced harvest, furniture and clothes seeds), the Book's Splice tab and migration 17 -> 18.
import { describe, expect, it } from 'vitest';
import { BLOCK_HIT_COOLDOWN_MS, FARM_START_SOIL, SEED_GROW_MS, SPLICE_BONUS_CHANCE, SPLICE_BONUS_MS, SAVE_VERSION } from './config.ts';
import { getBlockType, BLOCK_TYPES } from './blockTypes.ts';
import { BOOK_TABS, bookEntries, bookProgress, bookRewards, bookTotal, claimBookReward, sourceOf } from './book.ts';
import { CLOTHING, getClothing } from './clothing.ts';
import { harvestPlant, hitPlant, plantSeed, spliceSeed } from './farm.ts';
import { FURNITURE_TYPES, getFurnitureType } from './furniture.ts';
import { gainsSince } from './gains.ts';
import { isValidIcon } from './icons.ts';
import { applyChange } from './ledger.ts';
import { CROP_TYPES, MATERIAL_TYPES, getMaterialType, isSeedId } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { RANKS } from './ranks.ts';
import { plantInCell, type Plant, type Room } from './room.ts';
import { readSave, toSaveText } from './save.ts';
import { seedGrowMs, seedGrows, seedRank } from './seeds.ts';
import { allRecipes } from './spliceRule.ts';
import { SPLICE_RECIPES, SPLICE_SEEDS, isSpliceResult, pairKey, recipeFor, recipeHint, recipesWith, splice, spliceGrowMs } from './splice.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';
import type { Rng, SeedId } from './types.ts';

const free = { standing: [], from: null };
const SOIL = { c: FARM_START_SOIL.c, r: FARM_START_SOIL.r };
const seq = (...v: number[]): Rng => {
  let i = 0;
  return () => v[i++] ?? 0.99;
};
const rankIdx = (s: SeedId): number => RANKS.indexOf(seedRank(s));
const farmId = (s: GameState): number => s.player.farmRoomId;
const farmRoom = (s: GameState): Room => s.rooms.find((r) => r.id === s.player.farmRoomId)!;

/** The seeds a new player can get from the start: the crop seeds sold in the catalog and the seeds of catalog blocks. */
const STARTERS: SeedId[] = [
  ...CROP_TYPES.filter((c) => c.seedPrice !== null).map((c) => c.seed),
  ...BLOCK_TYPES.filter((b) => b.inCatalog).map((b) => b.seedId as SeedId),
];

function withSeeds(seeds: Partial<Record<SeedId, number>>): GameState {
  return applyChange(createNewPlayer(undefined, 0), { reason: 'debug', gold: 1000, materials: seeds }, 0)!;
}

describe('the splice table', () => {
  it('has about 40 recipes with every pair once, in any order', () => {
    expect(SPLICE_RECIPES.length).toBeGreaterThanOrEqual(38);
    const keys = SPLICE_RECIPES.map((r) => pairKey(r.a, r.b));
    expect(new Set(keys).size).toBe(keys.length); // no two results for one pair
    for (const r of SPLICE_RECIPES) {
      expect(splice(r.a, r.b)).toBe(r.result);
      expect(splice(r.b, r.a)).toBe(r.result); // symmetric
      expect(r.a).not.toBe(r.b);
      expect(r.result).not.toBe(r.a);
      expect(r.result).not.toBe(r.b);
    }
  });

  it('a pair not in the table, and a seed with itself, give nothing', () => {
    expect(splice('turnip_seed', 'turnip_seed')).toBeNull();
    expect(splice('dirt_seed', 'heartwood_throne_seed')).toBeNull();
    expect(recipeFor('dirt_seed', 'dirt_seed')).toBeNull();
  });

  it('every ingredient and every result is a seed item with a valid icon, a value and a rank', () => {
    const ids = new Set(SPLICE_RECIPES.flatMap((r) => [r.a, r.b, r.result]));
    for (const id of ids) {
      expect(isSeedId(id), id).toBe(true);
      const m = getMaterialType(id);
      expect(isValidIcon(m.icon), id).toBe(true);
      expect(m.icon.shape).toBe('seed');
      expect(m.baseValue, id).toBeGreaterThan(0);
      expect(RANKS).toContain(m.rank);
    }
  });

  it('a result is never lower in rank than the lower of its two inputs; the chain reaches ultra rare and one legendary', () => {
    for (const r of SPLICE_RECIPES) expect(rankIdx(r.result), `${r.a}+${r.b}`).toBeGreaterThanOrEqual(Math.min(rankIdx(r.a), rankIdx(r.b)));
    expect(SPLICE_RECIPES.some((r) => seedRank(r.result) === 'ultra_rare')).toBe(true);
    const legendary = new Set(SPLICE_RECIPES.filter((r) => seedRank(r.result) === 'legendary').map((r) => r.result));
    expect(legendary.size).toBe(1);
    // two commons give a rare
    expect(SPLICE_RECIPES.some((r) => seedRank(r.a) === 'common' && seedRank(r.b) === 'common' && seedRank(r.result) === 'rare')).toBe(true);
  });

  it('every result can be reached from the starter seeds (a graph walk)', () => {
    const have = new Set<SeedId>(STARTERS);
    for (let again = true; again; ) {
      again = false;
      for (const r of SPLICE_RECIPES) {
        if (have.has(r.a) && have.has(r.b) && !have.has(r.result)) {
          have.add(r.result);
          again = true;
        }
      }
    }
    for (const r of SPLICE_RECIPES) expect(have.has(r.result), `${r.result} unreachable`).toBe(true);
    // SG3: most splice seeds are made by the general rule, not by a special recipe, so walk every recipe of the rule too.
    for (let again = true; again; ) {
      again = false;
      for (const r of allRecipes()) {
        if (have.has(r.a) && have.has(r.b) && !have.has(r.result)) {
          have.add(r.result);
          again = true;
        }
      }
    }
    for (const s of SPLICE_SEEDS) expect(have.has(s.id), `${s.id} unreachable`).toBe(true);
  });

  it('makes no value from nothing: a splice eats two seeds for one, and a result is worth a bounded multiple of its inputs', () => {
    for (const r of SPLICE_RECIPES) {
      const inputs = getMaterialType(r.a).baseValue + getMaterialType(r.b).baseValue;
      expect(getMaterialType(r.result).baseValue, `${r.a}+${r.b}`).toBeLessThanOrEqual(inputs * 4);
    }
    // A spliced harvest never gives a seed back, only the one result seed (so a loop always loses seeds).
    for (const r of SPLICE_RECIPES) {
      const roll = harvestPlant({ seed: r.a, with: r.b, plantedAt: 0, readyAt: 1 }, seq(0, 0, 0, 0));
      expect(roll.seedBack).toBe(false);
      expect(roll.result).toBe(r.result);
    }
  });

  it('every splice seed grows something that exists', () => {
    for (const s of SPLICE_SEEDS) {
      const g = seedGrows(s.id);
      if (g.kind === 'material') expect(MATERIAL_TYPES.some((m) => m.id === g.id), s.id).toBe(true);
      else if (g.kind === 'furniture') expect(getFurnitureType(g.id).id, s.id).toBe(g.id);
      else expect(getClothing(g.id), s.id).toBeDefined();
    }
    // Clothes seeds only grow hidden (not free) clothes.
    for (const s of SPLICE_SEEDS) if (s.grows.kind === 'clothing') expect(CLOTHING.find((c) => c.id === (s.grows as { id: string }).id)!.free).toBe(false);
  });

  it('is available for every seed and tells what it is part of', () => {
    expect(recipesWith('dirt_seed').length).toBeGreaterThan(2);
    expect(isSpliceResult('glowcap_spore')).toBe(true);
    expect(isSpliceResult('turnip_seed')).toBe(false);
  });
});

describe('spliceGrowMs', () => {
  it('is the longer grow time plus the splice bonus', () => {
    expect(spliceGrowMs('dirt_seed', 'turnip_seed')).toBe(SEED_GROW_MS.common + SPLICE_BONUS_MS);
    expect(spliceGrowMs('pumpkin_seed', 'turnip_seed')).toBe(SEED_GROW_MS.rare + SPLICE_BONUS_MS);
    expect(spliceGrowMs('turnip_seed', 'pumpkin_seed')).toBe(spliceGrowMs('pumpkin_seed', 'turnip_seed'));
    expect(seedGrowMs('heartwood_throne_seed')).toBe(SEED_GROW_MS.legendary);
  });
});

describe('spliceSeed', () => {
  const base = (): GameState => {
    const s = withSeeds({ dirt_seed: 3, turnip_seed: 3, heartwood_throne_seed: 1 });
    const r = plantSeed(s, farmId(s), SOIL.c, SOIL.r, 'dirt_seed', 1000, free);
    if (!r.ok) throw new Error(r.problem);
    return r.state;
  };

  it('a second seed on a young plant restarts the clock for the pair and uses the seed up', () => {
    const s = base();
    const r = spliceSeed(s, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 5000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = plantInCell(farmRoom(r.state), SOIL.c, SOIL.r)!;
    expect(p).toEqual({ seed: 'dirt_seed', with: 'turnip_seed', plantedAt: 5000, readyAt: 5000 + spliceGrowMs('dirt_seed', 'turnip_seed') });
    expect(r.state.player.materials.turnip_seed).toBe(2);
    expect(ledgerMaterials(r.state)).toEqual(r.state.player.materials);
    expect(ledgerGold(r.state)).toBe(r.state.player.wallet.gold);
  });

  it('order does not matter: the table finds the pair either way', () => {
    const s = base();
    const r = spliceSeed(s, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 5000);
    const t = withSeeds({ dirt_seed: 3, turnip_seed: 3 });
    const q = plantSeed(t, farmId(t), SOIL.c, SOIL.r, 'turnip_seed', 1000, free);
    if (!q.ok || !r.ok) throw new Error('setup');
    const u = spliceSeed(q.state, farmId(t), SOIL.c, SOIL.r, 'dirt_seed', 5000);
    expect(u.ok).toBe(true);
    if (u.ok) expect(splice(plantInCell(farmRoom(u.state), SOIL.c, SOIL.r)!.seed, 'dirt_seed')).toBe('clay_seed');
  });

  it('a wrong pair says nothing happens and takes nothing; the same seed twice too', () => {
    const s = base();
    expect(spliceSeed(s, farmId(s), SOIL.c, SOIL.r, 'heartwood_throne_seed', 5000)).toEqual({ ok: false, problem: 'nothing_happens' });
    expect(spliceSeed(s, farmId(s), SOIL.c, SOIL.r, 'dirt_seed', 5000)).toEqual({ ok: false, problem: 'nothing_happens' });
    expect(s.player.materials.heartwood_throne_seed).toBe(1);
  });

  it('refuses: no plant, none in the bag, already spliced, ripe, someone else\'s room', () => {
    const s = base();
    expect(spliceSeed(s, farmId(s), SOIL.c + 1, SOIL.r, 'turnip_seed', 5000)).toEqual({ ok: false, problem: 'no_plant' });
    expect(spliceSeed(s, farmId(s), SOIL.c, SOIL.r, 'potato_seed', 5000)).toEqual({ ok: false, problem: 'empty' });
    expect(spliceSeed(s, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 1000 + SEED_GROW_MS.common)).toEqual({ ok: false, problem: 'ripe' });
    const r = spliceSeed(s, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 5000);
    if (!r.ok) throw new Error('setup');
    expect(spliceSeed(r.state, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 6000)).toEqual({ ok: false, problem: 'already_spliced' });
    expect(spliceSeed(s, s.rooms.find((x) => x.id !== farmId(s))!.id, 0, 0, 'turnip_seed', 5000)).toMatchObject({ ok: false });
  });
});

describe('harvesting a spliced plant', () => {
  const spliced = (a: SeedId, b: SeedId, extra: Partial<Record<SeedId, number>> = {}): GameState => {
    let s = withSeeds({ [a]: 2, [b]: 2, ...extra });
    const p = plantSeed(s, farmId(s), SOIL.c, SOIL.r, a, 1000, free);
    if (!p.ok) throw new Error(p.problem);
    s = p.state;
    const r = spliceSeed(s, farmId(s), SOIL.c, SOIL.r, b, 2000);
    if (!r.ok) throw new Error(r.problem);
    return r.state;
  };
  const ready = 2000 + spliceGrowMs('dirt_seed', 'turnip_seed');

  it('punching it before it is ripe does nothing and says how long it needs', () => {
    const s = spliceed();
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, ready - 1, 0, seq(0), null);
    expect(r).toEqual({ ok: false, problem: 'unripe', leftMs: 1 });
    expect(plantInCell(farmRoom(s), SOIL.c, SOIL.r)).not.toBeNull();
    function spliceed(): GameState {
      return spliced('dirt_seed', 'turnip_seed');
    }
  });

  it('gives the NEW seed, the cell is free, the recipe is found, and it all goes through the ledger', () => {
    const s = spliced('dirt_seed', 'turnip_seed');
    // rng: bonus chance (no), gems chance (no)
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, ready, 0, seq(0.99, 0.99), null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(plantInCell(farmRoom(r.state), SOIL.c, SOIL.r)).toBeNull();
    expect(r.state.player.materials.clay_seed).toBe(1);
    expect(r.state.player.splicesFound).toEqual([pairKey('dirt_seed', 'turnip_seed')]);
    expect(r.state.ledger.at(-1)!.reason).toBe('splice');
    expect(ledgerMaterials(r.state)).toEqual(r.state.player.materials);
    expect(gainsSince(s, r.state)).toEqual([{ itemId: 'clay_seed', count: 1, rank: 'common' }]);
    expect(r.state.player.seen.clay_seed).toBeDefined();
  });

  it('may add one block or crop of either seed (the small chance) and gems (source splice)', () => {
    const s = spliced('dirt_seed', 'turnip_seed');
    // bonus chance hits, picks the first seed (dirt), gems chance hits (0.1 < 0.3), amount min
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, ready, 0, seq(0, 0, 0, 0), null);
    if (!r.ok) throw new Error('hit');
    expect(r.roll).toMatchObject({ item: 'dirt', qty: 1, result: 'clay_seed', seedBack: false });
    expect(r.state.player.materials.dirt).toBe(1);
    expect(r.state.player.wallet.gems).toBeGreaterThan(0);
    expect(SPLICE_BONUS_CHANCE).toBeGreaterThan(0);
    expect(SPLICE_BONUS_CHANCE).toBeLessThan(1);
  });

  it('a found recipe is only listed once', () => {
    let s = spliced('dirt_seed', 'turnip_seed');
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, ready, 0, seq(0.99, 0.99), null);
    if (!r.ok) throw new Error('hit');
    s = r.state;
    const again = applyChange(s, { reason: 'debug', materials: { dirt_seed: 1, turnip_seed: 1 } }, 3000)!;
    const p = plantSeed(again, farmId(s), SOIL.c, SOIL.r, 'dirt_seed', 4000, free);
    if (!p.ok) throw new Error('plant');
    const sp = spliceSeed(p.state, farmId(s), SOIL.c, SOIL.r, 'turnip_seed', 5000);
    if (!sp.ok) throw new Error('splice');
    const h = hitPlant(sp.state, farmId(s), SOIL.c, SOIL.r, 5000 + spliceGrowMs('dirt_seed', 'turnip_seed'), 0, seq(0.99, 0.99), null);
    if (!h.ok) throw new Error('hit2');
    expect(h.state.player.splicesFound).toHaveLength(1);
    expect(h.state.player.materials.clay_seed).toBe(2);
  });

  it('a punch cooldown applies as for any harvest', () => {
    const s = spliced('dirt_seed', 'turnip_seed');
    expect(hitPlant(s, farmId(s), SOIL.c, SOIL.r, ready, ready - BLOCK_HIT_COOLDOWN_MS + 1, seq(0.99), null)).toEqual({ ok: false, problem: 'cooldown' });
  });
});

describe('seeds that grow furniture and clothes', () => {
  const grown = (seed: SeedId, state?: GameState): { s: GameState; plant: Plant } => {
    const s = state ?? withSeeds({ [seed]: 2 });
    const r = plantSeed(s, farmId(s), SOIL.c, SOIL.r, seed, 0, free);
    if (!r.ok) throw new Error(r.problem);
    return { s: r.state, plant: plantInCell(farmRoom(r.state), SOIL.c, SOIL.r)! };
  };

  it('a furniture seed gives one furniture item in the inventory', () => {
    const { s, plant } = grown('vine_bench_seed');
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, plant.readyAt, 0, seq(0.99, 0.99), null);
    if (!r.ok) throw new Error('hit');
    expect(r.state.items.filter((i) => i.typeId === 'vine_bench' && i.roomId === null)).toHaveLength(1);
    expect(gainsSince(s, r.state)).toEqual([{ itemId: 'vine_bench', count: 1, rank: 'rare' }]);
    expect(r.state.player.seen.vine_bench).toBeDefined();
  });

  it('a clothes seed unlocks the piece forever; a second harvest gives the seed back', () => {
    const { s, plant } = grown('tunic_seed');
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, plant.readyAt, 0, seq(0.99, 0.99), null);
    if (!r.ok) throw new Error('hit');
    expect(r.state.player.unlockedClothing).toEqual(['tunic']);
    const again = grown('tunic_seed', r.state);
    const h = hitPlant(again.s, farmId(s), SOIL.c, SOIL.r, again.plant.readyAt, 0, seq(0.99, 0.99), null);
    if (!h.ok) throw new Error('hit2');
    expect(h.state.player.unlockedClothing).toEqual(['tunic']);
    expect(h.state.player.materials.tunic_seed).toBe(1); // nothing wasted
  });

  it('a tavern good seed grows its goods by rank', () => {
    const { s, plant } = grown('hopvine_seed');
    const r = hitPlant(s, farmId(s), SOIL.c, SOIL.r, plant.readyAt, 0, seq(0, 0.99, 0.99), null);
    if (!r.ok) throw new Error('hit');
    expect(r.state.player.materials.root_ale).toBeGreaterThanOrEqual(2);
  });
});

describe('the Book: Splice tab', () => {
  it('lists every recipe once; sources and rewards exist', () => {
    expect(BOOK_TABS).toContain('splice');
    const e = bookEntries('splice');
    expect(e).toHaveLength(SPLICE_RECIPES.length);
    expect(new Set(e.map((x) => x.key)).size).toBe(e.length);
    expect(sourceOf('vine_bench')).toBe('Splicing');
    expect(sourceOf('clay_seed')).toBe('Punching blocks, Splicing');
    expect(sourceOf('dirt_seed')).toBe('Punching blocks');
    for (const f of FURNITURE_TYPES) expect(sourceOf(f.id), f.id).not.toBe('Unknown');
  });

  it('counts found recipes, shows a hint only for a seed the player has seen, and pays 25 / 50 / 75 / 100 %', () => {
    let s = createNewPlayer(undefined, 0);
    expect(bookProgress(s.player.seen, 'splice', [])).toEqual({ found: 0, total: SPLICE_RECIPES.length });
    const r = SPLICE_RECIPES[0]!;
    expect(recipeHint(r, {})).toBeNull();
    expect(recipeHint(r, { [r.b]: { count: 1, firstSeenAt: 0 } })).toBe(r.b);
    expect(recipeHint(r, { [r.a]: { count: 1, firstSeenAt: 0 }, [r.b]: { count: 1, firstSeenAt: 0 } })).toBe(r.a);
    const quarter = Math.ceil(SPLICE_RECIPES.length / 4);
    const keys = SPLICE_RECIPES.slice(0, quarter).map((x) => pairKey(x.a, x.b));
    s = { ...s, player: { ...s.player, splicesFound: keys } };
    expect(bookProgress(s.player.seen, 'splice', keys).found).toBe(quarter);
    expect(bookRewards(s.player, 'splice').map((x) => x.state)).toEqual(['ready', 'locked', 'locked', 'locked']);
    const claimed = claimBookReward(s, 'splice', 25, 10, seq(0, 0))!;
    expect(claimed.player.wallet.gold).toBeGreaterThan(s.player.wallet.gold);
    expect(claimed.player.wallet.gems).toBeGreaterThan(0);
    expect(bookTotal(s.player.seen, keys).found).toBe(bookTotal(s.player.seen, []).found + quarter);
  });
});

describe('migration 17 -> 18', () => {
  it('gives an old save an empty found-recipes list', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(18);
    const now = createNewPlayer(undefined, 1);
    const { splicesFound: _x, ...oldPlayer } = now.player;
    const r = readSave(JSON.stringify({ version: 17, savedAt: 9, state: { ...now, player: oldPlayer } }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (r.ok) expect(r.state.player.splicesFound).toEqual([]);
  });

  it('a current save keeps its found recipes', () => {
    const now = createNewPlayer(undefined, 1);
    const s = { ...now, player: { ...now.player, splicesFound: ['a+b'] } };
    const r = readSave(toSaveText(s, 5));
    if (!r.ok) throw new Error('load');
    expect(r.state.player.splicesFound).toEqual(['a+b']);
  });

  it('no block is missing its seed in a recipe', () => {
    for (const b of BLOCK_TYPES) expect(getBlockType(b.id).seedId).toBe(`${b.id}_seed`);
  });
});
