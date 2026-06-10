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
const VIDEO_API_TIMEOUT_MS = Math.max(180000, Number(process.env.WEBUI_VIDEO_API_TIMEOUT_MS || 900000));
const VIDEO_DOWNLOAD_TIMEOUT_MS = Math.max(120000, Number(process.env.WEBUI_VIDEO_DOWNLOAD_TIMEOUT_MS || 600000));
const VIDEO_SYNC_WAIT_MS = Math.max(3000, Number(process.env.WEBUI_VIDEO_SYNC_WAIT_MS || 15000));


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

function imageIndexPath() {
  return path.join(paths.imageRoot(), 'images-index.json');
}

function readImageIndexRecords() {
  try {
    const file = imageIndexPath();
    if (!fs.existsSync(file)) return [];
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(json) ? json : (Array.isArray(json.records) ? json.records : []);
  } catch (_) {
    return [];
  }
}

function writeImageIndexRecords(records = []) {
  try {
    ensureDir(paths.imageRoot());
    fs.writeFileSync(imageIndexPath(), JSON.stringify(records.slice(0, 1000), null, 2), 'utf8');
  } catch (_) {}
}

function recordIdentity(record = {}) {
  const rel = String(record.relativePath || imageRelativePath(record) || '').replace(/\\/g, '/').toLowerCase();
  const rawPath = normalizeStoredImagePath(record.path || imagePathFromRelative(record.relativePath || ''));
  const resolved = rawPath ? path.resolve(rawPath).toLowerCase() : '';
  return record.id || rel || resolved || '';
}

function mergeImageRecords(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const record of (Array.isArray(list) ? list : [])) {
      if (!record || typeof record !== 'object') continue;
      const key = recordIdentity(record);
      if (!key) continue;
      map.set(key, { ...(map.get(key) || {}), ...record });
    }
  }
  return [...map.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 1000);
}

function readRecords({ rescan = true } = {}) {
  const merged = mergeImageRecords(readImageIndexRecords(), store.read(IMAGE_KEY, []));
  return rescan ? syncImageRecordsFromDisk(merged).records : merged;
}

function writeRecords(records) {
  const normalized = mergeImageRecords(records);
  store.write(IMAGE_KEY, normalized);
  writeImageIndexRecords(normalized);
}

function imageRecordIdFromFile(filePath = '', kind = 'output') {
  const name = path.basename(filePath, path.extname(filePath));
  const suffix = name.match(/_([a-f0-9]{6,12})$/i)?.[1] || crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 10);
  const statPart = (() => { try { return Math.round(fs.statSync(filePath).mtimeMs).toString(36); } catch { return Date.now().toString(36); } })();
  return `${kind === 'input' ? 'in' : 'out'}_${statPart}_${suffix}`;
}

function promptFromImageFilename(filePath = '') {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/^\d{8}-\d{6}_/, '').replace(/_[a-f0-9]{6,12}$/i, '').replace(/_/g, ' ').trim();
}

function collectImageFiles(dir, kind, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectImageFiles(full, kind, out);
    else if (entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name)) out.push({ path: full, kind });
  }
  return out;
}

function canonicalImagePath(filePath = '') {
  const resolved = path.resolve(normalizeStoredImagePath(filePath));
  try { return fs.realpathSync(resolved).toLowerCase(); } catch (_) { return resolved.toLowerCase(); }
}

