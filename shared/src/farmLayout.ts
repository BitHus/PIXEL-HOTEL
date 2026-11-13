// The farm's fixed places (brief section 10b, step 9b): the soil plots and the cooking pot. Plain
// geometry from config, used by the placement rules (nothing is placed on a plot or the pot) and
// the navigation grid (the pot blocks walking; plots do not). Pure.

import { COOKING_POT, FARM_PLOTS, FARM_PLOTS_PER_LEVEL, FARM_PLOT_SIZE, type RoomLevel } from './config.ts';
import type { Rect } from './types.ts';
import type { Room } from './room.ts';

/** How many plots a farm of this level has (6, 12, 20). */
export function farmPlotCount(level: RoomLevel): number {
  return FARM_PLOTS_PER_LEVEL[level - 1] ?? 0;
}

/** Plot number `index` (0-based) as a rectangle on the floor. */
export function plotRect(index: number): Rect {
  const p = FARM_PLOTS[index];
  if (!p) throw new Error(`no farm plot ${index}`);
  return { x: p.x, y: p.y, w: FARM_PLOT_SIZE, h: FARM_PLOT_SIZE };
}

/** The plots of a farm at this level. */
export function plotRects(level: RoomLevel): Rect[] {
  return Array.from({ length: farmPlotCount(level) }, (_, i) => plotRect(i));
}

/** The middle of a plot (where the avatar stands to plant or harvest). */
export function plotCenter(index: number): { x: number; y: number } {
  const r = plotRect(index);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** The cooking pot's footprint. */
export function potRect(): Rect {
  return { x: COOKING_POT.x - COOKING_POT.w / 2, y: COOKING_POT.y - COOKING_POT.d, w: COOKING_POT.w, h: COOKING_POT.d };
}

/** Fixed things in a room that block walking (the farm's pot), besides the furniture. */
export function fixedBlockers(room: Room): Rect[] {
  return room.kind === 'farm' ? [potRect()] : [];
}

/** Where no furniture may stand (any part of it): the farm's plots and pot. */
export function noPlaceRects(room: Room): Rect[] {
  return room.kind === 'farm' ? [...plotRects(room.level), potRect()] : [];
}

/** The plot under a world point, or null (only the plots of this level). */
export function plotAt(level: RoomLevel, p: { x: number; y: number }): number | null {
  const rects = plotRects(level);
  const i = rects.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  return i < 0 ? null : i;
}
