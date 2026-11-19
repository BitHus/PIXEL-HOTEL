// The state of one dungeon run (brief section 10), plain data. A run is advanced only by
// step.ts step(run, inputs, dtMs, rng). Positions are world px (x right, y down); the map is made
// of DUNGEON_BLOCK px blocks.
// Step 9c: a mine visit is a DungeonRun too (place 'mine'): the same blocks, step() and ticks, with
// rocks instead of chests, the lantern timer instead of an exit, and pickaxe swings.

import {
  DUNGEON_ROUND,
  DUNGEON_ROUNDS,
  DIG_DEPTH_MAX,
  MINE_LANTERN_MS,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_BASE_ATTACK_MAX,
  PLAYER_BASE_ATTACK_MIN,
  type EnemyKind,
  type RockKind,
} from '../config.ts';
import { ownedArmor, ownedPickaxe, ownedWeapon } from '../gear.ts';
import { attackBonusAt, levelForXp, maxHpAt } from '../levels.ts';
import { attackCooldownOf, maxHpScaled, runBagSlotsOf } from '../skillRules.ts';
import { effective, type Bonuses } from '../stats.ts';
import type { Rank, FoodId, GearId, MaterialId, Point } from '../types.ts';
import { generateFloor, generateMine, type FloorPlan } from './generate.ts';
import { generateDigMine, type DigPlan } from './mineGen.ts';
import type { MineBlockId } from './mineBlocks.ts';

export type DungeonBlock = 'floor' | 'wall';
export type DungeonRoundId = 1 | 2;

/** A rectangle in blocks. */
export interface BlockRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A prop or landmark on a floor block (DG1). kind is a string the client draws; solid ones are also wall blocks. */
export interface DecorProp {
  id: number;
  kind: string;
  c: number;
  r: number;
  solid: boolean;
}

/** A corridor joining two main rooms (indexes into map.rooms); cells are the corridor blocks (DG1). */
export interface MapLink {
  a: number;
  b: number;
  cells: { c: number; r: number }[];
}

/** What a main room is (DG1): its template and theme id. */
export interface RoomInfo {
  template: string;
  theme: string;
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
  // Optional (DG1): runs saved before it have none of these and still load and play.
  /** The corridors between rooms, with the loops (crypt only). */
  links?: MapLink[];
  /** Nooks, secrets and the vault outside the bounding rects (they are floor; the fog must show them). */
  extras?: BlockRect[];
  /** Props and landmarks (decor kinds are strings; the client draws them). */
  decor?: DecorProp[];
  /** OA-9: the blocks that hold a chest (a wall torch never burns above one). Set by generateFloor; old runs have none. */
  chestBlocks?: { c: number; r: number }[];
  /** Template and theme of every main room, same order as rooms. */
  roomInfo?: RoomInfo[];
  /** MG-3: the dig mine's cave (the blocks there are diggable: see DungeonRun.dig). */
  dig?: boolean;
}

/** A cave-in tile of the dig mine: armed (looks cracked-free), cracking (the tell, DIG_CAVEIN_TELL_MS), fallen (done). */
export interface DigHazard {
  c: number;
  r: number;
  kind: 'cavein';
  state: 'armed' | 'cracking' | 'fallen';
  /** ms of the tell left while cracking. */
  crackMs: number;
}

