import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILD_CELL } from './config.ts';
import {
  FURNITURE_TYPES,
  anchorCell,
  canPlace,
  footprintCells,
  footprintRect,
  getFurnitureType,
  isOnGrid,
  moveItem,
  nearestValidPlacement,
  nextFacing,
  pickUpItem,
  planPlacement,
  poseAtCell,
  poseForAnchorCell,
  snapToCells,
  snapToSurface,
  standPointFor,
  wallItemRect,
  type FurnitureLookup,
} from './furniture.ts';
import { createRoom, rectInsideFloor } from './room.ts';
import { moveGhost, planGhost, startNewPlacing } from './placing.ts';
import { buildNavGrid, findPath, isCellFree } from './nav.ts';
import type { Facing, FurnitureItem, FurnitureType } from './types.ts';

const room = createRoom(1, 'hotel', 1, 1); // 18 x 12 cells (576 x 384), door zone x 256..320, y 320..384
const T = getFurnitureType;

let nextUid = 1;
function item(typeId: string, x: number, y: number, facing: Facing = 'down', onItemUid: number | null = null): FurnitureItem {
  return { uid: nextUid++, typeId, ownerId: 1, roomId: room.id, x, y, facing, onItemUid };
}
/** An item whose footprint's top-left cell is (col, row). */
function atCell(typeId: string, col: number, row: number, facing: Facing = 'down', rm = room): FurnitureItem {
  const p = poseAtCell(T(typeId), facing, col, row);
  return { uid: nextUid++, typeId, ownerId: 1, roomId: rm.id, x: p.x, y: p.y, facing, onItemUid: null };
}
const pose = (typeId: string, col: number, row: number, facing: Facing = 'down') => poseAtCell(T(typeId), facing, col, row);
const can = (items: FurnitureItem[], typeId: string, col: number, row: number, facing: Facing = 'down', rm = room): boolean => {
  const p = pose(typeId, col, row, facing);
  return canPlace(rm, items, T(typeId), p.x, p.y, facing);
};

describe('furniture data', () => {
  it('ids are unique across furniture.json and shared/data/furniture/*.json (P0 split)', () => {
    const ids = FURNITURE_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the 12 home types, in the catalog, common, and only the rug does not block', () => {
    const home = FURNITURE_TYPES.filter((t) => t.category === 'home_furniture' && t.inCatalog);
    expect(home).toHaveLength(12);
    for (const t of home) {
      expect(t.inCatalog).toBe(true);
      expect(t.rank).toBe('common');
      expect(t.blocks).toBe(t.id !== 'rug');
      expect(t.facings.length).toBeGreaterThan(0);
    }
    expect(T('bed').placeIn).toBe('hotel');
    expect(T('bookshelf').placeIn).toBe('hotel');
    expect(T('chair').placeIn).toBe('both');
  });

  it('floor items are whole cells (w x d); wall items keep their free px size (BG1)', () => {
    for (const t of FURNITURE_TYPES) {
      if (t.wall) continue;
      expect(t.w % BUILD_CELL, t.id).toBe(0);
      expect(t.d % BUILD_CELL, t.id).toBe(0);
      expect(t.w, t.id).toBeGreaterThanOrEqual(BUILD_CELL);
      expect(t.d, t.id).toBeGreaterThanOrEqual(BUILD_CELL);
    }
    expect(T('sign').w).toBe(40);
    expect(T('banner').d).toBe(4);
  });

  it('stall tables, shelves and display cases are plain decor since step S1: no slots, nothing to sell on them', () => {
    for (const id of ['stall_table', 'shelf', 'display_case']) {
      expect(T(id), id).not.toHaveProperty('slots');
      expect(T(id).placeIn, id).toBe('shop');
    }
  });

  it('has the step 7 shop types (section 7, 9)', () => {
    expect(T('shelf')).toMatchObject({ w: 64, d: 32, baseValue: 10, blocks: true, inCatalog: true, placeIn: 'shop' });
    expect(T('display_case')).toMatchObject({ w: 64, d: 32, baseValue: 40, appeal: 6, inCatalog: true, placeIn: 'shop' });
    expect(T('sign')).toMatchObject({ w: 40, wall: true, appeal: 10, baseValue: 25, inCatalog: true, placeIn: 'shop' });
    expect(T('banner')).toMatchObject({ w: 32, wall: true, appeal: 6, baseValue: 15, inCatalog: true, placeIn: 'shop' });
    expect(T('shop_rug')).toMatchObject({ w: 96, d: 64, blocks: false, appeal: 5, baseValue: 12, inCatalog: true, placeIn: 'shop' });
    expect(T('counter')).toMatchObject({ w: 96, d: 32, appeal: 8, inCatalog: false, noPickup: true });
    expect(T('stall_table')).toMatchObject({ w: 96, d: 64, baseValue: 10, blocks: true, inCatalog: false });
    expect(T('lamp')).toMatchObject({ placeIn: 'both', appeal: 4 });
    expect(T('plant')).toMatchObject({ placeIn: 'both', appeal: 3 });
  });
});

