// MG-1 (docs/PLAN-MINIGAMES.md 4): the skill tree. Pure rules on plain data. A SEPARATE point pool: one point per experience level from SKILL_FIRST_LEVEL plus
// one per Book reward taken (at most SKILL_BOOK_MAX). Unspent points are DERIVED (earned minus spent), never stored, so they cannot desync. Ranks live in
// Player.skills = { ranks, respecs }. Gold only through the ledger (respec). No rule reads the stats yet (MG-7).

import skillData from '../data/skills.json';
import { SKILL_BOOK_MAX, SKILL_FIRST_LEVEL, SKILL_RESPEC_FREE, SKILL_RESPEC_GOLD, SKILL_TIER_STEP } from './config.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import type { Bonuses, StatId } from './stats.ts';
import type { Player } from './types.ts';

export type SkillBranch = 'tavern' | 'dungeon' | 'fishing' | 'mining';
export const SKILL_BRANCHES: readonly SkillBranch[] = ['tavern', 'dungeon', 'fishing', 'mining'];

export interface SkillEffect {
  stat: StatId;
  perRank: number;
  /** The most (or, for a negative perRank, the least) the node's total may give. */
  cap?: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  tier: 1 | 2 | 3 | 4;
  pos: { x: number; y: number };
  name: string;
  icon: string;
  maxRank: number;
  /** Points for rank 1, 2, ... */
  costs: number[];
  requires: string[];
  effects: SkillEffect[];
}

export const SKILL_NODES: readonly SkillNode[] = skillData.nodes as SkillNode[];

export function skillNode(id: string): SkillNode | undefined {
  return SKILL_NODES.find((n) => n.id === id);
}

type SkillsOwner = Pick<Player, 'level' | 'bookRewards' | 'skills'>;

/** Points earned so far: 1 per level from SKILL_FIRST_LEVEL, plus 1 per Book reward taken (at most SKILL_BOOK_MAX). */
export function pointsEarned(level: number, bookRewardsTaken: number): number {
  return Math.max(0, level - SKILL_FIRST_LEVEL + 1) + Math.min(SKILL_BOOK_MAX, Math.max(0, bookRewardsTaken));
}

export function skillRanks(p: Pick<Player, 'skills'>): Record<string, number> {
  return p.skills?.ranks ?? {};
}

/** Points the owned ranks cost. */
export function pointsSpent(p: Pick<Player, 'skills'>): number {
  let sum = 0;
  for (const [id, rank] of Object.entries(skillRanks(p))) {
    const n = skillNode(id);
    if (n) for (let r = 0; r < Math.min(rank, n.maxRank); r++) sum += n.costs[r] ?? 0;
  }
  return sum;
}

/** The points still to spend (never negative). */
export function pointsFree(p: SkillsOwner): number {
  return Math.max(0, pointsEarned(p.level, p.bookRewards.length) - pointsSpent(p));
}

/** Points spent inside one branch. */
export function branchSpent(p: Pick<Player, 'skills'>, branch: SkillBranch): number {
  let sum = 0;
  for (const [id, rank] of Object.entries(skillRanks(p))) {
    const n = skillNode(id);
    if (n?.branch === branch) for (let r = 0; r < Math.min(rank, n.maxRank); r++) sum += n.costs[r] ?? 0;
  }
  return sum;
}

export type SkillProblem = 'unknown' | 'maxed' | 'requires' | 'tier' | 'points';

/** Why a rank of this node cannot be bought now (null = it can). */
export function skillProblem(p: SkillsOwner, id: string): SkillProblem | null {
  const n = skillNode(id);
  if (!n) return 'unknown';
  const ranks = skillRanks(p);
  const rank = ranks[id] ?? 0;
  if (rank >= n.maxRank) return 'maxed';
  if (n.requires.some((r) => (ranks[r] ?? 0) < 1)) return 'requires';
  if (branchSpent(p, n.branch) < (n.tier - 1) * SKILL_TIER_STEP) return 'tier';
  if (pointsFree(p) < (n.costs[rank] ?? Infinity)) return 'points';
  return null;
}

/** The cost of the next rank (null when maxed or unknown). */
export function nextSkillCost(p: Pick<Player, 'skills'>, id: string): number | null {
  const n = skillNode(id);
  if (!n) return null;
  return n.costs[skillRanks(p)[id] ?? 0] ?? null;
}

