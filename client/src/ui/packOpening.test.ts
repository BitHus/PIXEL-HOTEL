import { describe, expect, it } from 'vitest';
import { getPack, type PackFind } from '@pixel-hotel/shared';
import { bestRank, packToast } from './packOpening.ts';
import { percentText } from './packsView.ts';

const piece = (id: string, name: string, rank: PackFind['rank'], isNew: boolean, copies: number): PackFind => ({ kind: 'clothing', id, name, rank, isNew, copies });

describe('pack opening texts', () => {
  const pack = getPack('common_clothes')!;

  it('a new piece says New! and offers Wear it (the rarest new piece)', () => {
    const t = packToast(pack, [piece('braids', 'Braids', 'common', true, 1), piece('kilt', 'Kilt', 'rare', true, 1)]);
    expect(t.text).toBe('New! Kilt, Braids.');
    expect(t.wear).toBe('kilt');
  });

  it('a duplicate says Spare xN (the highest count once) and has no Wear it', () => {
    const t = packToast(pack, [piece('braids', 'Braids', 'common', false, 2), piece('braids', 'Braids', 'common', false, 3)]);
    expect(t.text).toBe('Spare x3: Braids.');
    expect(t.wear).toBeNull();
  });

  it('a blocks pack just says the things are in the bag', () => {
    const finds: PackFind[] = [
      { kind: 'material', id: 'dirt', name: 'Dirt', rank: 'common', isNew: false, copies: 0 },
      { kind: 'material', id: 'clay', name: 'Clay', rank: 'common', isNew: false, copies: 0 },
    ];
    expect(packToast(getPack('random_blocks')!, finds)).toEqual({ text: 'Random Blocks Pack: 2 things are in your bag.', wear: null });
  });

  it('the burst takes the colour of the best rank', () => {
    expect(bestRank([piece('a', 'A', 'common', true, 1), piece('b', 'B', 'ultra_rare', true, 1)])).toBe('ultra_rare');
    expect(bestRank([])).toBe('common');
  });

  it('percent text drops a useless .0', () => {
    expect(percentText(80)).toBe('80%');
    expect(percentText(88.235)).toBe('88.2%');
    expect(percentText(2)).toBe('2%');
  });
});
