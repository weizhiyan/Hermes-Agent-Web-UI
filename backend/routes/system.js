const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const store = require('../services/store');

const router = express.Router();
const PROJECT_ROOT = path.resolve(path.join(__dirname, '..', '..'));
const DEFAULT_MD_LIBRARY_DIR = path.join(store.DATA_DIR, 'output-md');

function mdLibraryRoot() {
  const settings = store.read('settings', {}) || {};
  return path.resolve(normalizeIncomingPath(settings.mdLibraryDir || process.env.HERMES_MD_LIBRARY_DIR || DEFAULT_MD_LIBRARY_DIR));
}

function roots() {
  return [...new Set([
    path.resolve(store.DATA_DIR),
    PROJECT_ROOT,
    mdLibraryRoot(),
  ])];
}

function allowed(target) {
  const full = path.resolve(target);
  return roots().some(root => full === root || full.startsWith(root + path.sep));
}

function normalizeIncomingPath(target) {
  const text = String(target || '');
  const win = text.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (win && process.platform !== 'win32') {
    return `/mnt/${win[1].toLowerCase()}/${win[2].replace(/\\/g, '/')}`;
  }
  const wsl = text.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (wsl && process.platform === 'win32') {
    return `${wsl[1].toUpperCase()}:\\${wsl[2].replace(/\//g, '\\')}`;
  }
  return text;
}

