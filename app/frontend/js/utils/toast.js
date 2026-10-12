/**
 * toast.js – Toast notification service
 */

const ICONS = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };

/**
 * Show a toast message.
 * @param {string} msg
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration  ms before auto-dismiss
 */
export function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${ICONS[type] ?? 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}