/** The dig mine's changing state (MG-3), plain JSON data (a saved run keeps it). The map's blocks say floor or wall; kinds say what a wall block is. */
export interface DigState {
  /** 1-based depth (the run's floor). */
  depth: number;
  /** Row-major, cols * rows: the kind of a solid block, '' where it is open floor. */
  kinds: (MineBlockId | '')[];
  /** Hits taken so far by blocks being dug (cell index -> hits). */
  hits: Record<number, number>;
  hazards: DigHazard[];
  /** Cell indexes of the rare blocks of this floor (they glint). */
  rare: number[];
  /** Counts every change of kinds, hits or hazards (the view redraws when it moves). */
  rev: number;
  /** Blaster: the swings made this visit (every Nth also breaks the stone and dirt around). */
  swings?: number;
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

/** A rock in the mine (step 9c): broken after hitsLeft more hits; drops ore (and maybe a gem). */
export interface Rock {
  id: number;
  kind: RockKind;
  hitsLeft: number;
  x: number;
  y: number;
}

/** The crypt (the dungeon) or the mine. */
export type RunPlace = 'crypt' | 'mine';

/** One slot of the run bag: a stack of one material (up to MATERIAL_STACK_MAX) or one furniture item. */
export type BagItem = { kind: 'material'; id: MaterialId; qty: number } | { kind: 'furniture'; typeId: string };

export interface RunBag {
  /** At most RUN_BAG_SLOTS (the banked bag has no limit). */
  slots: BagItem[];
  /** Gold takes no slot. */
  gold: number;
  /** Gems (step BG4) take no slot either: collected pickups, kept on Leave, half lost on death (the mine keeps them). */
  gems: number;
}

/** Gems lying on the floor (step BG4), collected by walking within GEM_PICKUP_REACH. Not in the bag until then. */
export interface GemPickup {
  id: number;
  x: number;
  y: number;
  qty: number;
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
  /** The lunch box (step 9b): food brought from the farm, eaten front to back. Lost on death. */
  food: FoodId[];
  /** Buff kinds eaten on this run (each works once per run). */
  buffs: FoodBuff[];
  /** ms between hits (350; glowcap broth makes it 300 for the run). */
  attackCooldownMs: number;
  /** The mine (step 9c): the rock the player walks to and swings at, one accepted tap waiting to
   *  land, and the run time from which the next swing is allowed. */
  targetRockId: number | null;
  pendingSwing: boolean;
  pickReadyAt: number;
  /** MG-3 dig mine: the cell index (row * cols + col) the player walks to and digs, and one accepted tap waiting to land. */
  targetDig?: number | null;
  pendingDig?: boolean;
  /** The pickaxe: hits per swing (basic 1, steel 2) and whether it breaks mithril. */
  hitsPerSwing: number;
  minesMithril: boolean;
  /** MG-7: the skill bonuses of this run (a snapshot from the start; absent = none), the bag's slots, and whether Last stand was spent. */
  skill?: Bonuses;
  bagSlots?: number;
  lastStandUsed?: boolean;
  /** Bone breaker: the hits made this run (every Nth counts double). */
  hitCount?: number;
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
  | { t: 'kill'; enemyId: number; kind: EnemyKind; xp: number; mimic: boolean }
  | { t: 'level_up'; level: number }
  /** rank: only for drops that rolled a rank above common (step 9e: the coloured, sparkling drop text). */
  | { t: 'loot'; item: string; qty: number; rank?: Rank }
  | { t: 'left_behind'; item: BagItem }
  /** Gems dropped on the floor at a point (step BG4), and collected into the bag. */
  | { t: 'gem_drop'; id: number; x: number; y: number; qty: number }
  | { t: 'gem_pickup'; id: number; qty: number }
  | { t: 'chest'; chestId: number }
  | { t: 'mimic'; enemyId: number; chestId: number }
  | { t: 'potion'; healed: number }
  | { t: 'eat'; food: FoodId; healed: number; buff: FoodBuff | null }
  | { t: 'exit' }
  | { t: 'stairs'; floor: number; healed: number }
  | { t: 'boss_banked' }
  | { t: 'swing'; rockId: number; hits: number }
  | { t: 'too_hard'; rockId: number }
  | { t: 'rock_broken'; rockId: number }
  | { t: 'dig'; cell: number; hits: number }
  | { t: 'dig_broken'; cell: number; kind: MineBlockId }
  | { t: 'dig_too_hard'; cell: number }
  | { t: 'cave_crack'; cell: number }
  | { t: 'cave_in'; cell: number; damage: number }
  | { t: 'lantern_out' }
  | { t: 'died' }
  | { t: 'left' };

export interface DungeonRun {
  /** The crypt or (step 9c) the mine. */
  place: RunPlace;
  seed: number;
  round: DungeonRoundId;
  /** 1-based floor number. */
  floor: number;
  maxFloors: number;
  map: DungeonMap;
  player: RunPlayer;
  enemies: Enemy[];
  chests: Chest[];
  /** The mine's rocks (empty in the crypt and in the dig mine). */
  rocks: Rock[];
  /** MG-3: the dig mine's blocks and hazards (set only in a dig mine run; place is then 'mine', floor is the depth). */
  dig?: DigState;
  /** Gems on the floor of this floor (step BG4); gone when the floor is left. */
  pickups: GemPickup[];
  /** The mine: the run time when the lantern goes out (the visit ends). null in the crypt. */
  lanternEndsAt: number | null;
  /** At risk until banked. */
  bag: RunBag;
  /** Safe: banked by leaving or by killing the boss (no slot limit). */
  banked: RunBag;
  /** Gold and items lost (death) or left behind (full bag). Kept for the run summary. */
  lost: RunBag;
  xpGained: number;
  /** The Book (step 9e): kills per enemy type ('slime', 'mimic', ...) and the types met, kept after death like xp. */
  kills: Partial<Record<string, number>>;
  met: string[];
  bossDefeated: boolean;
  /** What dealt the last hit to the player: an enemy kind, or 'mimic' (for the death screen). */
  lastHitBy: string | null;
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
  | { t: 'click_rock'; id: number }
  /** MG-3: dig the block at this cell (walks next to it first). */
  | { t: 'click_dig'; c: number; r: number }
  /** The mine: walk out now with everything (always allowed). */
  | { t: 'leave' }
  /** The crypt (hook b): give up the run now. It counts like a defeat (the bag and half the run gold are lost; the wallet and xp are safe). */
  | { t: 'abandon' }
  | { t: 'drink_potion' }
  | { t: 'eat' }
  | { t: 'choose_exit'; choice: ExitChoice };

/** Combat numbers from the level and the gear (section 10). */
export function combatStats(level: number, gear: readonly GearId[], skill?: Bonuses) {
  const weapon = ownedWeapon(gear);
  const armor = ownedArmor(gear);
  const bonus = attackBonusAt(level);
  return {
    maxHp: maxHpScaled(maxHpAt(level), skill), // flat (Tough) then percent (Guardian / Brawler)
    attackMin: (weapon?.attackMin ?? PLAYER_BASE_ATTACK_MIN) + bonus + (skill?.attackPlus ?? 0),
    attackMax: (weapon?.attackMax ?? PLAYER_BASE_ATTACK_MAX) + bonus + (skill?.attackPlus ?? 0),
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
  /** The lunch box (at most LUNCH_BOX_MAX food items). */
  food?: readonly FoodId[];
  /** MG-7: the bonuses of the bought skills (skillStats), a snapshot for the whole run. */
  skills?: Bonuses;
}

/** A food buff (step 9b): +attack, +max hp, or a shorter attack cooldown, once per run each. */
export type FoodBuff = 'attack' | 'max_hp' | 'attack_cooldown';

export function emptyRunBag(): RunBag {
  return { slots: [], gold: 0, gems: 0 };
}

/** A new run on floor 1 at full hp. (bank.ts startRun also pays the key.) */
export function newRun(o: NewRunOptions): DungeonRun {
  const round = o.round ?? DUNGEON_ROUND;
  return runFrom(o, generateFloor(o.seed, 1, round), round, 'crypt');
}

/** MG-3: a new dig mine visit at depth 1 (no lantern; the exit leads deeper up to DIG_DEPTH_MAX). The old rock mine (newMineRun) stays for its tests. */
export function newDigRun(o: NewRunOptions): DungeonRun {
  const plan = generateDigMine(o.seed, 1);
  const run = runFrom(o, plan, 1, 'mine');
  return { ...run, maxFloors: DIG_DEPTH_MAX, lanternEndsAt: null, dig: plan.dig };
}

/** A new mine visit (step 9c): a fresh small layout from the seed; `visit` is its number (1 = first). */
export function newMineRun(o: NewRunOptions & { visit: number }): DungeonRun {
  return runFrom(o, generateMine(o.seed, o.visit), 1, 'mine');
}

function runFrom(o: NewRunOptions, plan: FloorPlan, round: DungeonRoundId, place: RunPlace): DungeonRun {
  const level = levelForXp(o.xp);
  const s = combatStats(level, o.gear, o.skills);
  const pick = ownedPickaxe(o.gear);
  return {
    place,
    seed: o.seed,
    round,
    floor: 1,
    maxFloors: place === 'mine' ? 1 : DUNGEON_ROUNDS[round].maxFloors,
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
      food: [...(o.food ?? [])],
      buffs: [],
      attackCooldownMs: attackCooldownOf(o.skills), // Quick strike
      targetRockId: null,
      pendingSwing: false,
      pickReadyAt: 0,
      hitsPerSwing: pick?.hitsPerSwing ?? 1,
      minesMithril: pick?.minesMithril ?? false,
      exitArmed: true,
      ...(o.skills ? { skill: o.skills, bagSlots: runBagSlotsOf(place, o.skills) } : {}),
    },
    enemies: plan.enemies,
    chests: plan.chests,
    rocks: plan.rocks,
    pickups: [],
    lanternEndsAt: place === 'mine' ? MINE_LANTERN_MS : null,
    bag: emptyRunBag(),
    banked: emptyRunBag(),
    lost: emptyRunBag(),
    xpGained: 0,
    kills: {},
    met: [],
    bossDefeated: false,
    lastHitBy: null,
    status: 'active',
    timeMs: 0,
    carryMs: 0,
    events: [],
  };
}
