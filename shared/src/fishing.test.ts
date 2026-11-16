import { describe, expect, it } from 'vitest';
import {
  FISH_BAR,
  FISH_BITE_MS,
  FISH_BOX_BASE,
  FISH_BOX_MAX_SPEED,
  FISH_GRAVITY,
  FISH_REEL,
  FISH_REEL_FULL,
  FISH_REEL_MAX_MS,
  FISH_REEL_START,
  FISH_SWIM_ACCEL,
  FISH_TAP_KICK,
  FISH_THRUST,
  FISH_TICK_MS,
  FISH_WAIT_MAX_MS,
  FISH_WAIT_MIN_MS,
  RANK_WEIGHTS,
} from './config.ts';
import { CATCH_TYPES, FISH_TYPES, THING_TYPES, getCatchType } from './fish.ts';
import { bankCatch, fishDone, fishInBox, newFishSession, rollCatch, step, swimStep, type FishInput, type FishSession } from './fishing.ts';
import { createNewPlayer } from './newPlayer.ts';
import { RANKS } from './ranks.ts';
import { seededRng } from './rng.ts';
import type { Rank } from './types.ts';

/** A session with a fixed catch rank, so the strength is known. */
function session(rank: Rank, seed = 1, gear: string[] = []): FishSession {
  return { ...newFishSession(seededRng(seed), gear), rank, catchId: rank === 'common' ? 'mudfin' : rank === 'rare' ? 'lantern_carp' : rank === 'ultra_rare' ? 'moonscale_eel' : 'old_king_barbel' };
}

/** A session already in the reel with everything set. */
function reel(over: Partial<FishSession> = {}, rank: Rank = 'common', gear: string[] = []): FishSession {
  return { ...session(rank, 1, gear), phase: 'reel', fill: 50, fishPos: 50, fishTarget: 50, fishTurnMs: 5000, boxPos: 50, boxVel: 0, ...over };
}

/**
 * A player: at the bite it taps to hook, in the reel it holds the box under the fish. It looks
 * at the bar every `everyMs` (its reaction time) and aims a little ahead (`lead`, seconds).
 */
function play(s: FishSession, everyMs: number, lead: number, rng = seededRng(9), maxMs = 70_000): FishSession {
  let since = 0;
  let held = false;
  let first = true;
  for (let t = 0; t < maxMs && !fishDone(s); t += FISH_TICK_MS) {
    const inputs: FishInput[] = [];
    if (first && s.phase === 'bite') {
      inputs.push({ t: 'tap' });
      first = false;
    }
    since += FISH_TICK_MS;
    if (s.phase === 'reel' && since >= everyMs) {
      since = 0;
      const want = s.boxPos + s.boxVel * lead < s.fishPos;
      if (want !== held) {
        held = want;
        inputs.push({ t: want ? 'press' : 'release' });
      }
    }
    s = step(s, inputs, FISH_TICK_MS, rng);
  }
  return s;
}

describe('the catches (shared/data/fish.json)', () => {
  it('has 12 fish over the four ranks (5, 4, 2, 1) and 6 fished-up things, each with a rank and a value', () => {
    const count = (list: { rank: Rank }[]) => RANKS.map((r) => list.filter((c) => c.rank === r).length);
    expect(count(FISH_TYPES)).toEqual([5, 4, 2, 1]);
    expect(THING_TYPES.map((t) => t.id)).toEqual(['old_boot', 'driftwood', 'shell', 'glass_bottle', 'pearl', 'sunken_crown']);
    expect(count(THING_TYPES)).toEqual([2, 2, 1, 1]);
    expect(CATCH_TYPES).toHaveLength(18);
    expect(new Set(CATCH_TYPES.map((c) => c.id)).size).toBe(18);
    for (const f of FISH_TYPES) {
      expect(f.minCm).toBeGreaterThan(0);
      expect(f.maxCm!).toBeGreaterThan(f.minCm!);
    }
  });

  it('the value goes up with the rank (every fish of a higher rank is worth more than every one below it)', () => {
    for (const list of [FISH_TYPES, THING_TYPES]) {
      for (let i = 1; i < RANKS.length; i++) {
        const lower = list.filter((c) => c.rank === RANKS[i - 1]).map((c) => c.baseValue);
        const higher = list.filter((c) => c.rank === RANKS[i]).map((c) => c.baseValue);
        if (lower.length > 0 && higher.length > 0) expect(Math.min(...higher)).toBeGreaterThan(Math.max(...lower));
      }
    }
    expect(getCatchType('sunken_crown').rank).toBe('legendary');
    expect(getCatchType('pearl').rank).toBe('ultra_rare');
  });
});

