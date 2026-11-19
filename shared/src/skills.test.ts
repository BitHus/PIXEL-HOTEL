// MG-1 (docs/PLAN-MINIGAMES.md 4, 6): skill points, the tree data, the stat helper and the 37 -> 38 migration.
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, SKILL_BOOK_MAX, SKILL_RESPEC_FREE, SKILL_RESPEC_GOLD, SKILL_TIER_STEP } from './config.ts';
import type { GameState } from './gameState.ts';
import { createNewPlayer } from './newPlayer.ts';
import { readSave } from './save.ts';
import { effective, mergeBonuses } from './stats.ts';
import {
  SKILL_BRANCHES,
  SKILL_NODES,
  branchSpent,
  buySkill,
  nextSkillCost,
  pointsEarned,
  pointsFree,
  pointsSpent,
  respecCost,
  respecSkills,
  skillProblem,
  skillStats,
  skillsView,
} from './skills.ts';

const at = (level: number, book = 0, gold = 500): GameState => {
  const s = createNewPlayer(undefined, 0);
  return { ...s, player: { ...s.player, level, bookRewards: Array.from({ length: book }, (_, i) => `tab:${i}`), wallet: { ...s.player.wallet, gold } } };
};
const buyAll = (s: GameState, ids: string[]): GameState => ids.reduce((acc, id) => buySkill(acc, id) ?? acc, s);

describe('the stat helper', () => {
  it('rank 0 (no bonus) is the base exactly; percent stats scale, the others add', () => {
    expect(effective(128, 'roomWalkPct', undefined)).toBe(128);
    expect(effective(128, 'roomWalkPct', {})).toBe(128);
    expect(effective(128, 'roomWalkPct', { roomWalkPct: 6 })).toBeCloseTo(135.68);
    expect(effective(30, 'maxHpPlus', { maxHpPlus: 3 })).toBe(33);
    expect(mergeBonuses({ maxHpPlus: 3 }, { maxHpPlus: 2, trayPlus: 1 }, undefined)).toEqual({ maxHpPlus: 5, trayPlus: 1 });
  });
});

describe('the tree data', () => {
  it('has 4 branches of 8 nodes, unique ids, 4 tiers, costs per rank, requires inside the branch and one tier up', () => {
    expect(new Set(SKILL_NODES.map((n) => n.id)).size).toBe(32);
    for (const b of SKILL_BRANCHES) {
      const nodes = SKILL_NODES.filter((n) => n.branch === b);
      expect(nodes, b).toHaveLength(8);
      for (const t of [1, 2, 3, 4]) expect(nodes.filter((n) => n.tier === t).length, `${b} tier ${t}`).toBe(2);
    }
    for (const n of SKILL_NODES) {
      expect(n.costs, n.id).toHaveLength(n.maxRank);
      expect(n.effects.length, n.id).toBeGreaterThan(0);
      for (const r of n.requires) {
        const req = SKILL_NODES.find((x) => x.id === r)!;
        expect(req.branch, n.id).toBe(n.branch);
        expect(req.tier, n.id).toBe(n.tier - 1);
      }
      if (n.tier === 1) expect(n.requires, n.id).toEqual([]);
    }
  });
  it('the points are fewer than the sum of all ranks (the player picks a build) and each branch has 4 useful picks for 5 points', () => {
    const all = SKILL_NODES.reduce((a, n) => a + n.costs.reduce((x, y) => x + y, 0), 0);
    expect(pointsEarned(12, SKILL_BOOK_MAX)).toBe(15);
    expect(pointsEarned(12, SKILL_BOOK_MAX)).toBeLessThan(all);
    for (const b of SKILL_BRANCHES) {
      const cheap = SKILL_NODES.filter((n) => n.branch === b && n.tier === 1).flatMap((n) => n.costs).sort((x, y) => x - y);
      expect(cheap.slice(0, 4).reduce((x, y) => x + y, 0), b).toBeLessThanOrEqual(5);
    }
  });
  it('no node adds gold directly', () => {
    for (const n of SKILL_NODES) for (const e of n.effects) expect(e.stat, n.id).not.toMatch(/gold|coin/i);
  });
});

describe('points', () => {
  it('1 per level from 2 plus 1 per Book reward taken, at most 4; a level 5 save has 4 free points', () => {
    expect(pointsEarned(1, 0)).toBe(0);
    expect(pointsEarned(2, 0)).toBe(1);
    expect(pointsEarned(5, 0)).toBe(4);
    expect(pointsEarned(8, 9)).toBe(7 + SKILL_BOOK_MAX);
    expect(pointsFree(at(5).player)).toBe(4);
    expect(pointsFree(at(1).player)).toBe(0);
  });
  it('unspent is derived and never negative, even if a cheaper level makes spent exceed earned', () => {
    const s = buyAll(at(5), ['quick_feet', 'quick_feet', 'quick_feet', 'steady_hands']);
    expect(pointsSpent(s.player)).toBe(4);
    expect(pointsFree(s.player)).toBe(0);
    expect(pointsFree({ ...s.player, level: 2 })).toBe(0);
  });
});

