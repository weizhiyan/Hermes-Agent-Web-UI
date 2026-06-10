/**
 * Hermes CLI sessions bridge.
 * Reads real conversation history from Hermes Agent's session store.
 */
const express = require('express');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../services/store');
const { detectHermesCommand } = require('../services/hermes');
const { chatStream } = require('../services/llm');
const { redactSecrets, sanitizeChat } = require('../services/security');

const router = express.Router();

function modelConfigForScope(scope = 'agent') {
  const root = store.read('models', {});
  if (root && typeof root === 'object' && (root.webui || root.agent)) {
    return { ...(root[scope] || root.webui || root.agent || {}) };
  }
  return { ...(root || {}) };
}
const HIDDEN_KEY = 'cli-hidden-sessions';
const WEBUI_HERMES_SESSION_KEY = 'webui-hermes-sessions';
const WEBUI_CHAT_KEY = 'chats';

function runHermes(args) {
  const hermes = detectHermesCommand();
  if (!hermes) throw new Error('Hermes CLI not found. Install native Hermes on Windows and ensure hermes is on PATH.');
  const result = spawnSync(hermes.cmd || 'hermes', args, {
    encoding: 'utf8',
    timeout: 25000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw new Error('hermes CLI: ' + result.error.message);
  if (result.status !== 0) {
    throw new Error('hermes CLI exited ' + result.status + ': ' + (result.stderr || result.stdout || '').slice(0, 500));
  }
  return result.stdout;
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function makeTraceId(prefix = 'cli') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 8);
}

function requestTraceId(req) {
  const raw = String(req?.body?.traceId || '').trim();
  return raw || makeTraceId('cli');
}

function hiddenSessions() {
  return new Set(store.read(HIDDEN_KEY, []));
}

function webuiHermesSessions() {
  const ids = new Set();
  const rows = store.read(WEBUI_HERMES_SESSION_KEY, []);
  for (const item of (Array.isArray(rows) ? rows : [])) {
    const id = String(item?.sessionId || item?.id || '').trim();
    if (id) ids.add(id);
  }
  const chats = store.read(WEBUI_CHAT_KEY, []);
  for (const chat of (Array.isArray(chats) ? chats : [])) {
    for (const msg of (Array.isArray(chat?.messages) ? chat.messages : [])) {
      const id = String(msg?.hermesSessionId || '').trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

function isWebuiSourceSession(session = {}) {
  const raw = String(session.cliSource || session.sourceRaw || session.rawSource || '').toLowerCase();
  return raw === 'webui' || raw.includes('webui');
}

function saveHiddenSessions(set) {
  store.write(HIDDEN_KEY, [...set]);
}

function parseSessionTime(id) {
  const m = String(id || '').match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/);
  if (!m) return Date.now();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])).getTime();
}

function cleanPreview(value) {
  return redactSecrets(String(value || '')
    .replace(/^—(\s+—)*/, '')
    .replace(/^\[对话历史\]\s*/i, '')
    .trim());
}

function cleanTitle(value) {
  const text = redactSecrets(String(value || '').trim());
  return text && text !== '—' ? text : '';
}

function isSessionId(value) {
  return /^\d{8}_\d{6}_[A-Za-z0-9_-]+$/.test(String(value || '').trim());
}

function isDecorativeSessionLine(line) {
  const text = String(line || '').trim();
  if (!text) return true;
  if (/^(title|preview|last active|session id|id)\b/i.test(text)) return true;
  return /^[\s─━═┄┈┌┬┐└┴┘├┼┤│┃+\-|=]+$/.test(text);
}

