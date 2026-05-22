const Lark = require('@larksuiteoapi/node-sdk');
const store = require('./store');
const { spawnSync } = require('child_process');
const iconv = require('iconv-lite');

let channel = null;
let currentKey = '';
let status = { connected: false, mode: 'websocket', msg: '\u672a\u542f\u52a8', updatedAt: 0 };
const handled = new Map();
const chatHistories = new Map();
const DEDUPE_TTL_MS = 10 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 20;

function fixMojibake(text = '') {
  const raw = String(text || '');
  if (!/[\u00c0-\u00ff\u4e00-\u9fa5]/.test(raw)) return raw;
  try {
    const fixed = iconv.encode(raw, 'gbk').toString('utf8');
    const rawBad = (raw.match(/[?????]/g) || []).length;
    const fixedBad = (fixed.match(/[?????]/g) || []).length;
    return fixed && fixedBad < rawBad ? fixed : raw;
  } catch (_) {
    return raw;
  }
}

function mark(id = '') {
  const key = String(id || '').trim();
  if (!key) return true;
  const now = Date.now();
  for (const [oldKey, ts] of handled) {
    if (now - ts > DEDUPE_TTL_MS) handled.delete(oldKey);
  }
  if (handled.has(key)) return false;
  handled.set(key, now);
  return true;
}

function getFeishuPlatform() {
  const data = store.read('gateway', null);
  const platforms = Array.isArray(data?.platforms) ? data.platforms : [];
  return platforms.find(p => p.id === 'feishu') || null;
}

function updateGatewayPlatform(patch) {
  const data = store.read('gateway', null);
  if (!data || !Array.isArray(data.platforms)) return;
  const item = data.platforms.find(p => p.id === 'feishu');
  if (!item) return;
  Object.assign(item, patch, { checkedAt: Date.now() });
  store.write('gateway', data);
}

function pushHistory(chatId, role, content) {
  const id = String(chatId || 'default');
  const list = chatHistories.get(id) || [];
  list.push({ role, content: String(content || '') });
  chatHistories.set(id, list.slice(-MAX_HISTORY_MESSAGES));
  return chatHistories.get(id);
}

