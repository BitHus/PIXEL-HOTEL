// Emotes (step 9g-1, B2): `emotePose(kind, tMs)` gives small whole-pixel offsets for the avatar's layers and an optional bubble
// overlay. The box avatar shape is not changed: the client moves the body, the head layer and the arm boxes by these numbers.
// All motion is stepped (no sub-pixel): wave = arm up, swinging 2 px every 180 ms; cheer = jump 3 px with both arms up, 360 ms
// cycle; laugh = body shakes 1 px and head bobs 1 px every 120 ms; dance = body sways 2 px left/right and bounces 1 px,
// 300 ms per step; sleep = body drops 2 px, head down 2 px, 'zzz' bubble, slow 1200 ms breath. Rendering only.

export type EmoteKind = 'wave' | 'dance' | 'laugh' | 'cheer' | 'sleep';
export const EMOTE_KINDS: readonly EmoteKind[] = ['wave', 'dance', 'laugh', 'cheer', 'sleep'];

export type EmotePose = {
  /** Which emote this is (null = neutral): the sprite picks the wave strip for wave and cheer. */
  kind: EmoteKind | null;
  /** Offset of the whole body in art px. */
  dx: number;
  dy: number;
  /** Offset of the head layer only (on top of dy). */
  headDy: number;
  /** Raise the arms by this many px (0 = down). */
  armLift: number;
  /** Extra sideways swing of the raised arm in px (wave). */
  armSwing: number;
  /** A small symbol above the head, or null. */
  overlay: 'zzz' | 'heart' | 'note' | null;
};

export const NEUTRAL_POSE: EmotePose = { kind: null, dx: 0, dy: 0, headDy: 0, armLift: 0, armSwing: 0, overlay: null };

const phase = (t: number, period: number, steps: number): number => Math.floor((((t % period) + period) % period) / (period / steps));

export function emotePose(kind: EmoteKind, tMs: number): EmotePose {
  return { ...emoteShape(kind, tMs), kind };
}

function emoteShape(kind: EmoteKind, tMs: number): EmotePose {
  switch (kind) {
    case 'wave':
      return { ...NEUTRAL_POSE, armLift: 14, armSwing: phase(tMs, 360, 2) === 0 ? -2 : 2 };
    case 'cheer':
      return { ...NEUTRAL_POSE, dy: phase(tMs, 360, 2) === 0 ? 0 : -3, armLift: 16 };
    case 'laugh':
      return { ...NEUTRAL_POSE, dx: phase(tMs, 240, 2) === 0 ? -1 : 1, headDy: phase(tMs, 240, 2) === 0 ? 0 : -1, overlay: 'note' };
    case 'dance': {
      const s = phase(tMs, 1200, 4);
      return { ...NEUTRAL_POSE, dx: [-2, 0, 2, 0][s]!, dy: s % 2 === 0 ? 0 : -1, armLift: s % 2 === 0 ? 8 : 12, overlay: 'note' };
    }
    case 'sleep':
      return { ...NEUTRAL_POSE, dy: 2, headDy: phase(tMs, 2400, 2) === 0 ? 2 : 3, overlay: 'zzz' };
  }
}