describe('footprints in cells and rotation (BG1)', () => {
  it('footprintRect runs from (x - fw/2, y - fd) to (x + fw/2, y)', () => {
    expect(footprintRect({ x: 208, y: 224, facing: 'down' }, T('sofa'))).toEqual({ x: 160, y: 192, w: 96, h: 32 });
    expect(footprintRect({ x: 208, y: 224, facing: 'up' }, T('sofa'))).toEqual({ x: 160, y: 192, w: 96, h: 32 });
  });

  it('swaps w and d when facing left or right', () => {
    expect(footprintRect({ x: 208, y: 224, facing: 'right' }, T('sofa'))).toEqual({ x: 192, y: 128, w: 32, h: 96 });
    expect(footprintRect({ x: 208, y: 224, facing: 'left' }, T('sofa'))).toEqual({ x: 192, y: 128, w: 32, h: 96 });
    expect(footprintCells(T('sofa'), 'down')).toEqual({ w: 3, d: 1 });
    expect(footprintCells(T('sofa'), 'right')).toEqual({ w: 1, d: 3 });
    expect(footprintCells(T('bed'), 'down')).toEqual({ w: 2, d: 3 });
  });

  it('the anchor cell is the bottom-centre cell (even widths: the left of the two centre cells)', () => {
    // 3 wide, 1 high at columns 4..6, row 5: anchor column 5.
    expect(anchorCell(pose('sofa', 4, 5), T('sofa'))).toEqual({ col: 5, row: 5 });
    // 2 wide: columns 4..5, the anchor is the left one.
    expect(anchorCell(pose('table', 4, 5), T('table'))).toEqual({ col: 4, row: 5 });
    // The bed (2 x 3): rows 3..5, the anchor is the bottom row.
    expect(anchorCell(pose('bed', 4, 3), T('bed'))).toEqual({ col: 4, row: 5 });
    // A 1 x 1 item is its own anchor cell; the anchor point is the middle of the cell.
    expect(pose('chair', 4, 5)).toEqual({ x: 4 * 32 + 16, y: 6 * 32, facing: 'down' });
    expect(isOnGrid(pose('sofa', 4, 5), T('sofa'))).toBe(true);
    expect(isOnGrid({ x: 130, y: 224, facing: 'down' }, T('sofa'))).toBe(false);
  });

  it('rotation swaps w and d and keeps the anchor cell', () => {
    for (const id of ['sofa', 'table', 'bed', 'stall_table', 'chair']) {
      for (const facing of ['right', 'up', 'left'] as Facing[]) {
        const t = T(id);
        const a = anchorCell(pose(id, 6, 6), t);
        const turned = poseForAnchorCell(t, facing, a.col, a.row);
        expect(anchorCell(turned, t), `${id} ${facing}`).toEqual(a);
        expect(isOnGrid(turned, t), `${id} ${facing}`).toBe(true);
        const f = footprintRect(turned, t);
        const base = footprintRect(pose(id, 6, 6), t);
        const swapped = facing === 'right' || facing === 'left';
        expect(f.w, `${id} ${facing}`).toBe(swapped ? base.h : base.w);
        expect(f.h, `${id} ${facing}`).toBe(swapped ? base.w : base.h);
      }
    }
  });

  it('snapToCells puts the footprint on the cells nearest to where its middle is dragged', () => {
    const p = snapToCells(T('sofa'), 'down', { x: 210, y: 200 }); // middle of a 96 x 32 footprint
    expect(p).toEqual(pose('sofa', 5, 6)); // left edge 162 -> column 5, top 184 -> row 6 (5.75)
    expect(isOnGrid(p, T('sofa'))).toBe(true);
    const q = snapToCells(T('chair'), 'down', { x: 100, y: 100 });
    expect(q).toEqual(pose('chair', 3, 3));
  });
});

