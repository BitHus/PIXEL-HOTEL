// CEL-2/3/4 (docs/PLAN-CELLAR.md) and the kitchen change of 18 Nov: the kitchen is an open annex of the tavern (kitchenAnnex.test.ts), the cellar stays a room.
// New game, doors, the cellar's rack cap, building the cellar, migrations 35 -> 37 and 36 -> 37 (the kitchen room is dissolved), the tutorial steps and the appeal.

import { describe, expect, it } from 'vitest';
import { tavernAppeal } from './appeal.ts';
import { startBrew, brewOf, collectBrew } from './brewing.ts';
import { caskTier, fillCask, kegRacks } from './casks.ts';
import { addCellarForRacks, buildCellar, cellarBuildProblem, cellarProblem, dissolveKitchenRoom } from './cellarRooms.ts';
import { CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL, CELLAR_UNLOCK_LEVEL, SAVE_VERSION } from './config.ts';
import { startCook } from './cooking.ts';
import { FIRST_TEN_STEPS, guideWaiting, FIRST_TEN_NEW, firstTenEvent, firstTenGoal } from './firstTen.ts';
import { canPlace, footprintRect, getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { innDoorSpots, innTravel, innTravelProblem } from './innDoors.ts';
import { kitchenZone, prepBonus } from './kitchen.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { createRoom, roomAnnex, type Room } from './room.ts';
import { readSave, toSaveText } from './save.ts';
import { upgradeCost, upgradeRoom } from './economy.ts';
import { kitchenRoomIds, cellarRoomIds, tavernWorkRoomIds } from './workRooms.ts';
import type { FurnitureItem } from './types.ts';

const MIN = 60_000;
const tavernOf = (s: GameState): Room => s.rooms.find((r) => r.id === s.tavern.roomId)!;
const cellarOf = (s: GameState) => s.rooms.find((r) => r.id === s.player.cellarRoomId)!;
const rich = (s: GameState, level = 2): GameState => ({ ...s, player: { ...s.player, level, wallet: { ...s.player.wallet, gold: 5000 } } });

/** A save as version 36 wrote it: the kitchen is a room (id 50) holding the stove and the barrel; the tavern has none of them. */
function save36(mutate: (s: GameState) => GameState = (s) => s, version = 36): string {
  const base = createNewPlayer(undefined, 1);
  const kitchen = { ...createRoom(50, 'shop', 1, base.player.id), kind: 'kitchen', shape: 'kitchen_room', w: 192, h: 160 } as unknown as Room;
  const items = base.items.map((i) => (i.typeId === 'stove' ? { ...i, roomId: 50, x: 112, y: 64 } : i.typeId === 'brewing_barrel' ? { ...i, roomId: 50, x: 176, y: 64 } : i));
  const player = { ...base.player, kitchenRoomId: 50 } as GameState['player'];
  return JSON.stringify({ version, savedAt: 9, state: mutate({ ...base, rooms: [...base.rooms, kitchen], items, player }) });
}
const load = (text: string): GameState => {
  const r = readSave(text);
  if (!r.ok) throw new Error(`load failed: ${r.problem}`);
  return r.state;
};
const roomOfItem = (s: GameState, typeId: string) => s.rooms.find((r) => r.id === s.items.find((i) => i.typeId === typeId)!.roomId);

describe('a new game', () => {
  const s = createNewPlayer(undefined, 0);
  it('has no kitchen room and no cellar; the start stove and barrel stand in the tavern inside the open kitchen', () => {
    expect(s.rooms.map((r) => r.kind).sort()).toEqual(['farm', 'hotel', 'lakeside', 'shop']);
    expect((s.player as { kitchenRoomId?: number }).kitchenRoomId).toBeUndefined();
    expect(s.player.cellarRoomId).toBeUndefined();
    const inside = kitchenZone(tavernOf(s))!;
    for (const id of ['stove', 'brewing_barrel']) {
      const i = s.items.find((x) => x.typeId === id)!;
      expect(i.roomId).toBe(s.tavern.roomId);
      expect(i.x >= inside.x && i.x <= inside.x + inside.w && i.y > inside.y && i.y <= inside.y + inside.h, id).toBe(true);
    }
  });
  it('lets the first brew and the first dish happen in the tavern (the tutorial path)', () => {
    const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    const crops = applyChange(s, { reason: 'debug', materials: { turnip: 4, potato: 2 } }, 0)!;
    const brewing = startBrew(crops, barrel.uid, 'root_ale', 0)!;
    expect(brewing).not.toBeNull();
    expect(collectBrew(brewing, barrel.uid, 1e9)).not.toBeNull();
    expect(startCook(crops, stove.uid, 'roasted_turnip', 1, 0)).not.toBeNull();
  });
  it('knows its work rooms: the tavern (the kitchen is inside it) and, once built, the cellar', () => {
    expect(kitchenRoomIds(s)).toEqual([s.tavern.roomId]);
    expect(cellarRoomIds(s)).toEqual([s.tavern.roomId]);
    expect(tavernWorkRoomIds(s)).toEqual([s.tavern.roomId]);
  });
  it('a prep table inside the annex next to the stove adds a dish', () => {
    const room = tavernOf(s);
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    expect(kitchenZone(room)).toEqual(roomAnnex(room));
    const table: FurnitureItem = { uid: 90, typeId: 'prep_table', ownerId: 1, roomId: room.id, x: stove.x - 48, y: stove.y, facing: 'down', onItemUid: null };
    expect(canPlace(room, s.items, getFurnitureType('prep_table'), table.x, table.y, 'down')).toBe(true);
    expect(prepBonus([...s.items, table], room, stove.uid)).toBe(1);
  });
});

describe('what may stand where', () => {
  const s = createNewPlayer(undefined, 0);
  it('the cellar takes keg racks, and only so many per level', () => {
    const built = buildCellar(rich(s), 5)!;
    const c = cellarOf(built);
    const racks = (n: number): FurnitureItem[] => Array.from({ length: n }, (_, i) => ({ uid: 100 + i, typeId: 'keg_rack', ownerId: 1, roomId: c.id, x: 64 + i * 64, y: 128, facing: 'down' as const, onItemUid: null }));
    const rack = getFurnitureType('keg_rack');
    expect(canPlace(c, racks(1), rack, 192, 128, 'down')).toBe(true);
    expect(canPlace(c, racks(2), rack, 192, 128, 'down')).toBe(false); // level 1: 2 racks
    const l2 = { ...c, level: 2 as const };
    expect(canPlace(l2, racks(2), rack, 256, 128, 'down')).toBe(true);
    expect(canPlace(l2, racks(3), rack, 320, 128, 'down')).toBe(false); // level 2 and 3: 3 racks
    expect(canPlace(c, [], getFurnitureType('stove'), 128, 128, 'down')).toBe(false);
  });
});

describe('the doors', () => {
  const s = createNewPlayer(undefined, 0);
  it('every tavern has a cellar doorway and none to a kitchen', () => {
    const ids = innDoorSpots(tavernOf(s)).map((d) => d.id);
    expect(ids).toContain('tavern_to_cellar');
    expect(ids.some((i) => i.includes('kitchen'))).toBe(false);
  });
  it('the cellar door goes nowhere until the cellar is built', () => {
    const tavern = tavernOf(s);
    expect(innTravelProblem(s, tavern.id, 'tavern_to_cellar')).toBe('no_room');
    const built = buildCellar(rich(s), 5)!;
    expect(innTravel(built, tavern.id, 'tavern_to_cellar')?.roomId).toBe(built.player.cellarRoomId);
    expect(innTravel(built, cellarOf(built).id, 'cellar_to_tavern')?.roomId).toBe(tavern.id);
  });
});

describe('building the cellar (CEL-4)', () => {
  const s = createNewPlayer(undefined, 0);
  it('needs the player level and the gold, and says why', () => {
    expect([CELLAR_BUILD_COST, CELLAR_UNLOCK_LEVEL]).toEqual([300, 2]);
    expect(cellarProblem({ ...s, player: { ...s.player, level: 1, wallet: { gold: 9999, gems: 0 } } })).toBe('level');
    expect(cellarProblem({ ...s, player: { ...s.player, level: 2, wallet: { gold: 299, gems: 0 } } })).toBe('gold');
    expect(cellarProblem(rich(s))).toBeNull();
    expect(cellarBuildProblem({ level: 2, wallet: { gold: 300, gems: 0 }, cellarRoomId: 7 })).toBe('built');
    expect(buildCellar({ ...s, player: { ...s.player, level: 1, wallet: { gold: 9999, gems: 0 } } }, 1)).toBeNull();
  });
  it('costs 300 gold through the ledger (reason build), gives a level 1 cellar with one free keg rack, and cannot be built twice', () => {
    const start = rich(s);
    const built = buildCellar(start, 5)!;
    expect(built.player.wallet.gold).toBe(start.player.wallet.gold - CELLAR_BUILD_COST);
    expect(built.ledger.at(-1)).toMatchObject({ reason: 'build' });
    expect(cellarOf(built)).toMatchObject({ kind: 'cellar', level: 1, w: 256, h: 160 });
    const racks = kegRacks(built.items, cellarRoomIds(built));
    expect(racks).toHaveLength(1);
    expect(racks[0]!.roomId).toBe(cellarOf(built).id);
    expect(buildCellar(built, 6)).toBeNull();
  });
  it('upgrades by the cellar prices 400 and 900 and keeps its racks', () => {
    const built = buildCellar(rich(s), 5)!;
    const c = cellarOf(built);
    expect(upgradeCost(c)).toBe(400);
    const l2 = upgradeRoom(built, c.id, 6)!;
    expect(cellarOf(l2)).toMatchObject({ level: 2, w: 320 });
    expect(upgradeCost(cellarOf(l2))).toBe(900);
    expect(kegRacks(l2.items, cellarRoomIds(l2))).toHaveLength(1);
    expect(upgradeCost(tavernOf(built))).toBe(300);
  });
  it('a cask on the free rack works from the cellar (fill, ripen by the exact ms, collect)', () => {
    const built = applyChange(buildCellar(rich(s), 5)!, { reason: 'debug', materials: { root_ale: 7 } }, 5)!;
    const rack = kegRacks(built.items, cellarRoomIds(built))[0]!;
    const filled = fillCask(built, rack.uid, 0, 'root_ale', 7, 100)!;
    expect(filled).not.toBeNull();
    expect(caskTier(filled.tavern.casks[0]!, 100 + 30 * MIN - 1)).toBe('fresh');
    expect(caskTier(filled.tavern.casks[0]!, 100 + 30 * MIN)).toBe('aged');
  });
});

describe('migration 36 -> 37 (the kitchen room is dissolved into the tavern)', () => {
  it('SAVE_VERSION is 40; a version 36 save loses its kitchen room: stove and barrel stand in the tavern, nothing is lost', () => {
    expect(SAVE_VERSION).toBe(40);
    const text = save36();
    const before = JSON.parse(text).state as GameState;
    const s = load(text);
    expect(s.rooms.some((r) => (r.kind as string) === 'kitchen')).toBe(false);
    expect((s.player as { kitchenRoomId?: number }).kitchenRoomId).toBeUndefined();
    for (const id of ['stove', 'brewing_barrel']) expect(roomOfItem(s, id)?.kind).toBe('shop');
    expect(s.items.map((i) => i.uid).sort((a, b) => a - b)).toEqual(before.items.map((i) => i.uid).sort((a, b) => a - b));
    expect(s.items.every((i) => i.roomId !== 50)).toBe(true);
  });
  it('the player standing in the kitchen room is put in the tavern', () => {
    const s = load(save36((x) => ({ ...x, currentRoomId: 50 })));
    expect(s.currentRoomId).toBe(s.tavern.roomId);
  });
  it('keeps a brew in progress and a cook exact (uids do not change)', () => {
    const text = save36((s) => {
      const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
      const stove = s.items.find((i) => i.typeId === 'stove')!;
      return { ...s, tavern: { ...s.tavern, brews: [{ barrelUid: barrel.uid, drink: 'root_ale', readyAt: 123_456 }], cooks: [{ stoveUid: stove.uid, food: 'roasted_turnip', qty: 2, readyAt: 77_000 }] } };
    });
    const before = JSON.parse(text).state as GameState;
    const s = load(text);
    const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
    expect(brewOf(s.tavern.brews, barrel.uid)?.readyAt).toBe(123_456);
    expect(s.tavern.cooks).toEqual(before.tavern.cooks);
  });
  it('moves prep table, pantry, sink and hatch of the kitchen room in or to the bag; the casks on a keg rack stay exact', () => {
    const text = save36((s) => {
      const extra: FurnitureItem[] = [
        { uid: 80, typeId: 'prep_table', ownerId: 1, roomId: 50, x: 64, y: 128, facing: 'down', onItemUid: null },
        { uid: 81, typeId: 'pantry', ownerId: 1, roomId: 50, x: 128, y: 128, facing: 'down', onItemUid: null },
        { uid: 82, typeId: 'sink', ownerId: 1, roomId: 50, x: 16, y: 96, facing: 'down', onItemUid: null },
        { uid: 83, typeId: 'serving_hatch', ownerId: 1, roomId: 50, x: 96, y: 160, facing: 'down', onItemUid: null },
        { uid: 84, typeId: 'keg_rack', ownerId: 1, roomId: null, x: 0, y: 0, facing: 'down', onItemUid: null },
      ];
      const next: GameState = { ...s, items: [...s.items, ...extra], nextUid: 90 };
      return { ...next, tavern: { ...next.tavern, casks: [{ rackUid: 84, slot: 0, drink: 'root_ale', mugs: 7, startedAt: 1000 }] } };
    });
    const before = JSON.parse(text).state as GameState;
    const s = load(text);
    expect(s.items.map((i) => i.uid).sort((a, b) => a - b)).toEqual(before.items.map((i) => i.uid).sort((a, b) => a - b));
    for (const uid of [80, 81, 82, 83]) {
      const i = s.items.find((x) => x.uid === uid)!;
      expect(i.roomId === s.tavern.roomId || i.roomId === null, `item ${uid}`).toBe(true);
    }
    expect(s.tavern.casks).toEqual([{ rackUid: 84, slot: 0, drink: 'root_ale', mugs: 7, startedAt: 1000 }]);
  });
  it('is idempotent and a saved result loads as itself', () => {
    const s = load(save36());
    expect(dissolveKitchenRoom(s)).toEqual(s);
    expect(addCellarForRacks(s)).toBe(s);
    expect(readSave(toSaveText(s, 5))).toMatchObject({ ok: true, migrated: false });
  });
  it('a version 35 save gets no kitchen room at all (the cellar only when it owns a keg rack)', () => {
    const s = load(save36((x) => x, 35));
    expect(s.rooms.some((r) => (r.kind as string) === 'kitchen')).toBe(false);
    expect(s.player.cellarRoomId).toBeUndefined();
  });
});

describe('the tutorial (CEL-3)', () => {
  it('has no kitchen step any more; the barrel comes after the coins, the cellar step after load', () => {
    expect(FIRST_TEN_STEPS as readonly string[]).not.toContain('kitchen');
    expect(FIRST_TEN_STEPS.indexOf('coins')).toBeLessThan(FIRST_TEN_STEPS.indexOf('barrel'));
    expect(FIRST_TEN_STEPS.indexOf('cellar')).toBeGreaterThan(FIRST_TEN_STEPS.indexOf('load'));
  });
  it('shows the barrel as the goal after the coins step; the cellar step waits until the cellar is built', () => {
    let g = FIRST_TEN_NEW;
    for (const step of ['zoom', 'walk', 'holdwalk', 'menu', 'pour', 'serve', 'coins'] as const) g = firstTenEvent(g, step);
    const quiet = { brewReady: false, guestWaiting: false, pouring: false, trayServes: false, coinsOnTable: false, mineOpen: true };
    expect(firstTenGoal(g, guideWaiting(g, quiet))).toBe('barrel');
    expect(guideWaiting(g, quiet)).toContain('cellar');
    expect(guideWaiting(g, { ...quiet, cellarBuilt: true })).not.toContain('cellar');
  });
});

describe('the tavern appeal counts the cellar', () => {
  it('a decor piece in the cellar counts only when the cellar is listed', () => {
    const s = buildCellar(rich(createNewPlayer(undefined, 0)), 5)!;
    const tavern = tavernOf(s);
    const lamp: FurnitureItem = { uid: 90, typeId: 'lamp', ownerId: 1, roomId: cellarOf(s).id, x: 64, y: 128, facing: 'down', onItemUid: null };
    const items = [...s.items, lamp];
    expect(tavernAppeal(tavern, items)).toBe(tavernAppeal(tavern, s.items));
    expect(tavernAppeal(tavern, items, [cellarOf(s).id])).toBeGreaterThanOrEqual(tavernAppeal(tavern, s.items, [cellarOf(s).id]));
  });
});
