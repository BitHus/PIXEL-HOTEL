// Art for the crypt (step 9, look v1 = A15), drawn in code from rects and stepped blobs (no PNG yet; the
// PNG hooks of C14 fall back to this). Every solid shows a lit top-left edge and a darker front, with a
// 1 px dark outline. The crypt is COOL and DARK (night, dusk, slate, steel stone; bone silver); the only
// warm things are torches, the exit, chests and the Bone King's crown. The mine keeps its own colours
// (BLOCK_COLORS) and its warm lanterns. Medieval material language: flagstones with mortar, moss in the
// shade, iron-banded chests, rusty swords, bone and cloth (docs/ART-STYLE.md MEDIEVAL DIRECTION).
// Anchors are the feet / the bottom middle of the footprint, as everywhere else.

import { Container, Graphics } from 'pixi.js';
import { DUNGEON_BLOCK, PALETTE, ROCK_HITS, torchAllowed, type DungeonMap, type EnemyKind, type RockKind, type RunPlace } from '@pixel-hotel/shared';
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

// Named palette colours used below (indices of shared/palette.ts).
const P = {
  rust: PALETTE[0]!, clay: PALETTE[1]!, cream: PALETTE[2]!, sand: PALETTE[3]!, oak: PALETTE[4]!, walnut: PALETTE[5]!,
  crimson: PALETTE[7]!, red: PALETTE[8]!, orange: PALETTE[9]!, gold: PALETTE[10]!, butter: PALETTE[11]!,
  lime: PALETTE[12]!, green: PALETTE[13]!, forest: PALETTE[14]!, pine: PALETTE[15]!, navy: PALETTE[16]!, sky: PALETTE[17]!,
  white: PALETTE[19]!, silver: PALETTE[20]!, steel: PALETTE[21]!, slate: PALETTE[22]!, dusk: PALETTE[23]!, night: PALETTE[24]!,
  ink: PALETTE[25]!, plum: PALETTE[27]!, orchid: PALETTE[28]!, rose: PALETTE[29]!,
};

function hash(c: number, r: number): number {
  return ((c * 73856093) ^ (r * 19349663)) >>> 0;
}

function px(g: Graphics, x: number, y: number, w: number, h: number, color: string): void {
  g.rect(x, y, w, h).fill(color);
}

/** A box: top face (w x d, lighter) above a front face (w x h, darker), bottom-left at (x, y). */
function box(g: Graphics, x: number, y: number, w: number, d: number, h: number, color: string, outline = CRYPT_OUTLINE): void {
  g.rect(x - 1, y - h - d - 1, w + 2, h + d + 2).fill(outline);
  g.rect(x, y - h - d, w, d).fill(shade(color, 1.18));
  g.rect(x, y - h, w, h).fill(color);
  // The lit top-left edge.
  g.rect(x, y - h - d, w, 1).fill(shade(color, 1.4));
  g.rect(x, y - h - d, 1, d + h).fill(shade(color, 1.28));
}

/** A pixel-crisp ellipse built from rows (no anti-aliasing), centre (cx, cy). */
function blob(g: Graphics, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let i = 0; i < ry * 2; i++) {
    const dy = i + 0.5 - ry;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
    if (hw > 0) g.rect(cx - hw, cy - ry + i, hw * 2, 1).fill(color);
  }
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

/** Frames of a torch flame; a flame frame lasts TORCH_FRAME_MS. */
export const TORCH_FRAMES = 3;
export const TORCH_FRAME_MS = 110;

/** A wall front shows a torch on about 1 in 8 blocks (the crypt only); stable from the block index. */
export function hasTorch(c: number, r: number, map?: DungeonMap): boolean {
  // OA-9: never above a chest (the wall block c, r has the floor block c, r + 1 below it).
  if (map?.chestBlocks && !torchAllowed({ c, r: r + 1 }, map.chestBlocks)) return false;
  return hash(c, r) % 8 === 3;
}

/**
 * Where the crypt's wall torches burn, as world px of the flame centre (the coder places light pools and
 * animates the flame with drawTorchFlame). Same blocks as drawBlocks puts a torch bracket on.
 */
