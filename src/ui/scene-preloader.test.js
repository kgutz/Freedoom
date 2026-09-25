import { it, expect, vi, afterEach } from 'vitest';
import { createScenePreloader } from './scene-preloader.js';

afterEach(() => vi.useRealTimers());
function fixture() {
  vi.useFakeTimers();
  const document = new EventTarget();
  document.hidden = false; document.readyState = 'complete';
  const reduced = new EventTarget(); reduced.matches = false;
  const connection = new EventTarget();
  const window = new EventTarget();
  Object.assign(window, { Date, setTimeout, clearTimeout, AbortController,
    navigator: { connection, onLine: true }, matchMedia: () => reduced,
    URL: { createObjectURL: vi.fn(() => 'blob:cached-scene'), revokeObjectURL: vi.fn() },
    fetch: vi.fn(async () => ({ ok: true, blob: async () => new Blob(['video']) })),
  });
  let ready = true;
  const preloader = createScenePreloader({ window, document, isReady: () => ready });
  return { window, document, reduced, connection, preloader, setReady: value => ready = value };
}
it('waits for startup plus twenty seconds, then fetches market before temple', async () => {
  const f = fixture(); f.setReady(false);
  await vi.advanceTimersByTimeAsync(30000);
  expect(f.window.fetch).not.toHaveBeenCalled();
  f.setReady(true); await vi.advanceTimersByTimeAsync(20000);
  expect(f.window.fetch).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.window.fetch.mock.calls[0][0]).toBe('scenes/shops-v2.mp4');
  expect(f.window.fetch.mock.calls[0][1].priority).toBe('low');
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.window.fetch.mock.calls[1][0]).toBe('scenes/temple-v2.mp4');
  expect(f.preloader.forPlayback('scenes/shops-v2.mp4')).toBe('blob:cached-scene');
  f.preloader.dispose();
});
it.each(['hidden', 'motion', 'saveData', 'slow'])('does not preload when %s', async reason => {
  const f = fixture();
  if (reason === 'hidden') f.document.hidden = true;
  if (reason === 'motion') f.reduced.matches = true;
  if (reason === 'saveData') f.connection.saveData = true;
  if (reason === 'slow') f.connection.effectiveType = '3g';
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.window.fetch).not.toHaveBeenCalled(); f.preloader.dispose();
});
it('never downloads both at once and aborts background work on interaction', async () => {
  const f = fixture();
  f.window.fetch.mockImplementation((_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  await vi.advanceTimersByTimeAsync(30000);
  expect(f.window.fetch).toHaveBeenCalledOnce();
  const signal = f.window.fetch.mock.calls[0][1].signal;
  f.document.dispatchEvent(new Event('pointerdown'));
  expect(signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(4000);
  expect(f.window.fetch).toHaveBeenCalledOnce(); f.preloader.dispose();
});
it('foreground playback does not wait for prefetch and failures do not loop', async () => {
  const f = fixture();
  expect(f.preloader.forPlayback('scenes/shops-v2.mp4')).toBe('scenes/shops-v2.mp4');
  f.window.fetch.mockRejectedValue(new Error('offline'));
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.window.fetch).toHaveBeenCalledOnce();
  expect(f.window.fetch.mock.calls[0][0]).toBe('scenes/temple-v2.mp4');
  f.preloader.dispose();
});
