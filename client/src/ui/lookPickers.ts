// The look pickers (step 7b; tabs after 7b), used by character creation and the Avatar panel. One
// tab at a time, so nothing needs long scrolling: Body (skin tone), Hair (style + colour), Top
// (style + colour), Bottoms (style + colour), Shoes (colour), as icon tabs. Styles step with small
// square ◀ ▶ buttons on both sides of a name plate ("Hair 2  Ponytail") through the
// free and unlocked clothing (pickableClothing); colours are swatches from config LOOK_COLORS.
// Every tap calls onChange at once, so the preview updates the moment a choice is made.

import { HATS, LOOK_COLORS, PALETTE, RANK_COLORS, SLOT_FIELD, hatWearable, pickableClothing, type AvatarLook, type ClothingSlot } from '@pixel-hotel/shared';
import { drawAvatarOnCanvas, partBounds } from '../render/avatarParts.ts';
import { hatBoxes } from '../render/hatParts.ts';
import { el, textButton } from './dom.ts';
import { tabBar } from './panelShell.ts';
import type { IconName } from './pixelIcons.ts';

export interface LookPickers {
  readonly el: HTMLElement;
  /** The tab buttons (character creation puts them in its own place). */
  readonly tabs: HTMLElement;
  /** The open tab's pickers. */
  readonly body: HTMLElement;
  setLook(look: AvatarLook, unlocked?: readonly string[]): void;
}

type ColorField = 'skin' | 'hair' | 'shirt' | 'legs' | 'shoes';
type Row = { kind: 'color'; field: ColorField; list: readonly number[]; label: string } | { kind: 'style'; slot: ClothingSlot; label: string } | { kind: 'hat' };

const TABS: { name: string; icon: IconName; rows: Row[] }[] = [
  { name: 'Body', icon: 'avatar', rows: [{ kind: 'color', field: 'skin', list: LOOK_COLORS.skin, label: 'Skin tone' }] },
  {
    name: 'Hair',
    icon: 'hair',
    rows: [
      { kind: 'style', slot: 'hair', label: 'Hair' },
      { kind: 'color', field: 'hair', list: LOOK_COLORS.hair, label: 'Hair colour' },
    ],
  },
  {
    name: 'Top',
    icon: 'shirt',
    rows: [
      { kind: 'style', slot: 'top', label: 'Top' },
      { kind: 'color', field: 'shirt', list: LOOK_COLORS.top, label: 'Top colour' },
    ],
  },
  {
    name: 'Bottoms',
    icon: 'trousers',
    rows: [
      { kind: 'style', slot: 'bottoms', label: 'Bottoms' },
      { kind: 'color', field: 'legs', list: LOOK_COLORS.bottoms, label: 'Bottoms colour' },
    ],
  },
  { name: 'Shoes', icon: 'shoe', rows: [{ kind: 'color', field: 'shoes', list: LOOK_COLORS.shoes, label: 'Shoes colour' }] },
  // Hats (step 9g-1): only in the Avatar panel (a new character owns none).
  { name: 'Hat', icon: 'hat', rows: [{ kind: 'hat' }] },
];

/** A hat on a small canvas, 2 canvas px per art px; `locked` = the grey silhouette. */
function hatCanvas(id: string, locked: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'hat-preview';
  const ps = hatBoxes(id, 'down', locked);
  if (!ps) return c;
  const [x0, y0, x1, y1] = partBounds(ps);
  const k = 2;
  c.width = (x1 - x0) * k;
  c.height = (y1 - y0) * k;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = false;
  const dark = PALETTE[6] ?? '#000';
  for (const [x, y, w, h] of ps) {
    ctx.fillStyle = dark;
    ctx.fillRect((x - 1 - x0) * k, (y - 1 - y0) * k, (w + 2) * k, (h + 2) * k);
  }
  for (const [x, y, w, h, col] of ps) {
    ctx.fillStyle = col;
    ctx.fillRect((x - x0) * k, (y - y0) * k, w * k, h * k);
  }
  return c;
}

