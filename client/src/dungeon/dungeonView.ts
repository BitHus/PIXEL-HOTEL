// Draws a dungeon run (step 9) with the same top-down renderer as the rooms: the floor and wall
// blocks, the exit, and ONE depth-sorted list of standing things (the player, enemies, chests;
// by feet y, then x, then id), then the fog on top. Positions are interpolated between the last
// two ticks (run.carryMs), so walking looks smooth although the rules run in 100 ms ticks.
// Rendering only: no game rules here.
// Step 9c: the mine is drawn by the same view (run.place 'mine'): its own block colours, rocks in
// the depth-sorted list (they crack per hit and shake when hit), no exit stairs.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  CHEST_OPEN_MS,
  DUNGEON_BLOCK,
  DUNGEON_SEEN_DARK,
  DUNGEON_TICK_MS,
  ENEMY_WINDUP_MS,
  FX_AGGRO_MS,
  FX_KNOCKBACK_MS,
  FX_SQUASH_MS,
  FX_TELEGRAPH_RADIUS,
  GEM_ICON,
  GEM_PICKUP_REACH,
  HIT_FLASH_MS,
  DIG_COLS,
  digLightPxOf,
  glintingCells,
  glintingChests,
  PALETTE,
  PICKAXE_COOLDOWN_MS,
  facingFor,
  type Avatar,
  type AvatarLook,
  type Chest,
  type DungeonMap,
  type DungeonRun,
  type Enemy,
  type Facing,
  type Point,
  type Rock,
  type RunPlace,
} from '@pixel-hotel/shared';
import { AvatarSprite } from '../render/avatarSprite.ts';
import { DepthLayer } from '../render/depthLayer.ts';
import { iconTexture } from '../render/drawIcon.ts';
import { DigLayer, drawGlint } from './digArt.ts';
import { CRYPT_OUTLINE, ENEMY_HEIGHT, ROCK_HEIGHT, drawBlocks, drawChest, drawEnemy, drawExit, drawRock } from './dungeonArt.ts';
import { FogMemory } from './fog.ts';
import { decorAnimated, decorIsFlat, drawDecorProp, landmarkOf, landmarkToast } from './decor.ts';
import { DungeonLight } from './dungeonLight.ts';

/** Seen-but-not-lit blocks under the light layer: a cool dark blue (palette night) at this alpha. */
const SEEN_COOL = PALETTE[24]!;
const DUNGEON_SEEN_COOL = 0.62;
import { DungeonFx } from './dungeonFx.ts';
import { easeInQuad, easeOutBounce, easeOutQuad } from '../fx/ease.ts';
import { aggroStarted } from '../fx/fxSpec.ts';

/** Depth key ids: the player first, then enemies, then chests (only breaks exact ties). */
const PLAYER_ID = 0;
const CHEST_ID_BASE = 100000;
const ROCK_ID_BASE = 200000;
const GEM_ID_BASE = 300000;
/** A gem pile bobs this many px, and flies to the player over this long when picked up (ms). */
const GEM_BOB_PX = 2;
const GEM_FLY_MS = 180;

interface GemView {
  sprite: Sprite;
  x: number;
  y: number;
  /** ms since it started to fly to the player; -1 = lying on the floor. */
  flyMs: number;
}

interface RockView {
  root: Container;
  hitsLeft: number;
  shakeMs: number;
}

interface EnemyView {
  root: Container;
  /** The art and its white flash: squashed around the feet (outdoors rework C12). */
  body: Container;
  /** The "!" over the head when it starts to chase. */
  bang: Graphics;
  squashMs: number;
  knock: Point;
  /** ms since the knockback started (FX_KNOCKBACK_MS = done). */
  knockMs: number;
  telegraphMs: number;
  aggroMs: number;
  /** Its distance to the player at the last frame (for the aggro cue), null = not seen yet. */
  prevDist: number | null;
  white: Graphics;
  hp: Graphics;
  flashMs: number;
  height: number;
  /** Where it was drawn last (floats start here when it dies). */
  at: Point;
}

interface ChestView {
  root: Container;
  kind: 'wooden' | 'golden';
  /** ms since the lid started to open; -1 = shut. */
  openMs: number;
  /** Holds the three poses (shut, half, open): built once, only their visibility changes (no per-frame redraw). */
  art: Container;
  poses: Container[];
  glows: Container[];
}

/** A killed enemy fading out (its view stays for FX_DEATH_FADE_MS). */
interface DyingView {
  v: EnemyView;
  ms: number;
  total: number;
  at: Point;
}

