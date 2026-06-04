const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('../services/store');
const paths = require('../services/paths');
const { redactSecrets } = require('../services/security');
const { directApiStream } = require('../services/llm');
const { captureKnowledge } = require('../services/knowledgeCapture');

const router = express.Router();
const IMAGE_API_TIMEOUT_MS = Math.max(120000, Number(process.env.WEBUI_IMAGE_API_TIMEOUT_MS || 600000));
const IMAGE_DOWNLOAD_TIMEOUT_MS = Math.max(60000, Number(process.env.WEBUI_IMAGE_DOWNLOAD_TIMEOUT_MS || 180000));


function captureImageGenerationRecord({ sourcePrompt = '', prompt = '', inputs = [], outputs = [], model = '', provider = '', mode = '', chatId = '', optimizedByAgent = false } = {}) {
  try {
    const rawTitle = String(sourcePrompt || prompt || 'image-generation').replace(/\s+/g, ' ').trim().slice(0, 40) || 'image-generation';
    const title = 'Image Generation - ' + rawTitle;
    const outputLines = (outputs || []).map((img, index) => [
      '### Output ' + (index + 1),
      img.publicUrl ? ('![output ' + (index + 1) + '](' + img.publicUrl + ')') : '',
      '- localPath: ' + (img.path || ''),
      '- id: ' + (img.id || ''),
    ].filter(Boolean).join('\n')).join('\n\n') || 'None';
    const inputLines = (inputs || []).map((img, index) => [
      '### Reference ' + (index + 1),
      img.publicUrl ? ('![reference ' + (index + 1) + '](' + img.publicUrl + ')') : '',
      '- name: ' + (img.name || img.originalName || img.filename || ''),
      '- localPath: ' + (img.path || ''),
      '- id: ' + (img.id || ''),
    ].filter(Boolean).join('\n')).join('\n\n') || 'None';
    const content = [
      '# ' + title,
      '',
      '## Original Prompt',
      sourcePrompt || prompt || 'None',
      '',
      '## Final Prompt',
      prompt || 'None',
      '',
      '## Output Images',
      outputLines,
      '',
      '## Reference Images',
      inputLines,
      '',
      '## Metadata',
      '- model: ' + model,
      '- provider: ' + provider,
      '- mode: ' + mode,
      '- optimizedByAgent: ' + (optimizedByAgent ? 'true' : 'false'),
      '- chatId: ' + (chatId || ''),
      '- createdAt: ' + new Date().toISOString(),
    ].join('\n');
    captureKnowledge({ title, folder: 'images', type: 'image-generation', kind: 'image-generation', tags: ['auto-capture', 'image-generation'], source: 'image-generation', status: 'auto', content });
  } catch (_) {}
}
function modelConfigForScope(scope = 'webui') {
  const root = store.read('models', {});
  if (root && typeof root === 'object' && (root.webui || root.agent)) {
    return { ...(root[scope] || root.webui || root.agent || {}) };
  }
  return { ...(root || {}) };
}

function imageModelConfig() {
  const root = store.read('models', {});
  if (!root || typeof root !== 'object' || (!root.webui && !root.agent)) return modelConfigForScope('webui');
  const webui = root.webui || {};
  const agent = root.agent || {};
  const webuiLibrary = Array.isArray(webui.library) ? webui.library : [];
  const agentLibrary = Array.isArray(agent.library) ? agent.library : [];
  const webuiHasImage = !!webui.scenarios?.image || webuiLibrary.some(isImageLibraryModel);
  if (webuiHasImage) return { ...webui };
  return { ...agent, library: agentLibrary };
}

