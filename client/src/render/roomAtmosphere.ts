// The room's atmosphere (atmosphere step): shadows under items and avatars, the dark warm
// ambient with stepped light pools, slow dust in the pools and the puff of a first step. Drawing
// only; the numbers come from atmosphere.ts (pure) and shared/config.ts.
//
// Lighting: a small light map (one texel = LIGHT_PIXEL art px) starts white outside the room,
// gets the ambient colour on the room, and every light adds stepped rings on top (additive).
// The map is drawn over the room with the 'multiply' blend mode, so pools are hard pixel rings
// (no blur) and lit places keep their true colours.

import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import {
  AMBIENT_LIGHT,
  COOKING_POT,
  COOKING_POT_LIGHT,
  DOOR_LIGHT,
  DUST_PER_LIGHT,
  LIGHT_PIXEL,
  LIGHT_RINGS,
  LIGHT_STEP_MS,
  LIGHT_STRENGTH,
  PALETTE,
  WALK_PUFF_MS,
  borderRects,
  doorRect,
  doorZoneRect,
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
import { ambientColor, dustLightCount, dustSpeck, ellipseRows, flickerAt, itemLights, lightRings, scaleColor, shadowSize, type RoomLight } from './atmosphere.ts';
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
  private readonly glow = new Graphics();
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
    this.glow.blendMode = 'add';
    this.scene.addChild(this.base, this.glow);
    this.mapSprite.blendMode = 'multiply';
    this.mapSprite.scale.set(LIGHT_PIXEL);
    view.lightLayer.addChild(this.mapSprite);
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

    // White (no change) outside the room, the ambient colour on it, then the door's daylight.
    const b = this.base.clear();
    b.rect(this.bounds.x, this.bounds.y, w * LIGHT_PIXEL, h * LIGHT_PIXEL).fill(0xffffff);
    const amb = AMBIENT_LIGHT[room.kind];
    const dark = ambientColor(PALETTE[amb.color] ?? '#000000', amb.strength);
    for (const r of [...floorRects(room), doorRect(room), ...wallBands(room), ...borderRects(room)]) {
      if (r.w > 0 && r.h > 0) b.rect(r.x, r.y, r.w, r.h).fill(dark);
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
    const g = this.glow.clear();
    this.drawDoorLight(g);
    for (const l of this.lights) {
      const f = flickerAt(l.seed, timeMs, l.light.flicker);
      const color = scaleColor(PALETTE[l.light.color] ?? '#ffffff', (LIGHT_STRENGTH * f.brightness) / LIGHT_RINGS);
      for (const r of lightRings(l.light.radius * f.radius, LIGHT_RINGS)) g.circle(l.x, l.y, r).fill(color);
    }
    this.renderer.render({ container: this.scene, target: this.map, clear: true });
  }

  /** Daylight falling in through the door (hotel and shop): stepped, widest and faintest far in. */
  private drawDoorLight(g: Graphics): void {
    const room = this.room;
    if (!room || room.kind === 'farm') return;
    const z = doorZoneRect(room);
    const door = doorRect(room);
    const steps = 4;
    const color = scaleColor(PALETTE[DOOR_LIGHT.color] ?? '#ffffff', DOOR_LIGHT.strength / steps);
    const bottom = z.y + z.h;
    for (let k = 0; k < steps; k++) {
      const depth = Math.round((DOOR_LIGHT.depth * (steps - k)) / steps);
      const grow = (steps - 1 - k) * 12;
      g.rect(z.x - grow, bottom - depth, z.w + grow * 2, depth).fill(color);
      g.rect(door.x, door.y, door.w, door.h).fill(color);
    }
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
