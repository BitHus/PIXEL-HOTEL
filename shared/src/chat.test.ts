import { describe, expect, it } from 'vitest';
import { cleanChatText } from './chat.ts';

describe('cleanChatText', () => {
  it('trims, flattens whitespace and control characters', () => {
    expect(cleanChatText('  hi \n\t there ')).toBe('hi there');
  });
  it('returns null for empty messages', () => {
    expect(cleanChatText('   \n')).toBeNull();
  });
  it('cuts to 120 characters', () => {
    expect(cleanChatText('a'.repeat(200))).toHaveLength(120);
    expect(Array.from(cleanChatText('😀'.repeat(130))!)).toHaveLength(120);
  });
});