describe('nextFacing', () => {
  it("cycles through the type's facings", () => {
    const seen: Facing[] = [];
    let f: Facing = 'down';
    for (let i = 0; i < 4; i++) seen.push((f = nextFacing(T('chair'), f)));
    expect(seen).toEqual(['right', 'up', 'left', 'down']);
    expect(nextFacing(T('table'), 'down')).toBe('right');
    expect(nextFacing(T('table'), 'right')).toBe('down');
    expect(nextFacing(T('lamp'), 'down')).toBe('down');
  });
});

describe('canPlace on cells', () => {
  it('refuses overlaps between blocking items, but rugs and floor decor overlap anything', () => {
    const sofa = atCell('sofa', 6, 6); // columns 6..8, row 6
    expect(can([sofa], 'sofa', 7, 6)).toBe(false);
    expect(can([sofa], 'chair', 7, 6)).toBe(false);
    expect(can([sofa], 'sofa', 7, 5)).toBe(true); // the row above
    expect(can([sofa], 'rug', 6, 5)).toBe(true); // a rug (3 x 2) over the sofa's row
    // Sharing an edge is not an overlap.
    expect(can([sofa], 'sofa', 9, 6)).toBe(true);
    // A blocking item can stand on a rug.
    const rug = atCell('rug', 12, 6);
    expect(can([rug], 'table', 12, 6)).toBe(true);
  });

  it('refuses a footprint that is not on the cells', () => {
    expect(canPlace(room, [], T('sofa'), 208, 224, 'down')).toBe(true); // columns 5..7, row 6
    expect(canPlace(room, [], T('sofa'), 212, 224, 'down')).toBe(false); // 4 px off
    expect(canPlace(room, [], T('sofa'), 208, 228, 'down')).toBe(false);
    expect(canPlace(room, [], T('rug'), 210, 224, 'down')).toBe(false);
  });

  it('keeps the footprint fully on floor cells', () => {
    expect(can([], 'chair', 0, 0)).toBe(true);
    expect(can([], 'chair', 17, 0)).toBe(true);
    expect(can([], 'chair', -1, 0)).toBe(false);
    expect(can([], 'chair', 18, 0)).toBe(false);
    expect(can([], 'chair', 0, 11)).toBe(true);
    expect(can([], 'chair', 0, 12)).toBe(false);
    expect(can([], 'sofa', 16, 0)).toBe(false); // sticks out to the right
    expect(can([], 'sofa', 15, 0)).toBe(true);
  });

  it('refuses the 2 x 2 cell door zone, also for rugs; next to it is fine', () => {
    // Door at x 288: the zone is columns 8..9, rows 10..11.
    expect(can([], 'chair', 8, 10)).toBe(false);
    expect(can([], 'chair', 9, 11)).toBe(false);
    expect(can([], 'rug', 7, 10)).toBe(false); // 3 x 2 reaches into the zone
    expect(can([], 'rug', 5, 10)).toBe(true); // columns 5..7
    expect(can([], 'chair', 7, 10)).toBe(true);
    expect(can([], 'chair', 10, 11)).toBe(true);
    expect(can([], 'chair', 8, 9)).toBe(true); // just above the zone
  });

  it('refuses an item that would cut the door off from the middle of the room', () => {
    // A row of plants across the room above the door zone, with a one-cell gap at column 3.
    const row = Array.from({ length: 18 }, (_, c) => c).filter((c) => c !== 3).map((c) => atCell('plant', c, 9));
    expect(can(row, 'chair', 5, 4)).toBe(true);
    // The gap is one cell wide: a path through it is still a way, but closing it is refused.
    expect(can(row, 'chair', 3, 9)).toBe(false);
    // A rug in the gap does not block walking.
    expect(can(row, 'rug', 2, 9)).toBe(true);
    // The way through the gap exists on the nav grid (one free cell).
    const grid = buildNavGrid(room, row.map((i) => footprintRect(i, T('plant'))));
    const path = findPath(grid, { x: 288, y: 352 }, { x: 288, y: 100 });
    expect(path).not.toBeNull();
    // Walk the polyline in 2 px steps: it crosses row 9 only inside the gap (column 3).
    let through = false;
    for (let i = 1; i < path!.length; i++) {
      const a = path![i - 1]!;
      const b = path![i]!;
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const y = a.y + ((b.y - a.y) * k) / n;
        if (y >= 9 * 32 && y < 10 * 32) {
          through = true;
          expect(Math.floor(x / 32)).toBe(3);
        }
      }
    }
    expect(through).toBe(true);
  });

  it('respects placeIn', () => {
    const shop = createRoom(2, 'shop', 1, 1);
    expect(can([], 'bed', 3, 2, 'down', shop)).toBe(false);
    expect(can([], 'chair', 3, 2, 'down', shop)).toBe(true);
  });
});

