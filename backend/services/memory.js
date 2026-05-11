const fs = require('fs');
const path = require('path');
const store = require('./store');

const MEMORY_DIR = path.join(store.DATA_DIR, 'memory');
const CORE_DIR = path.join(MEMORY_DIR, 'core');
const HISTORY_DIR = path.join(store.DATA_DIR, 'history-md');

const CORE_FILES = [
  {
    id: 'AGENTS',
    file: 'AGENTS.md',
    title: '核心身份',
    description: 'Hermes Agent 的默认定位、协作风格和边界。',
    content: `# 核心身份

- Hermes Agent 是一个面向本地 WebUI 的协作型 AI 助手。
- 默认目标是帮助用户把想法落到可运行、可验收、可继续维护的结果上。
- 回答和文档优先使用中文，除非用户明确要求其他语言。
- 对高风险操作、删除、覆盖、外发隐私信息等行为，需要先提醒并确认。
`,
  },
  {
    id: 'PROFILE',
    file: 'PROFILE.md',
    title: '用户画像',
    description: '用户长期偏好、表达习惯和协作方式。',
    content: `# 用户画像

- 用户偏好直接、可操作、能落地的产品迭代。
- 用户希望 WebUI 视觉和交互都经过真实模拟操作验收，而不是只做代码层面的判断。
- 用户更喜欢中文说明，方便未来迁移电脑或交给其他 AI 继续维护。
`,
  },
  {
    id: 'PREFERENCES',
    file: 'PREFERENCES.md',
    title: '偏好规则',
    description: '界面、交互、输出格式等长期偏好。',
    content: `# 偏好规则

- 页面和弹窗需要适配深色/浅色主题，颜色尽量使用 CSS 变量。
- 交互反馈要清晰但克制，避免过重的悬停效果和闪烁。
- 同一概念不要在多个入口重复出现，优先保留用户最容易理解的位置。
- 验收时要模拟真实用户操作路径，发现问题后优先给出可修复方案。
`,
  },
  {
    id: 'TOOLS',
    file: 'TOOLS.md',
    title: '工具与数据',
    description: '本项目里可被 Hermes Agent 使用的本地资料位置。',
    content: `# 工具与数据

- 小脑瓜的核心记忆保存在 backend/data/memory/core/。
- WebUI 对话会导出为 Markdown，默认保存在 backend/data/history-md/。
- 技能文件主要来自 backend/data/skills-local/ 和 backend/data/skills.json。
- 频道配置对应后台网关数据，保存于 backend/data/gateway.json。
`,
  },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureMemoryStore() {
  ensureDir(CORE_DIR);
  ensureDir(HISTORY_DIR);
  for (const item of CORE_FILES) {
    const target = path.join(CORE_DIR, item.file);
    if (!fs.existsSync(target)) fs.writeFileSync(target, item.content, 'utf8');
  }
}

function coreMeta(item) {
  const target = path.join(CORE_DIR, item.file);
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  const content = stat ? fs.readFileSync(target, 'utf8') : '';
  return {
    id: item.id,
    type: 'core',
    title: item.title,
    description: item.description,
    file: item.file,
    path: target,
    size: stat ? stat.size : 0,
    mtime: stat ? stat.mtimeMs : 0,
    preview: summarizeMarkdown(content),
    editable: true,
  };
}

function listCoreFiles() {
  ensureMemoryStore();
  return CORE_FILES.map(coreMeta);
}

function getCoreDefinition(id) {
  return CORE_FILES.find(item => item.id === id);
}

function readCoreFile(id) {
  ensureMemoryStore();
  const item = getCoreDefinition(id);
  if (!item) return null;
  const target = path.join(CORE_DIR, item.file);
  return { ...coreMeta(item), content: fs.readFileSync(target, 'utf8') };
}

function writeCoreFile(id, content) {
  ensureMemoryStore();
  const item = getCoreDefinition(id);
  if (!item) return null;
  const target = path.join(CORE_DIR, item.file);
  fs.writeFileSync(target, String(content || ''), 'utf8');
  return readCoreFile(id);
}

function encodeMemoryId(relPath) {
  return Buffer.from(relPath, 'utf8').toString('base64url');
}

function decodeMemoryId(id) {
  try {
    return Buffer.from(String(id || ''), 'base64url').toString('utf8');
  } catch (_) {
    return '';
  }
}

function safeHistoryPath(id) {
  ensureMemoryStore();
  const rel = decodeMemoryId(id);
  if (!rel || rel.includes('\0')) return null;
  const target = path.resolve(HISTORY_DIR, rel);
  const root = path.resolve(HISTORY_DIR);
  if (target !== root && target.startsWith(root + path.sep)) return target;
  return null;
}

function summarizeMarkdown(content) {
  const text = String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<ask_user>[\s\S]*?(<\/ask_user>|$)/gi, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[-*_>`#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 120);
}

function inferMarkdownType(content, file = '') {
  const text = `${file}\n${String(content || '').slice(0, 4000)}`.toLowerCase();
  const rules = [
    ['UI / 视觉验收', /ui|视觉|样式|弹窗|页面|居中|按钮|深色|浅色|交互|布局|表格|预览/],
    ['模型配置', /模型|provider|api key|base url|openai|deepseek|gemini|anthropic|ollama|场景/],
    ['记忆系统', /记忆|memory|历史对话|markdown|压缩上下文|小脑瓜/],
    ['启动与后端', /启动|端口|8787|server|后端|接口|health|bat|node|日志/],
    ['技能与文件', /技能|skill|文件夹|编辑|md文档|本地文件/],
    ['频道与集成', /频道|网关|语雀|yuque|绑定|token|知识库|同步/],
    ['分身 / 角色', /分身|群聊|角色|agent|profile|助手/],
  ];
  const hit = rules.find(([, re]) => re.test(text));
  return hit ? hit[0] : '其他';
}

function pickLines(content, limit = 18) {
  const lines = String(content || '')
    .replace(/<ask_user>[\s\S]*?(<\/ask_user>|$)/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && line.length <= 220 && !/^\{.*\}$/.test(line));
  const important = lines.filter(line =>
    /^#{1,3}\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /用户|问题|原因|方案|结果|偏好|需要|建议|待办|TODO|完成|失败|路径|配置|端口|模型|频道|技能|记忆/.test(line)
  );
  return (important.length ? important : lines).slice(0, limit);
}

function compactConversationMemory(content, meta = {}) {
  const title = meta.title || '未命名对话';
  const sourcePath = meta.path || '';
  const updatedAt = meta.mtime ? new Date(meta.mtime).toLocaleString('zh-CN') : '';
  const lines = pickLines(content, 24);
  const todos = lines.filter(line => /待办|TODO|\[ \]|仍需|后续|下一步|验证|检查/.test(line)).slice(0, 8);
  const signals = lines.filter(line => /用户|偏好|要求|反馈|希望|不喜欢|喜欢|明确|强调/.test(line)).slice(0, 8);
  const decisions = lines.filter(line => /方案|结果|完成|已|决定|建议|原因|问题|修复/.test(line)).slice(0, 10);

  const section = (name, items, fallback) => {
    const body = (items.length ? items : fallback).map(line => {
      const clean = line.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, '').trim();
      return `- ${clean}`;
    }).join('\n');
    return `## ${name}\n${body || '- 暂无可提炼内容'}`;
  };

  return [
    `# ${title}`,
    '',
    '## 文件信息',
    `- 文件地址：${sourcePath}`,
    updatedAt ? `- 更新时间：${updatedAt}` : '',
    '',
    section('用户偏好与长期信号', signals, lines.slice(0, 5)),
    '',
    section('关键结论与上下文', decisions, lines.slice(0, 8)),
    '',
    section('待办与后续动作', todos, []),
    '',
    '## 原文摘要',
    `- ${summarizeMarkdown(content) || '暂无摘要'}`,
  ].filter(Boolean).join('\n');
}

function readConversationFile(id) {
  const target = safeHistoryPath(id);
  if (!target || !fs.existsSync(target) || !target.endsWith('.md')) return null;
  const stat = fs.statSync(target);
  const content = fs.readFileSync(target, 'utf8');
  const rel = path.relative(HISTORY_DIR, target);
  return {
    id,
    type: 'conversation',
    mdType: inferMarkdownType(content, target),
    title: path.basename(target, '.md'),
    file: path.basename(target),
    path: target,
    relativePath: rel,
    month: path.dirname(rel) === '.' ? '未归档' : path.dirname(rel),
    size: stat.size,
    mtime: stat.mtimeMs,
    preview: summarizeMarkdown(content),
    summary: summarizeMarkdown(content),
    editable: false,
    compactContent: compactConversationMemory(content, {
      title: path.basename(target, '.md'),
      path: target,
      mtime: stat.mtimeMs,
    }),
    content,
  };
}

function listConversationFiles() {
  ensureMemoryStore();
  const items = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(target);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const rel = path.relative(HISTORY_DIR, target);
        const stat = fs.statSync(target);
        const content = fs.readFileSync(target, 'utf8');
        items.push({
          id: encodeMemoryId(rel),
          type: 'conversation',
          mdType: inferMarkdownType(content, entry.name),
          title: path.basename(entry.name, '.md'),
          file: entry.name,
          path: target,
          relativePath: rel,
          month: path.dirname(rel) === '.' ? '未归档' : path.dirname(rel),
          size: stat.size,
          mtime: stat.mtimeMs,
          preview: summarizeMarkdown(content),
          summary: summarizeMarkdown(content),
          editable: false,
        });
      }
    }
  }

  walk(HISTORY_DIR);
  return items.sort((a, b) => b.mtime - a.mtime);
}

