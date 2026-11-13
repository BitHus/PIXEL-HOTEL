// Chat text rule (brief sections 11 and 13): one line, at most CHAT_MAX_LENGTH characters.

import { CHAT_MAX_LENGTH } from './config.ts';

/** Cleans a chat message: control characters and runs of spaces become one space, trimmed, cut to the max length. Null if empty. */
export function cleanChatText(text: string): string | null {
  // eslint-disable-next-line no-control-regex
  const flat = text.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
  const cut = Array.from(flat).slice(0, CHAT_MAX_LENGTH).join('').trim();
  return cut.length > 0 ? cut : null;
}
