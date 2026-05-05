const express = require('express');
const store = require('../services/store');

const router = express.Router();
const KEY = 'models';

const DEFAULTS = {
  anthropic: { base: 'https://api.anthropic.com', key: '', model: 'claude-opus-4-7' },
  openai: { base: 'https://api.openai.com/v1', key: '', model: 'gpt-4o' },
  deepseek: { base: 'https://api.deepseek.com', key: '', model: 'deepseek-chat' },
  local: { base: 'http://127.0.0.1:11434', model: 'qwen2.5:7b' },
  params: { temperature: 0.7, maxTokens: 2048, topP: 1 },
  current: 'deepseek-chat',
};

function load() {
  let cfg = store.read(KEY, null);
  if (!cfg) { store.write(KEY, DEFAULTS); return DEFAULTS; }
  let dirty = false;
  if (!cfg.deepseek) { cfg.deepseek = { ...DEFAULTS.deepseek }; dirty = true; }
  if (!cfg.anthropic) { cfg.anthropic = { ...DEFAULTS.anthropic }; dirty = true; }
  if (!cfg.openai) { cfg.openai = { ...DEFAULTS.openai }; dirty = true; }
  if (!cfg.local) { cfg.local = { ...DEFAULTS.local }; dirty = true; }
  if (!cfg.params) { cfg.params = { ...DEFAULTS.params }; dirty = true; }
  if (!cfg.current) { cfg.current = DEFAULTS.current; dirty = true; }
  if (dirty) store.write(KEY, cfg);
  return cfg;
}

router.get('/', (req, res) => res.ok(load()));

router.put('/', (req, res) => {
  const merged = { ...store.read(KEY, DEFAULTS), ...req.body };
  store.write(KEY, merged);
  res.ok(merged);
});

module.exports = router;
