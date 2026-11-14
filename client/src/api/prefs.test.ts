import { describe, expect, it } from 'vitest';
import { PREFS_KEY, SOUND_DEFAULT_VOLUME } from '@pixel-hotel/shared';
import { DEFAULT_PREFS, loadPrefs, parsePrefs, savePrefs } from './prefs.ts';
import { memoryStorage } from './saveStorage.ts';

describe('prefs', () => {
  it('defaults: sound on and quiet, lighting on', () => {
    expect(parsePrefs(null)).toEqual({ sound: true, volume: SOUND_DEFAULT_VOLUME, lighting: true });
    expect(SOUND_DEFAULT_VOLUME).toBeLessThanOrEqual(0.5);
  });
  it('damaged or odd text gives the defaults', () => {
    expect(parsePrefs('{not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"hello"')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"sound":"yes","volume":"loud","lighting":1}')).toEqual(DEFAULT_PREFS);
  });
  it('keeps valid values and clamps the volume', () => {
    expect(parsePrefs('{"sound":false,"volume":0.8,"lighting":false}')).toEqual({ sound: false, volume: 0.8, lighting: false });
    expect(parsePrefs('{"volume":7}').volume).toBe(1);
    expect(parsePrefs('{"volume":-1}').volume).toBe(0);
  });
  it('saves and loads through the storage', () => {
    const s = memoryStorage();
    savePrefs(s, { sound: false, volume: 0.2, lighting: false });
    expect(s.data.has(PREFS_KEY)).toBe(true);
    expect(loadPrefs(s)).toEqual({ sound: false, volume: 0.2, lighting: false });
  });
});
