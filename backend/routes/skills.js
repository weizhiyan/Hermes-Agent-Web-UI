const express = require('express');
const crypto = require('crypto');
const store = require('../services/store');

const router = express.Router();
const KEY = 'skills';

const DEFAULTS = [
  { id: 'code-review', icon: '🧪', name: '代码评审', desc: '逐行审阅并给出重构建议', tags: ['代码', '重构'], on: true,
    prompt: '你是一位资深代码评审专家。请逐行审阅用户提供的代码，指出潜在问题、安全漏洞、性能瓶颈，并给出具体的重构建议。回复使用 Markdown 格式，按问题严重程度排列。' },
  { id: 'web-search', icon: '🔍', name: '联网搜索', desc: '实时检索与引用来源', tags: ['搜索'], on: false,
    prompt: '你具备联网搜索能力。当用户提出需要最新信息的问题时，请主动搜索并引用来源，确保信息的时效性和准确性。' },
  { id: 'file-ops', icon: '📁', name: '文件操作', desc: '读写本地文件与批处理', tags: ['系统'], on: true,
    prompt: '你具备文件操作能力。可以帮助用户读取、创建、修改文件，以及进行批量文件处理。操作前请确认用户意图。' },
  { id: 'image-gen', icon: '🎨', name: '图像生成', desc: '根据提示词生成图片', tags: ['多模态'], on: false,
    prompt: '你具备图像生成能力。当用户需要生成图片时，请帮助用户优化提示词，使其更加精确和富有描述性。' },
  { id: 'shell', icon: '💻', name: 'Shell 执行', desc: '执行受限 Shell 命令', tags: ['系统', '危险'], on: false,
    prompt: '你具备 Shell 命令执行能力。可以帮用户执行安全的系统命令，但必须拒绝任何危险操作（如 rm -rf /、格式化磁盘等）。执行前请向用户确认。' },
  { id: 'memory', icon: '🧠', name: '长期记忆', desc: '跨会话记住偏好', tags: ['记忆'], on: true,
    prompt: '你具备长期记忆能力。请记住用户在对话中表达的偏好、习惯和重要信息，在后续对话中主动运用这些记忆来提供更个性化的服务。' },
];

function load() {
  let v = store.read(KEY, null);
  if (!v) { store.write(KEY, DEFAULTS); return DEFAULTS; }
  let dirty = false;
  v.forEach(item => {
    const def = DEFAULTS.find(d => d.id === item.id);
    if (def && !item.prompt) { item.prompt = def.prompt; dirty = true; }
    if (!item.prompt) { item.prompt = ''; dirty = true; }
  });
  if (dirty) store.write(KEY, v);
  return v;
}

router.get('/', (req, res) => res.ok(load()));

router.post('/', (req, res) => {
  const list = load();
  const item = {
    id: 'u-' + crypto.randomUUID().slice(0, 8),
    icon: req.body.icon || '✨',
    name: req.body.name || '自定义技能',
    desc: req.body.desc || '',
    tags: req.body.tags || ['自定义'],
    on: false,
    prompt: req.body.prompt || '',
  };
  list.push(item);
  store.write(KEY, list);
  res.ok(item);
});

router.put('/:id', (req, res) => {
  const list = load();
  const i = list.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.fail('skill not found', 404, 404);
  list[i] = { ...list[i], ...req.body, id: list[i].id };
  store.write(KEY, list);
  res.ok(list[i]);
});

router.delete('/:id', (req, res) => {
  const list = load().filter(x => x.id !== req.params.id);
  store.write(KEY, list);
  res.ok();
});

module.exports = router;