function syncImageRecordsFromDisk(records = [], options = {}) {
  const byPath = new Set(records.map(r => canonicalImagePath(r.path || imagePathFromRelative(r.relativePath || ''))).filter(Boolean));
  const byRelative = new Set(records.map(r => String(r.relativePath || imageRelativePath(r) || '').replace(/\\/g, '/').toLowerCase()).filter(Boolean));
  const additions = [];
  let skipped = 0;
  const files = [
    ...collectImageFiles(paths.imageOutputDir(), 'output'),
    ...collectImageFiles(paths.imageInputDir(), 'input'),
  ];
  for (const file of files) {
    const resolved = path.resolve(file.path);
    const realKey = canonicalImagePath(resolved);
    const rel = path.relative(paths.imageRoot(), resolved);
    const relKey = rel.replace(/\\/g, '/').toLowerCase();
    if (byPath.has(realKey) || byRelative.has(relKey)) { skipped++; continue; }
    let stat = null;
    try { stat = fs.statSync(resolved); } catch { skipped++; continue; }
    const id = imageRecordIdFromFile(resolved, file.kind);
    const prompt = file.kind === 'output' ? promptFromImageFilename(resolved) : '';
    additions.push({
      id,
      kind: file.kind,
      filename: path.basename(resolved),
      originalName: path.basename(resolved),
      mime: detectImageMime(fs.readFileSync(resolved).slice(0, 32)) || (path.extname(resolved).toLowerCase() === '.jpg' || path.extname(resolved).toLowerCase() === '.jpeg' ? 'image/jpeg' : 'image/png'),
      size: stat.size,
      path: resolved,
      relativePath: rel,
      url: publicUrlFor(id),
      publicUrl: publicUrlFor(id),
      prompt,
      sourcePrompt: prompt,
      model: '',
      provider: '',
      inputs: [],
      createdAt: stat.mtimeMs ? Math.round(stat.mtimeMs) : Date.now(),
    });
    byPath.add(realKey);
    byRelative.add(relKey);
  }
  const merged = additions.length ? mergeImageRecords(additions, records) : mergeImageRecords(records);
  if (additions.length || options.forceWrite) writeRecords(merged);
  const stats = { scanned: files.length, added: additions.length, skipped, total: merged.length };
  if (options.log || additions.length) console.log(`[images] scanned=${stats.scanned} added=${stats.added} skipped=${stats.skipped} total=${stats.total}`);
  return { records: merged, stats };
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
  const normalized = normalizeStoredImagePath(record.path);
  const stored = path.resolve(normalized);
  const legacyRoot = path.resolve(path.join(store.DATA_DIR, 'images'));
  const currentRoot = path.resolve(paths.imageRoot());
  for (const root of [currentRoot, legacyRoot]) {
    const rel = path.relative(root, stored);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  }
  const match = String(normalized).match(/[\/]images[\/](outputs|inputs)[\/](.+)$/i);
  if (match) return path.join(match[1].toLowerCase(), match[2]);
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
  const records = readRecords({ rescan: false });
  const merged = mergeImageRecords([record], records);
  writeRecords(merged);
  return record;
}

function findRecord(id) {
  return readRecords().find(r => r.id === id);
}

function normalizeImageRecordForClient(r = {}, req = null) {
  const id = r.id || '';
  return {
    id,
    kind: r.kind,
    name: r.originalName || r.filename,
    filename: r.filename,
    originalName: r.originalName || r.filename,
    mime: r.mime,
    size: r.size,
    path: r.path,
    relativePath: r.relativePath || imageRelativePath(r),
    url: r.url || (id ? publicUrlFor(id) : ''),
    publicUrl: id ? (req ? toPublicUrl(req, id) : (r.publicUrl || publicUrlFor(id))) : (r.publicUrl || r.url || ''),
    createdAt: r.createdAt,
    prompt: r.prompt,
    sourcePrompt: r.sourcePrompt,
    model: r.model,
    provider: r.provider,
    inputs: r.inputs || [],
    revisedPrompt: r.revisedPrompt || '',
    sourceUrl: r.sourceUrl || '',
    taskId: r.taskId || '',
    videoId: r.videoId || '',
  };
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


function isVideoLibraryModel(model = {}) {
  const tags = Array.isArray(model.tags) ? model.tags.map(t => String(t).toLowerCase()) : [];
  const name = String(model.name || model.id || '').toLowerCase();
  return ['openai-video', 'openai_video'].includes(model.apiFormat)
    || model.kind === 'video'
    || tags.includes('video')
    || /video|sora|runway|kling|pika|veo/.test(name);
}

function isAgnesModel(model = {}) {
  const text = [model.provider, model.name, model.id, model.base].filter(Boolean).join(' ').toLowerCase();
  return /agnes|apihub\.agnes-ai\.com|sapiens/.test(text);
}

function videoModelConfig() {
  const root = store.read('models', {});
  if (!root || typeof root !== 'object' || (!root.webui && !root.agent)) return modelConfigForScope('webui');
  const webui = root.webui || {};
  const agent = root.agent || {};
  const webuiLibrary = Array.isArray(webui.library) ? webui.library : [];
  const agentLibrary = Array.isArray(agent.library) ? agent.library : [];
  const webuiHasVideo = !!webui.scenarios?.video || webuiLibrary.some(isVideoLibraryModel);
  if (webuiHasVideo) return { ...webui };
  return { ...agent, library: agentLibrary };
}

function resolveVideoModel(modelId = 'auto') {
  const cfg = videoModelConfig();
  const lib = Array.isArray(cfg.library) ? cfg.library : [];
  const wanted = modelId && modelId !== 'auto' ? modelId : (cfg.scenarios?.video || '');
  const videoModels = lib.filter(m => m.enabled !== false && isVideoLibraryModel(m));
  let model = lib.find(m => m.id === wanted || m.name === wanted);
  if (!model && videoModels.length) model = videoModels[0];
  if (!model) {
    const err = new Error('WebUI video generation is not configured yet. Please add an OpenAI Video compatible model and bind it to the Video Generation scenario.');
    err.status = 400;
    throw err;
  }
  if (model.enabled === false) {
    if (videoModels.length) return videoModels[0];
    const err = new Error('The configured WebUI video model is disabled. Please enable a video model before generating videos.');
    err.status = 400;
    throw err;
  }
  if (!isVideoLibraryModel(model)) {
    if (videoModels.length) return videoModels[0];
    const err = new Error(`The Video Generation scenario is bound to ${model.name || model.id}, but it is not marked as a video model.`);
    err.status = 400;
    throw err;
  }
  return model;
}

function explicitVideoSecondsFromText(value = '') {
  const text = String(value || '');
  const en = text.match(/(\d{1,2})\s*(?:s|sec|secs|second|seconds)\b/i);
  const zh = text.match(/(\d{1,2})\s*?/);
  const n = Number((en && en[1]) || (zh && zh[1]) || 0);
  return n > 0 ? Math.max(1, Math.min(n, 20)) : 0;
}

function videoEndpoint(base) {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/v1\/videos$/i.test(clean)) return clean;
  if (/\/videos?\/generations$/i.test(clean)) return clean.replace(/\/video\/generations$/i, '/videos').replace(/\/videos\/generations$/i, '/videos');
  if (clean.endsWith('/v1')) return `${clean}/videos`;
  return `${clean}/v1/videos`;
}

