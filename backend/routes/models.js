const express = require('express');
const store = require('../services/store');

const router = express.Router();
const KEY = 'models';

const DEFAULTS = {
  anthropic: { base: 'https://api.anthropic.com', key: '', model: 'claude-opus-4-7' },
  openai: { base: 'https://api.openai.com/v1', key: '', model: 'gpt-4o' },
  deepseek: { base: 'https://api.deepseek.com', key: '', model: 'deepseek-v4-flash' },
  local: { base: 'http://127.0.0.1:11434', model: 'qwen2.5:7b' },
  params: { temperature: 0.7, maxTokens: 2048, topP: 1 },
  current: 'deepseek-v4-flash',
  library: [
    { id: 'deepseek-v4-flash', provider: 'deepseek', name: 'deepseek-v4-flash', base: 'https://api.deepseek.com', key: '', enabled: true, tags: ['chat'], apiFormat: 'openai-chat', authType: 'bearer' },
    { id: 'deepseek-r1', provider: 'deepseek', name: 'deepseek-r1', base: 'https://api.deepseek.com', key: '', enabled: true, tags: ['reasoning'], apiFormat: 'openai-chat', authType: 'bearer' },
    { id: 'gpt-4o', provider: 'openai', name: 'gpt-4o', base: 'https://api.openai.com/v1', key: '', enabled: false, tags: ['chat', 'vision'], apiFormat: 'openai-chat', authType: 'bearer' },
  ],
  scenarios: {
    chat: 'deepseek-v4-flash',
    reasoning: 'deepseek-r1',
    image: '',
  },
};

function normalizeLibrary(cfg) {
  const existing = Array.isArray(cfg.library) ? cfg.library : [];
  const fromProviders = Object.entries(cfg)
    .filter(([name, val]) => val && typeof val === 'object' && val.model && !['params', 'scenarios'].includes(name))
    .map(([provider, val]) => ({
      id: val.model,
      provider,
      name: val.model,
      base: val.base || '',
      key: val.key || '',
      enabled: true,
      tags: provider === 'deepseek' && /r1|reason/i.test(val.model) ? ['reasoning'] : ['chat'],
      apiFormat: val.apiFormat || 'openai-chat',
      authType: val.authType || 'bearer',
      authHeader: val.authHeader || '',
    }));
  const byId = new Map();
  [...DEFAULTS.library, ...fromProviders, ...existing].forEach(item => {
    if (!item || !item.name) return;
    const id = item.id || `${item.provider || 'custom'}:${item.name}`;
    byId.set(id, {
      id,
      provider: item.provider || 'custom',
      name: item.name || id,
      base: item.base || '',
      key: item.key || '',
      enabled: item.enabled !== false,
      tags: Array.isArray(item.tags) ? item.tags : [],
      kind: item.kind || 'chat',
      apiFormat: item.apiFormat || 'openai-chat',
      authType: item.authType || 'bearer',
      authHeader: item.authHeader || '',
    });
  });
  return [...byId.values()];
}

function authHeaders({ key = '', authType = 'bearer', authHeader = '' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!key) return headers;
  if (authType === 'x-api-key') headers['x-api-key'] = key;
  else if (authType === 'api-key') headers['api-key'] = key;
  else if (authType === 'custom' && authHeader) headers[authHeader] = key;
  else if (authType !== 'none') headers.Authorization = 'Bearer ' + key;
  return headers;
}

function modelListUrl(base, apiFormat = 'openai-chat') {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (apiFormat === 'ollama') return clean.endsWith('/api/tags') ? clean : `${clean}/api/tags`;
  if (apiFormat === 'gemini') return clean.includes('/models') ? clean : `${clean}/v1beta/models`;
  if (clean.endsWith('/models')) return clean;
  return clean.endsWith('/v1') ? `${clean}/models` : `${clean}/v1/models`;
}

