// The hands-on pour at the taps (G2): drawn IN THE WORLD at the tap stand, no HTML. Three phases: WAIT (an empty mug and the gauge stand on the bar,
// the stand glows softly: "press the tap"), POUR (the lever is pulled down, an amber stream falls into the mug, the liquid level rises in the drink's
// colour, a white foam head grows and rises past the rim beyond the green mark, a warm glow on the spout, the mug trembles when it overflows), DONE
// (the lever springs back, the mug shakes once, then it fades). The gauge next to the mug has a clear green window (POUR_PERFECT_RANGE) and a marker.
// Everything is whole-pixel boxes from the palette (Graphics), cheap per frame: one clear + about 30 rects. Rendering only, no rules. Reduce effects:
// no glow pulse, no tremble, no shake (the level, the stream and the gauge stay: they are information).
// Art wanted from the artist (optional): tap lever frames (rest / half / pulled) and mug fill frames; this draws boxes until they exist.

import { Graphics, Sprite, type Texture } from 'pixi.js';
import { POUR_MAX_FILL, POUR_PERFECT_RANGE, PALETTE, getDrinkType, getFurnitureType, type DrinkId, type FurnitureItem, type MaterialId } from '@pixel-hotel/shared';
import { easeOutBack, easeOutQuad, clamp01 } from '../fx/ease.ts';
import { shakeOffset } from '../fx/shake.ts';
import { itemDepthKey } from './depthOrder.ts';
import { surfaceHeight } from './furnitureArt.ts';
import { DARK_WARM } from './bareStyles.ts';
import type { RoomView } from './roomView.ts';
import { spriteFrames } from './spriteStore.ts';

// Local coordinates: origin = the stand's foot on the bar top, y up is negative.
const MUG = { x0: -5, x1: 5, top: -11, bottom: 2 }; // outer box (10 x 13)
const IN = { x0: -4, x1: 4, top: -10, bottom: 1 }; // inside (8 x 11)
const GAUGE = { x0: 10, x1: 15, top: -31, bottom: 2 }; // outer box of the gauge (5 x 33)
const SPOUT = { x: 0, y: -18 };
const PIVOT = { x: 5, y: -30 };
const LEVER_LEN = 8;
const PULL_MS = 140;
const SPRING_MS = 260;
const DONE_MS = 520;
const SHAKE_MS = 260;

// Art strips (animator A1, optional, the code boxes stay the fallback): furniture/tap_stand_lever.png (3 frames 14 x 16, pivot cap centre at frame px (3, 9)),
// tap_stand_mug.png and tap_stand_mugfill.png (4 frames 16 x 21: empty, 1/3, 2/3, full; the fill one is tinted with the drink colour).
const LEVER_FRAME = { w: 14, pivotX: 3, pivotY: 9 };
const MUG_FRAME = { w: 16, x: -6, y: -17 };
/** Where the rest lever sprite's top-left sits from the stand's foot on the bar (= PIVOT minus the frame pivot). */
const REST_LEVER = { x: 2, y: -39 };

/** Lever frame for the pull amount (0 rest .. 1 pulled): rest below 0.34, half below 0.8, else pulled (pure). */
export const leverFrame = (t: number): number => (t < 0.34 ? 0 : t < 0.8 ? 1 : 2);
/** Mug fill frame for a fill (1 = full): empty, 1/3, 2/3, full (pure). */
export const mugFillFrame = (fill: number, frames = 4): number => Math.max(0, Math.min(frames - 1, Math.round(Math.max(0, Math.min(1, fill)) * (frames - 1))));

interface ArtLayer {
  fill: Sprite;
  mug: Sprite;
  front: Graphics;
  lever: Sprite;
  fillTex: Texture[];
  mugTex: Texture[];
  leverTex: Texture[];
}

const FOAM = PALETTE[2];
const FOAM_LIGHT = PALETTE[19];
const GREEN = PALETTE[12];
const GREEN_DARK = PALETTE[13];
const GLASS = PALETTE[3];
const GOLD = PALETTE[10];
const BUTTER = PALETTE[11];
const AMBER = PALETTE[9];

type Phase = 'wait' | 'pour' | 'done';

