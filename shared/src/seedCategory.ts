// The category of a seed (step SG1): what kind of thing it grows. Derived from the data, nothing is stored. The general splice
// rule (spliceRule.ts) weights its result category by the categories of the two seeds put together. Pure.

import { materialGroup } from './materials.ts';
import { seedGrows } from './seeds.ts';
import type { SeedId } from './types.ts';

export type SeedCategory = 'block' | 'crop' | 'drink' | 'ore' | 'furniture' | 'clothing' | 'style' | 'material';

/** Every category, in the fixed order the rule uses to break ties and to fall back when a pool is empty. */
export const SEED_CATEGORIES: readonly SeedCategory[] = ['block', 'crop', 'drink', 'ore', 'furniture', 'clothing', 'style', 'material'];

/** The category of a seed: block, crop, drink and ore seeds grow those goods; furniture and clothes seeds their piece; a style seed a floor or wall style; the rest is 'material'. */
export function seedCategory(seed: SeedId): SeedCategory {
  const g = seedGrows(seed);
  if (g.kind === 'furniture') return 'furniture';
  if (g.kind === 'clothing') return 'clothing';
  if ((g.kind as string) === 'style') return 'style';
  if (g.kind !== 'material') return 'material';
  const group = materialGroup(g.id);
  if (group === 'block') return 'block';
  if (group === 'crop' || group === 'food') return 'crop';
  if (group === 'drink') return 'drink';
  if (g.id.endsWith('_ore')) return 'ore';
  return 'material';
}
