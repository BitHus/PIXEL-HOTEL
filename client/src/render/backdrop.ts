// What is outside the room (atmosphere step). Indoors: a calm dark warm wall of old planks, so the
// room looks like part of a building. Outdoors (the farm; owner, after 9d): darker grass with tree
// and bush shapes, never a building wall. Made in code; it moves with the camera like the room
// does, with a stepped vignette toward the screen edges (mild outdoors: daylight). Screen space;
// sits under the room. Everything is baked into one opaque picture that is only redrawn when the
// camera moves (one cheap layer while it rests).

import { Container, RenderTexture, Sprite, Texture, TilingSprite, type Renderer } from 'pixi.js';
import { PALETTE, type Camera } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { shade } from './colors.ts';

const TILE = 64;
const PLANK_H = 16;
/** The vignette texture is this small; stretched over the screen it gives chunky pixel steps. */
const VIGNETTE_SIZE = 40;
const VIGNETTE_STEPS = 5;
const VIGNETTE_MAX = 0.6;
/** Outdoors it is day: only a light vignette. */
const VIGNETTE_MAX_OUTDOOR = 0.3;

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  return { c, ctx };
}

/** Dark planks: four rows per tile with staggered joints (seamless). Calm: the rows differ only a little. */
function plankTexture(): Texture {
  const { c, ctx } = canvas(TILE, TILE);
  const rows = [shade(DARK_WARM, 0.62), shade(DARK_WARM, 0.6), shade(DARK_WARM, 0.64), shade(DARK_WARM, 0.61)];
  const joints = [20, 52, 8, 40];
  rows.forEach((color, i) => {
    const y = i * PLANK_H;
    ctx.fillStyle = color;
    ctx.fillRect(0, y, TILE, PLANK_H);
    // The gap under the plank and a joint, only a little darker.
    ctx.fillStyle = shade(DARK_WARM, 0.52);
    ctx.fillRect(0, y + PLANK_H - 1, TILE, 1);
    ctx.fillRect(joints[i] ?? 0, y, 1, PLANK_H - 1);
  });
  return Texture.from(c);
}

const OUT_TILE = 256;
/**
 * Trees and bushes on the outdoor tile: [x, y, radius]. Big ones are tree crowns (drawn as a few
 * overlapping blobs, so no two look the same), small ones bushes. Loosely grouped, not in rows.
 */
const GREENERY: readonly (readonly [number, number, number])[] = [
  [38, 40, 27], [84, 62, 19], [196, 28, 22], [230, 70, 16], [140, 150, 28], [176, 190, 18],
  [24, 176, 21], [70, 226, 24], [226, 222, 20],
  [120, 30, 7], [150, 84, 9], [58, 118, 8], [100, 190, 6], [206, 132, 10], [18, 104, 6], [246, 160, 7],
];

/** A round pixel blob (whole rows, no smooth edge). */
function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    if (half > 0) ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }
}

/** Outdoors: darker grass with tufts, and dark tree crowns and bushes seen from above (seamless). */
function outdoorTexture(): Texture {
  const { c, ctx } = canvas(OUT_TILE, OUT_TILE);
  const grass = shade(PALETTE[13], 0.8);
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, OUT_TILE, OUT_TILE);
  ctx.fillStyle = shade(PALETTE[13], 0.9);
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 67 + 11) % OUT_TILE, (i * 113 + 29) % OUT_TILE, 1, 2);
  ctx.fillStyle = shade(PALETTE[13], 0.7);
  for (let i = 0; i < 30; i++) ctx.fillRect((i * 89 + 50) % OUT_TILE, (i * 61 + 7) % OUT_TILE, 3, 1);
  const leaf = PALETTE[14];
  for (const [x, y, r] of GREENERY) {
    // Drawn on the tile and its neighbours, so a shape over the edge wraps around.
    for (const ox of [-OUT_TILE, 0, OUT_TILE]) {
      for (const oy of [-OUT_TILE, 0, OUT_TILE]) {
        const cx = x + ox;
        const cy = y + oy;
        // A crown is the main blob plus two smaller ones on its sides (bushes: just one).
        const parts: [number, number, number][] = r > 12 ? [[0, 0, r], [-Math.round(r * 0.6), Math.round(r * 0.35), Math.round(r * 0.6)], [Math.round(r * 0.55), -Math.round(r * 0.3) + (x % 7), Math.round(r * 0.55)]] : [[0, 0, r]];
        for (const [dx, dy, pr] of parts) blob(ctx, cx + dx + 2, cy + dy + Math.round(pr * 0.35), pr, shade(PALETTE[13], 0.62)); // the shadow on the grass
        for (const [dx, dy, pr] of parts) blob(ctx, cx + dx, cy + dy, pr, PALETTE[15]); // the dark rim
        for (const [dx, dy, pr] of parts) blob(ctx, cx + dx - 1, cy + dy - 1, pr - 2, leaf);
        for (const [dx, dy, pr] of parts) blob(ctx, cx + dx - Math.round(pr * 0.3), cy + dy - Math.round(pr * 0.3), Math.round(pr * 0.4), shade(leaf, 1.14)); // light from the top-left
      }
    }
  }
  return Texture.from(c);
}

