// Economy simulation (step 7; new rule in step 9d): nothing sells without the player at the till.
// Customers keep coming and take items, but at most QUEUE_MAX wait at the till; while the line is
// full nobody new comes in. The player looks in every N minutes and serves the whole line. Three
// pricing strategies (cheap, fair, greedy), appeal 0 and 60, 6 items in stock (no restocking),
// over 8 hours. Uses the same rules as the game (shared/src/shop.ts fillQueueMath: the maths of the
// catch-up). Averages over many seeds.
// Run: npm run simulate

import {
  BLOCK_BREAKS_CEILING_PER_HOUR,
  BLOCK_DROPS,
  BLOCK_TYPES,
  BALANCE_TARGETS,
  PACK_TYPES,
  QUEUE_MAX,
  RANK_NAMES,
  SEED_BACK_CHANCE,
  SEED_GROW_MS,
  SPARE_SELL,
  STAGES,
  STAGE_NAMES,
  activities,
  bestCropGoldPerCellMinute,
  biggestShare,
  blockLineage,
  chains,
  cheapestGoldPerGem,
  emptyShop,
  expectedDistinct,
  expectedSpares,
  fillQueueMath,
  focusedGems,
  gemsPerBoughtBlock,
  harvestYield,
  hoursToAfford,
  itemChances,
  lineGemsPerEvent,
  lineGemsPerHour,
  lootBaseValue,
  mixedBySource,
  mixedGemsPerHour,
  packGemReturn,
  packPeakSale,
  packSellValue,
  packsToComplete,
  questGemsBeforeMine,
  questGemsTotal,
  seedLineageGems,
  seedProductValue,
  seedRank,
  seedRatio,
  seededRng,
  CATALOG_PRICE_MULT,
  CROP_TYPES,
  SPLICE_RECIPES,
  type LootRef,
  type ShopSlot,
  type ShopState,
} from '../shared/src/index.ts';

const RUNS = 500;
const HOURS = 8;
const STOCK: LootRef[] = [
  { kind: 'material', id: 'wood', qty: 1 },
  { kind: 'material', id: 'wood', qty: 1 },
  { kind: 'material', id: 'cloth', qty: 1 },
  { kind: 'material', id: 'cloth', qty: 1 },
  { kind: 'material', id: 'crystal', qty: 1 },
  { kind: 'furniture', uid: 1, typeId: 'chair' },
];
const STRATEGIES: [string, number][] = [
  ['cheap (0.7x)', 0.7],
  ['fair (1.0x)', 1.0],
  ['greedy (1.3x)', 1.3],
];
/** How often the player comes to the till, minutes. */
const CHECK_EVERY = [5, 30, 120, 480];
const MINUTE = 60_000;

