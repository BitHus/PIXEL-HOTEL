// The lakeside in a room view (step 9f): draws the lake, the pier, the trees and the bushes, and
// handles the play mode taps (docs/UI-REFERENCE.md "Lakeside"):
// - WOODCUTTING: a tap on a tree walks next to it and swings; every further tap is one swing (the
//   400 ms axe cooldown is the API's: taps during it are ignored). A tree falls after 5 hits and
//   leaves a stump that grows back after 5 minutes of real time.
// - FISHING: a tap on the water walks to the nearest shore or pier spot and casts. The bobber
//   floats, dips with a "!" (tap in time to hook), then the reel (tap fast). Everything is timed by
//   shared/src/fishing.ts through the GameAPI; this file only draws and sends the presses. The reel
//   is a bar with a swimming fish and a catch box (Stardew style): the bar's Hold button (or the
//   track, or Space) holds the box to the right, a tap on the room kicks it; the box falls left by
//   itself. While the line is out every tap on the room is a fishing tap; the bar's ✗ (or Escape) stops.
// The action happens when the avatar arrives (main.ts calls arrived()).

import { Container, Graphics } from 'pixi.js';
import {
  CHOP_REACH_PX,
  LAKE_BUSHES,
  PALETTE,
  RANK_NAMES,
  facingFor,
  getCatchType,
  getMaterialType,
  isWater,
  regrowInMs,
  treeAnchor,
  treeAt,
  treeStand,
  TREE_COUNT,
  TREE_REGROW_MS,
  type CastPlan,
  type Facing,
  type FishInput,
  type FishSession,
  FISH_TICK_MS,
  type GainList,
  type GameAPI,
  type LakesideView,
  type MaterialId,
  type Point,
  type Rank,
  type Room,
} from '@pixel-hotel/shared';
import type { FishBar, ReelView } from '../ui/fishBar.ts';
import type { RoomView } from '../render/roomView.ts';
import { drawBang, drawBobber, drawBush, drawLake, drawPier, drawRipples, drawTree, type TreeLook } from './lakesideArt.ts';

export interface LakesideHooks {
  api: Pick<GameAPI, 'getLakeside' | 'chopTree' | 'castAt' | 'fishStart' | 'fishStep' | 'fishStop'>;
  bar: FishBar;
  toast(text: string): void;
  /** Walks to a world point; false if there is no way. */
  walkTo(p: Point): Promise<boolean>;
  /** Follows a path from the API (castAt). */
  follow(path: Point[]): void;
  /** The own avatar's feet and facing. */
  avatar(): { x: number; y: number; facing: Facing };
  face(f: Facing): void;
  /** The avatar swings (a small reach move). */
  swing(): void;
  /** A floating text at a world point (rank: its colour, and a sparkle for ultra rare and legendary). */
  float(at: Point, text: string, rank: Rank | null, delayMs?: number): void;
  sound(name: 'hit' | 'pop' | 'bell' | 'coin'): void;
  /** What a felled tree or a catch gave: the popups above the head (step BG3b). */
  gains(list: GainList, at?: Point): void;
  /** The bag, the Book and the Map changed. */
  afterChange(): Promise<void>;
}

type Pending = { kind: 'chop'; index: number } | { kind: 'cast'; plan: CastPlan };

/** How long a tree shakes after a hit, ms. */
const SHAKE_MS = 180;
/** How long a felled tree takes to fall, ms. */
const FALL_MS = 420;
/** A sapling shows during the last part of the regrowing. */
const SAPLING_PART = 0.3;
/** After the line comes in the bobber stays this long (a splash), ms. */
const SPLASH_MS = 500;

export class LakesideScreen {
  private lake: LakesideView | null = null;
  private readAt = 0;
  private readonly ground = new Container({ eventMode: 'none' });
  private readonly water = new Graphics();
  private readonly ripples = new Graphics();
  private readonly pier = new Graphics();
  private readonly overlay = new Container({ eventMode: 'none' });
  private readonly line = new Graphics();
  private readonly bobber = new Container();
  private readonly bang = drawBang();
  private bobberArt: Graphics | null = null;
  private trees: { c: Container; art: Graphics | null; look: TreeLook | null; hits: number; shakeMs: number; fallMs: number }[] = [];
  private bushes: Container[] = [];
  private drawnKey = '';
  private lastRipple = -1;
  private pending: Pending | null = null;

