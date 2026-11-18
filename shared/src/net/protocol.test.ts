import { describe, expect, it } from 'vitest';
import { API_PATHS, isVisitResponse, passwordProblem, ROOM_VIEW_VERSION, usernameProblem, visitCodeFromQuery } from './protocol.ts';

describe('account rules (shared by server and client)', () => {
  it('usernames: 3 to 16, letter first, letters digits underscore, not reserved', () => {
    expect(usernameProblem('Tester_1')).toBeNull();
    expect(usernameProblem('ab')).toBe('username_length');
    expect(usernameProblem('a'.repeat(17))).toBe('username_length');
    expect(usernameProblem('1abc')).toBe('username_chars');
    expect(usernameProblem('café')).toBe('username_chars');
    expect(usernameProblem('ROOT')).toBe('username_reserved');
    expect(usernameProblem(undefined)).toBe('username_type');
  });

  it('passwords: 8 characters to 72 bytes, not one character repeated or a common one', () => {
    expect(passwordProblem('correct horse')).toBeNull();
    expect(passwordProblem('1234567')).toBe('password_short');
    expect(passwordProblem('é'.repeat(37))).toBe('password_long'); // 74 bytes, 37 characters
    expect(passwordProblem(`ab${'é'.repeat(35)}`)).toBeNull(); // 72 bytes
    expect(passwordProblem('zzzzzzzzzz')).toBe('password_common');
    expect(passwordProblem('PocketBarrel')).toBe('password_common');
    expect(passwordProblem(12345678)).toBe('password_type');
  });
});

describe('protocol helpers', () => {
  it('every path is under /api/', () => {
    for (const p of Object.values(API_PATHS)) expect(p.startsWith('/api/')).toBe(true);
  });

  it('reads a visit code from the page query, same alphabet as the server', () => {
    expect(visitCodeFromQuery('?visit=k7qx2m')).toBe('K7QX2M');
    expect(visitCodeFromQuery('?a=1&visit=K7Q-X2M#x')).toBe('K7QX2M');
    expect(visitCodeFromQuery('?visit=K0QX2M')).toBeNull(); // 0 is not in the alphabet
    expect(visitCodeFromQuery('?visit=%E0%A4%A')).toBeNull();
    expect(visitCodeFromQuery('')).toBeNull();
  });

  it('isVisitResponse accepts the server shape and refuses others', () => {
    const ok = { code: 'K7QX2M', title: 'Hi', view: { v: ROOM_VIEW_VERSION, owner: { name: 'Bo', look: {} }, room: { kind: 'hotel' }, items: [], stars: 1, savedAt: 0 } };
    expect(isVisitResponse(ok)).toBe(true);
    expect(isVisitResponse({ ...ok, view: { ...ok.view, v: ROOM_VIEW_VERSION + 1 } })).toBe(false);
    expect(isVisitResponse({ ...ok, title: 3 })).toBe(false);
    expect(isVisitResponse(null)).toBe(false);
  });
});
