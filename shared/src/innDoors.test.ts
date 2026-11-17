// Inn doors (step MB-2): the door data per shape and level, what may stand on a spot, guests, travel, clearing spots, the upgrade.

import { describe, expect, it } from 'vitest';
import { applyChange } from './ledger.ts';
import { blockProblem, placeBlock } from './blocks.ts';
import { getBlockType } from './blockTypes.ts';
import { canPlace, doorPoint, doorReachesMiddle, footprintRect, getFurnitureType, roomBlockers, staffZone } from './furniture.ts';
import { clearDoorSpots } from './innDoorClear.ts';
import { doorAt, innDoorFile, innDoorSpotRects, innDoorSpots, innDoorwayRects, innTravel, innTravelProblem } from './innDoors.ts';
import { buildNavGrid, cellAt, isCellFree, reachableCells } from './nav.ts';
import { configForChoice, createNewPlayer, DEFAULT_NEW_PLAYER } from './newPlayer.ts';
import { guestZones, npcGrid } from './npcNav.ts';
import { kitchenZone } from './kitchen.ts';
import { cellOnFloor, createRoom, doorZoneRect, rectsOverlap, shapesFor, type Room, type RoomKind } from './room.ts';
import { plantProblem } from './farm.ts';
import { upgradeRoom } from './economy.ts';
import { BUILD_CELL, WALL_BAND, type RoomLevel } from './config.ts';
import { ledgerMaterials } from './testState.ts';
import type { DungeonRun } from './dungeon/run.ts';
import type { GameState } from './gameState.ts';

const LEVELS: RoomLevel[] = [1, 2, 3];
const ctx = { standing: [], from: null };

/** A new game whose tavern has this shape (the start items stand where the shape says). */
function tavernOf(shape: string): GameState {
  return createNewPlayer(configForChoice({ name: 'A', look: DEFAULT_NEW_PLAYER.look, hotelShape: 'square', shopShape: shape })!, 0);
}
const roomOfKind = (s: GameState, kind: RoomKind): Room => s.rooms.find((r) => r.kind === kind)!;
const shopShapes = shapesFor('shop').filter((s) => s.shopStart);

