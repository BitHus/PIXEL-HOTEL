// MG-7 / SK-1: the words of the Skills panel (pure, tested). One line per stat for "what a rank gives", and the reason a node cannot be bought yet.

import type { SkillBranch, SkillEffect, SkillNodeView, SkillsView } from '@pixel-hotel/shared';

export const BRANCH_NAMES: Record<SkillBranch, string> = {
  tavern: 'Tavern', kitchen: 'Kitchen', farm: 'Farm', fishing: 'Fishing', mining: 'Mining', dungeon: 'Dungeon', home: 'Home',
};

const sign = (v: number): string => (v > 0 ? `+${v}` : String(v));
const pct = (v: number): string => `${sign(Math.round(v * 100) / 100)}%`;

/** The text of one stat at a total value (a node's effect for some rank count). Flag stats (0/1) use the node's own text line. */
const STAT_TEXT: Record<string, (v: number) => string> = {
  roomWalkPct: (v) => `${pct(v)} walking speed in rooms`,
  trayPlus: (v) => `${sign(v)} on the waiter's tray`,
  seatsPlus: (v) => `${sign(v)} guest at a time`,
  pourWindowPlus: (v) => `Perfect pour window ${sign(Math.round(v * 100) / 100)} each side`,
  batchPlus: (v) => `${sign(v)} dish per stove batch`,
  tapCapPlus: (v) => `${sign(v)} mugs per tap`,
  caskSlotsPlus: (v) => `${sign(v)} cask per keg rack`,
  bagSlotsPlus: (v) => `${sign(v)} bag slots`,
  guestPatiencePct: (v) => `Guest patience ${pct(v)}`,
  guestRatePct: (v) => `Guests come ${pct(v)} more often`,
  pourFullPct: (v) => `Pour fill time ${pct(v)}`,
  gemTipPct: (v) => `Gem tip chance ${pct(v)}`,
  secondOrderPct: (v) => `${v}% chance a guest orders a second drink`,
  maxHpPlus: (v) => `${sign(v)} max hp`,
  runBagPlus: (v) => `${sign(v)} dungeon bag slots`,
  attackPlus: (v) => `${sign(v)} attack`,
  runSpeedPct: (v) => `${pct(v)} dungeon walking speed`,
  potionHealPct: (v) => `Potions heal ${pct(v)} more`,
  enemyMissMs: (v) => `Enemy wind-up ${sign(v)} ms longer`,
  chestGlintBlocks: (v) => `Chests glint ${sign(v)} blocks farther`,
  attackCdPct: (v) => `Attack cooldown ${pct(v)}`,
  maxHpPct: (v) => `Max hp ${pct(v)}`,
  damageTakenPlus: (v) => `Damage taken ${sign(v)}`,
  cookMsPct: (v) => `Cook time ${pct(v)}`,
  brewMsPct: (v) => `Brew time ${pct(v)}`,
  brewYieldPlus: (v) => `${sign(v)} mug per brew`,
  inputKeepPct: (v) => `${v}% chance an input is kept`,
  ripenMsPct: (v) => `Cask ripening ${pct(v)}`,
  foodHealPct: (v) => `Lunch-box food heals ${pct(v)}`,
  tasteReservePts: (v) => `Reserve taste chance ${sign(Math.round(v * 100))} points`,
  prepBonusPlus: (v) => `Prep bonus max ${sign(v)}`,
  growMsPct: (v) => `Grow time ${pct(v)}`,
  seedBackPts: (v) => `Seed-back chance ${sign(v)} points`,
  blockHitCdPct: (v) => `Block hit cooldown ${pct(v)}`,
  harvestBonusPct: (v) => `${v}% chance of +1 harvest`,
  blockReachPlus: (v) => `Block reach ${sign(v)}`,
  spliceMsPct: (v) => `Splice extra time ${pct(v)}`,
  harvestGemPct: (v) => `Harvest gem chance ${pct(v)}`,
  plantCapPlus: (v) => `${sign(v)} plants on the farm`,
  biteWaitPct: (v) => `Bite wait ${pct(v)}`,
  boxSizePct: (v) => `Catch box ${pct(v)}`,
  tensionRisePct: (v) => `Fish escape ${pct(v)} slower`,
  baitSavePct: (v) => `Bait kept on ${v}% of casts`,
  strikeWindowMs: (v) => `Strike window ${sign(v)} ms`,
  rankOddsPct: (v) => `Rare catches ${pct(v)} more often`,
  castReachPlus: (v) => `Cast reach ${sign(v)} blocks`,
  doubleCatchPct: (v) => `${v}% chance of a second fish`,
  digSpeedPct: (v) => `${pct(v)} digging speed`,
  lightPlus: (v) => `Light ${sign(v)}`,
  glintBlocks: (v) => `Ore glints ${sign(v)} blocks farther`,
  hazardDmgPct: (v) => `Hazard damage ${pct(v)}`,
  doubleStrikePct: (v) => `${v}% of swings count double`,
  mineBagPlus: (v) => `${sign(v)} mine bag slots`,
  oreBonusPct: (v) => `${pct(v)} ore from rocks`,
  gemChancePts: (v) => `Gem chance ${sign(v)} points`,
  caveTellMs: (v) => `Cave-in warning ${sign(v)} ms`,
  appealPlus: (v) => `Tavern appeal ${sign(v)}`,
  decorTypeCapPlus: (v) => `Each decor type counts ${sign(v)} more time for appeal`,
  questGemsPct: (v) => `Quest gems ${pct(v)}`,
  offlineHoursPlus: (v) => `Away catch-up ${sign(v)} h`,
  lunchBoxPlus: (v) => `${sign(v)} lunch box slot`,
  catVisitPct: (v) => `The cat visits ${pct(v)} more`,
  outdoorWalkPct: (v) => `${pct(v)} walking speed outdoors`,
  chopCdPct: (v) => `Chop cooldown ${pct(v)}`,
  treeRegrowPct: (v) => `Tree regrow ${pct(v)}`,
  giftChancePct: (v) => `${v}% chance a guest leaves a small gift`,
};

