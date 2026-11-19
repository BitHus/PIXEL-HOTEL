// The lakeside's life, Pixi part (outdoors rework C15): decor in the depth-sorted list, lily pads and fish shadows on the water,
// birds, butterflies and falling leaves in the air. Everything is built once (the art functions run at build time, never per frame);
// frames are chosen by toggling visibility. Ambient life is off with Reduce effects; decor is static and stays.

import { Container, Graphics, Sprite } from 'pixi.js';
import { spriteTexture } from '../render/spriteStore.ts';
import {
  LAKE_BIRDS,
  LAKE_BUTTERFLIES,
  LAKE_FALLING_LEAVES,
  LAKE_FISH_SHADOWS,
  type Point,
  type Rect,
} from '@pixel-hotel/shared';
import type { RoomView } from '../render/roomView.ts';
import { hash01 } from '../fx/shake.ts';
import { drawBird, drawButterfly, drawCattail, drawFishShadow, drawFlower, drawLeaf, drawLilyPad, drawMushroom, drawReeds, drawStone, drawTuft } from './lakesideArt.ts';
import {
  birdPose,
  birdVisible,
  butterflyAt,
  decorSpots,
  leafAt,
  newBird,
  newFishShadow,
  scareFish,
  stepBird,
  stepFish,
  type Bird,
  type DecorSpot,
  type FishShadow,
} from './lakeLife.ts';

const POSES = ['perch', 'fly1', 'fly2'] as const;

/** A3: the pond PNG for a decor kind (lily pads, reeds), centred (lily) or standing on its foot (reeds); null = the code art. */
function pondSprite(s: DecorSpot): Sprite | null {
  const id = s.kind === 'lily' ? (s.variant % 3 === 0 ? 'lily_flower' : 'lily_plain') : s.kind === 'reeds' ? 'reeds' : null;
  const tex = id ? spriteTexture('lake', id) : null;
  if (!tex) return null;
  const sp = new Sprite(tex);
  sp.anchor.set(0.5, s.kind === 'lily' ? 0.5 : 1);
  if (s.variant % 2 === 1) sp.scale.x = -1; // a mirror for variety (never a resize)
  return sp;
}

function drawDecor(s: DecorSpot): Container {
  const sp = pondSprite(s);
  if (sp) return sp;
  switch (s.kind) {
    case 'reeds': return drawReeds(s.variant);
    case 'cattail': return drawCattail(s.variant);
    case 'flower': return drawFlower(s.variant % 4, s.variant);
    case 'stone': return drawStone(s.variant);
    case 'mushroom': return drawMushroom(s.variant);
    case 'lily': return drawLilyPad(s.variant);
    default: return drawTuft(s.variant);
  }
}

export class LakeLifeView {
  /** Fish shadows and lily pads: goes on the ground layer right above the water. */
  readonly waterLayer = new Container({ eventMode: 'none' });
  /** Birds, butterflies, leaves: above everything. */
  readonly air = new Container({ eventMode: 'none' });
  private readonly decor: Container[] = [];
  private birds: Bird[] = [];
  private birdArt: Graphics[][] = [];
  private fish: FishShadow[] = [];
  private fishArt: Container[] = [];
  private flies: { home: Point; art: Graphics[] }[] = [];
  private leaves: Graphics[][] = [];
  private rngN = 0;
  private seed = 1;
  private built = false;

  constructor(private readonly view: RoomView) {}