export function wallTorchSpots(map: DungeonMap, place: RunPlace = 'crypt'): { x: number; y: number }[] {
  if (place !== 'crypt') return [];
  const out: { x: number; y: number }[] = [];
  const floor = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < map.cols && r < map.rows && map.blocks[r * map.cols + c] === 'floor';
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.blocks[r * map.cols + c] === 'floor' || !floor(c, r + 1) || !hasTorch(c, r, map)) continue;
      out.push({ x: c * B + B / 2, y: r * B + B - WALL_FRONT_H - 1 });
    }
  }
  return out;
}

/** One torch flame, base at (0, 0), frame stepped by clockMs: a warm orange teardrop with a gold and butter core. */
export function drawTorchFlame(clockMs = 0): Graphics {
  const g = new Graphics();
  const f = Math.floor(Math.max(0, clockMs) / TORCH_FRAME_MS) % TORCH_FRAMES;
  // Outer, middle, core; each frame leans and licks a little differently.
  const lean = [0, 1, -1][f]!;
  const tall = [6, 7, 5][f]!;
  px(g, -2, -tall + 1, 4, tall - 1, P.orange);
  px(g, -1 + lean, -tall, 2, 2, P.orange);
  px(g, -1, -tall + 3, 2, tall - 3, P.gold);
  px(g, 0, -2, 1, 2, P.butter);
  return g;
}

/** The wall torch: an iron bracket, a wooden torch head and the flame at frame `clockMs`, flame base at (cx, by). */
function torch(g: Graphics, cx: number, by: number, clockMs: number): void {
  // Warm light spill on the stone around it (kept faint: the coder adds the real light).
  g.rect(cx - 8, by - 10, 16, 14).fill({ color: P.orange, alpha: 0.12 });
  g.rect(cx - 5, by - 8, 10, 10).fill({ color: P.orange, alpha: 0.14 });
  px(g, cx - 3, by - 1, 6, 1, P.ink); // sconce top
  px(g, cx - 2, by, 4, 5, CRYPT_OUTLINE);
  px(g, cx - 1, by, 2, 4, P.walnut);
  px(g, cx - 1, by + 1, 1, 2, P.oak);
  px(g, cx - 4, by + 4, 8, 1, P.ink);
  px(g, cx - 3, by + 4, 6, 1, P.steel); // iron bracket
  const flame = drawTorchFlame(clockMs);
  flame.position.set(cx, by - 1);
  g.addChild(flame);
}

