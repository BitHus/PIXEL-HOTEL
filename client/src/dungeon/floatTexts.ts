// Floating text in the dungeon (step 9): damage numbers, drops, '+xp', 'miss'. HTML over the
// canvas at a world point; it rises and fades in FLOAT_TEXT_MS. Short effects, not messages.
// A drop above common shows in its rank colour (step 9e); ultra rare and legendary ones sparkle.

import { FLOAT_TEXT_MS, sparkles, type Point, type Rank } from '@pixel-hotel/shared';

export type FloatKind = 'damage' | 'hurt' | 'loot' | 'xp' | 'heal' | 'info';

interface Float {
  el: HTMLElement;
  at: Point;
  ageMs: number;
}

export class FloatTexts {
  private readonly items: Float[] = [];

  constructor(private readonly parent: HTMLElement) {}

  /** Adds a text at a world point; delayMs staggers several drops of one chest. */
  add(at: Point, text: string, kind: FloatKind, delayMs = 0, rank: Rank | null = null): void {
    const el = document.createElement('div');
    el.className = `float-text float-${kind}${rank ? ` rank-name rank-${rank}` : ''}`;
    el.textContent = text;
    // A short sparkle on ultra rare and legendary drops (step 9e): four small stars around the text.
    if (rank && sparkles(rank)) {
      el.classList.add('sparkle');
      for (let i = 0; i < 4; i++) {
        const star = document.createElement('span');
        star.className = `sparkle-star s${i}`;
        el.appendChild(star);
      }
    }
    el.style.opacity = '0';
    this.parent.appendChild(el);
    this.items.push({ el, at: { ...at }, ageMs: -delayMs });
  }

  update(dtMs: number, toScreen: (p: Point) => Point): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i]!;
      f.ageMs += dtMs;
      if (f.ageMs >= FLOAT_TEXT_MS) {
        f.el.remove();
        this.items.splice(i, 1);
        continue;
      }
      if (f.ageMs < 0) continue;
      const k = f.ageMs / FLOAT_TEXT_MS;
      const s = toScreen(f.at);
      f.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      f.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y - 28 * k)}px) translate(-50%, -100%)`;
    }
  }

  clear(): void {
    for (const f of this.items) f.el.remove();
    this.items.length = 0;
  }
}