function stockedShop(mult: number): ShopState {
  const slots: ShopSlot[] = STOCK.map((loot, i) => ({
    shelfUid: 100 + Math.floor(i / 3),
    index: i % 3,
    loot,
    price: Math.max(1, Math.round(lootBaseValue(loot) * mult)),
  }));
  return { ...emptyShop(2, 0), slots };
}

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
console.log(`Economy simulation (step 9d rule: no selling without the player, at most ${QUEUE_MAX} wait at the till).`);
console.log(`6 items in stock (2 wood, 2 cloth, 1 crystal, 1 chair; worth ${STOCK.reduce((a, l) => a + lootBaseValue(l), 0)} gold at base value), no restocking, ${HOURS} hours, ${RUNS} runs each.`);
console.log('"check" = the player serves the whole line every N minutes (also at the end).');
console.log('"lost min" = minutes of customer time lost because the line was full (nobody could come in).\n');
console.log(pad('strategy', 15) + pad('appeal', 8) + pad('check', 9) + pad('gold', 8) + pad('sold', 7) + 'lost min');
for (const [name, mult] of STRATEGIES) {
  for (const appeal of [0, 60]) {
    for (const every of CHECK_EVERY) {
      let gold = 0;
      let sold = 0;
      let lostMs = 0;
      for (let seed = 1; seed <= RUNS; seed++) {
        const rng = seededRng(seed);
        let shop = stockedShop(mult);
        let waiting: number[] = [];
        for (let t = 0; t < HOURS * 60 * MINUTE; t += every * MINUTE) {
          const span = Math.min(every * MINUTE, HOURS * 60 * MINUTE - t);
          const r = fillQueueMath(shop, appeal, waiting.length, span, rng);
          shop = r.shop;
          waiting = [...waiting, ...r.arrivals.map((a) => a.price)];
          // The line was full from the last arrival (or the start) to the end of the span.
          if (waiting.length >= QUEUE_MAX && shop.slots.length > 0) {
            const fullFrom = r.arrivals.length > 0 ? r.arrivals[r.arrivals.length - 1]!.afterMs : 0;
            lostMs += span - fullFrom;
          }
          // The player serves the whole line.
          gold += waiting.reduce((a, p) => a + p, 0);
          sold += waiting.length;
          waiting = [];
        }
      }
      const f = (n: number, d = 1): string => (n / RUNS).toFixed(d);
      console.log(pad(name, 15) + pad(appeal, 8) + pad(`${every} min`, 9) + pad(f(gold), 8) + pad(f(sold), 7) + (lostMs / RUNS / MINUTE).toFixed(0));
    }
  }
}

// ---------- BG9: the block world's gems, packs, seeds and splicing ----------
// Every number below is EXPECTED value worked out in closed form from the game's rules (shared/src/balance.ts); the activity
// rates (events per hour) are assumptions written in balance.ts, one place. Gems are the play money: gold is the tavern money.
const hr = (h: number): string => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
const f1 = (n: number): string => n.toFixed(1);

console.log('\n=== BG9 1. Gems per hour by source (focused hour in one activity; mixed hour = equal time in each open activity) ===');
for (const stage of STAGES) {
  console.log(`\n-- ${STAGE_NAMES[stage]} --`);
  console.log(pad('activity / source', 26) + pad('events/h', 10) + pad('gems/event', 12) + pad('focused gems/h', 16) + 'mixed gems/h');
  const acts = activities(stage);
  for (const a of acts) {
    console.log(`${a.label}   => ${f1(focusedGems(a))} gems/h focused`);
    for (const l of a.lines) {
      console.log('  ' + pad(l.source + ' (' + l.note + ')', 24) + pad(l.perHour, 10) + pad(lineGemsPerEvent(l).toFixed(3), 12) + pad(f1(lineGemsPerHour(l)), 16) + f1(lineGemsPerHour(l, 1 / acts.length)));
    }
  }
  const total = mixedGemsPerHour(stage);
  const by = [...mixedBySource(stage)].sort((x, y) => y[1] - x[1]);
  console.log(`MIXED ${f1(total)} gems/h: ` + by.map(([s, g]) => `${s} ${f1(g)} (${Math.round((g / total) * 100)}%)`).join(', '));
  const big = biggestShare(stage);
  console.log(`Biggest single source: ${big.source} ${Math.round(big.share * 100)}% (target at most ${Math.round(BALANCE_TARGETS.maxSourceShare * 100)}%).`);
}
console.log(`\nOne-off: the first-run quests pay ${f1(questGemsBeforeMine())} gems before the mine opens (level 3), ${f1(questGemsTotal())} in all. Book tiers: see BOOK_GEM_RANK.`);

