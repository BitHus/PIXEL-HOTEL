// The room's atmosphere (atmosphere step): shadows under items and avatars, the dark warm
// ambient with soft light halos, slow dust near the lights and the puff of a first step. Drawing
// only; the numbers come from atmosphere.ts (pure) and shared/config.ts.
//
// Lighting: the room stays bright and warm; a light is a small soft halo, not a ringed pool.
// A small light map (one texel = LIGHT_PIXEL art px) lies over the room as ONE normal layer: empty
// outside the room, a mild ambient shade on it, and every light takes that shade away with a soft
// round falloff (blend 'erase'). On top, every light adds its own warm colour with the same
// falloff (one sprite per light, blend 'add'), so things near a flame get brighter, not flatter.

import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import {
  AMBIENT_LIGHT,
  COOKING_POT,
  COOKING_POT_LIGHT,
  DUST_PER_LIGHT,
  LIGHT_PIXEL,
  LIGHT_STEP_MS,
  LIGHT_CUT,
  LIGHT_GLOW,
  PALETTE,
  WALK_PUFF_MS,
  borderRects,
  doorRect,
  floorRects,
  footprintRect,
  getFurnitureType,
  roomBoundsRect,
  wallBands,
  type FurnitureItem,
  type Point,
  type Rect,
  type Room,
} from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { dustLightCount, dustSpeck, ellipseRows, flickerAt, itemLights, lightFalloff, shadowSize, type RoomLight } from './atmosphere.ts';
import type { RoomView } from './roomView.ts';

/** The shadow leans away from the light (top-left). */
const SHADOW_DX = 2;
const SHADOW_OUTER = 0.16;
const SHADOW_INNER = 0.2;
const AVATAR_SHADOW = { rx: 10, ry: 4 };

/** A two-shade pixel ellipse around (x, y). */
function drawShadow(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  for (const r of ellipseRows(rx, ry)) g.rect(x - r.half, y + r.dy, r.half * 2, 1).fill({ color: DARK_WARM, alpha: SHADOW_OUTER });
  for (const r of ellipseRows(rx - 3, ry - 1)) g.rect(x - r.half, y + r.dy, r.half * 2, 1).fill({ color: DARK_WARM, alpha: SHADOW_INNER });
}

