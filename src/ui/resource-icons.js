export function resourceIcon(type) {
  const label = type === 'coin' ? 'Oro' : 'Sangre de Jefe';
  return `<span class="resource-icon resource-icon--${type}" role="img" aria-label="${label}"></span>`;
}

export function resourceValue(type, value, label = '') {
  return `<span class="resource-value">${resourceIcon(type)}<b>${Math.max(0, Number(value) || 0)}</b>${label ? `<small>${label}</small>` : ''}</span>`;
}

export function setTextWithResourceIcons(element, text) {
  if (!element) return;
  element.textContent = String(text ?? '');
  if (!String(text ?? '').includes('🪙')) return;
  element.innerHTML = element.innerHTML.replaceAll('🪙', resourceIcon('coin'));
}