console.log('\n=== BG9 2. Hours of MIXED play to afford each pack (the first-run quest gems count for the new player) ===');
console.log(pad('pack', 22) + pad('gems', 7) + pad('rolls', 7) + STAGES.map((s) => pad(STAGE_NAMES[s], 22)).join('') + 'target');
const TARGET_TEXT: Record<string, string> = {
  basic_seeds: `first pack: at most ${BALANCE_TARGETS.firstPackMaxMin} min`,
  random_blocks: `first pack: at most ${BALANCE_TARGETS.firstPackMaxMin} min`,
  common_clothes: `about ${BALANCE_TARGETS.commonClothesHours} h`,
  rare_clothes: `about ${BALANCE_TARGETS.rareClothesHours} h`,
};
for (const pack of PACK_TYPES) {
  console.log(pad(pack.name, 22) + pad(pack.gemPrice, 7) + pad(pack.rolls, 7) + STAGES.map((s) => pad(hr(hoursToAfford(pack.gemPrice, s)), 22)).join('') + (TARGET_TEXT[pack.id] ?? ''));
}

console.log('\n=== BG9 3. Packs: what is inside, what it sells for, how many duplicates ===');
console.log(pad('pack', 22) + pad('price', 7) + pad('sold (gold)', 13) + pad('peak sale', 11) + pad('price/piece', 13) + pad('dupes in 1 / 5 / 10 packs', 28) + pad('different in 10', 17) + 'gems back by playing it');
for (const pack of PACK_TYPES) {
  const peak = packPeakSale(pack);
  const pool = itemChances(pack).length;
  console.log(
    pad(pack.name, 22) + pad(pack.gemPrice, 7) + pad(f1(packSellValue(pack)), 13) + pad(peak.peak, 11) + pad(f1(peak.pricePerPiece), 13) +
      pad([1, 5, 10].map((n) => f1(expectedSpares(pack, n))).join(' / '), 28) + pad(`${f1(expectedDistinct(pack, 10))} of ${pool}`, 17) + packGemReturn(pack).toFixed(1),
  );
}
const complete = PACK_TYPES.filter((p) => p.pool === 'clothing').map((p) => `${p.name}: ${f1(packsToComplete(p, seededRng(3)))} packs for every piece it can give`);
console.log(complete.join('; ') + `. A spare piece sells for baseValue x SPARE_SELL (${SPARE_SELL}) gold.`);

console.log('\n=== BG9 4. Blocks and seeds: the punching loop ===');
console.log(pad('block', 14) + pad('rank', 11) + pad('hits', 6) + pad('breaks/blk', 12) + pad('gems/blk', 10) + pad('seeds/blk', 11) + pad('seed ratio', 12) + pad('gems/seed', 11) + 'gems per bought block (gold)');
for (const b of BLOCK_TYPES) {
  const l = blockLineage(b.rank);
  const ratio = seedRatio(b.id);
  const lineage = seedLineageGems(b.id);
  console.log(
    pad(b.id, 14) + pad(RANK_NAMES[b.rank], 11) + pad(b.hardness, 6) + pad(f1(l.breaks), 12) + pad(l.gems.toFixed(2), 10) + pad(l.seeds.toFixed(2), 11) + pad(ratio.toFixed(2) + (ratio >= 1 ? ' LOOP' : ''), 12) +
      pad(Number.isFinite(lineage) ? f1(lineage) : 'unlimited', 11) + (b.inCatalog ? `${gemsPerBoughtBlock(b.id).toFixed(2)} gems for ${b.baseValue * CATALOG_PRICE_MULT} gold` : 'not sold'),
  );
}
console.log(`Seed ratio = seeds back from ONE planted seed (harvest yield x seeds per block + ${SEED_BACK_CHANCE}); at 1 or more a seed makes seeds forever. BLOCK_DROPS: ` + (Object.entries(BLOCK_DROPS) as [string, (typeof BLOCK_DROPS)['common']][]).map(([k, v]) => `${k} block ${v.block} seed ${v.seed} gem ${v.gem}`).join('; '));
const rate = BLOCK_BREAKS_CEILING_PER_HOUR;
console.log(`Cheapest gold to gems: ${cheapestGoldPerGem().toFixed(1)} gold per gem (target at least ${BALANCE_TARGETS.minGoldPerGem}).`);
console.log(`If blocks never ran out, ${rate} breaks/h would give ${f1(rate * 0.375)} gems/h on common blocks. They do run out: a bought dirt block (${2 * CATALOG_PRICE_MULT} gold) gives ${gemsPerBoughtBlock('dirt').toFixed(2)} gems, so ${f1((2 * CATALOG_PRICE_MULT) / gemsPerBoughtBlock('dirt'))} gold per gem.`);

