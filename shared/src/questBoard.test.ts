import { describe, expect, it } from 'vitest';
import { applyChange } from './ledger.ts';
import { MIGRATIONS } from './save.ts';
import { createNewPlayer } from './newPlayer.ts';
import { DAILY_BLOCK_DAYS, QUEST_DATA, activeEvent, claimQuest, dailyQuests, dayInfo, questBoard } from './questBoard.ts';
import { HINTS } from './config.ts';

const day = dayInfo(Date.UTC(2026, 10, 17, 12), 0);
const keys = (n: number): string[] => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

describe('daily quests (TUT-2 part 3)', () => {
  it('the same date gives the same picks, always dailyCount, each from another area', () => {
    for (const k of keys(60)) {
      const a = dailyQuests(k, 1);
      expect(a.map((q) => q.id)).toEqual(dailyQuests(k, 1).map((q) => q.id));
      expect(a).toHaveLength(QUEST_DATA.dailyCount);
      expect(new Set(a.map((q) => q.area)).size).toBe(a.length);
    }
  });
  it('level-gated quests (mine) wait for the level, and a day never repeats the day before', () => {
    for (const k of keys(60)) expect(dailyQuests(k, 1).some((q) => q.id === 'd_mine')).toBe(false);
    const ks = keys(40);
    for (let i = 1; i < ks.length; i++) {
      if (Math.floor(Date.parse(ks[i]!) / 86_400_000) % DAILY_BLOCK_DAYS === 0) continue;
      const prev = new Set(dailyQuests(ks[i - 1]!, 3).map((q) => q.id));
      expect(dailyQuests(ks[i]!, 3).filter((q) => prev.has(q.id)).length).toBe(0);
    }
  });
  it('rewards are small gold only (no gems, never over the daily maximum)', () => {
    for (const q of [...QUEST_DATA.daily, ...QUEST_DATA.events.flatMap((e) => e.quests)]) expect(q.gold).toBeLessThanOrEqual(QUEST_DATA.dailyGoldMax);
    expect(QUEST_DATA.dailyCount * QUEST_DATA.dailyGoldMax).toBeLessThanOrEqual(75);
  });
  it('dayInfo gives the local day and its midnight', () => {
    const d = dayInfo(Date.UTC(2026, 10, 17, 23, 30), -120); // UTC+2: already the 18th
    expect(d.key).toBe('2026-11-18');
    expect(d.startMs).toBe(Date.UTC(2026, 10, 17, 22));
  });
});

describe('events and claims', () => {
  it('finds the running event, also over New Year', () => {
    expect(activeEvent('2026-11-17')?.event.id).toBe('harvest_feast');
    expect(activeEvent('2027-01-02')).toMatchObject({ startKey: '2026-12-15' });
    expect(activeEvent('2026-09-01')).toBeNull();
  });
  it('progress is counted from the ledger; a claim pays gold once through the ledger (reason quest)', () => {
    let s = createNewPlayer(undefined, 0);
    const pick = dailyQuests(day.key, 1)[0]!;
    const row = () => questBoard(s, day).daily.find((r) => r.text === pick.text)!;
    expect(row().ready).toBe(false);
    expect(claimQuest(s, row().claimId, day, 5)).toBeNull();
    for (let i = 0; i < pick.target; i++) {
      const m = pick.measure === 'made' ? { wood: 1 } : { wood: -0 };
      s = applyChange(s, { reason: pick.reasons[0] as never, gold: pick.reasons[0] === 'tavern' ? 1 : 0, materials: m }, day.startMs + 1000 + i)!;
    }
    expect(row().ready).toBe(true);
    const gold = s.player.wallet.gold;
    const paid = claimQuest(s, row().claimId, day, day.startMs + 9000)!;
    expect(paid.player.wallet.gold).toBe(gold + pick.gold);
    expect(paid.ledger.at(-1)).toMatchObject({ reason: 'quest', goldDelta: pick.gold });
    s = paid;
    expect(row()).toMatchObject({ claimed: true, ready: false });
    expect(claimQuest(s, row().claimId, day, 9)).toBeNull();
  });
  it('yesterday\'s ledger does not count for today', () => {
    let s = createNewPlayer(undefined, 0);
    const pick = dailyQuests(day.key, 1)[0]!;
    s = applyChange(s, { reason: pick.reasons[0] as never, materials: { wood: 1 } }, day.startMs - 1000)!;
    expect(questBoard(s, day).daily.every((r) => r.progress === 0)).toBe(true);
  });
  it('old hint quests become first_* achievements, done without a claim', () => {
    const s = { ...createNewPlayer(undefined, 0), hintsDone: 3 };
    const rows = questBoard(s, day).achievements.filter((r) => r.claimId.startsWith('first_'));
    expect(rows).toHaveLength(HINTS.length);
    expect(rows.filter((r) => r.claimed)).toHaveLength(3);
    expect(rows.some((r) => r.ready)).toBe(false);
  });
});

describe('save migration 32 -> 33', () => {
  it('adds quests.claimed and keeps hintsDone', () => {
    const s = createNewPlayer(undefined, 0) as unknown as Record<string, unknown>;
    const { quests: _q, ...old } = s;
    const next = MIGRATIONS[32]!({ ...old, hintsDone: 4 }) as { quests: { claimed: string[] }; hintsDone: number };
    expect(next.quests).toEqual({ claimed: [] });
    expect(next.hintsDone).toBe(4);
  });
});

