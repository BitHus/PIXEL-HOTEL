import { describe, expect, it } from 'vitest';
import { blockTapAction } from './blockTap.ts';

const base = { selectedId: 'dirt', selectedIsSeed: false, hasPlant: false, placeProblem: null } as const;

describe('blockTapAction (ST2)', () => {
  it('a block selected and room on top: the tap stacks', () => expect(blockTapAction(base)).toBe('stack'));
  it('nothing selected: the tap punches', () => expect(blockTapAction({ ...base, selectedId: null })).toBe('punch'));
  it('a seed selected: the tap punches (seeds plant elsewhere)', () => expect(blockTapAction({ ...base, selectedIsSeed: true })).toBe('punch'));
  it('a plant is always punched', () => expect(blockTapAction({ ...base, hasPlant: true })).toBe('punch'));
  it('a full stack or any refusal falls back to the punch', () => {
    expect(blockTapAction({ ...base, placeProblem: 'stack_full' })).toBe('punch');
    expect(blockTapAction({ ...base, placeProblem: 'avatar' })).toBe('punch');
  });
});
