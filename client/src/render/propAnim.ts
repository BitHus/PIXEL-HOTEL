// Prop animation (docs/PLAN-ANIMATION.md): flames, smoke, steam, embers, bubbles, motes, tap drips, jewel glints and the register's drawer.
// Everything is BUILT ONCE: flame/glint/drawer textures are drawn to a canvas on first use and shared; per frame we only swap a sprite's texture
// or move a pooled white square. No Graphics redraw. Flames are children of the item's own container (so depth order and hiding follow the item);
// particles live in one pooled sprite layer in the marker layer. Whole world px only. The numbers and timing are in propAnimSpecs.ts (pure).
// Reduce effects: no particles, drips or motes, flames still loop. OS prefers-reduced-motion: flames hold still too.

import { Container, Sprite, Texture } from 'pixi.js';
import { PALETTE, getFurnitureType, isOn, type Facing, type FurnitureItem, type Point } from '@pixel-hotel/shared';
import { ParticlePool, type ParticleKind } from '../fx/particles.ts';
import { boxesForFacing } from './furnitureArt.ts';
import { spriteFrames } from './spriteStore.ts';
import type { FurnitureSprite } from './furnitureSprite.ts';
import type { RoomView } from './roomView.ts';
import {
  DING_MS, DING_REACH_PX, FLAME_FRAME_COUNT, FLAME_LETTER, FLAME_SIZE, GHOST_LETTER, MEAL_STEAM_MAX, MEAL_STEAM_MS, PROP_ANIMS,
  boxAnchor, dripAt, drawerHeightAt, flameFrame, flameRows, glintFrameAt, motionLevel, particleAlpha, pngToRel, spawnFor, swayPx, twinkleFrame,
  type At, type EmitKind, type EmitSpec, type FlameKind, type MotionLevel,
} from './propAnimSpecs.ts';

const hex = (i: number): string => PALETTE[i] ?? '#ffffff';
const hexInt = (i: number): number => parseInt(hex(i).slice(1), 16);
const POOL_CAP = 96;

