// OA-5: what a stove or a brewing barrel looks like. Pure: from TavernState (cooks, brews) and the time passed in.
//   cold = nothing on it (no fire, no light, no bubbles); cooking = a batch is on; ready = a batch waits to be collected (a ready dot).

import { brewReady } from './brewing.ts';
import { cookReady } from './cooking.ts';
import type { TavernState } from './tavern.ts';

export type MachineState = 'cold' | 'cooking' | 'ready';

/** The state of the stove or barrel `uid` (furniture uids are unique, so one lookup serves both). */
export function machineState(tavern: Pick<TavernState, 'cooks' | 'brews'>, uid: number, now: number): MachineState {
  const cook = tavern.cooks.find((c) => c.stoveUid === uid);
  if (cook) return cookReady(cook, now) ? 'ready' : 'cooking';
  const brew = tavern.brews.find((b) => b.barrelUid === uid);
  if (brew) return brewReady(brew, now) ? 'ready' : 'cooking';
  return 'cold';
}

/** Every machine that is not cold, uid -> state (cold machines are left out). */
export function machineStates(tavern: Pick<TavernState, 'cooks' | 'brews'>, now: number): Map<number, MachineState> {
  const out = new Map<number, MachineState>();
  for (const c of tavern.cooks) out.set(c.stoveUid, machineState(tavern, c.stoveUid, now));
  for (const b of tavern.brews) out.set(b.barrelUid, machineState(tavern, b.barrelUid, now));
  return out;
}
