﻿﻿﻿const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('../services/store');
const paths = require('../services/paths');
const { chatStream } = require('../services/llm');
const { readCoreMemoryPrompt, readAgentMemoryPrompt, readAgentRulesPrompt } = require('../services/memory');
const { redactSecrets, sanitizeAny, sanitizeChat } = require('../services/security');
const { discoverExternalSkills, samePath, normalizeFsPath } = require('../services/skillDiscovery');
const { builtinSkills, isBuiltinLike } = require('../services/builtinSkills');
const modalBus = require('./modal');
const { captureKnowledge } = require('../services/knowledgeCapture');
const { generateImageFromPrompt, generateVideoFromPrompt } = require('./images');
const bridge = require('../services/hermes-python-bridge');

const router = express.Router();
const KEY = 'chats';

const WEBUI_HERMES_SESSION_KEY = 'webui-hermes-sessions';
function markWebuiHermesSession(sessionId, chatId = '') {
  try {
    const id = String(sessionId || '').trim();
    if (!id) return;
    const list = store.read(WEBUI_HERMES_SESSION_KEY, []);
    const rows = Array.isArray(list) ? list.filter(item => item && item.sessionId !== id) : [];
    rows.unshift({ sessionId: id, chatId: String(chatId || ''), source: 'webui', updatedAt: Date.now() });
    store.write(WEBUI_HERMES_SESSION_KEY, rows.slice(0, 1000));
  } catch (_) {}
}
const DEFAULT_SKILL_PROMPT_LIMIT = Math.max(1000, Number(process.env.HERMES_SKILL_PROMPT_LIMIT || 6000));
const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = Math.max(0, Math.min(Number(process.env.HERMES_KNOWLEDGE_SEARCH_LIMIT || 3), 8));
const CONTEXT_KEEP_MESSAGES = Math.max(8, Number(process.env.HERMES_CONTEXT_KEEP_MESSAGES || 24));
const CONTEXT_SUMMARY_TRIGGER = Math.max(CONTEXT_KEEP_MESSAGES + 6, Number(process.env.HERMES_CONTEXT_SUMMARY_TRIGGER || 36));
const ENV_AUTO_CAPTURE_CHAT_MD = /^(1|true|yes|on)$/i.test(String(process.env.HERMES_AUTO_CAPTURE_CHAT_MD || ''));
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

可用 WebUI 本地工具协议：
- webui_image_generate({"prompt":"最终提示词","sourcePrompt":"用户原始需求","attachmentIds":["可选附件ID"]})：生成/编辑图片，WebUI 后端会执行并返回图片。
- webui_markdown_create({"title":"文档标题","path":"可选相对路径.md","content":"完整 Markdown 内容"})：把输出文档保存到 MD 输出库并展示 Artifact。
- webui_markdown_insert_image({"path":"target.md or absolute .md path","imageId":"image id or url","alt":"image alt","position":"top|append"}): embed a WebUI image directly into the Markdown document as a Base64 data:image URL. Use position="top" when the user says ???/??/??; use append only for bottom/end.
  ??? WebUI ???????????????????????????????????/?????????????????????????????????
- webui_markdown_write 与 webui_file_write 可作为 webui_markdown_create 的同义调用，但只允许写入 MD 输出库内的 .md 文件。
- 调用工具时不要包在 Markdown 代码块中；如果运行时只把工具调用当文本输出，WebUI 会自动兜底执行。

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
function isInsidePath(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
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

function videoTaskIdFromMessage(msg = {}) {
  const genTask = msg && msg.imageGeneration && msg.imageGeneration.taskId ? String(msg.imageGeneration.taskId).trim() : '';
  if (genTask) return genTask;
  const text = [msg && msg.content, msg && msg.toolCalls ? JSON.stringify(msg.toolCalls) : '', msg && msg.tool_calls ? JSON.stringify(msg.tool_calls) : ''].join('\n');
  return (String(text || '').match(/task_[A-Za-z0-9]+/) || [])[0] || '';
}

async function hydrateVideoTasksForChat(chat, req = null) {
  if (!chat || !Array.isArray(chat.messages)) return { chat, changed: false };
  let changed = false;
  let hydrateChecks = 0;
  const maxHydrateChecks = 2;
  const host = req ? (req.get('host') || '127.0.0.1:3381') : '127.0.0.1:3381';
  const protocol = req && req.protocol ? req.protocol : 'http';
  const publicBase = protocol + '://' + host;
  for (const msg of chat.messages) {
    if (!msg || msg.role !== 'assistant') continue;
    const taskId = videoTaskIdFromMessage(msg);
    if (!taskId) continue;
    const fallbackPrompt = previousUserContentForMessage(chat.messages, msg);
    const currentOutputs = Array.isArray(msg.imageGeneration && msg.imageGeneration.outputs) ? msg.imageGeneration.outputs : [];
    if (currentOutputs.length) {
      const gen = msg.imageGeneration || {};
      if (fallbackPrompt && (!gen.prompt || !gen.sourcePrompt)) {
        msg.imageGeneration = {
          ...gen,
          prompt: gen.prompt || fallbackPrompt,
          sourcePrompt: gen.sourcePrompt || fallbackPrompt,
          optimizedPrompt: gen.optimizedPrompt || gen.prompt || fallbackPrompt,
          outputs: currentOutputs.map(item => ({ ...item, prompt: item.prompt || gen.prompt || fallbackPrompt, sourcePrompt: item.sourcePrompt || gen.sourcePrompt || fallbackPrompt })),
        };
        changed = true;
      }
      continue;
    }
    if (hydrateChecks >= maxHydrateChecks) continue;
    hydrateChecks += 1;
    try {
      const url = publicBase + '/api/images/video/task/' + encodeURIComponent(taskId)
        + '?publicBase=' + encodeURIComponent(publicBase)
        + '&prompt=' + encodeURIComponent((msg.imageGeneration && msg.imageGeneration.prompt) || '')
        + '&sourcePrompt=' + encodeURIComponent((msg.imageGeneration && msg.imageGeneration.sourcePrompt) || '');
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await response.json().catch(() => ({}));
      const data = json && json.code === 0 ? json.data : null;
      const outputs = Array.isArray(data && data.outputs) ? data.outputs : [];
      if (outputs.length) {
        msg.imageGeneration = {
          ...(msg.imageGeneration || {}),
          status: 'done',
          mediaType: 'video',
          model: (data.raw && data.raw.model) || (msg.imageGeneration && msg.imageGeneration.model) || '',
          provider: (msg.imageGeneration && msg.imageGeneration.provider) || '',
          outputs,
          inputs: (msg.imageGeneration && msg.imageGeneration.inputs) || [],
          prompt: (msg.imageGeneration && msg.imageGeneration.prompt) || outputs[0].prompt || '',
          sourcePrompt: (msg.imageGeneration && msg.imageGeneration.sourcePrompt) || outputs[0].sourcePrompt || '',
          optimizedPrompt: (msg.imageGeneration && msg.imageGeneration.optimizedPrompt) || (msg.imageGeneration && msg.imageGeneration.prompt) || '',
          mode: 'text-to-video',
          taskId,
          taskStatus: 'completed',
          loadingText: '',
          directMode: false,
        };
        msg.content = outputs.map((item, index) => {
          const videoUrl = item.publicUrl || item.url || '';
          return videoUrl ? '[Generated video ' + (index + 1) + '](' + videoUrl + ')' : '';
        }).filter(Boolean).join('\n\n') || msg.content;
        msg._streaming = false;
        changed = true;
      } else if (data && data.status && (!msg.imageGeneration || msg.imageGeneration.status !== 'done')) {
        msg.imageGeneration = {
          ...(msg.imageGeneration || {}),
          status: 'loading',
          mediaType: 'video',
          taskId,
          taskStatus: data.status || 'queued',
          outputs: [],
          loadingText: '\u89c6\u9891\u751f\u6210\u4e2d\uff0c\u5df2\u63d0\u4ea4\u4efb\u52a1',
          directMode: false,
        };
      }
    } catch (_) {}
  }
  return { chat, changed };
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

function isDocumentOutputIntent(text = '') {
  const value = String(text || '');
  if (!value.trim()) return false;
  const actionRe = /输出|生成|导出|写|写成|保存|存成|整理成|转成|create|generate|export|write|save/i;
  const targetRe = /md|markdown|文档|文章|报告|方案|笔记|总结|教程|doc|document|report|note/i;
  return actionRe.test(value) && targetRe.test(value);
}

function isVideoOutputIntent(text = '') {
  const value = String(text || '').trim();
  if (!value) return false;
  return /(video generation|text-to-video|image-to-video|generate.{0,80}(video|clip|animation|motion)|create.{0,80}(video|clip|animation|motion)|make.{0,80}(video|clip|animation|motion)|(\u751f\u6210|\u505a|\u521b\u5efa|\u8f93\u51fa|\u5236\u4f5c).{0,32}(\u89c6\u9891|\u77ed\u7247|\u52a8\u753b|\u52a8\u6548|\u52a8\u6001\u753b\u9762)|\u6587\u751f\u89c6\u9891|\u56fe\u751f\u89c6\u9891)/i.test(value);
}

function videoSecondsFromText(text = '') {
  const value = String(text || '');
  const en = value.match(/(\d{1,2})\s*(?:s|sec|secs|second|seconds)\b/i);
  const zh = value.match(/(\d{1,2})\s*\u79d2/);
  const matchedSeconds = Number((en && en[1]) || (zh && zh[1]) || 0);
  return matchedSeconds > 0 ? Math.max(1, Math.min(matchedSeconds, 20)) : 0;
}

function videoFallbackCallFromText(text = '') {
  const value = String(text || '').trim();
  if (!value || !isVideoOutputIntent(value)) return null;
  return { prompt: value, sourcePrompt: value, model: 'auto', size: '1024x1024', seconds: videoSecondsFromText(value) || 5, raw: value };
}

function isImageOutputIntent(text = '') {
  const value = String(text || '').trim();
  if (!value) return false;
  const keywords = ['\u56fe\u50cf\u751f\u6210','\u751f\u6210\u56fe\u50cf','\u751f\u6210\u56fe\u7247','\u56fe\u7247\u751f\u6210','\u753b\u4e00\u5f20','\u753b\u5f20','\u753b\u56fe','\u51fa\u56fe','\u751f\u56fe','\u7ed8\u56fe','\u505a\u4e00\u5f20','\u505a\u5f20','\u6765\u4e00\u5f20','\u6d77\u62a5','\u5934\u50cf','\u58c1\u7eb8','\u63d2\u753b','\u6539\u56fe','\u4fee\u56fe','\u91cd\u753b','\u91cd\u7ed8','\u91cd\u65b0\u751f\u6210','\u91cd\u65b0\u753b','\u91cd\u65b0\u51fa','\u6362\u4e00\u5f20','\u6362\u5f20','\u6362\u98ce\u683c','\u518d\u6765\u4e00\u5f20','\u518d\u751f\u6210','\u518d\u753b','\u4f18\u5316\u56fe','\u8c03\u6574\u56fe'];
  if (keywords.some(keyword => value.includes(keyword))) return true;
  if (/\u4e0d\u884c.{0,12}\u91cd|\u4e0d\u597d\u770b.{0,12}\u91cd|\u53c2\u8003.{0,20}\u56fe|\u57fa\u4e8e.{0,20}\u56fe/i.test(value)) return true;
  return /(generate|draw|create|edit|modify|optimize|change|replace|redraw|regenerate|rerender|remix|make).{0,80}(image|picture|photo|poster|avatar|wallpaper|illustration|visual|style)|regenerate|redraw|rerender|remix/i.test(value);
}

function imageFallbackCallFromText(text = '', chat = null) {
  const value = String(text || '').trim();
  if (!value || !isImageOutputIntent(value)) return null;
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  const lastImage = [...messages].reverse().find(msg => msg && msg.role === 'assistant' && msg.imageGeneration && Array.isArray(msg.imageGeneration.outputs) && msg.imageGeneration.outputs.length);
  const gen = lastImage?.imageGeneration || {};
  const previousPrompt = gen.prompt || gen.optimizedPrompt || gen.sourcePrompt || gen.outputs?.[0]?.prompt || '';
  const followupKeywords = ['\u91cd\u753b','\u91cd\u7ed8','\u91cd\u65b0\u751f\u6210','\u91cd\u65b0\u753b','\u91cd\u65b0\u51fa','\u6362\u4e00\u5f20','\u6362\u5f20','\u6362\u98ce\u683c','\u518d\u6765\u4e00\u5f20','\u518d\u751f\u6210','\u518d\u753b','\u4e0d\u884c','\u4e0d\u597d\u770b','\u8c03\u6574','\u4f18\u5316'];
  const isFollowup = followupKeywords.some(keyword => value.includes(keyword)) || /redraw|regenerate|rerender|remix/i.test(value);
  const prompt = isFollowup && previousPrompt
    ? `Regenerate the previous WebUI image. Previous prompt: ${previousPrompt}\nCurrent user change request: ${value}`
    : value;
  return { prompt, sourcePrompt: value, model: 'auto', size: '1024x1024', raw: value };
}

function hasFakeMarkdownImageOutput(text = '') {
  const value = String(text || '');
  if (!value) return false;
  const imageMd = /!\[[^\]]*\]\(([^)]+)\)/i;
  if (!imageMd.test(value)) return false;
  return !/webui_image_generate_result|\/api\/images\/file\/|\/uploads\/|https?:\/\//i.test(value);
}

