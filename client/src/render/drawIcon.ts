// drawIcon (step BG2): one place that turns an item's icon { shape, colors } into pixels on a
// canvas, a data URL (HTML slots) or a PixiJS texture (the room), cached per (shape, colors, rank,
// size). The drawing itself is iconPixels.ts (pure). Whole pixels, no smoothing.
//
// PLACEHOLDER ART: real pixel art replaces the drawing per item in phase 4 (docs/NOTES.md BG2).

import { Sprite, Texture } from 'pixi.js';
import { spriteTexture } from './spriteStore.ts';
import { getFurnitureType, getMaterialType, iconKey, paletteColor, type Icon, type IconShape, type LootRef, type PaletteName, type Rank } from '@pixel-hotel/shared';
import { ICON_SIZE, iconPixels } from './iconPixels.ts';

const canvases = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();
const textures = new Map<string, Texture>();

/** A drink's ripening tier (K2): a 3 px band across the middle of the mug, gold for aged, red for vintage, orchid for reserve (CEL-5). */
export type IconTier = 'aged' | 'vintage' | 'reserve';
const TIER_BAND: Record<IconTier, PaletteName> = { aged: 'gold', vintage: 'red', reserve: 'orchid' };

function keyOf(icon: Icon, rank: Rank | undefined, size: number, tier?: IconTier): string {
  return `${iconKey(icon)}|${rank ?? ''}|${size}|${tier ?? ''}`;
}

/** The icon's pixels with the tier band painted over its opaque pixels (rows centred on the middle of the shape). */
function bandedPixels(px: (string | null)[], tier: IconTier): (string | null)[] {
  let top = ICON_SIZE;
  let bottom = -1;
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      if (px[y * ICON_SIZE + x]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (bottom < 0) return px;
  const mid = Math.floor((top + bottom) / 2);
  const out = px.slice();
  const hex = paletteColor(TIER_BAND[tier]);
  for (let y = mid - 1; y <= mid + 1; y++) {
    for (let x = 0; x < ICON_SIZE; x++) if (out[y * ICON_SIZE + x]) out[y * ICON_SIZE + x] = hex;
  }
  return out;
}

/** The icon on a size x size canvas (32 = the real size; smaller samples the 32 px art, nearest). */
export function drawIcon(shape: IconShape, colors: PaletteName[], rank?: Rank, size = ICON_SIZE, tier?: IconTier): HTMLCanvasElement {
  const icon: Icon = { shape, colors };
  const key = keyOf(icon, rank, size, tier);
  const hit = canvases.get(key);
  if (hit) return hit;
  const px = tier ? bandedPixels(iconPixels(icon, rank), tier) : iconPixels(icon, rank);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = px[Math.floor(((y + 0.5) * ICON_SIZE) / size) * ICON_SIZE + Math.floor(((x + 0.5) * ICON_SIZE) / size)];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  canvases.set(key, canvas);
  return canvas;
}

/** The icon as a data URL for an <img> (HTML slots; CSS shows it pixelated). */
export function iconDataUrl(icon: Icon, rank?: Rank, tier?: IconTier): string {
  const key = keyOf(icon, rank, ICON_SIZE, tier);
  let url = urls.get(key);
  if (!url) {
    url = drawIcon(icon.shape, icon.colors, rank, ICON_SIZE, tier).toDataURL();
    urls.set(key, url);
  }
  return url;
}

/** The icon as a PixiJS texture (nearest scaling), for goods and drops in the room. */
export function iconTexture(icon: Icon, rank?: Rank, size = ICON_SIZE, tier?: IconTier): Texture {
  const key = keyOf(icon, rank, size, tier);
  let tex = textures.get(key);
  if (!tex) {
    tex = Texture.from(drawIcon(icon.shape, icon.colors, rank, size, tier));
    tex.source.scaleMode = 'nearest';
    textures.set(key, tex);
  }
  return tex;
}

/**
 * A sprite showing an item's icon, `size` px square: its PNG (assets/sprites/icons/<id>.png, or blocks/<id>.png) when it has one, else the code icon.
 * The room-side twin of the id-aware functions in ui/itemIcon.ts (docs/PLAN-ART-UPGRADE.md section 0).
 */
export function iconSpriteFor(id: string, icon: Icon, rank?: Rank, size = ICON_SIZE): Sprite {
  const tex = spriteTexture('icons', id) ?? spriteTexture('blocks', id);
  if (!tex) return new Sprite(iconTexture(icon, rank, size));
  const s = new Sprite(tex);
  s.width = size;
  s.height = size;
  return s;
}

/** The icon of a shop good (a stackable material or a furniture item). */
export function lootIcon(loot: LootRef): Icon {
  return loot.kind === 'material' ? getMaterialType(loot.id).icon : getFurnitureType(loot.typeId).icon;
}
