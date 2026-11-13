// Materials (brief section 10): stackable loot with a baseValue. Data in shared/data/materials.json.

import materialData from '../data/materials.json';
import type { MaterialId, MaterialType } from './types.ts';

export const MATERIAL_TYPES = materialData as MaterialType[];

const BY_ID = new Map(MATERIAL_TYPES.map((m) => [m.id, m]));

export function getMaterialType(id: MaterialId): MaterialType {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`unknown material ${id}`);
  return m;
}

export function isMaterialId(id: string): id is MaterialId {
  return BY_ID.has(id as MaterialId);
}
