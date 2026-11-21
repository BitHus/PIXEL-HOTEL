// Art for the dig mine (MG-3 rules, MG-15 art): PNG tiles dungeon/dig_<block>.png (32 x 32 per block kind), dig_crack_1..3 (overlays), dig_cavein_armed and
// dig_cavein_fallen, dig_cavein_cracking (2-frame strip = the flash), dig_glint (3-frame strip); the code art below stays as the fallback per tile. The cave is one Graphics per row of blocks, so a
// dug block redraws only its own row and the row above (a block's front face depends on the cell below). Rendering only: it reads the run's
// DigState (kinds, hits, cave-in tiles) and draws it; no rules here.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { DIG_COLS, DUNGEON_BLOCK, digHitProgress, getMineBlock, paletteColor, type DigState, type MineBlockId, type PaletteName } from '@pixel-hotel/shared';
import { shade } from '../render/colors.ts';
import { spriteFrames, spriteTexture } from '../render/spriteStore.ts';

const B = DUNGEON_BLOCK;
const FRONT_H = 10;
const FLOOR: string = paletteColor('night');
const FLOOR_SPECK: string = paletteColor('dusk');
const OUTLINE: string = paletteColor('ink');

function hash(c: number, r: number): number {
  return ((c * 73856093) ^ (r * 19349663)) >>> 0;
}

function px(g: Graphics, x: number, y: number, w: number, h: number, color: string): void {
  g.rect(x, y, w, h).fill(color);
}

/** The crack lines of a block that took `done` of `total` hits (0, 1, 2 or 3 stages). */
function cracks(g: Graphics, x: number, y: number, done: number, total: number): void {
  const { stage } = digHitProgress(done, total);
  if (stage >= 1) {
    px(g, x + 9, y + 6, 6, 1, OUTLINE);
    px(g, x + 14, y + 7, 1, 6, OUTLINE);
  }
  if (stage >= 2) {
    px(g, x + 14, y + 12, 8, 1, OUTLINE);
    px(g, x + 21, y + 13, 1, 7, OUTLINE);
    px(g, x + 6, y + 15, 6, 1, OUTLINE);
  }
  if (stage >= 3) {
    px(g, x + 5, y + 19, 12, 1, OUTLINE);
    px(g, x + 16, y + 19, 1, 6, OUTLINE);
    px(g, x + 24, y + 8, 1, 6, OUTLINE);
  }
}

function drawSolid(g: Graphics, c: number, r: number, kind: MineBlockId, openBelow: boolean, hits: number, over: Graphics, sprites: Container): void {
  const tex = spriteTexture('dungeon', `dig_${kind}`);
  if (tex) {
    const x = c * B;
    const y = r * B;
    const sp = new Sprite(tex);
    sp.position.set(x, y);
    sprites.addChild(sp);
    const total = getMineBlock(kind).hits;
    if (openBelow && kind !== 'bedrock') {
      // The front face: the bottom strip of a block with floor below it is darker.
      over.rect(x, y + B - FRONT_H, B, FRONT_H).fill({ color: OUTLINE, alpha: 0.45 });
      over.rect(x, y + B - FRONT_H, B, 1).fill({ color: OUTLINE, alpha: 0.7 });
    }
    if (hits > 0 && total > 0) {
      const { stage } = digHitProgress(hits, total);
      const ct = spriteTexture('dungeon', `dig_crack_${stage}`);
      if (ct) {
        const cs = new Sprite(ct);
        cs.position.set(x, y);
        sprites.addChild(cs);
      } else cracks(over, x, y, hits, total);
    }
    return;
  }
  const b = getMineBlock(kind);
  const x = c * B;
  const y = r * B;
  const [topName, frontName] = b.colors as [PaletteName, PaletteName];
  const top = paletteColor(topName);
  const front = paletteColor(frontName);
  const h = hash(c, r);
  if (kind === 'bedrock') {
    px(g, x, y, B, B, paletteColor('ink'));
    px(g, x + 2 + (h & 7), y + 3, 6, 1, paletteColor('night'));
    px(g, x + 12 + ((h >> 3) & 7), y + 17, 8, 1, paletteColor('night'));
    return;
  }
  const filler = b.filler === true;
  const base = filler ? top : shade(paletteColor('slate'), 0.9);
  px(g, x, y, B, B, base);
  px(g, x, y, B, 1, shade(base, 1.35));
  px(g, x, y, 1, B, shade(base, 1.2));
  px(g, x + B - 1, y, 1, B, shade(base, 0.7));
  if (filler) {
    px(g, x + 4 + (h & 7), y + 5 + ((h >> 3) & 7), 4, 2, shade(base, 0.8));
    px(g, x + 15 + ((h >> 6) & 7), y + 17 + ((h >> 9) & 3), 5, 2, shade(base, 1.2));
  } else {
    // Ore: a cluster of flecks in the ore's own colours, sparkling a little for the rare ones.
    const spots: [number, number][] = [[6, 6], [18, 5], [11, 14], [22, 16], [7, 21], [17, 23]];
    spots.forEach(([sx, sy], i) => {
      const w = 4 + ((h >> (i * 2)) & 1);
      px(g, x + sx, y + sy, w, 3, i % 2 === 0 ? top : front);
      px(g, x + sx, y + sy, w, 1, shade(top, 1.3));
    });
    if (b.rare) px(g, x + 14, y + 12, 3, 3, paletteColor('white'));
  }
  if (openBelow) {
    px(over, x, y + B - FRONT_H, B, FRONT_H, shade(base, 0.62));
    px(over, x, y + B - FRONT_H, B, 1, shade(base, 0.4));
  }
  const total = b.hits;
  if (hits > 0 && total > 0) cracks(over, x, y, hits, total);
}

