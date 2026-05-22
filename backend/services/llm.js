const { hermesStream } = require('./hermes');
const store = require('./store');

const RELAY_PROVIDER_RE = /new\s*api|one\s*api|openai|openrouter|siliconflow|together|moonshot|kimi|zhipu|智谱|中转|gateway|relay/i;
const AGENT_TASK_RE = /\b(改代码|修改代码|写入文件|保存文件|创建文件|删除文件|移动文件|重命名文件|运行命令|执行命令|终端|shell|powershell|cmd|git\s|npm\s|pnpm\s|yarn\s|docker\s|测试|构建|部署|安装依赖|批量处理|扫描项目|读取目录|分析代码库|修复bug|修 bug|提交|commit|push)\b|帮我(改|修|写|创建|删除|运行|执行|安装|部署)|打开.*文件|操作.*文件|工具调用|agent\s*模式|hermes\s*模式/i;

function shouldUseHermesAgent({ cfg = {}, settings = {}, last = '', libraryItem = null } = {}) {
  const mode = String(cfg.routingMode || settings.routingMode || '').toLowerCase();
  if (mode === 'hermes' || mode === 'agent') return { useHermes: true, reason: 'settings-hermes' };
  if (mode === 'direct' || mode === 'fast') return { useHermes: false, reason: 'settings-direct' };
  if (cfg.forceHermes === true) return { useHermes: true, reason: 'request-force-hermes' };
  if (cfg.forceDirect === true) return { useHermes: false, reason: 'request-force-direct' };
  if (!canUseDirectApi(libraryItem) && !isRelayModel(libraryItem)) return { useHermes: true, reason: 'direct-api-unavailable' };
  if (AGENT_TASK_RE.test(String(last || ''))) return { useHermes: true, reason: 'agent-intent' };
  return { useHermes: false, reason: 'normal-chat-direct' };
}

function authHeaders({ key = '', authType = 'bearer', authHeader = '' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!key || authType === 'none') return headers;
  if (authType === 'x-api-key') headers['x-api-key'] = key;
  else if (authType === 'api-key') headers['api-key'] = key;
  else if (authType === 'custom' && authHeader) headers[authHeader] = key;
  else headers.Authorization = `Bearer ${key}`;
  return headers;
}

function chatUrl(base = '') {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (clean.includes('/chat/completions')) return clean;
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

function findLibraryModel(cfg, id) {
  const lib = Array.isArray(cfg.library) ? cfg.library : [];
  if (!id) return null;
  return lib.find(m => m.enabled !== false && (m.id === id || m.name === id)) || null;
}

function selectedLibraryModel(cfg, requested) {
  return findLibraryModel(cfg, requested || cfg._requestedModel || cfg.current || '');
}

function isRelayModel(item = {}) {
  if (!item || !item.base) return false;
  if ((item.apiFormat || 'openai-chat') !== 'openai-chat') return false;
  return RELAY_PROVIDER_RE.test(`${item.provider || ''} ${item.base || ''}`);
}

function canUseDirectApi(item = {}) {
  return !!(item && item.base && (item.apiFormat || 'openai-chat') === 'openai-chat');
}

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}

function anySignal(signals = []) {
  const usable = signals.filter(Boolean);
  if (!usable.length) return undefined;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(usable);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of usable) {
    if (signal.aborted) return signal;
    signal.addEventListener('abort', abort, { once: true });
  }
  return controller.signal;
}

function detectProvider(cfg) {
  const current = cfg._requestedModel || cfg.current || '';
  const lib = findLibraryModel(cfg, current);
  if (lib?.key) return lib.provider || 'custom';

  const candidates = [];
  for (const [name, prov] of Object.entries(cfg || {})) {
    if (['params', 'scenarios', 'current', '_activeProvider', '_requestedModel', '_scene', 'custom', 'library'].includes(name)) continue;
    if (prov && typeof prov === 'object' && prov.key && current === prov.model) candidates.push(name);
  }
  if (candidates.length) return candidates[0];

  for (const [name, prov] of Object.entries(cfg || {})) {
    if (['params', 'scenarios', 'current', '_activeProvider', '_requestedModel', '_scene', 'custom', 'library'].includes(name)) continue;
    if (prov && typeof prov === 'object' && prov.key) return name;
  }
  return null;
}

