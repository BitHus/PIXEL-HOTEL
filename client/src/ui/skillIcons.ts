// Skill icons (SK-7, artist batch of 20 Nov): 99 PixelLab pictures of 32 x 32 in client/src/assets/ui/skills/<icon id>.png
// (one per node icon id in shared/data/skills.json, plus branch_<branch> emblems and hearth). Whole pixels, nearest-neighbour (the .slot-icon / .skill-emblem rules).
// A node without a picture here falls back to an existing pixel icon in skillsPanel.ts.

const URLS = import.meta.glob('../assets/ui/skills/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ART: Record<string, string> = {};
for (const [path, url] of Object.entries(URLS)) ART[path.slice(path.lastIndexOf('/') + 1, -4)] = url;

/** Icon ids whose staged art is not good enough yet: the panel uses its fallback pixel icon instead. */
const OVERRIDE_FALLBACK: ReadonlySet<string> = new Set<string>([]);

/** The picture url of a skill node icon id or a branch emblem ('branch_tavern'), or null when there is none (or it is held back). */
export function skillIconUrl(id: string): string | null {
  if (OVERRIDE_FALLBACK.has(id)) return null;
  return ART[id] ?? null;
}