const IMAGE_KEY = 'images';
const CHAT_KEY = 'chats';
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
    .replace(/(?:^|\n)\s*⚠?\s*Normalized model .*? for deepseek\.?\s*(?=\n|$)/gi, '\n')
    .replace(/^⚠?\s*Normalized model .*? for deepseek\.?\s*/i, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/^(最终提示词|优化后的提示词|final prompt|optimized prompt|prompt)\s*[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PROTECTED_IMAGE_TERMS = [
  { re: /阿尼亚|anya/i, canonical: 'Anya Forger (阿尼亚), from Spy x Family' },
  { re: /初音未来|miku/i, canonical: 'Hatsune Miku (初音未来)' },
  { re: /五条悟/i, canonical: 'Satoru Gojo (五条悟), from Jujutsu Kaisen' },
  { re: /路飞/i, canonical: 'Monkey D. Luffy (路飞), from One Piece' },
];

function protectImagePromptTerms(source = '', optimized = '') {
  let prompt = String(optimized || '').trim();
  const raw = String(source || '');
  if (!prompt) return prompt;
  const missing = PROTECTED_IMAGE_TERMS
    .filter(item => item.re.test(raw) && !item.re.test(prompt) && !prompt.includes(item.canonical))
    .map(item => item.canonical);
  if (missing.length) prompt = `${missing.join(', ')}, ${prompt}`;
  return dedupePromptText(prompt);
}

function dedupePromptText(prompt = '') {
  let text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text.replace(/(Anya Forger \(阿尼亚\), from Spy x Family,\s*){2,}/gi, 'Anya Forger (阿尼亚), from Spy x Family, ');
  text = text.replace(/(Anya Forger \(阿尼亚\), from Spy x Family[^。.!?；;]{8,120})(?:[。.!?；;,\s]+影感|[。.!?；;,\s]+电影质感)?[。.!?；;,\s]+\1/gi, '$1');
  const chunks = text
    .split(/(?<=[。.!?；;])\s+|[，,]\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const chunk of chunks) {
    const key = chunk
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/^(and|with|the)\s+/i, '')
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(chunk);
  }
  return out.join(', ');
}

function isBadOptimizedPrompt(prompt = '') {
  const text = String(prompt || '').trim();
  if (!text) return true;
  if (/!\[[^\]]*]\([^)]+\)/.test(text)) return true;
  if (/https?:\/\/|\/api\/images\/file\//i.test(text)) return true;
  if (/Normalized model|deepseek-chat|Provider:|HTTP \d{3}/i.test(text)) return true;
  if (/^(图片已生成|已生成图片|图像生成失败|Error:)/i.test(text)) return true;
  return false;
}

function pickTextModelId(cfg = {}, requested = '') {
  const library = Array.isArray(cfg.library) ? cfg.library : [];
  const usable = id => {
    if (!id || id === 'auto') return '';
    const item = library.find(m => m.enabled !== false && (m.id === id || m.name === id));
    if (!item) return id;
    return (item.apiFormat || 'openai-chat') === 'openai-chat' ? (item.id || item.name || id) : '';
  };
  return usable(requested)
    || usable(cfg.scenarios?.reasoning)
    || usable(cfg.scenarios?.chat)
    || usable(cfg.current)
    || (library.find(m => m.enabled !== false && (m.apiFormat || 'openai-chat') === 'openai-chat')?.id || '');
}

