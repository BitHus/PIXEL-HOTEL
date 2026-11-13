import { describe, expect, it } from 'vitest';
import { RUN_BAG_SLOTS } from '../config.ts';
import { getFurnitureType } from '../furniture.ts';
import { isMaterialId } from '../materials.ts';
import { seededRng } from '../rng.ts';
import { getLootTable, LOOT_TABLES, rollDrop, rollLoot } from './loot.ts';
import { addToBag } from './runBag.ts';
import { emptyRunBag } from './run.ts';

describe('loot tables (section 10)', () => {
  it('has the four tables; every item is gold, a material or crypt furniture', () => {
    expect(LOOT_TABLES.map((t) => t.id)).toEqual(['wooden_chest', 'golden_chest', 'enemy_rare', 'boss']);
    expect(getLootTable('wooden_chest').rolls).toBe(2);
    expect(getLootTable('golden_chest').rolls).toBe(3);
    for (const t of LOOT_TABLES) {
      for (const d of t.drops) {
        if (d.item === 'gold' || isMaterialId(d.item)) continue;
        expect(getFurnitureType(d.item)).toMatchObject({ category: 'crypt_furniture', inCatalog: false });
      }
    }
  });

  const share = (id: Parameters<typeof getLootTable>[0], pick: (item: string) => boolean): number => {
    const t = getLootTable(id);
    return t.drops.filter((d) => pick(d.item)).reduce((a, d) => a + d.weight, 0) / t.drops.reduce((a, d) => a + d.weight, 0);
  };
  const crypt = (item: string) => item !== 'gold' && !isMaterialId(item);

  it('wooden: mostly gold, then materials, 3% crypt furniture; golden: more crystal, 10% furniture', () => {
    expect(share('wooden_chest', (i) => i === 'gold')).toBeGreaterThan(0.5);
    expect(share('wooden_chest', crypt)).toBeCloseTo(0.03);
    expect(share('golden_chest', crypt)).toBeCloseTo(0.1);
    expect(share('golden_chest', (i) => i === 'crystal')).toBeGreaterThan(share('wooden_chest', (i) => i === 'crystal'));
    expect(share('enemy_rare', (i) => i === 'crystal')).toBeCloseTo(0.7);
    expect(getLootTable('boss').drops).toEqual([{ item: 'throne_piece', min: 1, max: 2, weight: 1 }]);
  });

  it('weights roughly match over 10000 rolls, and amounts stay in min..max', () => {
    for (const t of LOOT_TABLES) {
      const rng = seededRng(99);
      const counts = new Map<string, number>();
      const N = 10000;
      for (let k = 0; k < N; k++) {
        const l = rollDrop(t, rng);
        const d = t.drops.find((x) => x.item === l.item)!;
        expect(l.qty).toBeGreaterThanOrEqual(d.min);
        expect(l.qty).toBeLessThanOrEqual(d.max);
        counts.set(l.item, (counts.get(l.item) ?? 0) + 1);
      }
      const total = t.drops.reduce((a, d) => a + d.weight, 0);
      for (const d of t.drops) expect(Math.abs((counts.get(d.item) ?? 0) / N - d.weight / total)).toBeLessThan(0.015);
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
