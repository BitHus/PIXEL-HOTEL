// Dungeon events -> effects (outdoors rework C11/C12). PURE: an event plus a small context in, a list of effect specs out; no Pixi, no clock, no
// randomness (the renderer rolls the particle directions). The dungeon screen turns each spec into a view change, a particle burst, a sound or a
// float text. Look and feel only: nothing here changes the run.

import {
  ENEMY_CHASE_RANGE,
  ENEMY_WINDUP_MS,
  FX_BURST_COUNT,
  FX_DEATH_FADE_MS,
  FX_HIT_STOP_MS,
  FX_HURT_EDGE_MS,
  FX_KNOCKBACK_PX,
  FX_LOW_HP_FRACTION,
  FX_SPARK_COUNT,
  HIT_SHAKE_PX,
  HURT_SHAKE_PX,
  SCREEN_SHAKE_MS,
  type EnemyKind,
  type Point,
  type Rank,
  type RunEvent,
} from '@pixel-hotel/shared';

export type BitKind = 'goo' | 'bone' | 'feather' | 'debris' | 'dust';
export type FxSound = 'hit' | 'hurt' | 'kill' | 'chestOpen' | 'windup' | 'levelUp' | 'stairs' | 'found';
/** The look of a float text: 'big' is the CRIT style (a hit at the top of the attack range). */
export type FloatStyle = 'damage' | 'big' | 'hurt' | 'info';

export type FxSpec =
  | { t: 'hitStop'; ms: number }
  | { t: 'shake'; px: number; ms: number }
  | { t: 'squash'; enemyId: number }
  | { t: 'knockback'; enemyId: number; dx: number; dy: number; px: number }
  | { t: 'sparks'; at: Point; count: number }
  /** at null = above the player's head. */
  | { t: 'floatText'; at: Point | null; text: string; style: FloatStyle }
  | { t: 'burst'; at: Point; bits: BitKind; count: number }
  | { t: 'fadeOut'; enemyId: number; ms: number }
  | { t: 'chestOpen'; chestId: number }
  | { t: 'lootPop'; rank: Rank }
  | { t: 'telegraph'; enemyId: number; ms: number }
  | { t: 'edgePulse'; ms: number }
  | { t: 'sound'; name: FxSound; rank?: Rank };

/** What fxSpec needs to know about the world (the client fills it from the run; positions are the feet). */
export interface FxContext {
  /** True = the "Reduce effects" pref: only float texts and sounds are kept. */
  reduce: boolean;
  player: Point;
  attackMin: number;
  attackMax: number;
  enemy(id: number): { kind: EnemyKind; mimic: boolean; x: number; y: number } | null;
  rock(id: number): { x: number; y: number } | null;
}

/** A hit counts as big when it is at the top of the attack range (and the range is not a single number). */
export function isBigHit(damage: number, attackMin: number, attackMax: number): boolean {
  return attackMax > attackMin && damage >= attackMax;
}

/** The bits that fly when this enemy dies: goo, bones, feathers; a mimic breaks like wood. */
export function killBits(kind: EnemyKind, mimic: boolean): BitKind {
  if (mimic) return 'debris';
  return kind === 'slime' ? 'goo' : kind === 'bat' ? 'feather' : 'bone';
}

/** True the moment an enemy starts to chase: it was outside the chase range and is inside now. */
export function aggroStarted(prevDist: number | null, dist: number, range: number = ENEMY_CHASE_RANGE): boolean {
  return prevDist !== null && prevDist > range && dist <= range;
}

/** The low-hp warning (heartbeat vignette): under FX_LOW_HP_FRACTION of max hp and still alive. */
export function isLowHp(hp: number, maxHp: number): boolean {
  return hp > 0 && maxHp > 0 && hp / maxHp < FX_LOW_HP_FRACTION;
}

/** A unit vector from a to b (0,0 when they are on the same spot). */
export function directionTo(a: Point, b: Point): { dx: number; dy: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  return d < 0.001 ? { dx: 0, dy: 0 } : { dx: dx / d, dy: dy / d };
}

const above = (p: Point, px: number): Point => ({ x: p.x, y: p.y - px });

