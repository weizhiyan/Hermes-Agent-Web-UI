const fs = require('fs');
const path = require('path');

const DEFAULT_EXTERNAL_SKILL_DIR = path.resolve(process.env.HERMES_WEBUI_SKILL_DIR || '/mnt/e/AI/记忆/skills');
const EXTERNAL_SKILL_DIRS = (process.env.HERMES_WEBUI_SKILL_DIRS || '')
  .split(path.delimiter)
  .map(v => v.trim())
  .filter(Boolean);
const CACHE_TTL_MS = Math.max(1000, Number(process.env.HERMES_SKILL_CACHE_TTL_MS || 10_000));
let discoverCache = { at: 0, rootsKey: '', items: [] };

function normalizeFsPath(target = '') {
  const text = String(target || '').trim();
  const wsl = text.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (wsl && process.platform === 'win32') return `${wsl[1].toUpperCase()}:\\${wsl[2].replace(/\//g, '\\')}`;
  const win = text.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (win && process.platform !== 'win32') return `/mnt/${win[1].toLowerCase()}/${win[2].replace(/\\/g, '/')}`;
  return text;
}

function externalSkillRoots() {
  const roots = [...EXTERNAL_SKILL_DIRS, DEFAULT_EXTERNAL_SKILL_DIR]
    .map(normalizeFsPath)
    .map(p => path.resolve(p));
  return [...new Set(roots)].filter(p => fs.existsSync(p));
}

function slugId(value = '') {
  return String(value || 'skill')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'skill';
}

function iconForName(name = '') {
  const text = String(name || 'SK').replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, '').slice(0, 2);
  return (text || 'SK').toUpperCase();
}

function parseFrontmatter(content = '') {
  const text = String(content || '').replace(/^\uFEFF/, '');
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  const meta = {};
  if (match) {
    match[1].split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!m) return;
      meta[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
    });
  }
  return { meta, body: match ? text.slice(match[0].length) : text, raw: text };
}

function firstUsefulLine(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#') && !line.startsWith('---')) || '';
}

function skillFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  const walk = (dir, prefix = '') => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const abs = path.join(dir, entry.name);
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.isFile() && /\.(md|json|ya?ml|txt)$/i.test(entry.name)) {
        const stat = fs.statSync(abs);
        out.push({ name: rel.replace(/\\/g, '/'), path: abs, size: stat.size, mtime: stat.mtimeMs });
      }
      if (out.length >= 200) return;
    }
  };
  walk(root);
  return out;
}

function externalSkillDirs(root) {
  if (!fs.existsSync(root)) return [];
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .map(entry => path.join(root, entry.name));
}

function skillFromDir(skillDir, root) {
  let entries = [];
  try { entries = fs.readdirSync(skillDir, { withFileTypes: true }); } catch { return null; }
  const skillFile = entries.find(e => e.isFile() && /^SKILL\.md$/i.test(e.name));
  const readmeFile = entries.find(e => e.isFile() && /^README\.md$/i.test(e.name));
  if (!skillFile && !readmeFile) return null;

  const filePath = path.join(skillDir, skillFile ? skillFile.name : readmeFile.name);
  const parsed = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
  const rel = path.relative(root, skillDir).replace(/\\/g, '/');
  const name = parsed.meta.name || path.basename(skillDir);
  const description = parsed.meta.description || firstUsefulLine(parsed.body).slice(0, 180);
  return {
    id: `external-${slugId(rel || name)}`,
    icon: iconForName(name),
    name,
    desc: description,
    description,
    tags: ['自定义', '外置Skill'],
    source: parsed.meta.source || 'external',
    category: parsed.meta.category || path.basename(root) || '外置Skill',
    on: true,
    enabled: true,
    prompt: parsed.raw,
    path: skillDir,
    files: skillFiles(skillDir).map(file => file.name),
    external: true,
  };
}

function discoverExternalSkills() {
  const roots = externalSkillRoots();
  const rootsKey = roots.join('|');
  const now = Date.now();
  if (discoverCache.items.length && discoverCache.rootsKey === rootsKey && now - discoverCache.at < CACHE_TTL_MS) {
    return discoverCache.items.map(item => ({ ...item }));
  }
  const found = [];
  const seen = new Set();
  roots.forEach(root => {
    externalSkillDirs(root).forEach(skillDir => {
      const resolved = path.resolve(skillDir);
      if (seen.has(resolved)) return;
      const skill = skillFromDir(resolved, root);
      if (!skill) return;
      seen.add(resolved);
      found.push(skill);
    });
  });
  discoverCache = { at: now, rootsKey, items: found };
  return found;
}

function clearDiscoveryCache() {
  discoverCache = { at: 0, rootsKey: '', items: [] };
}
function samePath(a = '', b = '') {
  if (!a || !b) return false;
  return path.resolve(normalizeFsPath(a)).toLowerCase() === path.resolve(normalizeFsPath(b)).toLowerCase();
}

module.exports = {
  discoverExternalSkills,
  externalSkillRoots,
  externalSkillDirs,
  normalizeFsPath,
  samePath,
  skillFiles,
  clearDiscoveryCache,
};