/** The total of an effect at `rank` ranks (capped like skillStats does). */
export function effectTotal(e: SkillEffect, rank: number): number {
  const v = e.perRank * rank;
  if (e.cap === undefined) return v;
  return e.perRank < 0 ? Math.max(v, e.cap) : Math.min(v, e.cap);
}

/** What the node gives at `rank` ranks, e.g. "+12% walking speed in rooms"; every effect on one line. A flag node uses its text line. */
export function effectText(node: Pick<SkillNodeView, 'effects' | 'text'>, rank: number): string {
  const parts = node.effects.filter((e) => STAT_TEXT[e.stat]).map((e) => STAT_TEXT[e.stat]!(effectTotal(e, rank)));
  if (node.text && parts.length < node.effects.length) return node.text.replace(/\.$/, '');
  return parts.join(', ');
}

/** The text under a node: what it gives now and what the next rank adds. */
export function nodeSummary(node: SkillNodeView): string {
  if (node.rank === 0) return node.maxRank > 1 ? `Rank 1: ${effectText(node, 1)}.` : `${effectText(node, 1)}.`;
  if (node.rank >= node.maxRank) return `${effectText(node, node.rank)}.`;
  return `Now: ${effectText(node, node.rank)}. Next: ${effectText(node, node.rank + 1)}.`;
}

/** True when no rule reads the node's stat yet (SK-1: such a node is Coming soon and cannot be bought). */
export function notActiveYet(node: Pick<SkillNodeView, 'live'>): boolean {
  return !node.live;
}

/** Why the node cannot be bought now, in words ('' when it can, or when it is maxed). */
export function lockText(view: SkillsView, node: SkillNodeView): string {
  const name = (id: string): string => view.nodes.find((n) => n.id === id)?.name ?? id;
  switch (node.problem) {
    case null:
    case 'maxed':
    case 'unknown':
      return '';
    case 'soon':
      return 'Coming soon: the game part for it is still being built.';
    case 'unlinked': {
      const inner = node.links.filter((id) => node.kind === 'bridge' || (view.nodes.find((n) => n.id === id)?.ring ?? 0) < node.ring);
      return `Needs a linked skill first: ${inner.map(name).join(' or ')}.`;
    }
    case 'choice': {
      const other = view.nodes.find((n) => n.choice === node.choice && n.id !== node.id && n.rank > 0);
      return `You chose ${other?.name ?? 'the other one'}: only one of this pair.`;
    }
    case 'level':
      return `Needs player level ${node.gate?.level ?? 0} (you are ${view.level}).`;
    case 'ring': {
      const left = node.ringGate - node.ringSpent;
      const where = node.branch === 'bridge' || node.branch === 'hub' ? 'the rings below' : `the inner rings of ${BRANCH_NAMES[node.branch]}`;
      return `Spend ${left} more point${left === 1 ? '' : 's'} on ${where} (${node.ringSpent} of ${node.ringGate}).`;
    }
    case 'points':
      return `Needs ${node.nextCost} point${node.nextCost === 1 ? '' : 's'}; you have ${view.free}.`;
  }
}

/** The respec line: what it costs now. */
export function respecText(view: SkillsView): string {
  if (view.freeReset) return 'Respec: free (new tree)';
  return view.respecCost === 0 ? `Respec: free (${view.respecFree} left)` : `Respec: ${view.respecCost} gold`;
}

/** The unlearn button: '' when the rank cannot be taken back, else "Undo" (free) or "Unlearn (20 gold)". */
export function unlearnText(node: SkillNodeView): string {
  if (node.rank === 0 || node.unlearn !== null) return '';
  return node.undo ? 'Undo' : `Unlearn (${node.unlearnCost} gold)`;
}
