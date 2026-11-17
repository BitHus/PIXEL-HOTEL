// ST2: what a TAP on a cell that holds a block does. With a block (not a seed) selected and the block fits on top, the tap STACKS it;
// otherwise it punches the top block. A plant is always punched (harvest). Holding still 300 ms on a stackable block punches it instead
// (the client starts a hold hit), and with no block selected a tap punches as before. Pure; the client feeds what it knows.

import type { BlockProblem } from './blocks.ts';

export type BlockTapAction = 'stack' | 'punch';

export interface BlockTapInput {
  /** The hotbar block (or seed) id, or null. */
  selectedId: string | null;
  selectedIsSeed: boolean;
  hasPlant: boolean;
  /** blockProblem for placing the selected block in this cell now (null = it fits on top of the stack). */
  placeProblem: BlockProblem | null;
}

/** A tap on a cell that holds a block or a plant. */
export function blockTapAction(a: BlockTapInput): BlockTapAction {
  if (a.hasPlant || a.selectedId === null || a.selectedIsSeed) return 'punch';
  return a.placeProblem === null ? 'stack' : 'punch';
}
