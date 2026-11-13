import { describe, expect, it } from 'vitest';
import { TEXT_MIN_MS, TEXT_MS_PER_WORD } from './config.ts';
import { readingMs, wordCount } from './text.ts';

describe('reading pace', () => {
  it('counts words', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  Not  enough gold. ')).toBe(3);
  });
  it('at least 4 s plus 0.35 s per word', () => {
    expect(TEXT_MIN_MS).toBe(4000);
    expect(TEXT_MS_PER_WORD).toBe(350);
    expect(readingMs('')).toBe(4000);
    expect(readingMs('Not enough gold.')).toBe(4000 + 3 * 350);
    expect(readingMs('one two three four five six seven eight nine ten')).toBe(7500);
    expect(readingMs('hi', 6000)).toBe(6000);
  });
});
