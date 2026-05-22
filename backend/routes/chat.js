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

const router = express.Router();
const KEY = 'chats';
const DEFAULT_SKILL_PROMPT_LIMIT = Math.max(1000, Number(process.env.HERMES_SKILL_PROMPT_LIMIT || 6000));
const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = Math.max(0, Math.min(Number(process.env.HERMES_KNOWLEDGE_SEARCH_LIMIT || 3), 8));
const WEBUI_SELF_PROTECTION_PROMPT = `【WebUI 对话执行规则】
当前请求来自 Hermes WebUI 对话页。除非用户明确说明“现在不是 WebUI 对话，而是在 CLI/代码维护模式中修改项目”，否则你应把自己当作正在 WebUI 中服务用户的 Agent。

1. 图像任务：
- 当用户要求生成图片、画图、出图、改图、优化图片，或基于参考图生成视觉效果时，必须优先调用可用的图像生成工具，例如 webui_image_generate。
- 不要输出 curl、Python、HTTP 请求示例、伪代码，或“等待 API 返回”这类说明。
- 工具调用完成后，只需要用简短中文总结结果，并展示工具返回的图片 Markdown/预览链接。
- 如果工具不可用或失败，明确说明失败原因和下一步，不要假装已经生成。

2. 参考图任务：
- 用户上传图片并要求生成、修改、优化视觉效果时，应作为图像任务处理。
- 如果当前工具不能读取参考图，请直接说明工具限制，不要编造本地接口命令。

3. WebUI 自保护：
- 不要主动修改当前 Hermes WebUI 的核心代码与服务文件。
- 允许读取文件、解释现状、给出方案；允许在用户授权后写入业务数据文件，例如配置、记忆、输出文档和 backend/data 下的数据。
- 如果用户要求维护 WebUI 代码，请提示需要切换到 CLI/代码维护模式。`;

function loadAll() { return store.read(KEY, []); }
function saveAll(list) { store.write(KEY, list); }
function safeName(name) {
  return String(name || 'conversation').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}
function toMarkdown(chat) {
  const lines = [
    `# ${redactSecrets(chat.title || '未命名对话')}`,
    '',
    `- 时间：${new Date(chat.updatedAt || chat.createdAt || Date.now()).toLocaleString('zh-CN')}`,
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

function needsKnowledgeBaseRules(text = '') {
  return /文档|markdown|md\b|知识库|教程|笔记|总结|规范|方案|验收|交接|复盘|报告|分享|归档|保存|frontmatter|artifact/i.test(String(text || ''));
}

function isAgentTaskIntent(text = '') {
  return /\b(改代码|修改代码|写入文件|保存文件|创建文件|删除文件|移动文件|重命名文件|运行命令|执行命令|终端|shell|powershell|cmd|git\s|npm\s|pnpm\s|yarn\s|docker\s|测试|构建|部署|安装依赖|批量处理|扫描项目|读取目录|分析代码库|修复bug|修 bug|提交|commit|push)\b|帮我(改|修|写|创建|删除|运行|执行|安装|部署)|打开.*文件|操作.*文件|工具调用|agent\s*模式|hermes\s*模式/i.test(String(text || ''));
}

function skillMatchesMessage(skill = {}, text = '') {
  const haystack = String((skill.name || '') + ' ' + (skill.description || skill.desc || '') + ' ' + (skill.prompt || '')).toLowerCase();
  const message = String(text || '').toLowerCase();
  const keywords = tokenizeForSearch((skill.name || '') + ' ' + (skill.description || skill.desc || '')).slice(0, 12);
  if (keywords.some(token => token && message.includes(token))) return true;
  const pairs = [
    [/图|图片|画|生成图|出图|海报|插画|logo|视觉|参考图|改图|修图|image/i, /图|图片|image|视觉|海报|插画|logo|生成/i],
    [/代码|bug|报错|重构|审查|项目|函数|接口|前端|后端|node|js|css|html/i, /代码|审查|重构|bug|开发|编程/i],
    [/文件|保存|写入|读取|目录|路径|md|markdown|文档/i, /文件|目录|markdown|文档|写入|读取/i],
    [/联网|搜索|查一下|资料|官网|最新|新闻/i, /联网|搜索|浏览|资料|网页/i],
    [/记忆|偏好|习惯|兴趣|长期|remember/i, /记忆|长期|偏好|习惯/i],
    [/更新|安装|升级|github|版本|webui/i, /更新|安装|升级|webui|github/i],
    [/润色|表达|文案|改写|标题|方案|设计/i, /润色|表达|写作|文案|design|polish/i],
  ];
  return pairs.some(([intent, skillRe]) => intent.test(message) && skillRe.test(haystack));
}

function selectRelevantSkills(skills = [], message = '', { forceAll = false, limit = 4 } = {}) {
  if (forceAll) return skills;
  const matched = skills.filter(skill => skillMatchesMessage(skill, message));
  return matched.slice(0, Math.max(0, limit));
}

function limitPromptText(text = '', limit = DEFAULT_SKILL_PROMPT_LIMIT) {
  const raw = String(text || '');
  if (!raw || raw.length <= limit) return { text: raw, truncated: false, originalChars: raw.length };
  const head = Math.floor(limit * 0.72);
  const tail = Math.max(400, limit - head - 220);
  const clipped = `${raw.slice(0, head).trim()}\n\n[内容已截断：原始 ${raw.length} 字，仅注入前 ${head} 字和末尾 ${tail} 字。请优先遵守摘要、触发条件和关键规则。]\n\n${raw.slice(-tail).trim()}`;
  return { text: clipped, truncated: true, originalChars: raw.length };
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
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    preview: redactSecrets(c.messages?.slice(-1)[0]?.content || '').slice(0, 90),
    messageCount: c.messages?.length || 0,
  }));
  res.ok(list);
});

