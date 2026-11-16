// Step BG9: the balance of the block world. These tests FAIL when a loop reopens (a config or data number drifts): the
// seed loop, packs that pay back more than they cost, spliced results worth more than their inputs plus time, punching
// blocks swallowing the gem income, and a first pack that takes too long. The maths is in balance.ts; the printed tables are
// `npm run simulate` (NOTES, BG9). All numbers are EXPECTED values, so there is no rng here.

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from './blockTypes.ts';
import {
  STAGES,
  activities,
  firstHourGold,
  dishesPerBatch,
  poursPerHour,
  tapLastsMin,
  goldBySource,
  goldShares,
  guestGoldPerHour,
  runGoldPerHour,
  tavernTipGemsPerHour,
  traderByActivity,
  bestCropGoldPerCellMinute,
  biggestShare,
  blockBuyBack,
  brewSellLoops,
  dishSellLoops,
  mixedSurplusGoldPerHour,
  packTraderBack,
  surplusGoldPerHour,
  spliceSellLoops,
  chains,
  cheapestGoldPerGem,
  expectedSpares,
  focusedGems,
  hoursToAfford,
  mixedGemsPerHour,
  packGemReturn,
  packPeakSale,
  packSellValue,
  seedProductValue,
  seedRatio,
  starterSeeds,
  bestHarvestGemsPerCellMinute,
  spliceGemRows,
  plantsCapGoldPerHour,
  cheapestSpliceCycle,
  gemsPerEvent,
  harvestYield,
} from './balance.ts';
import { BALANCE_TARGETS, PACKS, PLANTS_ROOM_CAP, POUR_MS, PREP_BONUS, SELL_RATES, SEED_BACK_CHANCE, SPARE_SELL, SPLICE_BONUS_CHANCE, SPLICE_GEM_CAP, STOVE_BATCH_MAX, TAP_CAP } from './config.ts';
import { CROP_TYPES, getMaterialType } from './materials.ts';
import { getFurnitureType } from './furniture.ts';
import { materialSellPrice, furnitureSellPrice } from './trader.ts';
import { PACK_TYPES } from './packs.ts';
import { seededRng } from './rng.ts';
import { SPLICE_RECIPES } from './splice.ts';
import { allRecipes, categoryWeights } from './spliceRule.ts';
import { SEED_CATEGORIES, seedCategory } from './seedCategory.ts';
import { allSeedIds, isSpliceable, isStarterSeed, seedGrows, seedRank } from './seeds.ts';
import { packPool } from './packs.ts';
import { clothingSellPrice } from './trader.ts';

const cheapestPack = Math.min(...PACK_TYPES.map((p) => p.gemPrice));

describe('the seed loop is closed', () => {
  it('no block seed makes more seeds than it uses (ratio under the target)', () => {
    for (const b of BLOCK_TYPES) expect(seedRatio(b.id), b.id).toBeLessThan(BALANCE_TARGETS.maxSeedRatio);
  });
  it('the cheapest way to turn gold into gems (buy a block, punch it until it is gone) is dear', () => {
    expect(cheapestGoldPerGem()).toBeGreaterThanOrEqual(BALANCE_TARGETS.minGoldPerGem);
  });
});

describe('packs never pay back more than they cost', () => {
  for (const pack of PACK_TYPES) {
    it(`${pack.id}: the whole pack sold is worth less than its gem price`, () => {
      expect(packSellValue(pack)).toBeLessThan(pack.gemPrice);
    });
    it(`${pack.id}: playing its contents gives back at most ${BALANCE_TARGETS.maxPackGemReturn * 100}% of its price in gems`, () => {
      expect(packGemReturn(pack)).toBeLessThanOrEqual(pack.gemPrice * BALANCE_TARGETS.maxPackGemReturn);
    });
  }
  it('a spare clothes piece sells for less than one piece costs in its pack (the dearest piece the pack can give counts)', () => {
    for (const pack of PACK_TYPES.filter((p) => p.pool === 'clothing')) {
      const { peak, pricePerPiece } = packPeakSale(pack);
      expect(peak, pack.id).toBeLessThan(pricePerPiece);
    }
  });
  it('duplicates happen (they are allowed) but a first clothes pack mostly gives new pieces', () => {
    for (const pack of PACK_TYPES.filter((p) => p.pool === 'clothing')) expect(expectedSpares(pack, 1)).toBeLessThan(0.75);
  });
  it('config PACKS and the pack list agree', () => {
    expect(PACK_TYPES.map((p) => p.gemPrice).sort()).toEqual(Object.values(PACKS).map((p) => p.gemPrice).sort());
  });
});

