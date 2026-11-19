// SK-1 (docs/PLAN-SKILLTREE.md 2.3, 3, 4): the skill tree v2 graph, points, buy/unlearn/respec, the route preview and the 42 -> 43 migration.
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, SKILL_ACHIEVE_MAX, SKILL_BOOK_MAX, SKILL_RESPEC_FREE, SKILL_RING_GATE } from './config.ts';
import type { GameState } from './gameState.ts';
import { createNewPlayer } from './newPlayer.ts';
import { readSave } from './save.ts';
import { HOOKED_STATS } from './skillRules.ts';
import { STAT_IDS, effective, mergeBonuses, type StatId } from './stats.ts';
import {
  SKILL_BRANCHES,
  SKILL_HUB,
  SKILL_NODES,
  achievementsClaimed,
  buySkill,
  cheapestPath,
  migrateSkillsV2,
  pointsEarned,
  pointsFree,
  pointsSpent,
  respecCost,
  respecSkills,
  skillNode,
  skillProblem,
  skillStats,
  skillsView,
  treeProblems,
  unlearnProblem,
  unlearnSkill,
  validBuild,
} from './skills.ts';

const at = (level: number, book = 0, gold = 500): GameState => {
  const s = createNewPlayer(undefined, 0);
  return { ...s, player: { ...s.player, level, bookRewards: Array.from({ length: book }, (_, i) => `tab:${i}`), wallet: { ...s.player.wallet, gold } } };
};
const withRanks = (s: GameState, ranks: Record<string, number>, extra: object = {}): GameState => ({ ...s, player: { ...s.player, skills: { ranks, respecs: 0, ...extra } } });
const buyAll = (s: GameState, ids: string[]): GameState =>
  ids.reduce((acc, id) => {
    const next = buySkill(acc, id);
    if (!next) throw new Error(`could not buy ${id}: ${skillProblem(acc.player, id)}`);
    return next;
  }, s);
const OLD_IDS = [
  'quick_feet', 'steady_hands', 'roomy_tavern', 'keen_eye', 'big_batch', 'wide_kegs', 'cellar_racks', 'deep_pockets', 'thick_skin', 'satchel', 'sharp_edge',
  'light_feet', 'second_wind', 'parry', 'treasure_sense', 'last_stand', 'patient', 'wide_box', 'reel_master', 'bait_saver', 'sharp_eye', 'deep_cast',
  'trophy_hunter', 'calm_hands', 'strong_arm', 'lantern', 'ore_sense', 'careful_step', 'double_strike', 'pack_mule', 'prospector', 'gem_eye',
];
/** Every stat with the reason it is not a gold multiplier (CLAUDE.md 9: no node multiplies a gold amount). A new StatId must be listed here. */
const ALLOWED_STATS: Record<StatId, string> = {
  roomWalkPct: 'walk speed', trayPlus: 'tray size', seatsPlus: 'guest cap (throughput, gated by the 85% guest share)', pourWindowPlus: 'pour window',
  batchPlus: 'dishes per batch (items)', tapCapPlus: 'mugs per tap', caskSlotsPlus: 'casks per rack', bagSlotsPlus: 'bag slots',
  guestPatiencePct: 'guest patience time', guestRatePct: 'guest interval (throughput)', pourFullPct: 'pour fill time', gemTipPct: 'gem chance (not gold)',
  secondOrderPct: 'extra order chance (throughput)', autoCarryPerfect: 'automation', cookMsPct: 'cook time', brewMsPct: 'brew time', brewYieldPlus: 'mugs (items)',
  inputKeepPct: 'inputs kept (items)', ripenMsPct: 'ripening time', foodHealPct: 'heal amount', tasteReservePts: 'reserve taste chance', twinBarrel: 'parallel brews',
  prepAnywhere: 'prep placement', prepBonusPlus: 'dishes (items)', growMsPct: 'grow time', seedBackPts: 'seed chance (items)', blockHitCdPct: 'hit cooldown',
  harvestBonusPct: 'harvest items', blockReachPlus: 'reach', spliceMsPct: 'splice time', harvestGemPct: 'gem chance', plantCapPlus: 'plant cap', seedLore: 'info',
  areaHarvest: 'automation', harvestBait: 'bait (items)', maxHpPlus: 'hp', runBagPlus: 'run bag', attackPlus: 'attack', runSpeedPct: 'run speed',
  potionHealPct: 'heal', enemyMissMs: 'wind-up', chestGlintBlocks: 'info', lastStand: 'survival', attackCdPct: 'attack cooldown', maxHpPct: 'hp',
  damageTakenPlus: 'damage', heavyEvery: 'damage', biteWaitPct: 'bite time', boxSizePct: 'catch box', tensionRisePct: 'reel drain', baitSavePct: 'bait (items)',
  strikeWindowMs: 'strike window', deepCast: 'catch table', rankOddsPct: 'catch rank odds', keepBaitOnLoss: 'bait (items)', castReachPlus: 'reach',
  doubleCatchPct: 'fish (items)', digSpeedPct: 'dig speed', lightPlus: 'light', glintBlocks: 'info', hazardDmgPct: 'damage', doubleStrikePct: 'dig hits',
  mineBagPlus: 'mine bag', oreBonusPct: 'ore (items)', gemChancePts: 'gem chance', caveTellMs: 'hazard time', blastEvery: 'dig area', deepStart: 'mine depth',
  appealPlus: 'appeal (throughput)', decorTypeCapPlus: 'appeal (throughput)', questGemsPct: 'quest gems (not gold)', bookOutlines: 'info',
  offlineHoursPlus: 'away time', lunchBoxPlus: 'lunch box', catVisitPct: 'cosmetic', outdoorWalkPct: 'walk speed', chopCdPct: 'chop cooldown',
  treeRegrowPct: 'regrow time', homebodyStars: 'appeal (throughput)', giftChancePct: 'gift of a seed or block, never gold', autoLoadTap: 'automation',
};

