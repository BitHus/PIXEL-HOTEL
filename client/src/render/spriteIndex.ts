// Furniture sprites (docs/PLAN-SPRITES.md): the naming rules, pure. A PNG in assets/sprites/furniture/ is
// `<id>.png` (facing down) or `<id>_<facing>.png` (up, right). Left is never drawn: it is right mirrored.
// A piece uses its sprites only when EVERY facing its type allows has a file; else the whole piece keeps its code art.

import { AVATAR_SLOTS, type AvatarSlot, type Facing } from '@pixel-hotel/shared';

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

/**
 * dungeon (crypt and mine tiles, 32 x 32), actors (enemies and chests) and lake (water, trees, pier, decor) are the outdoors kinds (PLAN-REWORK-OUTDOORS
 * section 4). Their files are `<id>.png`; an animation STRIP is `<id>_<tag>.png` (see stripId): a horizontal row of equal frames.
 */
export const SPRITE_KINDS = ['furniture', 'icons', 'blocks', 'floors', 'walls', 'plants', 'dungeon', 'actors', 'lake', 'avatar'] as const;
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
    if (m) return { kind, id: m[1]!, variant: m[2]! };
    // A strip (ripe_sparkle.png: the farm ripe cue, 2 frames of 32 x 32) is one file, variant ''.
    const strip = /^([a-z0-9]+(?:_[a-z0-9]+)*_[a-z][a-z0-9]*)\.png$/.exec(file);
    return strip ? { kind, id: strip[1]!, variant: '' } : null;
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

// ---------- Animation strips (outdoors rework C11) ----------
/** The file id of an animation strip: `slime` + `idle` = `slime_idle` (the file is `slime_idle.png`, a horizontal row of equal frames). */
export const stripId = (id: string, tag: string): string => `${id}_${tag}`;

/**
 * How many frames a strip of this width holds (width / frame width), or 0 when it cannot be cut: a bad frame width, or a width that is not a whole
 * number of frames (such a strip is treated as missing, so a mis-sized file shows the code art instead of a torn frame).
 */
export function stripFrameCount(width: number, frameW: number): number {
  if (!Number.isInteger(width) || !Number.isInteger(frameW) || frameW <= 0 || width <= 0 || width % frameW !== 0) return 0;
  return width / frameW;
}

/** The x offset of frame `i` in a strip. */
export const stripFrameX = (i: number, frameW: number): number => i * frameW;


// ---------- Avatar layers (U1/C17, docs/PLAN-CHARACTERS.md section 6) ----------
/** A layer file in sprites/avatar/ is `<slot>_<item>_<anim>_<facing>.png`: id = `<slot>_<item>`, strip tag = `<anim>_<facing>` (stripId(id, tag) is the file id). */
export interface AvatarFileName {
  slot: AvatarSlot;
  item: string;
  id: string;
  anim: string;
  facing: 'down' | 'up' | 'right';
}

/** Splits an avatar file name or path (`torso_tunic_walk_down.png`, `hair_back_long_still_right.png`), or null. Slots may hold an underscore, so the slot is the longest known prefix; left is never drawn. */
export function parseAvatarFile(file: string): AvatarFileName | null {
  const base = file.split(/[\/]/).pop() ?? '';
  const m = /^([a-z0-9]+(?:_[a-z0-9]+)*)_([a-z0-9]+)_(down|up|right)\.png$/.exec(base);
  if (!m) return null;
  const rest = m[1]!;
  const slot = [...AVATAR_SLOTS].sort((a, b) => b.length - a.length).find((s) => rest.startsWith(`${s}_`));
  if (!slot) return null;
  const item = rest.slice(slot.length + 1);
  if (!item) return null;
  return { slot, item, id: `${slot}_${item}`, anim: m[2]!, facing: m[3] as AvatarFileName['facing'] };
}
