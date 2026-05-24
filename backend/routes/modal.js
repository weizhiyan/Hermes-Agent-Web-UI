const express = require('express');
const crypto = require('crypto');

const router = express.Router();

/** @type {Set<import('express').Response>} */
const sseClients = new Set();
const pendingAsks = new Map();

function broadcast(eventName, eventData) {
  let sent = 0;
  for (const client of sseClients) {
    try {
      client.write(`event: ${eventName}\ndata: ${JSON.stringify(eventData)}\n\n`);
      sent++;
    } catch {
      sseClients.delete(client);
    }
  }
  return sent;
}

function normalizeQuestions(input) {
  const questions = Array.isArray(input) ? input : [input];
  return questions
    .filter(Boolean)
    .slice(0, 3)
    .map((question, index) => ({
      id: String(question.id || `q_${index + 1}`),
      label: String(question.label || question.question || question.header || `问题 ${index + 1}`),
      hint: String(question.hint || question.description || ''),
      type: question.type === 'multi' || question.multiSelect ? 'multi' : 'single',
      required: question.required !== false,
      placeholder: String(question.placeholder || question.inputPlaceholder || '请输入补充说明...'),
      maxLength: Math.max(0, Math.min(Number(question.maxLength || 0), 2000)),
      options: Array.isArray(question.options) ? question.options.slice(0, 6).map(option => {
        if (typeof option === 'string') return { label: option, value: option };
        return {
          label: String(option.label ?? option.value ?? ''),
          value: String(option.value ?? option.label ?? ''),
          description: String(option.description || ''),
        };
      }).filter(option => option.label || option.value) : [],
    }))
    .filter(question => question.label);
}

router.get('/notify', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write('event: connected\ndata: {}\n\n');
  sseClients.add(res);
  console.log(`[modal-sse] client connected (${sseClients.size} total)`);

  const keepAlive = setInterval(() => {
    try { res.write(':keepalive\n\n'); } catch { clearInterval(keepAlive); }
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
    console.log(`[modal-sse] client disconnected (${sseClients.size} total)`);
  });
});

router.post('/modal', (req, res) => {
  const { title, html, width } = req.body;
  if (!html) return res.fail('html is required');
  const eventData = { title: title || '', html, width: width || '520px' };
  const sent = broadcast('modal', eventData);
  res.ok({ sent });
  console.log(`[modal-sse] pushed modal to ${sent} clients: "${(title || html).slice(0, 40)}"`);
});

router.post('/toast', (req, res) => {
  const { msg, type } = req.body;
  if (!msg) return res.fail('msg is required');
  const eventData = { msg, type: type || 'info' };
  const sent = broadcast('toast', eventData);
  res.ok({ sent });
  console.log(`[modal-sse] pushed toast to ${sent} clients: "${msg.slice(0, 40)}"`);
});

function createAsk(payload = {}, options = {}) {
  const title = String(payload.title || '\u0041gent \u9700\u8981\u786e\u8ba4');
  const message = String(payload.message || '\u8bf7\u8865\u5145\u4ee5\u4e0b\u4fe1\u606f\uff0cAgent \u5c06\u7ee7\u7eed\u6267\u884c\u3002');
  const questions = normalizeQuestions(payload.questions || payload.question || payload);
  const timeoutMs = Math.max(10000, Math.min(Number(payload.timeoutMs || 10 * 60 * 1000), 30 * 60 * 1000));
  if (!questions.length) return Promise.reject(Object.assign(new Error('questions are required'), { status: 400 }));
  if (!sseClients.size) return Promise.reject(Object.assign(new Error('no WebUI client connected'), { status: 409 }));
  const askId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const eventData = { id: askId, title, message, questions, timeoutMs, createdAt: Date.now() };
  const resultPromise = new Promise(resolve => {
    const timeout = setTimeout(() => {
      const pending = pendingAsks.get(askId);
      if (!pending) return;
      pendingAsks.delete(askId);
      pending.resolve?.({ ok: false, id: askId, status: 'timeout', answers: null });
    }, timeoutMs);
    pendingAsks.set(askId, { resolve, timeout, createdAt: Date.now() });
  });
  const sent = broadcast('ask', eventData);
  console.log(`[modal-sse] pushed ask to ${sent} clients: "${title.slice(0, 40)}"`);
  if (!options.wait) return Promise.resolve({ id: askId, sent, timeoutMs });
  return resultPromise.then(result => ({ ...result, sent }));
}
router.post('/ask', (req, res) => {
  const wait = req.body?.wait === true || req.query.wait === '1';
  createAsk(req.body || {}, { wait }).then(result => {
    res.ok(result);
  }).catch(error => {
    const status = error.status || 500;
    res.fail(error.message || 'ask failed', status, status);
  });
});

router.post('/ask/:id/answer', (req, res) => {
  const id = String(req.params.id || '');
  const pending = pendingAsks.get(id);
  if (!pending) return res.fail('ask not found or expired', 404, 404);
  pendingAsks.delete(id);
  clearTimeout(pending.timeout);
  const status = req.body?.cancelled ? 'cancelled' : 'answered';
  const answers = req.body?.answers ?? null;
  pending.resolve({ ok: status === 'answered', id, status, answers });
  res.ok({ id, status });
});

router.get('/ask/:id', (req, res) => {
  const id = String(req.params.id || '');
  const pending = pendingAsks.get(id);
  if (!pending) return res.fail('ask not found or expired', 404, 404);
  res.ok({ id, pending: true, createdAt: pending.createdAt });
});

module.exports = router;
module.exports.sseClients = sseClients;
module.exports.pendingAsks = pendingAsks;
module.exports.broadcast = broadcast;
module.exports.createAsk = createAsk;
