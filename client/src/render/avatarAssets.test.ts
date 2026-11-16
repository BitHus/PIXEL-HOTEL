// U1/C17: every PNG in assets/sprites/avatar/ must follow the naming, size and key-colour rules (docs/PLAN-CHARACTERS.md sections 4 and 5).
// With zero PNGs (today) this passes: a missing sprite is never an error.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { keyChannelOf, PALETTE, PALETTE_NAMES, RIG, SLOT_KEYS, type RigPose } from '@pixel-hotel/shared';
import { parseAvatarFile } from './spriteIndex.ts';

const dir = join(import.meta.dirname, '..', 'assets', 'sprites', 'avatar');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : [];

/** Minimal PNG decode (8-bit, non-interlaced RGBA or RGB) to RGBA bytes; enough for pixel-art files. */
function decode(buf: Buffer): { w: number; h: number; rgba: Uint8Array } {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const depth = buf[24]!;
  const type = buf[25]!;
  expect(depth, 'bit depth').toBe(8);
  expect([2, 6], 'colour type RGB or RGBA').toContain(type);
  const bpp = type === 6 ? 4 : 3;
  const parts: Buffer[] = [];
  for (let p = 8; p < buf.length; ) {
    const len = buf.readUInt32BE(p);
    if (buf.toString('ascii', p + 4, p + 8) === 'IDAT') parts.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    const row = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      const pa = Math.abs(b - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + b - 2 * c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      row[i] = (row[i]! + pred) & 255;
    }
    for (let x = 0; x < w; x++) {
      out.set([row[x * bpp]!, row[x * bpp + 1]!, row[x * bpp + 2]!, bpp === 4 ? row[x * bpp + 3]! : 255], (y * w + x) * 4);
    }
    prev = row;
  }
  return { w, h, rgba: out };
}

const hexOf = (c: string): string => c.replace('#', '').toLowerCase();
const NAME_BY_HEX = new Map(PALETTE.map((hex, i) => [hexOf(hex), PALETTE_NAMES[i]!]));

describe('avatar layer PNGs', () => {
  it('the folder may be empty', () => {
    expect(files.length).toBeGreaterThanOrEqual(0);
  });
  for (const file of files) {
    it(`${file}: name, size and colours`, () => {
      const n = parseAvatarFile(file);
      expect(n, 'file name').not.toBeNull();
      const { w, h, rgba } = decode(readFileSync(join(dir, file)));
      expect(h, 'height 64').toBe(RIG.canvas.h);
      const pose = n!.anim as RigPose;
      const frames = n!.anim === 'still' ? 1 : RIG.poses[pose]?.frames;
      expect(frames, `anim ${n!.anim} is walk, sit or still`).toBeDefined();
      expect(w, 'width = frames * 32').toBe(frames! * RIG.canvas.w);
      const allowed = SLOT_KEYS[n!.slot];
      for (let i = 0; i < rgba.length; i += 4) {
        const a = rgba[i + 3]!;
        if (a === 0) continue;
        expect(a, 'no anti-aliasing').toBe(255);
        const hex = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('');
        const name = NAME_BY_HEX.get(hex);
        expect(name, `pixel #${hex} is Endesga 32`).toBeDefined();
        const ch = keyChannelOf(name!);
        // A key colour of a channel the layer does not use may still be a plain colour (hat or armour silver); only layers with
        // allowed keys recolour, and then every key of a FOREIGN channel is an error.
        if (allowed.length > 0 && ch) expect(allowed, `${name} is a key of ${ch}`).toContain(ch);
      }
    });
  }
});
