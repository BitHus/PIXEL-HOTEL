// Draws the blocks of a room (step BG5): one coloured cube per cell of the foreground layer, in the
// depth-sorted object list (so avatars walk in front of and behind them), with cracks per stage,
// a short shake when punched, a puff of bits when one breaks, and the ghost of the block about to
// be placed. RENDERING ONLY: what stands where, and how hard it is, comes from the room (the rules
// are in shared/src/blocks.ts). Art is placeholder boxes drawn in code (palette names from the data).

import { Container, Graphics, Sprite } from 'pixi.js';
import { BUILD_CELL, blockList, crackStage, getBlockType, paletteColor, type BlockType, type PaletteName, type Room } from '@pixel-hotel/shared';
import type { DepthKey } from './depthOrder.ts';
import type { RoomView } from './roomView.ts';
import { spriteTexture } from './spriteStore.ts';

const SHAKE_MS = 140;
const PUFF_MS = 420;
const TOP = 11; // px of the cell the top face takes; the front face is the rest (slight front angle)

/** Lighter / darker versions of a palette colour (mix with white or the outline colour). */
function mix(hex: string, with_: string, k: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(with_.slice(1), 16);
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

const px = (g: Graphics, x: number, y: number, w: number, h: number, color: string, alpha = 1): void => {
  g.rect(x, y, w, h).fill({ color, alpha });
};

/** A tiny deterministic hash, for the speckles of a block's face. */
function speckles(id: string, n: number): { x: number; y: number }[] {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    out.push({ x: 3 + ((h >>> 3) % 24), y: TOP + 2 + ((h >>> 11) % 15) });
  }
  return out;
}

/** The block's PNG (assets/sprites/blocks/<id>.png, 32 x 32; the same picture is the item icon, ui/itemIcon.ts) as a sprite, or null: the code cube is drawn then. */
export function blockSprite(id: string): Sprite | null {
  const tex = spriteTexture('blocks', id);
  return tex ? new Sprite(tex) : null;
}

/** Draws one block cube on a 32 x 32 cell (top-left at 0, 0). */
export function drawBlockArt(g: Graphics, type: BlockType): void {
  const [c0, c1] = type.icon.colors as [PaletteName, PaletteName | undefined];
  const main = paletteColor(c0);
  const accent = paletteColor(c1 ?? c0);
  const outline = paletteColor('outline');
  const glass = type.id === 'glass';
  px(g, 0, 0, BUILD_CELL, BUILD_CELL, outline);
  // Top face (lit from the top-left), then the front face with a darker bottom row.
  px(g, 1, 1, BUILD_CELL - 2, TOP - 1, glass ? mix(accent, '#ffffff', 0.2) : mix(accent, '#ffffff', 0.15));
  px(g, 1, TOP, BUILD_CELL - 2, BUILD_CELL - TOP - 1, glass ? mix(main, '#ffffff', 0.35) : main);
  px(g, 1, BUILD_CELL - 3, BUILD_CELL - 2, 2, mix(main, outline, 0.35));
  px(g, 1, 1, BUILD_CELL - 2, 1, mix(accent, '#ffffff', 0.45));
  px(g, 1, TOP, 1, BUILD_CELL - TOP - 1, mix(main, '#ffffff', 0.25));
  if (type.id === 'brick') {
    // Mortar lines: three rows of bricks, joints shifted every second row.
    const mortar = mix(main, '#ffffff', 0.45);
    for (let r = 0; r < 3; r++) {
      const y = TOP + 6 * (r + 1) - 1;
      px(g, 1, y, BUILD_CELL - 2, 1, mortar);
      const off = r % 2 === 0 ? 8 : 16;
      for (let x = off; x < BUILD_CELL - 1; x += 16) px(g, x, y - 5, 1, 5, mortar);
    }
  } else if (type.id === 'planks') {
    for (const y of [TOP + 6, TOP + 12]) px(g, 1, y, BUILD_CELL - 2, 1, mix(main, outline, 0.4));
    for (const [x, y] of [[8, TOP + 3], [22, TOP + 9], [12, TOP + 15]] as const) px(g, x, y, 2, 1, mix(main, outline, 0.5));
  } else if (glass) {
    px(g, 5, TOP + 3, 2, 9, '#ffffff', 0.8);
    px(g, 9, TOP + 3, 1, 5, '#ffffff', 0.6);
    px(g, 22, TOP + 11, 4, 1, '#ffffff', 0.5);
  } else if (type.id === 'lantern_block') {
    // A glowing window in the front.
    px(g, 9, TOP + 3, 14, 11, outline);
    px(g, 10, TOP + 4, 12, 9, paletteColor('butter'));
    px(g, 13, TOP + 6, 6, 5, '#ffffff');
    px(g, 15, TOP + 3, 2, 11, outline);
    px(g, 9, TOP + 8, 14, 1, outline);
  } else {
    const dark = mix(main, outline, 0.3);
    const light = mix(main, '#ffffff', 0.2);
    speckles(type.id, 7).forEach((s, i) => px(g, s.x, s.y, 2, 1 + (i % 2), i % 3 === 0 ? light : dark));
    if (type.id === 'stone' || type.id === 'mossy_stone' || type.id === 'cinder_block') px(g, 1, TOP + 8, BUILD_CELL - 2, 1, dark);
    if (type.id === 'mossy_stone') for (const x of [3, 9, 15, 24]) px(g, x, TOP, 4, 2, paletteColor('lime'));
    if (type.id === 'cinder_block') for (const [x, y] of [[7, TOP + 4], [20, TOP + 11], [14, TOP + 2]] as const) px(g, x, y, 3, 2, paletteColor('orange'));
  }
}