const lighter = (css: string): string => (css === PALETTE[10] ? BUTTER : css === PALETTE[9] ? GOLD : css === PALETTE[5] ? PALETTE[4] : css === PALETTE[4] ? PALETTE[3] : css);

export class PourFx {
  private a: {
    g: Graphics;
    art: ArtLayer | null;
    phase: Phase;
    color: string;
    fill: number;
    shownFill: number;
    pullT: number; // 0 rest .. 1 pulled
    springMs: number; // ms since the release (spring-back), -1 = none
    ageMs: number;
    doneMs: number;
    perfect: boolean;
    auto: { until: number } | null;
  } | null = null;
  private seed = 1;

  /** PB-2 hook: the lever at rest (frame 0) on every tap stand, so the static tap_stand.png needs no lever. Key = stand uid. */
  private rest = new Map<number, Sprite>();
  /** The stand the active pour runs at (the art layer draws its own lever, so the rest one hides). */
  private activeUid: number | null = null;

  constructor(private readonly view: RoomView, private readonly reduce: () => boolean = () => false) {}

  /** Draw the lever at rest on each given stand (REST_LEVER from the stand's foot on the bar), drop the ones that left. Call after items sync. */
  syncRest(stands: { stand: FurnitureItem; bar: FurnitureItem | undefined }[]): void {
    const tex = spriteFrames('furniture', 'tap_stand', 'lever', LEVER_FRAME.w)?.[0];
    const seen = new Set<number>();
    for (const { stand, bar } of stands) {
      if (!tex) break;
      seen.add(stand.uid);
      const top = bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0;
      let sprite = this.rest.get(stand.uid);
      if (!sprite) {
        sprite = new Sprite(tex);
        sprite.eventMode = 'none';
        this.rest.set(stand.uid, sprite);
        this.view.objects.add(sprite, bar ? itemDepthKey(stand, bar) : { y: stand.y, x: stand.x, uid: stand.uid });
      }
      sprite.position.set(Math.round(stand.x) + REST_LEVER.x, Math.round(stand.y - top) + REST_LEVER.y);
      sprite.visible = this.activeUid !== stand.uid;
    }
    for (const [uid, sprite] of this.rest) {
      if (seen.has(uid)) continue;
      this.view.objects.remove(sprite);
      sprite.destroy();
      this.rest.delete(uid);
    }
  }

  /** OA-5b hook: per tap slot the state overlay of tap_stand_dry / tap_stand_wet (strips of 2 frames 32 x 48: left tap, right tap), wet tinted with the drink colour. Key = 'uid:slot'. */
  private tapState = new Map<string, Sprite>();

  /** Draws dry (no mug on the tap) or wet (mugs on it) on every slot of each stand; drops the ones that left. Call after items sync with TavernState.taps. */
  syncTapStates(stands: { stand: FurnitureItem; bar: FurnitureItem | undefined }[], taps: readonly { standUid: number; slot: number; drink: string; mugs: number }[]): void {
    const dry = spriteFrames('furniture', 'tap_stand', 'dry', 32);
    const wet = spriteFrames('furniture', 'tap_stand', 'wet', 32);
    const seen = new Set<string>();
    for (const { stand, bar } of stands) {
      if (!dry || !wet) break;
      const top = bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0;
      for (let slot = 0; slot < 2; slot++) {
        const key = `${stand.uid}:${slot}`;
        seen.add(key);
        const tap = taps.find((t) => t.standUid === stand.uid && t.slot === slot);
        const has = tap !== undefined && tap.mugs > 0;
        const tex = (has ? wet : dry)[slot] ?? (has ? wet : dry)[0];
        if (!tex) continue;
        let sprite = this.tapState.get(key);
        if (!sprite) {
          sprite = new Sprite(tex);
          sprite.eventMode = 'none';
          this.tapState.set(key, sprite);
          this.view.objects.add(sprite, bar ? itemDepthKey(stand, bar) : { y: stand.y, x: stand.x, uid: stand.uid });
        }
        sprite.texture = tex;
        sprite.tint = has ? (PALETTE[getDrinkType(tap.drink as DrinkId).color] ?? '#ffffff') : 0xffffff;
        sprite.position.set(Math.round(stand.x) - 16, Math.round(stand.y - top) - 48);
      }
    }
    for (const [key, sprite] of this.tapState) {
      if (seen.has(key)) continue;
      this.view.objects.remove(sprite);
      sprite.destroy();
      this.tapState.delete(key);
    }
  }

