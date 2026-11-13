// Small color helpers for placeholder art. Placeholder shading may compute its own shades
// (brief section 12); final sprites will use only the palette.

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Multiplies every channel: < 1 darker, > 1 lighter. */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = parse(hex);
  return toHex([r * factor, g * factor, b * factor]);
}

/** Moves the color toward its grey by amount (0 = unchanged, 1 = grey). */
export function desaturate(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return toHex([r + (l - r) * amount, g + (l - g) * amount, b + (l - b) * amount]);
}
