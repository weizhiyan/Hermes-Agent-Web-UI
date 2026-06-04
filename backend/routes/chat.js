const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('../services/store');
const paths = require('../services/paths');
const { chatStream } = require('../services/llm');
const { readCoreMemoryPrompt, readAgentRulesPrompt } = require('../services/memory');
const { redactSecrets, sanitizeAny, sanitizeChat } = require('../services/security');
const { discoverExternalSkills, samePath, normalizeFsPath } = require('../services/skillDiscovery');
const { builtinSkills, isBuiltinLike } = require('../services/builtinSkills');
const modalBus = require('./modal');
const { captureKnowledge } = require('../services/knowledgeCapture');
const { generateImageFromPrompt } = require('./images');

const router = express.Router();
const KEY = 'chats';
const DEFAULT_SKILL_PROMPT_LIMIT = Math.max(1000, Number(process.env.HERMES_SKILL_PROMPT_LIMIT || 6000));
const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = Math.max(0, Math.min(Number(process.env.HERMES_KNOWLEDGE_SEARCH_LIMIT || 3), 8));
const CONTEXT_KEEP_MESSAGES = Math.max(8, Number(process.env.HERMES_CONTEXT_KEEP_MESSAGES || 24));
const CONTEXT_SUMMARY_TRIGGER = Math.max(CONTEXT_KEEP_MESSAGES + 6, Number(process.env.HERMES_CONTEXT_SUMMARY_TRIGGER || 36));
const WEBUI_ASK_BRIDGE_PROMPT = [
  '【WebUI 反问弹窗协议】',
  '当你需要向用户确认信息、让用户在多个方案中选择、确认路径/范围/风险，或需要用户授权后才能继续时，不要直接输出普通问题。',
  '请输出且只输出一个 WEBUI_ASK_JSON 代码块，WebUI 后端会自动弹窗询问用户并把答案带回给你。',
  '',
  '```WEBUI_ASK_JSON',
  '{',
  '  "title": "Agent 需要确认",',
  '  "message": "我需要你确认下一步操作，然后继续执行。",',
  '  "questions": [',
  '    {',
  '      "id": "action",',
  '      "label": "下一步怎么做？",',
  '      "type": "single",',
  '      "options": [',
  '        { "label": "继续执行", "description": "按当前方案继续" },',
  '        { "label": "先暂停", "description": "停止当前任务，等待进一步说明" }',
  '      ],',
  '      "placeholder": "也可以补充其他要求"',
  '    }',
  '  ],',
  '  "timeoutMs": 600000',
  '}',
  '```',
  '',
  '不要在 WEBUI_ASK_JSON 代码块前后输出其他解释。'
].join('\n');
const WEBUI_SELF_PROTECTION_PROMPT = `【WebUI 对话执行规则】
当前请求来自 Hermes WebUI 对话页。除非用户明确说明“现在不是 WebUI 对话，而是在 CLI/代码维护模式中修改项目”，否则你应把自己当作正在 WebUI 中服务用户的 Agent。

1. 工具执行：
- 用户要求读取、写入、保存、修改、同步、上传、下载、调用 API、操作语雀/飞书/Notion/网页/文件/目录/命令时，必须走 Hermes Agent 工具能力；不要用纯文字假装已经执行。
- 只有工具或后端明确返回成功时，才说“已保存/已写入/已同步”。
- 当前没有对应工具时，直接说明限制，并给出可行替代方案。

2. 图像任务：
- 当用户要求生成图片、画图、出图、改图、优化图片，或基于参考图生成视觉效果时，必须优先调用 WebUI 图像生成工具 webui_image_generate。
- webui_image_generate is the only default image generation endpoint exposed by Hermes WebUI to HermesAgent; identify normal image-generation intent and call this tool.
- Do not use Hermes native image_gen for image tasks inside WebUI; if native image_gen says it is not configured, that does not mean WebUI image generation is unavailable.
- 前端“生成图像：”按钮/直连生图开关属于 WebUI 的跳过主 Agent 直连流程；你不要要求用户改用命令或手动调用接口。
- webui_image_generate 工具内部会按 WebUI 生图规则补充最终提示词；你只需要传清楚用户意图、关键限制和附件ID。
- webui_image_generate reads image model, API key, image directory, prompt optimization and save rules from WebUI Model Configuration; do not ask the user to configure ~/.hermes/.env, FAL_KEY, or OPENAI_API_KEY for WebUI image tasks.
- 如果用户上传了参考图，使用上下文里的“附件ID”作为 webui_image_generate 的 attachmentIds 参数；没有参考图时只传 prompt/sourcePrompt。
- 提示词可以优化，但必须保留用户指定的人物、角色、IP、品牌、产品、颜色、构图、尺寸和禁止项，不要泛化或替换专有名词。
- 不要输出 curl、Python、HTTP 请求示例、伪代码，或“等待 API 返回”这类说明。
- 工具调用完成后，只需要用简短中文总结结果，并展示工具返回的图片 Markdown/预览链接。
- 如果工具不可用或失败，明确说明失败原因和下一步，不要假装已经生成。

3. 参考图任务：
- 用户上传图片并要求生成、修改、优化视觉效果时，应作为图像任务处理。
- 如果当前工具不能读取参考图，请直接说明工具限制，不要编造本地接口命令。

4. WebUI 自保护：
- 不要主动修改当前 Hermes WebUI 的核心代码与服务文件。
- 允许读取文件、解释现状、给出方案；允许在用户明确要求维护 WebUI 代码后进行修改。
- 删除、覆盖、批量移动、安装依赖、联网下载等高风险操作必须先让用户确认。`;
function buildWebuiMarkdownOutputPrompt(settings = {}) {
  const mdDir = paths.mdLibraryRoot();
  const dataRoot = paths.dataRoot();
  return `【WebUI Markdown / Artifact 输出硬规则】
当用户要求产出可归档内容（工作文档、AI 分享、教程、笔记、总结、规范、方案、报告、验收说明、交接文档、复盘等）时，必须同时完成两步：

1. 先把完整 Markdown 文件写入 MD 输出库：${mdDir}
   - 文件名要清晰、可读，并以 .md 结尾。
   - 这是“历史文件”标签页的数据来源；不要写到聊天导出目录 history-md。
   - 当前 dataRoot：${dataRoot}

2. 然后最终回复只输出一个 artifact 标签，不要附加任何说明文字：
<artifact type="markdown" title="文件名">
完整 Markdown 内容
</artifact>

禁止：
- 禁止只在聊天里贴 Markdown 而不写入 ${mdDir}。
- 禁止在 artifact 标签前后说“已保存到……”或其他说明。
- 禁止把用户文档误写到 history-md；history-md 只用于聊天记录导出。
- 如果无法写文件，必须明确说明失败原因，不能假装已保存。`;
}
function loadAll() { return store.read(KEY, []); }
function saveAll(list) { store.write(KEY, list); }
function safeName(name) {
  return String(name || 'conversation').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}