  // Fishing.
  private session: FishSession | null = null;
  private target: Point | null = null;
  private stepping = false;
  private acc = 0;
  /** The presses, releases and taps waiting for the next call. */
  private queue: FishInput[] = [];
  private splashMs = 0;
  /** The reel's last two ticks (the bar is drawn between them, so it moves smoothly) and when the last one came. */
  private prevReel: ReelView | null = null;
  private curReel: ReelView | null = null;
  private curAt = 0;
  private lastTimeMs = -1;

  constructor(
    private readonly view: RoomView,
    private readonly hooks: LakesideHooks,
  ) {
    this.ground.addChild(this.water, this.ripples, this.pier);
    this.bobber.addChild(this.bang);
    this.bang.visible = false;
    this.bobber.visible = false;
    this.overlay.addChild(this.line, this.bobber);
  }

  get active(): boolean {
    return this.lake !== null;
  }

  /** True while the line is out (every tap on the room is a fishing tap). */
  get fishing(): boolean {
    return this.session !== null || (this.pending?.kind === 'cast');
  }

  /** The room changed: draw the lakeside when it is one, else take everything away. */
  async enter(room: Room): Promise<void> {
    this.stop();
    this.pending = null;
    if (room.kind !== 'lakeside') {
      this.leave();
      return;
    }
    drawLake(this.water);
    drawPier(this.pier);
    this.view.rugLayer.addChildAt(this.ground, 0);
    this.view.markerLayer.addChild(this.overlay);
    for (let i = 0; i < TREE_COUNT; i++) {
      const c = new Container({ eventMode: 'none' });
      const a = treeAnchor(i);
      c.position.set(a.x, a.y);
      this.view.objects.add(c, { y: a.y, x: a.x, uid: -2_000_000 - i });
      this.trees.push({ c, art: null, look: null, hits: -1, shakeMs: 0, fallMs: 0 });
    }
    LAKE_BUSHES.forEach((b, i) => {
      const c = new Container({ eventMode: 'none' });
      c.position.set(b.x, b.y);
      c.addChild(drawBush(i));
      this.view.objects.add(c, { y: b.y, x: b.x, uid: -2_100_000 - i });
      this.bushes.push(c);
    });
    this.drawnKey = '';
    this.set(await this.hooks.api.getLakeside());
  }

  private leave(): void {
    if (this.lake === null && this.trees.length === 0) return;
    this.lake = null;
    this.ground.removeFromParent();
    this.overlay.removeFromParent();
    for (const t of this.trees) {
      this.view.objects.remove(t.c);
      t.c.destroy({ children: true });
    }
    for (const b of this.bushes) {
      this.view.objects.remove(b);
      b.destroy({ children: true });
    }
    this.trees = [];
    this.bushes = [];
  }

  private set(lake: LakesideView): void {
    this.lake = lake;
    this.readAt = performance.now();
  }

  /** The API's clock now (trees grow back by it). */
  private now(): number {
    return this.lake ? this.lake.at + (performance.now() - this.readAt) : 0;
  }

  /** The look of tree `i` now: a tree, a stump, or a sapling in the last part of its regrowing. */
  private lookOf(i: number): TreeLook {
    const t = this.lake?.trees[i];
    if (!t || t.regrowInMs === null) return 'tree';
    const left = t.regrowInMs - (performance.now() - this.readAt);
    if (left <= 0) return 'tree';
    return left <= TREE_REGROW_MS * SAPLING_PART ? 'sapling' : 'stump';
  }

  private hitsOf(i: number): number {
    return this.lake?.trees[i]?.hits ?? 0;
  }

  /** Stops fishing and forgets a walk (the room changed, the dungeon opened). */
  stop(): void {
    this.pending = null;
    if (this.session) void this.hooks.api.fishStop();
    this.endFishing();
  }

  /** Cancels a walk to a tree or a cast spot (the player tapped something else). */
  cancel(): void {
    if (this.pending?.kind === 'cast' && !this.session) this.endFishing();
    this.pending = null;
  }

  // ---------- Taps ----------
  /** A tap on the room while the line is out: it hooks the fish, or kicks the box to the right. */
  fishTap(): void {
    if (this.session) this.queue.push({ t: 'tap' });
  }

