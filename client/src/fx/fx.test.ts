import { describe, expect, it } from 'vitest';
import { FX_HIT_STOP_MS, FX_MAX_PARTICLES, HIT_SHAKE_PX, HURT_SHAKE_PX, SCREEN_SHAKE_MS } from '@pixel-hotel/shared';
import { clamp01, easeInOutQuad, easeInQuad, easeOutBack, easeOutBounce, easeOutCubic, easeOutQuad } from './ease.ts';
import { HitStop, frameTimes } from './hitStop.ts';
import { ParticlePool } from './particles.ts';
import { Shake, hash01, shakeAmplitude, shakeOffset } from './shake.ts';

describe('easing', () => {
  it('every ease starts at 0 and ends at 1, and clamps outside 0..1', () => {
    for (const f of [easeInQuad, easeOutQuad, easeOutCubic, easeInOutQuad, easeOutBack, easeOutBounce]) {
      expect(f(0)).toBeCloseTo(0, 5);
      expect(f(1)).toBeCloseTo(1, 5);
      expect(f(-3)).toBeCloseTo(0, 5);
      expect(f(7)).toBeCloseTo(1, 5);
    }
    expect(clamp01(2)).toBe(1);
  });
  it('out-eases lead the linear line, in-ease trails it; back overshoots', () => {
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
    expect(easeInQuad(0.5)).toBeLessThan(0.5);
    expect(Math.max(...[0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
  });
});

describe('shake envelope', () => {
  it('is a whole number, decays and ends at 0', () => {
    const seen: number[] = [];
    for (let ms = 0; ms <= SCREEN_SHAKE_MS; ms += 10) seen.push(shakeAmplitude(HURT_SHAKE_PX, ms, SCREEN_SHAKE_MS));
    expect(seen.every(Number.isInteger)).toBe(true);
    expect(seen[0]).toBe(HURT_SHAKE_PX);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeLessThanOrEqual(seen[i - 1]!);
    expect(shakeAmplitude(HURT_SHAKE_PX, SCREEN_SHAKE_MS, SCREEN_SHAKE_MS)).toBe(0);
    expect(shakeAmplitude(HURT_SHAKE_PX, SCREEN_SHAKE_MS + 50, SCREEN_SHAKE_MS)).toBe(0);
    expect(shakeOffset(HURT_SHAKE_PX, SCREEN_SHAKE_MS, SCREEN_SHAKE_MS, 3, 40)).toEqual({ x: 0, y: 0 });
  });
  it('the noise is seeded: the same seed repeats, another seed differs, offsets stay in the amplitude and are whole', () => {
    expect(shakeOffset(5, 40, 160, 7, 40)).toEqual(shakeOffset(5, 40, 160, 7, 40));
    const a = Array.from({ length: 12 }, (_, i) => shakeOffset(5, i * 3, 160, 1, 1));
    const b = Array.from({ length: 12 }, (_, i) => shakeOffset(5, i * 3, 160, 2, 1));
    expect(a).not.toEqual(b);
    for (const o of a) {
      expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(5);
    }
    for (let i = 0; i < 50; i++) {
      const n = hash01(i, i * 3);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
  it('a Shake runs, ends at 0 and a weaker kick does not cut a stronger one', () => {
    const s = new Shake(40);
    s.kick(HURT_SHAKE_PX, SCREEN_SHAKE_MS);
    s.update(10);
    s.kick(HIT_SHAKE_PX, SCREEN_SHAKE_MS);
    let last = { x: 1, y: 1 };
    for (let i = 0; i < 40; i++) last = s.update(10);
    expect(s.active).toBe(false);
    expect(last).toEqual({ x: 0, y: 0 });
  });
});

describe('hit-stop', () => {
  it('freezes the drawing for its time and gives back the rest of dt', () => {
    const h = new HitStop();
    expect(h.consume(16)).toBe(16);
    h.trigger(FX_HIT_STOP_MS);
    expect(h.active).toBe(true);
    expect(h.consume(30)).toBe(0);
    expect(h.consume(30)).toBe(10);
    expect(h.active).toBe(false);
  });
  it('a shorter trigger never cuts a longer one', () => {
    const h = new HitStop();
    h.trigger(50);
    h.trigger(20);
    expect(h.consume(40)).toBe(0);
    expect(h.active).toBe(true);
  });
});

describe('hit-stop never changes the run', () => {
  it('the run gets every real ms of a 10 s session, with a hit-stop on every 7th frame, as with none; only the drawing is held back', () => {
    const play = (withStops: boolean): { runMs: number; drawMs: number; skipped: number } => {
      const stop = new HitStop();
      let runMs = 0; // what a fake api.dungeonAdvance would be handed in total
      let drawMs = 0;
      let skipped = 0;
      for (let frame = 0; frame < 600; frame++) {
        if (withStops && frame % 7 === 0) stop.trigger(FX_HIT_STOP_MS);
        const t = frameTimes(16, stop);
        runMs += t.runMs;
        drawMs += t.drawMs;
        if (t.skipDraw) skipped++;
      }
      return { runMs, drawMs, skipped };
    };
    const calm = play(false);
    const busy = play(true);
    expect(busy.runMs).toBe(calm.runMs);
    expect(busy.runMs).toBe(600 * 16);
    expect(calm.skipped).toBe(0);
    expect(busy.skipped).toBeGreaterThan(0);
    expect(busy.drawMs).toBeLessThan(calm.drawMs);
  });
  it('a frame that ends the freeze still draws the rest of its time', () => {
    const stop = new HitStop();
    stop.trigger(20);
    expect(frameTimes(16, stop)).toEqual({ runMs: 16, drawMs: 0, skipDraw: true });
    expect(frameTimes(16, stop)).toEqual({ runMs: 16, drawMs: 12, skipDraw: false });
    expect(frameTimes(16, stop)).toEqual({ runMs: 16, drawMs: 16, skipDraw: false });
  });
});

describe('particle pool', () => {
  it('never holds more than the cap and drops the spawn over it', () => {
    const pool = new ParticlePool();
    expect(pool.cap).toBe(FX_MAX_PARTICLES);
    for (let i = 0; i < FX_MAX_PARTICLES + 30; i++) pool.spawn('spark', 0, 0, 1, 1, 1000, 2, 0xffffff);
    expect(pool.count).toBe(FX_MAX_PARTICLES);
    expect(pool.spawn('spark', 0, 0, 0, 0, 100, 1, 0)).toBeNull();
  });
  it('moves, applies gravity, expires and frees the slot for reuse', () => {
    const pool = new ParticlePool(2);
    const a = pool.spawn('goo', 0, 0, 100, 0, 500, 2, 1, 200)!;
    pool.spawn('dust', 5, 5, 0, 0, 100, 2, 1);
    expect(pool.spawn('bone', 0, 0, 0, 0, 100, 2, 1)).toBeNull();
    pool.update(100);
    expect(a.x).toBeCloseTo(10, 5);
    expect(a.vy).toBeCloseTo(20, 5);
    expect(pool.count).toBe(1);
    expect(pool.spawn('bone', 1, 1, 0, 0, 100, 2, 1)?.kind).toBe('bone');
    pool.clear();
    expect(pool.count).toBe(0);
  });
  it('a particle with a floor lands, bounces lower each time and then rests on it', () => {
    const pool = new ParticlePool(1);
    const p = pool.spawn('drop', 0, 0, 0, 0, 5000, 3, 1, 600, 20, 0.5)!;
    let maxAfterFirst = 0;
    let bounced = false;
    for (let i = 0; i < 100; i++) {
      pool.update(16);
      if (p.vy < 0) bounced = true;
      expect(p.y).toBeLessThanOrEqual(20);
      if (bounced && i > 60) maxAfterFirst = Math.max(maxAfterFirst, 20 - p.y);
    }
    expect(bounced).toBe(true);
    expect(maxAfterFirst).toBeLessThan(2);
  });
  it('forEach only gives live particles', () => {
    const pool = new ParticlePool(4);
    pool.spawn('spark', 0, 0, 0, 0, 50, 1, 1);
    pool.spawn('spark', 0, 0, 0, 0, 500, 1, 1);
    pool.update(100);
    let n = 0;
    pool.forEach(() => n++);
    expect(n).toBe(1);
  });
});
