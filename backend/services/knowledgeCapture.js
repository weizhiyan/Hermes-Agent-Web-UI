const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const DOC_FOLDERS = ['输出文档', '临时收件箱'];
const LEGACY_DOC_FOLDERS = ['工作文档', 'AI分享', '教程', '笔记', '问题沉淀', 'Prompt模板', '项目经验', '生图记录', '工作流', '规则与偏好'];
const CATEGORY_ID_TO_FOLDER = {
  outputs: '输出文档',
  output: '输出文档',
  docs: '输出文档',
  document: '输出文档',
  final: '输出文档',
  inbox: '临时收件箱',
  draft: '临时收件箱',
  temp: '临时收件箱',
};
const VAULT_CATEGORIES = [
  { id: 'outputs', label: '输出文档', folder: '输出文档', aliases: ['工作文档', 'AI分享', '教程', '笔记'] },
  { id: 'inbox', label: '临时收件箱', folder: '临时收件箱' },
];

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
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
    .replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/gi, ' [图片] ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map(line => line.replace(/^#{1,6}\s+/, '').replace(/^[>\-\*\d\.\s]+/, '').trim())
    .filter(Boolean)
    .find(line => line.length > 12) || '';
  return body.length > 118 ? body.slice(0, 118) + '...' : body || '暂无内容概括';
}

function inferMdType(fileName, content, relPath) {
  const text = `${fileName}\n${relPath}\n${stripFrontmatter(content).slice(0, 2000)}`.toLowerCase();
  if (/输出|文档|教程|guide|how to|步骤|使用指南|说明|manual|报告|周报|分享|presentation|文章|专栏|总结|final|publish/.test(text)) return '输出文档';
  return '临时收件箱';
}

function yamlScalar(value) {
  return JSON.stringify(String(value ?? ''));
}

function yamlList(values = []) {
  return '[' + values.map(yamlScalar).join(', ') + ']';
}

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value).split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
}

function safeFilePart(value, fallback = '未命名文档') {
  const clean = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

function normalizeDocFolder(value, content = '') {
  const exact = String(value || '').trim();
  if (CATEGORY_ID_TO_FOLDER[exact]) return CATEGORY_ID_TO_FOLDER[exact];
  if (DOC_FOLDERS.includes(exact)) return exact;
  if (LEGACY_DOC_FOLDERS.includes(exact)) return '输出文档';
  if (/输出|正式|发布|publish|published|final|docs?|document/i.test(exact)) return '输出文档';
  const text = String(content || '').toLowerCase();
  if (!exact && /最终|正式|报告|教程|guide|manual|方案|总结|输出文档|publish|final/.test(text)) return '输出文档';
  return '临时收件箱';
}

function ensureMarkdownFrontmatter(content, meta = {}) {
  const raw = String(content || '').trim();
  const existing = parseFrontmatter(raw);
  const body = stripFrontmatter(raw).trimStart();
  const title = String(meta.title || existing.title || firstHeading(raw) || '未命名文档').trim();
  const tags = [...new Set([...normalizeTags(existing.tags), ...normalizeTags(existing.tag), ...normalizeTags(meta.tags)])].slice(0, 12);
  const folder = normalizeDocFolder(meta.folder || existing.folder || existing.type || existing.category || '临时收件箱', [title, body.slice(0, 1200)].join('\n'));
  const summary = String(meta.summary || existing.summary || existing.description || summarizeMarkdown(raw)).replace(/\r?\n/g, ' ').trim();
  const status = String(meta.status || existing.status || 'draft').trim();
  const created = String(meta.created || existing.created || new Date().toISOString()).trim();
  const source = String(meta.source || existing.source || 'agent').trim();
  const yaml = [
    '---',
    'title: ' + yamlScalar(title),
    'tags: ' + yamlList(tags),
    'created: ' + yamlScalar(created),
    'updated: ' + yamlScalar(new Date().toISOString()),
    'source: ' + yamlScalar(source),
    'status: ' + yamlScalar(status),
    'summary: ' + yamlScalar(summary.slice(0, 180)),
    '---',
    '',
  ].join('\n');
  return { title, folder, tags, summary, status, content: yaml + body };
}

function uniqueMarkdownPath(dir, title) {
  const date = new Date().toISOString().slice(0, 10);
  const base = date + '-' + safeFilePart(title) + '.md';
  let target = path.join(dir, base);
  let index = 2;
  while (fs.existsSync(target)) {
    target = path.join(dir, date + '-' + safeFilePart(title) + '-' + index + '.md');
    index += 1;
  }
  return target;
}

function mdLibraryRoot() {
  return paths.mdLibraryRoot();
}

function saveKnowledgeMarkdown(content, meta = {}) {
  const root = mdLibraryRoot();
  const raw = String(content || '').trim();
  if (!raw) throw new Error('content required');
  if (Buffer.byteLength(raw, 'utf8') > 5 * 1024 * 1024) throw new Error('file too large (max 5MB)');
  const doc = ensureMarkdownFrontmatter(raw, meta || {});
  const folder = normalizeDocFolder(doc.folder, [doc.title, (doc.tags || []).join(' '), raw].join('\n'));
  const dir = path.join(root, folder);
  fs.mkdirSync(dir, { recursive: true });
  const target = uniqueMarkdownPath(dir, doc.title);
  fs.writeFileSync(target, doc.content, 'utf8');
  const stat = fs.statSync(target);
  return { title: doc.title, folder, path: target, file: path.basename(target), size: stat.size, mtime: stat.mtimeMs, tags: doc.tags, summary: doc.summary };
}

function buildKnowledgeCaptureMarkdown(payload = {}) {
  const question = String(payload.question || payload.prompt || payload.rawQuestion || '').trim();
  const answer = String(payload.answer || payload.result || '').trim();
  const context = String(payload.context || '').trim();
  const kind = String(payload.kind || payload.type || 'question').trim();
  const title = String(payload.title || question.slice(0, 40) || '自动沉淀记录').trim();
  const sections = [
    `# ${title}`,
    '',
    '## 原始提问',
    question || '暂无',
  ];
  if (context) sections.push('', '## 关联上下文', context);
  if (answer) sections.push('', '## 最终结果', answer.slice(0, 12000));
  sections.push('', '## 沉淀信息', `- 类型：${kind}`, `- 来源：${payload.source || 'hermes-webui'}`, `- 时间：${new Date().toISOString()}`);
  return sections.join('\n');
}

function captureKnowledge(payload = {}) {
  const content = payload.content ? String(payload.content) : buildKnowledgeCaptureMarkdown(payload);
  const meta = {
    title: payload.title || payload.question || payload.prompt || '自动沉淀记录',
    folder: payload.folder,
    tags: payload.tags,
    source: payload.source || 'agent',
    status: payload.status || 'draft',
    summary: payload.summary,
  };
  return saveKnowledgeMarkdown(content, meta);
}

module.exports = {
  DOC_FOLDERS,
  CATEGORY_ID_TO_FOLDER,
  LEGACY_DOC_FOLDERS,
  VAULT_CATEGORIES,
  stripFrontmatter,
  parseFrontmatter,
  firstHeading,
  summarizeMarkdown,
  inferMdType,
  normalizeTags,
  safeFilePart,
  normalizeDocFolder,
  ensureMarkdownFrontmatter,
  uniqueMarkdownPath,
  saveKnowledgeMarkdown,
  buildKnowledgeCaptureMarkdown,
  captureKnowledge,
};
