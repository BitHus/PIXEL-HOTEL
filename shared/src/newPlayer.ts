// A new player (brief section 9): level 1, 0 xp, 100 gold, only the bare floor and wall
// unlocked, 4 wood and 2 cloth, an empty level 1 hotel room and a level 1 shop room, and no
// furniture in the inventory. The shop (the tavern, step 9t) starts with the bar (the counter), one
// stall_table, a round table with 2 stools and a brewing barrel with root ale ready, at fixed
// positions (the shop shape's shopStart; config SHOP_START_ITEMS and TAVERN_START_ITEMS); the hotel
// room is empty.

import { addSeen } from './seen.ts';
import { FARM_START_SOIL, SOIL_STYLE,
  HOTBAR_SLOTS,
  LOCAL_PLAYER_ID,
  DEFAULT_INN_NAME,
  LOCAL_PLAYER_NAME,
  START_FLOOR_STYLE,
  START_GOLD,
  START_HOTEL_ROOM_ID,
  START_LOOK,
  START_MATERIALS,
  START_PLAYER_LEVEL,
  START_SHOP_ROOM_ID,
  START_FARM_ROOM_ID,
  START_LAKESIDE_ROOM_ID,
  START_WALL_STYLE,
  START_XP,
  SHOP_START_ITEMS,
  TAVERN_START_DISH,
  TAVERN_START_DRINK,
  TAVERN_START_ITEMS,
} from './config.ts';
import type { AvatarLook } from './avatar.ts';
import { arrangeForInventory, emptyBag } from './bag.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { canPlace, getFurnitureType } from './furniture.ts';
import { createRoom, defaultShape, getRoomShape, paintFloorCells, shapesFor, type Room } from './room.ts';
import { cleanDisplayName, cleanInnName, lookAllowed } from './clothing.ts';
import { emptyLakeside } from './woodcut.ts';
import { emptyTavern } from './tavern.ts';
import { getFoodType } from './materials.ts';
import type { FurnitureItem } from './types.ts';
import type { MaterialId, StyleKind } from './types.ts';

export interface NewPlayerConfig {
  playerId: number;
  name: string;
  innName: string;
  hotelRoomId: number;
  shopRoomId: number;
  farmRoomId: number;
  lakesideRoomId: number;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  look: AvatarLook;
  /** Room shapes (roomShapes.json) the player picked for the hotel room and the shop. */
  hotelShape: string;
  shopShape: string;
}

export const DEFAULT_NEW_PLAYER: NewPlayerConfig = {
  playerId: LOCAL_PLAYER_ID,
  name: LOCAL_PLAYER_NAME,
  innName: DEFAULT_INN_NAME,
  hotelRoomId: START_HOTEL_ROOM_ID,
  shopRoomId: START_SHOP_ROOM_ID,
  farmRoomId: START_FARM_ROOM_ID,
  lakesideRoomId: START_LAKESIDE_ROOM_ID,
  gold: START_GOLD,
  materials: { ...START_MATERIALS },
  look: { ...START_LOOK },
  hotelShape: defaultShape('hotel'),
  shopShape: defaultShape('shop'),
};

/** What the player chooses when a new game starts (character creation and the room shapes). */
export interface NewPlayerChoice {
  name: string;
  /** The Inn's name (MB-1); empty or missing = the default "The Inn". */
  innName?: string;
  look: AvatarLook;
  hotelShape: string;
  shopShape: string;
}

/**
 * The new player config for a choice, or null when the choice is not allowed (a name that is not
 * clean, clothing that is not free, a colour not in the lists, a shape not for that room kind).
 */
export function configForChoice(choice: NewPlayerChoice): NewPlayerConfig | null {
  const name = cleanDisplayName(choice.name);
  if (!name || !lookAllowed(choice.look)) return null;
  const innName = cleanInnName(choice.innName);
  if (!innName) return null;
  if (!shapesFor('hotel').some((s) => s.id === choice.hotelShape)) return null;
  if (!shapesFor('shop').some((s) => s.id === choice.shopShape && s.shopStart)) return null;
  return { ...DEFAULT_NEW_PLAYER, name, innName, look: { ...choice.look }, hotelShape: choice.hotelShape, shopShape: choice.shopShape };
}

/** How an unlocked style is stored in Player.unlockedStyles (floor and wall ids may match). */
export function styleKey(kind: StyleKind, id: string): string {
  return `${kind}:${id}`;
}

