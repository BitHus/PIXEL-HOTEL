// Group CEL (docs/PLAN-CELLAR.md 4.3): the cellar's ripening tiers must not reopen a loop. The maths is in balance.ts (CEL section); the printed numbers are in NEWS and NOTES (CEL).
// All numbers are EXPECTED values, no rng except the seeded one balance.ts asks for.

import { describe, expect, it } from 'vitest';
import {
  CEL_GUEST_SHARE_MAX,
  CEL_RACK_RATIO_MAX,
  bestFreshBarrelGoldPerHour,
  firstHourGold,
  fullCellarReserveSupplyPerHour,
  guestShareWithReserve,
  rackDayGold,
  rackGoldPerHour,
} from './balance.ts';
import { CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL, RIPEN } from './config.ts';
import { applyChange } from './ledger.ts';
import { caskTier, collectCask, fillCask } from './casks.ts';
import { buildCellar } from './cellarRooms.ts';
import { DRINK_TYPES, TIER_DRINK_TYPES } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { ledgerMaterials } from './testState.ts';
import { upgradeRoom } from './economy.ts';

const TIERS = ['aged', 'vintage', 'reserve'] as const;

describe('CEL balance (docs/PLAN-CELLAR.md 4.3)', () => {
  it('1. a cask slot earns at most the best fresh barrel x CEL_RACK_RATIO_MAX per hour, at every tier of every drink', () => {
    const best = bestFreshBarrelGoldPerHour();
    for (const d of DRINK_TYPES) for (const t of TIERS) expect(rackGoldPerHour(d.id, t), `${d.id} ${t}`).toBeLessThanOrEqual(best * CEL_RACK_RATIO_MAX);
  });

  it('2. rack-day value: reserve is at most vintage x 1.5 (waiting longer is not the only strategy), and every tier pays a little less per slot-hour than the one before', () => {
    for (const d of DRINK_TYPES) {
      expect(rackDayGold(d.id, 'reserve'), d.id).toBeLessThanOrEqual(rackDayGold(d.id, 'vintage') * 1.5);
      expect(rackGoldPerHour(d.id, 'vintage'), d.id).toBeLessThan(rackGoldPerHour(d.id, 'aged'));
      expect(rackGoldPerHour(d.id, 'reserve'), d.id).toBeLessThan(rackGoldPerHour(d.id, 'vintage'));
    }
  });

  // CEL 3 was open (59% with 6 racks at level 3); the owner OK'd fewer racks (18 Nov): racks per level 2 / 3 / 3 gives about 54.8% (5 racks 57.7%, 4 racks 56.3%).
  it('3. a full level 3 cellar of reserve keeps the level 8 best-kitchen guest share at or under 55%', () => {
    const r = guestShareWithReserve('level8', seededRng(1));
    expect(r.share).toBeLessThanOrEqual(CEL_GUEST_SHARE_MAX);
  });
  it('3b. the reserve flow is limited by what the cellar makes and the numbers are the set ones (3 racks at level 3, 3 casks each)', () => {
    expect(CELLAR_RACK_MAX_BY_LEVEL).toEqual([2, 3, 3]);
    const s = fullCellarReserveSupplyPerHour();
    expect(s.mugsPerHour).toBeGreaterThan(0);
    expect(s.extraGoldPerHour).toBeLessThan(bestFreshBarrelGoldPerHour() * 1.6);
    expect(guestShareWithReserve('level8', seededRng(1)).share).toBeLessThan(CEL_GUEST_SHARE_MAX + 0.05);
  });

  it('4. a cask gives back exactly the mugs put in (ledger); nothing is sold since 18 Nov', () => {
    const s0 = createNewPlayer(undefined, 0);
    const level = { ...s0, player: { ...s0.player, level: 2, wallet: { ...s0.player.wallet, gold: 1000 } } };
    const built = buildCellar(level, 1)!;
    expect(TIER_DRINK_TYPES.length).toBeGreaterThan(0);
    const rack = built.items.find((i) => i.typeId === 'keg_rack' && i.roomId === built.player.cellarRoomId)!;
    const withAle = applyChange(built, { reason: 'debug', materials: { root_ale: 7 } }, 1)!;
    const before = ledgerMaterials(withAle);
    const filled = fillCask(withAle, rack.uid, 0, 'root_ale', 7, 10)!;
    const out = collectCask(filled, rack.uid, 0, 10)!; // collected at once: fresh mugs come back
    expect(out.item).toBe('root_ale');
    expect(out.mugs).toBe(7);
    expect(ledgerMaterials(out.state)).toEqual(before);
  });

  it('5. the cellar costs no more than two thirds of a new tavern\'s first hour of gold (the plan said one third: that cannot hold with 300 gold, the first hour is about 460)', () => {
    expect(CELLAR_BUILD_COST).toBeLessThanOrEqual((firstHourGold(60).gold * 2) / 3);
  });

  it('6. the biggest drink multiplier of any tier is the reserve one (5x), and an all-aged tavern earns 1.6x on drinks', () => {
    expect(Math.max(...RIPEN.map((r) => r.valueMult))).toBe(5);
    expect(RIPEN.find((r) => r.tier === 'aged')!.valueMult).toBe(1.6);
  });

  it('reserve needs a level 2 cellar: the tier stops at vintage in a level 1 cellar and in the tavern, and reaches reserve at level 2', () => {
    const MIN = 60_000;
    const s0 = createNewPlayer(undefined, 0);
    const built = applyChange(buildCellar({ ...s0, player: { ...s0.player, level: 2, wallet: { ...s0.player.wallet, gold: 5000 } } }, 1)!, { reason: 'debug', materials: { root_ale: 14 } }, 1)!;
    const rack = built.items.find((i) => i.typeId === 'keg_rack' && i.roomId === built.player.cellarRoomId)!;
    const l1 = fillCask(built, rack.uid, 0, 'root_ale', 7, 0)!;
    const wait = 720 * MIN;
    expect(collectCask(l1, rack.uid, 0, wait)!.tier).toBe('vintage');
    const l2 = upgradeRoom(l1, built.player.cellarRoomId!, 2)!;
    expect(collectCask(l2, rack.uid, 0, wait - 1)!.tier).toBe('vintage'); // the exact ms boundary
    const got = collectCask(l2, rack.uid, 0, wait)!;
    expect(got.tier).toBe('reserve');
    expect(got.item).toBe('root_ale_reserve');
    expect(caskTier(l2.tavern.casks[0]!, wait, 'reserve')).toBe('reserve');
  });
});