function pendingAttachmentIdsFromReq(req) {
  const body = req && req.body ? req.body : {};
  const ids = [];
  if (Array.isArray(body.pendingAttachmentIds)) ids.push(...body.pendingAttachmentIds);
  if (Array.isArray(body.attachmentIds)) ids.push(...body.attachmentIds);
  if (Array.isArray(body.attachments)) ids.push(...body.attachments.map(item => item && (item.id || item.attachmentId)).filter(Boolean));
  return [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
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
    routingMode: String(body.routingMode || 'auto').toLowerCase(),
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

function effectiveRoutingModeFromRequest(body = {}, agentSnapshot = {}, settings = {}) {
  const requested = String(body.routingMode || '').toLowerCase();
  const globalMode = String(settings.routingMode || 'auto').toLowerCase();
  if (globalMode && globalMode !== 'auto') return globalMode;
  if (requested) return requested;
  return String(agentSnapshot.routingMode || globalMode || 'auto').toLowerCase();
}

function shouldAutoCaptureChatMarkdown() {
  const settings = store.read('settings', {}) || {};
  if (settings.autoCaptureChatMd !== undefined) return settings.autoCaptureChatMd === true || String(settings.autoCaptureChatMd).toLowerCase() === 'true';
  return ENV_AUTO_CAPTURE_CHAT_MD;
}

function autoCaptureKnowledge(chat, userMsg, assistantContent) {
  if (!shouldAutoCaptureChatMarkdown()) return;
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

router.get('/:id', async (req, res) => {
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  if (String(req.query.hydrateVideo || '') === '1') {
    const hydrated = await hydrateVideoTasksForChat(chat, req);
    if (hydrated.changed) {
      chat.updatedAt = Date.now();
      saveAll(list);
    }
  }
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


function parseWebuiVideoTextToolCall(text = '') {
  const raw = String(text || '').trim();
  const parseArgs = (args, sourceText) => {
    const prompt = String(args?.prompt || '').trim();
    if (!prompt) return null;
    return {
      prompt,
      sourcePrompt: String(args.sourcePrompt || args.source_prompt || args.originalPrompt || prompt).trim(),
      model: String(args.model || 'auto'),
      size: String(args.size || '1024x1024'),
      seconds: Number(args.seconds || args.duration || 5) || 5,
      attachmentIds: Array.isArray(args.attachmentIds) ? args.attachmentIds.map(String).filter(Boolean) : [],
      raw: sourceText,
    };
  };

  const fnMatch = raw.match(/webui_video_generate\s*\(\s*({[\s\S]*?})\s*\)/m);
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
  if (jsonMatch && /webui_video_generate|video|\u89c6\u9891|\u77ed\u7247|\u52a8\u753b|\u52a8\u6548/.test(raw)) jsonCandidates.push(jsonMatch[1]);

  for (const candidate of jsonCandidates) {
    try {
      const parsed = parseArgs(JSON.parse(candidate), candidate);
      if (parsed) return parsed;
    } catch (_) {}
  }
  return null;
}

function parseVideoPendingTextResult(value = '') {
  const raw = String(value || '');
  const taskId = (raw.match(/task_[A-Za-z0-9]+/) || [])[0] || '';
  if (!taskId) return null;
  if (!/(queued|pending|video task submitted|\u6392\u961f|\u89c6\u9891\u4efb\u52a1\u5df2\u63d0\u4ea4|\u751f\u6210\u5b8c\u6210\u540e|\u751f\u6210\u4e2d)/i.test(raw)) return null;
  const model = (raw.match(/(?:\u6a21\u578b|model)[:?]\s*([^\n]+)/i) || [])[1] || 'auto';
  return { success: true, type: 'webui_video_generate_result', taskId, status: 'pending', taskStatus: 'queued', outputs: [], model: String(model).trim(), content: raw };
}
function webuiVideoToolResultPayload(data = {}) {
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  const markdown = outputs.map((item, index) => {
    const url = item.publicUrl || item.url || '';
    return url ? '[Generated video ' + (index + 1) + '](' + url + ')' : '';
  }).filter(Boolean).join('\n\n');
  return {
    success: true,
    type: 'webui_video_generate_result',
    markdown,
    videoUrl: outputs[0]?.publicUrl || outputs[0]?.url || '',
    taskId: data.taskId || '',
    status: data.status || '',
    taskStatus: data.taskStatus || data.status || '',
    outputs,
    inputs: Array.isArray(data.inputs) ? data.inputs : [],
    prompt: data.prompt || '',
    sourcePrompt: data.sourcePrompt || '',
    mode: data.mode || 'text-to-video',
    model: data.model || 'auto',
    provider: data.provider || '',
    content: data.content || markdown,
  };
}

function imageRecordsForMarkdownTool() {
  const records = [];
  try {
    const imageRoot = paths.imageRoot();
    const indexPath = path.join(imageRoot, 'images-index.json');
    if (fs.existsSync(indexPath)) {
      const fromIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      records.push(...(Array.isArray(fromIndex) ? fromIndex : (Array.isArray(fromIndex?.records) ? fromIndex.records : [])));
    }
  } catch (_) {
    // Keep going: a stale/corrupt image index should not disable Markdown embedding.
  }
  try {
    const fromStore = store.read('images', []);
    records.push(...(Array.isArray(fromStore) ? fromStore : []));
  } catch (_) {}
  try {
    records.push(...collectMarkdownImageFiles(paths.imageInputDir(), 'input'));
    records.push(...collectMarkdownImageFiles(paths.imageOutputDir(), 'output'));
  } catch (_) {}
  const seen = new Set();
  return records.filter(item => {
    if (!item) return false;
    const key = String(item.id || item.relativePath || item.path || item.fullPath || item.filename || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectMarkdownImageFiles(dir, kind, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownImageFiles(fullPath, kind, out);
    } else if (entry.isFile() && /\.(png|jpe?g|jfif|webp|gif|svg|avif|bmp)$/i.test(entry.name)) {
      out.push({
        id: '',
        kind,
        filename: entry.name,
        originalName: entry.name,
        path: fullPath,
        fullPath,
        relativePath: path.relative(paths.imageRoot(), fullPath),
      });
    }
  }
  return out;
}

function markdownImageLookupTokens(value = '') {
  const raw = String(value || '').trim();
  const decoded = (() => { try { return decodeURIComponent(raw); } catch { return raw; } })();
  const withoutQuery = decoded.split(/[?#]/)[0];
  const lastPart = withoutQuery.split(/[\\/]/).filter(Boolean).pop() || '';
  const fileIdMatch = decoded.match(/\/api\/images\/file\/([^/?#]+)/i);
  const fileId = fileIdMatch ? fileIdMatch[1] : lastPart;
  const hashTail = String(fileId || lastPart || '').split('_').filter(Boolean).pop() || '';
  return [...new Set([raw, decoded, withoutQuery, lastPart, fileId, hashTail].map(v => String(v || '').trim()).filter(Boolean))];
}

function resolveWebuiImageForMarkdown(imageId = '') {
  const value = String(imageId || '').trim();
  if (!value) return null;
  const decoded = (() => { try { return decodeURIComponent(value); } catch { return value; } })();
  const tokens = markdownImageLookupTokens(value);
  const records = imageRecordsForMarkdownTool();
  const found = records.find(item => {
    const relative = String(item.relativePath || '').replace(/\\/g, '/');
    const baseName = path.basename(String(item.path || item.fullPath || item.filename || item.originalName || ''));
    const baseStem = baseName ? path.basename(baseName, path.extname(baseName)) : '';
    const ids = [item.id, item.filename, item.originalName, item.url, item.publicUrl, item.path, item.fullPath, item.relativePath, relative, baseName, baseStem]
      .map(v => String(v || '').trim())
      .filter(Boolean);
    if (ids.some(id => id === decoded || id === value || tokens.includes(id))) return true;
    return ids.some(id => {
      if (id.length >= 8 && (decoded.includes(id) || value.includes(id))) return true;
      const stemTail = path.basename(id, path.extname(id)).split('_').filter(Boolean).pop() || '';
      return stemTail.length >= 6 && tokens.some(token => token.endsWith(stemTail) || stemTail.endsWith(token));
    });
  });
  if (!found) return null;
  const candidates = [
    found.path,
    found.relativePath ? path.join(paths.imageRoot(), found.relativePath) : '',
    found.kind === 'input' && found.filename ? path.join(paths.imageInputDir(), found.filename) : '',
    found.kind === 'output' && found.filename ? path.join(paths.imageOutputDir(), found.filename) : '',
  ].filter(Boolean);
  const fullPath = candidates.find(item => fs.existsSync(item));
  return fullPath ? { ...found, fullPath } : null;
}

function mimeForMarkdownImage(image = {}) {
  const explicit = String(image.mime || image.mimetype || image.contentType || '').trim().toLowerCase();
  if (explicit.startsWith('image/')) return explicit;
  const ext = path.extname(String(image.fullPath || image.filename || image.originalName || '')).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.jfif') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.bmp') return 'image/bmp';
  return 'image/png';
}

function imageDataUrlForMarkdownImage(image = {}) {
  if (!image || !image.fullPath || !fs.existsSync(image.fullPath)) return '';
  if (!mimeForMarkdownImage(image).startsWith('image/')) return '';
  const buffer = fs.readFileSync(image.fullPath);
  return `data:${mimeForMarkdownImage(image)};base64,${buffer.toString('base64')}`;
}

function markdownImageDataUrlFromSrc(src = '') {
  const value = String(src || '').trim();
  if (!value) return value;
  if (/^data:image\//i.test(value)) return value;
  const image = resolveWebuiImageForMarkdown(value);
  if (!image) return value;
  return imageDataUrlForMarkdownImage(image) || value;
}

function embedWebuiMarkdownImages(content = '') {
  return String(content || '').replace(/!\[([^\]\r\n]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (match, alt, src) => {
    const dataUrl = markdownImageDataUrlFromSrc(src);
    if (!dataUrl || dataUrl === src) return match;
    return `![${String(alt || '').replace(/[\]\n\r]/g, ' ')}](${dataUrl})`;
  });
}

function compactMarkdownImagePreview(markdown = '') {
  return String(markdown || '').replace(/\(data:image\/[^;]+;base64,[^)]+\)/gi, match => {
    return match.length > 96 ? `(data:image/...;base64,${match.length} chars)` : match;
  });
}

function resolveMarkdownLibraryPath(inputPath = '', { mustExist = false } = {}) {
  const mdRoot = path.resolve(paths.mdLibraryRoot());
  const raw = String(inputPath || '').trim();
  if (!raw) throw new Error('markdown path is required');
  const normalizedRaw = raw.replace(/\\/g, '/');
  let fullPath = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(mdRoot, normalizedRaw.replace(/^\/+/, ''));
  const markers = ['/output-md/', 'output-md/'];
  const lowerRaw = normalizedRaw.toLowerCase();
  const remapFromOutputMdMarker = () => {
    for (const marker of markers) {
      const idx = lowerRaw.lastIndexOf(marker);
      if (idx >= 0) {
        const rel = normalizedRaw.slice(idx + marker.length);
        fullPath = path.resolve(mdRoot, rel.replace(/^\/+/, ''));
        return true;
      }
    }
    return false;
  };
  if (!isInsidePath(mdRoot, fullPath)) remapFromOutputMdMarker();
  else if (!fs.existsSync(fullPath) && lowerRaw.includes('output-md/')) remapFromOutputMdMarker();
  if (!isInsidePath(mdRoot, fullPath)) throw new Error('invalid markdown path: ' + raw);
  if (!/\.md$/i.test(fullPath)) fullPath += '.md';
  if (!isInsidePath(mdRoot, fullPath)) throw new Error('invalid markdown path: ' + raw);
  if (mustExist && !fs.existsSync(fullPath)) throw new Error('target markdown not found: ' + raw);
  const relPath = path.relative(mdRoot, fullPath).replace(/\\/g, '/');
  return { mdRoot, fullPath, relPath };
}

function insertMarkdownImageLine(content = '', markdownLine = '', position = 'append') {
  const value = String(content || '');
  const line = String(markdownLine || '').trim();
  const mode = String(position || 'append').toLowerCase();
  if (mode === 'top' || mode === 'start' || mode === 'prepend' || mode === 'before') {
    return line + '\n\n' + value.replace(/^\uFEFF/, '');
  }
  return value.trimEnd() + '\n\n' + line + '\n';
}

function parseWebuiMarkdownInsertImageToolCall(text = '') {
  const raw = String(text || '').trim();
  const normalize = (args, sourceText) => {
    const pathValue = String(args?.path || args?.documentPath || args?.targetPath || '').trim();
    const imageId = String(args?.imageId || args?.imageID || args?.imageUrl || args?.url || args?.src || '').trim();
    if (!pathValue || !imageId) return null;
    const normalizedPath = pathValue.replace(/\\/g, '/');
    const isWinAbsolute = /^[A-Za-z]:\//.test(normalizedPath);
    const isAbsolute = isWinAbsolute || path.isAbsolute(pathValue);
    let targetPath;
    if (isAbsolute || normalizedPath.toLowerCase().includes('/output-md/')) {
      targetPath = pathValue;
    } else {
      targetPath = normalizedPath.replace(/^\/+/, '');
      if (!/\.md$/i.test(targetPath)) targetPath += '.md';
      targetPath = targetPath.split('/').map(part => safeName(part) || 'document').join('/');
    }
    return {
      path: targetPath,
      imageId,
      alt: String(args?.alt || args?.caption || args?.title || 'image').trim() || 'image',
      position: String(args?.position || 'append').trim().toLowerCase(),
      raw: sourceText || raw,
    };
  };
  const fnMatch = raw.match(/webui_markdown_insert_image\s*\(\s*({[\s\S]*?})\s*\)/m);
  if (fnMatch) {
    try { const parsed = normalize(JSON.parse(fnMatch[1]), fnMatch[0]); if (parsed) return parsed; } catch (_) {}
  }
  const jsonMatch = raw.match(/({[\s\S]*"(?:imageId|imageUrl|documentPath|targetPath)"[\s\S]*})/m);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const type = String(data?.type || data?.tool || data?.name || '').toLowerCase();
      if (type.includes('webui_markdown_insert_image')) return normalize(data, jsonMatch[1]);
    } catch (_) {}
  }
  return null;
}

async function runWebuiMarkdownInsertImageFallback({ call, res, toolCalls }) {
  const startedAt = Date.now();
  const toolName = 'webui_markdown_insert_image';
  toolCalls.push({ type:'tool', event_type:'tool.started', name: toolName, args: call, preview: call.raw || '', done:false, startedAt });
  sseWrite(res, 'tool', { event_type:'tool.started', name: toolName, preview: redactSecrets(call.raw || ''), args: sanitizeAny(call) });
  try {
    const { fullPath, relPath } = resolveMarkdownLibraryPath(call.path, { mustExist: true });
    const image = resolveWebuiImageForMarkdown(call.imageId);
    if (!image) throw new Error('image not found: ' + call.imageId);
    const dataUrl = imageDataUrlForMarkdownImage(image);
    if (!dataUrl) throw new Error('image cannot be embedded: ' + call.imageId);
    const markdownLine = `![${call.alt.replace(/[\]\n\r]/g, ' ')}](${dataUrl})`;
    const current = fs.readFileSync(fullPath, 'utf8');
    const next = insertMarkdownImageLine(current, markdownLine, call.position);
    fs.writeFileSync(fullPath, next, 'utf8');
    const payload = { success:true, type:'webui_markdown_insert_image_result', path: relPath, embedded:true, imagePath:'', fullImagePath: image.fullPath, fullPath, markdown: markdownLine, position: call.position || 'append' };
    const preview = JSON.stringify({ ...payload, markdown: compactMarkdownImagePreview(markdownLine), dataUrlLength: dataUrl.length });
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === toolName) { toolCalls[i].done = true; toolCalls[i].is_error = false; toolCalls[i].duration = Date.now() - startedAt; toolCalls[i].preview = preview; break; }
    }
    sseWrite(res, 'tool_complete', { event_type:'tool.completed', name: toolName, preview: redactSecrets(preview), is_error:false, duration: Date.now() - startedAt });
    return { ok:true, content:`Embedded image into ${payload.path}\n\n${compactMarkdownImagePreview(markdownLine)}`, payload };
  } catch (error) {
    const preview = error.message || 'markdown insert image failed';
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === toolName) { toolCalls[i].done = true; toolCalls[i].is_error = true; toolCalls[i].duration = Date.now() - startedAt; toolCalls[i].preview = preview; break; }
    }
    sseWrite(res, 'tool_complete', { event_type:'tool.completed', name: toolName, preview: redactSecrets(preview), is_error:true, duration: Date.now() - startedAt });
    return { ok:false, error: preview };
  }
}

function parseWebuiMarkdownTextToolCall(text = '') {
  const raw = String(text || '').trim();
  const normalize = (args, sourceText) => {
    const content = String(args?.content || args?.markdown || args?.body || '').trim();
    if (!content) return null;
    const title = String(args?.title || args?.name || '\u8f93\u51fa\u6587\u6863').trim().slice(0, 80) || '\u8f93\u51fa\u6587\u6863';
    let relPath = String(args?.path || args?.relativePath || '').trim();
    if (!relPath) relPath = safeName(title) + '.md';
    relPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!/\.md$/i.test(relPath)) relPath += '.md';
    relPath = relPath.split('/').map(part => safeName(part) || 'document').join('/');
    return { title, path: relPath, content, raw: sourceText || raw };
  };

  const fnMatch = raw.match(/webui_(?:markdown_create|markdown_write|file_write)\s*\(\s*({[\s\S]*?})\s*\)/m);
  if (fnMatch) {
    try {
      const parsed = normalize(JSON.parse(fnMatch[1]), fnMatch[0]);
      if (parsed) return parsed;
    } catch (_) {}
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) candidates.push(fenced[1].trim());
  if (raw.startsWith('{') && raw.endsWith('}')) candidates.push(raw);
  const jsonMatch = raw.match(/({[\s\S]*"(?:content|markdown|body)"[\s\S]*})/m);
  if (jsonMatch) candidates.push(jsonMatch[1]);
  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate);
      const type = String(data?.type || data?.tool || data?.name || '').toLowerCase();
      if (!type || (!type.includes('webui_markdown') && !type.includes('webui_file_write'))) continue;
      const parsed = normalize(data, candidate);
      if (parsed) return parsed;
    } catch (_) {}
  }
  return null;
}


function readableTextFileRoots() {
  return [
    paths.dataRoot(),
    paths.memoryRoot(),
    paths.mdLibraryRoot(),
  ].map(item => path.resolve(item)).filter(Boolean);
}

function resolveReadableWebuiFilePath(inputPath = '') {
  const raw = String(inputPath || '').trim();
  if (!raw) throw new Error('file path is required');
  let fullPath;
  if (/\.md$/i.test(raw) || raw.replace(/\\/g, '/').toLowerCase().includes('output-md/')) {
    try { fullPath = resolveMarkdownLibraryPath(raw, { mustExist: true }).fullPath; } catch (_) {}
  }
  if (!fullPath) {
    const normalizedRaw = raw.replace(/\\/g, '/');
    fullPath = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(paths.mdLibraryRoot(), normalizedRaw.replace(/^\/+/, ''));
    if (!fs.existsSync(fullPath) && normalizedRaw.toLowerCase().includes('output-md/')) {
      const idx = normalizedRaw.toLowerCase().lastIndexOf('output-md/');
      if (idx >= 0) fullPath = path.resolve(paths.mdLibraryRoot(), normalizedRaw.slice(idx + 'output-md/'.length).replace(/^\/+/, ''));
    }
  }
  const roots = readableTextFileRoots();
  if (!roots.some(root => isInsidePath(root, fullPath))) throw new Error('file path not allowed: ' + raw);
  if (!fs.existsSync(fullPath)) throw new Error('file not found: ' + raw);
  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) throw new Error('not a file: ' + raw);
  if (stat.size > 1024 * 1024) throw new Error('file too large (max 1MB): ' + raw);
  const ext = path.extname(fullPath).toLowerCase();
  if (!['.md','.txt','.json','.yaml','.yml','.log'].includes(ext)) throw new Error('unsupported file type: ' + ext);
  return { fullPath, size: stat.size, mtime: stat.mtimeMs };
}

function parseWebuiFileReadToolCall(text = '') {
  const raw = String(text || '').trim();
  const normalize = (args, sourceText) => {
    const pathValue = String(args?.path || args?.file || args?.filePath || args?.targetPath || '').trim();
    if (!pathValue) return null;
    return { path: pathValue, raw: sourceText || raw };
  };
  const fnMatch = raw.match(/webui_file_read\s*\(\s*({[\s\S]*?})\s*\)/m);
  if (fnMatch) {
    try { const parsed = normalize(JSON.parse(fnMatch[1]), fnMatch[0]); if (parsed) return parsed; } catch (_) {}
  }
  const codeMatch = raw.match(/<tool_code>\s*([\s\S]*?)\s*<\/tool_code>/i);
  if (codeMatch) {
    const parsed = parseWebuiFileReadToolCall(codeMatch[1]);
    if (parsed) return parsed;
  }
  const jsonMatch = raw.match(/({[\s\S]*"(?:path|filePath|targetPath)"[\s\S]*})/m);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const type = String(data?.type || data?.tool || data?.name || '').toLowerCase();
      if (type.includes('webui_file_read')) return normalize(data, jsonMatch[1]);
    } catch (_) {}
  }
  return null;
}