  private setActive(uid: number | null): void {
    this.activeUid = uid;
    for (const [id, s] of this.rest) s.visible = id !== uid;
  }

  get active(): boolean {
    return this.a !== null;
  }

  /** The phase now ('wait' | 'pour' | 'done') or null. */
  get phase(): Phase | null {
    return this.a?.phase ?? null;
  }

  private make(stand: FurnitureItem, bar: FurnitureItem | undefined, drink: MaterialId, phase: Phase): void {
    this.stop();
    const g = new Graphics();
    g.eventMode = 'none';
    const top = bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0;
    g.position.set(Math.round(stand.x), Math.round(stand.y - top));
    this.view.objects.add(g, bar ? itemDepthKey(stand, bar) : { y: stand.y, x: stand.x, uid: stand.uid });
    const color = PALETTE[getDrinkType(drink as DrinkId).color] ?? PALETTE[9];
    const art = this.makeArt(g, PALETTE[getDrinkType(drink as DrinkId).color] ?? PALETTE[9]);
    this.setActive(stand.uid);
    this.a = { g, art, phase, color, fill: 0, shownFill: 0, pullT: 0, springMs: -1, ageMs: 0, doneMs: 0, perfect: false, auto: null };
    this.draw();
  }

  /** The sprite layers over the code Graphics when all three strips exist, else null (the code mug and lever are drawn). */
  private makeArt(g: Graphics, color: string): ArtLayer | null {
    const mugTex = spriteFrames('furniture', 'tap_stand', 'mug', MUG_FRAME.w);
    const fillTex = spriteFrames('furniture', 'tap_stand', 'mugfill', MUG_FRAME.w);
    const leverTex = spriteFrames('furniture', 'tap_stand', 'lever', LEVER_FRAME.w);
    if (!mugTex || !fillTex || !leverTex || mugTex.length < 4 || fillTex.length < 4 || leverTex.length < 3) return null;
    const fill = new Sprite(fillTex[0]);
    fill.tint = color;
    const mug = new Sprite(mugTex[0]);
    const front = new Graphics();
    const lever = new Sprite(leverTex[0]);
    lever.position.set(PIVOT.x - LEVER_FRAME.pivotX, PIVOT.y - LEVER_FRAME.pivotY);
    for (const o of [fill, mug, front, lever]) o.eventMode = 'none';
    g.addChild(fill, mug, front, lever);
    return { fill, mug, front, lever, fillTex, mugTex, leverTex };
  }

  /** The avatar waits at the taps: an empty mug and the gauge appear, the stand glows. */
  wait(stand: FurnitureItem, bar: FurnitureItem | undefined, drink: MaterialId): void {
    this.make(stand, bar, drink, 'wait');
  }

  /** The press started: the lever goes down and the stream runs (keeps the same mug when wait() ran for this stand). */
  begin(stand: FurnitureItem, bar: FurnitureItem | undefined, drink: MaterialId): void {
    if (!this.a) this.make(stand, bar, drink, 'pour');
    const a = this.a!;
    a.phase = 'pour';
    a.fill = 0;
    a.shownFill = 0;
    a.springMs = -1;
    a.perfect = false;
  }

  /** The fill of the mug now (0..POUR_MAX_FILL, 1 = full). Smoothed in update(). */
  setFill(fill: number): void {
    if (this.a?.phase === 'pour') this.a.fill = Math.max(0, Math.min(POUR_MAX_FILL, fill));
  }

  /** The press ended: the stream stops, the lever springs back; the mug stays until finish() or stop(). */
  release(): void {
    const a = this.a;
    if (!a || a.phase !== 'pour') return;
    a.phase = 'done';
    a.springMs = 0;
    a.doneMs = 0;
  }

  /** The result arrived: a perfect pour gets the gold flash; the mug shakes once (always) and then fades. */
  finish(perfect: boolean): void {
    const a = this.a;
    if (!a) return;
    if (a.phase === 'pour') this.release();
    a.perfect = perfect;
    a.doneMs = 0;
    this.seed++;
  }

