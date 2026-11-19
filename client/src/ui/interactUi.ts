// MISCLICK-PROOF (owner 19 Nov): the HTML overlay of the interaction help. Rendering only; what is picked comes from client/src/game/interactAssist.ts.
// - a highlight box with a small name tag around the thing a click or tap would use (hover on PC, the press on a phone, the Tab cycle);
// - a confirm ring that flashes INTERACT_CONFIRM_MS after a pick;
// - the round CONTEXT BUTTON above the hotbar (phone): the action word of the nearest usable thing; a press does it (a hold for Pour).
// HOOK for the artist: the classes .interact-hl, .interact-tag, .interact-confirm and .ctx-btn in interactUi.css (sprite outline can replace the box later).

import { INTERACT_CONFIRM_MS, type Rect } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import './highlight.css';
import './interactUi.css';

export type HighlightMode = 'hover' | 'press' | 'key';

export interface InteractUiHooks {
  /** The context button went down (a tap or the start of a pour hold). */
  onButtonDown(): void;
  /** It was released or cancelled. */
  onButtonUp(): void;
}

export interface InteractUi {
  /** Shows the box with its name tag around these screen bounds (CSS px), or hides it (null). */
  highlight(bounds: Rect | null, label?: string, mode?: HighlightMode): void;
  /** The 150 ms confirm ring around these bounds. */
  confirm(bounds: Rect): void;
  /** Shows the context button with this action word, or hides it (null). */
  button(label: string | null): void;
  /** The walk-target ring on the tapped cell (screen CSS px); `fading` = arrived, it fades out; null hides it. */
  walkMark(bounds: Rect | null, fading: boolean): void;
  readonly buttonEl: HTMLButtonElement;
}

const place = (e: HTMLElement, b: Rect, pad: number): void => {
  e.style.left = `${Math.round(b.x - pad)}px`;
  e.style.top = `${Math.round(b.y - pad)}px`;
  e.style.width = `${Math.round(b.w + 2 * pad)}px`;
  e.style.height = `${Math.round(b.h + 2 * pad)}px`;
};

export function createInteractUi(parent: HTMLElement, hooks: InteractUiHooks): InteractUi {
  const box = el('div', 'interact-hl pk-hl');
  box.hidden = true;
  const tag = el('div', 'interact-tag');
  box.appendChild(tag);
  parent.appendChild(box);

  const btn = el('button', 'ctx-btn');
  btn.type = 'button';
  btn.hidden = true;
  let down = false;
  const release = (): void => {
    if (!down) return;
    down = false;
    btn.classList.remove('down');
    hooks.onButtonUp();
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (down) return;
    down = true;
    btn.classList.add('down');
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      // older browsers: the window pointerup in pourControl still ends a pour
    }
    hooks.onButtonDown();
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) btn.addEventListener(t, release);
  btn.addEventListener('click', (e) => e.preventDefault());
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  parent.appendChild(btn);

  // The walk-target ring (coordinator 19 Nov): the shared crisp brackets on the tapped cell; it fades out on arrival.
  const walkBox = el('div', 'walk-mark pk-hl');
  walkBox.hidden = true;
  parent.appendChild(walkBox);

  let lastLabel: string | null = null;
  return {
    buttonEl: btn,
    walkMark(bounds, fading) {
      if (!bounds) {
        walkBox.hidden = true;
        walkBox.classList.remove('fade');
        return;
      }
      walkBox.style.left = `${Math.round(bounds.x)}px`;
      walkBox.style.top = `${Math.round(bounds.y)}px`;
      walkBox.style.setProperty('--hl-w', `${Math.round(bounds.w)}px`);
      walkBox.style.setProperty('--hl-h', `${Math.round(bounds.h)}px`);
      walkBox.classList.toggle('fade', fading);
      walkBox.hidden = false;
    },
    highlight(bounds, label = '', mode = 'hover') {
      if (!bounds) {
        box.hidden = true;
        return;
      }
      const pad = 3;
      box.style.left = `${Math.round(bounds.x - pad)}px`;
      box.style.top = `${Math.round(bounds.y - pad)}px`;
      box.style.setProperty('--hl-w', `${Math.round(bounds.w + 2 * pad)}px`);
      box.style.setProperty('--hl-h', `${Math.round(bounds.h + 2 * pad)}px`);
      box.dataset.mode = mode;
      tag.textContent = label;
      tag.hidden = label === '';
      box.hidden = false;
    },
    confirm(bounds) {
      const ring = el('div', 'interact-confirm');
      place(ring, bounds, 4);
      ring.style.animationDuration = `${INTERACT_CONFIRM_MS}ms`;
      parent.appendChild(ring);
      window.setTimeout(() => ring.remove(), INTERACT_CONFIRM_MS + 30);
    },
    button(label) {
      if (label === lastLabel) return;
      lastLabel = label;
      if (label === null) {
        release();
        btn.hidden = true;
        return;
      }
      btn.textContent = label;
      btn.setAttribute('aria-label', label);
      btn.hidden = false;
    },
  };
}