function toMarkdown(chat) {
  const lines = [
    `# ${redactSecrets(chat.title || '未命名对话')}`,
    '',
    `- 更新时间：${new Date(chat.updatedAt || chat.createdAt || Date.now()).toLocaleString('zh-CN')}`,
    `- 来源：${chat.source || 'WebUI'}`,
    `- 模型：${chat.model || 'default'}`,
    '',
  ];
  (chat.messages || []).forEach(msg => {
    const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'Hermes' : msg.role;
    const time = msg.ts ? new Date(msg.ts).toLocaleString('zh-CN') : '';
    lines.push(`## ${role} ${time}`.trim(), '', redactSecrets(msg.content || ''), '');
  });
  return lines.join('\n');
}
function writeMarkdown(chat) {
  const date = new Date(chat.updatedAt || chat.createdAt || Date.now());
  const monthFolder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const targetDir = path.join(paths.historyDir(), monthFolder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, `${dateStr}_${safeName(redactSecrets(chat.title))}.md`);
  const content = toMarkdown(chat);
  fs.writeFileSync(filePath, content, 'utf8');
  return { content, path: filePath, folder: targetDir };
}

function extractWebuiAskRequest(text = '') {
  const match = String(text || '').match(/```WEBUI_ASK_JSON\s*([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1].trim());
    if (!data || !Array.isArray(data.questions) || !data.questions.length) return null;
    return {
      title: String(data.title || 'Agent 需要确认'),
      message: String(data.message || '请确认下一步操作。'),
      questions: data.questions,
      timeoutMs: Math.max(10000, Math.min(Number(data.timeoutMs || 600000), 30 * 60 * 1000)),
    };
  } catch (_) {
    return null;
  }
}

function formatAskAnswersForModel(result) {
  if (!result || !result.ok || !Array.isArray(result.answers)) return '用户没有完成确认或弹窗已超时。';
  return result.answers.map(item => {
    const selected = Array.isArray(item.selected) ? item.selected.filter(Boolean).join('、') : '';
    const custom = String(item.custom || '').trim();
    return `- ${item.label || item.id}: ${selected || '未选择'}${custom ? `；补充：${custom}` : ''}`;
  }).join('\n') || '用户已确认，但未提供具体答案。';
}
function needsKnowledgeBaseRules(text = '') {
  return /markdown|md\b|frontmatter|artifact|doc|document|save|report|note|tutorial|summary|knowledge|\u6587\u6863|\u77e5\u8bc6\u5e93|\u6559\u7a0b|\u7b14\u8bb0|\u603b\u7ed3|\u89c4\u8303|\u65b9\u6848|\u62a5\u544a|\u4fdd\u5b58/i.test(String(text || ''));
}

function isAgentTaskIntent(text = '') {
  const value = String(text || '');
  if (!value.trim()) return false;
  const forceRe = /agent\s*模式|hermes\s*模式|工具调用|用工具|调用工具|终端|命令行|shell|powershell|cmd|git\s|npm\s|pnpm\s|yarn\s|docker\s|curl|api|接口/i;
  const actionRe = /(帮我)?(新建|创建|保存|写入|读取|查看|打开|编辑|修改|更新|删除|移动|重命名|上传|下载|同步|导入|导出|发布|抓取|复制|粘贴|运行|执行|安装|部署|测试|构建|扫描|分析|修复|提交|create|write|read|save|edit|modify|update|delete|upload|download|sync|import|export|publish|run|execute)/i;
  const targetRe = /(本地|文件|文档|目录|路径|代码|项目|仓库|语雀|yuque|飞书|notion|网页|浏览器|网站|后台|控制台|知识库|markdown|md\b|file|folder|path|document|repo|browser|site)/i;
  if (forceRe.test(value)) return true;
  if (/帮我(改|修|写|新建|创建|保存|读取|查看|打开|编辑|修改|更新|删除|移动|重命名|上传|下载|同步|导入|导出|发布|抓取|运行|执行|安装|部署|测试|构建|提交)/i.test(value)) return true;
  if (actionRe.test(value) && targetRe.test(value)) return true;
  if (/(语雀|yuque|飞书|notion)/i.test(value) && /(编辑|修改|更新|发布|同步|上传|下载|导入|导出|读取|创建|新建|保存)/i.test(value)) return true;
  return false;
}
function skillMatchInfo(skill = {}, text = '') {
  const triggerText = Array.isArray(skill.triggers) ? skill.triggers.join(' ') : String(skill.triggers || '');
  const haystack = String((skill.name || '') + ' ' + (skill.description || skill.desc || '') + ' ' + triggerText + ' ' + (skill.prompt || '')).toLowerCase();
  const message = String(text || '').toLowerCase();
  const triggers = Array.isArray(skill.triggers) ? skill.triggers : String(skill.triggers || '').split(/[，,、\s]+/);
  const trigger = triggers.find(token => token && message.includes(String(token).toLowerCase()));
  if (trigger) return { matched: true, reason: 'trigger', trigger: String(trigger) };
  const keywords = tokenizeForSearch((skill.name || '') + ' ' + (skill.description || skill.desc || '')).slice(0, 12);
  const keyword = keywords.find(token => token && message.includes(token));
  if (keyword) return { matched: true, reason: 'keyword', trigger: keyword };
  const pairs = [
    [/图片|生成图|生图|出图|海报|插画|logo|视觉|参考图|改图|修图|image/i, /图片|image|视觉|海报|插画|logo|生成/i],
    [/代码|bug|报错|重构|审查|项目|函数|接口|前端|后端|node|js|css|html/i, /代码|审查|重构|bug|开发|编程/i],
    [/文件|保存|写入|读取|目录|路径|md|markdown|文档/i, /文件|目录|markdown|文档|写入|读取/i],
    [/联网|搜索|查一下|资料|官网|最新|新闻/i, /联网|搜索|浏览|资料|网页/i],
    [/记忆|偏好|习惯|兴趣|长期|remember/i, /记忆|长期|偏好|习惯/i],
    [/更新|安装|升级|github|版本|webui/i, /更新|安装|升级|webui|github/i],
    [/润色|表达|文案|改写|标题|方案|设计/i, /润色|表达|写作|文案|design|polish/i],
  ];
  const pairIndex = pairs.findIndex(([intent, skillRe]) => intent.test(message) && skillRe.test(haystack));
  if (pairIndex >= 0) return { matched: true, reason: 'intent', trigger: 'intent:' + (pairIndex + 1) };
  return { matched: false, reason: '', trigger: '' };
}

function skillMatchesMessage(skill = {}, text = '') {
  return skillMatchInfo(skill, text).matched;
}
function selectRelevantSkills(skills = [], message = '', { forceAll = false, limit = 4 } = {}) {
  const sorted = [...skills].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  if (forceAll) return sorted;
  const matched = sorted.filter(skill => skillMatchesMessage(skill, message));
  return matched.slice(0, Math.max(0, limit));
}

function limitPromptText(text = '', limit = DEFAULT_SKILL_PROMPT_LIMIT) {
  const raw = String(text || '');
  if (!raw || raw.length <= limit) return { text: raw, truncated: false, originalChars: raw.length };
  const head = Math.floor(limit * 0.72);
  const tail = Math.max(400, limit - head - 220);
  const clipped = `${raw.slice(0, head).trim()}

[内容已截断：原始 ${raw.length} 字，仅注入前 ${head} 字和末尾 ${tail} 字。请优先遵守摘要、触发条件和关键规则。]

${raw.slice(-tail).trim()}`;
  return { text: clipped, truncated: true, originalChars: raw.length };
}


function normalizeAgentSnapshot(body = {}) {
  const agentId = String(body.agentId || body.profileId || 'default').trim() || 'default';
  const agentName = String(body.agentName || body.profileName || (agentId === 'default' ? '\u9ed8\u8ba4\u52a9\u624b' : agentId)).slice(0, 120);
  const skillIds = Array.isArray(body.profileSkillIds || body.skillIds) ? (body.profileSkillIds || body.skillIds).map(String) : [];
  const dirs = paths.ensureAgentDirs(agentId);
  return {
    id: agentId,
    name: agentName,
    role: String(body.agentRole || body.role || '').slice(0, 240),
    modelId: String(body.modelId || body.model || 'auto'),
    systemPrompt: String(body.profilePrompt || body.systemPrompt || '').slice(0, 6000),
    skillIds,
    knowledgeFocus: Array.isArray(body.knowledgeFocus) ? body.knowledgeFocus.map(String).slice(0, 12) : [],
    soulDir: dirs.soulDir,
    memoryDir: dirs.memoryDir,
    workspaceDir: dirs.workspaceDir,
    knowledgeDir: dirs.knowledgeDir,
    capturedAt: new Date().toISOString(),
  };
}

function autoCaptureKnowledge(chat, userMsg, assistantContent) {
  const question = String(userMsg && userMsg.content || '').trim();
  const answer = String(assistantContent || '').trim();
  if (!question || !answer || /^error[:?]/i.test(answer)) return;
  const title = (chat && chat.title && chat.title !== question.slice(0, 24)) ? chat.title : question.slice(0, 40);
  try {
    captureKnowledge({
      title,
      folder: 'questions',
      type: 'question',
      kind: 'question',
      tags: ['auto-capture', 'raw-question', chat?.agentId ? ('agent-' + chat.agentId) : 'agent-default'],
      source: 'chat',
      status: 'auto',
      question,
      answer,
      context: chat && chat.id ? ('chatId: ' + chat.id) : '',
      chatId: chat && chat.id ? chat.id : '',
      agentId: chat && chat.agentId ? chat.agentId : '',
      agentName: chat && chat.agentName ? chat.agentName : '',
    });
  } catch (error) {
    try { appendSystemLog({ type: 'knowledge', level: 'warn', msg: 'auto capture failed: ' + error.message, chatId: chat && chat.id }); } catch {}
  }
}

function compactChatContext(chat) {
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  if (messages.length <= CONTEXT_SUMMARY_TRIGGER) return chat?.summary || '';
  const previousUntil = Math.max(0, Number(chat.compressedUntilIndex || 0));
  const keepStart = Math.max(0, messages.length - CONTEXT_KEEP_MESSAGES);
  if (keepStart <= previousUntil) return chat.summary || '';
  const slice = messages.slice(previousUntil, keepStart);
  if (!slice.length) return chat.summary || '';
  const brief = slice.map((msg, index) => {
    const role = msg.role === 'assistant' ? 'Assistant' : msg.role === 'user' ? 'User' : String(msg.role || 'Message');
    const text = redactSecrets(String(msg.content || '')).replace(/\s+/g, ' ').trim().slice(0, 260);
    return `${previousUntil + index + 1}. ${role}: ${text}`;
  }).filter(Boolean).join('\n');
  const prior = String(chat.summary || '').trim();
  const next = [prior, brief].filter(Boolean).join('\n').slice(-8000);
  chat.summary = next;
  chat.summaryUpdatedAt = Date.now();
  chat.compressedUntilIndex = keepStart;
  return next;
}

function agentSummaryPrompt(list, currentAgentId) {
  if (currentAgentId !== 'default') return '';
  const rows = list
    .filter(c => c && c.agentId && c.agentId !== 'default' && c.summary)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 8)
    .map(c => `- ${c.agentName || c.agentId}: ${String(c.summary || '').replace(/\s+/g, ' ').slice(-900)}`);
  if (!rows.length) return '';
  return ['[Other Agent Summaries - read only]', '默认助手可参考这些摘要理解其他 Agent 的沉淀，但不要直接改写其他 Agent 的记忆。', ...rows].join('\n');
}

function promptToggles(settings = {}) {
  return {
    webuiRules: true,
    coreMemory: true,
    agentRules: true,
    userSystemPrompt: true,
    profilePrompt: true,
    skills: true,
    knowledgeSearch: true,
    ...(settings.promptToggles || {}),
  };
}

function tokenizeForSearch(text = '') {
  return [...new Set(String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(item => item.length >= 2)
    .slice(0, 80))];
}

function compactKnowledgeContent(content = '', limit = 900) {
  const text = String(content || '')
    .replace(/^---\s*[\s\S]*?\n---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

function searchKnowledgeSnippets(query = '', limit = DEFAULT_KNOWLEDGE_SEARCH_LIMIT) {
  const root = paths.mdLibraryRoot();
  if (!limit || !fs.existsSync(root)) return [];
  const tokens = tokenizeForSearch(query);
  if (!tokens.length) return [];
  const results = [];
  const maxFiles = 300;

  function walk(dir, depth) {
    if (results.length >= maxFiles || depth > 6) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= maxFiles || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') continue;
      const stat = fs.statSync(full);
      if (stat.size > 1024 * 1024) continue;
      let content = '';
      try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
      const haystack = `${entry.name}\n${content}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += token.length > 3 ? 2 : 1;
      }
      if (!score) continue;
      results.push({
        title: entry.name.replace(/\.md$/i, ''),
        path: full,
        relativePath: path.relative(root, full),
        score,
        mtime: stat.mtimeMs,
        snippet: compactKnowledgeContent(content),
      });
    }
  }

  walk(root, 0);
  return results
    .sort((a, b) => b.score - a.score || b.mtime - a.mtime)
    .slice(0, limit);
}

