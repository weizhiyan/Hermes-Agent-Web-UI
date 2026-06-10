const express = require('express');
const crypto = require('crypto');
const store = require('../services/store');
const { redactSecrets, sanitizeAny } = require('../services/security');

const router = express.Router();
const KEY = 'webui-issues';
const MAX_ISSUES = 1000;

function safeText(value, max = 2000) {
  return redactSecrets(String(value || '').replace(/\r\n/g, '\n').trim()).slice(0, max);
}

function readIssues() {
  const list = store.read(KEY, []);
  return Array.isArray(list) ? list : [];
}

function writeIssues(list) {
  store.write(KEY, list.slice(0, MAX_ISSUES));
}

function normalizeIssue(body = {}, source = 'user') {
  const now = Date.now();
  const context = body.context && typeof body.context === 'object' ? sanitizeAny(body.context) : {};
  const recentEvents = Array.isArray(body.recentEvents) ? body.recentEvents.slice(-30).map(sanitizeAny) : [];
  const title = safeText(body.title || body.description || body.message || 'WebUI 问题', 120) || 'WebUI 问题';
  return {
    id: 'issue_' + now.toString(36) + '_' + crypto.randomBytes(3).toString('hex'),
    type: safeText(body.type || source, 60) || source,
    source,
    title,
    description: safeText(body.description || body.message || '', 3000),
    severity: ['low', 'medium', 'high', 'critical'].includes(String(body.severity || '').toLowerCase()) ? String(body.severity).toLowerCase() : 'medium',
    status: ['open', 'triaged', 'fixed', 'ignored'].includes(String(body.status || '').toLowerCase()) ? String(body.status).toLowerCase() : 'open',
    page: safeText(body.page || context.page || '', 80),
    chatId: safeText(body.chatId || context.chatId || '', 120),
    messageId: safeText(body.messageId || context.messageId || '', 120),
    agentId: safeText(body.agentId || context.agentId || '', 120),
    model: safeText(body.model || context.model || '', 160),
    runtime: safeText(body.runtime || context.runtime || '', 80),
    url: safeText(body.url || context.url || '', 500),
    trigger: safeText(body.trigger || '', 500),
    expected: safeText(body.expected || '', 1000),
    actual: safeText(body.actual || '', 1000),
    context,
    recentEvents,
    createdAt: now,
    updatedAt: now,
  };
}

function issueMarkdown(issue) {
  const lines = [];
  lines.push('## ' + issue.title);
  lines.push('');
  lines.push('- ID：' + issue.id);
  lines.push('- 来源：' + issue.source);
  lines.push('- 状态：' + issue.status);
  lines.push('- 严重级别：' + issue.severity);
  lines.push('- 创建时间：' + new Date(issue.createdAt).toLocaleString('zh-CN'));
  if (issue.page) lines.push('- 页面：' + issue.page);
  if (issue.chatId) lines.push('- 对话：' + issue.chatId);
  if (issue.agentId) lines.push('- Agent：' + issue.agentId);
  if (issue.model) lines.push('- 模型：' + issue.model);
  if (issue.runtime) lines.push('- Runtime：' + issue.runtime);
  if (issue.url) lines.push('- URL：' + issue.url);
  lines.push('');
  lines.push('### 问题描述');
  lines.push(issue.description || issue.title);
  if (issue.trigger || issue.expected || issue.actual) {
    lines.push('');
    lines.push('### 触发与预期');
    if (issue.trigger) lines.push('- 触发条件：' + issue.trigger);
    if (issue.expected) lines.push('- 预期：' + issue.expected);
    if (issue.actual) lines.push('- 实际：' + issue.actual);
  }
  if (issue.recentEvents && issue.recentEvents.length) {
    lines.push('');
    lines.push('### 近期事件');
    issue.recentEvents.slice(-10).forEach((event, index) => {
      lines.push((index + 1) + '. `' + (event.type || event.stage || event.source || 'event') + '` ' + safeText(event.message || event.msg || event.text || event.name || '', 200));
    });
  }
  return lines.join('\n');
}

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100) || 100, 500);
  const status = String(req.query.status || '').toLowerCase();
  let list = readIssues();
  if (status) list = list.filter(item => item.status === status);
  res.ok(list.slice(0, limit));
});

router.post('/', (req, res) => {
  const issue = normalizeIssue(req.body || {}, req.body?.source === 'auto' ? 'auto' : 'user');
  const list = readIssues();
  list.unshift(issue);
  writeIssues(list);
  res.ok(issue);
});

router.patch('/:id', (req, res) => {
  const list = readIssues();
  const issue = list.find(item => item.id === req.params.id);
  if (!issue) return res.fail('issue not found', 404, 404);
  ['status', 'severity', 'title', 'description'].forEach(key => {
    if (req.body[key] !== undefined) issue[key] = key === 'description' ? safeText(req.body[key], 3000) : safeText(req.body[key], 160);
  });
  issue.updatedAt = Date.now();
  writeIssues(list);
  res.ok(issue);
});

router.get('/report/markdown', (req, res) => {
  const status = String(req.query.status || 'open').toLowerCase();
  let list = readIssues();
  if (status && status !== 'all') list = list.filter(item => item.status === status);
  const title = '# WebUI 问题收集报告';
  const meta = ['- 生成时间：' + new Date().toLocaleString('zh-CN'), '- 状态：' + (status === 'all' ? '全部' : status), '- 数量：' + list.length].join('\n');
  res.type('text/markdown').send([title, '', meta, '', ...list.map(issueMarkdown)].join('\n\n'));
});

module.exports = router;
