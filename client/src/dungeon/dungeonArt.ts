// Placeholder art for the crypt (step 9), drawn in code from boxes like the furniture: every box
// shows a lighter top face and a darker front face, with a 1 px dark outline. The crypt is cool and
// dark (blue, purple, grey); chests, the golden glow and torches are the few warm lights.
// Anchors are the feet / the bottom middle of the footprint, as everywhere else.
// Step 9c: the mine uses the same drawing with its own colours (cool grey rock, brown earth specks,
// warm lanterns on some walls) and rocks in ore colours that crack with every hit.

import { Container, Graphics } from 'pixi.js';
import { DUNGEON_BLOCK, PALETTE, ROCK_HITS, type DungeonMap, type EnemyKind, type RockKind, type RunPlace } from '@pixel-hotel/shared';
import { desaturate, shade } from '../render/colors.ts';

const B = DUNGEON_BLOCK;
/** Cool dark outline for the crypt (warm DARK_WARM is for the hotel). */
export const CRYPT_OUTLINE: string = PALETTE[25]!;
export const CRYPT_FLOOR: string = PALETTE[24]!;
const FLOOR_SPECK: string = PALETTE[23]!;
const WALL_TOP: string = PALETTE[22]!;
const WALL_FRONT: string = PALETTE[23]!;
/** The bottom part of a wall block with floor below it is its front face. */
const WALL_FRONT_H = 14;

/** A box: top face (w x d, lighter) above a front face (w x h, darker), bottom-left at (x, y). */
function box(g: Graphics, x: number, y: number, w: number, d: number, h: number, color: string, outline = CRYPT_OUTLINE): void {
  g.rect(x - 1, y - h - d - 1, w + 2, h + d + 2).fill(outline);
  g.rect(x, y - h - d, w, d).fill(shade(color, 1.18));
  g.rect(x, y - h, w, h).fill(color);
}

interface BlockColors {
  floor: string;
  speck: string;
  wallTop: string;
  wallFront: string;
  /** Warm lanterns on some wall fronts (the mine). */
  lanterns: boolean;
}

const BLOCK_COLORS: Record<RunPlace, BlockColors> = {
  crypt: { floor: CRYPT_FLOOR, speck: FLOOR_SPECK, wallTop: WALL_TOP, wallFront: WALL_FRONT, lanterns: false },
  mine: { floor: desaturate(PALETTE[5]!, 0.7), speck: shade(desaturate(PALETTE[5]!, 0.7), 0.75), wallTop: PALETTE[21]!, wallFront: PALETTE[22]!, lanterns: true },
};

/** The floor and the walls of a map, drawn once per floor (the crypt's colours, or the mine's). */
export function drawBlocks(map: DungeonMap, place: RunPlace = 'crypt'): Graphics {
  const { floor: FLOOR, speck: SPECK, wallTop: TOP, wallFront: FRONT, lanterns } = BLOCK_COLORS[place];
  const g = new Graphics();
  const floor = (c: number, r: number): boolean =>
    c >= 0 && r >= 0 && c < map.cols && r < map.rows && map.blocks[r * map.cols + c] === 'floor';
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const x = c * B;
      const y = r * B;
      if (floor(c, r)) {
        g.rect(x, y, B, B).fill(FLOOR);
        // A few loose specks so the floor is not flat (same every time: from the block index).
        const h = (c * 73856093) ^ (r * 19349663);
        if (h % 3 === 0) g.rect(x + (h & 15) + 4, y + ((h >> 4) & 15) + 6, 3, 2).fill(SPECK);
        if (h % 5 === 0) g.rect(x + ((h >> 8) & 15) + 8, y + ((h >> 12) & 15) + 2, 2, 2).fill(SPECK);
        continue;
      }
      // Walls next to the floor: a top face, and a darker front face when the floor is below.
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1 && !near; dc++) near = floor(c + dc, r + dr);
      if (!near) continue;
      const front = floor(c, r + 1);
      g.rect(x, y, B, B).fill(TOP);
      // Stone joints on the top.
      g.rect(x, y + (front ? 8 : 15), B, 1).fill(shade(TOP, 0.85));
      g.rect(x + (r % 2 === 0 ? 10 : 22), y, 1, front ? 8 : 15).fill(shade(TOP, 0.85));
      if (front) {
        g.rect(x, y + B - WALL_FRONT_H, B, WALL_FRONT_H).fill(FRONT);
        g.rect(x, y + B - WALL_FRONT_H, B, 1).fill(CRYPT_OUTLINE);
        g.rect(x + (c % 2 === 0 ? 6 : 18), y + B - WALL_FRONT_H + 5, 8, 1).fill(shade(FRONT, 0.8));
        // The mine: a small warm lantern on every few wall fronts.
        if (lanterns && ((c * 7 + r * 3) % 9 === 0)) {
          g.rect(x + 13, y + B - WALL_FRONT_H - 6, 6, 9).fill(CRYPT_OUTLINE);
          g.rect(x + 14, y + B - WALL_FRONT_H - 5, 4, 7).fill(PALETTE[10]!);
          g.rect(x + 15, y + B - WALL_FRONT_H - 4, 2, 3).fill(PALETTE[11]!);
          g.rect(x + 10, y + B - 3, 12, 3).fill({ color: PALETTE[9]!, alpha: 0.35 });
        }
      }
    }
  }
  return g;
}

