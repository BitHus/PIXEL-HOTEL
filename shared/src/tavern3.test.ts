// N1 content batch 1: tavern and suite decor (shared/data/furniture/tavern3.json).
import { describe, expect, it } from 'vitest';
import tavern3 from '../data/furniture/tavern3.json';
import { canCraft, craft, getRecipe } from './crafting.ts';
import { canPlace, FURNITURE_TYPES, getFurnitureType } from './furniture.ts';
import { createNewPlayer } from './newPlayer.ts';
import { createRoom } from './room.ts';
import { catalogPrice } from './economy.ts';
import type { GameState } from './gameState.ts';
import type { FurnitureItem, FurnitureType, MaterialId } from './types.ts';

const NEW = (tavern3 as FurnitureType[]).map((t) => t.id);
const T = getFurnitureType;

describe('N1 tavern3 furniture', () => {
  it('adds the 9 new types with unique ids', () => {
    expect(NEW).toEqual(['barrel_table', 'hanging_lantern', 'tankard_rack', 'dartboard', 'spice_bundle', 'antler_mount', 'window_curtains', 'writing_desk', 'potted_flowers']);
    const ids = FURNITURE_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has small appeal (1 to 3), rank rules and catalog flags', () => {
    for (const id of NEW) {
      const t = T(id);
      expect(t.appeal).toBeGreaterThanOrEqual(1);
      expect(t.appeal).toBeLessThanOrEqual(3);
      expect(['common', 'rare']).toContain(t.rank);
    }
    for (const id of ['spice_bundle', 'antler_mount']) expect(T(id).inCatalog).toBe(false);
    for (const id of NEW.filter((x) => !['spice_bundle', 'antler_mount'].includes(x))) {
      expect(T(id).inCatalog).toBe(true);
      expect(catalogPrice(id)).toBe(T(id).baseValue * 3);
    }
    expect(T('dartboard').rank).toBe('rare');
    expect(T('writing_desk').rank).toBe('rare');
  });

  it('follows the kinds: surfaces, riders, wall items, lights, placeIn', () => {
    expect(T('barrel_table')).toMatchObject({ surface: true, w: 32, d: 32, placeIn: 'shop' });
    expect(T('writing_desk')).toMatchObject({ surface: true, w: 64, d: 32, placeIn: 'hotel' });
    expect(T('potted_flowers')).toMatchObject({ onSurface: true, placeIn: 'both' });
    expect(T('window_curtains')).toMatchObject({ wall: true, w: 64, placeIn: 'both' });
    for (const id of ['hanging_lantern', 'tankard_rack', 'dartboard', 'spice_bundle', 'antler_mount']) {
      expect(T(id).wall).toBe(true);
      expect(T(id).placeIn).toBe('shop');
    }
    expect(T('hanging_lantern').light).toBeDefined();
    expect(T('dartboard').light).toBeUndefined();
    expect(T('dartboard').seats).toEqual([]);
  });

  it('wall pieces can hang along a back wall, floor pieces can stand, in a fitting room', () => {
    const shop = createRoom(2, 'shop', 1, 1);
    const hotel = createRoom(1, 'hotel', 1, 1);
    for (const id of NEW.filter((x) => T(x).wall)) {
      const room = T(id).placeIn === 'hotel' ? hotel : shop;
      expect(canPlace(room, [], T(id), 130, 0, 'down'), id).toBe(true);
    }
    expect(canPlace(hotel, [], T('window_curtains'), 130, 0, 'down')).toBe(true);
    expect(canPlace(hotel, [], T('dartboard'), 130, 0, 'down')).toBe(false); // tavern only
    const at = (typeId: string, x: number, y: number): FurnitureItem => ({ uid: 1, typeId, ownerId: 1, roomId: 2, x, y, facing: 'down', onItemUid: null });
    expect(canPlace(hotel, [], T('writing_desk'), 160, 160, 'down')).toBe(true);
    expect(canPlace(shop, [at('barrel_table', 144, 160)], T('barrel_table'), 144, 160, 'down')).toBe(false); // overlap
  });
});

describe('N1 recipes', () => {
  const have = (m: Partial<Record<MaterialId, number>>): GameState => {
    const s = createNewPlayer();
    return { ...s, player: { ...s.player, materials: m } };
  };

  it('spice bundle and antler mount are craftable from a fixed inventory, through the ledger', () => {
    const spice = getRecipe('spice_bundle');
    expect(canCraft(spice, have({ wood: 1, cloth: 1 }))).toBe(false);
    const s1 = craft(spice, have({ wood: 1, cloth: 1, turnip: 2 }), 5)!;
    expect(s1.player.materials).toEqual({});
    expect(s1.items.some((f) => f.typeId === 'spice_bundle')).toBe(true);
    const antler = craft(getRecipe('antler_mount'), have({ bone: 6, wood: 2 }), 5)!;
    expect(antler.items.some((f) => f.typeId === 'antler_mount')).toBe(true);
    expect(getRecipe('spice_bundle').makesKind).toBe('furniture');
  });
});
