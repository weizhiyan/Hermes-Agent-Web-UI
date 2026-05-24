const fs = require('fs');
const path = require('path');
const paths = require('./paths');

function agentRulesDir() {
  return path.join(paths.memoryRoot(), 'agent-rules');
}

function agentAlwaysRulesFile() {
  return path.join(agentRulesDir(), 'always.md');
}

function agentRulesFile() {
  return path.join(agentRulesDir(), 'knowledge-base.md');
}

const DEFAULT_AGENT_ALWAYS_RULES = `# Hermes Agent 常驻短规则

- 默认使用中文，回答要简洁、可执行。
- 不要假装已经保存、写入、读取或记住；只有工具或后端明确返回成功时，才说“已保存/已写入/已读取”。
- 当前没有对应工具时，直接说明能力限制，并给出可行替代方案。
- 当回答超过 3 段，或涉及分析、总结、方案、教程、对比时，使用结构化 Markdown。

## 命令能力规则

- 用户明确要求执行命令时，先确认命令目的、工作目录和风险。
- 删除、覆盖、批量移动、安装依赖、联网下载等高风险命令必须先提醒并等待用户确认。
- 如需让 WebUI 后端执行受限命令，可请求用户授权后使用后端能力：POST http://127.0.0.1:3381/api/system/execute-command，参数为 command、args、cwd、timeoutMs。

## Agent 反问用户弹窗规则

当信息不足、存在多个合理方案、需要确认路径/范围/风险，或即将进行高风险操作时，不要自己猜测；优先通过 WebUI 反问弹窗请求用户选择或补充信息。

可调用本地接口：POST http://127.0.0.1:3381/api/sse/ask?wait=1

请求体示例：

{
  "title": "Agent 需要确认",
  "message": "我需要你确认下一步操作，然后继续执行。",
  "questions": [
    {
      "id": "action",
      "label": "下一步怎么做？",
      "type": "single",
      "options": [
        { "label": "继续执行", "description": "按当前方案继续" },
        { "label": "先暂停", "description": "停止当前任务，等待进一步说明" }
      ],
      "placeholder": "也可以补充其他要求"
    }
  ],
  "timeoutMs": 600000
}

返回 answers 后，根据用户选择继续执行。若接口返回 no WebUI client connected、超时或调用失败，则直接在聊天中向用户提问，不要卡住任务。`;

const DEFAULT_AGENT_KNOWLEDGE_RULES = `# Hermes WebUI 知识库与 Markdown 文档规则

## Markdown 文档输出时机

当用户要求输出工作文档、AI 分享文档、教程、笔记、总结、规范、方案、验收说明、交接文档、复盘或可归档内容时，优先输出完整 Markdown 文档。

## 文档结构规范

文档应尽量包含清晰标题、简短摘要、分层标题、可执行清单、步骤、验收标准或注意事项。

## 知识库分类建议

- 工作文档：需求、方案、验收、会议、问题收集、项目交接。
- AI分享：AI 工具、提示词、模型经验、分享稿。
- 教程：步骤化教程、配置说明、操作手册。
- 笔记：碎片想法、学习笔记、临时总结。
- 临时收件箱：分类不明确、待整理内容。

## Frontmatter 建议

适合保存的 Markdown 文档可在开头加入 title、type、tags、created、source 等 frontmatter。`;