export class DungeonView {
  /** Scaled and moved by the camera. */
  readonly world = new Container();
  private readonly base = new Container();
  readonly objects = new DepthLayer();
  /** Above the objects: the attack cooldown ring. */
  private readonly fx = new Graphics();
  private readonly fog = new Graphics();
  /** The crypt light layer (outdoors rework C14); the old fog is its fallback. */
  readonly light = new DungeonLight();
  private fogCool = false;
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogTex: Texture | null = null;
  private readonly fogSprite = new Sprite(Texture.EMPTY);
  /** MG-3: the dig mine's blocks (one Graphics per row) and the glints of rare blocks, drawn over the fog. */
  private readonly dig = new DigLayer();
  private readonly glints = new Graphics();
  private fogDirty = false;
  /** On the floor under the objects: the wind-up telegraph rings (outdoors rework C12). */
  private readonly floorFx = new Graphics();
  /** Sparks, bits, dust and loot drops above the objects. */
  readonly particles = new DungeonFx();
  /** Set by the screen each frame from the Reduce effects pref: no dust, aggro cue or telegraph then. */
  reduce = false;
  private readonly dying: DyingView[] = [];
  /** Kills the screen asked to fade (enemy id -> ms): the view keeps those views for a moment instead of removing them. */
  private readonly fadeRequests = new Map<number, number>();
  private readonly exit = drawExit();
  readonly player: AvatarSprite;
  private facing: Facing = 'down';
  private hurtMs = 0;
  private readonly enemies = new Map<number, EnemyView>();
  private readonly chests = new Map<number, ChestView>();
  private readonly rocks = new Map<number, RockView>();
  /** Gem piles lying on the floor (step BG4), and the ones flying to the player. */
  private readonly gems = new Map<number, GemView>();
  /** Props (map.decor, DG2): flat ones lie under the avatars, tall ones sort with them. Redrawn per flame frame when they burn. */
  private readonly flatDecor = new Container();
  private decorViews: { id: number; kind: string; c: number; r: number; root: Container; frame: number; flat: boolean }[] = [];
  /** Called once per floor when the landmark first comes into sight (the screen shows it as a toast). */
  onLandmark: ((text: string) => void) | null = null;
  private landmarkSaid = false;
  readonly fogMemory = new FogMemory();
  private map: DungeonMap | null = null;
  /** Where the player is drawn now (world px). */
  playerAt: Point = { x: 0, y: 0 };

  constructor(look: AvatarLook) {
    this.player = new AvatarSprite(look);
    this.player.container.eventMode = 'none';
    this.world.eventMode = 'none';
    this.world.addChild(this.base, this.flatDecor, this.floorFx, this.objects.container, this.fx, this.particles.container, this.fog, this.fogSprite, this.glints, this.light.container);
    this.objects.add(this.player.container, { y: 0, x: 0, uid: PLAYER_ID });
  }

  setLook(look: AvatarLook): void {
    this.player.setLook(look);
  }

  /** A new floor: draw its blocks, forget the fog and every enemy, chest and rock view. */
  setMap(map: DungeonMap, place: RunPlace = 'crypt'): void {
    this.map = map;
    this.base.removeChildren().forEach((c) => c !== this.exit && c !== this.dig.container && c.destroy());
    this.dig.reset();
    // The dig mine draws its cave from run.dig (DigLayer, synced each frame); every other place draws its blocks once.
    this.base.addChild(map.dig ? this.dig.container : drawBlocks(map, place));
    for (const [id, v] of this.rocks) {
      this.objects.remove(v.root);
      v.root.destroy({ children: true });
      this.rocks.delete(id);
    }
    this.exit.position.set((map.exit.c + 0.5) * DUNGEON_BLOCK, (map.exit.r + 1) * DUNGEON_BLOCK);
    this.base.addChild(this.exit);
    this.setDecor(map);
    for (const id of [...this.enemies.keys()]) this.removeEnemy(id);
    for (const d of this.dying.splice(0)) this.destroyEnemyView(d.v);
    this.fadeRequests.clear();
    this.particles.clear();
    for (const [id, c] of this.chests) {
      this.objects.remove(c.root);
      c.root.destroy({ children: true });
      this.chests.delete(id);
    }
    this.fogMemory.reset();
    this.light.setMap(map, place);
    this.fogDirty = true;
  }