function shQuote(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function runHermesOneshot(prompt) {
  const args = ['-z', String(prompt || ''), '--accept-hooks'];
  const native = spawnSync('hermes', args, {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
    shell: true,
  });
  if (!native.error && native.status === 0 && String(native.stdout || '').trim()) return String(native.stdout || '').trim();

  const command = `export PATH=\"$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH\"; hermes -z ${shQuote(prompt)} --accept-hooks`;
  const wsl = spawnSync('wsl', ['-e', 'bash', '-lc', command], {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (wsl.error) throw new Error('Hermes Agent CLI \u8c03\u7528\u5931\u8d25\uff1a' + wsl.error.message);
  if (wsl.status !== 0) throw new Error('Hermes Agent CLI \u8fd4\u56de\u9519\u8bef\uff1a' + (wsl.stderr || wsl.stdout || '').slice(0, 500));
  const text = String(wsl.stdout || '').trim();
  if (!text) throw new Error('Hermes Agent \u6ca1\u6709\u8fd4\u56de\u5185\u5bb9');
  return text;
}

function cleanAgentReply(text = '') {
  return String(text || '')
    .replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}

async function runAgent(chatId, userText) {
  const history = pushHistory(chatId, 'user', userText);
  const context = history.slice(0, -1).map(m => `${m.role === 'user' ? '\u7528\u6237' : 'Agent'}: ${m.content}`).join('\n');
  const prompt = context ? `\u4ee5\u4e0b\u662f\u98de\u4e66\u8fdc\u7a0b\u5bf9\u8bdd\u4e0a\u4e0b\u6587\uff0c\u8bf7\u4ee5 Hermes Agent \u7684\u65b9\u5f0f\u56de\u7b54\u3002\n\n${context}\n\n\u7528\u6237: ${userText}` : userText;
  const answer = cleanAgentReply(runHermesOneshot(prompt));
  pushHistory(chatId, 'assistant', answer);
  return answer;
}

/**
 * Extract MEDIA:/path lines from text, return { cleanText, mediaPaths }.
 */
function extractMediaPaths(text = '') {
  const lines = String(text || '').split('\n');
  const mediaPaths = [];
  const cleanLines = [];
  for (const line of lines) {
    const match = line.match(/^MEDIA:(.+)$/);
    if (match) {
      const p = match[1].trim();
      if (p) mediaPaths.push(p);
    } else {
      cleanLines.push(line);
    }
  }
  return { cleanText: cleanLines.join('\n').trim(), mediaPaths };
}

async function sendMediaToFeishu(channel, chatId, mediaPaths, opts = {}) {
  const results = [];
  for (const source of mediaPaths) {
    try {
      // channel.send supports { image: { source } } natively
      const r = await channel.send(chatId, { image: { source } }, opts);
      results.push({ source, ok: true, messageId: r?.messageId });
    } catch (e) {
      console.warn('[feishu-stream] send image failed:', source, e.message);
      results.push({ source, ok: false, error: e.message });
    }
  }
  return results;
}

async function stop() {
  if (channel) {
    try { await channel.disconnect(); } catch (_) {}
  }
  channel = null;
  currentKey = '';
  status = { connected: false, mode: 'websocket', msg: '\u5df2\u65ad\u5f00', updatedAt: Date.now() };
}

async function handleMessage(msg) {
  if (!mark(msg.messageId)) return;
  const text = fixMojibake(msg.content || '').trim();
  if (!text) return;
  console.log('[feishu-stream] message received', { chatId: msg.chatId, messageId: msg.messageId, content: text });
  try {
    const reply = await runAgent(msg.chatId, text);
    const { cleanText, mediaPaths } = extractMediaPaths(reply);
    if (cleanText) {
      await channel.send(msg.chatId, { text: cleanText }, { replyTo: msg.messageId });
    }
    if (mediaPaths.length > 0) {
      await sendMediaToFeishu(channel, msg.chatId, mediaPaths);
    }
    if (!cleanText && mediaPaths.length === 0) {
      await channel.send(msg.chatId, { text: 'Agent 没有返回内容' }, { replyTo: msg.messageId });
    }
  } catch (error) {
    console.warn('[feishu-stream] agent chat failed:', error.message);
    await channel.send(msg.chatId, { text: 'Agent 出错了: ' + error.message }, { replyTo: msg.messageId });
  }
}

async function startFromConfig({ force = false } = {}) {
  const platform = getFeishuPlatform();
  const config = platform?.config || {};
  const appId = String(config.appId || '').trim();
  const appSecret = String(config.appSecret || '').trim();
  const nextKey = appId && appSecret ? appId + ':' + appSecret.slice(0, 8) : '';
  if (!appId || !appSecret || platform?.enabled === false) {
    await stop();
    status = { connected: false, mode: 'websocket', msg: '\u98de\u4e66\u672a\u914d\u7f6e\u6216\u672a\u542f\u7528', updatedAt: Date.now() };
    return status;
  }
  if (!force && channel && currentKey === nextKey && status.connected) return status;
  await stop();
  currentKey = nextKey;
  status = { connected: false, mode: 'websocket', msg: '\u8fde\u63a5\u4e2d', updatedAt: Date.now() };
  channel = Lark.createLarkChannel({ appId, appSecret, transport: 'websocket', loggerLevel: Lark.LoggerLevel.info });
  channel.on('message', handleMessage);
  channel.on('error', (err) => {
    console.warn('[feishu-stream] error:', err.message || err);
    status = { connected: false, mode: 'websocket', msg: err.message || String(err), updatedAt: Date.now() };
    updateGatewayPlatform({ streamConnected: false, streamStatusMsg: status.msg });
  });
  channel.on('reconnecting', () => {
    status = { connected: false, mode: 'websocket', msg: '\u91cd\u8fde\u4e2d', updatedAt: Date.now() };
    updateGatewayPlatform({ streamConnected: false, streamStatusMsg: status.msg });
  });
  channel.on('reconnected', () => {
    status = { connected: true, mode: 'websocket', msg: '\u957f\u8fde\u63a5\u5df2\u6062\u590d', updatedAt: Date.now() };
    updateGatewayPlatform({ streamConnected: true, connected: true, enabled: true, streamStatusMsg: status.msg, statusMsg: '\u98de\u4e66\u957f\u8fde\u63a5\u5df2\u8fde\u63a5' });
  });
  await channel.connect();
  status = { connected: true, mode: 'websocket', msg: '\u957f\u8fde\u63a5\u5df2\u8fde\u63a5', updatedAt: Date.now() };
  updateGatewayPlatform({ streamConnected: true, connected: true, enabled: true, streamStatusMsg: status.msg, statusMsg: '\u98de\u4e66\u957f\u8fde\u63a5\u5df2\u8fde\u63a5' });
  console.log('[feishu-stream] connected');
  return status;
}

function getStatus() {
  return { ...status, ws: channel?.getConnectionStatus?.() };
}

module.exports = { startFromConfig, stop, getStatus };