router.post('/', (req, res) => {
  const now = Date.now();
  const chat = {
    id: crypto.randomUUID(),
    title: req.body.title || '新建对话',
    model: req.body.model || 'hermes-agent',
    agentId: req.body.agentId || '',
    agentName: req.body.agentName || '',
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
  if (req.body.agentId !== undefined) chat.agentId = String(req.body.agentId || '');
  if (req.body.agentName !== undefined) chat.agentName = String(req.body.agentName || '');
  chat.updatedAt = Date.now();
  saveAll(list);
  res.ok(sanitizeChat(chat));
});

router.post('/:id/messages/feedback', (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);

  const msgId = String(req.body.msgId || '');
  const feedback = req.body.feedback === 'like' ? 'like' : req.body.feedback === 'dislike' ? 'dislike' : '';
  if (!msgId || !feedback) return res.fail('invalid feedback', 400, 400);

  const message = (chat.messages || []).find(m => m && m.role === 'assistant' && String(m._msgId || m.ts || '') === msgId);
  if (!message) return res.fail('message not found', 404, 404);

  message.feedback = { value: feedback, updatedAt: Date.now() };
  chat.updatedAt = Date.now();
  saveAll(list);
  res.ok({ feedback: message.feedback });
});

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
  if (req.body.profileId) chat.agentId = String(req.body.profileId);
  if (req.body.profileName) chat.agentName = String(req.body.profileName).slice(0, 120);

  const requestedSkillIds = Array.isArray(req.body.profileSkillIds) ? req.body.profileSkillIds.map(String) : [];
  const storedSkills = store.read('skills', []);
  const externalSkills = discoverExternalSkills().map(skill => {
    const old = storedSkills.find(item => item && (item.id === skill.id || samePath(item.path, skill.path) || item.name === skill.name));
    return old ? { ...skill, on: old.on !== undefined ? old.on : skill.on, enabled: old.enabled !== undefined ? old.enabled : old.on } : skill;
  });
  const allSkills = [
    ...externalSkills,
    ...storedSkills
      .filter(item => item && item.source !== 'builtin' && item.source !== 'external')
      .filter(item => !externalSkills.some(skill => skill.id === item.id || samePath(skill.path, item.path) || skill.name === item.name))
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
  if (toggles.webuiRules) addSystemPart('WebUI 自保护规则', WEBUI_SELF_PROTECTION_PROMPT, { source: 'builtin' });
  const memoryPrompt = readCoreMemoryPrompt();
  if (toggles.coreMemory) addSystemPart('核心记忆', memoryPrompt, { source: 'memory' });
  const agentRulesPrompt = readAgentRulesPrompt({ includeKnowledgeBase: needsKnowledgeBaseRules(userMsg.content) });
  if (toggles.agentRules) addSystemPart('Agent 规则', agentRulesPrompt, { source: 'rules', knowledgeBase: needsKnowledgeBaseRules(userMsg.content) });
  if (toggles.userSystemPrompt) addSystemPart('全局系统提示词', settings.systemPrompt, { source: 'settings' });
  if (toggles.profilePrompt && (req.body.profilePrompt || req.body.profileName)) {
    addSystemPart(`Agent Profile: ${String(req.body.profileName || req.body.profileId || '默认助手').slice(0, 80)}`, `[当前 Agent: ${String(req.body.profileName || req.body.profileId || '默认助手').slice(0, 80)}]\n${String(req.body.profilePrompt || '').slice(0, 6000)}`, { source: 'profile' });
  }
  if (toggles.skills) skills.forEach(s => {
    const limited = limitPromptText(s.prompt);
    addSystemPart(`技能: ${s.name}`, `[技能: ${s.name}] ${limited.text}`, {
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
      '以下是从 MD 输出库按当前问题轻量检索到的相关片段，仅作为上下文参考；如果与用户当前要求冲突，以用户当前要求为准。',
      ...knowledgeSnippets.map((item, index) => `\n[${index + 1}] ${item.title}\n路径：${item.relativePath}\n摘要：${item.snippet}`),
    ].join('\n'), { source: 'knowledge-search', items: knowledgeSnippets.map(({ title, relativePath, score }) => ({ title, relativePath, score })) });
  }
  const systemPrompt = systemParts.join('\n\n');
  const historyLimit = Math.max(4, Math.min(Number(settings.history) || 16, 60));
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
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });
  perfMark(res, perfStart, 'sse-flushed', {
    historyMessages: recentMessages.length,
    systemChars: systemPrompt.length,
    promptDebug,
    promptTotalApproxTokens: Math.ceil(systemPrompt.length / 4),
  });

  const cfg = store.read('models', {});
  cfg._scene = req.body.scene || 'chat';
  cfg._abortSignal = abortController.signal;
  if (req.body.model && req.body.model !== 'auto') cfg._requestedModel = req.body.model;
  const lastAssistant = [...chat.messages].reverse().find(m => m && m.role === 'assistant' && String(m.hermesSessionId || '').trim());
  if (lastAssistant?.hermesSessionId) cfg._resumeSessionId = String(lastAssistant.hermesSessionId).trim();
  let full = '';
  let reasoningFull = '';
  let errorFull = '';
  const toolCalls = [];
  let firstContentEventSeen = false;
  let sessionIdFromDone = cfg._resumeSessionId || '';

  try {
    for await (const event of chatStream(cfg, contextMessages)) {
      if (abortController.signal.aborted) break;
      if (event.type === 'perf') {
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
            sseWrite(res, 'token', { text: safeText });
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

    const assistantContent = full || (errorFull ? `⚠️ ${errorFull}` : '');
    chat.messages.push({ role: 'assistant', content: redactSecrets(assistantContent), ts: Date.now(), error: Boolean(errorFull && !full) });
    if (reasoningFull) chat.messages[chat.messages.length - 1].reasoning = reasoningFull;
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
    if ((chat.title === '新建对话' || chat.title === '鏂板缓瀵硅瘽') && userMsg.content) chat.title = userMsg.content.slice(0, 24);
    saveAll(list);
    try { writeMarkdown(chat); } catch {}

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
      chat.messages.push({ role: 'assistant', content: `⚠️ ${safeText}`, ts: Date.now(), error: true });
      chat.updatedAt = Date.now();
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
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  const cfg = store.read('models', {});
  cfg._scene = scene || 'chat';
  cfg._abortSignal = abortController.signal;
  if (model && model !== 'auto') cfg._requestedModel = model;

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
