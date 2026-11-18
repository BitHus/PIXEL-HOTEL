import { describe, expect, it } from 'vitest';
import { createNewPlayer, skillsView } from '@pixel-hotel/shared';
import { effectText, lockText, nodeSummary, notActiveYet, respecText } from './skillsText.ts';

const view = (level: number, ranks: Record<string, number> = {}) => {
  const p = createNewPlayer(undefined, 0).player;
  return skillsView({ ...p, level, skills: { ranks, respecs: 0 } });
};
const node = (v: ReturnType<typeof view>, id: string) => v.nodes.find((n) => n.id === id)!;

describe('skills panel text', () => {
  it('shows what a rank gives and respects the cap', () => {
    const v = view(5);
    expect(effectText(node(v, 'quick_feet'), 1)).toBe('+6% walking speed in rooms');
    expect(effectText(node(v, 'quick_feet'), 3)).toBe('+18% walking speed in rooms');
    expect(effectText(node(v, 'patient'), 2)).toBe('Bite wait -16%');
    expect(nodeSummary(node(v, 'quick_feet'))).toBe('Rank 1: +6% walking speed in rooms.');
    expect(nodeSummary(node(view(5, { quick_feet: 1 }), 'quick_feet'))).toBe('Now: +6% walking speed in rooms. Next: +12% walking speed in rooms.');
  });
  it('says why a node is locked', () => {
    const v = view(2);
    expect(lockText(v, node(v, 'quick_feet'))).toBe('');
    expect(lockText(v, node(v, 'roomy_tavern'))).toBe('Needs Quick feet first.');
    const v2 = view(9, { steady_hands: 1 });
    expect(lockText(v2, node(v2, 'keen_eye'))).toBe('Spend 1 more point in Tavern (1 of 2).');
    expect(lockText(view(2, { quick_feet: 1 }), node(view(2, { quick_feet: 1 }), 'steady_hands'))).toBe('Needs 1 point; you have 0.');
  });
  it('marks nodes no rule reads yet and prints the respec cost', () => {
    expect(notActiveYet(node(view(2), 'bait_saver'))).toBe(true); // (the mining nodes work since the dig mine, MG-3)
    expect(notActiveYet(node(view(2), 'lantern'))).toBe(false);
    expect(notActiveYet(node(view(2), 'quick_feet'))).toBe(false);
    expect(respecText(view(2))).toBe('Respec: free (3 left)');
  });
});