/** The effects of one run event, in the order they should start. With ctx.reduce only float texts and sounds stay. */
export function fxSpec(e: RunEvent, ctx: FxContext): FxSpec[] {
  const out: FxSpec[] = [];
  switch (e.t) {
    case 'hit': {
      const en = ctx.enemy(e.enemyId);
      const big = isBigHit(e.damage, ctx.attackMin, ctx.attackMax);
      out.push({ t: 'floatText', at: en ? above(en, 28) : null, text: `-${e.damage}`, style: big ? 'big' : 'damage' });
      out.push({ t: 'hitStop', ms: FX_HIT_STOP_MS });
      out.push({ t: 'shake', px: HIT_SHAKE_PX, ms: SCREEN_SHAKE_MS });
      if (en) {
        const d = directionTo(ctx.player, en);
        out.push({ t: 'squash', enemyId: e.enemyId });
        out.push({ t: 'knockback', enemyId: e.enemyId, dx: d.dx, dy: d.dy, px: FX_KNOCKBACK_PX + (big ? 1 : 0) });
        out.push({ t: 'sparks', at: above(en, 14), count: FX_SPARK_COUNT + (big ? 2 : 0) });
      }
      out.push({ t: 'sound', name: 'hit' });
      break;
    }
    case 'enemy_hit':
      out.push({ t: 'floatText', at: null, text: `-${e.damage}`, style: 'hurt' });
      out.push({ t: 'hitStop', ms: FX_HIT_STOP_MS });
      out.push({ t: 'shake', px: HURT_SHAKE_PX, ms: SCREEN_SHAKE_MS });
      out.push({ t: 'edgePulse', ms: FX_HURT_EDGE_MS });
      out.push({ t: 'sound', name: 'hurt' });
      break;
    case 'enemy_miss':
      out.push({ t: 'floatText', at: null, text: 'dodged!', style: 'info' });
      break;
    case 'windup':
      out.push({ t: 'telegraph', enemyId: e.enemyId, ms: ENEMY_WINDUP_MS });
      out.push({ t: 'sound', name: 'windup' });
      break;
    case 'kill': {
      const en = ctx.enemy(e.enemyId);
      if (en) out.push({ t: 'burst', at: above(en, 14), bits: killBits(e.kind, e.mimic), count: FX_BURST_COUNT });
      out.push({ t: 'fadeOut', enemyId: e.enemyId, ms: FX_DEATH_FADE_MS });
      out.push({ t: 'sound', name: 'kill' });
      break;
    }
    case 'chest':
      out.push({ t: 'chestOpen', chestId: e.chestId });
      out.push({ t: 'sound', name: 'chestOpen' });
      break;
    case 'loot':
      out.push({ t: 'lootPop', rank: e.rank ?? 'common' });
      // Gold has its own coin sound; a thing found plays the rank-pitched ping.
      if (e.item !== 'gold') out.push({ t: 'sound', name: 'found', rank: e.rank ?? 'common' });
      break;
    case 'mimic': {
      const en = ctx.enemy(e.enemyId);
      out.push({ t: 'floatText', at: en ? above(en, 30) : null, text: 'A mimic!', style: 'hurt' });
      out.push({ t: 'shake', px: HIT_SHAKE_PX + 1, ms: SCREEN_SHAKE_MS });
      break;
    }
    case 'level_up':
      out.push({ t: 'sound', name: 'levelUp' });
      break;
    case 'stairs':
      out.push({ t: 'sound', name: 'stairs' });
      break;
    case 'swing': {
      const r = ctx.rock(e.rockId);
      if (r) out.push({ t: 'burst', at: above(r, 12), bits: 'debris', count: 3 });
      out.push({ t: 'shake', px: HIT_SHAKE_PX / 2, ms: SCREEN_SHAKE_MS });
      out.push({ t: 'sound', name: 'hit' });
      break;
    }
    case 'rock_broken': {
      const r = ctx.rock(e.rockId);
      if (r) out.push({ t: 'burst', at: above(r, 12), bits: 'debris', count: FX_BURST_COUNT + 3 });
      out.push({ t: 'shake', px: HIT_SHAKE_PX, ms: SCREEN_SHAKE_MS });
      out.push({ t: 'sound', name: 'kill' });
      break;
    }
    case 'died':
      out.push({ t: 'edgePulse', ms: FX_HURT_EDGE_MS * 2 });
      break;
    default:
      break;
  }
  return ctx.reduce ? out.filter((s) => s.t === 'floatText' || s.t === 'sound') : out;
}
