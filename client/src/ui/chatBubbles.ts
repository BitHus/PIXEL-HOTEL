// Chat bubbles (step 5): light cream bubbles with a dark outline above an avatar's head. New
// bubbles appear right above the head and push older ones up (they stack upward). Each one
// fades out during its last CHAT_BUBBLE_FADE_MS and is gone after CHAT_BUBBLE_MS. HTML, so the
// text stays sharp at every zoom; call update() every frame with the heads' screen positions.

import { CHAT_BUBBLE_FADE_MS, CHAT_BUBBLE_GAP_PX, CHAT_BUBBLE_MS, type ChatLine, type Point } from '@pixel-hotel/shared';
import { el } from './dom.ts';

interface Bubble {
  avatarId: number;
  el: HTMLElement;
  age: number;
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

  return {
    add(line) {
      const b = el('div', 'bubble', line.text);
      layer.appendChild(b);
      bubbles.push({ avatarId: line.avatarId, el: b, age: 0, life: CHAT_BUBBLE_MS });
    },
    addNode(avatarId, node, lifeMs) {
      const b = el('div', 'bubble bubble-icon');
      b.appendChild(node);
      layer.appendChild(b);
      bubbles.push({ avatarId, el: b, age: 0, life: lifeMs });
    },
    clear() {
      for (const b of bubbles) b.el.remove();
      bubbles = [];
    },
    update(dtMs, heads) {
      for (const b of bubbles) b.age += dtMs;
      for (const b of bubbles.filter((x) => x.age >= x.life)) b.el.remove();
      bubbles = bubbles.filter((b) => b.age < b.life);
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
        b.el.style.opacity = String(Math.min(1, (b.life - b.age) / CHAT_BUBBLE_FADE_MS));
        bottom.set(b.avatarId, y - h - CHAT_BUBBLE_GAP_PX);
      }
    },
  };
}
