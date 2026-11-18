// The save file (step 5): { version, savedAt, state } as JSON. The same text is written to
// storage and used for Export / Import. Old versions are migrated step by step with MIGRATIONS;
// a version without a migration path is refused ('too_old'), and the caller resets with a message.

import { CUSTOMER_FIRST_ID, DEFAULT_INN_NAME, HOTBAR_SLOTS, PLAYER_ATTACK_COOLDOWN_MS, SAVE_BACKUP_KEY, SAVE_KEY_PREFIX, SAVE_VERSION, SHOP_START_ITEMS } from './config.ts';
import { canPlace, getFurnitureType } from './furniture.ts';
import { emptyBag } from './bag.ts';
import { hasOnOff } from './itemUse.ts';
import { addBarFittings, addShopStartItems, addStove, addTavern } from './newPlayer.ts';
import { placedCount, snapItemsToGrid } from './gridMigration.ts';
import { convertLegacyFarm, emptyLegacyFarm, type LegacyFarm } from './legacyFarm.ts';
import { emptyLakeside } from './woodcut.ts';
import { createRoom } from './room.ts';
import { isSeedId } from './materials.ts';
import { clearDoorSpots } from './innDoorClear.ts';
import { addCellarForRacks, dissolveKitchenRoom, moveKitchenToAnnex } from './cellarRooms.ts';
import { retireRoundTables } from './retireRoundTable.ts';
import { applyChange, type Change } from './ledger.ts';
import type { LootRef, Player } from './types.ts';
import type { GameState } from './gameState.ts';

export interface SaveFile {
  version: number;
  savedAt: number;
  state: GameState;
}

export type SaveProblem = 'bad_json' | 'not_a_save' | 'too_old' | 'too_new' | 'invalid';

export type LoadResult =
  | { ok: true; state: GameState; version: number; migrated: boolean; returnedToBag: number; farmChanged: boolean; kitchenChanged: boolean; shopClosed: boolean; barChanged: boolean; doorsChanged: number }
  | { ok: false; problem: SaveProblem; version?: number };

/**
 * Migrations: MIGRATIONS[n] turns a version n state into a version n + 1 state. Add one each
 * time SAVE_VERSION goes up.
 */
