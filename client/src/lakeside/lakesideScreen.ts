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
  FX_BITE_MS,
  FX_CAST_ARC_PX,
  FX_CAST_MS,
  FX_CATCH_ARC_PX,
  FX_CATCH_FLASH_MS,
  FX_CATCH_FLY_MS,
  FX_CATCH_HOLD_MS,
  FX_LEAF_PUFF,
  FX_SLACK_MS,
  FX_TREE_SWAY_PX,
  LAKE_BUSHES,
  doorX,
  doorY,
  doorZoneRect,
  PALETTE,
  RANK_COLORS,
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
import { drawBang, drawBobber, drawBush, drawTree, treeVariantOf, type TreeLook } from './lakesideArt.ts';
import { PondView } from './pondView.ts';
import { LakeLifeView } from './lakeLifeView.ts';
import { BobberSet, arcPoint, nibbleDip, reelFeedback, reelTickPitch, reelTickStep, swayPx, treeFall } from './lakeFeel.ts';
import { LakeFx } from './lakeFx.ts';
import { easeOutBack, easeOutQuad } from '../fx/ease.ts';
import { Shake } from '../fx/shake.ts';

/** The sounds the lakeside plays (client/src/audio/sound.ts). `rank` is for 'found', `pitch` (0 to 1) for 'reelTick'. */
export type LakeSound = 'hit' | 'pop' | 'bell' | 'coin' | 'cast' | 'splash' | 'reelTick' | 'rustle' | 'found';

export interface LakesideHooks {
  api: Pick<GameAPI, 'getLakeside' | 'chopTree' | 'castAt' | 'fishStart' | 'fishStep' | 'fishStop'>;
  bar: FishBar;
  toast(text: string): void;
  /** TUT-2: a fish was caught (the tutorial's last step). */
  onCaught?(): void;
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
  sound(name: LakeSound, opts?: { rank?: Rank; pitch?: number }): void;
  /** The Reduce effects pref: no particles, rings, flight, sway, squash or flash (sounds and the floating texts stay). */
  reduceEffects(): boolean;
  /** A short screen flash (an ultra rare or legendary catch). */
  flash(ms: number): void;
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
  /** A3: the pond tiles, water drift, pier and pond decor. */
  private readonly pond: PondView;
  private readonly overlay = new Container({ eventMode: 'none' });
  private readonly line = new Graphics();
  private readonly bobber = new Container();
  private readonly bang = drawBang();
  /** The bobber is drawn once (floating and pulled under) and only moved and toggled. */
  private readonly bobberArt = new BobberSet<Graphics>(drawBobber);
  private readonly fx = new LakeFx();
  private readonly life: LakeLifeView;
  private roomSize = { w: 576, h: 384 };
  private reduce = false;
  private trees: { c: Container; art: Graphics | null; look: TreeLook | null; hits: number; shakeMs: number; fallMs: number; landed: boolean }[] = [];
  private bushes: Container[] = [];
  private drawnKey = '';
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
  // Fishing look (C13): all cosmetic, nothing here changes what fishing.ts decides.
  /** The cast flight, ms since the cast (null = landed or none), and where the bobber started. */
  private castMs: number | null = null;
  private castFrom: Point = { x: 0, y: 0 };
  /** Since the bite began (the dunk and the "!" pop), ms; null = no bite look. */
  private biteMs: number | null = null;
  /** The slack line after a lost fish, ms left, and the bobber's last spot. */
  private slackMs = 0;
  private lastTarget: Point | null = null;
  private readonly slackShake = new Shake(40);
  /** The reel's catch bar a moment ago (for the draining look) and the last tick step (for the tick sounds). */
  private lastFill = 0;
  private lastTick = 0;
  /** The caught fish: flying to the avatar, then held up. */
  private prizeFly: { from: Point; ageMs: number; rank: Rank } | null = null;
  private prizeHoldMs = 0;
  private seed = 1;

