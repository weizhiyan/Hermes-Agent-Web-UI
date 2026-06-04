const fs = require('fs');
const path = require('path');
const { hermesStream } = require('./hermes');
const store = require('./store');
const paths = require('./paths');

const RELAY_PROVIDER_RE = /new\s*api|one\s*api|openai|openrouter|siliconflow|together|moonshot|kimi|zhipu|xiaomi|mimo|mi\s*model|\u5c0f\u7c73|\u667a\u8c31|\u4e2d\u8f6c|gateway|relay/i;
const AGENT_FORCE_RE = /agent\s*模式|hermes\s*模式|工具调用|用工具|调用工具|终端|命令行|shell|powershell|cmd|git\s|npm\s|pnpm\s|yarn\s|docker\s|curl|api|接口/i;
const AGENT_ACTION_RE = /(帮我)?(新建|创建|保存|写入|读取|查看|打开|编辑|修改|更新|删除|移动|重命名|上传|下载|同步|导入|导出|发布|抓取|复制|粘贴|运行|执行|安装|部署|测试|构建|扫描|分析|修复|提交)/i;
const AGENT_TARGET_RE = /(本地|文件|文档|目录|路径|代码|项目|仓库|语雀|yuque|飞书|notion|网页|浏览器|网站|后台|控制台|知识库|markdown|md\b)/i;

function hasAgentTaskIntent(text = '') {
  const value = String(text || '');
  if (!value.trim()) return false;
  if (AGENT_FORCE_RE.test(value)) return true;
  if (/帮我(改|修|写|新建|创建|保存|读取|查看|打开|编辑|修改|更新|删除|移动|重命名|上传|下载|同步|导入|导出|发布|抓取|运行|执行|安装|部署|测试|构建|提交)/i.test(value)) return true;
  if (AGENT_ACTION_RE.test(value) && AGENT_TARGET_RE.test(value)) return true;
  if (/(语雀|yuque|飞书|notion)/i.test(value) && /(编辑|修改|更新|发布|同步|上传|下载|导入|导出|读取|创建|新建|保存)/i.test(value)) return true;
  return false;
}

