/**
 * Hermes CLI bridge.
 * 优先直接连接本机/WSL 中的 Hermes CLI，避免依赖额外的 8642 gateway 进程。
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOOL_START_RE = /^\[TOOL:START\]\s*(.*)/;
const TOOL_END_RE = /^\[TOOL:END\]\s*(.*)/;
const REASONING_RE = /^\[REASONING\]\s*(.*)/;
const THINKING_RE = /^\[THINKING\]\s*(.*)/;
const ERROR_RE = /^\[ERROR\]\s*(.*)/;
const TITLE_RE = /^\[TITLE\]\s*(.*)/;
const AGENT_TAG_RE = /^\[AGENT:\w+\]\s*/;
const SESSION_RE = /^Session:\s*([A-Za-z0-9_-]+)/;
const SESSION_ID_RE = /^session_id:\s*([A-Za-z0-9_-]+)/i;
const RESUMED_SESSION_RE = /^↻\s*Resumed session\s+([A-Za-z0-9_-]+)\s*\((\d+)\s+user message[s]?,\s*(\d+)\s+total message[s]?\)/i;
let cachedHermesCommand = null;
let cachedHermesCommandAt = 0;
let lastGoodHermesCommand = null;
let lastGoodHermesCommandAt = 0;
const HERMES_COMMAND_CACHE_MS = 5 * 60 * 1000;
const HERMES_COMMAND_MISS_CACHE_MS = 10 * 1000;
const HERMES_COMMAND_STALE_OK_MS = 30 * 60 * 1000;
const MAX_CONTEXT_MESSAGE_CHARS = 6000;

function compactHistoryContent(content = '') {
  const text = String(content || '')
    .replace(/<artifact\s+[^>]+>[\s\S]*?<\/artifact>/gi, '[已生成 Artifact 文档]')
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .trim();
  if (text.length <= MAX_CONTEXT_MESSAGE_CHARS) return text;
  return text.slice(0, 2400) + '\n…\n' + text.slice(-2400);
}

