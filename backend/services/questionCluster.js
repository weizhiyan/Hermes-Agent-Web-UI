const STOP_WORDS = new Set([
  '帮我', '帮忙', '请问', '请你', '一下', '一个', '这个', '那个', '应该', '如何', '怎么', '怎样',
  '设计', '优化', '生成', '实现', '吗', '呢', '吧', '的', '了', '和', '与', '或', '以及',
  '页面', '功能', '系统', '模块', '需求', '方案', '问题', '内容', '项目'
]);

const DOMAIN_HINTS = [
  { category: 'UI设计', words: ['页面', '界面', '视觉', '布局', '组件', '表格', '导航', '登录', '回收站', '按钮', '交互'] },
  { category: 'Prompt', words: ['prompt', '提示词', '指令', '角色', '上下文', '结构化输出'] },
  { category: 'Agent', words: ['agent', '智能体', '工具', '工作流', '自动化', '任务'] },
  { category: '知识库', words: ['知识库', '知识图谱', '记忆', '沉淀', '向量', 'embedding', '检索'] },
  { category: '产品设计', words: ['产品', '需求', '规划', '原型', '流程', '用户'] },
];

const COMMON_PHRASES = ['回收站', '知识图谱', '提示词', '知识库', '登录页', '导航栏', '批量删除', '恢复机制', '二次确认', '智能体'];

function normalizeText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:\[\]（）(){}<>"'`~@#$%^&*_+=|\\/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuestionWords(text = '') {
  return String(text || '')
    .replace(/帮我|帮忙|请问|请你|一下|应该|如何|怎么|怎样|设计|优化|生成|实现/g, '')
    .replace(/页面|功能|系统|模块|需求|方案|问题|内容|项目/g, '')
    .trim();
}

function tokenizeChinese(text = '') {
  const normalized = normalizeText(text);
  const raw = normalized.match(/[\u4e00-\u9fa5a-z0-9]{2,}/g) || [];
  const tokens = [];
  for (const phrase of COMMON_PHRASES) {
    if (normalized.includes(phrase.toLowerCase())) tokens.push(phrase);
  }
  for (const item of raw) {
    const compact = stripQuestionWords(item);
    if (/^[a-z0-9]{2,}$/i.test(compact) && !STOP_WORDS.has(compact)) tokens.push(compact);
    const source = compact || item;
    if (/^[\u4e00-\u9fa5]{2,}$/.test(source) && !STOP_WORDS.has(source) && source.length <= 6) tokens.push(source);
    if (/^[\u4e00-\u9fa5]{3,}$/.test(source)) {
      for (let size = Math.min(4, source.length); size >= 2; size--) {
        for (let i = 0; i <= source.length - size; i++) {
          const part = source.slice(i, i + size);
          if (!STOP_WORDS.has(part)) tokens.push(part);
        }
      }
    }
  }
  return tokens;
}

function extractKeywords(text = '') {
  const tokens = tokenizeChinese(text);
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length))
    .map(([token]) => token)
    .filter(token => token.length >= 2 && token.length <= 8 && !STOP_WORDS.has(token))
    .slice(0, 8);
}

function inferCategory(text = '', fallback = '未分类') {
  const lower = String(text || '').toLowerCase();
  let best = null;
  for (const item of DOMAIN_HINTS) {
    const score = item.words.reduce((sum, word) => sum + (lower.includes(word.toLowerCase()) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { category: item.category, score };
  }
  return best ? best.category : fallback;
}

function buildQuestionMeta(text = '', fallbackCategory = '未分类') {
  const normalizedText = normalizeText(text);
  const keywords = extractKeywords(text);
  const category = inferCategory(text, fallbackCategory);
  const clusterKey = [category, ...keywords.slice(0, 3)].join(':') || normalizedText.slice(0, 32);
  return { normalizedText, keywords, category, clusterKey };
}

function buildClusterTitle(text = '', meta = {}) {
  const keywords = meta.keywords || [];
  if (keywords.length >= 2) return keywords.slice(0, 3).join(' / ');
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 30 ? clean.slice(0, 30) + '...' : clean || '未命名问题';
}

module.exports = {
  normalizeText,
  extractKeywords,
  inferCategory,
  buildQuestionMeta,
  buildClusterTitle,
};
