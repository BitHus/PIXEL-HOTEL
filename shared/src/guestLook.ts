// What a guest looks like and where guests come from (step 9d, kept by 9t and S1). Pure.

import { CUSTOMER_KIND_WEIGHTS, CUSTOMER_OUTSIDE_PX, CUSTOMER_TOLERANCE_MAX, CUSTOMER_TOLERANCE_MIN, LOOK_COLORS } from './config.ts';
import type { AvatarLook } from './avatar.ts';
import { doorPoint } from './furniture.ts';
import type { CustomerKind } from './npcTalk.ts';
import { doorY, type Room } from './room.ts';
import { rngPick, seededRng } from './rng.ts';
import type { Point, Rng } from './types.ts';

/** Where guests appear and disappear: below the door, outside the floor. */
export function outsidePoint(room: Room): Point {
  const d = doorPoint(room);
  return { x: d.x, y: doorY(room) + CUSTOMER_OUTSIDE_PX };
}

/**
 * A guest's look from the free clothing and LOOK_COLORS, the same every time for the same id
 * (seeded by the id, so it survives a reload).
 */
/** The pieces that have layer PNGs (client/src/assets/sprites/avatar): guests are drawn from these, so they use the layered sprites, not the box fallback. */
export const GUEST_SPRITE_PIECES = {
  hairStyle: ['short', 'long'],
  top: ['tunic'],
  bottoms: ['trousers'],
  hat: ['straw_hat', 'hood_coif'],
} as const;
/** About one guest in four wears a hat. */
export const GUEST_HAT_CHANCE = 0.25;

export function guestLook(id: number): AvatarLook {
  const rng = seededRng(Math.imul(Math.abs(id) + 1, 0x9e3779b1) ^ 0x5bd1e995);
  const look: AvatarLook = {
    skin: rngPick(rng, LOOK_COLORS.skin),
    hair: rngPick(rng, LOOK_COLORS.hair),
    hairStyle: rngPick(rng, GUEST_SPRITE_PIECES.hairStyle),
    top: rngPick(rng, GUEST_SPRITE_PIECES.top),
    shirt: rngPick(rng, LOOK_COLORS.top),
    bottoms: rngPick(rng, GUEST_SPRITE_PIECES.bottoms),
    legs: rngPick(rng, LOOK_COLORS.bottoms),
    shoes: rngPick(rng, LOOK_COLORS.shoes),
  };
  return rng() < GUEST_HAT_CHANCE ? { ...look, hat: rngPick(rng, GUEST_SPRITE_PIECES.hat) } : look;
}

/** A guest kind by CUSTOMER_KIND_WEIGHTS. */
export function rollGuestKind(rng: Rng): CustomerKind {
  const kinds = Object.keys(CUSTOMER_KIND_WEIGHTS) as CustomerKind[];
  const total = kinds.reduce((a, k) => a + CUSTOMER_KIND_WEIGHTS[k], 0);
  let r = rng() * total;
  for (const k of kinds) {
    r -= CUSTOMER_KIND_WEIGHTS[k];
    if (r < 0) return k;
  }
  return kinds[kinds.length - 1]!;
}

/** A tolerance in [0.8, 1.4]: a guest orders when the price is at most baseValue * tolerance. */
export function rollTolerance(rng: Rng): number {
  return CUSTOMER_TOLERANCE_MIN + rng() * (CUSTOMER_TOLERANCE_MAX - CUSTOMER_TOLERANCE_MIN);
}
