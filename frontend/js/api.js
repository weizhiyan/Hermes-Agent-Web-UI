/**
 * REST client. Uses relative path when served via bridge (HTTP).
 */
import { store } from './store.js';

function baseUrl() {
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return '';
  }
  return store.get('apiBase', 'http://127.0.0.1:8787');
}

async function request(path, opts = {}) {
  const url = (baseUrl() || '').replace(/\/$/, '') + path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    mode: 'cors',
  });
  const json = await res.json().catch(() => ({ code: -1, msg: '连接失败，请检查桥接服务' }));
  if (json.code !== 0) throw new Error(json.msg || 'request failed');
  return json.data;
}

export const api = {
  health: () => request('/api/health'),

  // Chats
  listChats: () => request('/api/chats'),
  createChat: (title) => request('/api/chats', { method: 'POST', body: { title } }),
  getChat: (id) => request(`/api/chats/${id}`),
  deleteChat: (id) => request(`/api/chats/${id}`, { method: 'DELETE' }),
  renameChat: (id, title) => request(`/api/chats/${id}`, { method: 'PUT', body: { title } }),

  async sendMessage(id, content, onToken, signal) {
    const url = (baseUrl() || '').replace(/\/$/, '') + `/api/chats/${id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal, mode: 'cors',
    });
    if (!res.ok || !res.body) throw new Error('stream failed: ' + res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const event = /event: (\w+)/.exec(part)?.[1];
        const data = /data: (.*)/.exec(part)?.[1];
        if (event === 'token' && data) onToken(JSON.parse(data));
        if (event === 'error') throw new Error(JSON.parse(data).msg);
      }
    }
  },

  // Skills
  listSkills: () => request('/api/skills'),
  addSkill: (body) => request('/api/skills', { method: 'POST', body }),
  updateSkill: (id, body) => request(`/api/skills/${id}`, { method: 'PUT', body }),
  deleteSkill: (id) => request(`/api/skills/${id}`, { method: 'DELETE' }),

  // Models
  getModels: () => request('/api/models'),
  saveModels: (body) => request('/api/models', { method: 'PUT', body }),

  // Settings
  getSettings: () => request('/api/settings'),
  saveSettings: (body) => request('/api/settings', { method: 'PUT', body }),

  // Gateway / Platforms
  getGateway: () => request('/api/gateway'),
  saveGateway: (body) => request('/api/gateway', { method: 'PUT', body }),

  // Agent Status
  getAgent: () => request('/api/agent'),

  // Cron Jobs
  listCrons: () => request('/api/cron'),
  createCron: (body) => request('/api/cron', { method: 'POST', body }),
  updateCron: (id, body) => request(`/api/cron/${id}`, { method: 'PUT', body }),
  deleteCron: (id) => request(`/api/cron/${id}`, { method: 'DELETE' }),

  // Usage / Tokens
  getUsage: () => request('/api/usage'),

  // System
  getSystem: () => request('/api/system'),
};
