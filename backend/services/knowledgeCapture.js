const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const DOC_FOLDERS = ['输出文档', '问题沉淀', 'Prompt模板', '项目经验', '生图记录', '工作流', '规则与偏好', '临时收件箱'];
const LEGACY_DOC_FOLDERS = ['工作文档', 'AI分享', '教程', '笔记'];
const CATEGORY_ID_TO_FOLDER = { outputs: '\u8f93\u51fa\u6587\u6863', questions: '\u95ee\u9898\u6c89\u6dc0', prompts: 'Prompt\u6a21\u677f', projects: '\u9879\u76ee\u7ecf\u9a8c', images: '\u751f\u56fe\u8bb0\u5f55', workflows: '\u5de5\u4f5c\u6d41', rules: '\u89c4\u5219\u4e0e\u504f\u597d', inbox: '\u4e34\u65f6\u6536\u4ef6\u7bb1', question: '\u95ee\u9898\u6c89\u6dc0', prompt: 'Prompt\u6a21\u677f', image: '\u751f\u56fe\u8bb0\u5f55', project: '\u9879\u76ee\u7ecf\u9a8c', workflow: '\u5de5\u4f5c\u6d41', rule: '\u89c4\u5219\u4e0e\u504f\u597d' };
const VAULT_CATEGORIES = [
  { id: 'outputs', label: '输出文档', folder: '输出文档', aliases: ['工作文档', 'AI分享', '教程', '笔记'] },
  { id: 'questions', label: '问题沉淀', folder: '问题沉淀' },
  { id: 'prompts', label: 'Prompt 模板', folder: 'Prompt模板' },
  { id: 'projects', label: '项目经验', folder: '项目经验' },
  { id: 'images', label: '生图记录', folder: '生图记录' },
  { id: 'workflows', label: '工作流', folder: '工作流' },
  { id: 'rules', label: '规则与偏好', folder: '规则与偏好' },
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
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map(line => line.replace(/^#{1,6}\s+/, '').replace(/^[>\-\*\d\.\s]+/, '').trim())
    .filter(Boolean)
    .find(line => line.length > 12) || '';
  return body.length > 118 ? body.slice(0, 118) + '...' : body || '暂无内容概括';
}

function inferMdType(fileName, content, relPath) {
  const text = `${fileName}\n${relPath}\n${stripFrontmatter(content).slice(0, 2000)}`.toLowerCase();
  const rules = [
    ['生图记录', /生图|图片|图像|image|midjourney|dall|flux|stable diffusion|绘图|画面|风格|prompt.*图|图.*prompt/],
    ['Prompt模板', /prompt|提示词|咒语|模板|system prompt|agent prompt|ui prompt/],
    ['问题沉淀', /原始问题|追问|提问|问题|思考路径|决策逻辑|修改过程|复盘问题|question/],
    ['项目经验', /项目|产品|需求|prd|设计方案|ui\s*规范|模型配置|踩坑|经验|方案|proposal|plan/],
    ['工作流', /工作流|流程|workflow|codex|claude code|agent|自动化|协作流程/],
    ['规则与偏好', /规则|偏好|审美|表达习惯|长期记忆|profile|preference|style guide/],
    ['输出文档', /输出|文档|教程|guide|how to|步骤|使用指南|说明|manual|报告|周报|分享|presentation|文章|专栏|总结/],
    ['代码文档', /api|接口|代码|函数|class|组件|开发/],
    ['其他', /.*/],
  ];
  return (rules.find(([, re]) => re.test(text)) || rules[rules.length - 1])[0];
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
  const text = (exact + '\n' + String(content || '')).toLowerCase();
  if (/生图|图片|图像|image|midjourney|dall|flux|stable diffusion|绘图|画面|风格|prompt.*图|图.*prompt/.test(text)) return '生图记录';
  if (/prompt|提示词|咒语|模板|system prompt|agent prompt|ui prompt/.test(text)) return 'Prompt模板';
  if (/原始问题|追问|提问|问题|思考路径|决策逻辑|修改过程|question/.test(text)) return '问题沉淀';
  if (/项目|产品|需求|prd|设计方案|ui\s*规范|模型配置|踩坑|经验|方案|proposal|plan/.test(text)) return '项目经验';
  if (/工作流|流程|workflow|codex|claude code|agent|自动化|协作流程/.test(text)) return '工作流';
  if (/规则|偏好|审美|表达习惯|长期记忆|profile|preference|style guide/.test(text)) return '规则与偏好';
  if (/输出|文档|教程|guide|how\s*to|manual|步骤|使用说明|排错|报告|周报|分享|presentation|演讲|课程|案例|笔记|note|memo|灵感|学习|知识卡片|工作|复盘|汇报|会议|report/.test(text)) return '输出文档';
  return '临时收件箱';
}

function ensureMarkdownFrontmatter(content, meta = {}) {
  const raw = String(content || '').trim();
  const existing = parseFrontmatter(raw);
  const body = stripFrontmatter(raw).trimStart();
  const title = String(meta.title || existing.title || firstHeading(raw) || '未命名文档').trim();
  const tags = [...new Set([...normalizeTags(existing.tags), ...normalizeTags(existing.tag), ...normalizeTags(meta.tags)])].slice(0, 12);
  // Default to 临时收件箱 unless explicitly specified — user or AI can reclassify later
  const folder = String(meta.folder || existing.folder || existing.type || existing.category || '').trim() || '临时收件箱';
  const type = String(meta.type || existing.type || existing.category || folder).trim();
  const summary = String(meta.summary || existing.summary || existing.description || summarizeMarkdown(raw)).replace(/\r?\n/g, ' ').trim();
  const status = String(meta.status || existing.status || 'draft').trim();
  const created = String(meta.created || existing.created || new Date().toISOString()).trim();
  const source = String(meta.source || existing.source || 'hermes-webui').trim();
  const yaml = [
    '---',
    'title: ' + yamlScalar(title),
    'folder: ' + yamlScalar(folder),
    'type: ' + yamlScalar(type),
    'tags: ' + yamlList(tags),
    'created: ' + yamlScalar(created),
    'updated: ' + yamlScalar(new Date().toISOString()),
    meta.chatId ? 'chatId: ' + yamlScalar(meta.chatId) : '',
    meta.agentId ? 'agentId: ' + yamlScalar(meta.agentId) : '',
    meta.agentName ? 'agentName: ' + yamlScalar(meta.agentName) : '',
    'related: []',
    'source: ' + yamlScalar(source),
    'status: ' + yamlScalar(status),
    'summary: ' + yamlScalar(summary.slice(0, 180)),
    'createdBy: hermes',
    '---',
    '',
  ].filter(line => line !== '').join('\n');
  return { title, folder, type, tags, summary, status, content: yaml + body };
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
  if (Buffer.byteLength(raw, 'utf8') > 1024 * 1024) throw new Error('file too large (max 1MB)');
  const doc = ensureMarkdownFrontmatter(raw, meta || {});
  const folder = normalizeDocFolder(doc.folder, [doc.title, doc.type, (doc.tags || []).join(' '), raw].join('\n'));
  const dir = path.join(root, folder);
  fs.mkdirSync(dir, { recursive: true });
  const target = uniqueMarkdownPath(dir, doc.title);
  fs.writeFileSync(target, doc.content, 'utf8');
  const stat = fs.statSync(target);
  return { title: doc.title, folder, path: target, file: path.basename(target), size: stat.size, mtime: stat.mtimeMs };
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
    type: payload.type || payload.kind,
    tags: payload.tags,
    source: payload.source || 'hermes-webui',
    status: payload.status || 'auto',
    summary: payload.summary,
    chatId: payload.chatId,
    agentId: payload.agentId,
    agentName: payload.agentName,
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
