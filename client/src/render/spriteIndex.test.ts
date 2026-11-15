import { describe, expect, it } from 'vitest';
import { neededFacings, parseSpriteName, spriteComplete } from './spriteIndex.ts';

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
