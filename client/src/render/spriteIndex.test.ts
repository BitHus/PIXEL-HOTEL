import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '@pixel-hotel/shared';
import { neededFacings, parseSpriteName, parseSpritePath, plantComplete, spriteComplete, stripFrameCount, stripFrameX, stripId } from './spriteIndex.ts';

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

describe('block sprites (step H2)', () => {
  it('a file blocks/<id>.png is looked up by the block id: every block id is a valid file name, and the first five staged drafts are real blocks', () => {
    for (const b of BLOCK_TYPES) expect(parseSpritePath(`x/blocks/${b.id}.png`), b.id).toEqual({ kind: 'blocks', id: b.id, variant: '' });
    for (const id of ['dirt', 'planks', 'stone', 'glass', 'clay']) expect(BLOCK_TYPES.some((b) => b.id === id), id).toBe(true);
  });
});

describe('floor and wall sprites (step H3)', () => {
  it('floors/<id>.png and walls/<id>.png are looked up by the style id', () => {
    for (const kind of ['floors', 'walls'] as const) {
      expect(parseSpritePath(`../assets/sprites/${kind}/wood_planks.png`)).toEqual({ kind, id: 'wood_planks', variant: '' });
      expect(parseSpritePath(`x/${kind}/wood_planks_2.png`)?.variant).toBe('');
    }
  });
});

describe('outdoors kinds and animation strips (C11)', () => {
  it('dungeon, actors and lake files are <id>.png; a strip is just <id>_<tag>.png', () => {
    expect(parseSpritePath('../assets/sprites/dungeon/crypt_floor_a.png')).toEqual({ kind: 'dungeon', id: 'crypt_floor_a', variant: '' });
    expect(parseSpritePath('../assets/sprites/actors/slime_idle.png')).toEqual({ kind: 'actors', id: 'slime_idle', variant: '' });
    expect(parseSpritePath('x/lake/water.png')).toEqual({ kind: 'lake', id: 'water', variant: '' });
    expect(parseSpritePath('x/lake/Water.png')).toBeNull();
    expect(stripId('slime', 'idle')).toBe('slime_idle');
    expect(parseSpritePath(`x/actors/${stripId('bone_king', 'move')}.png`)?.id).toBe('bone_king_move');
  });
  it('the frame count is width / frame width; a width that is not whole frames, or a bad frame width, is 0 (= treated as missing)', () => {
    expect(stripFrameCount(64, 32)).toBe(2);
    expect(stripFrameCount(128, 32)).toBe(4);
    expect(stripFrameCount(48, 16)).toBe(3);
    expect(stripFrameCount(32, 32)).toBe(1);
    expect(stripFrameCount(70, 32)).toBe(0);
    expect(stripFrameCount(64, 0)).toBe(0);
    expect(stripFrameCount(0, 32)).toBe(0);
    expect(stripFrameCount(64, 24.5)).toBe(0);
  });
  it('frame i starts at i * frame width', () => {
    expect([0, 1, 2].map((i) => stripFrameX(i, 32))).toEqual([0, 32, 64]);
  });
});
