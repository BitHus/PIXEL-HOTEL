// OB-4 (owner 21 Nov): the PUNCH / CHILL toggle by the hotbar. What a tap or press on a cell with a block or a plant does in play mode (rooms only;
// the dungeon and the mine always hit). Placing or stacking the selected block never changes; with punch mode off nothing is broken or harvested:
// the tap falls through to walking or using things.

export type BlockCellAction = 'place' | 'hit' | null;

/** A tap on a cell that holds a block or a plant: 'place' (stack or plant the selected item), 'hit' (break or harvest), null = not for the blocks. */
export function blockCellTap(o: { punchMode: boolean; stackOrPlant: boolean }): BlockCellAction {
  if (o.stackOrPlant) return 'place';
  return o.punchMode ? 'hit' : null;
}

/** May a press or a hold break this (block, plant; a mine or dungeon rock always may)? */
export function mayBreak(punchMode: boolean, inRun: boolean): boolean {
  return inRun || punchMode;
}