/** The halo picture: white, alpha = lightFalloff from the middle. Made once, tinted per light. */
const HALO_PX = 64;
let haloTexture: Texture | null = null;
function halo(): Texture {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement('canvas');
  canvas.width = HALO_PX;
  canvas.height = HALO_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(HALO_PX, HALO_PX);
  const mid = HALO_PX / 2;
  for (let y = 0; y < HALO_PX; y++) {
    for (let x = 0; x < HALO_PX; x++) {
      const i = (y * HALO_PX + x) * 4;
      const a = lightFalloff(Math.hypot(x + 0.5 - mid, y + 0.5 - mid) / mid);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  haloTexture = Texture.from(canvas);
  haloTexture.source.scaleMode = 'nearest';
  return haloTexture;
}

function makeAvatarShadow(): Graphics {
  const g = new Graphics();
  drawShadow(g, 0, 0, AVATAR_SHADOW.rx, AVATAR_SHADOW.ry);
  return g;
}

interface Puff {
  c: Container;
  age: number;
}

export class RoomAtmosphere {
  private room: Room | null = null;
  private bounds: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private lights: RoomLight[] = [];
  private lightingOn = true;

  // Shadows.
  private readonly itemShadows = new Graphics();
  private readonly avatarShadows: Graphics[] = [];
  private avatarCount = 0;
  private readonly puffs: Puff[] = [];

  // The light map.
  private readonly scene = new Container();
  private readonly base = new Graphics();
  /** Halo sprites that take the ambient shade away around lights (blend 'erase'). */
  private readonly cut = new Container();
  /** Halo sprites that add the lights' colour to the room (blend 'add'), above the light map. */
  private readonly glow = new Container();
  private map: RenderTexture | null = null;
  private readonly mapSprite = new Sprite();
  private lastStep = -1;
  private dirty = true;

  // Dust.
  private readonly specks: Sprite[] = [];

  constructor(
    private readonly view: RoomView,
    private readonly renderer: Renderer,
  ) {
    view.shadowLayer.addChild(this.itemShadows);
    this.scene.addChild(this.base, this.cut);
    this.mapSprite.scale.set(LIGHT_PIXEL);
    view.lightLayer.addChild(this.mapSprite, this.glow);
  }

  /** Slow phones: no ambient, no pools, no dust (shadows stay: they cost nothing). */
  setLighting(on: boolean): void {
    this.lightingOn = on;
    this.view.lightLayer.visible = on;
    this.view.airLayer.visible = on;
    this.dirty = true;
  }

  setRoom(room: Room): void {
    this.room = room;
    this.bounds = roomBoundsRect(room);
    const w = Math.ceil(this.bounds.w / LIGHT_PIXEL);
    const h = Math.ceil(this.bounds.h / LIGHT_PIXEL);
    this.map?.destroy(true);
    this.map = RenderTexture.create({ width: w, height: h, resolution: 1, antialias: false, scaleMode: 'nearest' });
    this.mapSprite.texture = this.map;
    this.mapSprite.position.set(this.bounds.x, this.bounds.y);
    this.scene.scale.set(1 / LIGHT_PIXEL);
    this.scene.position.set(-this.bounds.x / LIGHT_PIXEL, -this.bounds.y / LIGHT_PIXEL);

    // Nothing outside the room; the ambient shade on it.
    const b = this.base.clear();
    const amb = AMBIENT_LIGHT[room.kind];
    for (const r of [...floorRects(room), doorRect(room), ...wallBands(room), ...borderRects(room)]) {
      if (r.w > 0 && r.h > 0) b.rect(r.x, r.y, r.w, r.h).fill({ color: PALETTE[amb.color] ?? '#000000', alpha: amb.strength });
    }
    for (const p of this.puffs.splice(0)) p.c.destroy({ children: true });
    this.dirty = true;
  }

  /** The placed items changed: new shadows and new light sources. */
  setItems(items: readonly FurnitureItem[], hidden: ReadonlySet<number> = new Set()): void {
    const room = this.room;
    if (!room) return;
    const g = this.itemShadows.clear();
    for (const item of items) {
      if (item.roomId !== room.id || hidden.has(item.uid) || item.onItemUid !== null) continue;
      const type = getFurnitureType(item.typeId);
      if (!type.blocks || type.wall) continue;
      const f = footprintRect(item, type);
      const s = shadowSize(f.w, f.h);
      drawShadow(g, Math.round(item.x) + SHADOW_DX, Math.round(item.y), s.rx, s.ry);
    }
    this.lights = itemLights(items, room.id, getFurnitureType, hidden);
    if (room.kind === 'farm') {
      const s = shadowSize(COOKING_POT.w, COOKING_POT.d);
      drawShadow(g, COOKING_POT.x + SHADOW_DX, COOKING_POT.y, s.rx, s.ry);
      this.lights.push({ x: COOKING_POT.x, y: COOKING_POT.y - COOKING_POT.d / 2, light: COOKING_POT_LIGHT, seed: -77 });
    }
    this.syncSpecks();
    this.dirty = true;
  }

  /** A small dust puff at the feet (the avatar starts walking). */
  puff(at: Point): void {
    const c = new Container();
    for (const dx of [-5, 0, 5]) {
      const s = new Sprite(Texture.WHITE);
      s.tint = PALETTE[2];
      s.width = 2;
      s.height = 2;
      s.position.set(dx, -2);
      c.addChild(s);
    }
    c.position.set(Math.round(at.x), Math.round(at.y));
    this.view.shadowLayer.addChild(c);
    this.puffs.push({ c, age: 0 });
  }

  /** Every frame. `feet`: the standing and walking avatars (their shadows). */
  update(dtMs: number, timeMs: number, feet: readonly Point[]): void {
    // Avatar shadows: one small sprite each, reused.
    for (let i = 0; i < feet.length; i++) {
      let s = this.avatarShadows[i];
      if (!s) {
        s = makeAvatarShadow();
        this.avatarShadows.push(s);
        this.view.shadowLayer.addChild(s);
      }
      const p = feet[i]!;
      s.visible = true;
      s.position.set(Math.round(p.x) + 1, Math.round(p.y));
    }
    for (let i = feet.length; i < this.avatarCount; i++) this.avatarShadows[i]!.visible = false;
    this.avatarCount = feet.length;

    // Puffs: three specks drift apart, up a little, and fade in steps.
    for (const p of this.puffs) {
      p.age += dtMs;
      const k = Math.min(1, p.age / WALK_PUFF_MS);
      p.c.children.forEach((s, i) => s.position.set((i - 1) * Math.round(5 + 4 * k), -2 - Math.round(4 * k)));
      p.c.alpha = k < 0.5 ? 0.7 : 0.35;
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]!;
      if (p.age < WALK_PUFF_MS) continue;
      p.c.destroy({ children: true });
      this.puffs.splice(i, 1);
    }

    if (!this.lightingOn || !this.map) return;
    this.lights.slice(0, dustLightCount(this.lights.length)).forEach((light, li) => {
      for (let i = 0; i < DUST_PER_LIGHT; i++) {
        const s = this.specks[li * DUST_PER_LIGHT + i];
        if (!s) continue;
        const d = dustSpeck(light, i, timeMs);
        s.position.set(d.x, d.y);
        s.alpha = d.bright ? 0.55 : 0.25;
      }
    });

    // The light map: only redrawn when the flicker steps or something changed.
    const step = Math.floor(timeMs / LIGHT_STEP_MS);
    if (step === this.lastStep && !this.dirty) return;
    this.lastStep = step;
    this.dirty = false;
    this.lights.forEach((l, i) => {
      const f = flickerAt(l.seed, timeMs, l.light.flicker);
      const size = Math.round(l.light.radius * f.radius) * 2;
      const cut = this.haloAt(this.cut, i, 'erase');
      cut.position.set(l.x, l.y);
      cut.width = cut.height = size;
      cut.alpha = LIGHT_CUT;
      const g = this.haloAt(this.glow, i, 'add');
      g.position.set(l.x, l.y);
      g.width = g.height = size;
      g.tint = PALETTE[l.light.color] ?? '#ffffff';
      g.alpha = LIGHT_GLOW * f.brightness;
    });
    for (const layer of [this.cut, this.glow]) layer.children.forEach((c, i) => (c.visible = i < this.lights.length));
    this.renderer.render({ container: this.scene, target: this.map, clear: true, clearColor: [0, 0, 0, 0] });
  }

  /** The i-th halo sprite of a layer (made when needed, reused). */
  private haloAt(layer: Container, i: number, blend: 'erase' | 'add'): Sprite {
    const have = layer.children[i] as Sprite | undefined;
    if (have) return have;
    const s = new Sprite(halo());
    s.anchor.set(0.5);
    s.blendMode = blend;
    layer.addChild(s);
    return s;
  }

  private syncSpecks(): void {
    const want = dustLightCount(this.lights.length) * DUST_PER_LIGHT;
    while (this.specks.length < want) {
      const s = new Sprite(Texture.WHITE);
      s.tint = PALETTE[2];
      s.width = 1;
      s.height = 1;
      this.view.airLayer.addChild(s);
      this.specks.push(s);
    }
    this.specks.forEach((s, i) => (s.visible = i < want));
  }
}
