import { describe, expect, it } from 'vitest';
import { PREFS_KEY, SOUND_DEFAULT_VOLUME } from '@pixel-hotel/shared';
import { DEFAULT_PREFS, loadPrefs, parsePrefs, savePrefs } from './prefs.ts';
import { memoryStorage } from './saveStorage.ts';

describe('prefs', () => {
  it('defaults: sound on and quiet, lighting on, build grid on', () => {
    expect(parsePrefs(null)).toEqual({ sound: true, volume: SOUND_DEFAULT_VOLUME, lighting: true, cellGrid: true, popups: true, nameTags: true, doorHintSeen: false, reduceEffects: false, hintsSeen: [] });
    expect(SOUND_DEFAULT_VOLUME).toBeLessThanOrEqual(0.5);
  });
  it('damaged or odd text gives the defaults', () => {
    expect(parsePrefs('{not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"hello"')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"sound":"yes","volume":"loud","lighting":1,"cellGrid":"on"}')).toEqual(DEFAULT_PREFS);
  });
  it('keeps valid values (popups can be switched off) and clamps the volume', () => {
    expect(parsePrefs('{"popups":false}').popups).toBe(false);
    expect(parsePrefs('{"sound":false,"volume":0.8,"lighting":false,"cellGrid":false}')).toEqual({ sound: false, volume: 0.8, lighting: false, cellGrid: false, popups: true, nameTags: true, doorHintSeen: false, reduceEffects: false, hintsSeen: [] });
    expect(parsePrefs('{"nameTags":false,"doorHintSeen":true}')).toMatchObject({ nameTags: false, doorHintSeen: true });
    expect(parsePrefs('{"nameTags":"no","doorHintSeen":1}')).toMatchObject({ nameTags: true, doorHintSeen: false, reduceEffects: false, hintsSeen: [] });
    expect(parsePrefs('{"volume":7}').volume).toBe(1);
    expect(parsePrefs('{"volume":-1}').volume).toBe(0);
  });
  it('reduceEffects is off by default and reads a stored boolean only', () => {
    expect(DEFAULT_PREFS.reduceEffects).toBe(false);
    expect(parsePrefs('{"reduceEffects":true}').reduceEffects).toBe(true);
    expect(parsePrefs('{"reduceEffects":"yes"}').reduceEffects).toBe(false);
  });
  it('the old followCamera pref is dropped: old saves (free look or locked) read and save without it (camera always locked, 19 Nov)', () => {
    expect(parsePrefs('{"followCamera":false}')).toEqual(DEFAULT_PREFS);
    expect('followCamera' in DEFAULT_PREFS).toBe(false);
  });
  it('saves and loads through the storage', () => {
    const s = memoryStorage();
    savePrefs(s, { sound: false, volume: 0.2, lighting: false, cellGrid: false, popups: false, nameTags: false, doorHintSeen: true, reduceEffects: true, hintsSeen: ['stove'] });
    expect(s.data.has(PREFS_KEY)).toBe(true);
    expect(loadPrefs(s)).toEqual({ sound: false, volume: 0.2, lighting: false, cellGrid: false, popups: false, nameTags: false, doorHintSeen: true, reduceEffects: true, hintsSeen: ['stove'] });
  });
});