router.get('/', (req, res) => {
  const list = loadAll().map(c => ({
    id: c.id,
    title: redactSecrets(c.title),
    model: c.model,
    agentId: c.agentId,
    agentName: c.agentName,
    source: c.source || 'WebUI',
    pinned: !!c.pinned,
    chatType: c.chatType || (c.isMainAgentChat ? 'main' : 'task'),
    isMainAgentChat: !!c.isMainAgentChat,
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    preview: redactSecrets(c.messages?.slice(-1)[0]?.content || '').slice(0, 90),
    messageCount: c.messages?.length || 0,
  }));
  res.ok(list);
});

router.post('/', (req, res) => {
  const now = Date.now();
  const agentSnapshot = normalizeAgentSnapshot(req.body || {});
  const chat = {
    id: crypto.randomUUID(),
    title: req.body.title || '新建对话',
    model: req.body.model || 'hermes-agent',
    agentId: agentSnapshot.id,
    agentName: agentSnapshot.name,
    agentSnapshot,
    lockedAgent: true,
    chatType: req.body.chatType || (req.body.isMainAgentChat ? 'main' : 'task'),
    isMainAgentChat: !!req.body.isMainAgentChat || req.body.chatType === 'main',
    source: req.body.source || 'WebUI',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const list = loadAll();
  list.unshift(chat);
  saveAll(list);
  res.ok(sanitizeChat(chat));
});

router.get('/exports/history', (req, res) => {
  const historyDir = paths.historyDir();
  if (!fs.existsSync(historyDir)) return res.ok([]);
  const result = [];
  try {
    const months = fs.readdirSync(historyDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const month of months) {
      const monthPath = path.join(historyDir, month.name);
      const files = fs.readdirSync(monthPath, { withFileTypes: true })
        .filter(f => f.isFile() && f.name.endsWith('.md'))
        .map(f => {
          const stat = fs.statSync(path.join(monthPath, f.name));
          return {
            name: f.name,
            path: path.join(monthPath, f.name),
            month: month.name,
            mtime: stat.mtimeMs,
            size: stat.size
          };
        });
      if (files.length > 0) {
        result.push({
          month: month.name,
          files: files.sort((a, b) => b.mtime - a.mtime)
        });
      }
    }
    result.sort((a, b) => b.month.localeCompare(a.month));
    res.ok(result);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.get('/exports/folder', (req, res) => {
  const historyDir = paths.historyDir();
  if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
  res.ok({ path: historyDir });
});

router.get('/:id', (req, res) => {
  const chat = loadAll().find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  res.ok(sanitizeChat(chat));
});

router.get('/:id/markdown', (req, res) => {
  const chat = loadAll().find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  res.ok(writeMarkdown(chat));
});

router.delete('/:id', (req, res) => {
  saveAll(loadAll().filter(c => c.id !== req.params.id));
  res.ok();
});

router.put('/:id', (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  if (req.body.title) chat.title = req.body.title;
  if (req.body.pinned !== undefined) chat.pinned = Boolean(req.body.pinned);
  if (!chat.lockedAgent) {
    if (req.body.agentId !== undefined) chat.agentId = String(req.body.agentId || '');
    if (req.body.agentName !== undefined) chat.agentName = String(req.body.agentName || '');
  }
  chat.updatedAt = Date.now();
  saveAll(list);
  res.ok(sanitizeChat(chat));
});

router.post('/:id/messages/feedback', (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);

  const msgId = String(req.body.msgId || '');
  const feedback = req.body.feedback === 'like' ? 'like' : req.body.feedback === 'dislike' ? 'dislike' : req.body.feedback === 'partial' ? 'partial' : '';
  if (!msgId || !feedback) return res.fail('invalid feedback', 400, 400);

  const message = (chat.messages || []).find(m => m && m.role === 'assistant' && String(m._msgId || m.ts || '') === msgId);
  if (!message) return res.fail('message not found', 404, 404);

  message.feedback = { value: feedback, updatedAt: Date.now() };
  chat.updatedAt = Date.now();
  saveAll(list);
  res.ok({ feedback: message.feedback });
});

function findMessageByClientId(chat, msgId) {
  const id = String(msgId || '');
  if (!id) return null;
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  return messages.find(m => m && String(m._msgId || m.id || m.ts || '') === id) || null;
}

function clientMessagePatch(body = {}) {
  const allowed = [
    'content',
    'thinking',
    'reasoning',
    'localEditContextId',
    'localEditContext',
    'localEditApplied',
    'localEditAppliedAt',
    'localEditApplyError',
    'imageGeneration',
    'attachments',
    'toolCalls',
    'processEvents',
    'promptDebug',
    'feedback',
  ];
  const out = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = sanitizeAny(body[key]);
  }
  if (out.content !== undefined) out.content = redactSecrets(String(out.content || ''));
  if (out.thinking !== undefined) out.thinking = redactSecrets(String(out.thinking || ''));
  if (out.reasoning !== undefined) out.reasoning = redactSecrets(String(out.reasoning || ''));
  if (out.localEditContextId !== undefined) out.localEditContextId = String(out.localEditContextId || '');
  if (out.localEditApplied !== undefined) out.localEditApplied = !!out.localEditApplied;
  if (out.localEditAppliedAt !== undefined) out.localEditAppliedAt = Number(out.localEditAppliedAt || 0) || Date.now();
  return out;
}

router.patch('/:id/messages/:msgId', (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  const message = findMessageByClientId(chat, req.params.msgId);
  if (!message) return res.fail('message not found', 404, 404);
  const patch = clientMessagePatch(req.body || {});
  Object.assign(message, patch);
  chat.updatedAt = Date.now();
  saveAll(list);
  res.ok(sanitizeAny(message));
});

function parseWebuiImageTextToolCall(text = '') {
  const raw = String(text || '').trim();
  const parseArgs = (args, sourceText) => {
    const prompt = String(args?.prompt || '').trim();
    if (!prompt) return null;
    return {
      prompt,
      sourcePrompt: String(args.sourcePrompt || args.source_prompt || args.originalPrompt || prompt).trim(),
      attachmentIds: Array.isArray(args.attachmentIds) ? args.attachmentIds.map(id => String(id || '').trim()).filter(Boolean) : [],
      model: String(args.model || 'auto'),
      size: String(args.size || '1024x1024'),
      raw: sourceText,
    };
  };

  const fnMatch = raw.match(/webui_image_generate\s*\(\s*({[\s\S]*?})\s*\)/m);
  if (fnMatch) {
    try {
      const parsed = parseArgs(JSON.parse(fnMatch[1]), fnMatch[0]);
      if (parsed) return parsed;
    } catch (_) {}
  }

  const jsonCandidates = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) jsonCandidates.push(fenced[1].trim());
  if (raw.startsWith('{') && raw.endsWith('}')) jsonCandidates.push(raw);
  const jsonMatch = raw.match(/({[\s\S]*"prompt"[\s\S]*})/m);
  if (jsonMatch) jsonCandidates.push(jsonMatch[1]);

  for (const candidate of jsonCandidates) {
    try {
      const parsed = parseArgs(JSON.parse(candidate), candidate);
      if (parsed) return parsed;
    } catch (_) {}
  }
  return null;
}

function parseWebuiImageTextToolCall(text = '') {
  const raw = String(text || '').trim();
  const parseArgs = (args, sourceText) => {
    const prompt = String(args?.prompt || '').trim();
    if (!prompt) return null;
    return {
      prompt,
      sourcePrompt: String(args.sourcePrompt || args.source_prompt || args.originalPrompt || prompt).trim(),
      attachmentIds: Array.isArray(args.attachmentIds) ? args.attachmentIds.map(id => String(id || '').trim()).filter(Boolean) : [],
      model: String(args.model || 'auto'),
      size: String(args.size || '1024x1024'),
      raw: sourceText,
    };
  };

  const fnMatch = raw.match(/webui_image_generate\s*\(\s*({[\s\S]*?})\s*\)/m);
  if (fnMatch) {
    try {
      const parsed = parseArgs(JSON.parse(fnMatch[1]), fnMatch[0]);
      if (parsed) return parsed;
    } catch (_) {}
  }

  const jsonCandidates = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) jsonCandidates.push(fenced[1].trim());
  if (raw.startsWith('{') && raw.endsWith('}')) jsonCandidates.push(raw);
  const jsonMatch = raw.match(/({[\s\S]*"prompt"[\s\S]*})/m);
  if (jsonMatch) jsonCandidates.push(jsonMatch[1]);

  for (const candidate of jsonCandidates) {
    try {
      const parsed = parseArgs(JSON.parse(candidate), candidate);
      if (parsed) return parsed;
    } catch (_) {}
  }
  return null;
}

