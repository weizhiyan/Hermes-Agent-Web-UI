/**
 * Simple JSON file store. Thread-safe enough for single-process dev usage.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function file(name) {
  return path.join(DATA_DIR, name + '.json');
}

function read(name, fallback) {
  const f = file(name);
  if (!fs.existsSync(f)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.warn('[store] parse failed for', name, e.message);
    return fallback;
  }
}

function write(name, data) {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { read, write };
