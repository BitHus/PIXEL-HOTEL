import { describe, expect, it } from 'vitest';
import { arrangeSlots, emptyBag, hotbarToBag, moveSlot, sortBag, stackBag, type SlotLayout } from './bag.ts';
import { BAG_SLOTS, HOTBAR_SLOTS } from './config.ts';

const hot = (...ids: (string | null)[]): (string | null)[] => [...ids, ...Array(6 - ids.length).fill(null)];
const tab = (...ids: (string | null)[]): (string | null)[] => [...ids, ...Array(BAG_SLOTS - ids.length).fill(null)];
const layout = (hotbar: (string | null)[], furniture: (string | null)[], materials: (string | null)[] = tab()): SlotLayout => ({
  hotbar,
  bag: { furniture, materials },
});

describe('arrangeSlots', () => {
  it('puts new types in the first free bag slots, BAG_SLOTS slots per tab', () => {
    const l = arrangeSlots({ hotbar: hot(), bag: emptyBag() }, ['chair', 'table'], ['wood', 'cloth']);
    expect(l.bag.furniture).toEqual(tab('chair', 'table'));
    expect(l.bag.materials).toEqual(tab('wood', 'cloth'));
    expect(l.bag.furniture).toHaveLength(36);
  });

  it('keeps every type in one slot: a hotbar type is not also in the bag', () => {
    const l = arrangeSlots(layout(hot('chair'), tab(null, 'chair', 'table')), ['chair', 'table'], []);
    expect(l.hotbar).toEqual(hot('chair'));
    expect(l.bag.furniture).toEqual(tab(null, null, 'table'));
  });

  it('keeps positions; types that are gone leave the bag but keep their hotbar slot', () => {
    const l = arrangeSlots(layout(hot(null, 'bed'), tab(null, 'rug', null, 'chair'), tab('wood', 'cloth')), ['chair'], ['cloth']);
    expect(l.hotbar).toEqual(hot(null, 'bed'));
    expect(l.bag.furniture).toEqual(tab(null, null, null, 'chair'));
    expect(l.bag.materials).toEqual(tab(null, 'cloth'));
  });

  it('merges duplicates and drops unknown hotbar types', () => {
    const l = arrangeSlots(layout(hot('nope', 'chair', 'chair'), tab('table', 'table')), ['chair', 'table'], []);
    expect(l.hotbar).toEqual(hot(null, 'chair'));
    expect(l.bag.furniture).toEqual(tab('table'));
  });

  it('grows a full tab by one slot instead of losing an item, and shrinks back', () => {
    const full = Array.from({ length: BAG_SLOTS }, (_, i) => `t${i}`);
    const l = arrangeSlots(layout(hot(), [...full]), [...full, 'chair'], []);
    expect(l.bag.furniture).toHaveLength(BAG_SLOTS + 1);
    expect(l.bag.furniture.at(-1)).toBe('chair');
    expect(arrangeSlots(l, full, []).bag.furniture).toHaveLength(BAG_SLOTS);
  });
});

describe('moveSlot', () => {
  const l = layout(hot('chair'), tab('table', null, 'rug'), tab('wood'));

  it('moves to an empty slot and swaps with a full one', () => {
    expect(moveSlot(l, { area: 'furniture', index: 0 }, { area: 'furniture', index: 1 })?.bag.furniture).toEqual(tab(null, 'table', 'rug'));
    const swapped = moveSlot(l, { area: 'furniture', index: 2 }, { area: 'hotbar', index: 0 })!;
    expect(swapped.hotbar).toEqual(hot('rug'));
    expect(swapped.bag.furniture).toEqual(tab('table', null, 'chair'));
  });

  it('refuses materials in the hotbar, an empty source and slots out of range', () => {
    expect(moveSlot(l, { area: 'materials', index: 0 }, { area: 'hotbar', index: 1 })).toBeNull();
    expect(moveSlot(l, { area: 'hotbar', index: 0 }, { area: 'materials', index: 1 })).toBeNull();
    expect(moveSlot(l, { area: 'hotbar', index: 3 }, { area: 'furniture', index: 1 })).toBeNull();
    expect(moveSlot(l, { area: 'hotbar', index: 0 }, { area: 'hotbar', index: 6 })).toBeNull();
  });

  it('does not change the layout it was given', () => {
    moveSlot(l, { area: 'furniture', index: 0 }, { area: 'hotbar', index: 1 });
    expect(l.hotbar).toEqual(hot('chair'));
  });

  it('hotbarToBag moves a hotbar stack to the first free bag slot', () => {
    const b = hotbarToBag(l, 0)!;
    expect(b.hotbar).toEqual(hot());
    expect(b.bag.furniture).toEqual(tab('table', 'chair', 'rug'));
    expect(hotbarToBag(l, 1)).toBeNull();
  });
});

describe('sort and stack', () => {
  it('sort puts the tab in catalog order and packs it', () => {
    const l = layout(hot(), tab(null, 'rug', null, 'chair', 'table'), tab(null, 'crystal', 'wood'));
    expect(sortBag(l, 'furniture').bag.furniture).toEqual(tab('chair', 'table', 'rug'));
    expect(sortBag(l, 'materials').bag.materials).toEqual(tab('wood', 'crystal'));
    expect(sortBag(l, 'furniture').bag.materials).toEqual(l.bag.materials);
  });

  it('stack merges equal items and closes gaps, keeping the order', () => {
    const l = layout(hot(), tab(null, 'rug', 'rug', null, 'chair'));
    expect(stackBag(l, 'furniture').bag.furniture).toEqual(tab('rug', 'chair'));
  });
});

describe('seeds in the hotbar (step 9b)', () => {
  const empty = { hotbar: Array<string | null>(HOTBAR_SLOTS).fill(null), bag: emptyBag() };
  it('a new seed type goes into a free hotbar slot; crops and food go to the Materials tab', () => {
    const l = arrangeSlots(empty, ['chair'], ['wood', 'turnip_seed', 'turnip', 'potato_stew']);
    expect(l.hotbar[0]).toBe('turnip_seed');
    expect(l.bag.materials.slice(0, 3)).toEqual(['wood', 'turnip', 'potato_stew']);
    expect(l.bag.furniture[0]).toBe('chair');
  });
  it('seeds move between the hotbar and the Materials tab; other materials never go in the hotbar', () => {
    const l = arrangeSlots(empty, ['chair'], ['wood', 'turnip_seed']);
    const back = hotbarToBag(l, 0)!;
    expect(back.hotbar[0]).toBeNull();
    expect(back.bag.materials).toContain('turnip_seed');
    const k = back.bag.materials.indexOf('turnip_seed');
    expect(moveSlot(back, { area: 'materials', index: k }, { area: 'hotbar', index: 2 })?.hotbar[2]).toBe('turnip_seed');
    expect(moveSlot(back, { area: 'materials', index: 0 }, { area: 'hotbar', index: 2 })).toBeNull();
    expect(moveSlot(back, { area: 'materials', index: k }, { area: 'furniture', index: 5 })).toBeNull();
    // A seed cannot swap with furniture into the Materials tab.
    const withChair = moveSlot(l, { area: 'furniture', index: 0 }, { area: 'hotbar', index: 1 })!;
    const sk = arrangeSlots(hotbarToBag(withChair, 0)!, ['chair'], ['wood', 'turnip_seed']);
    const seedAt = sk.bag.materials.indexOf('turnip_seed');
    expect(moveSlot(sk, { area: 'materials', index: seedAt }, { area: 'hotbar', index: 1 })).toBeNull();
  });
});