function parseSize(value = '', fallbackWidth = 1152, fallbackHeight = 768) {
  const match = String(value || '').match(/(\d{2,5})\s*[x×*]\s*(\d{2,5})/i);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: fallbackWidth, height: fallbackHeight };
}

function videoFrameParams(seconds = 5) {
  const wanted = Math.max(1, Math.min(Number(seconds || 5) || 5, 18));
  const candidates = [81, 121, 161, 201, 241, 281, 321, 361, 401, 441];
  let numFrames = candidates[0];
  for (const value of candidates) {
    if (Math.abs(value / 24 - wanted) < Math.abs(numFrames / 24 - wanted)) numFrames = value;
  }
  return { num_frames: numFrames, frame_rate: 24 };
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
  const payload = isAgnesModel(model)
    ? { ...body, extra_body: { ...(body.extra_body || {}), response_format: body.extra_body?.response_format || body.response_format || 'b64_json' } }
    : { ...body, response_format: body.response_format || 'b64_json' };
  if (isAgnesModel(model)) delete payload.response_format;
  const first = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
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


function videoExtFromMime(mime = '') {
  const value = String(mime || '').toLowerCase();
  if (value.includes('webm')) return '.webm';
  if (value.includes('quicktime') || value.includes('mov')) return '.mov';
  if (value.includes('mpeg')) return '.mpeg';
  return '.mp4';
}
function extractVideoItems(json = {}) {
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.videos)) return json.videos;
  if (Array.isArray(json.output)) return json.output.flatMap(item => Array.isArray(item.content) ? item.content : [item]);
  return [json].filter(Boolean);
}
function videoUrlFromItem(item = {}) { return item.url || item.video_url || item.href || item.download_url || item.output_url || item.file_url || item.remixed_from_video_id || item.video || ''; }
function videoBase64FromItem(item = {}) { return item.b64_json || item.base64 || item.video_base64 || item.data || ''; }
function videoIdFromItem(item = {}) { return item.video_id || item.videoId || item.id || item.data?.video_id || item.data?.id || ''; }
function findExistingVideoRecords({ taskId = '', videoId = '', sourceUrl = '' } = {}) {
  const cleanTaskId = String(taskId || '').trim();
  const cleanVideoId = String(videoId || '').trim();
  const cleanSourceUrl = String(sourceUrl || '').trim();
  if (!cleanTaskId && !cleanVideoId && !cleanSourceUrl) return [];
  return readRecords({ rescan: false }).filter(record => {
    if (!record || record.kind !== 'video') return false;
    if (cleanTaskId && String(record.taskId || '').trim() === cleanTaskId) return true;
    if (cleanVideoId && String(record.videoId || '').trim() === cleanVideoId) return true;
    if (cleanSourceUrl && String(record.sourceUrl || '').trim() === cleanSourceUrl) return true;
    return false;
  }).filter(record => existingImagePath(record));
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function videoTaskIdFromJson(json = {}) {
  return json.task_id || json.taskId || json.id || json.data?.task_id || json.data?.id || '';
}

async function fetchAgnesImageToImage(url, model, body, inputs = [], publicBase = '') {
  const images = inputs.map(input => imageInputPublicUrl(input, publicBase) || imageInputDataUrl(input)).filter(Boolean);
  return fetchJsonWithRetry(url, model, {
    ...body,
    extra_body: {
      ...(body.extra_body || {}),
      image: images,
      response_format: 'b64_json',
    },
  });
}
function videoIdFromJson(json = {}) {
  return json.video_id || json.videoId || json.data?.video_id || json.data?.videoId || json.data?.data?.video_id || '';
}
function videoStatusFromJson(json = {}) {
  return String(json.status || json.data?.status || json.data?.data?.status || '').toLowerCase();
}
function isVideoTaskPending(json = {}) {
  const status = videoStatusFromJson(json);
  return ['queued', 'pending', 'processing', 'running', 'in_progress', 'not_start', 'submitted', 'created'].includes(status) || /%$/.test(String(json.data?.progress || json.progress || ''));
}
function isVideoTaskFailed(json = {}) {
  const status = videoStatusFromJson(json);
  return ['failed', 'error', 'cancelled', 'canceled'].includes(status) || !!(json.error || json.data?.error || json.data?.fail_reason);
}
function videoStatusUrl(base, taskId, videoId = '') {
  const clean = String(base || '').replace(/\/+$/, '');
  const id = String(taskId || '').trim();
  const vid = String(videoId || '').trim();
  if (!clean || (!id && !vid)) return '';
  if (vid && isAgnesModel({ base: clean })) {
    const root = clean.replace(/\/v1(?:\/videos)?$/i, '').replace(/\/videos$/i, '');
    return `${root}/agnesapi?video_id=${encodeURIComponent(vid)}`;
  }
  return `${clean.replace(/\/v1\/videos$/i, '/v1')}/videos/${encodeURIComponent(id || vid)}`;
}
async function fetchVideoJsonWithRetry(url, model, body) {
  const headers = authHeaders(model, true);
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1500 * attempt);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.min(VIDEO_API_TIMEOUT_MS, 180000)),
    });
    const text = await response.text().catch(() => '');
    if (response.ok) {
      try { return text ? JSON.parse(text) : {}; } catch (_) { return {}; }
    }
    const error = new Error(`Video API failed HTTP ${response.status}: ${text.slice(0, 300)}`);
    error.status = response.status;
    lastError = error;
    if (![408, 409, 425, 429, 500, 502, 503, 504, 524].includes(Number(response.status))) break;
  }
  throw lastError || new Error('Video API failed');
}
function videoRequestShouldTryNext(status = 0, text = '') {
  const code = Number(status || 0);
  if ([400, 404, 405, 415, 422].includes(code)) return true;
  return /unknown parameter|unsupported|missing.*image|invalid.*image|incorrect padding|base64|image_url|first_frame|input_image|multipart|uploadfile|not json serializable|field|required/i.test(String(text || ''));
}

