const express = require('express');
const store = require('../services/store');

const router = express.Router();
const KEY = 'settings';

const DEFAULTS = {
  theme: 'dark',
  lang: 'zh',
  stream: true,
  autoTitle: true,
  history: 16,
  systemPrompt: '',
  /** API 根地址（可选）。空则前端使用当前页面 origin。 */
  api: '',
  hermesModel: '',
  hermesPath: '',
  quickMode: false,
  mdLibraryDir: '',
  debugPerf: false,
};

router.get('/', (req, res) => res.ok(store.read(KEY, DEFAULTS)));

router.put('/', (req, res) => {
  const merged = { ...store.read(KEY, DEFAULTS), ...req.body };
  store.write(KEY, merged);
  res.ok(merged);
});

module.exports = router;
