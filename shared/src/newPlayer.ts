// A new player (brief section 9): level 1, 0 xp, 100 gold, only the bare floor and wall
// unlocked, 4 wood and 2 cloth, an empty level 1 hotel room and a level 1 shop room, and no
// furniture anywhere. (The shop's counter and stall_table arrive in step 7.)

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
  START_WALL_STYLE,
  START_XP,
} from './config.ts';
import type { AvatarLook } from './avatar.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { createRoom } from './room.ts';
import type { MaterialId, StyleKind } from './types.ts';

export interface NewPlayerConfig {
  playerId: number;
  name: string;
  hotelRoomId: number;
  shopRoomId: number;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  look: AvatarLook;
}

export const DEFAULT_NEW_PLAYER: NewPlayerConfig = {
  playerId: LOCAL_PLAYER_ID,
  name: LOCAL_PLAYER_NAME,
  hotelRoomId: START_HOTEL_ROOM_ID,
  shopRoomId: START_SHOP_ROOM_ID,
  gold: START_GOLD,
  materials: { ...START_MATERIALS },
  look: { ...START_LOOK },
};

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
      hotelRoomId: config.hotelRoomId,
      shopRoomId: config.shopRoomId,
    },
    look: { ...config.look },
    rooms: [
      createRoom(config.hotelRoomId, 'hotel', 1, config.playerId),
      createRoom(config.shopRoomId, 'shop', 1, config.playerId),
    ],
    items: [],
    hotbar: Array.from({ length: HOTBAR_SLOTS }, () => null),
    currentRoomId: config.hotelRoomId,
    nextUid: 1,
    ledger: [],
  };
  const state = applyChange(empty, { reason: 'start', gold: config.gold, materials: config.materials }, at);
  if (!state) throw new Error('bad new player config');
  return state;
}
