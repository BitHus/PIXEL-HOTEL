// Dungeon floors (brief section 10). The crypt's layout is layout.ts (templates on a 3 x 3 grid of zones,
// corridors of at most DUNGEON_CORRIDOR_MAX blocks, loops, nooks, vault, secrets, themes, pacing); the
// mine (step 9c) keeps the old random-rectangle layout (legacyLayout.ts). Shared helpers: layoutCommon.ts.
// Same seed and floor = same floor; pure, the floor's own rng is made from the seed and the floor number.
//
// - Room 0 is the spawn room: no enemies and no chests there, so nothing starts on the player.
// - Each other room gets 0 to 2 enemies of the round's kinds, hp * (1 + 0.25 (n - 1)) rounded up. 3 to 5
//   wooden chests (1 in 8 a mimic when the round has mimics) and a 40% chance of one golden chest. The boss
//   floor (round 2, floor 3) has the Bone King in the exit room (the arena) and always a golden chest next to the exit.
// - The mine: 2 to 3 rooms, 0 to 1 slime or bat per room, no chests and no exit (the player leaves with the
//   Leave button or when the lantern runs out), and rocks in every room.

import { MINE_ENEMIES, MINE_ENEMIES_PER_ROOM_MAX, MINE_ROOMS_MAX, MINE_ROOMS_MIN, DUNGEON_ROUND } from '../config.ts';
import { generateCryptLayout } from './layout.ts';
import { generateLegacyLayout } from './legacyLayout.ts';
import type { FloorPlan } from './layoutCommon.ts';
import { blockAt } from './grid.ts';
import type { DungeonRoundId } from './run.ts';

export { NO_EXIT, blockDistances, blocksFromRect, chestSpotOk, enemyHp, floorRng, makeEnemy, rollRockKind, type FloorPlan } from './layoutCommon.ts';

export function generateFloor(seed: number, n: number, round: DungeonRoundId = DUNGEON_ROUND): FloorPlan {
  const plan = generateCryptLayout(seed, n, round);
  plan.map.chestBlocks = plan.chests.map((c) => blockAt(c));
  return plan;
}

/** A mine visit's layout (step 9c): a new one from every seed; `visit` is the visit number (1 = first). */
export function generateMine(seed: number, visit: number): FloorPlan {
  return generateLegacyLayout(seed, 1, 1, {
    roomsMin: MINE_ROOMS_MIN,
    roomsMax: MINE_ROOMS_MAX,
    enemies: MINE_ENEMIES,
    enemiesPerRoomMax: MINE_ENEMIES_PER_ROOM_MAX,
    kind: 'mine',
    mimics: false,
    boss: false,
    visit,
  });
}
