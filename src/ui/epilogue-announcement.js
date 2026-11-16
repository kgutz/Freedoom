export const EPILOGUE_NOTICE_ID = 'epilogue-bosses-22-25-v3';
export const EPILOGUE_VISIBLE_MS = 5000;
export function epilogueNoticePending(state) {
  return Boolean(state?.onboarded && state.game?.cls && !state.game?.updateNotices?.[EPILOGUE_NOTICE_ID]?.acknowledgedAt);
}
// Monotonic visible-time accounting, including transitions between timer ticks.
export function createVisibleCountdown(now, visible = true) {
  let last = now, elapsed = 0, active = visible;
  return { update(time, nextVisible = active) {
    if (active) elapsed += Math.max(0, time - last);
    last = time; active = nextVisible;
    return Math.max(0, EPILOGUE_VISIBLE_MS - elapsed);
  } };
}
export function installEpilogueAnnouncement({ document, getState, acknowledge, isBlocked = () => false,
  now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null, dialog = null, countdown = null, previousFocus = null;
  const blocked = () => isBlocked() || Boolean(document.querySelector('.modal-bg.show, dialog[open]'));
  const schedule = (delay = 500) => { clearTimer(timer); timer = setTimer(attempt, delay); };
  function remaining() { return countdown.update(now(), !document.hidden); }
  function finish() {
    if (!dialog || remaining() > 0) return;
    acknowledge(EPILOGUE_NOTICE_ID);
    clearTimer(timer);
    document.removeEventListener('visibilitychange', visibility);
    const closed = dialog; dialog = null;
    closed.close(); closed.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function refresh() {
    if (!dialog) return;
    const left = remaining();
    const button = dialog.querySelector('button');
    button.disabled = left > 0;
    button.textContent = left > 0 ? `Continuar en ${Math.ceil(left / 1000)} s` : 'Continuar mi aventura';
    if (left > 0) timer = setTimer(refresh, 100);
  }
  function visibility() { if (countdown) { remaining(); clearTimer(timer); refresh(); } }
  function attempt() {
    timer = null;
    if (dialog || !epilogueNoticePending(getState())) return;
    if (document.hidden || blocked()) { schedule(); return; }
    previousFocus = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.className = 'epilogue-announcement modal-bg show';
    dialog.setAttribute('aria-labelledby', 'epilogue-announcement-title');
    dialog.setAttribute('aria-describedby', 'epilogue-announcement-copy');
    dialog.innerHTML = `<div class="epilogue-announcement-content">
      <h2 id="epilogue-announcement-title">Nuevas mecánicas de<br><span>fusión de reliquias</span></h2>
      <img src="bosses/boss_22_archivista.webp" alt="El Archivista de las Excusas" width="320" height="320">
      <p id="epilogue-announcement-copy">Después de <strong>El Vacío</strong>, las nuevas reliquias solo podrán fusionarse con las <strong>seis reliquias anteriores</strong> que sean compatibles.</p>
      <button type="button" disabled>Continuar en 5 s</button></div>`;
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    dialog.querySelector('button').addEventListener('click', finish);
    document.body.append(dialog);
    dialog.showModal();
    countdown = createVisibleCountdown(now(), !document.hidden);
    document.addEventListener('visibilitychange', visibility);
    refresh();
  }
  return { queue: schedule };
}
