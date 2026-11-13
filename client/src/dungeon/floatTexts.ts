// Floating text in the dungeon (step 9): damage numbers, drops, '+xp', 'miss'. HTML over the
// canvas at a world point; it rises and fades in FLOAT_TEXT_MS. Short effects, not messages.

import { FLOAT_TEXT_MS, type Point } from '@pixel-hotel/shared';

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
  add(at: Point, text: string, kind: FloatKind, delayMs = 0): void {
    const el = document.createElement('div');
    el.className = `float-text float-${kind}`;
    el.textContent = text;
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