describe('the stat helper', () => {
  it('rank 0 (no bonus) is the base exactly; percent stats scale, the others add', () => {
    expect(effective(128, 'roomWalkPct', undefined)).toBe(128);
    expect(effective(128, 'roomWalkPct', {})).toBe(128);
    expect(effective(128, 'roomWalkPct', { roomWalkPct: 6 })).toBeCloseTo(135.68);
    expect(effective(30, 'maxHpPlus', { maxHpPlus: 3 })).toBe(33);
    expect(mergeBonuses({ maxHpPlus: 3 }, { maxHpPlus: 2, trayPlus: 1 }, undefined)).toEqual({ maxHpPlus: 5, trayPlus: 1 });
  });
});

describe('the tree data (v2)', () => {
  it('is a valid graph: unique ids, mirrored links, every node reachable from the hub, choice groups on one ring, costs per rank, known stats', () => {
    expect(treeProblems(SKILL_NODES)).toEqual([]);
    for (const n of SKILL_NODES) for (const l of n.links) expect(skillNode(l)!.links, `${n.id} - ${l}`).toContain(n.id);
  });
  it('has 92 nodes: 7 branches of 12 (2-3 on ring 1, a keystone pair on ring 4, one capstone on ring 5), 7 bridges, the hub; all 32 old ids kept', () => {
    expect(SKILL_NODES).toHaveLength(92);
    for (const b of SKILL_BRANCHES) {
      const nodes = SKILL_NODES.filter((n) => n.branch === b);
      expect(nodes, b).toHaveLength(12);
      expect(nodes.filter((n) => n.kind === 'keystone' && n.ring === 4), b).toHaveLength(2);
      const caps = nodes.filter((n) => n.kind === 'capstone');
      expect(caps.map((n) => [n.ring, n.gate?.level]), b).toEqual([[5, 20]]);
      for (const n of nodes.filter((m) => m.ring === 1)) expect(n.links, n.id).toContain(SKILL_HUB);
    }
    const bridges = SKILL_NODES.filter((n) => n.kind === 'bridge');
    expect(bridges).toHaveLength(7);
    for (const br of bridges) {
      expect(br.ring).toBe(3);
      const ends = br.links.map((l) => skillNode(l)!);
      expect(ends.map((e) => e.ring), br.id).toEqual([3, 3]);
      expect(new Set(ends.map((e) => e.branch)), br.id).toEqual(new Set(br.between));
    }
    for (const id of OLD_IDS) expect(skillNode(id), id).toBeDefined();
  });
  it('a node is live only when a rule reads every stat it gives; the old nodes whose stat is read stay live', () => {
    for (const n of SKILL_NODES.filter((m) => m.live && m.kind !== 'hub')) for (const e of n.effects) expect(HOOKED_STATS, n.id).toContain(e.stat);
    for (const id of OLD_IDS) {
      const n = skillNode(id)!;
      expect(n.live, id).toBe(n.effects.every((e) => HOOKED_STATS.includes(e.stat)));
    }
  });
  it('the whole tree costs more than 4 x the most points a player can have (nobody owns everything)', () => {
    const all = SKILL_NODES.reduce((a, n) => a + n.costs.reduce((x, y) => x + y, 0), 0);
    expect(pointsEarned(30, SKILL_BOOK_MAX, 999)).toBe(38);
    expect(all).toBeGreaterThan(4 * 38);
  });
  it('no node multiplies gold: every StatId is listed with a reason, none is a gold stat', () => {
    expect(Object.keys(ALLOWED_STATS).sort()).toEqual([...STAT_IDS].sort());
    for (const s of STAT_IDS) expect(s).not.toMatch(/gold|coin|price|tip(?!Pct)/i);
    expect(STAT_IDS.filter((s) => /tip/i.test(s))).toEqual(['gemTipPct']); // a GEM chance, never gold
  });
});

