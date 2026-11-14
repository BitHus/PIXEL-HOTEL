// Economy simulation (step 7; new rule in step 9d): nothing sells without the player at the till.
// Customers keep coming and take items, but at most QUEUE_MAX wait at the till; while the line is
// full nobody new comes in. The player looks in every N minutes and serves the whole line. Three
// pricing strategies (cheap, fair, greedy), appeal 0 and 60, 6 items in stock (no restocking),
// over 8 hours. Uses the same rules as the game (shared/src/shop.ts fillQueueMath: the maths of the
// catch-up). Averages over many seeds.
// Run: npm run simulate

import { QUEUE_MAX, emptyShop, fillQueueMath, lootBaseValue, seededRng, type LootRef, type ShopSlot, type ShopState } from '../shared/src/index.ts';

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