function localImagePromptFallback(source = '', mode = 'text-to-image') {
  const raw = redactSecrets(String(source || '').trim());
  let prompt = raw
    .replace(/^图像生成\s*[:：]\s*/i, '')
    .replace(/^生成\s*/i, '')
    .replace(/^一张\s*/i, '')
    .trim();
  prompt = protectImagePromptTerms(raw, prompt);
  if (/阿尼亚|anya/i.test(raw)) {
    prompt = prompt
      .replace(/阿尼亚/g, 'Anya Forger (阿尼亚), from Spy x Family, ')
      .replace(/,\s*([，,。])/g, '$1')
      .replace(/Anya Forger \(阿尼亚\), from Spy x Family[，,]\s*Anya Forger \(阿尼亚\), from Spy x Family/gi, 'Anya Forger (阿尼亚), from Spy x Family');
  }
  const base = mode === 'image-to-image'
    ? [
      'Use the provided reference image as the visual basis',
      prompt,
      'preserve the main subject, identity, composition, pose, layout, color mood, and visual style from the reference image',
      'apply only the user requested changes',
      'keep unchanged areas consistent with the reference image',
      'high quality, coherent details, natural lighting',
    ]
    : [
      prompt,
      'anime illustration style',
      'preserve the exact named character identity and outfit described by the user',
      'clear subject focus, coherent composition, high quality, detailed, vibrant natural lighting',
      'avoid changing the requested character, scene, clothing, animals, or action',
    ];
  return dedupePromptText(base.filter(Boolean).join(', '));
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

function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.slice(0, 6).toString('ascii') === 'GIF87a' || buffer.slice(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  return '';
}

function assertValidImageBuffer(buffer, source = 'image') {
  const mime = detectImageMime(buffer);
  if (!mime) {
    const head = Buffer.isBuffer(buffer) ? buffer.slice(0, 80).toString('utf8').replace(/\s+/g, ' ').trim() : '';
    throw new Error(`${source} did not return a valid image file${head ? `: ${head.slice(0, 80)}` : ''}`);
  }
  return mime;
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

function isInsideImageRoot(target) {
  const full = path.resolve(target);
  const roots = [paths.imageRoot(), path.join(store.DATA_DIR, 'images')].map(item => path.resolve(item));
  return roots.some(root => full === root || isInside(root, full));
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

function imageRelativePath(record = {}) {
  if (record.relativePath) return String(record.relativePath);
  if (!record.path) return '';
  const stored = path.resolve(normalizeStoredImagePath(record.path));
  const legacyRoot = path.resolve(path.join(store.DATA_DIR, 'images'));
  const currentRoot = path.resolve(paths.imageRoot());
  for (const root of [currentRoot, legacyRoot]) {
    const rel = path.relative(root, stored);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  }
  return '';
}

function imagePathFromRelative(rel = '') {
  return rel ? path.join(paths.imageRoot(), rel) : '';
}

function existingImagePath(record = {}) {
  const candidates = [
    imagePathFromRelative(imageRelativePath(record)),
    normalizeStoredImagePath(record.path),
    record.kind === 'input' && record.filename ? path.join(paths.imageInputDir(), record.filename) : '',
    record.kind === 'output' && record.filename ? path.join(paths.imageOutputDir(), record.filename) : '',
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

function isImageLibraryModel(model = {}) {
  const tags = Array.isArray(model.tags) ? model.tags.map(t => String(t).toLowerCase()) : [];
  return ['openai-image', 'openai_image'].includes(model.apiFormat)
    || model.kind === 'image'
    || (tags.includes('image') && !tags.includes('vision'));
}

function resolveImageModel(modelId = 'auto') {
  const cfg = imageModelConfig();
  const lib = Array.isArray(cfg.library) ? cfg.library : [];
  const wanted = modelId && modelId !== 'auto' ? modelId : (cfg.scenarios?.image || '');
  const imageModels = lib.filter(m => m.enabled !== false && isImageLibraryModel(m));
  let model = lib.find(m => m.id === wanted || m.name === wanted);
  if (!model && imageModels.length) model = imageModels[0];
  if (!model) {
    const err = new Error('WebUI image generation is not configured yet. Please open Settings > Model Configuration, add an OpenAI Image compatible model, and bind it to the Image Generation scenario.');
    err.status = 400;
    throw err;
  }
  if (model.enabled === false) {
    if (imageModels.length) return imageModels[0];
    const err = new Error('The configured WebUI image model is disabled. Please enable an image model before generating images.');
    err.status = 400;
    throw err;
  }
  const fmt = model.apiFormat || 'openai-image';
  if (!['openai-image', 'openai_image'].includes(fmt)) {
    if (imageModels.length) return imageModels[0];
    const err = new Error(`The Image Generation scenario is bound to ${model.name || model.id}, but its API format is ${fmt}. Please switch it to an OpenAI Image compatible model.`);
    err.status = 400;
    throw err;
  }
  return model;
}

function resolveImageModels(modelId = 'auto') {
  const cfg = imageModelConfig();
  const lib = Array.isArray(cfg.library) ? cfg.library : [];
  const imageModels = lib.filter(m => m.enabled !== false && isImageLibraryModel(m));
  const primary = resolveImageModel(modelId);
  const seen = new Set();
  return [primary, ...imageModels].filter(m => {
    const key = m?.id || `${m?.provider || ''}:${m?.name || ''}:${m?.base || ''}`;
    if (!m || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function providerLabel(model = {}) {
  return [model.provider, model.name].filter(Boolean).join(' / ') || model.id || '图像模型';
}

function isTransientImageError(error = {}) {
  const status = Number(error.status || error.code || 0);
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function shouldFallbackImageEditToGeneration(error = {}) {
  const status = Number(error.status || error.code || 0);
  const message = String(error.message || '').toLowerCase();
  if ([400, 401, 403, 404, 405, 408, 409, 415, 422, 425, 429, 500, 502, 503, 504, 524].includes(status)) return true;
  return /edit api failed|unsupported|not found|invalid token|missing.*image|invalid.*image|multipart|timeout|timed out|field/i.test(message);
}

function buildImageToImageFallbackPrompt(prompt = '') {
  const clean = redactSecrets(String(prompt || '').trim());
  const prefix = [
    'Use the provided reference image as the visual basis',
    'preserve the main subject, identity, composition, pose, layout, color mood, and visual style from the reference image',
    'apply only the requested changes and keep unrelated areas consistent with the reference image',
  ].join(', ');
  if (!clean) return prefix;
  if (/use the provided reference image as the visual basis|preserve the main subject|reference image/i.test(clean)) return clean;
  return `${prefix}, ${clean}`;
}

async function fetchJsonWithRetry(url, model, body) {
  const headers = authHeaders(model, true);
  const first = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, response_format: body.response_format || 'b64_json' }),
    signal: AbortSignal.timeout(IMAGE_API_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(IMAGE_API_TIMEOUT_MS),
    });
    if (retry.ok) return retry.json();
    const retryText = await retry.text().catch(() => '');
    const error = new Error(`Image API failed HTTP ${retry.status}: ${retryText.slice(0, 300)}`);
    error.status = retry.status;
    throw error;
  }
  const error = new Error(`Image API failed HTTP ${first.status}: ${firstText.slice(0, 300)}`);
  error.status = first.status;
  throw error;
}

async function fetchMultipartWithRetry(url, model, buildForm) {
  const makeRequest = async (includeResponseFormat, imageFieldMode = 'indexed') => {
    const form = buildForm(includeResponseFormat, imageFieldMode);
    return fetch(url, {
      method: 'POST',
      headers: authHeaders(model, false),
      body: form,
      signal: AbortSignal.timeout(IMAGE_API_TIMEOUT_MS),
    });
  };
  const attempts = [
    { includeResponseFormat: true, imageFieldMode: 'indexed' },
    { includeResponseFormat: false, imageFieldMode: 'indexed' },
    { includeResponseFormat: false, imageFieldMode: 'repeat' },
    { includeResponseFormat: false, imageFieldMode: 'array' },
  ];
  let lastStatus = 500;
  let lastText = '';
  for (const attempt of attempts) {
    const response = await makeRequest(attempt.includeResponseFormat, attempt.imageFieldMode);
    if (response.ok) return response.json();
    lastStatus = response.status;
    lastText = await response.text().catch(() => '');
    if (!/response_format|unknown parameter|unsupported|image_\d+|image\[\]|missing.*image|invalid.*image|field/i.test(lastText)) break;
  }
  const error = new Error(`Image edit API failed HTTP ${lastStatus}: ${lastText.slice(0, 300)}`);
  error.status = lastStatus;
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
    const r = await fetch(sourceUrl, { signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`Download generated image failed HTTP ${r.status}`);
    const contentType = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const arr = await r.arrayBuffer();
    buffer = Buffer.from(arr);
    mime = contentType || mime;
  }

  if (!buffer || !buffer.length) {
    throw new Error('Image API did not return recognizable image data.');
  }
  const detectedMime = assertValidImageBuffer(buffer, sourceUrl || 'Image API');
  if (!String(mime || '').toLowerCase().startsWith('image/') || detectImageMime(buffer) !== mime) {
    mime = detectedMime;
  }

  const ext = mimeToExt(mime);
  const dir = monthDir(paths.imageOutputDir());
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
    relativePath: path.relative(paths.imageRoot(), filePath),
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

const IMAGE2_DIR = path.resolve(process.env.HERMES_IMAGE2_SKILL_DIR || '/mnt/e/AI/记忆/skills/image2');

function readTextIfExists(filePath, maxChars = 12000) {
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').slice(0, maxChars).trim();
  } catch (_) {
    return '';
  }
}

function readImage2SkillContext() {
  const skill = readTextIfExists(path.join(IMAGE2_DIR, 'SKILL.md'), 14000);
  const preferences = readTextIfExists(path.join(IMAGE2_DIR, 'preferences.md'), 8000);
  return { skill, preferences, path: IMAGE2_DIR };
}

function defaultImagePromptRules() {
  return [
    '你是 Hermes Agent 的图像生成提示词优化助手。',
    '任务：在不改变用户核心意图的前提下，把用户的中文需求整理成更适合图像生成模型执行的提示词。',
    '必须保留用户输入中的具体人物、角色、IP、作品名、品牌名、产品名、地点名和专有名词；不要泛化、不要替换、不要删除。',
    '例如：阿尼亚不能改成 a young girl with pink hair；应该保留为 Anya Forger (阿尼亚), from Spy x Family。',
    '可以补充构图、光影、风格、材质、镜头、色彩、质量要求，但不能改变主体身份。',
    '如果是二次改图，要保留上一张图的主体连续性，并把本轮修改明确写进去。',
    '这是纯文本提示词优化任务，不要调用工具，不要执行命令，不要写文件，不要输出代码。',
    '只输出最终提示词，不要 Markdown，不要解释过程，不要编号，不要输出模型日志。',
    '如果输出中出现 Normalized model 等系统日志，必须删除。',
  ].join('\n');
}

function imagePromptModeRules(mode = 'text-to-image') {
  if (mode === 'image-to-image') {
    return [
      '当前任务类型：IMAGE TO IMAGE / 图生图 / 基于参考图编辑。',
      '必须把用户上传或选择的参考图作为视觉基础。',
      '提示词要明确要求：preserve the main subject, identity, composition, pose, layout, color mood, and visual style from the reference image。',
      '只执行用户本轮要求的修改；没有要求修改的部分应保持与参考图一致。',
      '如果用户说“改、换、加、去掉、优化、保持、参考、基于”，要写成编辑指令，而不是重新发明一张无关新图。',
      '不要把参考图描述成普通附件；要写出 use the provided reference image as the visual basis。',
    ].join('\n');
  }
  return [
    '当前任务类型：TEXT TO IMAGE / 文生图。',
    '根据用户文字创建新图，扩展主体、场景、构图、光影、风格、材质、质量要求。',
    '不得引入与用户需求冲突的新主体或新场景。',
  ].join('\n');
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
  const promptMode = Array.isArray(attachments) && attachments.length ? 'image-to-image' : 'text-to-image';
  const image2 = readImage2SkillContext();
  const messages = [
    {
      role: 'system',
      content: [
        image2.skill ? `[image2/SKILL.md]\n${image2.skill}` : defaultImagePromptRules(),
        image2.preferences ? `[image2/preferences.md]\n${image2.preferences}` : '',
        [
          '硬性输出格式：只返回一段用于图像生成模型的提示词。',
          '禁止调用任何图片生成工具。',
          '禁止返回 Markdown 图片、URL、文件路径、接口地址、模型日志、解释文字。',
          '如果你已经生成了图片，也必须忽略图片结果，只输出优化后的文本提示词。',
        ].join('\n'),
        imagePromptModeRules(promptMode),
        profilePrompt ? `当前 Agent：${profileName}\n${String(profilePrompt).slice(0, 2000)}` : `当前 Agent：${profileName}`,
      ].filter(Boolean).join('\n\n'),
    },
    {
      role: 'user',
      content: [
        `用户原始需求：${String(userPrompt || prompt).slice(0, 1200)}`,
        previousPrompt ? `上一轮提示词：${String(previousPrompt).slice(0, 1200)}` : '',
        cleanPrompt !== String(userPrompt || prompt).trim() ? `本轮合成提示词草稿（仅供参考，不要重复拼接）：${cleanPrompt.slice(0, 2200)}` : '',
        `参考图片：\n${attachmentText}`,
        '请基于“用户原始需求”输出一版去重后的最终提示词；不要把原始需求、草稿、上一轮提示词重复拼接。',
      ].filter(Boolean).join('\n\n'),
    },
  ];

  const cfg = modelConfigForScope('webui');
  cfg._scene = 'reasoning';
  cfg._requestedModel = pickTextModelId(cfg, model && model !== 'auto' ? model : '');
  cfg.params = { ...(cfg.params || {}), temperature: 0.35, maxTokens: Math.min(Number(cfg.params?.maxTokens || 1200), 1200) };
  if (!cfg._requestedModel) {
    const optimized = localImagePromptFallback([userPrompt, prompt, previousPrompt].filter(Boolean).join('\n'), promptMode);
    return res.ok({
      prompt: optimized || cleanPrompt,
      sourcePrompt: redactSecrets(String(userPrompt || prompt || '').trim()),
      usedOptimizer: false,
      fallback: true,
      error: '未配置可用于 WebUI image optimizer 的文本模型，已使用本地 image2 规则兜底。',
      skill: image2.skill ? 'webui-image-rules' : 'webui-image-default',
      skillPath: image2.skill ? image2.path : '',
      mode: promptMode,
    });
  }
  let full = '';
  let err = '';

  try {
    for await (const event of directApiStream(cfg, messages)) {
      if (event.type === 'token') full += redactSecrets(event.text || '');
      if (event.type === 'error') err += redactSecrets(event.text || '');
    }
    const sourceForProtection = [userPrompt, prompt, cleanPrompt].filter(Boolean).join('\n');
    const rawOptimized = protectImagePromptTerms(sourceForProtection, compactPrompt(full));
    const optimized = dedupePromptText(isBadOptimizedPrompt(rawOptimized) ? localImagePromptFallback(sourceForProtection, promptMode) : rawOptimized);
    res.ok({
      prompt: optimized || cleanPrompt,
      sourcePrompt: redactSecrets(String(userPrompt || prompt || '').trim()),
      usedOptimizer: !!optimized && optimized !== cleanPrompt && !isBadOptimizedPrompt(rawOptimized),
      fallback: isBadOptimizedPrompt(rawOptimized),
      error: err.slice(0, 300),
      skill: image2.skill ? 'webui-image-rules' : 'webui-image-default',
      skillPath: image2.skill ? image2.path : '',
      mode: promptMode,
    });
  } catch (e) {
    const optimized = dedupePromptText(localImagePromptFallback([userPrompt, prompt, previousPrompt].filter(Boolean).join('\n'), promptMode));
    res.ok({
      prompt: optimized || cleanPrompt,
      sourcePrompt: redactSecrets(String(userPrompt || prompt || '').trim()),
      usedOptimizer: false,
      fallback: true,
      error: redactSecrets(e.message || 'optimize failed'),
      skill: 'webui-image-fallback',
      skillPath: '',
      mode: promptMode,
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
  const userMsg = { role: 'user', content: redactSecrets(userContent), ts: now, attachments: imageRecords.inputs || [] };
  if (imageRecords.userMsgId) userMsg._msgId = String(imageRecords.userMsgId);
  chat.messages.push(userMsg);
  chat.messages.push({
    role: 'assistant',
    content: redactSecrets(assistantContent),
    ts: Date.now(),
    _msgId: imageRecords.assistantMsgId ? String(imageRecords.assistantMsgId) : undefined,
    imageGeneration: {
      model: modelName,
      outputs: imageRecords.outputs || [],
      inputs: imageRecords.inputs || [],
      prompt: imageRecords.prompt || '',
      sourcePrompt: imageRecords.sourcePrompt || '',
      optimizedByAgent: !!imageRecords.optimizedByAgent,
      mode: imageRecords.mode || '',
      optimizeSkill: imageRecords.optimizeSkill || '',
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
    const dir = monthDir(paths.imageInputDir());
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
      relativePath: path.relative(paths.imageRoot(), filePath),
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

async function generateImageFromPrompt({ prompt = '', sourcePrompt = '', optimizedByAgent = false, attachmentIds = [], model = 'auto', size = '1024x1024', chatId = '', publicBase = '', userMsgId = '', assistantMsgId = '' } = {}) {
  const cleanPrompt = redactSecrets(String(prompt || '').trim());
  const cleanSourcePrompt = redactSecrets(String(sourcePrompt || prompt || '').trim());
  const inputIds = Array.isArray(attachmentIds) ? attachmentIds : [];
  if (!cleanPrompt && inputIds.length === 0) {
    const err = new Error('prompt or image attachment required');
    err.status = 400;
    throw err;
  }

  const reqLike = { body: { publicBase } };
  const candidateModels = resolveImageModels(model);
  let selectedModel = candidateModels[0];
  const records = readRecords();
  const inputs = inputIds
    .map(id => records.find(r => r.id === id))
    .map(r => {
      const filePath = r ? existingImagePath(r) : '';
      return filePath ? { ...r, path: filePath } : null;
    })
    .filter(r => r && ['input', 'output'].includes(r.kind) && isInsideImageRoot(r.path));
  const finalPrompt = cleanPrompt || '请基于参考图片生成一张新的图片。';
  let json;
  const failures = [];
  let usedImageEditFallback = false;
  let imageEditFailures = [];
  for (const candidate of candidateModels) {
    selectedModel = candidate;
    try {
      if (inputs.length > 0) {
        const url = imageEndpoint(candidate.base, 'edits');
        if (!url) {
          const err = new Error('image edit url missing');
          err.status = 400;
          throw err;
        }
        json = await fetchMultipartWithRetry(url, candidate, (includeResponseFormat, imageFieldMode = 'indexed') => {
          const form = new FormData();
          form.append('model', candidate.name);
          form.append('prompt', finalPrompt);
          form.append('n', '1');
          form.append('size', size || '1024x1024');
          if (includeResponseFormat) form.append('response_format', 'b64_json');
          inputs.forEach((input, index) => {
            const buffer = fs.readFileSync(input.path);
            const blob = new Blob([buffer], { type: input.mime || 'image/png' });
            const fieldName = imageFieldMode === 'repeat'
              ? 'image'
              : (imageFieldMode === 'array' ? 'image[]' : (index === 0 ? 'image' : `image_${index}`));
            form.append(fieldName, blob, input.originalName || input.filename || `input_${index}.png`);
          });
          return form;
        });
      } else {
        const url = imageEndpoint(candidate.base, 'generations');
        if (!url) {
          const err = new Error('image generation url missing');
          err.status = 400;
          throw err;
        }
        json = await fetchJsonWithRetry(url, candidate, {
          model: candidate.name,
          prompt: finalPrompt,
          n: 1,
          size: size || '1024x1024',
        });
      }
      break;
    } catch (e) {
      failures.push(`${providerLabel(candidate)}?${e.message || e}`);
      if (inputs.length > 0) imageEditFailures.push(e);
      if (!isTransientImageError(e) || candidateModels.indexOf(candidate) === candidateModels.length - 1) {
        if (inputs.length > 0 && imageEditFailures.some(shouldFallbackImageEditToGeneration)) {
          for (const generationCandidate of candidateModels) {
            try {
              selectedModel = generationCandidate;
              const generationUrl = imageEndpoint(generationCandidate.base, 'generations');
              if (!generationUrl) continue;
              json = await fetchJsonWithRetry(generationUrl, generationCandidate, {
                model: generationCandidate.name,
                prompt: buildImageToImageFallbackPrompt(finalPrompt),
                n: 1,
                size: size || '1024x1024',
              });
              usedImageEditFallback = true;
              break;
            } catch (fallbackError) {
              failures.push(`${providerLabel(generationCandidate)}????????${fallbackError.message || fallbackError}`);
            }
          }
          if (json) break;
        }
        const err = new Error(failures.length > 1 ? `??????????${failures.join('?')}` : (e.message || 'image generation failed'));
        err.status = e.status || 500;
        throw err;
      }
    }
  }

  const items = extractImageItems(json);
  if (!items.length) throw new Error('?? API ?????????????????? API Key?');
  const outputs = [];
  for (const item of items) {
    if (outputs.length >= 4) break;
    try {
      outputs.push(await saveGeneratedItem(item, reqLike, {
        prompt: finalPrompt,
        sourcePrompt: cleanSourcePrompt,
        model: selectedModel.name,
        provider: selectedModel.provider,
        inputs: inputs.map(i => ({ id: i.id, path: i.path, url: i.url, publicUrl: toPublicUrl(reqLike, i.id), name: i.originalName })),
      }));
    } catch (e) {
      if (!outputs.length) throw e;
    }
  }
  if (!outputs.length) throw new Error('图像接口没有返回可用图片。');

  const imageMd = outputs.map((img, i) => `![生成图片 ${i + 1}](${toPublicUrl(reqLike, img.id)})`).join('\n\n');
  const promptLabel = inputs.length ? '图生图提示词' : '图像提示词';
  const promptBlock = `\n\n${promptLabel}：\n${finalPrompt}`;
  const assistantContent = `图片已生成${promptBlock}\n\n${imageMd}`;
  const inputMd = inputs.length
    ? `\n\n参考图片：\n${inputs.map(img => `![${img.originalName || img.filename}](${toPublicUrl(reqLike, img.id)})\n本地路径：${img.path}`).join('\n\n')}`
    : '';
  const userContent = `图像生成：${cleanSourcePrompt || finalPrompt}${inputMd}`;
  const imageCaptureInputs = inputs.map(i => ({ id: i.id, path: i.path, url: i.url, publicUrl: toPublicUrl(reqLike, i.id), name: i.originalName || i.filename }));
  const imageCaptureOutputs = outputs.map(o => ({ id: o.id, path: o.path, url: o.url, publicUrl: o.publicUrl, name: o.filename, prompt: o.prompt, sourcePrompt: o.sourcePrompt }));
  const imageMode = inputs.length ? (usedImageEditFallback ? 'image-to-image-fallback' : 'image-to-image') : 'text-to-image';
  const chat = appendChatMessages(chatId, userContent, assistantContent, selectedModel.name, {
    inputs: imageCaptureInputs,
    outputs: imageCaptureOutputs,
    prompt: finalPrompt,
    sourcePrompt: cleanSourcePrompt,
    optimizedByAgent: !!optimizedByAgent,
    mode: imageMode,
    optimizeSkill: optimizedByAgent ? 'webui-image-rules' : '',
    userMsgId,
    assistantMsgId,
  });

  captureImageGenerationRecord({
    sourcePrompt: cleanSourcePrompt,
    prompt: finalPrompt,
    inputs: imageCaptureInputs,
    outputs: imageCaptureOutputs,
    model: selectedModel.name,
    provider: selectedModel.provider,
    mode: imageMode,
    editFallback: usedImageEditFallback,
    chatId: chat?.id || chatId,
    optimizedByAgent: !!optimizedByAgent,
  });

  return {
    model: selectedModel.name,
    provider: selectedModel.provider,
    prompt: finalPrompt,
    sourcePrompt: cleanSourcePrompt,
    optimizedByAgent: !!optimizedByAgent,
    mode: imageMode,
    editFallback: usedImageEditFallback,
    inputs,
    outputs,
    content: assistantContent,
    chat: chat ? { id: chat.id, title: chat.title, updatedAt: chat.updatedAt, messageCount: chat.messages?.length || 0 } : null,
  };
}

router.post('/generate', async (req, res) => {
  const { prompt = '', sourcePrompt = '', optimizedByAgent = false, attachmentIds = [], model = 'auto', size = '1024x1024', chatId = '', publicBase = '', userMsgId = '', assistantMsgId = '' } = req.body || {};
  try {
    const data = await generateImageFromPrompt({ prompt, sourcePrompt, optimizedByAgent, attachmentIds, model, size, chatId, publicBase, userMsgId, assistantMsgId });
    res.ok(data);
  } catch (e) {
    res.fail(e.message || 'image generation failed', e.status || 500, e.status || 500);
  }
});
router.get('/file/:id', (req, res) => {
  const record = findRecord(req.params.id);
  const filePath = record ? existingImagePath(record) : '';
  if (!record || !filePath) return res.status(404).send('not found');
  const resolved = path.resolve(filePath);
  if (!isInsideImageRoot(resolved)) return res.status(403).send('forbidden');
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
    relativePath: r.relativePath || imageRelativePath(r),
    url: r.url,
    createdAt: r.createdAt,
    prompt: r.prompt,
    sourcePrompt: r.sourcePrompt,
    model: r.model,
    provider: r.provider,
  })));
});

module.exports = router;
module.exports.generateImageFromPrompt = generateImageFromPrompt;
