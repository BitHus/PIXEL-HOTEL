// A new player (brief section 9): level 1, 0 xp, 100 gold, only the bare floor and wall
// unlocked, 4 wood and 2 cloth, an empty level 1 hotel room and a level 1 shop room, and no
// furniture in the inventory. The shop starts with the counter and one stall_table at fixed
// positions (config SHOP_START_ITEMS); the hotel room is empty.

import {
  HOTBAR_SLOTS,
  LOCAL_PLAYER_ID,
  LOCAL_PLAYER_NAME,
  START_FLOOR_STYLE,
  START_GOLD,
  START_HOTEL_ROOM_ID,
  START_LOOK,
  START_MATERIALS,
  START_PLAYER_LEVEL,
  START_SHOP_ROOM_ID,
  START_FARM_ROOM_ID,
  START_WALL_STYLE,
  START_XP,
  SHOP_START_ITEMS,
} from './config.ts';
import type { AvatarLook } from './avatar.ts';
import { arrangeForInventory, emptyBag } from './bag.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { canPlace, getFurnitureType } from './furniture.ts';
import { createRoom, defaultShape, getRoomShape, shapesFor } from './room.ts';
import { cleanDisplayName, lookAllowed } from './clothing.ts';
import { emptyShop } from './shop.ts';
import { emptyFarm } from './farm.ts';
import type { MaterialId, StyleKind } from './types.ts';

export interface NewPlayerConfig {
  playerId: number;
  name: string;
  hotelRoomId: number;
  shopRoomId: number;
  farmRoomId: number;
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
  hotelRoomId: START_HOTEL_ROOM_ID,
  shopRoomId: START_SHOP_ROOM_ID,
  farmRoomId: START_FARM_ROOM_ID,
  gold: START_GOLD,
  materials: { ...START_MATERIALS },
  look: { ...START_LOOK },
  hotelShape: defaultShape('hotel'),
  shopShape: defaultShape('shop'),
};

/** What the player chooses when a new game starts (character creation and the room shapes). */
export interface NewPlayerChoice {
  name: string;
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
  if (!shapesFor('hotel').some((s) => s.id === choice.hotelShape)) return null;
  if (!shapesFor('shop').some((s) => s.id === choice.shopShape && s.shopStart)) return null;
  return { ...DEFAULT_NEW_PLAYER, name, look: { ...choice.look }, hotelShape: choice.hotelShape, shopShape: choice.shopShape };
}

/** How an unlocked style is stored in Player.unlockedStyles (floor and wall ids may match). */
export function styleKey(kind: StyleKind, id: string): string {
  return `${kind}:${id}`;
}

/** A brand new game for one player. The start gold and materials go through the ledger. */
export function createNewPlayer(config: NewPlayerConfig = DEFAULT_NEW_PLAYER, at = 0): GameState {
  const empty: GameState = {
    player: {
      id: config.playerId,
      name: config.name,
      level: START_PLAYER_LEVEL,
      xp: START_XP,
      wallet: { gold: 0 },
      materials: {},
      unlockedStyles: [styleKey('floor', START_FLOOR_STYLE), styleKey('wall', START_WALL_STYLE)],
      gear: [],
      potions: 0,
      unlockedClothing: [],
      hotelRoomId: config.hotelRoomId,
      shopRoomId: config.shopRoomId,
      farmRoomId: config.farmRoomId,
    },
    look: { ...config.look },
    rooms: [
      createRoom(config.hotelRoomId, 'hotel', 1, config.playerId, config.hotelShape),
      createRoom(config.shopRoomId, 'shop', 1, config.playerId, config.shopShape),
      createRoom(config.farmRoomId, 'farm', 1, config.playerId),
    ],
    items: SHOP_START_ITEMS.map((s, k) => ({
      uid: k + 1,
      typeId: s.typeId,
      ownerId: config.playerId,
      roomId: config.shopRoomId,
      // The shop shape says where they stand (config SHOP_START_ITEMS for the square shop).
      ...(getRoomShape(config.shopShape).shopStart?.[s.typeId] ?? { x: s.x, y: s.y }),
      facing: s.facing,
      onItemUid: null,
    })),
    hotbar: Array.from({ length: HOTBAR_SLOTS }, () => null),
    bag: emptyBag(),
    currentRoomId: config.hotelRoomId,
    nextUid: SHOP_START_ITEMS.length + 1,
    ledger: [],
    shop: emptyShop(config.shopRoomId, at),
    hintsDone: 0,
    run: null,
    farm: emptyFarm(config.farmRoomId),
    playerCreated: false,
  };
  const state = applyChange(empty, { reason: 'start', gold: config.gold, materials: config.materials }, at);
  if (!state) throw new Error('bad new player config');
  return arrangeState(state);
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
