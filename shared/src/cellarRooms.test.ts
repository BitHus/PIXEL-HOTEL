// CEL-2/3/4 (docs/PLAN-CELLAR.md): the attached kitchen and cellar rooms: new game, doors, the zone rule in both rooms, the 35 -> 36 migration, building the cellar,
// the rack cap, the tutorial steps and the appeal.

import { describe, expect, it } from 'vitest';
import { tavernAppeal } from './appeal.ts';
import { startBrew, brewOf, collectBrew } from './brewing.ts';
import { caskTier, fillCask, kegRacks } from './casks.ts';
import { addCellarForRacks, addKitchenRoom, buildCellar, cellarBuildProblem, cellarProblem } from './cellarRooms.ts';
import { CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL, CELLAR_UNLOCK_LEVEL, SAVE_VERSION } from './config.ts';
import { startCook } from './cooking.ts';
import { FIRST_TEN_STEPS, guideAutoEvents, guideWaiting, FIRST_TEN_NEW, firstTenEvent, firstTenGoal } from './firstTen.ts';
import { canPlace, getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { innDoorSpots, innTravel, innTravelProblem } from './innDoors.ts';
import { kitchenZone, prepBonus } from './kitchen.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { readSave, toSaveText } from './save.ts';
import { withTavernMachines } from './tavernTest.ts';
import { upgradeCost, upgradeRoom } from './economy.ts';
import { kitchenRoomIds, cellarRoomIds, tavernWorkRoomIds } from './workRooms.ts';
import type { FurnitureItem } from './types.ts';

const MIN = 60_000;
const kitchenOf = (s: GameState) => s.rooms.find((r) => r.id === s.player.kitchenRoomId)!;
const cellarOf = (s: GameState) => s.rooms.find((r) => r.id === s.player.cellarRoomId)!;
const rich = (s: GameState, level = 2): GameState => ({ ...s, player: { ...s.player, level, wallet: { ...s.player.wallet, gold: 5000 } } });

/** A save as it was before CEL-2 (version 35): no kitchen room, the stove and the barrel in the tavern. */
function oldSave(mutate: (s: GameState) => GameState = (s) => s): string {
  const s = mutate(withTavernMachines(createNewPlayer(undefined, 1)));
  const { kitchenRoomId: _k, ...player } = s.player;
  const old = { ...s, player, rooms: s.rooms.filter((r) => r.kind !== 'kitchen') };
  return JSON.stringify({ version: 35, savedAt: 9, state: old });
}
const load = (text: string): GameState => {
  const r = readSave(text);
  if (!r.ok) throw new Error(`load failed: ${r.problem}`);
  return r.state;
};
const roomOfItem = (s: GameState, typeId: string) => s.rooms.find((r) => r.id === s.items.find((i) => i.typeId === typeId)!.roomId);

describe('a new game (CEL-2)', () => {
  const s = createNewPlayer(undefined, 0);
  it('has the free kitchen with the start stove and barrel inside, no cellar, and no stove or barrel in the tavern', () => {
    expect(kitchenOf(s)).toMatchObject({ kind: 'kitchen', level: 1, w: 192, h: 160 });
    expect(s.player.cellarRoomId).toBeUndefined();
    expect(s.items.filter((i) => i.roomId === s.tavern.roomId).some((i) => i.typeId === 'stove' || i.typeId === 'brewing_barrel')).toBe(false);
    expect(s.items.filter((i) => i.roomId === kitchenOf(s).id).map((i) => i.typeId).sort()).toEqual(['brewing_barrel', 'stove']);
  });
  it('lets the first brew and the first dish happen in the kitchen (the tutorial path)', () => {
    const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    const crops = applyChange(s, { reason: 'debug', materials: { turnip: 4, potato: 2 } }, 0)!;
    const brewing = startBrew(crops, barrel.uid, 'root_ale', 0)!;
    expect(brewing).not.toBeNull();
    expect(collectBrew(brewing, barrel.uid, 1e9)).not.toBeNull();
    expect(startCook(crops, stove.uid, 'roasted_turnip', 1, 0)).not.toBeNull();
  });
  it('knows its work rooms', () => {
    expect(kitchenRoomIds(s)).toEqual([s.tavern.roomId, s.player.kitchenRoomId]);
    expect(cellarRoomIds(s)).toEqual([s.tavern.roomId]);
    expect(tavernWorkRoomIds(s)).toEqual([s.tavern.roomId, s.player.kitchenRoomId]);
  });
  it('whole room is the kitchen zone: a prep table next to the stove adds a dish', () => {
    const room = kitchenOf(s);
    expect(kitchenZone(room)).toEqual({ x: 0, y: 0, w: room.w, h: room.h });
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    const table: FurnitureItem = { uid: 90, typeId: 'prep_table', ownerId: 1, roomId: room.id, x: stove.x - 48, y: stove.y, facing: 'down', onItemUid: null };
    expect(canPlace(room, s.items, getFurnitureType('prep_table'), table.x, table.y, 'down')).toBe(true);
    expect(prepBonus([...s.items, table], room, stove.uid)).toBe(1);
  });
});

describe('what may stand where', () => {
  const s = createNewPlayer(undefined, 0);
  const k = kitchenOf(s);
  it('the kitchen takes the kitchen pieces and decor, never the bar, taps or keg racks', () => {
    expect(canPlace(k, [], getFurnitureType('stove'), 16, 128, 'down')).toBe(true);
    expect(canPlace(k, [], getFurnitureType('counter'), 96, 128, 'down')).toBe(false);
    expect(canPlace(k, [], getFurnitureType('keg_rack'), 96, 128, 'down')).toBe(false);
    expect(canPlace(k, [], getFurnitureType('lamp'), 16, 128, 'down')).toBe(true);
  });
  it('the cellar takes keg racks, and only so many per level', () => {
    const built = buildCellar(rich(s), 5)!;
    const c = cellarOf(built);
    const racks = (n: number): FurnitureItem[] => Array.from({ length: n }, (_, i) => ({ uid: 100 + i, typeId: 'keg_rack', ownerId: 1, roomId: c.id, x: 64 + i * 64, y: 128, facing: 'down' as const, onItemUid: null }));
    const rack = getFurnitureType('keg_rack');
    expect(canPlace(c, racks(1), rack, 192, 128, 'down')).toBe(true);
    expect(canPlace(c, racks(2), rack, 192, 128, 'down')).toBe(false); // level 1: 2 racks
    const l2 = { ...c, level: 2 as const };
    expect(canPlace(l2, racks(3), rack, 256, 128, 'down')).toBe(true);
    expect(CELLAR_RACK_MAX_BY_LEVEL).toEqual([2, 4, 6]);
    expect(canPlace(c, [], getFurnitureType('stove'), 128, 128, 'down')).toBe(false);
  });
});

describe('the doors (CEL-2/4)', () => {
  const s = createNewPlayer(undefined, 0);
  it('every tavern has a kitchen and a cellar doorway; the kitchen and the cellar each have one back', () => {
    const tavern = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    expect(innDoorSpots(tavern).map((d) => d.id)).toEqual(expect.arrayContaining(['tavern_to_kitchen', 'tavern_to_cellar']));
    expect(innDoorSpots(kitchenOf(s)).map((d) => d.id)).toEqual(['kitchen_to_tavern']);
  });
  it('lead from the tavern to the kitchen and back; the cellar door goes nowhere until the cellar is built', () => {
    const tavern = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    const inKitchen = innTravel(s, tavern.id, 'tavern_to_kitchen');
    expect(inKitchen?.roomId).toBe(s.player.kitchenRoomId);
    expect(innTravel(s, kitchenOf(s).id, 'kitchen_to_tavern')?.roomId).toBe(tavern.id);
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
    expect(upgradeCost(kitchenOf(built))).toBe(300);
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

describe('migration 35 -> 36 (CEL-2)', () => {
  it('SAVE_VERSION is 36 and a version 35 save with nothing special gets the kitchen with the stove and barrel; no cellar', () => {
    expect(SAVE_VERSION).toBe(36);
    const s = load(oldSave());
    expect(kitchenOf(s)).toMatchObject({ kind: 'kitchen', level: 1 });
    expect(roomOfItem(s, 'stove')?.kind).toBe('kitchen');
    expect(roomOfItem(s, 'brewing_barrel')?.kind).toBe('kitchen');
    expect(s.player.cellarRoomId).toBeUndefined();
    expect(new Set(s.items.map((i) => i.uid)).size).toBe(s.items.length);
  });
  it('keeps a brew in progress exact (the barrel keeps its uid, so readyAt stays) and a cook too', () => {
    const text = oldSave((s) => {
      const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
      const stove = s.items.find((i) => i.typeId === 'stove')!;
      return { ...s, tavern: { ...s.tavern, brews: [{ barrelUid: barrel.uid, drink: 'root_ale', readyAt: 123_456 }], cooks: [{ stoveUid: stove.uid, food: 'roasted_turnip', qty: 2, readyAt: 77_000 }] } };
    });
    const before = JSON.parse(text).state as GameState;
    const s = load(text);
    const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
    expect(brewOf(s.tavern.brews, barrel.uid)?.readyAt).toBe(123_456);
    expect(s.tavern.cooks).toEqual(before.tavern.cooks);
    expect(s.items.find((i) => i.typeId === 'stove')!.roomId).toBe(s.player.kitchenRoomId);
  });
  it('a save with a keg rack and a cask half way gets a free cellar; the cask keeps rackUid and startedAt, so the tier by exact ms is the same', () => {
    const text = oldSave((s) => {
      const withRack: GameState = { ...s, items: [...s.items, { uid: 70, typeId: 'keg_rack', ownerId: 1, roomId: s.tavern.roomId, x: 96, y: 288, facing: 'down', onItemUid: null }] };
      return { ...withRack, tavern: { ...withRack.tavern, casks: [{ rackUid: 70, slot: 0, drink: 'root_ale', mugs: 7, startedAt: 1000 }] } };
    });
    const s = load(text);
    expect(cellarOf(s)).toMatchObject({ kind: 'cellar', level: 1 });
    expect(s.items.find((i) => i.uid === 70)!.roomId).toBe(s.player.cellarRoomId);
    expect(s.tavern.casks).toEqual([{ rackUid: 70, slot: 0, drink: 'root_ale', mugs: 7, startedAt: 1000 }]);
    expect(caskTier(s.tavern.casks[0]!, 1000 + 30 * MIN - 1)).toBe('fresh');
    expect(caskTier(s.tavern.casks[0]!, 1000 + 30 * MIN)).toBe('aged');
    expect(kegRacks(s.items, cellarRoomIds(s)).map((i) => i.uid)).toEqual([70]);
  });
  it('a full tavern loses nothing: prep tables, pantry, sink and hatch move in or go to the bag; their riders come along', () => {
    const text = oldSave((s) => {
      const t = s.tavern.roomId;
      const extra: FurnitureItem[] = [
        { uid: 80, typeId: 'prep_table', ownerId: 1, roomId: t, x: 256, y: 160, facing: 'down', onItemUid: null },
        { uid: 81, typeId: 'pantry', ownerId: 1, roomId: t, x: 320, y: 160, facing: 'down', onItemUid: null },
        { uid: 82, typeId: 'sink', ownerId: 1, roomId: t, x: 400, y: 160, facing: 'down', onItemUid: null },
        { uid: 83, typeId: 'serving_hatch', ownerId: 1, roomId: t, x: 480, y: 160, facing: 'down', onItemUid: null },
      ];
      return { ...s, items: [...s.items, ...extra], nextUid: 90 };
    });
    const before = JSON.parse(text).state as GameState;
    const s = load(text);
    expect(s.items.map((i) => i.uid).sort((a, b) => a - b)).toEqual(before.items.map((i) => i.uid).sort((a, b) => a - b));
    for (const uid of [80, 81, 82, 83]) {
      const i = s.items.find((x) => x.uid === uid)!;
      expect(i.roomId === s.player.kitchenRoomId || i.roomId === null, `item ${uid}`).toBe(true);
    }
    expect(s.items.filter((i) => i.roomId === s.tavern.roomId).some((i) => getFurnitureType(i.typeId).kitchen || i.typeId === 'stove')).toBe(false);
  });
  it('is idempotent: the migration on a migrated state changes nothing, and a saved result loads as itself', () => {
    const s = load(oldSave());
    expect(addKitchenRoom(s)).toBe(s);
    expect(addCellarForRacks(s)).toBe(s);
    expect(readSave(toSaveText(s, 5))).toMatchObject({ ok: true, migrated: false });
  });
  it('clears what stood on the new tavern doorways', () => {
    const text = oldSave((s) => {
      const tavern = s.rooms.find((r) => r.id === s.tavern.roomId)!;
      const door = innDoorSpots(tavern).find((d) => d.id === 'tavern_to_kitchen')!;
      const chair: FurnitureItem = { uid: 95, typeId: 'chair', ownerId: 1, roomId: tavern.id, x: door.spot.x + 16, y: door.spot.y + 32, facing: 'down', onItemUid: null };
      return { ...s, items: [...s.items, chair], nextUid: 96 };
    });
    expect(load(text).items.find((i) => i.uid === 95)!.roomId).toBeNull();
  });
});

describe('the tutorial (CEL-3)', () => {
  it('has the kitchen step before the barrel, and the cellar step after load; the kitchen door ticks when the kitchen opens', () => {
    expect(FIRST_TEN_STEPS.indexOf('kitchen')).toBeLessThan(FIRST_TEN_STEPS.indexOf('barrel'));
    expect(FIRST_TEN_STEPS.indexOf('cellar')).toBeGreaterThan(FIRST_TEN_STEPS.indexOf('load'));
    const none = { walked: false, cooking: false, inFarm: false, buildOn: false, inDungeon: false, inMine: false, inLakeside: false };
    expect(guideAutoEvents({ ...none, inKitchen: true })).toEqual(['kitchen']);
  });
  it('shows the kitchen door as the goal after the coins step, then the barrel; the cellar step waits until the cellar is built', () => {
    let g = FIRST_TEN_NEW;
    for (const step of ['walk', 'menu', 'pour', 'serve', 'coins'] as const) g = firstTenEvent(g, step);
    const quiet = { brewReady: false, guestWaiting: false, pouring: false, trayServes: false, coinsOnTable: false, mineOpen: true };
    expect(firstTenGoal(g, guideWaiting(g, quiet))).toBe('kitchen');
    g = firstTenEvent(g, 'kitchen');
    expect(firstTenGoal(g, guideWaiting(g, quiet))).toBe('barrel');
    expect(guideWaiting(g, quiet)).toContain('cellar');
    expect(guideWaiting(g, { ...quiet, cellarBuilt: true })).not.toContain('cellar');
  });
});

describe('the tavern appeal counts the attached rooms', () => {
  it('a prep table in the kitchen adds its appeal; the tavern alone does not', () => {
    const s = createNewPlayer(undefined, 0);
    const tavern = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    const table: FurnitureItem = { uid: 90, typeId: 'prep_table', ownerId: 1, roomId: kitchenOf(s).id, x: 64, y: 128, facing: 'down', onItemUid: null };
    const items = [...s.items, table];
    const base = tavernAppeal(tavern, s.items);
    expect(tavernAppeal(tavern, items)).toBe(base);
    expect(tavernAppeal(tavern, items, [kitchenOf(s).id])).toBe(base + getFurnitureType('prep_table').appeal);
  });
});
