const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('../services/store');
const { chatStream } = require('../services/llm');
const { readCoreMemoryPrompt } = require('../services/memory');
const { redactSecrets, sanitizeAny, sanitizeChat } = require('../services/security');

const router = express.Router();
const KEY = 'chats';
const HISTORY_DIR = path.join(store.DATA_DIR, 'history-md');
const WEBUI_SELF_PROTECTION_PROMPT = `【WebUI 自保护规则】
当前请求来自 Hermes WebUI 对话页面。除非用户明确说明“现在不用 WebUI，而是在 CLI/代码模式中修改项目”，否则你不能修改当前 Hermes WebUI 的核心代码与服务文件。

禁止修改范围包括但不限于：
- index.html、app-new.js、frontend/、backend/routes/、backend/services/、backend/server.js
- 启动脚本、模型连接核心逻辑、WebUI 路由和页面样式

允许操作范围：
- 读取文件、解释现状、给出方案
- 写入或更新数据文件，例如用户授权的第三方 API 配置、记忆文件、图片/Markdown 输出目录、backend/data 下的业务数据
- 指导用户在 CLI 中执行维护操作

如果用户在 WebUI 对话里要求修改 WebUI 自身，请说明需要切换到 CLI/代码维护模式后再执行。`;

function loadAll() { return store.read(KEY, []); }
function saveAll(list) { store.write(KEY, list); }
function safeName(name) {
  return String(name || 'conversation').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}
function toMarkdown(chat) {
  const lines = [
    `# ${redactSecrets(chat.title || '未命名对话')}`,
    '',
    `- 时间：${new Date(chat.updatedAt || chat.createdAt || Date.now()).toLocaleString('zh-CN')}`,
    `- 来源：${chat.source || 'WebUI'}`,
    `- 模型：${chat.model || 'default'}`,
    '',
  ];
  (chat.messages || []).forEach(msg => {
    const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'Hermes' : msg.role;
    const time = msg.ts ? new Date(msg.ts).toLocaleString('zh-CN') : '';
    lines.push(`## ${role} ${time}`.trim(), '', redactSecrets(msg.content || ''), '');
  });
  return lines.join('\n');
}
function writeMarkdown(chat) {
  const date = new Date(chat.updatedAt || chat.createdAt || Date.now());
  const monthFolder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const targetDir = path.join(HISTORY_DIR, monthFolder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, `${dateStr}_${safeName(redactSecrets(chat.title))}.md`);
  const content = toMarkdown(chat);
  fs.writeFileSync(filePath, content, 'utf8');
  return { content, path: filePath, folder: targetDir };
}

router.get('/', (req, res) => {
  const list = loadAll().map(c => ({
    id: c.id,
    title: redactSecrets(c.title),
    model: c.model,
    agentId: c.agentId,
    agentName: c.agentName,
    source: c.source || 'WebUI',
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    preview: redactSecrets(c.messages?.slice(-1)[0]?.content || '').slice(0, 90),
    messageCount: c.messages?.length || 0,
  }));
  res.ok(list);
});

