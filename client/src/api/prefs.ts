// Device settings (atmosphere step): sound on/off, volume and lighting on/off. They are about
// this device, not the game, so they are kept next to the save (through the same SaveStorage
// interface) and not inside it.

import { PREFS_KEY, SOUND_DEFAULT_VOLUME } from '@pixel-hotel/shared';
import type { SaveStorage } from './saveStorage.ts';

export interface Prefs {
  sound: boolean;
  /** 0 to 1. */
  volume: number;
  lighting: boolean;
  /** Show the faint cell grid while placing furniture and painting floors (step BG1). */
  cellGrid: boolean;
  /** Show what you got as small icons above the avatar's head (step BG3 B). */
  popups: boolean;
  /** Show the display name above each avatar (step 9g-1). */
  nameTags: boolean;
  /** True once the one-time Inn door hint toast was shown (step MB-3): it never shows again on this device. */
  doorHintSeen: boolean;
  /** Reduce effects (outdoors rework C11): no hit-stop, shake, particles, squash or other juice; damage numbers and sounds stay. */
  reduceEffects: boolean;
  /** COD-1 (a): the camera glides after the avatar in the tavern (default on). */
  followCamera: boolean;
  /** VG-1: keys of the one-time hint chips already shown (shared/src/hints.ts). */
  hintsSeen: string[];
}

export const DEFAULT_PREFS: Prefs = { sound: true, volume: SOUND_DEFAULT_VOLUME, lighting: true, cellGrid: true, popups: true, nameTags: true, doorHintSeen: false, reduceEffects: false, followCamera: true, hintsSeen: [] };

/** Reads stored settings; anything missing or wrong becomes the default. */
export function parsePrefs(text: string | null): Prefs {
  let raw: unknown = null;
  try {
    raw = text === null ? null : JSON.parse(text);
  } catch {
    raw = null;
  }
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const volume = typeof o.volume === 'number' && Number.isFinite(o.volume) ? Math.max(0, Math.min(1, o.volume)) : DEFAULT_PREFS.volume;
  return {
    sound: typeof o.sound === 'boolean' ? o.sound : DEFAULT_PREFS.sound,
    volume,
    lighting: typeof o.lighting === 'boolean' ? o.lighting : DEFAULT_PREFS.lighting,
    cellGrid: typeof o.cellGrid === 'boolean' ? o.cellGrid : DEFAULT_PREFS.cellGrid,
    popups: typeof o.popups === 'boolean' ? o.popups : DEFAULT_PREFS.popups,
    nameTags: typeof o.nameTags === 'boolean' ? o.nameTags : DEFAULT_PREFS.nameTags,
    doorHintSeen: typeof o.doorHintSeen === 'boolean' ? o.doorHintSeen : DEFAULT_PREFS.doorHintSeen,
    reduceEffects: typeof o.reduceEffects === 'boolean' ? o.reduceEffects : DEFAULT_PREFS.reduceEffects,
    followCamera: typeof o.followCamera === 'boolean' ? o.followCamera : DEFAULT_PREFS.followCamera,
    hintsSeen: Array.isArray(o.hintsSeen) ? o.hintsSeen.filter((k): k is string => typeof k === 'string').slice(0, 64) : [],
  };
}

export function loadPrefs(storage: SaveStorage): Prefs {
  return parsePrefs(storage.get(PREFS_KEY));
}

export function savePrefs(storage: SaveStorage, prefs: Prefs): void {
  storage.set(PREFS_KEY, JSON.stringify(prefs));
}
