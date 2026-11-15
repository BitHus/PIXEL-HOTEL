// Gems flying to the avatar (step BG4, rooms): when a punch, a harvest or a felled tree gives gems, a small gem
// leaves the spot and flies to the avatar's head. The gems are in the wallet already (the API paid them through
// the ledger), so nothing is lost if the page closes: this is only the picture. In the dungeon and the mine the
// gems are real piles on the floor (render/dungeonView.ts). Rendering only; an HTML layer over the canvas.

import type { Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { gemIconUrl } from './itemIcon.ts';

/** How long one gem takes from the spot to the head (ms). */
export const GEM_FLY_TOTAL_MS = 450;

interface Flying {
  node: HTMLElement;
  from: Point;
  born: number;
}

export interface GemFly {
  /** Sends `count` gems (at most 3 pictures) from a screen point (CSS px). Ignored while the page is hidden. */
  launch(from: Point, count: number): void;
  /** Call every frame with the avatar's head on screen (CSS px), or null. */
  update(head: Point | null): void;
  clear(): void;
}

export function createGemFly(parent: HTMLElement): GemFly {
  const layer = el('div', 'gem-fly-layer');
  parent.appendChild(layer);
  let list: Flying[] = [];
  return {
    launch(from, count) {
      if (document.hidden || count <= 0) return;
      const now = performance.now();
      for (let i = 0; i < Math.min(3, count); i++) {
        const node = el('img', 'gem-fly');
        node.src = gemIconUrl();
        node.alt = '';
        node.draggable = false;
        layer.appendChild(node);
        // Staggered by a short delay: the later ones start in the past (born in the future).
        list.push({ node, from: { x: from.x + (i - 1) * 8, y: from.y }, born: now + i * 90 });
      }
    },
    update(head) {
      const now = performance.now();
      const keep: Flying[] = [];
      for (const f of list) {
        const k = (now - f.born) / GEM_FLY_TOTAL_MS;
        if (k >= 1 || !head) {
          if (k >= 1 || !head) f.node.remove();
          continue;
        }
        keep.push(f);
        if (k < 0) {
          f.node.style.opacity = '0';
          continue;
        }
        // Up a little first, then in to the head (ease in).
        const e = k * k;
        const x = f.from.x + (head.x - f.from.x) * e;
        const y = f.from.y + (head.y - f.from.y) * e - Math.sin(k * Math.PI) * 18;
        f.node.style.opacity = '1';
        f.node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      }
      list = keep;
    },
    clear() {
      for (const f of list) f.node.remove();
      list = [];
    },
  };
}
