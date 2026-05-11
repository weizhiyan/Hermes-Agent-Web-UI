const { hermesStream } = require('./hermes');
const store = require('./store');

async function* directApiStream(cfg, messages) {
  const requestedModel = cfg._requestedModel || cfg.current || '';
  const libraryItem = Array.isArray(cfg.library) ? cfg.library.find(m => m.enabled !== false && (m.id === requestedModel || m.name === requestedModel)) : null;
  const provider = libraryItem?.provider || cfg._activeProvider || 'deepseek';
  const provCfg = libraryItem || cfg[provider] || {};
  const baseRaw = (provCfg.base || 'https://api.deepseek.com').replace(/\/+$/, '');
  const key = provCfg.key || '';
  const model = libraryItem?.name || requestedModel || provCfg.model || 'deepseek-v4-flash';
  const apiFormat = provCfg.apiFormat || 'openai-chat';
  const authType = provCfg.authType || 'bearer';
  const authHeader = provCfg.authHeader || '';
  const params = cfg.params || {};

  if (!key) {
    yield { type: 'error', text: `未配置 ${provider} API Key，请在模型配置中填写` };
    return;
  }

  if (apiFormat !== 'openai-chat') {
    yield { type: 'error', text: `当前直连对话暂只支持 OpenAI 兼容格式，${apiFormat} 请走 Hermes CLI 或后续适配。` };
    return;
  }

  let url;
  if (baseRaw.includes('/chat/completions')) {
    url = baseRaw;
  } else if (baseRaw.endsWith('/v1')) {
    url = `${baseRaw}/chat/completions`;
  } else {
    url = `${baseRaw}/v1/chat/completions`;
  }

  let body;
  try {
    body = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens || 4096,
      top_p: params.topP ?? 1,
    });
  } catch (e) {
    yield { type: 'error', text: '消息序列化失败: ' + e.message };
    return;
  }

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authType === 'x-api-key' ? { 'x-api-key': key } :
          authType === 'api-key' ? { 'api-key': key } :
          authType === 'custom' && authHeader ? { [authHeader]: key } :
          authType === 'none' ? {} : { 'Authorization': `Bearer ${key}` }),
      },
      body,
      signal: AbortSignal.timeout(120000),
    });
  } catch (e) {
    yield { type: 'error', text: `API 连接失败: ${e.message}` };
    return;
  }

  if (!resp.ok) {
    let errText = '';
    try { errText = await resp.text(); } catch {}
    yield { type: 'error', text: `API 返回 ${resp.status}: ${errText.slice(0, 200)}` };
    return;
  }

  if (!resp.body) {
    yield { type: 'error', text: 'API 未返回流式响应' };
    return;
  }

  let buffer = '';
  const reader = resp.body.getReader();
  const dec = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);

        if (!line || !line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;

        let chunk;
        try { chunk = JSON.parse(data); } catch { continue; }

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.reasoning_content) {
          yield { type: 'reasoning', text: delta.reasoning_content };
        }
        if (delta.content) {
          yield { type: 'token', text: delta.content };
        }
      }
    }
  } catch (e) {
    yield { type: 'error', text: `流式读取失败: ${e.message}` };
  }
}

function detectProvider(cfg) {
  const current = cfg._requestedModel || cfg.current || '';
  const lib = Array.isArray(cfg.library) ? cfg.library.find(m => m.enabled !== false && (m.id === current || m.name === current) && m.key) : null;
  if (lib) return lib.provider || 'custom';
  const candidates = [];
  for (const [name, prov] of Object.entries(cfg)) {
    if (name === 'params' || name === 'current' || name === '_activeProvider' || name === 'custom') continue;
    if (prov && typeof prov === 'object' && prov.key) {
      if (current === prov.model) candidates.push(name);
    }
  }
  if (candidates.includes('deepseek')) return 'deepseek';
  if (candidates.length > 0) return candidates[0];
  if (cfg.deepseek?.key) return 'deepseek';
  for (const [name, prov] of Object.entries(cfg)) {
    if (name === 'params' || name === 'current' || name === '_activeProvider' || name === 'custom') continue;
    if (prov && typeof prov === 'object' && prov.key) return name;
  }
  return null;
}

async function* chatStream(cfg, messages) {
  const settings = store.read('settings', {});
  const last = messages[messages.length - 1]?.content || '';
  if (!last) {
    yield { type: 'error', text: '没有输入内容' };
    return;
  }

  const scene = cfg._scene || 'chat';
  const sceneModel = cfg._requestedModel || cfg.scenarios?.[scene] || cfg.scenarios?.chat || cfg.current || '';
  cfg._requestedModel = sceneModel;

  const quickMode = settings.quickMode === true;
  
  if (quickMode) {
    const provider = detectProvider(cfg);
    const selected = cfg._requestedModel || cfg.current || '';
    const libraryItem = Array.isArray(cfg.library) ? cfg.library.find(m => m.enabled !== false && (m.id === selected || m.name === selected) && m.key) : null;
    if (provider && (cfg[provider]?.key || libraryItem?.key)) {
      cfg._activeProvider = provider;
      try {
        yield* directApiStream(cfg, messages);
        return;
      } catch (e) {
        yield { type: 'error', text: `API 调用失败: ${e.message}` };
        return;
      }
    }
  }

  const modelCfg = { model: settings.hermesModel || sceneModel || '' };
  try {
    yield* hermesStream(last, messages, modelCfg, cfg);
  } catch (e) {
    yield { type: 'error', text: `Hermes Agent 调用失败: ${e.message}` };
  }
}

module.exports = { chatStream };
