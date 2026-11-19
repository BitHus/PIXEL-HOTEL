// TF-1 / TF-2 (docs/PLAN-TAVERN-FLOW.md): the bar's standing spots for BAR GUESTS and the rule that picks bar or table.
// Pure, no rendering. A bar spot is a cell on the CUSTOMER side of a bar piece (the counter or a counter extension, OA-6), directly in front of its
// footprint: one guest per front cell. A spot counts only if the cell is on the floor, free, reachable from the door by the customers' grid
// (npcGrid: the staff zone, the kitchen and the Inn doors are already blocked in it).

import { BAR_BASE, BAR_CHANCE_MAX, BAR_CHANCE_MIN, BAR_DISH_TABLE_SHIFT, BAR_SPOT_GAP, BAR_SPOTS_MAX } from './config.ts';
import { behindPoint, doorPoint, footprintRect, getFurnitureType } from './furniture.ts';
import { cellCenter, isCellFree, type NavGrid } from './nav.ts';
import { reachableFrom } from './npcNav.ts';
import type { Room } from './room.ts';
import { isBarPiece } from './barExtension.ts';
import type { Facing, FurnitureItem, Point, Rng } from './types.ts';

/** One standing place at the bar. (x, y) is the middle of the cell (the guest's feet); facing is toward the bar. */
export interface BarSpot {
  barUid: number;
  cell: { c: number; r: number };
  x: number;
  y: number;
  facing: Facing;
  /** 'front' = in front of a bar piece (the only kind in v1; the ends are an owner option). */
  side: 'front' | 'end';
}

/** What a guest remembers of its spot (the cell, so a moved bar frees it). */
export interface GuestBarSpot {
  barUid: number;
  c: number;
  r: number;
}

/** A Mess key for a bar spot: seatUid = the bar piece, seatIndex = this (kept far from real seat indices). */
export function barSpotIndex(cell: { c: number; r: number }): number {
  return 1000 + cell.r * 1000 + cell.c;
}

