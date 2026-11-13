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
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_REACH,
  PLAYER_DUNGEON_SPEED,
  RARE_DROP_CHANCE,
  STAIRS_HEAL,
} from '../config.ts';
import { POTION } from '../gear.ts';
import { attackBonusAt, levelForXp, maxHpAt } from '../levels.ts';
import { findPath, lineOfSight, type NavGrid } from '../nav.ts';
import { rngInt } from '../rng.ts';
import type { Point, Rng } from '../types.ts';
import { generateFloor, makeEnemy } from './generate.ts';
import { blockAt, dungeonNavGrid, onFloor } from './grid.ts';
import { getLootTable, rollLoot, type Loot } from './loot.ts';
import { emptyRunBag, type DungeonInput, type DungeonRun, type Enemy, type ExitChoice, type RunBag } from './run.ts';
import { addToBag, bagLoot } from './runBag.ts';

const TICK = DUNGEON_TICK_MS;
/** A mimic's enemy id: this plus the chest id. */
export const MIMIC_ID_BASE = 1000;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Copies everything step changes (the map is never changed and is shared). */
function cloneRun(run: DungeonRun): DungeonRun {
  return {
    ...run,
    player: { ...run.player },
    enemies: run.enemies.map((e) => ({ ...e })),
    chests: run.chests.map((c) => ({ ...c })),
    bag: { ...run.bag },
    banked: { ...run.banked },
    lost: { ...run.lost },
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
  if (input.t === 'click_point') {
    const path = findPath(grid, p, { x: input.x, y: input.y });
    if (!path) return;
    p.path = path.slice(1);
    p.targetEnemyId = null;
    p.pendingHit = false;
  } else if (input.t === 'click_enemy') {
    const e = r.enemies.find((x) => x.id === input.id);
    if (!e) return;
    p.targetEnemyId = e.id;
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
  }
}

function hit(r: DungeonRun, e: Enemy, now: number, rng: Rng): void {
  const p = r.player;
  const damage = rngInt(rng, p.attackMin, p.attackMax);
  e.hp -= damage;
  p.attackReadyAt = now + PLAYER_ATTACK_COOLDOWN_MS;
  p.pendingHit = false;
  r.events.push({ t: 'hit', enemyId: e.id, damage });
  if (e.hp <= 0) kill(r, e, rng);
}

function addLoot(r: DungeonRun, loot: readonly Loot[]): void {
  const added = addToBag(r.bag, loot);
  r.bag = added.bag;
  for (const l of loot) r.events.push({ t: 'loot', item: l.item, qty: l.qty });
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
  r.events.push({ t: 'kill', enemyId: e.id, kind: e.kind, xp });
  const level = levelForXp(p.xp);
  if (level > p.level) {
    // Level up: new stats and a full heal.
    const bonus = attackBonusAt(level) - attackBonusAt(p.level);
    p.level = level;
    p.maxHp = maxHpAt(level);
    p.hp = p.maxHp;
    p.attackMin += bonus;
    p.attackMax += bonus;
    r.events.push({ t: 'level_up', level });
  }
  if (e.mimic) addLoot(r, rollLoot(getLootTable('golden_chest'), rng));
  if (e.kind === 'bone_king') addLoot(r, rollLoot(getLootTable('boss'), rng));
  if (rng() < RARE_DROP_CHANCE) addLoot(r, rollLoot(getLootTable('enemy_rare'), rng));
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
  const kept = Math.floor(r.bag.gold * (1 - DEATH_GOLD_LOSS));
  const lostBag: RunBag = { slots: r.bag.slots, gold: r.bag.gold - kept };
  r.lost = { ...addToBag(r.lost, bagLoot(lostBag), Infinity).bag, gold: r.lost.gold + lostBag.gold };
  r.banked = { ...r.banked, gold: r.banked.gold + kept };
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
