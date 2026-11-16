// U1/C17: the layered avatar's rig, ramps and layer plan (docs/PLAN-CHARACTERS.md sections 3 to 6). Pure, no Pixi, no clock:
// time and distance are passed in. Nothing here draws; the renderer (C18) asks these functions.

import rigData from '../data/avatarRig.json';
import rampData from '../data/ramps.json';
import { WALK_FRAME_PX } from './config.ts';
import { getClothing, type ClothingType } from './clothing.ts';
import type { AvatarLook, AvatarState } from './avatar.ts';
import { PALETTE_NAMES, type PaletteName } from './palette.ts';
import type { Facing } from './types.ts';

// ---------- Layers ----------
/** Draw order for down and right (section 3); the UP view moves outer_back over the body (see avatarLayers). */
export const AVATAR_SLOTS = ['outer_back', 'body', 'shoes', 'legs', 'torso', 'outer', 'hair_back', 'face', 'hair_front', 'hat'] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

/** Body-attached layers are frame strips (walk, sit); head-attached layers are one picture per facing (anim 'still'). */
export const BODY_SLOTS: readonly AvatarSlot[] = ['outer_back', 'body', 'shoes', 'legs', 'torso', 'outer'];
export const isBodySlot = (s: AvatarSlot): boolean => BODY_SLOTS.includes(s);

/** Which key ramps a layer file may use (section 5). Layers with no keys use fixed Endesga colours only. */
export type KeyChannel = 'K1' | 'K2' | 'KS';
export const SLOT_KEYS: Record<AvatarSlot, readonly KeyChannel[]> = {
  outer_back: ['K1', 'K2'],
  body: ['KS'],
  shoes: ['K1'],
  legs: ['K1'],
  torso: ['K1', 'K2', 'KS'],
  outer: ['K1', 'K2'],
  hair_back: ['K1'],
  face: [],
  hair_front: ['K1'],
  hat: [],
};

/** The key colours (light to dark) per channel: palette names, only meaningful inside a layer that allows the channel. */
export const KEY_RAMPS: Record<KeyChannel, readonly PaletteName[]> = {
  K1: ['silver', 'steel', 'slate', 'dusk'],
  K2: ['cyan', 'sky', 'navy', 'pine'],
  KS: ['rose', 'orchid', 'plum', 'magenta'],
};

/** The channel a palette name is a key of, or null (an ordinary colour). */
export function keyChannelOf(name: PaletteName): KeyChannel | null {
  for (const ch of Object.keys(KEY_RAMPS) as KeyChannel[]) if (KEY_RAMPS[ch].includes(name)) return ch;
  return null;
}

// ---------- Ramps ----------
export type Ramp = readonly [PaletteName, PaletteName, PaletteName, PaletteName];
const RAMPS = rampData.ramps as unknown as Record<string, Ramp>;
export const IDENTITY_RAMP = rampData.identity as unknown as Ramp;

/** The 4-colour ramp (light, base, shade, deep) of a palette name, or null when none is defined (the client then derives one). */
export function rampFor(name: PaletteName): Ramp | null {
  return RAMPS[name] ?? null;
}
export const RAMP_NAMES = Object.keys(RAMPS);

/** Ramp of a palette INDEX (the look stores indices). */
export function rampForIndex(index: number): Ramp | null {
  const n = PALETTE_NAMES[index];
  return n ? rampFor(n) : null;
}

// ---------- Rig tables ----------
export type RigPose = 'walk' | 'sit';
type Table = Record<'down' | 'up' | 'right', [number, number][]>;
interface PoseData {
  frames: number;
  sitSeat: number;
  head: Table;
  hand: Table;
}
interface RigData {
  canvas: { w: number; h: number };
  headTop: number;
  hatTop: number;
  breath: { dy: number; durationMs: number; periodMs: number };
  poses: Record<RigPose, PoseData>;
}
export const RIG = rigData as unknown as RigData;

/** The drawn facing (left is the mirror of right) and whether to mirror. */
export function drawnFacing(facing: Facing): { facing: 'down' | 'up' | 'right'; mirror: boolean } {
  return facing === 'left' ? { facing: 'right', mirror: true } : { facing, mirror: false };
}

/** Which rig pose an avatar state uses: idle is walk frame 0, lie is drawn by code (null). */
export function rigPose(state: AvatarState): RigPose | null {
  return state === 'lie' ? null : state === 'sit' ? 'sit' : 'walk';
}

/** Frames of a pose (a strip has this many frames of the canvas width). */
export const poseFrames = (pose: RigPose): number => RIG.poses[pose].frames;

