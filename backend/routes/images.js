const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('../services/store');
const { redactSecrets } = require('../services/security');
const { chatStream } = require('../services/llm');

const router = express.Router();

const IMAGE_KEY = 'images';
const CHAT_KEY = 'chats';
const IMAGE_ROOT = path.join(store.DATA_DIR, 'images');
const INPUT_DIR = path.join(IMAGE_ROOT, 'inputs');
const OUTPUT_DIR = path.join(IMAGE_ROOT, 'outputs');
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function monthDir(base, now = new Date()) {
  const dir = path.join(base, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  ensureDir(dir);
  return dir;
}

function imageId(prefix = 'img') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function safeName(name = 'image') {
  return String(name || 'image').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 90);
}

function dateStamp(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function promptSlug(prompt = 'image') {
  const clean = safeName(redactSecrets(prompt || 'image'))
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (clean || 'image').slice(0, 42);
}

function compactPrompt(text = '') {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/^(最终提示词|优化后提示词|prompt)\s*[:：]\s*/i, '')
    .trim();
}

function mimeToExt(mime = '') {
  const clean = String(mime).split(';')[0].toLowerCase();
  if (clean.includes('jpeg') || clean.includes('jpg')) return '.jpg';
  if (clean.includes('png')) return '.png';
  if (clean.includes('webp')) return '.webp';
  if (clean.includes('gif')) return '.gif';
  return '.png';
}

function extFromName(name = '', fallbackMime = '') {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return ext;
  return mimeToExt(fallbackMime);
}

function parseDataUrl(dataUrl = '', explicitMime = '') {
  const text = String(dataUrl || '');
  const match = text.match(/^data:([^;,]+)?(;base64)?,([\s\S]+)$/);
  if (match) {
    const mime = match[1] || explicitMime || 'image/png';
    const isBase64 = !!match[2];
    const raw = isBase64 ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
    return { buffer: raw, mime };
  }
  const buffer = Buffer.from(text, 'base64');
  return { buffer, mime: explicitMime || 'image/png' };
}

function readRecords() {
  return store.read(IMAGE_KEY, []);
}

function writeRecords(records) {
  store.write(IMAGE_KEY, records);
}

function publicUrlFor(id) {
  return `/api/images/file/${encodeURIComponent(id)}`;
}

function publicBase(req) {
  const raw = String(req.body?.publicBase || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
}

function toPublicUrl(req, id) {
  const rel = publicUrlFor(id);
  const base = publicBase(req);
  return base ? base + rel : rel;
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function normalizeStoredImagePath(target = '') {
  const text = String(target || '');
  const wsl = text.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (wsl && process.platform === 'win32') {
    return `${wsl[1].toUpperCase()}:\\${wsl[2].replace(/\//g, '\\')}`;
  }
  const win = text.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (win && process.platform !== 'win32') {
    return `/mnt/${win[1].toLowerCase()}/${win[2].replace(/\\/g, '/')}`;
  }
  return text;
}

function existingImagePath(record = {}) {
  const candidates = [
    normalizeStoredImagePath(record.path),
    record.path,
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p)) || '';
}

function addRecord(record) {
  const records = readRecords();
  records.unshift(record);
  writeRecords(records.slice(0, 1000));
  return record;
}

function findRecord(id) {
  return readRecords().find(r => r.id === id);
}

function authHeaders({ key = '', authType = 'bearer', authHeader = '' } = {}, json = true) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (!key) return headers;
  if (authType === 'x-api-key') headers['x-api-key'] = key;
  else if (authType === 'api-key') headers['api-key'] = key;
  else if (authType === 'custom' && authHeader) headers[authHeader] = key;
  else if (authType !== 'none') headers.Authorization = 'Bearer ' + key;
  return headers;
}

function imageEndpoint(base, mode = 'generations') {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/images\/(generations|edits)$/i.test(clean)) {
    return clean.replace(/\/images\/(generations|edits)$/i, `/images/${mode}`);
  }
  if (clean.endsWith('/v1')) return `${clean}/images/${mode}`;
  return `${clean}/v1/images/${mode}`;
}

