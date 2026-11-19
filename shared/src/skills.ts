// SK-1 (docs/PLAN-SKILLTREE.md 2.3, 3, 4): the skill tree v2, ONE linked graph. Pure rules on plain data (shared/data/skills.json).
// A hub (the hearth, owned by everyone) in the middle, 7 branches as spokes, rings 1..5, keystone choice pairs on ring 4, capstones on ring 5, bridges on ring 3.
// Buy rule: a node is reachable when a node linked to it is owned (the hub always is), its ring gate holds (points spent on the LOWER rings of its branch), its
// level gate holds, its choice group is free, it is live (a rule reads its stat) and the points are there. Points are DERIVED (earned minus spent), never stored.
// Ranks live in Player.skills = { ranks, respecs, tree?, freeReset? }. Gold only through the ledger (respec, unlearn). No node multiplies a gold amount.

import skillData from '../data/skills.json';
import {
  SKILL_ACHIEVE_MAX,
  SKILL_ACHIEVE_PER_POINT,
  SKILL_BOOK_MAX,
  SKILL_FIRST_LEVEL,
  SKILL_RESPEC_FREE,
  SKILL_RESPEC_GOLD_PER_LEVEL,
  SKILL_RING_GATE,
  SKILL_UNLEARN_GOLD_PER_RING,
} from './config.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { STAT_IDS, type Bonuses, type StatId } from './stats.ts';
import type { Player } from './types.ts';

export type SkillBranch = 'tavern' | 'kitchen' | 'farm' | 'fishing' | 'mining' | 'dungeon' | 'home';
/** The branches in circle order (neighbours share a bridge; home wraps round to tavern). */
export const SKILL_BRANCHES: readonly SkillBranch[] = ['tavern', 'kitchen', 'farm', 'fishing', 'mining', 'dungeon', 'home'];
export type SkillNodeKind = 'hub' | 'minor' | 'notable' | 'keystone' | 'capstone' | 'bridge';
/** The hub: owned by everyone, the root of the graph. */
export const SKILL_HUB = 'hearth';

export interface SkillEffect {
  stat: StatId;
  perRank: number;
  /** The most (or, for a negative perRank, the least) the node's total may give. */
  cap?: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch | 'bridge' | 'hub';
  kind: SkillNodeKind;
  ring: number;
  /** Tree units (1 = 48 css px), authored data (tools/layout-skilltree.mjs). */
  pos: { x: number; y: number };
  name: string;
  icon: string;
  /** One line for flag nodes (what it changes in play). */
  text?: string;
  maxRank: number;
  /** Points for rank 1, 2, ... */
  costs: number[];
  /** Undirected links (mirrored by loadTree). */
  links: string[];
  /** One owned node per choice group (keystone pairs). */
  choice?: string;
  gate?: { level?: number };
  effects: SkillEffect[];
  /** False = no rule reads its stat yet: shown as Coming soon, never buyable. */
  live: boolean;
  /** A bridge: the two neighbour branches it joins. */
  between?: SkillBranch[];
}

export interface SkillBranchInfo {
  id: SkillBranch;
  name: string;
  icon: string;
  /** Degrees, 0 = up, clockwise. */
  angle: number;
}

/** The nodes with every link mirrored (a link listed on one side appears on both). */
export function loadTree(raw: readonly SkillNode[]): SkillNode[] {
  const links = new Map<string, Set<string>>(raw.map((n) => [n.id, new Set(n.links)]));
  for (const n of raw) for (const l of n.links) links.get(l)?.add(n.id);
  return raw.map((n) => ({ ...n, links: [...(links.get(n.id) ?? [])] }));
}

