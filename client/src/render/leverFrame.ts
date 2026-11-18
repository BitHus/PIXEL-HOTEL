// Tap stand lever pull (pure): which frame of tap_stand_lever.png (12 x 11 frames, 4 per slot: rest, 1, 2, 3 px down) a lever shows for a pull 0..1.
export const LEVER_FRAMES = 4;
export const LEVER_FRAME_W = 12;
/** Frame index inside one slot's 4 frames for a pull amount (clamped, rounded: 0 = rest, 3 = full pull). */
export function leverLevel(pull: number): number {
  if (!(pull > 0)) return 0;
  return Math.min(LEVER_FRAMES - 1, Math.round(Math.min(1, pull) * (LEVER_FRAMES - 1)));
}
/** Index in the whole strip: slot 0 (left) uses frames 0..3, slot 1 (right) frames 4..7. */
export function leverStripIndex(slot: number, pull: number): number {
  return (slot === 1 ? LEVER_FRAMES : 0) + leverLevel(pull);
}
