// Small pixel scenes for the Worlds panel (UI-2): one 48 x 30 picture per world, drawn with code in Endesga 32 only
// (shared/palette.ts), so the cards look like little windows into the places. A canvas per world, cached as a data URL.
// Light comes from the top-left; every scene has a dark warm outline row at the bottom edge.

import { PALETTE as P } from '@pixel-hotel/shared';

export type WorldId = 'hotel' | 'shop' | 'farm' | 'lakeside' | 'mine' | 'dungeon';

export const WORLD_ART_W = 48;
export const WORLD_ART_H = 30;

type Draw = (r: (x: number, y: number, w: number, h: number, c: number) => void) => void;

// Palette indices used below: 2 cream, 3 sand, 4 oak, 5 walnut, 6 outline, 7 crimson, 8 red, 9 orange, 10 gold,
// 11 butter, 12 lime, 13 green, 14 forest, 15 pine, 16 navy, 17 sky, 18 cyan, 20 silver, 21 steel, 22 slate,
// 23 dusk, 24 night, 25 ink, 31 tan.
const SCENES: Record<WorldId, Draw> = {
  // A bedroom: back wall with a window, planks, a bed with a red blanket.
  hotel: (r) => {
    r(0, 0, 48, 14, 5);
    r(0, 0, 48, 1, 4);
    r(0, 12, 48, 2, 6);
    r(30, 2, 12, 9, 6); // window
    r(31, 3, 10, 7, 17);
    r(31, 3, 10, 2, 18);
    r(35, 3, 2, 7, 6);
    r(31, 6, 10, 1, 6);
    r(0, 14, 48, 16, 4);
    for (let y = 17; y < 30; y += 4) r(0, y, 48, 1, 5);
    for (let x = 6; x < 48; x += 14) r(x, 14, 1, 16, 5);
    r(4, 15, 22, 12, 6); // bed
    r(5, 16, 20, 10, 2);
    r(5, 16, 6, 10, 3);
    r(11, 18, 14, 8, 7);
    r(11, 18, 14, 2, 8);
    r(5, 16, 6, 2, 2);
    r(34, 22, 8, 6, 6); // chest
    r(35, 23, 6, 4, 5);
    r(35, 23, 6, 1, 4);
    r(37, 25, 2, 1, 10);
  },
  // The tavern: a bar with mugs, a barrel, candle light.
  shop: (r) => {
    r(0, 0, 48, 13, 5);
    r(0, 0, 48, 1, 4);
    r(0, 11, 48, 2, 6);
    r(6, 3, 8, 6, 6); // shelf with bottles
    r(7, 4, 6, 4, 25);
    r(8, 4, 1, 4, 17);
    r(10, 5, 1, 3, 8);
    r(12, 4, 1, 4, 13);
    r(22, 2, 3, 5, 9); // hanging lamp glow
    r(23, 1, 1, 2, 6);
    r(23, 3, 1, 3, 11);
    r(0, 13, 48, 17, 4);
    for (let y = 16; y < 30; y += 4) r(0, y, 48, 1, 5);
    r(2, 14, 30, 4, 3); // bar top
    r(2, 14, 30, 1, 11);
    r(2, 18, 30, 8, 5);
    r(2, 18, 30, 1, 6);
    for (let x = 4; x < 30; x += 7) r(x, 20, 5, 5, 4);
    r(8, 11, 3, 3, 10); // mugs
    r(9, 11, 1, 1, 2);
    r(16, 11, 3, 3, 10);
    r(17, 11, 1, 1, 2);
    r(36, 14, 10, 14, 6); // barrel
    r(37, 15, 8, 12, 4);
    r(37, 15, 2, 12, 3);
    r(37, 18, 8, 1, 6);
    r(37, 23, 8, 1, 6);
    r(41, 20, 2, 2, 10);
  },
  // The farm: sky, grass, soil rows with sprouts, a fence.
  farm: (r) => {
    r(0, 0, 48, 12, 17);
    r(0, 0, 48, 4, 18);
    r(34, 2, 6, 6, 11); // sun
    r(35, 3, 4, 4, 10);
    r(0, 12, 48, 18, 13);
    r(0, 12, 48, 2, 12);
    for (let x = 0; x < 48; x += 4) r(x, 12, 1, 6, 15); // fence posts
    r(0, 14, 48, 1, 4);
    r(0, 16, 48, 1, 4);
    for (const y of [19, 24]) {
      r(4, y, 40, 4, 5);
      r(4, y, 40, 1, 4);
      for (let x = 7; x < 42; x += 6) {
        r(x, y - 3, 1, 3, 14);
        r(x - 1, y - 3, 1, 1, 12);
        r(x + 1, y - 4, 1, 1, 12);
      }
    }
    r(4, 22, 40, 1, 6);
  },
  // Lakeside: water, ripples, a pier, a tree.
  lakeside: (r) => {
    r(0, 0, 48, 10, 17);
    r(0, 0, 48, 3, 18);
    r(0, 10, 48, 20, 16);
    r(0, 10, 48, 2, 17);
    for (const [x, y] of [[8, 14], [22, 18], [34, 14], [14, 24], [30, 25]] as const) {
      r(x, y, 5, 1, 17);
      r(x + 1, y + 1, 3, 1, 18);
    }
    r(0, 10, 6, 20, 13); // shore and tree
    r(0, 10, 6, 2, 12);
    r(2, 3, 2, 8, 5);
    r(0, 0, 8, 6, 14);
    r(1, 0, 4, 3, 13);
    r(16, 20, 32, 4, 4); // pier
    r(16, 20, 32, 1, 3);
    for (let x = 18; x < 48; x += 5) r(x, 24, 1, 4, 5);
    r(40, 12, 1, 8, 5); // rod
    r(41, 12, 4, 1, 5);
    r(44, 13, 1, 9, 2);
    r(43, 22, 3, 2, 8);
  },
  // The mine: dark rock, copper ore, a lantern.
  mine: (r) => {
    r(0, 0, 48, 30, 24);
    for (const [x, y, w, h] of [[2, 3, 14, 10], [20, 1, 12, 8], [34, 5, 12, 12], [4, 17, 16, 11], [26, 18, 18, 10]] as const) {
      r(x, y, w, h, 23);
      r(x, y, w, 1, 22);
      r(x, y, 1, h, 22);
      r(x + w - 1, y + 1, 1, h - 1, 25);
    }
    for (const [x, y] of [[6, 6], [38, 9], [10, 22], [32, 22], [24, 4]] as const) {
      r(x, y, 3, 2, 9);
      r(x, y, 2, 1, 10);
      r(x + 1, y + 1, 1, 1, 7);
    }
    r(21, 12, 6, 7, 6); // lantern
    r(22, 13, 4, 5, 10);
    r(23, 14, 2, 3, 11);
    r(23, 11, 2, 1, 6);
    r(20, 11, 8, 1, 0);
  },
  // The dungeon: a stone arch with a dark door and torch glints.
  dungeon: (r) => {
    r(0, 0, 48, 30, 25);
    r(0, 0, 48, 30, 25);
    r(10, 4, 28, 26, 22);
    r(10, 4, 28, 1, 21);
    r(12, 8, 24, 22, 23);
    r(15, 10, 18, 20, 21);
    r(17, 12, 14, 18, 6);
    r(19, 10, 10, 2, 21);
    r(21, 14, 6, 16, 25);
    r(22, 23, 4, 2, 9);
    r(23, 22, 2, 1, 11);
    r(2, 10, 3, 5, 6); // torches
    r(3, 7, 2, 3, 9);
    r(3, 8, 1, 1, 11);
    r(43, 10, 3, 5, 6);
    r(43, 7, 2, 3, 9);
    r(44, 8, 1, 1, 11);
    for (let x = 12; x < 36; x += 6) r(x, 4, 1, 4, 24);
  },
};

const cache = new Map<WorldId, string>();

/** A data URL of the world's picture (pixelated by CSS: image-rendering). */
export function worldArtUrl(id: WorldId): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_ART_W;
  canvas.height = WORLD_ART_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  SCENES[id]((x, y, w, h, c) => {
    ctx.fillStyle = P[c] ?? P[6];
    ctx.fillRect(x, y, w, h);
  });
  ctx.fillStyle = P[6];
  ctx.fillRect(0, WORLD_ART_H - 1, WORLD_ART_W, 1); // the dark edge
  const url = canvas.toDataURL('image/png');
  cache.set(id, url);
  return url;
}