  /** The hold began or ended (the Hold button, the track or Space). */
  fishHold(on: boolean): void {
    if (this.session) this.queue.push({ t: on ? 'press' : 'release' });
  }

  /** The bar's ✗ or Escape: reels the line in without a result. */
  stopFishing(): void {
    if (!this.session && this.pending?.kind !== 'cast') return;
    void this.hooks.api.fishStop();
    this.pending = null;
    this.endFishing();
  }

  /** A play mode tap on the lakeside. True when it was about a tree or the water. */
  tap(p: Point): boolean {
    const lake = this.lake;
    if (!lake) return false;
    this.pending = null;
    const tree = treeAt(p);
    if (tree !== null) {
      this.tapTree(tree);
      return true;
    }
    if (isWater(p)) {
      void this.tapWater(p);
      return true;
    }
    return false;
  }

  private tapTree(i: number): void {
    const t = this.lake?.trees[i];
    if (!t) return;
    const left = t.regrowInMs === null ? null : t.regrowInMs - (performance.now() - this.readAt);
    if (left !== null && left > 0) {
      this.hooks.toast(`This tree grows back in ${Math.max(1, Math.ceil(left / 60_000))} min.`);
      return;
    }
    const me = this.hooks.avatar();
    const a = treeAnchor(i);
    if (Math.hypot(me.x - a.x, me.y - a.y) <= CHOP_REACH_PX) {
      void this.swing(i);
      return;
    }
    void this.hooks.walkTo(treeStand(i)).then((ok) => {
      if (ok) this.pending = { kind: 'chop', index: i };
      else this.hooks.toast('There is no way to that tree.');
    });
  }

  private async tapWater(p: Point): Promise<void> {
    const plan = await this.hooks.api.castAt(p);
    if (!plan) {
      this.hooks.toast('There is no way to the water there.');
      return;
    }
    this.target = plan.bobber;
    this.pending = { kind: 'cast', plan };
    this.hooks.follow(plan.path);
    this.hooks.bar.show(true);
    this.hooks.bar.set('wait', 'common');
  }

  /** The avatar stopped walking: swing at the tree, or cast the line, if that is where it was going. */
  arrived(): void {
    const a = this.pending;
    if (!a) return;
    this.pending = null;
    if (a.kind === 'chop') {
      void this.swing(a.index);
    } else {
      this.hooks.face(facingFor(a.plan.bobber.x - a.plan.spot.x, a.plan.bobber.y - a.plan.spot.y, 'down'));
      void this.hooks.api.fishStart().then((s) => {
        if (!s) {
          this.endFishing();
          return;
        }
        this.session = s;
        this.acc = 0;
        this.queue = [];
        this.prevReel = null;
        this.curReel = null;
        this.lastTimeMs = -1;
        this.splashMs = 0;
        this.hooks.bar.show(true);
        this.hooks.bar.set('wait', s.rank);
        this.hooks.sound('pop');
      });
    }
  }

  // ---------- Woodcutting ----------
  /** Swings once. 'go' = done, hold on; 'stop' = felled or not choppable; 'walk' = it walks to the tree first. */
  private async swing(i: number): Promise<'go' | 'stop' | 'walk'> {
    const r = await this.hooks.api.chopTree(i);
    if (!r) {
      // Not next to the tree after all: walk there.
      const ok = await this.hooks.walkTo(treeStand(i));
      if (ok) this.pending = { kind: 'chop', index: i };
      return ok ? 'walk' : 'stop';
    }
    this.set(r.lakeside);
    if (r.gains.length > 0) this.hooks.gains(r.gains, treeAnchor(i));
    if (r.kind === 'cooldown') return 'go';
    if (r.kind === 'regrowing') {
      this.hooks.toast('This tree grows back later.');
      return 'stop';
    }
    const a = treeAnchor(i);
    const me = this.hooks.avatar();
    this.hooks.face(facingFor(a.x - me.x, a.y - 12 - me.y, me.facing));
    this.hooks.swing();
    this.hooks.sound('hit');
    const tree = this.trees[i];
    if (tree) tree.shakeMs = SHAKE_MS;
    if (r.kind === 'felled' && tree) {
      tree.fallMs = FALL_MS;
      let k = 0;
      for (const [id, qty] of Object.entries(r.loot ?? {}) as [MaterialId, number][]) {
        const m = getMaterialType(id);
        this.hooks.float({ x: a.x, y: a.y - 40 }, `+${qty} ${m.name}`, m.rank === 'common' ? null : m.rank, 180 * k++);
        if (m.rank !== 'common') this.hooks.toast(`${m.name}! (${RANK_NAMES[m.rank]})`);
      }
      await this.hooks.afterChange();
    }
    return r.kind === 'felled' ? 'stop' : 'go';
  }

