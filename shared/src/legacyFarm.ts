// The farm before step BG6 (fixed plots, GameState.farm), kept ONLY for the save migrations: 6 -> 7
// made it, 15 -> 16 turns it into soil cells and plants. Nothing else may use this file.

import { LEGACY_FARM_PLOTS, LEGACY_FARM_PLOTS_PER_LEVEL, BUILD_CELL, SOIL_STYLE, type RoomLevel } from './config.ts';
import { CROP_TYPES } from './materials.ts';
import type { Plant } from './room.ts';

export interface LegacyPlot {
  crop: string | null;
  plantedAt: number;
}

export interface LegacyFarm {
  roomId: number;
  plots: LegacyPlot[];
}

/** A level 1 farm with empty plots (migration 6 -> 7). */
export function emptyLegacyFarm(roomId: number, level: RoomLevel = 1): LegacyFarm {
  return { roomId, plots: Array.from({ length: LEGACY_FARM_PLOTS_PER_LEVEL[level - 1] ?? 0 }, () => ({ crop: null, plantedAt: 0 })) };
}

export interface FarmConversion {
  /** "col,row" -> the soil style, one per old plot (snapped to the cell grid). */
  soil: Record<string, string>;
  /** "col,row" -> the plant, for every plot that held a crop (same crop, same planting time, same time left). */
  plants: Record<string, Plant>;
}

/** Each old plot becomes a soil cell; each planted crop becomes a plant with the crop's own old grow time. */
export function convertLegacyFarm(farm: LegacyFarm): FarmConversion {
  const soil: Record<string, string> = {};
  const plants: Record<string, Plant> = {};
  farm.plots.forEach((plot, i) => {
    const corner = LEGACY_FARM_PLOTS[i];
    if (!corner) return;
    const key = `${Math.floor(corner.x / BUILD_CELL)},${Math.floor(corner.y / BUILD_CELL)}`;
    soil[key] = SOIL_STYLE;
    const crop = plot.crop === null ? undefined : CROP_TYPES.find((c) => c.id === plot.crop);
    if (crop) plants[key] = { seed: crop.seed, plantedAt: plot.plantedAt, readyAt: plot.plantedAt + crop.growMinutes * 60_000 };
  });
  return { soil, plants };
}