  /** Builds everything for a lakeside room. */
  build(seed: number, w: number, h: number, doorZone: Rect | null, start: Point | null): void {
    this.destroy();
    this.seed = seed;
    this.built = true;
    const spots = decorSpots(seed, { w, h, doorZone, start });
    spots.forEach((s, i) => {
      const c = new Container({ eventMode: 'none' });
      c.position.set(s.x, s.y);
      c.addChild(drawDecor(s));
      if (s.kind === 'lily') this.waterLayer.addChild(c);
      else this.view.objects.add(c, { y: s.y, x: s.x, uid: -2_200_000 - i });
      this.decor.push(c);
    });
    // Fish shadows under the water's shine.
    this.fish = Array.from({ length: LAKE_FISH_SHADOWS }, (_, i) => newFishShadow(i));
    this.fishArt = this.fish.map((f) => {
      // A3: the fish shadow PNG at 60 percent (the code art without it).
      const tex = spriteTexture('lake', 'fish_shadow');
      const g: Container = tex ? new Sprite({ texture: tex, anchor: 0.5, alpha: 0.6 }) : drawFishShadow(f.size);
      this.waterLayer.addChildAt(g, 0);
      return g;
    });
    // Birds on the pier.
    this.birds = Array.from({ length: LAKE_BIRDS }, (_, i) => newBird(i));
    this.birdArt = this.birds.map(() =>
      POSES.map((p) => {
        const g = drawBird(p);
        g.visible = false;
        this.air.addChild(g);
        return g;
      }),
    );
    // Butterflies around flowers (else around the middle of the grass).
    const flowers = spots.filter((s) => s.kind === 'flower');
    for (let i = 0; i < LAKE_BUTTERFLIES; i++) {
      const f = flowers.length > 0 ? flowers[Math.floor(hash01(seed, 90 + i) * flowers.length)]! : { x: 100 + i * 60, y: 250 };
      const art = [0, 1].map((frame) => {
        const g = drawButterfly(frame, i);
        g.visible = false;
        this.air.addChild(g);
        return g;
      });
      this.flies.push({ home: { x: f.x, y: f.y }, art });
    }
    // Falling leaves: four tumble poses each.
    this.leaves = Array.from({ length: LAKE_FALLING_LEAVES }, (_, j) =>
      [0, 1, 2, 3].map((turn) => {
        const g = drawLeaf(j % 3, turn);
        g.visible = false;
        this.air.addChild(g);
        return g;
      }),
    );
  }

  /** A cast landed at `at`: the fish shadows nearby dart away. */
  scare(at: Point): void {
    this.fish = scareFish(this.fish, at);
  }

  /** `trees` = anchors of the trees that stand now; `avatar` = the avatar's feet. */
  update(dtMs: number, clockMs: number, avatar: Point | null, trees: readonly Point[], reduce: boolean, bounds: { w: number; h: number }): void {
    if (!this.built) return;
    this.air.visible = !reduce;
    this.waterLayer.children.forEach((c) => {
      if (this.fishArt.includes(c)) c.visible = !reduce;
    });
    if (reduce) return;
    const rng = (): number => hash01(this.seed, ++this.rngN);
    this.birds = this.birds.map((b, i) => {
      const nb = stepBird(b, dtMs, avatar, rng, bounds);
      const pose = birdPose(nb, clockMs);
      this.birdArt[i]!.forEach((g, k) => {
        g.visible = birdVisible(nb) && POSES[k] === pose;
        g.position.set(Math.round(nb.x), Math.round(nb.y));
        g.scale.x = nb.right ? 1 : -1;
      });
      return nb;
    });
    this.fish = this.fish.map((f, i) => {
      const nf = stepFish(f, dtMs);
      const g = this.fishArt[i]!;
      g.position.set(Math.round(nf.x), Math.round(nf.y));
      g.scale.x = nf.dir >= 0 ? 1 : -1;
      return nf;
    });
    this.flies.forEach((fl, i) => {
      const p = butterflyAt(i, clockMs, fl.home);
      fl.art.forEach((g, k) => {
        g.visible = k === p.frame;
        g.position.set(p.x, p.y);
      });
    });
    this.leaves.forEach((poses, j) => {
      const l = leafAt(j, clockMs, trees);
      poses.forEach((g, k) => {
        g.visible = l !== null && l.turn === k;
        if (l) {
          g.position.set(l.x, l.y);
          g.alpha = l.alpha;
        }
      });
    });
  }

  destroy(): void {
    for (const c of this.decor) {
      this.view.objects.remove(c);
      c.destroy({ children: true });
    }
    this.decor.length = 0;
    this.waterLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.air.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.birds = [];
    this.birdArt = [];
    this.fish = [];
    this.fishArt = [];
    this.flies = [];
    this.leaves = [];
    this.built = false;
  }
}
