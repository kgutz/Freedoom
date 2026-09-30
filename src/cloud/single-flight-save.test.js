import { describe, expect, it, vi } from 'vitest';
import { createSingleFlightSave } from './single-flight-save.js';

describe('single-flight cloud saves', () => {
  it('runs one save at a time and coalesces queued changes to the latest', async () => {
    const enqueue = createSingleFlightSave();
    let release;
    const first = vi.fn(() => new Promise(resolve => { release = resolve; }));
    const superseded = vi.fn();
    const latest = vi.fn();
    const done = enqueue(first);
    await Promise.resolve();
    enqueue(superseded);
    enqueue(latest);
    expect(latest).not.toHaveBeenCalled();
    release();
    await done;
    expect(first).toHaveBeenCalledTimes(1);
    expect(superseded).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });
  it('does not retry a failed save or send a queued stale save', async () => {
    const enqueue = createSingleFlightSave();
    let reject;
    const first = vi.fn(() => new Promise((_, fail) => { reject = fail; }));
    const stale = vi.fn();
    const done = enqueue(first);
    await Promise.resolve();
    enqueue(stale);
    reject(new Error('save conflict'));
    await expect(done).rejects.toThrow('save conflict');
    expect(first).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
    const next = vi.fn();
    await enqueue(next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