/** The walk frame for the distance walked so far: one frame per WALK_FRAME_PX, wrapping; negative distances wrap too. */
export function walkFrame(distancePx: number, frames = RIG.poses.walk.frames, framePx = WALK_FRAME_PX): number {
  if (!Number.isFinite(distancePx) || frames <= 0) return 0;
  const step = Math.floor(distancePx / framePx);
  return ((step % frames) + frames) % frames;
}

/**
 * Head offset in px for a pose, facing, frame and time: the table plus a 1 px breath while standing or sitting (not while `moving`).
 * Left mirrors dx. `moving` defaults to a walk pose past frame 0; pass it explicitly from the avatar state.
 */
export function headOffset(pose: RigPose, facing: Facing, frame: number, tMs = 0, moving = pose === 'walk' && frame !== 0): { dx: number; dy: number } {
  const d = drawnFacing(facing);
  const rows = RIG.poses[pose].head[d.facing];
  const [dx, dy] = rows[((frame % rows.length) + rows.length) % rows.length]!;
  let by = dy;
  if (!moving) {
    const t = ((tMs % RIG.breath.periodMs) + RIG.breath.periodMs) % RIG.breath.periodMs;
    if (t < RIG.breath.durationMs) by += RIG.breath.dy;
  }
  return { dx: d.mirror ? -dx : dx, dy: by };
}

/** The held-item anchor, px from the feet column (x) and feet row (y, negative up), for a pose, facing and frame. */
export function handAnchor(pose: RigPose, facing: Facing, frame: number): { x: number; y: number } {
  const d = drawnFacing(facing);
  const rows = RIG.poses[pose].hand[d.facing];
  const [x, y] = rows[((frame % rows.length) + rows.length) % rows.length]!;
  return { x: d.mirror ? -x : x, y };
}

// ---------- The layer plan ----------
/** What a role or outfit adds on top of the look (NPC roles, later `look.outer`). Values are layer item names. */
export interface AvatarOutfit {
  outer?: string;
  outerBack?: string;
}

export interface LayerRef {
  slot: AvatarSlot;
  /** `<slot>_<item>`: the sprite id in the `avatar` kind. */
  id: string;
  item: string;
  /** The strip tag `<anim>_<facing>` (spriteFrames('avatar', id, tag, 32)). */
  tag: string;
  frames: number;
  /** Draw the file mirrored (facing left). */
  mirror: boolean;
  /** An optional layer is skipped when its file is missing (a plain look has no outer or back hair); the others must exist or the box avatar is used. */
  optional: boolean;
}

const hatHides = (hat: ClothingType | undefined): 'none' | 'front' | 'all' => hat?.hides ?? 'none';

/**
 * The layers to draw, in order, for a look. `pose` 'walk' also serves idle (frame 0). Down and right: outer_back, body, shoes, legs,
 * torso, outer, hair_back, face, hair_front, hat. Up: outer_back moves over the worn clothes (a cloak covers the back) and the face is
 * not drawn. A hat that hides 'front' drops hair_front, 'all' drops both hair layers. Clothing ids are used as given.
 */
export function avatarLayers(look: AvatarLook, outfit: AvatarOutfit | null, facing: Facing, pose: RigPose): LayerRef[] {
  const d = drawnFacing(facing);
  const hat = look.hat ? getClothing(look.hat) : undefined;
  const hides = hatHides(hat);
  const items: Record<AvatarSlot, string | null> = {
    outer_back: outfit?.outerBack ?? null,
    body: 'base',
    shoes: 'boots',
    legs: look.bottoms,
    torso: look.top,
    outer: outfit?.outer ?? null,
    hair_back: look.hairStyle,
    face: d.facing === 'up' ? null : 'default',
    hair_front: look.hairStyle,
    hat: look.hat ? look.hat : null,
  };
  // The apron (outer) has no sit frame yet: hide it while sitting (remove this line when the sit frame exists).
  if (pose === 'sit') items.outer = null;
  if (hides === 'all') {
    items.hair_back = null;
    items.hair_front = null;
  } else if (hides === 'front') items.hair_front = null;
  const order: AvatarSlot[] = d.facing === 'up'
    ? ['body', 'shoes', 'legs', 'torso', 'outer', 'outer_back', 'hair_back', 'face', 'hair_front', 'hat']
    : [...AVATAR_SLOTS];
  const out: LayerRef[] = [];
  for (const slot of order) {
    const item = items[slot];
    if (!item) continue;
    const body = isBodySlot(slot);
    out.push({
      slot,
      id: `${slot}_${item}`,
      item,
      tag: `${body ? pose : 'still'}_${d.facing}`,
      frames: body ? poseFrames(pose) : 1,
      mirror: d.mirror,
      optional: slot === 'outer' || slot === 'outer_back' || slot === 'hair_back',
    });
  }
  return out;
}
