// Economy simulation (step 7; BG9; 9t C; S1). Since step S1 nobody sells loot to customers: gold comes from tavern guests
// (the 9t C table below, brewing- and seat-limited) and dungeon run gold (npm run simulate:dungeon). The old shop tables
// (customers at the till, 9d) are gone; the old shop's ceiling is only kept as a reference column. The trader comes in S2.
// Run: npm run simulate

import {
  BLOCK_BREAKS_CEILING_PER_HOUR,
  FOOD_TYPES,
  GUEST_BASE_INTERVAL_MS,
  GUEST_GROUP_WEIGHTS,
  GUEST_EAT_MAX_MS,
  GUEST_EAT_MIN_MS,
  GUEST_ORDER_AFTER_MAX_MS,
  GUEST_ORDER_AFTER_MIN_MS,
  DRINK_TYPES,
  STOVE_BATCH_MAX,
  cookMs,
  getMaterialType,
  type MaterialId,
  BLOCK_DROPS,
  BLOCK_TYPES,
  BALANCE_TARGETS,
  PACK_TYPES,
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
  expectedDistinct,
  expectedSpares,
  focusedGems,
  gemsPerBoughtBlock,
  harvestYield,
  hoursToAfford,
  itemChances,
  lineGemsPerEvent,
  lineGemsPerHour,
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
  SELL_RATE,
  spliceSellLoops,
  surplusGoldPerHour,
  mixedSurplusGoldPerHour,
  SPLICE_RECIPES,
} from '../shared/src/index.ts';

const MINUTE = 60_000;
const pad = (s: string | number, n: number): string => String(s).padEnd(n);
const RUNS = 500;
void RUNS;
void MINUTE;

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

console.log('\n=== BG9 5. Seed -> plant -> harvest: crop value per cell (S1: no one buys crops until the S2 trader; they feed brewing and cooking) ===');
console.log(pad('crop', 10) + pad('seed gold', 11) + pad('grow', 8) + pad('yield', 7) + pad('sells', 7) + pad('gold/harvest', 14) + 'gold per cell-min');
/** The old loot shop (removed in step S1), kept only as a reference ceiling: one customer every 60 s * 100 / (100 + appeal). */
const CUSTOMERS_PER_HOUR = (appeal: number): number => 3600 / (60 * (100 / (100 + appeal)));
for (const crop of CROP_TYPES) {
  if (crop.seedPrice === null) continue;
  const grow = SEED_GROW_MS[crop.rank] / 60_000;
  const y = harvestYield(crop.rank);
  const gold = y * crop.baseValue - crop.seedPrice * (1 - SEED_BACK_CHANCE);
  const perMin = gold / grow;
  console.log(pad(crop.id, 10) + pad(crop.seedPrice, 11) + pad(grow + ' min', 8) + pad(f1(y), 7) + pad(crop.baseValue, 7) + pad(f1(gold), 14) + f1(perMin));
}

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

console.log('\n=== K1. The tavern kitchen: dishes per hour per stove and gold per dish through the menu ===');
const AVG_GROUP = GUEST_GROUP_WEIGHTS.reduce((sum, w, i) => sum + w * (i + 1), 0) / GUEST_GROUP_WEIGHTS.reduce((a, b) => a + b, 0);
const GUESTS_PER_HOUR = (appeal: number): number => (3_600_000 / (GUEST_BASE_INTERVAL_MS * (100 / (100 + appeal)))) * AVG_GROUP;
console.log(pad('dish', 16) + pad('rank', 11) + pad('cook', 8) + pad('crops/dish', 12) + pad('crop gold', 11) + pad('menu price', 12) + pad('gold/dish', 11) + pad('dishes/h/stove', 16) + pad('(visit every 10 min)', 21) + 'gold/h/stove');
for (const f of FOOD_TYPES) {
  const batch = STOVE_BATCH_MAX;
  const cropsPerDish = Object.values(f.inputs).reduce((a, n) => a + (n ?? 0), 0);
  const cropGold = Object.entries(f.inputs).reduce((a, [id, n]) => a + (n ?? 0) * getMaterialType(id as MaterialId).baseValue, 0);
  const perHourBusy = (batch * 3_600_000) / cookMs(f);
  // A player who looks in every 10 minutes: a batch takes max(cook time, the next visit).
  const perHourVisits = batch * (60 / Math.max(10, cookMs(f) / 60_000));
  console.log(
    pad(f.id, 16) + pad(RANK_NAMES[f.rank], 11) + pad(`${cookMs(f) / 1000} s`, 8) + pad(cropsPerDish, 12) + pad(cropGold, 11) + pad(f.baseValue, 12) + pad(f.baseValue - cropGold, 11) + pad(f1(perHourBusy), 16) + pad(f1(perHourVisits), 21) + f1(perHourVisits * (f.baseValue - cropGold)),
  );
}
console.log(`Crops are the real limit, not the stove: one stove can cook ${STOVE_BATCH_MAX} dishes every ${cookMs(FOOD_TYPES[0]!) / 1000} s, but a harvest of a common crop takes ${SEED_GROW_MS.common / 60_000} min. Guests ask for about ${GUESTS_PER_HOUR(0).toFixed(0)} items/h at appeal 0 and ${GUESTS_PER_HOUR(100).toFixed(0)}/h at appeal 100 (a group is ${AVG_GROUP.toFixed(2)} guests on average), so more than ${Math.ceil(GUESTS_PER_HOUR(100) / ((60 / 10) * STOVE_BATCH_MAX))} stove(s) visited every 10 min cannot sell their dishes through the menu alone.`);

