import { describe, expect, it } from 'vitest';
import { neededFacings, parseSpriteName, parseSpritePath, plantComplete, spriteComplete } from './spriteIndex.ts';

describe('sprite names', () => {
  it('parses id and facing; plain id = down', () => {
    expect(parseSpriteName('register.png')).toEqual({ id: 'register', facing: 'down' });
    expect(parseSpriteName('../assets/sprites/furniture/tap_stand_right.png')).toEqual({ id: 'tap_stand', facing: 'right' });
    expect(parseSpriteName('prep_table_up.png')).toEqual({ id: 'prep_table', facing: 'up' });
    expect(parseSpriteName('C:\\x\\sink.png')).toEqual({ id: 'sink', facing: 'down' });
  });
  it('rejects left, other files and bad names', () => {
    expect(parseSpriteName('chair_left.png')).toBeNull();
    expect(parseSpriteName('chair.jpg')).toBeNull();
    expect(parseSpriteName('Chair.png')).toBeNull();
    expect(parseSpriteName('README.md')).toBeNull();
  });
  it('left folds into right', () => {
    expect(neededFacings({ facings: ['down', 'right', 'up', 'left'] })).toEqual(['down', 'right', 'up']);
  });
  it('a piece is complete only with every facing', () => {
    const chair = { id: 'chair', facings: ['down', 'right', 'up', 'left'] } as const;
    expect(spriteComplete(chair, ['chair.png', 'chair_right.png'])).toBe(false);
    expect(spriteComplete(chair, ['chair.png', 'chair_right.png', 'chair_up.png'])).toBe(true);
    expect(spriteComplete({ id: 'register', facings: ['down'] }, ['register.png'])).toBe(true);
    expect(spriteComplete({ id: 'register', facings: ['down'] }, ['sink.png'])).toBe(false);
    expect(spriteComplete({ id: 'register', facings: ['down'] }, [])).toBe(false);
  });
});

it('a path with Windows separators reads the same', () => {
  expect(parseSpritePath(['x', 'plants', 'glowcap_seed_3.png'].join(String.fromCharCode(92)))).toEqual({ kind: 'plants', id: 'glowcap_seed', variant: '3' });
});

describe('sprite paths by kind (PLAN-ART-UPGRADE section 0)', () => {
  it('reads the kind from the folder, the id and the variant from the file', () => {
    expect(parseSpritePath('../assets/sprites/furniture/tap_stand_right.png')).toEqual({ kind: 'furniture', id: 'tap_stand', variant: 'right' });
    expect(parseSpritePath('../assets/sprites/icons/wood.png')).toEqual({ kind: 'icons', id: 'wood', variant: '' });
    expect(parseSpritePath('../assets/sprites/blocks/mossy_stone.png')).toEqual({ kind: 'blocks', id: 'mossy_stone', variant: '' });
    expect(parseSpritePath('x/floors/wood_planks.png')).toEqual({ kind: 'floors', id: 'wood_planks', variant: '' });
    expect(parseSpritePath('x/walls/plaster.png')).toEqual({ kind: 'walls', id: 'plaster', variant: '' });
    expect(parseSpritePath('x/plants/turnip_2.png')).toEqual({ kind: 'plants', id: 'turnip', variant: '2' });
  });
  it('refuses an unknown folder, a bad name, furniture facing left, a plant stage 4 or a plant without a stage', () => {
    expect(parseSpritePath('x/music/wood.png')).toBeNull();
    expect(parseSpritePath('wood.png')).toBeNull();
    expect(parseSpritePath('x/icons/Wood.png')).toBeNull();
    expect(parseSpritePath('x/icons/wood.jpg')).toBeNull();
    expect(parseSpritePath('x/furniture/chair_left.png')).toBeNull();
    expect(parseSpritePath('x/plants/turnip_4.png')).toBeNull();
    expect(parseSpritePath('x/plants/turnip.png')).toBeNull();
  });
  it('a plant is complete only with all three stages', () => {
    expect(plantComplete(['1', '2'])).toBe(false);
    expect(plantComplete(['1', '2', '3'])).toBe(true);
    expect(plantComplete([])).toBe(false);
  });
});