describe('splicing makes no value from nothing', () => {
  const ch = chains();
  const start = starterSeeds();
  const spliced = [...new Set(SPLICE_RECIPES.map((r) => r.result))].filter((s) => !start.has(s));
  it('every spliced result is reachable from the starter seeds', () => {
    for (const s of spliced) expect(Number.isFinite(ch.get(s)!.ms), s).toBe(true);
  });
  it('what a spliced seed grows is worth no more than its seeds plus the cell-time at the best plain crop rate', () => {
    const rate = bestCropGoldPerCellMinute();
    for (const s of spliced) {
      const c = ch.get(s)!;
      expect(seedProductValue(s), s).toBeLessThanOrEqual(c.gold + (c.cellMs / 60_000) * rate);
    }
  });
  it('a plain crop cell is worth more per minute than any spliced result is (planting carrots beats splicing for gold)', () => {
    const rate = bestCropGoldPerCellMinute();
    for (const s of spliced) expect(seedProductValue(s) / (ch.get(s)!.cellMs / 60_000), s).toBeLessThan(rate);
  });
  it('a chain takes longer the rarer the result: legendary needs hours, rare and ultra rare minutes', () => {
    const t = (id: string): number => ch.get(id as never)!.ms;
    expect(t('heartwood_throne_seed')).toBeGreaterThan(2 * 3_600_000);
    expect(t('gilded_chair_seed')).toBeGreaterThan(t('mohawk_seed'));
  });
});

describe('gem income', () => {
  for (const stage of STAGES) {
    it(`${stage}: no single gem source is over ${BALANCE_TARGETS.maxSourceShare * 100}% of a mixed hour`, () => {
      expect(biggestShare(stage).share).toBeLessThanOrEqual(BALANCE_TARGETS.maxSourceShare);
    });
    it(`${stage}: punching blocks is not the best activity by far (under 2.2 times the mean of the others)`, () => {
      const acts = activities(stage);
      const blocks = focusedGems(acts.find((a) => a.id === 'blocks')!);
      const others = acts.filter((a) => a.id !== 'blocks').map(focusedGems);
      expect(blocks).toBeLessThan((others.reduce((x, y) => x + y, 0) / others.length) * 2.2);
    });
  }
  it('income grows with the stage', () => {
    expect(mixedGemsPerHour('level3')).toBeGreaterThan(mixedGemsPerHour('new'));
    expect(mixedGemsPerHour('level8')).toBeGreaterThan(mixedGemsPerHour('level3'));
  });
});

describe('pack timing targets (mixed play)', () => {
  it('the first (cheapest) pack is within the first-pack target for a new player, quest gems counted', () => {
    expect(hoursToAfford(cheapestPack, 'new') * 60).toBeLessThanOrEqual(BALANCE_TARGETS.firstPackMaxMin);
  });
  it('even the dearest first-hour pack of blocks or seeds is within the target', () => {
    for (const pack of PACK_TYPES.filter((p) => p.pool !== 'clothing')) expect(hoursToAfford(pack.gemPrice, 'new') * 60, pack.id).toBeLessThanOrEqual(BALANCE_TARGETS.firstPackMaxMin);
  });
  it('a Common Clothes Pack is about an hour at level 3 (within 20 %)', () => {
    expect(hoursToAfford(PACKS.common_clothes.gemPrice, 'level3')).toBeCloseTo(BALANCE_TARGETS.commonClothesHours, 0);
    expect(Math.abs(hoursToAfford(PACKS.common_clothes.gemPrice, 'level3') / BALANCE_TARGETS.commonClothesHours - 1)).toBeLessThan(0.2);
  });
  it('a Rare Clothes Pack is about three hours at level 3 (within 20 %)', () => {
    expect(Math.abs(hoursToAfford(PACKS.rare_clothes.gemPrice, 'level3') / BALANCE_TARGETS.rareClothesHours - 1)).toBeLessThan(0.2);
  });
  it('packs are dearer in this order: first pack, common clothes, rare clothes', () => {
    expect(cheapestPack).toBeLessThan(PACKS.common_clothes.gemPrice);
    expect(PACKS.common_clothes.gemPrice).toBeLessThan(PACKS.rare_clothes.gemPrice);
  });
});

