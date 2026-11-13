// The state of one dungeon run (brief section 10), plain data. A run is advanced only by
// step.ts step(run, inputs, dtMs, rng). Positions are world px (x right, y down); the map is made
// of DUNGEON_BLOCK px blocks.

import { DUNGEON_ROUND, DUNGEON_ROUNDS, PLAYER_BASE_ATTACK_MAX, PLAYER_BASE_ATTACK_MIN, type EnemyKind } from '../config.ts';
import { ownedArmor, ownedWeapon } from '../gear.ts';
import { attackBonusAt, levelForXp, maxHpAt } from '../levels.ts';
import type { GearId, MaterialId, Point } from '../types.ts';
import { generateFloor } from './generate.ts';

export type DungeonBlock = 'floor' | 'wall';
export type DungeonRoundId = 1 | 2;

/** A rectangle in blocks. */
export interface BlockRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One floor's layout. Never changed after it is generated. */
export interface DungeonMap {
  seed: number;
  /** 1-based floor number. */
  n: number;
  round: DungeonRoundId;
  /** Size in blocks. */
  cols: number;
  rows: number;
  /** Row-major, cols * rows. */
  blocks: DungeonBlock[];
  /** The rooms, in blocks; rooms[0] is the spawn room. */
  rooms: BlockRect[];
  /** Where the player starts, world px (the middle of a block in the spawn room). */
  spawn: Point;
  /** The exit block, in block coordinates. */
  exit: { c: number; r: number };
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  /** A woken mimic: fights as a skeleton, gives MIMIC_XP and a golden chest's loot. */
  mimic: boolean;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** ms left in the attack wind-up (it flashes); 0 = not winding up. */
  windupMs: number;
  /** ms until it may start a new attack. */
  cooldownMs: number;
  /** Waypoints when chasing without line of sight. */
  path: Point[];
  /** ms until that path is found again. */
  repathMs: number;
}

export type ChestKind = 'wooden' | 'golden';

export interface Chest {
  id: number;
  kind: ChestKind;
  /** Looks like a wooden chest; turns into a skeleton when walked onto. */
  mimic: boolean;
  opened: boolean;
  x: number;
  y: number;
}

/** One slot of the run bag: a stack of one material (up to MATERIAL_STACK_MAX) or one furniture item. */
export type BagItem = { kind: 'material'; id: MaterialId; qty: number } | { kind: 'furniture'; typeId: string };

export interface RunBag {
  /** At most RUN_BAG_SLOTS (the banked bag has no limit). */
  slots: BagItem[];
  /** Gold takes no slot. */
  gold: number;
}

export interface RunPlayer {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  /** Total xp (the player's xp plus what this run gave so far). */
  xp: number;
  attackMin: number;
  attackMax: number;
  /** Armor: each enemy hit does this much less damage, but at least minDamage. */
  damageReduction: number;
  minDamage: number;
  /** Walk waypoints (world px), the next one first. */
  path: Point[];
  /** The enemy the player walks to and hits, or null. */
  targetEnemyId: number | null;
  /** One accepted click on the target that lands when the player gets there. */
  pendingHit: boolean;
  /** Run time (ms) from which the next hit is allowed. */
  attackReadyAt: number;
  /** Run time (ms) from which the next potion is allowed. */
  potionReadyAt: number;
  potions: number;
  /** False while still standing on the exit after choosing 'stay'. */
  exitArmed: boolean;
}

/** 'exit_choice' pauses the run until choose_exit; 'dead' and 'left' end it. */
export type RunStatus = 'active' | 'exit_choice' | 'dead' | 'left';

export type RunEvent =
  | { t: 'hit'; enemyId: number; damage: number }
  | { t: 'windup'; enemyId: number }
  | { t: 'enemy_hit'; enemyId: number; damage: number }
  | { t: 'enemy_miss'; enemyId: number }
  | { t: 'kill'; enemyId: number; kind: EnemyKind; xp: number }
  | { t: 'level_up'; level: number }
  | { t: 'loot'; item: string; qty: number }
  | { t: 'left_behind'; item: BagItem }
  | { t: 'chest'; chestId: number }
  | { t: 'mimic'; enemyId: number }
  | { t: 'potion'; healed: number }
  | { t: 'exit' }
  | { t: 'stairs'; floor: number; healed: number }
  | { t: 'boss_banked' }
  | { t: 'died' }
  | { t: 'left' };

export interface DungeonRun {
  seed: number;
  round: DungeonRoundId;
  /** 1-based floor number. */
  floor: number;
  maxFloors: number;
  map: DungeonMap;
  player: RunPlayer;
  enemies: Enemy[];
  chests: Chest[];
  /** At risk until banked. */
  bag: RunBag;
  /** Safe: banked by leaving or by killing the boss (no slot limit). */
  banked: RunBag;
  /** Gold and items lost (death) or left behind (full bag). Kept for the run summary. */
  lost: RunBag;
  xpGained: number;
  bossDefeated: boolean;
  status: RunStatus;
  /** Run time in ms (whole ticks). */
  timeMs: number;
  /** ms of a tick not yet run (less than DUNGEON_TICK_MS). */
  carryMs: number;
  /** What happened during the last step (for drawing and sounds). */
  events: RunEvent[];
}

export type ExitChoice = 'deeper' | 'leave' | 'stay';

export type DungeonInput =
  | { t: 'click_point'; x: number; y: number }
  | { t: 'click_enemy'; id: number }
  | { t: 'drink_potion' }
  | { t: 'choose_exit'; choice: ExitChoice };

/** Combat numbers from the level and the gear (section 10). */
export function combatStats(level: number, gear: readonly GearId[]) {
  const weapon = ownedWeapon(gear);
  const armor = ownedArmor(gear);
  const bonus = attackBonusAt(level);
  return {
    maxHp: maxHpAt(level),
    attackMin: (weapon?.attackMin ?? PLAYER_BASE_ATTACK_MIN) + bonus,
    attackMax: (weapon?.attackMax ?? PLAYER_BASE_ATTACK_MAX) + bonus,
    damageReduction: armor?.damageReduction ?? 0,
    minDamage: armor?.minDamage ?? 1,
  };
}

export interface NewRunOptions {
  seed: number;
  round?: DungeonRoundId;
  xp: number;
  gear: readonly GearId[];
  potions: number;
}

export function emptyRunBag(): RunBag {
  return { slots: [], gold: 0 };
}

/** A new run on floor 1 at full hp. (bank.ts startRun also pays the key.) */
export function newRun(o: NewRunOptions): DungeonRun {
  const round = o.round ?? DUNGEON_ROUND;
  const plan = generateFloor(o.seed, 1, round);
  const level = levelForXp(o.xp);
  const s = combatStats(level, o.gear);
  return {
    seed: o.seed,
    round,
    floor: 1,
    maxFloors: DUNGEON_ROUNDS[round].maxFloors,
    map: plan.map,
    player: {
      x: plan.map.spawn.x,
      y: plan.map.spawn.y,
      hp: s.maxHp,
      level,
      xp: o.xp,
      ...s,
      path: [],
      targetEnemyId: null,
      pendingHit: false,
      attackReadyAt: 0,
      potionReadyAt: 0,
      potions: o.potions,
      exitArmed: true,
    },
    enemies: plan.enemies,
    chests: plan.chests,
    bag: emptyRunBag(),
    banked: emptyRunBag(),
    lost: emptyRunBag(),
    xpGained: 0,
    bossDefeated: false,
    status: 'active',
    timeMs: 0,
    carryMs: 0,
    events: [],
  };
}
