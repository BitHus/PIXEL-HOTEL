// The look pickers (step 7b), used by character creation and the Avatar panel: skin tone, hair
// style, hair colour, top, top colour, bottoms, bottoms colour and shoes colour. Styles step with
// ◀ ▶ through the free and unlocked clothing (selectableClothing); colours are swatches from
// config LOOK_COLORS.

import { LOOK_COLORS, PALETTE, SLOT_FIELD, selectableClothing, type AvatarLook, type ClothingSlot } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';

export interface LookPickers {
  readonly el: HTMLElement;
  setLook(look: AvatarLook, unlocked?: readonly string[]): void;
}

type ColorField = 'skin' | 'hair' | 'shirt' | 'legs' | 'shoes';

const ROWS: ({ kind: 'color'; field: ColorField; list: readonly number[]; label: string } | { kind: 'style'; slot: ClothingSlot; label: string })[] = [
  { kind: 'color', field: 'skin', list: LOOK_COLORS.skin, label: 'Skin tone' },
  { kind: 'style', slot: 'hair', label: 'Hair style' },
  { kind: 'color', field: 'hair', list: LOOK_COLORS.hair, label: 'Hair colour' },
  { kind: 'style', slot: 'top', label: 'Top' },
  { kind: 'color', field: 'shirt', list: LOOK_COLORS.top, label: 'Top colour' },
  { kind: 'style', slot: 'bottoms', label: 'Bottoms' },
  { kind: 'color', field: 'legs', list: LOOK_COLORS.bottoms, label: 'Bottoms colour' },
  { kind: 'color', field: 'shoes', list: LOOK_COLORS.shoes, label: 'Shoes colour' },
];

export function createLookPickers(onChange: (look: AvatarLook) => void): LookPickers {
  const box = el('div', 'look-pickers');
  let look: AvatarLook | null = null;
  let unlocked: readonly string[] = [];

  const draw = (): void => {
    box.replaceChildren();
    const l = look;
    if (!l) return;
    for (const row of ROWS) {
      const r = el('div', 'look-row');
      r.appendChild(el('div', 'look-label', row.label));
      if (row.kind === 'style') {
        const options = selectableClothing(row.slot, unlocked);
        const field = SLOT_FIELD[row.slot];
        const at = Math.max(0, options.findIndex((c) => c.id === l[field]));
        const step = (d: number): void => {
          const next = options[(at + d + options.length) % options.length];
          if (next) set({ ...l, [field]: next.id });
        };
        const prev = textButton('◀', () => step(-1), 'look-step');
        prev.setAttribute('aria-label', `Previous ${row.label.toLowerCase()}`);
        const next = textButton('▶', () => step(1), 'look-step');
        next.setAttribute('aria-label', `Next ${row.label.toLowerCase()}`);
        const stepper = el('div', 'look-stepper');
        stepper.append(prev, el('span', 'look-value', options[at]?.name ?? ''), next);
        r.appendChild(stepper);
      } else {
        const swatches = el('div', 'look-swatches');
        for (const i of row.list) {
          const b = el('button', `swatch${l[row.field] === i ? ' selected' : ''}`);
          b.type = 'button';
          b.style.background = PALETTE[i] ?? '';
          b.setAttribute('aria-label', `${row.label} ${i}`);
          b.addEventListener('click', () => set({ ...l, [row.field]: i }));
          swatches.appendChild(b);
        }
        r.appendChild(swatches);
      }
      box.appendChild(r);
    }
  };

  const set = (next: AvatarLook): void => {
    look = next;
    draw();
    onChange(next);
  };

  return {
    el: box,
    setLook(next, u = unlocked) {
      look = { ...next };
      unlocked = u;
      draw();
    },
  };
}