console.log('\n=== BG9 5. Seed -> plant -> harvest -> sell: gold per cell, and the limit ===');
console.log(pad('crop', 10) + pad('seed gold', 11) + pad('grow', 8) + pad('yield', 7) + pad('sells', 7) + pad('gold/harvest', 14) + pad('gold per cell-min', 19) + 'cells to feed the shop');
const CUSTOMERS_PER_HOUR = (appeal: number): number => 3600 / (60 * (100 / (100 + appeal)));
for (const crop of CROP_TYPES) {
  if (crop.seedPrice === null) continue;
  const grow = SEED_GROW_MS[crop.rank] / 60_000;
  const y = harvestYield(crop.rank);
  const gold = y * crop.baseValue - crop.seedPrice * (1 - SEED_BACK_CHANCE);
  const perMin = gold / grow;
  const cellsToSaturate = CUSTOMERS_PER_HOUR(100) / ((60 / grow) * y);
  console.log(pad(crop.id, 10) + pad(crop.seedPrice, 11) + pad(grow + ' min', 8) + pad(f1(y), 7) + pad(crop.baseValue, 7) + pad(f1(gold), 14) + pad(f1(perMin), 19) + cellsToSaturate.toFixed(2));
}
console.log(`The limit is the till: at most ${CUSTOMERS_PER_HOUR(0).toFixed(0)} customers/h at appeal 0 and ${CUSTOMERS_PER_HOUR(100).toFixed(0)}/h at appeal 100 (each buys ONE item, and only while the player serves). So crops cap at about ${(CUSTOMERS_PER_HOUR(100) * 22).toFixed(0)} gold/h however many cells, and a handful of cells already feed that.`);

console.log('\n=== BG9 6. Splicing: time, cost and value of each result (fastest way from starter seeds) ===');
const ch = chains();
const rate1 = bestCropGoldPerCellMinute();
console.log(pad('result', 24) + pad('rank', 11) + pad('wall clock', 12) + pad('seed gold', 11) + pad('cell-min', 10) + pad('worth (gold)', 14) + `worth per cell-min (a plain crop cell makes ${f1(rate1)})`);
const results = [...new Set(SPLICE_RECIPES.map((x) => x.result))];
for (const id of results) {
  const c = ch.get(id)!;
  const worth = seedProductValue(id);
  console.log(pad(id, 24) + pad(RANK_NAMES[seedRank(id)], 11) + (c.cellMs === 0 ? pad('(starter)', 12) + pad(c.gold, 11) + pad('-', 10) + pad(worth, 14) + 'comes from a pack or a drop' : pad(hr(c.ms / 3_600_000), 12) + pad(c.gold, 11) + pad(f1(c.cellMs / 60_000), 10) + pad(worth, 14) + f1(worth / (c.cellMs / 60_000))));
}
console.log('Wall clock = branches planted in parallel in their own cells; a splice cell takes the longer seed time + SPLICE_BONUS_MS. Value per cell-min must stay under a plain crop cell, else a chain makes value from nothing.');
console.log('Time by result rank (fastest result of each rank):' + (['common', 'rare', 'ultra_rare', 'legendary'] as const).map((rk) => { const ids = results.filter((i) => seedRank(i) === rk); return ids.length ? ` ${RANK_NAMES[rk]} ${hr(Math.min(...ids.map((i) => ch.get(i)!.ms)) / 3_600_000)}-${hr(Math.max(...ids.map((i) => ch.get(i)!.ms)) / 3_600_000)}` : ''; }).join(';'));
