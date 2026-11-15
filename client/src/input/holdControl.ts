// Hold to repeat (step BG5b), the client side. cameraControl reports presses; this keeps the pure
// HoldState (shared/src/hold.ts holdTick) and sends ONE request per hit through `deps.hit` (which goes
// to the GameAPI). No game rules here. Not for the dungeon fight (one hit per tap) and not for fishing.

import {
  AXE_COOLDOWN_MS,
  BLOCK_HIT_COOLDOWN_MS,
  HOLD_IDLE,
  HOLD_PLACE_MS,
  PICKAXE_COOLDOWN_MS,
  holdStart,
  holdStop,
  holdTick,
  type HoldState,
} from '@pixel-hotel/shared';

export type HoldTarget =
  | { kind: 'block'; c: number; r: number }
  | { kind: 'plant'; c: number; r: number }
  | { kind: 'tree'; index: number }
  | { kind: 'rock'; id: number }
  /** Placing blocks along cells (the cells come from push()). */
  | { kind: 'line'; c: number; r: number };

/**
 * What a hit answered: go on, stop the hold (it broke, nothing there), the avatar walks closer first,
 * or 'retry' = it was too early (the cooldown of the other side had not ended): nothing happened, ask again next frame.
 */
export type HoldResult = 'go' | 'stop' | 'walk' | 'retry';

export interface HoldDeps {
  now(): number;
  /** True while the avatar is walking (after a 'walk' answer the hold waits until it arrived). */
  walking(): boolean;
  /** One hit = one request. Resolves with what to do next. */
  hit(target: HoldTarget): Promise<HoldResult>;
}

export function holdCooldown(target: HoldTarget): number {
  switch (target.kind) {
    case 'rock':
      return PICKAXE_COOLDOWN_MS;
    case 'tree':
      return AXE_COOLDOWN_MS;
    case 'line':
      return HOLD_PLACE_MS;
    default:
      return BLOCK_HIT_COOLDOWN_MS;
  }
}

export class HoldControl {
  private state: HoldState = HOLD_IDLE;
  private target: HoldTarget | null = null;
  private busy = false;
  /** Counts holds, so an answer that comes after the hold ended is ignored. */
  private gen = 0;
  private approaching = false;
  private queue: { c: number; r: number }[] = [];
  private last: { c: number; r: number } | null = null;

  constructor(private readonly deps: HoldDeps) {}

  get active(): boolean {
    return this.state.active;
  }

  /** The press went down on something to hit: the first hit comes at once. */
  start(target: HoldTarget): void {
    this.gen++;
    this.state = holdStart();
    this.target = target;
    this.busy = false;
    this.approaching = false;
    this.queue = target.kind === 'line' ? [{ c: target.c, r: target.r }] : [];
    this.last = target.kind === 'line' ? { c: target.c, r: target.r } : null;
    this.tick();
  }

  /** Cells the pointer passed over during a line hold (already without the one it came from). */
  push(cells: { c: number; r: number }[]): void {
    if (this.target?.kind !== 'line') return;
    this.queue.push(...cells);
    const end = cells[cells.length - 1];
    if (end) this.last = end;
  }

  get lastCell(): { c: number; r: number } | null {
    return this.last;
  }

  stop(): void {
    this.gen++;
    this.state = holdStop();
    this.target = null;
    this.queue = [];
    this.last = null;
    this.approaching = false;
  }

  /** Every frame. At most one request in flight; holdTick decides when the next hit is due. */
  tick(): void {
    const target = this.target;
    if (!this.state.active || !target || this.busy) return;
    if (this.approaching) {
      if (this.deps.walking()) return;
      this.approaching = false;
    }
    let hitTarget: HoldTarget = target;
    if (target.kind === 'line') {
      if (this.queue.length === 0) return; // nothing to place: do not use up the cooldown
      const cell = this.queue[0]!;
      hitTarget = { kind: 'line', c: cell.c, r: cell.r };
    }
    const before = this.state;
    const r = holdTick(this.state, this.deps.now(), holdCooldown(hitTarget));
    this.state = r.state;
    if (!r.hit) return;
    if (target.kind === 'line') this.queue.shift();
    this.busy = true;
    const gen = this.gen;
    void this.deps.hit(hitTarget).then(
      (res) => {
        if (gen !== this.gen) return; // the hold ended (or a new one began) meanwhile
        this.busy = false;
        if (res === 'retry') {
          this.state = before; // too early: the next frame asks again, the cooldown was not used
          if (hitTarget.kind === 'line') this.queue.unshift({ c: hitTarget.c, r: hitTarget.r });
        } else if (res === 'stop') this.stop();
        else if (res === 'walk') this.approaching = true;
      },
      () => {
        if (gen !== this.gen) return;
        this.busy = false;
        this.stop();
      },
    );
  }
}
