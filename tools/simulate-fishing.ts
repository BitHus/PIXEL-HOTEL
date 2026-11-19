// FISH-2: prints the reel win rate by rank, rod and player (bots from shared/src/fishingSim.ts).
// Run: npx tsx tools/simulate-fishing.ts
import { FISH_BOTS, FISH_SKILLS_MAX, botWinRate } from '../shared/src/fishingSim.ts';
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
