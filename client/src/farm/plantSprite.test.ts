import { describe, expect, it } from 'vitest';
import { parseSpritePath } from '../render/spriteIndex.ts';
import { plantFileName, plantSprite, plantVariant } from './plantSprite.ts';

describe('plant stage sprites (H4)', () => {
  it('maps the three growth stages to variants 1 to 3', () => {
    expect([plantVariant('sprout'), plantVariant('small'), plantVariant('full')]).toEqual(['1', '2', '3']);
  });

  it('names files so the sprite loader parses them back to the same seed and stage', () => {
    const name = plantFileName('turnip_seed', 'full');
    expect(name).toBe('turnip_seed_3.png');
    expect(parseSpritePath(`../assets/sprites/plants/${name}`)).toEqual({ kind: 'plants', id: 'turnip_seed', variant: '3' });
  });

  it('with no PNG loaded there is no sprite (the code art stays)', () => {
    expect(plantSprite('turnip_seed', 'small')).toBeNull();
  });
});
