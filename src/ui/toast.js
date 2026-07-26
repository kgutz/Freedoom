let hideTimer = null;

export function showToast(document, text, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.className = `toast show ${type}`;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 2_000);
}
