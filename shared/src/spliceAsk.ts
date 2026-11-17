// SG5: what the splice preview dialog shows and when it asks. Pure; the client only draws it. No spoilers: a new mix shows "?" for the
// result and its category; only the rank and the grow time are shown (the discovery is the fun).

import { seedRank } from './seeds.ts';
import type { SplicePreview } from './splice.ts';
import type { Rank } from './types.ts';

/**
 * True when the dialog must ask before splicing: a new mix, or any rare+ ingredient or result. A known mix of common seeds splices with one
 * tap. Everything that is not a possible splice (no plant, ripe, already spliced, nothing happens) never asks: the normal path answers.
 */
export function spliceNeedsAsk(p: SplicePreview): boolean {
  if (p.status === 'new') return true;
  if (p.status !== 'known' || !p.uses) return false;
  return p.uses.some((s) => seedRank(s) !== 'common') || (p.rank !== undefined && p.rank !== 'common');
}

export interface SpliceDialogText {
  /** The result's name slot: the seed id when known, else null (the dialog draws "?"). */
  resultId: string | null;
  rank: Rank | null;
  /** "about 22 min" / "about 3 h", or '' when unknown. */
  growText: string;
}

export function spliceGrowText(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 90) return `about ${min} min`;
  const h = Math.round(ms / 3_600_000);
  return h < 48 ? `about ${h} h` : `about ${Math.round(h / 24)} days`;
}

export function spliceDialogText(p: SplicePreview): SpliceDialogText {
  return {
    resultId: p.status === 'known' && p.result ? p.result : null,
    rank: p.rank ?? null,
    growText: p.growMs !== undefined ? spliceGrowText(p.growMs) : '',
  };
}