  /** Builds the props of map.decor (none on the mine or on a run saved before DG1). */
  private setDecor(map: DungeonMap): void {
    for (const d of this.decorViews) {
      if (d.flat) d.root.destroy({ children: true });
      else {
        this.objects.remove(d.root);
        d.root.destroy({ children: true });
      }
    }
    this.decorViews = [];
    this.landmarkSaid = false;
    const B = DUNGEON_BLOCK;
    for (const d of map.decor ?? []) {
      const flat = decorIsFlat(d.kind);
      const root = drawDecorProp(d.kind, d.c, d.r, 0, map);
      root.position.set((d.c + 0.5) * B, (d.r + 1) * B);
      root.visible = false;
      root.eventMode = 'none';
      if (flat) this.flatDecor.addChild(root);
      else this.objects.add(root, { y: (d.r + 1) * B, x: (d.c + 0.5) * B, uid: 1_000_000 + d.id });
      this.decorViews.push({ id: d.id, kind: d.kind, c: d.c, r: d.r, root, frame: 0, flat });
    }
  }

  /** Per frame: props show once seen; burning ones swap to the next flame frame; the landmark line fires once. */
  private updateDecor(map: DungeonMap, clockMs: number): void {
    const B = DUNGEON_BLOCK;
    const frame = Math.floor(Math.max(0, clockMs) / 110) % 3;
    for (const d of this.decorViews) {
      const seen = this.fogMemory.seen.has(d.r * map.cols + d.c);
      d.root.visible = seen;
      if (!seen || d.frame === frame || !decorAnimated(d.kind)) continue;
      d.frame = frame;
      const next = drawDecorProp(d.kind, d.c, d.r, clockMs);
      next.position.copyFrom(d.root.position);
      next.eventMode = 'none';
      if (d.flat) {
        this.flatDecor.addChild(next);
        d.root.destroy({ children: true });
      } else {
        this.objects.remove(d.root);
        d.root.destroy({ children: true });
        this.objects.add(next, { y: (d.r + 1) * B, x: (d.c + 0.5) * B, uid: 1_000_000 + d.id });
      }
      d.root = next;
    }
    if (!this.landmarkSaid) {
      const lm = landmarkOf(map);
      if (lm && this.fogMemory.seen.has(lm.r * map.cols + lm.c)) {
        this.landmarkSaid = true;
        const text = landmarkToast(map);
        if (text) this.onLandmark?.(text);
      }
    }
  }

  get mapRect(): { x: number; y: number; w: number; h: number } {
    const m = this.map;
    return m ? { x: 0, y: 0, w: m.cols * DUNGEON_BLOCK, h: m.rows * DUNGEON_BLOCK } : { x: 0, y: 0, w: 1, h: 1 };
  }

