// Types and one helper shared by LocalGameAPI and its helper modules (R1 split).

import type { Avatar, Facing, Point, SeatSpot } from '@pixel-hotel/shared';

export type SaveResult = { ok: true } | { ok: false; message: string };

/** The own avatar's walk, tracked by time: where it was at `at` and what was left to walk. */
export interface WalkState {
  avatar: Avatar;
  path: Point[];
  at: number;
  /** Sits (or lies) on this seat when the path ends. */
  sitOn: { uid: number; seat: SeatSpot } | null;
  /** Walking to the spot behind the counter (step 7): the counter's uid and where it stood. */
  serveAt?: { uid: number; x: number; y: number; facing: Facing } | null;
  /** Standing behind the counter, taking payments: the counter's uid and where it stood. */
  serving?: { uid: number; x: number; y: number; facing: Facing } | null;
  /** The item and seat index the avatar is sitting or lying on. */
  seated: { uid: number; index: number } | null;
  /** Step 9t: what this walk is for while serving or tidying a table (a new walk of any other kind drops it). */
  task?: TavernTask | undefined;
}

/** The player's tavern errand: to the bar for an order, to the guest's table with it, or to a table spot to tidy it. */
export type TavernTask =
  | { stage: 'bar' }
  /** Standing at the tap stand while the mug is poured (step T1): done at `until` (ms, the API clock). */
  | { stage: 'pour'; until: number }
  | { stage: 'table'; guestId: number }
  | { stage: 'mess'; messId: number; what: 'coins' | 'dish' };

export function finitePoint(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
