import { describe, expect, it } from 'vitest';
import { RUN_BAG_SLOTS } from '../config.ts';
import { getFurnitureType } from '../furniture.ts';
import { getMaterialType, isMaterialId } from '../materials.ts';
import { seededRng } from '../rng.ts';
import { ENEMY_TABLES, getLootTable, LOOT_TABLES, rankChances, rollDrop, rollLoot } from './loot.ts';
import { RANKS, rankOf } from '../ranks.ts';
import { RECIPES } from '../crafting.ts';
import type { MaterialId } from '../types.ts';
import { addToBag } from './runBag.ts';
import { emptyRunBag } from './run.ts';

describe('loot tables (section 10, ranks from step 9e)', () => {
  it('has the chest and boss tables and one table per enemy type; every item is gold, a material or crypt furniture', () => {
    expect(LOOT_TABLES.map((t) => t.id)).toEqual(['wooden_chest', 'golden_chest', 'boss', ...ENEMY_TABLES]);
    expect(getLootTable('wooden_chest').rolls).toBe(2);
    expect(getLootTable('golden_chest').rolls).toBe(3);
    for (const t of LOOT_TABLES) {
      for (const d of t.drops) {
        // A drop row's rank is the item's own rank (a pile of gold may be any rank).
        if (d.item !== 'gold') expect(d.rank, `${t.id} ${d.item}`).toBe(rankOf(d.item));
        if (d.item === 'gold' || isMaterialId(d.item)) continue;
        expect(getFurnitureType(d.item)).toMatchObject({ category: 'crypt_furniture', inCatalog: false });
      }
    }
  });

  it('every enemy type has its own table with exactly one new material per rank, worth more per rank', () => {
    const all = new Set<string>();
    for (const id of ENEMY_TABLES) {
      const t = getLootTable(id);
      expect(t.rolls).toBe(1);
      expect(t.drops.map((d) => d.rank)).toEqual(RANKS);
      const values = t.drops.map((d) => getMaterialType(d.item as MaterialId).baseValue);
      expect([...values].sort((a, b) => a - b)).toEqual(values);
      for (const d of t.drops) {
        expect(isMaterialId(d.item)).toBe(true);
        expect(all.has(d.item)).toBe(false);
        all.add(d.item);
        // At least one recipe uses the enemy's drops.
      }
      expect(RECIPES.some((r) => t.drops.some((d) => (r.inputs[d.item as MaterialId] ?? 0) > 0)), id).toBe(true);
    }
    expect(all.size).toBe(20);
  });

  const itemChance = (id: Parameters<typeof getLootTable>[0], pick: (item: string) => boolean): number => {
    const t = getLootTable(id);
    const ranks = rankChances(t);
    let p = 0;
    for (const r of RANKS) {
      const rows = t.drops.filter((d) => d.rank === r);
      const total = rows.reduce((a, d) => a + d.weight, 0);
      if (total > 0) p += (ranks[r] * rows.filter((d) => pick(d.item)).reduce((a, d) => a + d.weight, 0)) / total;
    }
    return p;
  };
  const crypt = (item: string) => item !== 'gold' && !isMaterialId(item);

  it('the base odds are 75 / 20 / 4.5 / 0.5; a rank a table does not have falls to the one below', () => {
    const slime = rankChances(getLootTable('slime'));
    expect(slime.common).toBeCloseTo(0.75, 3);
    expect(slime.rare).toBeCloseTo(0.2, 3);
    expect(slime.ultra_rare).toBeCloseTo(0.045, 3);
    expect(slime.legendary).toBeCloseTo(0.005, 3);
    // The wooden chest has no legendary row: those rolls give an ultra rare drop.
    const wooden = rankChances(getLootTable('wooden_chest'));
    expect(wooden.legendary).toBe(0);
    expect(wooden.ultra_rare).toBeCloseTo(0.05, 3);
    // The boss table only has throne pieces.
    expect(rankChances(getLootTable('boss')).ultra_rare).toBeCloseTo(1, 3);
  });

  it('golden chests, mimics and the Bone King shift the odds up', () => {
    for (const [better, base] of [['golden_chest', 'wooden_chest'], ['mimic', 'slime'], ['bone_king', 'mimic']] as const) {
      const a = rankChances(getLootTable(better));
      const b = rankChances(getLootTable(base));
      expect(a.common, better).toBeLessThan(b.common);
      expect(a.rare + a.ultra_rare + a.legendary).toBeGreaterThan(b.rare + b.ultra_rare + b.legendary);
      expect(a.ultra_rare + a.legendary).toBeGreaterThan(b.ultra_rare + b.legendary);
    }
    expect(rankChances(getLootTable('bone_king')).legendary).toBeGreaterThan(rankChances(getLootTable('mimic')).legendary);
  });

  it('wooden: mostly gold, then materials, 5% crypt furniture; golden: more crystal, about 11% furniture', () => {
    expect(itemChance('wooden_chest', (i) => i === 'gold')).toBeGreaterThan(0.5);
    expect(itemChance('wooden_chest', crypt)).toBeCloseTo(0.05, 3);
    expect(itemChance('golden_chest', crypt)).toBeGreaterThan(0.09);
    expect(itemChance('golden_chest', crypt)).toBeLessThan(0.13);
    expect(itemChance('golden_chest', (i) => i === 'crystal')).toBeGreaterThan(itemChance('wooden_chest', (i) => i === 'crystal'));
    expect(getLootTable('boss').drops).toEqual([{ item: 'throne_piece', min: 1, max: 2, weight: 1, rank: 'ultra_rare' }]);
  });

  it('the rolled ranks roughly match the odds over 20000 rolls, and amounts stay in min..max', () => {
    for (const t of LOOT_TABLES) {
      const rng = seededRng(99);
      const counts: Record<string, number> = {};
      const N = 20000;
      for (let k = 0; k < N; k++) {
        const l = rollDrop(t, rng);
        const d = t.drops.find((x) => x.item === l.item && x.rank === l.rank)!;
        expect(d).toBeDefined();
        expect(l.qty).toBeGreaterThanOrEqual(d.min);
        expect(l.qty).toBeLessThanOrEqual(d.max);
        counts[l.rank] = (counts[l.rank] ?? 0) + 1;
      }
      const want = rankChances(t);
      for (const r of RANKS) expect(Math.abs((counts[r] ?? 0) / N - want[r]), `${t.id} ${r}`).toBeLessThan(0.012);
    }
  });

  it('rollLoot rolls the table rolls times', () => {
    expect(rollLoot(getLootTable('golden_chest'), seededRng(1))).toHaveLength(3);
  });
});