function shQuote(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function providerArg(provider = '') {
  const p = String(provider || '').trim().toLowerCase();
  if (!p) return '';
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
  if (apiMode === 'anthropic_messages' || base.includes('api.anthropic.com')) return 'anthropic';
  if (base.includes('api.deepseek.com')) return 'deepseek';
  if (base.includes('openrouter.ai')) return 'openrouter';
  if (base.includes('api.openai.com')) return 'openai';
  if (base.includes('dashscope.aliyuncs.com') || base.includes('dashscope-intl.aliyuncs.com')) return 'qwen';
  if (base.includes('api.moonshot') || base.includes('kimi.moonshot')) return 'moonshot';
  if (base.includes('api.groq.com')) return 'groq';
  if (base.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (base.includes('api.x.ai')) return 'xai';

  const active = providerArg(activeProvider || '');
  if (NATIVE_HERMES_PROVIDERS.has(active)) return active;
  const selectedProvider = providerArg(selectedModel?.provider || '');
  if (NATIVE_HERMES_PROVIDERS.has(selectedProvider)) return selectedProvider;
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

function readHermesConfigFile() {
  const dir = path.join(process.env.USERPROFILE || process.env.HOME || '', '.hermes');
  if (!dir) return '';
  const file = path.join(dir, 'config.yaml');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function readWslHermesConfigFile() {
  try {
    const result = spawnSync('wsl', ['-e', 'bash', '-lc', 'cat ~/.hermes/config.yaml 2>/dev/null'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    });
    if (result.status === 0 && result.stdout) return result.stdout;
  } catch (_) {
    // Ignore: callers fall back to the local config or a minimal config.
  }
  return '';
}

function sectionBounds(lines, sectionName) {
  const start = lines.findIndex(line => new RegExp('^' + sectionName + ':\\s*$').test(String(line).trim()));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z_][A-Za-z0-9_-]*:\s*(?:#.*)?$/.test(lines[i]) && !/^\s/.test(lines[i])) {
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

function upsertCustomProvider(text, providerName, selectedModel) {
  const base = hermesBaseUrl(selectedModel);
  const apiMode = hermesApiMode(selectedModel);
  const modelName = String(selectedModel?.name || selectedModel?.model || '').trim();
  const providerBlock = [
    '- name: ' + providerName,
    '  base_url: ' + base,
    '  api_key: ' + selectedModel.key,
    '  api_mode: ' + apiMode,
    ...(modelName ? ['  model: ' + JSON.stringify(modelName)] : []),
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

function minimalHermesConfig() {
  return [
    'providers: {}',
    'fallback_providers: []',
    'credential_pool_strategies: {}',
    'toolsets: []',
    'agent:',
    '  max_turns: 90',
  ].join('\n');
}

function mergedHermesConfigText(providerName, selectedModel, existing = '') {
  let updatedConfig = existing || minimalHermesConfig();
  if (!NATIVE_HERMES_PROVIDERS.has(providerName)) {
    updatedConfig = upsertCustomProvider(updatedConfig, providerName, selectedModel);
  }
  const lines = updatedConfig.replace(/\r\n/g, '\n').split('\n');
  const modelName = String(selectedModel?.name || selectedModel?.model || '').trim();
  const modelSection = ['model:', '  provider: ' + providerName];
  if (modelName) modelSection.push('  default: ' + JSON.stringify(modelName));
  return replaceSection(lines, 'model', modelSection).join('\n');
}

function syncHermesProviderConfig(providerName, selectedModel) {
  if (!providerName || !selectedModel?.base || !selectedModel?.key) return;
  if (!NATIVE_HERMES_PROVIDERS.has(providerName)) return;
  try {
    const dir = path.join(process.env.USERPROFILE || process.env.HOME || '', '.hermes');
    if (!dir) return;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'config.yaml');
    fs.writeFileSync(file, mergedHermesConfigText(providerName, selectedModel, readHermesConfigFile()), 'utf8');
  } catch (_) {
    // Best effort only; env vars still carry the selected model for the running process.
  }
}

function wslPathForWindowsFile(filePath) {
  const resolved = path.resolve(filePath).replace(/\\/g, '/');
  const drive = resolved.match(/^([A-Za-z]):\/(.*)$/);
  if (!drive) return resolved;
  return '/mnt/' + drive[1].toLowerCase() + '/' + drive[2];
}

function syncWslHermesProviderConfig(providerName, selectedModel) {
  if (!providerName || !selectedModel?.base || !selectedModel?.key) return '';
  if (!NATIVE_HERMES_PROVIDERS.has(providerName)) return '';
  const tmpDir = path.join(process.cwd(), '.claude');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpName = 'hermes_config_' + crypto.randomBytes(4).toString('hex') + '.yaml';
  const tmpFile = path.join(tmpDir, tmpName);
  const existingConfig = readWslHermesConfigFile() || readHermesConfigFile();
  fs.writeFileSync(tmpFile, mergedHermesConfigText(providerName, selectedModel, existingConfig), 'utf8');
  return tmpFile;
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
      timeout: 2000,
      windowsHide: true,
      shell: true,
    });
    if (!nativeCheck.error && nativeCheck.status === 0) {
      cachedHermesCommand = { type: 'native', cmd: 'hermes' };
      cachedHermesCommandAt = now;
      lastGoodHermesCommand = cachedHermesCommand;
      lastGoodHermesCommandAt = now;
      return cachedHermesCommand;
    }
  } catch (_) {}

  try {
    const wslCheck = spawnSync('wsl', ['-e', 'bash', '-lc', 'export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH"; command -v hermes >/dev/null 2>&1'], {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true,
    });
    if (wslCheck.status === 0) {
      cachedHermesCommand = { type: 'wsl', cmd: 'wsl' };
      cachedHermesCommandAt = now;
      lastGoodHermesCommand = cachedHermesCommand;
      lastGoodHermesCommandAt = now;
      return cachedHermesCommand;
    }
  } catch (_) {}

  cachedHermesCommand = null;
  cachedHermesCommandAt = now;
  if (lastGoodHermesCommand && now - lastGoodHermesCommandAt < HERMES_COMMAND_STALE_OK_MS) {
    return { ...lastGoodHermesCommand, stale: true };
  }
  return null;
}

function parseAgentLine(line) {
  const trimmed = String(line || '').replace(/\r$/, '');
  if (!trimmed) return null;
  let m;
  if ((m = trimmed.match(RESUMED_SESSION_RE))) return { type: 'session', sessionId: m[1] };
  if ((m = trimmed.match(SESSION_RE))) return { type: 'session', sessionId: m[1] };
  if ((m = trimmed.match(SESSION_ID_RE))) return { type: 'session', sessionId: m[1] };
  if ((m = trimmed.match(TOOL_START_RE))) {
    try {
      const d = JSON.parse(m[1]);
      return { type: 'tool', event_type: 'tool.started', name: d.name || '', preview: d.preview || '', args: d.args || {} };
    } catch {
      return { type: 'tool', event_type: 'tool.started', name: m[1].trim(), preview: '', args: {} };
    }
  }
  if ((m = trimmed.match(TOOL_END_RE))) {
    try {
      const d = JSON.parse(m[1]);
      return { type: 'tool_complete', event_type: 'tool.completed', name: d.name || '', preview: d.preview || '', is_error: !!d.is_error, duration: d.duration };
    } catch {
      return { type: 'tool_complete', event_type: 'tool.completed', name: m[1].trim(), preview: '', is_error: false };
    }
  }
  if ((m = trimmed.match(REASONING_RE))) return { type: 'reasoning', text: m[1] };
  if ((m = trimmed.match(THINKING_RE))) return { type: 'reasoning', text: m[1] };
  if ((m = trimmed.match(ERROR_RE))) return { type: 'error', text: m[1] };
  if ((m = trimmed.match(TITLE_RE))) return { type: 'title', title: m[1] };
  if (trimmed.match(AGENT_TAG_RE)) return null;
  return { type: 'token', text: trimmed + '\n' };
}

async function* hermesStream(prompt, history, modelCfg, fullCfg = {}) {
  const perfStart = Date.now();
  const hermesCmd = detectHermesCommand();
  yield { type: 'perf', stage: 'detect-hermes-command', ms: Date.now() - perfStart, command: hermesCmd?.type || 'missing' };
  if (!hermesCmd) {
    yield {
      type: 'error',
      text: 'Hermes Agent CLI 未找到。请先在 WSL 或本机安装 hermes，并确保命令可用。',
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
  yield { type: 'perf', stage: 'prompt-built', ms: Date.now() - perfStart, chars: fullPrompt.length, contextMessages: contextLines.length, resumed: !!resumeSessionId };

  const modelName = modelCfg?.model ? String(modelCfg.model) : '';
  const selectedModel = fullCfg._selectedLibraryModel || null;
  const providerName = selectedModel
    ? hermesProviderName(selectedModel, fullCfg._activeProvider)
    : providerArg(fullCfg._activeProvider || '');
  syncHermesProviderConfig(providerName, selectedModel);
  yield { type: 'perf', stage: 'provider-config-ready', ms: Date.now() - perfStart, provider: providerName || '', model: modelName || '', selected: !!selectedModel };
  let child;
  let tmpFile = null;
  let wslConfigFile = null;

  // Inject environment variables from WebUI config
  const customEnv = { ...process.env, PYTHONUNBUFFERED: '1' };
  if (selectedModel?.key) {
    if (providerName === 'deepseek') {
      customEnv.DEEPSEEK_API_KEY = selectedModel.key;
      delete customEnv.OPENAI_API_KEY;
      delete customEnv.ANTHROPIC_API_KEY;
    } else if (providerName === 'anthropic' || hermesApiMode(selectedModel) === 'anthropic_messages') {
      customEnv.ANTHROPIC_API_KEY = selectedModel.key;
      delete customEnv.OPENAI_API_KEY;
      delete customEnv.DEEPSEEK_API_KEY;
    } else {
      customEnv.OPENAI_API_KEY = selectedModel.key;
      delete customEnv.ANTHROPIC_API_KEY;
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
      delete customEnv.OPENAI_BASE_URL;
      delete customEnv.DEEPSEEK_BASE_URL;
    } else {
      customEnv.OPENAI_BASE_URL = selectedBaseUrl;
      delete customEnv.ANTHROPIC_BASE_URL;
      delete customEnv.DEEPSEEK_BASE_URL;
    }
  }
  if (!selectedModel) {
    if (fullCfg.anthropic?.key) customEnv.ANTHROPIC_API_KEY = fullCfg.anthropic.key;
    if (fullCfg.openai?.key) customEnv.OPENAI_API_KEY = fullCfg.openai.key;
    if (fullCfg.openai?.base) customEnv.OPENAI_BASE_URL = fullCfg.openai.base;
    if (fullCfg.deepseek?.key) customEnv.DEEPSEEK_API_KEY = fullCfg.deepseek.key;
    if (fullCfg.deepseek?.base) customEnv.DEEPSEEK_BASE_URL = fullCfg.deepseek.base;
  }

  try {
    if (hermesCmd.type === 'wsl' || fullPrompt.length > 8000) {
      const tmpDir = path.join(process.cwd(), '.claude');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpName = 'prompt_' + crypto.randomBytes(4).toString('hex') + '.txt';
      tmpFile = path.join(tmpDir, tmpName);
      fs.writeFileSync(tmpFile, fullPrompt, 'utf8');
    }

    if (hermesCmd.type === 'wsl') {
      wslConfigFile = syncWslHermesProviderConfig(providerName, selectedModel);
      let cmd;
      const syncConfigCmd = wslConfigFile
        ? `export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH"; mkdir -p ~/.hermes && cp ${shQuote(wslPathForWindowsFile(wslConfigFile))} ~/.hermes/config.yaml && `
        : 'export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH"; ';
      if (tmpFile) {
        const posixPath = '.claude/' + path.basename(tmpFile);
        cmd = `${syncConfigCmd}hermes chat -q "$(< ${posixPath})" -Q`;
      } else {
        cmd = `${syncConfigCmd}hermes chat -q ${shQuote(fullPrompt)} -Q`;
      }
      if (providerName) cmd += ` --provider ${shQuote(providerName)}`;
      if (modelName) cmd += ` -m ${shQuote(modelName)}`;
      if (resumeSessionId) cmd += ` --resume ${shQuote(resumeSessionId)}`;
      child = spawn('wsl', ['-e', 'bash', '-lc', cmd], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180000,
        windowsHide: true,
        env: customEnv,
      });
      yield { type: 'perf', stage: 'cli-spawned', ms: Date.now() - perfStart, command: 'wsl', promptFile: !!tmpFile };
    } else {
      const args = ['chat', '-q', fullPrompt, '-Q'];
      if (providerName) args.push('--provider', providerName);
      if (modelName) args.push('-m', modelName);
      if (resumeSessionId) args.push('--resume', resumeSessionId);
      child = spawn('hermes', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180000,
        windowsHide: true,
        env: customEnv,
        shell: true,
      });
      yield { type: 'perf', stage: 'cli-spawned', ms: Date.now() - perfStart, command: 'native', promptFile: !!tmpFile };
    }

    let stdoutBuffer = '';
    let stderr = '';
    let firstStdout = false;
    let stderrBuffer = '';
    const stderrEvents = [];
    child.stderr.on('data', chunk => {
      const text = chunk.toString('utf8');
      stderr += text;
      stderrBuffer += text;
      let idx;
      while ((idx = stderrBuffer.indexOf('\n')) >= 0) {
        const line = stderrBuffer.slice(0, idx);
        stderrBuffer = stderrBuffer.slice(idx + 1);
        const event = parseAgentLine(line);
        if (event && event.type === 'session') stderrEvents.push(event);
      }
    });

    for await (const chunk of child.stdout) {
      while (stderrEvents.length) yield stderrEvents.shift();
      if (!firstStdout) {
        firstStdout = true;
        yield { type: 'perf', stage: 'first-cli-stdout', ms: Date.now() - perfStart, bytes: chunk.length || 0 };
      }
      stdoutBuffer += chunk.toString('utf8');
      let idx;
      while ((idx = stdoutBuffer.indexOf('\n')) >= 0) {
        const line = stdoutBuffer.slice(0, idx);
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        const event = parseAgentLine(line);
        if (event) yield event;
      }
    }

    if (stdoutBuffer.trim()) {
      const event = parseAgentLine(stdoutBuffer);
      if (event) yield event;
    }
    while (stderrEvents.length) yield stderrEvents.shift();

    const exitCode = await new Promise(resolve => child.on('close', resolve));
    if (exitCode && stderr.trim()) {
      yield { type: 'error', text: stderr.trim().slice(0, 500) };
    }
  } catch (e) {
    if (e.killed || e.signal === 'SIGTERM') {
      yield { type: 'error', text: 'Hermes 请求超时或被中断' };
      return;
    }
    yield { type: 'error', text: e.message || 'Hermes 调用失败' };
  } finally {
    if (tmpFile && fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
    if (wslConfigFile && fs.existsSync(wslConfigFile)) {
      try { fs.unlinkSync(wslConfigFile); } catch (_) {}
    }
  }
}

module.exports = { hermesStream, parseAgentLine, detectHermesCommand };
