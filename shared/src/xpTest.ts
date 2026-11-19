// SK-2 test helper (like tavernTest.ts): the xp an action gave apart from its new Book entries (those give xp.json bookEntry each, ledger.ts).
import type { GameState } from './gameState.ts';
import { XP_TABLE } from './xp.ts';

export function eventXp(before: GameState, after: GameState): number {
  const finds = Object.keys(after.player.seen).filter((id) => before.player.seen[id] === undefined).length;
  return after.player.xp - before.player.xp - XP_TABLE.bookEntry * finds;
}