/** Unit step from a guest at a bar toward the bar, by its facing. */
export function facingStep(f: Facing): Point {
  return f === 'up' ? { x: 0, y: -1 } : f === 'down' ? { x: 0, y: 1 } : f === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

/** The spots of the room's bar, sorted left to right then top to bottom (queue order), at most BAR_SPOTS_MAX. `grid` is the customers' grid (npcGrid). */
export function barSpots(items: readonly FurnitureItem[], room: Room, grid: NavGrid): BarSpot[] {
  const reach = new Set(reachableFrom(grid, doorPoint(room)));
  const seen = new Set<string>();
  const out: BarSpot[] = [];
  // RUN 11: no guest stands in front of a bar cell that carries the register or a tap stand (they hid the stand); small free decor does not count.
  const carried = new Set<string>();
  for (const r of items) {
    if (r.roomId !== room.id || r.onItemUid === null) continue;
    const rt = getFurnitureType(r.typeId);
    if (rt.freeOnSurface) continue;
    const f = footprintRect(r, rt);
    carried.add(`${Math.floor((f.x + f.w / 2) / grid.cell)},${Math.floor((f.y + f.h / 2) / grid.cell)}`);
  }
  for (const it of items) {
    if (it.roomId !== room.id || it.onItemUid !== null) continue;
    const type = getFurnitureType(it.typeId);
    if (!isBarPiece(type)) continue;
    const f = footprintRect(it, type);
    const b = behindPoint(it, type);
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const cell = grid.cell;
    const vertical = Math.abs(b.y - cy) >= Math.abs(b.x - cx);
    // The customer side is opposite to the staff side.
    const front = vertical ? (b.y < cy ? 'below' : 'above') : b.x < cx ? 'right' : 'left';
    const cells: { c: number; r: number }[] = [];
    const c0 = Math.floor(f.x / cell);
    const c1 = Math.ceil((f.x + f.w) / cell) - 1;
    const r0 = Math.floor(f.y / cell);
    const r1 = Math.ceil((f.y + f.h) / cell) - 1;
    if (vertical) for (let c = c0; c <= c1; c++) cells.push({ c, r: front === 'below' ? r1 + 1 : r0 - 1 });
    else for (let r = r0; r <= r1; r++) cells.push({ c: front === 'right' ? c1 + 1 : c0 - 1, r });
    const facing: Facing = front === 'below' ? 'up' : front === 'above' ? 'down' : front === 'right' ? 'left' : 'right';
    const step = facingStep(facing);
    for (const k of cells) {
      const key = `${k.c},${k.r}`;
      if (carried.has(`${k.c + step.x},${k.r + step.y}`)) continue;
      if (seen.has(key) || !isCellFree(grid, k.c, k.r) || !reach.has(k.r * grid.cols + k.c)) continue;
      seen.add(key);
      const p = cellCenter(grid, k.c, k.r);
      out.push({ barUid: it.uid, cell: k, x: p.x, y: p.y, facing, side: 'front' });
    }
  }
  out.sort((a, b) => a.cell.c - b.cell.c || a.cell.r - b.cell.r);
  return out.slice(0, BAR_SPOTS_MAX);
}

/** True when this guest holds that spot. */
function holds(g: { barSpot?: GuestBarSpot }, s: BarSpot): boolean {
  return g.barSpot !== undefined && g.barSpot.barUid === s.barUid && g.barSpot.c === s.cell.c && g.barSpot.r === s.cell.r;
}

/**
 * The spots nobody holds: no guest on it or on the way (reserved the moment they come in) and no coins or mug left on it (`mess` = the tavern's mess list,
 * a spot with coins or a mug takes no new guest). `reserved` adds spots held by guests that are not in the list yet.
 */
export function freeBarSpots(
  spots: readonly BarSpot[],
  guests: readonly { barSpot?: GuestBarSpot }[],
  mess: readonly { seatUid: number; seatIndex: number }[] = [],
  reserved: readonly GuestBarSpot[] = [],
): BarSpot[] {
  // RUN 11 (they clumped): a spot within BAR_SPOT_GAP cells of a held one is not free either, so bar guests stand spread out.
  const held = [...guests.flatMap((g) => (g.barSpot ? [g.barSpot] : [])), ...reserved];
  const near = (s: BarSpot): boolean => held.some((h) => Math.max(Math.abs(h.c - s.cell.c), Math.abs(h.r - s.cell.r)) <= BAR_SPOT_GAP);
  return spots.filter(
    (s) =>
      !near(s) &&
      !mess.some((m) => m.seatUid === s.barUid && m.seatIndex === barSpotIndex(s.cell)),
  );
}

/** The free spot nearest `from` (the door), then the leftmost; null with none. */
export function barSpotFor(free: readonly BarSpot[], from: Point): BarSpot | null {
  let best: BarSpot | null = null;
  let bestD = Infinity;
  for (const s of free) {
    const d = Math.hypot(s.x - from.x, s.y - from.y);
    if (d < bestD - 1e-6 || (Math.abs(d - bestD) <= 1e-6 && best && s.cell.c < best.cell.c)) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Where the player stands to hand over: on the staff side of the bar, level with the spot (the staff cell behind the bar piece). */
export function barServePoint(spot: Pick<BarSpot, 'x' | 'y' | 'facing'>, bar: FurnitureItem): Point {
  const b = behindPoint(bar, getFurnitureType(bar.typeId));
  return spot.facing === 'up' || spot.facing === 'down' ? { x: spot.x, y: b.y } : { x: b.x, y: spot.y };
}

/** The point on the bar top in front of a guest standing at a spot (where the coins and the mug lie): half a cell toward the bar. */
export function barTopPoint(p: Point, facing: Facing, cell: number): Point {
  const d = facingStep(facing);
  return { x: p.x + (d.x * cell) / 2, y: p.y + (d.y * cell) / 2 };
}

export type SpotKind = 'bar' | 'table';

export interface SpotChoice {
  /** Size of the group (1 to 3). */
  size: number;
  seatsFree: number;
  spotsFree: number;
  /** The guest wants a cooked dish (a table is preferred). Bar guests order drinks only in v1, so this is false at the door. */
  wantsDish?: boolean;
}

/**
 * Bar or table for a group at the door (plan 3.2). Null = nothing fits (the guests shrug and leave as now). Groups of 2 or 3 take a table first and the bar
 * only when no table has enough free seats in total. A single guest: no seat = bar, no spot = table, else a bar chance
 * clamp(BAR_BASE + 0.1 * (spotsFree - 1) - 0.05 * seatsFree, MIN, MAX) minus BAR_DISH_TABLE_SHIFT for a dish wish. A single guest uses ONE rng draw (only when both exist).
 */
export function chooseSpot(rng: Rng, c: SpotChoice): SpotKind | null {
  if (c.size >= 2) return c.seatsFree >= c.size ? 'table' : c.spotsFree >= c.size ? 'bar' : null;
  if (c.seatsFree <= 0 && c.spotsFree <= 0) return null;
  if (c.seatsFree <= 0) return 'bar';
  if (c.spotsFree <= 0) return 'table';
  let chance = BAR_BASE + 0.1 * (c.spotsFree - 1) - 0.05 * c.seatsFree;
  if (c.wantsDish) chance -= BAR_DISH_TABLE_SHIFT;
  chance = Math.max(BAR_CHANCE_MIN, Math.min(BAR_CHANCE_MAX, chance));
  return rng() < chance ? 'bar' : 'table';
}
