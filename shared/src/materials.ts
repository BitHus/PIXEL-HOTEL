// Stackable goods (brief sections 10 and 10b): the dungeon materials (shared/data/materials.json)
// plus the farm's seeds and crops (shared/data/crops.json) and food (shared/data/food.json). They all
// stack in Player.materials and the bag's Materials tab, can go on shop slots and go through the
// ledger. MaterialType.group tells them apart.

import materialData from '../data/materials.json';
import cropData from '../data/crops.json';
import foodData from '../data/food.json';
import type { CropId, FoodId, MaterialGroup, MaterialId, MaterialType, SeedId } from './types.ts';

/** A crop (crops.json): its seed, grow time and value. A seed with seedPrice null is not sold. */
export interface CropType {
  id: CropId;
  name: string;
  seed: SeedId;
  seedName: string;
  /** Catalog price of one seed, or null (glowcap: the spore only drops in the dungeon). */
  seedPrice: number | null;
  /** The seed's own value (shop goods). */
  seedValue: number;
  growMinutes: number;
  baseValue: number;
  color: number;
  seedColor: number;
}

export type FoodEffect =
  | { kind: 'heal'; amount: number }
  | { kind: 'attack'; amount: number }
  | { kind: 'max_hp'; amount: number }
  | { kind: 'attack_cooldown'; amount: number };

/** A food recipe (food.json): cooked at the farm's pot from crops. */
export interface FoodType {
  id: FoodId;
  name: string;
  inputs: Partial<Record<MaterialId, number>>;
  effect: FoodEffect;
  baseValue: number;
  color: number;
}

export const CROP_TYPES = cropData as CropType[];
export const FOOD_TYPES = foodData as FoodType[];

const base = (materialData as Omit<MaterialType, 'group'>[]).map((m): MaterialType => ({ ...m, group: 'material' }));

export const MATERIAL_TYPES: MaterialType[] = [
  ...base,
  ...CROP_TYPES.map((c): MaterialType => ({ id: c.seed, name: c.seedName, baseValue: c.seedValue, color: c.seedColor, group: 'seed' })),
  ...CROP_TYPES.map((c): MaterialType => ({ id: c.id, name: c.name, baseValue: c.baseValue, color: c.color, group: 'crop' })),
  ...FOOD_TYPES.map((f): MaterialType => ({ id: f.id, name: f.name, baseValue: f.baseValue, color: f.color, group: 'food' })),
];

const BY_ID = new Map(MATERIAL_TYPES.map((m) => [m.id, m]));

export function getMaterialType(id: MaterialId): MaterialType {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`unknown material ${id}`);
  return m;
}

export function isMaterialId(id: string): id is MaterialId {
  return BY_ID.has(id as MaterialId);
}

/** The group of a stackable good (material, seed, crop or food), or null for anything else. */
export function materialGroup(id: string): MaterialGroup | null {
  return BY_ID.get(id as MaterialId)?.group ?? null;
}

export function isSeedId(id: string): id is SeedId {
  return materialGroup(id) === 'seed';
}

export function isFoodId(id: string): id is FoodId {
  return materialGroup(id) === 'food';
}

/** The crop a seed grows into. */
export function cropOfSeed(seed: SeedId): CropType {
  const c = CROP_TYPES.find((x) => x.seed === seed);
  if (!c) throw new Error(`unknown seed ${seed}`);
  return c;
}

export function getCropType(id: CropId): CropType {
  const c = CROP_TYPES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown crop ${id}`);
  return c;
}

export function getFoodType(id: FoodId): FoodType {
  const f = FOOD_TYPES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown food ${id}`);
  return f;
}
