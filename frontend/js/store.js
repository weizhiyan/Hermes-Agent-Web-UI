/** Tiny localStorage wrapper. Reset old keys on first load. */
const PREFIX = 'hermes:';

try {
  ['hermes.settings', 'hermes.model', 'hermes.skills', 'hermes.chats'].forEach(k => {
    localStorage.removeItem(k);
  });
  const oldBase = localStorage.getItem(PREFIX + 'apiBase');
  if (oldBase && JSON.parse(oldBase).includes('172.27.105.206')) {
    localStorage.removeItem(PREFIX + 'apiBase');
  }
  if (!localStorage.getItem(PREFIX + 'apiBase')) {
    localStorage.setItem(PREFIX + 'apiBase', JSON.stringify(''));
  }
} catch {}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
  remove(key) { localStorage.removeItem(PREFIX + key); },
};

export function toast(msg, ms = 1600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
