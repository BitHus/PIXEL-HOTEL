// Player-facing texts of the Account panel (ON-5): server error codes to plain words, and the time a save was made. Pure.

const MESSAGES: Record<string, string> = {
  network: 'Could not reach the server. Your game is safe on this device.',
  unauthorized: 'Please log in again.',
  rate_limited: 'Too many tries. Wait a little and try again.',
  too_large: 'The save is too big for the cloud.',
  newer_on_server: 'The cloud has a newer save. Tap Sync now to choose.',
  too_new: 'Please reload the game to update, then try again.',
  too_old: 'This save is too old for the cloud. Open the game once more to update it.',
  bad_login: 'Wrong name or password.',
  banned: 'This account is banned. You can keep playing offline on this device.',
  username_taken: 'That name is taken.',
  username_length: 'The name needs 3 to 16 characters.',
  username_chars: 'Use letters, digits and _, starting with a letter.',
  username_reserved: 'That name is not allowed.',
  password_short: 'The password needs at least 8 characters.',
  password_long: 'The password is too long.',
  password_common: 'Pick a less common password.',
  age_required: 'Please confirm you are 13 or older.',
  bad_state: 'This save looks damaged and was not uploaded.',
  not_a_save: 'This is not a game save.',
  invalid: 'This save could not be read by the server.',
  bad_time: 'This device clock looks wrong. Fix the date and time, then try again.',
  server_error: 'The server had a problem. Try again later.',
  bad_answer: 'The server gave an answer this game does not know. Try again later.',
  no_save: 'There is no save in the cloud yet. Tap Sync now to put this one there.',
  bad_request: 'The server did not understand that. Please reload the game.',
  bad_json: 'The server did not understand that. Please reload the game.',
  not_found: 'The server does not know that yet. Please reload the game.',
  bad_title: 'Use letters, digits and spaces, at most 24.',
  no_room: 'No room found for that code.',
  not_visitable: 'Only your hotel room can be shared.',
};

export function accountMessage(error: string): string {
  const known = MESSAGES[error];
  if (known) return known;
  // A bare status (nginx answers some limits itself, without a JSON body).
  if (error === 'http_429') return MESSAGES.rate_limited as string;
  if (/^http_5\d\d$/.test(error)) return MESSAGES.server_error as string;
  return 'Something went wrong. Try again later.';
}

/** "19 Nov 2026, 14:05" in the player's own time zone. */
export function saveTime(at: number | null): string {
  if (at === null || !Number.isFinite(at) || at <= 0) return 'never';
  const d = new Date(at);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getDate()} ${month} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}
