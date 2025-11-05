// src/services/auth.js
const STORAGE_KEY = 'repoAuth';
const subscribers = new Set();

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { provider: 'github', token: null, username: null };
  } catch {
    return { provider: 'github', token: null, username: null };
  }
}

function write(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  for (const cb of subscribers) {
    try { cb(read()); } catch {}
  }
}

export const auth = {
  subscribe(cb) { subscribers.add(cb); return () => subscribers.delete(cb); },
  getState() { return read(); },
  getToken() { return read().token; },
  isAuthed() { return !!read().token; },
  async login({ provider = 'github', token }) {
    if (!token) throw new Error('Введите токен');
    let ok = false, username = null, message = '';
    try {
      if (provider === 'github') {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`
          },
          cache: 'no-store'
        });
        ok = res.ok;
        if (res.status === 401 || res.status === 403) message = 'Недействительный токен GitHub';
        if (ok) {
          const u = await res.json();
          username = u?.login || null;
        }
      } else {
        throw new Error('Поддерживается только GitHub');
      }
    } catch (e) {
      message = e?.message || String(e);
    }
    if (!ok) throw new Error('Не удалось войти. Проверьте токен.');
    write({ provider, token, username });
    return { provider, username };
  },
  logout() {
    write({ provider: 'github', token: null, username: null });
  },
  handleAuthFailure() {
    auth.logout();
  }
};
