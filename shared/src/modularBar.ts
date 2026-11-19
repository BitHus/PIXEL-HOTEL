// MODULAR BAR (owner 19 Nov, SAVE 42): the bar is built from one-cell pieces (furniture 'bar', autotile 'bar') that join their neighbours like walls.
// Every piece is a surface and is served from behind (its own staff cell), so the register and the tap stands sit on any piece and guests stand in
// front of any piece. Pure, no rendering:
// - barTiles: which art tile each piece shows (straight, end, corner) from the bar pieces in the 4 cells around it (docs/NOTES.md MODULAR BAR ART).
// - convertCounters: migration 41 -> 42, the old 3-cell counter and the counter_ext pieces become bar pieces on the same cells (riders, guests and bar
//   mess follow the cell they stood on).

import { BUILD_CELL } from './config.ts';
import { footprintRect, getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { arrangeState } from './newPlayer.ts';
import { addSeen } from './seen.ts';
import type { Facing, FurnitureItem } from './types.ts';

/** The furniture id of a bar piece. */
export const BAR_PIECE = 'bar';
/** The old bar pieces (before 19 Nov): only old saves have them, migration 41 -> 42 turns them into bar pieces. */
export const RETIRED_BAR_TYPES: readonly string[] = ['counter', 'counter_ext'];

/**
 * The art tile of a bar piece (the sprite is furniture/bar_<tile>.png): h = a run left-right (front faces down), v = a run up-down (front faces right;
 * mirror for left), c = a corner named by the two neighbours it joins (cse = east + south). hback = a left-right piece turned to face up (the staff side).
 */
export type BarTile = 'hmid' | 'hendl' | 'hendr' | 'hback' | 'vmid' | 'vendn' | 'vends' | 'cse' | 'csw' | 'cne' | 'cnw';

export interface BarTileView {
  tile: BarTile;
  /** Draw mirrored left-right (only the straight up-down piece facing left). */
  mirror: boolean;
}

const key = (c: number, r: number): string => `${c},${r}`;

/** The tile for a piece from its neighbours (E, W, N, S hold a bar piece) and its facing. Pure, tested. */
export function barTileFor(n: { e: boolean; w: boolean; n: boolean; s: boolean }, facing: Facing): BarTileView {
  const h = n.e || n.w;
  const v = n.n || n.s;
  // A T or a cross keeps the tile of its through-run (left-right first): there is no T art.
  if (v && !(n.e && n.w)) {
    if (n.n && n.s) return { tile: 'vmid', mirror: facing === 'left' };
    if (!h) return { tile: n.s ? 'vendn' : 'vends', mirror: false };
    return { tile: `c${n.s ? 's' : 'n'}${n.e ? 'e' : 'w'}` as BarTile, mirror: false };
  }
  if (facing === 'up') return { tile: 'hback', mirror: false };
  if (n.e && n.w) return { tile: 'hmid', mirror: false };
  if (n.w) return { tile: 'hendr', mirror: false };
  return { tile: 'hendl', mirror: false };
}

/** The tile of every bar piece on the floor of a room, by uid. */
export function barTiles(items: readonly FurnitureItem[], roomId: number): Map<number, BarTileView> {
  const pieces = items.filter((i) => i.roomId === roomId && i.onItemUid === null && getFurnitureType(i.typeId).autotile === 'bar');
  const at = new Set(pieces.map((p) => key(Math.floor(p.x / BUILD_CELL), Math.floor((p.y - 1) / BUILD_CELL))));
  const out = new Map<number, BarTileView>();
  for (const p of pieces) {
    const c = Math.floor(p.x / BUILD_CELL);
    const r = Math.floor((p.y - 1) / BUILD_CELL);
    out.set(p.uid, barTileFor({ e: at.has(key(c + 1, r)), w: at.has(key(c - 1, r)), n: at.has(key(c, r - 1)), s: at.has(key(c, r + 1)) }, p.facing));
  }
  return out;
}

/** The floor cells (col, row) of an item's footprint. */
function cellsOf(item: FurnitureItem): { c: number; r: number }[] {
  const f = footprintRect(item, getFurnitureType(item.typeId));
  const out: { c: number; r: number }[] = [];
  for (let r = f.y / BUILD_CELL; r < (f.y + f.h) / BUILD_CELL; r++) for (let c = f.x / BUILD_CELL; c < (f.x + f.w) / BUILD_CELL; c++) out.push({ c, r });
  return out;
}

/**
 * Migration 41 -> 42: every counter (3 cells) and counter_ext (1 cell) becomes bar pieces on the same cells and facing. A counter_ext keeps its uid; a
 * counter keeps its uid on its middle cell and gets new pieces for the other two (ledger 'tavern_gift', 'the bar is built from pieces'). What stood on it
 * (register, tap stands, decor) stays where it was, on the piece under its middle; a bar guest's spot and the coins or mug on a bar spot follow the piece
 * in front of that cell. Pieces in the bag simply become bar pieces. Hotbar and bag slots follow (arrangeState).
 */
export function convertCounters(state: GameState, at: number): GameState {
  if (!state.items.some((i) => RETIRED_BAR_TYPES.includes(i.typeId))) return state;
  let s: GameState = state;
  // uid of an old piece + its cell -> the uid of the new piece on that cell
  const cellOwner = new Map<string, number>();
  const cellKey = (roomId: number, c: number, r: number): string => `${roomId}:${c},${r}`;
  for (const old of state.items.filter((i) => i.typeId === 'counter_ext' || i.typeId === 'counter')) {
    if (old.roomId === null) {
      s = { ...s, items: s.items.map((i) => (i.uid === old.uid ? { ...i, typeId: BAR_PIECE } : i)) };
      continue;
    }
    const cells = cellsOf(old);
    if (old.typeId === 'counter_ext' || cells.length <= 1) {
      s = { ...s, items: s.items.map((i) => (i.uid === old.uid ? { ...i, typeId: BAR_PIECE } : i)) };
      for (const k of cells) cellOwner.set(cellKey(old.roomId, k.c, k.r), old.uid);
      continue;
    }
    const mid = cells[Math.floor((cells.length - 1) / 2)]!;
    const others = cells.filter((k) => k !== mid);
    const gift = applyChange(s, { reason: 'tavern_gift', addFurniture: others.map(() => BAR_PIECE), note: 'the bar is built from pieces' }, at);
    if (!gift) continue;
    const fresh = gift.items.filter((i) => i.uid >= s.nextUid && i.typeId === BAR_PIECE);
    const place = (k: { c: number; r: number }) => ({ x: k.c * BUILD_CELL + BUILD_CELL / 2, y: (k.r + 1) * BUILD_CELL });
    const roomId = old.roomId;
    let items = gift.items.map((i) => (i.uid === old.uid ? { ...i, typeId: BAR_PIECE, ...place(mid) } : i));
    cellOwner.set(cellKey(roomId, mid.c, mid.r), old.uid);
    others.forEach((k, n) => {
      const piece = fresh[n];
      if (!piece) return;
      items = items.map((i) => (i.uid === piece.uid ? { ...i, roomId, facing: old.facing, onItemUid: null, ...place(k) } : i));
      cellOwner.set(cellKey(roomId, k.c, k.r), piece.uid);
    });
    // Riders: onto the piece under the middle of their footprint (their x, y stay: register and stands are one cell, decor is free on the top).
    items = items.map((i) => {
      if (i.onItemUid !== old.uid || i.roomId === null) return i;
      const f = footprintRect(i, getFurnitureType(i.typeId));
      const owner = cellOwner.get(cellKey(roomId, Math.floor((f.x + f.w / 2) / BUILD_CELL), Math.floor((f.y + f.h / 2) / BUILD_CELL)));
      return owner !== undefined ? { ...i, onItemUid: owner } : i;
    });
    s = { ...gift, items };
  }
  // Bar guests and the coins or mug on a bar spot: the piece in front of their cell (a spot is one cell in front of a piece).
  const pieceFor = (roomId: number, c: number, r: number): number | undefined => {
    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const u = cellOwner.get(cellKey(roomId, c + dc, r + dr));
      if (u !== undefined) return u;
    }
    return undefined;
  };
  const t = s.tavern;
  const guests = t.guests.map((g) => {
    if (!g.barSpot) return g;
    const u = pieceFor(t.roomId, g.barSpot.c, g.barSpot.r);
    return u !== undefined ? { ...g, barSpot: { ...g.barSpot, barUid: u } } : g;
  });
  const mess = t.mess.map((m) => {
    if (m.seatIndex < 1000) return m;
    const r = Math.floor((m.seatIndex - 1000) / 1000);
    const c = (m.seatIndex - 1000) % 1000;
    const u = pieceFor(t.roomId, c, r);
    return u !== undefined ? { ...m, seatUid: u } : m;
  });
  s = { ...s, tavern: { ...t, guests, mess } };
  // The Book: the bar piece is seen.
  return arrangeState({ ...s, player: { ...s.player, seen: addSeen(s.player.seen, BAR_PIECE, 1, at) } });
}
