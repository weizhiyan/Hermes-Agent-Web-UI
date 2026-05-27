const express = require('express');
const store = require('../services/store');

const router = express.Router();

function chatUrl(base = '') {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/chat\/completions\/?$/i.test(clean)) return clean;
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

function findRelayModel(modelName = '') {
  const root = store.read('models', {});
  const configs = [root.agent, root.webui].filter(Boolean);
  for (const cfg of configs) {
    const item = (cfg.library || []).find(model => {
      if (!model || model.enabled === false) return false;
      const aliases = [model.name, model.id].filter(Boolean).map(String);
      return aliases.includes(String(modelName || ''));
    });
    if (item?.base && item?.key) return item;
  }
  return null;
}

function authHeaders(model) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'User-Agent': process.env.WEBUI_RELAY_USER_AGENT || 'curl/8.5.0',
    Origin: process.env.WEBUI_RELAY_ORIGIN || 'https://chat.openai.com',
    Referer: process.env.WEBUI_RELAY_REFERER || 'https://chat.openai.com/',
  };
  const authType = model.authType || 'bearer';
  if (!model.key || authType === 'none') return headers;
  if (authType === 'x-api-key') headers['x-api-key'] = model.key;
  else if (authType === 'api-key') headers['api-key'] = model.key;
  else if (authType === 'custom' && model.authHeader) headers[model.authHeader] = model.key;
  else headers.Authorization = `Bearer ${model.key}`;
  return headers;
}

function cleanBody(body = {}, model) {
  const next = { ...body };
  next.model = model.name || body.model;
  next.messages = Array.isArray(next.messages) ? next.messages.map(message => ({
    role: message.role === 'tool' ? 'user' : message.role,
    content: typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? message.content.map(part => part?.text || part?.content || '').filter(Boolean).join('\n')
        : String(message.content || ''),
  })).filter(message => message.role && message.content) : [];
  if (Array.isArray(next.tools) && !next.tools.length) delete next.tools;
  if (next.tool_choice === 'none' || next.tool_choice == null) delete next.tool_choice;
  delete next.parallel_tool_calls;
  delete next.store;
  delete next.metadata;
  delete next.user;
  delete next.safety_identifier;
  delete next.reasoning_effort;
  delete next.service_tier;
  delete next.response_format;
  delete next.logprobs;
  delete next.top_logprobs;
  return next;
}

router.post('/chat/completions', async (req, res) => {
  const requestedModel = req.body?.model || '';
  const model = findRelayModel(requestedModel);
  if (!model) return res.status(404).json({ error: { message: `No WebUI relay model configured for ${requestedModel || 'empty model'}` } });
  try {
    const upstream = await fetch(chatUrl(model.base), {
      method: 'POST',
      headers: authHeaders(model),
      body: JSON.stringify(cleanBody(req.body || {}, model)),
      signal: AbortSignal.timeout(180000),
    });
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType) res.set('Content-Type', contentType);
    if (!upstream.body) return res.end(await upstream.text().catch(() => ''));
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    res.status(502).json({ error: { message: error.message || 'WebUI relay failed' } });
  }
});

module.exports = router;
