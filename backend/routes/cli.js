/**
 * Hermes CLI sessions bridge.
 * Reads real conversation history from Hermes Agent's session store.
 */
const express = require('express');
const { spawnSync } = require('child_process');
const store = require('../services/store');
const { detectHermesCommand } = require('../services/hermes');
const { redactSecrets, sanitizeChat } = require('../services/security');

const router = express.Router();
const HIDDEN_KEY = 'cli-hidden-sessions';

function shQuote(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function runHermes(args) {
  const hermes = detectHermesCommand();
  if (!hermes) throw new Error('Hermes CLI 未找到。请先在 WSL 或本机安装 hermes。');

  const result = hermes.type === 'wsl'
    ? spawnSync('wsl', ['-e', 'bash', '-lc', `hermes ${args.map(shQuote).join(' ')}`], {
        encoding: 'utf8',
        timeout: 25000,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      })
    : spawnSync('hermes', args, {
        encoding: 'utf8',
        timeout: 25000,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
        shell: true,
      });

  if (result.error) throw new Error('hermes CLI: ' + result.error.message);
  if (result.status !== 0) {
    throw new Error('hermes CLI exited ' + result.status + ': ' + (result.stderr || '').slice(0, 200));
  }
  return result.stdout;
}

function hiddenSessions() {
  return new Set(store.read(HIDDEN_KEY, []));
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

function parseSessionLine(line) {
  const parts = String(line || '').trim().split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const id = parts[parts.length - 1];
  const lastActive = parts[parts.length - 2];
  const title = cleanTitle(parts[0]);
  const preview = parts.length > 3 ? cleanPreview(parts.slice(1, -2).join(' ')) : '';
  const t = parseSessionTime(id);

  return {
    id,
    title: title || preview || null,
    preview,
    source: 'cli',
    lastActiveLabel: lastActive,
    lastActive,
    createdAt: t,
    updatedAt: t,
    readOnly: true,
  };
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
    const limit = String(Math.min(Number(req.query.limit) || 500, 5000));
    const raw = runHermes(['sessions', 'list', '--limit', limit]);
    const lines = raw.split('\n').filter(l => l.trim());
    const sessions = [];
    const hidden = hiddenSessions();
    let started = false;

    for (const line of lines) {
      if (!started) {
        if (line.includes('──')) started = true;
        continue;
      }
      const session = parseSessionLine(line);
      if (session && !hidden.has(session.id)) sessions.push(session);
    }

    res.ok(sessions);
  } catch (e) {
    console.warn('[cli] sessions list failed:', e.message);
    res.ok([]);
  }
});

router.get('/sessions/:id', (req, res) => {
  try {
    const raw = runHermes(['sessions', 'export', '-', '--session-id', req.params.id]);
    const data = JSON.parse(raw);
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

router.delete('/sessions/:id', (req, res) => {
  const hidden = hiddenSessions();
  hidden.add(req.params.id);
  saveHiddenSessions(hidden);
  res.ok({ hidden: true });
});

router._parseSessionLine = parseSessionLine;
module.exports = router;