function groupConversations(items) {
  const groups = [];
  const byMonth = new Map();
  for (const item of items) {
    if (!byMonth.has(item.month)) {
      byMonth.set(item.month, { month: item.month, files: [] });
      groups.push(byMonth.get(item.month));
    }
    byMonth.get(item.month).files.push(item);
  }
  return groups;
}

function groupConversationTypes(items) {
  const groups = [];
  const byType = new Map();
  for (const item of items) {
    const type = item.mdType || '其他';
    if (!byType.has(type)) {
      byType.set(type, { type, files: [] });
      groups.push(byType.get(type));
    }
    byType.get(type).files.push(item);
  }
  return groups.sort((a, b) => {
    if (a.type === '其他') return 1;
    if (b.type === '其他') return -1;
    return b.files.length - a.files.length || a.type.localeCompare(b.type, 'zh-CN');
  });
}

function getOverview() {
  const conversations = listConversationFiles();
  return {
    root: MEMORY_DIR,
    workspaceDir: path.join(__dirname, '..', '..'),
    coreDir: CORE_DIR,
    conversationDir: HISTORY_DIR,
    core: listCoreFiles(),
    conversations: groupConversations(conversations),
    conversationsFlat: conversations,
    conversationTypes: groupConversationTypes(conversations),
    stats: {
      coreCount: CORE_FILES.length,
      conversationCount: conversations.length,
      updatedAt: Date.now(),
    },
  };
}

function readCoreMemoryPrompt() {
  ensureMemoryStore();
  const sections = CORE_FILES
    .map(item => {
      const target = path.join(CORE_DIR, item.file);
      const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').trim() : '';
      return content ? `## ${item.title}\n${content}` : '';
    })
    .filter(Boolean);
  if (!sections.length) return '';
  return `以下是 Hermes Agent 的长期核心记忆，请在不违背用户当前要求和安全边界的前提下参考：\n\n${sections.join('\n\n')}`;
}

module.exports = {
  MEMORY_DIR,
  CORE_DIR,
  HISTORY_DIR,
  getOverview,
  listCoreFiles,
  readCoreFile,
  writeCoreFile,
  readConversationFile,
  readCoreMemoryPrompt,
};
