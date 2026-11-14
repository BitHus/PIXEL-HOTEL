import { describe, expect, it } from 'vitest';
import { AXE_COOLDOWN_MS, RANK_WEIGHTS, TREE_HITS, TREE_REGROW_MS, TREE_WOOD_MAX, TREE_WOOD_MIN } from './config.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import type { GameState } from './gameState.ts';
import { TREE_COUNT } from './lakeLayout.ts';
import { chop, emptyLakeside, fellLoot, growTrees, isStump, regrowInMs, TREE_RANK_DROPS } from './woodcut.ts';

const fresh = (): GameState => createNewPlayer(undefined, 0);

/** Swings at tree 0 every AXE_COOLDOWN_MS until it falls. Returns the state and the time of the felling swing. */
function fell(s: GameState, start: number, rng = seededRng(1)): { state: GameState; at: number } {
  let t = start;
  for (let k = 0; k < 20; k++, t += AXE_COOLDOWN_MS) {
    const r = chop(s, 0, t, rng)!;
    s = r.state;
    if (r.result.kind === 'felled') return { state: s, at: t };
  }
  throw new Error('never fell');
}

describe('woodcutting (section 10d, step 9f)', () => {
  it('there are 8 whole trees at the start', () => {
    expect(TREE_COUNT).toBe(8);
    expect(fresh().lakeside.trees).toHaveLength(8);
    expect(emptyLakeside(4).trees.every((t) => t.hits === 0 && t.felledAt === null)).toBe(true);
  });

  it('a tree falls after 5 hits of one tap each, gives 2 to 3 wood, and leaves a stump', () => {
    let s = fresh();
    const wood = s.player.materials.wood ?? 0;
    const rng = seededRng(2);
    let t = 1000;
    for (let hit = 1; hit < TREE_HITS; hit++, t += AXE_COOLDOWN_MS) {
      const r = chop(s, 0, t, rng)!;
      expect(r.result).toEqual({ kind: 'hit', hits: hit });
      s = r.state;
    }
    const r = chop(s, 0, t, rng)!;
    expect(r.result.kind).toBe('felled');
    const got = r.result.loot!.wood!;
    expect(got).toBeGreaterThanOrEqual(TREE_WOOD_MIN);
    expect(got).toBeLessThanOrEqual(TREE_WOOD_MAX);
    expect(r.state.player.materials.wood).toBe(wood + got);
    expect(r.state.ledger[r.state.ledger.length - 1]).toMatchObject({ reason: 'chop' });
    expect(isStump(r.state.lakeside.trees[0]!, t)).toBe(true);
    // The other trees are untouched.
    expect(r.state.lakeside.trees.slice(1).every((x) => x.hits === 0 && x.felledAt === null)).toBe(true);
  });

  it('taps during the 400 ms axe cooldown are ignored and change nothing', () => {
    const s0 = fresh();
    const a = chop(s0, 0, 1000, seededRng(3))!;
    expect(a.result.kind).toBe('hit');
    for (const dt of [0, 100, 399]) {
      const b = chop(a.state, 0, 1000 + dt, seededRng(3))!;
      expect(b.result.kind).toBe('cooldown');
      expect(b.state.lakeside.trees[0]!.hits).toBe(1);
      expect(b.state.lakeside.axeReadyAt).toBe(1000 + AXE_COOLDOWN_MS);
    }
    expect(chop(a.state, 0, 1000 + AXE_COOLDOWN_MS, seededRng(3))!.result).toEqual({ kind: 'hit', hits: 2 });
  });

  it('the steel axe counts double: a tree falls after 3 swings', () => {
    let s: GameState = { ...fresh(), player: { ...fresh().player, gear: ['steel_axe'] } };
    const rng = seededRng(4);
    const kinds: string[] = [];
    for (let k = 0; k < 3; k++) {
      const r = chop(s, 0, 1000 + k * AXE_COOLDOWN_MS, rng)!;
      kinds.push(r.result.kind);
      s = r.state;
    }
    expect(kinds).toEqual(['hit', 'hit', 'felled']);
  });

  it('a stump grows back after exactly 5 minutes of real time, also when the game was closed', () => {
    const { state, at } = fell(fresh(), 1000);
    const tree = state.lakeside.trees[0]!;
    expect(tree.felledAt).toBe(at);
    expect(regrowInMs(tree, at)).toBe(TREE_REGROW_MS);
    expect(regrowInMs(tree, at + 60_000)).toBe(TREE_REGROW_MS - 60_000);
    // Still a stump: a swing does nothing.
    const early = chop(state, 0, at + TREE_REGROW_MS - 1, seededRng(5))!;
    expect(early.result.kind).toBe('regrowing');
    expect(early.state.player.materials).toEqual(state.player.materials);
    expect(isStump(tree, at + TREE_REGROW_MS - 1)).toBe(true);
    // Whole again at the time (nothing ran in between: only the clock changed).
    expect(isStump(tree, at + TREE_REGROW_MS)).toBe(false);
    expect(regrowInMs(tree, at + TREE_REGROW_MS)).toBeNull();
    const later = growTrees(state.lakeside, at + 8 * 3600_000);
    expect(later.trees[0]).toEqual({ hits: 0, felledAt: null });
    // And it can be felled again.
    const again = chop(state, 0, at + TREE_REGROW_MS, seededRng(6))!;
    expect(again.result).toEqual({ kind: 'hit', hits: 1 });
    // The trees that were not felled stay as they are.
    expect(growTrees(fresh().lakeside, 5).trees).toEqual(fresh().lakeside.trees);
  });

  it('only the felled tree is a stump; another tree can be cut meanwhile', () => {
    const { state, at } = fell(fresh(), 1000);
    expect(chop(state, 1, at + AXE_COOLDOWN_MS, seededRng(7))!.result.kind).toBe('hit');
    expect(chop(state, 99, at, seededRng(7))).toBeNull();
    expect(chop(state, -1, at, seededRng(7))).toBeNull();
  });

  it('a felled tree gives the rank drops by RANK_WEIGHTS: resin, amber, golden acorn', () => {
    expect(TREE_RANK_DROPS).toEqual({ rare: 'resin', ultra_rare: 'amber', legendary: 'golden_acorn' });
    const rng = seededRng(8);
    const n: Record<string, number> = {};
    const N = 40000;
    for (let i = 0; i < N; i++) {
      const loot = fellLoot(rng);
      for (const id of ['resin', 'amber', 'golden_acorn']) if (loot[id as 'resin']) n[id] = (n[id] ?? 0) + 1;
      expect(loot.wood).toBeGreaterThanOrEqual(TREE_WOOD_MIN);
      expect(Object.keys(loot).filter((k) => k !== 'wood').length).toBeLessThanOrEqual(1);
    }
    expect(n.resin! / N).toBeCloseTo(RANK_WEIGHTS.rare / 100, 1);
    expect(n.amber! / N).toBeCloseTo(RANK_WEIGHTS.ultra_rare / 100, 1);
    expect(n.golden_acorn! / N).toBeGreaterThan(0);
    expect(n.golden_acorn! / N).toBeLessThan(0.015);
  });

  it('what a tree gives counts in the Book through the ledger', () => {
    let s = fresh();
    const seen = Object.keys(s.player.seen);
    expect(seen).not.toContain('resin');
    s = applyChange(s, { reason: 'chop', materials: { resin: 1 } }, 5)!;
    expect(s.player.seen.resin).toEqual({ count: 1, firstSeenAt: 5 });
  });
});
