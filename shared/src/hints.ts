// VG-1: the one-time in-world hint chip. A small bobbing label on the thing to use, shown once per thing (key), never while the guide points at
// something. Pure: which hint is due and how long it stays. Texts here; the client (game/hintChip.ts) draws and remembers the seen keys in prefs.

import { readingMs } from './text.ts';

export interface ContextHint {
  /** The seen key (stored per device). */
  key: string;
  /** The furniture type it sits on. */
  typeId: string;
  text: string;
}

/** Hints for things in reach in the tavern. */
export const CONTEXT_HINTS: readonly ContextHint[] = [
  { key: 'register', typeId: 'register', text: 'Menu, prices and selling' },
  { key: 'tap_stand', typeId: 'tap_stand', text: 'Load mugs on the taps' },
  { key: 'brewing_barrel', typeId: 'brewing_barrel', text: 'Brew more drinks' },
  { key: 'stove', typeId: 'stove', text: 'Cook dishes' },
];

/** Shown the first time a seed is selected (key 'seed'). */
export const SEED_HINT = { key: 'seed', text: 'Tap a soil cell or a block to plant' } as const;

/** RUN 5: the Book's Splice tab says how the first splice is found (shown while none is found yet). */
export const SPLICE_BOOK_HINT =
  'How to splice: plant a seed, and while it is still young select ANOTHER seed and tap the plant. Two seeds go in and the plant grows a new seed. Punch it when grown.';

/** In reach of a thing (world px between the avatar and its anchor). */
export const HINT_REACH_PX = 96;

/** The first hint among the types in reach that was not shown yet (null = none). */
export function hintDue(inReach: readonly string[], seen: readonly string[]): ContextHint | null {
  for (const h of CONTEXT_HINTS) if (inReach.includes(h.typeId) && !seen.includes(h.key)) return h;
  return null;
}

/** How long a hint stays, ms (reading pace). */
export function hintMs(text: string): number {
  return readingMs(text);
}