  /** Hold to repeat (BG5b): the standing tree under a point, or null (a tree that grows back is not held). */
  treeUnder(p: Point): number | null {
    if (!this.lake || this.session || this.pending?.kind === 'cast') return null;
    const i = treeAt(p);
    if (i === null) return null;
    const t = this.lake.trees[i];
    if (!t) return null;
    const left = t.regrowInMs === null ? null : t.regrowInMs - (performance.now() - this.readAt);
    return left !== null && left > 0 ? null : i;
  }

  /** One held swing at a tree: swings when next to it, else walks there (the hold goes on after arriving). */
  async holdSwing(i: number): Promise<'go' | 'stop' | 'walk'> {
    const me = this.hooks.avatar();
    const a = treeAnchor(i);
    if (Math.hypot(me.x - a.x, me.y - a.y) <= CHOP_REACH_PX) return this.swing(i);
    const ok = await this.hooks.walkTo(treeStand(i));
    if (!ok) {
      this.hooks.toast('There is no way to that tree.');
      return 'stop';
    }
    this.pending = { kind: 'chop', index: i };
    return 'walk';
  }

  // ---------- Fishing ----------
  private endFishing(): void {
    this.session = null;
    this.target = null;
    this.stepping = false;
    this.acc = 0;
    this.queue = [];
    this.prevReel = null;
    this.curReel = null;
    this.hooks.bar.show(false);
    this.bang.visible = false;
    this.splashMs = this.bobber.visible ? SPLASH_MS : 0;
    if (this.splashMs === 0) this.bobber.visible = false;
    this.line.clear();
  }

  private applySession(s: FishSession, caught: { id: string; rank: Rank; cm: number | null; record: boolean } | null): void {
    this.session = s.phase === 'done' ? null : s;
    // The reel: remember this tick and the one before, the bar is drawn between them every frame.
    if (s.phase === 'reel' && s.timeMs !== this.lastTimeMs) {
      this.lastTimeMs = s.timeMs;
      this.prevReel = this.curReel ?? { fishPos: s.fishPos, boxPos: s.boxPos, boxSize: s.boxSize, fill: s.fill };
      this.curReel = { fishPos: s.fishPos, boxPos: s.boxPos, boxSize: s.boxSize, fill: s.fill };
      this.curAt = performance.now();
    }
    this.hooks.bar.set(s.phase, s.rank, s.phase === 'reel' ? this.reelNow() : undefined);
    for (const e of s.events) {
      if (e.t === 'bite') this.hooks.sound('bell');
      else if (e.t === 'hooked') this.hooks.sound('pop');
      else if (e.t === 'escaped') this.hooks.toast('It got away!');
      else if (e.t === 'missed') this.hooks.toast('Too slow, it got away.');
    }
    if (s.phase !== 'done') return;
    if (caught && this.target) {
      const type = getCatchType(caught.id);
      const size = caught.cm !== null ? ` ${caught.cm} cm` : '';
      this.hooks.float({ x: this.target.x, y: this.target.y - 14 }, `${type.name}${size}`, caught.rank === 'common' ? null : caught.rank);
      this.hooks.toast(`Caught: ${type.name}${size}${caught.record && caught.cm !== null ? ' (a new record!)' : ''}`);
      this.hooks.sound('coin');
      void this.hooks.afterChange();
    }
    this.endFishing();
  }

  /** The reel as it is drawn now: between the last two ticks (the API steps in FISH_TICK_MS ticks). */
  private reelNow(): ReelView | undefined {
    const cur = this.curReel;
    const prev = this.prevReel;
    if (!cur) return undefined;
    if (!prev) return cur;
    const k = Math.max(0, Math.min(1, (performance.now() - this.curAt) / FISH_TICK_MS));
    const mix = (a: number, b: number): number => a + (b - a) * k;
    return { fishPos: mix(prev.fishPos, cur.fishPos), boxPos: mix(prev.boxPos, cur.boxPos), boxSize: cur.boxSize, fill: mix(prev.fill, cur.fill) };
  }

