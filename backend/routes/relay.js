const express = require('express');
const { collectTerminalChatModels, hasTerminalRelayAuth } = require('../services/terminalModels');

const router = express.Router();

function collectRelayModels(options = {}) {
  return collectTerminalChatModels({ includeAgent: options.includeAgent === true });
}

function chatUrl(base = '') {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/chat\/completions\/?$/i.test(clean)) return clean;
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

function findRelayModel(modelName = '') {
  const requested = String(modelName || '');
  if (!requested) return null;
  for (const item of collectRelayModels({ includeAgent: true })) {
    const aliases = [item.name, item.id].filter(Boolean).map(String);
    if (aliases.includes(requested) && item?.base && hasTerminalRelayAuth(item)) return item;
  }
  return null;
}

function anthropicToOpenAI(body = {}) {
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: typeof body.system === 'string' ? body.system : JSON.stringify(body.system) });
  for (const item of Array.isArray(body.messages) ? body.messages : []) {
    const content = typeof item.content === 'string'
      ? item.content
      : Array.isArray(item.content)
        ? item.content.map(part => part && (part.text || part.content) || '').filter(Boolean).join('\n')
        : String(item.content || '');
    if (item.role && content) messages.push({ role: item.role === 'assistant' ? 'assistant' : 'user', content });
  }
  return { model: body.model, messages, stream: body.stream !== false, temperature: body.temperature, max_tokens: body.max_tokens, top_p: body.top_p };
}
function openAIChunkToAnthropic(line = '') {
  if (!line.startsWith('data:')) return '';
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  try {
    const chunk = JSON.parse(data);
    const text = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content || '';
    if (!text) return '';
    return 'event: content_block_delta\ndata: ' + JSON.stringify({ type:'content_block_delta', index:0, delta:{ type:'text_delta', text } }) + '\n\n';
  } catch (_) { return ''; }
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

async function proxyChatCompletion(req, res, options = {}) {
  const anthropic = !!options.anthropic;
  const requestedModel = (req.body && req.body.model) || '';
  const model = findRelayModel(requestedModel);
  if (!model) return res.status(404).json({ error: { message: 'No WebUI relay model configured for ' + (requestedModel || 'empty model') } });
  try {
    const requestBody = anthropic ? anthropicToOpenAI(req.body || {}) : cleanBody(req.body || {}, model);
    const upstream = await fetch(chatUrl(model.base), {
      method: 'POST',
      headers: authHeaders(model),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(180000),
    });
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type') || '';
    if (anthropic && requestBody.stream !== false) res.set('Content-Type', 'text/event-stream; charset=utf-8');
    else if (contentType) res.set('Content-Type', contentType);
    if (!upstream.body) return res.end(await upstream.text().catch(() => ''));
    if (!anthropic || requestBody.stream === false) {
      const reader = upstream.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        res.write(Buffer.from(chunk.value));
      }
      return res.end();
    }
    res.write('event: message_start\ndata: {"type":"message_start","message":{"role":"assistant","content":[]}}\n\n');
    res.write('event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n');
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += dec.decode(chunk.value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        const out = openAIChunkToAnthropic(line);
        if (out) res.write(out);
      }
    }
    res.end();
  } catch (error) {
    res.status(502).json({ error: { message: error.message || 'WebUI relay failed' } });
  }
}

router.get('/models', (req, res) => {
  res.json({
    object: 'list',
    data: collectRelayModels().map(model => ({
      id: model.name,
      object: 'model',
      created: 0,
      owned_by: model.provider || 'webui',
      webui_id: model.id || model.name,
    })),
  });
});
router.post('/messages', (req, res) => proxyChatCompletion(req, res, { anthropic: true }));
router.post('/v1/messages', (req, res) => proxyChatCompletion(req, res, { anthropic: true }));
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
