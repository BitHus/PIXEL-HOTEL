// Step BG8: packs bought with gems. The data, the odds shown on the card, openPack (odds over many rolls, duplicates
// become spares and never unlock twice, a refused buy changes nothing), selling spares, the ledger, the Book,
// migration 18 -> 19.
import { describe, expect, it } from 'vitest';
import { PACKS, RANK_WEIGHTS, SAVE_VERSION } from './config.ts';
import { BLOCK_TYPES } from './blockTypes.ts';
import { CLOTHING } from './clothing.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import { isValidIcon } from './icons.ts';
import { applyChange } from './ledger.ts';
import { MATERIAL_TYPES } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { PACK_TYPES, copiesOwned, getPack, openPack, packOdds, packPool, piecesMissing } from './packs.ts';
import { RANKS } from './ranks.ts';
import { readSave, toSaveText } from './save.ts';
import { seededRng } from './rng.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';
import type { Rank, Rng } from './types.ts';

/** An rng that returns these numbers in turn (then the last one forever). */
const seq = (...v: number[]): Rng => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)]!;
};

const withGems = (n: number): GameState => applyChange(createNewPlayer(undefined, 1), { reason: 'debug', gems: n }, 1)!;
const ledgerGems = (s: GameState): number => s.ledger.reduce((a, e) => a + (e.gemsDelta ?? 0), 0);

describe('the pack data', () => {
  it('has the four packs of v1 with a price, rolls, a pool and a valid icon', () => {
    expect(PACK_TYPES.map((p) => p.id)).toEqual(['random_blocks', 'basic_seeds', 'common_clothes', 'rare_clothes']);
    for (const p of PACK_TYPES) {
      expect(p.gemPrice).toBe(PACKS[p.id].gemPrice);
      expect(p.gemPrice).toBeGreaterThan(0);
      expect(p.rolls).toBeGreaterThan(0);
      expect(isValidIcon(p.icon)).toBe(true);
      expect(packPool(p.pool).length).toBeGreaterThan(0);
    }
    expect(getPack('nope')).toBeUndefined();
  });

  it('the clothes pools hold only hidden pieces, every piece has a rank and a value, and no id clashes with an item', () => {
    for (const c of CLOTHING) {
      expect(RANKS).toContain(c.rank);
      expect(c.baseValue).toBeGreaterThan(0);
      expect(isValidIcon(c.icon)).toBe(true);
    }
    const pool = packPool('clothing');
    expect(pool.length).toBeGreaterThanOrEqual(15);
    for (const i of pool) expect(CLOTHING.find((c) => c.id === i.id)!.free).toBe(false);
    const ids = new Set([...MATERIAL_TYPES.map((m) => m.id as string), ...FURNITURE_TYPES.map((f) => f.id)]);
    for (const c of CLOTHING) expect(ids.has(c.id)).toBe(false);
    expect(new Set(CLOTHING.map((c) => c.id)).size).toBe(CLOTHING.length);
  });

  it('the pools have something for every rank the packs can roll (nothing falls through by accident)', () => {
    for (const rank of RANKS) expect(packPool('clothing').some((i) => i.rank === rank)).toBe(true);
    expect(packPool('blocks').length).toBe(BLOCK_TYPES.filter((b) => !b.spliceOnly).length); // SG3a: splice-only blocks never come from a pack
  });
});

describe('packOdds (the card)', () => {
  it('adds up to 100 percent and lists every possible thing', () => {
    for (const p of PACK_TYPES) {
      const odds = packOdds(p);
      expect(odds.reduce((a, r) => a + r.percent, 0)).toBeCloseTo(100, 6);
      expect(odds.flatMap((r) => r.items).length).toBeGreaterThan(0);
      for (const r of odds) for (const i of r.items) expect(i.rank).toBe(r.rank);
    }
  });

  it('is RANK_WEIGHTS times the pack multiplier', () => {
    const rare = Object.fromEntries(packOdds(getPack('rare_clothes')!).map((r) => [r.rank, r.percent]));
    const total = RANK_WEIGHTS.rare + RANK_WEIGHTS.ultra_rare + RANK_WEIGHTS.legendary;
    expect(rare.common).toBeUndefined();
    expect(rare.rare).toBeCloseTo((RANK_WEIGHTS.rare / total) * 100, 6);
    expect(rare.legendary).toBeCloseTo((RANK_WEIGHTS.legendary / total) * 100, 6);
    const common = Object.fromEntries(packOdds(getPack('common_clothes')!).map((r) => [r.rank, r.percent]));
    expect(common.common).toBeCloseTo((RANK_WEIGHTS.common / (RANK_WEIGHTS.common + RANK_WEIGHTS.rare * 0.5)) * 100, 6);
  });

  it('passes the chance of a rank with no item on to the next lower rank, like openPack does', () => {
    // The blocks pack asks for legendary (weight 0 there), the seeds pack never rolls above rare.
    const seeds = packOdds(getPack('basic_seeds')!);
    expect(seeds.map((r) => r.rank)).toEqual(['common', 'rare']);
  });
});