  /** The old automatic pour (event 'pour'): fills over `ms`, then finishes by itself. */
  start(stand: FurnitureItem, bar: FurnitureItem | undefined, drink: MaterialId, ms: number): void {
    this.make(stand, bar, drink, 'pour');
    this.a!.auto = { until: ms };
  }

  stop(): void {
    if (!this.a) return;
    this.view.objects.remove(this.a.g);
    this.a.g.destroy();
    this.a = null;
    this.setActive(null);
  }

  /** Call every frame with the frame time. */
  update(dtMs: number): void {
    const a = this.a;
    if (!a) return;
    a.ageMs += dtMs;
    if (a.auto) {
      a.fill = Math.min(1, a.ageMs / Math.max(1, a.auto.until));
      if (a.ageMs >= a.auto.until) {
        a.auto = null;
        this.release();
      }
    }
    // The level follows the fill with a short ease (a few px at most per frame: no jumps), the lever follows the press.
    a.shownFill += (a.fill - a.shownFill) * (1 - Math.exp(-dtMs / 45));
    if (Math.abs(a.fill - a.shownFill) < 0.004) a.shownFill = a.fill;
    if (a.phase === 'pour') a.pullT = Math.min(1, a.pullT + dtMs / PULL_MS);
    if (a.springMs >= 0) {
      a.springMs += dtMs;
      a.pullT = 1 - easeOutBack(a.springMs / SPRING_MS);
      if (a.springMs >= SPRING_MS) {
        a.pullT = 0;
        a.springMs = -1;
      }
    }
    if (a.phase === 'done') {
      a.doneMs += dtMs;
      if (a.doneMs >= DONE_MS) {
        this.stop();
        return;
      }
    }
    this.draw();
  }

  private draw(): void {
    const a = this.a;
    if (!a) return;
    const g = a.g;
    g.clear();
    const reduce = this.reduce();
    const fill = a.phase === 'pour' ? a.shownFill : a.fill;
    const pouring = a.phase === 'pour';
    // Warm glow on the spout while held (stepped pulse), a slow one while waiting.
    if (!reduce || pouring) {
      const pulse = Math.floor(a.ageMs / (pouring ? 110 : 420)) % 2;
      const aGlow = pouring ? 0.2 + pulse * 0.07 : a.phase === 'wait' ? 0.1 + pulse * 0.1 : 0;
      if (aGlow > 0) {
        g.rect(SPOUT.x - 11, SPOUT.y - 9, 22, 22).fill({ color: AMBER, alpha: aGlow * 0.5 });
        g.rect(SPOUT.x - 7, SPOUT.y - 5, 14, 14).fill({ color: GOLD, alpha: aGlow });
      }
    }
    // The mug shakes: a tremble when it overflows, one shake at the end.
    let sx = 0;
    if (!reduce) {
      if (pouring && fill > POUR_PERFECT_RANGE[1]) sx = Math.floor(a.ageMs / 60) % 2 === 0 ? -1 : 1;
      else if (a.phase === 'done' && a.springMs >= -1 && a.doneMs < SHAKE_MS) sx = shakeOffset(2, a.doneMs, SHAKE_MS, this.seed, 50).x;
    }
    this.drawGauge(g, fill, pouring);
    if (a.art) {
      // Strips: sprites for mug, liquid and lever; the stream and the gauge stay code (information).
      const art = a.art;
      art.front.clear();
      art.mug.position.set(MUG_FRAME.x + sx, MUG_FRAME.y);
      art.fill.position.set(MUG_FRAME.x + sx, MUG_FRAME.y);
      const idx = mugFillFrame(fill);
      art.fill.texture = art.fillTex[idx]!;
      art.mug.texture = art.mugTex[idx]!;
      art.lever.texture = art.leverTex[leverFrame(a.pullT)]!;
      if (pouring && fill < POUR_MAX_FILL) this.drawStream(art.front, a, fill, sx);
      return;
    }
    this.drawMug(g, a, fill, sx);
    if (pouring && fill < POUR_MAX_FILL) this.drawStream(g, a, fill, sx);
    this.drawLever(g, a.pullT);
  }