  // ---------- Every frame ----------
  update(dtMs: number, clockMs: number): void {
    const lake = this.lake;
    if (!lake) return;
    // Ripples.
    const ripple = Math.floor(clockMs / 500);
    if (ripple !== this.lastRipple) {
      this.lastRipple = ripple;
      drawRipples(this.ripples, clockMs);
    }
    // Trees: shake, fall, and the look (tree, stump, sapling) with the notches.
    this.trees.forEach((t, i) => {
      const look = this.lookOf(i);
      const hits = this.hitsOf(i);
      if (t.fallMs > 0) {
        // Falling: the old tree tips over and fades; then the stump shows.
        t.fallMs = Math.max(0, t.fallMs - dtMs);
        const k = 1 - t.fallMs / FALL_MS;
        if (t.art) {
          t.art.rotation = k * 1.2;
          t.art.alpha = 1 - k;
        }
        if (t.fallMs > 0) return;
        t.look = null;
      }
      if (t.look !== look || t.hits !== hits) {
        t.art?.destroy();
        t.art = drawTree(look, hits);
        t.c.addChild(t.art);
        t.look = look;
        t.hits = hits;
      }
      if (t.shakeMs > 0) {
        t.shakeMs = Math.max(0, t.shakeMs - dtMs);
        // Whole px only: -1, 0, 1, 0 ...
        t.c.pivot.x = t.shakeMs === 0 ? 0 : Math.round(Math.sin((1 - t.shakeMs / SHAKE_MS) * Math.PI * 4)) * 2;
      }
    });
    this.updateFishing(dtMs, clockMs);
  }

  private updateFishing(dtMs: number, clockMs: number): void {
    // The splash after the line comes in.
    if (!this.session && this.splashMs > 0) {
      this.splashMs -= dtMs;
      if (this.splashMs <= 0) this.bobber.visible = false;
    }
    const s = this.session;
    const target = this.target;
    if (!s || !target) {
      if (!this.session) this.line.clear();
      return;
    }
    // The bobber floats (a 1 px bob), dips on a bite and shakes while reeling.
    this.bobber.visible = true;
    const bite = s.phase === 'bite';
    const reel = s.phase === 'reel';
    const bob = reel ? Math.round(Math.sin(clockMs / 60) * 2) : Math.round(Math.sin(clockMs / 700));
    this.bobberArt?.destroy();
    this.bobberArt = drawBobber(bite || reel);
    this.bobber.addChildAt(this.bobberArt, 0);
    this.bobber.position.set(Math.round(target.x + (reel ? Math.round(Math.sin(clockMs / 90)) : 0)), Math.round(target.y + bob));
    this.bang.visible = bite;
    this.bang.position.set(0, -8);
    // The line, from the rod tip (above the avatar's hand) to the bobber.
    const me = this.hooks.avatar();
    const hand = { x: me.x + (me.facing === 'left' ? -10 : me.facing === 'right' ? 10 : 0), y: me.y - 36 };
    this.line.clear();
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = hand.x + (this.bobber.x - hand.x) * k;
      // A sag in the middle (less while reeling: the line is tight).
      const sag = Math.sin(k * Math.PI) * (reel ? 2 : 9);
      const y = hand.y + (this.bobber.y - 6 - hand.y) * k + sag;
      this.line.rect(Math.round(x), Math.round(y), 1, 1).fill({ color: PALETTE[20], alpha: 0.9 });
    }
    // The reel bar moves smoothly between the ticks.
    if (s.phase === 'reel') this.hooks.bar.set('reel', s.rank, this.reelNow());
    // The session: the presses and the time, one call at a time.
    this.acc += dtMs;
    if (this.stepping) return;
    this.stepping = true;
    const inputs = this.queue.splice(0);
    const dt = this.acc;
    this.acc = 0;
    void this.hooks.api.fishStep(inputs, dt).then((u) => {
      this.stepping = false;
      if (!u || !this.target) {
        if (!u) this.endFishing();
        return;
      }
      if (u.gains.length > 0) this.hooks.gains(u.gains, this.target ? { x: this.target.x, y: this.target.y } : undefined);
      this.applySession(u.session, u.caught);
    });
  }
}
