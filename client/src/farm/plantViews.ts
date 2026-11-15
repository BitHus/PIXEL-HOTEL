// Draws the plants of a farm room (step BG6): one small sprite per planted cell in the depth-sorted
// object list (avatars walk around them), in its stage (sprout, small plant, full plant), a bobbing
// marker over every fully grown one, a shake when an unripe plant is punched, a puff of bits when one is
// harvested, and the ghost of the seed about to be planted. RENDERING ONLY: what grows where and when it is
// ripe comes from the room (rules: shared/src/farm.ts). Art is placeholder boxes drawn in code (farmArt.ts).

import { Container, Graphics, type Sprite } from 'pixi.js';
import {
  BUILD_CELL,
  RIPE_MARKER_BOB_MS,
  RIPE_MARKER_BOB_PX,
  getMaterialType,
  growthStage,
  paletteColor,
  plantList,
  seedProduct,
  type PaletteName,
  type PlantStage,
  type Room,
  type SeedId,
} from '@pixel-hotel/shared';
import type { DepthKey } from '../render/depthOrder.ts';
import type { RoomView } from '../render/roomView.ts';
import { drawPlantArt, drawRipeMarker } from './farmArt.ts';
import { plantSprite } from './plantSprite.ts';

const SHAKE_MS = 160;
const PUFF_MS = 420;

interface PlantView {
  seed: SeedId;
  /** The second spliced-in seed (step BG7): it tints the plant's accent colour. */
  withSeed: SeedId | null;
  c: number;
  r: number;
  node: Container;
  art: Graphics;
  /** H4: the PNG of this stage when sprites/plants has the set; the code art above is then empty. */
  sprite: Sprite | null;
  marker: Graphics | null;
  stage: PlantStage;
  shakeMs: number;
}

interface Bit {
  g: Graphics;
  vx: number;
  vy: number;
  age: number;
}

export class PlantViews {
  private readonly views = new Map<string, PlantView>();
  private roomId = -1;
  private readonly bits: Bit[] = [];
  private readonly ghost = new Container();
  private readonly ghostArt = new Graphics();
  private readonly ghostFrame = new Graphics();
  private ghostFor = '';

  constructor(private readonly view: RoomView) {
    this.ghost.addChild(this.ghostArt, this.ghostFrame);
    this.ghost.visible = false;
    view.ghostLayer.addChild(this.ghost);
  }

  /** Shows the plants of this room: adds, removes and re-stages them (growth runs with `now`, ms on the game clock). */
  sync(room: Room, now: number): void {
    if (room.id !== this.roomId) {
      for (const v of this.views.values()) this.drop(v);
      this.views.clear();
      this.roomId = room.id;
    }
    const live = new Set<string>();
    for (const { c, r, plant } of plantList(room)) {
      const key = `${c},${r}`;
      live.add(key);
      let v = this.views.get(key);
      if (v && (v.seed !== plant.seed || v.withSeed !== (plant.with ?? null))) {
        this.drop(v);
        this.views.delete(key);
        v = undefined;
      }
      const stage = growthStage(plant, now);
      if (!v) {
        const node = new Container();
        const art = new Graphics();
        node.addChild(art);
        node.position.set(c * BUILD_CELL, r * BUILD_CELL);
        node.eventMode = 'none';
        v = { seed: plant.seed, withSeed: plant.with ?? null, c, r, node, art, sprite: null, marker: null, stage, shakeMs: 0 };
        this.paint(v);
        this.views.set(key, v);
        this.view.objects.add(node, this.keyOf(c, r));
      } else if (stage !== v.stage) {
        v.stage = stage;
        this.paint(v);
      }
      if (stage === 'full' && !v.marker) {
        v.marker = drawRipeMarker();
        v.marker.position.set(BUILD_CELL / 2, -10);
        v.node.addChild(v.marker);
      }
    }
    for (const [key, v] of [...this.views]) {
      if (live.has(key)) continue;
      this.drop(v);
      this.views.delete(key);
    }
  }