describe('openPack: the odds over many packs', () => {
  it.each(PACK_TYPES.map((p) => p.id))('%s: the rank of every find matches the card', (id) => {
    const pack = getPack(id)!;
    const base = withGems(1_000_000);
    const rng = seededRng(1234);
    const n = 3000;
    const count: Record<Rank, number> = { common: 0, rare: 0, ultra_rare: 0, legendary: 0 };
    for (let i = 0; i < n; i++) for (const f of openPack(base, id, rng, 2)!.finds) count[f.rank]++;
    const rolls = n * pack.rolls;
    for (const row of packOdds(pack)) expect(count[row.rank] / rolls).toBeCloseTo(row.percent / 100, 1);
    for (const r of RANKS) if (!packOdds(pack).some((row) => row.rank === r)) expect(count[r]).toBe(0);
  });

  it('a fixed rng gives a fixed result: the lowest roll is the first common item', () => {
    const r = openPack(withGems(100), 'common_clothes', seq(0, 0), 2)!;
    expect(r.finds).toHaveLength(PACKS.common_clothes.rolls);
    for (const f of r.finds) expect(f).toMatchObject({ id: 'braids', rank: 'common', kind: 'clothing' });
  });

  it('a block pack gives blocks and a seeds pack gives seeds, stacked in materials', () => {
    const sum = (s: GameState): number => Object.values(s.player.materials).reduce((a, n) => a + (n ?? 0), 0);
    const before = withGems(100);
    const blocks = openPack(before, 'random_blocks', seededRng(5), 2)!;
    expect(blocks.finds.every((f) => f.kind === 'material' && BLOCK_TYPES.some((b) => b.id === f.id))).toBe(true);
    expect(sum(blocks.state) - sum(before)).toBe(PACKS.random_blocks.rolls);
    const seeds = openPack(withGems(100), 'basic_seeds', seededRng(6), 2)!;
    expect(seeds.finds.every((f) => f.id.endsWith('_seed') || f.id === 'glowcap_spore')).toBe(true);
  });
});

describe('openPack: the buy', () => {
  it('takes the gems and gives the items, all in the ledger', () => {
    const start = withGems(100);
    const r = openPack(start, 'random_blocks', seededRng(9), 5)!;
    expect(r.state.player.wallet.gems).toBe(100 - PACKS.random_blocks.gemPrice);
    expect(ledgerGems(r.state)).toBe(r.state.player.wallet.gems);
    expect(ledgerGold(r.state)).toBe(r.state.player.wallet.gold);
    const entry = r.state.ledger[r.state.ledger.length - 1]!;
    expect(entry).toMatchObject({ reason: 'pack', gemsDelta: -PACKS.random_blocks.gemPrice, goldDelta: 0 });
    // The materials in the ledger are the wallet's materials; the pack's share is the finds.
    expect(ledgerMaterials(r.state)).toEqual(r.state.player.materials);
    const given = Object.values(entry.materials ?? {}).reduce((a, n) => a + (n ?? 0), 0);
    expect(given).toBe(PACKS.random_blocks.rolls);
    expect(r.gains.reduce((a, g) => a + g.count, 0)).toBe(PACKS.random_blocks.rolls);
    expect(r.state.player.packsOpened).toEqual({ random_blocks: 1 });
  });

  it('refuses without changing anything: too few gems, an unknown pack', () => {
    const poor = withGems(PACKS.common_clothes.gemPrice - 1);
    const snapshot = JSON.stringify(poor);
    expect(openPack(poor, 'common_clothes', seededRng(1), 2)).toBeNull();
    expect(openPack(poor, 'no_such_pack', seededRng(1), 2)).toBeNull();
    expect(JSON.stringify(poor)).toBe(snapshot);
    expect(openPack(createNewPlayer(undefined, 1), 'random_blocks', seededRng(1), 2)).toBeNull();
  });

  it('exactly enough gems works and leaves 0', () => {
    const r = openPack(withGems(PACKS.basic_seeds.gemPrice), 'basic_seeds', seededRng(1), 2)!;
    expect(r.state.player.wallet.gems).toBe(0);
  });
});