  /** The enemy drawn at a world point (generous for fingers), or null. Only lit enemies count. */
  enemyAt(run: DungeonRun, p: Point): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of run.enemies) {
      const v = this.enemies.get(e.id);
      if (!v || !v.root.visible) continue;
      const cx = v.at.x;
      const cy = v.at.y - v.height / 2;
      const reach = Math.max(24, v.height / 2 + 10);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d <= reach && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  /** The unopened chest drawn at a world point (seen ones only), or null. */
  chestAt(run: DungeonRun, p: Point, slack = 0): Chest | null {
    for (const c of run.chests) {
      const v = this.chests.get(c.id);
      if (!c.opened && v?.root.visible && Math.abs(p.x - c.x) <= 20 + slack && p.y >= c.y - 34 - slack && p.y <= c.y + 10 + slack) return c;
    }
    return null;
  }

  /** The rock drawn at a world point (seen ones only), or null. */
  rockAt(run: DungeonRun, p: Point, slack = 0): Rock | null {
    for (const r of run.rocks) {
      const v = this.rocks.get(r.id);
      if (v?.root.visible && Math.abs(p.x - r.x) <= 20 + slack && p.y >= r.y - ROCK_HEIGHT - 8 - slack && p.y <= r.y + 10 + slack) return r;
    }
    return null;
  }

  /** MG-3: the diggable block under a world point (row-major cell index), or null: open floor, bedrock, or a block not seen yet. */
  digCellAt(run: DungeonRun, p: Point): number | null {
    const d = run.dig;
    if (!d) return null;
    const c = Math.floor(p.x / DUNGEON_BLOCK);
    const r = Math.floor(p.y / DUNGEON_BLOCK);
    if (c < 0 || r < 0 || c >= run.map.cols || r >= run.map.rows) return null;
    const cell = r * run.map.cols + c;
    const kind = d.kinds[cell];
    if (!kind || kind === 'bedrock' || !this.fogMemory.seen.has(cell)) return null;
    return cell;
  }

  /** The gem pile near a world point (generous for fingers; seen piles only), or null. A tap on it walks onto it. */
  pickupAt(run: DungeonRun, p: Point): Point | null {
    let best: Point | null = null;
    let bestD = Infinity;
    for (const g of run.pickups) {
      const v = this.gems.get(g.id);
      if (!v?.sprite.visible) continue;
      const d = Math.hypot(p.x - g.x, p.y - 12 - g.y);
      if (d <= Math.max(24, GEM_PICKUP_REACH) && d < bestD) {
        best = { x: g.x, y: g.y };
        bestD = d;
      }
    }
    return best;
  }

  /** A hit rock shakes a little. */
  shakeRock(id: number): void {
    const v = this.rocks.get(id);
    if (v) v.shakeMs = 160;
  }

  /** Where an enemy was last drawn (for floats), or null. */
  enemyPoint(id: number): Point | null {
    const v = this.enemies.get(id);
    return v ? { x: v.at.x, y: v.at.y - v.height } : null;
  }

  /** Where an enemy's feet are drawn (before knockback), or null. */
  enemyFeet(id: number): Point | null {
    return this.enemies.get(id)?.at ?? null;
  }

  flashEnemy(id: number): void {
    const v = this.enemies.get(id);
    if (v) v.flashMs = HIT_FLASH_MS;
  }

  hurtPlayer(): void {
    this.hurtMs = HIT_FLASH_MS * 1.5;
  }

  openChest(id: number): void {
    const v = this.chests.get(id);
    if (v && v.openMs < 0) v.openMs = 0;
  }

  /** A hit enemy squashes (stepped, whole pixels) for FX_SQUASH_MS. */
  squashEnemy(id: number): void {
    const v = this.enemies.get(id);
    if (v) v.squashMs = FX_SQUASH_MS;
  }

  /** A hit enemy is pushed px away along (dx, dy), easing back over FX_KNOCKBACK_MS. */
  knockEnemy(id: number, dx: number, dy: number, px: number): void {
    const v = this.enemies.get(id);
    if (!v) return;
    v.knock = { x: dx * px, y: dy * px };
    v.knockMs = 0;
  }

  /** The red wind-up ring on the floor under an enemy, growing over ms. */
  telegraphEnemy(id: number, ms: number): void {
    const v = this.enemies.get(id);
    if (v) v.telegraphMs = ms;
  }

  /** The enemy is about to leave the run (a kill): keep its view and fade it out over ms instead of removing it at once. */
  fadeEnemy(id: number, ms: number): void {
    if (this.enemies.has(id)) this.fadeRequests.set(id, ms);
  }

  /** The floor y of a chest, for the loot that pops out of it. */
  chestFloorY(id: number): number | null {
    const v = this.chests.get(id);
    return v ? v.root.y + 4 : null;
  }

  /**
   * Draws the run. `prev` is the run one tick earlier (null after a floor change): standing things
   * are drawn between the two by run.carryMs.
   */
  render(run: DungeonRun, prev: DungeonRun | null, dtMs: number, clockMs: number): void {
    const map = run.map;
    // A dug block makes a new map object for the same floor: keep the fog, enemies and props (only a new floor resets them).
    const sameFloor = map.dig === true && this.map?.dig === true && this.map.seed === map.seed && this.map.n === map.n;
    if (map !== this.map) {
      if (sameFloor) this.map = map;
      else this.setMap(map, run.place);
    }
    if (run.dig) this.dig.sync(run.dig, map.cols, map.rows);
    const t = Math.min(1, run.carryMs / DUNGEON_TICK_MS);
    const same = prev !== null && (prev.map === map || (sameFloor && prev.floor === run.floor)) ? prev : null;
    const lerp = (a: Point | undefined, b: Point): Point => (a ? { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } : { x: b.x, y: b.y });

    // The player.
    const p = run.player;
    const at = lerp(same?.player, p);
    const dx = p.x - (same?.player.x ?? p.x);
    const dy = p.y - (same?.player.y ?? p.y);
    const moving = Math.hypot(dx, dy) > 0.01;
    if (moving) this.facing = facingFor(dx, dy, this.facing);
    else {
      // Facing the enemy it fights.
      const target = run.enemies.find((e) => e.id === p.targetEnemyId) ?? run.rocks.find((r) => r.id === p.targetRockId);
      if (target) this.facing = facingFor(target.x - p.x, target.y - p.y, this.facing);
    }
    this.playerAt = at;
    this.player.update({ x: at.x, y: at.y, facing: this.facing, state: moving ? 'walk' : 'idle' } as Avatar, clockMs);
    this.hurtMs = Math.max(0, this.hurtMs - dtMs);
    this.player.container.tint = this.hurtMs > 0 ? 0xff7070 : 0xffffff;
    this.objects.setKey(this.player.container, { y: at.y, x: at.x, uid: PLAYER_ID });

    // Fog: lit around the player, seen blocks dim, the rest black.
    this.light.reduce = this.reduce;
    this.light.perf.feed(dtMs);
    const cool = this.light.active;
    const lightPx = run.dig ? digLightPxOf(run.player.skill) : undefined;
    if (this.fogMemory.update(map, at, lightPx) || this.fogDirty || cool !== this.fogCool) {
      this.fogCool = cool;
      this.fogDirty = false;
      this.drawFog(map);
    }
    this.updateDecor(map, clockMs);
    this.light.update(at, clockMs, run.chests, run.enemies, (q) => this.fogMemory.isSeen(map, q));
    // Rare blocks glint through the dark (Ore sense widens it); the dig mine's glints and Treasure sense's chest glints.
    this.glints.clear();
    if (!this.reduce) for (const cell of glintingCells(run)) drawGlint(this.glints, cell, DIG_COLS, clockMs);
    const chestGlow = new Set(glintingChests(run));
    // The mine has no exit block (NO_EXIT is off the map).
    this.exit.visible = map.exit.c >= 0 && this.fogMemory.seen.has(map.exit.r * map.cols + map.exit.c);

    // Enemies: only on lit blocks; they blink during the wind-up and flash white when hit.
    const alive = new Set(run.enemies.map((e) => e.id));
    for (const id of [...this.enemies.keys()]) if (!alive.has(id)) this.retireEnemy(id);
    for (const e of run.enemies) {
      const v = this.enemies.get(e.id) ?? this.addEnemy(e);
      const pos = lerp(same?.enemies.find((x) => x.id === e.id), e);
      v.at = pos;
      // Knockback eases back, the squash steps back to normal (outdoors rework C12); both are whole pixels.
      let kx = 0;
      let ky = 0;
      if (v.knockMs < FX_KNOCKBACK_MS) {
        v.knockMs = Math.min(FX_KNOCKBACK_MS, v.knockMs + dtMs);
        const k = 1 - easeOutQuad(v.knockMs / FX_KNOCKBACK_MS);
        kx = v.knock.x * k;
        ky = v.knock.y * k;
      }
      v.root.position.set(Math.round(pos.x + kx), Math.round(pos.y + ky));
      v.root.visible = this.fogMemory.isLit(map, pos);
      this.squashBody(v, dtMs);
      v.telegraphMs = Math.max(0, v.telegraphMs - dtMs);
      const dist = Math.hypot(pos.x - at.x, pos.y - at.y);
      if (!this.reduce && v.root.visible && aggroStarted(v.prevDist, dist)) v.aggroMs = FX_AGGRO_MS;
      v.prevDist = dist;
      this.bang(v, dtMs);
      const blink = e.windupMs > 0 && Math.floor(clockMs / 60) % 2 === 0;
      v.root.tint = blink ? 0xff5050 : 0xffffff;
      v.flashMs = Math.max(0, v.flashMs - dtMs);
      v.white.visible = v.flashMs > 0;
      this.drawHp(v, e);
      this.objects.setKey(v.root, { y: pos.y, x: pos.x, uid: e.id });
    }

    this.updateDying(dtMs);
    this.drawTelegraphs(run);

    // Chests: drawn once seen; the lid opens over CHEST_OPEN_MS.
    for (const c of run.chests) {
      let v = this.chests.get(c.id);
      if (!v) {
        v = this.addChest(c);
        if (c.opened) {
          // Opened before this view existed (a reload): drawn open, no animation.
          v.openMs = CHEST_OPEN_MS;
          this.poseChest(v, 1);
        }
      }
      if (c.opened && v.openMs < 0) v.openMs = 0;
      if (v.openMs >= 0 && v.openMs < CHEST_OPEN_MS) {
        v.openMs = Math.min(CHEST_OPEN_MS, v.openMs + dtMs);
        this.poseChest(v, v.openMs / CHEST_OPEN_MS);
        // A little hop while it opens.
        v.art.y = -Math.round(Math.sin((v.openMs / CHEST_OPEN_MS) * Math.PI) * 4);
      }
      v.root.visible = this.fogMemory.isSeen(map, c) || chestGlow.has(c.id);
      for (const glow of v.glows) glow.alpha = 0.7 + 0.3 * Math.sin(clockMs / 300);
    }
    // A mimic leaves the chest list when it wakes.
    for (const [id, v] of this.chests) {
      if (run.chests.some((c) => c.id === id)) continue;
      this.objects.remove(v.root);
      v.root.destroy({ children: true });
      this.chests.delete(id);
    }

    // Rocks (the mine): drawn once seen, redrawn with more cracks after each hit.
    const rockIds = new Set(run.rocks.map((r) => r.id));
    for (const [id, v] of this.rocks) {
      if (rockIds.has(id)) continue;
      this.objects.remove(v.root);
      v.root.destroy({ children: true });
      this.rocks.delete(id);
    }
    for (const r of run.rocks) {
      let v = this.rocks.get(r.id);
      if (!v) {
        v = { root: new Container(), hitsLeft: -1, shakeMs: 0 };
        v.root.position.set(r.x, r.y);
        this.rocks.set(r.id, v);
        this.objects.add(v.root, { y: r.y, x: r.x, uid: ROCK_ID_BASE + r.id });
      }
      if (v.hitsLeft !== r.hitsLeft) {
        v.root.removeChildren().forEach((c) => c.destroy());
        v.root.addChild(drawRock(r.kind, r.hitsLeft));
        v.hitsLeft = r.hitsLeft;
      }
      v.shakeMs = Math.max(0, v.shakeMs - dtMs);
      v.root.x = r.x + (v.shakeMs > 0 ? (Math.floor(clockMs / 40) % 2 === 0 ? 1 : -1) : 0);
      v.root.visible = this.fogMemory.isSeen(map, r);
    }

    // Gem piles (step BG4): a small bobbing gem square; a picked-up pile flies to the player and is gone.
    const piles = new Set(run.pickups.map((g) => g.id));
    for (const g of run.pickups) {
      let v = this.gems.get(g.id);
      if (!v) {
        const sprite = new Sprite(iconTexture(GEM_ICON));
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(0.75);
        v = { sprite, x: g.x, y: g.y, flyMs: -1 };
        this.gems.set(g.id, v);
        this.objects.add(sprite, { y: g.y, x: g.x, uid: GEM_ID_BASE + g.id });
      }
      v.sprite.position.set(Math.round(g.x), Math.round(g.y - 4 - GEM_BOB_PX * (0.5 + 0.5 * Math.sin(clockMs / 260 + g.id))));
      v.sprite.visible = this.fogMemory.isSeen(map, g);
    }
    for (const [id, v] of this.gems) {
      if (!piles.has(id) && v.flyMs < 0) v.flyMs = 0;
      if (v.flyMs < 0) continue;
      v.flyMs += dtMs;
      const k = Math.min(1, v.flyMs / GEM_FLY_MS);
      v.sprite.position.set(Math.round(v.x + (at.x - v.x) * k), Math.round(v.y - 4 + (at.y - 28 - (v.y - 4)) * k));
      v.sprite.alpha = 1 - k * 0.5;
      if (k >= 1) {
        this.objects.remove(v.sprite);
        v.sprite.destroy();
        this.gems.delete(id);
      }
    }

    // The cooldown ring above the player's head: the attack, or the pickaxe in the mine.
    this.fx.clear();
    const now = run.timeMs + run.carryMs;
    const attackLeft = p.attackReadyAt - now;
    const pickLeft = p.pickReadyAt - now;
    const left = Math.max(attackLeft, pickLeft);
    const total = attackLeft >= pickLeft ? p.attackCooldownMs : PICKAXE_COOLDOWN_MS;
    if (left > 0) {
      const cx = Math.round(at.x) + 12;
      const cy = Math.round(at.y) - 66;
      const done = 1 - left / total;
      this.fx.circle(cx, cy, 5).fill({ color: CRYPT_OUTLINE, alpha: 0.7 });
      this.fx.moveTo(cx, cy).arc(cx, cy, 5, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2).lineTo(cx, cy).fill('#feae34');
    }
    if (!this.reduce && dtMs > 0) this.particles.footsteps(at, moving);
    this.particles.update(dtMs);
    this.objects.update();
  }

  /** The stepped squash of a hit enemy: wide and flat, then halfway, then normal (whole pixels, no smoothing). */
  private squashBody(v: EnemyView, dtMs: number): void {
    v.squashMs = Math.max(0, v.squashMs - dtMs);
    const k = v.squashMs / FX_SQUASH_MS;
    const [sx, sy] = k > 0.66 ? [1.25, 0.75] : k > 0.33 ? [1.12, 0.88] : [1, 1];
    v.body.scale.set(sx, sy);
  }

  /** The aggro "!" over an enemy that just started to chase: it drops in with a bounce and stays FX_AGGRO_MS. */
  private bang(v: EnemyView, dtMs: number): void {
    v.aggroMs = Math.max(0, v.aggroMs - dtMs);
    v.bang.visible = v.aggroMs > 0;
    if (!v.bang.visible) return;
    const t = Math.min(1, (FX_AGGRO_MS - v.aggroMs) / 220);
    v.bang.position.set(0, -v.height - 14 - Math.round(10 * (1 - easeOutBounce(t))));
  }

  /** Red rings that grow on the floor under every enemy that winds up an attack. */
  private drawTelegraphs(run: DungeonRun): void {
    const g = this.floorFx;
    g.clear();
    if (this.reduce) return;
    for (const e of run.enemies) {
      const v = this.enemies.get(e.id);
      if (!v || v.telegraphMs <= 0 || !v.root.visible) continue;
      const k = 1 - v.telegraphMs / ENEMY_WINDUP_MS;
      const r = Math.max(4, Math.round(FX_TELEGRAPH_RADIUS * easeInQuad(Math.min(1, k + 0.15))));
      g.ellipse(Math.round(v.at.x), Math.round(v.at.y), r, Math.round(r * 0.55)).fill({ color: PALETTE[8]!, alpha: 0.18 }).stroke({ color: PALETTE[8]!, width: 1, alpha: 0.9 });
    }
  }

  /** Fades the views of killed enemies and removes them when done. */
  private updateDying(dtMs: number): void {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i]!;
      d.ms += dtMs;
      let kx = 0;
      let ky = 0;
      if (d.v.knockMs < FX_KNOCKBACK_MS) {
        d.v.knockMs = Math.min(FX_KNOCKBACK_MS, d.v.knockMs + dtMs);
        const k = 1 - easeOutQuad(d.v.knockMs / FX_KNOCKBACK_MS);
        kx = d.v.knock.x * k;
        ky = d.v.knock.y * k;
      }
      d.v.root.position.set(Math.round(d.at.x + kx), Math.round(d.at.y + ky));
      this.squashBody(d.v, dtMs);
      d.v.root.alpha = Math.max(0, 1 - easeInQuad(d.ms / d.total));
      if (d.ms >= d.total) {
        this.destroyEnemyView(d.v);
        this.dying.splice(i, 1);
      }
    }
  }

  private addEnemy(e: Enemy): EnemyView {
    const root = new Container();
    const body = new Container();
    const art = drawEnemy(e.kind, e.mimic);
    const white = drawEnemy(e.kind, e.mimic, true);
    white.visible = false;
    body.addChild(art, white);
    const hp = new Graphics();
    const bang = new Graphics();
    bang.rect(-3, -9, 6, 2).fill(CRYPT_OUTLINE).rect(-2, -8, 4, 7).fill(PALETTE[11]!).rect(-3, -1, 6, 4).fill(CRYPT_OUTLINE).rect(-2, 0, 3, 2).fill(PALETTE[11]!);
    bang.visible = false;
    root.addChild(body, hp, bang);
    const v: EnemyView = {
      root, body, bang, white, hp, flashMs: 0, height: ENEMY_HEIGHT[e.mimic ? 'mimic' : e.kind], at: { x: e.x, y: e.y },
      squashMs: 0, knock: { x: 0, y: 0 }, knockMs: FX_KNOCKBACK_MS, telegraphMs: 0, aggroMs: 0, prevDist: null,
    };
    this.enemies.set(e.id, v);
    this.objects.add(root, { y: e.y, x: e.x, uid: e.id });
    return v;
  }

  private removeEnemy(id: number): void {
    const v = this.enemies.get(id);
    if (!v) return;
    this.destroyEnemyView(v);
    this.enemies.delete(id);
  }

  private destroyEnemyView(v: EnemyView): void {
    this.objects.remove(v.root);
    v.root.destroy({ children: true });
  }

  /** An enemy left the run: a killed one (the screen asked for a fade) fades out, anything else is removed at once. */
  private retireEnemy(id: number): void {
    const ms = this.fadeRequests.get(id);
    const v = this.enemies.get(id);
    this.fadeRequests.delete(id);
    if (ms === undefined || !v || !v.root.visible) {
      this.removeEnemy(id);
      return;
    }
    this.enemies.delete(id);
    v.hp.clear();
    v.bang.visible = false;
    v.white.visible = false;
    this.dying.push({ v, ms: 0, total: ms, at: { x: v.at.x, y: v.at.y } });
  }

  private drawHp(v: EnemyView, e: Enemy): void {
    v.hp.clear();
    if (e.hp >= e.maxHp) return;
    const w = 20;
    const y = -v.height - 6;
    v.hp.rect(-w / 2 - 1, y - 1, w + 2, 5).fill(CRYPT_OUTLINE);
    v.hp.rect(-w / 2, y, w, 3).fill('#5a6988');
    v.hp.rect(-w / 2, y, Math.max(1, Math.round((w * Math.max(0, e.hp)) / e.maxHp)), 3).fill('#e43b44');
  }

  private addChest(c: Chest): ChestView {
    const root = new Container();
    // Three poses built once; opening only switches which one shows (no Graphics redraw per frame).
    const poses = [drawChest(c.kind, 0), drawChest(c.kind, 0.5), drawChest(c.kind, 1)];
    const art = new Container();
    art.addChild(...poses);
    const glows = poses.map((p) => p.children.find((ch) => ch.label === 'glow')).filter((g): g is Container => g !== undefined);
    root.addChild(art);
    root.position.set(c.x, c.y);
    const v: ChestView = { root, kind: c.kind, openMs: -1, art, poses, glows };
    this.poseChest(v, 0);
    this.chests.set(c.id, v);
    this.objects.add(root, { y: c.y, x: c.x, uid: CHEST_ID_BASE + c.id });
    return v;
  }

  /** Shows the pose for how far the lid is open (0 = shut, 1 = open). */
  private poseChest(v: ChestView, open: number): void {
    const i = open <= 0 ? 0 : open < 0.5 ? 1 : 2;
    v.poses.forEach((p, k) => {
      p.visible = k === i;
    });
  }

  private drawFog(map: DungeonMap): void {
    const g = this.fog;
    g.clear();
    const B = DUNGEON_BLOCK;
    // The area around the map is black too (when the camera shows past the edge).
    g.rect(-B * 20, -B * 20, (map.cols + 40) * B, B * 20).fill(CRYPT_OUTLINE);
    g.rect(-B * 20, map.rows * B, (map.cols + 40) * B, B * 20).fill(CRYPT_OUTLINE);
    g.rect(-B * 20, 0, B * 20, map.rows * B).fill(CRYPT_OUTLINE);
    g.rect(map.cols * B, 0, B * 20, map.rows * B).fill(CRYPT_OUTLINE);
    // The blocks: one pixel per block in a small canvas, stretched with linear filtering, so the edges between lit, seen and unseen blocks are soft
    // instead of hard 32 px squares.
    if (!this.fogCanvas || this.fogCanvas.width !== map.cols || this.fogCanvas.height !== map.rows) {
      this.fogCanvas = document.createElement('canvas');
      this.fogCanvas.width = map.cols;
      this.fogCanvas.height = map.rows;
      this.fogTex?.destroy(true);
      this.fogTex = Texture.from(this.fogCanvas);
      this.fogTex.source.scaleMode = 'linear';
      this.fogSprite.texture = this.fogTex;
    }
    const rgb = (c: string): [number, number, number] => {
      const n = parseInt(c.replace('#', ''), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const dark = rgb(CRYPT_OUTLINE);
    const seen = this.fogCool ? rgb(SEEN_COOL) : dark;
    const seenA = this.fogCool ? DUNGEON_SEEN_COOL : DUNGEON_SEEN_DARK;
    const ctx = this.fogCanvas.getContext('2d')!;
    const img = ctx.createImageData(map.cols, map.rows);
    for (let i = 0; i < map.cols * map.rows; i++) {
      const isSeen = this.fogMemory.seen.has(i);
      const col = isSeen ? seen : dark;
      const a = this.fogMemory.lit.has(i) ? 0 : isSeen ? seenA : 1;
      img.data[i * 4] = col[0];
      img.data[i * 4 + 1] = col[1];
      img.data[i * 4 + 2] = col[2];
      img.data[i * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
    this.fogTex!.source.update();
    this.fogSprite.width = map.cols * B;
    this.fogSprite.height = map.rows * B;
  }
}
