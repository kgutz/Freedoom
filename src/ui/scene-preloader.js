// Optional, sequential warm-up. Foreground interaction always takes priority.
export function createScenePreloader({ window, document, isReady }) {
  const sources = ['scenes/shops-v2.mp4', 'scenes/temple-v2.mp4'];
  const cached = new Map();
  const attempted = new Set();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = window.navigator?.connection;
  let readyAt = null;
  let quietUntil = 0;
  let active = null;
  let disposed = false;
  let timer;
  const now = () => window.Date.now();
  const allowed = () => !document.hidden && !reduced.matches
    && !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType)
    && window.navigator?.onLine !== false;
  const cancel = () => active?.controller.abort();
  const interrupt = () => { quietUntil = now() + 5000; cancel(); };
  const tick = async () => {
    if (disposed) return;
    timer = window.setTimeout(tick, 1000);
    if (!isReady() || document.readyState !== 'complete') { readyAt = null; cancel(); return; }
    if (readyAt === null) readyAt = now();
    if (!allowed() || now() < quietUntil) { cancel(); return; }
    if (active || now() - readyAt < 20000) return;
    const source = sources.find(item => !attempted.has(item));
    if (!source) { window.clearTimeout(timer); return; }
    const controller = new window.AbortController();
    active = { source, controller };
    try {
      const response = await window.fetch(source, { signal: controller.signal, priority: 'low', cache: 'force-cache' });
      if (!response.ok) throw new Error('Scene preload unavailable');
      const blob = await response.blob();
      if (!controller.signal.aborted && !disposed) {
        cached.set(source, window.URL.createObjectURL(blob));
        attempted.add(source);
      }
    } catch (error) {
      // Abort is retryable; other failures fall back to normal on-demand playback.
      if (!controller.signal.aborted) attempted.add(source);
    } finally { active = null; }
  };
  document.addEventListener('pointerdown', interrupt, { passive: true, capture: true });
  document.addEventListener('keydown', interrupt, true);
  document.addEventListener('visibilitychange', interrupt);
  window.addEventListener('pagehide', interrupt);
  reduced.addEventListener('change', interrupt);
  connection?.addEventListener?.('change', interrupt);
  timer = window.setTimeout(tick, 1000);
  return {
    forPlayback(source) {
      interrupt();
      // Do not redownload in the background once the user requested this scene.
      if (sources.includes(source)) attempted.add(source);
      return cached.get(source) || source;
    },
    dispose() {
      disposed = true; cancel(); window.clearTimeout(timer);
      document.removeEventListener('pointerdown', interrupt, true);
      document.removeEventListener('keydown', interrupt, true);
      document.removeEventListener('visibilitychange', interrupt);
      window.removeEventListener('pagehide', interrupt);
      reduced.removeEventListener('change', interrupt);
      connection?.removeEventListener?.('change', interrupt);
      cached.forEach(url => window.URL.revokeObjectURL(url)); cached.clear();
    },
  };
}
