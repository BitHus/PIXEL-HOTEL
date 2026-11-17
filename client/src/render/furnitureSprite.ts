// One furniture item on screen: the box placeholder art for its facing, at its anchor (the
// bottom center of the footprint). Items on a surface are lifted by the surface height.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { PALETTE, footprintSize, type Facing, type FurnitureType, type MachineState } from '@pixel-hotel/shared';
import { drawFurniture } from './furnitureArt.ts';
import { READY_FRAME_MS } from './propAnimSpecs.ts';
import { spriteFor, spriteFrames } from './spriteStore.ts';

export class FurnitureSprite {
  /** Positioned at the anchor, in world px. */
  readonly container = new Container();
  private art: Container | null = null;
  private facing: Facing | null = null;
  /** The plain PNG body (the 'cooking' look); the cold and ready art swap it (OA-5, setMachine). */
  private baseTex: Texture | null = null;
  /** The small fish swimming in a fish tank (FurnitureType.swim, step 9f), or null. */
  private fish: Graphics | null = null;

  constructor(readonly type: FurnitureType) {}

  /** Shows the item at (x, y), drawn `lift` px higher (standing on a surface). */
  set(x: number, y: number, facing: Facing, lift = 0): void {
    this.container.position.set(Math.round(x), Math.round(y - lift));
    if (facing === this.facing) return;
    this.facing = facing;
    this.art?.destroy();
    // A PNG sprite (docs/PLAN-SPRITES.md) when the piece has all its facings, else the code art. Anchor = bottom centre.
    const tex = spriteFor(this.type.id, facing);
    this.baseTex = tex;
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5, 1);
      this.art = s;
    } else this.art = drawFurniture(this.type, facing);
    this.art.scale.x = facing === 'left' ? -1 : 1;
    this.container.addChildAt(this.art, 0);
    if (this.type.swim && !this.fish) {
      const s = this.type.swim;
      // The fish: a body, a tail and an eye, 1 px dark outline. Drawn facing right; animate() turns it.
      const g = new Graphics();
      g.rect(-s.w / 2 - 1, -s.h / 2 - 1, s.w + 2, s.h + 2).fill(PALETTE[6]);
      g.rect(-s.w / 2, -s.h / 2, s.w, s.h).fill(PALETTE[s.color] ?? PALETTE[9]);
      g.rect(-s.w / 2 - 3, -s.h / 2 - 1, 3, s.h + 2).fill(PALETTE[6]);
      g.rect(-s.w / 2 - 2, -s.h / 2, 2, s.h).fill(PALETTE[s.color] ?? PALETTE[9]);
      g.rect(s.w / 2 - 2, -s.h / 2 + 1, 1, 1).fill(PALETTE[19]);
      this.fish = g;
      this.container.addChild(g);
      this.animate(0);
    }
  }

  /**
   * OA-5: the body of a stove or a brewing barrel by state: cold = `<id>_cold.png` (no fire), cooking = the plain body, ready = the `<id>_ready.png`
   * strip (frames as wide as the footprint, READY_FRAME_MS each). A missing file keeps the plain body. Only the facing the art is drawn for (down).
   */
  setMachine(state: MachineState, clockMs: number): void {
    const art = this.art;
    if (!(this.type.cooks || this.type.brews) || !(art instanceof Sprite) || !this.baseTex || this.facing !== 'down') return;
    const w = footprintSize(this.type, 'down').w;
    let tex: Texture = this.baseTex;
    if (state === 'cold') tex = spriteFrames('furniture', this.type.id, 'cold', w)?.[0] ?? tex;
    else if (state === 'ready') {
      const frames = spriteFrames('furniture', this.type.id, 'ready', w);
      if (frames) tex = frames[Math.floor(clockMs / READY_FRAME_MS) % frames.length]!;
    }
    if (art.texture !== tex) art.texture = tex;
  }

  /** Moves the swimming fish (a slow there and back, turning at the ends). Whole px. */
  animate(clockMs: number): void {
    const s = this.type.swim;
    const g = this.fish;
    if (!s || !g) return;
    const phase = clockMs / 1400;
    const x = Math.sin(phase) * (s.range / 2);
    g.position.set(Math.round(s.dx + s.range / 2 + x), Math.round(-s.z - s.h / 2 - Math.sin(phase * 0.6) * 1));
    g.scale.x = Math.cos(phase) >= 0 ? 1 : -1;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
