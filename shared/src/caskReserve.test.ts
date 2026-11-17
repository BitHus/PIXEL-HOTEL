// CEL-5/CEL-7: the reserve tier: the proposed times per rank, the exact boundaries, the cap by cellar level, and the guests with a taste for reserve.

import { describe, expect, it } from 'vitest';
import { RIPEN_AFTER_MIN, TASTE_AGED_CHANCE, TASTE_RESERVE_CHANCE } from './config.ts';
import { caskTier, ripenMinutes, nextTierInMs, type Cask } from './casks.ts';
import { DRINK_TYPES, getDrinkType } from './materials.ts';
import type { BaseDrinkId } from './types.ts';
import { tasteOffers, type MenuOffer } from './tavern.ts';

const MIN = 60_000;
const cask = (drink: BaseDrinkId): Cask => ({ rackUid: 1, slot: 0, drink, mugs: 6, startedAt: 1000 });
const offer = (id: string): MenuOffer => ({ id: id as MenuOffer['id'], price: 10, baseValue: 10, stock: 5 });

describe('reserve times (the proposed numbers, PLAN-CELLAR 4.1)', () => {
  it('has the third number per rank', () => {
    expect(RIPEN_AFTER_MIN).toEqual({
      common: { aged: 30, vintage: 180, reserve: 720 },
      rare: { aged: 120, vintage: 480, reserve: 1440 },
      ultra_rare: { aged: 240, vintage: 960, reserve: 2880 },
      legendary: { aged: 480, vintage: 1920, reserve: 5760 },
    });
  });
  it('switches at the exact millisecond for every drink, and a rack that caps at vintage never gives reserve', () => {
    for (const d of DRINK_TYPES) {
      const m = ripenMinutes(d.id as BaseDrinkId);
      const c = cask(d.id as BaseDrinkId);
      expect(caskTier(c, 1000 + m.reserve * MIN - 1), d.id).toBe('vintage');
      expect(caskTier(c, 1000 + m.reserve * MIN), d.id).toBe('reserve');
      expect(caskTier(c, 1000 + m.reserve * MIN * 3, 'vintage'), d.id).toBe('vintage');
      expect(caskTier(c, 1000 + m.vintage * MIN), `${d.id} vintage`).toBe('vintage');
      expect(caskTier(c, 1000 + m.aged * MIN - 1), `${d.id} fresh`).toBe('fresh');
    }
  });
  it('counts down to the next tier the rack allows (also after a long offline time: the elapsed ms is all there is)', () => {
    const m = ripenMinutes('root_ale');
    expect(nextTierInMs('root_ale', 0)).toBe(m.aged * MIN);
    expect(nextTierInMs('root_ale', m.vintage * MIN)).toBe((m.reserve - m.vintage) * MIN);
    expect(nextTierInMs('root_ale', m.reserve * MIN)).toBe(0);
    expect(nextTierInMs('root_ale', m.vintage * MIN, 'vintage')).toBe(0);
  });
  it('reserve is worth 5x and tips 1.5x the plain drink', () => {
    const ale = getDrinkType('root_ale');
    expect(getDrinkType('root_ale_reserve').baseValue).toBe(ale.baseValue * 5);
    expect(getDrinkType('root_ale_reserve').tip).toBeCloseTo(ale.tip * 1.5);
  });
});

describe('guests with a taste for reserve (CEL-7)', () => {
  it('look only at reserve drinks with TASTE_RESERVE_CHANCE when a tap has one', () => {
    const offers = [offer('root_ale'), offer('root_ale_aged'), offer('root_ale_reserve')];
    expect(TASTE_RESERVE_CHANCE).toBe(0.1);
    expect(tasteOffers(offers, () => 0.05).map((o) => o.id)).toEqual(['root_ale_reserve']);
    // Not the reserve taste: the old aged/vintage taste decides (and may include the reserve one).
    expect(tasteOffers(offers, () => 0.2).map((o) => o.id)).toEqual(['root_ale_aged', 'root_ale_reserve']);
    expect(tasteOffers(offers, () => 0.9)).toEqual(offers);
    expect(TASTE_AGED_CHANCE).toBe(0.25);
  });
  it('do not touch the rng when no reserve drink is on a tap, so old seeds play as before', () => {
    let draws = 0;
    const rng = () => (draws++, 0.5);
    tasteOffers([offer('root_ale'), offer('root_ale_aged')], rng);
    expect(draws).toBe(1); // only the aged taste, as before CEL
    draws = 0;
    tasteOffers([offer('root_ale')], rng);
    expect(draws).toBe(0);
  });
});
