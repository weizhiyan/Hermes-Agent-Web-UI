import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ConfigProvider, theme as antdTheme, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import KnowledgeGraph from './components/KnowledgeGraph';
import './styles.css';

const CATEGORY_COLORS = {
  '主对话': 'var(--c-block-lime)',
  '问题沉淀': 'var(--c-block-lilac)',
  '文档梳理': 'var(--c-block-mint)',
  '产品设计': 'var(--c-block-cream)',
  '表达增强': 'var(--c-block-mint)',
  '生图研究': 'var(--c-block-coral)',
  '输出文档': 'var(--c-block-lime)',
  '生图记录': 'var(--c-block-coral)',
  '临时收件箱': 'var(--c-block-cream)',
  '临时': 'var(--c-surface2)',
  '未分类': 'var(--c-surface2)',
};

const RANGE_OPTIONS = [
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: 'all', label: '全部' },
];

const VIEW_OPTIONS = [
  { key: 'graph', label: '知识图谱', icon: 'graph' },
  { key: 'list', label: '列表', icon: 'list' },
  { key: 'stats', label: '统计图', icon: 'stats' },
];

const QUALITY_LABELS = { green: '优秀', yellow: '可用', orange: '待优化', red: '需重写', gray: '未分析' };

function getApiBase() {
  try {
    if (window.__HERMES_API_BASE) return window.__HERMES_API_BASE;
    return window.location.origin;
  } catch {
    return 'http://127.0.0.1:3381';
  }
}

async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.msg || 'API error');
  return data.data;
}

function buildQuery(range) {
  const params = new URLSearchParams();
  params.set('range', range);
  return `?${params.toString()}`;
}

function formatDate(seconds) {
  if (!seconds) return '-';
  return new Date(seconds * 1000).toLocaleDateString('zh-CN');
}

function qualityLabel(value) {
  return QUALITY_LABELS[value] || value || '未分析';
}

function previewText(node) {
  const examples = Array.isArray(node?.example_questions) ? node.example_questions : [];
  return examples[0] || node?.prompt_text || node?.summary || node?.md_content || '\u6682\u65e0\u539f\u5bf9\u8bdd\u5185\u5bb9';
}

function reportLabel(status, frequency) {
  if (status === 'generated') return '\u5df2\u751f\u6210\u62a5\u544a';
  if ((frequency || 1) >= 5) return '\u5f85\u751f\u6210\u62a5\u544a';
  return '\u4f4e\u9891\u4fdd\u5b58';
}

function ViewIcon({ type }) {
  if (type === 'list') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>;
  if (type === 'stats') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="7" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="18" cy="17" r="2.5"/><circle cx="7" cy="18" r="2.5"/><path d="m8.3 8.3 7.1 6.9"/><path d="m15 7-6.5 9"/><path d="M8.8 18h6.7"/></svg>;
}

function EmptyPanel({ loading }) {
  if (loading) return <div className="kg-panel-state"><div className="kg-loading-dots"><span></span><span></span><span></span></div></div>;
  return <div className="kg-panel-state">\u5f53\u524d\u65f6\u95f4\u8303\u56f4\u5185\u6682\u65e0\u63d0\u95ee\u6570\u636e</div>;
}

