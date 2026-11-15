// Crypt light layer, Pixi part (outdoors rework C14). Two additive Graphics in the world (the lantern pool around the
// player, redrawn every frame; the torch, exit, chest and crown pools, redrawn when the flicker steps) and a
// stepped screen vignette sprite on the stage. Everything is whole-pixel stepped discs. The view asks `active` and
// falls back to the old fog when the layer is off (Reduce effects, or the frame rate guard in light.ts tripped).

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  DUNGEON_LIGHT_PX,
  LIGHT_FLICKER_MS,
  LIGHT_FLICKER_PX,
  LIGHT_PLAYER_ALPHA,
  LIGHT_PLAYER_PX,
  LIGHT_RINGS,
  LIGHT_STEP_PX,
  LIGHT_VIGNETTE_ALPHA,
  LIGHT_VIGNETTE_START,
  LIGHT_VIGNETTE_STEPS,
  PALETTE,
  type Chest,
  type DungeonMap,
  type Enemy,
  type Point,
  type RunPlace,
} from '@pixel-hotel/shared';
import { LightPerf, dynamicLights, flickerRadius, lightRings, staticLights, vignetteAlpha, type LightSource } from './light.ts';

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
};

let vignetteTexture: Texture | null = null;

/** A 64x64 stepped dark ring, stretched to the screen with nearest-neighbour scaling. */
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
      const a = vignetteAlpha(d, LIGHT_VIGNETTE_START, LIGHT_VIGNETTE_STEPS, LIGHT_VIGNETTE_ALPHA);
      const i = (y * VIGNETTE_PX + x) * 4;
      img.data[i] = 24;
      img.data[i + 1] = 20;
      img.data[i + 2] = 37;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  vignetteTexture = Texture.from(canvas);
  vignetteTexture.source.scaleMode = 'nearest';
  return vignetteTexture;
}

export class DungeonLight {
  /** In the world, above the fog. */
  readonly container = new Container();
  /** On the stage, above the world. The screen adds it and sizes it with `layoutVignette`. */
  readonly vignette = new Sprite(makeVignetteTexture());
  private readonly pool = new Graphics();
  private readonly lamps = new Graphics();
  private statics: LightSource[] = [];
  private lampStep = -1;
  readonly perf = new LightPerf();
  /** Set each frame by the screen (Reduce effects). */
  reduce = false;

  constructor() {
    this.pool.blendMode = 'add';
    this.lamps.blendMode = 'add';
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
      this.pool.clear();
      this.lamps.clear();
      this.lampStep = -1;
      return;
    }
    // The lantern: a warm pool that breathes in whole steps.
    const pg = this.pool;
    pg.clear();
    const r = flickerRadius(LIGHT_PLAYER_PX, clockMs, 7, LIGHT_FLICKER_PX, LIGHT_FLICKER_MS, LIGHT_STEP_PX);
    for (const ring of lightRings(Math.min(r, DUNGEON_LIGHT_PX), LIGHT_RINGS, LIGHT_PLAYER_ALPHA, LIGHT_STEP_PX)) {
      pg.circle(Math.round(player.x), Math.round(player.y), ring.r).fill({ color: WARM, alpha: ring.alpha });
    }
    // The other lights only change when the flicker steps (chests open, a king dies: those change the list, so look at it too).
    const step = Math.floor(clockMs / LIGHT_FLICKER_MS);
    if (step === this.lampStep) return;
    this.lampStep = step;
    const lg = this.lamps;
    lg.clear();
    for (const s of [...this.statics, ...dynamicLights(chests, enemies)]) {
      if (!seen(s)) continue;
      const rad = flickerRadius(s.radius, clockMs, s.seed, LIGHT_FLICKER_PX / 2, LIGHT_FLICKER_MS, LIGHT_STEP_PX);
      for (const ring of lightRings(rad, LIGHT_RINGS, s.alpha, LIGHT_STEP_PX)) {
        lg.circle(Math.round(s.x), Math.round(s.y), ring.r).fill({ color: COLORS[s.kind], alpha: ring.alpha });
      }
    }
  }

  /** Stretches the vignette over the screen. */
  layoutVignette(w: number, h: number): void {
    this.vignette.width = w;
    this.vignette.height = h;
  }
}
