export function showTempleGift(document, game) {
  if (!game.templeGift?.grantedAt || game.templeGift?.seenAt) return false;
  let overlay = document.getElementById('templeGiftBg');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'templeGiftBg';
    overlay.className = 'modal-bg center pioneer-reward-bg';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="modal pioneer-reward-modal" role="dialog" aria-modal="true" aria-labelledby="templeGiftTitle">
    <section class="pioneer-reward-step" data-temple-gift-intro>
      <span class="pioneer-reward-kicker">UN REGALO DE AZARIEL</span>
      <h3 id="templeGiftTitle">Tu primer paso en el Templo</h3>
      <div class="pioneer-chest-scene" aria-hidden="true"><span class="pioneer-chest-aura"></span><span class="pioneer-chest-rays"></span><span class="pioneer-chest-sparks"><i></i><i></i><i></i><i></i><i></i></span><img src="rewards/pioneer-chest.webp" alt=""></div>
      <p>Por tu primera compra de una bendición, Azariel te regala un nuevo fondo para tu héroe.</p>
      <button type="button" class="pioneer-reward-action" data-temple-gift-reveal>ABRIR REGALO</button>
    </section>
    <section class="pioneer-reward-step pioneer-reward-reveal" data-temple-gift-result hidden>
      <span class="pioneer-reward-kicker">FONDO DESBLOQUEADO</span><h3>Refugio de Azariel</h3>
      <div class="pioneer-reward-item"><div class="temple-gift-media"><img class="temple-gift-preview" src="hero_background/azariel_temple.webp" alt="Santuario dorado de Azariel con cristalera celestial"></div><strong>Un lugar al que volver</strong></div>
      <p>Ya es tuyo. Lo encontrarás entre tus fondos, en formato cuadrado y panorámico según la pantalla.</p>
      <button type="button" class="pioneer-reward-action" data-temple-gift-view>VER FONDO</button>
      <button type="button" class="temple-gift-later" data-temple-gift-close>Más tarde</button>
    </section>
  </div>`;
  overlay.classList.add('show');
  overlay.querySelector('[data-temple-gift-reveal]').onclick = () => {
    overlay.querySelector('[data-temple-gift-intro]').hidden = true;
    overlay.querySelector('[data-temple-gift-result]').hidden = false;
    overlay.querySelector('[data-temple-gift-view]').focus();
  };
  overlay.querySelector('[data-temple-gift-reveal]').focus();
  return true;
}
