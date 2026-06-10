/**
 * Simple JSON file store. Thread-safe enough for single-process dev usage.
 */
const fs = require('fs');
const path = require('path');

function defaultDataDir() {
  if (process.env.HERMES_WEBUI_STORE_DIR) return process.env.HERMES_WEBUI_STORE_DIR;
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.USERPROFILE || process.cwd();
    return path.join(base, 'Hermes-WebUI', 'data');
  }
  return path.join(process.env.HOME || process.cwd(), '.hermes-webui', 'data');
}

const DATA_DIR = path.resolve(defaultDataDir());
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function file(name) {
  return path.join(DATA_DIR, name + '.json');
}

function backupCorruptFile(f, name) {
  try {
    if (!fs.existsSync(f)) return;
    const dir = path.join(DATA_DIR, 'corrupt-backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(dir, `${name}.${stamp}.json`);
    fs.copyFileSync(f, backup);
    console.warn('[store] corrupt backup saved:', backup);
  } catch (e) {
    console.warn('[store] corrupt backup failed for', name, e.message);
  }
}

function read(name, fallback) {
  const f = file(name);
  if (!fs.existsSync(f)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.warn('[store] parse failed for', name, e.message);
    backupCorruptFile(f, name);
    return fallback;
  }
}

function write(name, data) {
  const target = file(name);
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

module.exports = { read, write, DATA_DIR, file };
