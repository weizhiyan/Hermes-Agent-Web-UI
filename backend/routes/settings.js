const express = require('express');
const store = require('../services/store');

const router = express.Router();
const KEY = 'settings';

const DEFAULTS = {
  theme: 'light',
  lang: 'zh',
  stream: true,
  autoTitle: true,
  history: 20,
  systemPrompt: '',
  useHermesCli: true,
  hermesModel: 'deepseek-chat',
};

router.get('/', (req, res) => res.ok(store.read(KEY, DEFAULTS)));

router.put('/', (req, res) => {
  const merged = { ...store.read(KEY, DEFAULTS), ...req.body };
  store.write(KEY, merged);
  res.ok(merged);
});

module.exports = router;