  constructor(
    private readonly view: RoomView,
    private readonly hooks: LakesideHooks,
  ) {
    this.life = new LakeLifeView(view);
    this.pond = new PondView(view);
    this.ground.addChild(this.pond.water, this.life.waterLayer, this.pond.deck);
    this.bobber.addChild(this.bobberArt.idle, this.bobberArt.dip, this.bang);
    this.bobberArt.dip.visible = false;
    this.bang.visible = false;
    this.bobber.visible = false;
    this.overlay.addChild(this.life.air, this.line, this.bobber, this.fx.container);
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
    this.pond.build();
    this.view.rugLayer.addChildAt(this.ground, 0);
    this.view.markerLayer.addChild(this.overlay);
    for (let i = 0; i < TREE_COUNT; i++) {
      const c = new Container({ eventMode: 'none' });
      const a = treeAnchor(i);
      c.position.set(a.x, a.y);
      this.view.objects.add(c, { y: a.y, x: a.x, uid: -2_000_000 - i });
      this.trees.push({ c, art: null, look: null, hits: -1, shakeMs: 0, fallMs: 0, landed: false });
    }
    LAKE_BUSHES.forEach((b, i) => {
      const c = new Container({ eventMode: 'none' });
      c.position.set(b.x, b.y);
      c.addChild(drawBush(i));
      this.view.objects.add(c, { y: b.y, x: b.x, uid: -2_100_000 - i });
      this.bushes.push(c);
    });
    this.roomSize = { w: room.w, h: room.h };
    this.life.build(room.id, room.w, room.h, doorZoneRect(room), { x: doorX(room), y: doorY(room) - 40 });
    this.drawnKey = '';
    this.set(await this.hooks.api.getLakeside());
  }

