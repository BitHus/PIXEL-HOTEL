// H4 plant stage hook: a plant is drawn from sprites/plants/<seedId>_<1|2|3>.png when all three stages exist
// (1 sprout, 2 small, 3 full), else by the code art (farmArt.ts). No PNG = nothing changes.

import { Sprite, type Texture } from 'pixi.js';
import { BUILD_CELL, type PlantStage, type SeedId } from '@pixel-hotel/shared';
import { spriteTexture } from '../render/spriteStore.ts';

const STAGE_VARIANT: Record<PlantStage, string> = { sprout: '1', small: '2', full: '3' };

/** The sprite variant ('1' to '3') of a growth stage; the file is plants/<seedId>_<variant>.png. */
export function plantVariant(stage: PlantStage): string {
  return STAGE_VARIANT[stage];
}

/** The file name (without folder) of a plant stage sprite. */
export function plantFileName(seed: SeedId, stage: PlantStage): string {
  return `${seed}_${plantVariant(stage)}.png`;
}

/** A sprite for this plant stage, bottom centre on the cell's bottom edge, or null when there is no PNG set. */
export function plantSprite(seed: SeedId, stage: PlantStage): Sprite | null {
  const tex: Texture | null = spriteTexture('plants', seed, plantVariant(stage));
  if (!tex) return null;
  const s = new Sprite(tex);
  s.anchor.set(0.5, 1);
  s.position.set(BUILD_CELL / 2, BUILD_CELL);
  return s;
}