function webuiImageToolResultPayload(data = {}) {
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  const markdown = outputs.map((img, index) => {
    const url = img.publicUrl || img.url || '';
    return url ? `![Generated image ${index + 1}](${url})` : '';
  }).filter(Boolean).join('\n\n');
  return {
    success: true,
    type: 'webui_image_generate_result',
    markdown,
    imageUrl: outputs[0]?.publicUrl || outputs[0]?.url || '',
    outputs,
    inputs: Array.isArray(data.inputs) ? data.inputs : [],
    prompt: data.prompt || '',
    sourcePrompt: data.sourcePrompt || '',
    optimizedByAgent: !!data.optimizedByAgent,
    mode: data.mode || '',
    model: data.model || 'auto',
    provider: data.provider || '',
    content: data.content || markdown,
  };
}

async function runWebuiImageTextToolFallback({ call, chatId, userMsgId, assistantMsgId, req, res, toolCalls }) {
  const startedAt = Date.now();
  const toolEvent = { type: 'tool', event_type: 'tool.started', name: 'webui_image_generate', args: call, preview: call.raw || '' };
  toolCalls.push({ ...sanitizeAny(toolEvent), done: false });
  sseWrite(res, 'tool', {
    event_type: toolEvent.event_type,
    name: toolEvent.name,
    preview: redactSecrets(toolEvent.preview),
    args: sanitizeAny(toolEvent.args),
  });
  sseWrite(res, 'perf', { stage: 'webui-image-text-tool-fallback-start' });
  const progressTimer = setInterval(() => {
    try {
      sseWrite(res, 'perf', {
        stage: 'webui-image-text-tool-fallback-running',
        elapsedMs: Date.now() - startedAt,
      });
    } catch (_) {}
  }, 15000);
  try {
    const requestAttachmentIds = Array.isArray(req?.body?.attachments)
      ? req.body.attachments.map(item => item && item.id).filter(Boolean)
      : [];
    const attachmentIds = Array.isArray(call.attachmentIds) && call.attachmentIds.length
      ? call.attachmentIds
      : requestAttachmentIds;
    const data = await generateImageFromPrompt({
      prompt: call.prompt,
      sourcePrompt: call.sourcePrompt || call.prompt,
      optimizedByAgent: false,
      attachmentIds,
      model: call.model || 'auto',
      size: call.size || '1024x1024',
      chatId: '',
      publicBase: '',
      userMsgId,
      assistantMsgId,
    });
    clearInterval(progressTimer);
    const payload = webuiImageToolResultPayload(data);
    const preview = JSON.stringify(payload);
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === 'webui_image_generate') {
        toolCalls[i].done = true;
        toolCalls[i].is_error = false;
        toolCalls[i].duration = Date.now() - startedAt;
        toolCalls[i].preview = preview;
        break;
      }
    }
    sseWrite(res, 'tool_complete', {
      event_type: 'tool.completed',
      name: 'webui_image_generate',
      preview: redactSecrets(preview),
      is_error: false,
      duration: Date.now() - startedAt,
    });
    sseWrite(res, 'perf', { stage: 'webui-image-text-tool-fallback-done', outputs: payload.outputs.length });
    return { ok: true, content: data.content || payload.markdown || '??????', payload };
  } catch (error) {
    clearInterval(progressTimer);
    const preview = error.message || 'image generation failed';
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === 'webui_image_generate') {
        toolCalls[i].done = true;
        toolCalls[i].is_error = true;
        toolCalls[i].duration = Date.now() - startedAt;
        toolCalls[i].preview = preview;
        break;
      }
    }
    sseWrite(res, 'tool_complete', {
      event_type: 'tool.completed',
      name: 'webui_image_generate',
      preview: redactSecrets(preview),
      is_error: true,
      duration: Date.now() - startedAt,
    });
    sseWrite(res, 'perf', { stage: 'webui-image-text-tool-fallback-error', error: preview });
    return { ok: false, error: preview };
  }
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function appendSystemLog(entry = {}) {
  try {
    const logs = store.read('logs', []);
    logs.push({ ts: Date.now(), source: 'chat', ...entry });
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    store.write('logs', logs);
  } catch (_) {}
}


