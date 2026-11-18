// MG-1 (docs/PLAN-MINIGAMES.md 4.2, PLAN-UPGRADES 3): the ONE stat helper. Skills (and later minigame gear, MG-6) give BONUSES by stat id; a rule asks
// `effective(base, stat, bonuses)` and never knows where a bonus came from. Pure. Rank 0 / no bonus = the base value, exactly.
//
// Stat ids ending in `Pct` are percentages of the base (base * (1 + bonus / 100)); the others add to the base (base + bonus).

export type StatId =
  // tavern
  | 'roomWalkPct' | 'trayPlus' | 'seatsPlus' | 'pourWindowPlus' | 'batchPlus' | 'tapCapPlus' | 'caskSlotsPlus' | 'bagSlotsPlus'
  // dungeon
  | 'maxHpPlus' | 'runBagPlus' | 'attackPlus' | 'runSpeedPct' | 'potionHealPct' | 'enemyMissMs' | 'chestGlintBlocks' | 'lastStand'
  // fishing
  | 'biteWaitPct' | 'boxSizePct' | 'tensionRisePct' | 'baitSavePct' | 'strikeWindowMs' | 'deepCast' | 'rankOddsPct' | 'keepBaitOnLoss'
  // mining
  | 'digSpeedPct' | 'lightPlus' | 'glintBlocks' | 'hazardDmgPct' | 'doubleStrikePct' | 'mineBagPlus' | 'oreBonusPct' | 'gemChancePts';

/** Bonuses by stat id; a missing id is 0. */
export type Bonuses = Partial<Record<StatId, number>>;

/** The value a rule uses: the base with the stat's bonus applied (percent stats scale the base, the others add). */
export function effective(base: number, stat: StatId, bonuses: Bonuses | undefined): number {
  const b = bonuses?.[stat] ?? 0;
  if (b === 0) return base;
  return stat.endsWith('Pct') ? base * (1 + b / 100) : base + b;
}

/** Adds bonus sets together (skills + gear). */
export function mergeBonuses(...sets: readonly (Bonuses | undefined)[]): Bonuses {
  const out: Record<string, number> = {};
  for (const s of sets) for (const [k, v] of Object.entries(s ?? {})) out[k] = (out[k] ?? 0) + (v ?? 0);
  return out as Bonuses;
}
