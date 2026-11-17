// The whole saved state of one player's game (step 5): the player, their rooms, all their
// furniture (roomId null = in the inventory), the hotbar and bag layout, and the ledger. Plain data only.

import type { AvatarLook } from './avatar.ts';
import type { BagLayout } from './bag.ts';
import type { Room } from './room.ts';
import type { FurnitureItem, LedgerEntry, Player } from './types.ts';
import type { DungeonRun } from './dungeon/run.ts';
import type { LakesideState } from './woodcut.ts';
import type { TavernState } from './tavern.ts';

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
  /** False until the player made their character and picked the room shapes (step 7b). */
  playerCreated: boolean;
  /** How many first-run hints (config HINTS) are done; they show one at a time. */
  hintsDone: number;
  /** TUT-2 part 3 (save 33): daily, event and achievement rewards already taken (QuestRow.claimId). Progress is counted from the ledger. */
  quests: { claimed: string[]; /** Save 34: old ledger entries folded into counters per reason (reason, and reason:dead for a run that ended in death): n = entries, made = entries that put something in the bag. */ folded?: Record<string, { n: number; made: number }> };
  /** The dungeon run in progress (step 9), saved so a reload resumes it; null between runs. */
  run: DungeonRun | null;
  /** The lakeside's trees (step 9f, woodcut.ts); the lakeside room itself is in rooms. */
  lakeside: LakesideState;
  /** The tavern (step 9t, tavern.ts): the menu, guests, coins and dishes on the tables, brews. It is the shop room. */
  tavern: TavernState;
}

/** One chat message (not saved). */
export interface ChatLine {
  id: number;
  avatarId: number;
  name: string;
  text: string;
  at: number;
}