function perfMark(res, start, stage, extra = {}) {
  sseWrite(res, 'perf', { stage, ms: Date.now() - start, ...extra });
}

router.post('/:id/messages', async (req, res) => {
  const perfStart = Date.now();
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);

  const userMsg = {
    role: 'user',
    content: redactSecrets(String(req.body.displayContent ?? req.body.content ?? '')),
    ts: Date.now(),
  };
  if (req.body.userMsgId) userMsg._msgId = String(req.body.userMsgId);
  if (req.body.localEditContext) userMsg.localEditContext = sanitizeAny(req.body.localEditContext);
  if (Array.isArray(req.body.attachments) && req.body.attachments.length) {
    userMsg.attachments = req.body.attachments.map(item => ({
      id: String(item?.id || ''),
      name: String(item?.name || item?.originalName || item?.filename || '上传图片'),
      url: String(item?.url || ''),
      publicUrl: String(item?.publicUrl || item?.url || ''),
      path: String(item?.path || ''),
      kind: String(item?.kind || 'input'),
      mime: String(item?.mime || ''),
    })).filter(item => item.id || item.url || item.publicUrl);
  }
  chat.messages.push(userMsg);
  if (!chat.agentSnapshot) chat.agentSnapshot = normalizeAgentSnapshot({ ...req.body, agentId: chat.agentId || req.body.profileId, agentName: chat.agentName || req.body.profileName });
  chat.agentId = chat.agentSnapshot.id;
  chat.agentName = chat.agentSnapshot.name;
  chat.lockedAgent = true;
  chat.chatType = chat.chatType || (chat.isMainAgentChat ? 'main' : 'task');
  chat.isMainAgentChat = !!chat.isMainAgentChat || chat.chatType === 'main';
  const rollingSummary = compactChatContext(chat);

  const requestedSkillIds = Array.isArray(chat.agentSnapshot.skillIds) && chat.agentSnapshot.skillIds.length
    ? chat.agentSnapshot.skillIds.map(String)
    : (Array.isArray(req.body.profileSkillIds) ? req.body.profileSkillIds.map(String) : []);
  const storedSkills = store.read('skills', []);
  const builtin = builtinSkills().map(skill => {
    const old = storedSkills.find(item => item && (item.id === skill.id || item.name === skill.name));
    return old ? { ...skill, on: old.on !== undefined ? old.on : skill.on, enabled: old.enabled !== undefined ? old.enabled : old.on } : skill;
  });
  const externalSkills = discoverExternalSkills().filter(skill => !isBuiltinLike(skill)).map(skill => {
    const old = storedSkills.find(item => item && (item.id === skill.id || samePath(item.path, skill.path) || item.name === skill.name));
    return old ? { ...skill, on: old.on !== undefined ? old.on : skill.on, enabled: old.enabled !== undefined ? old.enabled : old.on } : skill;
  });
  const allSkills = [
    ...builtin,
    ...externalSkills,
    ...storedSkills
      .filter(item => item && item.source !== 'builtin' && item.source !== 'external')
      .filter(item => !isBuiltinLike(item))
      .filter(item => !externalSkills.some(skill => skill.id === item.id || samePath(skill.path, item.path) || skill.name === item.name))
      .filter(item => !builtin.some(skill => skill.id === item.id || skill.name === item.name))
      .map(item => ({ ...item, path: item.path ? normalizeFsPath(item.path) : item.path })),
  ];
  const enabledSkills = allSkills.filter(s => {
    if (!s.prompt) return false;
    if (requestedSkillIds.length) return requestedSkillIds.includes(String(s.id));
    return s.on;
  });
  const settings = store.read('settings', {});
  const forceAllSkills = requestedSkillIds.length > 0 || String(settings.routingMode || 'auto').toLowerCase() === 'hermes' || isAgentTaskIntent(userMsg.content);
  const skills = selectRelevantSkills(enabledSkills, userMsg.content, { forceAll: forceAllSkills, limit: Number(settings.skillAutoLimit || 4) || 4 });
  const toggles = promptToggles(settings);
  const systemParts = [];
  const promptDebug = [];
  function addSystemPart(label, content, extra = {}) {
    const text = String(content || '');
    if (!text) return;
    systemParts.push(text);
    promptDebug.push({
      label,
      chars: text.length,
      approxTokens: Math.ceil(text.length / 4),
      ...extra,
    });
  }
  if (Array.isArray(req.body.attachments) && req.body.attachments.length) {
    addSystemPart('图片识别模式', [
      '【图片识别模式】',
      '本轮用户已上传图片，后端会把图片内容直接作为多模态输入提供给视觉模型。',
      '你应该直接观察并描述/分析图片内容；不要要求用户提供本地路径、不要要求读取 settings.json/models.json、不要输出 ls/cat 命令。',
      '如果无法识别，请只说明视觉模型返回的具体错误，不要猜测 WebUI 配置缺失。'
    ].join('\n'), { source: 'vision-mode' });
  }
  if (toggles.webuiRules) {
    addSystemPart('WebUI 对话执行规则', WEBUI_SELF_PROTECTION_PROMPT, { source: 'builtin' });
    addSystemPart('WebUI 运行路径', [
      '【WebUI 当前运行路径】',
      `数据根目录：${paths.dataRoot()}`,
      `记忆根目录：${paths.memoryRoot()}`,
      `聊天历史导出目录 history-md：${paths.historyDir()}`,
      `MD 输出库目录 output-md / mdLibraryDir：${paths.mdLibraryRoot()}`,
      '用户生成的 Markdown 文档必须写入 MD 输出库目录，不要写入聊天历史导出目录。',
    ].join('\n'), { source: 'builtin' });
  }
  if (toggles.webuiRules) addSystemPart('WebUI 反问弹窗协议', WEBUI_ASK_BRIDGE_PROMPT, { source: 'builtin' });
  const memoryPrompt = readCoreMemoryPrompt();
  if (toggles.coreMemory) addSystemPart('核心记忆', memoryPrompt, { source: 'memory' });
  const agentRulesPrompt = readAgentRulesPrompt({ includeKnowledgeBase: needsKnowledgeBaseRules(userMsg.content) });
  if (toggles.agentRules) addSystemPart('Agent 规则', agentRulesPrompt, { source: 'rules', knowledgeBase: needsKnowledgeBaseRules(userMsg.content) });
  if (toggles.userSystemPrompt) addSystemPart('用户系统提示', settings.systemPrompt, { source: 'settings' });
  const activeAgentSnapshot = chat.agentSnapshot || normalizeAgentSnapshot(req.body || {});
  if (toggles.profilePrompt && (activeAgentSnapshot.systemPrompt || activeAgentSnapshot.name)) {
    const agentLabel = String(activeAgentSnapshot.name || activeAgentSnapshot.id || 'agent').slice(0, 80);
    const agentPrompt = [
      '[Current Agent: ' + agentLabel + ']',
      String(activeAgentSnapshot.systemPrompt || '').slice(0, 6000),
    ].filter(Boolean).join('\n');
    addSystemPart('Agent Profile: ' + agentLabel, agentPrompt, { source: 'profile', agentId: activeAgentSnapshot.id });
  }
  if (rollingSummary) addSystemPart('滚动上下文摘要', '[Conversation Summary]\n' + rollingSummary, { source: 'context-summary', compressedUntilIndex: chat.compressedUntilIndex || 0 });
  const otherAgentSummary = agentSummaryPrompt(list, activeAgentSnapshot.id);
  if (otherAgentSummary) addSystemPart('其他 Agent 摘要', otherAgentSummary, { source: 'agent-summaries' });
  if (toggles.skills) skills.forEach(s => {
    const limited = limitPromptText(s.prompt);
    addSystemPart(`技能 ${s.name}`, `[技能 ${s.name}] ${limited.text}`, {
      source: 'skill',
      id: s.id || '',
      name: s.name || '',
      truncated: limited.truncated,
      originalChars: limited.originalChars,
      limit: DEFAULT_SKILL_PROMPT_LIMIT,
    });
  });
  const knowledgeLimit = Math.max(0, Math.min(Number(settings.knowledgeSearchLimit ?? DEFAULT_KNOWLEDGE_SEARCH_LIMIT) || 0, 8));
  const knowledgeSnippets = toggles.knowledgeSearch ? searchKnowledgeSnippets(userMsg.content, knowledgeLimit) : [];
  if (knowledgeSnippets.length) {
    addSystemPart('相关 Markdown 知识片段', [
      '以下是 MD 知识库中可能相关的历史内容，请仅作为背景参考，不要把 history-md 当作生成文档的保存目录。',
      ...knowledgeSnippets.map((item, index) => `\n[${index + 1}] ${item.title}\n路径：${item.relativePath}\n摘要：${item.snippet}`),
    ].join('\n'), { source: 'knowledge-search', items: knowledgeSnippets.map(({ title, relativePath, score }) => ({ title, relativePath, score })) });
  }
  const requestedScene = req.body.scene || 'chat';
  if (requestedScene === 'image') {
    addSystemPart('Image Generation', [
      'You are in IMAGE GENERATION mode. When the user asks for an image:',
      '1. Analyze and refine the user prompt for better image quality',
      '2. Immediately call the webui_image_generate tool with the refined prompt',
      '3. Do NOT just output text prompts without calling the tool',
    ].join('\n'), { source: 'image-scene' });
  }
  const systemPrompt = systemParts.join('\n\n');
  const historyLimit = Math.max(4, Math.min(Number(settings.history) || 16, CONTEXT_KEEP_MESSAGES));
  const recentMessages = chat.messages.slice(-historyLimit).map((msg, index, arr) => (
    index === arr.length - 1 && msg === userMsg
      ? { ...msg, content: redactSecrets(String(req.body.content || userMsg.content || '')) }
      : msg
  ));
  const contextMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...recentMessages] : recentMessages;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const abortController = new AbortController();
  // Heartbeat: send comment every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 15000);
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
    clearInterval(heartbeat);
  });
  perfMark(res, perfStart, 'sse-flushed', {
    historyMessages: recentMessages.length,
    systemChars: systemPrompt.length,
    promptDebug,
    promptTotalApproxTokens: Math.ceil(systemPrompt.length / 4),
    matchedSkills: skills.map(s => ({ id: s.id || '', name: s.name || '', category: s.category || (Array.isArray(s.tags) ? s.tags[0] : ''), priority: Number(s.priority || 0), match: skillMatchInfo(s, userMsg.content) })),
  });

  const settingsForMode = store.read('settings', {});
  const modelRoot = store.read('models', {});
  const modelScope = settingsForMode.quickMode ? 'webui' : 'agent';
  const cfg = (modelRoot && (modelRoot.webui || modelRoot.agent)) ? (modelRoot[modelScope] || modelRoot.webui || modelRoot.agent || {}) : modelRoot;
  const hasImageAttachments = Array.isArray(req.body.attachments) && req.body.attachments.length > 0;
  if (hasImageAttachments && modelRoot && (modelRoot.webui || modelRoot.agent) && !cfg.scenarios?.vision) {
    const altScope = modelScope === 'webui' ? 'agent' : 'webui';
    const altCfg = modelRoot[altScope] || {};
    const altVisionId = altCfg.scenarios?.vision || '';
    const altVisionModel = Array.isArray(altCfg.library) ? altCfg.library.find(m => m && m.enabled !== false && (m.id === altVisionId || m.name === altVisionId)) : null;
    if (altVisionModel) {
      cfg.library = Array.isArray(cfg.library) ? [...cfg.library] : [];
      if (!cfg.library.some(m => m && m.id === altVisionModel.id)) cfg.library.push(altVisionModel);
      cfg.scenarios = { ...(cfg.scenarios || {}), vision: altVisionModel.id };
    }
  }
  cfg._scene = requestedScene;
  cfg._webuiRequestedScene = requestedScene;
  cfg._abortSignal = abortController.signal;

  const lastAssistant = [...chat.messages].reverse().find(m => m && m.role === 'assistant' && String(m.hermesSessionId || '').trim());
  if (lastAssistant?.hermesSessionId) cfg._resumeSessionId = String(lastAssistant.hermesSessionId).trim();
  let full = '';
  let reasoningFull = '';
  let errorFull = '';
  const toolCalls = [];
  let firstContentEventSeen = false;
  let sessionIdFromDone = cfg._resumeSessionId || '';
  let selectedRoute = '';
  let selectedRouteReason = '';
  let suppressAskJsonStream = false;

  try {
    for await (const event of chatStream(cfg, contextMessages)) {
      if (abortController.signal.aborted) break;
      if (event.type === 'perf') {
        if (event.stage === 'route-selected') {
          selectedRoute = event.route || '';
          selectedRouteReason = event.reason || '';
        }
        sseWrite(res, 'perf', event);
        continue;
      }
      if (!firstContentEventSeen) {
        firstContentEventSeen = true;
        perfMark(res, perfStart, 'first-hermes-event', { eventType: event.type });
      }
      switch (event.type) {
        case 'token':
          {
            const safeText = redactSecrets(event.text);
            full += safeText;
            if (full.toUpperCase().includes('WEBUI_ASK_JSON')) suppressAskJsonStream = true;
            if (!suppressAskJsonStream) sseWrite(res, 'token', { text: safeText });
          }
          break;

        case 'reasoning':
          {
            const safeText = redactSecrets(event.text);
            reasoningFull += safeText;
            sseWrite(res, 'reasoning', { text: safeText });
          }
          break;

        case 'tool':
          toolCalls.push({ ...sanitizeAny(event), done: false });
          sseWrite(res, 'tool', {
            event_type: event.event_type,
            name: event.name,
            preview: redactSecrets(event.preview),
            args: sanitizeAny(event.args),
          });
          break;

        case 'tool_complete':
          for (let i = toolCalls.length - 1; i >= 0; i--) {
            if (!toolCalls[i].done && (!event.name || toolCalls[i].name === event.name)) {
              toolCalls[i].done = true;
              toolCalls[i].is_error = event.is_error;
              toolCalls[i].duration = event.duration;
              break;
            }
          }
          sseWrite(res, 'tool_complete', {
            event_type: event.event_type,
            name: event.name,
            preview: redactSecrets(event.preview),
            is_error: event.is_error,
            duration: event.duration,
          });
          break;

        case 'title':
          sseWrite(res, 'title', { title: event.title, session_id: chat.id });
          if (event.title) chat.title = event.title;
          break;

        case 'session':
          if (event.sessionId) sessionIdFromDone = String(event.sessionId);
          sseWrite(res, 'perf', { stage: 'hermes-session', sessionId: sessionIdFromDone });
          break;

        case 'error':
          {
            const safeText = redactSecrets(event.text || '未知错误');
            errorFull += (errorFull ? '\n' : '') + safeText;
            sseWrite(res, 'error', { msg: safeText });
          }
          break;

        case 'done':
          if (event.session_id || event.sessionId) sessionIdFromDone = String(event.session_id || event.sessionId);
          break;
      }
    }

    if (abortController.signal.aborted) {
      perfMark(res, perfStart, 'client-aborted', { output_chars: full.length });
      return;
    }

    const askPayload = extractWebuiAskRequest(full);
    if (askPayload) {
      sseWrite(res, 'perf', { stage: 'agent-ask', title: askPayload.title });
      sseWrite(res, 'token', { text: '\n\nAgent 正在等待你的确认...\n' });
      const askResult = await modalBus.createAsk(askPayload, { wait: true }).catch(error => ({ ok: false, status: error.status || 'error', error: error.message, answers: null }));
      sseWrite(res, 'perf', { stage: 'agent-ask-result', status: askResult.status || (askResult.ok ? 'answered' : 'failed') });
      const answerText = formatAskAnswersForModel(askResult);
      full = '';
      const followupMessages = [
        ...contextMessages,
        { role: 'assistant', content: '[WebUI 已收到反问弹窗请求]' },
        { role: 'user', content: `以下是 WebUI 弹窗返回的用户确认结果：\n${answerText}\n\n请根据确认结果继续完成任务，不要再次输出 WEBUI_ASK_JSON，除非仍然缺少关键信息。` },
      ];
      for await (const followEvent of chatStream(cfg, followupMessages)) {
        if (abortController.signal.aborted) break;
        if (followEvent.type === 'token') {
          const safeText = redactSecrets(followEvent.text);
          full += safeText;
          sseWrite(res, 'token', { text: safeText });
        } else if (followEvent.type === 'reasoning') {
          const safeText = redactSecrets(followEvent.text);
          reasoningFull += safeText;
          sseWrite(res, 'reasoning', { text: safeText });
        } else if (followEvent.type === 'tool') {
          toolCalls.push({ ...sanitizeAny(followEvent), done: false });
          sseWrite(res, 'tool', { event_type: followEvent.event_type, name: followEvent.name, preview: redactSecrets(followEvent.preview), args: sanitizeAny(followEvent.args) });
        } else if (followEvent.type === 'tool_complete') {
          sseWrite(res, 'tool_complete', { event_type: followEvent.event_type, name: followEvent.name, preview: redactSecrets(followEvent.preview), is_error: followEvent.is_error, duration: followEvent.duration });
        } else if (followEvent.type === 'session') {
          if (followEvent.sessionId) sessionIdFromDone = String(followEvent.sessionId);
        } else if (followEvent.type === 'error') {
          const safeText = redactSecrets(followEvent.text || '未知错误');
          errorFull += (errorFull ? '\n' : '') + safeText;
          sseWrite(res, 'error', { msg: safeText });
        } else if (followEvent.type === 'done') {
          if (followEvent.session_id || followEvent.sessionId) sessionIdFromDone = String(followEvent.session_id || followEvent.sessionId);
        }
      }
    }

    const fallbackCall = parseWebuiImageTextToolCall(full);
    if (fallbackCall && !toolCalls.some(item => item.name === 'webui_image_generate')) {
      const fallback = await runWebuiImageTextToolFallback({
        call: fallbackCall,
        chatId: chat.id,
        userMsgId: req.body.userMsgId ? String(req.body.userMsgId) : '',
        assistantMsgId: req.body.assistantMsgId ? String(req.body.assistantMsgId) : '',
        req,
        res,
        toolCalls,
      });
      if (fallback.ok) {
        full = fallback.content || full.replace(fallbackCall.raw, '').trim();
        errorFull = '';
      } else {
        errorFull = fallback.error || 'image generation failed';
      }
    }

    if (!String(full || '').trim() && !String(errorFull || '').trim() && toolCalls.length === 0) {
      errorFull = 'Hermes Agent \u65e0\u8f93\u51fa\uff0c\u4efb\u52a1\u53ef\u80fd\u5df2\u4e2d\u65ad\u3002\u8bf7\u91cd\u8bd5\u3002';
      sseWrite(res, 'error', { msg: errorFull });
      sseWrite(res, 'perf', { stage: 'empty-agent-output' });
    }

    const assistantContent = full || (errorFull ? ('错误：' + errorFull) : '');
    const assistantMsg = { role: 'assistant', content: redactSecrets(assistantContent), ts: Date.now(), error: Boolean(errorFull && !full) };
    const imageToolCall = toolCalls.find(item => item.name === 'webui_image_generate' && item.preview);
    if (imageToolCall) {
      try {
        const imagePayload = JSON.parse(String(imageToolCall.preview || ''));
        if (imagePayload?.type === 'webui_image_generate_result' && Array.isArray(imagePayload.outputs) && imagePayload.outputs.length) {
          assistantMsg.imageGeneration = {
            status: 'done',
            model: imagePayload.model || '',
            provider: imagePayload.provider || '',
            outputs: imagePayload.outputs,
            inputs: imagePayload.inputs || [],
            prompt: imagePayload.prompt || '',
            sourcePrompt: imagePayload.sourcePrompt || '',
            optimizedPrompt: imagePayload.prompt || '',
            mode: imagePayload.mode || '',
            optimizedByAgent: !!imagePayload.optimizedByAgent,
            directMode: false,
          };
        }
      } catch (_) {}
    }
    if (req.body.assistantMsgId) assistantMsg._msgId = String(req.body.assistantMsgId);
    if (req.body.localEditContext?.id) assistantMsg.localEditContextId = String(req.body.localEditContext.id);
    chat.messages.push(assistantMsg);
    if (reasoningFull) chat.messages[chat.messages.length - 1].reasoning = redactSecrets(reasoningFull);
    if (toolCalls.length) {
      chat.messages[chat.messages.length - 1].tool_calls = toolCalls;
      chat.messages[chat.messages.length - 1].toolCalls = toolCalls.map(item => ({
        name: item.name || item.event_type || 'tool',
        status: item.is_error ? 'error' : 'success',
        input: item.args || item.preview || '',
        output: item.preview || '',
      }));
    }
    if (sessionIdFromDone) chat.messages[chat.messages.length - 1].hermesSessionId = sessionIdFromDone;
    chat.updatedAt = Date.now();
    if ((chat.title === '新对话' || chat.title === '未命名对话') && userMsg.content) chat.title = userMsg.content.slice(0, 24);
    saveAll(list);
    try { writeMarkdown(chat); } catch {}
    try { autoCaptureKnowledge(chat, userMsg, assistantContent); } catch {}
    appendSystemLog({
      type: 'task',
      level: errorFull ? 'error' : 'info',
      msg: (chat.title || 'chat') + ' · ' + (selectedRoute || 'unknown') + ' · ' + (Date.now() - perfStart) + 'ms',
      chatId: chat.id,
      title: chat.title || '',
      route: selectedRoute || '',
      reason: selectedRouteReason || '',
      durationMs: Date.now() - perfStart,
      outputChars: full.length,
      error: errorFull || '',
    });

    sseWrite(res, 'done', {
      session_id: chat.id,
      usage: { input_tokens: 0, output_tokens: 0 },
      perf: { total_ms: Date.now() - perfStart, output_chars: full.length },
    });
  } catch (e) {
    if (abortController.signal.aborted) return;
    const safeText = redactSecrets(e.message || '未知错误');
    sseWrite(res, 'error', { msg: safeText });
    try {
      const errorMsg = { role: 'assistant', content: '错误：' + safeText, ts: Date.now(), error: true };
      if (req.body.assistantMsgId) errorMsg._msgId = String(req.body.assistantMsgId);
      if (req.body.localEditContext?.id) errorMsg.localEditContextId = String(req.body.localEditContext.id);
      chat.messages.push(errorMsg);
      chat.updatedAt = Date.now();
      appendSystemLog({ type: 'task', level: 'error', msg: (chat.title || 'chat') + ' · error · ' + (Date.now() - perfStart) + 'ms', chatId: chat.id, title: chat.title || '', route: selectedRoute || '', reason: selectedRouteReason || '', durationMs: Date.now() - perfStart, outputChars: full.length, error: safeText });
      saveAll(list);
      writeMarkdown(chat);
    } catch {}
  } finally {
    res.end();
  }
});