function caveTexture(state: 'armed' | 'cracking' | 'fallen', crackMs: number): Texture | null {
  if (state === 'cracking') {
    const frames = spriteFrames('dungeon', 'dig_cavein', 'cracking', B);
    return frames ? (frames[Math.floor(crackMs / 120) % frames.length] ?? null) : null;
  }
  return spriteTexture('dungeon', `dig_cavein_${state}`);
}

function drawFloor(g: Graphics, c: number, r: number, cave: { state: 'armed' | 'cracking' | 'fallen'; crackMs: number } | null, sprites: Container): void {
  const x = c * B;
  const y = r * B;
  const h = hash(c, r);
  px(g, x, y, B, B, FLOOR);
  if (h % 3 === 0) px(g, x + 4 + (h & 15), y + 6 + ((h >> 4) & 15), 3, 2, FLOOR_SPECK);
  if (!cave) return;
  const tex = caveTexture(cave.state, cave.crackMs);
  if (tex) {
    const sp = new Sprite(tex);
    sp.position.set(x, y);
    sprites.addChild(sp);
    return;
  }
  const rust = paletteColor('rust');
  if (cave.state === 'armed') {
    // A faint seam in the floor: you can see it before you step on it.
    px(g, x + 6, y + 8, 10, 1, shade(FLOOR_SPECK, 1.3));
    px(g, x + 15, y + 8, 1, 8, shade(FLOOR_SPECK, 1.3));
    px(g, x + 9, y + 20, 14, 1, shade(FLOOR_SPECK, 1.3));
  } else if (cave.state === 'cracking') {
    const flash = Math.floor(cave.crackMs / 120) % 2 === 0;
    px(g, x + 2, y + 2, B - 4, B - 4, flash ? paletteColor('red') : rust);
    px(g, x + 5, y + 10, B - 10, 2, OUTLINE);
    px(g, x + 14, y + 4, 2, B - 8, OUTLINE);
    px(g, x + 8, y + 22, B - 16, 2, OUTLINE);
  } else {
    // Fallen: rubble, done.
    px(g, x + 4, y + 8, 8, 6, shade(FLOOR_SPECK, 1.1));
    px(g, x + 16, y + 14, 9, 7, shade(FLOOR_SPECK, 0.9));
    px(g, x + 10, y + 22, 6, 4, shade(FLOOR_SPECK, 1.25));
  }
}

/** The whole cave: one Graphics per row, redrawn only where kinds, hits or cave-in tiles changed. */
export class DigLayer {
  readonly container = new Container();
  private rows: { base: Graphics; sprites: Container; top: Graphics }[] = [];
  private lastKinds: readonly (MineBlockId | '')[] | null = null;
  private lastHits: Record<number, number> = {};
  private lastHaz = '';
  private rowCount = 0;

