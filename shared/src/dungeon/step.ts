// The real-time dungeon (brief section 10): step(run, inputs, dtMs, rng) applies the inputs, then
// runs fixed DUNGEON_TICK_MS ticks (the rest of dtMs waits in run.carryMs). Pure and deterministic:
// no Date.now and no Math.random; the same run, inputs, dtMs and rng give the same result.
//
// - click_point: walk there (nav grid path). click_enemy: walk next to it; the click is one hit if
//   the attack cooldown is ready at the moment of the click (otherwise the click is ignored); the
//   hit lands at once when in reach, else when the player gets there. No auto-attack.
// - Input times are exact (run.timeMs + run.carryMs), so the 350 ms cooldown is not rounded to
//   ticks. drink_potion heals at once (1 s between potions). choose_exit answers the exit choice.
// - Enemies chase within ENEMY_CHASE_RANGE (straight when they see the player, else a nav path),
//   start a ENEMY_WINDUP_MS wind-up within ATTACK_REACH, and miss if the player is farther than
//   ENEMY_MISS_RANGE when it ends; then they wait their attack cooldown. Bats make half of their
//   moves in a random direction.
// - Walking onto the exit pauses the run (status 'exit_choice') until choose_exit.
// - The mine (step 9c, run.place 'mine'): click_rock walks next to a rock and swings (one swing per
//   tap, PICKAXE_COOLDOWN_MS apart, like hits); a broken rock drops ore (and maybe a gem) into the
//   bag. 'leave' walks out at once with everything; so does the lantern running out. At 0 hp the
//   player is carried out and loses half of each ore (rounded down), nothing else. Enemies there give
//   xp but no rare drops.

import {
  ATTACK_REACH,
  CHEST_OPEN_REACH,
  DEATH_GOLD_LOSS,
  DUNGEON_TICK_MS,
  ENEMIES,
  ENEMY_CHASE_RANGE,
  ENEMY_MISS_RANGE,
  ENEMY_REPATH_MS,
  ENEMY_STOP_PX,
  ENEMY_WINDUP_MS,
  MIMIC_WAKE_MS,
  MIMIC_XP,
  PLAYER_ATTACK_REACH,
  PLAYER_DUNGEON_SPEED,
  GEM_CHANCE,
  GLOWCAP_SPORE_CHANCE,
  MINE_DEATH_ORE_LOSS,
  MINE_REACH,
  PICKAXE_COOLDOWN_MS,
  ROCK_ORE_MAX,
  ROCK_ORE_MIN,
  RARE_DROP_CHANCE,
  STAIRS_HEAL,
} from '../config.ts';
import { POTION } from '../gear.ts';
import { getFoodType } from '../materials.ts';
import { attackBonusAt, levelForXp, maxHpAt } from '../levels.ts';
import { findPath, lineOfSight, type NavGrid } from '../nav.ts';
import { rngInt } from '../rng.ts';
import type { Rank, FoodId, Point, Rng } from '../types.ts';
import { generateFloor, makeEnemy } from './generate.ts';
import { blockAt, dungeonNavGrid, onFloor } from './grid.ts';
import { getLootTable, rollLoot, type EnemyTableId, type Loot } from './loot.ts';
import { emptyRunBag, type DungeonInput, type DungeonRun, type Enemy, type ExitChoice, type FoodBuff, type Rock, type RunBag, type RunPlayer } from './run.ts';
import { addToBag, bagLoot } from './runBag.ts';

const TICK = DUNGEON_TICK_MS;
/** A mimic's enemy id: this plus the chest id. */
export const MIMIC_ID_BASE = 1000;

