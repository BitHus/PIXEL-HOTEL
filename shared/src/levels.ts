// XP and levels (brief section 10). Thresholds are data in shared/data/levels.json: totalXp[i] is
// the total xp needed for level i + 1. Xp counts the moment an enemy dies and is never taken
// away, so a failed run still levels the player.

import levelData from '../data/levels.json';
import { ATTACK_PER_EVEN_LEVEL, HP_PER_LEVEL, PLAYER_BASE_HP } from './config.ts';

export const MAX_LEVEL: number = levelData.maxLevel;
export const LEVEL_TOTAL_XP: readonly number[] = levelData.totalXp;

/** The level for a total amount of xp (1 to MAX_LEVEL). */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 2; l <= MAX_LEVEL; l++) if (xp >= (LEVEL_TOTAL_XP[l - 1] ?? Infinity)) level = l;
  return level;
}

/** Adds xp; returns the player with the new xp and level (the level never goes above MAX_LEVEL). */
export function addXp<P extends { xp: number; level: number }>(player: P, amount: number): P {
  const xp = player.xp + Math.max(0, Math.floor(amount));
  return { ...player, xp, level: Math.max(player.level, levelForXp(xp)) };
}

/** Total xp needed for the next level, or null at the top level. */
export function xpForNextLevel(level: number): number | null {
  return level >= MAX_LEVEL ? null : (LEVEL_TOTAL_XP[level] ?? null);
}

/** Max hp at a level: +HP_PER_LEVEL for every level after 1. */
export function maxHpAt(level: number): number {
  return PLAYER_BASE_HP + HP_PER_LEVEL * (level - 1);
}

/** Attack bonus at a level: +1 on every even level (added to both ends of the damage range). */
export function attackBonusAt(level: number): number {
  return ATTACK_PER_EVEN_LEVEL * Math.floor(level / 2);
}