describe('points', () => {
  it('1 per level from 2, + 1 per Book reward (max 4), + 1 per 5 achievements (max 5): 38 at the cap', () => {
    expect(pointsEarned(1, 0)).toBe(0);
    expect(pointsEarned(2, 0)).toBe(1);
    expect(pointsEarned(5, 0)).toBe(4);
    expect(pointsEarned(8, 9)).toBe(7 + SKILL_BOOK_MAX);
    expect([4, 5, 9, 10, 100].map((a) => pointsEarned(1, 0, a))).toEqual([0, 1, 1, 2, SKILL_ACHIEVE_MAX]);
    expect(pointsEarned(30, 4, 25)).toBe(38);
    expect(pointsFree(at(5).player)).toBe(4);
    const s = at(1);
    expect(achievementsClaimed({ quests: { ...s.quests, claimed: ['ach:a', 'daily:2026-11-19:x', 'ach:b', 'first_0'] } })).toBe(2);
  });
  it('unspent is derived and never negative', () => {
    const s = withRanks(at(2), { quick_feet: 3 });
    expect(pointsSpent(s.player)).toBe(3);
    expect(pointsFree(s.player)).toBe(0);
  });
});

describe('buying (the PoE-style rule)', () => {
  it('ring 1 is linked to the hub; a ring-2 node needs a linked owned node and SKILL_RING_GATE[1] points on ring 1 of its branch', () => {
    let s = at(10);
    expect(skillProblem(s.player, 'keen_eye')).toBe('unlinked');
    s = buyAll(s, ['steady_hands']);
    expect(skillProblem(s.player, 'keen_eye')).toBe('ring'); // 1 point on ring 1, needs 3
    expect(SKILL_RING_GATE[1]).toBe(3);
    s = buyAll(s, ['quick_feet', 'quick_feet', 'keen_eye']);
    expect(skillProblem(s.player, 'keen_eye')).toBeNull(); // rank 2: owned, gate holds
    expect(skillStats(s.player)).toMatchObject({ trayPlus: 1, roomWalkPct: 12, pourWindowPlus: 0.03 });
  });
  it('refuses unknown, maxed, coming-soon, no points; never mutates the old state', () => {
    const s = at(2);
    expect(skillProblem(s.player, 'nope')).toBe('unknown');
    expect(skillProblem(s.player, 'quick_simmer')).toBe('soon'); // live: false
    expect(buySkill(s, 'quick_simmer')).toBeNull();
    const one = buyAll(s, ['steady_hands']);
    expect(skillProblem(one.player, 'steady_hands')).toBe('maxed');
    expect(skillProblem(one.player, 'quick_feet')).toBe('points');
    expect(s.player.skills).toBeUndefined();
  });
  it('a keystone choice locks its pair; a capstone needs level 20 (checked on data, the nodes are not live yet)', () => {
    const ranks = { quick_feet: 3, steady_hands: 1, roomy_tavern: 2, patient_guests: 1, warm_welcome: 2, regulars_gem: 1, bustling_hall: 1 };
    expect(validBuild(ranks, 30)).toBe(true);
    expect(validBuild({ ...ranks, quiet_corner: 1 }, 30)).toBe(false); // both of one choice group
    expect(validBuild({ ...ranks, tavern_legend: 1 }, 19)).toBe(false); // level gate
    expect(validBuild({ ...ranks, tavern_legend: 1 }, 20)).toBe(true);
    const s = withRanks({ ...at(30) }, ranks);
    expect(skillProblem(s.player, 'quiet_corner')).toBe('soon'); // live check comes first
  });
});