/** The exit block: stairs going down into the dark, with a faint warm light from below. */
export function drawExit(): Graphics {
  const g = new Graphics();
  g.rect(-B / 2, -B, B, B).fill(CRYPT_OUTLINE);
  const steps = [PALETTE[22]!, PALETTE[23]!, PALETTE[24]!, PALETTE[25]!];
  steps.forEach((col, i) => g.rect(-B / 2 + 3, -B + 3 + i * 7, B - 6, 6).fill(col));
  g.rect(-B / 2 + 8, -6, B - 16, 3).fill({ color: PALETTE[9]!, alpha: 0.5 });
  return g;
}

/** Height of an enemy's art above its feet (for the hp bar and hit testing). */
export const ENEMY_HEIGHT: Record<EnemyKind | 'mimic', number> = { slime: 18, skeleton: 46, bat: 34, bone_king: 64, mimic: 26 };

function shadow(g: Graphics, w: number): void {
  g.ellipse(0, 0, w / 2, 3).fill({ color: CRYPT_OUTLINE, alpha: 0.5 });
}

/** An enemy, feet at (0, 0). `white` draws the same shapes in white (the hit flash). */
export function drawEnemy(kind: EnemyKind, mimic: boolean, white = false): Graphics {
  const g = new Graphics();
  const c = (hex: string): string => (white ? '#ffffff' : hex);
  const o = white ? '#ffffff' : CRYPT_OUTLINE;
  if (!white) shadow(g, mimic ? 28 : kind === 'bone_king' ? 36 : kind === 'bat' ? 14 : 22);
  if (mimic) {
    box(g, -14, 0, 28, 6, 12, c(PALETTE[5]!), o);
    // The lid gapes open: a red mouth with teeth.
    g.rect(-14, -26, 28, 8).fill(c(PALETTE[4]!));
    g.rect(-12, -18, 24, 4).fill(c(PALETTE[7]!));
    for (let k = 0; k < 5; k++) g.rect(-11 + k * 5, -18, 2, 2).fill(c(PALETTE[19]!));
    return g;
  }
  switch (kind) {
    case 'slime': {
      box(g, -11, 0, 22, 6, 10, c(PALETTE[13]!), o);
      g.rect(-6, -12, 3, 3).fill(c(CRYPT_OUTLINE));
      g.rect(3, -12, 3, 3).fill(c(CRYPT_OUTLINE));
      g.rect(-9, -15, 5, 2).fill(c(PALETTE[12]!));
      break;
    }
    case 'skeleton': {
      const bone = PALETTE[20]!;
      box(g, -6, 0, 4, 2, 16, c(bone), o);
      box(g, 2, 0, 4, 2, 16, c(bone), o);
      box(g, -8, -16, 16, 3, 15, c(PALETTE[2]!), o);
      g.rect(-6, -28, 12, 2).fill(c(PALETTE[21]!));
      box(g, -6, -34, 12, 3, 9, c(bone), o);
      g.rect(-4, -40, 3, 3).fill(c(CRYPT_OUTLINE));
      g.rect(1, -40, 3, 3).fill(c(CRYPT_OUTLINE));
      break;
    }
    case 'bat': {
      // It flies: the body floats above its shadow.
      g.rect(-14, -26, 10, 6).fill(o);
      g.rect(4, -26, 10, 6).fill(o);
      g.rect(-13, -25, 8, 4).fill(c(PALETTE[27]!));
      g.rect(5, -25, 8, 4).fill(c(PALETTE[27]!));
      box(g, -5, -20, 10, 3, 8, c(PALETTE[28]!), o);
      g.rect(-3, -27, 2, 2).fill(c(PALETTE[26]!));
      g.rect(1, -27, 2, 2).fill(c(PALETTE[26]!));
      break;
    }
    case 'bone_king': {
      const bone = PALETTE[20]!;
      box(g, -10, 0, 6, 3, 20, c(bone), o);
      box(g, 4, 0, 6, 3, 20, c(bone), o);
      box(g, -16, -20, 32, 5, 22, c(PALETTE[27]!), o);
      box(g, -9, -46, 18, 4, 12, c(bone), o);
      g.rect(-6, -55, 4, 4).fill(c(PALETTE[26]!));
      g.rect(2, -55, 4, 4).fill(c(PALETTE[26]!));
      // The crown: the warm light of the boss.
      g.rect(-10, -64, 20, 4).fill(o);
      g.rect(-9, -63, 18, 3).fill(c(PALETTE[10]!));
      for (const x of [-9, -2, 5]) g.rect(x, -66, 4, 3).fill(c(PALETTE[10]!));
      break;
    }
  }
  return g;
}

