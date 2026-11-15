// What is outside the room: the void (old-Habbo feel). A flat deep night colour with a few tiny
// 1 px specks of light, never more than a sprinkle. Made in code. The specks drift at a fraction of
// the camera speed (a little depth), always at whole screen pixels. A soft stepped vignette darkens
// the screen edges. Screen space; sits under the room. Everything is baked into one opaque picture
// that is only redrawn when the camera moves (one cheap layer while it rests).

import { Container, RenderTexture, Sprite, Texture, TilingSprite, type Renderer } from 'pixi.js';
import { PALETTE, type Camera } from '@pixel-hotel/shared';

/** The tile the specks repeat on (screen px; far larger than the eye notices as a pattern). */
const TILE = 192;
/** Specks per tile: few on purpose. */
const SPECKS = 22;
/** The specks move this much of the camera (0 = fixed to the screen, 1 = glued to the world). */
const PARALLAX = 0.15;
/** One speck is this many screen px wide (whole numbers keep it crisp). */
const SPECK_SIZE = 2;
const VIGNETTE_SIZE = 40;
const VIGNETTE_STEPS = 5;
const VIGNETTE_MAX = 0.45;

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  return { c, ctx };
}

/** Tiny deterministic generator, so the void looks the same every time (no Math.random in art either). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The void: flat colour with sparse 1-texel specks, mostly dim, a few brighter. Seamless (specks stay inside). */
function voidTexture(): Texture {
  const { c, ctx } = canvas(TILE, TILE);
  ctx.fillStyle = PALETTE[25];
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = lcg(7);
  // Dim, dim, mid, bright, rare: a long tail, so most specks barely show.
  const tones = [PALETTE[23], PALETTE[23], PALETTE[24], PALETTE[22], PALETTE[21]];
  for (let i = 0; i < SPECKS; i++) {
    const x = Math.floor(rand() * (TILE - 1));
    const y = Math.floor(rand() * (TILE - 1));
    const r = rand();
    ctx.fillStyle = tones[r < 0.5 ? 0 : r < 0.72 ? 2 : r < 0.92 ? 3 : 4] ?? PALETTE[23];
    ctx.fillRect(x, y, 1, 1);
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
  /** On the stage: one opaque picture of the void and the vignette (redrawn only when the camera moves). */
  readonly container = new Container({ eventMode: 'none' });
  private readonly scene = new Container();
  private readonly specks = new TilingSprite({ texture: voidTexture(), width: 1, height: 1 });
  private readonly vignette = new Sprite(vignetteTexture(VIGNETTE_MAX));
  private readonly picture = new Sprite();
  private baked: RenderTexture | null = null;
  private key = '';

  constructor(private readonly renderer: Renderer) {
    this.scene.addChild(this.specks, this.vignette);
    this.container.addChild(this.picture);
    this.specks.tileScale.set(SPECK_SIZE);
  }

  /** Every frame: the specks drift slowly with the camera; the vignette fills the screen. */
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
    this.specks.width = w;
    this.specks.height = h;
    // Whole screen pixels, so the specks never blur.
    this.specks.tilePosition.set(Math.round(-shown.x * PARALLAX * shown.zoom), Math.round(-shown.y * PARALLAX * shown.zoom));
    this.vignette.width = w;
    this.vignette.height = h;
    this.renderer.render({ container: this.scene, target: this.baked, clear: true });
  }

  /** Shown again after being hidden: draw it afresh. */
  refresh(): void {
    this.key = '';
  }
}
