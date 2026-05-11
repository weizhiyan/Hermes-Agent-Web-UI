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
let cachedHermesCommand = null;
let cachedHermesCommandAt = 0;

function shQuote(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function detectHermesCommand() {
  const now = Date.now();
  if (cachedHermesCommandAt && now - cachedHermesCommandAt < 60000) return cachedHermesCommand;
  try {
    const wslCheck = spawnSync('wsl', ['-e', 'bash', '-lc', 'command -v hermes >/dev/null 2>&1'], {
      encoding: 'utf8',
      timeout: 4000,
      windowsHide: true,
    });
    if (wslCheck.status === 0) {
      cachedHermesCommand = { type: 'wsl', cmd: 'wsl' };
      cachedHermesCommandAt = now;
      return cachedHermesCommand;
    }
  } catch (_) {}

  try {
    const nativeCheck = spawnSync('hermes', ['--version'], {
      encoding: 'utf8',
      timeout: 4000,
      windowsHide: true,
      shell: true,
    });
    if (!nativeCheck.error && nativeCheck.status === 0) {
      cachedHermesCommand = { type: 'native', cmd: 'hermes' };
      cachedHermesCommandAt = now;
      return cachedHermesCommand;
    }
  } catch (_) {}

  cachedHermesCommand = null;
  cachedHermesCommandAt = now;
  return null;
}

function parseAgentLine(line) {
  const trimmed = String(line || '').replace(/\r$/, '');
  if (!trimmed) return null;
  let m;
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
  const hermesCmd = detectHermesCommand();
  if (!hermesCmd) {
    yield {
      type: 'error',
      text: 'Hermes Agent CLI 未找到。请先在 WSL 或本机安装 hermes，并确保命令可用。',
    };
    return;
  }

  const contextLines = [];
  for (const m of (history || []).slice(0, -1)) {
    if (m.role === 'system') contextLines.push(`[system]\n${m.content || ''}`);
    else if (m.role === 'user') contextLines.push(`[user]\n${m.content || ''}`);
    else if (m.role === 'assistant') contextLines.push(`[assistant]\n${m.content || ''}`);
  }

  let fullPrompt = String(prompt || '');
  if (contextLines.length > 0) {
    fullPrompt = `[对话历史]\n${contextLines.join('\n---\n')}\n\n[当前问题]\n${fullPrompt}`;
  }

  const modelName = modelCfg?.model ? String(modelCfg.model) : '';
  let child;
  let tmpFile = null;

  // Inject environment variables from WebUI config
  const customEnv = { ...process.env, PYTHONUNBUFFERED: '1' };
  if (fullCfg.anthropic?.key) customEnv.ANTHROPIC_API_KEY = fullCfg.anthropic.key;
  if (fullCfg.openai?.key) customEnv.OPENAI_API_KEY = fullCfg.openai.key;
  if (fullCfg.openai?.base) customEnv.OPENAI_BASE_URL = fullCfg.openai.base;
  if (fullCfg.deepseek?.key) customEnv.DEEPSEEK_API_KEY = fullCfg.deepseek.key;
  if (fullCfg.deepseek?.base) customEnv.DEEPSEEK_BASE_URL = fullCfg.deepseek.base;

  try {
    if (fullPrompt.length > 8000) {
      const tmpDir = path.join(process.cwd(), '.claude');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpName = 'prompt_' + crypto.randomBytes(4).toString('hex') + '.txt';
      tmpFile = path.join(tmpDir, tmpName);
      fs.writeFileSync(tmpFile, fullPrompt, 'utf8');
    }

    if (hermesCmd.type === 'wsl') {
      let cmd;
      if (tmpFile) {
        const posixPath = '.claude/' + path.basename(tmpFile);
        cmd = `hermes chat -q "$(< ${posixPath})" -Q`;
      } else {
        cmd = `hermes chat -q ${shQuote(fullPrompt)} -Q`;
      }
      if (modelName) cmd += ` -m ${shQuote(modelName)}`;
      child = spawn('wsl', ['-e', 'bash', '-lc', cmd], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180000,
        windowsHide: true,
        env: customEnv,
      });
    } else {
      const args = ['chat', '-q', fullPrompt, '-Q'];
      if (modelName) args.push('-m', modelName);
      child = spawn('hermes', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180000,
        windowsHide: true,
        env: customEnv,
        shell: true,
      });
    }

    let stdoutBuffer = '';
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });

    for await (const chunk of child.stdout) {
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
  }
}

module.exports = { hermesStream, parseAgentLine, detectHermesCommand };
