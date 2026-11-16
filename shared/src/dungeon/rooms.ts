// Room templates of the crypt (DG1, brief section 10 LAYOUT). A template is a size range plus a MASK:
// a pure function that says which blocks of the room's bounding rect are floor. Data:
// shared/data/dungeonRooms.json. Masks are always 4-connected (tested) and never touch the rng.

import roomData from '../../data/dungeonRooms.json';

export type MaskKind = 'rect' | 'cross' | 'ell' | 'cutcorner' | 'pillars' | 'alcoves' | 'ring' | 'split' | 'hall' | 'arena';

export interface RoomTemplate {
  id: string;
  mask: MaskKind;
  weight: number;
  w: [number, number];
  h: [number, number];
}

export const ROOM_TEMPLATES: readonly RoomTemplate[] = roomData.templates as RoomTemplate[];

export function getRoomTemplate(id: string): RoomTemplate {
  const t = ROOM_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown room template ${id}`);
  return t;
}

/**
 * The floor mask of a w x h room, row-major (true = floor). `variant` (0..3) picks the corner of the
 * L shape that is cut away.
 */
export function roomMask(kind: MaskKind, w: number, h: number, variant = 0): boolean[] {
  const out: boolean[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) out.push(isFloorCell(kind, w, h, variant, c, r));
  }
  return out;
}

function isFloorCell(kind: MaskKind, w: number, h: number, variant: number, c: number, r: number): boolean {
  switch (kind) {
    case 'rect':
      return true;
    case 'cross': {
      const bc = Math.floor((w - 1) / 2);
      const br = Math.floor((h - 1) / 2);
      return (c >= bc && c <= bc + 1) || (r >= br && r <= br + 1);
    }
    case 'ell': {
      const cw = Math.floor(w / 2);
      const ch = Math.floor(h / 2);
      const v = variant % 4;
      if (v === 0) return !(c < cw && r < ch);
      if (v === 1) return !(c >= w - cw && r < ch);
      if (v === 2) return !(c < cw && r >= h - ch);
      return !(c >= w - cw && r >= h - ch);
    }
    case 'cutcorner':
      return !((c === 0 || c === w - 1) && (r === 0 || r === h - 1));
    case 'pillars':
      return !(c % 2 === 1 && r % 2 === 1 && c >= 1 && c <= w - 2 && r >= 1 && r <= h - 2);
    case 'alcoves':
      return !((r === 0 || r === h - 1) && c % 2 === 1);
    case 'ring': {
      const c0 = Math.floor((w - 2) / 2);
      const r0 = Math.floor((h - 2) / 2);
      return !(c >= c0 && c <= c0 + 1 && r >= r0 && r <= r0 + 1);
    }
    case 'split':
      return !(r === Math.floor(h / 2) && c >= 1 && c <= w - 2);
    case 'hall':
      return !((c === 2 || c === 5) && (r === 1 || r === 2));
    case 'arena':
      return !((c === 2 || c === 5) && (r === 2 || r === 5));
  }
}

/** True if every floor cell of the mask can be reached from every other (4 directions). */
export function maskConnected(mask: readonly boolean[], w: number, h: number): boolean {
  const first = mask.indexOf(true);
  if (first < 0) return false;
  const seen = new Set<number>([first]);
  const queue = [first];
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]!;
    const c = i % w;
    const r = (i - c) / w;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= w || nr >= h) continue;
      const j = nr * w + nc;
      if (mask[j] && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === mask.filter(Boolean).length;
}
