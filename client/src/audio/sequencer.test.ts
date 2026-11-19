import { describe, expect, it } from 'vitest';
import { TRACKS } from './musicData.ts';
import { crossfadeGains, eventsBetween, fadePlan, loopSeconds, loopSteps, noteHz, parsePattern, trackFor, volumeGain } from './sequencer.ts';

describe('note table', () => {
  it('knows A4 and octaves', () => {
    expect(noteHz('A4')).toBeCloseTo(440);
    expect(noteHz('A5')).toBeCloseTo(880);
    expect(noteHz('C4')).toBeCloseTo(261.63, 1);
    expect(noteHz('F#4')).toBeCloseTo(369.99, 1);
    expect(noteHz('Bb3')).toBeCloseTo(233.08, 1);
    expect(noteHz('k')).toBeNull();
  });
});

describe('every track', () => {
  for (const track of Object.values(TRACKS)) {
    it(`${track.id}: all voices fill the loop exactly and notes parse`, () => {
      for (const v of track.voices) {
        const p = parsePattern(v.pattern);
        expect(p.steps).toBe(loopSteps(track));
        if (v.wave !== 'noise') for (const e of p.events) expect(noteHz(e.note), e.note).not.toBeNull();
        else for (const e of p.events) expect(['k', 's', 'h']).toContain(e.note);
      }
    });
    it(`${track.id}: loop is 15 to 60 seconds`, () => {
      expect(loopSeconds(track)).toBeGreaterThan(15);
      expect(loopSeconds(track)).toBeLessThan(60);
    });
  }
  it('the tavern jig is about 100 bpm in 6/8', () => {
    expect(TRACKS.tavern.bpm).toBe(100);
    expect(TRACKS.tavern.stepsPerBar).toBe(6);
  });
});

describe('parsePattern', () => {
  it('counts rests and lengths', () => {
    expect(parsePattern('A4:2 -:2 B4')).toEqual({ steps: 5, events: [{ step: 0, len: 2, note: 'A4' }, { step: 4, len: 1, note: 'B4' }] });
  });
  it('rejects bad tokens', () => {
    expect(() => parsePattern('A4:0')).toThrow();
  });
});

describe('eventsBetween', () => {
  const ev = [{ step: 0, len: 1, note: 'A4' }, { step: 3, len: 1, note: 'B4' }];
  it('windows inside a loop and across the seam', () => {
    expect(eventsBetween(ev, 4, 0, 4).map((e) => e.at)).toEqual([0, 3]);
    expect(eventsBetween(ev, 4, 3, 6).map((e) => e.at)).toEqual([3, 4]);
    expect(eventsBetween(ev, 4, 8, 8)).toEqual([]);
  });
});

describe('places, fades and volume', () => {
  it('maps rooms to tracks', () => {
    expect(trackFor('shop')).toBe('tavern');
    expect(trackFor('cellar')).toBe('tavern');
    expect(trackFor('hotel')).toBe('title');
    expect(trackFor('mine')).toBe('mine');
    expect(trackFor('nowhere')).toBeNull();
  });
  it('plans fades', () => {
    expect(fadePlan('tavern', 'tavern')).toBe('none');
    expect(fadePlan(null, 'farm')).toBe('start');
    expect(fadePlan('farm', null)).toBe('stop');
    expect(fadePlan('farm', 'mine')).toBe('crossfade');
  });
  it('crossfade keeps equal power', () => {
    for (const p of [0, 0.3, 0.5, 1]) {
      const g = crossfadeGains(p);
      expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1);
    }
    expect(crossfadeGains(0).in).toBe(0);
  });
  it('volume curve', () => {
    expect(volumeGain(false, 1)).toBe(0);
    expect(volumeGain(true, 0.5)).toBeCloseTo(0.25);
    expect(volumeGain(true, 9)).toBe(1);
  });
});
