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
  return node?.prompt_text || node?.summary || node?.md_content || '暂无原对话内容';
}

function ViewIcon({ type }) {
  if (type === 'list') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>;
  if (type === 'stats') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="7" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="18" cy="17" r="2.5"/><circle cx="7" cy="18" r="2.5"/><path d="m8.3 8.3 7.1 6.9"/><path d="m15 7-6.5 9"/><path d="M8.8 18h6.7"/></svg>;
}

function EmptyPanel({ loading }) {
  if (loading) return <div className="kg-panel-state"><div className="kg-loading-dots"><span></span><span></span><span></span></div></div>;
  return <div className="kg-panel-state">当前时间范围内暂无提问数据</div>;
}

function QuestionList({ nodes, loading }) {
  if (!nodes.length) return <EmptyPanel loading={loading} />;
  return (
    <div className="kg-list-view kg-webui-list">
      {nodes.map(node => (
        <article className="kg-question-card kg-webui-card" key={node.id}>
          <div className="kg-question-main">
            <div className="kg-question-head">
              <span className="kg-question-title">{node.title}</span>
              <span className="kg-pill kg-webui-tag">{node.category || '未分类'}</span>
            </div>
            <p className="kg-question-summary">{previewText(node)}</p>
          </div>
          <div className="kg-question-side">
            <span>{formatDate(node.created_at)}</span>
            <span>质量：{qualityLabel(node.quality)}</span>
            <span>频次：{node.frequency || 1}</span>
            {node.relations ? <span>关系：{node.relations}</span> : null}
          </div>
        </article>
      ))}
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
  return (
    <aside className="kg-node-detail">
      <button className="kg-detail-close" type="button" onClick={onClose} aria-label="关闭详情">×</button>
      <div className="kg-detail-eyebrow">原对话</div>
      <h2>{node.title}</h2>
      <p>{previewText(node)}</p>
      <div className="kg-detail-meta">
        <span>{node.category || '未分类'}</span>
        <span>质量：{qualityLabel(node.quality)}</span>
        <span>频次：{node.frequency || 1}</span>
        <span>关系：{node.relations || 0}</span>
      </div>
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
        <div className="kg-stat-card kg-webui-card"><span>可复用线索</span><strong>{stats.reusable || 0}</strong></div>
        <div className="kg-stat-card kg-webui-card"><span>分类数量</span><strong>{(stats.categories || []).length}</strong></div>
      </div>
      <section className="kg-chart-card kg-webui-card"><h3>办公场景分布</h3><BarList items={stats.categories || []} color="var(--c-ink)" /></section>
      <section className="kg-chart-card kg-webui-card"><h3>质量分布</h3><BarList items={qualityItems} color="var(--c-ink-muted)" /></section>
      <section className="kg-chart-card kg-webui-card"><h3>时间趋势</h3><BarList items={timeline.slice(-14)} color="var(--c-ink)" /></section>
    </div>
  );
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
  const [refreshKey, setRefreshKey] = useState(0);
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
      messageApi.error('加载提问分析失败: ' + e.message);
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
    setActionLoading(true);
    try {
      const result = await apiFetch('/api/knowledge/sync-prompts', { method: 'POST', body: '{}' });
      messageApi.success(`同步完成：新增 ${result.synced || 0} 条，重复 ${result.duplicated || 0} 条`);
      setRefreshKey(key => key + 1);
    } catch (e) {
      messageApi.error('同步失败: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  }, [messageApi]);

  const isDarkMode = theme === 'dark';

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm, token: { borderRadius: 10, colorPrimary: 'var(--c-ink)', colorBgElevated: 'var(--c-input-bg)', colorText: 'var(--c-ink)', colorTextSecondary: 'var(--c-ink-muted)', colorBorder: 'var(--c-hairline)', fontFamily: "'Alibaba PuHuiTi 3', system-ui, sans-serif" } }}>
      {contextHolder}
      <div className="kg-app" data-theme={theme}>
        <header className="kg-toolbar kg-webui-toolbar">
          <div className="kg-toolbar-group kg-webui-filterbar">
            {RANGE_OPTIONS.map(option => <button key={option.key} className={`kg-webui-chip ${range === option.key ? 'active' : ''}`} onClick={() => setRange(option.key)} type="button">{option.label}</button>)}
            {view === 'graph' && <button className="kg-action-btn kg-webui-action" type="button" onClick={syncQuestions} disabled={actionLoading}>{actionLoading ? '同步中…' : '同步问题'}</button>}
          </div>

        </header>
        <main className="kg-main">
          {view === 'graph' && <KnowledgeGraph nodes={graphData.nodes} edges={graphData.edges} categoryColors={CATEGORY_COLORS} highlightCategory={highlightCategory} onNodeClick={handleNodeClick} onBgClick={handleBgClick} loading={loading} isDark={isDarkMode} />}
          {view === 'list' && <QuestionList nodes={graphData.nodes} loading={loading} />}
          {view === 'stats' && <StatsView stats={stats} loading={loading} />}
        </main>
      </div>
    </ConfigProvider>
  );
}