/** The crack lines of a stage (1 to 3), in whole pixels on the front face. */
function drawCracks(g: Graphics, stage: number): void {
  g.clear();
  if (stage <= 0) return;
  const c = paletteColor('outline');
  const line = (pts: [number, number][]): void => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) px(g, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1, c);
    }
  };
  line([[15, TOP + 1], [13, TOP + 6], [16, TOP + 9]]);
  if (stage >= 2) {
    line([[16, TOP + 9], [20, TOP + 12], [19, TOP + 17]]);
    line([[13, TOP + 6], [8, TOP + 8], [6, TOP + 13]]);
  }
  if (stage >= 3) {
    line([[22, TOP + 4], [20, TOP + 7], [24, TOP + 10]]);
    line([[8, TOP + 8], [10, TOP + 14], [14, TOP + 17]]);
    line([[26, TOP + 12], [23, TOP + 16]]);
  }
}

interface BlockView {
  id: string;
  c: number;
  r: number;
  node: Container;
  cracks: Graphics;
  stage: number;
  shakeMs: number;
}

interface Bit {
  g: Graphics;
  vx: number;
  vy: number;
  age: number;
}

export class BlockViews {
  private readonly views = new Map<string, BlockView>();
  private roomId = -1;
  private readonly bits: Bit[] = [];
  private readonly ghost = new Container();
  private readonly ghostArt = new Graphics();
  private ghostSprite: Sprite | null = null;
  private readonly ghostFrame = new Graphics();
  private ghostFor = '';

  constructor(private readonly view: RoomView) {
    this.ghost.addChild(this.ghostArt, this.ghostFrame);
    this.ghost.visible = false;
    this.ghost.alpha = 0.75;
    view.ghostLayer.addChild(this.ghost);
  }

