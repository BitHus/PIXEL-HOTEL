import { describe, expect, it } from 'vitest';
import { RANK_COLORS } from './config.ts';
import { PALETTE } from './palette.ts';
import { RANKS } from './ranks.ts';
import { rarityLabel, rarityStyle, withRarity } from './rarityView.ts';

describe('rarity view (OB-8)', () => {
  it('every rank has a label, a palette colour and a growing glow', () => {
    for (const r of RANKS) {
      const s = rarityStyle(r);
      expect(rarityLabel(r).length).toBeGreaterThan(0);
      expect(s.color).toBe(PALETTE[RANK_COLORS[r]]);
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    const glows = RANKS.map((r) => rarityStyle(r).glow);
    expect(glows).toEqual([...glows].sort());
    expect(rarityStyle('common').glow).toBe(0);
    expect(rarityStyle('legendary').beam).toBe(true);
    expect(rarityStyle('rare').beam).toBe(false);
  });

  it('adds the rank word only above common', () => {
    expect(withRarity('Stone', 'common')).toBe('Stone');
    expect(withRarity('Iron ore', 'rare')).toBe('Iron ore (Rare)');
  });
});