/** A chest, bottom middle at (0, 0). `open` 0 = shut, 1 = lid fully up. */
export function drawChest(kind: 'wooden' | 'golden', open: number): Container {
  const root = new Container();
  const golden = kind === 'golden';
  if (golden) {
    // A warm glow on the floor around the golden chest.
    const glow = new Graphics();
    glow.ellipse(0, -6, 30, 14).fill({ color: PALETTE[10]!, alpha: 0.18 });
    glow.ellipse(0, -6, 20, 9).fill({ color: PALETTE[11]!, alpha: 0.18 });
    glow.label = 'glow';
    root.addChild(glow);
  }
  const g = new Graphics();
  shadow(g, 30);
  const body = golden ? PALETTE[10]! : PALETTE[4]!;
  const band = golden ? PALETTE[9]! : PALETTE[22]!;
  box(g, -14, 0, 28, 6, 10, body);
  g.rect(-14, -10, 28, 2).fill(band);
  if (open <= 0) {
    box(g, -14, -10, 28, 8, 4, shade(body, 1.05));
    g.rect(-2, -14, 4, 4).fill(band);
  } else {
    // Inside: dark, the lid tilted up behind it.
    g.rect(-13, -16, 26, 6).fill(CRYPT_OUTLINE);
    const lift = Math.round(8 * Math.min(1, open));
    box(g, -14, -16, 28, 2, 4 + lift, shade(body, 0.9));
  }
  root.addChild(g);
  return root;
}

/** Ore colours of the rocks (step 9c). */
const ORE: Record<RockKind, string> = { copper: PALETTE[1]!, iron: PALETTE[20]!, mithril: PALETTE[18]! };
/** Height of a rock's art above its foot (hit testing). */
export const ROCK_HEIGHT = 26;

/**
 * A rock, foot at (0, 0): a grey boulder with flecks in its ore colour; cracks grow with every hit
 * (hitsLeft of ROCK_HITS[kind]).
 */
export function drawRock(kind: RockKind, hitsLeft: number): Graphics {
  const g = new Graphics();
  shadow(g, 30);
  const stone = PALETTE[22]!;
  box(g, -14, 0, 28, 10, 14, stone);
  box(g, -9, -14, 18, 6, 4, shade(stone, 1.08));
  const ore = ORE[kind];
  for (const [x, y, w, h] of [[-10, -9, 4, 3], [3, -6, 5, 3], [-3, -19, 4, 2], [7, -16, 3, 2], [-12, -16, 3, 2]] as const) {
    g.rect(x, y, w, h).fill(ore);
    g.rect(x, y, w, 1).fill(shade(ore, 1.3));
  }
  // Cracks: more of them the more it was hit.
  const done = 1 - hitsLeft / ROCK_HITS[kind];
  const cracks: [number, number, number, number][] = [
    [-2, -22, 1, 8],
    [-1, -14, 4, 1],
    [3, -13, 1, 7],
    [-8, -12, 1, 6],
    [-7, -6, 5, 1],
    [6, -22, 1, 5],
  ];
  const n = Math.round(done * cracks.length);
  for (const [x, y, w, h] of cracks.slice(0, n)) g.rect(x, y, w, h).fill(CRYPT_OUTLINE);
  return g;
}
