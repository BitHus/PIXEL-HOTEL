// Sprites (docs/PLAN-SPRITES.md, docs/PLAN-ART-UPGRADE.md section 0): every PNG in assets/sprites/<kind>/ is bundled by Vite and loaded once
// at boot (loadSprites). Kinds: furniture (per facing), icons, blocks, floors, walls, plants (three growth stages). The id is the key, no data
// hook: a piece without a complete set of files is drawn by the code art as before.
//   spriteFor(typeId, facing)          furniture texture ('left' asks for 'right'; the caller mirrors), or null
//   spriteTexture(kind, id, variant)   a PixiJS texture, or null
//   spriteUrl(kind, id, variant)       the bundled file's URL for an <img> (HTML slots), or null

import { Assets, type Texture } from 'pixi.js';
import { FURNITURE_TYPES, type Facing } from '@pixel-hotel/shared';
import { neededFacings, parseSpritePath, plantComplete, type SpriteKind } from './spriteIndex.ts';

const URLS = import.meta.glob('../assets/sprites/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface Loaded {
  texture: Texture;
  url: string;
}

/** `${kind}/${id}` -> variant -> the loaded file; only complete pieces are kept. */
const store = new Map<string, Map<string, Loaded>>();

const keyOf = (kind: SpriteKind, id: string): string => `${kind}/${id}`;

/** Loads every sprite PNG (nearest scaling). A file that fails is skipped and logged; the game never stops. With no PNGs it resolves at once. */
export async function loadSprites(): Promise<void> {
  const types = new Map(FURNITURE_TYPES.map((t) => [t.id, t]));
  const loaded = new Map<string, Map<string, Loaded>>();
  await Promise.all(
    Object.keys(URLS).map(async (file) => {
      const ref = parseSpritePath(file);
      if (!ref || (ref.kind === 'furniture' && !types.has(ref.id))) return;
      try {
        const url = URLS[file]!;
        const texture = (await Assets.load(url)) as Texture;
        texture.source.scaleMode = 'nearest';
        const key = keyOf(ref.kind, ref.id);
        const per = loaded.get(key) ?? new Map<string, Loaded>();
        per.set(ref.variant, { texture, url });
        loaded.set(key, per);
      } catch (e) {
        console.warn(`sprite ${file} failed to load`, e);
      }
    }),
  );
  store.clear();
  for (const [key, per] of loaded) {
    const [kind, ...rest] = key.split('/') as [SpriteKind, ...string[]];
    const id = rest.join('/');
    // Furniture needs every facing its type allows, a plant its three stages; everything else is one file.
    const ok = kind === 'furniture' ? neededFacings(types.get(id)!).every((f) => per.has(f)) : kind === 'plants' ? plantComplete(per.keys()) : per.has('');
    if (ok) store.set(key, per);
  }
}

function pick(kind: SpriteKind, id: string, variant: string): Loaded | null {
  return store.get(keyOf(kind, id))?.get(variant) ?? null;
}

/** The sprite of a furniture type for a facing ('left' uses 'right'; the caller mirrors), or null = draw the code art. */
export function spriteFor(typeId: string, facing: Facing): Texture | null {
  return pick('furniture', typeId, facing === 'left' ? 'right' : facing)?.texture ?? null;
}

/** A sprite texture of any kind (variant: '' for a single picture, '1' to '3' for a plant stage, the facing for furniture), or null. */
export function spriteTexture(kind: SpriteKind, id: string, variant = ''): Texture | null {
  return pick(kind, id, variant)?.texture ?? null;
}

/** The URL of a sprite file for an <img> (HTML slots), or null. */
export function spriteUrl(kind: SpriteKind, id: string, variant = ''): string | null {
  return pick(kind, id, variant)?.url ?? null;
}