/** Buys one rank. Null when it cannot be bought (see skillProblem). */
export function buySkill(state: GameState, id: string): GameState | null {
  if (skillProblem(state.player, id) !== null) return null;
  const skills = state.player.skills ?? { ranks: {}, respecs: 0 };
  return { ...state, player: { ...state.player, skills: { ...skills, ranks: { ...skills.ranks, [id]: (skills.ranks[id] ?? 0) + 1 } } } };
}

/** What a respec costs now: 0 for the first SKILL_RESPEC_FREE, then SKILL_RESPEC_GOLD. */
export function respecCost(p: Pick<Player, 'skills'>): number {
  return (p.skills?.respecs ?? 0) < SKILL_RESPEC_FREE ? 0 : SKILL_RESPEC_GOLD;
}

/** Takes every rank back (the points are free again). The first SKILL_RESPEC_FREE are free, then gold through the ledger (reason 'respec'). Null without ranks or gold. */
export function respecSkills(state: GameState, at: number): GameState | null {
  if (pointsSpent(state.player) === 0) return null;
  const cost = respecCost(state.player);
  const paid = cost > 0 ? applyChange(state, { reason: 'respec', gold: -cost, note: 'skill respec' }, at) : state;
  if (!paid) return null;
  return { ...paid, player: { ...paid.player, skills: { ranks: {}, respecs: (state.player.skills?.respecs ?? 0) + 1 } } };
}

/** The bonuses the owned ranks give (every effect capped); empty without ranks. */
export function skillStats(p: Pick<Player, 'skills'>): Bonuses {
  const out: Record<string, number> = {};
  for (const [id, rank] of Object.entries(skillRanks(p))) {
    const n = skillNode(id);
    if (!n || rank <= 0) continue;
    for (const e of n.effects) {
      let v = e.perRank * Math.min(rank, n.maxRank);
      if (e.cap !== undefined) v = e.perRank < 0 ? Math.max(v, e.cap) : Math.min(v, e.cap);
      out[e.stat] = (out[e.stat] ?? 0) + v;
    }
  }
  return out as Bonuses;
}

/** One node as the panel shows it. */
export interface SkillNodeView {
  id: string;
  branch: SkillBranch;
  tier: number;
  pos: { x: number; y: number };
  name: string;
  icon: string;
  maxRank: number;
  rank: number;
  /** Cost of the next rank, null when maxed. */
  nextCost: number | null;
  requires: string[];
  /** Why the next rank cannot be bought (null = buyable now). */
  problem: SkillProblem | null;
  effects: SkillEffect[];
}

/** The whole tree for the panel. */
export interface SkillsView {
  earned: number;
  spent: number;
  free: number;
  respecs: number;
  respecFree: number;
  respecCost: number;
  /** Points spent per branch and the points each tier step needs (tier N needs (N-1) * tierStep spent in its branch). */
  branchSpent: Record<SkillBranch, number>;
  tierStep: number;
  nodes: SkillNodeView[];
}

export function skillsView(p: SkillsOwner): SkillsView {
  const earned = pointsEarned(p.level, p.bookRewards.length);
  const spent = pointsSpent(p);
  const respecs = p.skills?.respecs ?? 0;
  return {
    earned,
    spent,
    free: Math.max(0, earned - spent),
    respecs,
    respecFree: Math.max(0, SKILL_RESPEC_FREE - respecs),
    respecCost: respecCost(p),
    branchSpent: { tavern: branchSpent(p, 'tavern'), dungeon: branchSpent(p, 'dungeon'), fishing: branchSpent(p, 'fishing'), mining: branchSpent(p, 'mining') },
    tierStep: SKILL_TIER_STEP,
    nodes: SKILL_NODES.map((n) => ({
      id: n.id,
      branch: n.branch,
      tier: n.tier,
      pos: n.pos,
      name: n.name,
      icon: n.icon,
      maxRank: n.maxRank,
      rank: skillRanks(p)[n.id] ?? 0,
      nextCost: nextSkillCost(p, n.id),
      requires: n.requires,
      problem: skillProblem(p, n.id),
      effects: n.effects,
    })),
  };
}
