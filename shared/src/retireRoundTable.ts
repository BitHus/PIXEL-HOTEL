// The round table is retired (owner 18 Nov: a blocky world, never a circle). Migration 38 -> 39 turns every round table an old save owns into the square table:
// same uid, same room, same anchor (the table is 2 x 1 cells, so it keeps the bottom row of the old 2 x 2); whatever stood on it moves into that row. Pure.

import { BUILD_CELL } from './config.ts';
import type { GameState } from './gameState.ts';

export const RETIRED_TABLE = 'round_table';
export const SQUARE_TABLE = 'table';

export function retireRoundTables(state: GameState): GameState {
  if (!state.items.some((i) => i.typeId === RETIRED_TABLE) && !state.hotbar.includes(RETIRED_TABLE) && !state.bag.furniture.includes(RETIRED_TABLE)) return state;
  const old = new Map(state.items.filter((i) => i.typeId === RETIRED_TABLE).map((i) => [i.uid, i]));
  const items = state.items.map((i) => {
    if (i.typeId === RETIRED_TABLE) return { ...i, typeId: SQUARE_TABLE };
    const base = i.onItemUid !== null ? old.get(i.onItemUid) : undefined;
    // a rider that sat on the upper row of the old 2 x 2 slides down onto the table's one row
    return base && i.y < base.y - BUILD_CELL ? { ...i, y: base.y - BUILD_CELL / 2 } : i;
  });
  const has = (list: readonly (string | null)[]): boolean => list.includes(SQUARE_TABLE);
  const swap = (list: (string | null)[], other: boolean): (string | null)[] => {
    let seen = other;
    return list.map((id) => {
      if (id !== RETIRED_TABLE) return id;
      if (seen) return null;
      seen = true;
      return SQUARE_TABLE;
    });
  };
  const hotbar = swap(state.hotbar, has(state.bag.furniture));
  const furniture = swap(state.bag.furniture, has(hotbar));
  return { ...state, items, hotbar, bag: { ...state.bag, furniture } };
}