function resolveImageModel(modelId = 'auto') {
  const cfg = store.read('models', {});
  const lib = Array.isArray(cfg.library) ? cfg.library : [];
  const wanted = modelId && modelId !== 'auto' ? modelId : (cfg.scenarios?.image || '');
  const model = lib.find(m => m.id === wanted || m.name === wanted);
  if (!model) {
    const err = new Error('请先在设置 > 模型配置 > 图像生成 场景中选择一个真实图像模型。');
    err.status = 400;
    throw err;
  }
  if (model.enabled === false) {
    const err = new Error('当前图像模型已被禁用，请先启用后再生成。');
    err.status = 400;
    throw err;
  }
  const fmt = model.apiFormat || 'openai-image';
  if (!['openai-image', 'openai_image'].includes(fmt)) {
    const err = new Error(`当前模型 API 格式是 ${fmt}，图像生成请配置为 OpenAI 图片接口。`);
    err.status = 400;
    throw err;
  }
  return model;
}

async function fetchJsonWithRetry(url, model, body) {
  const headers = authHeaders(model, true);
  const first = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, response_format: body.response_format || 'b64_json' }),
    signal: AbortSignal.timeout(120000),
  });
  if (first.ok) return first.json();
  const firstText = await first.text().catch(() => '');
  if (/response_format|unknown parameter|unsupported/i.test(firstText)) {
    const retryBody = { ...body };
    delete retryBody.response_format;
    const retry = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(retryBody),
      signal: AbortSignal.timeout(120000),
    });
    if (retry.ok) return retry.json();
    const retryText = await retry.text().catch(() => '');
    const error = new Error(`图像接口失败 HTTP ${retry.status}: ${retryText.slice(0, 300)}`);
    error.status = retry.status;
    throw error;
  }
  const error = new Error(`图像接口失败 HTTP ${first.status}: ${firstText.slice(0, 300)}`);
  error.status = first.status;
  throw error;
}

async function fetchMultipartWithRetry(url, model, buildForm) {
  const makeRequest = async (includeResponseFormat) => {
    const form = buildForm(includeResponseFormat);
    return fetch(url, {
      method: 'POST',
      headers: authHeaders(model, false),
      body: form,
      signal: AbortSignal.timeout(120000),
    });
  };
  const first = await makeRequest(true);
  if (first.ok) return first.json();
  const firstText = await first.text().catch(() => '');
  if (/response_format|unknown parameter|unsupported/i.test(firstText)) {
    const retry = await makeRequest(false);
    if (retry.ok) return retry.json();
    const retryText = await retry.text().catch(() => '');
    const error = new Error(`图生图接口失败 HTTP ${retry.status}: ${retryText.slice(0, 300)}`);
    error.status = retry.status;
    throw error;
  }
  const error = new Error(`图生图接口失败 HTTP ${first.status}: ${firstText.slice(0, 300)}`);
  error.status = first.status;
  throw error;
}

function extractImageItems(json = {}) {
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.images)) return json.images;
  if (Array.isArray(json.output)) {
    return json.output.flatMap(item => {
      if (Array.isArray(item.content)) return item.content;
      return [item];
    });
  }
  return [json].filter(Boolean);
}

