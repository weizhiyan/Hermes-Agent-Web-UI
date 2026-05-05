/**
 * LLM dispatcher with real streaming for Anthropic / OpenAI / DeepSeek / Ollama.
 *
 * cfg shape:
 *   {
 *     anthropic: { base, key, model },
 *     openai:    { base, key, model },
 *     deepseek:  { base, key, model },
 *     local:     { base, model },
 *     params:    { temperature, maxTokens, topP },
 *     current:   string
 *   }
 */

const { hermesStream } = require('./hermes');
const store = require('./store');

const DEFAULT_SYSTEM = 'You are Hermes, a helpful assistant. Answer in the user\'s language.';

function pickProvider(cfg) {
  const id = (cfg && cfg.current) || '';
  if (cfg?.anthropic?.model && id === cfg.anthropic.model) return 'anthropic';
  if (cfg?.openai?.model && id === cfg.openai.model) return 'openai';
  if (cfg?.deepseek?.model && id === cfg.deepseek.model) return 'deepseek';
  if (cfg?.local?.model && id === cfg.local.model) return 'local';
  if (/^claude/i.test(id)) return 'anthropic';
  if (/^(gpt|o\d|chatgpt)/i.test(id)) return 'openai';
  if (/^deepseek/i.test(id)) return 'deepseek';
  if (id) return 'local';
  return null;
}

/* ------------------------- SSE / NDJSON stream helpers ------------------------ */

async function* iterLines(response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      yield line;
    }
  }
  if (buf.length) yield buf;
}

async function* iterSSE(response) {
  let event = 'message';
  let dataLines = [];
  for await (const line of iterLines(response)) {
    if (line === '') {
      if (dataLines.length) {
        yield { event, data: dataLines.join('\n') };
      }
      event = 'message';
      dataLines = [];
      continue;
    }
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataLines.length) yield { event, data: dataLines.join('\n') };
}

/* --------------------------------- Anthropic -------------------------------- */

async function* anthropicStream(cfg, messages) {
  const { base = 'https://api.anthropic.com', key, model } = cfg.anthropic || {};
  if (!key) throw new Error('Anthropic API key 未配置');

  let system = '';
  const msgs = [];
  for (const m of messages) {
    if (m.role === 'system') system = (system ? system + '\n\n' : '') + m.content;
    else msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }

  const body = {
    model: model || 'claude-opus-4-7',
    max_tokens: cfg.params?.maxTokens ?? 2048,
    temperature: cfg.params?.temperature ?? 0.7,
    top_p: cfg.params?.topP ?? 1,
    stream: true,
    messages: msgs,
  };
  if (system) body.system = system;

  const resp = await fetch(`${base.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Anthropic ${resp.status}: ${txt.slice(0, 300)}`);
  }

  for await (const frame of iterSSE(resp)) {
    if (frame.event === 'content_block_delta') {
      try {
        const p = JSON.parse(frame.data);
        const t = p?.delta?.text;
        if (t) yield t;
      } catch {}
    } else if (frame.event === 'message_stop') {
      return;
    } else if (frame.event === 'error') {
      throw new Error('Anthropic stream error: ' + frame.data);
    }
  }
}

/* ---------------------------------- OpenAI ---------------------------------- */

async function* openaiStream(cfg, messages) {
  const { base = 'https://api.openai.com/v1', key, model } = cfg.openai || {};
  if (!key) throw new Error('OpenAI API key 未配置');

  const body = {
    model: model || 'gpt-4o',
    stream: true,
    temperature: cfg.params?.temperature ?? 0.7,
    top_p: cfg.params?.topP ?? 1,
    max_tokens: cfg.params?.maxTokens ?? 2048,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  const resp = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 300)}`);
  }

  for await (const frame of iterSSE(resp)) {
    const data = frame.data;
    if (!data || data === '[DONE]') {
      if (data === '[DONE]') return;
      continue;
    }
    try {
      const p = JSON.parse(data);
      const t = p.choices?.[0]?.delta?.content;
      if (t) yield t;
    } catch {}
  }
}

/* --------------------------------- DeepSeek --------------------------------- */

async function* deepseekStream(cfg, messages) {
  const { base = 'https://api.deepseek.com', key, model } = cfg.deepseek || {};
  if (!key) throw new Error('DeepSeek API key 未配置');

  const body = {
    model: model || 'deepseek-chat',
    stream: true,
    temperature: cfg.params?.temperature ?? 0.7,
    top_p: cfg.params?.topP ?? 1,
    max_tokens: cfg.params?.maxTokens ?? 2048,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  const resp = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`DeepSeek ${resp.status}: ${txt.slice(0, 300)}`);
  }

  for await (const frame of iterSSE(resp)) {
    const data = frame.data;
    if (!data || data === '[DONE]') {
      if (data === '[DONE]') return;
      continue;
    }
    try {
      const p = JSON.parse(data);
      const t = p.choices?.[0]?.delta?.content;
      if (t) yield t;
    } catch {}
  }
}

/* ----------------------------- Ollama (local) ------------------------------- */

async function* ollamaStream(cfg, messages) {
  const { base = 'http://127.0.0.1:11434', model } = cfg.local || {};
  const body = {
    model: model || 'qwen2.5:7b',
    stream: true,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    options: {
      temperature: cfg.params?.temperature ?? 0.7,
      top_p: cfg.params?.topP ?? 1,
      num_predict: cfg.params?.maxTokens ?? 2048,
    },
  };

  const resp = await fetch(`${base.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Ollama ${resp.status}: ${txt.slice(0, 300)}`);
  }

  for await (const line of iterLines(resp)) {
    if (!line.trim()) continue;
    try {
      const p = JSON.parse(line);
      const t = p.message?.content;
      if (t) yield t;
      if (p.done) return;
    } catch {}
  }
}

/* --------------------------------- fallback --------------------------------- */

async function* simulateStream(prompt) {
  const reply =
    '【模拟模式】未配置任何 provider，回显：\n> ' + prompt +
    '\n\n请在设置页填入 API Key 或启动本地 Ollama。';
  for (const ch of reply) {
    await new Promise(r => setTimeout(r, 6));
    yield ch;
  }
}

/* --------------------------------- dispatcher ------------------------------- */

async function* chatStream(cfg, messages) {
  cfg = cfg || {};

  // If Hermes CLI mode is enabled, delegate to hermese CLI instead
  const settings = store.read('settings', {});
  if (settings.useHermesCli) {
    const last = messages[messages.length - 1]?.content || '';
    if (!last) {
      yield '[错误] 没有输入内容';
      return;
    }
    try {
      yield* hermesStream(last, messages, { model: settings.hermesModel || '' });
    } catch (e) {
      yield `\n\n[错误] Hermes CLI 调用失败: ${e.message}`;
    }
    return;
  }

  const hasSystem = messages.some(m => m.role === 'system');
  const msgs = hasSystem
    ? messages
    : [{ role: 'system', content: DEFAULT_SYSTEM }, ...messages];

  const provider = pickProvider(cfg);
  try {
    if (provider === 'anthropic') { yield* anthropicStream(cfg, msgs); return; }
    if (provider === 'openai')    { yield* openaiStream(cfg, msgs);    return; }
    if (provider === 'deepseek')  { yield* deepseekStream(cfg, msgs);  return; }
    if (provider === 'local')     { yield* ollamaStream(cfg, msgs);    return; }
  } catch (e) {
    yield `\n\n[错误] ${e.message}`;
    return;
  }
  const last = messages[messages.length - 1]?.content || '';
  yield* simulateStream(last);
}

module.exports = { chatStream };