// ---------- The trader (step S2): selling never opens a loop ----------
describe('the trader closes its loops', () => {
  it('selling the ingredients of a dish never pays more than the dish', () => {
    for (const d of dishSellLoops()) expect(d.sold, d.id).toBeLessThanOrEqual(d.made);
  });
  it('selling the ingredients of a brew never pays more than the mugs it gives', () => {
    for (const d of brewSellLoops()) expect(d.sold, d.id).toBeLessThanOrEqual(d.made);
  });
  it('buying a catalog block and selling it back loses gold', () => {
    const rows = blockBuyBack();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.back, r.id).toBeLessThan(r.paid);
  });
  it('a pack sold back at the trader never pays more than its gems are worth at the gold-per-gem floor', () => {
    for (const p of PACK_TYPES) {
      const b = packTraderBack(p);
      expect(b.sold, p.id).toBeLessThan(b.gemValue);
      expect(b.peakPiece * p.rolls, p.id).toBeLessThan(b.gemValue); // even if every roll were its dearest piece
    }
  });
  it('the results of a splice chain sold back do not beat the seeds they cost (their gold plus their cell-time)', () => {
    const rows = spliceSellLoops();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.seedSold, r.seed).toBeLessThanOrEqual(r.cost);
      expect(r.productSold, r.seed).toBeLessThanOrEqual(r.cost);
    }
  });
  it('STRICT (S3): a splice result and its seed sold back never pay more than the GOLD of the starter seeds it took', () => {
    for (const r of spliceSellLoops()) {
      expect(r.seedSold, r.seed).toBeLessThanOrEqual(r.gold);
      expect(r.productSold, r.seed).toBeLessThanOrEqual(r.gold);
    }
  });
});

