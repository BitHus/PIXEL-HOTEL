// FISH ART (ART-2, artist): the swimming fish as a DOM sprite. The sheet client/src/assets/fishing/fish_swim.png
// (Aseprite, 4 frames of 24 x 12, facing RIGHT, key colours body #ff0044, belly #fee761, fin #f77622) is
// recoloured with a fish's two icon colours and cached as a data URL; the CSS (ui/fishingUi.css, .fx-fish)
// steps through the 4 frames (tail wiggle) and mirrors it for facing left. No rules in here.
//
//   const f = createFishSprite(['orange', 'gold']);   // or fishColors('lantern_carp')
//   f.el          the element (.fx-fish; size set by --fx-scale, default 2 = 48 x 24 px)
//   f.face('left' | 'right')    mirror
//   f.speed(0..1)               tail beat: 0 = lazy (700 ms a cycle), 1 = darting (240 ms)

import fishSheetUrl from '../assets/fishing/fish_swim.png';
import { PALETTE_NAMES, isPaletteName, paletteColor, type PaletteName } from '@pixel-hotel/shared';

export const FISH_FRAME_W = 24;
export const FISH_FRAME_H = 12;
export const FISH_FRAMES = 4;

const KEY_BODY = [0xff, 0x00, 0x44];
const KEY_BELLY = [0xfe, 0xe7, 0x61];
const KEY_FIN = [0xf7, 0x76, 0x22];

let sheet: HTMLImageElement | null = null;
let sheetReady: Promise<void> | null = null;
const urlCache = new Map<string, string>();
const waiting = new Set<() => void>();

function loadSheet(): void {
  if (sheetReady) return;
  sheet = new Image();
  sheetReady = new Promise<void>((resolve) => {
    sheet!.onload = () => resolve();
    sheet!.onerror = () => resolve();
  });
  sheet.src = fishSheetUrl;
  void sheetReady.then(() => {
    for (const fn of waiting) fn();
    waiting.clear();
  });
}

function rgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function darker(c: number[], k: number): number[] {
  return c.map((v) => Math.round(v * k));
}

/** The two colours of a fish, as palette names (the data's icon colours). */
export function paletteHex(name: string, fallback: PaletteName): string {
  return paletteColor(isPaletteName(name) ? name : fallback);
}

/** A data URL of the whole sheet recoloured (body, belly, fin = a darker body), or '' while it loads or in a test. */
export function fishSheetFor(bodyName: string, bellyName: string): string {
  const key = `${bodyName}|${bellyName}`;
  const hit = urlCache.get(key);
  if (hit !== undefined) return hit;
  if (!sheet || !sheet.complete || sheet.naturalWidth === 0 || typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = sheet.naturalWidth;
  c.height = sheet.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const body = rgb(paletteHex(bodyName, PALETTE_NAMES[9]));
  const belly = rgb(paletteHex(bellyName, PALETTE_NAMES[11]));
  const fin = darker(body, 0.78);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const m = (k: number[]): boolean => d[i] === k[0] && d[i + 1] === k[1] && d[i + 2] === k[2];
    const to = m(KEY_BODY) ? body : m(KEY_BELLY) ? belly : m(KEY_FIN) ? fin : null;
    if (to) {
      d[i] = to[0]!;
      d[i + 1] = to[1]!;
      d[i + 2] = to[2]!;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  urlCache.set(key, url);
  return url;
}

export interface FishSprite {
  readonly el: HTMLElement;
  /** Recolour (palette names). */
  paint(body: string, belly: string): void;
  face(dir: 'left' | 'right'): void;
  /** Tail beat speed 0 (lazy) to 1 (darting). */
  speed(v: number): void;
}

export function createFishSprite(colors: readonly string[] = ['orange', 'gold']): FishSprite {
  loadSheet();
  const el = document.createElement('div');
  el.className = 'fx-fish';
  el.setAttribute('aria-hidden', 'true');
  let body = colors[0] ?? 'orange';
  let belly = colors[1] ?? 'gold';
  const apply = (): void => {
    const url = fishSheetFor(body, belly);
    if (url) el.style.backgroundImage = `url(${url})`;
    else waiting.add(apply);
  };
  apply();
  return {
    el,
    paint(b, l) {
      if (b === body && l === belly) return;
      body = b;
      belly = l;
      apply();
    },
    face(dir) {
      el.dataset.face = dir;
    },
    speed(v) {
      const k = Math.max(0, Math.min(1, v));
      el.style.setProperty('--fx-beat', `${Math.round(700 - 460 * k)}ms`);
    },
  };
}
