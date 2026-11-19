import { describe, expect, it } from 'vitest';
import { NPC_LINE_MAX, TALK_CHANCE } from './config.ts';
import { refillTaps, runTavern, serveAll, tidy, legacyStart, withAle } from './tavernTest.ts';
import { GAG_MOMENTS, NPC_LINES, NPC_MOMENTS, maybeSay, pickLine, reactionMoment, sayFrom, talkChance, type NpcMoment } from './npcTalk.ts';
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

describe('3g npc talk hooks', () => {
  it('has every hooked moment with short, unique lines', () => {
    for (const m of ['arrive', 'arrive_group', 'perfect_pour', 'tip', 'eating', 'leave_happy', 'leave_unhappy', 'busy', 'quiet', 'bar_guest', 'staff', 'group_chat', ...GAG_MOMENTS] as const) {
      expect(NPC_MOMENTS).toContain(m);
      expect(NPC_LINES[m].length).toBeGreaterThanOrEqual(6);
      for (const l of NPC_LINES[m]) expect(l.length).toBeLessThanOrEqual(NPC_LINE_MAX);
      expect(new Set(NPC_LINES[m]).size).toBe(NPC_LINES[m].length);
    }
  });

  it('a simulated tavern evening says lines from the new moments, all short and from the data', () => {
    const heard = new Map<string, number>();
    let s = refillTaps(withAle(), 0);
    const rng = seededRng(11);
    s = runTavern(s, 0, 6 * 60 * 60_000, rng, true, (st, events, t) => {
      for (const e of events) if (e.t === 'say') heard.set(e.text, (heard.get(e.text) ?? 0) + 1);
      return tidy(refillTaps(serveAll(st, rng), t), t);
    });
    const inMoment = (m: NpcMoment): boolean => NPC_LINES[m].some((l) => heard.has(l));
    for (const l of heard.keys()) expect(l.length).toBeLessThanOrEqual(NPC_LINE_MAX);
    for (const m of ['arrive', 'leave_happy', 'eating'] as const) expect(inMoment(m), m).toBe(true);
    expect(inMoment('busy') || inMoment('quiet') || inMoment('group_chat') || GAG_MOMENTS.some(inMoment)).toBe(true);
    expect(s.tavern.lastLines.arrive).toBeDefined();
  });

  it('sayFrom keeps the no-repeat memory in the tavern state and stays quiet at chance 0', () => {
    let s = legacyStart();
    expect(sayFrom(s, 'staff', 0, seededRng(1))).toBeNull();
    const rng = seededRng(5);
    let last: number | undefined;
    for (let i = 0; i < 100; i++) {
      const r = sayFrom(s, 'perfect_pour', 1, rng);
      expect(r).not.toBeNull();
      expect(r!.state.tavern.lastLines.perfect_pour).not.toBe(last);
      last = r!.state.tavern.lastLines.perfect_pour;
      s = r!.state;
    }
  });
});