router.post('/gc-stream', async (req, res) => {
  const { messages, model, scene } = req.body;
  if (!messages || !messages.length) return res.fail('messages required');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const abortController = new AbortController();
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 15000);
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
    clearInterval(heartbeat);
  });

  const settingsForMode = store.read('settings', {});
  const modelRoot = store.read('models', {});
  const modelScope = settingsForMode.quickMode ? 'webui' : 'agent';
  const cfg = (modelRoot && (modelRoot.webui || modelRoot.agent)) ? (modelRoot[modelScope] || modelRoot.webui || modelRoot.agent || {}) : modelRoot;
  const requestedScene = scene || 'chat';
  cfg._scene = requestedScene;
  cfg._webuiRequestedScene = requestedScene;
  cfg._abortSignal = abortController.signal;


  try {
    for await (const event of chatStream(cfg, messages)) {
      if (abortController.signal.aborted) break;
      switch (event.type) {
        case 'token':
          sseWrite(res, 'token', { text: redactSecrets(event.text) });
          break;
        case 'reasoning':
          sseWrite(res, 'reasoning', { text: redactSecrets(event.text) });
          break;
        case 'error':
          sseWrite(res, 'error', { msg: redactSecrets(event.text) });
          break;
      }
    }
    if (!abortController.signal.aborted) sseWrite(res, 'done', {});
  } catch (e) {
    if (abortController.signal.aborted) return;
    sseWrite(res, 'error', { msg: e.message });
  } finally {
    res.end();
  }
});
module.exports = router;