  /** Forget everything (a new floor). */
  reset(): void {
    this.container.removeChildren().forEach((g) => g.destroy());
    this.rows = [];
    this.lastKinds = null;
    this.lastHits = {};
    this.lastHaz = '';
  }

  /** Brings the picture up to date with the dig state. Cheap when nothing changed (an identity check). */
  sync(dig: DigState, cols: number, rows: number): void {
    if (this.lastKinds === null || this.rowCount !== rows) {
      this.reset();
      this.rowCount = rows;
      for (let r = 0; r < rows; r++) {
        const root = new Container();
        const row = { base: new Graphics(), sprites: new Container(), top: new Graphics() };
        root.addChild(row.base, row.sprites, row.top);
        this.rows.push(row);
        this.container.addChild(root);
        this.drawRow(dig, cols, r);
      }
      this.lastKinds = dig.kinds;
      this.lastHits = { ...dig.hits };
      this.lastHaz = this.hazKey(dig);
      return;
    }
    const hazKey = this.hazKey(dig);
    if (dig.kinds === this.lastKinds && hazKey === this.lastHaz && sameHits(dig.hits, this.lastHits)) return;
    const dirty = new Set<number>();
    if (dig.kinds !== this.lastKinds) {
      for (let i = 0; i < dig.kinds.length; i++) {
        if (dig.kinds[i] !== this.lastKinds[i]) {
          const r = Math.floor(i / cols);
          dirty.add(r);
          if (r > 0) dirty.add(r - 1);
        }
      }
    }
    for (const k of new Set([...Object.keys(dig.hits), ...Object.keys(this.lastHits)])) {
      if ((dig.hits[Number(k)] ?? 0) !== (this.lastHits[Number(k)] ?? 0)) dirty.add(Math.floor(Number(k) / cols));
    }
    if (hazKey !== this.lastHaz) for (const h of dig.hazards) dirty.add(h.r);
    for (const r of dirty) this.drawRow(dig, cols, r);
    this.lastKinds = dig.kinds;
    this.lastHits = { ...dig.hits };
    this.lastHaz = hazKey;
  }

  private hazKey(dig: DigState): string {
    return dig.hazards.map((h) => `${h.state}${h.state === 'cracking' ? Math.floor(h.crackMs / 120) : ''}`).join(',');
  }

  private drawRow(dig: DigState, cols: number, r: number): void {
    const row = this.rows[r];
    if (!row) return;
    const g = row.base;
    g.clear();
    row.top.clear();
    row.sprites.removeChildren().forEach((ch) => ch.destroy());
    const hazards = new Map<number, (typeof dig.hazards)[number]>();
    for (const h of dig.hazards) hazards.set(h.r * DIG_COLS + h.c, h);
    for (let c = 0; c < cols; c++) {
      const cell = r * cols + c;
      const kind = dig.kinds[cell] as MineBlockId | '';
      if (kind === '') drawFloor(g, c, r, hazards.get(cell) ?? null, row.sprites);
      else drawSolid(g, c, r, kind, r + 1 < this.rowCount && dig.kinds[cell + cols] === '', dig.hits[cell] ?? 0, row.top, row.sprites);
    }
  }
}

function sameHits(a: Record<number, number>, b: Record<number, number>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[Number(k)] === b[Number(k)]);
}

/** A glint on a rare block: a small white star that blinks, drawn over the fog. Cell = row-major index. */
export function drawGlint(g: Graphics, cell: number, cols: number, clockMs: number): void {
  const c = cell % cols;
  const r = Math.floor(cell / cols);
  const x = c * B + 16;
  const y = r * B + 12;
  const phase = Math.floor(clockMs / 180 + cell) % 4;
  const frames = spriteFrames('dungeon', 'dig', 'glint', B);
  if (frames && frames.length >= 3) {
    // Frames: small, medium, large star; the blink runs small, medium, large, medium (the code star's phases).
    g.texture(frames[phase === 0 ? 0 : phase === 2 ? 2 : 1]!, 0xffffff, c * B, r * B);
    return;
  }
  const s = phase === 0 ? 1 : phase === 1 || phase === 3 ? 3 : 5;
  g.rect(x - s, y, s * 2 + 1, 1).fill(paletteColor('white'));
  g.rect(x, y - s, 1, s * 2 + 1).fill(paletteColor('white'));
  g.rect(x, y, 1, 1).fill(paletteColor('butter'));
}
