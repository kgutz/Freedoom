// Peek dialog: visible only while the trigger is held, closed by the caller on pointer release.
// Native dialog still provides top-layer isolation and an inert background while shown.
export function installSkillInfoDialog(document) {
  const existing = document.getElementById('skillInfoDialog');
  if (existing) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'skillInfoDialog';
  dialog.className = 'relic-effect-dialog skill-info-dialog';
  dialog.setAttribute('aria-labelledby', 'skillInfoTitle');
  dialog.setAttribute('aria-describedby', 'skillInfoDescription');
  dialog.innerHTML = `<div class="skill-info-row">
    <div class="skill-info-icon" id="skillInfoIconWrap">
      <img id="skillInfoIcon" src="" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="sk-fallback" id="skillInfoIconFallback" style="display:none"></span>
    </div>
    <div class="skill-info-text">
      <h3 id="skillInfoTitle"></h3>
      <p id="skillInfoDescription"></p>
    </div>
  </div>
  <div class="skill-info-chips">
    <span class="skill-info-chip"><b id="skillInfoMana"></b>&nbsp;💧</span>
    <span class="skill-info-chip">Nv&nbsp;<b id="skillInfoLevel"></b></span>
  </div>`;
  document.body.append(dialog);
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
  dialog.addEventListener('close', finish);
  dialog.addEventListener('cancel', event => {
    // Esc still works as a keyboard-only fallback; the normal path is releasing the pointer.
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  });
  dialog.openForTrigger = (triggerEl, data) => {
    if (dialog.open) return;
    trigger = triggerEl || null;
    dialog.querySelector('#skillInfoTitle').textContent = data.name;
    dialog.querySelector('#skillInfoDescription').textContent = data.description;
    dialog.querySelector('#skillInfoMana').textContent = data.mana;
    dialog.querySelector('#skillInfoLevel').textContent = data.level;
    const icon = dialog.querySelector('#skillInfoIcon');
    const fallback = dialog.querySelector('#skillInfoIconFallback');
    icon.style.display = '';
    fallback.style.display = 'none';
    icon.src = data.iconSrc || '';
    fallback.textContent = data.iconFallback || '';
    overflow = document.body.style.overflow;
    parentScroller = triggerEl?.closest?.('.sheet, #forgeBody') || null;
    parentOverflow = parentScroller?.style.overflow || '';
    document.body.style.overflow = 'hidden';
    if (parentScroller) parentScroller.style.overflow = 'hidden';
    dialog.showModal();
  };
}

export function showSkillInfoDialog(document, { name, description, mana, level, iconSrc, iconFallback, trigger = null }) {
  installSkillInfoDialog(document);
  const dialog = document.getElementById('skillInfoDialog');
  dialog.openForTrigger(trigger, {
    name,
    description,
    mana,
    level,
    iconSrc,
    iconFallback,
  });
}

export function closeSkillInfoDialog(document) {
  const dialog = document.getElementById('skillInfoDialog');
  if (dialog?.open) dialog.close();
}
