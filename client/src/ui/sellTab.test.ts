// Step S2: the words of the Sell tab's question and its help texts (the rows themselves are drawn with the DOM and covered by hand).
import { describe, expect, it } from 'vitest';
import { SELL_CONFIRM_QTY } from '@pixel-hotel/shared';
import { SELL_EMPTY_HELP, SELL_INTRO, sellDetail } from './sellTab.ts';

describe('sell question text', () => {
  it('says every reason it asks and that it cannot be undone', () => {
    const t = sellDetail({ rank: 'legendary', inHotbar: true, unit: 20 }, SELL_CONFIRM_QTY + 1);
    expect(t).toContain('very rare');
    expect(t).toContain('hotbar');
    expect(t).toContain(`${SELL_CONFIRM_QTY + 1} pieces`);
    expect(t).toContain('20 gold each');
    expect(t).toContain('cannot be undone');
  });
  it('a plain big sale only mentions the count', () => {
    const t = sellDetail({ rank: 'common', inHotbar: false, unit: 3 }, 9);
    expect(t).toContain('9 pieces');
    expect(t).not.toContain('hotbar');
    expect(t).not.toContain('very rare');
  });
  it('the help texts say nothing sells by itself', () => {
    expect(SELL_INTRO).toContain('Nothing sells by itself');
    expect(SELL_EMPTY_HELP.length).toBeGreaterThan(10);
  });
});