function imageInputDataUrl(input = {}) {
  const filePath = input.path || existingImagePath(input);
  if (!filePath || !fs.existsSync(filePath)) return '';
  const mime = input.mime || 'image/png';
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${base64}`;
}

function imageInputPublicUrl(input = {}, publicBase = '') {
  const base = String(publicBase || process.env.WEBUI_PUBLIC_BASE || '').replace(/\/+$/, '');
  const id = input.id || '';
  if (base && id) return `${base}${publicUrlFor(id)}`;
  const value = String(input.publicUrl || input.url || '').trim();
  return /^https?:\/\//i.test(value) ? value : '';
}

async function fetchVideoMultipart(url, model, body, inputs = [], imageField = 'image') {
  const form = new FormData();
  Object.entries(body || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  });
  inputs.slice(0, 1).forEach((input, index) => {
    const buffer = fs.readFileSync(input.path);
    const blob = new Blob([buffer], { type: input.mime || 'image/png' });
    const name = input.originalName || input.filename || `input_${index}.png`;
    form.append(imageField, blob, name);
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(model, false),
    body: form,
    signal: AbortSignal.timeout(Math.min(VIDEO_API_TIMEOUT_MS, 180000)),
  });
  const text = await response.text().catch(() => '');
  if (response.ok) {
    try { return text ? JSON.parse(text) : {}; } catch (_) { return {}; }
  }
  const error = new Error(`Video API failed HTTP ${response.status}: ${text.slice(0, 300)}`);
  error.status = response.status;
  error.responseText = text;
  throw error;
}

async function fetchVideoWithInputs(url, model, body, inputs = [], publicBase = '') {
  if (!inputs.length) return fetchVideoJsonWithRetry(url, model, body);
  const dataUrl = imageInputDataUrl(inputs[0]);
  const rawBase64 = dataUrl.replace(/^data:[^;]+;base64,/i, '');
  const publicUrls = inputs.map(input => imageInputPublicUrl(input, publicBase)).filter(Boolean);
  const usablePublicUrls = publicUrls.filter(url => !/^https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|::1)(?::\d+)?\//i.test(url));
  const agnesPreferredImages = isAgnesModel(model) ? usablePublicUrls : publicUrls;
  const firstImage = agnesPreferredImages[0] || (isAgnesModel(model) ? rawBase64 : dataUrl);
  const attempts = [
    { label: 'json:image', run: () => fetchVideoJsonWithRetry(url, model, { ...body, image: firstImage }) },
    { label: 'json:extra_body.image', run: () => fetchVideoJsonWithRetry(url, model, { ...body, extra_body: { ...(body.extra_body || {}), image: agnesPreferredImages.length > 1 ? agnesPreferredImages : [firstImage] } }) },
    { label: 'json:image_url:data-url', run: () => fetchVideoJsonWithRetry(url, model, { ...body, image_url: dataUrl }) },
    { label: 'json:input_image:data-url', run: () => fetchVideoJsonWithRetry(url, model, { ...body, input_image: dataUrl }) },
    { label: 'json:images:data-url', run: () => fetchVideoJsonWithRetry(url, model, { ...body, images: [dataUrl] }) },
    { label: 'json:image_base64', run: () => fetchVideoJsonWithRetry(url, model, { ...body, image_base64: rawBase64 }) },
    { label: 'json:first_frame_image_base64', run: () => fetchVideoJsonWithRetry(url, model, { ...body, first_frame_image: rawBase64 }) },
    { label: 'multipart:image', run: () => fetchVideoMultipart(url, model, body, inputs, 'image') },
    { label: 'multipart:first_frame_image', run: () => fetchVideoMultipart(url, model, body, inputs, 'first_frame_image') },
  ];
  const failures = [];
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (error) {
      failures.push(`${attempt.label}: ${error.message || error}`);
      if (!videoRequestShouldTryNext(error.status, error.responseText || error.message)) break;
    }
  }
  const err = new Error(`图生视频请求失败，已尝试 ${failures.length} 种参考图传参方式：${failures.join('；')}`);
  err.status = 500;
  throw err;
}

function resolveGenerationInputs(attachmentIds = []) {
  const ids = Array.isArray(attachmentIds) ? attachmentIds.map(String).filter(Boolean) : [];
  if (!ids.length) return [];
  const records = readRecords();
  return ids
    .map(id => records.find(r => r.id === id))
    .map(r => {
      const filePath = r ? existingImagePath(r) : '';
      return filePath ? { ...r, path: filePath } : null;
    })
    .filter(r => r && ['input', 'output'].includes(r.kind) && String(r.mime || '').startsWith('image/') && isInsideImageRoot(r.path));
}

async function pollVideoTaskIfNeeded(json = {}, model = {}) {
  const initialItems = extractVideoItems(json).filter(item => videoUrlFromItem(item) || videoBase64FromItem(item));
  if (initialItems.length) return json;
  const taskId = videoTaskIdFromJson(json);
  if (!taskId || !isVideoTaskPending(json)) return json;
  const url = videoStatusUrl(model.base, taskId, videoIdFromJson(json));
  if (!url) return json;
  const startedAt = Date.now();
  let lastJson = json;
  while (Date.now() - startedAt < Math.min(VIDEO_API_TIMEOUT_MS, VIDEO_SYNC_WAIT_MS)) {
    await sleep(5000);
    const response = await fetch(url, { method: 'GET', headers: authHeaders(model, true), signal: AbortSignal.timeout(Math.min(30000, VIDEO_API_TIMEOUT_MS)) });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      const err = new Error(`Video task polling failed HTTP ${response.status}: ${text.slice(0, 300)}`);
      err.status = response.status;
      throw err;
    }
    lastJson = text ? JSON.parse(text) : {};
    const items = extractVideoItems(lastJson).filter(item => videoUrlFromItem(item) || videoBase64FromItem(item));
    if (items.length) return lastJson;
    if (isVideoTaskFailed(lastJson)) throw new Error('Video task failed: ' + JSON.stringify(lastJson.error || lastJson.data?.error || lastJson.data?.fail_reason || lastJson).slice(0, 500));
    if (!isVideoTaskPending(lastJson) && !items.length) return lastJson;
  }
  return { ...lastJson, __pendingVideoTask: true, taskId, status: videoStatusFromJson(lastJson) || videoStatusFromJson(json) || 'queued' };
}
async function saveGeneratedVideoItem(item, req, meta = {}) {
  const sourceUrl = videoUrlFromItem(item);
  const videoId = meta.videoId || videoIdFromItem(item);
  const existing = findExistingVideoRecords({ taskId: meta.taskId, videoId, sourceUrl });
  if (existing.length) return normalizeImageRecordForClient(existing[0], req);
  const id = imageId('vid');
  let buffer = null;
  let mime = 'video/mp4';
  const base64 = videoBase64FromItem(item);
  if (base64 && /^data:/i.test(base64)) {
    const parsed = parseDataUrl(base64);
    buffer = parsed.buffer;
    mime = parsed.mime || mime;
  } else if (base64 && /^[A-Za-z0-9+/=\s]+$/.test(String(base64).slice(0, 200))) {
    buffer = Buffer.from(String(base64).replace(/\s+/g, ''), 'base64');
  } else if (sourceUrl) {
    const r = await fetch(sourceUrl, { signal: AbortSignal.timeout(VIDEO_DOWNLOAD_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`Download generated video failed HTTP ${r.status}`);
    const contentType = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const arr = await r.arrayBuffer();
    buffer = Buffer.from(arr);
    mime = contentType || mime;
  }
  if (!buffer || !buffer.length) throw new Error('Video API did not return recognizable video data.');
  if (!String(mime || '').toLowerCase().startsWith('video/')) mime = 'video/mp4';
  const ext = videoExtFromMime(mime);
  const dir = monthDir(paths.imageOutputDir());
  const filename = `${dateStamp()}_${promptSlug(meta.sourcePrompt || meta.prompt || 'video')}_${id.slice(-6)}${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return addRecord({ id, kind: 'video', filename, originalName: filename, mime, size: buffer.length, path: filePath, relativePath: path.relative(paths.imageRoot(), filePath), url: publicUrlFor(id), publicUrl: toPublicUrl(req, id), prompt: meta.prompt || '', sourcePrompt: meta.sourcePrompt || '', model: meta.model || '', provider: meta.provider || '', inputs: meta.inputs || [], sourceUrl, taskId: meta.taskId || '', videoId, createdAt: Date.now() });
}
async function generateVideoFromPrompt({ prompt = '', sourcePrompt = '', attachmentIds = [], model = 'auto', size = '1024x1024', seconds = 5, chatId = '', publicBase = '', userMsgId = '', assistantMsgId = '' } = {}) {
  const cleanPrompt = redactSecrets(String(prompt || sourcePrompt || '').trim());
  const cleanSourcePrompt = redactSecrets(String(sourcePrompt || prompt || '').trim());
  if (!cleanPrompt) { const err = new Error('prompt required'); err.status = 400; throw err; }
  const inputs = resolveGenerationInputs(attachmentIds);
  const selectedModel = resolveVideoModel(model);
  const url = videoEndpoint(selectedModel.base);
  if (!url) { const err = new Error('Video model API base is missing.'); err.status = 400; throw err; }
  const videoPrompt = inputs.length
    ? `Use the provided reference image as the first frame and visual source. Preserve the reference image identity, character, composition, color palette, outfit, facial features, and illustration style. Only add natural motion/camera movement requested by the user. Do not redesign or replace the subject. ${cleanPrompt}`
    : cleanPrompt;
  const resolvedSeconds = explicitVideoSecondsFromText(cleanSourcePrompt || cleanPrompt) || Number(seconds || 5) || 5;
  const dimensions = parseSize(size, 1152, 768);
  const frames = videoFrameParams(resolvedSeconds);
  const requestBody = isAgnesModel(selectedModel)
    ? { model: selectedModel.name || selectedModel.id, prompt: videoPrompt, width: dimensions.width, height: dimensions.height, ...frames }
    : { model: selectedModel.name || selectedModel.id, prompt: videoPrompt, size, seconds: String(resolvedSeconds) };
  const firstJson = await fetchVideoWithInputs(url, selectedModel, requestBody, inputs, publicBase);
  const json = await pollVideoTaskIfNeeded(firstJson, selectedModel);
  if (json.__pendingVideoTask) {
    const taskId = json.taskId || videoTaskIdFromJson(firstJson) || videoTaskIdFromJson(json);
    const status = json.status || videoStatusFromJson(json) || 'queued';
    const content = 'Video task submitted but still pending. Task ID: ' + taskId + ', status: ' + status;
    return {
      model: selectedModel.name,
      provider: selectedModel.provider,
      prompt: cleanPrompt,
      sourcePrompt: cleanSourcePrompt,
      mode: inputs.length ? 'image-to-video' : 'text-to-video',
      status: 'pending',
      taskId,
      videoId: json.video_id || json.data?.video_id || json.data?.data?.id || firstJson.video_id || '',
      taskStatus: status,
      outputs: [],
      inputs: inputs.map(i => ({ id: i.id, path: i.path, url: i.url, publicUrl: toPublicUrl({ body: { publicBase } }, i.id), name: i.originalName || i.filename })),
      content,
      raw: json,
      chat: null,
    };
  }
  const items = extractVideoItems(json);
  if (!items.length) throw new Error('Video API returned an invalid response. Please check video model config or API key.');
  const completedTaskId = videoTaskIdFromJson(firstJson) || videoTaskIdFromJson(json) || '';
  const reqLike = { body: { publicBase } };
  const captureInputs = inputs.map(i => ({ id: i.id, path: i.path, url: i.url, publicUrl: toPublicUrl(reqLike, i.id), name: i.originalName || i.filename }));
  const outputs = [];
  for (const item of items) { if (outputs.length >= 2) break; outputs.push(await saveGeneratedVideoItem(item, reqLike, { prompt: cleanPrompt, sourcePrompt: cleanSourcePrompt, model: selectedModel.name, provider: selectedModel.provider, inputs: captureInputs, taskId: completedTaskId, videoId: videoIdFromItem(item) })); }
  if (!outputs.length) throw new Error('Video result was returned but saving failed. Please check output directory permissions.');
  const captureOutputs = outputs.map(o => ({ id: o.id, path: o.path, relativePath: o.relativePath || imageRelativePath(o), url: o.url || publicUrlFor(o.id), publicUrl: toPublicUrl(reqLike, o.id), name: o.filename || o.originalName, filename: o.filename, originalName: o.originalName || o.filename, mime: o.mime, size: o.size, createdAt: o.createdAt, prompt: o.prompt, sourcePrompt: o.sourcePrompt, model: o.model, provider: o.provider, taskId: o.taskId || completedTaskId, videoId: o.videoId || '' }));
  const videoMd = captureOutputs.map((vid, i) => `[生成视频 ${i + 1}](${vid.publicUrl || vid.url})`).join('\n\n');
  const assistantContent = `视频已生成\n\n视频提示词：\n${cleanPrompt}\n\n${videoMd}`;
  const videoMode = inputs.length ? 'image-to-video' : 'text-to-video';
  const chat = appendChatMessages(chatId, `\u89c6\u9891\u751f\u6210\uff1a${cleanSourcePrompt || cleanPrompt}`, assistantContent, selectedModel.name, { inputs: captureInputs, outputs: captureOutputs, prompt: cleanPrompt, sourcePrompt: cleanSourcePrompt, optimizedByAgent: false, mode: videoMode, mediaType: 'video', userMsgId, assistantMsgId });
  return { model: selectedModel.name, provider: selectedModel.provider, prompt: cleanPrompt, sourcePrompt: cleanSourcePrompt, mode: videoMode, outputs: captureOutputs, inputs: captureInputs, content: assistantContent, chat: chat ? { id: chat.id, title: chat.title, updatedAt: chat.updatedAt, messageCount: chat.messages?.length || 0 } : null };
}

const IMAGE2_DIR = path.resolve(process.env.HERMES_IMAGE2_SKILL_DIR || path.join(paths.dataRoot(), 'skills', 'image2'));

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
      mediaType: imageRecords.mediaType || (String(imageRecords.mode || '').includes('video') ? 'video' : 'image'),
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
        if (isAgnesModel(candidate)) {
          const url = imageEndpoint(candidate.base, 'generations');
          if (!url) {
            const err = new Error('image generation url missing');
            err.status = 400;
            throw err;
          }
          json = await fetchAgnesImageToImage(url, candidate, {
            model: candidate.name,
            prompt: finalPrompt,
            n: 1,
            size: size || '1024x1024',
          }, inputs, publicBase);
        } else {
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
        }
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
              failures.push(`${providerLabel(generationCandidate)} \u56fe\u751f\u56fe\u56de\u9000\u5931\u8d25\uff1a${fallbackError.message || fallbackError}`);
            }
          }
          if (json) break;
        }
        const err = new Error(failures.length > 1 ? `\u56fe\u50cf\u751f\u6210\u5931\u8d25\uff0c\u5df2\u5c1d\u8bd5\u56de\u9000\uff1a${failures.join('\uff1b')}` : (e.message || 'image generation failed'));
        err.status = e.status || 500;
        throw err;
      }
    }
  }

  const items = extractImageItems(json);
  if (!items.length) throw new Error('\u5916\u90e8\u56fe\u50cf API \u8fd4\u56de\u4e86\u65e0\u6548\u54cd\u5e94\uff0c\u8bf7\u68c0\u67e5\u56fe\u50cf\u6a21\u578b\u914d\u7f6e\u6216 API Key\u3002');
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
  const imageCaptureOutputs = outputs.map(o => ({ id: o.id, path: o.path, relativePath: o.relativePath || imageRelativePath(o), url: o.url || publicUrlFor(o.id), publicUrl: toPublicUrl(reqLike, o.id), name: o.filename || o.originalName, filename: o.filename, originalName: o.originalName || o.filename, mime: o.mime, size: o.size, createdAt: o.createdAt, prompt: o.prompt, sourcePrompt: o.sourcePrompt, model: o.model, provider: o.provider }));
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
    inputs: imageCaptureInputs,
    outputs: imageCaptureOutputs,
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
router.get('/video/task/:taskId', async (req, res) => {
  const { taskId } = req.params || {};
  const { model = 'auto', publicBase = '', videoId = '' } = req.query || {};
  try {
    const selectedModel = resolveVideoModel(model);
    const url = videoStatusUrl(selectedModel.base, taskId, videoId);
    if (!url) return res.fail('video task id required', 400, 400);
    const response = await fetch(url, { method: 'GET', headers: authHeaders(selectedModel, true), signal: AbortSignal.timeout(30000) });
    const text = await response.text().catch(() => '');
    if (!response.ok) return res.fail('Video task query failed HTTP ' + response.status + ': ' + text.slice(0, 300), response.status, response.status);
    const json = text ? JSON.parse(text) : {};
    const items = extractVideoItems(json).filter(item => videoUrlFromItem(item) || videoBase64FromItem(item));
    const existingByTask = findExistingVideoRecords({ taskId }).map(r => normalizeImageRecordForClient(r, req));
    if (existingByTask.length) {
      return res.ok({ status: videoStatusFromJson(json) || 'completed', taskId, outputs: existingByTask, raw: json });
    }
    if (!items.length) {
      return res.ok({ status: videoStatusFromJson(json) || 'unknown', taskId, outputs: [], raw: json });
    }
    const reqLike = { body: { publicBase } };
    const outputs = [];
    for (const item of items) {
      if (outputs.length >= 2) break;
      outputs.push(await saveGeneratedVideoItem(item, reqLike, { prompt: req.query.prompt || '', sourcePrompt: req.query.sourcePrompt || '', model: selectedModel.name, provider: selectedModel.provider, taskId, videoId: videoIdFromItem(item) }));
    }
    const captureOutputs = outputs.map(o => ({ id: o.id, path: o.path, relativePath: o.relativePath || imageRelativePath(o), url: o.url || publicUrlFor(o.id), publicUrl: toPublicUrl(reqLike, o.id), name: o.filename || o.originalName, filename: o.filename, originalName: o.originalName || o.filename, mime: o.mime, size: o.size, createdAt: o.createdAt, prompt: o.prompt, sourcePrompt: o.sourcePrompt, model: o.model, provider: o.provider, taskId: o.taskId || taskId, videoId: o.videoId || '' }));
    res.ok({ status: videoStatusFromJson(json) || 'completed', taskId, outputs: captureOutputs, raw: json });
  } catch (e) {
    res.fail(e.message || 'video task query failed', e.status || 500, e.status || 500);
  }
});

