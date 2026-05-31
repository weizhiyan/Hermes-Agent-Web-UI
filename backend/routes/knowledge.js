/**
 * Knowledge Graph API routes — /api/knowledge/*
 */
const express = require('express');
const router = express.Router();
const knowledgeDb = require('../services/knowledgeDb');
const knowledgeAnalyzer = require('../services/knowledgeAnalyzer');
const { parseFrontmatter, summarizeMarkdown, DOC_FOLDERS, LEGACY_DOC_FOLDERS, normalizeDocFolder } = require('../services/knowledgeCapture');
const paths = require('../services/paths');
const store = require('../services/store');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectHermesCommand } = require('../services/hermes');

// --- Junk message filtering ---

const JUNK_PATTERNS = [
  /^(你好|hello|hi|hey|哈喽|嗨)$/i,
  /^(你是谁|你是什么|what\s*(are|is)\s*(you|your)|who\s*are\s*you)$/i,
  /^(what\s*model|你是什么模型|你用的什么模型)/i,
  /^(thanks?|谢谢|感谢|thank\s*you)$/i,
  /^(好的?|ok|okay|嗯|啊|哦|噢|呵)$/i,
  /^(再见|bye|goodbye|拜拜|88)$/i,
  /^[\s\.\,\!\?\-\=\+\*\/\\]+$/,  // pure punctuation
  /^\d+$/,  // pure numbers
];