export const MIGRATIONS: Record<number, (state: unknown) => unknown> = {
  // 1 -> 2: the bag got a slot layout. It starts empty; arrangeState fills it from the inventory.
  1: (state) => (isObject(state) ? { ...state, bag: emptyBag() } : state),
  // 2 -> 3 (step 7): the shop (empty, first customer 10 s after it gets stock), the hints, and the
  // shop's counter and stall_table (an old shop had none).
  2: (state) => {
    if (!isObject(state) || !isObject(state.player) || !Array.isArray(state.items) || !Array.isArray(state.rooms)) return state;
    const player = state.player as unknown as Player;
    const s = { ...state, shop: { roomId: player.shopRoomId, slots: [], nextCustomerInMs: 10_000, saleHistory: {}, customers: [], nextCustomerId: -1, updatedAt: 0, lastLines: {} }, hintsDone: 0 } as unknown as GameState;
    try {
      return addShopStartItems(s);
    } catch {
      return state;
    }
  },
  // 3 -> 4: the counter moved away from the back wall, so the player can stand behind it. A counter
  // still on the old start spot moves to the new one when that is free.
  3: (state) => {
    if (!isObject(state) || !Array.isArray(state.items) || !Array.isArray(state.rooms)) return state;
    try {
      const s = state as unknown as GameState;
      const room = s.rooms.find((r) => r.id === s.player.shopRoomId);
      const counter = s.items.find((i) => i.typeId === 'counter' && i.roomId === s.player.shopRoomId);
      const to = SHOP_START_ITEMS.find((i) => i.typeId === 'counter');
      if (!room || !counter || !to || counter.x !== 176 || counter.y !== 40 || counter.facing !== 'down') return state;
      const others = s.items.filter((i) => i.uid !== counter.uid);
      if (!canPlace(room, others, getFurnitureType('counter'), to.x, to.y, 'down')) return state;
      return { ...s, items: s.items.map((i) => (i.uid === counter.uid ? { ...i, x: to.x, y: to.y } : i)) };
    } catch {
      return state;
    }
  },
  // 4 -> 5 (step 7b): rooms get a shape (the old rectangle = 'square' / 'square_shop'), the look
  // gets clothing ids (the old look = short hair, long sleeves, trousers), unlockedClothing starts
  // empty.
  4: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms) || !isObject(state.look) || !isObject(state.player)) return state;
    const rooms = state.rooms.map((r) =>
      isObject(r) && typeof r.shape !== 'string' ? { ...r, shape: r.kind === 'shop' ? 'square_shop' : 'square' } : r,
    );
    const look = { ...state.look, hairStyle: 'short', top: 'long_sleeve', bottoms: 'trousers' };
    // A save that already has a player skips character creation and the intro.
    return { ...state, rooms, look, player: { ...state.player, unlockedClothing: [] }, playerCreated: true };
  },
  // 5 -> 6 (step 9): no dungeon run in progress.
  5: (state) => (isObject(state) ? { ...state, run: null } : state),
  // 6 -> 7 (step 9b): a level 1 farm with empty plots (a new room with the next free id), and a run
  // in progress gets an empty lunch box, no buffs and the normal attack cooldown.
  6: (state) => {
    if (!isObject(state) || !isObject(state.player) || !Array.isArray(state.rooms)) return state;
    if (isObject(state.farm)) return state;
    const ids = state.rooms.map((r) => (isObject(r) && typeof r.id === 'number' ? r.id : 0));
    const farmRoomId = Math.max(0, ...ids) + 1;
    const ownerId = typeof state.player.id === 'number' ? state.player.id : 1;
    const run = state.run;
    const nextRun =
      isObject(run) && isObject(run.player)
        ? { ...run, player: { food: [], buffs: [], attackCooldownMs: PLAYER_ATTACK_COOLDOWN_MS, ...run.player } }
        : run;
    return {
      ...state,
      player: { ...state.player, farmRoomId },
      rooms: [...state.rooms, createRoom(farmRoomId, 'farm', 1, ownerId)],
      farm: emptyLegacyFarm(farmRoomId),
      run: nextRun,
    };
  },
  // 7 -> 8 (step 9c): no mine visits yet; a saved run is a crypt run with no rocks, no lantern and
  // the basic pickaxe. Gear ids stay: iron_sword and leather_armor are forge tiers now. An old save
  // with both the iron sword and nothing before it simply has the iron sword tier.
  7: (state) => {
    if (!isObject(state) || !isObject(state.player)) return state;
    const run = state.run;
    const nextRun =
      isObject(run) && isObject(run.player)
        ? {
            place: 'crypt',
            rocks: [],
            lanternEndsAt: null,
            ...run,
            player: { targetRockId: null, pendingSwing: false, pickReadyAt: 0, hitsPerSwing: 1, minesMithril: false, ...run.player },
          }
        : run;
    return { ...state, player: { mineVisits: 0, ...state.player }, run: nextRun };
  },
  // 8 -> 9 (step 9d, shop life): the shop remembers the last talk line per moment; customers got a
  // kind, a plan, a seat and a call timer. Only customers carrying an item stay (they wait in the
  // line; the catch-up when the game opens puts them on their queue spots), the rest are gone.
  8: (state) => {
    if (!isObject(state) || !isObject(state.shop)) return state;
    const old = Array.isArray(state.shop.customers) ? state.shop.customers : [];
    const customers = old
      .filter((c): c is Record<string, unknown> => isObject(c) && c.carrying !== null && c.carrying !== undefined)
      .map((c) => ({
        kind: 'browser',
        looksMax: 1,
        decorLeft: 0,
        decorUid: null,
        seat: null,
        sitChecked: false,
        callInMs: 0,
        ...c,
        phase: 'queue',
        path: [],
        browsing: false,
      }));
    return { ...state, shop: { lastLines: {}, ...state.shop, customers } };
  },
  // 9 -> 10 (natural customers, after 9d): a customer has a plan of small behaviours, may be a
  // window-shopper or a friend, and can talk. Only customers carrying an item stay (as before: the
  // catch-up when the game opens puts them on their queue spots); they get the new fields.
  9: (state) => {
    if (!isObject(state) || !isObject(state.shop)) return state;
    const old = Array.isArray(state.shop.customers) ? state.shop.customers : [];
    const customers = old
      .filter((c): c is Record<string, unknown> => isObject(c) && c.carrying !== null && c.carrying !== undefined)
      .map(({ looks: _looks, looksMax: _max, decorLeft: _left, ...c }) => ({
        ...c,
        buys: true,
        plan: [],
        step: 0,
        doing: null,
        followId: null,
        talk: null,
        holdMs: 0,
        phase: 'queue',
        path: [],
        browsing: false,
      }));
    return { ...state, shop: { ...state.shop, customers } };
  },
  // 10 -> 11 (step 9e, ranks and the Book): Player.seen, bookOpenedAt and bookRewards. Everything
  // the player owns now counts as seen (first seen at time 0, so nothing shows "New!"). A saved
  // run gets its kill and met lists.
  10: (state) => {
    if (!isObject(state) || !isObject(state.player)) return state;
    const player = state.player;
    const seen: Record<string, { count: number; firstSeenAt: number }> = {};
    const add = (id: unknown, n: unknown): void => {
      if (typeof id !== 'string' || typeof n !== 'number' || n <= 0) return;
      seen[id] = { count: (seen[id]?.count ?? 0) + n, firstSeenAt: 0 };
    };
    if (isObject(player.materials)) for (const [id, n] of Object.entries(player.materials)) add(id, n);
    if (Array.isArray(state.items)) for (const item of state.items) if (isObject(item)) add(item.typeId, 1);
    const slots = isObject(state.shop) && Array.isArray(state.shop.slots) ? state.shop.slots : [];
    for (const slot of slots) {
      const loot = isObject(slot) && isObject(slot.loot) ? slot.loot : null;
      if (loot?.kind === 'material') add(loot.id, typeof loot.qty === 'number' ? loot.qty : 1);
      else if (loot?.kind === 'furniture') add(loot.typeId, 1);
    }
    const run = isObject(state.run) ? { kills: {}, met: [], ...state.run } : state.run;
    return { ...state, run, player: { seen, bookOpenedAt: 0, bookRewards: [], ...player } };
  },
  // 11 -> 12 (step 9f, the lakeside): a level 1 lakeside room (the next free room id) with 8 whole
  // trees, Player.lakesideRoomId and Player.biggest {}.
  11: (state) => {
    if (!isObject(state) || !isObject(state.player) || !Array.isArray(state.rooms)) return state;
    if (isObject(state.lakeside)) return state;
    const ids = state.rooms.map((r) => (isObject(r) && typeof r.id === 'number' ? r.id : 0));
    const lakesideRoomId = Math.max(0, ...ids) + 1;
    const ownerId = typeof state.player.id === 'number' ? state.player.id : 1;
    return {
      ...state,
      player: { biggest: {}, ...state.player, lakesideRoomId },
      rooms: [...state.rooms, createRoom(lakesideRoomId, 'lakeside', 1, ownerId)],
      lakeside: emptyLakeside(lakesideRoomId),
    };
  },
  // 12 -> 13 (step 9t, the tavern): GameState.tavern, and a round table, 2 bar stools and a brewing
  // barrel (root ale ready) in the bag. The toast that explains the tavern shows once (introSeen).
  12: (state) => {
    if (!isObject(state) || !isObject(state.player) || !Array.isArray(state.items) || !Array.isArray(state.ledger) || isObject(state.tavern)) return state;
    try {
      const at = isObject(state.shop) && typeof state.shop.updatedAt === 'number' ? state.shop.updatedAt : 0;
      return addTavern(state as unknown as GameState, at);
    } catch {
      return state;
    }
  },
  // 13 -> 14 (step BG1, the cell grid): rooms are whole cells, floor furniture snaps to the nearest
  // valid cell footprint, wall items stay, what no longer fits goes back to the bag.
  13: (state) => {
    if (!isObject(state) || !Array.isArray(state.items) || !Array.isArray(state.rooms)) return state;
    try {
      return snapItemsToGrid(state as unknown as GameState).state;
    } catch {
      return state;
    }
  },
  // 14 -> 15 (step BG5, blocks and gems): every room gets an empty block layer, the wallet gets 0 gems.
  14: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms) || !isObject(state.player) || !isObject(state.player.wallet)) return state;
    const rooms = state.rooms.map((r) => (isObject(r) ? { ...r, blocks: isObject(r.blocks) ? r.blocks : {} } : r));
    return { ...state, rooms, player: { ...state.player, wallet: { ...state.player.wallet, gems: 0 } } };
  },
  // 15 -> 16 (step BG6, seeds and the free-form farm): the fixed plots go away. Each old plot becomes a soil
  // cell (snapped to the cell grid); each planted crop becomes a plant with the same crop, planting time and
  // time left (its own old grow time); every room gets an empty plant layer; GameState.farm is dropped.
  // Crops and seeds in the bag are unchanged (the seed ids are the same).
  15: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms)) return state;
    const { farm, ...rest } = state;
    const conv = isObject(farm) && Array.isArray(farm.plots) ? convertLegacyFarm(farm as unknown as LegacyFarm) : { soil: {}, plants: {} };
    const farmRoomId = isObject(farm) && typeof farm.roomId === 'number' ? farm.roomId : null;
    const rooms = state.rooms.map((r) => {
      if (!isObject(r)) return r;
      const base = { ...r, plants: isObject(r.plants) ? r.plants : {} };
      if (r.id !== farmRoomId || r.kind !== 'farm') return base;
      return { ...base, floorCells: { ...(isObject(r.floorCells) ? r.floorCells : {}), ...conv.soil }, plants: { ...base.plants, ...conv.plants } };
    });
    return { ...rest, rooms };
  },
  // 16 -> 17 (step BG4, gems from everywhere): a run in progress gets 0 gems in its three bags and no
  // gem piles on the floor.
  16: (state) => {
    if (!isObject(state) || !isObject(state.run)) return state;
    const run = state.run;
    const bag = (b: unknown) => (isObject(b) ? { gems: 0, ...b } : b);
    return { ...state, run: { ...run, bag: bag(run.bag), banked: bag(run.banked), lost: bag(run.lost), pickups: Array.isArray(run.pickups) ? run.pickups : [] } };
  },
  // 17 -> 18 (step BG7, splicing): the player has found no splice recipes yet.
  17: (state) => {
    if (!isObject(state) || !isObject(state.player)) return state;
    return { ...state, player: { ...state.player, splicesFound: Array.isArray(state.player.splicesFound) ? state.player.splicesFound : [] } };
  },
  // BG8: spare clothing and the opened-packs counter start empty.
  18: (state) => {
    if (!isObject(state) || !isObject(state.player)) return state;
    const p = state.player;
    return { ...state, player: { ...p, clothingSpares: isObject(p.clothingSpares) ? p.clothingSpares : {}, packsOpened: isObject(p.packsOpened) ? p.packsOpened : {} } };
  },
  // 19 -> 20 (BG9): a new quest (open a pack) sits at index 5, before the mine quest. A player who was already past
  // the farm quest keeps their place: the mine and splice quests moved up by one and the pack quest counts as done.
  19: (state) => {
    if (!isObject(state) || typeof state.hintsDone !== 'number') return state;
    return state.hintsDone >= 5 ? { ...state, hintsDone: state.hintsDone + 1 } : state;
  },
  // 20 -> 21 (step K1, the tavern kitchen): cooking moves from the farm's pot to a stove in the tavern. The tavern
  // gets an empty cooks list and one stove (on its start spot if free, else in the bag). Nothing is lost.
  20: (state) => {
    if (!isObject(state) || !isObject(state.tavern) || !Array.isArray(state.items) || !Array.isArray(state.rooms) || !Array.isArray(state.ledger) || !isObject(state.player)) return state;
    try {
      const at = isObject(state.shop) && typeof state.shop.updatedAt === 'number' ? state.shop.updatedAt : 0;
      return addStove(state as unknown as GameState, at);
    } catch {
      return { ...state, tavern: { ...state.tavern, cooks: [] } };
    }
  },
  // 21 -> 22 (step S1, the shop is the tavern): loot customers are gone. Every good on a slot goes back to the bag (ledger
  // 'shop_closed': same uids, no finds, no gain popup); stall tables, shelves and cases stay where they are as plain decor.
  // GameState.shop is dropped (slots, prices, sale history, customers, the line, the shop clock); the guests keep their id
  // counter (TavernState.nextGuestId). Nothing is lost.
  21: (state) => {
    if (!isObject(state) || !isObject(state.tavern) || !Array.isArray(state.items) || !Array.isArray(state.ledger) || !isObject(state.player)) return state;
    const { shop, ...rest } = state;
    const old = isObject(shop) ? shop : {};
    const at = typeof old.updatedAt === 'number' ? old.updatedAt : 0;
    const nextGuestId = typeof old.nextCustomerId === 'number' && Number.isInteger(old.nextCustomerId) ? old.nextCustomerId : CUSTOMER_FIRST_ID;
    let next = { ...rest, tavern: { ...state.tavern, nextGuestId } } as unknown as GameState;
    const slots = Array.isArray(old.slots) ? old.slots : [];
    for (const slot of slots) {
      const loot = isObject(slot) && isObject(slot.loot) ? (slot.loot as unknown as LootRef) : null;
      if (!loot) continue;
      const back: Change =
        loot.kind === 'material'
          ? { reason: 'shop_closed', materials: { [loot.id]: Math.max(1, loot.qty ?? 1) }, note: `off the stall: ${loot.id}` }
          : { reason: 'shop_closed', returnFurniture: [{ uid: loot.uid, typeId: loot.typeId }], note: `off the stall: ${loot.typeId}` };
      next = applyChange(next, back, at) ?? next;
    }
    return next;
  },
  // 22 -> 23 (step S3): a table spot can hold a gem a happy guest tipped (Mess.gems). Every pile on a table gets 0 gems. Nothing is lost.
  22: (state) => {
    if (!isObject(state) || !isObject(state.tavern) || !Array.isArray(state.tavern.mess)) return state;
    return { ...state, tavern: { ...state.tavern, mess: state.tavern.mess.map((m) => (isObject(m) ? { ...m, gems: typeof m.gems === 'number' ? m.gems : 0 } : m)) } };
  },
  // 23 -> 24 (step T1, taps and the kitchen): TavernState.taps (empty: the drinks in the bag stay in the bag); the tavern gets a register and a
  // tap stand ON the bar (ledger 'tavern_gift'), or in the bag when the bar's cells are taken. The kitchen zone needs no data in the save.
  23: (state) => {
    if (!isObject(state) || !isObject(state.tavern) || !Array.isArray(state.items) || !Array.isArray(state.rooms) || !Array.isArray(state.ledger) || !isObject(state.player)) return state;
    try {
      return addBarFittings(state as unknown as GameState, typeof state.tavern.updatedAt === 'number' ? state.tavern.updatedAt : 0);
    } catch {
      return { ...state, tavern: { ...state.tavern, taps: [] } };
    }
  },
  // 24 -> 25 (MB-1): the Inn has a name. Existing saves get the default "The Inn". Nothing else changes.
  24: (state) => {
    if (!isObject(state) || !isObject(state.player)) return state;
    return { ...state, player: { ...state.player, innName: typeof state.player.innName === 'string' ? state.player.innName : DEFAULT_INN_NAME } };
  },
  // 25 -> 26 (step K2): TavernState.casks (empty: keg racks start with free slots). Nothing else changes.
  25: (state) => {
    if (!isObject(state) || !isObject(state.tavern)) return state;
    return { ...state, tavern: { ...state.tavern, casks: Array.isArray(state.tavern.casks) ? state.tavern.casks : [] } };
  },
  // 29 -> 30 (step SG4, plants on any block): the plant layer is normalised. A plant whose seed (or second seed) no longer exists is dropped,
  // one with broken times too, and the lakeside has none; a plant and a block may now share a cell, so nothing else changes.
  29: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms)) return state;
    const rooms = (state.rooms as unknown[]).map((room) => {
      if (!isObject(room)) return room;
      const old = isObject(room.plants) ? room.plants : {};
      const plants: Record<string, unknown> = {};
      if (room.kind !== 'lakeside') {
        for (const [key, p] of Object.entries(old)) {
          if (!isObject(p) || typeof p.seed !== 'string' || !isSeedId(p.seed)) continue;
          if (typeof p.plantedAt !== 'number' || typeof p.readyAt !== 'number') continue;
          if (p.with !== undefined && !(typeof p.with === 'string' && isSeedId(p.with))) continue;
          plants[key] = p;
        }
      }
      return { ...room, plants };
    });
    return { ...state, rooms };
  },
  // 33 -> 34 (ledger trim): GameState.quests.folded is optional (counters of the entries cut from the old ledger); nothing to change but keep the shape.
  // 38 -> 39 (owner 18 Nov, the kitchen is an ATTACHED ANNEX of the tavern, not a ring): the round table becomes the square table (retireRoundTable.ts); the tavern grows by the annex (room.w and h), floor pieces that stood in the old kitchen zone move into the annex's inside (rest to the bag).
  38: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms) || !Array.isArray(state.items) || !isObject(state.tavern)) return state;
    return retireRoundTables(moveKitchenToAnnex(state as unknown as GameState));
  },
  // 37 -> 38 (MG-1, skill points + level cap 12): Player.skills = { ranks, respecs } is OPTIONAL (missing = nothing bought); the unspent points are derived from the level and the
  // Book rewards (a level 5 save has 4 free points), so there is nothing to change in an old save.
  37: (state) => state,
  // 36 -> 37 (owner 18 Nov, the kitchen is a walled area of the tavern): the kitchen room is dissolved (its items move into the tavern's kitchen zone, Player.kitchenRoomId goes); the keg racks and the cellar stay.
  36: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms) || !Array.isArray(state.items) || !isObject(state.player) || !isObject(state.tavern)) return state;
    return dissolveKitchenRoom(state as unknown as GameState);
  },
  // 35 -> 36 (CEL-2/4): the attached kitchen room (Player.kitchenRoomId; stove, barrel, prep tables, pantry, sink and hatch move in from the tavern, level = the tavern's)
  // and, when the player owns a keg rack, a cellar with the racks (Player.cellarRoomId, free). Brews, cooks and casks are keyed by furniture uid, so batches in progress and
  // cask start times stay exact; what does not fit goes to the bag; the tavern's two new doors clear their spots.
  35: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms) || !Array.isArray(state.items) || !isObject(state.player) || !isObject(state.tavern)) return state;
    // The kitchen room of this version is dissolved again one version later (36 -> 37), so only the cellar is made here.
    return addCellarForRacks(state as unknown as GameState);
  },
  // 34 -> 35 (CEL-1): Player.kitchenRoomId and cellarRoomId are optional (missing = no such room yet) and Room.kind may be 'kitchen' or 'cellar'; nothing to change in an old save (the kitchen and the cellar are created and filled when the doors exist, CEL-2/4).
  34: (state) => state,
  33: (state) => (isObject(state) ? { ...state, quests: isObject(state.quests) && Array.isArray(state.quests.claimed) ? state.quests : { claimed: [] } } : state),
  // 32 -> 33 (TUT-2 part 3, daily quests and achievements): GameState.quests = { claimed: [] }. The first-run hint quests become the first_* achievements, derived from hintsDone (nothing is lost or paid twice).
  32: (state) => (isObject(state) ? { ...state, quests: isObject(state.quests) && Array.isArray(state.quests.claimed) ? state.quests : { claimed: [] } } : state),
  // 31 -> 32 (step ST1, stacked blocks): Room.blocks per cell was ONE block, now a stack (array, bottom first): every block becomes a stack of one.
  31: (state) => {
    if (!isObject(state) || !Array.isArray(state.rooms)) return state;
    const rooms = (state.rooms as unknown[]).map((room) => {
      if (!isObject(room) || !isObject(room.blocks)) return room;
      const blocks: Record<string, unknown[]> = {};
      for (const [key, b] of Object.entries(room.blocks)) {
        if (Array.isArray(b)) blocks[key] = b;
        else if (isObject(b)) blocks[key] = [b];
      }
      return { ...room, blocks };
    });
    return { ...state, rooms };
  },
  // 30 -> 31 (step COD-1, the waiter's tray): TavernState.holding (one mug, tied to a guest) becomes TavernState.tray (up to TRAY_MAX mugs, tied to nobody).
  30: (state) => {
    if (!isObject(state) || !isObject(state.tavern)) return state;
    const { holding, ...tavern } = state.tavern;
    const tray = isObject(holding) && typeof holding.item === 'string' ? [{ item: holding.item, ...(holding.perfect === true ? { perfect: true } : {}) }] : Array.isArray(tavern.tray) ? tavern.tray : [];
    return { ...state, tavern: { ...tavern, tray } };
  },
  // 28 -> 29 (step G2, hands-on pour): a mug in the hands has `perfect` (false). Nothing else changes.
  28: (state) => {
    if (!isObject(state) || !isObject(state.tavern) || !isObject(state.tavern.holding)) return state;
    return { ...state, tavern: { ...state.tavern, holding: { ...state.tavern.holding, perfect: state.tavern.holding.perfect === true } } };
  },
  // 27 -> 28 (step 9g-2, usable furniture and the cat): Player.pet = null, and lamps, fires and the like get their on/off state (on, as they always shone).
  // Nothing else changes.
  27: (state) => {
    if (!isObject(state) || !isObject(state.player) || !Array.isArray(state.items)) return state;
    const items = (state.items as unknown[]).map((i) => {
      if (!isObject(i) || typeof i.typeId !== 'string' || typeof i.on === 'boolean') return i;
      try {
        return hasOnOff(getFurnitureType(i.typeId)) ? { ...i, on: true } : i;
      } catch {
        return i;
      }
    });
    return { ...state, items, player: { ...state.player, pet: state.player.pet === undefined ? null : state.player.pet } };
  },
  // 26 -> 27 (step MB-2, Inn doors): every hotel, tavern and farm room has door spots now. Furniture, blocks and plants standing on a spot go back to
  // the bag (ledger 'door_spot'; a plant gives its seed); nothing else changes.
  26: (state) => {
    if (!isObject(state) || !Array.isArray(state.items) || !Array.isArray(state.rooms) || !Array.isArray(state.ledger) || !isObject(state.player)) return state;
    try {
      let next = state as unknown as GameState;
      for (const room of next.rooms) next = clearDoorSpots(next, room.id, 0).state;
      return next;
    } catch {
      return state;
    }
  },
};

