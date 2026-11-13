// Economy simulation (step 7): how a shop does with three pricing strategies (cheap, fair,
// greedy), at appeal 0 and 60, with 6 items in stock (no restocking), over 1 hour and 8 hours.
// Uses the same rules as the game (shared/src/shop.ts simulateShop). Averages over many seeds.
// Run: npm run simulate

import { emptyShop, lootBaseValue, seededRng, simulateShop, type LootRef, type ShopSlot } from '../shared/src/index.ts';

const RUNS = 500;
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
const HOUR = 3_600_000;

function stockedShop(mult: number) {
  const slots: ShopSlot[] = STOCK.map((loot, i) => ({
    shelfUid: 100 + Math.floor(i / 3),
    index: i % 3,
    loot,
    price: Math.max(1, Math.round(lootBaseValue(loot) * mult)),
  }));
  return { ...emptyShop(2, 0), slots };
}

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
console.log(`Economy simulation: 6 items in stock (2 wood, 2 cloth, 1 crystal, 1 chair; worth ${STOCK.reduce((a, l) => a + lootBaseValue(l), 0)} gold at base value), no restocking, ${RUNS} runs each.`);
console.log('"slot time" = average minutes an item sat on its slot (until sold, or to the end if unsold).');
console.log('"blocked" = slot-hours still taken by unsold items at the end.\n');
console.log(pad('strategy', 15) + pad('appeal', 8) + pad('time', 6) + pad('gold', 8) + pad('sold', 7) + pad('slot time', 11) + 'blocked');
for (const [name, mult] of STRATEGIES) {
  for (const appeal of [0, 60]) {
    for (const hours of [1, 8]) {
      let gold = 0;
      let sold = 0;
      let slotMs = 0;
      let blockedMs = 0;
      for (let seed = 1; seed <= RUNS; seed++) {
        const r = simulateShop(stockedShop(mult), appeal, hours * HOUR, seededRng(seed));
        gold += r.sales.reduce((a, s) => a + s.price, 0);
        sold += r.sales.length;
        slotMs += r.sales.reduce((a, s) => a + s.at, 0);
        const unsold = STOCK.length - r.sales.length;
        slotMs += unsold * hours * HOUR;
        blockedMs += unsold * hours * HOUR;
      }
      const f = (n: number, d = 1): string => (n / RUNS).toFixed(d);
      console.log(
        pad(name, 15) + pad(appeal, 8) + pad(`${hours} h`, 6) + pad(f(gold), 8) + pad(f(sold), 7) +
          pad((slotMs / RUNS / STOCK.length / 60_000).toFixed(0) + ' min', 11) + (blockedMs / RUNS / HOUR).toFixed(1) + ' h',
      );
    }
  }
}
