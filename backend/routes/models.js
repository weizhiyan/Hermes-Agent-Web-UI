const express = require('express');
const store = require('../services/store');

const router = express.Router();
const KEY = 'models';
const SCOPES = ['webui', 'agent'];

const DEFAULTS = {
  params: { temperature: 0.7, maxTokens: 4096, topP: 1 },
  current: '',
  library: [],
  scenarios: {
    chat: '',
    reasoning: '',
    image: '',
    fallback: '',
  },
};

const OPENAI_COMPAT_PROVIDERS = /new\s*api|one\s*api|openai|deepseek|siliconflow|openrouter|together|moonshot|kimi|zhipu|\u667a\u8c31|\u4e2d\u8f6c|gateway/i;

function looksLocalOllama(base = '', provider = '') {
  const text = `${provider} ${base}`.toLowerCase();
  return text.includes('ollama') || text.includes('127.0.0.1:11434') || text.includes('localhost:11434');
}

function inferApiFormat(item = {}) {
  const current = item.apiFormat || '';
  const provider = item.provider || '';
  const base = item.base || '';
  if (current === 'openai-image' || current === 'openai_image') return 'openai-image';
  if (looksLocalOllama(base, provider)) return 'ollama';
  if (current === 'ollama' && OPENAI_COMPAT_PROVIDERS.test(`${provider} ${base}`)) return 'openai-chat';
  if (current === 'anthropic') return 'anthropic_messages';
  return current || 'openai-chat';
}

function inferAuthType(item = {}) {
  if (item.authType) return item.authType;
  if (looksLocalOllama(item.base, item.provider)) return 'none';
  if (inferApiFormat(item) === 'anthropic_messages' || /anthropic|claude/i.test(item.provider || '')) return 'x-api-key';
  return 'bearer';
}

