// Step S2: the trader. Rates, what lists and what never does, the confirm threshold, the ledger, the Book, no auto selling.
import { describe, expect, it } from 'vitest';
import { SELL_CONFIRM_QTY, SELL_HINT_STACKS, SELL_RATE, SPARE_SELL } from './config.ts';
import { CLOTHING } from './clothing.ts';
import { FOOD_TYPES, DRINK_TYPES, MATERIAL_TYPES, getMaterialType } from './materials.ts';
import { getFurnitureType } from './furniture.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { bagIsFilling, clothingSellPrice, furnitureSellPrice, materialSellPrice, sell, sellPrice, sellRows, sellWarning } from './trader.ts';
import { ledgerGold, ledgerMaterials } from './testState.ts';
import type { GameState } from './gameState.ts';
import type { MaterialId } from './types.ts';

const base = (): GameState => createNewPlayer(undefined, 0);
const give = (s: GameState, materials: Partial<Record<MaterialId, number>>, extra: { addFurniture?: string[]; addClothing?: string[] } = {}): GameState =>
  applyChange(s, { reason: 'debug', materials, ...extra }, 1)!;
const hidden = CLOTHING.find((c) => !c.free)!;

describe('prices', () => {
  it('pays baseValue * SELL_RATE, whole gold, at least 1', () => {
    expect(SELL_RATE).toBeGreaterThan(0);
    expect(SELL_RATE).toBeLessThan(1);
    expect(sellPrice(100)).toBe(Math.round(100 * SELL_RATE));
    expect(sellPrice(1)).toBe(1);
    for (const m of MATERIAL_TYPES) {
      const p = materialSellPrice(m.id);
      if (p === 0) continue;
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThan(m.baseValue + 1); // never above the value itself
    }
  });

  it('a spare piece of clothing keeps SPARE_SELL', () => {
    expect(clothingSellPrice(hidden.id)).toBe(Math.floor(hidden.baseValue * SPARE_SELL));
    expect(clothingSellPrice('short')).toBe(0); // a free starter piece
    expect(clothingSellPrice('nope')).toBe(0);
  });

  it('food and drinks are never bought (menu and lunch box goods)', () => {
    for (const f of FOOD_TYPES) expect(materialSellPrice(f.id)).toBe(0);
    for (const d of DRINK_TYPES) expect(materialSellPrice(d.id)).toBe(0);
  });

  it('the counter is never bought, a normal piece is', () => {
    expect(furnitureSellPrice('counter')).toBe(0);
    expect(furnitureSellPrice('bar_stool')).toBe(sellPrice(getFurnitureType('bar_stool').baseValue));
  });
});

describe('the list', () => {
  it('lists materials, bag furniture and spare clothes with a count and a unit price', () => {
    let s = give(base(), { copper_ore: 7 }, { addFurniture: ['bar_stool', 'bar_stool'], addClothing: [hidden.id, hidden.id] });
    const rows = sellRows(s);
    expect(rows.find((r) => r.id === 'copper_ore')).toMatchObject({ kind: 'material', count: 7, unit: materialSellPrice('copper_ore') });
    expect(rows.find((r) => r.id === 'bar_stool')).toMatchObject({ kind: 'furniture', count: 2 });
    expect(rows.find((r) => r.id === hidden.id)).toMatchObject({ kind: 'clothing', count: 1, unit: clothingSellPrice(hidden.id) }); // the first copy unlocked it
    s = give(s, { roasted_turnip: 3, root_ale: 2 });
    expect(sellRows(s).some((r) => r.id === 'roasted_turnip' || r.id === 'root_ale')).toBe(false);
  });

  it('never lists placed furniture or the counter, even in the bag', () => {
    const s = base();
    expect(sellRows(s).some((r) => r.kind === 'furniture')).toBe(false); // the start items are placed
    const counter = s.items.find((i) => i.typeId === 'counter')!;
    const odd = { ...s, items: s.items.map((i) => (i.uid === counter.uid ? { ...i, roomId: null } : i)) };
    expect(sellRows(odd).some((r) => r.id === 'counter')).toBe(false);
    expect(sell(odd, 'furniture', 'counter', 1, 5)).toBeNull();
  });

  it('marks what sits in the hotbar', () => {
    const s0 = give(base(), { copper_ore: 3 }, { addFurniture: ['bar_stool'] });
    const s = { ...s0, hotbar: ['bar_stool', null, ...s0.hotbar.slice(2)] };
    expect(sellRows(s).find((r) => r.id === 'bar_stool')!.inHotbar).toBe(true);
    expect(sellRows(s).find((r) => r.id === 'copper_ore')!.inHotbar).toBe(false);
  });

  it('the bag is filling at SELL_HINT_STACKS different sellable stacks', () => {
    const ids = MATERIAL_TYPES.filter((m) => materialSellPrice(m.id) > 0).map((m) => m.id);
    const few = Object.fromEntries(ids.slice(0, SELL_HINT_STACKS - 3).map((i) => [i, 1]));
    const many = Object.fromEntries(ids.slice(0, SELL_HINT_STACKS + 2).map((i) => [i, 1]));
    const zero = { ...base(), player: { ...base().player, materials: {} } };
    expect(bagIsFilling(give(zero, few))).toBe(false);
    expect(bagIsFilling(give(zero, many))).toBe(true);
  });
});