console.log('\n=== 9t C. Tavern income per hour (guests by appeal, seats, menu prices, brewing and cooking output) next to the old shop ===');
// The old shop: one customer every 60 s * 100 / (100 + appeal), each buying one item of about SHOP_SALE gold (the figure the till line above uses).
const SHOP_SALE = 22;
const GOLD_PER_GEM_NOTE = 'gems: see BG9 1 (the tavern pays gold only; no new gem source)';
// A guest holds a seat: the pause before the order, the player's walk to the bar and the table (about SERVE_S), the meal, and the walk out.
const SERVE_S = 15;
const STAY_S = (GUEST_ORDER_AFTER_MIN_MS + GUEST_ORDER_AFTER_MAX_MS) / 2000 + SERVE_S + (GUEST_EAT_MIN_MS + GUEST_EAT_MAX_MS) / 2000 + 5;
const seatCap = (seats: number): number => (seats * 3600) / STAY_S;
const mugsPerHour = (d: (typeof DRINK_TYPES)[number], barrels: number): number => barrels * d.mugs * (60 / Math.max(10, d.minutes));
const cropCost = (inputs: Partial<Record<MaterialId, number>>): number => Object.entries(inputs).reduce((a, [id, n]) => a + (n ?? 0) * getMaterialType(id as MaterialId).baseValue, 0);
// Gold per mug at the default menu price (baseValue; the tip is a share of it) and the net after the crops that went into it.
console.log(pad('drink', 16) + pad('rank', 9) + pad('brew', 9) + pad('mugs', 6) + pad('price', 7) + pad('tip', 6) + pad('crop gold/mug', 15) + pad('net gold/mug', 14) + pad('mugs/h/barrel', 15) + 'net gold/h/barrel (visit every 10 min)');
for (const d of DRINK_TYPES) {
  const tip = d.baseValue * d.tip;
  const perMug = cropCost(d.inputs) / d.mugs;
  console.log(pad(d.id, 16) + pad(RANK_NAMES[d.rank], 9) + pad(`${d.minutes} min`, 9) + pad(d.mugs, 6) + pad(d.baseValue, 7) + pad(f1(tip), 6) + pad(f1(perMug), 15) + pad(f1(d.baseValue + tip - perMug), 14) + pad(f1(mugsPerHour(d, 1)), 15) + f1(mugsPerHour(d, 1) * (d.baseValue + tip - perMug)));
}
const avgMug = DRINK_TYPES.reduce((a, d) => a + d.baseValue + d.baseValue * d.tip, 0) / DRINK_TYPES.length;
const rootAle = DRINK_TYPES[0]!;
console.log(`\nA guest holds a seat about ${STAY_S.toFixed(0)} s (order pause, the carry, the meal, the walk out) so a seat serves at most ${seatCap(1).toFixed(0)} guests/h.`);
console.log('Gold per hour = the smallest of: guests who arrive, guests the seats hold, mugs the barrels brew (every drink on the menu at its baseValue; the glowcap tip is counted). "x old shop" = tavern gold / (shop customers/h * ' + SHOP_SALE + ' gold).');
console.log(pad('appeal', 8) + pad('guests/h', 10) + pad('seats', 7) + pad('barrels', 9) + pad('menu', 10) + pad('seat cap', 10) + pad('mug supply', 12) + pad('sold/h', 8) + pad('gold/h', 9) + pad('old shop', 10) + pad('x old shop', 12) + 'limit');
for (const appeal of [0, 30, 60, 100]) {
  for (const [seats, barrelsN, menu, price] of [[2, 1, 'root ale', rootAle.baseValue], [2, 1, 'mixed', avgMug], [6, 2, 'mixed', avgMug], [10, 4, 'mixed', avgMug]] as const) {
    const arrive = GUESTS_PER_HOUR(appeal);
    const cap = seatCap(seats);
    const mugAvg = menu === 'root ale' ? mugsPerHour(rootAle, barrelsN) : (DRINK_TYPES.reduce((a, d) => a + mugsPerHour(d, 1), 0) / DRINK_TYPES.length) * barrelsN;
    const sold = Math.min(arrive, cap, mugAvg);
    const limit = sold === mugAvg ? 'brewing' : sold === cap ? 'seats' : 'guests';
    const gold = sold * price;
    const shop = CUSTOMERS_PER_HOUR(appeal) * SHOP_SALE;
    console.log(pad(appeal, 8) + pad(f1(arrive), 10) + pad(seats, 7) + pad(barrelsN, 9) + pad(menu, 10) + pad(f1(cap), 10) + pad(f1(mugAvg), 12) + pad(f1(sold), 8) + pad(f1(gold), 9) + pad(f1(shop), 10) + pad(`${(gold / shop).toFixed(2)}x`, 12) + limit);
  }
}
// Dishes from the stove (K1) go on the same menu: one stove visited every 10 min makes up to STOVE_BATCH_MAX * 6 dishes/h; each is worth its baseValue.
const avgDish = FOOD_TYPES.reduce((a, f) => a + f.baseValue, 0) / FOOD_TYPES.length;
console.log(`\nOne stove visited every 10 min adds up to ${STOVE_BATCH_MAX * 6} dishes/h worth ${f1(avgDish)} gold each on average (${f1(STOVE_BATCH_MAX * 6 * avgDish)} gold/h if guests ordered them all; dishes are off the menu until the player switches them on).`);
console.log('REPORT (nothing retuned): the target is tavern gold/h within 0.5x to 2x of the old shop at the same appeal. Result: brewing is the limit in every row. A new game (2 stools, one barrel) earns about 0.1x to 0.25x of the old shop ceiling, 4 barrels 0.45x to 0.9x; guests and seats are never the limit. The old shop figure is a CEILING (it assumes loot for every customer, which the dungeon cannot supply), so the real gap is smaller, and the stove adds dishes. If the owner wants the start closer to 0.5x: more mugs per brew, or a shorter root ale time.');
console.log(GOLD_PER_GEM_NOTE + '.');