async function runWebuiFileReadFallback({ call, res, toolCalls }) {
  const startedAt = Date.now();
  const toolName = 'webui_file_read';
  toolCalls.push({ type:'tool', event_type:'tool.started', name: toolName, args: call, preview: call.raw || '', done:false, startedAt });
  sseWrite(res, 'tool', { event_type:'tool.started', name: toolName, preview: redactSecrets(call.raw || ''), args: sanitizeAny(call) });
  try {
    const { fullPath, size, mtime } = resolveReadableWebuiFilePath(call.path);
    const content = fs.readFileSync(fullPath, 'utf8');
    const payload = { success:true, type:'webui_file_read_result', path: fullPath, size, mtime, content };
    const preview = JSON.stringify({ ...payload, content: content.slice(0, 2000) });
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === toolName) { toolCalls[i].done = true; toolCalls[i].is_error = false; toolCalls[i].duration = Date.now() - startedAt; toolCalls[i].preview = preview; break; }
    }
    sseWrite(res, 'tool_complete', { event_type:'tool.completed', name: toolName, preview: redactSecrets(preview), is_error:false, duration: Date.now() - startedAt });
    return { ok:true, content, payload };
  } catch (error) {
    const preview = error.message || 'file read failed';
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === toolName) { toolCalls[i].done = true; toolCalls[i].is_error = true; toolCalls[i].duration = Date.now() - startedAt; toolCalls[i].preview = preview; break; }
    }
    sseWrite(res, 'tool_complete', { event_type:'tool.completed', name: toolName, preview: redactSecrets(preview), is_error:true, duration: Date.now() - startedAt });
    return { ok:false, error: preview };
  }
}

