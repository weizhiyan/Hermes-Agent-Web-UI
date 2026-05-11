const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const store = require('../services/store');
const { chatStream } = require('../services/llm');

const router = express.Router();
const KEY = 'skills';
const LOCAL_DIR = path.join(store.DATA_DIR, 'skills-local');

const DEFAULTS = [
  { id: 'code-review', icon: 'CR', name: '代码审查', desc: '逐行审阅并给出重构建议', tags: ['代码', '重构', '内置'], source: 'builtin', on: true, prompt: '你是一位资深代码审查专家。请指出潜在问题、安全风险、性能瓶颈，并给出具体修改建议。' },
  { id: 'web-search', icon: 'WS', name: '联网搜索', desc: '需要最新信息时提醒检索来源', tags: ['搜索', '内置'], source: 'builtin', on: false, prompt: '当问题需要最新信息时，请提醒用户需要联网检索，并在回答中标注可靠来源。' },
  { id: 'file-ops', icon: 'FS', name: '文件操作', desc: '辅助读写本地文件与批处理', tags: ['系统', '内置'], source: 'builtin', on: true, prompt: '你可以协助处理文件内容。涉及写入、删除或批量操作时，先确认目标和风险。' },
  { id: 'image-gen', icon: 'IG', name: '图像生成', desc: '根据提示词生成或优化图像需求', tags: ['多模态', '内置'], source: 'builtin', on: false, prompt: '当用户需要图像时，帮助整理清晰、具体、可执行的图像提示词。' },
  { id: 'memory', icon: 'ME', name: '长期记忆', desc: '跨会话记录偏好和重要信息', tags: ['记忆', '内置'], source: 'builtin', on: true, prompt: '请在后续对话中主动参考用户明确表达过的偏好、上下文和重要事实。' },
];

function ensureDir() {
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
}
function safeName(name) {
  return String(name || 'skill').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}
