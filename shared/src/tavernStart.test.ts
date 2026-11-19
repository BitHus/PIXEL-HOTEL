// Step S3: what a new tavern starts with: three seats (a third stool at the table replaces the stall table), the early dish on the menu, 7 mugs of root ale,
// and the first hour of the model matches what a hand-run of the game gives.

import { describe, expect, it } from 'vitest';
import { TAVERN_START_DISH, TAVERN_START_DRINK } from './config.ts';
import { itemBlockers } from './furniture.ts';
import { DEFAULT_NEW_PLAYER, createNewPlayer } from './newPlayer.ts';
import { buildNavGrid, findPath } from './nav.ts';
import { doorPoint } from './furniture.ts';
import { shapesFor } from './room.ts';
import { getDrinkType } from './materials.ts';
import { menuOffers, menuRows, tavernSeats } from './tavern.ts';
import { startCook } from './cooking.ts';
import { firstHourGold } from './balance.ts';

describe('a new tavern (step S3)', () => {
  it('START LAYOUT REDO (19 Nov): at least four seats on every shop shape (a chair on every side of the table, bar stools at a long bar), all reachable from the door', () => {
    for (const shape of shapesFor('shop')) {
      const s = createNewPlayer({ ...DEFAULT_NEW_PLAYER, shopShape: shape.id }, 0);
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId)!;
      const seats = tavernSeats(s.items, room.id);
      expect(seats.length, shape.id).toBeGreaterThanOrEqual(4);
      const grid = buildNavGrid(room, itemBlockers(s.items, room.id));
      for (const seat of seats) {
        // A guest walks to the cell beside the seat's stool (the seat itself is blocked by the stool): some path from the door must end near it.
        const path = findPath(grid, doorPoint(room), { x: seat.x, y: seat.y + 32 }) ?? findPath(grid, doorPoint(room), { x: seat.x + 32, y: seat.y }) ?? findPath(grid, doorPoint(room), { x: seat.x - 32, y: seat.y }) ?? findPath(grid, doorPoint(room), { x: seat.x, y: seat.y - 32 });
        expect(path, `${shape.id} seat ${seat.uid}`).not.toBeNull();
      }
    }
  });

  it('has no stall table (old saves keep theirs)', () => {
    expect(createNewPlayer(undefined, 0).items.some((i) => i.typeId === 'stall_table')).toBe(false);
  });

  it('owner 19 Nov: four chairs at the table and two bar stools at the bar (6 seats in the square tavern)', () => {
    const s = createNewPlayer(undefined, 0);
    const bars = new Set(s.items.filter((i) => i.typeId === 'bar').map((i) => i.uid));
    const round = s.items.find((i) => i.typeId === 'table')!;
    const seats = tavernSeats(s.items, s.tavern.roomId);
    expect(seats.filter((k) => bars.has(k.tableUid))).toHaveLength(2);
    expect(seats.filter((k) => k.tableUid === round.uid)).toHaveLength(4);
  });

  it('the start barrel holds 7 root ale and the early dish is on the menu', () => {
    const s = createNewPlayer(undefined, 0);
    expect(TAVERN_START_DRINK).toBe('root_ale');
    // Step T1: the 7 root ale of a new game are loaded on the first tap; the barrel starts idle.
    expect(s.tavern.brews).toEqual([]);
    expect(s.tavern.taps).toMatchObject([{ drink: 'root_ale', slot: 0, mugs: getDrinkType('root_ale').mugs }]);
    expect(s.tavern.taps[0]!.mugs).toBe(7);
    expect(menuRows(s).find((r) => r.id === 'root_ale')).toMatchObject({ on: true, stock: 7 });
    expect(menuRows(s).find((r) => r.id === TAVERN_START_DISH)).toMatchObject({ on: true, stock: 0, price: 14 }); // on, but no stock: no guest is offered a dish that is not there
    expect(menuOffers(s).some((o) => o.id === TAVERN_START_DISH)).toBe(false);
    expect(s.tavern.menu[TAVERN_START_DISH]).toEqual({ on: true, price: 14 });
  });

  it('a cooked roasted turnip is offered at once (the stove has 20 s of work; one turnip per dish)', () => {
    let s = createNewPlayer(undefined, 0);
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    const wheat = { ...s, player: { ...s.player, materials: { ...s.player.materials, turnip: 2 } } };
    const cooked = startCook(wheat, stove.uid, 'roasted_turnip', 2, 0);
    expect(cooked).not.toBeNull();
    s = cooked!;
    expect(s.tavern.cooks).toHaveLength(1);
    expect(menuOffers({ ...s, player: { ...s.player, materials: { ...s.player.materials, roasted_turnip: 2 } } }).some((o) => o.id === 'roasted_turnip')).toBe(true);
  });

  it('the model: 30 minutes about 220 gold, the first hour about 460 (7 mugs a visit at 9 gold, 2 dishes at 14 every 20 minutes)', () => {
    expect(firstHourGold(30).gold).toBe(7 * 3 * 9 + 2 * 14);
    expect(firstHourGold(60).gold).toBe(7 * 6 * 9 + 6 * 14);
    expect(firstHourGold(0).gold).toBe(0);
  });
});