  /** Draws the plant's current stage: from sprites/plants when present (H4), else the code art. */
  private paint(v: PlantView): void {
    v.sprite?.destroy();
    v.sprite = null;
    v.art.clear();
    const sprite = plantSprite(v.seed, v.stage);
    if (sprite) {
      v.sprite = sprite;
      v.node.addChildAt(sprite, 0);
    } else {
      drawPlantArt(v.art, v.seed, v.stage, v.withSeed);
    }
  }

  private keyOf(c: number, r: number): DepthKey {
    // Like a block: the foot is the cell's bottom edge; negative uids never tie with items or avatars.
    return { y: (r + 1) * BUILD_CELL, x: c * BUILD_CELL + BUILD_CELL / 2, uid: -3_000_000 - r * 1000 - c };
  }

  private drop(v: PlantView): void {
    this.view.objects.remove(v.node);
    v.node.destroy({ children: true });
  }

  /** An unripe plant was punched: it shakes for a moment (and stays). */
  shake(c: number, r: number): void {
    const v = this.views.get(`${c},${r}`);
    if (v) v.shakeMs = SHAKE_MS;
  }

  /** A plant was harvested (it is already gone from the room): a puff of leaves and its colours. */
  harvestFx(c: number, r: number, seed: SeedId): void {
    const colors = getMaterialType(seedProduct(seed)).icon.colors.map((n) => paletteColor(n as PaletteName));
    colors.push(paletteColor('lime'));
    for (let i = 0; i < 9; i++) {
      const g = new Graphics();
      g.rect(0, 0, 3, 3).fill(colors[i % colors.length] ?? '#ffffff');
      g.position.set(c * BUILD_CELL + 10 + (i % 3) * 5, r * BUILD_CELL + 12 + (i % 2) * 6);
      this.view.markerLayer.addChild(g);
      const a = (i / 9) * Math.PI * 2;
      this.bits.push({ g, vx: Math.cos(a) * 55, vy: Math.sin(a) * 45 - 35, age: 0 });
    }
  }

  /** The seed that was in a cell (for the harvest puff, which runs after the room changed). */
  seedAt(room: Room, c: number, r: number): SeedId | null {
    return room.plants[`${c},${r}`]?.seed ?? null;
  }

  /** Every frame: shakes, the bobbing markers and the bits. */
  update(dtMs: number, clockMs: number): void {
    const bob = Math.floor(clockMs / RIPE_MARKER_BOB_MS) % 2 === 0 ? 0 : -RIPE_MARKER_BOB_PX;
    for (const v of this.views.values()) {
      if (v.marker) v.marker.y = -10 + bob;
      if (v.shakeMs > 0) {
        v.shakeMs = Math.max(0, v.shakeMs - dtMs);
        v.node.x = v.c * BUILD_CELL + (v.shakeMs > 0 ? (Math.floor(v.shakeMs / 40) % 2 === 0 ? 1 : -1) : 0);
      }
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i]!;
      b.age += dtMs;
      if (b.age >= PUFF_MS) {
        b.g.destroy();
        this.bits.splice(i, 1);
        continue;
      }
      const t = dtMs / 1000;
      b.vy += 160 * t;
      b.g.x = Math.round(b.g.x + b.vx * t);
      b.g.y = Math.round(b.g.y + b.vy * t);
      b.g.alpha = 1 - b.age / PUFF_MS;
    }
  }

  /** The ghost of the seed that would be planted in a cell (green = fits, red = not); null hides it. */
  showGhost(at: { c: number; r: number; seed: SeedId; valid: boolean } | null): void {
    if (!at) {
      this.ghost.visible = false;
      return;
    }
    if (this.ghostFor !== at.seed) {
      this.ghostFor = at.seed;
      this.ghostArt.clear();
      drawPlantArt(this.ghostArt, at.seed, 'small');
    }
    this.ghostFrame.clear();
    this.ghostFrame.rect(0, 0, BUILD_CELL, BUILD_CELL).stroke({ width: 2, color: paletteColor(at.valid ? 'lime' : 'red'), alignment: 1 });
    this.ghostArt.alpha = at.valid ? 0.6 : 0.3;
    this.ghost.position.set(at.c * BUILD_CELL, at.r * BUILD_CELL);
    this.ghost.visible = true;
  }
}