/** The enemy's type for drops and the Book: its kind, or 'mimic'. */
export function enemyTypeOf(e: Pick<Enemy, 'kind' | 'mimic'>): EnemyTableId {
  return e.mimic ? 'mimic' : e.kind;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Copies everything step changes (the map is never changed and is shared). */
function cloneRun(run: DungeonRun): DungeonRun {
  return {
    ...run,
    player: { ...run.player, food: [...run.player.food], buffs: [...run.player.buffs] },
    enemies: run.enemies.map((e) => ({ ...e })),
    chests: run.chests.map((c) => ({ ...c })),
    rocks: run.rocks.map((x) => ({ ...x })),
    bag: { ...run.bag },
    banked: { ...run.banked },
    lost: { ...run.lost },
    kills: { ...run.kills },
    met: [...run.met],
    events: [],
  };
}

export function step(run: DungeonRun, inputs: readonly DungeonInput[], dtMs: number, rng: Rng): DungeonRun {
  const r = cloneRun(run);
  for (const input of inputs) applyInput(r, input, rng);
  if (r.status !== 'active') {
    r.carryMs = 0;
    return r;
  }
  let left = r.carryMs + Math.max(0, dtMs);
  while (left >= TICK && r.status === 'active') {
    tick(r, rng);
    left -= TICK;
  }
  r.carryMs = r.status === 'active' ? left : 0;
  return r;
}

/** True while the run waits for the exit choice. */
export function isPaused(run: DungeonRun): boolean {
  return run.status === 'exit_choice';
}

/** The choices at the exit: deeper only when there is a deeper floor. */
export function exitChoices(run: DungeonRun): ExitChoice[] {
  return run.floor < run.maxFloors ? ['deeper', 'leave', 'stay'] : ['leave', 'stay'];
}

function applyInput(r: DungeonRun, input: DungeonInput, rng: Rng): void {
  const p = r.player;
  const now = r.timeMs + r.carryMs;
  if (input.t === 'choose_exit') {
    if (r.status !== 'exit_choice') return;
    if (input.choice === 'leave') leave(r);
    else if (input.choice === 'deeper' && r.floor < r.maxFloors) deeper(r);
    else if (input.choice === 'stay') {
      r.status = 'active';
      p.exitArmed = false;
    }
    return;
  }
  if (r.status !== 'active') return;
  const grid = dungeonNavGrid(r.map);
  if (input.t === 'leave') {
    if (r.place === 'mine') leave(r);
  } else if (input.t === 'click_point') {
    const path = findPath(grid, p, { x: input.x, y: input.y });
    if (!path) return;
    p.path = path.slice(1);
    p.targetEnemyId = null;
    p.pendingHit = false;
    p.targetRockId = null;
    p.pendingSwing = false;
  } else if (input.t === 'click_rock') {
    const rock = r.rocks.find((x) => x.id === input.id);
    if (!rock) return;
    p.targetRockId = rock.id;
    p.targetEnemyId = null;
    p.pendingHit = false;
    p.path = [];
    if (now < p.pickReadyAt) {
      p.pendingSwing = false; // a tap during the cooldown is ignored (it only keeps walking there)
      return;
    }
    if (distance(p, rock) <= MINE_REACH) swing(r, rock, now, rng);
    else p.pendingSwing = true;
  } else if (input.t === 'click_enemy') {
    const e = r.enemies.find((x) => x.id === input.id);
    if (!e) return;
    p.targetEnemyId = e.id;
    p.targetRockId = null;
    p.pendingSwing = false;
    p.path = [];
    if (now < p.attackReadyAt) {
      p.pendingHit = false; // a click during the cooldown is ignored (it only keeps walking there)
      return;
    }
    if (distance(p, e) <= PLAYER_ATTACK_REACH) hit(r, e, now, rng);
    else p.pendingHit = true;
  } else if (input.t === 'drink_potion') {
    if (p.potions <= 0 || now < p.potionReadyAt || p.hp >= p.maxHp) return;
    const healed = Math.min(POTION.heal, p.maxHp - p.hp);
    p.hp += healed;
    p.potions -= 1;
    p.potionReadyAt = now + POTION.cooldownMs;
    r.events.push({ t: 'potion', healed });
  } else if (input.t === 'eat') {
    eat(r, now);
  }
}

/** What eating this food now would do: heal (when hurt and the potion cooldown is ready), or a buff
 *  not taken yet on this run. Null = it would do nothing now. */
function foodUse(p: RunPlayer, id: FoodId, now: number): { heal: number; buff: FoodBuff | null } | null {
  const e = getFoodType(id).effect;
  if (e.kind === 'heal') return p.hp < p.maxHp && now >= p.potionReadyAt ? { heal: Math.min(e.amount, p.maxHp - p.hp), buff: null } : null;
  return p.buffs.includes(e.kind) ? null : { heal: 0, buff: e.kind };
}

/**
 * Eats the first food in the lunch box that does something now (section 10b): healing food heals
 * and shares the potions' cooldown; each buff kind works once per run. A food that would do
 * nothing stays in the box.
 */
function eat(r: DungeonRun, now: number): void {
  const p = r.player;
  const k = p.food.findIndex((id) => foodUse(p, id, now) !== null);
  const id = p.food[k];
  if (id === undefined) return;
  const use = foodUse(p, id, now)!;
  p.food.splice(k, 1);
  if (use.heal > 0) {
    p.hp += use.heal;
    p.potionReadyAt = now + POTION.cooldownMs;
  }
  if (use.buff) {
    const e = getFoodType(id).effect;
    p.buffs.push(use.buff);
    if (e.kind === 'attack') {
      p.attackMin += e.amount;
      p.attackMax += e.amount;
    } else if (e.kind === 'max_hp') {
      p.maxHp += e.amount;
      p.hp += e.amount;
    } else if (e.kind === 'attack_cooldown') {
      p.attackCooldownMs = Math.min(p.attackCooldownMs, e.amount);
    }
  }
  r.events.push({ t: 'eat', food: id, healed: use.heal, buff: use.buff });
}

function hit(r: DungeonRun, e: Enemy, now: number, rng: Rng): void {
  const p = r.player;
  const damage = rngInt(rng, p.attackMin, p.attackMax);
  e.hp -= damage;
  p.attackReadyAt = now + p.attackCooldownMs;
  p.pendingHit = false;
  r.events.push({ t: 'hit', enemyId: e.id, damage });
  if (e.hp <= 0) kill(r, e, rng);
}

/** One pickaxe swing at a rock (step 9c). Mithril needs the steel pickaxe. */
function swing(r: DungeonRun, rock: Rock, now: number, rng: Rng): void {
  const p = r.player;
  p.pickReadyAt = now + PICKAXE_COOLDOWN_MS;
  p.pendingSwing = false;
  if (rock.kind === 'mithril' && !p.minesMithril) {
    r.events.push({ t: 'too_hard', rockId: rock.id });
    return;
  }
  const hits = Math.min(rock.hitsLeft, p.hitsPerSwing);
  rock.hitsLeft -= hits;
  r.events.push({ t: 'swing', rockId: rock.id, hits });
  if (rock.hitsLeft > 0) return;
  r.rocks = r.rocks.filter((x) => x.id !== rock.id);
  p.targetRockId = null;
  r.events.push({ t: 'rock_broken', rockId: rock.id });
  const loot: Loot[] = [{ item: `${rock.kind}_ore`, qty: rngInt(rng, ROCK_ORE_MIN, ROCK_ORE_MAX) }];
  if (rng() < GEM_CHANCE) loot.push({ item: 'gem', qty: 1 });
  addLoot(r, loot);
}

function addLoot(r: DungeonRun, loot: readonly (Loot & { rank?: Rank })[]): void {
  const added = addToBag(r.bag, loot);
  r.bag = added.bag;
  for (const l of loot) r.events.push({ t: 'loot', item: l.item, qty: l.qty, ...(l.rank && l.rank !== 'common' ? { rank: l.rank } : {}) });
  if (added.leftBehind.length > 0) {
    r.lost = addToBag(r.lost, bagLoot({ slots: added.leftBehind, gold: 0 }), Infinity).bag;
    for (const item of added.leftBehind) r.events.push({ t: 'left_behind', item });
  }
}

/** Moves the bag into the banked bag (leaving, or killing the boss). */
function bankBag(r: DungeonRun): void {
  r.banked = { ...addToBag(r.banked, bagLoot(r.bag), Infinity).bag, gold: r.banked.gold + r.bag.gold };
  r.bag = emptyRunBag();
}

function kill(r: DungeonRun, e: Enemy, rng: Rng): void {
  const p = r.player;
  r.enemies = r.enemies.filter((x) => x.id !== e.id);
  if (p.targetEnemyId === e.id) {
    p.targetEnemyId = null;
    p.pendingHit = false;
  }
  const xp = e.mimic ? MIMIC_XP : ENEMIES[e.kind].xp;
  r.xpGained += xp;
  p.xp += xp;
  r.events.push({ t: 'kill', enemyId: e.id, kind: e.kind, xp, mimic: e.mimic === true });
  // The Book: a kill counts for the enemy's type (a mimic is its own type).
  const type = enemyTypeOf(e);
  r.kills[type] = (r.kills[type] ?? 0) + 1;
  if (!r.met.includes(type)) r.met.push(type);
  const level = levelForXp(p.xp);
  if (level > p.level) {
    // Level up: new stats and a full heal.
    const bonus = attackBonusAt(level) - attackBonusAt(p.level);
    // The new level's hp on top of what food added (pumpkin pie).
    p.maxHp += maxHpAt(level) - maxHpAt(p.level);
    p.level = level;
    p.hp = p.maxHp;
    p.attackMin += bonus;
    p.attackMax += bonus;
    r.events.push({ t: 'level_up', level });
  }
  if (e.mimic) addLoot(r, rollLoot(getLootTable('golden_chest'), rng));
  if (e.kind === 'bone_king') addLoot(r, rollLoot(getLootTable('boss'), rng));
  // The enemy's own drop table (step 9e): RARE_DROP_CHANCE per kill, and the table decides the
  // rank. The Bone King always drops. No such drops in the mine (step 9c): only ore and gems.
  if (r.place === 'crypt' && (e.kind === 'bone_king' || rng() < RARE_DROP_CHANCE)) addLoot(r, rollLoot(getLootTable(type), rng));
  if (e.kind === 'bone_king') {
    r.bossDefeated = true;
    bankBag(r);
    r.events.push({ t: 'boss_banked' });
  }
}

function leave(r: DungeonRun): void {
  bankBag(r);
  r.status = 'left';
  r.events.push({ t: 'left' });
}

function die(r: DungeonRun): void {
  if (r.place === 'mine') {
    carriedOut(r);
    return;
  }
  const kept = Math.floor(r.bag.gold * (1 - DEATH_GOLD_LOSS));
  const lostBag: RunBag = { slots: r.bag.slots, gold: r.bag.gold - kept };
  r.lost = { ...addToBag(r.lost, bagLoot(lostBag), Infinity).bag, gold: r.lost.gold + lostBag.gold };
  r.banked = { ...r.banked, gold: r.banked.gold + kept };
  r.bag = emptyRunBag();
  // The lunch box is lost too (step 9b).
  const food = r.player.food.map((id) => ({ item: id, qty: 1 }));
  if (food.length > 0) r.lost = addToBag(r.lost, food, Infinity).bag;
  r.player.food = [];
  r.player.hp = 0;
  r.status = 'dead';
  r.events.push({ t: 'died' });
}

/**
 * 0 hp in the mine (section 10c): the player is carried out with everything but half of each ore of
 * this visit (rounded down). Gems, potions and xp stay.
 */
function carriedOut(r: DungeonRun): void {
  const totals = new Map<string, number>();
  for (const l of bagLoot(r.bag)) totals.set(l.item, (totals.get(l.item) ?? 0) + l.qty);
  const kept: Loot[] = [];
  const lost: Loot[] = [];
  for (const [item, qty] of totals) {
    const gone = item.endsWith('_ore') ? Math.floor(qty * MINE_DEATH_ORE_LOSS) : 0;
    if (qty - gone > 0) kept.push({ item, qty: qty - gone });
    if (gone > 0) lost.push({ item, qty: gone });
  }
  r.banked = { ...addToBag(r.banked, kept, Infinity).bag, gold: r.banked.gold + r.bag.gold };
  r.lost = addToBag(r.lost, lost, Infinity).bag;
  r.bag = emptyRunBag();
  r.player.hp = 0;
  r.status = 'dead';
  r.events.push({ t: 'died' });
}

function deeper(r: DungeonRun): void {
  const plan = generateFloor(r.seed, r.floor + 1, r.round);
  const p = r.player;
  r.floor += 1;
  r.map = plan.map;
  r.enemies = plan.enemies;
  r.chests = plan.chests;
  const healed = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * STAIRS_HEAL));
  p.hp += healed;
  p.x = plan.map.spawn.x;
  p.y = plan.map.spawn.y;
  p.path = [];
  p.targetEnemyId = null;
  p.pendingHit = false;
  p.exitArmed = true;
  r.status = 'active';
  r.events.push({ t: 'stairs', floor: r.floor, healed });
}