describe('buying', () => {
  it('rank 0 gives no bonus; a rank gives perRank; the cap stops it; maxed is refused', () => {
    const s0 = at(12, 4);
    expect(skillStats(s0.player)).toEqual({});
    let s = s0;
    for (let i = 0; i < 3; i++) s = buySkill(s, 'quick_feet')!;
    expect(skillStats(s.player)).toEqual({ roomWalkPct: 18 });
    expect(buySkill(s, 'quick_feet')).toBeNull();
    expect(skillProblem(s.player, 'quick_feet')).toBe('maxed');
  });
  it('caps hold: a node never gives more than its cap (and a negative stat never goes below it)', () => {
    for (const n of SKILL_NODES) {
      const ranks = { [n.id]: n.maxRank };
      const stats = skillStats({ skills: { ranks, respecs: 0 } }) as Record<string, number>;
      for (const e of n.effects) {
        if (e.cap === undefined) continue;
        if (e.perRank < 0) expect(stats[e.stat]!, n.id).toBeGreaterThanOrEqual(e.cap);
        else expect(stats[e.stat]!, n.id).toBeLessThanOrEqual(e.cap);
      }
    }
  });
  it('needs the points, the previous node and the branch spend of the tier', () => {
    const poor = at(2);
    expect(skillProblem(poor.player, 'quick_feet')).toBeNull();
    expect(skillProblem(at(1).player, 'quick_feet')).toBe('points');
    expect(skillProblem(poor.player, 'nope')).toBe('unknown');
    const rich = at(12, 4);
    expect(skillProblem(rich.player, 'roomy_tavern')).toBe('requires');
    let s = buySkill(rich, 'quick_feet')!;
    expect(skillProblem(s.player, 'roomy_tavern')).toBe('tier'); // 1 point in the branch, tier 2 needs SKILL_TIER_STEP
    s = buySkill(buySkill(s, 'quick_feet')!, 'quick_feet')!;
    expect(branchSpent(s.player, 'tavern')).toBe(3);
    expect(3).toBeGreaterThanOrEqual(SKILL_TIER_STEP);
    expect(skillProblem(s.player, 'roomy_tavern')).toBeNull();
    // another branch is not counted
    expect(skillProblem(buySkill(rich, 'thick_skin')!.player, 'sharp_edge')).toBe('tier');
  });
  it('costs the next rank and never mutates the old state', () => {
    const s = at(12, 4);
    const next = buySkill(s, 'roomy_tavern');
    expect(next).toBeNull();
    const a = buySkill(s, 'quick_feet')!;
    expect(s.player.skills).toBeUndefined();
    expect(a.player.skills).toEqual({ ranks: { quick_feet: 1 }, respecs: 0 });
    expect(nextSkillCost(a.player, 'quick_feet')).toBe(1);
    expect(nextSkillCost(buyAll(a, ['quick_feet', 'quick_feet']).player, 'quick_feet')).toBeNull();
  });
});

describe('respec', () => {
  it('the first 3 are free, then 100 gold through the ledger (reason respec); the points come back', () => {
    expect([SKILL_RESPEC_FREE, SKILL_RESPEC_GOLD]).toEqual([3, 100]);
    let s = buySkill(at(6, 0, 250), 'quick_feet')!;
    expect(respecSkills(at(6), 1)).toBeNull(); // nothing to take back
    for (let i = 0; i < 3; i++) {
      expect(respecCost(s.player)).toBe(0);
      s = respecSkills(s, 5)!;
      expect(pointsSpent(s.player)).toBe(0);
      expect(s.player.wallet.gold).toBe(250);
      s = buySkill(s, 'quick_feet')!;
    }
    expect(respecCost(s.player)).toBe(100);
    const paid = respecSkills(s, 9)!;
    expect(paid.player.wallet.gold).toBe(150);
    expect(paid.ledger.at(-1)).toMatchObject({ reason: 'respec', goldDelta: -100 });
    expect(paid.player.skills).toEqual({ ranks: {}, respecs: 4 });
    // not enough gold: refused, nothing changes
    const broke = { ...s, player: { ...s.player, wallet: { ...s.player.wallet, gold: 99 } } };
    expect(respecSkills(broke, 9)).toBeNull();
  });
});

describe('the view for the panel', () => {
  it('lists every node with rank, next cost and why it is locked', () => {
    const v = skillsView(buySkill(at(4), 'quick_feet')!.player);
    expect(v).toMatchObject({ earned: 3, spent: 1, free: 2, respecFree: 3, respecCost: 0 });
    expect(v.nodes).toHaveLength(32);
    expect(v.nodes.find((n) => n.id === 'quick_feet')).toMatchObject({ rank: 1, nextCost: 1, problem: null });
    expect(v.nodes.find((n) => n.id === 'roomy_tavern')).toMatchObject({ rank: 0, problem: 'tier' });
    expect(v.nodes.find((n) => n.id === 'thick_skin')).toMatchObject({ problem: null });
  });
});

describe('migration 37 -> 38 (Player.skills)', () => {
  const save = (version: number, mutate: (s: GameState) => unknown = (s) => s): string => JSON.stringify({ version, savedAt: 1, state: mutate(at(5)) });
  it('SAVE_VERSION is 41 (38 -> 39 the kitchen annex); an old save has no skills field (nothing bought) and keeps its derived points; nothing is lost', () => {
    expect(SAVE_VERSION).toBe(41);
    const r = readSave(save(37, (s) => ({ ...s, player: { ...s.player, skills: undefined } })));
    if (!r.ok) throw new Error(r.problem);
    expect(r.state.player.skills).toBeUndefined();
    expect(pointsFree(r.state.player)).toBe(4);
    expect(r.state.player.level).toBe(5);
  });
  it('is idempotent: a save that has skills keeps them', () => {
    const r = readSave(save(37, (s) => ({ ...s, player: { ...s.player, skills: { ranks: { quick_feet: 2 }, respecs: 1 } } })));
    if (!r.ok) throw new Error(r.problem);
    expect(r.state.player.skills).toEqual({ ranks: { quick_feet: 2 }, respecs: 1 });
    expect(pointsFree(r.state.player)).toBe(2);
  });
});
