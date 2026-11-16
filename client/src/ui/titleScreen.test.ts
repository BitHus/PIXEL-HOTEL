import { describe, expect, it } from 'vitest';
import { continueNote } from './titleScreen.ts';
import { MEDIEVAL_ICONS } from './pixelIconsMedieval.ts';

describe('title screen', () => {
  it('says why Continue is off, or who continues', () => {
    expect(continueNote({ exists: false, canContinue: false })).toBe('No saved game yet.');
    expect(continueNote({ exists: true, canContinue: false, problem: 'invalid' })).toContain('damaged');
    expect(continueNote({ exists: true, canContinue: true, playerName: 'Mira', innName: 'The Lantern', level: 3 })).toBe('Mira, The Lantern, level 3');
  });
});

describe('medieval icons', () => {
  it('are 16 x 16 and use only mapped characters', () => {
    for (const [name, icon] of Object.entries(MEDIEVAL_ICONS)) {
      expect(icon.rows, name).toHaveLength(16);
      for (const row of icon.rows) {
        expect(row.length, name).toBe(16);
        for (const ch of row) if (ch !== '.') expect(icon.colors[ch], `${name} ${ch}`).toBeTruthy();
      }
    }
  });
});