function normalizeHermesListText(raw) {
  return String(raw || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[│┃]/g, '  ')
    .replace(/[┌┬┐└┴┘├┼┤]/g, ' ')
    .replace(/[─━═┄┈]+/g, '  ');
}
function normalizeSessionObject(item) {
  if (!item || typeof item !== 'object') return null;
  const id = item.id || item.session_id || item.sessionId;
  if (!isSessionId(id)) return null;
  const t = parseSessionTime(id);
  const title = cleanTitle(item.title || item.name || item.summary || '');
  const preview = cleanPreview(item.preview || item.last_message || item.lastMessage || item.description || '');
  const updatedAt = Number(item.updatedAt || item.updated_at || item.ended_at || item.last_active_at || 0);
  const createdAt = Number(item.createdAt || item.created_at || item.started_at || 0);
  return {
    id,
    title: title || preview || id,
    preview,
    source: 'cli',
    cliSource: item.source || item.origin || item.client_source || item.clientSource || '',
    sourceRaw: item.source || item.origin || item.client_source || item.clientSource || '',
    lastActiveLabel: item.lastActiveLabel || item.last_active || item.lastActive || '',
    lastActive: item.lastActive || item.last_active || '',
    createdAt: createdAt > 10_000_000_000 ? createdAt : (createdAt ? Math.floor(createdAt * 1000) : t),
    updatedAt: updatedAt > 10_000_000_000 ? updatedAt : (updatedAt ? Math.floor(updatedAt * 1000) : t),
    readOnly: true,
  };
}

function parseSessionJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    const list = Array.isArray(parsed) ? parsed : (parsed.sessions || parsed.data || parsed.items || []);
    if (!Array.isArray(list)) return [];
    return list.map(normalizeSessionObject).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function parseSessionText(raw) {
  const sessions = [];
  const seen = new Set();
  const lines = normalizeHermesListText(raw).split('\n').filter(l => l.trim());
  for (const line of lines) {
    const session = parseSessionLine(line);
    if (session && !seen.has(session.id)) {
      seen.add(session.id);
      sessions.push(session);
    }
  }
  if (sessions.length) return sessions;
  const ids = String(raw || '').match(/\d{8}_\d{6}_[A-Za-z0-9_-]+/g) || [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const t = parseSessionTime(id);
    sessions.push({ id, title: id, preview: '', source: 'cli', createdAt: t, updatedAt: t, readOnly: true });
  }
  return sessions;
}

function parseSessionLine(line) {
  const normalized = normalizeHermesListText(line);
  if (isDecorativeSessionLine(normalized)) return null;

  const idMatch = normalized.match(/\d{8}_\d{6}_[A-Za-z0-9_-]+/);
  if (!idMatch) return null;

  const id = idMatch[0];
  const beforeId = normalized.slice(0, idMatch.index).trim();
  const parts = beforeId.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
  const lastActive = parts.length > 1 ? parts[parts.length - 1] : '';
  const title = cleanTitle(parts[0] || '');
  const preview = parts.length > 2 ? cleanPreview(parts.slice(1, -1).join(' ')) : cleanPreview(parts[1] || '');
  const t = parseSessionTime(id);

  return {
    id,
    title: title || preview || id,
    preview,
    source: 'cli',
    cliSource: item.source || item.origin || item.client_source || item.clientSource || '',
    sourceRaw: item.source || item.origin || item.client_source || item.clientSource || '',
    lastActiveLabel: lastActive,
    lastActive,
    createdAt: t,
    updatedAt: t,
    readOnly: true,
  };
}

function sessionFileId(filePath = '') {
  const base = path.basename(String(filePath || ''), '.json');
  return base.replace(/^session_/, '');
}

function readSessionFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function lightJsonString(head, key) {
  const re = new RegExp('"' + key + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"');
  const match = String(head || '').match(re);
  if (!match) return '';
  try { return JSON.parse('"' + match[1] + '"'); } catch (_) { return match[1]; }
}

function lightMessagePreview(head, role) {
  const marker = '"role"';
  let index = String(head || '').indexOf('"' + role + '"');
  if (index < 0) index = String(head || '').indexOf(role);
  if (index < 0) return '';
  const slice = String(head || '').slice(Math.max(0, index - 300), index + 2400);
  return cleanPreview(lightJsonString(slice, 'content')).slice(0, 220);
}

function sessionFromFile(filePath) {
  let stat = null;
  try { stat = fs.statSync(filePath); } catch (_) { return null; }
  const id = sessionFileId(filePath);
  if (!isSessionId(id)) return null;
  return {
    id,
    title: id,
    preview: '',
    source: 'cli',
    cliSource: 'cli',
    sourceRaw: 'cli',
    createdAt: parseSessionTime(id),
    updatedAt: stat.mtimeMs || parseSessionTime(id),
    readOnly: true,
  };
}

function listSessionFiles(limit = 500) {
  const rows = [];
  for (const dir of candidateSessionDirs()) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (/^session_.*\.json$/i.test(name)) rows.push(path.join(dir, name));
      }
    } catch (_) {}
  }
  return rows
    .map(filePath => ({ filePath, mtime: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map(row => row.filePath);
}

function sessionsFromFiles(limit = 500) {
  const seen = new Set();
  return listSessionFiles(limit).map(sessionFromFile).filter(Boolean).filter(session => {
    if (seen.has(session.id)) return false;
    seen.add(session.id);
    return true;
  });
}

function exportSessionFromFile(id) {
  const filePath = listSessionFiles(5000).find(file => sessionFileId(file) === id || path.basename(file, '.json') === id);
  if (!filePath) return null;
  const data = readSessionFile(filePath);
  if (!data) return null;
  const messages = mergeToolMessages(data.messages || []);
  const createdAt = data.session_start ? Date.parse(data.session_start) : parseSessionTime(id);
  const updatedAt = data.last_updated ? Date.parse(data.last_updated) : fs.statSync(filePath).mtimeMs;
  return sanitizeChat({
    id: data.session_id || data.id || id,
    title: data.title || messages.find(m => m.role === 'user')?.content || '未命名对话',
    model: data.model || 'unknown',
    source: 'cli',
    cliSource: data.platform || data.source || 'cli',
    createdAt: Number.isFinite(createdAt) ? createdAt : parseSessionTime(id),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    messages,
    messageCount: messages.length,
    tokenUsage: { input: data.input_tokens || 0, output: data.output_tokens || 0 },
    readOnly: true,
  });
}

function mergeToolMessages(rawMessages) {
  const merged = [];
  let pendingTools = [];

  for (const m of rawMessages) {
    if (m.role === 'assistant') {
      if (pendingTools.length && merged.length) {
        const last = merged[merged.length - 1];
        if (last.role === 'assistant') last.toolCalls = pendingTools;
      }
      pendingTools = [];
      let tcArray = [];
      if (m.tool_calls) {
        try {
          const parsed = typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls) : m.tool_calls;
          tcArray = (Array.isArray(parsed) ? parsed : [parsed]).map(tc => ({
            name: tc.function?.name || tc.name || 'unknown',
            status: 'success',
            input: tc.function?.arguments || tc.input || '',
            output: '',
            id: tc.id || '',
          }));
        } catch {}
      }
      merged.push({
        role: 'assistant',
        content: m.content || '',
        ts: Math.floor((m.timestamp || 0) * 1000),
        toolCalls: tcArray,
        pendingToolOutputs: tcArray.length ? tcArray.map(() => null) : undefined,
      });
    } else if (m.role === 'tool') {
      if (merged.length && merged[merged.length - 1].role === 'assistant') {
        const last = merged[merged.length - 1];
        if (!last.toolCalls) last.toolCalls = [];
        const idx = last.toolCalls.findIndex(tc => !tc.output);
        if (idx >= 0) {
          last.toolCalls[idx].output = (m.content || '').slice(0, 300);
          last.toolCalls[idx].status = 'success';
        } else {
          last.toolCalls.push({
            name: m.tool_name || 'tool',
            status: 'success',
            input: '',
            output: (m.content || '').slice(0, 300),
          });
        }
      }
    } else {
      if (pendingTools.length && merged.length) {
        const last = merged[merged.length - 1];
        if (last.role === 'assistant' && !last.toolCalls) last.toolCalls = pendingTools;
        pendingTools = [];
      }
      merged.push({
        role: m.role,
        content: m.content || '',
        ts: Math.floor((m.timestamp || 0) * 1000),
      });
    }
  }
  return merged;
}

router.get('/sessions', (req, res) => {
  try {
    const limitNumber = Math.min(Number(req.query.limit) || 500, 5000);
    const hidden = hiddenSessions();
    const sessions = sessionsFromFiles(Math.max(limitNumber * 8, 500));
    const seen = new Set();
    const visible = sessions.filter(session => {
      if (!session || hidden.has(session.id) || seen.has(session.id)) return false;
      seen.add(session.id);
      return true;
    });
    res.ok(visible.slice(0, limitNumber));
  } catch (e) {
    console.warn('[cli] sessions list failed:', e.message);
    res.ok([]);
  }
});
router.get('/sessions/:id', (req, res) => {
  try {
    let data = null;
    try {
      const raw = runHermes(['sessions', 'export', '-', '--session-id', req.params.id]);
      data = JSON.parse(raw);
    } catch (error) {
      const fileChat = exportSessionFromFile(req.params.id);
      if (fileChat) return res.ok(fileChat);
      throw error;
    }
    const messages = mergeToolMessages(data.messages || []);
    res.ok(sanitizeChat({
      id: data.id,
      title: data.title || '未命名对话',
      model: data.model || 'unknown',
      source: 'cli',
      cliSource: data.source || '',
      createdAt: Math.floor((data.started_at || 0) * 1000),
      updatedAt: data.ended_at ? Math.floor(data.ended_at * 1000) : Date.now(),
      messages,
      messageCount: messages.length,
      tokenUsage: {
        input: data.input_tokens || 0,
        output: data.output_tokens || 0,
      },
      readOnly: true,
    }));
  } catch (e) {
    res.fail(e.message);
  }
});

router.post('/sessions/:id/messages', async (req, res) => {
  const content = redactSecrets(String(req.body?.content || '').trim());
  if (!content) return res.fail('content required', 400, 400);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const traceId = requestTraceId(req);
  const userMsgId = req.body?.userMsgId ? String(req.body.userMsgId) : '';
  const assistantMsgId = req.body?.assistantMsgId ? String(req.body.assistantMsgId) : '';
  const cfg = modelConfigForScope('agent');
  cfg._scene = req.body?.scene || 'chat';
  if (req.body?.model && req.body.model !== 'auto') cfg._requestedModel = req.body.model;
  cfg._resumeSessionId = String(req.params.id || '').trim();
  cfg._traceId = traceId;
  cfg._runId = traceId;
  cfg.quickMode = false;

  let full = '';
  let reasoningFull = '';
  try {
    for await (const event of chatStream(cfg, [{ role: 'user', content }])) {
      switch (event.type) {
        case 'token':
          full += redactSecrets(event.text || '');
          sseWrite(res, 'token', { text: redactSecrets(event.text || '') });
          break;
        case 'reasoning':
          reasoningFull += redactSecrets(event.text || '');
          sseWrite(res, 'reasoning', { text: redactSecrets(event.text || '') });
          break;
        case 'tool':
          sseWrite(res, 'tool', event);
          break;
        case 'tool_complete':
          sseWrite(res, 'tool_complete', event);
          break;
        case 'title':
          sseWrite(res, 'title', { title: event.title, session_id: req.params.id, traceId, userMsgId, assistantMsgId });
          break;
        case 'session':
          sseWrite(res, 'perf', { stage: 'hermes-session', sessionId: event.sessionId || req.params.id, traceId, userMsgId, assistantMsgId });
          break;
        case 'perf':
          sseWrite(res, 'perf', { traceId, userMsgId, assistantMsgId, ...event });
          break;
        case 'error':
          sseWrite(res, 'error', { msg: redactSecrets(event.text || 'request failed'), traceId, userMsgId, assistantMsgId });
          break;
        case 'done':
          break;
      }
    }
    sseWrite(res, 'done', {
      session_id: req.params.id,
      usage: { input_tokens: 0, output_tokens: 0 },
      reasoning_chars: reasoningFull.length,
      output_chars: full.length,
      traceId,
      userMsgId,
      assistantMsgId,
      runId: cfg._runId || traceId,
    });
  } catch (e) {
    sseWrite(res, 'error', { msg: redactSecrets(e.message || 'request failed'), traceId, userMsgId, assistantMsgId });
  } finally {
    res.end();
  }
});

router.delete('/sessions/:id', (req, res) => {
  const hidden = hiddenSessions();
  hidden.add(req.params.id);
  saveHiddenSessions(hidden);
  res.ok({ hidden: true });
});

router._parseSessionLine = parseSessionLine;
module.exports = router;
