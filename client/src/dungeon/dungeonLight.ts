// Crypt light layer, Pixi part (outdoors rework C14, smoothed after the owner saw rings). Soft additive light: one radial-gradient sprite per
// light (the lantern pool around the player and the torch, exit, chest and crown pools), tinted warm and scaled to the flickering radius, plus a
// smooth screen vignette. Smooth gradients, no stepped discs (stepped discs showed as visible rings). The view asks `active` and falls back to the
// old fog when the layer is off (Reduce effects, or the frame rate guard in light.ts tripped).

import { Container, Sprite, Texture } from 'pixi.js';
import {
  DUNGEON_LIGHT_PX,
  LIGHT_FLICKER_MS,
  LIGHT_FLICKER_PX,
  LIGHT_PLAYER_ALPHA,
  LIGHT_PLAYER_PX,
  LIGHT_STEP_PX,
  LIGHT_VIGNETTE_ALPHA,
  LIGHT_VIGNETTE_START,
  PALETTE,
  type Chest,
  type DungeonMap,
  type Enemy,
  type Point,
  type RunPlace,
} from '@pixel-hotel/shared';
import { LightPerf, dynamicLights, flickerRadius, staticLights, type LightSource } from './light.ts';

const WARM = PALETTE[10]!;
const COOL_TORCH = PALETTE[9]!;
const EXIT_GLOW = PALETTE[10]!;
const CROWN = PALETTE[9]!;
const VIGNETTE_PX = 64;

const COLORS: Record<LightSource['kind'], string> = {
  torch: COOL_TORCH,
  lantern: WARM,
  exit: EXIT_GLOW,
  chest: WARM,
  gold_chest: PALETTE[11]!,
  crown: CROWN,
  decor: WARM,
};


const GLOW_PX = 128;
let glowTexture: Texture | null = null;

/** A soft white radial glow (smooth falloff to 0 at the edge), tinted and scaled per light. Linear filtering keeps it smooth. */
function makeGlowTexture(): Texture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = GLOW_PX;
  canvas.height = GLOW_PX;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(GLOW_PX / 2, GLOW_PX / 2, 0, GLOW_PX / 2, GLOW_PX / 2, GLOW_PX / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.78)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GLOW_PX, GLOW_PX);
  glowTexture = Texture.from(canvas);
  glowTexture.source.scaleMode = 'linear';
  return glowTexture;
}

let vignetteTexture: Texture | null = null;

/** A 64x64 smooth dark vignette (transparent in the middle, dark at the corners), stretched to the screen. */
function makeVignetteTexture(): Texture {
  if (vignetteTexture) return vignetteTexture;
  const canvas = document.createElement('canvas');
  canvas.width = VIGNETTE_PX;
  canvas.height = VIGNETTE_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(VIGNETTE_PX, VIGNETTE_PX);
  const half = VIGNETTE_PX / 2;
  for (let y = 0; y < VIGNETTE_PX; y++) {
    for (let x = 0; x < VIGNETTE_PX; x++) {
      const d = Math.hypot((x + 0.5 - half) / half, (y + 0.5 - half) / half) / Math.SQRT2;
      const k = Math.min(1, Math.max(0, (d - LIGHT_VIGNETTE_START) / (1 - LIGHT_VIGNETTE_START)));
      const a = LIGHT_VIGNETTE_ALPHA * k * k * (3 - 2 * k);
      const i = (y * VIGNETTE_PX + x) * 4;
      img.data[i] = 24;
      img.data[i + 1] = 20;
      img.data[i + 2] = 37;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  vignetteTexture = Texture.from(canvas);
  vignetteTexture.source.scaleMode = 'linear';
  return vignetteTexture;
}

/** A tinted additive glow sprite. */
function glowSprite(): Sprite {
  const s = new Sprite(makeGlowTexture());
  s.anchor.set(0.5);
  s.blendMode = 'add';
  s.eventMode = 'none';
  return s;
}

export class DungeonLight {
  /** In the world, above the fog. */
  readonly container = new Container();
  /** On the stage, above the world. The screen adds it and sizes it with `layoutVignette`. */
  readonly vignette = new Sprite(makeVignetteTexture());
  private readonly pool = glowSprite();
  private readonly lamps = new Container();
  private readonly lampSprites: Sprite[] = [];
  private statics: LightSource[] = [];
  private lampStep = -1;
  readonly perf = new LightPerf();
  /** Set each frame by the screen (Reduce effects). */
  reduce = false;

  constructor() {
    this.pool.tint = WARM;
    this.lamps.eventMode = 'none';
    this.container.eventMode = 'none';
    this.container.addChild(this.lamps, this.pool);
    this.vignette.eventMode = 'none';
    this.vignette.visible = false;
  }

  /** True when the layer draws (and the cool fog replaces the black one). */
  get active(): boolean {
    return !this.reduce && !this.perf.failed;
  }

  /** A new floor: its torches, lanterns and exit. */
  setMap(map: DungeonMap, place: RunPlace): void {
    this.statics = staticLights(map, place);
    this.lampStep = -1;
  }

  /** Draws one frame. `seen(x, y)` says whether the block at a world point has been seen. */
  update(player: Point, clockMs: number, chests: readonly Chest[], enemies: readonly Enemy[], seen: (p: Point) => boolean): void {
    const on = this.active;
    this.container.visible = on;
    this.vignette.visible = on;
    if (!on) {
      this.pool.visible = false;
      this.lamps.visible = false;
      this.lampStep = -1;
      return;
    }
    // The lantern: one soft warm pool that breathes with the flicker.
    const pg = this.pool;
    pg.visible = true;
    const r = flickerRadius(LIGHT_PLAYER_PX, clockMs, 7, LIGHT_FLICKER_PX, LIGHT_FLICKER_MS, LIGHT_STEP_PX);
    const rad0 = Math.min(r, DUNGEON_LIGHT_PX);
    pg.position.set(Math.round(player.x), Math.round(player.y));
    pg.width = pg.height = rad0 * 2;
    pg.alpha = Math.min(1, LIGHT_PLAYER_ALPHA * 1.6);
    // The other lights only change when the flicker steps (chests open, a king dies: those change the list, so look at it too).
    const step = Math.floor(clockMs / LIGHT_FLICKER_MS);
    if (step === this.lampStep) return;
    this.lampStep = step;
    const lg = this.lamps;
    lg.visible = true;
    let n = 0;
    for (const s of [...this.statics, ...dynamicLights(chests, enemies)]) {
      if (!seen(s)) continue;
      const rad = flickerRadius(s.radius, clockMs, s.seed, LIGHT_FLICKER_PX / 2, LIGHT_FLICKER_MS, LIGHT_STEP_PX);
      let sp = this.lampSprites[n];
      if (!sp) {
        sp = glowSprite();
        this.lampSprites.push(sp);
        lg.addChild(sp);
      }
      sp.visible = true;
      sp.tint = s.color ?? COLORS[s.kind];
      sp.position.set(Math.round(s.x), Math.round(s.y));
      sp.width = sp.height = rad * 2;
      sp.alpha = Math.min(1, s.alpha * 1.6);
      n++;
    }
    for (let i = n; i < this.lampSprites.length; i++) this.lampSprites[i]!.visible = false;
  }

  /** Stretches the vignette over the screen. */
  layoutVignette(w: number, h: number): void {
    this.vignette.width = w;
    this.vignette.height = h;
  }
}
