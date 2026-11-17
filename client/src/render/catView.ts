// CAT HOOK (step 9g-2 rules in shared/src/pet.ts; docs/NOTES.md CAT HOOK): draws the pet from PNG strips, with a code-box fallback.
// Strips (artist + animator): client/src/assets/sprites/actors/cat_{walk,sit,sleep}.png, a horizontal row of 32 x 32 frames, drawn FACING RIGHT
// (left = the sprite mirrored). walk 4 frames, sit 2, sleep 2. Feet at the bottom middle of the frame (anchor 0.5, 1) = the brain's (x, y).
// A missing strip falls back to the box cat (a box body, head and tail in code). The purr heart is a small code heart above the cat.
// Rendering only: the cat's behaviour is shared/src/pet.ts stepPet; the caller feeds the PetBrain and the game clock.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { PALETTE, type PetBrain, type PetMode } from '@pixel-hotel/shared';
import { spriteFrames } from './spriteStore.ts';

export const CAT_FRAME = 32;
/** Frames per strip (what the artist draws) and ms per frame. 'follow' uses the walk strip. */
export const CAT_STRIPS = {
  walk: { frames: 4, ms: 140 },
  sit: { frames: 2, ms: 900 },
  sleep: { frames: 2, ms: 1400 },
} as const;
export type CatStrip = keyof typeof CAT_STRIPS;

export const catStripOf = (mode: PetMode): CatStrip => (mode === 'follow' ? 'walk' : mode);

/** The frame to show: a loop over `count` frames of `ms` each. Pure (tested). */
export function catFrameIndex(strip: CatStrip, clockMs: number, count: number = CAT_STRIPS[strip].frames): number {
  if (count <= 1) return 0;
  return Math.floor(Math.max(0, clockMs) / CAT_STRIPS[strip].ms) % count;
}

export interface CatView {
  container: Container;
  /** Moves, mirrors and animates the cat. `nowMs` = the game clock passed to stepPet. */
  update(brain: PetBrain, nowMs: number): void;
  /** The y the draw-order list sorts on (the cat's feet). */
  readonly y: number;
  destroy(): void;
}

const c = (i: number): number => parseInt((PALETTE[i] ?? '#000000').slice(1), 16);

function drawBoxCat(g: Graphics, mode: PetMode, frame: number): void {
  g.clear();
  const body = c(14);
  const dark = c(0);
  if (mode === 'sleep') {
    g.rect(-9, -8, 18, 8).fill(body).stroke({ width: 1, color: dark });
    g.rect(5, -10, 6, 6).fill(body).stroke({ width: 1, color: dark });
    return;
  }
  const bob = mode === 'sit' ? frame : 0;
  const legs = mode === 'sit' ? 0 : frame % 2 ? 2 : 0;
  g.rect(-8, -12 + bob, mode === 'sit' ? 10 : 16, 9 - bob + 3 - legs).fill(body).stroke({ width: 1, color: dark });
  g.rect(4, -18 + bob, 7, 7).fill(body).stroke({ width: 1, color: dark });
  g.rect(-12, -14 + bob, 4, 2).fill(body);
}

export function createCatView(): CatView {
  const container = new Container();
  const sprite = new Sprite();
  sprite.anchor.set(0.5, 1);
  const box = new Graphics();
  const heart = new Graphics();
  heart.rect(-2, -38, 2, 2).rect(1, -38, 2, 2).rect(-3, -36, 7, 2).rect(-2, -34, 5, 2).rect(-1, -32, 3, 2).fill(c(8));
  heart.visible = false;
  container.addChild(box, sprite, heart);
  const cache: Partial<Record<CatStrip, Texture[] | null>> = {};
  const strip = (s: CatStrip): Texture[] | null => {
    if (cache[s] === undefined) {
      const f = spriteFrames('actors', 'cat', s, CAT_FRAME);
      cache[s] = f && f.length > 0 ? f : null;
    }
    return cache[s] ?? null;
  };
  let feetY = 0;
  return {
    container,
    get y() { return feetY; },
    update(brain, nowMs) {
      feetY = Math.round(brain.y);
      container.position.set(Math.round(brain.x), feetY);
      container.scale.x = brain.dir; // the strips face right
      const s = catStripOf(brain.mode);
      const frames = strip(s);
      if (frames) {
        sprite.texture = frames[catFrameIndex(s, nowMs, frames.length)]!;
        sprite.visible = true;
        box.visible = false;
      } else {
        sprite.visible = false;
        box.visible = true;
        drawBoxCat(box, brain.mode, catFrameIndex(s, nowMs));
      }
      heart.visible = nowMs < brain.purrUntilMs;
      heart.scale.x = brain.dir; // keep the heart unmirrored
    },
    destroy() { container.destroy({ children: true }); },
  };
}