/** What the title screen needs to know about the saved game (UI round 4: Continue / New game). Pure: `get` reads a storage key. */
export interface SavePeek {
  /** Some save text exists under the current key, an older versioned key or the automatic backup. */
  exists: boolean;
  /** True when it reads (after migration) and the character was made: Continue will work. */
  canContinue: boolean;
  version?: number;
  savedAt?: number;
  /** For the Continue card: the player's name, the Inn name and the level. */
  playerName?: string;
  innName?: string;
  level?: number;
  problem?: SaveProblem;
}

/** Looks for a save without loading it into the game: the current key first, then older versions, then the backup. */
export function peekSave(get: (key: string) => string | null): SavePeek {
  const keys = [saveKey(), ...Array.from({ length: SAVE_VERSION - 1 }, (_, k) => saveKey(SAVE_VERSION - 1 - k)), SAVE_BACKUP_KEY];
  let found = false;
  let problem: SaveProblem | undefined;
  for (const key of keys) {
    const text = get(key);
    if (text === null) continue;
    found = true;
    const r = readSave(text);
    if (!r.ok) {
      problem ??= r.problem;
      continue;
    }
    let savedAt: number | undefined;
    try {
      const f = JSON.parse(text) as { savedAt?: unknown };
      if (typeof f.savedAt === 'number') savedAt = f.savedAt;
    } catch {
      // savedAt stays unknown
    }
    const p = r.state.player;
    return { exists: true, canContinue: r.state.playerCreated, version: r.version, savedAt, playerName: p.name, innName: p.innName, level: p.level };
  }
  return { exists: found, canContinue: false, problem };
}