router.post('/', (req, res) => {
  const now = Date.now();
  const chat = {
    id: crypto.randomUUID(),
    title: req.body.title || '新建对话',
    model: req.body.model || 'hermes-agent',
    agentId: req.body.agentId || '',
    agentName: req.body.agentName || '',
    source: req.body.source || 'WebUI',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const list = loadAll();
  list.unshift(chat);
  saveAll(list);
  res.ok(sanitizeChat(chat));
});

router.get('/exports/history', (req, res) => {
  if (!fs.existsSync(HISTORY_DIR)) return res.ok([]);
  const result = [];
  try {
    const months = fs.readdirSync(HISTORY_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const month of months) {
      const monthPath = path.join(HISTORY_DIR, month.name);
      const files = fs.readdirSync(monthPath, { withFileTypes: true })
        .filter(f => f.isFile() && f.name.endsWith('.md'))
        .map(f => {
          const stat = fs.statSync(path.join(monthPath, f.name));
          return {
            name: f.name,
            path: path.join(monthPath, f.name),
            month: month.name,
            mtime: stat.mtimeMs,
            size: stat.size
          };
        });
      if (files.length > 0) {
        result.push({
          month: month.name,
          files: files.sort((a, b) => b.mtime - a.mtime)
        });
      }
    }
    result.sort((a, b) => b.month.localeCompare(a.month));
    res.ok(result);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.get('/exports/folder', (req, res) => {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
  res.ok({ path: HISTORY_DIR });
});

router.get('/:id', (req, res) => {
  const chat = loadAll().find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  res.ok(sanitizeChat(chat));
});

router.get('/:id/markdown', (req, res) => {
  const chat = loadAll().find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  res.ok(writeMarkdown(chat));
});

router.delete('/:id', (req, res) => {
  saveAll(loadAll().filter(c => c.id !== req.params.id));
  res.ok();
});

router.put('/:id', (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  if (req.body.title) chat.title = req.body.title;
  if (req.body.pinned !== undefined) chat.pinned = Boolean(req.body.pinned);
  if (req.body.agentId !== undefined) chat.agentId = String(req.body.agentId || '');
  if (req.body.agentName !== undefined) chat.agentName = String(req.body.agentName || '');
  chat.updatedAt = Date.now();
  saveAll(list);
  res.ok(sanitizeChat(chat));
});

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/:id/messages', async (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);

  const userMsg = { role: 'user', content: redactSecrets(String(req.body.content || '')), ts: Date.now() };
  chat.messages.push(userMsg);
  if (req.body.profileId) chat.agentId = String(req.body.profileId);
  if (req.body.profileName) chat.agentName = String(req.body.profileName).slice(0, 120);

  const requestedSkillIds = Array.isArray(req.body.profileSkillIds) ? req.body.profileSkillIds.map(String) : [];
  const skills = store.read('skills', []).filter(s => {
    if (!s.prompt) return false;
    if (requestedSkillIds.length) return requestedSkillIds.includes(String(s.id));
    return s.on;
  });
  const settings = store.read('settings', {});
  const systemParts = [];
  systemParts.push(WEBUI_SELF_PROTECTION_PROMPT);
  const memoryPrompt = readCoreMemoryPrompt();
  if (memoryPrompt) systemParts.push(memoryPrompt);
  if (settings.systemPrompt) systemParts.push(settings.systemPrompt);
  if (req.body.profilePrompt || req.body.profileName) systemParts.push(`[当前 Agent: ${String(req.body.profileName || req.body.profileId || '默认助手').slice(0, 80)}]\n${String(req.body.profilePrompt || '').slice(0, 6000)}`);
  skills.forEach(s => systemParts.push(`[技能: ${s.name}] ${s.prompt}`));
  const systemPrompt = systemParts.join('\n\n');
  const historyLimit = Math.max(4, Math.min(Number(settings.history) || 16, 60));
  const recentMessages = chat.messages.slice(-historyLimit);
  const contextMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...recentMessages] : recentMessages;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const cfg = store.read('models', {});
  cfg._scene = req.body.scene || 'chat';
  if (req.body.model && req.body.model !== 'auto') cfg._requestedModel = req.body.model;
  let full = '';
  let reasoningFull = '';
  const toolCalls = [];

  try {
    for await (const event of chatStream(cfg, contextMessages)) {
      switch (event.type) {
        case 'token':
          {
            const safeText = redactSecrets(event.text);
            full += safeText;
            sseWrite(res, 'token', { text: safeText });
          }
          break;

        case 'reasoning':
          {
            const safeText = redactSecrets(event.text);
            reasoningFull += safeText;
            sseWrite(res, 'reasoning', { text: safeText });
          }
          break;

        case 'tool':
          toolCalls.push({ ...sanitizeAny(event), done: false });
          sseWrite(res, 'tool', {
            event_type: event.event_type,
            name: event.name,
            preview: redactSecrets(event.preview),
            args: sanitizeAny(event.args),
          });
          break;

        case 'tool_complete':
          for (let i = toolCalls.length - 1; i >= 0; i--) {
            if (!toolCalls[i].done && (!event.name || toolCalls[i].name === event.name)) {
              toolCalls[i].done = true;
              toolCalls[i].is_error = event.is_error;
              toolCalls[i].duration = event.duration;
              break;
            }
          }
          sseWrite(res, 'tool_complete', {
            event_type: event.event_type,
            name: event.name,
            preview: redactSecrets(event.preview),
            is_error: event.is_error,
            duration: event.duration,
          });
          break;

        case 'title':
          sseWrite(res, 'title', { title: event.title, session_id: chat.id });
          if (event.title) chat.title = event.title;
          break;

        case 'error':
          sseWrite(res, 'error', { msg: redactSecrets(event.text) });
          break;
      }
    }

    chat.messages.push({ role: 'assistant', content: redactSecrets(full), ts: Date.now() });
    if (reasoningFull) chat.messages[chat.messages.length - 1].reasoning = reasoningFull;
    if (toolCalls.length) chat.messages[chat.messages.length - 1].tool_calls = toolCalls;
    chat.updatedAt = Date.now();
    if (chat.title === '新建对话' && userMsg.content) chat.title = userMsg.content.slice(0, 24);
    saveAll(list);
    try { writeMarkdown(chat); } catch {}

    sseWrite(res, 'done', {
      session_id: chat.id,
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  } catch (e) {
    sseWrite(res, 'error', { msg: e.message });
  } finally {
    res.end();
  }
});

router.post('/gc-stream', async (req, res) => {
  const { messages, model, scene } = req.body;
  if (!messages || !messages.length) return res.fail('messages required');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const cfg = store.read('models', {});
  cfg._scene = scene || 'chat';
  if (model && model !== 'auto') cfg._requestedModel = model;

  try {
    for await (const event of chatStream(cfg, messages)) {
      switch (event.type) {
        case 'token':
          sseWrite(res, 'token', { text: redactSecrets(event.text) });
          break;
        case 'reasoning':
          sseWrite(res, 'reasoning', { text: redactSecrets(event.text) });
          break;
        case 'error':
          sseWrite(res, 'error', { msg: redactSecrets(event.text) });
          break;
      }
    }
    sseWrite(res, 'done', {});
  } catch (e) {
    sseWrite(res, 'error', { msg: e.message });
  } finally {
    res.end();
  }
});

module.exports = router;