  private drawGauge(g: Graphics, fill: number, pouring: boolean): void {
    const h = GAUGE.bottom - GAUGE.top - 2; // inner height
    const yOf = (v: number): number => GAUGE.bottom - 1 - Math.round((Math.min(POUR_MAX_FILL, v) / POUR_MAX_FILL) * h);
    g.rect(GAUGE.x0 - 1, GAUGE.top - 1, GAUGE.x1 - GAUGE.x0 + 2, GAUGE.bottom - GAUGE.top + 2).fill(DARK_WARM);
    g.rect(GAUGE.x0, GAUGE.top, GAUGE.x1 - GAUGE.x0, GAUGE.bottom - GAUGE.top).fill(PALETTE[25]);
    const lo = yOf(POUR_PERFECT_RANGE[1]);
    const hi = yOf(POUR_PERFECT_RANGE[0]);
    const inWindow = fill >= POUR_PERFECT_RANGE[0] && fill <= POUR_PERFECT_RANGE[1];
    // The green window: a bright band with a darker frame, it blinks while the marker is inside (release now!).
    g.rect(GAUGE.x0, lo, GAUGE.x1 - GAUGE.x0, hi - lo + 1).fill(pouring && inWindow && Math.floor(this.a!.ageMs / 90) % 2 === 0 ? PALETTE[11] : GREEN);
    g.rect(GAUGE.x0, lo, GAUGE.x1 - GAUGE.x0, 1).fill(GREEN_DARK);
    g.rect(GAUGE.x0, hi, GAUGE.x1 - GAUGE.x0, 1).fill(GREEN_DARK);
    // The level in the gauge (the drink's colour) and the marker tick that sticks out to the left.
    const my = yOf(fill);
    if (fill > 0) g.rect(GAUGE.x0 + 1, my, GAUGE.x1 - GAUGE.x0 - 2, GAUGE.bottom - 1 - my).fill({ color: this.a!.color, alpha: 0.85 });
    g.rect(GAUGE.x0 - 3, my, GAUGE.x1 - GAUGE.x0 + 5, 1).fill(inWindow ? PALETTE[11] : FOAM_LIGHT);
    g.rect(GAUGE.x0 - 3, my - 1, 2, 3).fill(DARK_WARM);
    g.rect(GAUGE.x0 - 2, my, 1, 1).fill(inWindow ? GREEN : FOAM_LIGHT);
  }

  private drawMug(g: Graphics, a: NonNullable<PourFx['a']>, fill: number, sx: number): void {
    const x0 = MUG.x0 + sx;
    const inH = IN.bottom - IN.top; // 11
    const liquidH = Math.round(inH * Math.min(1, fill));
    // Outline, glass and handle.
    g.rect(x0 - 1, MUG.top - 1, MUG.x1 - MUG.x0 + 2, MUG.bottom - MUG.top + 2).fill(DARK_WARM);
    g.rect(x0 + MUG.x1 - MUG.x0, MUG.top + 2, 3, 7).fill(DARK_WARM);
    g.rect(x0 + MUG.x1 - MUG.x0 + 1, MUG.top + 3, 1, 5).fill(PALETTE[4]);
    g.rect(x0, MUG.top, MUG.x1 - MUG.x0, MUG.bottom - MUG.top).fill(GLASS);
    g.rect(IN.x0 + sx, IN.top, IN.x1 - IN.x0, inH).fill(PALETTE[24]);
    // The liquid, a lighter top line, and a glint on the glass.
    if (liquidH > 0) {
      g.rect(IN.x0 + sx, IN.bottom - liquidH, IN.x1 - IN.x0, liquidH).fill(a.color);
      g.rect(IN.x0 + sx, IN.bottom - liquidH, IN.x1 - IN.x0, 1).fill(lighter(a.color));
    }
    g.rect(IN.x0 + sx + 1, IN.top + 1, 1, 3).fill({ color: FOAM_LIGHT, alpha: 0.5 });
    // The foam head grows from about half full and rises above the rim past the green mark; beyond the window it spills down the sides.
    if (fill > 0.55) {
      const grow = easeOutQuad((fill - 0.55) / (1.15 - 0.55));
      const head = Math.round(1 + grow * 4);
      const topY = IN.bottom - liquidH - head;
      const y = Math.max(MUG.top - 5, topY);
      g.rect(IN.x0 + sx, y, IN.x1 - IN.x0, IN.bottom - liquidH - y).fill(FOAM);
      g.rect(IN.x0 + sx, y, IN.x1 - IN.x0, 1).fill(FOAM_LIGHT);
      if (head >= 4) g.rect(IN.x0 + sx - 1, y + 1, 1, 1).fill(FOAM);
    }
    if (fill > POUR_PERFECT_RANGE[1]) {
      const run = Math.min(8, Math.round((fill - POUR_PERFECT_RANGE[1]) * 28));
      g.rect(x0 - 1, MUG.top, 1, run).fill(FOAM);
      g.rect(x0 + MUG.x1 - MUG.x0, MUG.top, 1, Math.round(run * 0.6)).fill(FOAM);
    }
    // A perfect pour: a gold rim flash that fades.
    if (a.perfect && a.phase === 'done') {
      const k = 1 - clamp01(a.doneMs / DONE_MS);
      g.rect(x0 - 1, MUG.top - 6, MUG.x1 - MUG.x0 + 2, 1).fill({ color: BUTTER, alpha: k });
      g.rect(x0 - 2, MUG.top - 5, 1, 7).fill({ color: GOLD, alpha: k });
      g.rect(x0 + MUG.x1 - MUG.x0 + 1, MUG.top - 5, 1, 7).fill({ color: GOLD, alpha: k });
    }
  }

