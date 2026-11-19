import { describe, expect, it } from 'vitest';
import { CLOUD_AUTOSYNC_MS, CLOUD_AUTOSYNC_RETRY_MS, createCloudAutoSync } from './cloudAutoSync.ts';
import type { PushResult } from './cloudSave.ts';

/** Fake timers: run() fires every timer due by `at`. */
function clock() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimer: (fn: () => void, ms: number) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer: (h: unknown) => void timers.delete(h as number),
    pending: () => [...timers.values()].map((t) => t.at - now),
    async advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      }
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

function fakeCloud(answers: PushResult[], user: string | null = 'Tester') {
  const pushed: (string | null)[] = [];
  return {
    pushed,
    cloud: {
      username: () => user,
      pushIfAhead: async (t: string | null): Promise<PushResult> => {
        pushed.push(t);
        return answers.shift() ?? { ok: true, action: 'unchanged' };
      },
    },
  };
}

describe('cloud auto sync', () => {
  it('pushes once per CLOUD_AUTOSYNC_MS while the game keeps saving (a throttle, not a debounce)', async () => {
    const c = clock();
    const f = fakeCloud([]);
    const a = createCloudAutoSync({ cloud: f.cloud, localText: () => 'SAVE', ...c });
    for (let i = 0; i < 120; i++) {
      a.changed();
      await c.advance(100);
    }
    expect(f.pushed).toHaveLength(Math.floor((120 * 100) / CLOUD_AUTOSYNC_MS));
    a.changed();
    await c.advance(CLOUD_AUTOSYNC_MS);
    expect(f.pushed.length).toBeGreaterThanOrEqual(1);
    expect(f.pushed.every((t) => t === 'SAVE')).toBe(true);
  });
  it('does nothing while signed out', async () => {
    const c = clock();
    const f = fakeCloud([], null);
    const a = createCloudAutoSync({ cloud: f.cloud, localText: () => 'SAVE', ...c });
    a.changed();
    await a.flush();
    await c.advance(CLOUD_AUTOSYNC_MS * 2);
    expect(f.pushed).toEqual([]);
    expect(c.pending()).toEqual([]);
  });
  it('flush pushes at once and cancels the pending timer', async () => {
    const c = clock();
    const f = fakeCloud([]);
    const a = createCloudAutoSync({ cloud: f.cloud, localText: () => 'SAVE', ...c });
    a.changed();
    await a.flush();
    expect(f.pushed).toHaveLength(1);
    expect(c.pending()).toEqual([]);
  });
  it('says "behind" once until an upload works again; never downloads', async () => {
    const c = clock();
    let told = 0;
    const f = fakeCloud([{ ok: true, action: 'behind' }, { ok: true, action: 'behind' }, { ok: true, action: 'uploaded' }, { ok: true, action: 'behind' }]);
    const a = createCloudAutoSync({ cloud: f.cloud, localText: () => 'SAVE', ...c, onBehind: () => told++ });
    await a.flush();
    await a.flush();
    expect(told).toBe(1);
    await a.flush();
    await a.flush();
    expect(told).toBe(2);
  });
  it('retries later after a network failure or a rate limit, not after a refusal', async () => {
    const c = clock();
    const f = fakeCloud([{ ok: false, error: 'network' }, { ok: false, error: 'too_large' }]);
    const a = createCloudAutoSync({ cloud: f.cloud, localText: () => 'SAVE', ...c });
    await a.flush();
    expect(c.pending()).toEqual([CLOUD_AUTOSYNC_RETRY_MS]);
    await c.advance(CLOUD_AUTOSYNC_RETRY_MS);
    expect(f.pushed).toHaveLength(2);
    expect(c.pending()).toEqual([]);
  });
});
