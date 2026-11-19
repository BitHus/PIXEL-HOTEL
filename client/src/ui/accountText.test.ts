import { describe, expect, it } from 'vitest';
import { accountMessage, saveTime } from './accountText.ts';

describe('accountMessage', () => {
  it('has a plain text for banned and the sign-up problems', () => {
    expect(accountMessage('banned')).toMatch(/banned/);
    expect(accountMessage('username_taken')).toBe('That name is taken.');
  });
  it('falls back for unknown codes and never says inn', () => {
    expect(accountMessage('http_502')).toMatch(/went wrong/);
    expect(accountMessage('x')).not.toMatch(/\binn\b/i);
  });
});

describe('saveTime', () => {
  it('says never without a time and formats a real one', () => {
    expect(saveTime(null)).toBe('never');
    expect(saveTime(0)).toBe('never');
    expect(saveTime(new Date(2026, 10, 19, 9, 5).getTime())).toBe('19 Nov 2026, 09:05');
  });
});