async function saveGeneratedItem(item, req, meta = {}) {
  const id = imageId('out');
  let buffer = null;
  let mime = 'image/png';
  let sourceUrl = item.url || item.image_url || item.href || '';
  let base64 = item.b64_json || item.base64 || item.image || item.data || '';

  if (!base64 && item.type === 'output_image' && item.image_base64) base64 = item.image_base64;
  if (base64 && /^data:/i.test(base64)) {
    const parsed = parseDataUrl(base64);
    buffer = parsed.buffer;
    mime = parsed.mime;
  } else if (base64 && /^[A-Za-z0-9+/=\s]+$/.test(String(base64).slice(0, 200))) {
    buffer = Buffer.from(String(base64).replace(/\s+/g, ''), 'base64');
  } else if (sourceUrl) {
    const r = await fetch(sourceUrl, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`下载生成图片失败 HTTP ${r.status}`);
    const arr = await r.arrayBuffer();
    buffer = Buffer.from(arr);
    mime = r.headers.get('content-type') || mime;
  }

  if (!buffer || !buffer.length) {
    throw new Error('图像接口没有返回可识别的图片数据。');
  }

  const ext = mimeToExt(mime);
  const dir = monthDir(OUTPUT_DIR);
  const filename = `${dateStamp()}_${promptSlug(meta.sourcePrompt || meta.prompt)}_${id.slice(-6)}${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return addRecord({
    id,
    kind: 'output',
    filename,
    originalName: filename,
    mime,
    size: buffer.length,
    path: filePath,
    url: publicUrlFor(id),
    publicUrl: toPublicUrl(req, id),
    prompt: meta.prompt || '',
    sourcePrompt: meta.sourcePrompt || '',
    model: meta.model || '',
    provider: meta.provider || '',
    inputs: meta.inputs || [],
    revisedPrompt: item.revised_prompt || item.revisedPrompt || '',
    sourceUrl,
    createdAt: Date.now(),
  });
}

router.post('/optimize-prompt', async (req, res) => {
  const {
    prompt = '',
    userPrompt = '',
    previousPrompt = '',
    attachments = [],
    model = 'auto',
    profileName = '默认助手',
    profilePrompt = '',
  } = req.body || {};
  const cleanPrompt = redactSecrets(String(prompt || userPrompt || '').trim());
  if (!cleanPrompt) return res.fail('prompt required', 400, 400);

  const attachmentText = Array.isArray(attachments) && attachments.length
    ? attachments.slice(0, 6).map((img, i) => `${i + 1}. ${img.name || '参考图'} ${img.kind || 'input'} ${img.path || ''}`.trim()).join('\n')
    : '无参考图';
  const messages = [
    {
      role: 'system',
      content: [
        '你是 Hermes Agent 的图像生成提示词优化助手。',
        '任务：在不改变用户核心意图的前提下，把用户的中文需求整理成更适合图像生成模型执行的提示词。',
        '严格要求：不要编造用户没有要求的主体、文字、品牌、人物身份；可以补充构图、光线、风格、材质、镜头、质量要求。',
        '如果是二次改图，要保留上一张图的主体连续性，并把本轮修改明确写进去。',
        '这是纯文本提示词优化任务，不要调用工具，不要执行命令，不要写文件，不要输出代码。',
        '只输出最终提示词，不要 Markdown，不要解释过程，不要编号。',
        profilePrompt ? `当前 Agent：${profileName}\n${String(profilePrompt).slice(0, 2000)}` : `当前 Agent：${profileName}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `用户原始需求：${String(userPrompt || prompt).slice(0, 1200)}`,
        previousPrompt ? `上一轮提示词：${String(previousPrompt).slice(0, 1200)}` : '',
        `本轮合成提示词草稿：${cleanPrompt.slice(0, 2200)}`,
        `参考图片：\n${attachmentText}`,
      ].filter(Boolean).join('\n\n'),
    },
  ];

  const cfg = store.read('models', {});
  cfg._scene = 'reasoning';
  if (model && model !== 'auto') cfg._requestedModel = model;
  let full = '';
  let err = '';

  try {
    for await (const event of chatStream(cfg, messages)) {
      if (event.type === 'token') full += redactSecrets(event.text || '');
      if (event.type === 'error') err += redactSecrets(event.text || '');
    }
    const optimized = compactPrompt(full);
    res.ok({
      prompt: optimized || cleanPrompt,
      sourcePrompt: redactSecrets(String(userPrompt || prompt || '').trim()),
      usedAgent: !!optimized && optimized !== cleanPrompt,
      fallback: !optimized,
      error: err.slice(0, 300),
    });
  } catch (e) {
    res.ok({
      prompt: cleanPrompt,
      sourcePrompt: redactSecrets(String(userPrompt || prompt || '').trim()),
      usedAgent: false,
      fallback: true,
      error: redactSecrets(e.message || 'optimize failed'),
    });
  }
});

