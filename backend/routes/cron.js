const express = require('express');
const crypto = require('crypto');
const store = require('../services/store');

const router = express.Router();
const KEY = 'cron';
const load = () => store.read(KEY, []);
const save = list => store.write(KEY, list);

router.get('/', (req, res) => res.ok(load()));
router.post('/', (req, res) => {
  const item = {
    id: crypto.randomUUID(),
    name: req.body.name || '未命名任务',
    schedule: req.body.schedule || '0 9 * * *',
    prompt: req.body.prompt || '',
    enabled: req.body.enabled !== false,
    createdAt: Date.now(),
    lastRun: null,
  };
  const list = load();
  list.unshift(item);
  save(list);
  res.ok(item);
});
router.put('/:id', (req, res) => {
  const list = load();
  const i = list.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.fail('cron not found', 404, 404);
  list[i] = { ...list[i], ...req.body, id: list[i].id };
  save(list);
  res.ok(list[i]);
});
router.delete('/:id', (req, res) => {
  save(load().filter(x => x.id !== req.params.id));
  res.ok();
});
module.exports = router;