describe('the catch rolls (rank odds from RANK_WEIGHTS, a better rod shifts them)', () => {
  const rolls = (mult: Parameters<typeof rollCatch>[1], seed: number, N = 60000): Record<Rank, number> => {
    const rng = seededRng(seed);
    const n: Record<Rank, number> = { common: 0, rare: 0, ultra_rare: 0, legendary: 0 };
    for (let i = 0; i < N; i++) n[rollCatch(rng, mult).rank]++;
    for (const r of RANKS) n[r] /= N;
    return n;
  };

  it('the basic rod: 75 / 20 / 4.5 / 0.5 percent', () => {
    const n = rolls({}, 1);
    expect(n.common).toBeCloseTo(RANK_WEIGHTS.common / 100, 1);
    expect(n.rare).toBeCloseTo(0.2, 1);
    expect(n.ultra_rare).toBeCloseTo(0.045, 2);
    expect(n.legendary).toBeGreaterThan(0.002);
    expect(n.legendary).toBeLessThan(0.01);
  });

  it('a better rod shifts the odds up, the mithril rod the most', () => {
    const base = rolls({}, 2);
    const copper = rolls({ common: 0.85, rare: 1.5, ultra_rare: 1.5, legendary: 1.5 }, 2);
    const mithril = rolls({ common: 0.65, rare: 2, ultra_rare: 2.5, legendary: 3 }, 2);
    expect(copper.common).toBeLessThan(base.common);
    expect(mithril.common).toBeLessThan(copper.common);
    expect(mithril.ultra_rare + mithril.legendary).toBeGreaterThan(copper.ultra_rare + copper.legendary);
    expect(copper.ultra_rare + copper.legendary).toBeGreaterThan(base.ultra_rare + base.legendary);
  });

  it('fish and things of the rolled rank both come; fish more often (weight 3 to 1)', () => {
    const rng = seededRng(3);
    let fish = 0;
    let things = 0;
    for (let i = 0; i < 20000; i++) {
      const c = rollCatch(rng).type;
      if (c.rank === 'common') (c.kind === 'fish' ? fish++ : things++);
    }
    expect(things).toBeGreaterThan(0);
    // 5 fish of weight 3 against 2 things of weight 1.
    expect(fish / (fish + things)).toBeCloseTo(15 / 17, 1);
  });

  it('a new session: the bobber floats 2 to 8 s, the size is in the fish range, things have none', () => {
    for (let seed = 1; seed < 300; seed++) {
      const s = newFishSession(seededRng(seed));
      expect(s.phase).toBe('wait');
      expect(s.waitMs).toBeGreaterThanOrEqual(FISH_WAIT_MIN_MS);
      expect(s.waitMs).toBeLessThanOrEqual(FISH_WAIT_MAX_MS);
      const type = getCatchType(s.catchId);
      expect(type.rank).toBe(s.rank);
      if (type.kind === 'fish') {
        expect(s.cm).toBeGreaterThanOrEqual(type.minCm!);
        expect(s.cm).toBeLessThanOrEqual(type.maxCm!);
      } else expect(s.cm).toBeNull();
    }
  });
});

