// The whole saved state of one player's game (step 5): the player, their rooms, all their
// furniture (roomId null = in the inventory), the hotbar and bag layout, and the ledger. Plain data only.

import type { AvatarLook } from './avatar.ts';
import type { BagLayout } from './bag.ts';
import type { Room } from './room.ts';
import type { FurnitureItem, LedgerEntry, Player } from './types.ts';

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
}

/** One chat message (not saved). */
export interface ChatLine {
  id: number;
  avatarId: number;
  name: string;
  text: string;
  at: number;
}
