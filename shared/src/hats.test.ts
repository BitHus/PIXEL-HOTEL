import { describe, expect, it } from 'vitest';
import { CLOTHING, HATS, SLOT_FIELD, hatCatalogPrice, lookAllowed } from './clothing.ts';
import { buyHat } from './hats.ts';
import { createNewPlayer } from './newPlayer.ts';
import { BOOK_REWARDS } from './book.ts';
import { PACK_TYPES, packOdds, packPool } from './packs.ts';
import { RANKS } from './ranks.ts';

const HAT_SOURCES = ['catalog', 'book', 'fish', 'loot', 'splice', 'boss', 'sunken', 'mine'];

describe('hat data', () => {
  it('has 12 unique hats with a rank, a source and an unlock hint, none free, none in packs', () => {
    expect(HATS.length).toBe(12);
    expect(new Set(HATS.map((h) => h.id)).size).toBe(12);
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
