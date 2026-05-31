/**
 * AI Knowledge Analyzer — 知识点评分与自动分类
 * 用户主动触发，非自动执行。
 */
const store = require('./store');
const llm = require('./llm');

const CATEGORIES = ['UI设计', 'Prompt', '生图', 'Agent', '项目需求', '周报', '教程', '技术方案', '临时'];
const DEFAULT_MARKDOWN_CATEGORIES = ['输出文档', '问题沉淀', 'Prompt模板', '项目经验', '生图记录', '工作流', '规则与偏好'];
const QUALITIES = ['green', 'yellow', 'orange', 'red', 'gray'];

function normalizeCategoryList(categories, fallback = CATEGORIES) {
  const seen = new Set();
  const list = (Array.isArray(categories) ? categories : [])
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .filter(v => {
      if (seen.has(v)) return false;
      seen.add(v);
      return true;
    });
  return list.length ? list : fallback;
}

function buildAnalyzeSystemPrompt(categories = CATEGORIES) {
  const categoryList = normalizeCategoryList(categories, CATEGORIES);
  return `你是一个知识质量评估和分类助手。用户会给你一段提问/知识内容，你需要：

1. 从以下分类中选择最匹配的一个：${categoryList.join('、')}
2. 评估提问质量，给出评级和理由

质量评级标准：
- green（高质量）：提问清晰、逻辑严谨、有明确上下文、可复用性高
- yellow（普通）：提问基本清楚但缺少部分上下文或细节
- orange（可优化）：描述模糊、逻辑不完整、AI 难以高效回答
- red（逻辑混乱）：表述混乱、缺少基本结构、建议重构
- gray（临时）：临时内容、无法判断、或不适合评估

请严格按照以下 JSON 格式返回，不要添加任何其他内容：
{"category":"分类名","quality":"评级","quality_reason":"简短理由（20字内）","tags":["标签1","标签2"]}`;
}

function pickUsableConfig(modelsConfig = {}) {
  const webuiConfig = modelsConfig.webui || {};
  const agentConfig = modelsConfig.agent || {};
  const webuiLibrary = Array.isArray(webuiConfig.library) ? webuiConfig.library : [];
  const agentLibrary = Array.isArray(agentConfig.library) ? agentConfig.library : [];
  const webuiUsable = !!(webuiConfig.current || webuiConfig.scenarios?.chat || webuiConfig.scenarios?.reasoning || webuiLibrary.some(m => m.enabled !== false));
  if (webuiUsable) return webuiConfig;
  return agentConfig;
}

function getModelConfig() {
  const settings = store.read('settings', {}) || {};
  const modelsConfig = store.read('models', {}) || {};
  const activeConfig = pickUsableConfig(modelsConfig);
  const current = activeConfig.current || activeConfig.scenarios?.reasoning || activeConfig.scenarios?.chat || settings.hermesModel || '';
  return {
    settings,
    modelsConfig: activeConfig,
    ...activeConfig,
    current,
    library: activeConfig.library || [],
    params: activeConfig.params || {},
  };
}

async function analyzeContent(title, content, options = {}) {
  const cfg = getModelConfig();
  const allowedCategories = normalizeCategoryList(options.categories || options.markdownCategories, CATEGORIES);
  const text = `标题：${title || '无标题'}\n\n内容：\n${(content || '').slice(0, 3000)}`;

  const messages = [
    { role: 'system', content: buildAnalyzeSystemPrompt(allowedCategories) },
    { role: 'user', content: text },
  ];

  let result = '';
  const streamCfg = {
    ...cfg,
    forceDirect: true,
    _abortSignal: null,
  };

  try {
    for await (const event of llm.chatStream(streamCfg, messages)) {
      if (event.type === 'token') result += event.text;
      if (event.type === 'error') throw new Error(event.text);
    }
  } catch (e) {
    return {
      category: '临时',
      quality: 'gray',
      quality_reason: 'AI 分析失败',
      tags: [],
      error: e.message,
    };
  }

  // Parse JSON from result
  const jsonMatch = result.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    return {
      category: '临时',
      quality: 'gray',
      quality_reason: 'AI 返回格式异常',
      tags: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      category: allowedCategories.includes(parsed.category) ? parsed.category : '临时',
      quality: QUALITIES.includes(parsed.quality) ? parsed.quality : 'gray',
      quality_reason: String(parsed.quality_reason || '').slice(0, 50),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
    };
  } catch {
    return {
      category: '临时',
      quality: 'gray',
      quality_reason: 'JSON 解析失败',
      tags: [],
    };
  }
}

module.exports = {
  analyzeContent,
  CATEGORIES,
  DEFAULT_MARKDOWN_CATEGORIES,
  QUALITIES,
  normalizeCategoryList,
};