async function runWebuiMarkdownTextToolFallback({ call, res, toolCalls }) {
  const startedAt = Date.now();
  const toolEvent = { type: 'tool', event_type: 'tool.started', name: 'webui_markdown_create', args: call, preview: call.raw || '' };
  if (!call.__skipToolStart) {
    toolCalls.push({ ...sanitizeAny(toolEvent), done: false, startedAt });
    sseWrite(res, 'tool', {
      event_type: toolEvent.event_type,
      name: toolEvent.name,
      preview: redactSecrets(toolEvent.preview),
      args: sanitizeAny(toolEvent.args),
    });
  }
  try {
    const { fullPath, relPath } = resolveMarkdownLibraryPath(call.path);
    const embeddedContent = embedWebuiMarkdownImages(call.content);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, embeddedContent, 'utf8');
    const stats = fs.statSync(fullPath);
    const payload = {
      success: true,
      type: 'webui_markdown_create_result',
      title: call.title,
      path: relPath,
      fullPath,
      size: stats.size,
      mtime: stats.mtimeMs,
      artifact: `<artifact type="markdown" title="${call.title.replace(/"/g, '&quot;')}">\n${embeddedContent}\n</artifact>`,
    };
    const preview = JSON.stringify({ ...payload, artifact: compactMarkdownImagePreview(payload.artifact) });
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && (toolCalls[i].name === 'webui_markdown_create' || toolCalls[i].name === 'webui_markdown_write' || toolCalls[i].name === 'webui_file_write')) {
        toolCalls[i].done = true;
        toolCalls[i].is_error = false;
        toolCalls[i].duration = Date.now() - startedAt;
        toolCalls[i].preview = preview;
        break;
      }
    }
    sseWrite(res, 'tool_complete', {
      event_type: 'tool.completed',
      name: 'webui_markdown_create',
      preview: redactSecrets(preview),
      is_error: false,
      duration: Date.now() - startedAt,
    });
    return { ok: true, content: payload.artifact, payload };
  } catch (error) {
    const preview = error.message || 'markdown create failed';
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && (toolCalls[i].name === 'webui_markdown_create' || toolCalls[i].name === 'webui_markdown_write' || toolCalls[i].name === 'webui_file_write')) {
        toolCalls[i].done = true;
        toolCalls[i].is_error = true;
        toolCalls[i].duration = Date.now() - startedAt;
        toolCalls[i].preview = preview;
        break;
      }
    }
    sseWrite(res, 'tool_complete', {
      event_type: 'tool.completed',
      name: 'webui_markdown_create',
      preview: redactSecrets(preview),
      is_error: true,
      duration: Date.now() - startedAt,
    });
    return { ok: false, error: preview };
  }
}