/** What is wrong with tree data ([] = fine): unique ids, links exist, all reachable from the hub, choice groups of 2+ on one ring, costs per rank, known stats. */
export function treeProblems(nodes: readonly SkillNode[]): string[] {
  const out: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) out.push('duplicate ids');
  if (byId.get(SKILL_HUB)?.kind !== 'hub') out.push('no hub');
  const stats = new Set<string>(STAT_IDS);
  for (const n of nodes) {
    for (const l of n.links) if (!byId.has(l)) out.push(`${n.id}: link ${l} missing`);
    if (n.costs.length !== n.maxRank) out.push(`${n.id}: costs ${n.costs.length} for ${n.maxRank} ranks`);
    for (const e of n.effects) if (!stats.has(e.stat)) out.push(`${n.id}: unknown stat ${e.stat}`);
    if (n.kind !== 'hub' && n.effects.length === 0) out.push(`${n.id}: no effect`);
  }
  const seen = new Set([SKILL_HUB]);
  const todo = [SKILL_HUB];
  while (todo.length > 0) for (const l of byId.get(todo.pop()!)?.links ?? []) if (!seen.has(l)) (seen.add(l), todo.push(l));
  for (const n of nodes) if (!seen.has(n.id)) out.push(`${n.id}: not reachable from the hub`);
  const groups = new Map<string, SkillNode[]>();
  for (const n of nodes) if (n.choice) groups.set(n.choice, [...(groups.get(n.choice) ?? []), n]);
  for (const [g, list] of groups) if (list.length < 2 || new Set(list.map((n) => n.ring)).size !== 1) out.push(`choice ${g}: needs 2+ nodes on one ring`);
  return out;
}

export const SKILL_TREE_BRANCHES: readonly SkillBranchInfo[] = skillData.branches as SkillBranchInfo[];
export const SKILL_NODES: readonly SkillNode[] = loadTree(skillData.nodes as SkillNode[]);
const NODE_BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]));

export function skillNode(id: string): SkillNode | undefined {
  return NODE_BY_ID.get(id);
}

export type SkillRanks = Readonly<Record<string, number>>;
type SkillsOwner = Pick<Player, 'level' | 'bookRewards' | 'skills'>;

/** Points earned so far: 1 per level from SKILL_FIRST_LEVEL, + 1 per Book reward taken (max SKILL_BOOK_MAX), + 1 per SKILL_ACHIEVE_PER_POINT achievements claimed (max SKILL_ACHIEVE_MAX). */
export function pointsEarned(level: number, bookRewardsTaken: number, achievementsClaimed = 0): number {
  return (
    Math.max(0, level - SKILL_FIRST_LEVEL + 1) +
    Math.min(SKILL_BOOK_MAX, Math.max(0, bookRewardsTaken)) +
    Math.min(SKILL_ACHIEVE_MAX, Math.floor(Math.max(0, achievementsClaimed) / SKILL_ACHIEVE_PER_POINT))
  );
}

/** Achievements claimed (GameState.quests.claimed ids 'ach:...'), for pointsEarned. */
export function achievementsClaimed(state: Pick<GameState, 'quests'>): number {
  return (state.quests?.claimed ?? []).filter((id) => id.startsWith('ach:')).length;
}

export function skillRanks(p: Pick<Player, 'skills'>): Record<string, number> {
  return p.skills?.ranks ?? {};
}

const rankCost = (n: SkillNode, rank: number): number => n.costs.slice(0, Math.min(rank, n.maxRank)).reduce((a, c) => a + c, 0);
const owned = (ranks: SkillRanks, id: string): boolean => id === SKILL_HUB || (ranks[id] ?? 0) >= 1;

/** Points the ranks cost. */
export function ranksSpent(ranks: SkillRanks, filter?: (n: SkillNode) => boolean): number {
  let sum = 0;
  for (const [id, rank] of Object.entries(ranks)) {
    const n = skillNode(id);
    if (n && (!filter || filter(n))) sum += rankCost(n, rank);
  }
  return sum;
}

/** Points the owned ranks cost. */
export function pointsSpent(p: Pick<Player, 'skills'>): number {
  return ranksSpent(skillRanks(p));
}

/** The points still to spend (never negative). */
export function pointsFree(p: SkillsOwner, achieved = 0): number {
  return Math.max(0, pointsEarned(p.level, p.bookRewards.length, achieved) - pointsSpent(p));
}

/** Points spent inside one branch (all rings). */
export function branchSpent(p: Pick<Player, 'skills'>, branch: SkillBranch): number {
  return ranksSpent(skillRanks(p), (n) => n.branch === branch);
}

/** The points a node's ring gate needs: SKILL_RING_GATE[ring - 1] on the lower rings of its branch (0 for bridges and the hub). */
export function ringGateOf(n: SkillNode): number {
  return n.kind === 'bridge' || n.kind === 'hub' ? 0 : (SKILL_RING_GATE[n.ring - 1] ?? 0);
}
/** Points spent in the node's branch on rings below it. */
export function spentBelow(ranks: SkillRanks, n: SkillNode): number {
  return ranksSpent(ranks, (m) => m.branch === n.branch && m.ring < n.ring);
}
const choiceTaken = (ranks: SkillRanks, n: SkillNode): SkillNode | undefined =>
  n.choice ? SKILL_NODES.find((m) => m.choice === n.choice && m.id !== n.id && owned(ranks, m.id)) : undefined;