describe('the fishing session step(session, inputs, dtMs, rng)', () => {
  it('waits, then the bobber dips with a "!" that stays for the rank window (common 700 ms)', () => {
    let s: FishSession = { ...session('common'), waitMs: 3000 };
    const rng = seededRng(1);
    s = step(s, [], 2950, rng);
    expect(s.phase).toBe('wait');
    s = step(s, [], 50, rng);
    expect(s.phase).toBe('bite');
    expect(s.events).toEqual([{ t: 'bite' }]);
    expect(s.biteMs).toBe(FISH_BITE_MS.common);
    expect(FISH_BITE_MS.common).toBe(700);
    // Not hooked in time: the fish is gone, nothing is lost.
    s = step(s, [], 650, rng);
    expect(s.phase).toBe('bite');
    s = step(s, [], 50, rng);
    expect(s.phase).toBe('done');
    expect(s.outcome).toBe('missed');
    expect(s.events).toEqual([{ t: 'missed' }]);
  });

  it('the rarer the fish, the shorter the window', () => {
    expect(FISH_BITE_MS.legendary).toBeLessThan(FISH_BITE_MS.ultra_rare);
    expect(FISH_BITE_MS.ultra_rare).toBeLessThan(FISH_BITE_MS.rare);
    expect(FISH_BITE_MS.rare).toBeLessThan(FISH_BITE_MS.common);
    for (const r of RANKS) {
      let s: FishSession = { ...session(r), waitMs: 50 };
      s = step(s, [], 50, seededRng(1));
      expect(s.biteMs).toBe(FISH_BITE_MS[r]);
    }
  });

  it('a tap or a hold while the bobber floats does not hook; a tap in the window hooks it and starts the reel', () => {
    let s: FishSession = { ...session('rare'), waitMs: 2000 };
    const rng = seededRng(2);
    s = step(s, [{ t: 'tap' }], 0, rng);
    expect(s.phase).toBe('wait');
    expect(s.events).toEqual([]);
    s = step(s, [], 2000, rng);
    expect(s.phase).toBe('bite');
    s = step(s, [{ t: 'tap' }], 0, rng);
    expect(s.phase).toBe('reel');
    expect(s.fill).toBe(FISH_REEL_START);
    expect(s.boxPos).toBe(s.boxSize / 2);
    expect(s.boxVel).toBe(0);
    expect(s.fishPos).toBeGreaterThan(FISH_BAR / 2);
    expect(s.events).toEqual([{ t: 'hooked' }]);
    // A press hooks too, and keeps holding.
    let h: FishSession = { ...session('common'), phase: 'bite', biteMs: 500 };
    h = step(h, [{ t: 'press' }], 0, rng);
    expect(h.phase).toBe('reel');
    expect(h.held).toBe(true);
  });

  it('the catch box falls left by itself, holding pushes it right, letting go lets it fall again', () => {
    const rng = seededRng(3);
    // Falls: from the middle it ends at the left wall.
    let s = reel({ boxPos: 60, fishPos: 60, fishTarget: 60 });
    const start = s.boxPos;
    s = step(s, [], 400, rng);
    expect(s.boxPos).toBeLessThan(start);
    s = step(s, [], 4000, rng);
    expect(s.boxPos).toBe(s.boxSize / 2);
    // Holding from the left wall carries it right (net thrust is up: FISH_THRUST > FISH_GRAVITY).
    expect(FISH_THRUST).toBeGreaterThan(FISH_GRAVITY);
    let h = reel({ boxPos: 13, fishPos: 90, fishTarget: 90, fishTurnMs: 99999 });
    h = step(h, [{ t: 'press' }], 1500, rng);
    expect(h.boxPos).toBeGreaterThan(40);
    const high = h.boxPos;
    h = step(h, [{ t: 'release' }], 300, rng);
    expect(h.held).toBe(false);
    expect(h.boxPos).toBeLessThan(high + 5);
    h = step(h, [], 5000, rng);
    expect(h.boxPos).toBe(h.boxSize / 2);
    // It never leaves the bar, and never goes faster than the top speed.
    let w = reel({ boxPos: 60, fishPos: 10, fishTarget: 10, fishTurnMs: 99999 });
    w = step(w, [{ t: 'press' }], 0, rng);
    for (let i = 0; i < 100; i++) {
      w = step(w, [], FISH_TICK_MS, rng);
      expect(w.boxPos).toBeGreaterThanOrEqual(w.boxSize / 2);
      expect(w.boxPos).toBeLessThanOrEqual(FISH_BAR - w.boxSize / 2);
      expect(Math.abs(w.boxVel)).toBeLessThanOrEqual(FISH_BOX_MAX_SPEED);
    }
  });

  it('a tap gives the box one kick to the right', () => {
    let s = reel({ boxPos: 30, boxVel: 0, fishPos: 80, fishTarget: 80, fishTurnMs: 99999 });
    s = step(s, [{ t: 'tap' }], 0, seededRng(4));
    expect(s.boxVel).toBe(FISH_TAP_KICK);
    s = step(s, [{ t: 'tap' }, { t: 'tap' }, { t: 'tap' }, { t: 'tap' }], 0, seededRng(4));
    expect(s.boxVel).toBeLessThanOrEqual(FISH_BOX_MAX_SPEED);
    expect(s.boxVel).toBeGreaterThan(FISH_TAP_KICK);
  });

  it('the fish swims back and forth inside the bar, at its rank speed, and changes direction', () => {
    for (const rank of RANKS) {
      let s = reel({ fishPos: 50, fishTarget: 50, fishTurnMs: 0 }, rank);
      const rng = seededRng(5);
      const seen = new Set<number>();
      let maxStep = 0;
      let last = s.fishPos;
      for (let i = 0; i < 1200; i++) {
        s = step({ ...s, fill: 50, boxPos: s.fishPos, boxVel: 0 }, [], FISH_TICK_MS, rng);
        expect(s.fishPos).toBeGreaterThanOrEqual(0);
        expect(s.fishPos).toBeLessThanOrEqual(FISH_BAR);
        maxStep = Math.max(maxStep, Math.abs(s.fishPos - last));
        last = s.fishPos;
        seen.add(Math.round(s.fishTarget));
      }
      // It never swims faster than a dart of its rank.
      expect(maxStep).toBeLessThanOrEqual(FISH_REEL[rank].speed * 2.4 * (FISH_TICK_MS / 1000) + 1e-9);
      expect(seen.size).toBeGreaterThan(10);
    }
    // The rarer the faster.
    for (let i = 1; i < RANKS.length; i++) expect(FISH_REEL[RANKS[i]!].speed).toBeGreaterThan(FISH_REEL[RANKS[i - 1]!].speed);
  });

  it('the catch bar fills while the fish is in the box and drains while it is out; full = caught, empty = escaped', () => {
    const rng = seededRng(6);
    // In the box (the box under the fish, the fish standing still: a huge turn time).
    let inside = reel({ fill: 50, boxPos: 50, fishPos: 50, fishTarget: 50, fishTurnMs: 99999 });
    expect(fishInBox(inside)).toBe(true);
    // Holding the box exactly where the fish is would drift; keep it there by hand for 1 s.
    inside = step({ ...inside }, [], FISH_TICK_MS, rng);
    expect(inside.fill).toBeCloseTo(50 + FISH_REEL.common.gain * 0.05, 6);
    // Out of the box: it drains.
    let out = reel({ fill: 50, boxPos: 13, fishPos: 90, fishTarget: 90, fishTurnMs: 99999 });
    expect(fishInBox(out)).toBe(false);
    out = step(out, [], FISH_TICK_MS, rng);
    expect(out.fill).toBeCloseTo(50 - FISH_REEL.common.drain * 0.05, 6);
    // Full: caught.
    let c = reel({ fill: FISH_REEL_FULL - 0.5, boxPos: 50, fishPos: 50, fishTarget: 50, fishTurnMs: 99999 });
    c = step(c, [], 200, rng);
    expect(c.outcome).toBe('caught');
    expect(c.fill).toBe(FISH_REEL_FULL);
    expect(c.events.at(-1)).toMatchObject({ t: 'caught', id: 'mudfin', rank: 'common' });
    // Empty: it escapes.
    let e = reel({ fill: 0.3, boxPos: 13, fishPos: 90, fishTarget: 90, fishTurnMs: 99999 });
    e = step(e, [], 300, rng);
    expect(e.outcome).toBe('escaped');
    expect(e.fill).toBe(0);
    expect(e.events).toEqual([{ t: 'escaped' }]);
    // A reel that lasts too long is lost.
    let long = reel({ reelMs: FISH_REEL_MAX_MS - 50, boxPos: 50, fishPos: 50, fishTarget: 50, fishTurnMs: 99999, fill: 60 });
    long = step(long, [], 100, rng);
    expect(long.outcome).toBe('escaped');
  });

  it('cancel ends it at once; nothing happens after the end', () => {
    let s = session('common');
    s = step(s, [{ t: 'cancel' }], 0, seededRng(1));
    expect(s.outcome).toBe('cancelled');
    const after = step(s, [{ t: 'tap' }, { t: 'press' }], 5000, seededRng(1));
    expect(after.phase).toBe('done');
    expect(after.events).toEqual([]);
  });

  it('is deterministic and independent of how the time is cut: one big step = many small ones', () => {
    const base = reel({ fill: 60, boxPos: 40, fishPos: 55, fishTarget: 55, fishTurnMs: 0, held: true }, 'ultra_rare');
    const a = step(base, [], 1530, seededRng(7));
    let b: FishSession = base;
    const rng = seededRng(7);
    for (let i = 0; i < 153; i++) b = step(b, [], 10, rng);
    expect(b.fill).toBeCloseTo(a.fill, 9);
    expect(b.fishPos).toBeCloseTo(a.fishPos, 9);
    expect(b.boxPos).toBeCloseTo(a.boxPos, 9);
    expect(b.timeMs).toBe(a.timeMs);
    expect(b.carryMs).toBe(a.carryMs);
    expect(a.timeMs).toBe(1500);
    expect(a.carryMs).toBe(30);
    // The old session is never changed.
    expect(base.fill).toBe(60);
    expect(base.boxPos).toBe(40);
  });
});