describe('wall items stay free (BG1: only floor items go per cell)', () => {
  it('hang at any x along the band, in 4 px steps or whole px, anchor y at the band foot', () => {
    const torch = T('wall_torch'); // 24 px wide: not a whole number of cells, so it cannot be per cell
    for (const x of [100, 101, 104, 117, 130]) expect(canPlace(room, [], torch, x, 0, 'down'), `x ${x}`).toBe(true);
    expect(canPlace(room, [], torch, 100, 4, 'down')).toBe(false); // not on the floor edge
    expect(canPlace(room, [], torch, 8, 0, 'down')).toBe(false); // sticks out left
    expect(canPlace(room, [], torch, 12, 0, 'down')).toBe(true);
    // A wall item is not snapped to a cell by the rules: planPlacement keeps x and finds the band.
    expect(planPlacement(room, [], torch, 133, 20, 'down')).toMatchObject({ x: 133, y: 0, ok: true });
  });

  it('two wall items overlap only when their widths overlap', () => {
    const a: FurnitureItem = { ...item('wall_torch', 100, 0), roomId: room.id };
    expect(canPlace(room, [a], T('wall_torch'), 130, 0, 'down')).toBe(true);
    expect(canPlace(room, [a], T('wall_torch'), 120, 0, 'down')).toBe(false);
  });

  it('a wall item is not in the way of the door zone or floor items', () => {
    const torch = item('wall_torch', 432, 0);
    expect(can([torch], 'chair', 13, 0)).toBe(true);
  });
});

