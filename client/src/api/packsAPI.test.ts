// Step BG8: packs through the GameAPI: opening, the bag, selling a spare, a refused buy, saving.
import { describe, expect, it } from 'vitest';
import { HINTS, PACKS, PACK_HINT, applyChange, createNewPlayer, saveKey, toSaveText, type GameState, type Rng } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;
/** The lowest roll every time: the first common item of a pool. */
const low: Rng = () => 0;

function fresh(gems: number): GameState {
  const base = { ...createNewPlayer(undefined, 0), playerCreated: true };
  return applyChange(base, { reason: 'debug', gems }, 0)!;
}

function open(state: GameState, rng: Rng = low) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { api: LocalGameAPI.open(storage, clock, rng).api, storage };
}

describe('GameAPI packs', () => {
  it('opens a blocks pack: gems out, blocks in the bag, popups list', async () => {
    const { api } = open(fresh(100));
    const r = (await api.openPack('random_blocks'))!;
    expect(r.finds).toHaveLength(PACKS.random_blocks.rolls);
    expect(r.gains.reduce((a, g) => a + g.count, 0)).toBe(PACKS.random_blocks.rolls);
    const p = await api.getPlayer();
    expect(p.wallet.gems).toBe(100 - PACKS.random_blocks.gemPrice);
    expect(p.materials.dirt).toBe(PACKS.random_blocks.rolls);
  });

  it('opening a pack finishes the pack quest when it shows (and pays its gems)', async () => {
    const { api } = open({ ...fresh(100), hintsDone: PACK_HINT });
    expect(await api.currentHint()).toBe(HINTS[PACK_HINT]);
    await api.openPack('random_blocks');
    expect(await api.currentHint()).toBeNull(); // the mine quest waits for level 3
    expect(api.snapshot().hintsDone).toBe(PACK_HINT + 1);
  });

  it('refuses with too few gems and changes nothing', async () => {
    const { api } = open(fresh(PACKS.rare_clothes.gemPrice - 1));
    expect(await api.openPack('rare_clothes')).toBeNull();
    expect(await api.openPack('nope')).toBeNull();
    expect((await api.getPlayer()).wallet.gems).toBe(PACKS.rare_clothes.gemPrice - 1);
  });

  it('a clothes pack unlocks the piece, keeps spares, and a spare can be sold', async () => {
    const { api } = open(fresh(100));
    const r = (await api.openPack('common_clothes'))!;
    expect(r.finds.map((f) => f.isNew)).toEqual([true, false, false]);
    let p = await api.getPlayer();
    expect(p.unlockedClothing).toEqual(['braids']);
    expect(p.clothingSpares).toEqual({ braids: 2 });
    const gold = p.wallet.gold;
    const paid = await api.sellSpare('braids', 1);
    expect(paid).toBeGreaterThan(0);
    p = await api.getPlayer();
    expect(p.wallet.gold).toBe(gold + paid!);
    expect(p.clothingSpares).toEqual({ braids: 1 });
    expect(await api.sellSpare('braids', 5)).toBeNull();
    expect(await api.sellSpare('short', 1)).toBeNull();
  });

  it('is saved: a reload keeps the pack, the spares and the counter', async () => {
    const { api, storage } = open(fresh(100));
    await api.openPack('common_clothes');
    const again = LocalGameAPI.open(storage, clock, low).api;
    const p = await again.getPlayer();
    expect(p.clothingSpares).toEqual({ braids: 2 });
    expect(p.packsOpened).toEqual({ common_clothes: 1 });
  });
});