function appendChatMessages(chatId, userContent, assistantContent, modelName, imageRecords) {
  if (!chatId) return null;
  const chats = store.read(CHAT_KEY, []);
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return null;
  const now = Date.now();
  chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
  chat.messages.push({ role: 'user', content: redactSecrets(userContent), ts: now, attachments: imageRecords.inputs || [] });
  chat.messages.push({
    role: 'assistant',
    content: redactSecrets(assistantContent),
    ts: Date.now(),
    imageGeneration: {
      model: modelName,
      outputs: imageRecords.outputs || [],
      inputs: imageRecords.inputs || [],
    },
  });
  if (!chat.title || chat.title === '新建对话') chat.title = redactSecrets(userContent).replace(/\s+/g, ' ').slice(0, 24) || '图像生成';
  chat.model = modelName || chat.model;
  chat.updatedAt = Date.now();
  store.write(CHAT_KEY, chats);
  return chat;
}

router.post('/upload', (req, res) => {
  const { dataUrl, base64, mime, fileName, source = 'upload' } = req.body || {};
  if (!dataUrl && !base64) return res.fail('image data required', 400, 400);
  try {
    const parsed = parseDataUrl(dataUrl || base64, mime);
    if (!String(parsed.mime || '').startsWith('image/')) return res.fail('只支持上传图片文件', 400, 400);
    if (parsed.buffer.length > MAX_UPLOAD_BYTES) return res.fail('图片过大，请控制在 25MB 以内', 413, 413);
    const id = imageId('in');
    const ext = extFromName(fileName, parsed.mime);
    const filename = `${id}${ext}`;
    const dir = monthDir(INPUT_DIR);
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, parsed.buffer);
    const record = addRecord({
      id,
      kind: 'input',
      filename,
      originalName: safeName(fileName || filename),
      mime: parsed.mime,
      size: parsed.buffer.length,
      path: filePath,
      url: publicUrlFor(id),
      publicUrl: toPublicUrl(req, id),
      source,
      createdAt: Date.now(),
    });
    res.ok(record);
  } catch (e) {
    res.fail(e.message || 'upload failed', 500, 500);
  }
});

