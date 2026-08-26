export function resourceIcon(type) {
  const label = type === 'coin' ? 'Oro' : type === 'arcane-fiber' ? 'Fibra Arcana' : 'Sangre de Jefe';
  return `<span class="resource-icon resource-icon--${type}" role="img" aria-label="${label}"></span>`;
}

export function resourceValue(type, value, label = '') {
  return `<span class="resource-value">${resourceIcon(type)}<b>${Math.max(0, Number(value) || 0)}</b>${label ? `<small>${label}</small>` : ''}</span>`;
}

export function setTextWithResourceIcons(element, text) {
  if (!element) return;
  element.textContent = String(text ?? '');
  const iconTokens = {
    '🪙': 'coin',
    '🧵': 'arcane-fiber',
    '🩸': 'boss-blood',
  };
  Object.entries(iconTokens).forEach(([token, type]) => {
    element.innerHTML = element.innerHTML.replaceAll(token, resourceIcon(type));
  });
}
