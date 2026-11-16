// Tavern pastimes (step 9g-2, PT-1 cheap version): a throw of darts or a roll of dice for fun. No gold, no rule effect. Pure: rng passed in.

import { rngInt, rngPick } from './rng.ts';
import type { Rng } from './types.ts';

const DART_LINES: { min: number; lines: string[] }[] = [
  { min: 50, lines: ['Bullseye! The tavern cheers.', 'Dead centre, by the saints!'] },
  { min: 30, lines: ['A fine throw, near the heart of it.', 'Well aimed, archer.'] },
  { min: 10, lines: ['It sticks in the ring. Not bad.', 'A respectable throw.'] },
  { min: 0, lines: ['The dart bounces off the wall. Ale-arm, perhaps.', 'The dart thuds into the beam beside it.'] },
];

/** One dart: a score of 0 to 50 (50 = bullseye) and a line. */
export function throwDarts(rng: Rng): { score: number; text: string } {
  const roll = rng();
  const score = roll < 0.05 ? 50 : roll < 0.3 ? rngInt(rng, 30, 40) : roll < 0.75 ? rngInt(rng, 10, 25) : rngInt(rng, 0, 5);
  const row = DART_LINES.find((r) => score >= r.min)!;
  return { score, text: `${rngPick(rng, row.lines)} (${score})` };
}

/** Two six-sided dice and a line. */
export function rollDice(rng: Rng): { dice: [number, number]; text: string } {
  const dice: [number, number] = [rngInt(rng, 1, 6), rngInt(rng, 1, 6)];
  const total = dice[0] + dice[1];
  const tail = dice[0] === dice[1] ? (dice[0] === 6 ? "Double sixes! The devil's own luck." : 'A pair! Lady Luck smiles.') : total >= 9 ? 'A strong roll.' : total <= 4 ? 'Poor luck, friend.' : 'A fair roll.';
  return { dice, text: `The dice tumble: ${dice[0]} and ${dice[1]}. ${tail}` };
}