describe('review fixes 17 Nov', () => {
  const dayA = dayInfo(Date.UTC(2026, 10, 18, 0, 30), 0);
  const dayB = dayInfo(Date.UTC(2026, 10, 17, 23, 30), 0); // the day before, reached by a clock flip
  const doAll = (s: ReturnType<typeof createNewPlayer>, d: typeof dayA, at: number) => {
    let st = s;
    for (const q of dailyQuests(d.key, 1)) {
      for (let i = 0; i < q.target; i++) st = applyChange(st, { reason: q.reasons[0] as never, gold: q.reasons[0] === 'tavern' ? 1 : 0, materials: q.measure === 'made' ? { wood: 1 } : { wood: -0 } }, at + i)!;
    }
    return st;
  };
  it('finding 1: flipping the clock back and forth never pays a daily twice', () => {
    let s = createNewPlayer(undefined, 0);
    s = doAll(s, dayB, dayB.startMs + 1000);
    s = doAll(s, dayA, dayA.startMs + 1000);
    let paid = 0;
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const d of [dayA, dayB]) {
        for (const r of questBoard(s, d).daily) {
          const next = claimQuest(s, r.claimId, d, d.startMs + 5000);
          if (next) {
            paid += next.player.wallet.gold - s.player.wallet.gold;
            s = next;
          }
        }
      }
    }
    expect(paid).toBeLessThanOrEqual(QUEST_DATA.dailyCount * QUEST_DATA.dailyGoldMax * 2);
    for (const d of [dayA, dayB]) expect(questBoard(s, d).daily.every((r) => !r.ready)).toBe(true);
  });
  it('finding 1: entries stamped tomorrow do not count today; tz offset is clamped', () => {
    let s = createNewPlayer(undefined, 0);
    const pick = dailyQuests(day.key, 1)[0]!;
    for (let i = 0; i < pick.target; i++) s = applyChange(s, { reason: pick.reasons[0] as never, materials: { wood: 1 } }, day.startMs + 86_400_000 + 5 + i)!;
    expect(questBoard(s, day).daily.every((r) => r.progress === 0)).toBe(true);
    expect(dayInfo(Date.UTC(2026, 10, 17, 12), 99999)).toEqual(dayInfo(Date.UTC(2026, 10, 17, 12), 720));
    expect(dayInfo(Date.UTC(2026, 10, 17, 12), -99999)).toEqual(dayInfo(Date.UTC(2026, 10, 17, 12), -840));
  });
  it('finding 3: a run that ended in death (or Abandon) does not count as brought home', () => {
    let s = createNewPlayer(undefined, 0);
    s = applyChange(s, { reason: 'dungeon_bank', note: 'dungeon run dead' }, 5)!;
    const run5 = QUEST_DATA.achievements.find((q) => q.id === 'run_5')!;
    expect(questBoard(s, day).achievements.find((r) => r.text === run5.text)!.progress).toBe(0);
    s = applyChange(s, { reason: 'dungeon_bank', note: 'dungeon run left' }, 6)!;
    expect(questBoard(s, day).achievements.find((r) => r.text === run5.text)!.progress).toBe(1);
  });
  it('finding 4: a level-up does not re-roll the day (only a gated quest is swapped)', () => {
    for (const k of keys(200)) {
      const l2 = dailyQuests(k, 2);
      const l3 = dailyQuests(k, 3);
      expect(l2).toHaveLength(QUEST_DATA.dailyCount);
      expect(l3).toHaveLength(QUEST_DATA.dailyCount);
      expect(l3.filter((q) => !l2.includes(q)).length).toBeLessThanOrEqual(1);
      expect(l2.some((q) => (q.minLevel ?? 1) > 2)).toBe(false);
    }
  });
  it('finding 2: folding the ledger keeps achievement progress and daily progress of recent entries', () => {
    let s = createNewPlayer(undefined, 0);
    for (let i = 0; i < 2600; i++) s = applyChange(s, { reason: 'plant', materials: { wood: 0 } }, 1000 + i)!;
    expect(s.ledger.length).toBeLessThan(2600);
    expect(s.ledger.length).toBeLessThanOrEqual(2500);
    expect(s.quests.folded?.plant?.n).toBeGreaterThan(0);
    expect(s.ledger.at(-1)!.id).toBeGreaterThan(2600);
    const ach = QUEST_DATA.achievements.find((q) => q.reasons.includes('plant'));
    if (ach) expect(questBoard(s, day).achievements.find((r) => r.text === ach.text)!.progress).toBe(Math.min(ach.target, s.quests.folded!.plant!.n + s.ledger.filter((e) => e.reason === 'plant').length));
  });
});

describe('save migration 33 -> 34', () => {
  it('keeps quests (folded is optional)', () => {
    const s = createNewPlayer(undefined, 0);
    const next = MIGRATIONS[33]!({ ...s, quests: { claimed: ['x'] } }) as { quests: { claimed: string[] } };
    expect(next.quests).toEqual({ claimed: ['x'] });
  });
});