describe('surfaces', () => {
  // The cell rules (register, tap stand) are tested with a lamp that is NOT free decor.
  const CL: FurnitureType = { ...T('lamp'), freeOnSurface: false };
  it('snaps a structural onSurface item to the nearest free cell on top', () => {
    const table = atCell('table', 6, 5); // top: columns 6..7, row 5: x 192..256, y 160..192
    expect(snapToSurface(room, [table], CL, 200, 190, 'down')).toEqual({ x: 208, y: 192, onItemUid: table.uid });
    // Near the edge it is pulled onto the last cell.
    expect(snapToSurface(room, [table], CL, 252, 192, 'down')).toEqual({ x: 240, y: 192, onItemUid: table.uid });
    // A second lamp goes to the other cell.
    const lamp = { ...item('lamp', 208, 192, 'down', table.uid) };
    const cellTypes: FurnitureLookup = (id) => (id === 'lamp' ? CL : T(id));
    const spot = snapToSurface(room, [table, lamp], CL, 212, 190, 'down', cellTypes);
    expect(spot).toEqual({ x: 240, y: 192, onItemUid: table.uid });
    // A full table has no free spot.
    const lamp2 = { ...item('lamp', 240, 192, 'down', table.uid) };
    expect(snapToSurface(room, [table, lamp, lamp2], CL, 212, 190, 'down', cellTypes)).toBeNull();
    // Not over a surface: no snap; on the floor it is a normal placement.
    expect(snapToSurface(room, [table], CL, 400, 190, 'down')).toBeNull();
    const floorSpot = pose('lamp', 12, 5);
    expect(planPlacement(room, [table], T('lamp'), floorSpot.x, floorSpot.y, 'down')).toMatchObject({ onItemUid: null, ok: true });
    // Items that are not onSurface never snap.
    expect(snapToSurface(room, [table], T('chair'), 200, 190, 'down')).toBeNull();
  });

  it('moves and goes back with the item under it', () => {
    const table = atCell('table', 6, 5);
    const lamp = item('lamp', 208, 192, 'down', table.uid);
    const to = pose('table', 9, 7);
    const moved = moveItem([table, lamp], table.uid, { x: to.x, y: to.y, facing: 'down', roomId: room.id, onItemUid: null });
    expect(moved.find((i) => i.uid === lamp.uid)).toMatchObject({ x: 9 * 32 + 16, y: 8 * 32, onItemUid: table.uid, roomId: room.id });
    const back = pickUpItem(moved, table.uid);
    expect(back.find((i) => i.uid === table.uid)).toMatchObject({ roomId: null });
    expect(back.find((i) => i.uid === lamp.uid)).toMatchObject({ roomId: null, onItemUid: null });
  });

  it('turns with the item under it and stays on top, on a cell of the surface', () => {
    const table = atCell('table', 6, 5);
    const lamp = item('lamp', 240, 192, 'down', table.uid);
    const a = anchorCell(table, T('table'));
    const to = poseForAnchorCell(T('table'), 'right', a.col, a.row);
    const turned = moveItem([table, lamp], table.uid, { ...to, roomId: room.id, onItemUid: null });
    const l = turned.find((i) => i.uid === lamp.uid)!;
    const top = footprintRect(turned.find((i) => i.uid === table.uid)!, T('table'));
    const fp = footprintRect(l, T('lamp'));
    expect(l.onItemUid).toBe(table.uid);
    expect(fp.x >= top.x && fp.y >= top.y && fp.x + fp.w <= top.x + top.w && fp.y + fp.h <= top.y + top.h).toBe(true);
  });

  it('is one level only', () => {
    const box: FurnitureType = { ...T('crate'), id: 'small_box', w: 32, d: 32, surface: true, onSurface: true };
    const types: FurnitureLookup = (id) => (id === 'small_box' ? box : T(id));
    const table = atCell('table', 6, 5);
    const onTable = item('small_box', 208, 192, 'down', table.uid);
    // A lamp aimed at the box lands on the table's other cell, never on the box.
    const spot = snapToSurface(room, [table, onTable], CL, 208, 190, 'down', types);
    expect(spot).toEqual({ x: 240, y: 192, onItemUid: table.uid });
    // A surface that carries items cannot itself go onto a surface.
    const p = planPlacement(room, [table], box, 208, 192, 'down', true, types);
    expect(p.onItemUid).toBeNull();
    expect(p.ok).toBe(false);
  });
});

