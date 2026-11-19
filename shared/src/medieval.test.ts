// C17b: the five medieval pieces (shared/data/furniture/medieval.json). Art follows from art-src/staging/furniture-r3.
import { describe, expect, it } from 'vitest';
import medieval from '../data/furniture/medieval.json';
import { catalogPrice } from './economy.ts';
import { canPlace, FURNITURE_TYPES, getFurnitureType as T } from './furniture.ts';
import { createRoom } from './room.ts';
import type { FurnitureType } from './types.ts';

const IDS = (medieval as FurnitureType[]).map((t) => t.id);

describe('medieval furniture', () => {
  it('has the five ids, unique across all furniture', () => {
    expect(IDS).toEqual(['trestle_table', 'keg_stack', 'iron_chandelier', 'weapon_rack', 'anvil']);
    const ids = FURNITURE_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('sizes match the staged art (width in px = footprint width)', () => {
    expect(T('trestle_table')).toMatchObject({ w: 96, d: 32, surface: true, blocks: true, placeIn: 'shop' });
    expect(T('keg_stack')).toMatchObject({ w: 32, d: 32, placeIn: 'shop' });
    expect(T('iron_chandelier')).toMatchObject({ w: 40, wall: true, blocks: false, placeIn: 'shop' });
    expect(T('iron_chandelier').light).toBeDefined();
    expect(T('weapon_rack')).toMatchObject({ w: 64, d: 32, placeIn: 'both' });
    expect(T('anvil')).toMatchObject({ w: 32, d: 32, placeIn: 'both' });
    for (const id of IDS) expect(T(id).facings).toEqual(['down']);
  });
  it('appeal 1 to 3, common or rare, catalog price = baseValue * 3', () => {
    for (const id of IDS) {
      const t = T(id);
      expect(t.appeal).toBeGreaterThanOrEqual(1);
      expect(t.appeal).toBeLessThanOrEqual(3);
      expect(['common', 'rare']).toContain(t.rank);
      expect(t.inCatalog).toBe(true);
      expect(catalogPrice(id)).toBe(t.baseValue * 3);
    }
  });
  it('can be placed in a fitting room', () => {
    const shop = createRoom(2, 'shop', 1, 1);
    const hotel = createRoom(1, 'hotel', 1, 1);
    expect(canPlace(shop, [], T('iron_chandelier'), 200, 0, 'down')).toBe(true);
    expect(canPlace(hotel, [], T('iron_chandelier'), 200, 0, 'down')).toBe(false);
    expect(canPlace(hotel, [], T('anvil'), 144, 160, 'down')).toBe(true);
    expect(canPlace(hotel, [], T('weapon_rack'), 160, 160, 'down')).toBe(true);
  });
});
