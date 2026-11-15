// Furniture sprites (docs/PLAN-SPRITES.md): every PNG in assets/sprites/furniture/ is bundled by Vite and loaded once at boot
// (loadSprites). spriteFor(typeId, facing) gives its texture, or null when the piece has no complete set (code art then).

import { Assets, type Texture } from 'pixi.js';
import { FURNITURE_TYPES, type Facing } from '@pixel-hotel/shared';
import { neededFacings, parseSpriteName, type SpriteFacing } from './spriteIndex.ts';

const URLS = import.meta.glob('../assets/sprites/furniture/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const store = new Map<string, Map<SpriteFacing, Texture>>();

/** Loads every sprite PNG (nearest scaling). A file that fails is skipped and logged; the game never stops. With no PNGs it resolves at once. */
export async function loadSprites(): Promise<void> {
  const types = new Map(FURNITURE_TYPES.map((t) => [t.id, t]));
  const loaded = new Map<string, Map<SpriteFacing, Texture>>();
  await Promise.all(
    Object.keys(URLS).map(async (file) => {
      const name = parseSpriteName(file);
      if (!name || !types.has(name.id)) return;
      try {
        const tex = (await Assets.load(URLS[file]!)) as Texture;
        tex.source.scaleMode = 'nearest';
        const per = loaded.get(name.id) ?? new Map<SpriteFacing, Texture>();
        per.set(name.facing, tex);
        loaded.set(name.id, per);
      } catch (e) {
        console.warn(`sprite ${file} failed to load`, e);
      }
    }),
  );
  store.clear();
  // Only a piece with every facing it needs uses sprites.
  for (const [id, per] of loaded) if (neededFacings(types.get(id)!).every((f) => per.has(f))) store.set(id, per);
}

/** The sprite of a furniture type for a facing ('left' uses 'right'; the caller mirrors), or null = draw the code art. */
export function spriteFor(typeId: string, facing: Facing): Texture | null {
  return store.get(typeId)?.get(facing === 'left' ? 'right' : facing) ?? null;
}