describe('duplicates: spares', () => {
  it('the first copy unlocks the piece, the next ones are spares (also inside one pack)', () => {
    const r = openPack(withGems(100), 'common_clothes', seq(0, 0), 2)!;
    const p = r.state.player;
    expect(p.unlockedClothing).toEqual(['braids']);
    expect(p.clothingSpares).toEqual({ braids: PACKS.common_clothes.rolls - 1 });
    expect(r.finds.map((f) => [f.isNew, f.copies])).toEqual([[true, 1], [false, 2], [false, 3]]);
    expect(copiesOwned(p, 'braids')).toBe(PACKS.common_clothes.rolls);
    expect(copiesOwned(p, 'bob')).toBe(0);
  });

  it('a piece already owned never unlocks twice and its spare count grows by one per extra copy', () => {
    const once = openPack(withGems(500), 'common_clothes', seq(0, 0), 2)!.state;
    const again = openPack(once, 'common_clothes', seq(0, 0), 3)!.state;
    expect(again.player.unlockedClothing.filter((id) => id === 'braids')).toHaveLength(1);
    expect(again.player.clothingSpares.braids).toBe(2 * (PACKS.common_clothes.rolls) - 1);
    expect(again.player.packsOpened.common_clothes).toBe(2);
  });

  it('the popup list says what came: the clothing id with its count and rank', () => {
    const r = openPack(withGems(100), 'common_clothes', seq(0, 0), 2)!;
    expect(r.gains).toEqual([{ itemId: 'braids', count: PACKS.common_clothes.rolls, rank: 'common' }]);
  });

  it('piecesMissing counts what the pack can still give', () => {
    const fresh = createNewPlayer(undefined, 1).player;
    const pack = getPack('common_clothes')!;
    const total = packOdds(pack).flatMap((r) => r.items).length;
    expect(piecesMissing(fresh, pack)).toEqual({ missing: total, total });
    const got = openPack(withGems(100), 'common_clothes', seq(0, 0), 2)!.state.player;
    expect(piecesMissing(got, pack).missing).toBe(total - 1);
    expect(piecesMissing(got, getPack('random_blocks')!)).toEqual({ missing: 0, total: 0 });
  });
});

describe('the Book', () => {
  it('counts every pack find as found, clothes too (spares add to the count)', () => {
    const r = openPack(withGems(100), 'common_clothes', seq(0, 0), 7)!;
    expect(r.state.player.seen.braids).toEqual({ count: PACKS.common_clothes.rolls, firstSeenAt: 7 });
    const b = openPack(withGems(100), 'random_blocks', seededRng(3), 8)!;
    for (const f of b.finds) expect(b.state.player.seen[f.id]?.count).toBeGreaterThan(0);
    const s = openPack(withGems(100), 'basic_seeds', seededRng(4), 9)!;
    for (const f of s.finds) expect(s.state.player.seen[f.id]?.count).toBeGreaterThan(0);
  });
});

describe('migration 18 -> 19', () => {
  it('gives an old save no spares and no opened packs', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(19);
    const now = createNewPlayer(undefined, 1);
    const { clothingSpares: _a, packsOpened: _b, ...oldPlayer } = now.player;
    const r = readSave(JSON.stringify({ version: 18, savedAt: 9, state: { ...now, player: oldPlayer } }));
    expect(r).toMatchObject({ ok: true, migrated: true });
    if (r.ok) expect(r.state.player).toMatchObject({ clothingSpares: {}, packsOpened: {} });
  });

  it('a current save keeps its spares and its counter', () => {
    const s = openPack(withGems(100), 'common_clothes', seq(0, 0), 2)!.state;
    const r = readSave(toSaveText(s, 5));
    if (!r.ok) throw new Error('load');
    expect(r.state.player.clothingSpares).toEqual(s.player.clothingSpares);
    expect(r.state.player.packsOpened).toEqual({ common_clothes: 1 });
  });
});
