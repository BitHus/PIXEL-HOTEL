// Furniture sprites (docs/PLAN-SPRITES.md): the naming rules, pure. A PNG in assets/sprites/furniture/ is
// `<id>.png` (facing down) or `<id>_<facing>.png` (up, right). Left is never drawn: it is right mirrored.
// A piece uses its sprites only when EVERY facing its type allows has a file; else the whole piece keeps its code art.

import type { Facing } from '@pixel-hotel/shared';

export type SpriteFacing = Exclude<Facing, 'left'>;

export interface SpriteName {
  id: string;
  facing: SpriteFacing;
}

/** Splits a file name or path into the furniture id and facing, or null (not a sprite name; `_left` is refused). */
export function parseSpriteName(file: string): SpriteName | null {
  const base = file.split(/[\\/]/).pop() ?? '';
  if (/_(left|down).png$/.test(base)) return null;
  const m = /^([a-z0-9]+(?:_[a-z0-9]+)*?)(?:_(up|right))?\.png$/.exec(base);
  if (!m) return null;
  return { id: m[1]!, facing: (m[2] as SpriteFacing | undefined) ?? 'down' };
}

/** The facings a type needs drawn: its own, with left folded into right. */
export function neededFacings(type: { facings: readonly Facing[] }): SpriteFacing[] {
  return [...new Set(type.facings.map((f): SpriteFacing => (f === 'left' ? 'right' : f)))];
}

/** True only when every needed facing of the type has a file among `files` (names or paths). */
export function spriteComplete(type: { id: string; facings: readonly Facing[] }, files: Iterable<string>): boolean {
  const have = new Set<string>();
  for (const f of files) {
    const n = parseSpriteName(f);
    if (n && n.id === type.id) have.add(n.facing);
  }
  return neededFacings(type).every((f) => have.has(f));
}
