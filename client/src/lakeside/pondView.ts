// POND (A3, docs/NOTES.md POND ART SET): the lakeside's pond drawn from the vertex grid (shared LAKE_LEVELS) with the corner-mask
// tile sheets, the 4-frame water drift on solid water cells (a phase per cell), the pier deck and its end cap, and the fixed pond
// decor (rowboat and rocks flat on the ground; reeds and the lantern post in the depth-sorted list). Sprites are never scaled.
// Without the PNGs (tests, a failed load) the cells are flat colour boxes. Look only: no rules here.

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { cellCorners, isPierCell, LAKE_CELL, LAKE_COLS, LAKE_PIER, LAKE_POND_DECOR, LAKE_ROWS, PALETTE } from '@pixel-hotel/shared';
import type { RoomView } from '../render/roomView.ts';
import { spriteFrames, spriteTexture } from '../render/spriteStore.ts';
import { driftFrame, pickPondTile, tileFrame, type PondSheet } from './pondTiles.ts';

const DECOR_FILE = { reeds: 'reeds', rocks: 'rocks', rowboat: 'rowboat', lantern: 'lantern_post' } as const;
/** Flat fallback colours by terrain level (sand, shallow, deep). */
const FLAT = [PALETTE[13]!, PALETTE[2]!, PALETTE[18]!, PALETTE[17]!];

const tileCache = new Map<string, Texture | null>();

/** Tile `idx` of a sheet as a texture (cached), or null when the sheet is not loaded. */
function tileTexture(sheet: PondSheet, idx: number): Texture | null {
  const key = `${sheet}/${idx}`;
  const base = spriteTexture('lake', sheet);
  const hit = tileCache.get(key);
  if (hit && base && hit.source === base.source) return hit;
  if (!base) return null;
  const f = tileFrame(idx, LAKE_CELL);
  const t = new Texture({ source: base.source, frame: new Rectangle(base.frame.x + f.x, base.frame.y + f.y, f.w, f.h) });
  tileCache.set(key, t);
  return t;
}

export class PondView {
  /** The pond tiles, then the pier deck: goes on the ground layer (under the life layer's lily pads). */
  readonly water = new Container({ eventMode: 'none' });
  /** The pier and the flat decor above the lily pads and fish shadows. */
  readonly deck = new Container({ eventMode: 'none' });
  private drift: { sprite: Sprite; c: number; r: number; frames: Texture[] }[] = [];
  private standing: Container[] = [];
  private lastStep = -1;

  constructor(private readonly view: RoomView) {}

  build(): void {
    this.destroy();
    const shallow = spriteFrames('lake', 'water_shallow', 'drift', LAKE_CELL);
    const deep = spriteFrames('lake', 'water_deep', 'drift', LAKE_CELL);
    const flat = new Graphics();
    this.water.addChild(flat);
    for (let r = 0; r < LAKE_ROWS; r++) {
      for (let c = 0; c < LAKE_COLS; c++) {
        const corners = cellCorners(c, r);
        const tile = pickPondTile(corners);
        if (!tile) continue;
        const frames = tile.drift === 'shallow' ? shallow : tile.drift === 'deep' ? deep : null;
        const tex = frames?.[0] ?? tileTexture(tile.sheet, tile.idx);
        if (!tex) {
          flat.rect(c * LAKE_CELL, r * LAKE_CELL, LAKE_CELL, LAKE_CELL).fill(FLAT[Math.round(corners.reduce((a, b) => a + b, 0) / 4)]!);
          continue;
        }
        const s = new Sprite(tex);
        s.position.set(c * LAKE_CELL, r * LAKE_CELL);
        this.water.addChild(s);
        if (frames) this.drift.push({ sprite: s, c, r, frames });
      }
    }
    this.buildPier();
    for (const [i, d] of LAKE_POND_DECOR.entries()) {
      const tex = spriteTexture('lake', DECOR_FILE[d.kind]);
      if (!tex) continue;
      const s = new Sprite(tex);
      s.anchor.set(0.5, 1);
      if (d.kind === 'rowboat' || d.kind === 'rocks') {
        s.position.set(d.x, d.y);
        this.deck.addChild(s);
      } else {
        const c = new Container({ eventMode: 'none' });
        c.position.set(d.x, d.y);
        c.addChild(s);
        this.view.objects.add(c, { y: d.y, x: d.x, uid: -2_300_000 - i });
        this.standing.push(c);
      }
    }
  }

  /** The deck: plank tiles 0 / 1 by (c + r) % 2 running east-west, the end cap (turned to east-west) on the last cell, a dark rim on the water sides. */
  private buildPier(): void {
    const p = LAKE_PIER;
    const across = p.w >= p.h;
    const a = [spriteTexture('lake', across ? 'pier_deck_h0' : 'pier_deck_v0'), spriteTexture('lake', across ? 'pier_deck_h1' : 'pier_deck_v1')];
    const cap = spriteTexture('lake', 'pier_cap');
    const rim = new Graphics();
    const cells: { c: number; r: number }[] = [];
    for (let y = p.y; y < p.y + p.h; y += LAKE_CELL) for (let x = p.x; x < p.x + p.w; x += LAKE_CELL) cells.push({ c: x / LAKE_CELL, r: y / LAKE_CELL });
    const last = cells[cells.length - 1]!;
    for (const { c, r } of cells) {
      const x = c * LAKE_CELL;
      const y = r * LAKE_CELL;
      const isEnd = c === last.c && r === last.r && cap;
      const tex = isEnd ? cap : a[(c + r) % 2];
      if (!tex) {
        rim.rect(x, y, LAKE_CELL, LAKE_CELL).fill(PALETTE[4]!);
        continue;
      }
      const s = new Sprite(tex);
      if (isEnd && across) {
        // The cap is drawn north-south: a quarter turn (lossless) makes it the east end.
        s.anchor.set(0.5);
        s.rotation = -Math.PI / 2;
        s.position.set(x + LAKE_CELL / 2, y + LAKE_CELL / 2);
      } else s.position.set(x, y);
      this.deck.addChild(s);
      // A 1 px outline (the art's outline colour) on the sides that touch water.
      if (!isPierCell(c, r - 1)) rim.rect(x, y - 1, LAKE_CELL, 1).fill(PALETTE[6]!);
      if (!isPierCell(c, r + 1)) rim.rect(x, y + LAKE_CELL, LAKE_CELL, 1).fill(PALETTE[6]!);
    }
    this.deck.addChild(rim);
  }

  /** Steps the water drift (each solid water cell on its own phase). */
  update(clockMs: number, reduce: boolean): void {
    const step = reduce ? 0 : Math.floor(clockMs / 250);
    if (step === this.lastStep) return;
    this.lastStep = step;
    for (const d of this.drift) d.sprite.texture = d.frames[reduce ? 0 : driftFrame(d.c, d.r, clockMs, d.frames.length)]!;
  }

  destroy(): void {
    for (const c of this.standing) {
      this.view.objects.remove(c);
      c.destroy({ children: true });
    }
    this.standing = [];
    this.drift = [];
    this.water.removeChildren().forEach((c) => c.destroy());
    this.deck.removeChildren().forEach((c) => c.destroy());
    this.lastStep = -1;
  }
}
