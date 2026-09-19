const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&#39;');

export function effectControl({ id, name, description }, kind = 'EFECTO PRINCIPAL') {
  return `<button type="button" class="relic-effect-link" aria-haspopup="dialog" aria-controls="relicEffectInfoDialog" data-effect-name="${escapeHtml(name)}" data-effect-description="${escapeHtml(description)}" data-effect-kind="${kind}" data-relic-effect="${escapeHtml(id)}">${escapeHtml(name)}</button>`;
}

export function effectControlList(effects, kind = 'EFECTO PRINCIPAL') {
  return `<div class="relic-effect-controls">${effects.map((effect, index) => `<span class="relic-effect-item">${index > 0 && index === effects.length - 1 ? '<span class="relic-effect-conjunction">y </span>' : ''}${effectControl(effect, kind)}${index < effects.length - 2 ? '<span class="relic-effect-comma">,</span>' : ''}</span>`).join(' ')}</div>`;
}

// Native dialog provides top-layer isolation, inert background and keyboard focus containment.
export function installRelicEffectDialog(document) {
  const existing = document.getElementById('relicEffectInfoDialog');
  if (existing) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'relicEffectInfoDialog';
  dialog.className = 'relic-effect-dialog';
  dialog.setAttribute('aria-labelledby', 'relicEffectInfoTitle');
  dialog.setAttribute('aria-describedby', 'relicEffectInfoDescription');
  dialog.innerHTML = '<span class="relic-effect-info-kicker" id="relicEffectInfoKind"></span><h3 id="relicEffectInfoTitle"></h3><p id="relicEffectInfoDescription"></p><button type="button" id="relicEffectInfoClose" aria-label="Cerrar detalle del efecto">Entendido</button>';
  document.body.append(dialog);
  const close = dialog.querySelector('button');
  let trigger = null;
  let overflow = '';
  let parentScroller = null;
  let parentOverflow = '';
  function finish() {
    document.body.style.overflow = overflow;
    if (parentScroller) parentScroller.style.overflow = parentOverflow;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
    parentScroller = null;
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', finish);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      // This explanatory dialog has one interactive control in either direction.
      event.preventDefault();
      event.stopPropagation();
      close.focus({ preventScroll: true });
    }
    // Do not let a parent's Escape listener close the underlying sheet.
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    }
  });
  let outsidePointer = false;
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  dialog.addEventListener('pointerdown', event => { outsidePointer = outside(event); });
  dialog.addEventListener('click', event => {
    if (outsidePointer && outside(event)) dialog.close();
    outsidePointer = false;
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-effect-description]');
    if (!button || dialog.open) return;
    event.preventDefault();
    event.stopPropagation();
    trigger = button;
    dialog.querySelector('#relicEffectInfoTitle').textContent = button.dataset.effectName;
    dialog.querySelector('#relicEffectInfoDescription').textContent = button.dataset.effectDescription;
    dialog.querySelector('#relicEffectInfoKind').textContent = button.dataset.effectKind;
    overflow = document.body.style.overflow;
    parentScroller = button.closest('.sheet, #forgeBody');
    parentOverflow = parentScroller?.style.overflow || '';
    document.body.style.overflow = 'hidden';
    if (parentScroller) parentScroller.style.overflow = 'hidden';
    dialog.showModal();
    close.focus({ preventScroll: true });
  }, true);
}