describe('validBuild', () => {
  it('empty is valid; an orphan, a broken gate, a rank over max or an unknown id is not', () => {
    expect(validBuild({}, 1)).toBe(true);
    expect(validBuild({ keen_eye: 1 }, 30)).toBe(false); // not linked to anything owned
    expect(validBuild({ steady_hands: 1, keen_eye: 1 }, 30)).toBe(false); // ring gate 3
    expect(validBuild({ steady_hands: 1, quick_feet: 2, keen_eye: 1 }, 30)).toBe(true);
    expect(validBuild({ quick_feet: 4 }, 30)).toBe(false);
    expect(validBuild({ nope: 1 }, 30)).toBe(false);
    expect(validBuild({ hearth: 1 }, 30)).toBe(false);
  });
  it('a bridge is reachable from either side and has no ring gate', () => {
    const tavern = { quick_feet: 3, steady_hands: 1, keen_eye: 2, roomy_tavern: 1, wide_kegs: 1 };
    expect(validBuild(tavern, 10)).toBe(true);
    expect(validBuild({ ...tavern, fresh_tap: 1 }, 10)).toBe(true);
  });
});

describe('unlearn, undo and respec', () => {
  const build = (): GameState => buyAll(at(10, 0, 500), ['steady_hands', 'quick_feet', 'quick_feet', 'keen_eye']);
  it('only a leaf can be unlearned; it costs 10 gold x its ring through the ledger (reason respec); an undo is free', () => {
    const s = build();
    expect(unlearnProblem(s.player, 'steady_hands')).toBe('not_leaf'); // keen_eye hangs on it
    expect(unlearnProblem(s.player, 'quick_feet')).toBe('not_leaf'); // the ring-2 gate needs 3 on ring 1
    expect(unlearnProblem(s.player, 'thick_skin')).toBe('not_owned');
    expect(unlearnProblem(s.player, 'keen_eye')).toBeNull();
    const paid = unlearnSkill(s, 'keen_eye', 9)!;
    expect(paid.player.wallet.gold).toBe(500 - 20);
    expect(paid.ledger.at(-1)).toMatchObject({ reason: 'respec', goldDelta: -20 });
    expect(paid.player.skills!.ranks.keen_eye).toBeUndefined();
    const undone = unlearnSkill(s, 'keen_eye', 9, true)!;
    expect(undone.player.wallet.gold).toBe(500);
    expect(unlearnSkill(s, 'steady_hands', 9)).toBeNull();
    expect(unlearnSkill({ ...s, player: { ...s.player, wallet: { ...s.player.wallet, gold: 5 } } }, 'keen_eye', 9)).toBeNull();
  });
  it('the migration free reset goes first and does not count; then 3 free; then 25 gold x level', () => {
    let s = withRanks(at(10, 0, 1000), { quick_feet: 1 }, { freeReset: true });
    expect(respecCost(s.player)).toBe(0);
    s = respecSkills(s, 1)!;
    expect(s.player.skills).toEqual({ ranks: {}, respecs: 0, tree: 2 });
    for (let i = 0; i < SKILL_RESPEC_FREE; i++) {
      s = respecSkills(buyAll(s, ['quick_feet']), 1)!;
      expect(s.player.wallet.gold).toBe(1000);
    }
    expect(respecCost(s.player)).toBe(250);
    s = respecSkills(buyAll(s, ['quick_feet']), 1)!;
    expect(s.player.wallet.gold).toBe(750);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'respec', goldDelta: -250 });
    expect(respecSkills(s, 1)).toBeNull(); // nothing spent
  });
});