/**
 * True when a build is valid: known ids, ranks 1..maxRank, every owned node reachable through owned nodes from the hub, ring and level gates hold, at most
 * one per choice group. Used by buy, unlearn and the migration (and later the server). A build of no-longer-live nodes stays valid (live is about buying).
 */
export function validBuild(ranks: SkillRanks, level: number): boolean {
  const ids = Object.keys(ranks).filter((id) => (ranks[id] ?? 0) !== 0);
  for (const id of ids) {
    const n = skillNode(id);
    const r = ranks[id]!;
    if (!n || n.kind === 'hub' || !Number.isInteger(r) || r < 0 || r > n.maxRank) return false;
    if (spentBelow(ranks, n) < ringGateOf(n)) return false;
    if ((n.gate?.level ?? 0) > level) return false;
    if (choiceTaken(ranks, n)) return false;
  }
  const seen = new Set([SKILL_HUB]);
  const todo = [SKILL_HUB];
  while (todo.length > 0) {
    for (const l of skillNode(todo.pop()!)?.links ?? []) {
      if (!seen.has(l) && owned(ranks, l)) {
        seen.add(l);
        todo.push(l);
      }
    }
  }
  return ids.every((id) => seen.has(id));
}

export type SkillProblem = 'unknown' | 'maxed' | 'soon' | 'unlinked' | 'choice' | 'level' | 'ring' | 'points';

/** Why a rank of this node cannot be bought now (null = it can). `achieved` = achievements claimed (achievementsClaimed). */
export function skillProblem(p: SkillsOwner, id: string, achieved = 0): SkillProblem | null {
  const n = skillNode(id);
  if (!n) return 'unknown';
  const ranks = skillRanks(p);
  const rank = ranks[id] ?? 0;
  if (rank >= n.maxRank) return 'maxed';
  if (!n.live) return 'soon';
  if (rank === 0 && !n.links.some((l) => owned(ranks, l))) return 'unlinked';
  if (choiceTaken(ranks, n)) return 'choice';
  if ((n.gate?.level ?? 0) > p.level) return 'level';
  if (spentBelow(ranks, n) < ringGateOf(n)) return 'ring';
  if (pointsFree(p, achieved) < (n.costs[rank] ?? Infinity)) return 'points';
  return null;
}

/** The cost of the next rank (null when maxed or unknown). */
export function nextSkillCost(p: Pick<Player, 'skills'>, id: string): number | null {
  const n = skillNode(id);
  if (!n) return null;
  return n.costs[skillRanks(p)[id] ?? 0] ?? null;
}

const skillsOf = (p: Pick<Player, 'skills'>): NonNullable<Player['skills']> => p.skills ?? { ranks: {}, respecs: 0, tree: 2 };

/** Buys one rank. Null when it cannot be bought (see skillProblem). */
export function buySkill(state: GameState, id: string): GameState | null {
  if (skillProblem(state.player, id, achievementsClaimed(state)) !== null) return null;
  const skills = skillsOf(state.player);
  return { ...state, player: { ...state.player, skills: { ...skills, ranks: { ...skills.ranks, [id]: (skills.ranks[id] ?? 0) + 1 } } } };
}

export type UnlearnProblem = 'unknown' | 'not_owned' | 'not_leaf';

/** Why one rank of this node cannot be taken back (null = it can): only a rank whose removal keeps the build valid (a leaf). */
export function unlearnProblem(p: Pick<Player, 'skills' | 'level'>, id: string): UnlearnProblem | null {
  const n = skillNode(id);
  if (!n || n.kind === 'hub') return 'unknown';
  const ranks = skillRanks(p);
  const rank = ranks[id] ?? 0;
  if (rank < 1) return 'not_owned';
  const next = { ...ranks };
  if (rank === 1) delete next[id];
  else next[id] = rank - 1;
  return validBuild(next, p.level) ? null : 'not_leaf';
}