describe('Inn door data', () => {
  it('has one door in the suite, four in the tavern (suite, garden, kitchen, cellar), one in the garden, the kitchen and the cellar, on every shape and level', () => {
    for (const sh of shapesFor('hotel')) for (const l of LEVELS) expect(innDoorSpots(createRoom(1, 'hotel', l, 1, sh.id)).map((d) => d.id)).toEqual(['suite_to_tavern']);
    for (const sh of shopShapes) for (const l of LEVELS) expect(innDoorSpots(createRoom(1, 'shop', l, 1, sh.id)).map((d) => d.id).sort()).toEqual(['tavern_to_cellar', 'tavern_to_garden', 'tavern_to_kitchen', 'tavern_to_suite']);
    for (const l of LEVELS) expect(innDoorSpots(createRoom(1, 'farm', l, 1, 'farm')).map((d) => d.id)).toEqual(['garden_to_tavern']);
    for (const l of LEVELS) {
      expect(innDoorSpots(createRoom(1, 'kitchen', l, 1)).map((d) => d.id)).toEqual(['kitchen_to_tavern']);
      expect(innDoorSpots(createRoom(1, 'cellar', l, 1)).map((d) => d.id)).toEqual(['cellar_to_tavern']);
    }
    expect(innDoorSpots(createRoom(1, 'lakeside', 1, 1, 'lakeside'))).toEqual([]);
  });

  it('links every door to the matching door of the other room (both ways)', () => {
    const { links } = innDoorFile();
    for (const [id, link] of Object.entries(links)) expect(links[link.arrive]?.arrive).toBe(id);
  });

  it('puts every spot on the floor in front of an up-facing floor edge (a back wall band), 2 x 1 cells, off the door zone and each other', () => {
    const all: Room[] = [
      ...shapesFor('hotel').flatMap((sh) => LEVELS.map((l) => createRoom(1, 'hotel', l, 1, sh.id))),
      ...shopShapes.flatMap((sh) => LEVELS.map((l) => createRoom(1, 'shop', l, 1, sh.id))),
      ...LEVELS.map((l) => createRoom(1, 'farm', l, 1, 'farm')),
      ...LEVELS.map((l) => createRoom(1, 'kitchen', l, 1)),
      ...LEVELS.map((l) => createRoom(1, 'cellar', l, 1)),
    ];
    for (const room of all) {
      for (const d of innDoorSpots(room)) {
        expect(d.w).toBe(2);
        expect(d.spot).toEqual({ x: d.col * BUILD_CELL, y: d.row * BUILD_CELL, w: 2 * BUILD_CELL, h: BUILD_CELL });
        expect(d.doorway.h).toBe(WALL_BAND);
        for (let c = d.col; c < d.col + d.w; c++) {
          expect(cellOnFloor(room, c, d.row), `${room.kind} ${room.shape} L${room.level} ${d.id}`).toBe(true);
          expect(cellOnFloor(room, c, d.row - 1)).toBe(false);
        }
        expect(rectsOverlap(d.spot, doorZoneRect(room))).toBe(false);
      }
      const rects = innDoorSpotRects(room);
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
    }
  });

  it('keeps the spots off the kitchen zone, the bar and its staff spot and every start item of the tavern; they stay reachable from the main door', () => {
    for (const sh of shopShapes) {
      const s = tavernOf(sh.id);
      for (const l of LEVELS) {
        const grown = createRoom(roomOfKind(s, 'shop').id, 'shop', l, s.player.id, sh.id);
        const items = s.items.filter((i) => i.roomId === grown.id && i.onItemUid === null && !getFurnitureType(i.typeId).wall);
        const zones = [
          ...items.map((i) => footprintRect(i, getFurnitureType(i.typeId))),
          ...items.filter((i) => getFurnitureType(i.typeId).servedFromBehind).map((i) => staffZone(i, getFurnitureType(i.typeId))),
        ];
        const kitchen = kitchenZone(grown);
        const grid = buildNavGrid(grown, roomBlockers(grown, s.items));
        const door = cellAt(grid, doorPoint(grown));
        const reach = reachableCells(grid, door.r * grid.cols + door.c);
        for (const spot of innDoorSpotRects(grown)) {
          expect(zones.some((z) => rectsOverlap(spot, z)), `${sh.id} L${l}`).toBe(false);
          // CEL-2: only the door to the kitchen room may stand inside the tavern's old kitchen zone (staff only, the door is theirs).
          const isKitchenDoor = innDoorSpots(grown).some((d) => d.spot.x === spot.x && d.spot.y === spot.y && d.id === 'tavern_to_kitchen');
          expect(!isKitchenDoor && kitchen !== null && rectsOverlap(spot, kitchen), `${sh.id} L${l} kitchen`).toBe(false);
          const r = spot.y / BUILD_CELL;
          for (let c = spot.x / BUILD_CELL; c < (spot.x + spot.w) / BUILD_CELL; c++) {
            expect(isCellFree(grid, c, r) && reach[r * grid.cols + c] === true, `${sh.id} L${l} reachable`).toBe(true);
          }
        }
      }
    }
  });

  it('keeps the spots reachable in a new hotel room and a new farm', () => {
    const s = tavernOf('square_shop');
    for (const kind of ['hotel', 'farm'] as const) {
      const room = roomOfKind(s, kind);
      const grid = buildNavGrid(room, roomBlockers(room, s.items));
      const door = cellAt(grid, doorPoint(room));
      const reach = reachableCells(grid, door.r * grid.cols + door.c);
      for (const spot of innDoorSpotRects(room)) expect(reach[(spot.y / BUILD_CELL) * grid.cols + spot.x / BUILD_CELL]).toBe(true);
    }
  });

  it('finds the door at a cell', () => {
    const room = createRoom(1, 'farm', 1, 1, 'farm');
    const d = innDoorSpots(room)[0]!;
    expect(doorAt(room, { c: d.col, r: d.row })?.id).toBe('garden_to_tavern');
    expect(doorAt(room, { c: d.col + 1, r: d.row })?.id).toBe('garden_to_tavern');
    expect(doorAt(room, { c: d.col + 2, r: d.row })).toBeNull();
    expect(doorAt(room, { c: d.col, r: d.row + 1 })).toBeNull();
  });
});

