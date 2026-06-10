/**
 * Knowledge Graph API routes 鈥?/api/knowledge/*
 */
const express = require('express');
const router = express.Router();
const knowledgeDb = require('../services/knowledgeDb');
const knowledgeAnalyzer = require('../services/knowledgeAnalyzer');
const { parseFrontmatter, summarizeMarkdown, DOC_FOLDERS, LEGACY_DOC_FOLDERS, normalizeDocFolder, captureKnowledge } = require('../services/knowledgeCapture');
const paths = require('../services/paths');
const store = require('../services/store');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectHermesCommand } = require('../services/hermes');
const questionCluster = require('../services/questionCluster');

// --- Junk message filtering ---

function isInsidePath(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

const JUNK_PATTERNS = [
  /^(你好|hello|hi|hey|哈喽|嗨)$/i,
  /^(你是谁|你是什么|what\s*(are|is)\s*(you|your)|who\s*are\s*you)$/i,
  /^(what\s*model|你是什么模型|你用的什么模型)/i,
  /^(thanks?|谢谢|感谢|thank\s*you)$/i,
  /^(好的?|ok|okay|嗯|好|收到)$/i,
  /^(再见|bye|goodbye|拜拜|88)$/i,
  /^[\s\.,!?\-=+*\/\\]+$/,
  /^\d+$/,
]


function rangeLabelFromQuery(query = {}) {
  const range = String(query.range || '30d').toLowerCase();
  if (query.start || query.end) return '自定义时间';
  if (range === '7d') return '近 7 天';
  if (range === 'all') return '全部';
  return '近 30 天';
}

function formatReportDate(seconds) {
  if (!seconds) return '-';
  return new Date(seconds * 1000).toLocaleDateString('zh-CN');
}

function qualityLabel(value) {
  return ({ green: '优秀', yellow: '可复用', orange: '待优化', red: '需重写', gray: '未分析' })[value] || value || '未分析';
}

function topItems(items = [], limit = 6) {
  return [...items].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, limit);
}

