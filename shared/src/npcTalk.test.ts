import { describe, expect, it } from 'vitest';
import { NPC_LINE_MAX, TALK_CHANCE } from './config.ts';
import { NPC_LINES, NPC_MOMENTS, maybeSay, pickLine, reactionMoment, talkChance } from './npcTalk.ts';
import { seededRng } from './rng.ts';

describe('npc lines', () => {
  it('has every moment with at least 6 short lines', () => {
    for (const m of ['enter', 'browse', 'cheap', 'fair', 'high', 'too_high', 'queue', 'pay', 'leave', 'lovely', 'empty'] as const) {
      expect(NPC_MOMENTS).toContain(m);
      expect(NPC_LINES[m].length).toBeGreaterThanOrEqual(6);
      for (const l of NPC_LINES[m]) expect(l.length).toBeLessThanOrEqual(NPC_LINE_MAX);
      expect(new Set(NPC_LINES[m]).size).toBe(NPC_LINES[m].length);
    }
    expect(NPC_LINES.queue).toContain('Hello? Anyone here?');
  });

  it('never picks the same line twice in a row', () => {
    const rng = seededRng(7);
    let last: number | undefined;
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const k = pickLine('enter', rng, last);
      expect(k).not.toBe(last);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(NPC_LINES.enter.length);
      seen.add(k);
      last = k;
    }
    expect(seen.size).toBe(NPC_LINES.enter.length);
  });

  it('is deterministic for the same rng', () => {
    const a = [1, 2, 3].map(() => pickLine('pay', seededRng(3), 0));
    expect(new Set(a).size).toBe(1);
  });

  it('maps reactions to moments', () => {
    expect(reactionMoment('big_smile')).toBe('cheap');
    expect(reactionMoment('smile')).toBe('fair');
    expect(reactionMoment('shrug')).toBe('high');
    expect(reactionMoment('frown')).toBe('too_high');
  });

  it('talks more when chatty, less when hurried, never above 1', () => {
    expect(talkChance('enter', 'browser')).toBe(TALK_CHANCE.enter);
    expect(talkChance('enter', 'chatty')).toBeGreaterThan(TALK_CHANCE.enter);
    expect(talkChance('enter', 'hurried')).toBeLessThan(TALK_CHANCE.enter);
    expect(talkChance('remark', 'chatty')).toBeLessThanOrEqual(1);
  });

  it('maybeSay stays quiet at chance 0 and remembers the line', () => {
    expect(maybeSay({}, 'leave', 0, seededRng(1))).toBeNull();
    const r = maybeSay({ leave: 2 }, 'leave', 1, seededRng(1));
    expect(r).not.toBeNull();
    expect(NPC_LINES.leave).toContain(r!.text);
    expect(r!.lastLines.leave).not.toBe(2);
    expect(r!.text).toBe(NPC_LINES.leave[r!.lastLines.leave!]);
  });
});