function writeSkillFile(item) {
  ensureDir();
  const filePath = path.join(LOCAL_DIR, `${safeName(item.name)}-${item.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(item, null, 2), 'utf8');
  return filePath;
}
function normalize(list) {
  const incoming = Array.isArray(list) ? list : [];
  const byId = new Map(incoming.map(item => [item.id, item]));
  const mergedDefaults = DEFAULTS.map(def => {
    const old = byId.get(def.id);
    return old ? { ...def, on: old.on !== undefined ? old.on : def.on } : def;
  });
  const custom = incoming
    .filter(item => item && item.id && !DEFAULTS.some(def => def.id === item.id))
    .map(item => ({ ...item, source: item.source || ((item.tags || []).includes('用户制作') ? 'user' : 'custom') }));
  return [...mergedDefaults, ...custom];
}
function load() {
  const list = normalize(store.read(KEY, null));
  list.forEach(item => {
    if (!item.files) item.files = skillFiles(item).map(f => f.name);
  });
  store.write(KEY, list);
  return list;
}
function skillRoot(item) {
  if (item?.path && fs.existsSync(item.path)) {
    const stat = fs.statSync(item.path);
    return stat.isDirectory() ? item.path : path.dirname(item.path);
  }
  return LOCAL_DIR;
}
function skillFiles(item) {
  const root = skillRoot(item);
  if (!fs.existsSync(root)) return [];
  const out = [];
  const walk = (dir, prefix = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const abs = path.join(dir, e.name);
      const rel = prefix ? path.join(prefix, e.name) : e.name;
      if (e.isDirectory()) {
        walk(abs, rel);
      } else if (e.isFile() && /\.(md|json|ya?ml|txt)$/i.test(e.name)) {
        const stat = fs.statSync(abs);
        out.push({ name: rel.replace(/\\/g, '/'), path: abs, size: stat.size, mtime: stat.mtimeMs });
      }
      if (out.length >= 200) return;
    }
  };
  walk(root);
  return out;
}
function safeSkillFile(item, fileName) {
  const root = path.resolve(skillRoot(item));
  const target = path.resolve(root, String(fileName || ''));
  if (target === root || !target.startsWith(root + path.sep)) return null;
  return target;
}

router.get('/', (req, res) => res.ok(load()));

router.get('/:id/files', (req, res) => {
  const item = load().find(x => x.id === req.params.id);
  if (!item) return res.fail('skill not found', 404, 404);
  res.ok({ root: skillRoot(item), files: skillFiles(item) });
});

router.get('/:id/file', (req, res) => {
  const item = load().find(x => x.id === req.params.id);
  if (!item) return res.fail('skill not found', 404, 404);
  const target = safeSkillFile(item, req.query.path);
  if (!target || !fs.existsSync(target)) return res.fail('file not found', 404, 404);
  res.ok({ name: String(req.query.path || path.basename(target)).replace(/\\/g, '/'), path: target, content: fs.readFileSync(target, 'utf8') });
});

router.put('/:id/file', (req, res) => {
  const item = load().find(x => x.id === req.params.id);
  if (!item) return res.fail('skill not found', 404, 404);
  const target = safeSkillFile(item, req.query.path);
  if (!target || !fs.existsSync(target)) return res.fail('file not found', 404, 404);
  fs.writeFileSync(target, String(req.body.content || ''), 'utf8');
  res.ok({ name: String(req.query.path || path.basename(target)).replace(/\\/g, '/'), path: target, content: fs.readFileSync(target, 'utf8') });
});

router.get('/:id/files/:file', (req, res) => {
  const item = load().find(x => x.id === req.params.id);
  if (!item) return res.fail('skill not found', 404, 404);
  const target = safeSkillFile(item, req.params.file);
  if (!target || !fs.existsSync(target)) return res.fail('file not found', 404, 404);
  res.ok({ name: path.basename(target), path: target, content: fs.readFileSync(target, 'utf8') });
});

router.put('/:id/files/:file', (req, res) => {
  const item = load().find(x => x.id === req.params.id);
  if (!item) return res.fail('skill not found', 404, 404);
  const target = safeSkillFile(item, req.params.file);
  if (!target || !fs.existsSync(target)) return res.fail('file not found', 404, 404);
  fs.writeFileSync(target, String(req.body.content || ''), 'utf8');
  res.ok({ name: path.basename(target), path: target, content: fs.readFileSync(target, 'utf8') });
});

router.get('/folder', (req, res) => {
  ensureDir();
  res.ok({ path: LOCAL_DIR });
});

router.post('/', (req, res) => {
  const list = load();
  const item = {
    id: 'u-' + crypto.randomUUID().slice(0, 8),
    icon: req.body.icon || 'SK',
    name: req.body.name || '自定义技能',
    desc: req.body.desc || '',
    tags: req.body.tags || ['自定义'],
    source: req.body.source || 'custom',
    on: Boolean(req.body.on),
    prompt: req.body.prompt || '',
  };
  item.path = writeSkillFile(item);
  list.push(item);
  store.write(KEY, list);
  res.ok(item);
});

router.post('/describe', async (req, res) => {
  const { name, content } = req.body || {};
  if (!name && !content) return res.fail('name or content required', 400, 400);
  try {
    const prompt = `请为以下技能生成一段简洁的中文描述（50字以内，不要加引号）：\n\n技能名称：${name || '未命名'}\n${content ? '技能内容：\n' + String(content).slice(0, 2000) : ''}`;
    const messages = [
      { role: 'system', content: '你是一个技能描述生成器，只输出描述文本，不要任何额外内容。' },
      { role: 'user', content: prompt },
    ];
    let desc = '';
    const cfg = store.read('models', {});
    for await (const event of chatStream(cfg, messages)) {
      if (event.type === 'token') desc += event.text;
      if (event.type === 'error') { desc = name + '相关技能'; break; }
    }
    res.ok({ description: (desc || name + '相关技能').trim() });
  } catch (e) {
    res.ok({ description: (name || '自定义') + '相关技能' });
  }
});

router.post('/import', (req, res) => {
  const list = load();
  let parsed = {};
  if (req.body.content) {
    try { parsed = JSON.parse(req.body.content); } catch { parsed = {}; }
  }
  const item = {
    id: 'u-' + crypto.randomUUID().slice(0, 8),
    icon: req.body.icon || parsed.icon || 'SK',
    name: req.body.name || parsed.name || req.body.filename?.replace(/\.[^.]+$/, '') || '导入 Skill',
    desc: req.body.desc || parsed.desc || parsed.description || '',
    tags: req.body.tags || parsed.tags || ['自定义'],
    source: 'custom',
    on: Boolean(req.body.on ?? parsed.on),
    prompt: req.body.prompt || parsed.prompt || req.body.content || '',
  };
  item.path = writeSkillFile(item);
  list.push(item);
  store.write(KEY, list);
  res.ok(item);
});

router.post('/:id/open-folder', (req, res) => {
  ensureDir();
  const list = load();
  const item = list.find(x => x.id === req.params.id);
  if (!item) return res.fail('skill not found', 404, 404);
  let target = LOCAL_DIR;
  if (item.path) {
    const dir = path.dirname(item.path);
    if (fs.existsSync(dir)) target = dir;
  }
  if (!fs.existsSync(target)) return res.fail('path not found', 404, 404);
  const cmd = process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  spawn(cmd, [target], { detached: true, stdio: 'ignore' })
    .on('error', () => { /* xdg-open not available */ })
    .unref();
  res.ok({ path: target });
});

router.put('/:id', (req, res) => {
  const list = load();
  const i = list.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.fail('skill not found', 404, 404);
  list[i] = { ...list[i], ...req.body, id: list[i].id };
  if (list[i].source !== 'builtin') list[i].path = writeSkillFile(list[i]);
  store.write(KEY, list);
  res.ok(list[i]);
});

router.delete('/:id', (req, res) => {
  const list = load();
  const item = list.find(x => x.id === req.params.id);
  if (item?.source === 'builtin') return res.fail('内置技能不能删除，可以关闭启用状态', 400, 400);
  const next = list.filter(x => x.id !== req.params.id);
  store.write(KEY, next);
  res.ok();
});

module.exports = router;
