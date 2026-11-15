import { describe, expect, it } from 'vitest';
import { ICON_SHAPES, iconKey, isIconShape, isValidIcon } from './icons.ts';
import { iconGroups } from './itemIcons.ts';
import { PALETTE, PALETTE_NAMES, isPaletteName, paletteColor } from './palette.ts';

describe('palette names', () => {
  it('has one name per palette colour, all different', () => {
    expect(PALETTE_NAMES.length).toBe(PALETTE.length);
    expect(new Set(PALETTE_NAMES).size).toBe(PALETTE.length);
    expect(paletteColor('outline')).toBe(PALETTE[6]);
    expect(isPaletteName('gold')).toBe(true);
    expect(isPaletteName('#ff0000')).toBe(false);
  });
});

describe('icon shapes', () => {
  it('are a fixed list without doubles, with the shapes BG4 to BG8 need', () => {
    expect(new Set(ICON_SHAPES).size).toBe(ICON_SHAPES.length);
    for (const s of ['seed', 'block', 'gem', 'ore', 'bar', 'fish', 'leaf', 'mushroom', 'log', 'potion', 'bread', 'mug', 'cloth', 'bone', 'boot', 'key', 'ring', 'sword', 'helmet', 'shirt', 'hat', 'plate', 'bottle', 'shell']) {
      expect(isIconShape(s)).toBe(true);
    }
  });
  it('isValidIcon checks shape and colours', () => {
    expect(isValidIcon({ shape: 'ore', colors: ['clay', 'orange'] })).toBe(true);
    expect(isValidIcon({ shape: 'nope', colors: ['clay'] })).toBe(false);
    expect(isValidIcon({ shape: 'ore', colors: ['#fff'] })).toBe(false);
    expect(isValidIcon({ shape: 'ore', colors: [] })).toBe(false);
    expect(isValidIcon(undefined)).toBe(false);
  });
});

describe('every item has an icon', () => {
  const groups = iconGroups();
  it('covers the groups', () => {
    for (const g of ['material', 'seed', 'crop', 'food', 'drink', 'fish', 'thing', 'furniture', 'clothing', 'gear', 'extra']) {
      expect(groups[g]?.length, g).toBeGreaterThan(0);
    }
  });
  for (const [group, items] of Object.entries(groups)) {
    it(`${group}: every icon is valid`, () => {
      for (const { id, icon } of items) expect(isValidIcon(icon), `${group}/${id}`).toBe(true);
    });
    it(`${group}: no two items share shape + colours`, () => {
      const seen = new Map<string, string>();
      for (const { id, icon } of items) {
        const key = iconKey(icon);
        expect(seen.get(key), `${group}/${id} = ${seen.get(key)}`).toBeUndefined();
        seen.set(key, id);
      }
    });
  }
});
