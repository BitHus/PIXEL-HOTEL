import { describe, expect, it } from 'vitest';
import { accountMessage, saveTime } from './accountText.ts';

describe('accountMessage', () => {
  it('has a plain text for banned and the sign-up problems', () => {
    expect(accountMessage('banned')).toMatch(/banned/);
    expect(accountMessage('username_taken')).toBe('That name is taken.');
  });
  it('falls back for unknown codes and never says inn', () => {
    expect(accountMessage('http_418')).toMatch(/went wrong/);
    expect(accountMessage('http_502')).toBe(accountMessage('server_error'));
    expect(accountMessage('http_429')).toBe(accountMessage('rate_limited'));
  });
  it('every server error code has its own text', () => {
    for (const code of ['bad_request', 'bad_json', 'too_large', 'rate_limited', 'unauthorized', 'not_found', 'server_error', 'age_required', 'username_taken', 'bad_login', 'banned', 'no_save', 'not_a_save', 'too_new', 'too_old', 'invalid', 'bad_time', 'bad_state', 'newer_on_server', 'bad_title', 'no_room', 'not_visitable', 'network', 'bad_answer']) {
      expect(accountMessage(code), code).not.toMatch(/went wrong/);
    }
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
