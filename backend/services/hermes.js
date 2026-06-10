/**
 * Hermes CLI bridge.
 * Windows-first native Hermes CLI bridge.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const { collectTerminalChatModels } = require('./terminalModels');

const TOOL_START_RE = /^\[TOOL:START\]\s*(.*)/;
const TOOL_END_RE = /^\[TOOL:END\]\s*(.*)/;
const REASONING_RE = /^\[REASONING\]\s*(.*)/;
const THINKING_RE = /^\[THINKING\]\s*(.*)/;
const ERROR_RE = /^\[ERROR\]\s*(.*)/;
const TITLE_RE = /^\[TITLE\]\s*(.*)/;
const AGENT_TAG_RE = /^\[AGENT:\w+\]\s*/;
const ANSI_CONTROL_RE = /(?:\x1B\[[0-?]*[ -/]*[@-~]|\x1B\][\s\S]*?(?:\x07|\x1B\\)|[\x00-\x08\x0B\x0C\x0E-\x1F\x7F])/g;
const SESSION_RE = /\bsession:\s*([A-Za-z0-9_-]+)/i;
const SESSION_ID_RE = /\bsession_id:\s*([A-Za-z0-9_-]+)/i;
const RESUMED_SESSION_RE = /(?:^|[^\w])↻?\s*Resumed session\s+([A-Za-z0-9_-]+)\s*\((\d+)\s+user message[s]?,\s*(\d+)\s+total message[s]?\)/i;
const TERMINAL_DECOR_RE = /^[\s│┃┆┊┌└├┤┬┴─═╭╰╮╯╞╡╪╔╚╗╝║╠╣╦╩╬•●○◦▪▫■□◇◆▶▷▸▹▾▿⠁-⣿\[\]\(\)]+/u;
let cachedHermesCommand = null;
let cachedHermesCommandAt = 0;
let lastGoodHermesCommand = null;
let lastGoodHermesCommandAt = 0;
const HERMES_COMMAND_CACHE_MS = 5 * 60 * 1000;
const HERMES_COMMAND_MISS_CACHE_MS = 10 * 1000;
const HERMES_COMMAND_STALE_OK_MS = 30 * 60 * 1000;
const MAX_CONTEXT_MESSAGE_CHARS = 6000;
const activeHermesChildren = new Map();
const HERMES_CLI_TIMEOUT_MS = Math.max(60000, Number(process.env.HERMES_CLI_TIMEOUT_MS || 30 * 60 * 1000));
const HERMES_IDLE_TIMEOUT_MS = Math.max(30000, Number(process.env.HERMES_IDLE_TIMEOUT_MS || 5 * 60 * 1000));
const CONFIG_LOCK_TIMEOUT_MS = Math.max(1000, Number(process.env.HERMES_CONFIG_LOCK_TIMEOUT_MS || 10000));
const WEBUI_RELAY_PROVIDER = 'webui_relay';
const HERMES_CONFIG_PATH_CACHE_MS = 60 * 1000;
let hermesConfigWriteLock = Promise.resolve();
let cachedHermesConfigPath = '';
let cachedHermesConfigPathAt = 0;

function logCritical(scope, error, extra = {}) {
  const message = error && error.stack ? error.stack : (error && error.message ? error.message : String(error || 'unknown'));
  console.error('[hermes:' + scope + ']', message, extra && Object.keys(extra).length ? extra : '');
}

function cleanupTempFile(filePath, scope = 'temp') {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    logCritical('cleanup-' + scope, e, { filePath });
  }
}

function writeFileAtomic(target, content) {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, '.' + path.basename(target) + '.' + process.pid + '.' + Date.now() + '.tmp');
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    fs.renameSync(tmp, target);
  } catch (e) {
    cleanupTempFile(tmp, 'atomic-write');
    throw e;
  }
}

function withHermesConfigWriteLock(task) {
  const previous = hermesConfigWriteLock;
  let release;
  const next = new Promise(resolve => { release = resolve; });
  hermesConfigWriteLock = previous.then(() => next, () => next);
  return previous
    .then(() => Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Hermes config write lock timeout')), CONFIG_LOCK_TIMEOUT_MS)),
    ]))
    .finally(() => release());
}


function registerHermesChild(child, meta = {}) {
  if (!child || !child.pid) return child;
  activeHermesChildren.set(child.pid, { child, meta: { ...meta, pid: child.pid, startedAt: Date.now() } });
  child.once('close', () => activeHermesChildren.delete(child.pid));
  return child;
}

function stopActiveHermesChildren(reason = 'manual-stop') {
  const items = [...activeHermesChildren.values()];
  items.forEach(({ child }) => {
    try { if (child && !child.killed) child.kill('SIGTERM'); } catch (_) {}
  });
  setTimeout(() => {
    items.forEach(({ child }) => {
      try { if (child && !child.killed) child.kill('SIGKILL'); } catch (_) {}
    });
  }, 1500).unref?.();
  return { stopped: items.length, reason, pids: items.map(item => item.meta.pid).filter(Boolean) };
}

function activeHermesChildStats() {
  return [...activeHermesChildren.values()].map(item => item.meta);
}

function compactHistoryContent(content = '') {
  const text = String(content || '')
    .replace(/<artifact\s+[^>]+>[\s\S]*?<\/artifact>/gi, '[已生成 Artifact 文档]')
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .trim();
  if (text.length <= MAX_CONTEXT_MESSAGE_CHARS) return text;
  return text.slice(0, 2400) + '\n…\n' + text.slice(-2400);
}