describe('what may stand on a spot', () => {
  const s = tavernOf('square_shop');
  const hotel = roomOfKind(s, 'hotel');
  const farm = roomOfKind(s, 'farm');
  const shop = roomOfKind(s, 'shop');
  const spot = innDoorSpots(hotel)[0]!;

  it('refuses floor furniture on a spot (also a rug) and accepts the same piece next to it', () => {
    const chair = getFurnitureType('chair');
    const x = spot.col * BUILD_CELL + BUILD_CELL / 2;
    expect(canPlace(hotel, [], chair, x, (spot.row + 1) * BUILD_CELL, 'down')).toBe(false);
    expect(canPlace(hotel, [], getFurnitureType('rug'), x + BUILD_CELL, (spot.row + 2) * BUILD_CELL, 'down')).toBe(false);
    expect(canPlace(hotel, [], chair, x, (spot.row + 2) * BUILD_CELL, 'down')).toBe(true);
  });

  it('refuses a wall item over the doorway but takes one beside it', () => {
    const torch = getFurnitureType('wall_torch');
    const foot = spot.row * BUILD_CELL;
    expect(canPlace(hotel, [], torch, spot.spot.x + 32, foot, 'down')).toBe(false);
    expect(canPlace(hotel, [], torch, spot.spot.x - 64, foot, 'down')).toBe(true);
    expect(innDoorwayRects(hotel)[0]).toEqual(spot.doorway);
  });

  it('refuses a block (reason inn_door) and a plant on a spot', () => {
    expect(blockProblem(hotel, s.items, getBlockType('planks'), spot.col, spot.row, ctx)).toBe('inn_door');
    expect(blockProblem(hotel, s.items, getBlockType('planks'), spot.col + 1, spot.row, ctx)).toBe('inn_door');
    expect(blockProblem(hotel, s.items, getBlockType('planks'), spot.col + 2, spot.row, ctx)).toBeNull();
    const fd = innDoorSpots(farm)[0]!;
    const withSoil = { ...farm, floorCells: { ...farm.floorCells, [`${fd.col},${fd.row}`]: 'soil' } };
    expect(plantProblem(withSoil, s.items, fd.col, fd.row, ctx)).toBe('inn_door');
    const given = applyChange(s, { reason: 'debug', materials: { planks: 1 } }, 1)!;
    expect(placeBlock(given, hotel.id, spot.col, spot.row, 'planks', 1, ctx)).toEqual({ ok: false, problem: 'inn_door' });
    expect(shop.kind).toBe('shop');
  });

  it('keeps the door-zone rules: the door still reaches the middle with a spot free, and the door zone stays free', () => {
    for (const room of [hotel, shop, farm]) expect(doorReachesMiddle(room, roomBlockers(room, s.items))).toBe(true);
    const z = doorZoneRect(hotel);
    expect(canPlace(hotel, [], getFurnitureType('chair'), z.x + 16, z.y + 32, 'down')).toBe(false);
  });
});

describe('guests', () => {
  it('never path through the spots of the tavern', () => {
    const s = tavernOf('square_shop');
    const shop = roomOfKind(s, 'shop');
    const zones = guestZones(s.items, shop);
    for (const sp of innDoorSpotRects(shop)) expect(zones).toContainEqual(sp);
    const grid = npcGrid(buildNavGrid(shop, roomBlockers(shop, s.items)), zones);
    for (const sp of innDoorSpotRects(shop)) {
      const c0 = sp.x / BUILD_CELL;
      const r0 = sp.y / BUILD_CELL;
      expect(isCellFree(grid, c0, r0)).toBe(false);
      expect(isCellFree(grid, c0 + 1, r0)).toBe(false);
    }
  });
});