/** The storage key for a save version. */
export function saveKey(version = SAVE_VERSION): string {
  return `${SAVE_KEY_PREFIX}${version}`;
}

/** The save text for a state. */
export function toSaveText(state: GameState, savedAt: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt, state };
  return JSON.stringify(file);
}

/** Reads a save text: checks the version, migrates old ones, and checks the shape. */
export function readSave(text: string): LoadResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'bad_json' };
  }
  if (!isObject(file) || typeof file.version !== 'number' || !Number.isInteger(file.version) || !('state' in file)) {
    return { ok: false, problem: 'not_a_save' };
  }
  const version = file.version;
  if (version > SAVE_VERSION) return { ok: false, problem: 'too_new', version };
  let state: unknown = file.state;
  let returnedToBag = 0;
  let doorsChanged = 0;
  for (let v = version; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return { ok: false, problem: 'too_old', version };
    const was = v === 13 && isObject(state) && Array.isArray(state.items) ? placedCount(state.items as GameState['items']) : 0;
    const spotWas = v === 26 ? onRooms(state) : 0;
    state = migrate(state);
    if (v === 26) doorsChanged = Math.max(0, spotWas - onRooms(state));
    if (v === 13 && isObject(state) && Array.isArray(state.items)) returnedToBag = Math.max(0, was - placedCount(state.items as GameState['items']));
  }
  if (!isGameState(state)) return { ok: false, problem: 'invalid', version };
  return { ok: true, state, version, migrated: version !== SAVE_VERSION, returnedToBag, farmChanged: version < 16, kitchenChanged: version < 21, shopClosed: version < 22, barChanged: version < 24, doorsChanged };
}