describe('the run bag (section 10)', () => {
  it('stacks materials up to 10 per slot; gold takes no slot; each furniture item one slot', () => {
    const { bag } = addToBag(emptyRunBag(), [
      { item: 'bone', qty: 7 },
      { item: 'bone', qty: 6 },
      { item: 'gold', qty: 50 },
      { item: 'skull_lamp', qty: 1 },
      { item: 'skull_lamp', qty: 1 },
    ]);
    expect(bag.gold).toBe(50);
    expect(bag.slots).toEqual([
      { kind: 'material', id: 'bone', qty: 10 },
      { kind: 'material', id: 'bone', qty: 3 },
      { kind: 'furniture', typeId: 'skull_lamp' },
      { kind: 'furniture', typeId: 'skull_lamp' },
    ]);
  });

  it('never holds more than 12 slots; the rest is left behind', () => {
    const rng = seededRng(3);
    let bag = emptyRunBag();
    const left = [];
    for (let k = 0; k < 200; k++) {
      const r = addToBag(bag, rollLoot(getLootTable('golden_chest'), rng));
      bag = r.bag;
      left.push(...r.leftBehind);
      expect(bag.slots.length).toBeLessThanOrEqual(RUN_BAG_SLOTS);
    }
    expect(bag.slots).toHaveLength(12);
    expect(left.length).toBeGreaterThan(0);
    // A full bag still tops up a stack that has room.
    const full = addToBag({ slots: [{ kind: 'material', id: 'wood', qty: 4 }, ...Array(11).fill({ kind: 'furniture', typeId: 'wall_torch' })], gold: 0 }, [{ item: 'wood', qty: 8 }]);
    expect(full.bag.slots[0]).toEqual({ kind: 'material', id: 'wood', qty: 10 });
    expect(full.leftBehind).toEqual([{ kind: 'material', id: 'wood', qty: 2 }]);
  });
});
