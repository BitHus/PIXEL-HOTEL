// The look pickers (step 7b; tabs after 7b), used by character creation and the Avatar panel. One
// tab at a time, so nothing needs long scrolling: Body (skin tone), Hair (style + colour), Top
// (style + colour), Bottoms (style + colour), Shoes (colour). Styles step with ◀ ▶ through the
// free and unlocked clothing (selectableClothing); colours are swatches from config LOOK_COLORS.
// Every tap calls onChange at once, so the preview updates the moment a choice is made.

import { LOOK_COLORS, PALETTE, SLOT_FIELD, selectableClothing, type AvatarLook, type ClothingSlot } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';

export interface LookPickers {
  readonly el: HTMLElement;
  /** The tab buttons (character creation puts them in its own place). */
  readonly tabs: HTMLElement;
  /** The open tab's pickers. */
  readonly body: HTMLElement;
  setLook(look: AvatarLook, unlocked?: readonly string[]): void;
}

type ColorField = 'skin' | 'hair' | 'shirt' | 'legs' | 'shoes';
type Row = { kind: 'color'; field: ColorField; list: readonly number[]; label: string } | { kind: 'style'; slot: ClothingSlot; label: string };

const TABS: { name: string; rows: Row[] }[] = [
  { name: 'Body', rows: [{ kind: 'color', field: 'skin', list: LOOK_COLORS.skin, label: 'Skin tone' }] },
  {
    name: 'Hair',
    rows: [
      { kind: 'style', slot: 'hair', label: 'Hair style' },
      { kind: 'color', field: 'hair', list: LOOK_COLORS.hair, label: 'Hair colour' },
    ],
  },
  {
    name: 'Top',
    rows: [
      { kind: 'style', slot: 'top', label: 'Top' },
      { kind: 'color', field: 'shirt', list: LOOK_COLORS.top, label: 'Top colour' },
    ],
  },
  {
    name: 'Bottoms',
    rows: [
      { kind: 'style', slot: 'bottoms', label: 'Bottoms' },
      { kind: 'color', field: 'legs', list: LOOK_COLORS.bottoms, label: 'Bottoms colour' },
    ],
  },
  { name: 'Shoes', rows: [{ kind: 'color', field: 'shoes', list: LOOK_COLORS.shoes, label: 'Shoes colour' }] },
];

export function createLookPickers(onChange: (look: AvatarLook) => void): LookPickers {
  const box = el('div', 'look-pickers');
  const tabs = el('div', 'tabs look-tabs');
  const body = el('div', 'look-body');
  box.append(tabs, body);
  let look: AvatarLook | null = null;
  let unlocked: readonly string[] = [];
  let tab = 0;

  const tabButtons = TABS.map((t, i) => {
    const b = textButton(t.name, () => {
      tab = i;
      draw();
    }, 'tab');
    tabs.appendChild(b);
    return b;
  });

  const row = (l: AvatarLook, r: Row): HTMLElement => {
    const out = el('div', 'look-row');
    out.appendChild(el('div', 'look-label', r.label));
    if (r.kind === 'style') {
      const options = selectableClothing(r.slot, unlocked);
      const field = SLOT_FIELD[r.slot];
      const at = Math.max(0, options.findIndex((c) => c.id === l[field]));
      const step = (d: number): void => {
        const next = options[(at + d + options.length) % options.length];
        if (next) set({ ...l, [field]: next.id });
      };
      const prev = textButton('◀', () => step(-1), 'look-step');
      prev.setAttribute('aria-label', `Previous ${r.label.toLowerCase()}`);
      const next = textButton('▶', () => step(1), 'look-step');
      next.setAttribute('aria-label', `Next ${r.label.toLowerCase()}`);
      const stepper = el('div', 'look-stepper');
      stepper.append(prev, el('span', 'look-value', options[at]?.name ?? ''), next);
      out.appendChild(stepper);
    } else {
      const swatches = el('div', 'look-swatches');
      for (const i of r.list) {
        const b = el('button', `swatch${l[r.field] === i ? ' selected' : ''}`);
        b.type = 'button';
        b.style.background = PALETTE[i] ?? '';
        b.setAttribute('aria-label', `${r.label} ${i}`);
        b.addEventListener('click', () => set({ ...l, [r.field]: i }));
        swatches.appendChild(b);
      }
      out.appendChild(swatches);
    }
    return out;
  };

  const draw = (): void => {
    tabButtons.forEach((b, i) => b.classList.toggle('on', i === tab));
    body.replaceChildren();
    const l = look;
    if (!l) return;
    for (const r of TABS[tab]?.rows ?? []) body.appendChild(row(l, r));
  };

  const set = (next: AvatarLook): void => {
    look = next;
    draw();
    onChange(next);
  };

  return {
    el: box,
    tabs,
    body,
    setLook(next, u = unlocked) {
      look = { ...next };
      unlocked = u;
      draw();
    },
  };
}