async function* directApiStream(cfg, messages) {
  const signal = cfg._abortSignal;
  const requestedModel = cfg._requestedModel || cfg.current || '';
  const libraryItem = selectedLibraryModel(cfg, requestedModel);
  const provider = libraryItem?.provider || cfg._activeProvider || '';
  const providerCfg = libraryItem || cfg[provider] || {};
  const base = String(providerCfg.base || '').replace(/\/+$/, '');
  const key = providerCfg.key || '';
  const model = libraryItem?.name || requestedModel || providerCfg.model || '';
  const apiFormat = providerCfg.apiFormat || 'openai-chat';
  const authType = providerCfg.authType || 'bearer';
  const authHeader = providerCfg.authHeader || '';
  const params = cfg.params || {};

  if (!base || !model) {
    yield { type: 'error', text: '未配置可用模型。请先到设置 > 模型配置添加真实 Provider、Base URL、API Key 和模型。' };
    return;
  }

  if (apiFormat !== 'openai-chat') {
    yield { type: 'error', text: `快速模式目前只支持 OpenAI 兼容格式，当前模型是 ${apiFormat}。请改成 OpenAI 兼容，或关闭快速模式走 Hermes CLI。` };
    return;
  }

  if (!key && authType !== 'none') {
    yield { type: 'error', text: `未配置 ${provider || model} 的 API Key，请在模型配置中填写后再发送。` };
    return;
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
    yield { type: 'error', text: `消息序列化失败: ${e.message}` };
    return;
  }

  let resp;
  try {
    resp = await fetch(chatUrl(base), {
      method: 'POST',
      headers: authHeaders({ key, authType, authHeader }),
      body,
      signal: anySignal([signal, timeoutSignal(120000)]),
    });
  } catch (e) {
    if (e.name === 'AbortError' || signal?.aborted) {
      yield { type: 'perf', stage: 'direct-api-aborted' };
      return;
    }
    yield { type: 'error', text: `API 连接失败: ${e.message}` };
    return;
  }

  if (!resp.ok) {
    let errText = '';
    try { errText = await resp.text(); } catch {}
    yield { type: 'error', text: `API 返回 ${resp.status}: ${errText.replace(/\s+/g, ' ').slice(0, 240)}` };
    return;
  }

  if (!resp.body) {
    yield { type: 'error', text: 'API 未返回流式响应。' };
    return;
  }

  let buffer = '';
  const reader = resp.body.getReader();
  const dec = new TextDecoder();

  try {
    while (true) {
      if (signal?.aborted) {
        try { await reader.cancel(); } catch {}
        yield { type: 'perf', stage: 'direct-api-aborted' };
        return;
      }
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
        if (delta.reasoning_content && cfg.showRawReasoning === true) yield { type: 'reasoning', text: delta.reasoning_content };
        if (delta.content) yield { type: 'token', text: delta.content };
      }
    }
  } catch (e) {
    if (e.name === 'AbortError' || signal?.aborted) {
      yield { type: 'perf', stage: 'direct-api-aborted' };
      return;
    }
    yield { type: 'error', text: `流式读取失败: ${e.message}` };
  }
}

async function* chatStream(cfg, messages) {
  const settings = store.read('settings', {});
  const last = messages[messages.length - 1]?.content || '';
  if (!last) {
    yield { type: 'error', text: '没有输入内容。' };
    return;
  }

  const scene = cfg._scene || 'chat';
  const sceneModel = cfg._requestedModel || cfg.scenarios?.[scene] || cfg.scenarios?.chat || cfg.current || '';
  const libraryItem = selectedLibraryModel(cfg, sceneModel);
  const modelName = libraryItem?.name || sceneModel || settings.hermesModel || '';
  cfg._requestedModel = libraryItem?.id || sceneModel;
  cfg._selectedLibraryModel = libraryItem || null;

  const route = shouldUseHermesAgent({ cfg, settings, last, libraryItem });
  yield { type: 'perf', stage: 'route-selected', route: route.useHermes ? 'hermes' : 'direct', reason: route.reason };
  if (!route.useHermes) {
    const provider = detectProvider(cfg);
    const selected = cfg._requestedModel || cfg.current || '';
    const directLibraryItem = selectedLibraryModel(cfg, selected);
    if (provider || directLibraryItem) {
      cfg._activeProvider = provider || directLibraryItem.provider || '';
      yield* directApiStream(cfg, messages);
      return;
    }
    yield { type: 'perf', stage: 'route-fallback', route: 'hermes', reason: 'direct-provider-missing' };
  }

  const modelCfg = { model: modelName };
  try {
    yield* hermesStream(last, messages, modelCfg, cfg);
  } catch (e) {
    yield { type: 'error', text: `Hermes Agent 调用失败: ${e.message}` };
  }
}

module.exports = { chatStream, directApiStream, detectProvider };