  private leave(): void {
    if (this.lake === null && this.trees.length === 0) return;
    this.lake = null;
    this.life.destroy();
    this.pond.destroy();
    this.fx.clear();
    this.prizeFly = null;
    this.prizeHoldMs = 0;
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

  /** A3: true when a world point is on the pond's water (a press there never starts a hold-walk: the tap casts). */
  waterUnder(p: Point): boolean {
    return this.lake !== null && treeAt(p) === null && isWater(p);
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
    this.life.scare(plan.bobber);
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
        this.biteMs = null;
        this.slackMs = 0;
        this.lastFill = 0;
        this.lastTick = 0;
        this.seed++;
        this.hooks.bar.show(true);
        this.hooks.bar.set('wait', s.rank);
        this.hooks.sound('cast');
        // The cast: the rod swings and the bobber flies from the hand to the water (landing: splash and rings).
        this.hooks.swing();
        const me = this.hooks.avatar();
        this.castFrom = { x: me.x + (me.facing === 'left' ? -10 : me.facing === 'right' ? 10 : 0), y: me.y - 36 };
        this.castMs = this.reduce ? null : 0;
        if (this.reduce) this.hooks.sound('splash');
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
    this.hooks.sound('rustle');
    if (tree) {
      tree.shakeMs = this.reduce ? 0 : SHAKE_MS;
      // A leaf puff from the crown on every hit.
      if (!this.reduce) this.fx.leaves({ x: a.x, y: a.y - 44 }, FX_LEAF_PUFF);
    }
    if (r.kind === 'felled' && tree) {
      tree.fallMs = FALL_MS;
      tree.landed = false;
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
    this.castMs = null;
    this.biteMs = null;
    this.splashMs = this.bobber.visible ? SPLASH_MS : 0;
    if (this.splashMs === 0) this.bobber.visible = false;
    // A lost fish leaves a slack line for a moment (applySession sets slackMs before it ends the session).
    if (this.slackMs <= 0) this.line.clear();
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
    this.feedbackBar(s);
    const spot = this.target;
    let lost = false;
    for (const e of s.events) {
      if (e.t === 'bite') {
        this.hooks.sound('bell');
        // The bite look: a dunk, rings that grow, the "!" pops in.
        this.biteMs = 0;
        if (spot && !this.reduce) {
          this.fx.ring(spot);
          this.fx.splash(spot, 4);
        }
      } else if (e.t === 'hooked') {
        this.hooks.sound('pop');
        this.biteMs = null;
        if (spot && !this.reduce) this.fx.splash(spot, 6);
      } else if (e.t === 'escaped') {
        this.hooks.toast('It got away!');
        lost = true;
      } else if (e.t === 'missed') {
        this.hooks.toast('Too slow, it got away.');
        lost = true;
      }
    }
    if (s.phase !== 'done') return;
    if (lost && spot && !this.reduce) {
      // Escape: the line goes slack and the bobber shakes for a moment.
      this.slackMs = FX_SLACK_MS;
      this.lastTarget = { x: spot.x, y: spot.y };
      this.slackShake.kick(3, FX_SLACK_MS);
      this.hooks.sound('splash');
    }
    if (caught && this.target) {
      const type = getCatchType(caught.id);
      const size = caught.cm !== null ? ` ${caught.cm} cm` : '';
      this.hooks.float({ x: this.target.x, y: this.target.y - 14 }, `${type.name}${size}`, caught.rank === 'common' ? null : caught.rank);
      this.hooks.onCaught?.();
      this.hooks.toast(`Caught: ${type.name}${size}${caught.record && caught.cm !== null ? ' (a new record!)' : ''}`);
      this.catchLook(caught.rank, this.target);
      void this.hooks.afterChange();
    }
    this.endFishing();
  }

  /** The reel: the bar's classes (catching, draining, tension) from reelFeedback, and a rising tick as the catch bar fills. */
  private feedbackBar(s: FishSession): void {
    if (s.phase !== 'reel') {
      this.hooks.bar.set(s.phase, s.rank);
      return;
    }
    const reel = this.reelNow();
    if (!reel) {
      this.hooks.bar.set(s.phase, s.rank);
      return;
    }
    this.hooks.bar.set('reel', s.rank, reel, reelFeedback(reel, reel.fill - this.lastFill));
    const step = reelTickStep(s.fill);
    if (step > this.lastTick) this.hooks.sound('reelTick', { pitch: reelTickPitch(s.fill) });
    this.lastTick = step;
    this.lastFill = s.fill;
  }

  /** The catch look: the fish icon flies in an arc to the avatar, a splash, a burst in the rank colour; ultra rare and legendary flash and jingle. */
  private catchLook(rank: Rank, at: Point): void {
    if (rank === 'ultra_rare' || rank === 'legendary') this.hooks.sound('found', { rank });
    else if (rank === 'rare') this.hooks.sound('found', { rank });
    else this.hooks.sound('coin');
    if (this.reduce) return;
    this.fx.splash(at, 8);
    this.fx.ring(at);
    this.prizeFly = { from: { x: at.x, y: at.y }, ageMs: 0, rank };
    this.fx.prize.tint = rank === 'common' ? 0xffffff : parseInt(PALETTE[RANK_COLORS[rank]]!.slice(1), 16);
    if (rank === 'ultra_rare' || rank === 'legendary') this.hooks.flash(FX_CATCH_FLASH_MS);
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
    this.reduce = this.hooks.reduceEffects();
    // The pond's water drift (A3).
    this.pond.update(clockMs, this.reduce);
    if (this.reduce && this.fx.pool.count > 0) this.fx.clear();
    // Trees: shake, squash, fall, sway, and the look (tree, stump, sapling) with the notches.
    this.trees.forEach((t, i) => {
      const look = this.lookOf(i);
      const hits = this.hitsOf(i);
      if (t.fallMs > 0) {
        // Falling: the tree tips over, bounces once on landing (leaf burst, rustle) and fades; then the stump shows.
        t.fallMs = Math.max(0, t.fallMs - dtMs);
        const k = 1 - t.fallMs / FALL_MS;
        const fall = treeFall(k);
        if (t.art) {
          t.art.rotation = fall.angle;
          t.art.alpha = fall.alpha;
          t.art.y = -fall.lift;
        }
        if (fall.landed && !t.landed) {
          t.landed = true;
          const a = treeAnchor(i);
          this.hooks.sound('rustle');
          if (!this.reduce) this.fx.leaves({ x: a.x + 14, y: a.y - 6 }, FX_LEAF_PUFF * 3);
        }
        if (t.fallMs > 0) return;
        t.look = null;
      }
      if (t.look !== look || t.hits !== hits) {
        t.art?.destroy();
        t.art = drawTree(look, hits, treeVariantOf(i));
        t.c.addChild(t.art);
        t.look = look;
        t.hits = hits;
      }
      if (t.shakeMs > 0) {
        t.shakeMs = Math.max(0, t.shakeMs - dtMs);
        // Whole px only: -1, 0, 1, 0 ... and the trunk squashes 1 px (the tree dips) while it shakes.
        t.c.pivot.x = t.shakeMs === 0 ? 0 : Math.round(Math.sin((1 - t.shakeMs / SHAKE_MS) * Math.PI * 4)) * 2;
        t.c.pivot.y = t.shakeMs === 0 ? 0 : -1;
      }
      // Wind sway of a standing tree in whole px (off with Reduce effects).
      if (t.art) t.art.x = look === 'tree' && !this.reduce ? swayPx(clockMs, i, FX_TREE_SWAY_PX) : 0;
    });
    const standing: Point[] = [];
    for (let i = 0; i < TREE_COUNT; i++) if (this.lookOf(i) === 'tree') standing.push(treeAnchor(i));
    this.life.update(dtMs, clockMs, this.hooks.avatar(), standing, this.reduce, this.roomSize);
    this.fx.update(dtMs);
    this.updateFishing(dtMs, clockMs);
  }

  private updateFishing(dtMs: number, clockMs: number): void {
    this.updatePrize(dtMs);
    // The splash after the line comes in, and the slack line after a lost fish.
    if (!this.session && this.splashMs > 0) {
      this.splashMs -= dtMs;
      if (this.splashMs <= 0) this.bobber.visible = false;
    }
    if (!this.session && this.slackMs > 0) this.updateSlack(dtMs);
    const s = this.session;
    const target = this.target;
    if (!s || !target) {
      if (!this.session && this.slackMs <= 0) this.line.clear();
      return;
    }
    // The bobber floats (a 1 px bob), nibbles while waiting, dunks on a bite and thrashes while reeling (more when the fish is far from the box).
    this.bobber.visible = true;
    const bite = s.phase === 'bite';
    const reel = s.phase === 'reel';
    const flight = this.castMs;
    let dx = 0;
    let dy = Math.round(Math.sin(clockMs / 700));
    let dip = bite || reel;
    if (s.phase === 'wait' && !this.reduce) {
      const n = nibbleDip(clockMs, this.seed);
      dy += n;
      dip = n > 0;
    }
    if (bite && this.biteMs !== null && !this.reduce) {
      this.biteMs += dtMs;
      // The dunk: pulled 4 px under on the first half of the bite look, then it bobs.
      const k = Math.min(1, this.biteMs / FX_BITE_MS);
      dy = Math.round(4 * easeOutQuad(Math.min(1, k * 2))) + (k >= 1 ? Math.round(Math.sin(clockMs / 90)) : 0);
      if (Math.floor((this.biteMs - dtMs) / 320) !== Math.floor(this.biteMs / 320)) this.fx.ring(target);
    }
    if (reel) {
      const r = this.reelNow();
      const tension = r ? reelFeedback(r, 0).tension : 0;
      const amp = this.reduce ? 1 : 1 + Math.round(tension * 3);
      dy = Math.round(Math.sin(clockMs / (90 - tension * 40)) * amp);
      dx = Math.round(Math.sin(clockMs / (60 + 30 * (1 - tension))) * amp);
    }
    this.bobberArt.get(true).visible = dip;
    this.bobberArt.get(false).visible = !dip;
    this.bobber.position.set(Math.round(target.x + dx), Math.round(target.y + dy));
    // The cast: the bobber flies in an arc from the rod to the water; landing = splash and rings.
    if (flight !== null) {
      this.castMs = flight + dtMs;
      const k = Math.min(1, this.castMs / FX_CAST_MS);
      const p = arcPoint(this.castFrom, target, easeOutQuad(k), FX_CAST_ARC_PX);
      this.bobber.position.set(Math.round(p.x), Math.round(p.y));
      if (k >= 1) {
        this.castMs = null;
        this.hooks.sound('splash');
        this.fx.splash(target, 7);
        this.fx.ring(target);
      }
    }
    // The "!" pops in with a bounce on a bite.
    this.bang.visible = bite;
    this.bang.position.set(0, -8);
    const pop = bite && !this.reduce && this.biteMs !== null ? easeOutBack(Math.min(1, this.biteMs / 220)) : 1;
    this.bang.scale.set(pop);
    // The line, from the rod tip (above the avatar's hand) to the bobber.
    const me = this.hooks.avatar();
    const hand = { x: me.x + (me.facing === 'left' ? -10 : me.facing === 'right' ? 10 : 0), y: me.y - 36 };
    this.drawLine(hand, this.bobber.x, this.bobber.y, reel ? 2 : 9);
    // The reel bar moves smoothly between the ticks.
    if (s.phase === 'reel') {
      const r = this.reelNow();
      this.hooks.bar.set('reel', s.rank, r, r ? reelFeedback(r, r.fill - this.lastFill) : undefined);
    }
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

  /** The line as a dotted sag curve from the hand to the bobber (sag px in the middle). Cleared first. */
  private drawLine(hand: Point, bx: number, by: number, sag: number): void {
    this.line.clear();
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = hand.x + (bx - hand.x) * k;
      const y = hand.y + (by - 6 - hand.y) * k + Math.sin(k * Math.PI) * sag;
      this.line.rect(Math.round(x), Math.round(y), 1, 1).fill({ color: PALETTE[20], alpha: 0.9 });
    }
  }

  /** A lost fish: the line hangs slack and the bobber shakes for FX_SLACK_MS. */
  private updateSlack(dtMs: number): void {
    const at = this.lastTarget;
    if (!at) {
      this.slackMs = 0;
      return;
    }
    this.slackMs = Math.max(0, this.slackMs - dtMs);
    const off = this.slackShake.update(dtMs);
    this.bobber.visible = true;
    this.bobberArt.get(false).visible = true;
    this.bobberArt.get(true).visible = false;
    this.bobber.position.set(Math.round(at.x + off.x), Math.round(at.y));
    const me = this.hooks.avatar();
    const hand = { x: me.x + (me.facing === 'left' ? -10 : me.facing === 'right' ? 10 : 0), y: me.y - 36 };
    this.drawLine(hand, this.bobber.x, this.bobber.y, 16);
    if (this.slackMs <= 0) {
      this.line.clear();
      if (this.splashMs <= 0) this.bobber.visible = false;
    }
  }

  /** The caught fish: it flies to the avatar in an arc, then is held above the head for FX_CATCH_HOLD_MS (a burst and a reach pose on landing). */
  private updatePrize(dtMs: number): void {
    const prize = this.fx.prize;
    const fly = this.prizeFly;
    const me = this.hooks.avatar();
    const head = { x: me.x, y: me.y - 52 };
    if (fly) {
      fly.ageMs += dtMs;
      const k = Math.min(1, fly.ageMs / FX_CATCH_FLY_MS);
      const p = arcPoint(fly.from, head, easeOutQuad(k), FX_CATCH_ARC_PX);
      prize.visible = true;
      prize.position.set(Math.round(p.x), Math.round(p.y));
      if (k >= 1) {
        this.prizeFly = null;
        this.prizeHoldMs = FX_CATCH_HOLD_MS;
        this.hooks.swing();
        this.fx.rankBurst(head, fly.rank, fly.rank === 'common' ? 5 : 12);
      }
      return;
    }
    if (this.prizeHoldMs > 0) {
      this.prizeHoldMs -= dtMs;
      prize.position.set(Math.round(head.x), Math.round(head.y - 2 + Math.round(Math.sin(this.prizeHoldMs / 120))));
      if (this.prizeHoldMs <= 0) prize.visible = false;
    }
  }

}
