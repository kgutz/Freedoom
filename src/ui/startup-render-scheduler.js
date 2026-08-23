function scheduleIdle(window, callback, timeout) {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
}

export function scheduleStartupPreload({
  window,
  renderSecondary,
  renderHeavy,
  afterSecondary,
}) {
  let cancelled = false;
  let cancelSecondary = () => {};
  let cancelHeavy = () => {};

  cancelSecondary = scheduleIdle(window, () => {
    if (cancelled) return;
    renderSecondary();
    afterSecondary?.();
    cancelHeavy = scheduleIdle(window, () => {
      if (!cancelled) renderHeavy();
    }, 1_000);
  }, 250);

  return () => {
    cancelled = true;
    cancelSecondary();
    cancelHeavy();
  };
}