async function runWebuiImageTextToolFallback({ call, chatId, userMsgId, assistantMsgId, req, res, toolCalls }) {
  const startedAt = Date.now();
  const toolEvent = { type: 'tool', event_type: 'tool.started', name: 'webui_image_generate', args: call, preview: call.raw || '' };
  if (!call.__skipToolStart) {
    toolCalls.push({ ...sanitizeAny(toolEvent), done: false, startedAt });
    sseWrite(res, 'tool', {
      event_type: toolEvent.event_type,
      name: toolEvent.name,
      preview: redactSecrets(toolEvent.preview),
      args: sanitizeAny(toolEvent.args),
    });
  }
  sseWrite(res, 'perf', { stage: 'webui-image-text-tool-fallback-start' });
  const progressTimer = setInterval(() => {
    try {
      const elapsedMs = Date.now() - startedAt;
      sseWrite(res, 'perf', {
        stage: 'webui-image-text-tool-fallback-running',
        elapsedMs,
      });
      sseWrite(res, 'tool_running', {
        event_type: 'tool.running',
        name: 'webui_image_generate',
        preview: call.raw || call.prompt || '',
        elapsedMs,
      });
    } catch (_) {}
  }, 10000);
  try {
    const requestAttachmentIds = pendingAttachmentIdsFromReq(req);
    const attachmentIds = Array.isArray(call.attachmentIds) && call.attachmentIds.length
      ? call.attachmentIds.map(String).filter(Boolean)
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
    return { ok: true, content: data.content || payload.markdown || '视频已生成', payload };
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


async function runWebuiVideoTextToolFallback({ call, chatId, userMsgId, assistantMsgId, req, res, toolCalls }) {
  const startedAt = Date.now();
  const toolEvent = { type: 'tool', event_type: 'tool.started', name: 'webui_video_generate', args: call, preview: call.raw || '' };
  if (!call.__skipToolStart) {
    toolCalls.push({ ...sanitizeAny(toolEvent), done: false, startedAt });
    sseWrite(res, 'tool', { event_type: toolEvent.event_type, name: toolEvent.name, preview: redactSecrets(toolEvent.preview), args: sanitizeAny(toolEvent.args) });
  }
  const progressTimer = setInterval(() => {
    try {
      const elapsedMs = Date.now() - startedAt;
      sseWrite(res, 'tool_running', { event_type: 'tool.running', name: 'webui_video_generate', preview: call.raw || call.prompt || '', elapsedMs });
    } catch (_) {}
  }, 10000);
  try {
    const requestAttachmentIds = pendingAttachmentIdsFromReq(req);
    const attachmentIds = Array.isArray(call.attachmentIds) && call.attachmentIds.length
      ? call.attachmentIds.map(String).filter(Boolean)
      : requestAttachmentIds;
    const data = await generateVideoFromPrompt({
      prompt: call.prompt,
      sourcePrompt: call.sourcePrompt || call.prompt,
      attachmentIds,
      model: call.model || 'auto',
      size: call.size || '1024x1024',
      seconds: videoSecondsFromText(call.__userText || call.sourcePrompt || call.raw || '') || call.seconds || 5,
      chatId: '',
      publicBase: '',
      userMsgId,
      assistantMsgId,
    });
    clearInterval(progressTimer);
    const payload = webuiVideoToolResultPayload(data);
    const preview = JSON.stringify(payload);
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === 'webui_video_generate') {
        toolCalls[i].done = true; toolCalls[i].is_error = false; toolCalls[i].duration = Date.now() - startedAt; toolCalls[i].preview = preview; break;
      }
    }
    sseWrite(res, 'tool_complete', { event_type: 'tool.completed', name: 'webui_video_generate', preview: redactSecrets(preview), is_error: false, duration: Date.now() - startedAt });
    return { ok: true, content: data.content || payload.markdown || '视频已生成', payload };
  } catch (error) {
    clearInterval(progressTimer);
    const preview = error.message || 'video generation failed';
    for (let i = toolCalls.length - 1; i >= 0; i--) {
      if (!toolCalls[i].done && toolCalls[i].name === 'webui_video_generate') {
        toolCalls[i].done = true; toolCalls[i].is_error = true; toolCalls[i].duration = Date.now() - startedAt; toolCalls[i].preview = preview; break;
      }
    }
    sseWrite(res, 'tool_complete', { event_type: 'tool.completed', name: 'webui_video_generate', preview: redactSecrets(preview), is_error: true, duration: Date.now() - startedAt });
    return { ok: false, error: preview };
  }
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function makeTraceId(prefix = 'tr') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 8);
}

function requestTraceId(req, fallbackPrefix = 'tr') {
  const raw = String(req?.body?.traceId || '').trim();
  return raw || makeTraceId(fallbackPrefix);
}

function toolEventName(event = {}, fallback = '') {
  return String(
    event?.name ||
    event?.tool ||
    event?.tool_name ||
    event?.toolName ||
    event?.server ||
    event?.id ||
    fallback ||
    ''
  ).trim();
}

function agentSessionId(event = {}) {
  return String(event?.hermesSessionId || event?.sessionId || event?.session_id || '').trim();
}

function hermesSessionPayload(sessionId = '') {
  const sid = String(sessionId || '').trim();
  return { sessionId: sid, session_id: sid, hermesSessionId: sid };
}

function normalizeToolEvent(event = {}, fallback = 'tool') {
  const clean = sanitizeAny(event) || {};
  const args = clean.args !== undefined ? clean.args : (clean.input !== undefined ? clean.input : (clean.params !== undefined ? clean.params : {}));
  const preview = clean.preview !== undefined ? clean.preview : (clean.output || clean.result || clean.content || clean.text || '');
  return { ...clean, name: toolEventName(clean, fallback) || 'tool', args, preview };
}

function completeToolEvent(toolCalls = [], event = {}) {
  const toolEvent = normalizeToolEvent(event);
  let matched = false;
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const existingName = toolEventName(toolCalls[i], 'tool') || 'tool';
    if (!toolCalls[i].done && (existingName === toolEvent.name || existingName === 'tool' || toolEvent.name === 'tool')) {
      toolCalls[i].done = true;
      toolCalls[i].is_error = toolEvent.is_error;
      toolCalls[i].duration = toolEvent.duration;
      toolCalls[i].preview = toolEvent.preview || toolCalls[i].preview || '';
      if (existingName === 'tool' && toolEvent.name !== 'tool') toolCalls[i].name = toolEvent.name;
      matched = true;
      break;
    }
  }
  if (!matched) toolCalls.push({ ...toolEvent, done: true, startedAt: Date.now() });
  return toolEvent;
}

