// Draws a dungeon run (step 9) with the same top-down renderer as the rooms: the floor and wall
// blocks, the exit, and ONE depth-sorted list of standing things (the player, enemies, chests;
// by feet y, then x, then id), then the fog on top. Positions are interpolated between the last
// two ticks (run.carryMs), so walking looks smooth although the rules run in 100 ms ticks.
// Rendering only: no game rules here.
// Step 9c: the mine is drawn by the same view (run.place 'mine'): its own block colours, rocks in
// the depth-sorted list (they crack per hit and shake when hit), no exit stairs.

import { Container, Graphics } from 'pixi.js';
import {
  CHEST_OPEN_MS,
  DUNGEON_BLOCK,
  DUNGEON_SEEN_DARK,
  DUNGEON_TICK_MS,
  HIT_FLASH_MS,
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
import { CRYPT_OUTLINE, ENEMY_HEIGHT, ROCK_HEIGHT, drawBlocks, drawChest, drawEnemy, drawExit, drawRock } from './dungeonArt.ts';
import { FogMemory } from './fog.ts';

/** Depth key ids: the player first, then enemies, then chests (only breaks exact ties). */
const PLAYER_ID = 0;
const CHEST_ID_BASE = 100000;
const ROCK_ID_BASE = 200000;

interface RockView {
  root: Container;
  hitsLeft: number;
  shakeMs: number;
}

interface EnemyView {
  root: Container;
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
  art: Container;
}

export class DungeonView {
  /** Scaled and moved by the camera. */
  readonly world = new Container();
  private readonly base = new Container();
  readonly objects = new DepthLayer();
  /** Above the objects: the attack cooldown ring. */
  private readonly fx = new Graphics();
  private readonly fog = new Graphics();
  private readonly exit = drawExit();
  readonly player: AvatarSprite;
  private facing: Facing = 'down';
  private hurtMs = 0;
  private readonly enemies = new Map<number, EnemyView>();
  private readonly chests = new Map<number, ChestView>();
  private readonly rocks = new Map<number, RockView>();
  readonly fogMemory = new FogMemory();
  private map: DungeonMap | null = null;
  /** Where the player is drawn now (world px). */
  playerAt: Point = { x: 0, y: 0 };

  constructor(look: AvatarLook) {
    this.player = new AvatarSprite(look);
    this.player.container.eventMode = 'none';
    this.world.eventMode = 'none';
    this.world.addChild(this.base, this.objects.container, this.fx, this.fog);
    this.objects.add(this.player.container, { y: 0, x: 0, uid: PLAYER_ID });
  }

  setLook(look: AvatarLook): void {
    this.player.setLook(look);
  }

  /** A new floor: draw its blocks, forget the fog and every enemy, chest and rock view. */
  setMap(map: DungeonMap, place: RunPlace = 'crypt'): void {
    this.map = map;
    this.base.removeChildren().forEach((c) => c !== this.exit && c.destroy());
    this.base.addChild(drawBlocks(map, place));
    for (const [id, v] of this.rocks) {
      this.objects.remove(v.root);
      v.root.destroy({ children: true });
      this.rocks.delete(id);
    }
    this.exit.position.set((map.exit.c + 0.5) * DUNGEON_BLOCK, (map.exit.r + 1) * DUNGEON_BLOCK);
    this.base.addChild(this.exit);
    for (const id of [...this.enemies.keys()]) this.removeEnemy(id);
    for (const [id, c] of this.chests) {
      this.objects.remove(c.root);
      c.root.destroy({ children: true });
      this.chests.delete(id);
    }
    this.fogMemory.reset();
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
  chestAt(run: DungeonRun, p: Point): Chest | null {
    for (const c of run.chests) {
      const v = this.chests.get(c.id);
      if (!c.opened && v?.root.visible && Math.abs(p.x - c.x) <= 20 && p.y >= c.y - 34 && p.y <= c.y + 10) return c;
    }
    return null;
  }

  /** The rock drawn at a world point (seen ones only), or null. */
  rockAt(run: DungeonRun, p: Point): Rock | null {
    for (const r of run.rocks) {
      const v = this.rocks.get(r.id);
      if (v?.root.visible && Math.abs(p.x - r.x) <= 20 && p.y >= r.y - ROCK_HEIGHT - 8 && p.y <= r.y + 10) return r;
    }
    return null;
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

  /**
   * Draws the run. `prev` is the run one tick earlier (null after a floor change): standing things
   * are drawn between the two by run.carryMs.
   */
  render(run: DungeonRun, prev: DungeonRun | null, dtMs: number, clockMs: number): void {
    const map = run.map;
    if (map !== this.map) this.setMap(map, run.place);
    const t = Math.min(1, run.carryMs / DUNGEON_TICK_MS);
    const same = prev !== null && prev.map === map ? prev : null;
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
    if (this.fogMemory.update(map, at)) this.drawFog(map);
    // The mine has no exit block (NO_EXIT is off the map).
    this.exit.visible = map.exit.c >= 0 && this.fogMemory.seen.has(map.exit.r * map.cols + map.exit.c);

    // Enemies: only on lit blocks; they blink during the wind-up and flash white when hit.
    const alive = new Set(run.enemies.map((e) => e.id));
    for (const id of [...this.enemies.keys()]) if (!alive.has(id)) this.removeEnemy(id);
    for (const e of run.enemies) {
      const v = this.enemies.get(e.id) ?? this.addEnemy(e);
      const pos = lerp(same?.enemies.find((x) => x.id === e.id), e);
      v.at = pos;
      v.root.position.set(Math.round(pos.x), Math.round(pos.y));
      v.root.visible = this.fogMemory.isLit(map, pos);
      const blink = e.windupMs > 0 && Math.floor(clockMs / 60) % 2 === 0;
      v.root.tint = blink ? 0xff5050 : 0xffffff;
      v.flashMs = Math.max(0, v.flashMs - dtMs);
      v.white.visible = v.flashMs > 0;
      this.drawHp(v, e);
      this.objects.setKey(v.root, { y: pos.y, x: pos.x, uid: e.id });
    }

    // Chests: drawn once seen; the lid opens over CHEST_OPEN_MS.
    for (const c of run.chests) {
      let v = this.chests.get(c.id);
      if (!v) {
        v = this.addChest(c);
        if (c.opened) {
          // Opened before this view existed (a reload): drawn open, no animation.
          v.openMs = CHEST_OPEN_MS;
          this.redrawChest(v, 1);
        }
      }
      if (c.opened && v.openMs < 0) v.openMs = 0;
      if (v.openMs >= 0 && v.openMs < CHEST_OPEN_MS) {
        v.openMs = Math.min(CHEST_OPEN_MS, v.openMs + dtMs);
        this.redrawChest(v, v.openMs / CHEST_OPEN_MS);
        // A little hop while it opens.
        v.art.y = -Math.round(Math.sin((v.openMs / CHEST_OPEN_MS) * Math.PI) * 4);
      }
      v.root.visible = this.fogMemory.isSeen(map, c);
      const glow = v.art.children.find((ch) => ch.label === 'glow');
      if (glow) glow.alpha = 0.7 + 0.3 * Math.sin(clockMs / 300);
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
    this.objects.update();
  }

  private addEnemy(e: Enemy): EnemyView {
    const root = new Container();
    const art = drawEnemy(e.kind, e.mimic);
    const white = drawEnemy(e.kind, e.mimic, true);
    white.visible = false;
    const hp = new Graphics();
    root.addChild(art, white, hp);
    const v: EnemyView = { root, white, hp, flashMs: 0, height: ENEMY_HEIGHT[e.mimic ? 'mimic' : e.kind], at: { x: e.x, y: e.y } };
    this.enemies.set(e.id, v);
    this.objects.add(root, { y: e.y, x: e.x, uid: e.id });
    return v;
  }

  private removeEnemy(id: number): void {
    const v = this.enemies.get(id);
    if (!v) return;
    this.objects.remove(v.root);
    v.root.destroy({ children: true });
    this.enemies.delete(id);
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
    const art = drawChest(c.kind, 0);
    root.addChild(art);
    root.position.set(c.x, c.y);
    const v: ChestView = { root, kind: c.kind, openMs: -1, art };
    this.chests.set(c.id, v);
    this.objects.add(root, { y: c.y, x: c.x, uid: CHEST_ID_BASE + c.id });
    return v;
  }

  private redrawChest(v: ChestView, open: number): void {
    const y = v.art.y;
    v.root.removeChild(v.art);
    v.art.destroy({ children: true });
    v.art = drawChest(v.kind, open);
    v.art.y = y;
    v.root.addChild(v.art);
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
    for (let r = 0; r < map.rows; r++) {
      // Runs of equal blocks in a row become one rectangle.
      let c = 0;
      while (c < map.cols) {
        const i = r * map.cols + c;
        const kind = this.fogMemory.lit.has(i) ? 0 : this.fogMemory.seen.has(i) ? 1 : 2;
        let end = c + 1;
        while (end < map.cols) {
          const j = r * map.cols + end;
          const k = this.fogMemory.lit.has(j) ? 0 : this.fogMemory.seen.has(j) ? 1 : 2;
          if (k !== kind) break;
          end++;
        }
        if (kind > 0) g.rect(c * B, r * B, (end - c) * B, B).fill({ color: CRYPT_OUTLINE, alpha: kind === 2 ? 1 : DUNGEON_SEEN_DARK });
        c = end;
      }
    }
  }
}