describe('standPointFor', () => {
  it('is in front of the item, turned with its facing', () => {
    const t = T('chair'); // 32 x 32, standPoint (0, 24)
    expect(standPointFor({ x: 100, y: 100, facing: 'down' }, t)).toEqual({ x: 100, y: 124 });
    expect(standPointFor({ x: 100, y: 100, facing: 'right' }, t)).toEqual({ x: 140, y: 84 });
    expect(standPointFor({ x: 100, y: 100, facing: 'up' }, t)).toEqual({ x: 100, y: 44 });
    expect(standPointFor({ x: 100, y: 100, facing: 'left' }, t)).toEqual({ x: 60, y: 84 });
  });
});

describe('the counter (served from behind)', () => {
  it('cannot stand against the back wall: the shopkeeper must fit behind it', () => {
    const shop = createRoom(2, 'shop', 1, 1);
    expect(can([], 'counter', 3, 0, 'down', shop)).toBe(false);
    expect(can([], 'counter', 3, 2, 'down', shop)).toBe(true);
    expect(can([], 'counter', 3, 1, 'down', shop)).toBe(true); // one free row behind it is enough
    // Facing up, its back is toward the door side: against the back wall is fine then.
    expect(can([], 'counter', 3, 0, 'up', shop)).toBe(true);
  });
});

describe('nearestValidPlacement', () => {
  it('keeps a free spot, moves off a taken one to the nearest cell footprint, null when nothing fits', () => {
    const sofa = atCell('sofa', 6, 6);
    const want = { x: sofa.x, y: sofa.y - 16 };
    const p = nearestValidPlacement(room, [sofa], T('sofa'), 'down', want)!;
    expect(p).not.toBeNull();
    expect(canPlace(room, [sofa], T('sofa'), p.x, p.y, 'down')).toBe(true);
    expect(Math.abs(p.y - sofa.y)).toBe(32); // the row above or below
    expect(nearestValidPlacement(room, [], T('chair'), 'down', { x: 100, y: 100 })).toEqual(pose('chair', 3, 3));
    // A room with no free cell for the item.
    const full = Array.from({ length: 18 * 12 }, (_, i) => atCell('plant', i % 18, Math.floor(i / 18)));
    expect(nearestValidPlacement(room, full, T('chair'), 'down', { x: 100, y: 100 })).toBeNull();
  });
});

describe('non-rectangular rooms (step 7b)', () => {
  const l = createRoom(5, 'hotel', 1, 1, 'l_shape'); // cells (0,0,10,14) + (10,6,10,8)
  const plus = createRoom(6, 'hotel', 1, 1, 'plus'); // top arm columns 6..13, bar rows 4..9

  it('placement rejects items crossing outside the floor', () => {
    expect(can([], 'table', 9, 9, 'down', l)).toBe(true); // across the seam of the L (columns 9..10)
    expect(can([], 'table', 10, 5, 'down', l)).toBe(false); // in the cut-out above the right arm
    expect(can([], 'table', 9, 5, 'down', l)).toBe(false); // half in the cut-out
    expect(can([], 'table', 15, 3, 'down', l)).toBe(false); // in the cut-out
    expect(can([], 'table', 7, 2, 'down', plus)).toBe(true); // in the top arm
    expect(can([], 'table', 5, 2, 'down', plus)).toBe(false); // half off the top arm
    expect(can([], 'table', 2, 12, 'down', plus)).toBe(false); // below the bar, outside
  });

  it('the nav grid blocks every cell outside the union', () => {
    for (const room of [l, plus]) {
      const grid = buildNavGrid(room, []);
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const cell = { x: c * grid.cell, y: r * grid.cell, w: grid.cell, h: grid.cell };
          if (!rectInsideFloor(room, cell)) expect(isCellFree(grid, c, r)).toBe(false);
        }
      }
    }
    expect(isCellFree(buildNavGrid(l, []), 15, 2)).toBe(false); // the L's cut-out corner
    // Walking from the top arm of the plus to its bottom arm goes through the bar.
    expect(findPath(buildNavGrid(plus, []), { x: 320, y: 40 }, { x: 320, y: 420 })).not.toBeNull();
  });

  it('wall items hang on any back wall band, also the inner one of an L', () => {
    const l = createRoom(7, 'shop', 1, 1, 'l_shape'); // banners are shop items
    expect(canPlace(l, [], T('banner'), 480, 192, 'down')).toBe(true); // the inner band
    expect(canPlace(l, [], T('banner'), 160, 0, 'down')).toBe(true); // the top band
    expect(canPlace(l, [], T('banner'), 320, 192, 'down')).toBe(false); // half off the inner band
    expect(canPlace(l, [], T('banner'), 480, 0, 'down')).toBe(false); // no wall up there
    const p = planPlacement(l, [], T('banner'), 470, 230, 'down');
    expect(p).toMatchObject({ x: 470, y: 192, ok: true });
  });
});

