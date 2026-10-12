/**
 * utils/api.js – HTTP API client
 * All endpoints for auth, posts, sects, channels.
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE = isLocal ? 'http://localhost:3000/api' : '/api';

let _token = localStorage.getItem('xianxia_token') || null;

export function saveToken(t) {
  _token = t;
  localStorage.setItem('xianxia_token', t);
}
export function clearToken() {
  _token = null;
  localStorage.removeItem('xianxia_token');
}
export function getToken() { return _token; }

// ── Fetch wrapper ────────────────────────────────────────────
async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };

  // Don't set Content-Type for FormData (browser sets boundary)
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body instanceof FormData
      ? opts.body
      : opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── API endpoints ────────────────────────────────────────────
const api = {

  auth: {
    register: (body) => request('/auth/register', { method: 'POST', body }),
    login:    (body) => request('/auth/login',    { method: 'POST', body }),
    me:       ()     => request('/auth/me'),
    logout:   ()     => request('/auth/logout',   { method: 'POST' }),
    updateAvatar: (formData) => request('/auth/avatar', {
      method: 'PATCH', body: formData,
    }),
    updateSettings: (formData) => request('/auth/settings', {
      method: 'PATCH', body: formData,
    }),
    searchUsers: (q) => request(`/auth/users/search?q=${encodeURIComponent(q)}`),
    getUser:     (id) => request(`/auth/users/${id}`),
  },

  posts: {
    list:    (qs = '')   => request(`/posts${qs}`),
    get:     (id)        => request(`/posts/${id}`),
    create:  (body)      => request('/posts', { method: 'POST', body }),
    delete:  (id)        => request(`/posts/${id}`, { method: 'DELETE' }),
    like:    (id)        => request(`/posts/${id}/like`, { method: 'POST' }),
    comment: (id, body)  => request(`/posts/${id}/comments`, { method: 'POST', body }),
  },

  sects: {
    list:     ()         => request('/sects'),
    mine:     ()         => request('/sects/mine'),
    get:      (id)       => request(`/sects/${id}`),
    create:   (body)     => request('/sects', { method: 'POST', body }),
    update:   (id, body) => request(`/sects/${id}`, { method: 'PATCH', body }),
    delete:   (id)       => request(`/sects/${id}`, { method: 'DELETE' }),
    join:     (id)       => request(`/sects/${id}/join`, { method: 'POST' }),
    leave:    (id)       => request(`/sects/${id}/leave`, { method: 'DELETE' }),
    members:  (id)       => request(`/sects/${id}/members`),
    channels: (id)       => request(`/sects/${id}/channels`),
    // Group management
    invite:   (id, body) => request(`/sects/${id}/invite`, { method: 'POST', body }),
    kick:     (id, uid)  => request(`/sects/${id}/kick/${uid}`, { method: 'DELETE' }),
    setRole:  (id, uid, body) => request(`/sects/${id}/members/${uid}/role`, { method: 'PATCH', body }),
    // Channel management
    createChannel: (id, body) => request(`/sects/${id}/channels`, { method: 'POST', body }),
    updateChannel: (id, channelId, body) => request(`/sects/${id}/channels/${channelId}`, { method: 'PATCH', body }),
    deleteChannel: (id, channelId) => request(`/sects/${id}/channels/${channelId}`, { method: 'DELETE' }),
  },

  channels: {
    messages: (id, qs='') => request(`/channels/${id}/messages${qs}`),
    send:     (id, body)  => request(`/channels/${id}/messages`, { method: 'POST', body }),
    react:    (msgId, body) => request(`/channels/messages/${msgId}/react`, { method: 'POST', body }),
  },

  notifications: {
    list:     ()     => request('/notifications'),
    read:     (id)   => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    clearAll: ()     => request('/notifications', { method: 'DELETE' }),
    accept:   (id)   => request(`/notifications/${id}/accept`, { method: 'POST' }),
    reject:   (id)   => request(`/notifications/${id}/reject`, { method: 'POST' }),
  },

  dms: {
    listRecent: () => request('/dms'),
    history: (userId) => request(`/dms/${userId}`),
    send: (userId, body) => request(`/dms/${userId}`, { method: 'POST', body }),
    markRead: (userId) => request(`/dms/${userId}/read`, { method: 'PATCH' }),
  },

  blocks: {
    list: () => request('/blocks'),
    block: (userId) => request(`/blocks/${userId}`, { method: 'POST' }),
    unblock: (userId) => request(`/blocks/${userId}`, { method: 'DELETE' }),
  },

  friends: {
    list: () => request('/friends'),
    add: (userId) => request(`/friends/${userId}`, { method: 'POST' }),
    remove: (userId) => request(`/friends/${userId}`, { method: 'DELETE' }),
    check: (userId) => request(`/friends/${userId}/check`),
  }
};

export default api;