describe('rods: a better rod makes the box bigger and let it fall slower (upgrades make the reel easier)', () => {
  it('the basic rod, the copper-reel rod and the mithril rod', () => {
    const basic = newFishSession(seededRng(1), []);
    const copper = newFishSession(seededRng(1), ['copper_reel_rod']);
    const mithril = newFishSession(seededRng(1), ['mithril_rod']);
    expect(basic.boxSize).toBe(FISH_BOX_BASE);
    expect(basic.gravityScale).toBe(1);
    expect(copper.boxSize).toBeGreaterThan(basic.boxSize);
    expect(mithril.boxSize).toBeGreaterThan(copper.boxSize);
    expect(copper.gravityScale).toBeLessThan(1);
    expect(mithril.gravityScale).toBeLessThan(copper.gravityScale);
  });

  it('a lighter fall: the same drop takes longer with a better rod', () => {
    const fallen = (gear: string[]): number => {
      let s = reel({ boxPos: 70, fishPos: 90, fishTarget: 90, fishTurnMs: 99999 }, 'common', gear);
      s = { ...s, boxSize: FISH_BOX_BASE };
      s = step(s, [], 500, seededRng(1));
      return 70 - s.boxPos;
    };
    expect(fallen(['copper_reel_rod'])).toBeLessThan(fallen([]));
    expect(fallen(['mithril_rod'])).toBeLessThan(fallen(['copper_reel_rod']));
  });
});