describe('OA-10 wall items hang anywhere on the band (free x and y)', () => {
  const torch = T('wall_torch'); // 24 x 48 on a 64 px band: anchor y -16 (top) .. 0 (foot)
  const at = (x: number, y: number): FurnitureItem => ({ ...item('wall_torch', x, y), roomId: room.id });

  it('wallItemRect covers the sprite above the anchor', () => {
    expect(wallItemRect({ x: 100, y: -10, facing: 'down' }, torch)).toEqual({ x: 88, y: -58, w: 24, h: 48 });
  });

  it('accepts any y from the band top to the foot, refuses above and below', () => {
    expect(canPlace(room, [], torch, 100, 0, 'down')).toBe(true); // the old foot line
    expect(canPlace(room, [], torch, 100, -8, 'down')).toBe(true);
    expect(canPlace(room, [], torch, 100, -16, 'down')).toBe(true);
    expect(canPlace(room, [], torch, 100, -17, 'down')).toBe(false); // sticks out above the wall
    expect(canPlace(room, [], torch, 100, 4, 'down')).toBe(false); // hangs onto the floor
  });

  it('planPlacement keeps a free y (clamped into the band), the nearest band', () => {
    expect(planPlacement(room, [], torch, 100, -8, 'down')).toMatchObject({ x: 100, y: -8, ok: true });
    expect(planPlacement(room, [], torch, 100, -60, 'down')).toMatchObject({ y: -16, ok: true });
    expect(planPlacement(room, [], torch, 100, 40, 'down')).toMatchObject({ y: 0, ok: true });
  });

  it('two wall items overlap only when their rectangles overlap (height matters)', () => {
    const small = T('wall_torch');
    const a = at(100, -10);
    expect(canPlace(room, [a], small, 100, -10, 'down')).toBe(false);
    expect(canPlace(room, [a], small, 120, -10, 'down')).toBe(false); // 24 wide: x overlaps
    expect(canPlace(room, [a], small, 124, -10, 'down')).toBe(true);
    // same x, but a shorter item that sits fully below is still stacked in y: 48 px tall each never fit twice in 64
    expect(canPlace(room, [a], small, 100, 0, 'down')).toBe(false);
  });

  it('old items at the foot line stay valid and a move keeps the stored y', () => {
    const old = at(100, 0);
    expect(canPlace(room, [], torch, old.x, old.y, old.facing)).toBe(true);
    const moved = moveItem([old], old.uid, { x: 140, y: -12, facing: 'down', onItemUid: null, roomId: room.id });
    expect(moved[0]).toMatchObject({ x: 140, y: -12 });
  });

  it('the ghost centre follows the pointer: anchor y = pointer y + half the height, 4 px snap', () => {
    const s = startNewPlacing('wall_torch', { x: 100, y: -32 }, null);
    expect(planGhost(room, [], s)).toMatchObject({ x: 100, y: -8, ok: true });
    expect(planGhost(room, [], moveGhost(s, { x: 101, y: -29 }), false)).toMatchObject({ x: 101, y: -5, ok: true });
    expect(planGhost(room, [], moveGhost(s, { x: 100, y: -80 }))).toMatchObject({ y: -16, ok: true });
  });
});
