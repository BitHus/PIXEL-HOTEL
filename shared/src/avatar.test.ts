import { describe, expect, it } from 'vitest';
import { HOTEL_WALK_SPEED } from './config.ts';
import { facingFor, pathLength, walkAvatar, type Avatar } from './avatar.ts';
import { buildNavGrid, findPath } from './nav.ts';
import { createRoom } from './room.ts';
import type { Point } from './types.ts';

function avatarAt(p: Point): Avatar {
  return {
    id: 1,
    name: 'test',
    look: { skin: 30, hair: 5, hairStyle: 'short', top: 't_shirt', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 6 },
    roomId: 1,
    x: p.x,
    y: p.y,
    facing: 'down',
    state: 'idle',
  };
}

describe('facingFor', () => {
  it('uses the dominant axis', () => {
    expect(facingFor(10, 3, 'up')).toBe('right');
    expect(facingFor(-10, 3, 'up')).toBe('left');
    expect(facingFor(2, 9, 'up')).toBe('down');
    expect(facingFor(2, -9, 'down')).toBe('up');
    expect(facingFor(0, 0, 'left')).toBe('left');
  });
});

describe('walkAvatar', () => {
  const path = [{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 30, y: 140 }]; // 50 + 100 = 150 px

  it('reaches the end point after exactly path length / speed', () => {
    const ms = (pathLength(path) / HOTEL_WALK_SPEED) * 1000;
    const before = walkAvatar(avatarAt(path[0]!), path.slice(1), ms - 1);
    expect(before.avatar.state).toBe('walk');
    expect(before.path.length).toBe(1);
    const done = walkAvatar(avatarAt(path[0]!), path.slice(1), ms);
    expect(done.avatar).toMatchObject({ x: 30, y: 140, state: 'idle', facing: 'down' });
    expect(done.path).toEqual([]);
  });

  it('gives the same result in many small steps', () => {
    let walk = { avatar: avatarAt(path[0]!), path: path.slice(1) };
    const total = (pathLength(path) / HOTEL_WALK_SPEED) * 1000;
    const dt = total / 100;
    for (let i = 0; i < 99; i++) walk = walkAvatar(walk.avatar, walk.path, dt);
    expect(walk.avatar.state).toBe('walk');
    walk = walkAvatar(walk.avatar, walk.path, dt + 1e-6);
    expect(walk.avatar).toMatchObject({ x: 30, y: 140, state: 'idle' });
  });

  it('moves at the walk speed and faces the dominant axis', () => {
    const w = walkAvatar(avatarAt({ x: 0, y: 0 }), [{ x: 1000, y: 10 }], 500);
    expect(Math.hypot(w.avatar.x, w.avatar.y)).toBeCloseTo(HOTEL_WALK_SPEED / 2, 9);
    expect(w.avatar.facing).toBe('right');
  });

  it('reaches the end of a real path in path length / speed', () => {
    const room = createRoom(1, 'hotel', 1, 1);
    const grid = buildNavGrid(room, [{ x: 200, y: 0, w: 16, h: 300 }]);
    const p = findPath(grid, { x: 100, y: 100 }, { x: 500, y: 100 })!;
    const ms = (pathLength(p) / HOTEL_WALK_SPEED) * 1000;
    const w = walkAvatar(avatarAt(p[0]!), p.slice(1), ms);
    expect(w.avatar).toMatchObject({ x: 500, y: 100, state: 'idle' });
  });
});