describe('the strength by rank: common is easy, legendary is hard (a player that reacts every 100 ms)', () => {
  /** The share of 60 hooked fish of a rank that a player lands. */
  const rate = (rank: Rank, everyMs: number, lead: number, gear: string[] = []): number => {
    let caught = 0;
    const N = 60;
    for (let seed = 1; seed <= N; seed++) {
      const s = { ...session(rank, seed, gear), phase: 'bite' as const, biteMs: FISH_BITE_MS[rank] };
      if (play(s, everyMs, lead, seededRng(seed * 7)).outcome === 'caught') caught++;
    }
    return caught / N;
  };

  it('common: even a slow player (reacting every 0.4 s) lands every one', () => {
    expect(rate('common', 400, 0)).toBe(1);
  });

  it('the harder the rank the fewer are landed with the basic rod', () => {
    const r = RANKS.map((rank) => rate(rank, 250, 0.1));
    for (let i = 1; i < r.length; i++) expect(r[i]!).toBeLessThan(r[i - 1]! + 0.001);
    expect(r[0]!).toBe(1);
    expect(r[1]!).toBeGreaterThan(0.85);
    expect(r[3]!).toBeLessThan(0.3);
    // A sharp player (reacting every 0.1 s) can land a legendary, but not every time.
    const pro = rate('legendary', 100, 0.15);
    expect(pro).toBeGreaterThan(0.2);
    expect(pro).toBeLessThan(0.75);
  });

  it('upgrades help: a better rod lands more of the hardest fish', () => {
    const basic = rate('legendary', 250, 0.1);
    const copper = rate('legendary', 250, 0.1, ['copper_reel_rod']);
    const mithril = rate('legendary', 250, 0.1, ['mithril_rod']);
    expect(copper).toBeGreaterThan(basic + 0.1);
    expect(mithril).toBeGreaterThan(copper + 0.2);
    expect(rate('ultra_rare', 400, 0, ['mithril_rod'])).toBeGreaterThan(rate('ultra_rare', 400, 0) + 0.2);
  });
});

