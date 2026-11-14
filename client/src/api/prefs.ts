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
}

export const DEFAULT_PREFS: Prefs = { sound: true, volume: SOUND_DEFAULT_VOLUME, lighting: true };

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
  };
}

export function loadPrefs(storage: SaveStorage): Prefs {
  return parsePrefs(storage.get(PREFS_KEY));
}

export function savePrefs(storage: SaveStorage, prefs: Prefs): void {
  storage.set(PREFS_KEY, JSON.stringify(prefs));
}