function nodePreview(node = {}) {
  return String(node.prompt_text || node.summary || node.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function buildKnowledgeReportMarkdown({ rangeLabel, stats, graph }) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const categories = topItems(stats.categories || [], 8);
  const reusableNodes = [...nodes]
    .sort((a, b) => ((b.frequency || 1) - (a.frequency || 1)) || ((b.relations || 0) - (a.relations || 0)))
    .filter(node => (node.frequency || 1) > 1 || (node.relations || 0) > 1)
    .slice(0, 8);
  const valuableNodes = [...nodes]
    .sort((a, b) => ((b.relations || 0) - (a.relations || 0)) || ((b.frequency || 1) - (a.frequency || 1)))
    .slice(0, 8);
  const needOrganize = nodes
    .filter(node => !node.md_path && ['yellow', 'green', 'gray', '', null, undefined].includes(node.quality))
    .sort((a, b) => ((b.frequency || 1) + (b.relations || 0)) - ((a.frequency || 1) + (a.relations || 0)))
    .slice(0, 8);
  const timeline = stats.timeline || [];
  const activeDays = timeline.filter(item => item.count > 0).length;
  const topCategory = categories[0];
  const title = `${rangeLabel}知识复盘报告`;
  const lines = [
    `# ${title}`,
    '',
    `> 生成时间：${new Date().toLocaleString('zh-CN')}`,
    `> 数据范围：${rangeLabel}`,
    '',
    '## 总览',
    `- 问题总数：${stats.total || nodes.length}`,
    `- 可复用线索：${stats.reusable || reusableNodes.length}`,
    `- 主题分类：${categories.length}`,
    `- 关系数量：${edges.length}`,
    `- 活跃天数：${activeDays}`,
  ];
  if (topCategory) lines.push(`- 最高频主题：${topCategory.name}（${topCategory.count} 条）`);
  lines.push('', '## 高频主题');
  if (categories.length) {
    categories.forEach((item, index) => lines.push(`${index + 1}. ${item.name || '未分类'}：${item.count} 条`));
  } else {
    lines.push('- 暂无足够数据。');
  }
  lines.push('', '## 可复用经验');
  if (reusableNodes.length) {
    reusableNodes.forEach((node, index) => lines.push(`${index + 1}. **${node.title || '未命名问题'}**｜${node.category || '未分类'}｜频次 ${node.frequency || 1}｜关系 ${node.relations || 0}\n   - ${nodePreview(node) || '暂无摘要'}`));
  } else {
    lines.push('- 暂未发现重复出现或高关联的问题，可继续积累。');
  }
  lines.push('', '## 关键知识节点');
  if (valuableNodes.length) {
    valuableNodes.forEach((node, index) => lines.push(`${index + 1}. **${node.title || '未命名节点'}**｜${node.category || '未分类'}｜质量：${qualityLabel(node.quality)}｜${formatReportDate(node.created_at)}\n   - ${nodePreview(node) || '暂无摘要'}`));
  } else {
    lines.push('- 暂无关键节点。');
  }
  lines.push('', '## 待整理内容');
  if (needOrganize.length) {
    needOrganize.forEach((node, index) => lines.push(`${index + 1}. ${node.title || '未命名内容'}｜${node.category || '未分类'}｜建议整理为输出文档`));
  } else {
    lines.push('- 当前高价值内容基本已有文档承载。');
  }
  lines.push('', '## 建议动作');
  lines.push('- 把“可复用经验”中的前 3 项整理成固定 Prompt、流程或输出文档。');
  lines.push('- 对“待整理内容”逐条补充上下文和最终结论，减少后续重复提问成本。');
  lines.push('- 下次复盘时重点观察高频主题是否持续增长，决定是否建立独立项目/知识分类。');
  lines.push('', '## 数据说明');
  lines.push('- 本报告基于知识图谱节点、关系、分类、质量与频次统计自动生成。');
  lines.push('- 报告用于个人复盘，不代表最终结论，可继续手动编辑补充。');
  return { title, content: lines.join('\n') };
}
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

// GET /api/knowledge/graph 鈥?瀹屾暣鍥捐氨鏁版嵁
router.get('/graph', (req, res) => {
  try {
    const { category, quality, search } = req.query;
    const data = knowledgeDb.getGraphData({ category, quality, search, ...parseDateRange(req.query) });
    res.ok(data);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/nodes 鈥?鍒楀嚭鑺傜偣
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

// POST /api/knowledge/nodes 鈥?鍒涘缓鑺傜偣
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

// GET /api/knowledge/nodes/:id 鈥?鑾峰彇鍗曚釜鑺傜偣
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

// PATCH /api/knowledge/nodes/:id 鈥?鏇存柊鑺傜偣
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

// DELETE /api/knowledge/nodes/:id 鈥?鍒犻櫎鑺傜偣
router.delete('/nodes/:id', (req, res) => {
  try {
    knowledgeDb.deleteNode(req.params.id);
    res.ok({ deleted: true });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/relations 鈥?鍒楀嚭鍏崇郴
router.get('/relations', (req, res) => {
  try {
    const { node_id } = req.query;
    const relations = knowledgeDb.listRelations({ node_id: node_id || undefined });
    res.ok(relations);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/relations 鈥?鍒涘缓鍏崇郴
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

// DELETE /api/knowledge/relations/:id 鈥?鍒犻櫎鍏崇郴
router.delete('/relations/:id', (req, res) => {
  try {
    knowledgeDb.deleteRelation(req.params.id);
    res.ok({ deleted: true });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/analyze 鈥?AI 鍒嗘瀽鑺傜偣璐ㄩ噺
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

// GET /api/knowledge/categories 鈥?鍒嗙被缁熻
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



function buildQuestionClusterReportMarkdown(node = {}) {
  const examples = Array.isArray(node.example_questions) ? node.example_questions : [];
  const keywords = Array.isArray(node.keywords) ? node.keywords : [];
  const title = `${node.title || '\u9ad8\u9891\u95ee\u9898'}\u5206\u6790\u62a5\u544a`;
  const lines = [
    `# ${title}`,
    '',
    `> \u751f\u6210\u65f6\u95f4\uff1a${new Date().toLocaleString('zh-CN')}`,
    `> \u6240\u5c5e\u5206\u7c7b\uff1a${node.category || '\u672a\u5206\u7c7b'}`,
    `> \u51fa\u73b0\u6b21\u6570\uff1a${node.frequency || 1}`,
    '',
    '## \u8fd9\u4e2a\u5206\u7c7b\u4e3b\u8981\u8ba8\u8bba\u4ec0\u4e48',
    `- \u4e3b\u8981\u56f4\u7ed5\u201c${node.title || node.prompt_text || '\u672a\u547d\u540d\u95ee\u9898'}\u201d\u5c55\u5f00\u3002`,
    `- \u5173\u952e\u8bcd\uff1a${keywords.length ? keywords.join('\u3001') : '\u6682\u65e0'}`,
    '',
    '## \u7528\u6237\u771f\u6b63\u5173\u6ce8\u4ec0\u4e48',
    `- \u9ad8\u9891\u7a0b\u5ea6\uff1a${node.frequency || 1} \u6b21\uff0c\u8bf4\u660e\u8be5\u95ee\u9898\u503c\u5f97\u6c89\u6dc0\u4e3a\u56fa\u5b9a\u7ecf\u9a8c\u6216\u6a21\u677f\u3002`,
    `- \u5173\u8054\u95ee\u9898\u6570\u91cf\uff1a${examples.length || 1} \u4e2a\uff0c\u53ef\u4f5c\u4e3a\u540e\u7eed\u77e5\u8bc6\u5e93\u6761\u76ee\u7684\u7d20\u6750\u3002`,
    '',
    '## \u5178\u578b\u95ee\u9898',
  ];
  if (examples.length) examples.slice(0, 10).forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  else lines.push(`1. ${node.prompt_text || node.summary || node.title || '\u6682\u65e0'}`);
  lines.push('', '## \u4f18\u5316\u5efa\u8bae');
  lines.push('- \u5c06\u8be5\u95ee\u9898\u6574\u7406\u4e3a\u53ef\u590d\u7528\u7684\u6807\u51c6\u7b54\u6848\u3001\u6d41\u7a0b\u6216\u63d0\u793a\u8bcd\u3002');
  lines.push('- \u5982\u679c\u8be5\u95ee\u9898\u6301\u7eed\u589e\u957f\uff0c\u5efa\u8bae\u62c6\u5206\u4e3a\u66f4\u7ec6\u7684\u5b50\u95ee\u9898\u5e76\u5f62\u6210\u4e8c\u7ea7\u77e5\u8bc6\u8282\u70b9\u3002');
  lines.push('- \u5c06\u5178\u578b\u95ee\u9898\u8865\u5145\u4e0a\u4e0b\u6587\u3001\u8fb9\u754c\u6761\u4ef6\u548c\u6700\u7ec8\u7ed3\u8bba\uff0c\u51cf\u5c11\u540e\u7eed\u91cd\u590d\u6c9f\u901a\u6210\u672c\u3002');
  lines.push('', '## \u7ecf\u9a8c\u6c89\u6dc0\u65b9\u5411');
  lines.push('- \u56fa\u5316\u5e38\u89c1\u95ee\u6cd5\u3002');
  lines.push('- \u6c89\u6dc0\u63a8\u8350\u89e3\u51b3\u6d41\u7a0b\u3002');
  lines.push('- \u603b\u7ed3\u5931\u8d25\u6848\u4f8b\u548c\u6ce8\u610f\u4e8b\u9879\u3002');
  return { title, content: lines.join('\n') };
}

function buildTop20ReportMarkdown({ graph, stats, rangeLabel }) {
  const nodes = [...(graph.nodes || [])].sort((a, b) => (b.frequency || 1) - (a.frequency || 1));
  const categories = stats.categories || [];
  const topNodes = nodes.slice(0, 20);
  const title = `${rangeLabel}Top20\u9ad8\u9891\u95ee\u9898\u62a5\u544a`;
  const lines = [
    `# ${title}`,
    '',
    `> \u751f\u6210\u65f6\u95f4\uff1a${new Date().toLocaleString('zh-CN')}`,
    `> \u9ad8\u9891\u9608\u503c\uff1a\u51fa\u73b0\u6b21\u6570 >= 5`,
    '',
    '## Top20 \u9ad8\u9891\u95ee\u9898',
  ];
  if (topNodes.length) {
    topNodes.forEach((node, index) => {
      const keywords = Array.isArray(node.keywords) ? node.keywords.join('\u3001') : '';
      lines.push(`${index + 1}. **${node.title || '\u672a\u547d\u540d\u95ee\u9898'}**\uff5c${node.category || '\u672a\u5206\u7c7b'}\uff5c\u51fa\u73b0 ${node.frequency || 1} \u6b21\uff5c${keywords || '\u65e0\u5173\u952e\u8bcd'}`);
      lines.push(`   - \u5178\u578b\u95ee\u9898\uff1a${nodePreview(node) || '\u6682\u65e0'}`);
    });
  } else {
    lines.push('- \u6682\u65e0\u95ee\u9898\u6570\u636e\u3002');
  }
  lines.push('', '## Top20 \u9ad8\u9891\u5206\u7c7b');
  if (categories.length) categories.slice(0, 20).forEach((item, index) => lines.push(`${index + 1}. ${item.name || '\u672a\u5206\u7c7b'}\uff1a${item.count} \u6b21`));
  else lines.push('- \u6682\u65e0\u5206\u7c7b\u6570\u636e\u3002');
  lines.push('', '## \u5efa\u8bae\u52a8\u4f5c');
  lines.push('- \u4f18\u5148\u628a Top5 \u95ee\u9898\u6574\u7406\u4e3a\u6807\u51c6\u6587\u6863\u6216\u63d0\u793a\u8bcd\u6a21\u677f\u3002');
  lines.push('- \u5bf9\u589e\u957f\u6700\u5feb\u7684\u5206\u7c7b\u5efa\u7acb\u72ec\u7acb\u77e5\u8bc6\u76ee\u5f55\u3002');
  lines.push('- \u5bf9\u4f4e\u9891\u4f46\u91cd\u8981\u7684\u95ee\u9898\u7ee7\u7eed\u4fdd\u5b58\uff0c\u6682\u4e0d\u6d88\u8017 AI \u5206\u6790\u6210\u672c\u3002');
  return { title, content: lines.join('\n') };
}

// POST /api/knowledge/nodes/:id/report - generate one cluster report
router.post('/nodes/:id/report', (req, res) => {
  try {
    const node = knowledgeDb.getNode(req.params.id);
    if (!node) return res.fail('node not found', 1, 404);
    const report = buildQuestionClusterReportMarkdown(node);
    const saved = captureKnowledge({
      title: report.title,
      folder: 'output',
      type: 'cluster-report',
      tags: ['knowledge-graph', 'cluster-report', node.category || 'uncategorized'],
      source: 'knowledge-cluster-report',
      status: 'draft',
      summary: `${node.title || 'cluster'} report`,
      content: report.content,
    });
    knowledgeDb.updateNode(node.id, { report_status: 'generated' });
    res.ok({ ...saved, title: report.title, node_id: node.id });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/report/top20 - generate Top20 report
router.post('/report/top20', (req, res) => {
  try {
    const query = { ...(req.query || {}), ...(req.body || {}) };
    const dateRange = parseDateRange(query);
    const rangeLabel = rangeLabelFromQuery(query);
    const graph = knowledgeDb.getGraphData(dateRange);
    const stats = knowledgeDb.getQuestionStats(dateRange);
    const report = buildTop20ReportMarkdown({ graph, stats, rangeLabel });
    const saved = captureKnowledge({
      title: report.title,
      folder: 'output',
      type: 'top20-report',
      tags: ['knowledge-graph', 'Top20', 'high-frequency', rangeLabel],
      source: 'knowledge-top20-report',
      status: 'draft',
      summary: `${rangeLabel} Top20 report`,
      content: report.content,
    });
    res.ok({ ...saved, title: report.title, range: rangeLabel });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/import-md 鈥?浠?Markdown 鏂囦欢瀵煎叆
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
      category: category || fm.folder || '涓存椂',
      tags: tags || (Array.isArray(fm.tags) ? fm.tags : []),
      md_path,
      quality: quality || 'gray',
    });

    res.ok(node);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/import-batch 鈥?鎵归噺瀵煎叆鎵€鏈?MD 鏂囦欢
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
              category: fm.folder || '涓存椂',
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
      const cat = item.category || '涓存椂';
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

// Agent profile -> 图谱分类映射
const AGENT_CATEGORY_MAP = {
  default: '主对话',
  thinker: '问题沉淀',
  coder: '文档梳理',
  pm: '产品设计',
  designer: '表达增强',
  researcher: '生图研究',
};

// 系统命令 / UI 操作不是有效用户问题
const SYSTEM_CMD_PATTERNS = [
  /^(新建对话|新对话|打开设置|切换模型|切换主题|清除上下文|导出对话|删除对话|重命名|固定对话|取消固定)$/i,
  /^(主对话|问题沉淀|文档梳理|产品设计|表达增强|生图研究)\s*[·•]\s*主对话/i,
  /^(开始|停止|继续|重试|刷新|返回|关闭|取消|确认|好的|行|可以|嗯|ok|yes|no)$/i,
  /^[\s\.,!?\-=+*\/\\]+$/,
  /^\d+$/,
];

function isSystemCommand(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return SYSTEM_CMD_PATTERNS.some(pattern => pattern.test(trimmed));
}

function runHermes(args, timeout = 30000) {
  const hermes = detectHermesCommand();
  if (!hermes) throw new Error('Hermes CLI not found. Install native Hermes on Windows and ensure hermes is on PATH.');
  const result = spawnSync(hermes.cmd || 'hermes', args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 40 * 1024 * 1024,
    windowsHide: true,
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

// POST /api/knowledge/sync-prompts 鈥?浠?WebUI + Hermes CLI 鑱婂ぉ璁板綍鍚屾鐢ㄦ埛鎻愮ず璇嶅埌鐭ヨ瘑鍥捐氨
router.post('/sync-prompts', (req, res) => {
  try {
    const { chatIds, includeCli = true, limit = 500, minFrequency = 5 } = req.body || {};
    const minFreq = Math.max(1, Number(minFrequency) || 5);
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

        const clusterMeta = questionCluster.buildQuestionMeta(text, category);
        let node = knowledgeDb.findNodeByPrompt(text);
        if (node) {
          node = knowledgeDb.mergeQuestionIntoNode(node.id, { prompt_text: text, clusterMeta });
          duplicated++;
        } else {
          const candidate = knowledgeDb.findSimilarQuestionNode(clusterMeta, { category, threshold: 0.72 });
          if (candidate) {
            node = knowledgeDb.mergeQuestionIntoNode(candidate.id, {
              prompt_text: text,
              context_reply: nextAssistantReply(chat.messages, i),
              chat_id: chat.id,
              source: chat.source === 'cli' ? 'cli-sync' : 'auto-capture',
              clusterMeta,
            });
            duplicated++;
          } else {
            node = knowledgeDb.createNode({
              title: questionCluster.buildClusterTitle(text, clusterMeta),
              summary: text.slice(0, 200),
              category: clusterMeta.category || category,
              quality: 'gray',
              source: chat.source === 'cli' ? 'cli-sync' : 'auto-capture',
              chat_id: chat.id,
              prompt_text: text,
              context_reply: nextAssistantReply(chat.messages, i),
              frequency: 1,
              cluster_key: clusterMeta.clusterKey,
              normalized_text: clusterMeta.normalizedText,
              keywords: clusterMeta.keywords,
              example_questions: [text],
              last_question_at: Math.floor(Date.now() / 1000),
              report_status: minFreq <= 1 ? 'pending' : 'none',
            });
            synced++;
            categories[node.category || category] = (categories[node.category || category] || 0) + 1;
          }
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

    res.ok({ synced, skipped, duplicated, relations, chats: chats.length, categories, minFrequency: minFreq });
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
    UI设计: '输出文档',
    Prompt: 'Prompt模板',
    生图: '生图记录',
    Agent: '工作流',
    项目需求: '项目经验',
    周报: '输出文档',
    教程: '输出文档',
    技术方案: '输出文档',
    临时: null,
  };
  return Object.prototype.hasOwnProperty.call(categoryMap, category) ? categoryMap[category] : category;
}

// POST /api/knowledge/auto-classify — AI 自动分类临时收件箱文件
router.post('/auto-classify', async (req, res) => {
  try {
    const mdRoot = paths.mdLibraryRoot();
    const inboxDir = path.join(mdRoot, '临时收件箱');

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

        // If still "涓存椂" or unmapped, skip
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

// GET /api/knowledge/markdown 鈥?璇诲彇 Markdown 鏂囨。锛堝畨鍏ㄨ矾寰勯檺鍒讹級
router.get('/markdown', (req, res) => {
  try {
    const { path: relPath } = req.query;
    if (!relPath) return res.fail('path is required');

    const mdRoot = path.resolve(paths.mdLibraryRoot());
    const fullPath = path.resolve(mdRoot, relPath);

    // 闃叉璺緞绌胯秺
    if (!isInsidePath(mdRoot, fullPath)) {
      return res.fail('invalid path: outside markdown library', 1, 403);
    }

    if (!fs.existsSync(fullPath)) {
      return res.fail('file not found', 1, 404);
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return res.fail('not a file', 1, 400);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

    res.ok({
      path: relPath,
      content,
      mtime: stats.mtimeMs,
      size: stats.size,
      hash,
    });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// PUT /api/knowledge/markdown 鈥?鍐欏叆 Markdown 鏂囨。锛堝畨鍏ㄨ矾寰勯檺鍒讹級
router.put('/markdown', (req, res) => {
  try {
    const { path: relPath, content } = req.body;
    if (!relPath) return res.fail('path is required');
    if (content === undefined) return res.fail('content is required');

    const mdRoot = path.resolve(paths.mdLibraryRoot());
    const fullPath = path.resolve(mdRoot, relPath);

    // 闃叉璺緞绌胯秺
    if (!isInsidePath(mdRoot, fullPath)) {
      return res.fail('invalid path: outside markdown library', 1, 403);
    }

    // 纭繚鐩綍瀛樺湪
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    const stats = fs.statSync(fullPath);
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

    res.ok({
      path: relPath,
      mtime: stats.mtimeMs,
      size: stats.size,
      hash,
      saved: true,
    });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// POST /api/knowledge/markdown/replace 鈥?灞€閮ㄦ浛鎹?Markdown 閫夊尯锛堝揩閫熺紪杈戯級
router.post('/markdown/replace', (req, res) => {
  try {
    const { path: relPath, oldText, newText, lineStart, lineEnd, returnContent } = req.body || {};
    if (!relPath) return res.fail('path is required');
    if (!oldText) return res.fail('oldText is required');
    if (newText === undefined) return res.fail('newText is required');

    const mdRoot = path.resolve(paths.mdLibraryRoot());
    const fullPath = path.resolve(mdRoot, relPath);

    // 闃叉璺緞绌胯秺
    if (!isInsidePath(mdRoot, fullPath)) {
      return res.fail('invalid path: outside markdown library', 1, 403);
    }

    if (!fs.existsSync(fullPath)) {
      return res.fail('file not found', 1, 404);
    }

    const statsBefore = fs.statSync(fullPath);
    if (!statsBefore.isFile()) {
      return res.fail('not a file', 1, 400);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const normalize = (s) => String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const normOldText = normalize(oldText).trim();
    const normContent = normalize(content);
    const normNewText = normalize(newText).trim();

    let updated = '';
    let matchedBy = 'text';
    const start = Number(lineStart || 0);
    const end = Number(lineEnd || 0);

    if (start > 0 && end >= start) {
      const lines = normContent.split('\n');
      const selected = lines.slice(start - 1, end).join('\n').trim();
      if (selected === normOldText) {
        lines.splice(start - 1, end - start + 1, ...normNewText.split('\n'));
        updated = lines.join('\n');
        matchedBy = 'line-range';
      }
    }

    if (!updated) {
      const index = normContent.indexOf(normOldText);
      if (index < 0) return res.fail('selected text not found', 1, 409);
      if (normContent.indexOf(normOldText, index + normOldText.length) >= 0) {
        return res.fail('selected text is not unique; please provide lineStart/lineEnd', 1, 409);
      }
      updated = normContent.slice(0, index) + normNewText + normContent.slice(index + normOldText.length);
    }

    fs.writeFileSync(fullPath, updated, 'utf8');
    const stats = fs.statSync(fullPath);
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(updated).digest('hex').slice(0, 16);

    const payload = {
      path: relPath,
      mtime: stats.mtimeMs,
      size: stats.size,
      hash,
      saved: true,
      matchedBy,
    };
    if (returnContent !== false) payload.content = updated;
    res.ok(payload);
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

// GET /api/knowledge/markdown/status — 获取文档状态（mtime/hash）
router.get('/markdown/status', (req, res) => {
  try {
    const { path: relPath } = req.query;
    if (!relPath) return res.fail('path is required');

    const mdRoot = path.resolve(paths.mdLibraryRoot());
    const fullPath = path.resolve(mdRoot, relPath);

    // 闃叉璺緞绌胯秺
    if (!isInsidePath(mdRoot, fullPath)) {
      return res.fail('invalid path: outside markdown library', 1, 403);
    }

    if (!fs.existsSync(fullPath)) {
      return res.fail('file not found', 1, 404);
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return res.fail('not a file', 1, 400);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

    res.ok({
      path: relPath,
      mtime: stats.mtimeMs,
      size: stats.size,
      hash,
      exists: true,
    });
  } catch (e) {
    res.fail(e.message, 1, 500);
  }
});

module.exports = router;