function providerArg(provider = '') {
  const raw = String(provider || '').trim();
  const p = raw.toLowerCase();
  if (!p) return '';
  if (/[\u4e2d\u8f6c]|gateway|relay|new\s*api|one\s*api/i.test(raw)) return 'webui_relay';
  return p.replace(/[^a-z0-9_-]/g, '');
}

const NATIVE_HERMES_PROVIDERS = new Set([
  'anthropic',
  'bedrock',
  'deepseek',
  'gemini',
  'groq',
  'moonshot',
  'ollama',
  'openai',
  'openrouter',
  'qwen',
  'xai',
]);

function hermesProviderName(selectedModel, activeProvider = '') {
  const base = String(selectedModel?.base || '').trim().toLowerCase();
  const apiMode = hermesApiMode(selectedModel || {});
  if (base.includes('api.anthropic.com')) return 'anthropic';
  if (base.includes('api.deepseek.com')) return 'deepseek';
  if (base.includes('openrouter.ai')) return 'openrouter';
  if (base.includes('api.openai.com')) return 'openai';
  if (base.includes('dashscope.aliyuncs.com') || base.includes('dashscope-intl.aliyuncs.com')) return 'qwen';
  if (base.includes('api.moonshot') || base.includes('kimi.moonshot')) return 'moonshot';
  if (base.includes('api.groq.com')) return 'groq';
  if (base.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (base.includes('api.x.ai')) return 'xai';

  const active = providerArg(activeProvider || '');
  if (active === 'webui_relay') return active;
  if (NATIVE_HERMES_PROVIDERS.has(active)) return active;
  const selectedProvider = providerArg(selectedModel?.provider || '');
  if (selectedProvider === 'webui_relay') return selectedProvider;
  if (NATIVE_HERMES_PROVIDERS.has(selectedProvider)) return selectedProvider;
  if (selectedModel?.base && selectedModel?.key) return 'webui_relay';
  return '';
}

function hermesApiMode(selectedModel = {}) {
  const fmt = String(selectedModel.apiFormat || 'openai-chat').trim().toLowerCase();
  if (fmt === 'anthropic' || fmt === 'anthropic-messages' || fmt === 'anthropic_messages') return 'anthropic_messages';
  if (fmt === 'codex' || fmt === 'codex-responses' || fmt === 'codex_responses') return 'codex_responses';
  return 'chat_completions';
}

function hermesBaseUrl(selectedModel = {}) {
  let base = String(selectedModel.base || '').trim().replace(/\/+$/, '');
  if (hermesApiMode(selectedModel) === 'anthropic_messages') {
    base = base.replace(/\/v1$/i, '');
  }
  return base;
}

function requestModelName(selectedModel = {}) {
  return String(selectedModel?.model || selectedModel?.name || '').trim();
}

function cleanUrl(value = '') {
  return String(value || '').replace(/\s+/g, '').replace(/\/+$/, '');
}

function relayBaseUrl() {
  const port = process.env.WEBUI_PORT || process.env.HERMES_WEBUI_PORT || 3381;
  return cleanUrl(process.env.WEBUI_RELAY_BASE_URL || `http://127.0.0.1:${port}/v1`);
}

function sanitizeHermesConfigText(text = '') {
  return String(text || '').replace(/http:\/\/([^\s"']+):(\d+)\s+\/v1/g, 'http://$1:$2/v1');
}

function hermesProviderBaseUrl(selectedModel = {}, options = {}) {
  if ((options.providerName || '') === WEBUI_RELAY_PROVIDER) {
    return relayBaseUrl();
  }
  if (!NATIVE_HERMES_PROVIDERS.has(options.providerName || '') && selectedModel?.base && selectedModel?.key) {
    return relayBaseUrl();
  }
  return hermesBaseUrl(selectedModel);
}

function hermesConfigPathCandidates() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || (home ? path.join(home, 'AppData', 'Local') : '');
  const appData = process.env.APPDATA || '';
  return [
    process.env.HERMES_CONFIG_PATH || '',
    localAppData ? path.join(localAppData, 'hermes', 'config.yaml') : '',
    appData ? path.join(appData, 'hermes', 'config.yaml') : '',
    home ? path.join(home, '.hermes', 'config.yaml') : '',
  ].filter(Boolean);
}

function hermesConfigFilePath() {
  const now = Date.now();
  if (cachedHermesConfigPath && now - cachedHermesConfigPathAt < HERMES_CONFIG_PATH_CACHE_MS) return cachedHermesConfigPath;

  const envPath = String(process.env.HERMES_CONFIG_PATH || '').trim();
  if (envPath) {
    cachedHermesConfigPath = envPath;
    cachedHermesConfigPathAt = now;
    return cachedHermesConfigPath;
  }

  try {
    const result = spawnSync('hermes', ['config', 'path'], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
    });
    const cliPath = String(result.stdout || result.stderr || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
    if (!result.error && result.status === 0 && cliPath) {
      cachedHermesConfigPath = cliPath;
      cachedHermesConfigPathAt = now;
      return cachedHermesConfigPath;
    }
  } catch (_) {}

  const candidates = hermesConfigPathCandidates();
  cachedHermesConfigPath = candidates.find(file => {
    try { return fs.existsSync(file); } catch (_) { return false; }
  }) || candidates[0] || '';
  cachedHermesConfigPathAt = now;
  return cachedHermesConfigPath;
}

function readHermesConfigFile() {
  const file = hermesConfigFilePath();
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function normalizeHermesModelList(models = []) {
  const seen = new Set();
  const next = [];
  for (const item of models || []) {
    const value = String(item || '').trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}

function collectWebuiRelayModelItems(extraModel = null) {
  return collectTerminalChatModels({ extraModel });
}

function collectWebuiRelayModelNames(extraModel = null) {
  return normalizeHermesModelList(collectWebuiRelayModelItems(extraModel).map(item => item.name));
}

function defaultWebuiRelayModel(extraModel = null) {
  const root = store.read('models', {});
  const items = collectWebuiRelayModelItems(extraModel);
  const ids = [
    root?.webui?.current,
    root?.webui?.scenarios?.chat,
    root?.agent?.current,
    root?.agent?.scenarios?.chat,
    requestModelName(extraModel),
  ].map(value => String(value || '').trim()).filter(Boolean);
  for (const id of ids) {
    const found = items.find(item => item.id === id || item.name === id);
    if (found) return found;
  }
  return items[0] || null;
}

function modelListLines(models = [], indent = '') {
  const names = normalizeHermesModelList(models);
  if (!names.length) return [];
  return [
    indent + 'discover_models: false',
    indent + 'models:',
    ...names.map(name => indent + '  - ' + yamlScalar(name)),
  ];
}

function sectionBounds(lines, sectionName) {
  const start = lines.findIndex(line => new RegExp('^' + sectionName + ':\\s*(?:\\{\\}|\\[\\])?\\s*$').test(String(line).trim()));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z_][A-Za-z0-9_-]*:\s*(?:.*)?$/.test(lines[i]) && !/^\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function replaceSection(lines, sectionName, newSectionLines) {
  const bounds = sectionBounds(lines, sectionName);
  if (!bounds) return [...lines, '', ...newSectionLines];
  return [...lines.slice(0, bounds.start), ...newSectionLines, ...lines.slice(bounds.end)];
}

function yamlScalar(value = '') {
  return JSON.stringify(String(value || ''));
}

function upsertProvider(text, providerName, selectedModel, options = {}) {
  const base = hermesProviderBaseUrl(selectedModel, { ...options, providerName });
  const apiMode = hermesApiMode(selectedModel);
  const modelName = requestModelName(selectedModel);
  const models = normalizeHermesModelList(options.models || []);
  const providerBlock = [
    providerName + ':',
    '  name: ' + yamlScalar(providerName),
    '  api: ' + yamlScalar(base),
    '  api_key: ' + yamlScalar(selectedModel.key),
    '  transport: ' + yamlScalar(apiMode),
    ...(modelName ? ['  default_model: ' + yamlScalar(modelName)] : []),
    ...modelListLines(models, '  '),
  ];

  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const section = sectionBounds(lines, 'providers');
  if (!section) {
    const modelSection = sectionBounds(lines, 'model');
    const insertAt = modelSection ? modelSection.start : 0;
    return [
      ...lines.slice(0, insertAt),
      'providers:',
      ...providerBlock.map(line => '  ' + line),
      '',
      ...lines.slice(insertAt),
    ].join('\n');
  }

  const body = lines.slice(section.start + 1, section.end);
  const blocks = [];
  let current = [];
  for (const line of body) {
    if (/^\s{2}[A-Za-z0-9_-]+:\s*$/.test(line) && current.length) {
      blocks.push(current);
      current = [line];
    } else if (current.length || /^\s{2}[A-Za-z0-9_-]+:\s*$/.test(line)) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const targetHead = '  ' + providerName + ':';
  const replacement = providerBlock.map(line => '  ' + line);
  const targetIdx = blocks.findIndex(block => String(block[0] || '').trim() === providerName + ':');
  if (targetIdx >= 0) blocks[targetIdx] = replacement;
  else blocks.push(replacement);

  const rebuilt = ['providers:'];
  for (const item of blocks) rebuilt.push(...item);
  return [...lines.slice(0, section.start), ...rebuilt, ...lines.slice(section.end)].join('\n');
}

function upsertCustomProvider(text, providerName, selectedModel, options = {}) {
  const base = hermesProviderBaseUrl(selectedModel, { ...options, providerName });
  const apiMode = hermesApiMode(selectedModel);
  const modelName = requestModelName(selectedModel);
  const models = normalizeHermesModelList(options.models || []);
  const providerBlock = [
    '- name: ' + providerName,
    '  base_url: ' + base,
    '  api_key: ' + selectedModel.key,
    '  api_mode: ' + apiMode,
    ...(modelName ? ['  model: ' + JSON.stringify(modelName)] : []),
    ...modelListLines(models, '  '),
  ];

  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const section = sectionBounds(lines, 'custom_providers');
  if (!section) {
    const modelSection = sectionBounds(lines, 'model');
    const insertAt = modelSection ? modelSection.end : 0;
    return [
      ...lines.slice(0, insertAt),
      'custom_providers:',
      ...providerBlock,
      '',
      ...lines.slice(insertAt),
    ].join('\n');
  }

  const sectionLines = lines.slice(section.start + 1, section.end);
  const blocks = [];
  let current = [];
  for (const line of sectionLines) {
    if (/^\s*-\s+name:\s*/.test(line) && current.length) {
      blocks.push(current);
      current = [line];
    } else if (current.length || /^\s*-\s+name:\s*/.test(line)) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const targetIdx = blocks.findIndex(block => block.some(line => line.includes('name: ' + providerName)));
  if (targetIdx >= 0) blocks[targetIdx] = providerBlock;
  else blocks.push(providerBlock);

  const rebuilt = ['custom_providers:'];
  for (const item of blocks) rebuilt.push(...item);
  return [...lines.slice(0, section.start), ...rebuilt, ...lines.slice(section.end)].join('\n');
}

function removeCustomProvider(text = '', providerName = '') {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const section = sectionBounds(lines, 'custom_providers');
  if (!section) return text;
  const sectionLines = lines.slice(section.start + 1, section.end);
  const blocks = [];
  let current = [];
  for (const line of sectionLines) {
    if (/^\s*-\s+name:\s*/.test(line) && current.length) {
      blocks.push(current);
      current = [line];
    } else if (current.length || /^\s*-\s+name:\s*/.test(line)) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  const kept = blocks.filter(block => !block.some(line => String(line).trim() === 'name: ' + providerName || String(line).includes('name: ' + providerName)));
  if (!kept.length) return [...lines.slice(0, section.start), ...lines.slice(section.end)].join('\n');
  const rebuilt = ['custom_providers:'];
  for (const block of kept) rebuilt.push(...block);
  return [...lines.slice(0, section.start), ...rebuilt, ...lines.slice(section.end)].join('\n');
}

function upsertMcpServer(text = '', serverName = '', serverBlock = []) {
  if (!serverName || !Array.isArray(serverBlock) || !serverBlock.length) return text;
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const section = sectionBounds(lines, 'mcp_servers');
  if (!section) return [...lines, '', 'mcp_servers:', ...serverBlock].join('\n');

  const body = lines.slice(section.start + 1, section.end);
  const blocks = [];
  let current = [];
  for (const line of body) {
    if (/^\s{2}[A-Za-z0-9_-]+:\s*$/.test(line) && current.length) {
      blocks.push(current);
      current = [line];
    } else if (current.length || /^\s{2}[A-Za-z0-9_-]+:\s*$/.test(line)) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const targetIdx = blocks.findIndex(block => String(block[0] || '').trim() === serverName + ':');
  if (targetIdx >= 0) blocks[targetIdx] = serverBlock;
  else blocks.push(serverBlock);

  const rebuilt = ['mcp_servers:'];
  for (const block of blocks) rebuilt.push(...block);
  return [...lines.slice(0, section.start), ...rebuilt, ...lines.slice(section.end)].join('\n');
}

function webuiImageMcpServerBlock(options = {}) {
  const scriptPath = path.join(process.cwd(), 'backend', 'mcp', 'webui-image-server.js');
  const command = process.execPath || 'node';
  return [
    '  webui_image:',
    '    command: ' + yamlScalar(command),
    '    args:',
    '    - ' + yamlScalar(scriptPath),
    '    env:',
    '      WEBUI_API: ' + yamlScalar(options.webuiApi || process.env.WEBUI_API || 'http://127.0.0.1:3381'),
    '    enabled: true',
    '    tools:',
    '      include:',
    '      - webui_image_generate',
    '      - webui_video_generate',
    '      - webui_markdown_insert_image',
    '      - webui_markdown_create',
  ];
}

function removeMcpServer(text = '', serverName = '') {
  if (!serverName) return text || '';
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const section = sectionBounds(lines, 'mcp_servers');
  if (!section) return lines.join('\n');
  const escapedName = serverName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targetRe = new RegExp(`^\\s{2}${escapedName}\\s*:\\s*$`);
  for (let i = section.start + 1; i < section.end; i++) {
    if (!targetRe.test(lines[i] || '')) continue;
    let end = i + 1;
    while (end < section.end && !/^\s{2}[^\s].*:\s*$/.test(lines[end] || '')) end += 1;
    return [...lines.slice(0, i), ...lines.slice(end)].join('\n');
  }
  return lines.join('\n');
}

function normalizeWebuiImageMcpServers(text = '') {
  let updated = text || '';
  updated = removeMcpServer(updated, 'webui-image');
  updated = removeMcpServer(updated, 'webui_image');
  return updated;
}

function upsertWebuiImageMcpServer(text = '', options = {}) {
  return upsertMcpServer(normalizeWebuiImageMcpServers(text), 'webui_image', webuiImageMcpServerBlock(options));
}

function minimalHermesConfig() {
  return [
    'providers: {}',
    'fallback_providers: []',
    'credential_pool_strategies: {}',
    'toolsets:',
    '- hermes-cli',
    'agent:',
    '  max_turns: 90',
  ].join('\n');
}

function ensureWebuiImageMcpConfig(existing = '', options = {}) {
  return sanitizeHermesConfigText(upsertWebuiImageMcpServer(sanitizeHermesConfigText(existing || minimalHermesConfig()), options));
}

function mergedHermesConfigText(providerName, selectedModel, existing = '', options = {}) {
  let updatedConfig = sanitizeHermesConfigText(existing || minimalHermesConfig());
  if (!NATIVE_HERMES_PROVIDERS.has(providerName)) {
    updatedConfig = upsertProvider(updatedConfig, providerName, selectedModel, options);
    updatedConfig = upsertCustomProvider(updatedConfig, providerName, selectedModel, options);
  }
  const lines = updatedConfig.replace(/\r\n/g, '\n').split('\n');
  const modelName = requestModelName(selectedModel);
  const modelSection = ['model:', '  provider: ' + providerName];
  if (modelName) modelSection.push('  default: ' + JSON.stringify(modelName));
  if (modelName && !NATIVE_HERMES_PROVIDERS.has(providerName)) modelSection.push('  api_mode: chat_completions');
  const withModel = replaceSection(lines, 'model', modelSection).join('\n');
  return sanitizeHermesConfigText(upsertWebuiImageMcpServer(withModel, options));
}

async function syncHermesProviderConfig(providerName, selectedModel) {
  if (!providerName || !selectedModel?.base) return;
  if (providerName !== WEBUI_RELAY_PROVIDER && !selectedModel?.key) return;
  try {
    await withHermesConfigWriteLock(() => {
      const file = hermesConfigFilePath();
      if (!file) return;
      const options = providerName === WEBUI_RELAY_PROVIDER
        ? { models: collectWebuiRelayModelNames(selectedModel) }
        : {};
      const relayDefault = providerName === WEBUI_RELAY_PROVIDER
        ? defaultWebuiRelayModel(selectedModel) || selectedModel
        : selectedModel;
      writeFileAtomic(file, mergedHermesConfigText(providerName, relayDefault, readHermesConfigFile(), options));
    });
  } catch (e) {
    logCritical('config-write', e, { providerName });
  }
}

async function syncWebuiRelayProviderConfig() {
  const selectedModel = defaultWebuiRelayModel();
  if (!selectedModel?.base) return false;
  await syncHermesProviderConfig(WEBUI_RELAY_PROVIDER, selectedModel);
  return true;
}

function detectHermesCommand() {
  const now = Date.now();
  if (cachedHermesCommandAt) {
    const ttl = cachedHermesCommand ? HERMES_COMMAND_CACHE_MS : HERMES_COMMAND_MISS_CACHE_MS;
    if (now - cachedHermesCommandAt < ttl) return cachedHermesCommand;
  }

  try {
    const nativeCheck = spawnSync('hermes', ['--version'], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
    });
    if (!nativeCheck.error && nativeCheck.status === 0) {
      const output = String(nativeCheck.stdout || nativeCheck.stderr || '').trim();
      const ver = output.match(/(\d+\.\d+\.\d+)/);
      let resolvedPath = '';
      try {
        const where = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['hermes'], { encoding: 'utf8', timeout: 1500, windowsHide: true });
        resolvedPath = String(where.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)[0] || '';
      } catch (_) {}
      cachedHermesCommand = { type: 'native', cmd: 'hermes', version: ver ? ver[1] : 'unknown', status: 0, path: resolvedPath, output: output.split(/\r?\n/)[0] || '' };
      cachedHermesCommandAt = now;
      lastGoodHermesCommand = cachedHermesCommand;
      lastGoodHermesCommandAt = now;
      return cachedHermesCommand;
    }
  } catch (e) {
    logCritical('detect-command', e);
  }

  cachedHermesCommand = null;
  cachedHermesCommandAt = now;
  if (lastGoodHermesCommand && now - lastGoodHermesCommandAt < HERMES_COMMAND_STALE_OK_MS) {
    return { ...lastGoodHermesCommand, stale: true };
  }
  return null;
}

function cleanAgentLine(line) {
  return String(line || '').replace(/\r$/, '').replace(ANSI_CONTROL_RE, '');
}

function compactLocalPath(value = '') {
  const text = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  if (!text) return '';
  const cwd = process.cwd().replace(/\\/g, '/').replace(/\/+$/, '');
  const normalized = text.replace(/\\/g, '/');
  if (normalized.toLowerCase().startsWith(cwd.toLowerCase() + '/')) {
    return normalized.slice(cwd.length + 1).replace(/\//g, '\\');
  }
  return text;
}

function parseTerminalAgentStep(line) {
  const clean = cleanAgentLine(line);
  const trimmed = clean.trim();
  if (!trimmed) return null;
  const text = trimmed.replace(TERMINAL_DECOR_RE, '').trim();
  if (!text) return null;

  let m;
  if ((m = text.match(/^plan\s+(\d+)\s+task\(s\)/i))) {
    return { type: 'agent_step', phase: 'plan', status: 'running', title: '制定计划', detail: `${m[1]} 个任务`, raw: trimmed };
  }
  if ((m = text.match(/^plan\s+(\d+)\/(\d+)\s+task\(s\)/i))) {
    return { type: 'agent_step', phase: 'plan', status: 'running', title: '推进计划', detail: `${m[1]}/${m[2]} 个任务`, raw: trimmed };
  }
  if ((m = text.match(/^preparing\s+([a-z_][\w-]*)\.{0,3}/i))) {
    const action = m[1].replace(/_/g, ' ');
    if (/^(todo|execute code|patch)$/i.test(action)) {
      const title = /todo/i.test(action) ? '准备任务计划' : (/patch/i.test(action) ? '准备应用修改' : '准备执行代码');
      return { type: 'agent_step', phase: /patch/i.test(action) ? 'patch' : 'exec', status: 'running', title, detail: '', raw: trimmed };
    }
    return null;
  }
  if ((m = text.match(/^exec\s+(.+?)(?:\s+\d+(?:\.\d+)?s)?$/i))) {
    const code = m[1].trim();
    if (/^import\s+/i.test(code)) return null;
    const openMatch = code.match(/open\((?:r)?["']([^"']+)["']/i);
    if (openMatch) {
      return { type: 'agent_step', phase: 'file', status: 'running', title: '读取文件', detail: compactLocalPath(openMatch[1]), raw: trimmed };
    }
    return { type: 'agent_step', phase: 'exec', status: 'running', title: '执行代码', detail: code.slice(0, 160), raw: trimmed };
  }
  if ((m = text.match(/^patch\s+(.+?)(?:\s+\d+(?:\.\d+)?s)?(?:\s+\[(.+)\])?$/i))) {
    const detail = compactLocalPath(m[1]);
    const failed = /failed|error|失败/i.test(m[2] || '');
    return { type: 'agent_step', phase: 'patch', status: failed ? 'error' : 'running', title: failed ? '应用修改失败' : '应用修改', detail, error: failed, raw: trimmed };
  }
  if ((m = text.match(/^Self-improvement review:\s*(.+)$/i))) {
    return { type: 'agent_step', phase: 'memory', status: 'done', title: '更新 Agent 记忆', detail: m[1].trim(), raw: trimmed };
  }
  if (/failed to read file/i.test(text)) {
    return { type: 'agent_step', phase: 'file', status: 'error', title: '读取文件失败', detail: text.slice(0, 200), error: true, raw: trimmed };
  }
  return null;
}

function parseAgentLine(line) {
  const clean = cleanAgentLine(line);
  const trimmed = clean.trim();
  if (!trimmed) return null;
  let m;
  const terminalStep = parseTerminalAgentStep(trimmed);
  if (terminalStep) return terminalStep;
  if ((m = trimmed.match(RESUMED_SESSION_RE))) return { type: 'session', sessionId: m[1] };
  if ((m = trimmed.match(SESSION_RE))) return { type: 'session', sessionId: m[1] };
  if ((m = trimmed.match(SESSION_ID_RE))) return { type: 'session', sessionId: m[1] };
  const toolNameFrom = d => String(d?.name || d?.tool || d?.tool_name || d?.toolName || d?.server || d?.id || '').trim();
  if ((m = trimmed.match(TOOL_START_RE))) {
    try {
      const d = JSON.parse(m[1]);
      return { type: 'tool', event_type: 'tool.started', name: toolNameFrom(d), preview: d.preview || '', args: d.args || d.input || d.params || {} };
    } catch {
      return { type: 'tool', event_type: 'tool.started', name: m[1].trim(), preview: '', args: {} };
    }
  }
  if ((m = trimmed.match(TOOL_END_RE))) {
    try {
      const d = JSON.parse(m[1]);
      const preview = d.preview || d.output || d.result || d.content || d.text || '';
      return { type: 'tool_complete', event_type: 'tool.completed', name: toolNameFrom(d), preview, is_error: !!d.is_error, duration: d.duration };
    } catch {
      return { type: 'tool_complete', event_type: 'tool.completed', name: m[1].trim(), preview: '', is_error: false };
    }
  }
  if ((m = trimmed.match(REASONING_RE))) return { type: 'reasoning', text: m[1] };
  if ((m = trimmed.match(THINKING_RE))) return { type: 'reasoning', text: m[1] };
  if ((m = trimmed.match(ERROR_RE))) return { type: 'error', text: m[1] };
  if ((m = trimmed.match(TITLE_RE))) return { type: 'title', title: m[1] };
  if (trimmed.match(AGENT_TAG_RE)) return null;
  return { type: 'token', text: clean + '\n' };
}

async function* hermesStream(prompt, history, modelCfg, fullCfg = {}) {
  const perfStart = Date.now();
  const runId = String(fullCfg._runId || ('run_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex')));
  const mirror = (type, text = '', extra = {}) => {
    const line = String(text || '').replace(/\s+/g, ' ').trim();
    const preview = line.length > 800 ? line.slice(0, 800) + '?' : line;
    if (preview || type === 'exit') console.log('[AgentRun ' + runId + '] ' + type.toUpperCase() + (preview ? ' ' + preview : ''), extra && Object.keys(extra).length ? extra : '');
  };
  yield { type: 'perf', stage: 'run-start', runId, ms: 0 };
  mirror('start', 'Hermes stream started');
  const hermesCmd = detectHermesCommand();
  yield { type: 'perf', stage: 'detect-hermes-command', runId, ms: Date.now() - perfStart, command: hermesCmd?.type || 'missing' };
  if (!hermesCmd) {
    yield {
      type: 'error',
      text: 'Hermes Agent CLI not found. Install native Hermes on Windows and ensure hermes is on PATH.',
    };
    return;
  }

  const resumeSessionId = String(fullCfg._resumeSessionId || '').trim();
  const contextLines = [];
  if (!resumeSessionId) {
    for (const m of (history || []).slice(0, -1)) {
      const content = compactHistoryContent(m.content || '');
      if (!content) continue;
      if (m.role === 'system') contextLines.push(`[system]\n${content}`);
      else if (m.role === 'user') contextLines.push(`[user]\n${content}`);
      else if (m.role === 'assistant') contextLines.push(`[assistant]\n${content}`);
    }
  }

  let fullPrompt = String(prompt || '');
  if (contextLines.length > 0) {
    fullPrompt = `[对话历史]\n${contextLines.join('\n---\n')}\n\n[当前问题]\n${fullPrompt}`;
  }
  yield { type: 'perf', stage: 'prompt-built', runId, ms: Date.now() - perfStart, chars: fullPrompt.length, contextMessages: contextLines.length, resumed: !!resumeSessionId };

  const modelName = modelCfg?.model ? String(modelCfg.model) : '';
  const selectedModel = fullCfg._selectedLibraryModel || null;
  const providerName = selectedModel
    ? hermesProviderName(selectedModel, fullCfg._activeProvider)
    : providerArg(fullCfg._activeProvider || '');
  await syncHermesProviderConfig(providerName, selectedModel);
  yield { type: 'perf', stage: 'provider-config-ready', runId, ms: Date.now() - perfStart, provider: providerName || '', model: modelName || '', selected: !!selectedModel, apiFormat: selectedModel?.apiFormat || '', hasKey: !!selectedModel?.key, hasBase: !!selectedModel?.base };
  let child;
  let tmpFile = null;

  // Inject environment variables from WebUI config
  const customEnv = { ...process.env, PYTHONUNBUFFERED: '1' };
  if (selectedModel?.key) {
    if (providerName === 'deepseek') {
      customEnv.DEEPSEEK_API_KEY = selectedModel.key;
      delete customEnv.OPENAI_API_KEY;
      delete customEnv.ANTHROPIC_API_KEY;
    } else if (providerName === 'anthropic' || hermesApiMode(selectedModel) === 'anthropic_messages') {
      customEnv.ANTHROPIC_API_KEY = selectedModel.key;
      customEnv.ANTHROPIC_TOKEN = selectedModel.key;
      delete customEnv.OPENAI_API_KEY;
      delete customEnv.DEEPSEEK_API_KEY;
    } else {
      customEnv.OPENAI_API_KEY = selectedModel.key;
      delete customEnv.ANTHROPIC_API_KEY;
      delete customEnv.ANTHROPIC_TOKEN;
      delete customEnv.DEEPSEEK_API_KEY;
    }
  }
  if (selectedModel?.base) {
    const selectedBaseUrl = hermesBaseUrl(selectedModel);
    if (providerName === 'deepseek') {
      customEnv.DEEPSEEK_BASE_URL = selectedBaseUrl;
      delete customEnv.OPENAI_BASE_URL;
      delete customEnv.ANTHROPIC_BASE_URL;
    } else if (providerName === 'anthropic' || hermesApiMode(selectedModel) === 'anthropic_messages') {
      customEnv.ANTHROPIC_BASE_URL = selectedBaseUrl;
      customEnv.ANTHROPIC_API_BASE = selectedBaseUrl;
      delete customEnv.OPENAI_BASE_URL;
      delete customEnv.DEEPSEEK_BASE_URL;
    } else {
      customEnv.OPENAI_BASE_URL = selectedBaseUrl;
      delete customEnv.ANTHROPIC_BASE_URL;
      delete customEnv.ANTHROPIC_API_BASE;
      delete customEnv.DEEPSEEK_BASE_URL;
    }
  }
  if (!selectedModel) {
    if (fullCfg.anthropic?.key) {
      customEnv.ANTHROPIC_API_KEY = fullCfg.anthropic.key;
      customEnv.ANTHROPIC_TOKEN = fullCfg.anthropic.key;
    }
    if (fullCfg.openai?.key) customEnv.OPENAI_API_KEY = fullCfg.openai.key;
    if (fullCfg.openai?.base) customEnv.OPENAI_BASE_URL = fullCfg.openai.base;
    if (fullCfg.deepseek?.key) customEnv.DEEPSEEK_API_KEY = fullCfg.deepseek.key;
    if (fullCfg.deepseek?.base) customEnv.DEEPSEEK_BASE_URL = fullCfg.deepseek.base;
  }

  const runHermesAttempt = async function* (resumeId = '') {
    if (fullPrompt.length > 8000) {
      const tmpDir = path.join(process.cwd(), '.claude');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      tmpFile = path.join(tmpDir, 'prompt_' + crypto.randomBytes(8).toString('hex') + '.txt');
      writeFileAtomic(tmpFile, fullPrompt);
    }

    const args = ['chat', '-q', tmpFile ? fs.readFileSync(tmpFile, 'utf8') : fullPrompt, '-Q'];
    args.push('--toolsets', 'hermes-cli,webui_image', '--accept-hooks', '--yolo');
    if (providerName) args.push('--provider', providerName);
    if (modelName) args.push('-m', modelName);
    if (resumeId) args.push('--resume', resumeId);

    let idleTimer = null;
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const err = new Error('Hermes idle timeout');
        logCritical('idle-timeout', err, { runId, idleMs: HERMES_IDLE_TIMEOUT_MS });
        try { if (child && !child.killed) child.kill('SIGTERM'); } catch (e) { logCritical('idle-kill', e, { runId }); }
      }, HERMES_IDLE_TIMEOUT_MS);
      idleTimer.unref?.();
    };

    child = registerHermesChild(spawn(hermesCmd.cmd || 'hermes', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: HERMES_CLI_TIMEOUT_MS,
      windowsHide: true,
      env: customEnv,
    }), { command: 'native', resumed: !!resumeId, promptFile: !!tmpFile, timeoutMs: HERMES_CLI_TIMEOUT_MS, idleTimeoutMs: HERMES_IDLE_TIMEOUT_MS });
    child.once('error', e => logCritical('child-error', e, { runId }));
    const closePromise = new Promise(resolve => child.once('close', resolve));
    armIdleTimer();
    yield { type: 'perf', stage: 'cli-spawned', runId, ms: Date.now() - perfStart, command: 'native', promptFile: !!tmpFile, resumed: !!resumeId, timeoutMs: HERMES_CLI_TIMEOUT_MS, idleTimeoutMs: HERMES_IDLE_TIMEOUT_MS };
    mirror('spawn', 'native' + (resumeId ? ' resume=' + resumeId : ''));

    let stdoutBuffer = '';
    let stderr = '';
    let firstStdout = false;
    let meaningfulStdout = false;
    let stderrBuffer = '';
    const stderrEvents = [];
    const yieldQueue = [];
    const queueStderrLine = line => {
      const cleanLine = cleanAgentLine(line);
      if (cleanLine.trim()) yieldQueue.push({ type: 'raw_stderr', stream: 'stderr', runId, text: cleanLine.trim().slice(0, 4000), ts: Date.now() });
      const event = parseAgentLine(line);
      if (event && (event.type === 'session' || event.type === 'agent_step')) stderrEvents.push(event);
    };
    child.stderr.on('data', chunk => {
      armIdleTimer();
      const text = chunk.toString('utf8');
      stderr += text;
      mirror('stderr', text);
      stderrBuffer += text;
      let idx;
      while ((idx = stderrBuffer.indexOf('\n')) >= 0) {
        const line = stderrBuffer.slice(0, idx);
        stderrBuffer = stderrBuffer.slice(idx + 1);
        queueStderrLine(line);
      }
    });

    for await (const chunk of child.stdout) {
      armIdleTimer();
      while (stderrEvents.length) yield stderrEvents.shift();
      while (yieldQueue.length) yield yieldQueue.shift();
      if (!firstStdout) {
        firstStdout = true;
        yield { type: 'perf', stage: 'first-cli-stdout', runId, ms: Date.now() - perfStart, bytes: chunk.length || 0, resumed: !!resumeId };
      }
      const stdoutText = chunk.toString('utf8');
      mirror('stdout', stdoutText);
      stdoutBuffer += stdoutText;
      let idx;
      while ((idx = stdoutBuffer.indexOf('\n')) >= 0) {
        const line = stdoutBuffer.slice(0, idx);
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        const cleanLine = line.replace(/\r$/, '');
        if (cleanLine.trim()) yield { type: 'raw_line', stream: 'stdout', runId, text: cleanLine.slice(0, 4000), ts: Date.now() };
        const event = parseAgentLine(line);
        if (event && !['session', 'agent_step'].includes(event.type)) meaningfulStdout = true;
        if (event) yield event;
      }
    }

    if (stdoutBuffer.trim()) {
      yield { type: 'raw_line', stream: 'stdout', runId, text: stdoutBuffer.trim().slice(0, 4000), ts: Date.now() };
      const event = parseAgentLine(stdoutBuffer);
      if (event && !['session', 'agent_step'].includes(event.type)) meaningfulStdout = true;
      if (event) yield event;
    }
    const exitCode = await closePromise;
    if (idleTimer) clearTimeout(idleTimer);
    if (stderrBuffer.trim()) {
      queueStderrLine(stderrBuffer);
      stderrBuffer = '';
    }
    while (stderrEvents.length) yield stderrEvents.shift();
    while (yieldQueue.length) yield yieldQueue.shift();
    mirror('exit', 'code=' + exitCode, { meaningfulStdout, stderr: !!stderr.trim() });
    yield { type: 'agent_exit', runId, code: exitCode, meaningfulStdout, stderrTail: stderr.trim().slice(-1000), ms: Date.now() - perfStart };
    if (resumeId && !meaningfulStdout) {
      yield { type: 'perf', stage: 'resume-empty-retry', runId, ms: Date.now() - perfStart, sessionId: resumeId, exitCode, reason: firstStdout ? 'session-only' : 'empty' };
      yield* runHermesAttempt('');
      return;
    }
    if (!meaningfulStdout) {
      const detail = stderr.trim() ? (': ' + stderr.trim().slice(0, 500)) : '';
      yield { type: 'error', text: 'Hermes Agent ended without output' + detail };
      return;
    }
    if (exitCode && stderr.trim()) {
      yield { type: 'error', text: stderr.trim().slice(0, 500) };
    }
  };

  try {
    yield* runHermesAttempt(resumeSessionId);
  } catch (e) {
    logCritical('stream-error', e, { runId });
    if (e.killed || e.signal === 'SIGTERM') {
      yield { type: 'error', text: 'Hermes 请求超时或被中断' };
      return;
    }
    yield { type: 'error', text: e.message || 'Hermes 调用失败' };
  } finally {
    cleanupTempFile(tmpFile, 'prompt');
  }
}

module.exports = {
  hermesStream,
  parseAgentLine,
  detectHermesCommand,
  stopActiveHermesChildren,
  activeHermesChildStats,
  syncWebuiRelayProviderConfig,
};
