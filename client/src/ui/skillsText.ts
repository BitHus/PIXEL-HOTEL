// MG-7: the words of the Skills panel (pure, tested). One line per stat for "what a rank gives", and the reason a node cannot be bought yet.

import { UNHOOKED_STATS, type SkillBranch, type SkillEffect, type SkillNodeView, type SkillsView } from '@pixel-hotel/shared';

export const BRANCH_NAMES: Record<SkillBranch, string> = { tavern: 'Tavern', dungeon: 'Dungeon', fishing: 'Fishing', mining: 'Mining' };

const sign = (v: number): string => (v > 0 ? `+${v}` : String(v));
const pct = (v: number): string => `${sign(Math.round(v * 100) / 100)}%`;

/** The text of one stat at a total value (a node's effect for some rank count). */
const STAT_TEXT: Record<string, (v: number) => string> = {
  roomWalkPct: (v) => `${pct(v)} walking speed in rooms`,
  trayPlus: (v) => `${sign(v)} on the waiter's tray`,
  seatsPlus: (v) => `${sign(v)} guest at a time`,
  pourWindowPlus: (v) => `Perfect pour window ${sign(Math.round(v * 100) / 100)} each side`,
  batchPlus: (v) => `${sign(v)} dish per stove batch`,
  tapCapPlus: (v) => `${sign(v)} mugs per tap`,
  caskSlotsPlus: (v) => `${sign(v)} cask per keg rack`,
  bagSlotsPlus: (v) => `${sign(v)} bag slots`,
  maxHpPlus: (v) => `${sign(v)} max hp`,
  runBagPlus: (v) => `${sign(v)} dungeon bag slots`,
  attackPlus: (v) => `${sign(v)} attack`,
  runSpeedPct: (v) => `${pct(v)} dungeon walking speed`,
  potionHealPct: (v) => `Potions heal ${pct(v)} more`,
  enemyMissMs: (v) => `Enemy wind-up ${sign(v)} ms longer`,
  chestGlintBlocks: (v) => `Chests glint ${sign(v)} blocks farther`,
  lastStand: () => 'Survive one lethal hit per run at 1 hp',
  biteWaitPct: (v) => `Bite wait ${pct(v)}`,
  boxSizePct: (v) => `Catch box ${pct(v)}`,
  tensionRisePct: (v) => `Fish escape ${pct(v)} slower`,
  baitSavePct: (v) => `Bait kept on ${v}% of casts`,
  strikeWindowMs: (v) => `Strike window ${sign(v)} ms`,
  deepCast: () => 'A reeds spot joins the lake table',
  rankOddsPct: (v) => `Rare catches ${pct(v)} more often`,
  keepBaitOnLoss: () => 'A lost fish keeps the bait',
  digSpeedPct: (v) => `${pct(v)} digging speed`,
  lightPlus: (v) => `Light ${sign(v)}`,
  glintBlocks: (v) => `Ore glints ${sign(v)} blocks farther`,
  hazardDmgPct: (v) => `Hazard damage ${pct(v)}`,
  doubleStrikePct: (v) => `${v}% of swings count double`,
  mineBagPlus: (v) => `${sign(v)} mine bag slots`,
  oreBonusPct: (v) => `${pct(v)} ore from rocks`,
  gemChancePts: (v) => `Gem chance ${sign(v)} points`,
};

/** The total of an effect at `rank` ranks (capped like skillStats does). */
export function effectTotal(e: SkillEffect, rank: number): number {
  const v = e.perRank * rank;
  if (e.cap === undefined) return v;
  return e.perRank < 0 ? Math.max(v, e.cap) : Math.min(v, e.cap);
}

/** What the node gives at `rank` ranks, e.g. "+12% walking speed in rooms"; every effect on one line. */
export function effectText(node: Pick<SkillNodeView, 'effects'>, rank: number): string {
  return node.effects.map((e) => (STAT_TEXT[e.stat] ?? ((v: number) => `${e.stat} ${sign(v)}`))(effectTotal(e, rank))).join(', ');
}

/** The text under a node: what it gives now and what the next rank adds. */
export function nodeSummary(node: SkillNodeView): string {
  if (node.rank === 0) return `Rank 1: ${effectText(node, 1)}.`;
  if (node.rank >= node.maxRank) return `${effectText(node, node.rank)}.`;
  return `Now: ${effectText(node, node.rank)}. Next: ${effectText(node, node.rank + 1)}.`;
}

/** True when no rule reads the node's stat yet (it still costs points; the panel says so). */
export function notActiveYet(node: Pick<SkillNodeView, 'effects'>): boolean {
  return node.effects.some((e) => UNHOOKED_STATS.includes(e.stat));
}

/** Why the node cannot be bought now, in words ('' when it can, or when it is maxed). */
export function lockText(view: SkillsView, node: SkillNodeView): string {
  switch (node.problem) {
    case null:
    case 'maxed':
    case 'unknown':
      return '';
    case 'requires': {
      const missing = node.requires.filter((id) => (view.nodes.find((n) => n.id === id)?.rank ?? 0) < 1).map((id) => view.nodes.find((n) => n.id === id)?.name ?? id);
      return `Needs ${missing.join(' and ')} first.`;
    }
    case 'tier': {
      const need = (node.tier - 1) * view.tierStep;
      const spent = view.branchSpent[node.branch];
      return `Spend ${need - spent} more point${need - spent === 1 ? '' : 's'} in ${BRANCH_NAMES[node.branch]} (${spent} of ${need}).`;
    }
    case 'points':
      return `Needs ${node.nextCost} point${node.nextCost === 1 ? '' : 's'}; you have ${view.free}.`;
  }
}

/** The respec line: what it costs now. */
export function respecText(view: SkillsView): string {
  return view.respecCost === 0 ? `Respec: free (${view.respecFree} left)` : `Respec: ${view.respecCost} gold`;
}
