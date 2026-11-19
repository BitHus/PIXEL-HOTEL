import { describe, expect, it } from 'vitest';
import { createNewPlayer, skillsView } from '@pixel-hotel/shared';
import { effectText, lockText, nodeSummary, notActiveYet, respecText, unlearnText } from './skillsText.ts';

const view = (level: number, ranks: Record<string, number> = {}, extra: object = {}) => {
  const p = createNewPlayer(undefined, 0).player;
  return skillsView({ ...p, level, skills: { ranks, respecs: 0, ...extra } });
};
const node = (v: ReturnType<typeof view>, id: string) => v.nodes.find((n) => n.id === id)!;

describe('skills panel text', () => {
  it('shows what a rank gives and respects the cap; flag nodes use their own line', () => {
    const v = view(5);
    expect(effectText(node(v, 'quick_feet'), 1)).toBe('+6% walking speed in rooms');
    expect(effectText(node(v, 'quick_feet'), 3)).toBe('+18% walking speed in rooms');
    expect(effectText(node(v, 'patient'), 2)).toBe('Bite wait -16%');
    expect(effectText(node(v, 'last_stand'), 1)).toBe('Survive one lethal hit per run at 1 hp');
    expect(effectText(node(v, 'bustling_hall'), 1)).toBe('Guests come +15% more often, Guest patience -20%');
    expect(nodeSummary(node(v, 'quick_feet'))).toBe('Rank 1: +6% walking speed in rooms.');
    expect(nodeSummary(node(view(5, { quick_feet: 1 }), 'quick_feet'))).toBe('Now: +6% walking speed in rooms. Next: +12% walking speed in rooms.');
  });
  it('says why a node is locked', () => {
    const v = view(2);
    expect(lockText(v, node(v, 'quick_feet'))).toBe('');
    expect(lockText(v, node(v, 'keen_eye'))).toBe('Needs a linked skill first: Steady hands.');
    const v2 = view(9, { steady_hands: 1 });
    expect(lockText(v2, node(v2, 'keen_eye'))).toBe('Spend 2 more points on the inner rings of Tavern (1 of 3).');
    expect(lockText(view(2, { quick_feet: 1 }), node(view(2, { quick_feet: 1 }), 'steady_hands'))).toBe('Needs 1 point; you have 0.');
    expect(lockText(v, node(v, 'quick_simmer'))).toMatch(/^Coming soon/);
  });
  it('marks nodes no rule reads yet, prints the respec cost and the unlearn button', () => {
    expect(notActiveYet(node(view(2), 'bait_saver'))).toBe(true);
    expect(notActiveYet(node(view(2), 'lantern'))).toBe(false);
    expect(respecText(view(2))).toBe('Respec: free (3 left)');
    expect(respecText(view(2, { quick_feet: 1 }, { freeReset: true }))).toBe('Respec: free (new tree)');
    const v = view(5, { quick_feet: 1 });
    expect(unlearnText(node(v, 'quick_feet'))).toBe('Unlearn (10 gold)');
    expect(unlearnText(node(v, 'steady_hands'))).toBe('');
  });
});
