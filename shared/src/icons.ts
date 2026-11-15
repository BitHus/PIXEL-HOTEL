// Item icons (step BG2): every item is a coloured square. An icon is { shape, colors }: a SHAPE
// from the fixed list below (drawn in code by client/src/render/iconPixels.ts on a 32x32 square)
// and 1 to 3 palette names (main, accent, third). Rank only changes the frame, never the shape.
// These are rough placeholders: real pixel art replaces the drawing per item in phase 4.

import { isPaletteName, type PaletteName } from './palette.ts';

export const ICON_SHAPES = [
  // goods
  'ore', 'bar', 'fish', 'leaf', 'mushroom', 'log', 'potion', 'bread', 'mug', 'gem', 'seed', 'block',
  'cloth', 'bone', 'boot', 'key', 'ring', 'plate', 'bottle', 'shell', 'blob', 'wing', 'fang', 'skull',
  'crown', 'heart', 'orb', 'root', 'pumpkin', 'bowl', 'hinge', 'tongue', 'dust', 'acorn', 'driftwood',
  // gear and clothing
  'sword', 'armor', 'pickaxe', 'axe', 'rod', 'helmet', 'shirt', 'hat', 'trousers', 'skirt', 'hair',
  // furniture silhouettes
  'chair', 'sofa', 'table', 'lamp', 'shelf', 'bed', 'rug', 'plant', 'box', 'barrel', 'bench', 'sign',
  'banner', 'torch', 'throne', 'jar', 'anchor', 'net', 'chandelier', 'counter', 'stool', 'tank',
] as const;

export type IconShape = (typeof ICON_SHAPES)[number];

export interface Icon {
  shape: IconShape;
  /** 1 to 3 palette names: main, accent, third (missing ones follow the one before). */
  colors: PaletteName[];
}

export function isIconShape(s: string): s is IconShape {
  return (ICON_SHAPES as readonly string[]).includes(s);
}

/** True when the shape is known and the colours are 1 to 3 known palette names. */
export function isValidIcon(icon: { shape: string; colors: readonly string[] } | undefined): icon is Icon {
  return !!icon && isIconShape(icon.shape) && icon.colors.length >= 1 && icon.colors.length <= 3 && icon.colors.every(isPaletteName);
}

/** A stable text key of an icon (cache key and the uniqueness test). */
export function iconKey(icon: Icon): string {
  return `${icon.shape}:${icon.colors.join(',')}`;
}