/** The floor and the walls of a map, drawn once per floor (the crypt's colours, or the mine's). `clockMs` picks the torch frame baked in. */
export function drawBlocks(map: DungeonMap, place: RunPlace = 'crypt', clockMs = 0): Graphics {
  const { floor: FLOOR, speck: SPECK, wallTop: TOP, wallFront: FRONT, lanterns } = BLOCK_COLORS[place];
  const crypt = place === 'crypt';
  const SEAM = crypt ? CRYPT_OUTLINE : shade(FLOOR, 0.6);
  const LITE = shade(FLOOR, crypt ? 1.45 : 1.25);
  const MID = shade(FLOOR, 1.15);
  const g = new Graphics();
  const floor = (c: number, r: number): boolean =>
    c >= 0 && r >= 0 && c < map.cols && r < map.rows && map.blocks[r * map.cols + c] === 'floor';
  const wall = (c: number, r: number): boolean => !floor(c, r);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const x = c * B;
      const y = r * B;
      const h = hash(c, r);
      if (floor(c, r)) {
        g.rect(x, y, B, B).fill(FLOOR);
        // Flagstones: two rows of slabs with mortar seams; the joints and the row split vary by block.
        const split = 14 + (h & 3);
        const j1 = 9 + ((h >> 2) & 7);
        const j2 = 6 + ((h >> 5) & 15);
        px(g, x, y + split, B, 1, SEAM);
        px(g, x + j1, y, 1, split, SEAM);
        px(g, x + j2, y + split + 1, 1, B - split - 1, SEAM);
        // Lit top-left edges of every slab, a slightly lighter slab here and there.
        px(g, x, y, j1, 1, LITE);
        px(g, x + j1 + 1, y, B - j1 - 1, 1, LITE);
        px(g, x, y + split + 1, j2, 1, LITE);
        px(g, x + j2 + 1, y + split + 1, B - j2 - 1, 1, LITE);
        px(g, x, y, 1, split, LITE);
        px(g, x + j1 + 1, y + 1, 1, split - 1, shade(FLOOR, 1.25));
        px(g, x, y + split + 1, 1, B - split - 1, LITE);
        px(g, x + j2 + 1, y + split + 2, 1, B - split - 2, shade(FLOOR, 1.25));
        if (h % 3 === 0) px(g, x + 1, y + 1, j1 - 1, split - 1, MID);
        if (h % 4 === 1) px(g, x + j2 + 2, y + split + 2, B - j2 - 2, B - split - 2, MID);
        // One feature per block, by hash: plain, a crack, a puddle, bones, a rune, moss (mine: pebbles).
        const v = (h >> 9) % 14;
        const fx = x + 4 + ((h >> 13) & 15);
        const fy = y + 4 + ((h >> 17) & 15);
        if (v === 0 || v === 1) {
          px(g, fx, fy, 3, 1, SEAM);
          px(g, fx + 2, fy + 1, 1, 3, SEAM);
          px(g, fx + 3, fy + 4, 3, 1, SEAM);
          px(g, fx + 5, fy + 5, 1, 3, SEAM);
          if (v === 1) px(g, fx - 3, fy - 1, 3, 1, SEAM);
        } else if (v === 2 && crypt) {
          // A puddle: dark water with a pale glint.
          blob(g, fx + 6, fy + 3, 7, 4, P.ink);
          blob(g, fx + 6, fy + 3, 6, 3, P.navy);
          px(g, fx + 3, fy + 1, 3, 1, P.sky);
          px(g, fx + 8, fy + 4, 2, 1, shade(P.sky, 0.7));
        } else if (v === 3 && crypt) {
          // Scattered bones: a long bone and a small skull.
          px(g, fx, fy + 3, 8, 2, P.ink);
          px(g, fx + 1, fy + 3, 6, 1, P.silver);
          px(g, fx, fy + 2, 2, 1, P.silver);
          px(g, fx + 7, fy + 5, 2, 1, P.silver);
          px(g, fx + 2, fy - 3, 6, 5, P.ink);
          px(g, fx + 3, fy - 2, 4, 3, P.silver);
          px(g, fx + 3, fy - 1, 1, 1, P.ink);
          px(g, fx + 6, fy - 1, 1, 1, P.ink);
        } else if (v === 4 && crypt) {
          // A rune slab: a faint plum sigil that glows a little.
          g.rect(fx - 1, fy - 1, 9, 9).fill({ color: P.plum, alpha: 0.35 });
          px(g, fx + 3, fy, 1, 7, P.plum);
          px(g, fx, fy + 3, 7, 1, P.plum);
          px(g, fx + 1, fy + 1, 1, 1, P.plum);
          px(g, fx + 5, fy + 5, 1, 1, P.plum);
          px(g, fx + 3, fy + 3, 1, 1, P.orchid);
        } else if (v === 5 && crypt) {
          // Moss creeping in from a corner.
          px(g, x + 1, y + B - 6, 8, 5, P.pine);
          px(g, x + 1, y + B - 8, 4, 3, P.pine);
          px(g, x + 2, y + B - 5, 5, 3, P.forest);
          px(g, x + 3, y + B - 6, 2, 1, P.green);
        } else if (!crypt && v < 6) {
          px(g, fx, fy, 3, 2, SPECK);
          px(g, fx + 5, fy + 4, 2, 2, SPECK);
        }
        continue;
      }
      // Walls next to the floor: a top face, and a darker front face when the floor is below.
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1 && !near; dc++) near = floor(c + dc, r + dr);
      if (!near) continue;
      const front = floor(c, r + 1);
      const topH = front ? B - WALL_FRONT_H : B;
      g.rect(x, y, B, B).fill(TOP);
      // Stone courses on the top: 8 px high, joints staggered per course.
      const course = shade(TOP, 0.8);
      for (let cy = 7; cy < topH; cy += 8) px(g, x, y + cy, B, 1, course);
      for (let k = 0, cy = 0; cy < topH; k++, cy += 8) {
        const off = (k + r) % 2 === 0 ? 10 : 22;
        px(g, x + off, y + cy, 1, Math.min(7, topH - cy), course);
        if (cy > 0 || r % 2 === 0) px(g, x + ((off + 14) % 30), y + cy, 1, Math.min(7, topH - cy), course);
      }
      // The lit edge top-left (where the neighbour is floor), the shade right and below.
      const hi = shade(TOP, 1.35);
      if (!wall(c, r - 1)) px(g, x, y, B, 1, hi);
      else if (h % 3 === 0) px(g, x + 3, y + 2, 6, 1, shade(TOP, 1.12));
      if (!wall(c - 1, r)) px(g, x, y, 1, topH, hi);
      if (!wall(c + 1, r)) px(g, x + B - 1, y, 1, topH, shade(TOP, 0.7));
      if (!front && !wall(c, r + 1)) px(g, x, y + B - 1, B, 1, shade(TOP, 0.7));
      if (crypt && h % 6 === 0 && !wall(c, r - 1)) {
        // Moss on a shaded edge of the top.
        px(g, x + 3, y + 1, 7, 2, P.forest);
        px(g, x + 5, y + 3, 3, 1, P.forest);
        px(g, x + 4, y + 1, 2, 1, P.green);
      }
      if (front) {
        const fy0 = y + B - WALL_FRONT_H;
        g.rect(x, fy0, B, WALL_FRONT_H).fill(FRONT);
        px(g, x, fy0, B, 1, CRYPT_OUTLINE);
        px(g, x, fy0 + 1, B, 1, shade(FRONT, 1.35)); // the lip of the top, lit
        // Two courses of blocks with mortar, then a darker base.
        px(g, x, fy0 + 6, B, 1, shade(FRONT, 0.72));
        px(g, x + (c % 2 === 0 ? 8 : 20), fy0 + 2, 1, 4, shade(FRONT, 0.72));
        px(g, x + (c % 2 === 0 ? 22 : 6), fy0 + 7, 1, 4, shade(FRONT, 0.72));
        px(g, x, fy0 + WALL_FRONT_H - 4, B, 4, shade(FRONT, crypt ? 0.62 : 0.8));
        px(g, x, fy0 + WALL_FRONT_H - 4, B, 1, shade(FRONT, 0.5));
        if (crypt) {
          if (h % 5 === 1) {
            // Moss creeping up the base.
            px(g, x + 4, fy0 + WALL_FRONT_H - 6, 9, 3, P.pine);
            px(g, x + 6, fy0 + WALL_FRONT_H - 8, 4, 2, P.forest);
            px(g, x + 6, fy0 + WALL_FRONT_H - 7, 2, 1, P.green);
          }
          if (h % 7 === 2) {
            // A crack in the stone.
            px(g, x + 12, fy0 + 2, 1, 3, CRYPT_OUTLINE);
            px(g, x + 13, fy0 + 5, 1, 3, CRYPT_OUTLINE);
            px(g, x + 12, fy0 + 8, 1, 2, CRYPT_OUTLINE);
          }
          if (h % 11 === 4) {
            // A hanging iron chain with a shackle.
            for (let k = 0; k < 5; k++) px(g, x + 24, fy0 + 2 + k * 2, 2, 1, P.steel);
            px(g, x + 23, fy0 + 11, 4, 2, P.slate);
          }
          if (hasTorch(c, r, map)) torch(g, x + B / 2, fy0 + 4, clockMs);
        }
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

/** The exit block: a stone arch with iron studs and stairs going down into the dark, warm light rising from below. */
export function drawExit(clockMs = 0): Graphics {
  const g = new Graphics();
  const flick = Math.floor(Math.max(0, clockMs) / 220) % 2; // the glow breathes in whole px
  g.rect(-B / 2, -B, B, B).fill(CRYPT_OUTLINE);
  // The arch: stone blocks with a lit top-left edge.
  g.rect(-B / 2 + 1, -B + 1, B - 2, B - 1).fill(P.slate);
  g.rect(-B / 2 + 1, -B + 1, B - 2, 1).fill(P.steel);
  g.rect(-B / 2 + 1, -B + 1, 1, B - 1).fill(P.steel);
  g.rect(B / 2 - 2, -B + 2, 1, B - 2).fill(P.dusk);
  for (const y of [-24, -16, -8]) g.rect(-B / 2 + 1, y, 5, 1).fill(P.dusk);
  for (const y of [-24, -16, -8]) g.rect(B / 2 - 6, y, 5, 1).fill(P.dusk);
  // The dark opening.
  g.rect(-B / 2 + 6, -B + 5, B - 12, B - 5).fill(CRYPT_OUTLINE);
  g.rect(-B / 2 + 7, -B + 6, B - 14, B - 6).fill(P.night);
  // Stairs going down: each step darker and narrower, lit edge on top.
  for (let i = 0; i < 4; i++) {
    const y = -B + 8 + i * 5;
    const inset = i * 1;
    g.rect(-B / 2 + 7 + inset, y, B - 14 - inset * 2, 4).fill(shade(P.dusk, 1 - i * 0.18));
    g.rect(-B / 2 + 7 + inset, y, B - 14 - inset * 2, 1).fill(shade(P.steel, 1 - i * 0.22));
  }
  // Studs on the frame.
  for (const [x, y] of [[-12, -22], [10, -22], [-12, -12], [10, -12]] as const) g.rect(x, y, 2, 2).fill(P.silver);
  // The warm light from below, stepped (the exit's one warm thing).
  g.rect(-B / 2 + 7, -9, B - 14, 7).fill({ color: P.orange, alpha: 0.3 });
  g.rect(-B / 2 + 9 - flick, -7, B - 18 + flick * 2, 5).fill({ color: P.gold, alpha: 0.4 });
  g.rect(-B / 2 + 12, -5, B - 24, 3).fill({ color: P.butter, alpha: 0.55 });
  g.rect(-B / 2 + 2, -2, B - 4, 2).fill({ color: P.orange, alpha: 0.22 });
  return g;
}

/** Height of an enemy's art above its feet (for the hp bar and hit testing). */
export const ENEMY_HEIGHT: Record<EnemyKind | 'mimic', number> = { slime: 18, skeleton: 46, bat: 34, bone_king: 64, mimic: 26 };

function shadow(g: Graphics, w: number): void {
  g.ellipse(0, 0, w / 2, 3).fill({ color: CRYPT_OUTLINE, alpha: 0.5 });
}

/** A rect of `color` with a 1 px outline `o` around it (a limb, a bone). */
function part(g: Graphics, x: number, y: number, w: number, h: number, color: string, o: string): void {
  g.rect(x - 1, y - 1, w + 2, h + 2).fill(o);
  g.rect(x, y, w, h).fill(color);
}

/** A stepped shape: rows of [y, x0, x1) in `fill`, outlined by the same rows shifted one px each way in `o`. */
function rows(g: Graphics, list: [number, number, number][], fill: string, o: string): void {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) for (const [y, a, b] of list) g.rect(a + dx, y + dy, b - a, 1).fill(o);
  for (const [y, a, b] of list) g.rect(a, y, b - a, 1).fill(fill);
}