/** A brand new game for one player. The start gold and materials go through the ledger. */
/** A new farm starts with a patch of soil (FARM_START_SOIL); the player adds or removes soil for free. */
function startFarmRoom(room: Room): Room {
  const { c, r, w, h } = FARM_START_SOIL;
  return paintFloorCells(room, { c, r }, { c: c + w - 1, r: r + h - 1 }, SOIL_STYLE);
}

/** A new tavern's menu (step S3): the early dish is on from the start, so the stove has something to do in the first minutes (a dish only sells while it is in stock). */
function startMenu(): Record<string, { on: boolean; price: number }> {
  const dish = getFoodType(TAVERN_START_DISH);
  return { [dish.id]: { on: true, price: dish.baseValue } };
}

export function createNewPlayer(config: NewPlayerConfig = DEFAULT_NEW_PLAYER, at = 0): GameState {
  const shopStart = getRoomShape(config.shopShape).shopStart;
  // The bar and the stall table, then the tavern's round table, two stools and the brewing barrel.
  const startItems: FurnitureItem[] = [
    ...SHOP_START_ITEMS.filter((s) => s.typeId !== 'stall_table').map((s) => ({ typeId: s.typeId as string, at: shopStart?.[s.typeId] ?? { x: s.x, y: s.y }, facing: s.facing })),
    ...TAVERN_START_ITEMS.map((s) => ({ typeId: s.typeId as string, at: shopStart?.[s.key] ?? { x: s.x, y: s.y }, facing: s.facing })),
  ].map((s, k) => ({ uid: k + 1, typeId: s.typeId, ownerId: config.playerId, roomId: config.shopRoomId, x: s.at.x, y: s.at.y, facing: s.facing, onItemUid: null }));
  const barrel = startItems.find((i) => i.typeId === 'brewing_barrel');
  const empty: GameState = {
    player: {
      id: config.playerId,
      name: config.name,
      innName: config.innName,
      level: START_PLAYER_LEVEL,
      xp: START_XP,
      wallet: { gold: 0, gems: 0 },
      materials: {},
      unlockedStyles: [styleKey('floor', START_FLOOR_STYLE), styleKey('wall', START_WALL_STYLE)],
      gear: [],
      potions: 0,
      unlockedClothing: [],
      hotelRoomId: config.hotelRoomId,
      shopRoomId: config.shopRoomId,
      farmRoomId: config.farmRoomId,
      lakesideRoomId: config.lakesideRoomId,
      biggest: {},
      mineVisits: 0,
      seen: {},
      bookOpenedAt: at,
      bookRewards: [],
      splicesFound: [],
      clothingSpares: {},
      packsOpened: {},
    },
    look: { ...config.look },
    rooms: [
      createRoom(config.hotelRoomId, 'hotel', 1, config.playerId, config.hotelShape),
      createRoom(config.shopRoomId, 'shop', 1, config.playerId, config.shopShape),
      startFarmRoom(createRoom(config.farmRoomId, 'farm', 1, config.playerId)),
      createRoom(config.lakesideRoomId, 'lakeside', 1, config.playerId),
    ],
    items: startItems,
    hotbar: Array.from({ length: HOTBAR_SLOTS }, () => null),
    bag: emptyBag(),
    currentRoomId: config.hotelRoomId,
    nextUid: startItems.length + 1,
    ledger: [],
    hintsDone: 0,
    run: null,
    lakeside: emptyLakeside(config.lakesideRoomId),
    // The start barrel holds a brew that is ready to collect.
    tavern: { ...emptyTavern(config.shopRoomId, at), menu: startMenu(), brews: barrel ? [{ barrelUid: barrel.uid, drink: TAVERN_START_DRINK, readyAt: at }] : [] },
    playerCreated: false,
  };
  const state = applyChange(empty, { reason: 'start', gold: config.gold, materials: config.materials }, at);
  if (!state) throw new Error('bad new player config');
  // The start furniture (counter, stall table) is in the Book from the start.
  let seen = state.player.seen;
  for (const item of state.items) seen = addSeen(seen, item.typeId, 1, at);
  return arrangeState({ ...state, player: { ...state.player, seen } });
}

/**
 * Puts the shop's start furniture (counter, stall_table) in the shop room of an old save that has
 * none: at its fixed spot if it fits there, else on the first free spot (scanning the floor), else
 * (the stall_table only) into the inventory. The shop always ends with exactly one counter.
 */