/** `tabsHost`: where the icon tabs go (a panel's tab row); default: a tab row of its own. */
export function createLookPickers(onChange: (look: AvatarLook) => void, tabsHost?: HTMLElement, withHats = false): LookPickers {
  const tabDefs = withHats ? TABS : TABS.filter((t) => !t.rows.some((r) => r.kind === 'hat'));
  /** The hat being browsed in the Hat tab: 0 = no hat, then HATS in data order (locked ones too, as silhouettes). */
  let hatAt = 0;
  const box = el('div', 'look-pickers');
  const tabs = tabsHost ?? el('div', 'panel-tabs look-tabs');
  const body = el('div', 'look-body');
  box.append(body);
  let look: AvatarLook | null = null;
  let unlocked: readonly string[] = [];
  let tab = 0;

  const markTab = tabBar(
    tabs,
    tabDefs.map((t, i) => [String(i), t.icon, t.name] as const),
    (i) => {
      tab = Number(i);
      draw();
    },
  );

  const row = (l: AvatarLook, r: Exclude<Row, { kind: 'hat' }>): HTMLElement => {
    const out = el('div', 'look-row');
    if (r.kind === 'style') {
      const options = pickableClothing(r.slot, unlocked);
      const field = SLOT_FIELD[r.slot];
      const at = Math.max(0, options.findIndex((c) => c.id === l[field]));
      const step = (d: number): void => {
        const next = options[(at + d + options.length) % options.length];
        if (next) set({ ...l, [field]: next.id });
      };
      // Big tiles: each option drawn on the avatar itself (cropped to the hair, top or bottoms), so you pick by looking.
      const grid = el('div', 'look-tiles');
      options.forEach((o, i) => {
        const t = el('button', `look-tile crop-${r.slot}${i === at ? ' selected' : ''}`);
        t.type = 'button';
        t.setAttribute('aria-label', `${r.label}: ${o.name}`);
        t.title = o.name;
        const c = el('canvas', 'look-tile-art');
        drawAvatarOnCanvas(c, { ...l, [field]: o.id }, 'down', 1);
        t.appendChild(c);
        t.addEventListener('click', () => set({ ...l, [field]: o.id }));
        grid.appendChild(t);
      });
      const prev = textButton('◀', () => step(-1), 'look-step small');
      prev.setAttribute('aria-label', `Previous ${r.label.toLowerCase()}`);
      const next = textButton('▶', () => step(1), 'look-step small');
      next.setAttribute('aria-label', `Next ${r.label.toLowerCase()}`);
      const stepper = el('div', 'look-stepper');
      const plate = el('span', 'look-value plate light');
      plate.append(el('span', 'look-kind', `${r.label} ${at + 1} / ${options.length}`), el('span', '', options[at]?.name ?? ''));
      stepper.append(prev, plate, next);
      out.append(grid, stepper);
    } else {
      out.appendChild(el('div', 'look-label plate', r.label));
      const swatches = el('div', 'look-swatches');
      for (const i of r.list) {
        const b = el('button', `swatch look-swatch${l[r.field] === i ? ' selected' : ''}`);
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

  const hatRow = (l: AvatarLook): HTMLElement => {
    const out = el('div', 'look-row hat-row');
    const n = HATS.length + 1;
    const hat = hatAt === 0 ? null : HATS[hatAt - 1]!;
    const owned = hat === null || hatWearable(hat.id, unlocked);
    const step = (d: number): void => {
      hatAt = (hatAt + d + n) % n;
      draw();
    };
    const prev = textButton('◀', () => step(-1), 'look-step small');
    prev.setAttribute('aria-label', 'Previous hat');
    const next = textButton('▶', () => step(1), 'look-step small');
    next.setAttribute('aria-label', 'Next hat');
    const plate = el('span', 'look-value plate light');
    plate.append(el('span', 'look-kind', `Hat ${hatAt} of ${HATS.length}`), el('span', '', hat ? (owned ? hat.name : 'Locked hat') : 'No hat'));
    if (hat && owned) plate.style.color = PALETTE[RANK_COLORS[hat.rank]] ?? '';
    const stepper = el('div', 'look-stepper');
    stepper.append(prev, plate, next);
    // A tile per hat: "no hat" first, locked hats as grey silhouettes.
    const grid = el('div', 'look-tiles hat-tiles');
    for (let i = 0; i < n; i++) {
      const h = i === 0 ? null : HATS[i - 1]!;
      const t = el('button', `look-tile hat-tile${i === hatAt ? ' selected' : ''}${h && !hatWearable(h.id, unlocked) ? ' locked' : ''}`);
      t.type = 'button';
      const tileOwned = h === null || hatWearable(h.id, unlocked);
      t.setAttribute('aria-label', h ? (tileOwned ? h.name : `Locked hat. ${h.unlock ?? ''}`) : 'No hat');
      t.title = h ? (tileOwned ? h.name : `Locked: ${h.unlock ?? ''}`) : 'No hat';
      if (h) t.appendChild(hatCanvas(h.id, !hatWearable(h.id, unlocked)));
      else t.appendChild(el('span', 'look-tile-none', '✕'));
      t.addEventListener('click', () => {
        hatAt = i;
        draw();
      });
      grid.appendChild(t);
    }
    out.append(grid, stepper);
    if (hat && !owned) out.appendChild(el('div', 'hat-hint hat-lock-hint', hat.unlock ? `How to get it: ${hat.unlock}` : 'Find it while you play.'));
    const wearing = (l.hat ?? '') === (hat?.id ?? '');
    if (owned) {
      const b = textButton(wearing ? 'Worn' : hat ? 'Wear' : 'Take off', () => set({ ...l, hat: hat?.id ?? '' }), 'look-wear');
      b.disabled = wearing;
      out.appendChild(b);
    }
    return out;
  };

  const draw = (): void => {
    markTab(String(tab));
    body.replaceChildren();
    const l = look;
    if (!l) return;
    for (const r of tabDefs[tab]?.rows ?? []) body.appendChild(r.kind === 'hat' ? hatRow(l) : row(l, r));
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
