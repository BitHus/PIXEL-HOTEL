// Step BG9: the balance of the block world. These tests FAIL when a loop reopens (a config or data number drifts): the
// seed loop, packs that pay back more than they cost, spliced results worth more than their inputs plus time, punching
// blocks swallowing the gem income, and a first pack that takes too long. The maths is in balance.ts; the printed tables are
// `npm run simulate` (NOTES, BG9). All numbers are EXPECTED values, so there is no rng here.

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from './blockTypes.ts';
import {
  STAGES,
  activities,
  bestCropGoldPerCellMinute,
  biggestShare,
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
import { BALANCE_TARGETS, PACKS, SPARE_SELL } from './config.ts';
import { PACK_TYPES } from './packs.ts';
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