export function addShopStartItems(state: GameState): GameState {
  const roomId = state.player.shopRoomId;
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return state;
  let s = state;
  for (const start of SHOP_START_ITEMS) {
    if (start.typeId === 'counter' && s.items.some((i) => i.typeId === 'counter' && i.roomId === roomId)) continue;
    if (start.typeId !== 'counter' && s.items.some((i) => i.typeId === start.typeId)) continue;
    const type = getFurnitureType(start.typeId);
    const spots: { x: number; y: number }[] = [{ x: start.x, y: start.y }];
    for (let y = type.d; y <= room.h; y += 16) for (let x = type.w / 2; x <= room.w - type.w / 2; x += 16) spots.push({ x, y });
    const spot = spots.find((p) => canPlace(room, s.items, type, p.x, p.y, start.facing));
    const placed = spot !== undefined || start.typeId === 'counter';
    const at = spot ?? { x: start.x, y: start.y };
    const item = {
      uid: s.nextUid,
      typeId: start.typeId,
      ownerId: s.player.id,
      roomId: placed ? roomId : null,
      x: placed ? at.x : 0,
      y: placed ? at.y : 0,
      facing: start.facing,
      onItemUid: null,
    };
    s = { ...s, items: [...s.items, item], nextUid: s.nextUid + 1 };
  }
  return s;
}

/** The state with its hotbar and bag layout matched to its inventory (bag.ts arrangeSlots). */
export function arrangeState(state: GameState): GameState {
  const l = arrangeForInventory({ hotbar: state.hotbar, bag: state.bag }, state.items, state.player.materials);
  return { ...state, hotbar: l.hotbar, bag: l.bag };
}

/**
 * The tavern for an old save (step 9t, migration 12 -> 13): a round table, 2 bar stools and a
 * brewing barrel with root ale ready go into the bag (ledger 'tavern_gift'), and the tavern starts
 * empty with introSeen false, so the game explains it once.
 */
export function addTavern(state: GameState, at: number): GameState {
  const gift = applyChange(state, { reason: 'tavern_gift', addFurniture: TAVERN_START_ITEMS.filter((i) => i.typeId !== 'stove' && i.key !== 'stool_bar').map((i) => i.typeId), note: 'the shop is a tavern now' }, at);
  if (!gift) throw new Error('cannot add the tavern');
  const barrel = gift.items.find((i) => i.typeId === 'brewing_barrel' && i.uid >= state.nextUid);
  return {
    ...gift,
    tavern: { ...emptyTavern(gift.player.shopRoomId, at), introSeen: false, brews: barrel ? [{ barrelUid: barrel.uid, drink: TAVERN_START_DRINK, readyAt: at }] : [] },
  };
}

/**
 * The kitchen for an old save (step K1, migration 20 -> 21): cooking moved from the farm's pot to the tavern, so
 * the tavern gets ONE stove (ledger 'tavern_gift'). It goes on its start spot (the shape's shopStart) when that
 * spot is free, else into the bag. Nothing else changes: planted crops, the bag and the farm stay as they are.
 * A save that already has a stove keeps it (no second one).
 */
export function addStove(state: GameState, at: number): GameState {
  const base: GameState = { ...state, tavern: { ...state.tavern, cooks: state.tavern.cooks ?? [] } };
  if (base.items.some((i) => getFurnitureType(i.typeId).cooks)) return base;
  const gift = applyChange(base, { reason: 'tavern_gift', addFurniture: ['stove'], note: 'cooking moved to the tavern' }, at);
  if (!gift) throw new Error('cannot add the stove');
  const stove = gift.items.find((i) => i.typeId === 'stove' && i.uid >= base.nextUid);
  const room = gift.rooms.find((r) => r.id === gift.tavern.roomId);
  const spot = room ? getRoomShape(room.shape).shopStart?.stove : undefined;
  if (!stove || !room || !spot || !canPlace(room, gift.items.filter((i) => i.uid !== stove.uid), getFurnitureType('stove'), spot.x, spot.y, 'down')) return arrangeState(gift);
  const placed = { ...stove, roomId: room.id, x: spot.x, y: spot.y, facing: 'down' as const };
  return arrangeState({ ...gift, items: gift.items.map((i) => (i.uid === stove.uid ? placed : i)) });
}
