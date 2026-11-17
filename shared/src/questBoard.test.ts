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
