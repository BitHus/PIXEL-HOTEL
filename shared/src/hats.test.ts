import { describe, expect, it } from 'vitest';
import { CLOTHING, HATS, SLOT_FIELD, hatCatalogPrice, lookAllowed } from './clothing.ts';
import { SKULL_CAP_KILLS, buyHat, earnedHats, grantEarnedHats } from './hats.ts';
import { addSeen, enemyKey } from './seen.ts';
import { startMine } from './dungeon/bank.ts';
import { FISH_TYPES } from './fish.ts';
import { createNewPlayer } from './newPlayer.ts';
import { BOOK_REWARDS } from './book.ts';
import { PACK_TYPES, packOdds, packPool } from './packs.ts';
import { RANKS } from './ranks.ts';

const HAT_SOURCES = ['catalog', 'book', 'fish', 'loot', 'splice', 'boss', 'sunken', 'mine'];

describe('hat data', () => {
  it('has 13 unique hats with a rank, a source and an unlock hint, none free, none in packs', () => {
    expect(HATS.length).toBe(13);
    expect(new Set(HATS.map((h) => h.id)).size).toBe(13);
    for (const h of HATS) {
      expect(h.free).toBe(false);
      expect(h.pack).toBe(false);
      expect(RANKS).toContain(h.rank);
      expect(HAT_SOURCES).toContain(h.source);
      expect(h.unlock && h.unlock.length > 0).toBe(true);
      expect(h.icon.shape).toBe('hat');
    }
    expect(SLOT_FIELD.hat).toBe('hat');
  });
  it('keeps hats out of the clothes pack pools', () => {
    const ids = packPool('clothing').map((i) => i.id);
    for (const h of HATS) expect(ids).not.toContain(h.id);
    expect(ids.length).toBe(CLOTHING.filter((c) => !c.free && c.slot !== 'hat').length);
    for (const p of PACK_TYPES.filter((x) => x.pool === 'clothing')) {
      for (const row of packOdds(p)) for (const it of row.items) expect(HATS.some((h) => h.id === it.id)).toBe(false);
    }
  });
  it('catalog hats cost baseValue * 3, others are not sold', () => {
    expect(hatCatalogPrice('straw_hat')).toBe(60);
    expect(hatCatalogPrice('feather_cap')).toBe(180);
    expect(hatCatalogPrice('gold_crown')).toBeNull();
    expect(hatCatalogPrice('short')).toBeNull();
  });
});

describe('wearing and buying hats', () => {
  const state = createNewPlayer(undefined, 0);
  it('a locked hat is not wearable, an owned one is', () => {
    expect(lookAllowed({ ...state.look, hat: 'straw_hat' }, [])).toBe(false);
    expect(lookAllowed({ ...state.look, hat: 'straw_hat' }, ['straw_hat'])).toBe(true);
    expect(lookAllowed({ ...state.look }, [])).toBe(true);
    expect(lookAllowed({ ...state.look, hat: 'nonsense' }, ['nonsense'])).toBe(false);
  });
  it('buys a catalog hat once, for gold', () => {
    const rich = { ...state, player: { ...state.player, wallet: { ...state.player.wallet, gold: 100 } } };
    const bought = buyHat(rich, 'wool_cap', 1)!;
    expect(bought.player.wallet.gold).toBe(40);
    expect(bought.player.unlockedClothing).toContain('wool_cap');
    expect(buyHat(bought, 'wool_cap', 2)).toBeNull();
    expect(buyHat(rich, 'feather_cap', 1)).toBeNull(); // 180 > 100 gold
    expect(buyHat(rich, 'gold_crown', 1)).toBeNull(); // not sold
  });
  it('the Book hands out the tavern keeper hat at 25% and the gold crown at 100%', () => {
    expect(BOOK_REWARDS.furniture[0]!.hat).toBe('tavern_keeper_hat');
    expect(BOOK_REWARDS.enemies[3]!.hat).toBe('gold_crown');
  });
});

describe('event hats', () => {
  const base = createNewPlayer(undefined, 0);
  const withSeen = (f: (m: typeof base.player.seen) => typeof base.player.seen) => ({ ...base, player: { ...base.player, seen: f(base.player.seen) } });

  it('a new player has earned none', () => {
    expect(earnedHats(base.player)).toEqual([]);
    expect(grantEarnedHats(base)).toBe(base);
  });
  it('a rare fish earns the fisher hat, a common fish does not', () => {
    const common = FISH_TYPES.find((f) => f.rank === 'common')!;
    const rare = FISH_TYPES.find((f) => f.rank === 'rare')!;
    expect(earnedHats(withSeen((m) => addSeen(m, common.id, 1, 1)).player)).toEqual([]);
    const got = grantEarnedHats(withSeen((m) => addSeen(m, rare.id, 1, 1)));
    expect(got.player.unlockedClothing).toContain('fisher_hat');
    // Granting twice does not make a spare.
    expect(grantEarnedHats(got)).toBe(got);
  });
  it('skeleton kills, the Bone King and the sunken crown', () => {
    expect(earnedHats(withSeen((m) => addSeen(m, enemyKey('skeleton'), SKULL_CAP_KILLS - 1, 1)).player)).toEqual([]);
    expect(earnedHats(withSeen((m) => addSeen(m, enemyKey('skeleton'), SKULL_CAP_KILLS, 1)).player)).toEqual(['skull_cap']);
    expect(earnedHats(withSeen((m) => addSeen(m, enemyKey('bone_king'), 1, 1)).player)).toEqual(['knight_helm']);
    expect(earnedHats(withSeen((m) => addSeen(m, 'sunken_crown', 1, 1)).player)).toEqual(['sunken_crown_hat']);
  });
  it('the 10th mine visit unlocks the miner lamp cap', () => {
    const s = { ...base, player: { ...base.player, level: 8, mineVisits: 8 } };
    const ninth = startMine(s, 1)!;
    expect(ninth.state.player.unlockedClothing).not.toContain('miner_lamp_cap');
    const tenth = startMine(ninth.state, 2)!;
    expect(tenth.state.player.mineVisits).toBe(10);
    expect(tenth.state.player.unlockedClothing).toContain('miner_lamp_cap');
  });
  it('a splice seed grows the flower crown, and harvesting unlocks it', () => {
    expect(HATS.find((h) => h.id === 'flower_crown')!.source).toBe('splice');
  });
});
