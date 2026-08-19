import { setTextWithResourceIcons } from './resource-icons.js';

let hideTimer = null;

export function showToast(document, text, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  setTextWithResourceIcons(toast, text);
  toast.className = `toast show ${type}`;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 2_000);
}
