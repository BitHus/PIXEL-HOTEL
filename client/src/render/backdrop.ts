// What is outside the room (atmosphere step): a dark warm wall of old planks, made in code, that
// moves with the camera like the room does, and a stepped vignette toward the screen edges, so
// the room looks like part of a building. Screen space; sits under the room. Both are baked into
// one opaque picture that is only redrawn when the camera moves (one cheap layer while it rests).

import { Container, RenderTexture, Sprite, Texture, TilingSprite, type Renderer } from 'pixi.js';
import { PALETTE, type Camera } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { shade } from './colors.ts';

const TILE = 64;
const PLANK_H = 16;
/** The vignette texture is this small; stretched over the screen it gives chunky pixel steps. */
const VIGNETTE_SIZE = 40;
const VIGNETTE_STEPS = 5;
const VIGNETTE_MAX = 0.78;

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  return { c, ctx };
}

/** Dark planks: four rows per tile with staggered joints and a few fixed specks (seamless). */
function plankTexture(): Texture {
  const { c, ctx } = canvas(TILE, TILE);
  const base = shade(DARK_WARM, 0.62);
  const rows = [shade(DARK_WARM, 0.66), shade(DARK_WARM, 0.58), shade(DARK_WARM, 0.7), shade(DARK_WARM, 0.6)];
  const joints = [20, 52, 8, 40];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE, TILE);
  rows.forEach((color, i) => {
    const y = i * PLANK_H;
    ctx.fillStyle = color;
    ctx.fillRect(0, y, TILE, PLANK_H - 1);
    // The gap under the plank, a joint and a light top edge.
    ctx.fillStyle = shade(DARK_WARM, 0.4);
    ctx.fillRect(0, y + PLANK_H - 1, TILE, 1);
    ctx.fillRect(joints[i] ?? 0, y, 1, PLANK_H - 1);
    ctx.fillStyle = shade(DARK_WARM, 0.8);
    ctx.fillRect(0, y, TILE, 1);
    ctx.fillStyle = shade(DARK_WARM, 0.5);
    ctx.fillRect(((joints[i] ?? 0) + 13) % TILE, y + 6, 5, 1);
    ctx.fillRect(((joints[i] ?? 0) + 37) % TILE, y + 10, 3, 1);
  });
  return Texture.from(c);
}

/** Stepped darkness from the middle (clear) to the corners. */
function vignetteTexture(): Texture {
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
      const a = (Math.round(d * VIGNETTE_STEPS) / VIGNETTE_STEPS) * VIGNETTE_MAX;
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
  private readonly planks = new TilingSprite({ texture: plankTexture(), width: 1, height: 1 });
  private readonly vignette = new Sprite(vignetteTexture());
  private readonly picture = new Sprite();
  private baked: RenderTexture | null = null;
  private key = '';

  constructor(private readonly renderer: Renderer) {
    this.scene.addChild(this.planks, this.vignette);
    this.container.addChild(this.picture);
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
