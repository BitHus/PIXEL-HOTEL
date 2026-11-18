import { describe, expect, it } from 'vitest';
import { npcGrid, npcPath, inStaffZone } from './npcNav.ts';
import { buildNavGrid, cellAt, isCellFree } from './nav.ts';
import { createRoom } from './room.ts';

describe('the guests\' nav grid (staff only)', () => {
  const room = createRoom(2, 'hotel', 1, 1); // a plain room: the tavern's kitchen partition would block cells too
  const grid = buildNavGrid(room, []);
  const zone = { x: 100, y: 40, w: 96, h: 40 };

  it('blocks every cell that touches a staff zone and nothing else', () => {
    const g = npcGrid(grid, [zone]);
    expect(npcGrid(grid, [zone])).toBe(g); // cached
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const x = c * g.cell;
        const y = r * g.cell;
        const touches = x < zone.x + zone.w && x + g.cell > zone.x && y < zone.y + zone.h && y + g.cell > zone.y;
        expect(isCellFree(g, c, r)).toBe(!touches);
      }
    }
    expect(grid.blocked.every((b) => !b)).toBe(true); // the room's own grid is untouched
  });

  it('a way to a spot in the zone ends at the nearest free spot outside it', () => {
    const g = npcGrid(grid, [zone]);
    const path = npcPath(g, { x: 300, y: 200 }, { x: 148, y: 60 });
    expect(path.length).toBeGreaterThan(0);
    const end = path[path.length - 1]!;
    expect(inStaffZone([zone], end)).toBe(false);
    const cell = cellAt(g, end);
    expect(isCellFree(g, cell.c, cell.r)).toBe(true);
    expect(Math.hypot(end.x - 148, end.y - 60)).toBeLessThan(48);
  });
});