describe('selling', () => {
  it('sell 1 and sell all pay unit * qty through the ledger (reason sell) and give a gold popup', () => {
    const s0 = give(base(), { copper_ore: 7 });
    const unit = materialSellPrice('copper_ore');
    const one = sell(s0, 'material', 'copper_ore', 1, 10)!;
    expect(one.result.gold).toBe(unit);
    expect(one.result.gains).toEqual([{ itemId: 'gold', count: unit, rank: 'common' }]);
    expect(one.state.player.materials.copper_ore).toBe(6);
    expect(one.state.ledger.at(-1)).toMatchObject({ reason: 'sell', goldDelta: unit, materials: { copper_ore: -1 } });
    const all = sell(one.state, 'material', 'copper_ore', 6, 11)!;
    expect(all.state.player.materials.copper_ore).toBeUndefined();
    expect(all.state.player.wallet.gold).toBe(s0.player.wallet.gold + unit * 7);
    expect(ledgerGold(all.state)).toBe(all.state.player.wallet.gold);
    expect(ledgerMaterials(all.state).copper_ore).toBeUndefined();
  });

  it('sells unplaced furniture and spare clothes', () => {
    const s0 = give(base(), {}, { addFurniture: ['bar_stool', 'bar_stool', 'bar_stool'], addClothing: [hidden.id, hidden.id, hidden.id] });
    const f = sell(s0, 'furniture', 'bar_stool', 2, 5)!;
    expect(f.result.gold).toBe(2 * furnitureSellPrice('bar_stool'));
    expect(f.state.items.filter((i) => i.typeId === 'bar_stool' && i.roomId === null)).toHaveLength(1);
    const c = sell(s0, 'clothing', hidden.id, 2, 5)!;
    expect(c.state.player.clothingSpares[hidden.id]).toBeUndefined();
    expect(c.result.gold).toBe(2 * clothingSellPrice(hidden.id));
    expect(ledgerGold(c.state)).toBe(c.state.player.wallet.gold);
    expect(sell(s0, 'clothing', hidden.id, 3, 5)).toBeNull(); // only two spares
  });

  it('refuses what it should and changes nothing', () => {
    const s = give(base(), { copper_ore: 2, roasted_turnip: 2 });
    expect(sell(s, 'material', 'copper_ore', 3, 5)).toBeNull();
    expect(sell(s, 'material', 'copper_ore', 0, 5)).toBeNull();
    expect(sell(s, 'material', 'copper_ore', -1, 5)).toBeNull();
    expect(sell(s, 'material', 'copper_ore', 1.5, 5)).toBeNull();
    expect(sell(s, 'material', 'roasted_turnip', 1, 5)).toBeNull(); // food
    expect(sell(s, 'material', 'nope', 1, 5)).toBeNull();
    expect(sell(s, 'furniture', 'nope', 1, 5)).toBeNull();
    expect(sell(s, 'furniture', 'bar_stool', 1, 5)).toBeNull(); // none in the bag
    expect(sell(s, 'clothing', 'short', 1, 5)).toBeNull();
  });

  it('is not a find: the Book is untouched', () => {
    const s = give(base(), { copper_ore: 4 });
    const after = sell(s, 'material', 'copper_ore', 4, 9)!.state;
    expect(after.player.seen).toEqual(s.player.seen);
  });

  it('is deterministic: the same call twice gives the same state', () => {
    const s = give(base(), { copper_ore: 4 });
    expect(sell(s, 'material', 'copper_ore', 2, 9)!.state).toEqual(sell(s, 'material', 'copper_ore', 2, 9)!.state);
  });
});

describe('when it asks first', () => {
  it('more than SELL_CONFIRM_QTY pieces, ultra rare and legendary, hotbar things', () => {
    const common = { rank: 'common' as const, inHotbar: false };
    expect(sellWarning(common, SELL_CONFIRM_QTY)).toBeNull();
    expect(sellWarning(common, SELL_CONFIRM_QTY + 1)).toBe('many');
    expect(sellWarning({ rank: 'rare', inHotbar: false }, 1)).toBeNull();
    expect(sellWarning({ rank: 'ultra_rare', inHotbar: false }, 1)).toBe('rare');
    expect(sellWarning({ rank: 'legendary', inHotbar: false }, 1)).toBe('rare');
    expect(sellWarning({ rank: 'common', inHotbar: true }, 1)).toBe('hotbar');
  });

  it('every real ultra rare or legendary row warns for one piece', () => {
    for (const m of MATERIAL_TYPES) {
      if (materialSellPrice(m.id) === 0) continue;
      const w = sellWarning({ rank: m.rank, inHotbar: false }, 1);
      expect(w === 'rare').toBe(m.rank === 'ultra_rare' || m.rank === 'legendary');
      expect(getMaterialType(m.id).rank).toBe(m.rank);
    }
  });
});
