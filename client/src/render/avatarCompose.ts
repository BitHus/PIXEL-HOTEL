// U1/C18: the layered avatar, baked on the CPU. For a look, pose, facing, frame and head offset: load the layer PNGs (avatar kind), recolour the
// key colours with the look's ramps, composite in avatarLayers order, add ONE 1 px outline (avatarBake.ts, pure) and make one texture. Results are
// cached per look (LRU, MAX_LOOKS). Returns null when a needed layer file is missing: the caller then draws the box avatar (avatarParts.ts).
// Left is never baked: the caller mirrors the right-facing result.

import { Texture } from 'pixi.js';
import { avatarLayers, drawnFacing, headOffset, type AvatarLook, type AvatarOutfit, type Facing, type LayerRef, type RigPose } from '@pixel-hotel/shared';
import { BAKE_FEET_X, BAKE_FEET_Y, CODE_HAT_DY, BAKE_H, BAKE_W, LAYER_H, LAYER_W, bakeLayers, bakePlan, decideSprites, keyMap, lookKey, recolor, type BakeLayer, type SpriteDecision } from './avatarBake.ts';
import { registerBakedPreview } from './avatarParts.ts';
import { DARK_WARM } from './bareStyles.ts';
import { hatBoxes } from './hatParts.ts';
import { spriteFrames } from './spriteStore.ts';

/** At most this many looks are kept baked (guests and visitors use few; section 6, performance). */
export const MAX_LOOKS = 64;

export interface BakedAvatar {
  bytes: Uint8Array;
  codeHat: boolean;
  /** Made on first use (the HTML preview needs only the bytes). */
  texture: Texture | null;
}

const lookCache = new Map<string, Map<string, BakedAvatar | null>>();
const pixelCache = new WeakMap<Texture, Uint8ClampedArray>();
let scratch: HTMLCanvasElement | null = null;

/** The RGBA of one 32 x 64 frame of a strip texture (read once, cached). */
function framePixels(tex: Texture): Uint8ClampedArray | null {
  const hit = pixelCache.get(tex);
  if (hit) return hit;
  const res = tex.source.resource as CanvasImageSource | undefined;
  if (!res || typeof document === 'undefined') return null;
  scratch ??= document.createElement('canvas');
  scratch.width = LAYER_W;
  scratch.height = LAYER_H;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, LAYER_W, LAYER_H);
  const f = tex.frame;
  ctx.drawImage(res, f.x, f.y, LAYER_W, LAYER_H, 0, 0, LAYER_W, LAYER_H);
  const px = ctx.getImageData(0, 0, LAYER_W, LAYER_H).data;
  pixelCache.set(tex, px);
  return px;
}

const strip = (ref: LayerRef): Texture[] | null => {
  const frames = spriteFrames('avatar', ref.id, ref.tag, LAYER_W);
  return frames && frames.length === ref.frames ? frames : null;
};

/** The layer plan and fallback decision for a look/pose/facing (pure rules in avatarBake.ts; only the file lookup is here). */
export function decide(look: AvatarLook, pose: RigPose, facing: Facing, outfit: AvatarOutfit | null = null): SpriteDecision {
  return decideSprites(avatarLayers(look, outfit, drawnFacing(facing).facing, pose), (ref) => strip(ref) !== null);
}

/** True when the baked avatar can be drawn for this look, pose and facing (every needed layer file exists); else the box avatar is used. */
export function hasAvatarSprites(look: AvatarLook, pose: RigPose, facing: Facing, outfit: AvatarOutfit | null = null): boolean {
  return decide(look, pose, facing, outfit).ok;
}

/** The baked avatar (bytes, texture on demand) or null = use the box avatar. `facing` left is baked as right: mirror it yourself. */
export function bakeAvatar(look: AvatarLook, pose: RigPose, facing: Facing, frame: number, head: { dx: number; dy: number }, outfit: AvatarOutfit | null = null): BakedAvatar | null {
  const f = drawnFacing(facing).facing;
  const lk = lookKey(look, outfit);
  let per = lookCache.get(lk);
  if (per) {
    lookCache.delete(lk);
    lookCache.set(lk, per); // most recently used last
  } else {
    per = new Map();
    lookCache.set(lk, per);
    if (lookCache.size > MAX_LOOKS) lookCache.delete(lookCache.keys().next().value!);
  }
  const fk = `${pose}|${f}|${frame}|${head.dx}|${head.dy}`;
  if (per.has(fk)) return per.get(fk)!;
  const d = decide(look, pose, f, outfit);
  let baked: BakedAvatar | null = null;
  if (d.ok) {
    const layers: BakeLayer[] = [];
    let complete = true;
    for (const p of bakePlan(d.layers, frame, head)) {
      const px = strip(p.ref)?.[p.frame];
      const data = px ? framePixels(px) : null;
      if (!data) {
        complete = false;
        break;
      }
      layers.push({ rgba: recolor(data, keyMap(p.ref.slot, look)), dx: p.dx, dy: p.dy });
    }
    if (complete) baked = { bytes: bakeLayers(layers), codeHat: d.codeHat, texture: null };
  }
  per.set(fk, baked);
  return baked;
}

/** The PixiJS texture of a baked avatar (nearest scaling), made once. The feet are at (BAKE_FEET_X, BAKE_FEET_Y). */
export function bakedTexture(b: BakedAvatar): Texture {
  if (!b.texture) {
    const c = bytesToCanvas(b.bytes);
    const t = Texture.from(c);
    t.source.scaleMode = 'nearest';
    b.texture = t;
  }
  return b.texture;
}

export function bytesToCanvas(bytes: Uint8Array): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BAKE_W;
  c.height = BAKE_H;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(bytes), BAKE_W, BAKE_H), 0, 0);
  return c;
}

/** Drops every baked look (tests, or after the sprites were reloaded). */
export function clearAvatarBakes(): void {
  lookCache.clear();
}

export const bakeCacheSize = (): number => lookCache.size;

/**
 * Draws the baked avatar (standing, walk frame 0, no breath) on a 2D context for the HTML previews (character creation, the Avatar panel).
 * (ox, oy) = the feet in canvas px of the preview, `scale` canvas px per art px; 'left' is the right view flipped. Returns false when a layer
 * file is missing: the caller draws the box avatar.
 */
export function drawBakedPreview(ctx: CanvasRenderingContext2D, look: AvatarLook, facing: Facing, scale: number, ox: number, oy: number): boolean {
  const df = drawnFacing(facing).facing;
  const head = headOffset('walk', df, 0, 0, true);
  const b = bakeAvatar(look, 'walk', df, 0, head);
  if (!b) return false;
  const left = facing === 'left';
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(ox * scale, oy * scale);
  if (left) ctx.scale(-1, 1);
  ctx.drawImage(bytesToCanvas(b.bytes), -BAKE_FEET_X * scale, -BAKE_FEET_Y * scale, BAKE_W * scale, BAKE_H * scale);
  const hat = b.codeHat && look.hat ? hatBoxes(look.hat, df) : null;
  if (hat) {
    const oy2 = head.dy + CODE_HAT_DY;
    const rect = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect((x + head.dx) * scale, (y + oy2) * scale, w * scale, h * scale);
    };
    for (const [x, y, w, h] of hat) rect(x - 1, y - 1, w + 2, h + 2, DARK_WARM);
    for (const [x, y, w, h, c] of hat) rect(x, y, w, h, c);
  }
  ctx.restore();
  return true;
}

registerBakedPreview(drawBakedPreview);
