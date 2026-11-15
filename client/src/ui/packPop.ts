// The pack's opening pop (step BG8), drawn in code: the pack's picture shakes, then bursts into squares in the colour of
// the best rank inside. It plays in the middle of the screen for PACK_POP_MS; then the items float above the head as
// popups (BG3). Rendering only. Reduced-motion players get no animation, only a short wait.

import { PACK_POP_MS, RANKS, sparkles, type Rank } from '@pixel-hotel/shared';
import { el } from './dom.ts';

const SHARDS = 10;

/** Plays the pop; resolves when it is over. `best` = the rarest rank inside (the burst's colour, a sparkle for ultra_rare and legendary). */
export function playPackPop(parent: HTMLElement, iconUrl: string, best: Rank): Promise<void> {
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return new Promise((resolve) => window.setTimeout(resolve, 150));
  const layer = el('div', 'pack-pop');
  layer.style.setProperty('--pop-ms', `${PACK_POP_MS}ms`);
  layer.classList.add(`rank-${RANKS.includes(best) ? best : 'common'}`);
  const img = el('img', 'pack-pop-img');
  img.src = iconUrl;
  img.alt = '';
  img.draggable = false;
  layer.appendChild(img);
  for (let i = 0; i < SHARDS; i++) {
    const s = el('span', 'pack-pop-shard');
    const a = (i / SHARDS) * Math.PI * 2;
    s.style.setProperty('--dx', `${Math.round(Math.cos(a) * 90)}px`);
    s.style.setProperty('--dy', `${Math.round(Math.sin(a) * 90)}px`);
    layer.appendChild(s);
  }
  if (sparkles(best)) for (let i = 0; i < 4; i++) layer.appendChild(el('span', `sparkle-star s${i}`));
  parent.appendChild(layer);
  return new Promise((resolve) =>
    window.setTimeout(() => {
      layer.remove();
      resolve();
    }, PACK_POP_MS),
  );
}