/** Gold to unlearn one rank of a node: SKILL_UNLEARN_GOLD_PER_RING x its ring (0 when it is an undo of this session). */
export function unlearnCost(id: string, undo = false): number {
  return undo ? 0 : SKILL_UNLEARN_GOLD_PER_RING * (skillNode(id)?.ring ?? 0);
}

/** Takes one rank back (the points are free again). `undo` = bought since the panel opened: free. Else gold through the ledger ('respec'). Null when refused. */
export function unlearnSkill(state: GameState, id: string, at: number, undo = false): GameState | null {
  if (unlearnProblem(state.player, id) !== null) return null;
  const cost = unlearnCost(id, undo);
  const paid = cost > 0 ? applyChange(state, { reason: 'respec', gold: -cost, note: `skill unlearn ${id}` }, at) : state;
  if (!paid) return null;
  const skills = skillsOf(state.player);
  const ranks = { ...skills.ranks };
  const rank = ranks[id] ?? 0;
  if (rank <= 1) delete ranks[id];
  else ranks[id] = rank - 1;
  return { ...paid, player: { ...paid.player, skills: { ...skills, ranks } } };
}

/** What a full respec costs now: 0 with the free reset or for the first SKILL_RESPEC_FREE, then SKILL_RESPEC_GOLD_PER_LEVEL x the level. */
export function respecCost(p: Pick<Player, 'skills' | 'level'>): number {
  if (p.skills?.freeReset) return 0;
  return (p.skills?.respecs ?? 0) < SKILL_RESPEC_FREE ? 0 : SKILL_RESPEC_GOLD_PER_LEVEL * p.level;
}

