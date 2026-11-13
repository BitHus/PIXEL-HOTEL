// The farm (brief section 10b, step 9b): soil plots at fixed places (farmLayout.ts), crops that grow
// in real time in 3 stages (sprout, half, ripe; times in shared/data/crops.json), planting seeds and
// harvesting 1 to 2 crops. Pure: the time and the rng are passed in, no Date.now. Seeds, planting and
// harvesting go through applyChange (the ledger). Growth only needs plantedAt, so it goes on while
// the game is closed and survives a save and reload.

import { HARVEST_MAX, HARVEST_MIN, type RoomLevel } from './config.ts';
import { farmPlotCount } from './farmLayout.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { CROP_TYPES, cropOfSeed, getCropType, isSeedId, type CropType } from './materials.ts';
import { rngInt } from './rng.ts';
import type { CropId, Rng, SeedId } from './types.ts';

/** One soil plot: empty (crop null) or growing since plantedAt (ms, the same clock as `now`). */
export interface Plot {
  crop: CropId | null;
  plantedAt: number;
}

export interface FarmState {
  roomId: number;
  /** One per plot of the farm's level, in FARM_PLOTS order. */
  plots: Plot[];
}

export type CropStage = 'sprout' | 'half' | 'ripe';

export const EMPTY_PLOT: Plot = { crop: null, plantedAt: 0 };

/** A new farm: all plots of the level empty. */
export function emptyFarm(roomId: number, level: RoomLevel = 1): FarmState {
  return { roomId, plots: Array.from({ length: farmPlotCount(level) }, () => ({ ...EMPTY_PLOT })) };
}

/** The farm's plots for a new level: the old ones stay as they are, the new ones are empty. */
export function growPlots(farm: FarmState, level: RoomLevel): FarmState {
  const plots = farm.plots.map((p) => ({ ...p }));
  while (plots.length < farmPlotCount(level)) plots.push({ ...EMPTY_PLOT });
  return { ...farm, plots };
}

/** How long a crop takes to be ripe, ms. */
export function growMs(crop: CropId): number {
  return getCropType(crop).growMinutes * 60_000;
}

/** Plants a seed on an empty plot. Null if the plot already has a crop or it is not a seed. */
export function plant(plot: Plot, seed: SeedId, now: number): Plot | null {
  if (plot.crop !== null || !isSeedId(seed)) return null;
  return { crop: cropOfSeed(seed).id, plantedAt: now };
}

/** The crop's stage: sprout for the first half of its time, half until ripe, then ripe. Null when empty. */
export function stageOf(plot: Plot, now: number): CropStage | null {
  if (plot.crop === null) return null;
  const t = now - plot.plantedAt;
  const total = growMs(plot.crop);
  if (t >= total) return 'ripe';
  return t >= total / 2 ? 'half' : 'sprout';
}

/** ms until the crop is ripe (0 when ripe), or null when empty. */
export function ripeInMs(plot: Plot, now: number): number | null {
  if (plot.crop === null) return null;
  return Math.max(0, plot.plantedAt + growMs(plot.crop) - now);
}

export interface Harvest {
  plot: Plot;
  crop: CropId;
  qty: number;
}

/** Harvests a ripe plot: HARVEST_MIN to HARVEST_MAX crops, the plot is empty again. Null if not ripe. */
export function harvest(plot: Plot, now: number, rng: Rng): Harvest | null {
  if (plot.crop === null || stageOf(plot, now) !== 'ripe') return null;
  return { plot: { ...EMPTY_PLOT }, crop: plot.crop, qty: rngInt(rng, HARVEST_MIN, HARVEST_MAX) };
}

function setPlot(state: GameState, index: number, plot: Plot): GameState {
  return { ...state, farm: { ...state.farm, plots: state.farm.plots.map((p, i) => (i === index ? plot : p)) } };
}

/** Plants one of the player's seeds on plot `index` (ledger reason 'plant'). Null if it cannot. */
export function plantPlot(state: GameState, index: number, seed: SeedId, at: number): GameState | null {
  const plot = state.farm.plots[index];
  const planted = plot ? plant(plot, seed, at) : null;
  if (!planted) return null;
  const paid = applyChange(state, { reason: 'plant', materials: { [seed]: -1 }, note: `planted ${seed}` }, at);
  return paid && setPlot(paid, index, planted);
}

/** Harvests plot `index` into the bag (ledger reason 'harvest'). Null if it is not ripe. */
export function harvestPlot(state: GameState, index: number, at: number, rng: Rng): { state: GameState; harvest: Harvest } | null {
  const plot = state.farm.plots[index];
  const h = plot ? harvest(plot, at, rng) : null;
  if (!h) return null;
  const got = applyChange(state, { reason: 'harvest', materials: { [h.crop]: h.qty }, note: `harvested ${h.crop}` }, at);
  return got && { state: setPlot(got, index, h.plot), harvest: h };
}

/** The crops whose seeds are sold in the catalog (Seeds tab). */
export function seedsForSale(): CropType[] {
  return CROP_TYPES.filter((c) => c.seedPrice !== null);
}

/** Buys `qty` seeds of a crop (ledger reason 'seeds'). Null if not for sale or the gold is short. */
export function buySeeds(state: GameState, seed: SeedId, qty: number, at: number): GameState | null {
  const crop = CROP_TYPES.find((c) => c.seed === seed);
  if (!crop || crop.seedPrice === null || !Number.isInteger(qty) || qty < 1) return null;
  return applyChange(state, { reason: 'seeds', gold: -crop.seedPrice * qty, materials: { [seed]: qty }, note: `bought ${qty} ${seed}` }, at);
}

/** Counts for the travel card: ripe, growing and empty plots. */
export function farmCounts(farm: FarmState, now: number): { ripe: number; growing: number; empty: number } {
  let ripe = 0;
  let growing = 0;
  for (const p of farm.plots) {
    const s = stageOf(p, now);
    if (s === 'ripe') ripe++;
    else if (s !== null) growing++;
  }
  return { ripe, growing, empty: farm.plots.length - ripe - growing };
}