describe('banking a catch', () => {
  it('a caught fish goes into the bag through the ledger (reason fish) and the Book, and the size is a record', () => {
    let s = createNewPlayer(undefined, 0);
    const caught = (cm: number): FishSession => ({ ...session('common'), outcome: 'caught', phase: 'done', cm });
    s = bankCatch(s, caught(12), 100, () => 0.9999)!;
    expect(s.player.materials.mudfin).toBe(1);
    expect(s.player.seen.mudfin).toEqual({ count: 1, firstSeenAt: 100 });
    expect(s.player.biggest.mudfin).toBe(12);
    expect(s.ledger[s.ledger.length - 1]).toMatchObject({ reason: 'fish' });
    s = bankCatch(s, caught(9), 200, () => 0.9999)!;
    expect(s.player.biggest.mudfin).toBe(12);
    s = bankCatch(s, caught(17), 300, () => 0.9999)!;
    expect(s.player.biggest.mudfin).toBe(17);
    expect(s.player.materials.mudfin).toBe(3);
    expect(s.player.seen.mudfin!.count).toBe(3);
  });

  it('only a catch can be banked; things have no size', () => {
    const s = createNewPlayer(undefined, 0);
    expect(bankCatch(s, { ...session('common'), outcome: 'escaped', phase: 'done' }, 5, () => 0.9999)).toBeNull();
    expect(bankCatch(s, { ...session('common'), outcome: null }, 5, () => 0.9999)).toBeNull();
    const boot: FishSession = { ...session('common'), catchId: 'old_boot', cm: null, outcome: 'caught', phase: 'done' };
    const next = bankCatch(s, boot, 5, () => 0.9999)!;
    expect(next.player.materials.old_boot).toBe(1);
    expect(next.player.biggest).toEqual({});
  });
});

