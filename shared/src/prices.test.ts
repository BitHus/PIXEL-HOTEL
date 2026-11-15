import { describe, expect, it } from 'vitest';
import { SHOP_PRICE_MAX } from './config.ts';
import { decide, validPrice } from './prices.ts';

describe('the menu price rule (section 9)', () => {
  it('reactions match section 9', () => {
    // baseValue 10, tolerance 1: limit 10.
    expect(decide(7, 10, 1)).toEqual({ buy: true, reaction: 'big_smile' });
    expect(decide(8, 10, 1)).toEqual({ buy: true, reaction: 'smile' });
    expect(decide(10, 10, 1)).toEqual({ buy: true, reaction: 'smile' });
    expect(decide(11, 10, 1)).toEqual({ buy: false, reaction: 'shrug' });
    expect(decide(11.5, 10, 1)).toEqual({ buy: false, reaction: 'shrug' });
    expect(decide(12, 10, 1)).toEqual({ buy: false, reaction: 'frown' });
    expect(decide(13, 10, 1.3)).toEqual({ buy: true, reaction: 'smile' });
  });

  it('a price is whole gold from 1 to SHOP_PRICE_MAX', () => {
    expect(validPrice(1)).toBe(true);
    expect(validPrice(SHOP_PRICE_MAX)).toBe(true);
    expect(validPrice(0)).toBe(false);
    expect(validPrice(SHOP_PRICE_MAX + 1)).toBe(false);
    expect(validPrice(2.5)).toBe(false);
  });
});
