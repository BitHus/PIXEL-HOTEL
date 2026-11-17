// The own avatar's walking, sitting and serving (R1 split of main.ts: part 2 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { WALK_RESYNC_PX, type Point } from '@pixel-hotel/shared';
import { AvatarSprite } from '../render/avatarSprite.ts';
import { avatarDepthKey } from '../render/depthOrder.ts';
import { Seating } from '../render/seating.ts';
import type { G1 } from './ctx.ts';

export async function setupAvatarWalk(g: G1) {
  const { first, view, atmosphere, api, st } = g;

  // ---------- The own avatar (paths come from the GameAPI; the client animates them) ----------
  const me = first.avatars[0];
  if (!me) throw new Error('no avatar');
  st.avatar = me;
  /** Points the avatar still has to walk to, and where it was sent (to re-path when the room changes). */
  st.path = [];
  st.goal = null;
  const sprite = new AvatarSprite(st.avatar.look, false);
  /** The seat the avatar walks to, slides onto, and sits or lies on. */
  const seating = new Seating(sprite);
  view.objects.add(sprite.container, avatarDepthKey(st.avatar));

  /** Starts walking along a path from the API (it starts where the API thinks the avatar is). */
  const follow = (p: Point[]): void => {
    const first = p[0];
    // Only jump when the API's start point is clearly elsewhere (tiny timing differences are walked off).
    if (first && Math.hypot(first.x - st.avatar.x, first.y - st.avatar.y) > WALK_RESYNC_PX) st.avatar = { ...st.avatar, x: first.x, y: first.y };
    st.path = p.slice(1);
    seating.clear();
    st.serving = null;
    // A first step kicks up a little dust.
    if (st.path.length > 0 && st.avatar.state !== 'walk') atmosphere.puff(st.avatar);
    st.avatar = { ...st.avatar, state: st.path.length > 0 ? 'walk' : 'idle' };
  };
  /** Walks to a world point (the nearest free spot if it is blocked). False if unreachable. */
  const walkTo = async (to: Point): Promise<boolean> => {
    const p = await api.walk(to);
    if (!p) return false;
    follow(p);
    st.goal = to;
    return true;
  };
  /** Walks to the nearest reachable side of an item's free seat (nearest the tap) and sits or lies on arrival. */
  const sitOn = async (uid: number, tap: Point | null): Promise<boolean> => {
    const r = await api.sit(uid, tap ?? undefined);
    if (!r) return false;
    follow(r.path);
    st.goal = null;
    seating.goal = { uid, seat: r.seat, tap };
    return true;
  };
  /** Walking behind the counter ('walking') or standing there taking payments ('there'), with the facing. */
  st.serving = null;
  /** Walks behind the shop's counter (like sitting: tap it in play mode). False if there is no way. */
  const serveAt = async (uid: number): Promise<boolean> => {
    const r = await api.serve(uid);
    if (!r) return false;
    follow(r.path);
    st.goal = null;
    st.serving = { state: 'walking', facing: r.facing };
    return true;
  };
  const stop = (): void => {
    st.path = [];
    seating.goal = null;
    if (st.avatar.state === 'walk') st.avatar = { ...st.avatar, state: 'idle' };
    // OWN-4: the API stops where the client stopped, else its old walk goes on and the next tap snaps the avatar.
    void api.stopWalk({ x: st.avatar.x, y: st.avatar.y });
  };

  return { sprite, seating, follow, walkTo, sitOn, serveAt, stop };
}