describe('gems from a catch (step BG4)', () => {
  it('the rank of the catch scales the gems; a miss gives none', () => {
    const s0 = createNewPlayer(undefined, 0);
    const caught = (rank: 'common' | 'ultra_rare'): FishSession => ({ ...session(rank), outcome: 'caught', phase: 'done', cm: 10 });
    const common = bankCatch(s0, caught('common'), 1, () => 0)!;
    expect(common.player.wallet.gems).toBe(1);
    const ultra = bankCatch(s0, caught('ultra_rare'), 1, () => 0)!;
    expect(ultra.player.wallet.gems).toBe(4);
    expect(ultra.ledger[ultra.ledger.length - 1]).toMatchObject({ reason: 'fish', gemsDelta: 4 });
    expect(bankCatch(s0, caught('common'), 1, () => 0.9999)!.player.wallet.gems).toBe(0);
  });
});

describe('FISH-1 fish movement path', () => {
  const start = { fishPos: 50, fishTarget: 50, fishTurnMs: 0, fishSpeedMul: 1, fishVel: 0, fishFace: 'right' as 'left' | 'right' };

  it('stays in the bar, never exceeds its top speed and is deterministic', () => {
    for (const rank of RANKS) {
      let f = { ...start };
      let g = { ...start };
      const rng = seededRng(5);
      const rng2 = seededRng(5);
      for (let i = 0; i < 1200; i++) {
        f = swimStep(f, rank, rng, FISH_TICK_MS);
        g = swimStep(g, rank, rng2, FISH_TICK_MS);
        expect(f.fishPos).toBeGreaterThanOrEqual(0);
        expect(f.fishPos).toBeLessThanOrEqual(FISH_BAR);
        expect(Math.abs(f.fishVel)).toBeLessThanOrEqual(FISH_REEL[rank].speed * 2.4 + 1e-9);
      }
      expect(f).toEqual(g);
    }
  });

  it('accelerates smoothly: the speed never jumps, the fish turns around now and then', () => {
    for (const rank of RANKS) {
      let f = { ...start };
      const rng = seededRng(11);
      let turns = 0;
      for (let i = 0; i < 2000; i++) {
        const n = swimStep(f, rank, rng, FISH_TICK_MS);
        const maxJump = (FISH_SWIM_ACCEL[rank] * 2.4 * FISH_TICK_MS) / 1000 + 1e-9;
        expect(Math.abs(n.fishVel - f.fishVel)).toBeLessThanOrEqual(maxJump);
        if (n.fishFace !== f.fishFace) turns++;
        f = n;
      }
      expect(turns).toBeGreaterThan(2);
    }
  });

  it('faces the way it swims', () => {
    let f = { ...start, fishTarget: 90, fishTurnMs: 99999 };
    const rng = seededRng(1);
    for (let i = 0; i < 20; i++) f = swimStep(f, 'common', rng, FISH_TICK_MS);
    expect(f.fishFace).toBe('right');
    f = { ...f, fishTarget: 5, fishTurnMs: 99999 };
    for (let i = 0; i < 80; i++) f = swimStep(f, 'common', rng, FISH_TICK_MS);
    expect(f.fishFace).toBe('left');
  });

  it('rarer fish swim faster', () => {
    const avg = (rank: Rank): number => {
      let f = { ...start };
      const rng = seededRng(3);
      let sum = 0;
      for (let i = 0; i < 1500; i++) {
        f = swimStep(f, rank, rng, FISH_TICK_MS);
        sum += Math.abs(f.fishVel);
      }
      return sum / 1500;
    };
    expect(avg('legendary')).toBeGreaterThan(avg('common'));
  });

  it('nibbles 1 to 3 times just before the bite', () => {
    let s: FishSession = { ...session('common', 4), waitMs: 4000, nibblesLeft: 3 };
    const rng = seededRng(2);
    let nibbles = 0;
    for (let i = 0; i < 100 && s.phase === 'wait'; i++) {
      s = step(s, [], FISH_TICK_MS, rng);
      for (const e of s.events) if (e.t === 'nibble') nibbles++;
    }
    expect(s.phase).toBe('bite');
    expect(nibbles).toBeGreaterThanOrEqual(1);
    expect(nibbles).toBeLessThanOrEqual(3);
  });
});
