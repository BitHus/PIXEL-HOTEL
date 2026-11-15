// Endesga 32 by Endesga (lospec.com/palette-list/endesga-32).
// This is the ONLY place the palette hex list lives. Switching palettes = changing this file.

export const PALETTE_NAME = 'Endesga 32';

export const PALETTE = [
  '#be4a2f',
  '#d77643',
  '#ead4aa',
  '#e4a672',
  '#b86f50',
  '#733e39',
  '#3e2731',
  '#a22633',
  '#e43b44',
  '#f77622',
  '#feae34',
  '#fee761',
  '#63c74d',
  '#3e8948',
  '#265c42',
  '#193c3e',
  '#124e89',
  '#0099db',
  '#2ce8f5',
  '#ffffff',
  '#c0cbdc',
  '#8b9bb4',
  '#5a6988',
  '#3a4466',
  '#262b44',
  '#181425',
  '#ff0044',
  '#68386c',
  '#b55088',
  '#f6757a',
  '#e8b796',
  '#c28569',
] as const;

export type PaletteColor = (typeof PALETTE)[number];

/**
 * Our own names for the 32 colours, in palette order (data files name a colour by these, so no hex
 * and no index appears outside this file). `outline` is the dark warm outline colour.
 */
export const PALETTE_NAMES = [
  'rust', 'clay', 'cream', 'sand', 'oak', 'walnut', 'outline', 'crimson',
  'red', 'orange', 'gold', 'butter', 'lime', 'green', 'forest', 'pine',
  'navy', 'sky', 'cyan', 'white', 'silver', 'steel', 'slate', 'dusk',
  'night', 'ink', 'magenta', 'plum', 'orchid', 'rose', 'skin', 'tan',
] as const;

export type PaletteName = (typeof PALETTE_NAMES)[number];

export function isPaletteName(name: string): name is PaletteName {
  return (PALETTE_NAMES as readonly string[]).includes(name);
}

/** The hex of a palette name. */
export function paletteColor(name: PaletteName): string {
  return PALETTE[PALETTE_NAMES.indexOf(name)]!;
}
