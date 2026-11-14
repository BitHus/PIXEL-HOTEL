// Chat bubbles (step 5): light cream bubbles with a dark outline above an avatar's head. New
// bubbles appear right above the head and push older ones up (they stack upward). Each one
// stays at reading pace (readingMs, at least CHAT_BUBBLE_MS), then fades out over CHAT_BUBBLE_FADE_MS. HTML, so the
// text stays sharp at every zoom; call update() every frame with the heads' screen positions.
// A bubble's age is REAL time (fix after 9d): the shop keeps running while the page is in the
// background and no frames are drawn, so bubbles that aged per frame piled up above a waiting
// customer. Nothing is added while the page is hidden, and one avatar shows at most
// CHAT_BUBBLES_PER_AVATAR bubbles (the oldest goes).

import { CHAT_BUBBLE_FADE_MS, CHAT_BUBBLE_GAP_PX, CHAT_BUBBLE_MS, CHAT_BUBBLES_PER_AVATAR, readingMs, type ChatLine, type Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';

interface Bubble {
  avatarId: number;
  el: HTMLElement;
  /** When it appeared (performance.now()). */
  born: number;
  /** How long it stays, ms. */
  life: number;
}

export interface ChatBubbles {
  add(line: ChatLine): void;
  /** A bubble with any content (a customer's reaction face), staying lifeMs. */
  addNode(avatarId: number, node: Node, lifeMs: number): void;
  clear(): void;
  /** Moves the bubbles; heads: screen point above each avatar's head (CSS px). */
  update(dtMs: number, heads: ReadonlyMap<number, Point>): void;
}

export function createChatBubbles(parent: HTMLElement): ChatBubbles {
  const layer = el('div', 'bubble-layer');
  parent.appendChild(layer);
  let bubbles: Bubble[] = [];
  const push = (avatarId: number, b: HTMLElement, life: number): void => {
    if (document.hidden) return; // Nobody sees it, and it would only pile up.
    layer.appendChild(b);
    bubbles.push({ avatarId, el: b, born: performance.now(), life });
    const mine = bubbles.filter((x) => x.avatarId === avatarId);
    for (const old of mine.slice(0, Math.max(0, mine.length - CHAT_BUBBLES_PER_AVATAR))) {
      old.el.remove();
      bubbles = bubbles.filter((x) => x !== old);
    }
  };

  return {
    add(line) {
      const b = el('div', 'bubble', line.text);
      push(line.avatarId, b, readingMs(line.text, CHAT_BUBBLE_MS) + CHAT_BUBBLE_FADE_MS);
    },
    addNode(avatarId, node, lifeMs) {
      const b = el('div', 'bubble bubble-icon');
      b.appendChild(node);
      push(avatarId, b, lifeMs);
    },
    clear() {
      for (const b of bubbles) b.el.remove();
      bubbles = [];
    },
    update(_dtMs, heads) {
      const now = performance.now();
      for (const b of bubbles.filter((x) => now - x.born >= x.life)) b.el.remove();
      bubbles = bubbles.filter((b) => now - b.born < b.life);
      // Per avatar: the newest bubble sits right above the head, older ones above it.
      const bottom = new Map<number, number>();
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]!;
        const head = heads.get(b.avatarId);
        b.el.hidden = !head;
        if (!head) continue;
        const y = bottom.get(b.avatarId) ?? head.y;
        const h = b.el.offsetHeight;
        const w = b.el.offsetWidth;
        const x = Math.min(Math.max(head.x - w / 2, 4), window.innerWidth - w - 4);
        b.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y - h)}px)`;
        b.el.classList.toggle('tail', !bottom.has(b.avatarId));
        b.el.style.opacity = String(Math.min(1, (b.life - (now - b.born)) / CHAT_BUBBLE_FADE_MS));
        bottom.set(b.avatarId, y - h - CHAT_BUBBLE_GAP_PX);
      }
    },
  };
}