  /** Shows the blocks of this room: adds, removes and re-stages cracks (the heal runs with time). */
  sync(room: Room, now: number): void {
    if (room.id !== this.roomId) {
      for (const v of this.views.values()) this.drop(v);
      this.views.clear();
      this.roomId = room.id;
    }
    const live = new Set<string>();
    for (const { c, r, block } of blockList(room)) {
      const key = `${c},${r}`;
      live.add(key);
      let v = this.views.get(key);
      if (v && v.id !== block.id) {
        this.drop(v);
        this.views.delete(key);
        v = undefined;
      }
      const type = getBlockType(block.id);
      if (!v) {
        const node = new Container();
        // A block PNG when there is one (step H2), else the code cube; the crack stages stay code-drawn on top.
        const art = blockSprite(block.id) ?? new Graphics();
        if (art instanceof Graphics) drawBlockArt(art, type);
        const cracks = new Graphics();
        node.addChild(art, cracks);
        node.position.set(c * BUILD_CELL, r * BUILD_CELL);
        node.eventMode = 'none';
        v = { id: block.id, c, r, node, cracks, stage: 0, shakeMs: 0 };
        this.views.set(key, v);
        this.view.objects.add(node, this.keyOf(c, r));
      }
      const stage = crackStage(block, type.hardness, now);
      if (stage !== v.stage) {
        v.stage = stage;
        drawCracks(v.cracks, stage);
      }
    }
    for (const [key, v] of [...this.views]) {
      if (live.has(key)) continue;
      this.drop(v);
      this.views.delete(key);
    }
  }

  private keyOf(c: number, r: number): DepthKey {
    // Like an item whose foot is the cell's bottom edge; negative uids never tie with items or avatars.
    return { y: (r + 1) * BUILD_CELL, x: c * BUILD_CELL + BUILD_CELL / 2, uid: -2_000_000 - r * 1000 - c };
  }

  private drop(v: BlockView): void {
    this.view.objects.remove(v.node);
    v.node.destroy({ children: true });
  }

  /** A punch: the block shakes for a moment. */
  punch(c: number, r: number): void {
    const v = this.views.get(`${c},${r}`);
    if (v) v.shakeMs = SHAKE_MS;
  }

  /** A block broke (it is already gone from the room): a puff of bits in its colours. */
  breakFx(c: number, r: number, id: string): void {
    const type = getBlockType(id);
    const colors = type.icon.colors.map((n) => paletteColor(n));
    for (let i = 0; i < 8; i++) {
      const g = new Graphics();
      px(g, 0, 0, 3, 3, colors[i % colors.length] ?? '#ffffff');
      g.position.set(c * BUILD_CELL + 10 + (i % 3) * 5, r * BUILD_CELL + 14 + (i % 2) * 6);
      this.view.markerLayer.addChild(g);
      const a = (i / 8) * Math.PI * 2;
      this.bits.push({ g, vx: Math.cos(a) * 50, vy: Math.sin(a) * 40 - 30, age: 0 });
    }
  }

  /** Every frame: shakes and bits. */
  update(dtMs: number): void {
    for (const v of this.views.values()) {
      if (v.shakeMs > 0) {
        v.shakeMs = Math.max(0, v.shakeMs - dtMs);
        v.node.x = v.c * BUILD_CELL + (v.shakeMs > 0 ? (Math.floor(v.shakeMs / 35) % 2 === 0 ? 1 : -1) : 0);
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

  /** The ghost of the block that would be placed in a cell (green = fits, red = not); null hides it. */
  showGhost(at: { c: number; r: number; id: string; valid: boolean } | null): void {
    if (!at) {
      this.ghost.visible = false;
      return;
    }
    const key = `${at.id}`;
    if (key !== this.ghostFor) {
      this.ghostFor = key;
      this.ghostArt.clear();
      this.ghostSprite?.destroy();
      this.ghostSprite = blockSprite(at.id);
      if (this.ghostSprite) this.ghost.addChildAt(this.ghostSprite, 0);
      else drawBlockArt(this.ghostArt, getBlockType(at.id));
    }
    this.ghostFrame.clear();
    const color = paletteColor(at.valid ? 'lime' : 'red');
    this.ghostFrame.rect(0, 0, BUILD_CELL, BUILD_CELL).stroke({ width: 2, color, alignment: 1 });
    this.ghostArt.alpha = at.valid ? 0.55 : 0.3;
    if (this.ghostSprite) this.ghostSprite.alpha = at.valid ? 0.55 : 0.3;
    this.ghost.position.set(at.c * BUILD_CELL, at.r * BUILD_CELL);
    this.ghost.visible = true;
  }
}
