// Dungeon simulation (step 8): a bot plays many runs with the real rules (shared/src/dungeon,
// step()). It clicks every N ms: it hits an enemy that is next to it, otherwise walks to the
// nearest unopened chest, then to the exit. At the exit it goes deeper while hp >= 50%, else
// leaves. It drinks a potion (if it has one) below 40% hp. Runs: npm run simulate:dungeon
// Optional arguments: the number of runs (default 1000) and the round (default: both).

import {
  DUNGEON_ROUND,
  PLAYER_ATTACK_REACH,
  distance,
  getFurnitureType,
  getMaterialType,
  levelForXp,
  newRun,
  seededRng,
  step,
  type DungeonInput,
  type DungeonRoundId,
  type DungeonRun,
  type GearId,
  type Point,
  type RunBag,
} from '../shared/src/index.ts';

const RUNS = Number(process.argv[2] ?? 1000);
const ROUNDS: DungeonRoundId[] = process.argv[3] ? [Number(process.argv[3]) as DungeonRoundId] : [1, 2];
const CHAIN = 10;
const MAX_RUN_MS = 20 * 60 * 1000;

interface BotState {
  goal: Point | null;
}

function botInputs(run: DungeonRun, bot: BotState): DungeonInput[] {
  const p = run.player;
  if (run.status === 'exit_choice') {
    const deeper = run.floor < run.maxFloors && p.hp >= p.maxHp * 0.5;
    return [{ t: 'choose_exit', choice: deeper ? 'deeper' : 'leave' }];
  }
  if (p.potions > 0 && p.hp < p.maxHp * 0.4) return [{ t: 'drink_potion' }];
  const near = run.enemies
    .filter((e) => distance(e, p) <= PLAYER_ATTACK_REACH + 4)
    .sort((a, b) => distance(a, p) - distance(b, p))[0];
  if (near) {
    return [{ t: 'click_enemy', id: near.id }];
  }
  // Keep going to the chest already chosen until it is open (else the bot can swing between two).
  const open = run.chests.filter((c) => !c.opened);
  const chest = open.find((c) => bot.goal && c.x === bot.goal.x && c.y === bot.goal.y) ?? open.sort((a, b) => distance(a, p) - distance(b, p))[0];
  const exit = { x: (run.map.exit.c + 0.5) * 32, y: (run.map.exit.r + 0.5) * 32 };
  const goal = chest ? { x: chest.x, y: chest.y } : exit;
  if (bot.goal && bot.goal.x === goal.x && bot.goal.y === goal.y && p.path.length > 0 && p.targetEnemyId === null) return [];
  bot.goal = goal;
  return [{ t: 'click_point', x: goal.x, y: goal.y }];
}

function playRun(seed: number, round: DungeonRoundId, clickMs: number, xp: number, gear: GearId[]): DungeonRun {
  const rng = seededRng(seed * 7 + clickMs);
  let run = newRun({ seed, round, xp, gear, potions: 0 });
  const bot: BotState = { goal: null };
  while ((run.status === 'active' || run.status === 'exit_choice') && run.timeMs < MAX_RUN_MS) {
    run = step(run, botInputs(run, bot), clickMs, rng);
  }
  return run;
}

function bagValue(bag: RunBag): number {
  return bag.gold + bag.slots.reduce((a, s) => a + (s.kind === 'material' ? getMaterialType(s.id).baseValue * s.qty : getFurnitureType(s.typeId).baseValue), 0);
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(5);
const num = (n: number) => n.toFixed(0).padStart(5);

for (const round of ROUNDS) {
  console.log(`\n=== Round ${round}${round === DUNGEON_ROUND ? ' (current DUNGEON_ROUND)' : ''}: ${RUNS} runs per row, level 1, no potions ===`);
  console.log('bot            survive  value/run  value/banked  gold/banked  floors  minutes  timeouts  avg level after 10 runs');
  const configs: [string, number, GearId[]][] = [
    ['350 ms', 350, []],
    ['500 ms', 500, []],
    ['700 ms', 700, []],
    ['500 ms + gear', 500, ['iron_sword', 'leather_armor']],
  ];
  const drops: [string, Map<string, number>][] = [];
  for (const [name, clickMs, gear] of configs) {
    let survived = 0;
    let value = 0;
    let bankedValue = 0;
    let bankedGold = 0;
    let floors = 0;
    let ms = 0;
    let timeouts = 0;
    const rare = new Map<string, number>();
    for (let i = 0; i < RUNS; i++) {
      const run = playRun(i + 1, round, clickMs, 0, gear);
      const v = bagValue(run.banked);
      value += v;
      floors += run.floor;
      ms += run.timeMs;
      if (run.status === 'left') {
        survived++;
        bankedValue += v;
        bankedGold += run.banked.gold;
      }
      if (run.status !== 'left' && run.status !== 'dead') timeouts++;
      for (const s of [...run.banked.slots, ...run.lost.slots]) {
        const id = s.kind === 'furniture' ? s.typeId : s.id;
        if (s.kind === 'furniture' || id === 'throne_piece') rare.set(id, (rare.get(id) ?? 0) + (s.kind === 'material' ? s.qty : 1));
      }
    }
    // Ten runs in a row, xp carried over (100 chains, or fewer when RUNS is small).
    const chains = Math.max(1, Math.floor(RUNS / CHAIN));
    let levels = 0;
    for (let c = 0; c < chains; c++) {
      let xp = 0;
      for (let k = 0; k < CHAIN; k++) xp += playRun(100000 + c * CHAIN + k, round, clickMs, xp, gear).xpGained;
      levels += levelForXp(xp);
    }
    const s = survived || 1;
    console.log(
      `${name.padEnd(15)}${pct(survived / RUNS)}    ${num(value / RUNS)}      ${num(bankedValue / s)}        ${num(bankedGold / s)}     ${(floors / RUNS).toFixed(2)}    ${(ms / RUNS / 60000).toFixed(1).padStart(4)}     ${String(timeouts).padStart(4)}      ${(levels / chains).toFixed(2)}`,
    );
    drops.push([name, rare]);
  }
  console.log('\nRare drops found (banked or lost) per 100 runs:');
  const ids = ['bone_chair', 'skull_lamp', 'coffin_table', 'wall_torch', 'throne_piece'];
  console.log('bot            ' + ids.map((id) => id.padStart(13)).join(''));
  for (const [name, rare] of drops) console.log(name.padEnd(15) + ids.map((id) => (((rare.get(id) ?? 0) / RUNS) * 100).toFixed(1).padStart(13)).join(''));
}
