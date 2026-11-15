// drawIcon (step BG2): one place that turns an item's icon { shape, colors } into pixels on a
// canvas, a data URL (HTML slots) or a PixiJS texture (the room), cached per (shape, colors, rank,
// size). The drawing itself is iconPixels.ts (pure). Whole pixels, no smoothing.
//
// PLACEHOLDER ART: real pixel art replaces the drawing per item in phase 4 (docs/NOTES.md BG2).

import { Texture } from 'pixi.js';
import { getFurnitureType, getMaterialType, iconKey, type Icon, type IconShape, type LootRef, type PaletteName, type Rank } from '@pixel-hotel/shared';
import { ICON_SIZE, iconPixels } from './iconPixels.ts';

const canvases = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();
const textures = new Map<string, Texture>();

function keyOf(icon: Icon, rank: Rank | undefined, size: number): string {
  return `${iconKey(icon)}|${rank ?? ''}|${size}`;
}

/** The icon on a size x size canvas (32 = the real size; smaller samples the 32 px art, nearest). */
export function drawIcon(shape: IconShape, colors: PaletteName[], rank?: Rank, size = ICON_SIZE): HTMLCanvasElement {
  const icon: Icon = { shape, colors };
  const key = keyOf(icon, rank, size);
  const hit = canvases.get(key);
  if (hit) return hit;
  const px = iconPixels(icon, rank);
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
export function iconDataUrl(icon: Icon, rank?: Rank): string {
  const key = keyOf(icon, rank, ICON_SIZE);
  let url = urls.get(key);
  if (!url) {
    url = drawIcon(icon.shape, icon.colors, rank).toDataURL();
    urls.set(key, url);
  }
  return url;
}

/** The icon as a PixiJS texture (nearest scaling), for goods and drops in the room. */
export function iconTexture(icon: Icon, rank?: Rank, size = ICON_SIZE): Texture {
  const key = keyOf(icon, rank, size);
  let tex = textures.get(key);
  if (!tex) {
    tex = Texture.from(drawIcon(icon.shape, icon.colors, rank, size));
    tex.source.scaleMode = 'nearest';
    textures.set(key, tex);
  }
  return tex;
}

/** The icon of a shop good (a stackable material or a furniture item). */
export function lootIcon(loot: LootRef): Icon {
  return loot.kind === 'material' ? getMaterialType(loot.id).icon : getFurnitureType(loot.typeId).icon;
}