/** Stepped darkness from the middle (clear) to the corners. */
function vignetteTexture(max: number): Texture {
  const n = VIGNETTE_SIZE;
  const { c, ctx } = canvas(n, n);
  const img = ctx.createImageData(n, n);
  const dark = parseInt(PALETTE[25].slice(1), 16);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n - 0.5;
      const dy = (y + 0.5) / n - 0.5;
      // 0 in the middle, 1 in the corners; clear until about half way out.
      const d = Math.min(1, Math.max(0, (Math.hypot(dx, dy) / Math.SQRT1_2 - 0.45) / 0.55));
      const a = (Math.round(d * VIGNETTE_STEPS) / VIGNETTE_STEPS) * max;
      const i = (y * n + x) * 4;
      img.data[i] = (dark >> 16) & 255;
      img.data[i + 1] = (dark >> 8) & 255;
      img.data[i + 2] = dark & 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(c);
}

export class Backdrop {
  /** On the stage: one opaque picture of the planks and the vignette (redrawn only when the camera moves). */
  readonly container = new Container({ eventMode: 'none' });
  private readonly scene = new Container();
  private readonly indoor = plankTexture();
  private outdoor: Texture | null = null;
  private readonly planks = new TilingSprite({ texture: this.indoor, width: 1, height: 1 });
  private readonly vignetteIn = vignetteTexture(VIGNETTE_MAX);
  private vignetteOut: Texture | null = null;
  private readonly vignette = new Sprite(this.vignetteIn);
  private readonly picture = new Sprite();
  private baked: RenderTexture | null = null;
  private key = '';

  constructor(private readonly renderer: Renderer) {
    this.scene.addChild(this.planks, this.vignette);
    this.container.addChild(this.picture);
  }

  /** Outdoors (the farm): grass with trees and bushes in place of the planks. */
  setOutdoor(outdoor: boolean): void {
    if (outdoor) {
      this.outdoor ??= outdoorTexture();
      this.vignetteOut ??= vignetteTexture(VIGNETTE_MAX_OUTDOOR);
    }
    this.planks.texture = outdoor && this.outdoor ? this.outdoor : this.indoor;
    this.vignette.texture = outdoor && this.vignetteOut ? this.vignetteOut : this.vignetteIn;
    this.key = '';
  }

  /** Every frame: the planks follow the camera (snapped, like the room); the vignette fills the screen. */
  update(shown: Camera, w: number, h: number): void {
    if (!this.container.visible) return;
    const res = this.renderer.resolution;
    const key = `${shown.x},${shown.y},${shown.zoom},${w},${h},${res}`;
    if (key === this.key) return;
    this.key = key;
    if (!this.baked || this.baked.width !== w || this.baked.height !== h || this.baked.source.resolution !== res) {
      this.baked?.destroy(true);
      this.baked = RenderTexture.create({ width: w, height: h, resolution: res, antialias: false, scaleMode: 'nearest' });
      this.picture.texture = this.baked;
    }
    this.planks.width = w;
    this.planks.height = h;
    this.planks.tileScale.set(shown.zoom);
    this.planks.tilePosition.set(-shown.x * shown.zoom, -shown.y * shown.zoom);
    this.vignette.width = w;
    this.vignette.height = h;
    this.renderer.render({ container: this.scene, target: this.baked, clear: true });
  }

  /** Shown again after being hidden: draw it afresh. */
  refresh(): void {
    this.key = '';
  }
}
