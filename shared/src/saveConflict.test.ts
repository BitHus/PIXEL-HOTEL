import { describe, expect, it } from 'vitest';
import { newestSide, planSync, restampSave } from './saveConflict.ts';

describe('planSync', () => {
  it('handles missing saves and ties', () => {
    expect(planSync(null, null, null)).toBe('none');
    expect(planSync(5, null, null)).toBe('upload');
    expect(planSync(null, 5, null)).toBe('download');
    expect(planSync(5, 5, 3)).toBe('none');
  });
  it('asks when two different saves have no shared past', () => {
    expect(planSync(9, 5, null)).toBe('ask');
    expect(planSync(5, 9, null)).toBe('ask');
  });
  it('takes the only side that changed since the last sync', () => {
    expect(planSync(9, 5, 5)).toBe('upload');
    expect(planSync(5, 9, 5)).toBe('download');
  });
  it('asks when both changed', () => {
    expect(planSync(9, 7, 5)).toBe('ask');
    expect(planSync(7, 9, 5)).toBe('ask');
  });
  it('falls back to the newest when neither is past the last sync', () => {
    expect(planSync(4, 3, 5)).toBe('upload');
    expect(planSync(3, 4, 5)).toBe('download');
  });
});

describe('newestSide and restampSave', () => {
  it('names the newer side', () => {
    expect(newestSide(9, 5)).toBe('local');
    expect(newestSide(5, 9)).toBe('cloud');
  });
  it('raises savedAt above the cloud save and keeps the rest', () => {
    const out = JSON.parse(restampSave(JSON.stringify({ version: 40, savedAt: 100, state: { a: 1 } }), 500, 200)!);
    expect(out).toEqual({ version: 40, savedAt: 501, state: { a: 1 } });
    expect(JSON.parse(restampSave(JSON.stringify({ savedAt: 100 }), 50, 900)!).savedAt).toBe(900);
  });
  it('refuses text that is not JSON', () => {
    expect(restampSave('nope', 1, 2)).toBeNull();
  });
});
