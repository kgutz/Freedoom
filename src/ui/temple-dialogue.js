export function templeGreeting(game = {}) {
  const experience = game.blessings?.experience?.active;
  const energy = game.blessings?.energy?.active;
  if (experience && energy) return 'Me alegra verte. Las dos bendiciones siguen contigo. Adelante, estás en tu casa.';
  if (experience || energy) return `Me alegra verte. Tu protección de ${experience ? 'experiencia' : 'energía'} sigue contigo.`;
  return 'Bienvenido. Tómate un respiro. Si buscas protección para el camino, puedo ayudarte.';
}

let cancelPrevious = () => {};
export function startTempleDialogue(root, game, window) {
  cancelPrevious();
  const button = root?.querySelector('[data-temple-dialogue]');
  if (!button) return;
  const text = templeGreeting(game);
  const output = button.querySelector('[data-dialogue-text]');
  const reserve = button.querySelector('[data-dialogue-reserve]');
  const hint = button.querySelector('[data-dialogue-hint]');
  reserve.textContent = text;
  button.setAttribute('aria-label', `Azariel: ${text}`);
  let timer;
  let count = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finish = () => {
    window.clearTimeout(timer);
    output.textContent = text;
    hint.textContent = 'Azariel te espera';
  };
  const tick = () => {
    if (!button.isConnected || button.closest('[hidden], [aria-hidden="true"]')) { finish(); return; }
    output.textContent = text.slice(0, ++count);
    if (count < text.length) timer = window.setTimeout(tick, 28);
    else finish();
  };
  button.onclick = finish;
  reduced.addEventListener('change', finish);
  cancelPrevious = () => {
    window.clearTimeout(timer);
    reduced.removeEventListener('change', finish);
    button.onclick = null;
  };
  hint.textContent = 'Toca para mostrar todo';
  if (reduced.matches) finish();
  else tick();
}
