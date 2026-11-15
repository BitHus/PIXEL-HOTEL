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
  if (/_(left|down)\.png$/.test(base)) return null;
  const m = /^([a-z0-9]+(?:_[a-z0-9]+)*?)(?:_(up|right))?\.png$/.exec(base);
  if (!m) return null;
  return { id: m[1]!, facing: (m[2] as SpriteFacing | undefined) ?? 'down' };
}

/** The facings a type needs drawn: its own, with left folded into right. */
export function neededFacings(type: { facings: readonly Facing[] }): SpriteFacing[] {
  return [...new Set(type.facings.map((f): SpriteFacing => (f === 'left' ? 'right' : f)))];
}

export const SPRITE_KINDS = ['furniture', 'icons', 'blocks', 'floors', 'walls', 'plants'] as const;
export type SpriteKind = (typeof SPRITE_KINDS)[number];

/** One sprite file: its kind (the folder), the id, and the variant: the facing (furniture), the growth stage 1 to 3 (plants), else ''. */
export interface SpriteRef {
  kind: SpriteKind;
  id: string;
  variant: string;
}

export const PLANT_STAGES = ['1', '2', '3'] as const;

/**
 * Splits a path such as `../assets/sprites/icons/wood.png` into its kind, id and variant (docs/PLAN-ART-UPGRADE.md section 0), or null.
 * furniture: `<id>[_up|_right].png`; plants: `<id>_<1|2|3>.png`; icons, blocks, floors and walls: `<id>.png`.
 */
export function parseSpritePath(path: string): SpriteRef | null {
  const parts = path.split(/[\\/]/);
  const file = parts.pop() ?? '';
  const kind = parts.pop() as SpriteKind | undefined;
  if (!kind || !(SPRITE_KINDS as readonly string[]).includes(kind)) return null;
  if (kind === 'furniture') {
    const n = parseSpriteName(file);
    return n ? { kind, id: n.id, variant: n.facing } : null;
  }
  if (kind === 'plants') {
    const m = /^([a-z0-9]+(?:_[a-z0-9]+)*)_([123])\.png$/.exec(file);
    return m ? { kind, id: m[1]!, variant: m[2]! } : null;
  }
  const m = /^([a-z0-9]+(?:_[a-z0-9]+)*)\.png$/.exec(file);
  return m ? { kind, id: m[1]!, variant: '' } : null;
}

/** True only when a plant has all three growth stages among the variants. */
export function plantComplete(variants: Iterable<string>): boolean {
  const have = new Set(variants);
  return PLANT_STAGES.every((s) => have.has(s));
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