describe('innTravel', () => {
  const s = tavernOf('square_shop');
  const hotel = roomOfKind(s, 'hotel');
  const shop = roomOfKind(s, 'shop');
  const farm = roomOfKind(s, 'farm');

  it('walks suite - tavern - garden and back, arriving on the matching door spot facing down', () => {
    const t = innTravel(s, hotel.id, 'suite_to_tavern')!;
    expect(t.roomId).toBe(shop.id);
    const arrive = innDoorSpots(shop).find((d) => d.id === 'tavern_to_suite')!;
    expect(t.cell).toEqual({ c: arrive.col, r: arrive.row });
    expect(t.point).toEqual({ x: arrive.spot.x + 16, y: arrive.spot.y + 16 });
    expect(t.stepTo).toEqual({ x: t.point.x, y: t.point.y + BUILD_CELL });
    expect(t.facing).toBe('down');
    expect(innTravel(s, shop.id, 'tavern_to_garden')?.roomId).toBe(farm.id);
    expect(innTravel(s, farm.id, 'garden_to_tavern')?.roomId).toBe(shop.id);
    expect(innTravel(s, shop.id, 'tavern_to_suite')?.roomId).toBe(hotel.id);
  });

  it('refuses a door that is not in this room, an unknown door and a missing room', () => {
    expect(innTravel(s, hotel.id, 'tavern_to_garden')).toBeNull();
    expect(innTravel(s, hotel.id, 'nope')).toBeNull();
    expect(innTravel(s, 999, 'suite_to_tavern')).toBeNull();
    expect(innTravel({ ...s, rooms: s.rooms.filter((r) => r.kind !== 'shop') }, hotel.id, 'suite_to_tavern')).toBeNull();
    expect(innTravelProblem(s, hotel.id, 'nope')).toBe('no_door');
    expect(innTravelProblem(s, hotel.id, 'suite_to_tavern')).toBeNull();
  });

  it('refuses during a dungeon or mine run and changes nothing', () => {
    const before = JSON.stringify(s);
    const running = { ...s, run: { floor: 1 } as unknown as DungeonRun };
    expect(innTravel(running, hotel.id, 'suite_to_tavern')).toBeNull();
    expect(innTravelProblem(running, hotel.id, 'suite_to_tavern')).toBe('in_run');
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('clearing door spots', () => {
  it('sends furniture, blocks and a plant on a spot back to the bag (ledger door_spot) and leaves the rest', () => {
    const s0 = tavernOf('square_shop');
    const hotel = roomOfKind(s0, 'hotel');
    const hs = innDoorSpots(hotel)[0]!;
    const farm = roomOfKind(s0, 'farm');
    const fs = innDoorSpots(farm)[0]!;
    const chairUid = s0.nextUid;
    const s: GameState = {
      ...s0,
      nextUid: s0.nextUid + 2,
      items: [
        ...s0.items,
        { uid: chairUid, typeId: 'chair', ownerId: s0.player.id, roomId: hotel.id, x: hs.col * BUILD_CELL + 16, y: (hs.row + 1) * BUILD_CELL, facing: 'down', onItemUid: null },
        { uid: chairUid + 1, typeId: 'chair', ownerId: s0.player.id, roomId: hotel.id, x: 16, y: 10 * BUILD_CELL, facing: 'down', onItemUid: null },
      ],
      rooms: s0.rooms.map((r) =>
        r.id === hotel.id
          ? { ...r, blocks: { [`${hs.col + 1},${hs.row}`]: [{ id: 'planks', hits: 0, hitAt: 0 }], '0,5': [{ id: 'planks', hits: 0, hitAt: 0 }] } }
          : r.id === farm.id
            ? { ...r, plants: { [`${fs.col},${fs.row}`]: { seed: 'turnip_seed', plantedAt: 0, readyAt: 100 } } }
            : r,
      ),
    };
    const out = clearDoorSpots(s, hotel.id, 5);
    expect(out.moved).toBe(2);
    expect(out.state.items.find((i) => i.uid === chairUid)!.roomId).toBeNull();
    expect(out.state.items.find((i) => i.uid === chairUid + 1)!.roomId).toBe(hotel.id);
    expect(Object.keys(out.state.rooms.find((r) => r.id === hotel.id)!.blocks)).toEqual(['0,5']);
    expect(out.state.player.materials.planks).toBe(1);
    expect(out.state.ledger.at(-1)).toMatchObject({ reason: 'door_spot', materials: { planks: 1 } });
    const out2 = clearDoorSpots(out.state, farm.id, 6);
    expect(out2.moved).toBe(1);
    expect(out2.state.rooms.find((r) => r.id === farm.id)!.plants).toEqual({});
    expect(out2.state.player.materials.turnip_seed).toBe(1);
    // The ledger adds up to the bag.
    expect(ledgerMaterials(out2.state)).toEqual(ledgerMaterials(s0) && { ...ledgerMaterials(s0), planks: 1, turnip_seed: 1 });
    // Nothing more to clear the second time.
    expect(clearDoorSpots(out2.state, farm.id, 7).moved).toBe(0);
  });

  it('a room upgrade keeps working with door spots (the spots of the new level stay free)', () => {
    const s0 = tavernOf('square_shop');
    const gold = applyChange(s0, { reason: 'debug', gold: 5000 }, 1)!;
    const up = upgradeRoom(gold, roomOfKind(gold, 'hotel').id, 2)!;
    expect(up).not.toBeNull();
    expect(innDoorSpots(roomOfKind(up, 'hotel'))).toHaveLength(1);
    expect(roomOfKind(up, 'hotel').level).toBe(2);
  });
});
