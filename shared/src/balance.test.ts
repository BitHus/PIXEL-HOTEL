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
} from './balance.ts';
import { BALANCE_TARGETS, PACKS, SELL_RATES, SPARE_SELL } from './config.ts';
import { CROP_TYPES, getMaterialType } from './materials.ts';
import { getFurnitureType } from './furniture.ts';
import { materialSellPrice, furnitureSellPrice } from './trader.ts';
import { PACK_TYPES } from './packs.ts';
import { seededRng } from './rng.ts';
import { SPLICE_RECIPES } from './splice.ts';

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