/** Takes every rank back. The free reset (SAVE 43) goes first and does not count; then the SKILL_RESPEC_FREE free ones, then gold ('respec'). Null without ranks or gold. */
export function respecSkills(state: GameState, at: number): GameState | null {
  if (pointsSpent(state.player) === 0) return null;
  const cost = respecCost(state.player);
  const paid = cost > 0 ? applyChange(state, { reason: 'respec', gold: -cost, note: 'skill respec' }, at) : state;
  if (!paid) return null;
  const old = skillsOf(state.player);
  const respecs = old.freeReset ? old.respecs : old.respecs + 1;
  return { ...paid, player: { ...paid.player, skills: { ranks: {}, respecs, tree: 2 } } };
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

/**
 * The cheapest way to reach a node from the owned set (the panel's route preview, "4 nodes, 7 points"): Dijkstra over the first-rank cost of every
 * unowned node on the way (nodes blocked by a taken choice group are skipped). path = the unowned nodes in buy order, ending with the target. Gates are
 * not checked (the preview shows the road, the buy rule the rest). Null when the node is unknown or cannot be reached.
 */
export function cheapestPath(ranks: SkillRanks, targetId: string): { path: string[]; points: number } | null {
  const target = skillNode(targetId);
  if (!target) return null;
  if (owned(ranks, targetId)) return { path: [], points: 0 };
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (const n of SKILL_NODES) if (owned(ranks, n.id)) dist.set(n.id, 0);
  for (;;) {
    let best: string | null = null;
    for (const [id, d] of dist) if (!done.has(id) && (best === null || d < dist.get(best)!)) best = id;
    if (best === null) return null;
    if (best === targetId) break;
    done.add(best);
    for (const l of skillNode(best)!.links) {
      const m = skillNode(l)!;
      if (done.has(l) || owned(ranks, l) || choiceTaken(ranks, m)) continue;
      const d = dist.get(best)! + (m.costs[0] ?? 0);
      if (d < (dist.get(l) ?? Infinity)) {
        dist.set(l, d);
        prev.set(l, best);
      }
    }
  }
  const path: string[] = [];
  for (let id: string | undefined = targetId; id !== undefined && !owned(ranks, id); id = prev.get(id)) path.unshift(id);
  return { path, points: dist.get(targetId)! };
}

/** One node as the panel shows it. */
export interface SkillNodeView {
  id: string;
  branch: SkillNode['branch'];
  kind: SkillNodeKind;
  ring: number;
  pos: { x: number; y: number };
  name: string;
  icon: string;
  text?: string;
  maxRank: number;
  rank: number;
  /** Cost of the next rank, null when maxed. */
  nextCost: number | null;
  links: string[];
  choice?: string;
  gate?: { level?: number };
  between?: SkillBranch[];
  live: boolean;
  /** Points this node's ring gate needs on the lower rings of its branch, and what is spent there now. */
  ringGate: number;
  ringSpent: number;
  /** Why the next rank cannot be bought (null = buyable now). */
  problem: SkillProblem | null;
  /** Why one rank cannot be taken back (null = it can), the gold it costs, and whether it is a free undo of this session. */
  unlearn: UnlearnProblem | null;
  unlearnCost: number;
  undo: boolean;
  effects: SkillEffect[];
}

/** The whole tree for the panel. */
export interface SkillsView {
  version: 2;
  earned: number;
  spent: number;
  free: number;
  respecs: number;
  respecFree: number;
  respecCost: number;
  /** The one free reset of the SAVE 43 migration is still there. */
  freeReset: boolean;
  level: number;
  /** Points spent per branch (all rings). */
  branchSpent: Record<SkillBranch, number>;
  branches: readonly SkillBranchInfo[];
  nodes: SkillNodeView[];
}

/** The view for the panel. `achieved` = achievements claimed; `undo` = node ids bought since the panel opened (each one rank, a free undo). */
export function skillsView(p: SkillsOwner, opts: { achieved?: number; undo?: readonly string[] } = {}): SkillsView {
  const earned = pointsEarned(p.level, p.bookRewards.length, opts.achieved ?? 0);
  const spent = pointsSpent(p);
  const respecs = p.skills?.respecs ?? 0;
  const ranks = skillRanks(p);
  const branchSpentAll = Object.fromEntries(SKILL_BRANCHES.map((b) => [b, branchSpent(p, b)])) as Record<SkillBranch, number>;
  return {
    version: 2,
    earned,
    spent,
    free: Math.max(0, earned - spent),
    respecs,
    respecFree: Math.max(0, SKILL_RESPEC_FREE - respecs),
    respecCost: respecCost(p),
    freeReset: p.skills?.freeReset === true,
    level: p.level,
    branchSpent: branchSpentAll,
    branches: SKILL_TREE_BRANCHES,
    nodes: SKILL_NODES.map((n) => {
      const undo = opts.undo?.includes(n.id) === true;
      return {
        id: n.id,
        branch: n.branch,
        kind: n.kind,
        ring: n.ring,
        pos: n.pos,
        name: n.name,
        icon: n.icon,
        ...(n.text ? { text: n.text } : {}),
        maxRank: n.maxRank,
        rank: ranks[n.id] ?? 0,
        nextCost: nextSkillCost(p, n.id),
        links: n.links,
        ...(n.choice ? { choice: n.choice } : {}),
        ...(n.gate ? { gate: n.gate } : {}),
        ...(n.between ? { between: n.between } : {}),
        live: n.live,
        ringGate: ringGateOf(n),
        ringSpent: spentBelow(ranks, n),
        problem: skillProblem(p, n.id, opts.achieved ?? 0),
        unlearn: unlearnProblem(p, n.id),
        unlearnCost: unlearnCost(n.id, undo),
        undo,
        effects: n.effects,
      };
    }),
  };
}

/**
 * SAVE 42 -> 43: an old (MG-1) build moves onto the v2 tree. Unknown ids are dropped, ranks clamped to maxRank; when the result is not a valid v2 build
 * every rank is cleared (points are derived, so nothing is lost). Every save with skills gets one free full reset (freeReset) and tree 2.
 */
export function migrateSkillsV2(skills: unknown, level: number): Player['skills'] | undefined {
  if (typeof skills !== 'object' || skills === null) return undefined;
  const s = skills as { ranks?: unknown; respecs?: unknown };
  const ranks: Record<string, number> = {};
  if (typeof s.ranks === 'object' && s.ranks !== null) {
    for (const [id, r] of Object.entries(s.ranks as Record<string, unknown>)) {
      const n = skillNode(id);
      if (!n || n.kind === 'hub' || typeof r !== 'number' || !Number.isFinite(r) || r < 1) continue;
      ranks[id] = Math.min(Math.floor(r), n.maxRank);
    }
  }
  const respecs = typeof s.respecs === 'number' && Number.isFinite(s.respecs) && s.respecs >= 0 ? Math.floor(s.respecs) : 0;
  return { ranks: validBuild(ranks, level) ? ranks : {}, respecs, tree: 2, freeReset: true };
}
