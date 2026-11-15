// LocalGameAPI helpers: walking. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  AVATAR_START_FROM_BOTTOM,
  NAV_CELL,
  doorX,
  doorY,
  APPROACH_REACH_PX,
  behindPoint,
  findPath,
  getFurnitureType,
  planSit,
  standUpSpot,
  walkAvatar,
  type ServeResult,
  type Avatar,
  type Point,
  type SitResult,
} from '@pixel-hotel/shared';
import { finitePoint, type WalkState } from './apiShared.ts';
import type { LocalGameAPI } from './localGameAPI.ts';

export const walkApi = {
  async walk(h: LocalGameAPI, to: Point): Promise<Point[] | null> {
    if (!finitePoint(to)) return null;
    const avatar = h.standingAvatar(to);
    const path = findPath(h.grid, avatar, to);
    if (!path) return null;
    h.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: h.now(), sitOn: null, seated: null };
    return path;
  },

  async sit(h: LocalGameAPI, uid: number, tap?: Point): Promise<SitResult | null> {
    const item = h.roomItem(uid);
    if (!item || (tap !== undefined && !finitePoint(tap))) return null;
    const type = getFurnitureType(item.typeId);
    const avatar = h.standingAvatar(item);
    // Seats taken by others: the tavern's guests (other players come in step 10).
    const taken = h.state.currentRoomId === h.state.tavern.roomId ? h.state.tavern.guests.flatMap((c) => (c.seat?.uid === uid ? [c.seat.index] : [])) : [];
    const plan = planSit(h.grid, avatar, item, type, tap ?? null, taken);
    if (!plan) return null;
    const { path, seat } = plan;
    h.walkState = { avatar: { ...avatar, state: 'walk' }, path: path.slice(1), at: h.now(), sitOn: { uid, seat }, seated: null };
    return { path, seat };
  },

  async serve(h: LocalGameAPI, uid: number): Promise<ServeResult | null> {
    const counter = h.roomItem(uid);
    if (!counter) return null;
    const type = getFurnitureType(counter.typeId);
    if (!type.servedFromBehind) return null;
    const avatar = h.standingAvatar(counter);
    const spot = behindPoint(counter, type);
    const path = findPath(h.grid, avatar, spot);
    const end = path?.[path.length - 1];
    if (!path || !end || Math.hypot(end.x - spot.x, end.y - spot.y) > APPROACH_REACH_PX) return null;
    const facing = counter.facing;
    const at = { uid, x: counter.x, y: counter.y, facing };
    h.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: h.now(), sitOn: null, seated: null, serveAt: at };
    return { path, facing };
  },

  /** Where the own avatar is now (it walks by time), and sits down when it reached a seat. */
  /**
   * The avatar ready to walk. Out of bed (fix after 9e): a lying avatar is in the middle of the
   * bed, so a walk that started there went on under the bed's drawing and the avatar was gone for
   * a second. It now stands up next to the bed at once: on the free spot nearest the bed, on the
   * side it is going to (`toward`).
   */
  standingAvatar(h: LocalGameAPI, toward: Point): Avatar {
    const a = h.avatarNow();
    if (a.state !== 'lie') return a;
    const d = Math.hypot(toward.x - a.x, toward.y - a.y) || 1;
    const lean = { x: a.x + ((toward.x - a.x) / d) * NAV_CELL, y: a.y + ((toward.y - a.y) / d) * NAV_CELL };
    const spot = standUpSpot(h.grid, lean);
    const standing: Avatar = { ...a, ...spot, state: 'idle' };
    h.walkState = { ...h.walkState, avatar: standing, path: [], at: h.now(), sitOn: null, seated: null };
    return standing;
  },

  avatarNow(h: LocalGameAPI): Avatar {
    const w = h.walkState;
    const now = h.now();
    if (w.avatar.state === 'sit' || w.avatar.state === 'lie') return w.avatar;
    const r = walkAvatar(w.avatar, w.path, Math.max(0, now - w.at));
    let next: WalkState = { ...w, avatar: r.avatar, path: r.path, at: now };
    if (r.path.length === 0 && w.sitOn) {
      const { x, y, facing, pose, index } = w.sitOn.seat;
      next = { ...next, avatar: { ...r.avatar, x, y, facing, state: pose }, sitOn: null, seated: { uid: w.sitOn.uid, index } };
    }
    if (r.path.length === 0 && w.serveAt) {
      // Behind the counter: face it and take payments.
      next = { ...next, avatar: { ...next.avatar, facing: w.serveAt.facing }, serveAt: null, serving: w.serveAt };
    }
    h.walkState = next;
    return next.avatar;
  },

  /** The own avatar standing in the door zone of the current room. */
  doorWalk(h: LocalGameAPI): WalkState {
    const room = h.room();
    const p = h.state.player;
    const avatar: Avatar = {
      id: p.id,
      name: p.name,
      look: { ...h.state.look },
      roomId: room.id,
      x: doorX(room),
      y: doorY(room) - AVATAR_START_FROM_BOTTOM,
      facing: 'up',
      state: 'idle',
    };
    return { avatar, path: [], at: h.now(), sitOn: null, seated: null };
  },

  /** Where avatars stand still in the current room: the own avatar, and the tavern's guests. */
  standingPoints(h: LocalGameAPI): Point[] {
    const me = h.avatarNow();
    const out: Point[] = h.walkState.path.length === 0 ? [{ x: me.x, y: me.y }] : [];
    if (h.state.currentRoomId === h.state.tavern.roomId) {
      for (const g of h.state.tavern.guests) if (g.path.length === 0) out.push({ x: g.x, y: g.y });
    }
    return out;
  },
};
