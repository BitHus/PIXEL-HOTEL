// The whole saved state of one player's game (step 5): the player, their rooms, all their
// furniture (roomId null = in the inventory), the hotbar and bag layout, and the ledger. Plain data only.

import type { AvatarLook } from './avatar.ts';
import type { BagLayout } from './bag.ts';
import type { Room } from './room.ts';
import type { ShopState } from './shop.ts';
import type { FurnitureItem, LedgerEntry, Player } from './types.ts';
import type { DungeonRun } from './dungeon/run.ts';
import type { FarmState } from './farm.ts';

export interface GameState {
  player: Player;
  look: AvatarLook;
  rooms: Room[];
  /** Every furniture item the player owns. roomId null = in the inventory. */
  items: FurnitureItem[];
  /** HOTBAR_SLOTS furniture type ids (null = empty slot). */
  hotbar: (string | null)[];
  /** Where each inventory stack sits in the bag (bag.ts). A type is in the hotbar or here, never both. */
  bag: BagLayout;
  /** The room the player is in. */
  currentRoomId: number;
  /** The next furniture uid to hand out. */
  nextUid: number;
  ledger: LedgerEntry[];
  /** The player's shop: goods on the slots, prices, customers, sale history (step 7, shop.ts). */
  shop: ShopState;
  /** False until the player made their character and picked the room shapes (step 7b). */
  playerCreated: boolean;
  /** How many first-run hints (config HINTS) are done; they show one at a time. */
  hintsDone: number;
  /** The dungeon run in progress (step 9), saved so a reload resumes it; null between runs. */
  run: DungeonRun | null;
  /** The farm's plots (step 9b, farm.ts); the farm room itself is in rooms. */
  farm: FarmState;
}

/** One chat message (not saved). */
export interface ChatLine {
  id: number;
  avatarId: number;
  name: string;
  text: string;
  at: number;
}
