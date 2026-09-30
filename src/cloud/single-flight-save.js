// Coalesce changes arriving during a save, without overlapping requests or retrying failures.
export function createSingleFlightSave() {
  let running = null;
  let pending = null;
  return function enqueue(task) {
    pending = task;
    if (running) return running;
    running = Promise.resolve().then(async () => {
      try {
        while (pending) {
          const next = pending;
          pending = null;
          await next();
        }
      } finally {
        pending = null;
        running = null;
      }
    });
    return running;
  };
}