function runningToolSnapshots(toolCalls = []) {
  const now = Date.now();
  return toolCalls
    .filter(tool => tool && !tool.done)
    .map(tool => ({
      event_type: 'tool.running',
      name: toolEventName(tool, 'tool') || 'tool',
      preview: redactSecrets(tool.preview || ''),
      elapsedMs: tool.startedAt ? now - tool.startedAt : 0,
    }));
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


router.post('/tools/markdown/insert-image', async (req, res) => {
  const call = {
    path: String(req.body?.path || req.body?.documentPath || '').trim(),
    imageId: String(req.body?.imageId || req.body?.imageUrl || req.body?.url || '').trim(),
    alt: String(req.body?.alt || req.body?.caption || 'image').trim() || 'image',
    position: String(req.body?.position || 'append').trim() || 'append',
    raw: 'api:/tools/markdown/insert-image',
  };
  if (!call.path || !call.imageId) return res.fail('path and imageId are required', 400, 400);
  const toolCalls = [];
  const nullRes = { write() {} };
  const result = await runWebuiMarkdownInsertImageFallback({ call, res: nullRes, toolCalls });
  if (!result.ok) return res.fail(result.error || 'markdown insert image failed', 500, 500);
  res.ok(result.payload);
})

router.post('/tools/markdown/create', async (req, res) => {
  const call = {
    title: String(req.body?.title || req.body?.name || '输出文档').trim().slice(0, 80),
    path: String(req.body?.path || req.body?.relativePath || '').trim(),
    content: String(req.body?.content || req.body?.markdown || req.body?.body || '').trim(),
    raw: 'api:/tools/markdown/create',
  };
  if (!call.content) return res.fail('content is required', 400, 400);
  const toolCalls = [];
  const nullRes = { write() {} };
  const result = await runWebuiMarkdownTextToolFallback({ call, res: nullRes, toolCalls });
  if (!result.ok) return res.fail(result.error || 'markdown create failed', 500, 500);
  res.ok(result.payload);
});;

router.post('/:id/messages', async (req, res) => {
  const perfStart = Date.now();
  const list = loadAll();
  const chat = list.find(c => c.id === req.params.id);
  if (!chat) return res.fail('chat not found', 404, 404);
  const traceId = requestTraceId(req, 'chat');
  const userMsgId = req.body.userMsgId ? String(req.body.userMsgId) : '';
  const assistantMsgId = req.body.assistantMsgId ? String(req.body.assistantMsgId) : '';

  const userMsg = {
    role: 'user',
    content: redactSecrets(String(req.body.displayContent ?? req.body.content ?? '')),
    ts: Date.now(),
  };
  if (userMsgId) userMsg._msgId = userMsgId;
  userMsg.traceId = traceId;
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
  const activeAgentSnapshot = chat.agentSnapshot || normalizeAgentSnapshot(req.body || {});
  const agentMemoryPrompt = readAgentMemoryPrompt(activeAgentSnapshot.id);
  if (toggles.coreMemory) addSystemPart('Agent 独立记忆', agentMemoryPrompt, { source: 'agent-memory', agentId: activeAgentSnapshot.id });
  const agentRulesPrompt = readAgentRulesPrompt({ includeKnowledgeBase: needsKnowledgeBaseRules(userMsg.content) });
  if (toggles.agentRules) addSystemPart('Agent 规则', agentRulesPrompt, { source: 'rules', knowledgeBase: needsKnowledgeBaseRules(userMsg.content) });
  if (toggles.userSystemPrompt) addSystemPart('用户系统提示', settings.systemPrompt, { source: 'settings' });
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
      '3a. For follow-up image requests such as regenerate, redraw, change style, another one, or this is not good, still call webui_image_generate again; never fabricate a Markdown image URL.',
      '4. IMPORTANT: do not call webui_image_generate in video mode; webui_video_generate is the required tool',
    ].join('\n'), { source: 'image-scene' });
  }
  if (requestedScene === 'video') {
    addSystemPart('Video Generation', [
      'You are in VIDEO GENERATION mode. When the user asks for a video, animation, short clip, or motion visual:',
      '1. Analyze and refine the user prompt with subject, motion, camera, style, and duration',
      '2. Immediately call the webui_video_generate tool with the refined prompt',
      '3. Do NOT just output text prompts without calling the tool',
      '4. If the user uploaded reference images, pass their attachmentIds to webui_video_generate. Never omit attachmentIds for image-to-video/reference-video tasks.',
      '5. Preserve the reference image identity, character, composition, color palette, and visual style; only add requested motion/camera movement.',
    ].join('\n'), { source: 'video-scene' });
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
  const heartbeat = setInterval(() => {
    try {
      const runningTools = runningToolSnapshots(toolCalls);
      sseWrite(res, 'heartbeat', { ts: Date.now(), runningTools: runningTools.length });
      runningTools.forEach(tool => sseWrite(res, 'tool_running', tool));
    } catch (_) {
      clearInterval(heartbeat);
    }
  }, 10000);
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
  const requestedRoutingMode = effectiveRoutingModeFromRequest(req.body, chat.agentSnapshot, settingsForMode);
  if (['auto','direct','hermes','agent','fast'].includes(requestedRoutingMode)) cfg.routingMode = requestedRoutingMode;
  if (requestedRoutingMode === 'hermes' || requestedRoutingMode === 'agent') cfg.forceHermes = true;
  if (requestedRoutingMode === 'direct' || requestedRoutingMode === 'fast') cfg.forceDirect = true;
  if (isDocumentOutputIntent(userMsg.content) || requestedScene === 'video' || isVideoOutputIntent(userMsg.content) || requestedScene === 'image' || isImageOutputIntent(userMsg.content)) {
    cfg.routingMode = 'hermes';
    cfg.forceHermes = true;
    cfg.forceDirect = false;
  }
  const requestedAgentRuntime = String(req.body.agentRuntime || 'cli').toLowerCase();
  if (['auto','api','api-server','server','cli','cli-only','hermes-cli'].includes(requestedAgentRuntime)) cfg.agentRuntime = requestedAgentRuntime;
  cfg._scene = requestedScene;
  cfg._webuiRequestedScene = requestedScene;
  cfg._abortSignal = abortController.signal;
  cfg._traceId = traceId;
  cfg._runId = traceId;
  console.log('[AgentRun ' + cfg._runId + '] USER ' + String(userMsg.content || '').replace(/\s+/g, ' ').slice(0, 500));

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

  // ===== Python Bridge mode =====
  console.log('[chat.js] useBridge=' + req.body.useBridge + ' agentRuntime=' + cfg.agentRuntime);
  if (req.body.useBridge || cfg.agentRuntime === 'python-bridge') {
    try {
      await bridge.ensureBridge();
    } catch (e) {
      sseWrite(res, 'error', { msg: 'Bridge start failed: ' + e.message, traceId, userMsgId, assistantMsgId });
      clearInterval(heartbeat);
      res.end();
      return;
    }
    try {
      await bridge.sendChat({
        message: userMsg.content,
        session_id: chat.id,
        onToolStart: (e) => {
          toolCalls.push({ name: e.name, args: e.args, done: false, startedAt: Date.now() });
          sseWrite(res, 'tool', {
            event_type: 'tool.started',
            name: e.name,
            args: sanitizeAny(e.args || {}),
            preview: redactSecrets(JSON.stringify(e.args || {})),
          });
        },
        onToolOutput: (e) => {
          sseWrite(res, 'tool_running', {
            event_type: 'tool.running',
            name: e.name,
            preview: redactSecrets(e.content || ''),
            elapsedMs: Date.now() - (toolCalls.find(tc => tc.name === e.name && !tc.done)?.startedAt || Date.now()),
          });
        },
        onToolComplete: (e) => {
          const tc = toolCalls.find(tc => tc.name === e.name && !tc.done);
          if (tc) { tc.done = true; tc.result = e.result; tc.duration = e.duration; }
          sseWrite(res, 'tool_complete', {
            event_type: 'tool.completed',
            name: e.name,
            preview: redactSecrets(e.result || ''),
            is_error: false,
            duration: parseFloat(e.duration) * 1000 || 0,
          });
        },
        onText: (e) => {
          full += e.content;
          sseWrite(res, 'token', { text: redactSecrets(e.content) });
        },
        onThinking: (e) => {
          if (e.content) {
            reasoningFull += e.content;
            sseWrite(res, 'reasoning', { text: redactSecrets(e.content) });
          }
        },
        onError: (e) => {
          errorFull += (errorFull ? '\n' : '') + e.content;
          sseWrite(res, 'error', { msg: redactSecrets(e.content) });
        },
      });
    } catch (e) {
      if (!abortController.signal.aborted) {
        sseWrite(res, 'error', { msg: e.message, traceId, userMsgId, assistantMsgId });
      }
    } finally {
      // Save assistant message
      if (full || reasoningFull || toolCalls.length) {
        const doneEvent = { type: 'done', sessionId: sessionIdFromDone };
        if (agentSessionId && typeof agentSessionId === 'function') sessionIdFromDone = agentSessionId(doneEvent) || sessionIdFromDone;
        if (sessionIdFromDone) {
          markWebuiHermesSession(sessionIdFromDone, chat.id);
        }
        chat.messages.push({
          role: 'assistant',
          content: full,
          reasoning: reasoningFull || undefined,
          thinking: reasoningFull || undefined,
          toolCalls: toolCalls.length ? toolCalls : undefined,
          ts: Date.now(),
          hermesSessionId: sessionIdFromDone || undefined,
        });
        const chatList = loadAll();
        const chatIdx = chatList.findIndex(c => c.id === chat.id);
        if (chatIdx >= 0) chatList[chatIdx] = chat;
        else chatList.push(chat);
        saveAll(chatList);
        autoCaptureKnowledge(chat, userMsg, full);
      }
      sseWrite(res, 'done', {});
      clearInterval(heartbeat);
      res.end();
    }
    return;
  }

  try {
    for await (const event of chatStream(cfg, contextMessages)) {
      if (abortController.signal.aborted) break;
      if (event.type === 'perf') {
        if (event.stage === 'route-selected') {
          selectedRoute = event.route || '';
          selectedRouteReason = event.reason || '';
        }
        sseWrite(res, 'perf', { traceId, userMsgId, assistantMsgId, ...event });
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
          {
            const toolEvent = normalizeToolEvent(event);
            toolCalls.push({ ...toolEvent, done: false, startedAt: Date.now() });
            sseWrite(res, 'tool', {
              event_type: toolEvent.event_type,
              name: toolEvent.name,
              preview: redactSecrets(toolEvent.preview),
              args: sanitizeAny(toolEvent.args),
            });
          }
          break;

        case 'tool_complete':
          {
            const toolEvent = completeToolEvent(toolCalls, event);
            sseWrite(res, 'tool_complete', {
              event_type: toolEvent.event_type,
              name: toolEvent.name,
              preview: redactSecrets(toolEvent.preview),
              is_error: toolEvent.is_error,
              duration: toolEvent.duration,
            });
          }
          break;

        case 'tool_running':
          {
            const toolEvent = normalizeToolEvent(event);
            sseWrite(res, 'tool_running', {
              event_type: toolEvent.event_type,
              name: toolEvent.name,
              preview: redactSecrets(toolEvent.preview || ''),
              elapsedMs: toolEvent.elapsedMs || 0,
            });
          }
          break;

        case 'agent_step':
          sseWrite(res, 'agent_step', {
            phase: event.phase || '',
            status: event.status || 'running',
            title: redactSecrets(event.title || ''),
            detail: redactSecrets(event.detail || ''),
            raw: redactSecrets(event.raw || ''),
            error: !!event.error,
          });
          break;

        case 'heartbeat':
          sseWrite(res, 'heartbeat', { ts: event.ts || Date.now(), runningTools: runningToolSnapshots(toolCalls).length });
          break;

        case 'raw_line':
          if (process.env.HERMES_EXPOSE_RAW_STDOUT === '1') {
            sseWrite(res, 'agent_raw', {
              runId: event.runId || cfg._runId || '',
              stream: 'stdout',
              text: redactSecrets(event.text || ''),
              ts: event.ts || Date.now(),
              rawType: event.type || 'raw_line',
            });
          }
          break;
        case 'raw_stderr':
        case 'agent_raw':
          sseWrite(res, 'agent_raw', {
            runId: event.runId || cfg._runId || '',
            stream: event.stream || (event.type === 'raw_stderr' ? 'stderr' : 'stdout'),
            text: redactSecrets(event.text || ''),
            ts: event.ts || Date.now(),
            rawType: event.type || 'agent_raw',
          });
          break;

        case 'agent_exit':
          sseWrite(res, 'agent_exit', {
            runId: event.runId || cfg._runId || '',
            code: event.code,
            meaningfulStdout: !!event.meaningfulStdout,
            stderrTail: redactSecrets(event.stderrTail || ''),
            ms: event.ms || 0,
          });
          if (!event.meaningfulStdout) {
            appendSystemLog({ type: 'task', level: 'warn', msg: 'Hermes process exited without meaningful stdout', chatId: chat.id, runId: event.runId || cfg._runId || '', exitCode: event.code, stderrTail: redactSecrets(event.stderrTail || '') });
          }
          break;

        case 'title':
          sseWrite(res, 'title', { title: event.title, session_id: chat.id });
          if (event.title) chat.title = event.title;
          break;

        case 'session':
          if (agentSessionId(event)) sessionIdFromDone = agentSessionId(event);
          sseWrite(res, 'perf', { traceId, userMsgId, assistantMsgId, stage: 'hermes-session', ...hermesSessionPayload(sessionIdFromDone) });
          break;

        case 'error':
          {
            const safeText = redactSecrets(event.text || '未知错误');
            errorFull += (errorFull ? '\n' : '') + safeText;
            sseWrite(res, 'error', { msg: safeText, traceId, userMsgId, assistantMsgId });
          }
          break;

        case 'done':
          if (agentSessionId(event)) sessionIdFromDone = agentSessionId(event);
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
          const toolEvent = normalizeToolEvent(followEvent);
          toolCalls.push({ ...toolEvent, done: false, startedAt: Date.now() });
          sseWrite(res, 'tool', { event_type: toolEvent.event_type, name: toolEvent.name, preview: redactSecrets(toolEvent.preview), args: sanitizeAny(toolEvent.args) });
        } else if (followEvent.type === 'tool_complete') {
          const toolEvent = completeToolEvent(toolCalls, followEvent);
          sseWrite(res, 'tool_complete', { event_type: toolEvent.event_type, name: toolEvent.name, preview: redactSecrets(toolEvent.preview), is_error: toolEvent.is_error, duration: toolEvent.duration });
        } else if (followEvent.type === 'tool_running') {
          const toolEvent = normalizeToolEvent(followEvent);
          sseWrite(res, 'tool_running', { event_type: toolEvent.event_type, name: toolEvent.name, preview: redactSecrets(toolEvent.preview || ''), elapsedMs: toolEvent.elapsedMs || 0 });
        } else if (followEvent.type === 'agent_step') {
          sseWrite(res, 'agent_step', {
            phase: followEvent.phase || '',
            status: followEvent.status || 'running',
            title: redactSecrets(followEvent.title || ''),
            detail: redactSecrets(followEvent.detail || ''),
            raw: redactSecrets(followEvent.raw || ''),
            error: !!followEvent.error,
          });
        } else if (followEvent.type === 'session') {
          if (agentSessionId(followEvent)) sessionIdFromDone = agentSessionId(followEvent);
          sseWrite(res, 'perf', { traceId, userMsgId, assistantMsgId, stage: 'hermes-session', ...hermesSessionPayload(sessionIdFromDone) });
        } else if (followEvent.type === 'error') {
          const safeText = redactSecrets(followEvent.text || '未知错误');
          errorFull += (errorFull ? '\n' : '') + safeText;
          sseWrite(res, 'error', { msg: safeText, traceId, userMsgId, assistantMsgId });
        } else if (followEvent.type === 'done') {
          if (agentSessionId(followEvent)) sessionIdFromDone = agentSessionId(followEvent);
        }
      }
    }

    const fileReadCall = parseWebuiFileReadToolCall(full);
    if (fileReadCall && !toolCalls.some(item => item.name === 'webui_file_read')) {
      const readResult = await runWebuiFileReadFallback({ call: fileReadCall, res, toolCalls });
      if (readResult.ok) {
        full = '';
        errorFull = '';
        const readFollowupMessages = [
          ...contextMessages,
          { role: 'assistant', content: '[WebUI ?????????]' },
          { role: 'user', content: [
            'webui_file_read ?????',
            'path: ' + readResult.payload.path,
            'content:',
            readResult.content,
            '',
            '????????????????????????????????????? WebUI ???????????????'
          ].join('\n') },
        ];
        for await (const followEvent of chatStream(cfg, readFollowupMessages)) {
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
            const toolEvent = normalizeToolEvent(followEvent);
            toolCalls.push({ ...toolEvent, done: false, startedAt: Date.now() });
            sseWrite(res, 'tool', { event_type: toolEvent.event_type, name: toolEvent.name, preview: redactSecrets(toolEvent.preview), args: sanitizeAny(toolEvent.args) });
          } else if (followEvent.type === 'tool_complete') {
            const toolEvent = completeToolEvent(toolCalls, followEvent);
            sseWrite(res, 'tool_complete', { event_type: toolEvent.event_type, name: toolEvent.name, preview: redactSecrets(toolEvent.preview), is_error: toolEvent.is_error, duration: toolEvent.duration });
          } else if (followEvent.type === 'tool_running') {
            const toolEvent = normalizeToolEvent(followEvent);
            sseWrite(res, 'tool_running', { event_type: toolEvent.event_type, name: toolEvent.name, preview: redactSecrets(toolEvent.preview || ''), elapsedMs: toolEvent.elapsedMs || 0 });
          } else if (followEvent.type === 'agent_step') {
            sseWrite(res, 'agent_step', {
              phase: followEvent.phase || '',
              status: followEvent.status || 'running',
              title: redactSecrets(followEvent.title || ''),
              detail: redactSecrets(followEvent.detail || ''),
              raw: redactSecrets(followEvent.raw || ''),
              error: !!followEvent.error,
            });
          } else if (followEvent.type === 'session') {
            if (agentSessionId(followEvent)) sessionIdFromDone = agentSessionId(followEvent);
            sseWrite(res, 'perf', { traceId, userMsgId, assistantMsgId, stage: 'hermes-session', ...hermesSessionPayload(sessionIdFromDone) });
          } else if (followEvent.type === 'error') {
            const safeText = redactSecrets(followEvent.text || '????');
            errorFull += (errorFull ? '\n' : '') + safeText;
            sseWrite(res, 'error', { msg: safeText, traceId, userMsgId, assistantMsgId });
          } else if (followEvent.type === 'done') {
            if (agentSessionId(followEvent)) sessionIdFromDone = agentSessionId(followEvent);
          }
        }
      } else {
        errorFull = readResult.error || 'file read failed';
      }
    }

    const insertImageCall = parseWebuiMarkdownInsertImageToolCall(full);
    if (insertImageCall && !toolCalls.some(item => item.name === 'webui_markdown_insert_image')) {
      const fallback = await runWebuiMarkdownInsertImageFallback({ call: insertImageCall, res, toolCalls });
      if (fallback.ok) { full = fallback.content || full.replace(insertImageCall.raw, '').trim(); errorFull = ''; }
      else { errorFull = fallback.error || 'markdown insert image failed'; }
    }

    const pendingMarkdownTool = toolCalls.find(item => ['webui_markdown_create', 'webui_markdown_write', 'webui_file_write'].includes(item.name) && !item.done);
    if (pendingMarkdownTool) {
      let pendingArgs = pendingMarkdownTool.args || pendingMarkdownTool.preview || {};
      if (typeof pendingArgs === 'string') {
        try { pendingArgs = JSON.parse(pendingArgs); } catch (_) { pendingArgs = parseWebuiMarkdownTextToolCall(pendingArgs) || {}; }
      }
      const pendingCall = parseWebuiMarkdownTextToolCall(JSON.stringify({ ...(pendingArgs || {}), type: pendingMarkdownTool.name })) || pendingArgs;
      if (pendingCall && pendingCall.content) {
        const fallback = await runWebuiMarkdownTextToolFallback({
          call: { ...pendingCall, __skipToolStart: true },
          res,
          toolCalls,
        });
        if (fallback.ok) {
          full = fallback.content || full;
          errorFull = '';
        } else {
          errorFull = fallback.error || 'markdown create failed';
        }
      }
    }

    const pendingImageTool = toolCalls.find(item => item.name === 'webui_image_generate' && !item.done);
    if (pendingImageTool) {
      let pendingArgs = pendingImageTool.args || pendingImageTool.preview || {};
      if (typeof pendingArgs === 'string') {
        try { pendingArgs = JSON.parse(pendingArgs); } catch (_) { pendingArgs = parseWebuiImageTextToolCall(pendingArgs) || { prompt: pendingArgs }; }
      }
      const pendingCall = parseWebuiImageTextToolCall(JSON.stringify(pendingArgs || {})) || pendingArgs;
      if (pendingCall && pendingCall.prompt) {
        const fallback = await runWebuiImageTextToolFallback({
          call: { ...pendingCall, __skipToolStart: true },
          chatId: chat.id,
          userMsgId: req.body.userMsgId ? String(req.body.userMsgId) : '',
          assistantMsgId: req.body.assistantMsgId ? String(req.body.assistantMsgId) : '',
          req,
          res,
          toolCalls,
        });
        if (fallback.ok) {
          full = fallback.content || full;
          errorFull = '';
        } else {
          errorFull = fallback.error || 'image generation failed';
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

    const inferredImageFallbackCall = (!toolCalls.some(item => item.name === 'webui_image_generate' && item.done && !item.is_error) && (requestedScene === 'image' || isImageOutputIntent(userMsg.content) || hasFakeMarkdownImageOutput(full)))
      ? imageFallbackCallFromText(userMsg.content, chat)
      : null;
    if (inferredImageFallbackCall) {
      const fallback = await runWebuiImageTextToolFallback({
        call: inferredImageFallbackCall,
        chatId: chat.id,
        userMsgId: req.body.userMsgId ? String(req.body.userMsgId) : '',
        assistantMsgId: req.body.assistantMsgId ? String(req.body.assistantMsgId) : '',
        req,
        res,
        toolCalls,
      });
      if (fallback.ok) {
        full = fallback.content || '';
        errorFull = '';
      } else {
        errorFull = fallback.error || 'image generation failed';
      }
    }


    const pendingVideoTool = toolCalls.find(item => item.name === 'webui_video_generate' && !item.done);
    if (pendingVideoTool) {
      let pendingArgs = pendingVideoTool.args || pendingVideoTool.preview || {};
      if (typeof pendingArgs === 'string') {
        try { pendingArgs = JSON.parse(pendingArgs); } catch (_) { pendingArgs = parseWebuiVideoTextToolCall(pendingArgs) || { prompt: pendingArgs }; }
      }
      const pendingCall = parseWebuiVideoTextToolCall(JSON.stringify(pendingArgs || {})) || pendingArgs;
      if (pendingCall && pendingCall.prompt) {
        const fallback = await runWebuiVideoTextToolFallback({ call: { ...pendingCall, __skipToolStart: true, __userText: userMsg.content }, chatId: chat.id, userMsgId: req.body.userMsgId ? String(req.body.userMsgId) : '', assistantMsgId: req.body.assistantMsgId ? String(req.body.assistantMsgId) : '', req, res, toolCalls });
        if (fallback.ok) { full = fallback.content || full; errorFull = ''; } else { errorFull = fallback.error || 'video generation failed'; }
      }
    }

    const visibleVideoPendingBeforeFallback = parseVideoPendingTextResult(full);
    const videoFallbackCall = visibleVideoPendingBeforeFallback
      ? null
      : (parseWebuiVideoTextToolCall(full) || ((requestedScene === 'video' || isVideoOutputIntent(userMsg.content)) && !toolCalls.some(item => item.name === 'webui_video_generate') ? videoFallbackCallFromText(userMsg.content) : null));
    if (visibleVideoPendingBeforeFallback) {
      errorFull = '';
    }
    if (videoFallbackCall && !toolCalls.some(item => item.name === 'webui_video_generate' && item.done && !item.is_error)) {
      const fallback = await runWebuiVideoTextToolFallback({ call: { ...videoFallbackCall, __userText: userMsg.content }, chatId: chat.id, userMsgId: req.body.userMsgId ? String(req.body.userMsgId) : '', assistantMsgId: req.body.assistantMsgId ? String(req.body.assistantMsgId) : '', req, res, toolCalls });
      if (fallback.ok) { full = fallback.content || full.replace(videoFallbackCall.raw, '').trim(); errorFull = ''; } else { errorFull = fallback.error || 'video generation failed'; }
    }

    const markdownFallbackCall = parseWebuiMarkdownTextToolCall(full);
    if (markdownFallbackCall && !toolCalls.some(item => ['webui_markdown_create', 'webui_markdown_write', 'webui_file_write'].includes(item.name))) {
      const fallback = await runWebuiMarkdownTextToolFallback({
        call: markdownFallbackCall,
        res,
        toolCalls,
      });
      if (fallback.ok) {
        full = fallback.content || full.replace(markdownFallbackCall.raw, '').trim();
        errorFull = '';
      } else {
        errorFull = fallback.error || 'markdown create failed';
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

    const visibleVideoPending = parseVideoPendingTextResult(assistantContent);
    const videoToolCall = toolCalls.find(item => item.name === 'webui_video_generate' && item.preview);
    if (videoToolCall) {
      try {
        const videoPayload = JSON.parse(String(videoToolCall.preview || ''));
        if (videoPayload?.type === 'webui_video_generate_result' && Array.isArray(videoPayload.outputs)) {
          const videoOutputs = Array.isArray(videoPayload.outputs) ? videoPayload.outputs : [];
          assistantMsg.imageGeneration = {
            status: videoOutputs.length ? 'done' : 'loading',
            mediaType: 'video',
            model: videoPayload.model || '',
            provider: videoPayload.provider || '',
            outputs: videoOutputs,
            inputs: videoPayload.inputs || [],
            prompt: videoPayload.prompt || '',
            sourcePrompt: videoPayload.sourcePrompt || '',
            optimizedPrompt: videoPayload.prompt || '',
            mode: videoPayload.mode || 'text-to-video',
            taskId: videoPayload.taskId || '',
            taskStatus: videoPayload.taskStatus || videoPayload.status || '',
            loadingText: videoOutputs.length ? '' : '\u89c6\u9891\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u6b63\u5728\u7b49\u5f85\u751f\u6210\u7ed3\u679c',
            directMode: false,
          };
        }
      } catch (_) {}
    }
    if (!assistantMsg.imageGeneration && visibleVideoPending) {
      assistantMsg.imageGeneration = {
        status: 'loading',
        mediaType: 'video',
        model: visibleVideoPending.model || '',
        provider: '',
        outputs: [],
        inputs: [],
        prompt: '',
        sourcePrompt: '',
        optimizedPrompt: '',
        mode: 'text-to-video',
        taskId: visibleVideoPending.taskId || '',
        taskStatus: visibleVideoPending.taskStatus || visibleVideoPending.status || '',
        loadingText: '\u89c6\u9891\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u6b63\u5728\u7b49\u5f85\u751f\u6210\u7ed3\u679c',
        directMode: false,
      };
    }
    if (assistantMsgId) assistantMsg._msgId = assistantMsgId;
    assistantMsg.traceId = traceId;
    assistantMsg.userMsgId = userMsgId;
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
    if (sessionIdFromDone) markWebuiHermesSession(sessionIdFromDone, chat.id);
    chat.updatedAt = Date.now();
    if ((chat.title === '新对话' || chat.title === '未命名对话') && userMsg.content) chat.title = userMsg.content.slice(0, 24);
    saveAll(list);
    // Ordinary chats stay in chats.json. Markdown files are written only by explicit export or document tools.
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
      traceId,
      userMsgId,
      assistantMsgId,
      runId: cfg._runId || traceId,
    });

    console.log('[AgentRun ' + (cfg._runId || '') + '] DONE chars=' + full.length + ' tools=' + toolCalls.length);
    sseWrite(res, 'done', {
      chat_session_id: chat.id,
      session_id: sessionIdFromDone || '',
      sessionId: sessionIdFromDone || '',
      hermesSessionId: sessionIdFromDone || '',
      usage: { input_tokens: 0, output_tokens: 0 },
      traceId,
      userMsgId,
      assistantMsgId,
      runId: cfg._runId || traceId,
      perf: { total_ms: Date.now() - perfStart, output_chars: full.length },
    });
  } catch (e) {
    if (abortController.signal.aborted) return;
    const safeText = redactSecrets(e.message || '未知错误');
    sseWrite(res, 'error', { msg: safeText, traceId, userMsgId, assistantMsgId });
    try {
      const errorMsg = { role: 'assistant', content: '错误：' + safeText, ts: Date.now(), error: true };
      if (assistantMsgId) errorMsg._msgId = assistantMsgId;
      errorMsg.traceId = traceId;
      errorMsg.userMsgId = userMsgId;
      if (req.body.localEditContext?.id) errorMsg.localEditContextId = String(req.body.localEditContext.id);
      chat.messages.push(errorMsg);
      chat.updatedAt = Date.now();
      appendSystemLog({ type: 'task', level: 'error', msg: (chat.title || 'chat') + ' · error · ' + (Date.now() - perfStart) + 'ms', chatId: chat.id, title: chat.title || '', route: selectedRoute || '', reason: selectedRouteReason || '', durationMs: Date.now() - perfStart, outputChars: full.length, error: safeText, traceId, userMsgId, assistantMsgId, runId: cfg._runId || traceId });
      saveAll(list);
      // Do not auto-export error messages to chat history Markdown.
    } catch {}
  } finally {
    clearInterval(heartbeat);
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
    try { sseWrite(res, 'heartbeat', { ts: Date.now(), runningTools: 0 }); } catch (_) { clearInterval(heartbeat); }
  }, 10000);
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
    clearInterval(heartbeat);
  });

  const settingsForMode = store.read('settings', {});
  const modelRoot = store.read('models', {});
  const modelScope = settingsForMode.quickMode ? 'webui' : 'agent';
  const cfg = (modelRoot && (modelRoot.webui || modelRoot.agent)) ? (modelRoot[modelScope] || modelRoot.webui || modelRoot.agent || {}) : modelRoot;
  const requestedScene = scene || 'chat';
  const requestedRoutingMode = effectiveRoutingModeFromRequest(req.body, {}, settingsForMode);
  if (['auto','direct','hermes','agent','fast'].includes(requestedRoutingMode)) cfg.routingMode = requestedRoutingMode;
  if (requestedRoutingMode === 'hermes' || requestedRoutingMode === 'agent') cfg.forceHermes = true;
  if (requestedRoutingMode === 'direct' || requestedRoutingMode === 'fast') cfg.forceDirect = true;
  const routeLastMessage = [...messages].reverse().find(m => m && m.role === 'user')?.content || '';
  if (isDocumentOutputIntent(routeLastMessage) || requestedScene === 'video' || isVideoOutputIntent(routeLastMessage)) {
    cfg.routingMode = 'hermes';
    cfg.forceHermes = true;
    cfg.forceDirect = false;
  }
  const requestedAgentRuntime = String(req.body.agentRuntime || 'cli').toLowerCase();
  if (['auto','api','api-server','server','cli','cli-only','hermes-cli'].includes(requestedAgentRuntime)) cfg.agentRuntime = requestedAgentRuntime;
  cfg._scene = requestedScene;
  cfg._webuiRequestedScene = requestedScene;
  cfg._abortSignal = abortController.signal;
  cfg._runId = 'gc_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 8);
  console.log('[AgentRun ' + cfg._runId + '] GC_STREAM messages=' + messages.length);
  const gcAgentSnapshot = normalizeAgentSnapshot(req.body || {});
  const gcAgentMemoryPrompt = readAgentMemoryPrompt(gcAgentSnapshot.id);
  const contextMessages = gcAgentMemoryPrompt
    ? [
        ...messages.slice(0, 1),
        { role: 'system', content: gcAgentMemoryPrompt },
        ...messages.slice(1),
      ]
    : messages;

  try {
    for await (const event of chatStream(cfg, contextMessages)) {
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
    clearInterval(heartbeat);
    res.end();
  }
});
module.exports = router;