function chatUrl(base, apiFormat = 'openai-chat') {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (apiFormat === 'ollama') return clean.endsWith('/api/chat') ? clean : `${clean}/api/chat`;
  if (apiFormat !== 'openai-chat') return '';
  if (clean.includes('/chat/completions')) return clean;
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

function load() {
  let cfg = store.read(KEY, null);
  if (!cfg) { store.write(KEY, DEFAULTS); return DEFAULTS; }
  let dirty = false;
  if (!cfg.deepseek) { cfg.deepseek = { ...DEFAULTS.deepseek }; dirty = true; }
  if (!cfg.anthropic) { cfg.anthropic = { ...DEFAULTS.anthropic }; dirty = true; }
  if (!cfg.openai) { cfg.openai = { ...DEFAULTS.openai }; dirty = true; }
  if (!cfg.local) { cfg.local = { ...DEFAULTS.local }; dirty = true; }
  if (!cfg.params) { cfg.params = { ...DEFAULTS.params }; dirty = true; }
  if (!cfg.current) { cfg.current = DEFAULTS.current; dirty = true; }
  if (!cfg.scenarios) { cfg.scenarios = { ...DEFAULTS.scenarios }; dirty = true; }
  const lib = normalizeLibrary(cfg);
  if (JSON.stringify(lib) !== JSON.stringify(cfg.library)) { cfg.library = lib; dirty = true; }
  if (dirty) store.write(KEY, cfg);
  return cfg;
}

router.get('/', (req, res) => res.ok(load()));

router.put('/', (req, res) => {
  const merged = { ...load(), ...req.body };
  merged.library = normalizeLibrary(merged);
  if (!merged.scenarios) merged.scenarios = { ...DEFAULTS.scenarios };
  store.write(KEY, merged);
  res.ok(merged);
});

router.post('/library', (req, res) => {
  const cfg = load();
  const item = req.body || {};
  if (!item.name) return res.fail('model name required', 400, 400);
  const id = item.id || `${item.provider || 'custom'}:${item.name}`;
  const previous = cfg.library.find(m => m.id === id) || {};
  const next = cfg.library.filter(m => m.id !== id);
  next.push({
    id,
    provider: item.provider || 'custom',
    name: item.name,
    base: item.base || '',
    key: item.key || '',
    enabled: item.enabled !== undefined ? item.enabled !== false : previous.enabled !== false,
    tags: Array.isArray(item.tags) ? item.tags : [],
    kind: item.kind || 'chat',
    apiFormat: item.apiFormat || 'openai-chat',
    authType: item.authType || 'bearer',
    authHeader: item.authHeader || '',
  });
  cfg.library = normalizeLibrary({ ...cfg, library: next });
  store.write(KEY, cfg);
  res.ok(cfg);
});

router.delete('/library/:id', (req, res) => {
  const cfg = load();
  cfg.library = cfg.library.filter(m => m.id !== req.params.id);
  for (const [scene, id] of Object.entries(cfg.scenarios || {})) {
    if (id === req.params.id) cfg.scenarios[scene] = '';
  }
  store.write(KEY, cfg);
  res.ok(cfg);
});

/** 代理获取远程模型列表（避免前端 CORS 问题） */
router.post('/fetch-remote', async (req, res) => {
  const { url, base, key, apiFormat = 'openai-chat', authType = 'bearer', authHeader = '' } = req.body || {};
  const targetUrl = url || modelListUrl(base, apiFormat);
  if (!targetUrl) return res.fail('url required', 400, 400);
  try {
    const r = await fetch(targetUrl, { headers: authHeaders({ key, authType, authHeader }), signal: AbortSignal.timeout(10000) });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.fail(`HTTP ${r.status}: ${text.slice(0, 100)}`, r.status, r.status);
    }
    const j = await r.json();
    let models = [];
    if (Array.isArray(j.models)) models = j.models.map(m => typeof m === 'string' ? m : m.name || m.id);
    else if (Array.isArray(j.data)) models = j.data.map(m => m.id || m.name || m);
    else if (Array.isArray(j)) models = j.map(m => typeof m === 'string' ? m : m.id || m.name);
    res.ok({ models, total: models.length });
  } catch (e) {
    res.fail('获取失败: ' + e.message, 500, 500);
  }
});

/** 测试模型连接 */
router.post('/test', async (req, res) => {
  const { provider } = req.body || {};
  const base = provider?.base?.replace(/\/+$/, '') || '';
  const model = provider?.model || '';
  const key = provider?.key || '';
  const apiFormat = provider?.apiFormat || 'openai-chat';
  const authType = provider?.authType || 'bearer';
  const authHeader = provider?.authHeader || '';

  if (!base || !model) {
    return res.json({ ok: false, error: '请填写 Base URL 和模型名' });
  }

  try {
    const url = chatUrl(base, apiFormat);
    if (!url) return res.json({ ok: false, error: `暂不支持直接测试 ${apiFormat}，请先使用 OpenAI 兼容格式` });
    const result = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ key, authType, authHeader }),
      body: JSON.stringify(apiFormat === 'ollama' ? {
        model,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      } : {
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) {
      const text = await result.text().catch(() => '');
      return res.json({ ok: false, error: `${result.status} ${result.statusText}${text ? ': ' + text.slice(0, 80) : ''}` });
    }
    const json = await result.json();
    const choice = json.choices?.[0];
    return res.json({ ok: true, model: json.model || model, response: choice?.message?.content?.slice(0, 50) || '' });
  } catch (e) {
    return res.json({ ok: false, error: e.message || '连接失败' });
  }
});

module.exports = router;
