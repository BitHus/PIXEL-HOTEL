// Usable furniture (step 9g-2): what a tap on a placed piece does. Pure: the clock and the rng are passed in.
// 'toggle' and 'fire' flip FurnitureItem.on (saved, save 28); 'music' returns the tune to play (shared/data/tunes.json, played by the client);
// 'clock' tells the time of day; 'mirror' asks the client to open the Avatar panel; 'pet' adopts the cat; 'darts' and 'dice' are pastimes (pastimes.ts).

import tunesData from '../data/tunes.json';
import { PET_DEFAULT_NAMES, PET_NAME_MAX } from './config.ts';
import { getFurnitureType } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { rollDice, throwDarts } from './pastimes.ts';
import { rngPick } from './rng.ts';
import type { FurnitureItem, FurnitureType, Rng } from './types.ts';

/** One note: [frequency Hz, length ms]. */
export type TuneNote = readonly [number, number];
export const TUNES = tunesData as unknown as Record<string, readonly TuneNote[]>;

export type UseResult =
  | { kind: 'toggle'; on: boolean; text: string }
  | { kind: 'fire'; on: boolean; text: string }
  | { kind: 'music'; tune: string; notes: readonly TuneNote[]; text: string }
  | { kind: 'clock'; text: string }
  | { kind: 'mirror'; text: string }
  | { kind: 'pet'; adopted: boolean; name: string; text: string }
  | { kind: 'darts'; score: number; text: string }
  | { kind: 'dice'; dice: [number, number]; text: string };

/** A usable piece is on unless it was switched off. */
export function isOn(item: Pick<FurnitureItem, 'on'>): boolean {
  return item.on !== false;
}

/** The type has an on/off state. */
export function hasOnOff(type: Pick<FurnitureType, 'use'>): boolean {
  return type.use === 'toggle' || type.use === 'fire';
}

/** Does a tap on this type do something? */
export function isUsable(type: Pick<FurnitureType, 'use'>): boolean {
  return type.use !== undefined && type.use !== 'none';
}

const HOUR_WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];

/** The wall clock's words for a minute of the day (0 to 1439): "Half past three in the afternoon". Real time is passed in. */
export function clockText(minuteOfDay: number): string {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 12 && min < 8) return 'High noon';
  if (h === 0 && min < 8) return 'Midnight, the witching hour';
  // From the "to" side the hour has moved on: pick the part of the day from the hour we speak of.
  const spoken = min >= 38 ? (h + 1) % 24 : h;
  const part = spoken < 5 ? 'in the dead of night' : spoken < 12 ? 'in the morning' : spoken < 17 ? 'in the afternoon' : spoken < 21 ? 'in the evening' : 'at night';
  const word = (hh: number): string => HOUR_WORDS[hh % 12]!;
  let when: string;
  if (min < 8) when = `${word(h)} o'clock`;
  else if (min < 23) when = `A quarter past ${word(h)}`;
  else if (min < 38) when = `Half past ${word(h)}`;
  else if (min < 53) when = `A quarter to ${word(spoken)}`;
  else when = `Nearly ${word(spoken)} o'clock`;
  const text = `${when} ${part}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The cat's start name for a rng. */
export function petStartName(rng: Rng): string {
  return rngPick(rng, PET_DEFAULT_NAMES);
}

/** A cat name: letters, digits and spaces, trimmed, at most PET_NAME_MAX; null if empty or not allowed. */
export function cleanPetName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || name.length > PET_NAME_MAX || !/^[A-Za-z0-9 ]+$/.test(name)) return null;
  return name;
}

/**
 * Uses a placed piece. Null = refused (no such item, not placed in a room, nothing to use). `minuteOfDay` is the local time of day (the
 * client passes it), `rng` is for pastimes and the cat's name. Returns the new state and what happened.
 */
export function useItem(state: GameState, uid: number, minuteOfDay: number, rng: Rng): { state: GameState; result: UseResult } | null {
  const item = state.items.find((i) => i.uid === uid);
  if (!item || item.roomId === null) return null;
  const type = getFurnitureType(item.typeId);
  switch (type.use) {
    case 'toggle':
    case 'fire': {
      const on = !isOn(item);
      const text =
        type.use === 'fire'
          ? on ? 'The fire crackles back to life.' : 'You bank the fire down to embers.'
          : on ? `You light the ${type.name.toLowerCase()}.` : `You snuff the ${type.name.toLowerCase()}.`;
      return { state: { ...state, items: state.items.map((i) => (i.uid === uid ? { ...i, on } : i)) }, result: { kind: type.use, on, text } };
    }
    case 'music': {
      const tune = type.tune ?? 'hearth_waltz';
      const notes = TUNES[tune];
      if (!notes) return null;
      return { state, result: { kind: 'music', tune, notes, text: `The ${type.name.toLowerCase()} plays a merry tune.` } };
    }
    case 'clock':
      return { state, result: { kind: 'clock', text: clockText(minuteOfDay) } };
    case 'mirror':
      return { state, result: { kind: 'mirror', text: 'You smooth your tunic in the glass.' } };
    case 'pet': {
      if (state.player.pet) return { state, result: { kind: 'pet', adopted: false, name: state.player.pet.name, text: `${state.player.pet.name} is curled up here.` } };
      const name = petStartName(rng);
      return { state: { ...state, player: { ...state.player, pet: { name } } }, result: { kind: 'pet', adopted: true, name, text: `A stray cat pads in and adopts you. You call her ${name}.` } };
    }
    case 'darts': {
      const r = throwDarts(rng);
      return { state, result: { kind: 'darts', score: r.score, text: r.text } };
    }
    case 'dice': {
      const r = rollDice(rng);
      return { state, result: { kind: 'dice', dice: r.dice, text: r.text } };
    }
    default:
      return null;
  }
}

/** Renames the cat. Null = no cat yet or a bad name. */
export function renamePet(state: GameState, raw: string): GameState | null {
  const name = cleanPetName(raw);
  if (!state.player.pet || !name) return null;
  return { ...state, player: { ...state.player, pet: { name } } };
}