function QuestionList({ nodes, loading, onGenerateReport, reportLoadingId }) {
  if (!nodes.length) return <EmptyPanel loading={loading} />;
  return (
    <div className="kg-list-view kg-webui-list">
      {nodes.map(node => {
        const keywords = Array.isArray(node.keywords) ? node.keywords : [];
        const examples = Array.isArray(node.example_questions) ? node.example_questions : [];
        return (
          <article className="kg-question-card kg-webui-card" key={node.id}>
            <div className="kg-question-main">
              <div className="kg-question-head">
                <span className="kg-question-title">{node.title}</span>
                <span className="kg-pill kg-webui-tag">{node.category || '\u672a\u5206\u7c7b'}</span>
              </div>
              <p className="kg-question-summary">{previewText(node)}</p>
              {keywords.length ? <div className="kg-keywords">{keywords.slice(0, 5).map(word => <span className="kg-pill" key={word}>{word}</span>)}</div> : null}
              {examples.length > 1 ? <p className="kg-question-summary">典型问题：{examples.slice(0, 3).join(' / ')}</p> : null}
            </div>
            <div className="kg-question-side">
              <span>更新：{formatDate(node.last_question_at || node.updated_at || node.created_at)}</span>
              <span>出现：{node.frequency || 1} 次</span>
              <span>关联：{node.relations || 0}</span>
              <span>{reportLabel(node.report_status, node.frequency)}</span>
              <button className="kg-mini-btn" type="button" onClick={() => onGenerateReport(node)} disabled={reportLoadingId === node.id}>{reportLoadingId === node.id ? '\u751f\u6210\u4e2d\u2026' : '\u5355\u7c07\u62a5\u544a'}</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BarList({ items, color }) {
  const max = Math.max(1, ...items.map(item => item.count));
  return (
    <div className="kg-bars">
      {items.map(item => (
        <div className="kg-bar-row" key={item.name || item.date}>
          <div className="kg-bar-label">{item.name || item.date}</div>
          <div className="kg-bar-track"><div className="kg-bar-fill" style={{ width: `${(item.count / max) * 100}%`, background: color }} /></div>
          <div className="kg-bar-value">{item.count}</div>
        </div>
      ))}
    </div>
  );
}

function NodeDetail({ node, onClose }) {
  if (!node) return null;
  const keywords = Array.isArray(node.keywords) ? node.keywords : [];
  const examples = Array.isArray(node.example_questions) ? node.example_questions : [];
  return (
    <aside className="kg-node-detail">
      <button className="kg-detail-close" type="button" onClick={onClose} aria-label="关闭详情">×</button>
      <div className="kg-detail-eyebrow">高频问题簇</div>
      <h2>{node.title}</h2>
      <p>{previewText(node)}</p>
      <div className="kg-detail-meta">
        <span>{node.category || '\u672a\u5206\u7c7b'}</span>
        <span>出现：{node.frequency || 1} 次</span>
        <span>关联：{node.relations || 0}</span>
        <span>{reportLabel(node.report_status, node.frequency)}</span>
      </div>
      {keywords.length ? <div className="kg-keywords">{keywords.map(word => <span className="kg-pill" key={word}>{word}</span>)}</div> : null}
      {examples.length ? <div className="kg-detail-path">典型问题：{examples.slice(0, 5).join(' / ')}</div> : null}
      {node.md_path ? <div className="kg-detail-path" title={node.md_path}>{node.md_path}</div> : null}
    </aside>
  );
}

function StatsView({ stats, loading }) {
  if (loading || !stats) return <EmptyPanel loading={loading} />;
  const qualityItems = Object.entries(stats.qualities || {}).map(([name, count]) => ({ name: qualityLabel(name), count }));
  const timeline = stats.timeline || [];
  return (
    <div className="kg-stats-view kg-webui-stats">
      <div className="kg-stat-grid">
        <div className="kg-stat-card kg-webui-card"><span>问题总数</span><strong>{stats.total || 0}</strong></div>
        <div className="kg-stat-card kg-webui-card"><span>问题簇</span><strong>{stats.clusters || 0}</strong></div>
        <div className="kg-stat-card kg-webui-card"><span>高频簇 ≥5</span><strong>{stats.reusable || 0}</strong></div>
      </div>
      <section className="kg-chart-card kg-webui-card"><h3>领域分类分布</h3><BarList items={stats.categories || []} color="var(--c-ink)" /></section>
      <section className="kg-chart-card kg-webui-card"><h3>分析状态分布</h3><BarList items={qualityItems} color="var(--c-ink-muted)" /></section>
      <section className="kg-chart-card kg-webui-card"><h3>时间趋势</h3><BarList items={timeline.slice(-14)} color="var(--c-ink)" /></section>
    </div>
  );
}

function buildLayeredGraph(nodes = [], baseEdges = []) {
  const graphNodes = [];
  const graphEdges = [];
  const categoryMap = new Map();

  for (const node of nodes) {
    const category = node.category || '\u672a\u5206\u7c7b';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { id: `category:${category}`, title: category, category, node_type: 'domain', frequency: 0, relations: 0, summary: '\u9886\u57df\u5206\u7c7b' });
    }
    const categoryNode = categoryMap.get(category);
    categoryNode.frequency += node.frequency || 1;
    categoryNode.relations += 1;
  }

  graphNodes.push(...categoryMap.values());
  for (const node of nodes) {
    const category = node.category || '\u672a\u5206\u7c7b';
    const clusterNode = { ...node, node_type: 'cluster', title: node.title || previewText(node) };
    graphNodes.push(clusterNode);
    graphEdges.push({ id: `edge:${category}:${node.id}`, source: `category:${category}`, target: node.id, type: 'contains', strength: 0.8 });

    const examples = Array.isArray(node.example_questions) ? node.example_questions.slice(0, 3) : [];
    examples.forEach((question, index) => {
      const id = `question:${node.id}:${index}`;
      graphNodes.push({ id, title: question.length > 24 ? `${question.slice(0, 24)}...` : question, summary: question, prompt_text: question, category, node_type: 'question', frequency: 1, relations: 1, parent_id: node.id });
      graphEdges.push({ id: `edge:${node.id}:${index}`, source: node.id, target: id, type: 'example', strength: 0.45 });
    });
  }

  for (const edge of baseEdges || []) {
    if (nodes.some(node => node.id === edge.source) && nodes.some(node => node.id === edge.target)) graphEdges.push(edge);
  }
  return { nodes: graphNodes, edges: graphEdges };
}

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [stats, setStats] = useState(null);
  const [highlightCategory, setHighlightCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => new URLSearchParams(window.location.search).get('theme') || document.documentElement.getAttribute('data-theme') || 'light');
  const [range, setRange] = useState('30d');
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'graph');
  const [actionLoading, setActionLoading] = useState(false);
  const [nodeReportLoading, setNodeReportLoading] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [reportFilter, setReportFilter] = useState('all');
  const [sortBy, setSortBy] = useState('frequency');
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    function handleMessage(e) {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'theme') {
        const nextTheme = msg.theme || msg.value || 'dark';
        setTheme(nextTheme);
      }
      if (msg.type === 'api-base' || msg.apiBase) window.__HERMES_API_BASE = msg.value || msg.apiBase;
      if (msg.type === 'refresh') setRefreshKey(key => key + 1);
      if (msg.type === 'set-view' && msg.view) setView(msg.view);
    }
    window.addEventListener('message', handleMessage);
    try { window.parent.postMessage({ type: 'request-theme' }, '*'); } catch {}
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const query = useMemo(() => buildQuery(range), [range]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [graph, nextStats] = await Promise.all([
        apiFetch(`/api/knowledge/graph${query}`),
        apiFetch(`/api/knowledge/stats${query}`),
      ]);
      setGraphData(graph);
      setStats(nextStats);
    } catch (e) {
      messageApi.error('\u540c\u6b65\u5931\u8d25: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [messageApi, query]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const handleNodeClick = useCallback(async (node) => {
    setHighlightCategory(prev => prev === node.category ? null : node.category);
  }, []);

  const handleBgClick = useCallback(() => {
    setHighlightCategory(null);
  }, []);


  const syncQuestions = useCallback(async () => {
    setActionLoading('sync');
    try {
      const result = await apiFetch('/api/knowledge/sync-prompts', { method: 'POST', body: JSON.stringify({ minFrequency: 5 }) });
      messageApi.success(`\u540c\u6b65\u5b8c\u6210\uff1a\u65b0\u589e ${result.synced || 0} \u4e2a\u95ee\u9898\u7c07\uff0c\u5408\u5e76 ${result.duplicated || 0} \u6761\u76f8\u4f3c\u95ee\u9898`);
      setRefreshKey(key => key + 1);
    } catch (e) {
      messageApi.error('\u540c\u6b65\u5931\u8d25: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  }, [messageApi]);

  const generateNodeReport = useCallback(async (node) => {
    if (!node?.id || node.node_type) return;
    setNodeReportLoading(node.id);
    try {
      const result = await apiFetch(`/api/knowledge/nodes/${node.id}/report`, { method: 'POST', body: '{}' });
      messageApi.success(`\u5355\u7c07\u62a5\u544a\u5df2\u751f\u6210\uff1a${result.file || result.title || ''}`);
      try { window.parent.postMessage({ type: 'artifact-refresh', path: result.file || result.path, title: result.title }, '*'); } catch {}
      setRefreshKey(key => key + 1);
    } catch (e) {
      messageApi.error('\u751f\u6210\u5355\u7c07\u62a5\u544a\u5931\u8d25: ' + e.message);
    } finally {
      setNodeReportLoading('');
    }
  }, [messageApi]);

  const generateTop20Report = useCallback(async () => {
    setActionLoading('top20');
    try {
      const result = await apiFetch(`/api/knowledge/report/top20${query}`, { method: 'POST', body: '{}' });
      messageApi.success(`Top20\u62a5\u544a\u5df2\u751f\u6210\uff1a${result.file || result.title || ''}`);
      try { window.parent.postMessage({ type: 'artifact-refresh', path: result.file || result.path, title: result.title }, '*'); } catch {}
    } catch (e) {
      messageApi.error('\u751f\u6210Top20\u62a5\u544a\u5931\u8d25: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  }, [messageApi, query]);

  const generateReport = useCallback(async () => {
    setActionLoading('report');
    try {
      const result = await apiFetch(`/api/knowledge/report${query}`, { method: 'POST', body: '{}' });
      messageApi.success(`知识报告已生成：${result.file || result.title || ''}`);
      try { window.parent.postMessage({ type: 'artifact-refresh', path: result.file || result.path, title: result.title }, '*'); } catch {}
    } catch (e) {
      messageApi.error('\u751f\u6210\u62a5\u544a\u5931\u8d25: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  }, [messageApi, query]);


  const baseNodes = useMemo(() => graphData.nodes || [], [graphData.nodes]);
  const categories = useMemo(() => [...new Set(baseNodes.map(node => node.category || '').filter(Boolean))].sort(), [baseNodes]);
  const filteredNodes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const matched = baseNodes.filter(node => {
      if (categoryFilter && (node.category || '') !== categoryFilter) return false;
      if (reportFilter === 'high' && (node.frequency || 1) < 5) return false;
      if (reportFilter === 'pending' && !((node.frequency || 1) >= 5 && node.report_status !== 'generated')) return false;
      if (reportFilter === 'generated' && node.report_status !== 'generated') return false;
      if (!keyword) return true;
      const haystack = [node.title, node.summary, node.prompt_text, node.category, ...(node.keywords || []), ...(node.example_questions || [])].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
    return matched.sort((a, b) => {
      if (sortBy === 'updated') return (b.last_question_at || b.updated_at || 0) - (a.last_question_at || a.updated_at || 0);
      if (sortBy === 'category') return String(a.category || '').localeCompare(String(b.category || ''), 'zh-CN');
      return (b.frequency || 1) - (a.frequency || 1);
    });
  }, [baseNodes, categoryFilter, reportFilter, search, sortBy]);
  const layeredGraph = useMemo(() => buildLayeredGraph(filteredNodes, graphData.edges || []), [filteredNodes, graphData.edges]);

  const isDarkMode = theme === 'dark';

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm, token: { borderRadius: 10, colorPrimary: 'var(--c-ink)', colorBgElevated: 'var(--c-input-bg)', colorText: 'var(--c-ink)', colorTextSecondary: 'var(--c-ink-muted)', colorBorder: 'var(--c-hairline)', fontFamily: "'Alibaba PuHuiTi 3', system-ui, sans-serif" } }}>
      {contextHolder}
      <div className="kg-app" data-theme={theme}>
        <header className="kg-toolbar kg-webui-toolbar">
          <div className="kg-toolbar-group kg-webui-filterbar">
            {RANGE_OPTIONS.map(option => <button key={option.key} className={`kg-webui-chip ${range === option.key ? 'active' : ''}`} onClick={() => setRange(option.key)} type="button">{option.label}</button>)}
            <div className="kg-toolbar-actions">
              <input className="kg-search-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索问题 / 关键词" />
              <select className="kg-select" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                <option value="">全部分类</option>
                {categories.map(category => <option value={category} key={category}>{category}</option>)}
              </select>
              <select className="kg-select" value={reportFilter} onChange={event => setReportFilter(event.target.value)}>
                <option value="all">全部问题</option>
                <option value="high">?? ?5</option>
                <option value="pending">待报告</option>
                <option value="generated">已报告</option>
              </select>
              <select className="kg-select" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="frequency">按频次</option>
                <option value="updated">按更新</option>
                <option value="category">按分类</option>
              </select>
              <button className="kg-action-btn kg-webui-action" type="button" onClick={generateTop20Report} disabled={!!actionLoading}>{actionLoading === 'top20' ? '\u751f\u6210\u4e2d\u2026' : 'Top20\u62a5\u544a'}</button>
              <button className="kg-action-btn kg-webui-action" type="button" onClick={generateReport} disabled={!!actionLoading}>{actionLoading === 'report' ? '\u751f\u6210\u4e2d\u2026' : '\u751f\u6210\u62a5\u544a'}</button>
              <button className="kg-action-btn kg-webui-action" type="button" onClick={syncQuestions} disabled={!!actionLoading}>{actionLoading === 'sync' ? '\u540c\u6b65\u4e2d\u2026' : '\u540c\u6b65\u95ee\u9898'}</button>
            </div>
          </div>

        </header>
        <main className="kg-main">
          {view === 'graph' && <KnowledgeGraph nodes={layeredGraph.nodes} edges={layeredGraph.edges} categoryColors={CATEGORY_COLORS} highlightCategory={highlightCategory} onNodeClick={handleNodeClick} onBgClick={handleBgClick} loading={loading} isDark={isDarkMode} />}
          {view === 'list' && <QuestionList nodes={filteredNodes} loading={loading} onGenerateReport={generateNodeReport} reportLoadingId={nodeReportLoading} />}
          {view === 'stats' && <StatsView stats={stats} loading={loading} />}
        </main>
      </div>
    </ConfigProvider>
  );
}