describe('the route preview (cheapestPath)', () => {
  it('finds the cheapest unowned road from the owned set, in buy order; owned = empty; unknown = null', () => {
    expect(cheapestPath({}, 'keen_eye')).toEqual({ path: ['steady_hands', 'keen_eye'], points: 2 });
    expect(cheapestPath({ steady_hands: 1 }, 'keen_eye')).toEqual({ path: ['keen_eye'], points: 1 });
    expect(cheapestPath({ steady_hands: 1 }, 'steady_hands')).toEqual({ path: [], points: 0 });
    expect(cheapestPath({}, 'nope')).toBeNull();
    const far = cheapestPath({}, 'tavern_legend')!;
    expect(far.path.at(-1)).toBe('tavern_legend');
    expect(far.path[0]).toMatch(/quick_feet|steady_hands/);
  });
  it('skips the other node of a taken choice group', () => {
    const r = cheapestPath({ quick_feet: 1, roomy_tavern: 1, warm_welcome: 1, bustling_hall: 1 }, 'tavern_legend')!;
    expect(r).toEqual({ path: ['tavern_legend'], points: 4 });
    expect(cheapestPath({ quick_feet: 1, patient_guests: 1, regulars_gem: 1, bustling_hall: 1 }, 'quiet_corner')).toBeNull();
  });
});

describe('the view for the panel', () => {
  it('lists every node with rank, next cost, ring gate, why it is locked and whether it can be unlearned', () => {
    const s = buyAll(at(4), ['steady_hands']);
    const v = skillsView(s.player, { undo: ['steady_hands'] });
    expect(v).toMatchObject({ version: 2, earned: 3, spent: 1, free: 2, freeReset: false, level: 4 });
    expect(v.nodes).toHaveLength(92);
    expect(v.branchSpent).toMatchObject({ tavern: 1, kitchen: 0 });
    expect(v.nodes.find((n) => n.id === 'steady_hands')).toMatchObject({ rank: 1, problem: 'maxed', unlearn: null, unlearnCost: 0, undo: true });
    expect(v.nodes.find((n) => n.id === 'keen_eye')).toMatchObject({ problem: 'ring', ringGate: 3, ringSpent: 1, nextCost: 1 });
    expect(v.nodes.find((n) => n.id === 'quick_simmer')!.problem).toBe('soon');
  });
});

describe('migration 42 -> 43 (the tree v2)', () => {
  const save = (skills: unknown, level = 8, xp = 450): string =>
    JSON.stringify({ version: 42, savedAt: 1, state: (() => { const s = at(level); return { ...s, player: { ...s.player, xp, skills } }; })() });
  const load = (text: string): GameState => {
    const r = readSave(text);
    if (!r.ok) throw new Error(r.problem);
    return r.state;
  };
  it('SAVE_VERSION is 43 and an old build that is valid on v2 keeps its ranks (clamped, unknown ids dropped) plus one free reset', () => {
    expect(SAVE_VERSION).toBe(43);
    const s = load(save({ ranks: { quick_feet: 5, steady_hands: 1, keen_eye: 1, gone_node: 2 }, respecs: 2 }));
    expect(s.player.skills).toEqual({ ranks: { quick_feet: 3, steady_hands: 1, keen_eye: 1 }, respecs: 2, tree: 2, freeReset: true });
    expect(respecCost(s.player)).toBe(0);
  });
  it('an old build that is not valid on v2 is cleared: 0 spent and every point free', () => {
    // MG-1 big_batch hung on roomy_tavern; on v2 it is a kitchen ring-2 node with no kitchen ring 1 owned.
    const s = load(save({ ranks: { quick_feet: 1, roomy_tavern: 1, big_batch: 1 }, respecs: 0 }));
    expect(s.player.skills).toEqual({ ranks: {}, respecs: 0, tree: 2, freeReset: true });
    expect(pointsFree(s.player)).toBe(pointsEarned(8, 0));
  });
  it('a save without skills stays without; earned >= spent always; level 12 with 1400 xp stays level 12', () => {
    const none = load(save(undefined));
    expect(none.player.skills).toBeUndefined();
    const top = load(save({ ranks: { thick_skin: 3 }, respecs: 0 }, 12, 1400));
    expect(top.player.level).toBe(12);
    expect(top.player.xp).toBe(1400);
    expect(pointsSpent(top.player)).toBeLessThanOrEqual(pointsEarned(top.player.level, top.player.bookRewards.length));
  });
  it('is idempotent and survives junk', () => {
    const once = migrateSkillsV2({ ranks: { quick_feet: 2 }, respecs: 1 }, 5);
    expect(migrateSkillsV2(once, 5)).toEqual(once);
    expect(migrateSkillsV2({ ranks: { quick_feet: 'x', thick_skin: -1, satchel: 1.7 }, respecs: -3 }, 5)).toEqual({ ranks: { satchel: 1 }, respecs: 0, tree: 2, freeReset: true });
    expect(migrateSkillsV2(null, 5)).toBeUndefined();
  });
});
