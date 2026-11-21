import { describe, expect, it } from 'vitest';
import { TRACKS } from './musicData.ts';
import { makeImpulse, pulseCoeffs } from './musicFx.ts';
import { FORM_BARS, accentFor, arcLevel, arpEvents, chordNotes, dottedEighth, dropout, humanize, jitterMs, leadTranspose, mulberry32, padEvents, parseChords, sectionOf, swingDelay } from './musicForm.ts';
import { loopSteps, noteHz, parseTrack } from './sequencer.ts';

describe('chords', () => {
  it('builds triads and sevenths with the root in the octave', () => {
    expect(chordNotes('D', 3)).toEqual(['D3', 'F#3', 'A3']);
    expect(chordNotes('Bm', 3)).toEqual(['B3', 'D4', 'F#4']);
    expect(chordNotes('E7', 2)).toEqual(['E2', 'G#2', 'B2', 'D3']);
    expect(chordNotes('Dm7', 3)).toEqual(['D3', 'F3', 'A3', 'C4']);
    expect(() => chordNotes('H', 3)).toThrow();
  });
  for (const track of Object.values(TRACKS)) {
    it(`${track.id}: one chord per bar, pad covers the loop exactly, arp stays inside it with valid notes`, () => {
      expect(parseChords(track)).toHaveLength(track.bars);
      const pad = padEvents(track);
      let at = 0;
      for (const e of pad) {
        expect(e.step).toBe(at);
        at += e.len;
      }
      expect(at).toBe(loopSteps(track));
      for (const e of arpEvents(track)) {
        expect(e.step + e.len).toBeLessThanOrEqual(loopSteps(track));
        expect(noteHz(e.note), e.note).not.toBeNull();
      }
      expect(arpEvents(track).length > 0).toBe(track.arp !== undefined);
    });
    it(`${track.id}: parseTrack adds a pad voice and every data voice has a role`, () => {
      const { voices } = parseTrack(track.id);
      expect(voices.some((v) => v.role === 'pad')).toBe(true);
      for (const v of track.voices) expect(v.role).toBeTruthy();
    });
  }
  it('the tavern jig splits bars 7 and 8 into two chords', () => {
    const t = TRACKS.tavern;
    expect(parseChords(t)[6]).toEqual(['D', 'A']);
    expect(padEvents(t).find((e) => e.step === 6 * 6 + 3)?.note).toBe('A');
  });
  it('arp repeats a tone three times in the tavern jig', () => {
    const a = arpEvents(TRACKS.tavern).slice(0, 6).map((e) => e.note);
    expect(a[0]).toBe(a[2]);
    expect(a[3]).toBe(a[5]);
    expect(a[0]).not.toBe(a[3]);
  });
});

describe('form and arc', () => {
  it('the form is 16 bars in 4 sections', () => {
    expect(FORM_BARS).toBe(16);
    expect(sectionOf(0, 8)).toBe(0);
    expect(sectionOf(4 * 8, 8)).toBe(1);
    expect(sectionOf(15 * 8, 8)).toBe(3);
    expect(sectionOf(16 * 8, 8)).toBe(0); // wraps
  });
  it('builds up: pad and bass first, lead, then drums and arp', () => {
    expect(arcLevel('pad', 0)).toBeCloseTo(0.6);
    expect(arcLevel('lead', 0)).toBe(0);
    expect(arcLevel('lead', 1)).toBeGreaterThan(0);
    expect(arcLevel('drums', 1)).toBe(0);
    expect(arcLevel('arp', 2)).toBe(1);
    expect(arcLevel('lead', 3)).toBe(1);
  });
  it('second time round the lead is an octave up', () => {
    expect(leadTranspose(0)).toBe(0);
    expect(leadTranspose(1)).toBe(12);
    expect(leadTranspose(2)).toBe(0);
  });
  it('dropouts: kick on every 4th bar beat 1, bass on every 8th bar', () => {
    expect(dropout('drums', 'k', 3 * 6, 6)).toBe(true);
    expect(dropout('drums', 'k', 2 * 6, 6)).toBe(false);
    expect(dropout('drums', 'h', 3 * 6, 6)).toBe(false);
    expect(dropout('bass', 'D3', 7 * 6, 6)).toBe(true);
    expect(dropout('bass', 'D3', 6 * 6, 6)).toBe(false);
  });
});

describe('humanising', () => {
  it('the seeded rng is repeatable and in range', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('jitter, velocity and detune stay inside their limits', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 500; i++) {
      const lead = humanize(rng, 'lead', 'D5', 0.75);
      expect(Math.abs(lead.dt)).toBeLessThanOrEqual(0.008);
      expect(Math.abs(lead.cents)).toBeLessThanOrEqual(3);
      expect(lead.vel).toBeLessThanOrEqual(1);
      expect(lead.vel).toBeGreaterThan(0.6);
      expect(Math.abs(humanize(rng, 'drums', 'k', 1).dt)).toBe(0);
      expect(Math.abs(humanize(rng, 'bass', 'D3', 1).dt)).toBeLessThanOrEqual(0.004);
      expect(Math.abs(humanize(rng, 'pad', 'D', 1).cents)).toBe(0);
    }
    expect(jitterMs('pad', 'D')).toBe(0);
  });
  it('accents beat 1 over beat 3 over upbeats', () => {
    expect(accentFor(0, 3)).toBe(1);
    expect(accentFor(3, 3)).toBe(0.9);
    expect(accentFor(1, 3)).toBe(0.75);
  });
  it('swing only delays odd eighths of straight tracks', () => {
    expect(swingDelay(1, 2, 0.1, 0.4)).toBeCloseTo(0.04);
    expect(swingDelay(2, 2, 0.1, 0.4)).toBe(0);
    expect(swingDelay(1, 3, 0.1, 0.4)).toBe(0);
    expect(swingDelay(1, 2, undefined, 0.4)).toBe(0);
  });
  it('the echo is a dotted eighth', () => {
    expect(dottedEighth(100)).toBeCloseTo(0.45);
    expect(dottedEighth(60)).toBeCloseTo(0.75);
  });
});

describe('effects data', () => {
  it('the generated impulse is stereo, decays and differs per channel', () => {
    const [l, r] = makeImpulse(8000, 1, 0.8, 3);
    expect(l).toHaveLength(8000);
    expect(l).not.toEqual(r);
    const rms = (a: Float32Array, from: number, to: number): number => Math.sqrt(a.slice(from, to).reduce((s, x) => s + x * x, 0) / (to - from));
    expect(rms(l, 0, 800)).toBeGreaterThan(rms(l, 7000, 8000) * 5);
    expect(makeImpulse(8000, 1, 0.8, 3)[0]).toEqual(l);
  });
  it('the 25% pulse has the Fourier series b_n = 2/(n pi) sin(n pi d)', () => {
    const { real, imag } = pulseCoeffs(0.25, 8);
    expect(real).toHaveLength(9);
    expect(imag[1]).toBeCloseTo((2 / Math.PI) * Math.sin(Math.PI * 0.25));
    expect(imag[4]).toBeCloseTo(0); // sin(pi) = 0
  });
});