/** The wings of a bat in pose 0 (raised) or 1 (lowered), mirrored for the right side. */
function wingRows(side: -1 | 1, pose: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 11; i++) {
    // Raised: the wing climbs and widens up and out; lowered: it sweeps out and down.
    const y = pose === 0 ? -22 - i : -24 + i;
    const reach = pose === 0 ? 3 + Math.round(i * 1.1) : 3 + Math.round(Math.min(i, 8) * 1.3);
    const a = side < 0 ? -3 - reach : 3;
    const b = side < 0 ? -3 : 3 + reach;
    // Scalloped trailing edge: every third row is shorter.
    const trim = i % 3 === 2 ? 1 : 0;
    out.push([y, side < 0 ? a + trim : a, side < 0 ? b : b - trim]);
  }
  return out;
}

/**
 * An enemy, feet at (0, 0). `white` draws the same shapes in white (the hit flash). `phase` picks a pose:
 * the bat's wing beat (even = raised, odd = lowered) and the slime's squash (even = tall, odd = flat).
 */
export function drawEnemy(kind: EnemyKind, mimic: boolean, white = false, phase = 0): Graphics {
  const g = new Graphics();
  const c = (hex: string): string => (white ? '#ffffff' : hex);
  const o = white ? '#ffffff' : CRYPT_OUTLINE;
  const ph = ((phase % 2) + 2) % 2;
  if (!white) shadow(g, mimic ? 28 : kind === 'bone_king' ? 36 : kind === 'bat' ? 14 : 22);
  if (mimic) {
    // A treasure chest with a mouth: iron bands, a lolling tongue, a row of teeth and two yellow eyes.
    box(g, -14, 0, 28, 6, 12, c(P.oak), o);
    g.rect(-13, -10, 26, 1).fill(c(P.walnut));
    for (const x of [-10, 8]) g.rect(x, -11, 3, 11).fill(c(P.slate));
    g.rect(-14, -26, 28, 9).fill(o);
    g.rect(-13, -25, 26, 8).fill(c(P.oak));
    g.rect(-13, -25, 26, 1).fill(c(P.sand));
    g.rect(-12, -18, 24, 5).fill(c(P.crimson)); // the open mouth
    for (let k = 0; k < 6; k++) g.rect(-11 + k * 4, -18, 2, 3).fill(c(P.white));
    for (let k = 0; k < 5; k++) g.rect(-9 + k * 4, -14, 2, 2).fill(c(P.cream));
    g.rect(-3, -14, 6, 6).fill(o);
    g.rect(-2, -14, 4, 6).fill(c(P.rose)); // the tongue
    g.rect(-1, -9, 2, 1).fill(c(P.red));
    g.rect(-9, -23, 3, 3).fill(c(P.butter));
    g.rect(6, -23, 3, 3).fill(c(P.butter));
    g.rect(-8, -22, 1, 1).fill(o);
    g.rect(7, -22, 1, 1).fill(o);
    for (const x of [-10, 8]) g.rect(x, -25, 3, 8).fill(c(P.slate));
    return g;
  }
  switch (kind) {
    case 'slime': {
      // A squashy blob: lit top-left, dark underbelly, two big eyes with a shine.
      const rx = ph === 0 ? 11 : 13;
      const ry = ph === 0 ? 8 : 6;
      const cy = -ry;
      blob(g, 0, cy, rx + 1, ry + 1, o);
      blob(g, 0, cy, rx, ry, c(P.green));
      blob(g, 3, cy + 2, rx - 4, ry - 3, c(P.forest));
      g.rect(-rx + 3, cy + 1, 2 * rx - 6, 1).fill(c(P.green));
      blob(g, -3, cy - ry + 3, Math.max(3, rx - 7), 2, c(P.lime));
      g.rect(-rx + 3, cy - 1, 2, 1).fill(c(P.lime));
      const ey = cy - 1;
      g.rect(-6, ey - 1, 4, 5).fill(c(P.white));
      g.rect(2, ey - 1, 4, 5).fill(c(P.white));
      g.rect(-5, ey + 1, 2, 3).fill(o);
      g.rect(3, ey + 1, 2, 3).fill(o);
      g.rect(-5, ey + 1, 1, 1).fill(c(P.white));
      g.rect(3, ey + 1, 1, 1).fill(c(P.white));
      g.rect(-2, ey + 5, 4, 1).fill(o);
      break;
    }
    case 'skeleton': {
      const bone = c(P.silver);
      const lit = c(P.cream);
      const dark = c(P.steel);
      // Legs, a pelvis, a rib cage with rib lines, arms, a skull with a jaw.
      part(g, -6, -16, 4, 16, bone, o);
      part(g, 2, -16, 4, 16, bone, o);
      g.rect(-5, -16, 1, 16).fill(lit);
      g.rect(3, -16, 1, 16).fill(lit);
      part(g, -7, -19, 14, 4, dark, o);
      part(g, -8, -32, 16, 13, bone, o);
      g.rect(-7, -32, 14, 1).fill(lit);
      for (const y of [-30, -27, -24, -21]) g.rect(-6, y, 12, 1).fill(o);
      g.rect(-1, -31, 2, 11).fill(dark);
      part(g, -12, -31, 3, 13, bone, o);
      part(g, 9, -31, 3, 13, bone, o);
      part(g, -7, -44, 14, 11, bone, o);
      g.rect(-6, -44, 12, 1).fill(lit);
      g.rect(-5, -41, 4, 4).fill(o);
      g.rect(1, -41, 4, 4).fill(o);
      g.rect(-4, -40, 1, 1).fill(c(P.red));
      g.rect(2, -40, 1, 1).fill(c(P.red));
      g.rect(-1, -37, 2, 2).fill(o);
      for (let k = 0; k < 5; k++) g.rect(-5 + k * 2, -35, 1, 2).fill(o);
      // A rusty sword in the right hand.
      part(g, 12, -40, 3, 22, c(P.steel), o);
      g.rect(13, -40, 1, 22).fill(c(P.silver));
      g.rect(13, -34, 2, 3).fill(c(P.rust));
      g.rect(12, -26, 2, 2).fill(c(P.rust));
      part(g, 10, -19, 7, 2, c(P.walnut), o);
      part(g, 12, -17, 3, 5, c(P.walnut), o);
      break;
    }
    case 'bat': {
      // It flies: the body floats above its shadow; wings beat between two poses.
      rows(g, wingRows(-1, ph), c(P.plum), o);
      rows(g, wingRows(1, ph), c(P.plum), o);
      // Wing bones.
      const w0 = wingRows(-1, ph);
      const w1 = wingRows(1, ph);
      for (const [y, a] of [w0[3]!, w0[7]!]) g.rect(a + 1, y, 3, 1).fill(c(P.orchid));
      for (const [y, , b] of [w1[3]!, w1[7]!]) g.rect(b - 4, y, 3, 1).fill(c(P.orchid));
      part(g, -5, -26, 10, 9, c(P.orchid), o);
      g.rect(-4, -26, 8, 1).fill(c(P.rose));
      g.rect(-5, -29, 3, 3).fill(o);
      g.rect(2, -29, 3, 3).fill(o);
      g.rect(-4, -28, 1, 2).fill(c(P.orchid));
      g.rect(3, -28, 1, 2).fill(c(P.orchid));
      g.rect(-3, -23, 2, 2).fill(c(P.red));
      g.rect(1, -23, 2, 2).fill(c(P.red));
      g.rect(-2, -19, 1, 2).fill(c(P.white));
      g.rect(1, -19, 1, 2).fill(c(P.white));
      break;
    }
    case 'bone_king': {
      const bone = c(P.silver);
      const lit = c(P.cream);
      // A tattered plum cloak over bone armour; the crown flame is the one warm light.
      part(g, -10, -22, 6, 22, bone, o);
      part(g, 4, -22, 6, 22, bone, o);
      g.rect(-9, -22, 1, 22).fill(lit);
      g.rect(5, -22, 1, 22).fill(lit);
      const cloak: [number, number, number][] = [];
      for (let y = -23; y < -1; y++) {
        const half = 15 + Math.floor((y + 23) / 4);
        cloak.push([y, -half, half]);
      }
      rows(g, cloak, c(P.plum), o);
      for (let y = -23; y < -1; y += 6) {
        const half = 15 + Math.floor((y + 23) / 4);
        g.rect(-half, y, half * 2, 1).fill(c(P.dusk));
      }
      for (const x of [-18, -8, 2, 12]) g.rect(x, -3, 4, 3).fill(o); // the ragged hem
      part(g, -14, -44, 28, 8, c(P.steel), o); // pauldrons and gorget
      g.rect(-13, -44, 26, 1).fill(c(P.silver));
      for (const x of [-14, 10]) { g.rect(x, -49, 4, 6).fill(o); g.rect(x + 1, -48, 2, 5).fill(c(P.steel)); }
      part(g, -9, -36, 18, 14, bone, o); // chest
      for (const y of [-34, -31, -28, -25]) g.rect(-7, y, 14, 1).fill(o);
      part(g, -9, -57, 18, 13, bone, o); // skull
      g.rect(-8, -57, 16, 1).fill(lit);
      g.rect(-6, -53, 5, 5).fill(o);
      g.rect(1, -53, 5, 5).fill(o);
      g.rect(-5, -52, 2, 2).fill(c(P.orange));
      g.rect(2, -52, 2, 2).fill(c(P.orange));
      g.rect(-1, -49, 2, 2).fill(o);
      for (let k = 0; k < 6; k++) g.rect(-6 + k * 2, -46, 1, 2).fill(o);
      // The crown: a gold band with three flames (the boss's warm light).
      g.rect(-10, -63, 20, 6).fill(o);
      g.rect(-9, -62, 18, 4).fill(c(P.gold));
      g.rect(-9, -62, 18, 1).fill(c(P.butter));
      g.rect(-9, -59, 18, 1).fill(c(P.orange));
      for (const x of [-8, -2, 4]) {
        g.rect(x - 1, -68, 6, 7).fill(o);
        g.rect(x, -67, 4, 6).fill(c(P.orange));
        g.rect(x + 1, -66, 2, 5).fill(c(P.gold));
      }
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
  shadow(g, 32);
  const body = golden ? P.gold : P.oak;
  const lidC = golden ? P.butter : P.sand;
  const band = golden ? P.orange : P.slate;
  const bandLit = golden ? P.butter : P.steel;
  // The body: planks with seams, two iron (or gilded) bands, a lit left edge.
  box(g, -14, 0, 28, 6, 10, body);
  if (!golden) for (const x of [-6, 2, 9]) g.rect(x, -9, 1, 9).fill(P.walnut);
  for (const x of [-11, 8]) {
    g.rect(x, -10, 4, 10).fill(band);
    g.rect(x, -10, 1, 10).fill(bandLit);
    g.rect(x + 1, -7, 1, 1).fill(golden ? P.rust : P.silver);
    g.rect(x + 1, -3, 1, 1).fill(golden ? P.rust : P.silver);
  }
  g.rect(-13, -2, 26, 2).fill(shade(body, 0.75));
  if (open <= 0) {
    // The lid: a lighter top with the bands running over it and a lock plate.
    box(g, -14, -10, 28, 8, 4, lidC);
    for (const x of [-11, 8]) {
      g.rect(x, -22, 4, 12).fill(band);
      g.rect(x, -22, 1, 12).fill(bandLit);
    }
    g.rect(-3, -14, 6, 6).fill(CRYPT_OUTLINE);
    g.rect(-2, -13, 4, 4).fill(golden ? P.red : P.gold);
    g.rect(-1, -12, 1, 1).fill(CRYPT_OUTLINE);
    g.rect(-1, -13, 1, 1).fill(golden ? P.rose : P.butter);
  } else {
    // Inside: dark, with a warm gleam of loot; the lid tilted up behind it.
    g.rect(-13, -16, 26, 6).fill(CRYPT_OUTLINE);
    g.rect(-11, -15, 22, 4).fill(P.walnut);
    const gleam = Math.min(1, open);
    g.rect(-9, -15, 18, 2).fill({ color: P.gold, alpha: 0.4 + 0.4 * gleam });
    g.rect(-4, -14, 8, 1).fill({ color: P.butter, alpha: gleam });
    const lift = Math.round(8 * Math.min(1, open));
    box(g, -14, -16, 28, 2, 4 + lift, shade(lidC, 0.85));
    for (const x of [-11, 8]) g.rect(x, -22 - lift, 4, 4 + lift).fill(band);
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