function isJunkPrompt(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function parseDateRange(query = {}) {
  const now = Math.floor(Date.now() / 1000);
  const range = String(query.range || '30d').toLowerCase();
  if (range === 'all') return {};

  if (query.start || query.end) {
    const result = {};
    if (query.start) {
      const startMs = Date.parse(String(query.start));
      if (!Number.isNaN(startMs)) result.start = Math.floor(startMs / 1000);
    }
    if (query.end) {
      const endValue = String(query.end);
      const endMs = Date.parse(endValue.length <= 10 ? endValue + 'T23:59:59' : endValue);
      if (!Number.isNaN(endMs)) result.end = Math.floor(endMs / 1000);
    }
    return result;
  }

  if (range === '7d') return { start: now - 7 * 24 * 60 * 60 };
  return { start: now - 30 * 24 * 60 * 60 };
}

// GET /api/knowledge/graph — 完整图谱数据
router.get('/graph', (req, res) => {
  try {
    const { category, quality, search } = req.query;
    const data = knowledgeDb.getGraphData({ category, quality, search, ...parseDateRange(req.query) });
    res.ok(data);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/nodes — 列出节点
router.get('/nodes', (req, res) => {
  try {
    const { category, quality, search, limit, offset } = req.query;
    const dateRange = parseDateRange(req.query);
    const nodes = knowledgeDb.listNodes({
      category: category || undefined,
      quality: quality || undefined,
      search: search || undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      ...dateRange,
    });
    const total = knowledgeDb.countNodes({ category, quality, search, ...dateRange });
    res.ok({ nodes, total });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/nodes — 创建节点
router.post('/nodes', (req, res) => {
  try {
    const { title, summary, category, quality, quality_reason, tags, md_path, source, chat_id } = req.body;
    if (!title) return res.fail('title is required');
    const node = knowledgeDb.createNode({ title, summary, category, quality, quality_reason, tags, md_path, source, chat_id });
    res.ok(node);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/nodes/:id — 获取单个节点
router.get('/nodes/:id', (req, res) => {
  try {
    const node = knowledgeDb.getNode(req.params.id);
    if (!node) return res.fail('node not found', 1, 404);
    // If node has md_path, read the markdown content
    if (node.md_path) {
      const mdRoot = paths.mdLibraryRoot();
      const fullPath = path.resolve(mdRoot, node.md_path);
      if (fs.existsSync(fullPath)) {
        node.md_content = fs.readFileSync(fullPath, 'utf8');
      }
    }
    // Get related nodes
    const relations = knowledgeDb.listRelations({ node_id: node.id });
    node.relations = relations;
    res.ok(node);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// PATCH /api/knowledge/nodes/:id — 更新节点
router.patch('/nodes/:id', (req, res) => {
  try {
    const allowed = ['title', 'summary', 'category', 'quality', 'quality_reason', 'tags', 'md_path', 'source', 'chat_id'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const node = knowledgeDb.updateNode(req.params.id, updates);
    if (!node) return res.fail('node not found', 1, 404);
    res.ok(node);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// DELETE /api/knowledge/nodes/:id — 删除节点
router.delete('/nodes/:id', (req, res) => {
  try {
    knowledgeDb.deleteNode(req.params.id);
    res.ok({ deleted: true });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/relations — 列出关系
router.get('/relations', (req, res) => {
  try {
    const { node_id } = req.query;
    const relations = knowledgeDb.listRelations({ node_id: node_id || undefined });
    res.ok(relations);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/relations — 创建关系
router.post('/relations', (req, res) => {
  try {
    const { source_id, target_id, relation_type, strength } = req.body;
    if (!source_id || !target_id) return res.fail('source_id and target_id are required');
    if (source_id === target_id) return res.fail('cannot create self-relation');
    const relation = knowledgeDb.createRelation({ source_id, target_id, relation_type, strength });
    res.ok(relation);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// DELETE /api/knowledge/relations/:id — 删除关系
router.delete('/relations/:id', (req, res) => {
  try {
    knowledgeDb.deleteRelation(req.params.id);
    res.ok({ deleted: true });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/analyze — AI 分析节点质量
router.post('/analyze', async (req, res) => {
  try {
    const { node_id, title, content } = req.body;
    let nodeTitle = title;
    let nodeContent = content;

    // If node_id provided, fetch from DB
    if (node_id && !content) {
      const node = knowledgeDb.getNode(node_id);
      if (!node) return res.fail('node not found', 1, 404);
      nodeTitle = node.title;
      if (node.md_path) {
        const mdRoot = paths.mdLibraryRoot();
        const fullPath = path.resolve(mdRoot, node.md_path);
        if (fs.existsSync(fullPath)) {
          nodeContent = fs.readFileSync(fullPath, 'utf8');
        }
      }
      if (!nodeContent) nodeContent = node.summary || node.title;
    }

    if (!nodeTitle && !nodeContent) return res.fail('title or content is required');

    const result = await knowledgeAnalyzer.analyzeContent(nodeTitle, nodeContent);

    // If node_id provided, update the node
    if (node_id) {
      knowledgeDb.updateNode(node_id, {
        category: result.category,
        quality: result.quality,
        quality_reason: result.quality_reason,
        tags: result.tags,
      });
    }

    res.ok(result);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/categories — 分类统计
router.get('/categories', (req, res) => {
  try {
    const stats = knowledgeDb.getCategoryStats(parseDateRange(req.query));
    res.ok(stats);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/stats ? question analytics for dashboard
router.get('/stats', (req, res) => {
  try {
    const stats = knowledgeDb.getQuestionStats(parseDateRange(req.query));
    res.ok(stats);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/import-md — 从 Markdown 文件导入
router.post('/import-md', (req, res) => {
  try {
    const { md_path, title, category, tags, quality } = req.body;
    if (!md_path) return res.fail('md_path is required');

    const mdRoot = paths.mdLibraryRoot();
    const fullPath = path.resolve(mdRoot, md_path);
    if (!fs.existsSync(fullPath)) return res.fail('file not found: ' + md_path);

    const content = fs.readFileSync(fullPath, 'utf8');
    const fm = parseFrontmatter(content);
    const summary = summarizeMarkdown(content);

    const node = knowledgeDb.importFromMdFile({
      title: title || fm.title || path.basename(md_path, '.md'),
      summary,
      category: category || fm.folder || '临时',
      tags: tags || (Array.isArray(fm.tags) ? fm.tags : []),
      md_path,
      quality: quality || 'gray',
    });

    res.ok(node);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/import-batch — 批量导入所有 MD 文件
router.post('/import-batch', (req, res) => {
  try {
    const mdRoot = paths.mdLibraryRoot();
    if (!fs.existsSync(mdRoot)) return res.fail('MD library not found');

    const imported = [];
    const errors = [];

    function walkDir(dir, relBase) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relBase, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath, relPath);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const fm = parseFrontmatter(content);
            const summary = summarizeMarkdown(content);
            const node = knowledgeDb.importFromMdFile({
              title: fm.title || entry.name.replace(/\.md$/, ''),
              summary,
              category: fm.folder || '临时',
              tags: Array.isArray(fm.tags) ? fm.tags : [],
              md_path: relPath,
            });
            imported.push({ path: relPath, id: node.id, title: node.title, category: node.category });
          } catch (e) {
            errors.push({ path: relPath, error: e.message });
          }
        }
      }
    }

    walkDir(mdRoot, '');

    // Auto-create relations between nodes in the same category
    const byCategory = {};
    for (const item of imported) {
      const cat = item.category || '临时';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    let relationsCreated = 0;
    const existingRelations = knowledgeDb.listRelations();
    const relSet = new Set(existingRelations.map(r => `${r.source_id}:${r.target_id}`));
    for (const [cat, nodes] of Object.entries(byCategory)) {
      if (nodes.length < 2) continue;
      // Connect each node to the next one (chain) to avoid O(n^2)
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i].id, b = nodes[i + 1].id;
        const key1 = `${a}:${b}`, key2 = `${b}:${a}`;
        if (!relSet.has(key1) && !relSet.has(key2)) {
          try {
            knowledgeDb.createRelation({ source_id: a, target_id: b, relation_type: 'related', strength: 0.3 });
            relSet.add(key1);
            relationsCreated++;
          } catch {}
        }
      }
    }

    res.ok({ imported: imported.length, errors: errors.length, relations: relationsCreated, details: { imported: imported.slice(0, 20), errors: errors.slice(0, 10) } });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// Agent profile → 图谱分类映射
const AGENT_CATEGORY_MAP = {
  'default': '主对话',
  'thinker': '问题沉淀',
  'coder': '文档梳理',
  'pm': '产品设计',
  'designer': '表达增强',
  'researcher': '生图研究',
};

// 系统命令 / UI 操作 — 不是真正的用户提问
const SYSTEM_CMD_PATTERNS = [
  /^(新建对话|新对话|打开设置|切换模型|切换主题|清除上下文|导出对话|删除对话|重命名|固定对话|取消固定)$/i,
  /^(主对话|问题沉淀|文档梳理|产品设计|表达增强|生图研究)\s*[·•]\s*主对话$/,
  /^(开始|停止|继续|重试|刷新|返回|关闭|取消|确认|好的|行|可以|嗯|ok|yes|no)$/i,
  /^[\s\.\,\!\?\-\=\+\*\/\\]+$/,
  /^\d+$/,
];

function isSystemCommand(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  for (const pattern of SYSTEM_CMD_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function shQuote(value) {
  return `'${String(value || '').replace(/'/g, `'\''`)}'`;
}

function runHermes(args, timeout = 30000) {
  const hermes = detectHermesCommand();
  if (!hermes) throw new Error('Hermes CLI 未找到');
  const result = hermes.type === 'wsl'
    ? spawnSync('wsl', ['-e', 'bash', '-lc', `export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH"; hermes ${args.map(shQuote).join(' ')}`], {
        encoding: 'utf8', timeout, maxBuffer: 40 * 1024 * 1024, windowsHide: true,
      })
    : spawnSync('hermes', args, {
        encoding: 'utf8', timeout, maxBuffer: 40 * 1024 * 1024, windowsHide: true, shell: true,
      });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || '').slice(0, 500));
  return result.stdout || '';
}

function isSessionId(value) {
  return /^\d{8}_\d{6}_[A-Za-z0-9_-]+$/.test(String(value || '').trim());
}

function parseCliSessionList(raw) {
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    const list = Array.isArray(parsed) ? parsed : (parsed.sessions || parsed.data || parsed.items || []);
    return (Array.isArray(list) ? list : []).map(item => item && (item.id || item.session_id || item.sessionId)).filter(isSessionId);
  } catch (_) {
    return String(raw || '').match(/\d{8}_\d{6}_[A-Za-z0-9_-]+/g) || [];
  }
}

function normalizeCliMessages(rawMessages = []) {
  return rawMessages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: String(m.content || ''), ts: Math.floor((m.timestamp || 0) * 1000) || Date.now() }));
}

function loadWebChatsForSync(chatIds) {
  return (store.read('chats', []) || [])
    .filter(chat => !chatIds || !chatIds.length || chatIds.includes(chat.id))
    .map(chat => ({ ...chat, source: chat.source || 'webui' }));
}

function loadCliChatsForSync(chatIds, limit) {
  const ids = [];
  try {
    let raw = '';
    try {
      raw = runHermes(['sessions', 'list', '--limit', String(limit || 500), '--json'], 30000);
    } catch (_) {
      raw = runHermes(['sessions', 'list', '--limit', String(limit || 500)], 30000);
    }
    for (const id of parseCliSessionList(raw)) {
      if ((!chatIds || !chatIds.length || chatIds.includes(id)) && !ids.includes(id)) ids.push(id);
    }
  } catch (_) {
    return [];
  }

  const chats = [];
  for (const id of ids) {
    try {
      const raw = runHermes(['sessions', 'export', '-', '--session-id', id], 45000);
      const data = JSON.parse(raw);
      const messages = normalizeCliMessages(data.messages || []);
      if (messages.length) chats.push({ id, source: 'cli', agentId: 'default', messages });
    } catch (_) {}
  }
  return chats;
}

function nextAssistantReply(messages, index) {
  for (let i = index + 1; i < messages.length; i++) {
    if (messages[i].role === 'assistant') return String(messages[i].content || '').slice(0, 1000);
    if (messages[i].role === 'user') return '';
  }
  return '';
}

function relationKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// POST /api/knowledge/sync-prompts — 从 WebUI + Hermes CLI 聊天记录同步用户提示词到知识图谱
router.post('/sync-prompts', (req, res) => {
  try {
    const { chatIds, includeCli = true, limit = 500 } = req.body || {};
    const chats = [
      ...loadWebChatsForSync(chatIds),
      ...(includeCli ? loadCliChatsForSync(chatIds, limit) : []),
    ];
    let synced = 0;
    let skipped = 0;
    let duplicated = 0;
    let relations = 0;
    const categories = {};
    const relSet = new Set((knowledgeDb.listRelations() || []).map(r => relationKey(r.source_id, r.target_id)));

    for (const chat of chats) {
      if (!Array.isArray(chat.messages)) continue;
      const agentId = chat.agentId || 'default';
      const category = AGENT_CATEGORY_MAP[agentId] || AGENT_CATEGORY_MAP['default'];
      let prevNodeId = null;

      for (let i = 0; i < chat.messages.length; i++) {
        const msg = chat.messages[i];
        if (msg.role !== 'user') continue;

        const text = String(msg.content || '').trim();
        if (isSystemCommand(text)) { skipped++; continue; }
        if (isJunkPrompt(text)) { skipped++; continue; }

        let node = knowledgeDb.findNodeByPrompt(text);
        if (node) {
          knowledgeDb.incrementFrequency(node.id);
          duplicated++;
        } else {
          const title = text.length > 30 ? text.slice(0, 30) + '...' : text;
          node = knowledgeDb.createNode({
            title,
            summary: text.slice(0, 200),
            category,
            quality: 'yellow',
            source: chat.source === 'cli' ? 'cli-sync' : 'auto-capture',
            chat_id: chat.id,
            prompt_text: text,
            context_reply: nextAssistantReply(chat.messages, i),
            frequency: 1,
          });
          synced++;
          categories[category] = (categories[category] || 0) + 1;
        }

        if (prevNodeId && node && node.id && prevNodeId !== node.id) {
          const key = relationKey(prevNodeId, node.id);
          if (!relSet.has(key)) {
            try {
              knowledgeDb.createRelation({ source_id: prevNodeId, target_id: node.id, relation_type: 'same_chat', strength: 0.45 });
              relSet.add(key);
              relations++;
            } catch (_) {}
          }
        }
        if (node && node.id) prevNodeId = node.id;
      }
    }

    res.ok({ synced, skipped, duplicated, relations, chats: chats.length, categories });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

function markdownCategoryFolders(mdRoot) {
  const defaults = (Array.isArray(DOC_FOLDERS) ? DOC_FOLDERS : [])
    .filter(name => name && name !== '临时收件箱');
  const folders = [];
  try {
    if (fs.existsSync(mdRoot)) {
      for (const entry of fs.readdirSync(mdRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        if (entry.name === '临时收件箱') continue;
        if (['.git', 'node_modules', 'history-md', 'memory'].includes(entry.name)) continue;
        folders.push(entry.name);
      }
    }
  } catch (_) {}
  return [...new Set([...defaults, ...folders])];
}

function mapAnalyzerCategoryToFolder(category) {
  const categoryMap = {
    'UI设计': '输出文档',
    'Prompt': 'Prompt模板',
    '生图': '生图记录',
    'Agent': '工作流',
    '项目需求': '项目经验',
    '周报': '输出文档',
    '教程': '输出文档',
    '技术方案': '输出文档',
    '临时': null,
  };
  return Object.prototype.hasOwnProperty.call(categoryMap, category) ? categoryMap[category] : category;
}

// POST /api/knowledge/auto-classify — AI 自动分类临时收件箱文件
router.post('/auto-classify', async (req, res) => {
  try {
    const mdRoot = paths.mdLibraryRoot();
    const inboxDir = path.join(mdRoot, '临时收件箱');
    if (!fs.existsSync(inboxDir)) return res.ok({ moved: 0, categories: {} });

    const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
    if (!files.length) return res.ok({ moved: 0, categories: {} });

    const vaultFolders = markdownCategoryFolders(mdRoot);
    let moved = 0;
    let skipped = 0;
    const categories = {};
    const errors = [];

    for (const file of files) {
      try {
        const filePath = path.join(inboxDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(content);

        // Use AI to classify against the current Markdown folders, not a hardcoded legacy list.
        const analysis = await knowledgeAnalyzer.analyzeContent(fm.title || file, content.slice(0, 2000), { categories: vaultFolders });
        if (analysis.error) errors.push({ file, error: analysis.error });
        let targetFolder = mapAnalyzerCategoryToFolder(analysis.category);
        if (LEGACY_DOC_FOLDERS.includes(targetFolder)) targetFolder = '输出文档';
        if (targetFolder && !vaultFolders.includes(targetFolder)) {
          const normalized = normalizeDocFolder(targetFolder, [fm.title || file, content.slice(0, 1200)].join('\n'));
          if (vaultFolders.includes(normalized)) targetFolder = normalized;
        }

        // If still "临时" or unmapped, skip
        if (!targetFolder || targetFolder === '临时' || targetFolder === '临时收件箱' || !vaultFolders.includes(targetFolder)) {
          skipped++;
          continue;
        }

        const targetDir = path.join(mdRoot, targetFolder);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        let destPath = path.join(targetDir, file);
        // Handle name conflicts
        if (fs.existsSync(destPath)) {
          const ext = path.extname(file);
          const base = path.basename(file, ext);
          destPath = path.join(targetDir, `${base}-${Date.now()}${ext}`);
        }

        fs.renameSync(filePath, destPath);

        const oldRelPath = path.relative(mdRoot, filePath).split(path.sep).join('/');
        const newRelPath = path.relative(mdRoot, destPath).split(path.sep).join('/');
        const summary = summarizeMarkdown(content);
        const existing = knowledgeDb.findNodeByMdPath(oldRelPath) || knowledgeDb.findNodeByMdPath(newRelPath);
        if (existing && existing.id) {
          knowledgeDb.updateNode(existing.id, {
            title: fm.title || path.basename(destPath, '.md'),
            summary,
            category: targetFolder,
            tags: analysis.tags || (Array.isArray(fm.tags) ? fm.tags : []),
            quality: analysis.quality || 'gray',
            quality_reason: analysis.quality_reason || '',
            md_path: newRelPath,
            source: 'import',
          });
        } else {
          knowledgeDb.importFromMdFile({
            title: fm.title || path.basename(destPath, '.md'),
            summary,
            category: targetFolder,
            tags: analysis.tags || (Array.isArray(fm.tags) ? fm.tags : []),
            md_path: newRelPath,
            quality: analysis.quality || 'gray',
          });
        }

        moved++;
        categories[targetFolder] = (categories[targetFolder] || 0) + 1;
      } catch (e) {
        errors.push({ file, error: e.message });
      }
    }

    res.ok({ moved, skipped, total: files.length, categories, availableCategories: vaultFolders, errors: errors.slice(0, 5) });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

module.exports = router;