  private drawStream(g: Graphics, a: NonNullable<PourFx['a']>, fill: number, sx: number): void {
    const wob = Math.floor(a.ageMs / 80) % 2; // the column wobbles by a pixel
    const inH = IN.bottom - IN.top;
    const surface = Math.min(IN.top, IN.bottom - Math.round(inH * Math.min(1, fill)) - (fill > 0.55 ? 2 : 0));
    const len = Math.max(1, surface - SPOUT.y);
    g.rect(SPOUT.x - 1 + wob + sx, SPOUT.y, 2, len).fill(a.color);
    g.rect(SPOUT.x - 1 + wob + sx, SPOUT.y, 1, len).fill(lighter(a.color));
    // A few droplets breaking off the column (stepped, deterministic).
    for (let i = 0; i < 3; i++) {
      const t = ((a.ageMs / 260 + i / 3) % 1);
      const dy = SPOUT.y + 2 + Math.round(t * Math.max(0, len - 3));
      g.rect(SPOUT.x - 2 + ((i + wob) % 3) + sx, dy, 1, 1).fill(lighter(a.color));
    }
    // The soft splash where it lands: two foam pixels bouncing at the surface.
    const sp = Math.floor(a.ageMs / 70) % 3;
    g.rect(SPOUT.x - 3 + sp + sx, surface - 1, 1, 1).fill({ color: FOAM_LIGHT, alpha: 0.8 });
    g.rect(SPOUT.x + 2 - sp + sx, surface - 1, 1, 1).fill({ color: FOAM_LIGHT, alpha: 0.8 });
  }

  /** The lever: a short arm from its pivot, pulled down while the tap runs (t 0 = rest, 1 = pulled; the spring-back overshoots a little). */
  private drawLever(g: Graphics, t: number): void {
    const deg = -68 + easeOutQuad(Math.min(1, Math.max(-0.25, t))) * 100; // up and a bit right ... pulled down
    const rad = (deg * Math.PI) / 180;
    const tx = Math.round(PIVOT.x + Math.cos(rad) * LEVER_LEN);
    const ty = Math.round(PIVOT.y + Math.sin(rad) * LEVER_LEN);
    const steps = LEVER_LEN;
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(PIVOT.x + ((tx - PIVOT.x) * i) / steps);
      const y = Math.round(PIVOT.y + ((ty - PIVOT.y) * i) / steps);
      g.rect(x - 1, y - 1, 3, 3).fill(DARK_WARM);
    }
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(PIVOT.x + ((tx - PIVOT.x) * i) / steps);
      const y = Math.round(PIVOT.y + ((ty - PIVOT.y) * i) / steps);
      g.rect(x, y, 1, 1).fill(PALETTE[4]);
    }
    g.rect(tx - 1, ty - 1, 3, 3).fill(GOLD);
    g.rect(tx - 1, ty - 1, 1, 1).fill(BUTTER);
    g.rect(PIVOT.x - 1, PIVOT.y - 1, 3, 3).fill(PALETTE[21]);
  }
}
