// U1/C17: the layered avatar's rig, ramps and layer plan (docs/PLAN-CHARACTERS.md sections 3 to 6). Pure, no Pixi, no clock:
// time and distance are passed in. Nothing here draws; the renderer (C18) asks these functions.

import rigData from '../data/avatarRig.json';
import rampData from '../data/ramps.json';
import { BLINK_CLOSED_MS, BLINK_MAX_MS, BLINK_MIN_MS, WALK_FRAME_PX } from './config.ts';
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
/** lean and drink (RUN 5, art LOOK2): a guest standing at the bar, seen from behind (only the UP strips are drawn; down and right fall back to idle). */
export type RigPose = 'walk' | 'sit' | 'idle' | 'eat' | 'wave' | 'lean' | 'drink';
export const RIG_POSES: readonly RigPose[] = ['walk', 'sit', 'idle', 'eat', 'wave', 'lean', 'drink'];
/** The standing poses of a bar guest (TF): leaning on the bar, or drinking from the mug. */
export type BarPose = 'lean' | 'drink';
type Table = Record<'down' | 'up' | 'right', [number, number][]>;
interface PoseData {
  frames: number;
  /** ms per frame of a timed pose (idle, eat, wave); walk frames come from the distance walked. */
  frameMs?: number;
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

/** Which rig pose an avatar state uses (CH1): standing still is 'idle' (2 frames), seated is 'sit' ('eat' while `eating`), a wave or cheer emote on two feet is 'wave'; lie is drawn by code (null). */
export function rigPose(state: AvatarState, opts: { eating?: boolean; waving?: boolean; bar?: BarPose | null } = {}): RigPose | null {
  if (state === 'lie') return null;
  if (state === 'sit') return opts.eating ? 'eat' : 'sit';
  if (state === 'walk') return 'walk';
  // A wave wins over a bar pose; a standing bar guest leans or drinks (RUN 5 hook for TF bar guests).
  return opts.waving ? 'wave' : (opts.bar ?? 'idle');
}

/** The frame of a timed pose (idle, eat, wave) at time tMs; `phaseMs` shifts one avatar against the others so a room does not breathe in step. Poses without a frameMs give 0. */
export function timedFrame(pose: RigPose, tMs: number, phaseMs = 0): number {
  const p = RIG.poses[pose];
  if (!p.frameMs || p.frames <= 1) return 0;
  const n = Math.floor((tMs + phaseMs) / p.frameMs);
  return ((n % p.frames) + p.frames) % p.frames;
}

/** Is the face blinking at tMs? One blink of BLINK_CLOSED_MS per interval; the interval (BLINK_MIN_MS to BLINK_MAX_MS) and the start depend on the seed only (pure, no rng). */
export function blinkClosed(tMs: number, seed: number): boolean {
  const h = (Math.imul(Math.floor(seed) | 0, 2654435761) >>> 0) / 4294967296;
  const h2 = (Math.imul((Math.floor(seed) | 0) ^ 0x9e3779b9, 2246822519) >>> 0) / 4294967296;
  const period = BLINK_MIN_MS + Math.floor(h * (BLINK_MAX_MS - BLINK_MIN_MS + 1));
  const t = (((tMs + h2 * period) % period) + period) % period;
  return t < BLINK_CLOSED_MS;
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
  // Idle, eat, wave, lean and drink have their own frames (the breath is in the strips); only walk and sit get the code breath.
  if (!moving && (pose === 'walk' || pose === 'sit')) {
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

export interface LayerAlt {
  tag: string;
  frames: number;
  /** Always draw frame 0 of this strip (a different pose: its frame 1 is not the same picture). */
  first: boolean;
}

export interface LayerRef {
  slot: AvatarSlot;
  /** `<slot>_<item>`: the sprite id in the `avatar` kind. */
  id: string;
  item: string;
  /** The strip tag `<anim>_<facing>` (spriteFrames('avatar', id, tag, 32)). */
  tag: string;
  frames: number;
  /** Other strips to use when this one's file is missing (idle falls back to walk, eat to sit, blink to still): tried in order. */
  alts: readonly LayerAlt[];
  /** Draw the file mirrored (facing left). */
  mirror: boolean;
  /** An optional layer is skipped when its file is missing (a plain look has no outer or back hair); the others must exist or the box avatar is used. */
  optional: boolean;
}

/** The strips a body layer may use when the file of the pose is missing (art arrives piece by piece): idle and wave fall back to walk frame 0, eat to sit, lean and drink to idle. */
export function poseAlts(pose: RigPose, facing: 'down' | 'up' | 'right'): LayerAlt[] {
  const alt = (p: RigPose, first: boolean): LayerAlt => ({ tag: `${p}_${facing}`, frames: poseFrames(p), first });
  switch (pose) {
    case 'idle': return [alt('walk', true)];
    case 'wave': return [alt('idle', false), alt('walk', true)];
    case 'eat': return [alt('sit', true)];
    // Bar poses: only the body and torso of the UP view are drawn; every other layer and facing uses the idle (then walk) strips.
    case 'lean':
    case 'drink': return [alt('idle', false), alt('walk', true)];
    default: return [];
  }
}

const hatHides = (hat: ClothingType | undefined): 'none' | 'front' | 'all' => hat?.hides ?? 'none';

/**
 * The layers to draw, in order, for a look. `pose` 'walk' also serves idle (frame 0). Down and right: outer_back, body, shoes, legs,
 * torso, outer, hair_back, face, hair_front, hat. Up: outer_back moves over the worn clothes (a cloak covers the back) and the face is
 * not drawn. A hat that hides 'front' drops hair_front, 'all' drops both hair layers. Clothing ids are used as given.
 */
export function avatarLayers(look: AvatarLook, outfit: AvatarOutfit | null, facing: Facing, pose: RigPose, blink = false): LayerRef[] {
  const d = drawnFacing(facing);
  const hat = look.hat ? getClothing(look.hat) : undefined;
  const hides = hatHides(hat);
  const items: Record<AvatarSlot, string | null> = {
    outer_back: outfit?.outerBack ?? null,
    body: 'base',
    shoes: 'boots',
    legs: look.bottoms,
    torso: look.top,
    outer: outfit?.outer ?? (look.outer ? look.outer : null),
    hair_back: look.hairStyle,
    face: d.facing === 'up' ? null : 'default',
    hair_front: look.hairStyle,
    hat: look.hat ? look.hat : null,
  };
  if (hides === 'all') {
    items.hair_back = null;
    items.hair_front = null;
  } else if (hides === 'front' && d.facing !== 'up') items.hair_front = null; // from behind the hair IS hair_front: a front-only hat keeps it (no bald head)
  const order: AvatarSlot[] = d.facing === 'up'
    ? ['body', 'shoes', 'legs', 'torso', 'outer', 'outer_back', 'hair_back', 'face', 'hair_front', 'hat']
    : [...AVATAR_SLOTS];
  const out: LayerRef[] = [];
  for (const slot of order) {
    const item = items[slot];
    if (!item) continue;
    const body = isBodySlot(slot);
    const blinking = slot === 'face' && blink;
    out.push({
      slot,
      id: `${slot}_${item}`,
      item,
      tag: `${body ? pose : blinking ? 'blink' : 'still'}_${d.facing}`,
      frames: body ? poseFrames(pose) : 1,
      alts: body ? poseAlts(pose, d.facing) : blinking ? [{ tag: `still_${d.facing}`, frames: 1, first: true }] : [],
      mirror: d.mirror,
      optional: slot === 'outer' || slot === 'outer_back' || slot === 'hair_back',
    });
  }
  return out;
}