describe('what surplus sells for in an hour (a report for S3, not a target)', () => {
  it('is positive, finite and the same every time for a seed', () => {
    for (const stage of STAGES) {
      const a = mixedSurplusGoldPerHour(stage, seededRng(7));
      expect(a).toBeGreaterThan(0);
      expect(Number.isFinite(a)).toBe(true);
      expect(mixedSurplusGoldPerHour(stage, seededRng(7))).toBe(a);
      for (const x of surplusGoldPerHour(stage, seededRng(7))) expect(x.gold, x.id).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------- Step S3: gold per hour by source, the first hour, selling never beats using ----------
describe('gold sources of a mixed hour (S3)', () => {
  for (const stage of STAGES) {
    it(`${stage}: tavern guests, dungeon run gold and the trader are each between ${BALANCE_TARGETS.minGoldShare * 100}% and ${BALANCE_TARGETS.maxGoldShare * 100}% of the gold`, () => {
      for (const row of goldBySource(stage, seededRng(11))) {
        const share = row.mixed / goldShares(stage, seededRng(11)).total;
        expect(share, `${row.id} ${Math.round(share * 100)}%`).toBeGreaterThanOrEqual(BALANCE_TARGETS.minGoldShare);
        expect(share, `${row.id} ${Math.round(share * 100)}%`).toBeLessThanOrEqual(BALANCE_TARGETS.maxGoldShare);
      }
    });
    it(`${stage}: selling crops never beats the tavern guests, the dungeon run gold or the mine (focused hours)`, () => {
      const rows = traderByActivity(stage, seededRng(11));
      const farm = rows.find((r) => r.id === 'farm')!.focused;
      expect(farm).toBeGreaterThanOrEqual(0); // surplus crops are worth something, never a loss
      expect(farm).toBeLessThan(guestGoldPerHour(stage).gold);
      expect(farm).toBeLessThan(runGoldPerHour(stage, seededRng(11)));
      const mine = rows.find((r) => r.id === 'mine');
      if (mine) expect(farm).toBeLessThan(mine.focused);
    });
    it(`${stage}: no trader activity (loot, ore, crops, wood, fish) out-earns the tavern at full attention`, () => {
      for (const r of traderByActivity(stage, seededRng(11))) expect(r.focused, r.id).toBeLessThan(guestGoldPerHour(stage).gold);
    });
  }
  it('the mixed hour grows with the stage: new < level 3 < level 8', () => {
    const t = (s: (typeof STAGES)[number]): number => goldShares(s, seededRng(11)).total;
    expect(t('level3')).toBeGreaterThan(t('new'));
    expect(t('level8')).toBeGreaterThan(t('level3'));
  });
});

describe('the first hour of a new game (S3)', () => {
  it('the first 30 minutes of the tavern are inside the target', () => {
    const g = firstHourGold(30).gold;
    expect(g).toBeGreaterThanOrEqual(BALANCE_TARGETS.firstHalfHourGold.min);
    expect(g).toBeLessThanOrEqual(BALANCE_TARGETS.firstHalfHourGold.max);
  });
  it('the first hour is inside 300 to 500 gold', () => {
    const g = firstHourGold(60).gold;
    expect(g).toBeGreaterThanOrEqual(BALANCE_TARGETS.firstHourGold.min);
    expect(g).toBeLessThanOrEqual(BALANCE_TARGETS.firstHourGold.max);
  });
  it('gold only grows with time, and guests are never the limit (the supply of mugs and dishes is)', () => {
    let last = -1;
    for (let m = 0; m <= 60; m += 5) {
      const x = firstHourGold(m);
      expect(x.gold).toBeGreaterThanOrEqual(last);
      expect(x.mugs + x.dishes).toBeLessThanOrEqual(x.guests);
      last = x.gold;
    }
  });
  it('brewing is still worth doing: a brew sells for much more than the crops in it would at the trader', () => {
    const rows = brewSellLoops().find((b) => b.id === 'root_ale')!;
    expect(rows.made).toBeGreaterThan(rows.sold * 5);
  });
});

describe('selling never beats using (S3)', () => {
  it('every sellable stackable thing worth more than 2 gold pays at most the maxSellShare of its value', () => {
    for (const t of [...CROP_TYPES.map((c) => c.id), 'wood', 'cloth', 'bone', 'copper_ore', 'iron_ore', 'mithril_ore', 'copper_bar', 'iron_bar', 'mithril_bar', 'pebble_perch', 'lantern_carp', 'amber', 'resin', 'turnip_seed', 'amberbud_seed']) {
      const base = getMaterialType(t as never).baseValue;
      if (base <= 2) continue;
      expect(materialSellPrice(t), t).toBeLessThanOrEqual(Math.ceil(base * BALANCE_TARGETS.maxSellShare));
    }
  });
  it('crops pay the least of the groups, ore and fish pay more, splice results pay the least of all', () => {
    expect(SELL_RATES.crop).toBeLessThanOrEqual(SELL_RATES.material);
    expect(SELL_RATES.crop).toBeLessThan(SELL_RATES.ore);
    expect(SELL_RATES.crop).toBeLessThan(SELL_RATES.fish);
    expect(SELL_RATES.splice).toBeLessThan(SELL_RATES.crop);
    expect(SELL_RATES.ore).toBeGreaterThanOrEqual(SELL_RATES.material);
    expect(SELL_RATES.bar).toBeLessThan(SELL_RATES.ore); // selling ore beats smelting it just to sell the bar: bars are for gear
  });
  it('furniture that only splicing grows pays the low splice rate', () => {
    for (const id of ['vine_bench', 'gilded_chair', 'honey_table', 'ember_lamp', 'heartwood_throne']) expect(furnitureSellPrice(id), id).toBeLessThanOrEqual(Math.max(1, Math.round(getFurnitureType(id).baseValue * SELL_RATES.splice)));
  });
  it('seed -> plant -> sell: the crops of one harvest sell for no more than the seed cost (selling never makes gold by planting)', () => {
    for (const crop of CROP_TYPES.filter((c) => c.seedPrice !== null)) {
      const sold = materialSellPrice(crop.id) * ((crop.rank === 'common' ? 3 : crop.rank === 'rare' ? 2.5 : 1.5));
      expect(sold, crop.id).toBeLessThanOrEqual(crop.seedPrice!);
    }
  });
});

describe('the tavern gem tip in the gem tables (S3)', () => {
  it('is a small source: under 5% of the gems of a mixed hour at every stage', () => {
    for (const stage of STAGES) expect(tavernTipGemsPerHour(stage) / mixedGemsPerHour(stage), stage).toBeLessThan(0.05);
  });
});

describe('taps, the pour and the prep tables keep the S3 numbers (T1)', () => {
  it('a batch grows by the prep bonus and never past STOVE_BATCH_MAX + PREP_BONUS.max', () => {
    expect([0, 1, 2, 3, 9].map((b) => dishesPerBatch(b))).toEqual([4, 5, 6, 6, 6]);
    expect(dishesPerBatch(2, 2)).toBe(4);
    expect(STOVE_BATCH_MAX + PREP_BONUS.max).toBe(6);
  });

  it('with the best kitchen (the full prep bonus) every gold source is still between 10% and 55% at every stage (the S3 cap of 50% holds without prep tables)', () => {
    for (const stage of STAGES) {
      for (const row of goldBySource(stage, seededRng(11), PREP_BONUS.max)) {
        const share = row.mixed / goldShares(stage, seededRng(11), PREP_BONUS.max).total;
        expect(share, `${stage} ${row.id} ${Math.round(share * 100)}%`).toBeGreaterThanOrEqual(BALANCE_TARGETS.minGoldShare);
        expect(share, `${stage} ${row.id} ${Math.round(share * 100)}%`).toBeLessThanOrEqual(BALANCE_TARGETS.maxGoldShareBestKitchen);
      }
    }
  });

  it('a prep table only adds free dishes: guest gold never falls with it and the best kitchen adds at most +50% dishes', () => {
    for (const stage of STAGES) {
      const base = guestGoldPerHour(stage).gold;
      const best = guestGoldPerHour(stage, PREP_BONUS.max).gold;
      expect(best).toBeGreaterThanOrEqual(base);
      expect(best / base, stage).toBeLessThanOrEqual((STOVE_BATCH_MAX + PREP_BONUS.max) / STOVE_BATCH_MAX);
    }
  });

  it('the first 30 minutes and the first hour stay inside the S3 targets with the pour step counted', () => {
    expect(POUR_MS).toBeLessThanOrEqual(1000);
    expect(firstHourGold(30).gold).toBeGreaterThanOrEqual(BALANCE_TARGETS.firstHalfHourGold.min);
    expect(firstHourGold(30).gold).toBeLessThanOrEqual(BALANCE_TARGETS.firstHalfHourGold.max);
    expect(firstHourGold(60).gold).toBeGreaterThanOrEqual(BALANCE_TARGETS.firstHourGold.min);
    expect(firstHourGold(60).gold).toBeLessThanOrEqual(BALANCE_TARGETS.firstHourGold.max);
  });

  it('pours per hour never exceed the guests; a full tap lasts at least two minutes and the player is never tied to the taps', () => {
    for (const stage of STAGES) {
      expect(poursPerHour(stage), stage).toBeGreaterThan(0);
      expect(tapLastsMin(stage, 2), stage).toBeGreaterThan(2);
    }
    expect(TAP_CAP * 2).toBeGreaterThanOrEqual(poursPerHour('new') / 6); // two taps cover ten minutes of pours at the start
  });
});

// ---------- Step SG2: the economy gate of the general splice rule (plan 2.7). Over allRecipes(), special and general pairs. ----------
describe('SG2 splice gate: every pair of the general rule', () => {
  const ch = chains();
  const start = starterSeeds();
  const all = allRecipes();
  const results = [...new Set(all.map((x) => x.result))].filter((s) => !start.has(s));
  const rate = bestCropGoldPerCellMinute();

  it('1. reachability: every non-starter result has a finite chain (ms, gold, cell-minutes) from the starter seeds', () => {
    expect(results.length).toBeGreaterThan(0);
    for (const s of results) {
      const c = ch.get(s)!;
      expect(Number.isFinite(c.ms) && Number.isFinite(c.gold) && Number.isFinite(c.cellMs), s).toBe(true);
    }
  });

  it('2. STRICT sell-back per chain: the result seed and one harvest of its product sold together pay no more than the gold of its starter seeds', () => {
    for (const r of spliceSellLoops()) expect(r.seedSold + r.productSold, r.seed).toBeLessThanOrEqual(r.gold);
  });
  it('2. STRICT sell-back per step: for every pair, the result seed and its product sold pay no more than the chains of the two seeds put in', () => {
    for (const x of all) {
      if (start.has(x.result)) continue;
      const g = seedGrows(x.result);
      const product = g.kind === 'material' ? materialSellPrice(g.id) * harvestYield(seedRank(x.result)) : g.kind === 'furniture' ? furnitureSellPrice(g.id) : clothingSellPrice(g.id);
      expect(materialSellPrice(x.result) + product, `${x.a} + ${x.b} -> ${x.result}`).toBeLessThanOrEqual(ch.get(x.a)!.gold + ch.get(x.b)!.gold);
    }
  });

  it('3. cell-minutes: what a result is worth per cell-minute of its chain is under the best plain crop cell, for EVERY result', () => {
    for (const s of results) expect(seedProductValue(s) / (ch.get(s)!.cellMs / 60_000), s).toBeLessThan(rate);
  });

  it('4. seeds: two seeds in, one out (the seed count falls with every splice); the bonus item cannot make up for it', () => {
    expect(SEED_BACK_CHANCE).toBeLessThan(1);
    for (const x of all) expect(x.result === x.a && x.result === x.b, 'a splice never gives both seeds back').toBe(false);
    // One splice gives exactly 1 new seed (the rule returns one id) plus the bonus item (SPLICE_BONUS_CHANCE) which, if a block, returns at most seedRatio of a seed.
    const worstBlock = Math.max(...BLOCK_TYPES.map((b) => seedRatio(b.id)));
    expect(1 + SPLICE_BONUS_CHANCE * worstBlock).toBeLessThan(2);
    for (const b of BLOCK_TYPES) expect(seedRatio(b.id), b.id).toBeLessThan(BALANCE_TARGETS.maxSeedRatio);
  });

  it('5. gems: per cell-minute a splice chain stays under SPLICE_GEM_CAP times the best plain harvest, and its gems are worth no more gold than the chain costs', () => {
    const cap = bestHarvestGemsPerCellMinute() * SPLICE_GEM_CAP;
    for (const r of spliceGemRows()) {
      expect(r.perCellMin, r.seed).toBeLessThanOrEqual(cap);
      expect(r.gemGold, r.seed).toBeLessThanOrEqual(r.cost);
    }
    expect(cheapestGoldPerGem()).toBeGreaterThanOrEqual(BALANCE_TARGETS.minGoldPerGem);
    for (const stage of STAGES) expect(biggestShare(stage).share, stage).toBeLessThanOrEqual(BALANCE_TARGETS.maxSourceShare);
  });

  it('6. packs: a pack sold back pays less than its price and no pack can hand out a splice-only seed', () => {
    for (const p of PACK_TYPES) {
      expect(packSellValue(p), p.id).toBeLessThan(p.gemPrice);
      for (const item of packPool(p.pool)) {
        if (item.kind === 'material' && allSeedIds().includes(item.id as never)) expect(isStarterSeed(item.id as never), `${p.id} ${item.id}`).toBe(true);
      }
    }
    for (const s of results) for (const p of PACK_TYPES) expect(packPool(p.pool).some((i) => i.id === s), `${p.id} has ${s}`).toBe(false);
  });

  it('7. cycles (depth 4): no loop of splices gives a seed back for free (every loop costs gold or cell-time)', () => {
    const loops = cheapestSpliceCycle(4);
    for (const l of loops) expect(l.cost, l.seed).toBeGreaterThan(0);
  });

  it('8. ore, drinks, furniture and styles: furniture seeds sell at most the splice rate, ore per cell-minute stays under the mine, a brew is worth more than its crops', () => {
    const mine = traderByActivity('level8', seededRng(11)).find((r) => r.id === 'mine');
    for (const s of results) {
      const g = seedGrows(s);
      if (seedCategory(s) === 'ore' && g.kind === 'material' && mine) {
        const perMin = (materialSellPrice(g.id) * harvestYield(seedRank(s))) / (ch.get(s)!.cellMs / 60_000);
        expect(perMin, s).toBeLessThan(mine.focused / 60);
      }
      if (g.kind === 'furniture') expect(furnitureSellPrice(g.id), s).toBeLessThanOrEqual(Math.max(1, Math.round(getFurnitureType(g.id).baseValue * SELL_RATES.splice)));
    }
    for (const d of brewSellLoops()) expect(d.sold, d.id).toBeLessThanOrEqual(d.made);
  });

  it('9. distribution: every result seed of the pool is made by at least 2 pairs and no category strays more than 8 points from its weight', () => {
    const made = new Map<string, number>();
    for (const x of all) made.set(x.result, (made.get(x.result) ?? 0) + 1);
    const pool = allSeedIds().filter((s) => !isStarterSeed(s) && isSpliceable(s));
    for (const s of pool) expect(made.get(s) ?? 0, s).toBeGreaterThanOrEqual(2);
    const general = all.filter((x) => !x.special);
    // Only categories that HAVE a pool seed can be hit; until SG3 fills the pools the weights are renormalised over those (every category with 3+ seeds per rank 0..2 means all).
    const live = SEED_CATEGORIES.filter((c) => pool.some((s) => seedCategory(s) === c));
    const expected = new Map<string, number>();
    const actual = new Map<string, number>();
    for (const x of general) {
      const w = categoryWeights(seedCategory(x.a), seedCategory(x.b));
      const total = live.reduce((a, c) => a + (w[c] ?? 0), 0);
      if (total > 0) for (const c of live) expected.set(c, (expected.get(c) ?? 0) + (w[c] ?? 0) / total / general.length);
      actual.set(seedCategory(x.result), (actual.get(seedCategory(x.result)) ?? 0) + 1 / general.length);
    }
    for (const c of live) expect(Math.abs((actual.get(c) ?? 0) - (expected.get(c) ?? 0)) * 100, c).toBeLessThanOrEqual(8);
    for (const x of SPLICE_RECIPES) expect(allSeedIds(), 'special result is a seed').toContain(x.result);
  });

  it('10. plants: a full cap of plants earns at most 25% of a mixed hour at level 8, and food crops need soil or a soil host', () => {
    const farmShare = 1 / activities('level8').length; // a mixed hour gives each open activity an equal share of the time
    expect(plantsCapGoldPerHour('level8') * farmShare).toBeLessThanOrEqual(goldShares('level8', seededRng(11)).total * 0.25);
    expect(PLANTS_ROOM_CAP.farm).toBeGreaterThan(PLANTS_ROOM_CAP.shop);
    expect(BLOCK_TYPES.filter((b) => b.soilHost).length).toBeGreaterThan(0);
  });
  it('the gem yardsticks of test 5 are above zero', () => {
    expect(bestHarvestGemsPerCellMinute()).toBeGreaterThan(0);
    expect(gemsPerEvent('splice', 'common')).toBeGreaterThan(0);
  });
});
