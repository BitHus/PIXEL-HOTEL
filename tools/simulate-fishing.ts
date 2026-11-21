// FISH-2: prints the reel win rate by rank, rod and player (bots from shared/src/fishingSim.ts).
// Run: npx tsx tools/simulate-fishing.ts
import { FISH_BOTS, FISH_SKILLS_MAX, botHookRate, botWinRate } from '../shared/src/fishingSim.ts';
import { RANKS } from '../shared/src/ranks.ts';

const setups: { name: string; gear: string[]; skills: boolean }[] = [
  { name: 'basic rod', gear: [], skills: false },
  { name: 'copper-reel', gear: ['copper_reel_rod'], skills: false },
  { name: 'mithril', gear: ['mithril_rod'], skills: false },
  { name: 'mithril+skills', gear: ['mithril_rod'], skills: true },
];
const n = Number(process.argv[2] ?? 120);
for (const [botName, bot] of Object.entries(FISH_BOTS)) {
  console.log(`\n${botName} player (looks every ${bot.everyMs} ms), win % over ${n} hooked fish`);
  console.log(['setup'.padEnd(16), ...RANKS.map((r) => r.padStart(11))].join(''));
  for (const s of setups) {
    const row = RANKS.map((r) => `${Math.round(botWinRate(r, bot, s.gear, s.skills ? FISH_SKILLS_MAX : undefined, n) * 100)}%`.padStart(11));
    console.log([s.name.padEnd(16), ...row].join(''));
  }
}

// J10 BOBBER DIP: hook % by reaction time to the dip (+-100 ms jitter), basic rod, no skills; and a fast tapper (always early).
console.log(`\nJ10 hook % (tap after the bobber goes under), over ${n} casts`);
console.log(['reaction'.padEnd(16), ...RANKS.map((r) => r.padStart(11))].join(''));
for (const ms of [200, 300, 400, 500]) console.log([(ms + ' ms').padEnd(16), ...RANKS.map((r) => (Math.round(botHookRate(r, ms, { jitterMs: 100, n }) * 100) + '%').padStart(11))].join(''));
console.log(['sharp eye max'.padEnd(16), ...RANKS.map((r) => (Math.round(botHookRate(r, 400, { jitterMs: 100, n, skill: FISH_SKILLS_MAX }) * 100) + '%').padStart(11))].join(''));
console.log(['fast tapper'.padEnd(16), ...RANKS.map((r) => (Math.round(botHookRate(r, 0, { tapEveryMs: 150, n }) * 100) + '%').padStart(11))].join(''));
