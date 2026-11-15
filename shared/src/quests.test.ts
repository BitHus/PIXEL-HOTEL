import { describe, expect, it } from 'vitest';
import { GEMS } from './config.ts';
import { createNewPlayer } from './newPlayer.ts';
import { completeQuest } from './quests.ts';
import { gainsSince } from './gains.ts';

describe('quests (step BG4)', () => {
  it('finishing the showing quest pays its gems and moves on; the ledger says quest', () => {
    const s = createNewPlayer(undefined, 0);
    const next = completeQuest(s, s.hintsDone, 5, () => 0);
    expect(next.hintsDone).toBe(s.hintsDone + 1);
    expect(next.player.wallet.gems).toBe(GEMS.quest.min);
    expect(next.ledger.at(-1)).toMatchObject({ reason: 'quest', gemsDelta: GEMS.quest.min, goldDelta: 0 });
    // The gems show up in a gains list.
    expect(gainsSince(s, next)).toEqual([{ itemId: 'gems', count: GEMS.quest.min, rank: 'common' }]);
  });

  it('a quest that is not the showing one changes nothing and pays nothing', () => {
    const s = createNewPlayer(undefined, 0);
    expect(completeQuest(s, 3, 5, () => 0)).toBe(s);
    expect(completeQuest({ ...s, hintsDone: 2 }, 1, 5, () => 0).player.wallet.gems).toBe(0);
  });
});
