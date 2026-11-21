// Pure helpers for the music effects (OB-9): the generated reverb impulse and a narrow pulse wave. No Web Audio here.

import { mulberry32 } from './musicForm.ts';

/** A stereo reverb impulse from seeded noise: exponential decay (about 60 dB over the tail) with a one-pole lowpass that darkens it. */
export function makeImpulse(sampleRate: number, seconds: number, damp: number, seed = 1): [Float32Array, Float32Array] {
  const n = Math.max(1, Math.floor(sampleRate * seconds));
  const decay = 6.9 / seconds;
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    const rng = mulberry32(seed + ch * 7919); // left and right differ
    const data = out[ch]!;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const a = 0.5 + 0.4 * damp * (i / n); // the smoothing grows along the tail: later = darker
      y = y * a + (rng() * 2 - 1) * (1 - a);
      data[i] = y * Math.exp(-(i / sampleRate) * decay) * 2;
    }
  }
  return out;
}

/** Fourier coefficients of a pulse wave with a duty cycle (0.25 = the reedy NES pulse): b_n = 2 / (n pi) * sin(n pi duty). */
export function pulseCoeffs(duty: number, harmonics = 32): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return { real, imag };
}
