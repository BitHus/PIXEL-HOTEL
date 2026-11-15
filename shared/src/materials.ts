// Stackable goods (brief sections 10 and 10b): the dungeon materials (shared/data/materials.json)
// plus the farm's seeds and crops (shared/data/crops.json) and food (shared/data/food.json). They all
// stack in Player.materials and the bag's Materials tab, can go on shop slots and go through the
// ledger. MaterialType.group tells them apart.

import materialData from '../data/materials.json';
import cropData from '../data/crops.json';
import foodData from '../data/food.json';
import drinkData from '../data/drinks.json';
import { CATCH_TYPES } from './fish.ts';
import { BLOCK_TYPES } from './blockTypes.ts';
import { SPLICE_SEEDS } from './spliceData.ts';
import type { Icon } from './icons.ts';
import { RIPEN } from './config/ripen.ts';
import type { BaseDrinkId, CropId, DrinkId, DrinkTier, FoodId, MaterialGroup, MaterialId, MaterialType, Rank, SeedId } from './types.ts';

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
  /** The square icons of the crop and of its seed (step BG2). */
  icon: Icon;
  seedIcon: Icon;
  /** The rank of the crop and of its seed (step 9e). */
  rank: Rank;
}

export type FoodEffect =
  | { kind: 'heal'; amount: number }
  | { kind: 'attack'; amount: number }
  | { kind: 'max_hp'; amount: number }
  | { kind: 'attack_cooldown'; amount: number };

/** A food recipe (food.json): cooked on a stove in the tavern from crops (step K1). */
export interface FoodType {
  id: FoodId;
  name: string;
  inputs: Partial<Record<MaterialId, number>>;
  effect: FoodEffect;
  baseValue: number;
  color: number;
  icon: Icon;
  rank: Rank;
  /** Time for one batch on a stove, ms (real time); without it config COOK_MS by rank. */
  cookMs?: number;
}

/** A drink (drinks.json, step 9t): brewed in a brewing barrel from crops, in real time. */
export interface DrinkType {
  id: DrinkId;
  /** Set on an aged or vintage tier: the plain drink it ripens from. */
  baseId?: BaseDrinkId;
  tier?: DrinkTier;
  name: string;
  inputs: Partial<Record<MaterialId, number>>;
  /** Brewing time in minutes of real time. */
  minutes: number;
  /** Mugs one brew gives. */
  mugs: number;
  /** The value of one mug. */
  baseValue: number;
  /** Extra coins a guest leaves, as a share of the price (the glowcap tonic). */
  tip: number;
  color: number;
  icon: Icon;
  rank: Rank;
}

export const CROP_TYPES = cropData as CropType[];
/** The drinks a barrel brews (fresh). */
export const DRINK_TYPES = drinkData as DrinkType[];

const RANK_LADDER: readonly Rank[] = ['common', 'rare', 'ultra_rare', 'legendary'];
function nextRank(r: Rank): Rank {
  return RANK_LADDER[Math.min(RANK_LADDER.length - 1, RANK_LADDER.indexOf(r) + 1)]!;
}

/** The aged and vintage item of every drink, built from drinks.json (never hand-copied): same icon and brew data, value and tip by RIPEN, vintage one rank up. */
export const TIER_DRINK_TYPES: DrinkType[] = DRINK_TYPES.flatMap((d) =>
  RIPEN.map((r): DrinkType => ({
    ...d,
    id: `${d.id as BaseDrinkId}_${r.tier}`,
    baseId: d.id as BaseDrinkId,
    tier: r.tier,
    name: `${r.tier === 'aged' ? 'Aged' : 'Vintage'} ${d.name.charAt(0).toLowerCase()}${d.name.slice(1)}`,
    baseValue: Math.round(d.baseValue * r.valueMult),
    tip: d.tip * r.tipMult,
    rank: r.tier === 'vintage' ? nextRank(d.rank) : d.rank,
  })),
);
export const FOOD_TYPES = foodData as FoodType[];

const base = (materialData as Omit<MaterialType, 'group'>[]).map((m): MaterialType => ({ ...m, group: 'material' }));

export const MATERIAL_TYPES: MaterialType[] = [
  ...base,
  // The blocks (step BG5): placed in a cell, punched out again.
  ...BLOCK_TYPES.map((b): MaterialType => ({ id: b.id, name: b.name, baseValue: b.baseValue, color: 0, icon: b.icon, rank: b.rank, group: 'block' })),
  // Every block has a seed (step BG6): the same two colours on the seed shape, a little cheaper than the block.
  ...BLOCK_TYPES.map((b): MaterialType => ({
    id: `${b.id}_seed` as SeedId,
    name: `${b.name.replace(/ block$/, '')} seed`,
    baseValue: Math.max(1, Math.round(b.baseValue / 2)),
    color: 0,
    icon: { shape: 'seed', colors: b.icon.colors },
    rank: b.rank,
    group: 'seed',
  })),
  // The seeds only splicing makes (step BG7).
  ...SPLICE_SEEDS.map((s): MaterialType => ({ id: s.id, name: s.name, baseValue: s.baseValue, color: 0, icon: s.icon, rank: s.rank, group: 'seed' })),
  ...CROP_TYPES.map((c): MaterialType => ({ id: c.seed, name: c.seedName, baseValue: c.seedValue, color: c.seedColor, icon: c.seedIcon, rank: c.rank, group: 'seed' })),
  ...CROP_TYPES.map((c): MaterialType => ({ id: c.id, name: c.name, baseValue: c.baseValue, color: c.color, icon: c.icon, rank: c.rank, group: 'crop' })),
  ...FOOD_TYPES.map((f): MaterialType => ({ id: f.id, name: f.name, baseValue: f.baseValue, color: f.color, icon: f.icon, rank: f.rank, group: 'food' })),
  ...[...DRINK_TYPES, ...TIER_DRINK_TYPES].map((d): MaterialType => ({ id: d.id, name: d.name, baseValue: d.baseValue, color: d.color, icon: d.icon, rank: d.rank, group: 'drink' })),
  // The lakeside's catches (step 9f): fish and the things fished up.
  ...CATCH_TYPES.map((c): MaterialType => ({ id: c.id, name: c.name, baseValue: c.baseValue, color: c.color, icon: c.icon, rank: c.rank, group: c.kind })),
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

/** The crop a seed grows into (a crop seed only: block seeds grow blocks, see seeds in farm.ts). */
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

export function isDrinkId(id: string): id is DrinkId {
  return materialGroup(id) === 'drink';
}

/** True for the plain drinks a barrel brews (not an aged or vintage item). */
export function isBaseDrinkId(id: string): id is BaseDrinkId {
  return DRINK_TYPES.some((d) => d.id === id);
}

export function getDrinkType(id: DrinkId): DrinkType {
  const d = DRINK_TYPES.find((x) => x.id === id) ?? TIER_DRINK_TYPES.find((x) => x.id === id);
  if (!d) throw new Error(`unknown drink ${id}`);
  return d;
}