function toExplorerPath(target) {
  const text = String(target || '');
  const match = text.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (match) {
    return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}`;
  }
  return target;
}

function safeStat(target) {
  try { return fs.statSync(target); } catch { return null; }
}

function itemFor(dir, entry) {
  const full = path.join(dir, entry.name);
  const stat = safeStat(full);
  return {
    name: entry.name,
    path: full,
    type: entry.isDirectory() ? 'folder' : 'file',
    size: entry.isFile() && stat ? stat.size : 0,
    mtime: stat ? stat.mtimeMs : 0,
    ext: entry.isFile() ? path.extname(entry.name).toLowerCase() : '',
  };
}

router.post('/open-path', (req, res) => {
  const target = normalizeIncomingPath(req.body.path);
  if (!target || !allowed(target)) return res.fail('path not allowed', 403, 403);
  const finalTarget = fs.existsSync(target) ? target : path.dirname(target);
  if (!fs.existsSync(finalTarget)) return res.fail('path not found', 404, 404);
  const stat = safeStat(finalTarget);
  const explorerTarget = toExplorerPath(finalTarget);
  const args = stat && stat.isFile() ? ['/select,', explorerTarget] : [explorerTarget];
  spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref();
  res.ok({ path: finalTarget });
});

router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const logs = store.read('logs', []);
  res.ok(logs.slice(-limit));
});

router.post('/logs', (req, res) => {
  const logs = store.read('logs', []);
  const entry = {
    ts: Date.now(),
    level: req.body.level || 'info',
    msg: req.body.msg || '',
    source: req.body.source || 'system',
  };
  logs.push(entry);
  if (logs.length > 1000) logs.splice(0, logs.length - 1000);
  store.write('logs', logs);
  res.ok(entry);
});

router.get('/files', (req, res) => {
  const dir = path.resolve(normalizeIncomingPath(req.query.dir || store.DATA_DIR));
  if (!allowed(dir)) return res.fail('path not allowed', 403, 403);
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => !d.name.startsWith('.'))
      .map(d => itemFor(dir, d))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
    const parent = path.dirname(dir);
    res.ok({
      path: dir,
      parent: parent !== dir && allowed(parent) ? parent : null,
      roots: [
        { id: 'data', label: '数据目录', path: path.resolve(store.DATA_DIR) },
        { id: 'workspace', label: '项目目录', path: PROJECT_ROOT },
        { id: 'md', label: 'MD 输出库', path: mdLibraryRoot() },
      ],
      items,
    });
  } catch (e) {
    res.ok({ path: dir, items: [], error: e.message });
  }
});

router.get('/file-content', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.query.path || ''));
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.fail('not a file', 400, 400);
    if (stat.size > 1024 * 1024) return res.fail('file too large (max 1MB)', 400, 400);
    const content = fs.readFileSync(filePath, 'utf8');
    res.ok({ path: filePath, content, size: stat.size, mtime: stat.mtimeMs, ext: path.extname(filePath).toLowerCase() });
  } catch (e) {
    res.fail('read failed: ' + e.message, 500, 500);
  }
});

router.get('/file-raw', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.query.path || ''));
  if (!filePath || !allowed(filePath)) return res.status(403).send('path not allowed');
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.status(400).send('not a file');
    if (stat.size > 30 * 1024 * 1024) return res.status(413).send('file too large');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).send('read failed: ' + e.message);
  }
});

function stripFrontmatter(content) {
  return String(content || '').replace(/^---\s*[\s\S]*?\n---\s*/m, '');
}

function parseFrontmatter(content) {
  const match = String(content || '').match(/^---\s*([\s\S]*?)\n---/m);
  const out = {};
  if (!match) return out;
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
    out[key] = value;
  }
  return out;
}

function firstHeading(content) {
  const body = stripFrontmatter(content);
  const line = body.split(/\r?\n/).find(l => /^#\s+/.test(l.trim()));
  return line ? line.replace(/^#\s+/, '').trim() : '';
}

function summarizeMarkdown(content) {
  const body = stripFrontmatter(content)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map(line => line.replace(/^#{1,6}\s+/, '').replace(/^[>\-\*\d\.\s]+/, '').trim())
    .filter(Boolean)
    .find(line => line.length > 12) || '';
  return body.length > 118 ? body.slice(0, 118) + '...' : body || '暂无内容概括';
}

function inferMdType(fileName, content, relPath) {
  const text = `${fileName}\n${relPath}\n${stripFrontmatter(content).slice(0, 2000)}`.toLowerCase();
  const rules = [
    ['文章', /文章|博客|blog|essay|post|专栏/],
    ['方案', /方案|proposal|plan|prd|需求|设计方案/],
    ['报告', /报告|report|复盘|review|分析|调研/],
    ['教程', /教程|guide|how to|步骤|使用指南|说明/],
    ['会议纪要', /会议|纪要|meeting|minutes/],
    ['代码文档', /api|接口|代码|函数|class|组件|开发/],
    ['视觉设计', /ui|视觉|样式|设计|交互|验收/],
    ['其他', /.*/],
  ];
  return (rules.find(([, re]) => re.test(text)) || rules[rules.length - 1])[0];
}

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value).split(/[,\s，、]+/).map(s => s.trim()).filter(Boolean);
}

function scanMarkdownFiles(root) {
  const files = [];
  const maxFiles = 500;
  const skipDirs = new Set(['.git', 'node_modules', 'history-md', 'memory']);

  function walk(dir, depth) {
    if (files.length >= maxFiles || depth > 8) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles || entry.name.startsWith('.') || skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') continue;
      const stat = safeStat(full);
      if (!stat || stat.size > 1024 * 1024) continue;
      const rel = path.relative(root, full);
      const parts = rel.split(path.sep);
      const folder = parts.length > 1 ? parts[0] : '根目录';
      let content = '';
      try { content = fs.readFileSync(full, 'utf8'); } catch { content = ''; }
      const fm = parseFrontmatter(content);
      const title = String(fm.title || firstHeading(content) || path.basename(entry.name, '.md')).trim();
      const mdType = String(fm.type || fm.category || inferMdType(entry.name, content, rel)).trim();
      const tags = [...new Set([...normalizeTags(fm.tags), ...normalizeTags(fm.tag)])];
      files.push({
        id: Buffer.from(full).toString('base64url'),
        title,
        file: entry.name,
        path: full,
        dir: path.dirname(full),
        relativePath: rel,
        folder,
        mdType,
        type: mdType,
        tags,
        summary: String(fm.summary || fm.description || summarizeMarkdown(content)).trim(),
        mtime: stat.mtimeMs,
        size: stat.size,
      });
    }
  }

  walk(root, 0);
  return files.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
}

function groupBy(list, key, label) {
  const map = new Map();
  for (const item of list) {
    const value = key(item) || label;
    if (!map.has(value)) map.set(value, { [label === '其他' ? 'name' : 'name']: value, files: [] });
    map.get(value).files.push(item);
  }
  return [...map.entries()].map(([name, group]) => ({ name, type: name, tag: name, folder: name, files: group.files }))
    .sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name, 'zh-CN'));
}

router.get('/md-library', (req, res) => {
  const root = mdLibraryRoot();
  if (!allowed(root)) return res.fail('path not allowed', 403, 403);
  try {
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    const filesFlat = scanMarkdownFiles(root);
    const folders = groupBy(filesFlat, f => f.folder, '根目录');
    const types = groupBy(filesFlat, f => f.mdType, '其他');
    const tagItems = [];
    const tagMap = new Map();
    for (const file of filesFlat) {
      for (const tag of file.tags || []) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag).push(file);
      }
    }
    for (const [tag, files] of tagMap.entries()) tagItems.push({ tag, name: tag, files });
    tagItems.sort((a, b) => b.files.length - a.files.length || a.tag.localeCompare(b.tag, 'zh-CN'));
    res.ok({
      root,
      filesFlat,
      folders,
      types,
      tags: tagItems,
      stats: {
        total: filesFlat.length,
        folders: folders.length,
        types: types.length,
        lastUpdated: filesFlat[0]?.mtime || 0,
      },
    });
  } catch (e) {
    res.fail('scan failed: ' + e.message, 500, 500);
  }
});

module.exports = router;
