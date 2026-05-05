const express = require('express');
const crypto = require('crypto');
const store = require('../services/store');
const { chatStream } = require('../services/llm');

const router = express.Router();
const KEY = 'chats';

function loadAll() {
  return store.read(KEY, []);
}
function saveAll(list) {
  store.write(KEY, list);
}

router.get('/', (req, res) => {
  const list = loadAll().map(c => ({
    id: c.id, title: c.title, model: c.model, updatedAt: c.updatedAt,
    preview: (c.messages.slice(-1)[0]?.content || '').slice(0, 60),
  }));
  res.ok(list);
});

router.post('/', (req, res) => {
  const now = Date.now();
  const chat = {
    id: crypto.randomUUID(),
    title: req.body.title || '新建对话',
    model: req.body.model || 'claude-opus-4-7',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const list = loadAll();
  list.unshift(chat);
  saveAll(list);
  res.ok(chat);
});

router.get('/:id', (req, res) => {
  const chat = loadAll().find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  res.ok(chat);
});

router.delete('/:id', (req, res) => {
  const list = loadAll().filter(c => c.id !== req.params.id);
  saveAll(list);
  res.ok();
});

router.put('/:id', (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  if (req.body.title) chat.title = req.body.title;
  chat.updatedAt = Date.now();
  saveAll(list);
  res.ok(chat);
});

/**
 * POST /api/chats/:id/messages
 * body: { content: string }
 * Response: text/event-stream, events: "token" (data: text), "done"
 */
router.post('/:id/messages', async (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);

  const userMsg = { role: 'user', content: String(req.body.content || ''), ts: Date.now() };
  chat.messages.push(userMsg);

  const skills = store.read('skills', []).filter(s => s.on && s.prompt);
  const settings = store.read('settings', {});
  let systemParts = [];
  if (settings.systemPrompt) systemParts.push(settings.systemPrompt);
  skills.forEach(s => systemParts.push(`[技能: ${s.name}] ${s.prompt}`));
  const systemPrompt = systemParts.join('\n\n');

  const contextMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...chat.messages]
    : chat.messages;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const cfg = store.read('models', {});
  let full = '';
  try {
    for await (const tok of chatStream(cfg, contextMessages)) {
      full += tok;
      res.write(`event: token\ndata: ${JSON.stringify(tok)}\n\n`);
    }
    const asst = { role: 'assistant', content: full, ts: Date.now() };
    chat.messages.push(asst);
    chat.updatedAt = Date.now();
    if (chat.title === '新建对话' && userMsg.content) {
      chat.title = userMsg.content.slice(0, 24);
    }
    saveAll(list);
    res.write(`event: done\ndata: ${JSON.stringify({ id: chat.id })}\n\n`);
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ msg: e.message })}\n\n`);
  } finally {
    res.end();
  }
});

module.exports = router;