/** A bitmap of letters -> a nearest-neighbour texture, made once. */
function bitmapTexture(rows: readonly string[], letters: Record<string, number>): Texture {
  const h = rows.length;
  const w = rows[0]!.length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = letters[rows[y]![x]!];
      if (p === undefined) continue;
      ctx.fillStyle = hex(p);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

const flameCache = new Map<FlameKind, Texture[]>();
function flameTextures(kind: FlameKind): Texture[] {
  let t = flameCache.get(kind);
  if (!t) {
    const letters = kind === 'ghost' ? GHOST_LETTER : FLAME_LETTER;
    t = Array.from({ length: FLAME_FRAME_COUNT }, (_, f) => bitmapTexture(flameRows(kind, f), letters));
    flameCache.set(kind, t);
  }
  return t;
}

const GLINT_ROWS = [
  ['.....', '.....', '..W..', '.....', '.....'],
  ['.....', '..y..', '.yWy.', '..y..', '.....'],
  ['..y..', '..W..', 'yWWWy', '..W..', '..y..'],
  ['.....', '..y..', '.yWy.', '..y..', '.....'],
  ['.....', '.....', '..W..', '.....', '.....'],
];
let glintTex: Texture[] | null = null;
const glintTextures = (): Texture[] => (glintTex ??= GLINT_ROWS.map((r) => bitmapTexture(r, { W: 19, y: 11 })));

/** The register drawer at 1 to 5 px high: coins on top once it is 4 px or more, a wood front, a dark lip. Index = height. */
let drawerTex: Texture[] | null = null;
function drawerTextures(): Texture[] {
  if (drawerTex) return drawerTex;
  const out: Texture[] = [Texture.EMPTY];
  for (let h = 1; h <= 5; h++) {
    const rows: string[] = [];
    if (h >= 4) rows.push('o' + Array.from({ length: 18 }, (_, x) => (x % 3 === 2 ? 'b' : 'a')).join('') + 'o');
    const wood = h - 1 - rows.length;
    for (let i = 0; i < wood; i++) rows.push('o' + (i === 0 ? 'l'.repeat(18) : 'k'.repeat(18)) + 'o');
    if (wood > 0 && h >= 3) rows[rows.length - 1] = 'o' + 'k'.repeat(8) + 'hhhh' + 'k'.repeat(6) + 'o';
    rows.push('o'.repeat(20));
    out.push(bitmapTexture(rows, { o: 6, k: 4, l: 3, a: 10, b: 11, h: 2 }));
  }
  return (drawerTex = out);
}

const TO_POOL: Record<EmitKind, ParticleKind> = { smoke: 'dust', steam: 'leaf', ember: 'spark', spark: 'debris', bubble: 'goo', mote: 'feather' };
const FROM_POOL: Partial<Record<ParticleKind, EmitKind>> = { dust: 'smoke', leaf: 'steam', spark: 'ember', debris: 'spark', goo: 'bubble', feather: 'mote' };

interface FlameRun { sprite: Sprite; frames: Texture[]; kind: FlameKind; flicker: number; seed: number; frame: number }
interface EmitRun { spec: EmitSpec; pos: Point; accum: number; next: number }
interface DripRun { sprite: Sprite; pos: Point; seed: number }
interface GlintRun { sprite: Sprite; pos: Point; seed: number; period: number }
interface RegRun { drawer: Sprite; glint: Sprite; t: number }

interface Entry {
  uid: number;
  container: Container;
  deco: Container;
  key: string;
  mirror: number;
  on: boolean;
  flames: FlameRun[];
  emits: EmitRun[];
  drips: DripRun[];
  glints: GlintRun[];
  reg: RegRun | null;
}

export interface MealSpot { x: number; y: number; hot: boolean }

export class PropAnim {
  private readonly entries = new Map<number, Entry>();
  private readonly layer = new Container({ eventMode: 'none' });
  private readonly pool = new ParticlePool(POOL_CAP);
  private readonly dots: Sprite[] = [];
  private meals: MealSpot[] = [];
  private mealAccum: number[] = [];
  private readonly mq: MediaQueryList | null = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  constructor(view: RoomView, private readonly reduce: () => boolean) {
    view.markerLayer.addChild(this.layer);
    for (let i = 0; i < POOL_CAP; i++) {
      const s = new Sprite(Texture.WHITE);
      s.visible = false;
      this.dots.push(s);
      this.layer.addChild(s);
    }
  }

  private level(): MotionLevel {
    return motionLevel(this.reduce(), this.mq?.matches ?? false);
  }

  /** Call after FurnitureSprite.set: builds (or rebuilds when the type or facing changed) the item's animated parts. */
  attach(fs: FurnitureSprite, item: FurnitureItem, pngTex: Texture | null): void {
    const spec = PROP_ANIMS[item.typeId];
    if (!spec) return;
    const key = `${item.typeId}|${item.facing}|${pngTex ? 1 : 0}`;
    let e = this.entries.get(item.uid);
    if (e && e.key !== key) {
      e.deco.destroy({ children: true });
      this.entries.delete(item.uid);
      e = undefined;
    }
    if (!e) e = this.build(fs, item, pngTex, key);
    e.on = isOn(item);
  }

  private build(fs: FurnitureSprite, item: FurnitureItem, pngTex: Texture | null, key: string): Entry {
    const type = getFurnitureType(item.typeId);
    const spec = PROP_ANIMS[item.typeId]!;
    const boxes = boxesForFacing(type, item.facing as Facing).boxes;
    const resolve = (at: At): Point => {
      if (pngTex && at.png) return pngToRel(at.png[0], at.png[1], pngTex.width, pngTex.height);
      if (Array.isArray(at.code)) return { x: at.code[0]!, y: at.code[1]! };
      return boxAnchor(boxes, at.code as 'top' | { z: number }) ?? { x: 0, y: -type.height };
    };
    const deco = new Container({ eventMode: 'none' });
    const mirror = item.facing === 'left' ? -1 : 1;
    deco.scale.x = mirror;
    fs.container.addChild(deco);
    const e: Entry = { uid: item.uid, container: fs.container, deco, key, mirror, on: true, flames: [], emits: [], drips: [], glints: [], reg: null };
    (spec.flames ?? []).forEach((f, i) => {
      const p = resolve(f.at);
      const size = FLAME_SIZE[f.kind];
      const strip = f.strip ? spriteFrames('furniture', item.typeId, f.strip.tag, f.strip.frameW) : null;
      const frames = strip ?? flameTextures(f.kind);
      const sprite = new Sprite(frames[0]!);
      sprite.eventMode = 'none';
      sprite.position.set(p.x - Math.floor(size.w / 2), p.y - size.h);
      deco.addChild(sprite);
      e.flames.push({ sprite, frames, kind: f.kind, flicker: f.flicker ?? type.light?.flicker ?? 0.5, seed: i === 0 ? item.uid : item.uid * 7 + i, frame: 0 });
    });
    for (const m of spec.emits ?? []) e.emits.push({ spec: m, pos: resolve(m.at), accum: Math.random() * m.everyMs, next: m.everyMs });
    (spec.drips ?? []).forEach((at, i) => {
      const sprite = new Sprite(Texture.WHITE);
      sprite.tint = hexInt(10);
      sprite.visible = false;
      deco.addChild(sprite);
      e.drips.push({ sprite, pos: resolve(at), seed: item.uid * 5 + i });
    });
    (spec.glints ?? []).forEach((g, i) => {
      const sprite = new Sprite(glintTextures()[0]!);
      sprite.visible = false;
      deco.addChild(sprite);
      e.glints.push({ sprite, pos: resolve(g.at), seed: item.uid * 3 + i, period: g.periodMs });
    });
    if (spec.register) {
      const drawer = new Sprite(Texture.EMPTY);
      drawer.position.set(-10, -3);
      const glint = new Sprite(glintTextures()[0]!);
      glint.position.set(3, -32);
      glint.visible = false;
      deco.addChild(drawer, glint);
      e.reg = { drawer, glint, t: -1 };
    }
    this.entries.set(item.uid, e);
    return e;
  }

  detach(uid: number): void {
    this.entries.delete(uid);
  }

  clear(): void {
    this.entries.clear();
    this.pool.clear();
    this.meals = [];
  }

  /** The table spots that hold a full dish or drink (steam rises from them). */
  setMealSpots(spots: readonly MealSpot[]): void {
    this.meals = spots.slice(0, MEAL_STEAM_MAX);
    if (this.mealAccum.length !== this.meals.length) this.mealAccum = this.meals.map(() => Math.random() * 600);
  }

  /** Coins landed at `at` (a tavernFx sparkle): the nearest register pops its drawer and glints. Plays even with Reduce effects (it is feedback). */
  ding(at: Point): void {
    let best: Entry | null = null;
    let bestD = DING_REACH_PX;
    for (const e of this.entries.values()) {
      if (!e.reg) continue;
      const d = Math.hypot(e.container.x - at.x, e.container.y - 8 - at.y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best?.reg) best.reg.t = 0;
  }

  update(dtMs: number, clockMs: number): void {
    const level = this.level();
    for (const e of this.entries.values()) {
      if (!e.container.visible) continue;
      for (const f of e.flames) {
        f.sprite.visible = e.on;
        if (!e.on) continue;
        const n = flameFrame(f.seed, clockMs, f.flicker, level === 2) % f.frames.length;
        if (n !== f.frame) {
          f.frame = n;
          f.sprite.texture = f.frames[n]!;
        }
      }
      for (const g of e.glints) {
        const fr = level === 2 ? -1 : twinkleFrame(g.seed, clockMs, g.period);
        g.sprite.visible = fr >= 0;
        if (fr >= 0) {
          g.sprite.texture = glintTextures()[fr]!;
          g.sprite.position.set(g.pos.x - 2, g.pos.y - 2);
        }
      }
      if (e.reg && e.reg.t >= 0) {
        e.reg.t += dtMs;
        const h = level === 2 ? (e.reg.t < 400 ? 5 : 0) : drawerHeightAt(e.reg.t);
        e.reg.drawer.texture = drawerTextures()[h]!;
        const gf = level === 2 ? -1 : glintFrameAt(e.reg.t);
        e.reg.glint.visible = gf >= 0;
        if (gf >= 0) e.reg.glint.texture = glintTextures()[gf]!;
        if (e.reg.t >= DING_MS) e.reg.t = -1;
      }
      if (level > 0) {
        for (const d of e.drips) d.sprite.visible = false;
        continue;
      }
      for (const d of e.drips) {
        const dr = dripAt(d.seed, clockMs, 3400);
        d.sprite.visible = dr.state !== 'none' && e.on;
        if (dr.state === 'splash') {
          d.sprite.position.set(d.pos.x - 1, d.pos.y + dr.dy);
          d.sprite.width = 3;
          d.sprite.height = 1;
        } else if (dr.state !== 'none') {
          d.sprite.position.set(d.pos.x, d.pos.y + dr.dy);
          d.sprite.width = 1;
          d.sprite.height = dr.size;
        }
      }
      if (!e.on) continue;
      for (const m of e.emits) {
        m.accum += dtMs;
        if (m.accum < m.next) continue;
        m.accum -= m.next;
        m.next = m.spec.everyMs * (0.7 + 0.6 * Math.random());
        const s = spawnFor(m.spec.kind, Math.random);
        const area = m.spec.area;
        const ox = area ? (Math.random() - 0.5) * area[0] : 0;
        const oy = area ? (Math.random() - 0.5) * area[1] : 0;
        this.pool.spawn(TO_POOL[m.spec.kind], e.container.x + e.mirror * (m.pos.x + s.dx + ox), e.container.y + m.pos.y + s.dy + oy, s.vx, s.vy, s.lifeMs, s.size, hexInt(s.color));
      }
    }
    if (level === 0) this.steamMeals(dtMs);
    else this.pool.clear();
    this.pool.update(dtMs);
    this.draw();
  }

  private steamMeals(dtMs: number): void {
    this.meals.forEach((m, i) => {
      const every = m.hot ? MEAL_STEAM_MS.hot : MEAL_STEAM_MS.warm;
      this.mealAccum[i] = (this.mealAccum[i] ?? 0) + dtMs;
      if (this.mealAccum[i]! < every) return;
      this.mealAccum[i]! -= every;
      const s = spawnFor('steam', Math.random);
      this.pool.spawn('leaf', m.x + s.dx, m.y - 1, s.vx, s.vy * (m.hot ? 1 : 0.7), s.lifeMs * (m.hot ? 1 : 0.7), m.hot ? 2 : 1, hexInt(s.color));
    });
  }

  private draw(): void {
    let i = 0;
    this.pool.forEach((q) => {
      const s = this.dots[i++];
      if (!s) return;
      const kind = FROM_POOL[q.kind] ?? 'smoke';
      const t = q.ageMs / q.lifeMs;
      s.visible = true;
      s.position.set(Math.round(q.x) + swayPx(kind, q.ageMs, q.lifeMs), Math.round(q.y));
      s.width = s.height = q.size;
      s.tint = q.color;
      s.alpha = particleAlpha(kind, t);
    });
    for (let j = i; j < this.dots.length; j++) {
      if (!this.dots[j]!.visible) break;
      this.dots[j]!.visible = false;
    }
  }
}