router.post('/generate', async (req, res) => {
  const { prompt = '', sourcePrompt = '', optimizedByAgent = false, attachmentIds = [], model = 'auto', size = '1024x1024', chatId = '' } = req.body || {};
  const cleanPrompt = redactSecrets(String(prompt || '').trim());
  const cleanSourcePrompt = redactSecrets(String(sourcePrompt || prompt || '').trim());
  const inputIds = Array.isArray(attachmentIds) ? attachmentIds : [];
  if (!cleanPrompt && inputIds.length === 0) return res.fail('prompt or image attachment required', 400, 400);

  try {
    const selectedModel = resolveImageModel(model);
    const records = readRecords();
    const inputs = inputIds
      .map(id => records.find(r => r.id === id))
      .map(r => {
        const filePath = r ? existingImagePath(r) : '';
        return filePath ? { ...r, path: filePath } : null;
      })
      .filter(r => r && ['input', 'output'].includes(r.kind) && isInside(IMAGE_ROOT, r.path));
    const finalPrompt = cleanPrompt || '请基于上传图片生成一张新的图片。';
    let json;

    if (inputs.length > 0) {
      const url = imageEndpoint(selectedModel.base, 'edits');
      if (!url) return res.fail('image edit url missing', 400, 400);
      json = await fetchMultipartWithRetry(url, selectedModel, (includeResponseFormat) => {
        const form = new FormData();
        form.append('model', selectedModel.name);
        form.append('prompt', finalPrompt);
        form.append('n', '1');
        form.append('size', size || '1024x1024');
        if (includeResponseFormat) form.append('response_format', 'b64_json');
        inputs.forEach((input, index) => {
          const buffer = fs.readFileSync(input.path);
          const blob = new Blob([buffer], { type: input.mime || 'image/png' });
          form.append(index === 0 ? 'image' : `image_${index}`, blob, input.originalName || input.filename || `input_${index}.png`);
        });
        return form;
      });
    } else {
      const url = imageEndpoint(selectedModel.base, 'generations');
      if (!url) return res.fail('image generation url missing', 400, 400);
      json = await fetchJsonWithRetry(url, selectedModel, {
        model: selectedModel.name,
        prompt: finalPrompt,
        n: 1,
        size: size || '1024x1024',
      });
    }

    const items = extractImageItems(json);
    const outputs = [];
    for (const item of items) {
      if (outputs.length >= 4) break;
      try {
        outputs.push(await saveGeneratedItem(item, req, {
          prompt: finalPrompt,
          sourcePrompt: cleanSourcePrompt,
          model: selectedModel.name,
          provider: selectedModel.provider,
          inputs: inputs.map(i => ({ id: i.id, path: i.path, url: i.url, publicUrl: toPublicUrl(req, i.id), name: i.originalName })),
        }));
      } catch (e) {
        if (!outputs.length) throw e;
      }
    }
    if (!outputs.length) throw new Error('没有生成可保存的图片。');

    const imageMd = outputs.map((img, i) => `![生成图片 ${i + 1}](${toPublicUrl(req, img.id)})`).join('\n\n');
    const assistantContent = `已生成图片：\n\n${imageMd}`;
    const inputMd = inputs.length
      ? `\n\n参考图片：\n${inputs.map(img => `![${img.originalName || img.filename}](${toPublicUrl(req, img.id)})\n本地路径：${img.path}`).join('\n\n')}`
      : '';
    const userContent = `图像生成：${cleanSourcePrompt || finalPrompt}${optimizedByAgent && cleanSourcePrompt !== finalPrompt ? `\n\nAgent 优化提示词：${finalPrompt}` : ''}${inputMd}`;
    const chat = appendChatMessages(chatId, userContent, assistantContent, selectedModel.name, {
      inputs: inputs.map(i => ({ id: i.id, path: i.path, url: i.url, publicUrl: toPublicUrl(req, i.id), name: i.originalName })),
      outputs: outputs.map(o => ({ id: o.id, path: o.path, url: o.url, publicUrl: o.publicUrl, name: o.filename, prompt: o.prompt, sourcePrompt: o.sourcePrompt })),
    });

    res.ok({
      model: selectedModel.name,
      provider: selectedModel.provider,
      prompt: finalPrompt,
      sourcePrompt: cleanSourcePrompt,
      optimizedByAgent: !!optimizedByAgent,
      inputs,
      outputs,
      content: assistantContent,
      chat: chat ? { id: chat.id, title: chat.title, updatedAt: chat.updatedAt, messageCount: chat.messages?.length || 0 } : null,
    });
  } catch (e) {
    res.fail(e.message || 'image generation failed', e.status || 500, e.status || 500);
  }
});

router.get('/file/:id', (req, res) => {
  const record = findRecord(req.params.id);
  const filePath = record ? existingImagePath(record) : '';
  if (!record || !filePath) return res.status(404).send('not found');
  const resolved = path.resolve(filePath);
  if (!isInside(IMAGE_ROOT, resolved)) return res.status(403).send('forbidden');
  res.setHeader('Content-Type', record.mime || 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(resolved);
});

router.get('/', (_req, res) => {
  res.ok(readRecords().map(r => ({
    id: r.id,
    kind: r.kind,
    name: r.originalName || r.filename,
    mime: r.mime,
    size: r.size,
    path: r.path,
    url: r.url,
    createdAt: r.createdAt,
    prompt: r.prompt,
    sourcePrompt: r.sourcePrompt,
    model: r.model,
    provider: r.provider,
  })));
});

module.exports = router;