function isOldSeedModel(item = {}) {
  const id = item.id || item.name || '';
  const base = String(item.base || '').replace(/\/+$/, '');
  if (item.key) return false;
  if (id === 'deepseek-r1' && base === 'https://api.deepseek.com') return true;
  if (id === 'gpt-4o' && base === 'https://api.openai.com/v1') return true;
  if (id === 'qwen2.5:7b' && base === 'http://127.0.0.1:11434') return true;
  return false;
}

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
      apiFormat: inferApiFormat({ ...val, provider }),
      authType: inferAuthType({ ...val, provider }),
      authHeader: val.authHeader || '',
    }));
  const byId = new Map();
  [...fromProviders, ...existing].forEach(item => {
    if (!item || !item.name || isOldSeedModel(item)) return;
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
      apiFormat: inferApiFormat(item),
      authType: inferAuthType(item),
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

function anthropicHeaders({ key = '', authType = 'x-api-key', authHeader = '' } = {}) {
  const headers = authHeaders({ key, authType, authHeader });
  headers['anthropic-version'] = '2023-06-01';
  return headers;
}

function modelListUrl(base, apiFormat = 'openai-chat') {
  let clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (apiFormat === 'openai-image' || apiFormat === 'openai_image') {
    clean = clean.replace(/\/images\/(generations|edits)$/i, '');
    return clean.endsWith('/models') ? clean : (clean.endsWith('/v1') ? `${clean}/models` : `${clean}/v1/models`);
  }
  if (apiFormat === 'ollama') return clean.endsWith('/api/tags') ? clean : `${clean}/api/tags`;
  if (apiFormat === 'gemini') return clean.includes('/models') ? clean : `${clean}/v1beta/models`;
  if (apiFormat === 'anthropic_messages') return clean.endsWith('/v1') ? `${clean}/models` : `${clean}/v1/models`;
  if (clean.endsWith('/models')) return clean;
  return clean.endsWith('/v1') ? `${clean}/models` : `${clean}/v1/models`;
}

function chatUrl(base, apiFormat = 'openai-chat') {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (apiFormat === 'openai-image' || apiFormat === 'openai_image') return modelListUrl(base, apiFormat);
  if (apiFormat === 'ollama') return clean.endsWith('/api/chat') ? clean : `${clean}/api/chat`;
  if (apiFormat === 'anthropic_messages') return clean.endsWith('/v1') ? `${clean}/messages` : `${clean}/v1/messages`;
  if (apiFormat !== 'openai-chat') return '';
  if (clean.includes('/chat/completions')) return clean;
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

function authLabel(authType = 'bearer', authHeader = '') {
  if (authType === 'bearer') return 'Authorization: Bearer ***';
  if (authType === 'x-api-key') return 'x-api-key: ***';
  if (authType === 'api-key') return 'api-key: ***';
  if (authType === 'custom') return `${authHeader || '(custom header)'}: ***`;
  return 'none';
}

function snippet(text = '', max = 300) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function testHints({ status, apiFormat, authType, base, provider, bodyText, error }) {
  const hints = [];
  const text = `${provider || ''} ${base || ''}`;
  if (apiFormat === 'ollama' && !looksLocalOllama(base, provider)) {
    hints.push('当前选择的是 Ollama，但这个地址不像本地 Ollama；New API / One API / 中转站通常应选择 OpenAI 兼容。');
  }
  if (apiFormat === 'openai-chat' && /\/api\/chat\/?$/.test(String(base || ''))) {
    hints.push('Base URL 看起来已经包含 Ollama 的 /api/chat；OpenAI 兼容格式请填写网关根地址或 /v1。');
  }
  if (apiFormat === 'openai-chat' && /claude|kiro|anthropic/i.test(`${provider || ''} ${bodyText || ''}`)) {
    hints.push('Claude/Kiro 类中转模型如果测试通过但对话返回空，建议把 API 格式改为 Anthropic Messages。');
  }
  if (apiFormat === 'openai-image') {
    hints.push('OpenAI 图片接口的连接测试只验证 /v1/models 和认证，不会消耗额度生成测试图片；真正生图由对话页“图像生成”触发。');
  }
  if (apiFormat === 'anthropic_messages' && /\/v1\/?$/.test(String(base || ''))) {
    hints.push('Anthropic Messages 建议填写网关根地址，后端会自动请求 /v1/messages。');
  }
  if (OPENAI_COMPAT_PROVIDERS.test(text) && authType !== 'bearer') {
    hints.push('这个 Provider 看起来像 OpenAI 兼容网关，常见认证方式是 Bearer Token；如果网关文档要求 x-api-key 再切回。');
  }
  if (status === 401 || status === 403) hints.push('认证失败，请检查 API Key 是否正确，以及认证方式是 Bearer、x-api-key 还是自定义 Header。');
  if (status === 404) hints.push('接口路径不存在，通常是 Base URL 或 API 格式选错了。OpenAI 兼容会测试 /v1/chat/completions。');
  if (status === 400 && /model|not found|does not exist|invalid/i.test(bodyText || '')) hints.push('模型名可能不是该 Provider 可调用的精确 ID，请先获取模型列表后勾选保存。');
  if (/timeout|aborted|fetch failed|ECONN/i.test(error || '')) hints.push('网络或服务不可达，请确认后端机器能访问该 Base URL，且服务端口已开放。');
  return hints;
}

function normalizeScenarios(scenarios = {}, library = []) {
  const ids = new Set(library.map(m => m.id));
  return {
    chat: ids.has(scenarios.chat) ? scenarios.chat : '',
    reasoning: ids.has(scenarios.reasoning) ? scenarios.reasoning : '',
    image: ids.has(scenarios.image) ? scenarios.image : '',
    fallback: ids.has(scenarios.fallback) ? scenarios.fallback : '',
  };
}

function blankConfig() {
  return { ...DEFAULTS, params: { ...DEFAULTS.params }, scenarios: { ...DEFAULTS.scenarios }, library: [] };
}

function isScopedRoot(cfg = {}) {
  return cfg && typeof cfg === 'object' && (cfg.webui || cfg.agent);
}

function requestedScope(req) {
  const scope = String(req.query.scope || req.body?.scope || '').toLowerCase();
  return SCOPES.includes(scope) ? scope : '';
}

function normalizeConfig(cfg = {}) {
  cfg = { ...blankConfig(), ...(cfg || {}), params: { ...DEFAULTS.params, ...(cfg.params || {}) }, scenarios: { ...DEFAULTS.scenarios, ...(cfg.scenarios || {}) } };
  cfg.library = normalizeLibrary(cfg);
  cfg.scenarios = normalizeScenarios(cfg.scenarios, cfg.library);
  if (cfg.current && !cfg.library.some(m => m.id === cfg.current || m.name === cfg.current)) cfg.current = '';
  return cfg;
}

function loadAll() {
  let root = store.read(KEY, null);
  if (!root) {
    const next = { webui: blankConfig(), agent: blankConfig() };
    store.write(KEY, next);
    return next;
  }
  if (!isScopedRoot(root)) {
    const migrated = normalizeConfig(root);
    const next = { webui: migrated, agent: migrated };
    store.write(KEY, next);
    return next;
  }
  const next = {
    webui: normalizeConfig(root.webui || root.default || root),
    agent: normalizeConfig(root.agent || root.webui || root.default || root),
  };
  if (JSON.stringify(next) !== JSON.stringify(root)) store.write(KEY, next);
  return next;
}

function load(scope = 'webui') {
  return loadAll()[SCOPES.includes(scope) ? scope : 'webui'];
}

function saveScope(scope, cfg) {
  const root = loadAll();
  root[SCOPES.includes(scope) ? scope : 'webui'] = normalizeConfig(cfg);
  store.write(KEY, root);
  return root[SCOPES.includes(scope) ? scope : 'webui'];
}

router.get('/', (req, res) => {
  const scope = requestedScope(req);
  res.ok(scope ? load(scope) : loadAll());
});

router.put('/', (req, res) => {
  const scope = requestedScope(req) || 'webui';
  const body = { ...(req.body || {}) };
  delete body.scope;
  const merged = { ...load(scope), ...body };
  res.ok(saveScope(scope, merged));
});

router.post('/library', (req, res) => {
  const scope = requestedScope(req) || 'webui';
  const cfg = load(scope);
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
    apiFormat: inferApiFormat(item),
    authType: inferAuthType(item),
    authHeader: item.authHeader || '',
  });
  cfg.library = normalizeLibrary({ ...cfg, library: next });
  cfg.scenarios = normalizeScenarios(cfg.scenarios || DEFAULTS.scenarios, cfg.library);
  if (!cfg.current && cfg.library.length) cfg.current = cfg.library[0].id;
  res.ok(saveScope(scope, cfg));
});

router.delete('/library/:id', (req, res) => {
  const scope = requestedScope(req) || 'webui';
  const cfg = load(scope);
  cfg.library = cfg.library.filter(m => m.id !== req.params.id);
  for (const [scene, id] of Object.entries(cfg.scenarios || {})) {
    if (id === req.params.id) cfg.scenarios[scene] = '';
  }
  if (cfg.current === req.params.id) cfg.current = '';
  store.write(KEY, cfg);
  res.ok(cfg);
});

/** 代理获取远程模型列表（避免前端 CORS 问题） */
router.post('/fetch-remote', async (req, res) => {
  const { url, base, key, apiFormat = 'openai-chat', authType = 'bearer', authHeader = '' } = req.body || {};
  const targetUrl = url || modelListUrl(base, apiFormat);
  if (!targetUrl) return res.fail('url required', 400, 400);
  try {
    const r = await fetch(targetUrl, {
      headers: apiFormat === 'anthropic_messages'
        ? anthropicHeaders({ key, authType, authHeader })
        : authHeaders({ key, authType, authHeader }),
      signal: AbortSignal.timeout(10000),
    });
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
  const providerName = provider?.provider || '';
  const apiFormat = inferApiFormat(provider || {});
  const authType = inferAuthType(provider || {});
  const authHeader = provider?.authHeader || '';

  if (!base || !model) {
    return res.json({
      ok: false,
      error: '请填写 Base URL 和模型名',
      apiFormat,
      authType,
      hints: ['模型测试必须至少包含 Base URL 和模型名。'],
    });
  }

  const url = chatUrl(base, apiFormat);
  const meta = {
    ok: false,
    testedUrl: url,
    apiFormat,
    authType,
    authHeader: authLabel(authType, authHeader),
    request: {
      method: 'POST',
      model,
      stream: false,
      auth: authLabel(authType, authHeader),
    },
  };

  try {
    if (!url) {
      return res.json({
        ...meta,
        error: `暂不支持直接测试 ${apiFormat}，请先使用 OpenAI 兼容格式`,
        hints: testHints({ apiFormat, authType, base, provider: providerName }),
      });
    }
    if (apiFormat === 'openai-image' || apiFormat === 'openai_image') {
      const result = await fetch(url, {
        method: 'GET',
        headers: authHeaders({ key, authType, authHeader }),
        signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) {
        const text = await result.text().catch(() => '');
        const bodySnippet = snippet(text);
        return res.json({
          ...meta,
          request: { ...meta.request, method: 'GET' },
          status: result.status,
          statusText: result.statusText,
          bodySnippet,
          error: `${result.status} ${result.statusText}${bodySnippet ? ': ' + bodySnippet.slice(0, 120) : ''}`,
          hints: testHints({ status: result.status, apiFormat, authType, base, provider: providerName, bodyText: text }),
        });
      }
      const json = await result.json();
      const models = Array.isArray(json.data) ? json.data.map(m => m.id || m.name || m).filter(Boolean) : [];
      const found = !models.length || models.includes(model);
      return res.json({
        ...meta,
        request: { ...meta.request, method: 'GET' },
        ok: found,
        status: result.status,
        model,
        response: found ? `图片接口认证正常${models.length ? `，模型列表 ${models.length} 个` : ''}` : '',
        bodySnippet: models.length ? models.slice(0, 12).join(', ') : snippet(JSON.stringify(json)),
        error: found ? '' : '接口可访问，但模型列表里没有找到当前模型名。',
        hints: found ? [] : ['请确认图像模型名称是 Provider 返回的精确 ID，或在获取模型列表后重新勾选保存。'],
      });
    }
    const result = await fetch(url, {
      method: 'POST',
      headers: apiFormat === 'anthropic_messages'
        ? anthropicHeaders({ key, authType, authHeader })
        : authHeaders({ key, authType, authHeader }),
      body: JSON.stringify(
        apiFormat === 'ollama' ? {
          model,
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        } : apiFormat === 'anthropic_messages' ? {
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 8,
        } : {
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }
      ),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) {
      const text = await result.text().catch(() => '');
      const bodySnippet = snippet(text);
      return res.json({
        ...meta,
        status: result.status,
        statusText: result.statusText,
        bodySnippet,
        error: `${result.status} ${result.statusText}${bodySnippet ? ': ' + bodySnippet.slice(0, 120) : ''}`,
        hints: testHints({ status: result.status, apiFormat, authType, base, provider: providerName, bodyText: text }),
      });
    }
    const json = await result.json();
    const choice = json.choices?.[0];
    const anthropicText = Array.isArray(json.content)
      ? json.content.filter(x => x?.type === 'text').map(x => x.text || '').join('')
      : '';
    return res.json({
      ...meta,
      ok: true,
      status: result.status,
      model: json.model || model,
      response: (choice?.message?.content || anthropicText || '').slice(0, 80),
      hints: [],
    });
  } catch (e) {
    const error = e.message || '\u8fde\u63a5\u5931\u8d25';
    return res.json({
      ...meta,
      error,
      hints: testHints({ apiFormat, authType, base, provider: providerName, error }),
    });
  }
});

router.post('/benchmark', async (req, res) => {
  const { provider } = req.body || {};
  const base = provider?.base?.replace(/\/+$/, '') || '';
  const model = provider?.model || '';
  const key = provider?.key || '';
  const providerName = provider?.provider || '';
  const apiFormat = inferApiFormat(provider || {});
  const authType = inferAuthType(provider || {});
  const authHeader = provider?.authHeader || '';
  const url = chatUrl(base, apiFormat);
  const startedAt = Date.now();
  const resultMeta = { ok: false, provider: providerName, model, apiFormat, testedUrl: url, firstTokenMs: 0, totalMs: 0, outputChars: 0, response: '', error: '' };
  if (!base || !model || !url) return res.json({ ...resultMeta, error: '\u8bf7\u586b\u5199 Base URL \u548c\u6a21\u578b\u540d\uff0c\u4e14\u683c\u5f0f\u9700\u652f\u6301\u804a\u5929\u6d4b\u8bd5\u3002' });
  if (!['openai-chat', 'ollama', 'anthropic_messages'].includes(apiFormat)) return res.json({ ...resultMeta, error: '\u6682\u4e0d\u652f\u6301\u6d4b\u901f\uff1a' + apiFormat });
  try {
    const body = apiFormat === 'ollama' ? { model, messages: [{ role: 'user', content: '\u8bf7\u53ea\u56de\u590d ok' }], stream: true }
      : apiFormat === 'anthropic_messages' ? { model, messages: [{ role: 'user', content: '\u8bf7\u53ea\u56de\u590d ok' }], max_tokens: 8, stream: true }
      : { model, messages: [{ role: 'user', content: '\u8bf7\u53ea\u56de\u590d ok' }], max_tokens: 8, stream: true };
    const response = await fetch(url, {
      method: 'POST',
      headers: apiFormat === 'anthropic_messages' ? anthropicHeaders({ key, authType, authHeader }) : authHeaders({ key, authType, authHeader }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      const detail = text ? ': ' + snippet(text).slice(0, 120) : '';
      return res.json({ ...resultMeta, status: response.status, totalMs: Date.now() - startedAt, error: response.status + ' ' + response.statusText + detail });
    }
    const reader = response.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    let output = '';
    let firstTokenMs = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        if (line === 'data: [DONE]') break;
        let text = '';
        if (line.startsWith('data:')) {
          try {
            const chunk = JSON.parse(line.slice(5).trim());
            const delta = chunk.choices?.[0]?.delta || {};
            text = delta.content || delta.reasoning_content || delta.reasoning || '';
          } catch {}
        } else if (apiFormat === 'ollama') {
          try { const chunk = JSON.parse(line); text = chunk.message?.content || chunk.response || ''; } catch {}
        } else if (apiFormat === 'anthropic_messages') {
          try { const chunk = JSON.parse(line); text = chunk.delta?.text || chunk.content_block?.text || ''; } catch {}
        }
        if (text) {
          if (!firstTokenMs) firstTokenMs = Date.now() - startedAt;
          output += text;
        }
      }
      if (output.length >= 20) break;
    }
    const totalMs = Date.now() - startedAt;
    return res.json({ ...resultMeta, ok: true, firstTokenMs: firstTokenMs || totalMs, totalMs, outputChars: output.length, response: output.slice(0, 80) });
  } catch (e) {
    return res.json({ ...resultMeta, totalMs: Date.now() - startedAt, error: e.message || '\u6d4b\u901f\u5931\u8d25' });
  }
});

module.exports = router;
