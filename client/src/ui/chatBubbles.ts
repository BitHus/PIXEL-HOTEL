// Chat bubbles (step 5): light cream bubbles with a dark outline above an avatar's head. New
// bubbles appear right above the head and push older ones up (they stack upward). Each one
// stays at reading pace (readingMs, at least CHAT_BUBBLE_MS), then fades out over CHAT_BUBBLE_FADE_MS. HTML, so the
// text stays sharp at every zoom; call update() every frame with the heads' screen positions.
// A bubble's age is REAL time (fix after 9d): the shop keeps running while the page is in the
// background and no frames are drawn, so bubbles that aged per frame piled up above a waiting
// customer. Nothing is added while the page is hidden, and one avatar shows at most
// CHAT_BUBBLES_PER_AVATAR bubbles (the oldest goes).

import { CHAT_BUBBLE_FADE_MS, CHAT_BUBBLE_GAP_PX, CHAT_BUBBLE_MS, CHAT_BUBBLES_MAX, CHAT_BUBBLES_PER_AVATAR, readingMs, type ChatLine, type Point } from '@pixel-hotel/shared';
import { pickNearest, placeBubbles, snapToDevice, type BubbleIn } from './bubbleLayout.ts';
import { el } from './dom.ts';

// NPC chatter (guests, staff: negative avatar ids) is small and local: a compact pill, at most NPC_VISIBLE_MAX shown at once (nearest to the
// screen centre first), only for heads on screen, one line per NPC, long lines cut. The player's own bubble is unchanged.
const NPC_VISIBLE_MAX = 3;
// RUN 11 (6): at most this many bubbles show over one avatar (the newest); older ones stay hidden until they expire, so the name tag stays readable.
const VISIBLE_PER_AVATAR = 2;
const NPC_TEXT_MAX = 44;
const NPC_BASE_MS = 2500;
const NPC_MARGIN_PX = 24;

interface Bubble {
  avatarId: number;
  npc: boolean;
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
  let prevNear: ReadonlySet<number> = new Set();
  const push = (avatarId: number, b: HTMLElement, life: number, npc = false): void => {
    if (document.hidden) return; // Nobody sees it, and it would only pile up.
    layer.appendChild(b);
    bubbles.push({ avatarId, npc, el: b, born: performance.now(), life });
    const mine = bubbles.filter((x) => x.avatarId === avatarId);
    for (const old of mine.slice(0, Math.max(0, mine.length - (npc ? 1 : CHAT_BUBBLES_PER_AVATAR)))) {
      old.el.remove();
      bubbles = bubbles.filter((x) => x !== old);
    }
    // RUN 5: a cap for the whole screen (several guests talking at once): the oldest goes.
    while (bubbles.length > CHAT_BUBBLES_MAX) bubbles.shift()!.el.remove();
  };

  return {
    add(line) {
      if (line.avatarId < 0) {
        const t = line.text.length > NPC_TEXT_MAX ? `${line.text.slice(0, NPC_TEXT_MAX - 1).trimEnd()}…` : line.text;
        push(line.avatarId, el('div', 'bubble bubble-npc', t), readingMs(t, NPC_BASE_MS) + CHAT_BUBBLE_FADE_MS, true);
        return;
      }
      const b = el('div', 'bubble', line.text);
      push(line.avatarId, b, readingMs(line.text, CHAT_BUBBLE_MS) + CHAT_BUBBLE_FADE_MS);
    },
    addNode(avatarId, node, lifeMs) {
      // A guest's talk line (span.npc-line: optional reaction face + words) is NPC chatter: small pill, cut text, short life, one per guest.
      if (node instanceof HTMLElement && node.classList.contains('npc-line')) {
        const t = [...node.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
        if (t?.textContent && t.textContent.length > NPC_TEXT_MAX) t.textContent = `${t.textContent.slice(0, NPC_TEXT_MAX - 1).trimEnd()}…`;
        const nb = el('div', 'bubble bubble-npc bubble-icon');
        nb.appendChild(node);
        push(avatarId, nb, Math.min(lifeMs, readingMs(node.textContent ?? '', NPC_BASE_MS) + CHAT_BUBBLE_FADE_MS), true);
        return;
      }
      const b = el('div', 'bubble bubble-icon');
      b.appendChild(node);
      push(avatarId, b, lifeMs);
    },
    clear() {
      for (const b of bubbles) b.el.remove();
      bubbles = [];
    },
    update(_dtMs, heads) {
      if (bubbles.length === 0) return; // OWN-4 (a): no layout reads (querySelector, getBoundingClientRect) on frames without a chat bubble
      const now = performance.now();
      const dpr = window.devicePixelRatio || 1;
      for (const b of bubbles.filter((x) => now - x.born >= x.life)) b.el.remove();
      bubbles = bubbles.filter((b) => now - b.born < b.life);
      // Per avatar the newest bubble sits right above the head, older ones above it; bubbles of different avatars never overlap, an order icon is
      // never covered and the button column is avoided (pure: bubbleLayout.ts placeBubbles).
      const col = document.querySelector('.side-buttons')?.getBoundingClientRect() ?? null;
      const orders = [...document.querySelectorAll('.order-bubble')].filter((o) => !(o as HTMLElement).hidden).map((o) => o.getBoundingClientRect());
      const shown: Bubble[] = [];
      const input: BubbleIn[] = [];
      // NPC lines: only on screen, and only the NPC_VISIBLE_MAX nearest to the screen centre.
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      // Hysteresis (pickNearest): while the camera is locked on the walking avatar the distances change every frame; a bubble already shown stays unless a newcomer is clearly nearer (no flicker).
      const cands = bubbles
        .filter((b) => b.npc)
        .map((b) => ({ b, h: heads.get(b.avatarId) }))
        .filter((o): o is { b: Bubble; h: Point } => !!o.h && o.h.x > -NPC_MARGIN_PX && o.h.x < window.innerWidth + NPC_MARGIN_PX && o.h.y > 0 && o.h.y < window.innerHeight + NPC_MARGIN_PX);
      const nearIds = pickNearest(cands.map((o) => ({ key: o.b.avatarId, x: o.h.x, y: o.h.y })), cx, cy, NPC_VISIBLE_MAX, prevNear);
      prevNear = nearIds;
      const near = new Set(cands.filter((o) => nearIds.has(o.b.avatarId)).map((o) => o.b));
      const perAvatar = new Map<number, number>();
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]!;
        const head = heads.get(b.avatarId);
        const nth = (perAvatar.get(b.avatarId) ?? 0) + 1;
        perAvatar.set(b.avatarId, nth);
        b.el.hidden = !head || (b.npc && !near.has(b)) || nth > VISIBLE_PER_AVATAR;
        if (b.el.hidden || !head) continue;
        shown.push(b);
        input.push({ avatarId: b.avatarId, headX: head.x, headY: head.y, w: b.el.offsetWidth, h: b.el.offsetHeight });
      }
      const at = placeBubbles(input, window.innerWidth, CHAT_BUBBLE_GAP_PX, orders, col);
      shown.forEach((b, i) => {
        const p = at[i]!;
        b.el.style.transform = `translate(${snapToDevice(p.x, dpr)}px, ${snapToDevice(p.y, dpr)}px)`;
        b.el.classList.toggle('tail', p.tail);
        b.el.style.opacity = String(Math.min(1, (b.life - (now - b.born)) / CHAT_BUBBLE_FADE_MS));
      });
    },
  };
}