/** Moves a point along waypoints by up to `dist` px; returns the rest of the path. */
function walk(pos: Point, path: Point[], dist: number): Point[] {
  let left = dist;
  let i = 0;
  while (i < path.length && left > 0) {
    const wp = path[i]!;
    const d = distance(pos, wp);
    if (d <= left) {
      pos.x = wp.x;
      pos.y = wp.y;
      left -= d;
      i++;
    } else {
      pos.x += ((wp.x - pos.x) / d) * left;
      pos.y += ((wp.y - pos.y) / d) * left;
      left = 0;
    }
  }
  return path.slice(i);
}

function tick(r: DungeonRun, rng: Rng): void {
  r.timeMs += TICK;
  const now = r.timeMs;
  const p = r.player;
  const grid = dungeonNavGrid(r.map);

  // The mine's lantern: when it goes out the player walks out with everything.
  if (r.lanternEndsAt !== null && now >= r.lanternEndsAt) {
    r.events.push({ t: 'lantern_out' });
    leave(r);
    return;
  }

  // The mine: walk to the target rock, then a waiting swing.
  const rock = r.rocks.find((x) => x.id === p.targetRockId) ?? null;
  if (rock && distance(p, rock) > MINE_REACH) {
    const end = p.path[p.path.length - 1];
    if (!end || distance(end, rock) > MINE_REACH) p.path = findPath(grid, p, rock)?.slice(1) ?? [];
  }

  // The player: walk (towards the target enemy if there is one), then a pending hit.
  const target = r.enemies.find((e) => e.id === p.targetEnemyId) ?? null;
  if (target && distance(p, target) > PLAYER_ATTACK_REACH) {
    const end = p.path[p.path.length - 1];
    if (!end || distance(end, target) > ENEMY_STOP_PX) p.path = findPath(grid, p, target)?.slice(1) ?? [];
  }
  p.path = walk(p, p.path, (PLAYER_DUNGEON_SPEED * TICK) / 1000);
  if (target && distance(p, target) <= PLAYER_ATTACK_REACH) {
    p.path = [];
    if (p.pendingHit && now >= p.attackReadyAt) hit(r, target, now, rng);
  }
  if (rock && distance(p, rock) <= MINE_REACH) {
    p.path = [];
    if (p.pendingSwing && now >= p.pickReadyAt) swing(r, rock, now, rng);
  }

  // Chests open (or wake as a mimic) when walked onto.
  for (const c of r.chests) {
    if (c.opened || distance(p, c) > CHEST_OPEN_REACH) continue;
    if (c.mimic) {
      r.chests = r.chests.filter((x) => x.id !== c.id);
      // It opens like a chest, then waits MIMIC_WAKE_MS before its first wind-up (fair to dodge).
      // (+ one tick: it already counts down in this tick.)
      const e = { ...makeEnemy(MIMIC_ID_BASE + c.id, 'skeleton', r.floor, c.x, c.y, true), cooldownMs: MIMIC_WAKE_MS + TICK };
      r.enemies = [...r.enemies, e];
      r.events.push({ t: 'mimic', enemyId: e.id, chestId: c.id });
    } else {
      c.opened = true;
      r.events.push({ t: 'chest', chestId: c.id });
      addLoot(r, rollLoot(getLootTable(c.kind === 'golden' ? 'golden_chest' : 'wooden_chest'), rng));
      // Step 9b: sometimes a glowcap spore for the farm.
      if (rng() < GLOWCAP_SPORE_CHANCE) addLoot(r, [{ item: 'glowcap_spore', qty: 1 }]);
    }
  }

  // The exit pauses the run until the player chooses.
  const b = blockAt(p);
  const onExit = b.c === r.map.exit.c && b.r === r.map.exit.r;
  if (onExit && p.exitArmed) {
    p.path = [];
    p.targetEnemyId = null;
    p.pendingHit = false;
    r.status = 'exit_choice';
    r.events.push({ t: 'exit' });
    return;
  }
  if (!onExit) p.exitArmed = true;

  for (const e of r.enemies) {
    enemyTick(r, e, grid, rng);
    if (p.hp <= 0) {
      die(r);
      return;
    }
  }
}

