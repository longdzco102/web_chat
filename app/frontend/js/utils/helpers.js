/**
 * helpers.js – Pure utility functions (no DOM, no state)
 */

/** Format large numbers: 1200 → "1.2K", 1500000 → "1.5M" */
export function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/** Escape HTML special chars to prevent XSS */
export function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Return HH:MM string from a Date (default: now) */
export function timeStr(date = new Date()) {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/** Return human-readable tag label */
export function tagLabel(tag) {
  const map = {
    'tu-luyen':  'Tu Luyện',
    'chien-dau': 'Chiến Đấu',
    'bao-vat':   'Bảo Vật',
    'tong-mon':  'Tông Môn',
    'truy-tim':  'Truy Tầm Boss',
  };
  return map[tag] ?? tag;
}

/** Return gradient CSS string for banner based on tag */
export function bannerGrad(tag) {
  const map = {
    'tu-luyen':  'linear-gradient(135deg,#0d2a2a,#1a5a4a)',
    'chien-dau': 'linear-gradient(135deg,#2a0d0d,#5a1a1a)',
    'bao-vat':   'linear-gradient(135deg,#2a2200,#5a4a00)',
    'tong-mon':  'linear-gradient(135deg,#1a0a40,#3a1060)',
    'truy-tim':  'linear-gradient(135deg,#2a1a00,#5a3a00)',
  };
  return map[tag] ?? 'linear-gradient(135deg,#1a1040,#2a1060)';
}

/** Clamp a value between min and max */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
