import { describe, expect, it, vi } from 'vitest';
import { withCloudTimeout } from './with-cloud-timeout.js';

describe('withCloudTimeout', () => {
  it('resolves with the value when the promise settles before the deadline', async () => {
    vi.useFakeTimers();
    try {
      const result = withCloudTimeout(Promise.resolve('ok'), 1000, 'test');
      await vi.advanceTimersByTimeAsync(0);
      await expect(result).resolves.toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects with a cloud-timeout error when the deadline elapses first', async () => {
    vi.useFakeTimers();
    try {
      const neverSettles = new Promise(() => {});
      const result = withCloudTimeout(neverSettles, 1000, 'loadGameSave');
      const assertion = expect(result).rejects.toMatchObject({
        code: 'cloud-timeout',
        label: 'loadGameSave',
      });
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates the original rejection when the promise rejects before the deadline', async () => {
    vi.useFakeTimers();
    try {
      const boom = new Error('network down');
      const rejectsAsync = new Promise((_resolve, reject) => {
        setTimeout(() => reject(boom), 10);
      });
      const result = withCloudTimeout(rejectsAsync, 1000, 'session');
      const assertion = expect(result).rejects.toBe(boom);
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timer once the promise settles so it does not fire later', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    try {
      await withCloudTimeout(Promise.resolve('ok'), 1000, 'test');
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      clearSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
