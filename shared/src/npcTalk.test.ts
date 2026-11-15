import { describe, expect, it } from 'vitest';
import { NPC_LINE_MAX, TALK_CHANCE } from './config.ts';
import { NPC_LINES, NPC_MOMENTS, maybeSay, pickLine, reactionMoment, talkChance } from './npcTalk.ts';
import { seededRng } from './rng.ts';

describe('npc lines', () => {
  it('has every moment with at least 6 short lines', () => {
    for (const m of ['cheap', 'fair', 'high', 'too_high', 'lovely', 'no_seat', 'no_menu', 'table_talk', 'toast', 'drink_talk', 'order_wait', 'unhappy', 'thanks'] as const) {
      expect(NPC_MOMENTS).toContain(m);
      expect(NPC_LINES[m].length).toBeGreaterThanOrEqual(6);
      for (const l of NPC_LINES[m]) expect(l.length).toBeLessThanOrEqual(NPC_LINE_MAX);
      expect(new Set(NPC_LINES[m]).size).toBe(NPC_LINES[m].length);
    }
    expect(NPC_LINES.order_wait).toContain('Barkeep? Over here!');
    // Step S1: the lines about shopping at a stall are gone.
    for (const gone of ['enter', 'browse', 'queue', 'pay', 'leave', 'empty', 'smalltalk', 'remark', 'window']) expect(NPC_MOMENTS).not.toContain(gone);
  });

  it('never picks the same line twice in a row', () => {
    const rng = seededRng(7);
    let last: number | undefined;
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const k = pickLine('toast', rng, last);
      expect(k).not.toBe(last);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(NPC_LINES.toast.length);
      seen.add(k);
      last = k;
    }
    expect(seen.size).toBe(NPC_LINES.toast.length);
  });

  it('is deterministic for the same rng', () => {
    const a = [1, 2, 3].map(() => pickLine('thanks', seededRng(3), 0));
    expect(new Set(a).size).toBe(1);
  });

  it('maps reactions to moments', () => {
    expect(reactionMoment('big_smile')).toBe('cheap');
    expect(reactionMoment('smile')).toBe('fair');
    expect(reactionMoment('shrug')).toBe('high');
    expect(reactionMoment('frown')).toBe('too_high');
  });

  it('talks more when chatty, less when hurried, never above 1', () => {
    expect(talkChance('table', 'browser')).toBe(TALK_CHANCE.table);
    expect(talkChance('table', 'chatty')).toBeGreaterThan(TALK_CHANCE.table);
    expect(talkChance('table', 'hurried')).toBeLessThan(TALK_CHANCE.table);
    expect(talkChance('reaction', 'chatty')).toBeLessThanOrEqual(1);
  });

  it('maybeSay stays quiet at chance 0 and remembers the line', () => {
    expect(maybeSay({}, 'thanks', 0, seededRng(1))).toBeNull();
    const r = maybeSay({ thanks: 2 }, 'thanks', 1, seededRng(1));
    expect(r).not.toBeNull();
    expect(NPC_LINES.thanks).toContain(r!.text);
    expect(r!.lastLines.thanks).not.toBe(2);
    expect(r!.text).toBe(NPC_LINES.thanks[r!.lastLines.thanks!]);
  });
});
