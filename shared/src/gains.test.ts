import { describe, expect, it } from 'vitest';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { gain, gainsFromRunEvents, gainsSince, mergeGains } from './gains.ts';
import type { RunEvent } from './dungeon/run.ts';

describe('mergeGains', () => {
  it('adds the same item and rank together, keeps the order, and drops empty counts', () => {
    const list = mergeGains([gain('wood', 2), gain('bone', 1)], [gain('wood', 3), gain('bone', 0), gain('bone', -2)]);
    expect(list).toEqual([
      { itemId: 'wood', count: 5, rank: 'common' },
      { itemId: 'bone', count: 1, rank: 'common' },
    ]);
  });

  it('keeps different ranks of one item apart, and does not change its inputs', () => {
    const a = [{ itemId: 'crystal', count: 1, rank: 'rare' as const }];
    const out = mergeGains(a, [{ itemId: 'crystal', count: 1, rank: 'legendary' as const }], a);
    expect(out).toEqual([
      { itemId: 'crystal', count: 2, rank: 'rare' },
      { itemId: 'crystal', count: 1, rank: 'legendary' },
    ]);
    expect(a[0]!.count).toBe(1);
    expect(mergeGains()).toEqual([]);
  });

  it('gain() takes the item type\'s rank unless one is given', () => {
    expect(gain('wood').rank).toBe('common');
    expect(gain('wood', 1, 'rare').rank).toBe('rare');
  });
});

describe('gainsSince (the ledger entries written between two states)', () => {
  const start = createNewPlayer(undefined, 0);

  it('lists materials and furniture that came in, not what was used or the gold', () => {
    const next = applyChange(start, { reason: 'craft', gold: -5, materials: { wood: -2, cloth: 1 }, addFurniture: ['chair'] }, 1)!;
    expect(gainsSince(start, next)).toEqual([
      { itemId: 'cloth', count: 1, rank: 'common' },
      { itemId: 'chair', count: 1, rank: 'common' },
    ]);
  });

  it('adds several changes together and is empty when nothing came in', () => {
    const a = applyChange(start, { reason: 'chop', materials: { wood: 2 } }, 1)!;
    const b = applyChange(a, { reason: 'chop', materials: { wood: 1 } }, 2)!;
    expect(gainsSince(start, b)).toEqual([{ itemId: 'wood', count: 3, rank: 'common' }]);
    expect(gainsSince(b, b)).toEqual([]);
    expect(gainsSince(start, applyChange(start, { reason: 'dungeon_key', gold: -10 }, 1)!)).toEqual([]);
  });

  it('banking a run and the lunch box are not gains (they were shown already)', () => {
    const banked = applyChange(start, { reason: 'dungeon_bank', materials: { bone: 5 }, addFurniture: ['chair'] }, 1)!;
    expect(gainsSince(start, banked)).toEqual([]);
    const lunch = applyChange(start, { reason: 'lunch_box', materials: { wood: 1 } }, 1)!;
    expect(gainsSince(start, lunch)).toEqual([]);
  });
});

describe('gainsFromRunEvents (dungeon and mine)', () => {
  it('lists loot events with their rolled rank, merged', () => {
    const events: RunEvent[] = [
      { t: 'hit', enemyId: 1, damage: 4 },
      { t: 'loot', item: 'bone', qty: 2 },
      { t: 'loot', item: 'bone', qty: 1 },
      { t: 'loot', item: 'crystal', qty: 1, rank: 'ultra_rare' },
      { t: 'loot', item: 'wall_torch', qty: 1 },
    ];
    expect(gainsFromRunEvents(events)).toEqual([
      { itemId: 'bone', count: 3, rank: 'common' },
      { itemId: 'crystal', count: 1, rank: 'ultra_rare' },
      { itemId: 'wall_torch', count: 1, rank: expect.any(String) },
    ]);
    expect(gainsFromRunEvents([])).toEqual([]);
  });

  it('gold in a loot event is not a gain', () => {
    expect(gainsFromRunEvents([{ t: 'loot', item: 'gold', qty: 31, rank: 'rare' }, { t: 'loot', item: 'bone', qty: 1 }])).toEqual([{ itemId: 'bone', count: 1, rank: 'common' }]);
  });

  it('takes away what was left behind (full bag), a whole entry if nothing fit', () => {
    const events: RunEvent[] = [
      { t: 'loot', item: 'bone', qty: 4 },
      { t: 'left_behind', item: { kind: 'material', id: 'bone', qty: 1 } },
      { t: 'loot', item: 'wall_torch', qty: 1 },
      { t: 'left_behind', item: { kind: 'furniture', typeId: 'wall_torch' } },
    ];
    expect(gainsFromRunEvents(events)).toEqual([{ itemId: 'bone', count: 3, rank: 'common' }]);
  });
});