const CORE_FILES = [
  {
    id: 'AGENTS',
    file: 'AGENTS.md',
    title: '核心身份',
    description: 'Hermes Agent 的默认定位、协作风格和边界。',
    content: `# 核心身份

- Hermes Agent 是一个面向本地 WebUI 的协作型 AI 助手。
- 默认目标是帮助用户把想法落到可运行、可验收、可持续维护的结果上。
- 回答和文档优先使用中文，除非用户明确要求其他语言。
- 对高风险操作、删除、覆盖、外发隐私信息等行为，需要先提醒并确认。`,
  },
  {
    id: 'PROFILE',
    file: 'PROFILE.md',
    title: '用户画像',
    description: '用户长期偏好、表达习惯和协作方式。',
    content: `# 用户画像

- 用户偏好直接、可操作、能落地的产品迭代。
- 用户希望 WebUI 视觉和交互都经过真实模拟操作验收，而不是只做代码层面的判断。
- 用户更喜欢中文说明，方便未来迁移电脑或交给其他 AI 继续维护。`,
  },
  {
    id: 'PREFERENCES',
    file: 'PREFERENCES.md',
    title: '偏好规则',
    description: '界面、交互、输出格式等长期偏好。',
    content: `# 偏好规则

- WebUI 默认应保持简洁、清晰、稳定。
- 优化时不要破坏当前主逻辑。
- 安装、迁移、更新要尽量一键化。
- 记忆、图片、输出文档应支持放在 WebUI 项目外部，方便迁移和备份。`,
  },
  {
    id: 'TOOLS',
    file: 'TOOLS.md',
    title: '工具与环境',
    description: '本地工具、目录、模型和外部服务的长期记录。',
    content: `# 工具与环境

- WebUI 默认端口：3381。
- 推荐外部数据目录：F:\\AI\\Hermes Agent\\记忆。
- WebUI 对话会导出为 Markdown，默认保存在 history-md。
- 图片默认分为 images/inputs 和 images/outputs。`,
  },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureMemoryStore() {
  ensureDir(paths.coreMemoryDir());
  ensureDir(paths.historyDir());
  ensureDir(agentRulesDir());
  if (!fs.existsSync(agentAlwaysRulesFile())) fs.writeFileSync(agentAlwaysRulesFile(), DEFAULT_AGENT_ALWAYS_RULES, 'utf8');
  if (!fs.existsSync(agentRulesFile())) fs.writeFileSync(agentRulesFile(), DEFAULT_AGENT_KNOWLEDGE_RULES, 'utf8');
  for (const item of CORE_FILES) {
    const target = path.join(paths.coreMemoryDir(), item.file);
    if (!fs.existsSync(target)) fs.writeFileSync(target, item.content, 'utf8');
  }
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

function safeStat(file) {
  try { return fs.statSync(file); } catch { return null; }
}

function coreMeta(item) {
  const target = path.join(paths.coreMemoryDir(), item.file);
  const stat = safeStat(target);
  const content = stat ? fs.readFileSync(target, 'utf8') : '';
  return {
    id: item.id,
    type: 'core',
    mdType: '核心记忆',
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
  const target = path.join(paths.coreMemoryDir(), item.file);
  return { ...coreMeta(item), content: fs.readFileSync(target, 'utf8') };
}

function writeCoreFile(id, content) {
  ensureMemoryStore();
  const item = getCoreDefinition(id);
  if (!item) return null;
  const target = path.join(paths.coreMemoryDir(), item.file);
  fs.writeFileSync(target, String(content || ''), 'utf8');
  return readCoreFile(id);
}

function encodeMemoryId(relPath) {
  return Buffer.from(relPath, 'utf8').toString('base64url');
}

function decodeMemoryId(id) {
  try { return Buffer.from(String(id || ''), 'base64url').toString('utf8'); } catch { return ''; }
}

function safeHistoryPath(id) {
  ensureMemoryStore();
  const rel = decodeMemoryId(id);
  if (!rel || rel.includes('\0')) return null;
  const target = path.resolve(paths.historyDir(), rel);
  const root = path.resolve(paths.historyDir());
  if (target !== root && target.startsWith(root + path.sep)) return target;
  return null;
}

function inferMarkdownType(content, file = '') {
  const text = `${file}\n${String(content || '').slice(0, 4000)}`.toLowerCase();
  const rules = [
    ['UI / 视觉验收', /ui|视觉|样式|弹窗|页面|居中|按钮|深色|浅色|交互|布局|表格|预览/],
    ['模型配置', /模型|provider|api key|base url|openai|deepseek|gemini|anthropic|ollama|场景/],
    ['记忆系统', /记忆|memory|历史对话|markdown|上下文/],
    ['启动与后端', /启动|端口|3381|server|后端|接口|health|bat|node|日志/],
    ['技能与文件', /技能|skill|文件夹|编辑|md文档|本地文件/],
    ['频道与集成', /频道|网关|飞书|语雀|绑定|token|知识库|同步/],
    ['分享 / 角色', /分享|群聊|角色|agent|profile|助手/],
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
  const decisions = lines.filter(line => /方案|结果|完成|已决定|建议|原因|问题|修复/.test(line)).slice(0, 10);

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
  const rel = path.relative(paths.historyDir(), target);
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
    compactContent: compactConversationMemory(content, { title: path.basename(target, '.md'), path: target, mtime: stat.mtimeMs }),
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
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const stat = safeStat(target);
      if (!stat) continue;
      const rel = path.relative(paths.historyDir(), target);
      const id = encodeMemoryId(rel);
      const content = fs.readFileSync(target, 'utf8');
      items.push({
        id,
        type: 'conversation',
        mdType: inferMarkdownType(content, target),
        title: path.basename(target, '.md'),
        file: entry.name,
        path: target,
        relativePath: rel,
        month: path.dirname(rel) === '.' ? '未归档' : path.dirname(rel),
        size: stat.size,
        mtime: stat.mtimeMs,
        preview: summarizeMarkdown(content),
        summary: summarizeMarkdown(content),
        editable: false,
        compactContent: compactConversationMemory(content, { title: path.basename(target, '.md'), path: target, mtime: stat.mtimeMs }),
      });
    }
  }

  walk(paths.historyDir());
  return items.sort((a, b) => b.mtime - a.mtime);
}

function groupConversations(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.month || '未归档';
    if (!map.has(key)) map.set(key, { month: key, title: key, items: [] });
    map.get(key).items.push(item);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function groupConversationTypes(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.mdType || '其他';
    if (!map.has(key)) map.set(key, { type: key, title: key, items: [] });
    map.get(key).items.push(item);
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length || a.type.localeCompare(b.type, 'zh-CN'));
}

function getOverview() {
  ensureMemoryStore();
  const conversations = listConversationFiles();
  return {
    root: paths.memoryRoot(),
    workspaceDir: path.join(__dirname, '..', '..'),
    coreDir: paths.coreMemoryDir(),
    conversationDir: paths.historyDir(),
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
      const target = path.join(paths.coreMemoryDir(), item.file);
      const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').trim() : '';
      return content ? `## ${item.title}\n${content}` : '';
    })
    .filter(Boolean);
  if (!sections.length) return '';
  return `以下是 Hermes Agent 的长期核心记忆，请在不违背用户当前要求和安全边界的前提下参考：\n\n${sections.join('\n\n')}`;
}

function readRuleFilePrompt(file, title) {
  ensureMemoryStore();
  if (!fs.existsSync(file)) return '';
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return '';
  return `以下是 Hermes Agent 的${title}，请遵守：\n\n${content}`;
}

function readAgentRulesPrompt(options = {}) {
  const sections = [
    readRuleFilePrompt(agentAlwaysRulesFile(), '常驻短规则'),
  ];
  if (options.includeKnowledgeBase) {
    sections.push(readRuleFilePrompt(agentRulesFile(), '知识库与 Markdown 文档规则'));
  }
  return sections.filter(Boolean).join('\n\n');
}

module.exports = {
  get MEMORY_DIR() { return paths.memoryRoot(); },
  get CORE_DIR() { return paths.coreMemoryDir(); },
  get HISTORY_DIR() { return paths.historyDir(); },
  get AGENT_RULES_DIR() { return agentRulesDir(); },
  get AGENT_ALWAYS_RULES_FILE() { return agentAlwaysRulesFile(); },
  get AGENT_RULES_FILE() { return agentRulesFile(); },
  getOverview,
  listCoreFiles,
  readCoreFile,
  writeCoreFile,
  readConversationFile,
  readCoreMemoryPrompt,
  readAgentRulesPrompt,
};