function enemyTick(r: DungeonRun, e: Enemy, grid: NavGrid, rng: Rng): void {
  const p = r.player;
  const stats = ENEMIES[e.kind];
  const d = distance(e, p);
  if (e.windupMs > 0) {
    e.windupMs = Math.max(0, e.windupMs - TICK);
    if (e.windupMs > 0) return;
    if (d <= ENEMY_MISS_RANGE) {
      const damage = Math.max(p.minDamage, rngInt(rng, stats.hitMin, stats.hitMax) - p.damageReduction);
      p.hp -= damage;
      r.lastHitBy = e.mimic ? 'mimic' : e.kind;
      r.events.push({ t: 'enemy_hit', enemyId: e.id, damage });
    } else {
      r.events.push({ t: 'enemy_miss', enemyId: e.id });
    }
    // Then it waits its attack cooldown (section 10: wind-up, attack, then the cooldown).
    e.cooldownMs = stats.attackEveryMs;
    return;
  }
  e.cooldownMs = Math.max(0, e.cooldownMs - TICK);
  if (d <= ATTACK_REACH && e.cooldownMs === 0) {
    e.windupMs = ENEMY_WINDUP_MS;
    e.path = [];
    r.events.push({ t: 'windup', enemyId: e.id });
    return;
  }
  if (d > ENEMY_CHASE_RANGE) {
    e.path = [];
    return;
  }
  // It noticed the player: this enemy type is met (the Book, step 9e).
  const type = enemyTypeOf(e);
  if (!r.met.includes(type)) r.met.push(type);
  if (d <= ENEMY_STOP_PX) return;
  const move = (stats.speed * TICK) / 1000;
  if (stats.randomMoveChance > 0 && rng() < stats.randomMoveChance) {
    const a = rng() * Math.PI * 2;
    const to = { x: e.x + Math.cos(a) * move, y: e.y + Math.sin(a) * move };
    if (onFloor(r.map, to) && lineOfSight(grid, e, to)) {
      e.x = to.x;
      e.y = to.y;
    }
    return;
  }
  if (lineOfSight(grid, e, p)) {
    e.path = [];
    walk(e, [{ x: p.x, y: p.y }], Math.min(move, d - ENEMY_STOP_PX));
    return;
  }
  e.repathMs -= TICK;
  if (e.path.length === 0 || e.repathMs <= 0) {
    e.path = findPath(grid, e, p)?.slice(1) ?? [];
    e.repathMs = ENEMY_REPATH_MS;
  }
  e.path = walk(e, e.path, move);
}
