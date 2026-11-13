// Reading pace for texts on screen (fix after step 7b): a text stays at least TEXT_MIN_MS plus
// TEXT_MS_PER_WORD for every word, so longer messages stay longer. Pure.

import { TEXT_MIN_MS, TEXT_MS_PER_WORD } from './config.ts';

/** The words in a text (runs of non-space characters). */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/** How long a text stays on screen before it starts to fade, ms (at least `min`). */
export function readingMs(text: string, min = TEXT_MIN_MS): number {
  return Math.max(min, TEXT_MIN_MS + TEXT_MS_PER_WORD * wordCount(text));
}