/** Furniture placed in rooms plus blocks and plants (to count what a migration sent back to the bag). */
function onRooms(state: unknown): number {
  if (!isObject(state) || !Array.isArray(state.items) || !Array.isArray(state.rooms)) return 0;
  const layers = (state.rooms as unknown[]).reduce<number>((n, r) => n + (isObject(r) ? Object.keys(isObject(r.blocks) ? r.blocks : {}).length + Object.keys(isObject(r.plants) ? r.plants : {}).length : 0), 0);
  return placedCount(state.items as GameState['items']) + layers;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

const isInt = (x: unknown): boolean => typeof x === 'number' && Number.isInteger(x);

/** A shape check of a loaded state (enough to catch a wrong or damaged file). */
export function isGameState(x: unknown): x is GameState {
  if (!isObject(x)) return false;
  const p = x.player;
  if (!isObject(p) || !isInt(p.id) || !isObject(p.wallet) || !isInt(p.wallet.gold) || !isInt(p.wallet.gems) || !isObject(p.materials)) return false;
  if (!isObject(x.look) || !Array.isArray(x.rooms) || x.rooms.length === 0) return false;
  if (!x.rooms.every((r) => isObject(r) && isInt(r.id) && (r.kind === 'hotel' || r.kind === 'shop' || r.kind === 'farm' || r.kind === 'lakeside' || r.kind === 'cellar') && typeof r.shape === 'string')) return false;
  if (typeof x.look.hairStyle !== 'string' || typeof x.look.top !== 'string' || typeof x.look.bottoms !== 'string') return false;
  if (!Array.isArray(p.unlockedClothing) || !Array.isArray(p.splicesFound) || !isObject(p.clothingSpares) || !isObject(p.packsOpened) || typeof x.playerCreated !== 'boolean' || typeof p.innName !== 'string') return false;
  if (p.pet !== null && !(isObject(p.pet) && typeof p.pet.name === 'string')) return false;
  if (!Array.isArray(x.items) || !x.items.every((i) => isObject(i) && isInt(i.uid) && typeof i.typeId === 'string')) return false;
  if (!Array.isArray(x.hotbar) || x.hotbar.length !== HOTBAR_SLOTS) return false;
  if (!x.hotbar.every((h) => h === null || typeof h === 'string')) return false;
  const bag = x.bag;
  if (!isObject(bag) || !isSlotList(bag.furniture) || !isSlotList(bag.materials)) return false;
  if (!isInt(x.currentRoomId) || !x.rooms.some((r) => isObject(r) && r.id === x.currentRoomId)) return false;
  if (!isInt(x.hintsDone) || !isObject(x.quests) || !Array.isArray(x.quests.claimed)) return false;
  if (!isInt(p.farmRoomId) || !x.rooms.every((r) => isObject(r) && isObject(r.plants) && isObject(r.blocks))) return false;
  if (!isObject(x.lakeside) || !isInt(x.lakeside.roomId) || !Array.isArray(x.lakeside.trees) || !isInt(p.lakesideRoomId) || !isObject(p.biggest)) return false;
  const t = x.tavern;
  if (!isObject(t) || !isInt(t.roomId) || !isObject(t.menu) || !Array.isArray(t.guests) || !Array.isArray(t.mess) || !Array.isArray(t.brews) || !Array.isArray(t.cooks) || !Array.isArray(t.taps) || !Array.isArray(t.casks) || !Array.isArray(t.serveQueue) || !isInt(t.nextGuestId)) return false;
  if (x.run !== null && !(isObject(x.run) && isObject(x.run.map) && isObject(x.run.player) && Array.isArray(x.run.enemies))) return false;
  return isInt(x.nextUid) && Array.isArray(x.ledger);
}

function isSlotList(x: unknown): boolean {
  return Array.isArray(x) && x.every((h) => h === null || typeof h === 'string');
}
