// Easing functions for effects (outdoors rework C11): pure, input and output 0..1 (easeOutBack overshoots a little).

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeLinear = (t: number): number => clamp01(t);
export const easeInQuad = (t: number): number => clamp01(t) ** 2;
export const easeOutQuad = (t: number): number => {
  const k = clamp01(t);
  return 1 - (1 - k) * (1 - k);
};
export const easeOutCubic = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
export const easeInOutQuad = (t: number): number => {
  const k = clamp01(t);
  return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
};
/** Overshoots past 1 and settles: a pop-in. */
export const easeOutBack = (t: number): number => {
  const k = clamp01(t) - 1;
  const c = 1.70158;
  return 1 + (c + 1) * k ** 3 + c * k ** 2;
};
/** Falls and bounces on the ground three times (loot landing). */
export const easeOutBounce = (t: number): number => {
  const k = clamp01(t);
  const n = 7.5625;
  const d = 2.75;
  if (k < 1 / d) return n * k * k;
  if (k < 2 / d) return n * (k - 1.5 / d) * (k - 1.5 / d) + 0.75;
  if (k < 2.5 / d) return n * (k - 2.25 / d) * (k - 2.25 / d) + 0.9375;
  return n * (k - 2.625 / d) * (k - 2.625 / d) + 0.984375;
};
