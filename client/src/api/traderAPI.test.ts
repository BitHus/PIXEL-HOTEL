// Step S2: the trader through the GameAPI: the Sell tab's list, selling for gold with a popup list, refusals, the save, and NO AUTO SELLING
// (a clock that runs for hours, a full bag and a catch-up never sell anything; the sell rule has exactly one caller).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyChange, createNewPlayer, saveKey, toSaveText, type GameState, type Rng } from '@pixel-hotel/shared';
import { ledgerGold, ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

let t = 1000;
const clock = (): number => t;
const rng: Rng = () => 0.5;

function stocked(): GameState {
  const base = { ...createNewPlayer(undefined, 0), playerCreated: true };
  return applyChange(base, { reason: 'debug', materials: { copper_ore: 12, dirt: 3, iron_bar: 2, roasted_turnip: 2 }, addFurniture: ['bar_stool', 'bar_stool'] }, 0)!;
}

function open(state: GameState) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { api: LocalGameAPI.open(storage, clock, rng).api, storage };
}

describe('GameAPI trader', () => {
  it('lists what can be sold: no food, no placed things', async () => {
    const { api } = open(stocked());
    const rows = await api.getSellRows();
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(['copper_ore', 'dirt', 'iron_bar', 'bar_stool']));
    expect(rows.some((r) => r.id === 'roasted_turnip' || r.id === 'counter')).toBe(false);
  });

  it('sells one and all: gold in, things out, a gold popup, the ledger adds up', async () => {
    const { api } = open(stocked());
    const before = (await api.getPlayer()).wallet.gold;
    const unit = (await api.getSellRows()).find((r) => r.id === 'copper_ore')!.unit;
    const one = (await api.sell('material', 'copper_ore', 1))!;
    expect(one.gold).toBe(unit);
    expect(one.gains).toEqual([{ itemId: 'gold', count: unit, rank: 'common' }]);
    const all = (await api.sell('material', 'copper_ore', 11))!;
    expect(all.gold).toBe(unit * 11);
    const p = await api.getPlayer();
    expect(p.wallet.gold).toBe(before + unit * 12);
    expect(p.materials.copper_ore).toBeUndefined();
    const s = api.snapshot();
    expect(ledgerGold(s)).toBe(s.player.wallet.gold);
    expect(ledgerMaterials(s).copper_ore).toBeUndefined();
    expect(s.ledger.filter((e) => e.reason === 'sell')).toHaveLength(2);
  });

  it('sells a bag furniture piece but never a placed one, and refuses bad calls', async () => {
    const { api } = open(stocked());
    expect(await api.sell('furniture', 'bar_stool', 2)).not.toBeNull();
    expect(await api.sell('furniture', 'bar_stool', 1)).toBeNull(); // the bag is empty of them now
    expect(await api.sell('furniture', 'counter', 1)).toBeNull();
    expect(await api.sell('material', 'roasted_turnip', 1)).toBeNull();
    expect(await api.sell('material', 'dirt', 4)).toBeNull();
    expect(await api.sell('material', 'dirt', 0)).toBeNull();
    expect((await api.getPlayer()).materials.dirt).toBe(3);
  });

  it('is saved: a reload keeps the gold and the missing things', async () => {
    const { api, storage } = open(stocked());
    await api.sell('material', 'iron_bar', 2);
    const again = LocalGameAPI.open(storage, clock, rng).api;
    const p = await again.getPlayer();
    expect(p.materials.iron_bar).toBeUndefined();
    expect(p.materials.copper_ore).toBe(12);
  });
});

describe('no auto selling', () => {
  it('hours of clock ticks and a reload after a long break sell nothing', async () => {
    const { api, storage } = open(stocked());
    const gold = (await api.getPlayer()).wallet.gold;
    for (let i = 0; i < 200; i++) {
      t += 60_000;
      api.update();
    }
    const again = LocalGameAPI.open(storage, clock, rng).api;
    again.update();
    for (const a of [api, again]) {
      const s = a.snapshot();
      expect(s.ledger.some((e) => e.reason === 'sell')).toBe(false);
      expect(s.player.materials.copper_ore).toBe(12);
      expect(s.items.filter((i) => i.typeId === 'bar_stool' && i.roomId === null)).toHaveLength(2);
      expect(s.player.wallet.gold).toBeGreaterThanOrEqual(gold); // guests may pay; nothing was sold
    }
  });

  it('the sell rule has exactly one caller: the API method a tap reaches', () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
      });
    const files = [...walk(join(root, 'shared/src')), ...walk(join(root, 'client/src'))];
    const users = files.map((f) => f.split(String.fromCharCode(92)).join('/')).filter((f) => /(?<![.\w])sell\(\s*(?:h\.)?state\b/.test(readFileSync(f, 'utf8')) && !/shared\/src\/trader\.ts$/.test(f)).map((f) => f.slice(root.length + 1));
    expect(users).toEqual(['client/src/api/traderApi.ts']);
  });
});