router.post('/video/generate', async (req, res) => {
  const { prompt = '', sourcePrompt = '', attachmentIds = [], model = 'auto', size = '1024x1024', seconds = 5, chatId = '', publicBase = '', userMsgId = '', assistantMsgId = '' } = req.body || {};
  try {
    const data = await generateVideoFromPrompt({ prompt, sourcePrompt, attachmentIds, model, size, seconds, chatId, publicBase, userMsgId, assistantMsgId });
    res.ok(data);
  } catch (e) {
    res.fail(e.message || 'video generation failed', e.status || 500, e.status || 500);
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

router.get('/', (req, res) => {
  let records = readRecords();
  const limit = Number(req.query.limit || 0);
  if (Number.isFinite(limit) && limit > 0) records = records.slice(0, Math.min(limit, 500));
  res.ok(records.map(r => normalizeImageRecordForClient(r, req)));
});

router.post('/rescan', (req, res) => {
  const before = readRecords({ rescan: false });
  const result = syncImageRecordsFromDisk(before, { forceWrite: true, log: true });
  res.ok({
    ...result.stats,
    before: before.length,
    images: result.records.map(r => normalizeImageRecordForClient(r, req)),
  });
});

module.exports = router;
module.exports.generateImageFromPrompt = generateImageFromPrompt;
module.exports.generateVideoFromPrompt = generateVideoFromPrompt;