console.log('\n=== S2. The trader: gold per hour from selling surplus, next to guest gold (nothing retuned; S3 tunes it) ===');
console.log(`The trader pays baseValue x SELL_RATE (${SELL_RATE}), at least 1; spare clothes keep SPARE_SELL (${SPARE_SELL}); food and drinks are never bought. Every thing the activities drop is counted as SURPLUS (so this is a CEILING: crops, ore and wood also feed cooking, brewing and crafting). Blocks are building stock and are not counted. Chest and kill gold is not counted (it is gold already).`);
console.log(pad('stage', 24) + pad('mixed hour', 12) + 'focused hour by activity (gold/h)');
for (const stage of STAGES) {
  const rows = surplusGoldPerHour(stage, seededRng(11));
  console.log(pad(STAGE_NAMES[stage], 24) + pad(f1(mixedSurplusGoldPerHour(stage, seededRng(11))), 12) + rows.map((r) => `${r.id} ${f1(r.gold)}`).join(', '));
}
const guestNew = Math.min(GUESTS_PER_HOUR(0), seatCap(2), mugsPerHour(rootAle, 1)) * rootAle.baseValue;
const guestBig = Math.min(GUESTS_PER_HOUR(60), seatCap(6), (DRINK_TYPES.reduce((a, d) => a + mugsPerHour(d, 1), 0) / DRINK_TYPES.length) * 2) * avgMug;
console.log(`Guest gold per hour for comparison (table 9t C): a new game ${f1(guestNew)} (2 stools, one barrel of root ale), a bigger tavern ${f1(guestBig)} (6 seats, 2 barrels, appeal 60). Ratio of a new player's mixed-hour surplus to guest gold: ${(mixedSurplusGoldPerHour('new', seededRng(11)) / guestNew).toFixed(2)}x.`);
console.log('Loops closed (balance.test.ts): selling the ingredients of a dish or brew pays less than the dish or the mugs; a bought catalog block sells back for less; a pack sold back is worth less than its gems at the gold-per-gem floor; a splice chain\'s results sold back are worth less than their seeds plus cell-time.');
const traded = spliceSellLoops().filter((r) => r.productSold > r.gold);
console.log(`NOT CLOSED, ONLY PRICED: ${traded.length} spliced results sell for more than the GOLD of their starter seeds (${traded.map((r) => `${r.seed.replace(/_seed$/, '')} ${r.productSold} vs ${r.gold}`).join('; ')}); what pays for them is the real time (cell-minutes), as in BG9.`);
