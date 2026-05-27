const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const store = require('../services/store');
const { chatStream } = require('../services/llm');
const { discoverExternalSkills, externalSkillRoots, normalizeFsPath, samePath, skillFiles: discoverSkillFiles } = require('../services/skillDiscovery');

const router = express.Router();

function modelConfigForScope(scope = 'webui') {
  const root = store.read('models', {});
  if (root && typeof root === 'object' && (root.webui || root.agent)) {
    return { ...(root[scope] || root.webui || root.agent || {}) };
  }
  return { ...(root || {}) };
}
const KEY = 'skills';
const LOCAL_DIR = path.join(store.DATA_DIR, 'skills-local');
const DEFAULTS = [];

function ensureDir() {
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

function writeSkillFile(item) {
  ensureDir();
  const filePath = path.join(LOCAL_DIR, `${safeName(item.name)}-${item.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(item, null, 2), 'utf8');
  return filePath;
}

function skillRoot(item) {
  const itemPath = normalizeFsPath(item?.path || '');
  if (itemPath && fs.existsSync(itemPath)) {
    const stat = fs.statSync(itemPath);
    return stat.isDirectory() ? itemPath : path.dirname(itemPath);
  }
  return LOCAL_DIR;
}

function skillFiles(item) {
  return discoverSkillFiles(skillRoot(item));
}

function normalize(list) {
  const incoming = Array.isArray(list) ? list : [];
  const byId = new Map(incoming.map(item => [item.id, item]));
  const external = discoverExternalSkills().map(item => {
    const old = incoming.find(x => x && (x.id === item.id || samePath(x.path, item.path) || x.name === item.name));
    return old ? { ...item, on: old.on !== undefined ? old.on : item.on, enabled: old.enabled !== undefined ? old.enabled : old.on, pinned: old.pinned, useCount: old.useCount, viewCount: old.viewCount } : item;
  });
  const mergedDefaults = DEFAULTS.map(def => {
    const old = byId.get(def.id);
    return old ? { ...def, on: old.on !== undefined ? old.on : def.on, enabled: old.enabled !== undefined ? old.enabled : old.on } : def;
  });
  const custom = incoming
    .filter(item => item && item.id && !DEFAULTS.some(def => def.id === item.id))
    .filter(item => item.source !== 'builtin')
    .filter(item => item.source !== 'external')
    .filter(item => !external.some(ext => ext.id === item.id || samePath(ext.path, item.path) || ext.name === item.name))
    .map(item => ({ ...item, path: item.path ? normalizeFsPath(item.path) : item.path, source: item.source || ((item.tags || []).includes('用户制作') ? 'user' : 'custom') }))
    .filter(item => {
      if (item.path && fs.existsSync(normalizeFsPath(item.path))) return true;
      return Boolean(String(item.prompt || '').trim());
    });
  return [...mergedDefaults, ...external, ...custom];
}

function load() {
  const list = normalize(store.read(KEY, null));
  list.forEach(item => {
    item.files = skillFiles(item).map(f => f.name);
  });
  store.write(KEY, list);
  return list;
}

function safeSkillFile(item, fileName) {
  const root = path.resolve(skillRoot(item));
  const target = path.resolve(root, String(fileName || ''));
  if (target === root || !target.startsWith(root + path.sep)) return null;
  return target;
}

router.get('/', (_req, res) => res.ok(load()));

router.get('/folder', (_req, res) => {
  ensureDir();
  res.ok({ path: LOCAL_DIR, external: externalSkillRoots() });
});

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

router.post('/', (req, res) => {
  const list = load();
  const item = {
    id: 'u-' + crypto.randomUUID().slice(0, 8),
    icon: req.body.icon || 'SK',
    name: req.body.name || '自定义技能',
    desc: req.body.desc || '',
    description: req.body.description || req.body.desc || '',
    tags: req.body.tags || ['自定义'],
    source: req.body.source || 'custom',
    on: Boolean(req.body.on),
    enabled: Boolean(req.body.enabled ?? req.body.on),
    triggers: req.body.triggers || [],
    priority: Number(req.body.priority || 0),
    category: req.body.category || (Array.isArray(req.body.tags) ? req.body.tags[0] : ''),
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
    const prompt = `请为以下技能生成一段简洁的中文描述（40字以内，不要加引号）：\n\n技能名称：${name || '未命名'}\n${content ? '技能内容：\n' + String(content).slice(0, 2000) : ''}`;
    const messages = [
      { role: 'system', content: '你是一个技能描述生成器，只输出描述文本，不要任何额外内容。' },
      { role: 'user', content: prompt },
    ];
    let desc = '';
    const cfg = modelConfigForScope('webui');
    for await (const event of chatStream(cfg, messages)) {
      if (event.type === 'token') desc += event.text;
      if (event.type === 'error') { desc = `${name}相关技能`; break; }
    }
    res.ok({ description: (desc || `${name}相关技能`).trim() });
  } catch (e) {
    res.ok({ description: `${name || '自定义'}相关技能` });
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
    description: req.body.description || req.body.desc || parsed.description || parsed.desc || '',
    tags: req.body.tags || parsed.tags || ['自定义'],
    source: 'custom',
    on: Boolean(req.body.on ?? parsed.on),
    enabled: Boolean(req.body.enabled ?? req.body.on ?? parsed.enabled ?? parsed.on),
    triggers: req.body.triggers || parsed.triggers || [],
    priority: Number(req.body.priority ?? parsed.priority ?? 0),
    category: req.body.category || parsed.category || (Array.isArray(req.body.tags || parsed.tags) ? (req.body.tags || parsed.tags)[0] : ''),
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
    const itemPath = normalizeFsPath(item.path);
    const stat = fs.existsSync(itemPath) ? fs.statSync(itemPath) : null;
    target = stat?.isDirectory() ? itemPath : path.dirname(itemPath);
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
  if (!['builtin', 'external'].includes(list[i].source)) list[i].path = writeSkillFile(list[i]);
  store.write(KEY, list);
  res.ok(list[i]);
});

router.delete('/:id', (req, res) => {
  const list = load();
  const item = list.find(x => x.id === req.params.id);
  if (item?.source === 'builtin') return res.fail('内置技能不能删除，可以关闭启用状态', 400, 400);
  if (item?.source === 'external') return res.fail('外置 Skill 来自文件夹，请从外置目录中移除文件后刷新', 400, 400);
  const next = list.filter(x => x.id !== req.params.id);
  store.write(KEY, next);
  res.ok();
});

module.exports = router;