import { HALLOWEEN_CANDIES } from '../domain/halloween-candy-rules.js';

export function showHalloweenGift(document, onClaim, onVisitAlley = () => {}) {
  let overlay = document.getElementById('halloweenGiftBg');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'halloweenGiftBg';
    overlay.className = 'modal-bg center pioneer-reward-bg';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="modal pioneer-reward-modal halloween-gift-modal" role="dialog" aria-modal="true" aria-labelledby="halloweenGiftTitle">
    <section class="pioneer-reward-step" data-halloween-gift-intro>
      <span class="pioneer-reward-kicker">UN REGALO DE HALLOWEEN</span>
      <h3 id="halloweenGiftTitle">¡Truco o trato!</h3>
      <div class="pioneer-chest-scene"><span class="pioneer-chest-aura" aria-hidden="true"></span><img src="potions/pack_calabaza_arpillera.webp" alt="Calabaza de regalo de Halloween"></div>
      <p>Las sombras traen un regalo para tu próxima Cacería: una chuche de cada tipo.</p>
      <div class="beta-tester-reward-items halloween-gift-items">${HALLOWEEN_CANDIES.map(candy => `<div class="pioneer-reward-item"><img src="${candy.image}" alt="${candy.name}"><strong>×1</strong><small>${candy.name.replace('Chuche de ', '')}</small></div>`).join('')}</div>
      <p class="feedback-reward-once">UN REGALO POR CUENTA DURANTE EL EVENTO</p>
      <button type="button" class="pioneer-reward-action" data-halloween-gift-claim>RECLAMAR REGALO</button>
      <p data-halloween-gift-error role="status" hidden>No se pudo guardar el regalo. Puedes reintentarlo.</p>
    </section>
    <section class="pioneer-reward-step" data-halloween-gift-alley hidden>
      <span class="pioneer-reward-kicker">EL EVENTO CONTINÚA</span>
      <h3 id="halloweenAlleyTitle">Más sorpresas en el Callejón</h3>
      <div class="pioneer-chest-scene"><img src="potions/pack_calabaza_arpillera.webp" alt="Calabaza de Halloween"></div>
      <p>Tu regalo ya está en el bolso. En el Callejón te esperan chuches, atuendos, un fondo especial y la Máscara del Diezmo Carmesí.</p>
      <button type="button" class="pioneer-reward-action" data-halloween-gift-visit>IR AL CALLEJÓN</button>
      <button type="button" class="temple-gift-later" data-halloween-gift-later>Más tarde</button>
    </section>
  </div>`;
  overlay.classList.add('show');
  const button = overlay.querySelector('[data-halloween-gift-claim]');
  button.onclick = async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await onClaim();
      overlay.querySelector('[data-halloween-gift-intro]').hidden = true;
      overlay.querySelector('[data-halloween-gift-alley]').hidden = false;
      overlay.querySelector('[role="dialog"]').setAttribute('aria-labelledby', 'halloweenAlleyTitle');
      overlay.querySelector('[data-halloween-gift-visit]').focus();
    } catch {
      button.disabled = false;
      overlay.querySelector('[data-halloween-gift-error]').hidden = false;
    }
  };
  overlay.querySelector('[data-halloween-gift-visit]').onclick = () => {
    overlay.classList.remove('show');
    onVisitAlley();
  };
  overlay.querySelector('[data-halloween-gift-later]').onclick = () => overlay.classList.remove('show');
  button.focus();
}