function shouldUseHermesAgent({ cfg = {}, settings = {}, last = '', libraryItem = null } = {}) {
  const mode = String(cfg.routingMode || settings.routingMode || 'auto').toLowerCase();
  const quickDirect = cfg.quickMode === true || settings.quickMode === true;
  const agentIntent = hasAgentTaskIntent(last);
  if (cfg.forceHermes === true) return { useHermes: true, reason: 'request-force-hermes' };
  if (cfg.forceDirect === true) return { useHermes: false, reason: 'request-force-direct' };
  if (quickDirect) return { useHermes: false, reason: 'quick-mode-direct' };
  if (mode === 'hermes' || mode === 'agent') return { useHermes: true, reason: 'settings-hermes' };
  if (mode === 'direct' || mode === 'fast') return { useHermes: false, reason: 'settings-direct' };
  if (!canUseDirectApi(libraryItem) && !isRelayModel(libraryItem)) return { useHermes: true, reason: 'direct-api-unavailable' };
  if (agentIntent) return { useHermes: true, reason: 'agent-intent' };
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

function normalizeApiBase(base = '') {
  return String(base || '')
    .trim()
    .replace(/\/+(v1\/)?chat\/completions\/?$/i, '')
    .replace(/\/+v1\/models\/?$/i, '/v1')
    .replace(/\/+models\/?$/i, '')
    .replace(/\/+$/g, '');
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

function requestModelName(item = {}, fallback = '') {
  return item?.model || item?.name || fallback || '';
}
function normalizeStoredImagePath(target = '') {
  const text = String(target || '');
  const wsl = text.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (wsl && process.platform === 'win32') return wsl[1].toUpperCase() + ':\\' + wsl[2].replace(/\//g, '\\');
  const win = text.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (win && process.platform !== 'win32') return '/mnt/' + win[1].toLowerCase() + '/' + win[2].replace(/\\/g, '/');
  return text;
}
function isInside(root, target) {
  const rel = path.relative(root, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
function imagePathFromAttachment(item = {}) {
  const candidates = [
    normalizeStoredImagePath(item.path || ''),
    item.filename ? path.join(paths.imageInputDir(), item.filename) : '',
    item.filename ? path.join(paths.imageOutputDir(), item.filename) : '',
  ].filter(Boolean);
  const roots = paths.roots().map(root => path.resolve(root));
  return candidates.find(candidate => {
    try {
      const full = path.resolve(candidate);
      return fs.existsSync(full) && roots.some(root => full === root || isInside(root, full));
    } catch (_) { return false; }
  }) || '';
}
function imageDataUrlFromAttachment(item = {}) {
  const filePath = imagePathFromAttachment(item);
  if (!filePath) return '';
  const mime = item.mime || (filePath.toLowerCase().endsWith('.webp') ? 'image/webp' : (filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png'));
  try { return 'data:' + mime + ';base64,' + fs.readFileSync(filePath).toString('base64'); } catch (_) { return ''; }
}
function messageContentForProvider(message = {}) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (!attachments.length) return message.content;
  const content = [{ type: 'text', text: String(message.content || '') }];
  for (const item of attachments.slice(0, 6)) {
    const dataUrl = imageDataUrlFromAttachment(item);
    const url = dataUrl || item.publicUrl || item.url || '';
    if (url) content.push({ type: 'image_url', image_url: { url } });
  }
  return content.length > 1 ? content : message.content;
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

async function* hermesApiServerStream(cfg, messages) {
  const settings = store.read('settings', {});
  const signal = cfg._abortSignal;
  const base = String(cfg.hermesApiServerUrl || settings.hermesApiServerUrl || '').replace(/\/+$/, '');
  const key = String(cfg.hermesApiServerKey || settings.hermesApiServerKey || '');
  const model = cfg._selectedLibraryModel?.name || cfg._requestedModel || cfg.current || 'hermes-agent';
  if (!base) {
    yield { type: 'perf', stage: 'hermes-api-skipped', reason: 'missing-url' };
    return false;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = 'Bearer ' + key;
  const body = JSON.stringify({
    model,
    messages: messages.map(m => ({ role: m.role, content: messageContentForProvider(m) })),
    stream: true,
  });
  let resp;
  try {
    yield { type: 'perf', stage: 'hermes-api-connect', base };
    resp = await fetch(chatUrl(base), {
      method: 'POST',
      headers,
      body,
      signal: anySignal([signal, timeoutSignal(120000)]),
    });
  } catch (e) {
    if (e.name === 'AbortError' || signal?.aborted) {
      yield { type: 'perf', stage: 'hermes-api-aborted' };
      return true;
    }
    yield { type: 'perf', stage: 'hermes-api-failed', reason: e.message };
    return false;
  }
  if (!resp.ok || !resp.body) {
    let errText = '';
    try { errText = await resp.text(); } catch {}
    yield { type: 'perf', stage: 'hermes-api-failed', status: resp.status, reason: errText.replace(/\s+/g, ' ').slice(0, 180) };
    return false;
  }
  let buffer = '';
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  try {
    while (true) {
      if (signal?.aborted) {
        try { await reader.cancel(); } catch {}
        yield { type: 'perf', stage: 'hermes-api-aborted' };
        return true;
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
        if (data === '[DONE]') return true;
        let chunk;
        try { chunk = JSON.parse(data); } catch { continue; }
        const delta = chunk.choices?.[0]?.delta || chunk.delta || {};
        const tool = chunk.tool || chunk.tool_call || chunk.toolCall;
        if (delta.reasoning_content && cfg.showRawReasoning === true) yield { type: 'reasoning', text: delta.reasoning_content };
        if (delta.content) yield { type: 'token', text: delta.content };
        if (tool?.name) yield { type: 'tool', name: tool.name, preview: tool.preview || '', args: tool.args || tool.input || {} };
        if (chunk.session_id || chunk.sessionId) yield { type: 'session', sessionId: chunk.session_id || chunk.sessionId };
      }
    }
    return true;
  } catch (e) {
    if (e.name === 'AbortError' || signal?.aborted) {
      yield { type: 'perf', stage: 'hermes-api-aborted' };
      return true;
    }
    yield { type: 'perf', stage: 'hermes-api-failed', reason: e.message };
    return false;
  }
}

async function* directApiStream(cfg, messages) {
  const signal = cfg._abortSignal;
  const requestedModel = cfg._requestedModel || cfg.current || '';
  const libraryItem = selectedLibraryModel(cfg, requestedModel);
  const provider = libraryItem?.provider || cfg._activeProvider || '';
  const providerCfg = libraryItem || cfg[provider] || {};
  const base = String(providerCfg.base || '').replace(/\/+$/, '');
  const key = providerCfg.key || '';
  const model = requestModelName(libraryItem || providerCfg, requestedModel);
  const apiFormat = providerCfg.apiFormat || 'openai-chat';
  const authType = providerCfg.authType || 'bearer';
  const authHeader = providerCfg.authHeader || '';
  const params = cfg.params || {};

  if (!base || !model) {
    yield { type: 'error', text: '模型配置不完整：请在设置 > 模型中配置 Provider、Base URL 和 API Key。' };
    return;
  }

  if (apiFormat !== 'openai-chat') {
    yield { type: 'error', text: `当前直连模式仅支持 OpenAI Chat Completions 格式，当前为 ${apiFormat}。请切换到兼容 OpenAI 的接口，或使用 Hermes Agent 模式。` };
    return;
  }

  if (!key && authType !== 'none') {
    yield { type: 'error', text: `缺少 ${provider || model} 的 API Key，请先在模型设置中填写。` };
    return;
  }

  let body;
  try {
    body = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: messageContentForProvider(m) })),
      stream: true,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens || 4096,
      top_p: params.topP ?? 1,
    });
  } catch (e) {
    yield { type: 'error', text: `消息序列化失败：${e.message}` };
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
      return true;
    }
    yield { type: 'error', text: `API 连接失败：${e.message}` };
    return false;
  }

  if (!resp.ok) {
    let errText = '';
    try { errText = await resp.text(); } catch {}
    yield { type: 'error', text: `API 返回 ${resp.status}: ${errText.replace(/\s+/g, ' ').slice(0, 240)}` };
    return false;
  }

  if (!resp.body) {
    yield { type: 'error', text: 'API 没有返回可读取的响应体。' };
    return false;
  }

  let buffer = '';
  const reader = resp.body.getReader();
  const dec = new TextDecoder();

  try {
    while (true) {
      if (signal?.aborted) {
        try { await reader.cancel(); } catch {}
        yield { type: 'perf', stage: 'direct-api-aborted' };
        return true;
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
        if (data === '[DONE]') return true;

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
      return true;
    }
    yield { type: 'error', text: `流式读取失败：${e.message}` };
    return false;
  }
  return true;
}

async function* chatStream(cfg, messages) {
  const settings = store.read('settings', {});
  const last = messages[messages.length - 1]?.content || '';
  if (!last) {
    yield { type: 'error', text: '消息内容为空。' };
    return;
  }

  const requestedScene = cfg._scene || 'chat';
  const hasImages = messages.some(m => Array.isArray(m.attachments) && m.attachments.length);
  const scene = hasImages && requestedScene === 'chat' && cfg.scenarios?.vision ? 'vision' : requestedScene;
  const sceneModel = cfg.scenarios?.[scene] || cfg.scenarios?.chat || cfg._requestedModel || cfg.current || '';
  const libraryItem = selectedLibraryModel(cfg, sceneModel);
  const modelName = requestModelName(libraryItem || {}, sceneModel || settings.hermesModel || '');
  cfg._requestedModel = libraryItem?.id || sceneModel;
  cfg._selectedLibraryModel = libraryItem || null;

  let route = shouldUseHermesAgent({ cfg, settings, last, libraryItem });
  if (hasImages && scene === 'vision' && canUseDirectApi(libraryItem)) {
    route = { useHermes: false, reason: 'vision-attachment-direct' };
  }
  yield { type: 'perf', stage: 'route-selected', route: route.useHermes ? 'hermes' : 'direct', reason: route.reason, scene };
  if (!route.useHermes) {
    const provider = detectProvider(cfg);
    const selected = cfg._requestedModel || cfg.current || '';
    const directLibraryItem = selectedLibraryModel(cfg, selected);
    if (provider || directLibraryItem) {
      cfg._activeProvider = provider || directLibraryItem.provider || '';
      const directOk = yield* directApiStream(cfg, messages);
      if (directOk) return;
      const fallbackId = cfg.scenarios?.fallback || '';
      const fallbackItem = fallbackId && selectedLibraryModel(cfg, fallbackId);
      if (fallbackItem && fallbackItem.id !== directLibraryItem?.id) {
        yield { type: 'perf', stage: 'model-fallback', from: directLibraryItem?.id || selected, to: fallbackItem.id };
        cfg._requestedModel = fallbackItem.id;
        cfg._selectedLibraryModel = fallbackItem;
        cfg._activeProvider = fallbackItem.provider || '';
        const fallbackOk = yield* directApiStream(cfg, messages);
        if (fallbackOk) return;
      }
      return;
    }
    yield { type: 'perf', stage: 'route-fallback', route: 'hermes', reason: 'direct-provider-missing' };
  }

  // Image scene: use chat model for LLM, image model goes to webui_image_generate tool
  let hermesModel = modelName;
  if (scene === 'image') {
    const chatLibraryItem = selectedLibraryModel(cfg, cfg.scenarios?.chat || cfg.current || '');
    hermesModel = requestModelName(chatLibraryItem) || modelName;
    // Also swap _selectedLibraryModel to the chat model so Hermes CLI uses correct provider/env vars
    if (chatLibraryItem) cfg._selectedLibraryModel = chatLibraryItem;
  }
  const modelCfg = { model: hermesModel };
  const hermesApiUrl = String(cfg.hermesApiServerUrl || settings.hermesApiServerUrl || '').trim();
  if (hermesApiUrl) {
    const apiResult = yield* hermesApiServerStream(cfg, messages);
    if (apiResult) return;
    yield { type: 'perf', stage: 'route-fallback', route: 'hermes-cli', reason: 'hermes-api-unavailable' };
  }
  try {
    yield* hermesStream(last, messages, modelCfg, cfg);
  } catch (e) {
    yield { type: 'error', text: `Hermes Agent 执行失败：${e.message}` };
  }
}

module.exports = { chatStream, directApiStream, hermesApiServerStream, detectProvider };
