// Short numbers for small UI spots (the gold strip under the bag): 999, 1.2k, 12k, 1.2M.
// Always rounded down, so it never shows more gold than the player has.

export function shortNumber(n: number): string {
  const v = Math.floor(n);
  if (Math.abs(v) < 1000) return String(v);
  const unit = Math.abs(v) < 1_000_000 ? { d: 1000, s: 'k' } : { d: 1_000_000, s: 'M' };
  const x = v / unit.d;
  const shown = Math.abs(x) < 10 ? Math.trunc(x * 10) / 10 : Math.trunc(x);
  return `${shown}${unit.s}`;
}
