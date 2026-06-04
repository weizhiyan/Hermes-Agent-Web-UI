/**
 * Hermes Agent — Artifact 面板 + 流式解析（参考 Claude Artifact 机制，适配 Hermes UI）
 * 依赖（由 index.html 引入）：marked, hljs, mermaid
 */
(function (global) {
  'use strict';

  const THINK_OPEN = '<think>';
  const THINK_CLOSE = '</think>';
  const ART_CLOSE = '</artifact>';

  function parseAttrs(tagInner) {
    const o = {};
    if (!tagInner) return o;
    const re = /(\w+)=["']([^"']*)["']/g;
    let m;
    while ((m = re.exec(tagInner))) o[m[1].toLowerCase()] = m[2];
    return o;
  }

  function stripClosedThinks(str) {
    return str
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi, '');
  }

  function extractTailThink(str) {
    const lo = str.lastIndexOf(THINK_OPEN);
    const lc = str.lastIndexOf(THINK_CLOSE);
    if (lo === -1 || lo <= lc) return { base: str, tail: '' };
    return { base: str.slice(0, lo), tail: str.slice(lo + THINK_OPEN.length) };
  }

  function extractCompletedArtifacts(str) {
    const out = [];
    const re = /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/gi;
    let m;
    while ((m = re.exec(str))) {
      out.push({ attrs: parseAttrs(m[1]), content: m[2], complete: true });
    }
    return out;
  }

  function stripCompletedArtifacts(str) {
    return str.replace(/<artifact\s+[^>]+>[\s\S]*?<\/artifact>/gi, '');
  }

  function stripLooseMarkdownMeta(markdown) {
    let text = String(markdown || '').replace(/^\uFEFF/, '').trimStart();
    text = text.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
    const lines = text.split(/\r?\n/);
    const metaRe = /^(title|folder|type|tags|status|summary|createdBy|created|updated|source)\s*:/i;
    let index = 0;
    let consumed = false;
    while (index < lines.length && (metaRe.test(lines[index].trim()) || (!lines[index].trim() && consumed))) {
      if (metaRe.test(lines[index].trim())) consumed = true;
      index += 1;
    }
    return consumed ? lines.slice(index).join('\n').trimStart() : text;
  }

  async function readJsonResponse(res, fallbackMessage) {
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      throw new Error(clean ? clean.slice(0, 120) : (fallbackMessage || '接口没有返回 JSON，可能需要重启 WebUI 后端'));
    }
    if (!res.ok || !data || data.code !== 0) throw new Error(data && data.msg ? data.msg : (fallbackMessage || '请求失败'));
    return data;
  }

  async function writeClipboardText(value) {
    const text = String(value || '');
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }

  function extractTailArtifact(str) {
    const re = /<artifact\s+([^>]+)>([\s\S]*)$/i;
    const m = re.exec(str);
    if (!m) return { base: str, active: null };
    const inner = m[2];
    if (inner.includes(ART_CLOSE)) return { base: str, active: null };
    return {
      base: str.slice(0, m.index),
      active: { attrs: parseAttrs(m[1]), content: inner, complete: false },
    };
  }

  function parseHermesStream(raw) {
    const s = String(raw || '');
    let think = '';
    s.replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner) => {
      think += inner;
      return '';
    });
    s.replace(/<redacted_thinking>([\s\S]*?)<\/redacted_thinking>/gi, (_, inner) => {
      think += inner;
      return '';
    });
    let noClosedThink = stripClosedThinks(s);
    const t2 = extractTailThink(noClosedThink);
    think += t2.tail;
    noClosedThink = t2.base;

    const completedArtifacts = extractCompletedArtifacts(noClosedThink);
    let vis = stripCompletedArtifacts(noClosedThink);
    const a2 = extractTailArtifact(vis);
    vis = a2.base.trim();
    const activeArtifact = a2.active;

    return {
      think,
      visibleText: vis,
      completedArtifacts,
      activeArtifact,
    };
  }

  const versionByTitle = new Map();
  let _prevCompletedArtifactCount = 0;

  function resetSession() {
    versionByTitle.clear();
    _prevCompletedArtifactCount = 0;
  }

  function recordCompletedArtifacts(arts) {
    for (const a of arts) {
      const title = (a.attrs && a.attrs.title) || 'artifact';
      const list = versionByTitle.get(title) || [];
      list.push({
        version: list.length + 1,
        type: (a.attrs.type || 'markdown').toLowerCase(),
        language: (a.attrs.language || '').toLowerCase(),
        path: a.attrs.path || '',
        content: a.content,
        ts: Date.now(),
      });
      versionByTitle.set(title, list);
    }
  }

  function typeLabel(type) {
    const t = (type || 'markdown').toLowerCase();
    if (t === 'code') return 'Code';
    if (t === 'html') return 'HTML';
    if (t === 'mermaid') return 'Mermaid';
    return 'Markdown';
  }

  let layout = 'CHAT_ONLY';
  let splitPct = 52;
  let dragActive = false;
  let _mdTimer = null;
  let _sourceSaveTimer = null;
  let _sourceSaveInFlight = false;
  let _sourceSavePending = false;
  let _sourceLastSaved = '';
  let _dragMode = 'split';
  let currentTitle = '';
  let currentFilePath = '';
  let currentTab = 'preview';
  let viewVersionIndex = -1;
  let historyMode = 'category:outputs';
  let knowledgeGraphView = 'graph';
  let _kgResizeObs = null;
  let historySubFilter = 'all';
  let historyCategoryMenuOpen = false;
  let historyCategoryMenuPos = null;
  let historyData = null;
  let historyPreview = null;
  let localEditContext = null;
  let lastEditHighlight = null;
  let _sourceOverlayRaf = 0;
  let _sourceOverlayScrollPending = false;
  let _sourceOverlayRetryCount = 0;
  let _sourceMetricsCache = null;
  let _sourceResizeObs = null;
  const DOC_FOLDERS = ['工作文档', 'AI分享', '教程', '笔记', '临时收件箱'];
  const autoSavedKeys = new Set();
  let _currentDocSnapshot = null;

  function namedIcon(name, size = 16, fallback = '') {
    return global.HermesIcons && typeof global.HermesIcons.svg === 'function'
      ? global.HermesIcons.svg(name, size, fallback)
      : fallback;
  }

  function renderToolbarIcon(kind) {
    if (kind === 'chat') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>';
    }
    if (kind === 'split') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg>';
    }
    if (kind === 'eye' || kind === 'preview') {
      return namedIcon('预览', 16, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/></svg>');
    }
    if (kind === 'code') {
      return namedIcon('代码', 16, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 9l-4 3 4 3"/><path d="M16 9l4 3-4 3"/><path d="M14 6l-4 12"/></svg>');
    }
    if (kind === 'copy') {
      return namedIcon('复制', 16, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M5 15V7a2 2 0 012-2h8"/></svg>');
    }
    if (kind === 'magic') {
      return namedIcon('局部编辑', 16, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4 5 5"/><path d="M14 5 4 15l-1 6 6-1L19 10"/><path d="M5 4v4"/><path d="M3 6h4"/><path d="M19 16v4"/><path d="M17 18h4"/></svg>');
    }
    if (kind === 'back') {
      return namedIcon('??', 16, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>');
    }
    if (kind === 'download') {
      return namedIcon('下载', 16, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/></svg>');
    }
    if (kind === 'library') {
      return namedIcon('知识库', 16, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="7" cy="6" r="1.2"/><circle cx="7" cy="12" r="1.2"/><circle cx="7" cy="18" r="1.2"/></svg>');
    }
    if (kind === 'refresh') {
      return '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 9.25C2.91421 9.25 3.25 9.58579 3.25 10C3.25 13.7279 6.27209 16.75 10 16.75C11.8211 16.75 13.4726 16.0301 14.6875 14.8574C14.9855 14.5697 15.4604 14.578 15.748 14.876C16.0356 15.174 16.0274 15.6489 15.7295 15.9365C14.2462 17.3683 12.2252 18.25 10 18.25C7.20848 18.25 4.74284 16.8621 3.25 14.7402V16.667C3.24982 17.0811 2.91411 17.417 2.5 17.417C2.0859 17.417 1.75018 17.0811 1.75 16.667V10C1.75 9.58579 2.08579 9.25 2.5 9.25ZM10 1.75C12.7912 1.75 15.2571 3.13729 16.75 5.25879V3.33301C16.75 2.91879 17.0858 2.58301 17.5 2.58301C17.9142 2.58301 18.25 2.91879 18.25 3.33301V10C18.2499 10.1551 18.2028 10.2993 18.1221 10.4189C18.068 10.499 17.999 10.568 17.9189 10.6221C17.7993 10.7028 17.6552 10.75 17.5 10.75C17.3448 10.75 17.2007 10.7028 17.0811 10.6221C17.001 10.568 16.932 10.499 16.8779 10.4189C16.7972 10.2993 16.7501 10.1551 16.75 10C16.75 6.27209 13.7279 3.25 10 3.25C8.09282 3.25 6.37105 4.03991 5.14258 5.3125C4.85488 5.61035 4.37999 5.61868 4.08203 5.33105C3.78435 5.04334 3.77592 4.56841 4.06348 4.27051C5.56292 2.71723 7.66926 1.75 10 1.75Z" fill="currentColor"/></svg>';
    }
    if (kind === 'chevron-down') {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>';
    }
    if (kind === 'close') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>';
    }
    if (kind === 'doc') {
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/></svg>';
    }
    if (kind === 'list') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
    }
    return '';
  }

  function loadSplit() {
    try {
      const v = parseFloat(localStorage.getItem('hermes.artifactSplit'));
      if (!Number.isNaN(v) && v >= 28 && v <= 82) splitPct = v;
    } catch (_) {}
  }

  function saveSplit() {
    try {
      localStorage.setItem('hermes.artifactSplit', String(splitPct));
    } catch (_) {}
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function apiBase() {
    try {
      const settings = global.state && global.state.settings;
      const api = settings && settings.api ? String(settings.api).trim().replace(/\/$/, '') : '';
      if (api) return api;
    } catch (_) {}
    if (global.location && /^https?:$/.test(global.location.protocol)) return '';
    return 'http://127.0.0.1:3381';
  }

  function publicApiBase() {
    const base = apiBase();
    if (base) return base.replace(/\/$/, '');
    if (global.location && /^https?:$/.test(global.location.protocol)) return global.location.origin;
    return 'http://127.0.0.1:3381';
  }

  function mediaUrl(url) {
    const text = String(url || '');
    if (!text) return '';
    if (/^https?:\/\//i.test(text) || /^data:/i.test(text)) return text;
    return publicApiBase() + '/' + text.replace(/^\/+/, '');
  }

  function fmtBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function fileNameFromPath(filePath) {
    return String(filePath || '').split(/[\\/]/).pop() || 'Markdown';
  }

  function hideExportMenu() {
    const menu = $('#artifactExportMenu');
    if (menu) menu.classList.remove('open');
  }

  function toggleExportMenu(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    if (!shouldShowArtifactExport()) {
      hideExportMenu();
      return;
    }
    const menu = $('#artifactExportMenu');
    if (!menu) return;
    menu.classList.toggle('open');
  }

  function refreshCurrentView() {
    hideExportMenu();
    const refreshBtn = $('#artifactRefreshBtn');
    if (refreshBtn) {
      refreshBtn.classList.remove('is-refreshing');
      void refreshBtn.offsetWidth;
      refreshBtn.classList.add('is-refreshing');
      setTimeout(() => refreshBtn.classList.remove('is-refreshing'), 650);
    }
    if (currentTab === 'history') {
      if (historyPreview && historyPreview.path) {
        const encodedPath = encodeURIComponent(historyPreview.path);
        const encodedName = encodeURIComponent(fileNameFromPath(historyPreview.path));
        previewHistoryFile(encodedPath, encodedName);
        return;
      }
      loadHistory();
      return;
    }
    if (currentFilePath) {
      previewHistoryFile(encodeURIComponent(currentFilePath), encodeURIComponent(currentTitle || fileNameFromPath(currentFilePath)));
      return;
    }
    const list = getVersionList(currentTitle);
    const row = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex] : null;
    const typ = row ? row.type : 'markdown';
    const lang = row ? row.language : '';
    const body = getSourceText() || window.__hermesLastArtifactBody || '';
    const prev = $('#artifactPreview');
    if (currentTab === 'source') {
      syncSourceEditor(body);
    }
    if (prev && body) flushPreviewNow(typ, lang, body, prev);
  }

  function formatDocDate(ts) {
    return ts ? new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
  }

  function renderDocLibraryHeader(all, folders, tags) {
    const total = Array.isArray(all) ? all.length : 0;
    const resultText = `${total} 篇文档`;
    return `<div class="doc-library-head">
      <div class="doc-library-head-main">
        <div>
          <h3>知识库</h3>
          <p class="doc-library-subtitle">默认展示输出文档，其他沉淀分类可从右侧展开。</p>
        </div>
        <div class="doc-library-stats">
          <span>${esc(resultText)}</span>
          <span>${(folders || []).length} 个文件夹</span>
          <span>${(tags || []).length} 个标签</span>
        </div>
      </div>
    </div>`;
  }

  function renderDocListEmpty(message) {
    return `<div class="history-empty-docs">
      <h3>${esc('暂无文档')}</h3>
      <p>${esc(message || '生成 Markdown 后可在代码模式直接编辑，修改会自动保存到知识库。')}</p>
    </div>`;
  }


  function knowledgeNodeTone(file) {
    const text = [file.mdType, file.folder, file.type, ...(Array.isArray(file.tags) ? file.tags : [])].join(' ');
    if (/临时|未分类|inbox|temp/i.test(text)) return 'gray';
    if (/规则|偏好|Prompt|模板|项目经验|输出文档|高质量|复用/i.test(text)) return 'green';
    if (/生图|图片|image|工作流/i.test(text)) return 'yellow';
    if (/问题|沉淀|修改|优化/i.test(text)) return 'orange';
    if (/混乱|重构|错误/i.test(text)) return 'red';
    return 'gray';
  }

  function knowledgeGraphTheme() {
    const css = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => (css.getPropertyValue(name) || fallback || '').trim();
    return { bg: pick('--c-surface1', '#fff'), ink: pick('--c-ink', '#202124'), muted: pick('--c-ink-muted', '#8a8f98'), edge: pick('--c-hairline', 'rgba(0,0,0,.12)'), center: pick('--c-accent', '#1f7aff'), green: '#35a56a', yellow: '#d6a431', orange: '#e06f3d', red: '#d94b4b', gray: '#9aa3af' };
  }

  function knowledgeNodeTooltip(node) {
    if (!node) return '';
    if (node.type === 'root') return '<strong>知识库</strong><span>当前 Markdown / Prompt / 用户问题沉淀的关系入口。</span>';
    if (node.type === 'group') return '<strong>' + esc(node.label || '分类') + '</strong><span>分类节点，连接该分类下的知识点。</span>';
    return '<strong>' + esc(node.label || '未命名') + '</strong><span>' + esc(node.meta || '点击打开 Markdown') + '</span>';
  }

  function ensureKnowledgeTooltip(stage) {
    let tip = stage.querySelector('.knowledge-graph-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'knowledge-graph-tooltip';
      stage.appendChild(tip);
    }
    return tip;
  }

  function showKnowledgeTooltip(stage, node, x, y) {
    const tip = ensureKnowledgeTooltip(stage);
    tip.innerHTML = knowledgeNodeTooltip(node);
    tip.style.left = Math.min(stage.clientWidth - 220, Math.max(12, x + 14)) + 'px';
    tip.style.top = Math.min(stage.clientHeight - 96, Math.max(12, y + 14)) + 'px';
    tip.classList.add('show');
  }

  function hideKnowledgeTooltip(stage) {
    const tip = stage && stage.querySelector('.knowledge-graph-tooltip');
    if (tip) tip.classList.remove('show');
  }

  function buildKnowledgeGraphData(categories, all) {
    const groups = (categories || []).filter(group => (group.files || []).length);
    const sourceGroups = groups.length ? groups : [{ id: 'all', label: '全部', files: all || [] }];
    const nodes = [{ id: 'root', label: '知识库', type: 'root', tone: 'center', size: 38 }];
    const edges = [];
    sourceGroups.slice(0, 9).forEach((group, groupIndex) => {
      const groupId = 'group_' + (group.id || groupIndex);
      nodes.push({ id: groupId, label: group.label || group.folder || group.name || '临时', type: 'group', tone: knowledgeNodeTone({ folder: group.label || group.folder || group.name }), size: 23, groupIndex });
      edges.push({ source: 'root', target: groupId });
      (group.files || []).slice(0, 18).forEach((file, fileIndex) => {
        const title = file.title || file.file || file.name || '未命名';
        const id = groupId + '_file_' + fileIndex;
        nodes.push({ id, label: title, type: 'file', tone: knowledgeNodeTone(file), size: 8 + Math.min(5, Math.max(0, Math.round((String(title).length || 1) / 12))), path: file.path || '', name: title, groupIndex, fileIndex, meta: [file.mdType || file.folder || '', formatDocDate(file.mtime)].filter(Boolean).join(' · ') });
        edges.push({ source: groupId, target: id });
      });
    });
    return { nodes, edges };
  }

  function renderKnowledgeMap(categories, all) {
    const total = Array.isArray(all) ? all.length : 0;
    return '<div class="knowledge-map-panel">'
      + '<div class="knowledge-map-intro"><strong>AI 协作型知识地图</strong><span>中心是知识库，外围是分类与问题/Prompt/文档节点。点击小节点打开 Markdown。</span></div>'
      + '<div class="knowledge-map-legend"><span class="tone-green">高质量</span><span class="tone-yellow">普通</span><span class="tone-orange">待优化</span><span class="tone-red">混乱</span><span class="tone-gray">临时</span></div>'
      + '<div class="knowledge-graph-stage" id="knowledgeGraphStage" data-count="' + total + '"></div>'
      + '</div>';
  }

  function radialKnowledgePositions(data, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const groups = data.nodes.filter(n => n.type === 'group');
    const filesByGroup = new Map(groups.map(g => [g.id, data.nodes.filter(n => n.type === 'file' && n.id.startsWith(g.id + '_file_'))]));
    const radius = Math.min(width, height) * 0.22;
    const outer = Math.min(width, height) * 0.42;
    const pos = new Map([['root', { x: cx, y: cy }]]);
    groups.forEach((group, index) => {
      const angle = (-Math.PI / 2) + index * Math.PI * 2 / Math.max(groups.length, 1);
      const gx = cx + Math.cos(angle) * radius;
      const gy = cy + Math.sin(angle) * radius;
      pos.set(group.id, { x: gx, y: gy });
      const files = filesByGroup.get(group.id) || [];
      const spread = Math.min(Math.PI / 2.15, Math.PI * 2 / Math.max(groups.length, 2) * 0.82);
      files.forEach((file, fileIndex) => {
        const t = files.length <= 1 ? 0.5 : fileIndex / (files.length - 1);
        const fa = angle - spread / 2 + spread * t;
        const fr = outer * (0.68 + (fileIndex % 4) * 0.105);
        pos.set(file.id, { x: gx + Math.cos(fa) * fr * 0.58, y: gy + Math.sin(fa) * fr * 0.58 });
      });
    });
    return pos;
  }

  function renderKnowledgeGraphSvg(stage, data) {
    const theme = knowledgeGraphTheme();
    const rect = stage.getBoundingClientRect();
    const width = Math.max(520, Math.round(rect.width || stage.clientWidth || 760));
    const height = Math.max(420, Math.round(rect.height || 520));
    const pos = radialKnowledgePositions(data, width, height);
    const colorOf = tone => tone === 'center' ? theme.center : (theme[tone] || theme.gray);
    const edges = data.edges.map(edge => {
      const a = pos.get(edge.source), b = pos.get(edge.target);
      return a && b ? '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" />' : '';
    }).join('');
    const nodes = data.nodes.map(node => {
      const p = pos.get(node.id) || { x: width / 2, y: height / 2 };
      const label = node.type === 'file' ? '' : '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + node.size + 13).toFixed(1) + '">' + esc(node.label).slice(0, 8) + '</text>';
      const click = node.type === 'file' && node.path ? ' data-path="' + encodeURIComponent(node.path) + '" data-name="' + encodeURIComponent(node.name || node.label) + '"' : '';
      const hover = ' data-node-id="' + node.id + '"';
      return '<g class="kg-node kg-' + node.type + '"' + click + hover + ' style="--node-color:' + colorOf(node.tone) + '"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + node.size + '"/><title>' + esc([node.label, node.meta].filter(Boolean).join(' · ')) + '</title>' + label + '</g>';
    }).join('');
    stage.innerHTML = '<svg class="knowledge-graph-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="知识地图"><rect width="' + width + '" height="' + height + '" rx="18"/><g class="kg-edges">' + edges + '</g><g class="kg-nodes">' + nodes + '</g></svg>';
    const nodeById = new Map(data.nodes.map(item => [item.id, item]));
    stage.querySelectorAll('.kg-node[data-node-id]').forEach(el => {
      el.addEventListener('mouseenter', event => showKnowledgeTooltip(stage, nodeById.get(el.dataset.nodeId), event.offsetX, event.offsetY));
      el.addEventListener('mousemove', event => showKnowledgeTooltip(stage, nodeById.get(el.dataset.nodeId), event.offsetX, event.offsetY));
      el.addEventListener('mouseleave', () => hideKnowledgeTooltip(stage));
    });
    stage.querySelectorAll('.kg-file[data-path]').forEach(node => node.addEventListener('click', () => previewHistoryFile(node.dataset.path || '', node.dataset.name || '')));
  }

  function renderKnowledgeGraphG6(stage, data) {
    if (!global.G6 || !global.G6.Graph) return false;
    const theme = knowledgeGraphTheme();
    try {
      stage.innerHTML = '';
      if (stage._kgGraph && typeof stage._kgGraph.destroy === 'function') stage._kgGraph.destroy();
      const { Graph } = global.G6;
      const graph = new Graph({
        container: stage,
        autoFit: 'view',
        data: { nodes: data.nodes.map(node => ({ id: node.id, data: node, style: { labelText: node.type === 'file' ? '' : node.label, size: node.size * 2, fill: node.tone === 'center' ? theme.center : (theme[node.tone] || theme.gray), stroke: theme.bg, lineWidth: node.type === 'root' ? 2 : 1 } })), edges: data.edges.map(edge => ({ source: edge.source, target: edge.target, style: { stroke: theme.edge, lineWidth: 1 } })) },
        node: { style: { labelFill: theme.muted, labelFontSize: 11, labelPlacement: 'bottom' } },
        edge: { style: { stroke: theme.edge, lineWidth: 1 } },
        layout: { type: 'd3-force', link: { distance: 88, strength: 0.45 }, manyBody: { strength: -180 }, collide: { radius: 18 } },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        animation: false,
      });
      graph.on('node:pointerenter', evt => {
        const item = evt.item || evt.target;
        const model = typeof item?.getModel === 'function' ? item.getModel() : item?.data;
        const nodeData = model?.data || model;
        const box = stage.getBoundingClientRect();
        showKnowledgeTooltip(stage, nodeData, (evt.client?.x || evt.clientX || box.width / 2) - box.left, (evt.client?.y || evt.clientY || box.height / 2) - box.top);
      });
      graph.on('node:pointermove', evt => {
        const item = evt.item || evt.target;
        const model = typeof item?.getModel === 'function' ? item.getModel() : item?.data;
        const nodeData = model?.data || model;
        const box = stage.getBoundingClientRect();
        showKnowledgeTooltip(stage, nodeData, (evt.client?.x || evt.clientX || box.width / 2) - box.left, (evt.client?.y || evt.clientY || box.height / 2) - box.top);
      });
      graph.on('node:pointerleave', () => hideKnowledgeTooltip(stage));
      graph.on('node:click', evt => {
        const item = evt.item || evt.target;
        const model = typeof item?.getModel === 'function' ? item.getModel() : item?.data;
        const nodeData = model?.data || model;
        if (nodeData?.type === 'file' && nodeData.path) previewHistoryFile(encodeURIComponent(nodeData.path), encodeURIComponent(nodeData.name || nodeData.label || ''));
      });
      graph.render();
      stage._kgGraph = graph;
      return true;
    } catch (_) {
      return false;
    }
  }

  function initKnowledgeMapGraph(categories, all) {
    const stage = $('#knowledgeGraphStage');
    if (!stage) return;
    const data = buildKnowledgeGraphData(categories, all);
    requestAnimationFrame(() => {
      if (!renderKnowledgeGraphG6(stage, data)) renderKnowledgeGraphSvg(stage, data);
    });
  }
  function applyLayout() {
    const wb = $('#chatWorkbench');
    const shell = $('#artifactShell');
    const main = $('#chatMainPane');
    const rs = $('#artifactResizer');
    const toggleButton = document.querySelector('.header-toggle-panel-btn');
    if (!wb || !shell || !main) return;
    if (!document.body.contains(shell)) return;
    wb.dataset.layout = layout;
    const isOpen = layout !== 'CHAT_ONLY';
    if (toggleButton) {
      const nextLabel = isOpen ? '知识库已打开' : '打开知识库';
      toggleButton.classList.toggle('is-open', isOpen);
      toggleButton.setAttribute('title', nextLabel);
      toggleButton.setAttribute('aria-label', nextLabel);
    }
    if (layout === 'CHAT_ONLY') {
      shell.classList.remove('open', 'full');
      shell.classList.remove('artifact-focused');
      main.style.flex = '1 1 100%';
      main.style.width = '';
      wb.style.removeProperty('--artifact-chat-basis');
      main.style.minWidth = '';
      main.style.removeProperty('overflow');
      if (rs) rs.style.display = 'none';
      return;
    }
    if (rs) rs.style.display = '';
    if (layout === 'PREVIEW_ONLY') {
      shell.classList.add('open', 'full');
      main.style.flex = '0 0 0px';
      main.style.width = '0';
      main.style.minWidth = '0';
      main.style.overflow = 'hidden';
      scheduleSourceOverlaySync({ scrollToHighlight: false });
      return;
    }
    shell.classList.add('open');
    shell.classList.add('artifact-focused');
    shell.classList.remove('full');
    main.style.removeProperty('overflow');
    wb.style.setProperty('--artifact-chat-basis', `${splitPct}%`);
    main.style.flex = `0 0 var(--artifact-chat-basis, ${splitPct}%)`;
    main.style.width = '';
    main.style.minWidth = '280px';
    scheduleSourceOverlaySync({ scrollToHighlight: false });
  }

  function setLayout(mode) {
    if (mode === 'chat') layout = 'CHAT_ONLY';
    else if (mode === 'preview') layout = 'PREVIEW_ONLY';
    else layout = 'SPLIT_VIEW';
    applyLayout();
    syncToolbarActive();
  }

  function artifactDisplayTitle() {
    if (currentTab === 'history' && historyPreview) return historyPreview.title || fileNameFromPath(historyPreview.path || '') || '?????';
    return currentTitle || '?????';
  }

  function notifyArtifactContextChanged() {
    try { if (typeof global.syncArtifactContextChip === 'function') global.syncArtifactContextChip(); } catch (_) {}
  }

  function getCurrentMarkdownContext() {
    const path = currentFilePath || (historyPreview && historyPreview.path) || '';
    const title = currentTitle || artifactDisplayTitle() || fileNameFromPath(path || '');
    const body = getSourceText ? getSourceText() : '';
    if (!path || !/\.md$/i.test(path)) return null;

    // 获取选区信息
    const sourceEditor = $('#artifactSource');
    let selection = '';
    let lineStart = 0;
    let lineEnd = 0;

    if (sourceEditor && currentTab === 'source') {
      const start = sourceEditor.selectionStart || 0;
      const end = sourceEditor.selectionEnd || 0;
      if (start !== end) {
        selection = body.slice(start, end);
        const beforeSelection = body.slice(0, start);
        lineStart = (beforeSelection.match(/\n/g) || []).length + 1;
        const selectionLines = (selection.match(/\n/g) || []).length;
        lineEnd = lineStart + selectionLines;
      }
    }

    return {
      title,
      path,
      type: 'markdown',
      previewing: true,
      size: body ? body.length : 0,
      totalLines: body ? body.split('\n').length : 0,
      selection,
      lineStart,
      lineEnd,
      snapshot: _currentDocSnapshot || { content: body, mtime: 0, hash: '' },
      status: _currentDocSnapshot ? 'tracked' : 'untracked'
    };
  }

  function syncDocumentHeader() {
    const head = $('#artifactDocumentHead');
    const titleEl = $('#artifactDocumentTitle');
    const show = currentTab !== 'history' || !!historyPreview;
    if (head) head.style.display = show ? 'flex' : 'none';
    if (titleEl) titleEl.textContent = artifactDisplayTitle();
  }

  function getLineRangeFromOffsets(text, start, end) {
    const source = String(text || '');
    const safeStart = Math.max(0, Math.min(source.length, Number(start) || 0));
    const safeEnd = Math.max(safeStart, Math.min(source.length, Number(end) || safeStart));
    const before = source.slice(0, safeStart);
    const selected = source.slice(safeStart, safeEnd);
    const lineStart = (before.match(/\n/g) || []).length + 1;
    const lineEnd = lineStart + (selected.match(/\n/g) || []).length;
    return { lineStart, lineEnd };
  }

  function lineLabelFromRange(startLine, endLine) {
    const start = Number(startLine) || 0;
    const end = Number(endLine) || 0;
    if (!start) return '';
    return start === end || !end ? `L${start}` : `L${start}-${end}`;
  }

  function buildLocalEditCardHtml(ctx, extraClass) {
    if (!ctx) return '';
    const lineLabel = lineLabelFromRange(ctx.lineStart, ctx.lineEnd);
    const title = ctx.path ? fileNameFromPath(ctx.path) : (ctx.title || '当前文档');
    const classes = ['local-edit-card'];
    if (extraClass) classes.push(extraClass);
    return `<div class="${classes.join(' ')}">`
      + `<span class="local-edit-card-title" title="${esc(title)}">${esc(title)}</span>`
      + (lineLabel ? `<span class="local-edit-card-lines">${esc(lineLabel)}</span>` : '')
      + `</div>`;
  }

  function buildComposerEditReferenceCard(ctx) {
    if (!ctx) return '';
    const lineLabel = lineLabelFromRange(ctx.lineStart, ctx.lineEnd);
    const title = ctx.path ? fileNameFromPath(ctx.path) : (ctx.title || '当前文档');
    const snippet = String(ctx.selectedText || ctx.originalContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return `
      <div class="card-content">
        <span class="card-main">
          <span class="card-title" title="${esc(title)}">${esc(title)}</span>
          ${snippet ? `<span class="card-snippet" title="${esc(snippet)}">${esc(snippet)}</span>` : ''}
        </span>
        ${lineLabel ? `<span class="card-lines">${esc(lineLabel)}</span>` : ''}
      </div>
      <button class="card-remove" type="button" aria-label="移除引用">×</button>
    `;
  }

  function lineStartOffsetFromNumber(text, lineNumber) {
    const source = String(text || '');
    const target = Math.max(1, Number(lineNumber) || 1);
    if (target <= 1) return 0;
    let index = 0;
    let current = 1;
    while (current < target) {
      const nextBreak = source.indexOf('\n', index);
      if (nextBreak === -1) return source.length;
      index = nextBreak + 1;
      current += 1;
    }
    return index;
  }

  function lineEndOffsetFromNumber(text, lineNumber) {
    const source = String(text || '');
    const start = lineStartOffsetFromNumber(source, lineNumber);
    const nextBreak = source.indexOf('\n', start);
    return nextBreak === -1 ? source.length : nextBreak;
  }

  function sourceLineHeight(src) {
    if (!src) return 22;
    const lineHeight = parseFloat(global.getComputedStyle(src).lineHeight);
    return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 22;
  }

  function resetSourceMetricsCache() {
    _sourceMetricsCache = null;
  }

  function syncSourceLayerGeometry() {
    const src = $('#artifactSource');
    if (!src) return;
    const width = Math.max(0, Math.round(src.clientWidth || 0));
    const measure = $('#artifactSourceMeasure');
    const highlight = $('#artifactSourceHighlight');
    const active = $('#artifactSourceActiveHighlight');
    [measure, highlight, active].forEach(layer => {
      if (!layer || !width) return;
      layer.style.width = width + 'px';
      layer.style.right = 'auto';
    });
  }

  function getSourceLineMetrics() {
    const src = $('#artifactSource');
    const measure = $('#artifactSourceMeasure');
    const text = String(src?.value || '');
    const lines = text.split('\n');
    const lineHeight = sourceLineHeight(src);
    syncSourceLayerGeometry();
    const width = src ? Math.round(src.clientWidth || 0) : 0;
    if (_sourceMetricsCache
      && _sourceMetricsCache.text === text
      && _sourceMetricsCache.width === width
      && _sourceMetricsCache.lineHeight === lineHeight) {
      return _sourceMetricsCache.metrics;
    }
    const fallbackHeights = lines.map(() => lineHeight);
    if (!src || !measure || !src.offsetParent || src.clientWidth <= 0) {
      const metrics = { lines, heights: fallbackHeights, lineHeight };
      _sourceMetricsCache = { text, width, lineHeight, metrics };
      return metrics;
    }
    measure.innerHTML = lines.map(line => `<div class="artifact-source-measure-line">${line ? esc(line) : '&#8203;'}</div>`).join('');
    const heights = Array.from(measure.children).map(el => Math.max(lineHeight, Math.ceil(el.getBoundingClientRect().height || lineHeight)));
    const metrics = { lines, heights: heights.length ? heights : fallbackHeights, lineHeight };
    _sourceMetricsCache = { text, width, lineHeight, metrics };
    return metrics;
  }

  function sourceLineTop(metrics, lineNumber) {
    const target = Math.max(1, Number(lineNumber) || 1);
    let top = 0;
    for (let i = 0; i < target - 1 && i < metrics.heights.length; i += 1) {
      top += metrics.heights[i] || metrics.lineHeight;
    }
    return top;
  }

  function normalizePathForCompare(path) {
    let text = String(path || '').trim();
    if (!text) return '';
    text = text.replace(/\\/g, '/');
    text = text.replace(/^([ab])\/{2,}/i, '$1/');
    text = text.replace(/^[ab]\//i, '');
    text = text.replace(/^\/mnt\/([a-z])\//i, (_, drive) => drive.toUpperCase() + ':/');
    return text.toLowerCase();
  }

  function editHighlightMatchesCurrentPath() {
    if (!lastEditHighlight) return false;
    const highlightPath = normalizePathForCompare(lastEditHighlight.path);
    const activePath = normalizePathForCompare(currentFilePath);
    return !highlightPath || !activePath || highlightPath === activePath;
  }

  function resolveEditHighlightRange(sourceText, totalLines) {
    const source = String(sourceText || '');
    const fallbackText = String(lastEditHighlight?.text || '').trim();
    const storedStartLine = Math.max(1, Number(lastEditHighlight?.startLine) || 1);
    const storedEndLine = Math.max(storedStartLine, Number(lastEditHighlight?.endLine) || storedStartLine);
    if (fallbackText && fallbackText.length >= 4) {
      let bestRange = null;
      let bestDistance = Infinity;
      let index = source.indexOf(fallbackText);
      let checked = 0;
      while (index >= 0 && checked < 50) {
        const range = getLineRangeFromOffsets(source, index, index + fallbackText.length);
        const distance = Math.abs((range.lineStart || storedStartLine) - storedStartLine);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestRange = range;
        }
        if (distance === 0) break;
        checked += 1;
        index = source.indexOf(fallbackText, index + fallbackText.length);
      }
      if (bestRange) {
        return {
          startLine: Math.max(1, Math.min(totalLines, bestRange.lineStart || storedStartLine)),
          endLine: Math.max(1, Math.min(totalLines, bestRange.lineEnd || bestRange.lineStart || storedEndLine)),
        };
      }
    }
    return {
      startLine: Math.max(1, Math.min(totalLines, storedStartLine)),
      endLine: Math.max(1, Math.min(totalLines, storedEndLine)),
    };
  }

  function buildGutterLineNumbers(metrics) {
    const marks = [];
    const total = Math.max(1, metrics.heights.length || metrics.lines.length || 1);
    const active = editHighlightMatchesCurrentPath();
    const start = active ? Math.max(1, Number(lastEditHighlight.startLine) || 1) : 0;
    const end = active ? Math.max(start, Number(lastEditHighlight.endLine) || start) : 0;
    for (let i = 1; i <= total; i += 1) {
      const height = Math.max(metrics.lineHeight, metrics.heights[i - 1] || metrics.lineHeight);
      const edited = active && i >= start && i <= end ? ' is-edited' : '';
      marks.push(`<div class="artifact-source-gutter-line${edited}" data-line="${i}" style="height:${height}px;line-height:${metrics.lineHeight}px">${i}</div>`);
    }
    return marks.join('');
  }

  function syncSourceGutter(metrics) {
    const src = $('#artifactSource');
    const gutter = $('#artifactSourceGutter');
    if (!src || !gutter) return;
    const sourceMetrics = metrics || getSourceLineMetrics();
    gutter.innerHTML = buildGutterLineNumbers(sourceMetrics);
    gutter.scrollTop = src.scrollTop || 0;
  }

  function syncSourceHighlightScroll() {
    const src = $('#artifactSource');
    const hl = $('#artifactSourceHighlight');
    if (!src || !hl) return;
    hl.style.transform = `translateY(-${src.scrollTop || 0}px)`;
    positionSourceActiveHighlight();
  }

  function clearSourceActiveHighlight() {
    const active = $('#artifactSourceActiveHighlight');
    if (!active) return;
    active.style.display = 'none';
    active.style.height = '0px';
    active.removeAttribute('data-start-line');
    active.removeAttribute('data-end-line');
  }

  function positionSourceActiveHighlight(metricsArg, startLineArg, endLineArg) {
    const src = $('#artifactSource');
    const active = $('#artifactSourceActiveHighlight');
    if (!src || !active) return false;
    const metrics = metricsArg || getSourceLineMetrics();
    const storedStart = Number(active.dataset.startLine || 0);
    const storedEnd = Number(active.dataset.endLine || 0);
    const startLine = Math.max(1, Number(startLineArg || storedStart) || 1);
    const endLine = Math.max(startLine, Number(endLineArg || storedEnd) || startLine);
    if (!active.dataset.startLine && startLineArg == null) return false;
    const total = Math.max(1, metrics.heights.length || metrics.lines.length || 1);
    const from = Math.max(1, Math.min(total, startLine));
    const to = Math.max(from, Math.min(total, endLine));
    let height = 0;
    for (let i = from; i <= to; i += 1) {
      height += Math.max(metrics.lineHeight, metrics.heights[i - 1] || metrics.lineHeight);
    }
    active.dataset.startLine = String(from);
    active.dataset.endLine = String(to);
    active.style.display = 'block';
    active.style.top = Math.round(10 + sourceLineTop(metrics, from) - (src.scrollTop || 0)) + 'px';
    active.style.height = Math.max(metrics.lineHeight, Math.round(height)) + 'px';
    active.style.width = Math.max(0, Math.round(src.clientWidth || 0)) + 'px';
    return true;
  }

  function sourcePanelReadyForHighlight() {
    const src = $('#artifactSource');
    const shell = $('#artifactSourceShell');
    if (!src || !shell || currentTab !== 'source') return false;
    if (shell.style.display === 'none' || src.style.display === 'none') return false;
    const rect = src.getBoundingClientRect();
    return src.offsetParent !== null && rect.width > 20 && rect.height > 20;
  }

  function applySourceEditHighlight(options = {}) {
    const src = $('#artifactSource');
    const hl = $('#artifactSourceHighlight');
    const shell = $('#artifactSourceShell');
    if (!src || !hl || !shell) return false;
    if (options.waitForVisible && !sourcePanelReadyForHighlight()) return false;
    const metrics = getSourceLineMetrics();
    if (!editHighlightMatchesCurrentPath()) {
      hl.innerHTML = '';
      shell.classList.remove('has-edit-highlight');
      clearSourceActiveHighlight();
      syncSourceGutter(metrics);
      syncSourceHighlightScroll();
      return true;
    }
    const lines = [];
    const total = Math.max(1, metrics.heights.length || metrics.lines.length || 1);
    const { startLine, endLine } = resolveEditHighlightRange(src.value || '', total);
    for (let i = 1; i <= total; i += 1) {
      const height = Math.max(metrics.lineHeight, metrics.heights[i - 1] || metrics.lineHeight);
      lines.push(i >= startLine && i <= endLine
        ? `<div class="artifact-source-highlight-line" style="height:${height}px"></div>`
        : `<div class="artifact-source-highlight-spacer" style="height:${height}px"></div>`);
    }
    hl.innerHTML = lines.join('');
    shell.classList.add('has-edit-highlight');
    if (options.scrollToHighlight !== false) {
      src.scrollTop = Math.max(0, sourceLineTop(metrics, startLine) - (metrics.lineHeight * 2));
    }
    positionSourceActiveHighlight(metrics, startLine, endLine);
    syncSourceHighlightScroll();
    syncSourceGutter(metrics);
    return true;
  }

  function scheduleSourceOverlaySync(options = {}) {
    _sourceOverlayScrollPending = _sourceOverlayScrollPending || options.scrollToHighlight === true;
    if (options.scrollToHighlight === true || options.retry === true) {
      const retries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : 8;
      _sourceOverlayRetryCount = Math.max(_sourceOverlayRetryCount, retries);
    }
    if (_sourceOverlayRaf) return;
    _sourceOverlayRaf = requestAnimationFrame(() => {
      const shouldScroll = _sourceOverlayScrollPending;
      _sourceOverlayRaf = 0;
      _sourceOverlayScrollPending = false;
      const ok = applySourceEditHighlight({ scrollToHighlight: shouldScroll, waitForVisible: true });
      if (!ok && _sourceOverlayRetryCount > 0) {
        _sourceOverlayRetryCount -= 1;
        scheduleSourceOverlaySync({ scrollToHighlight: shouldScroll, retry: true, retries: _sourceOverlayRetryCount });
      } else {
        _sourceOverlayRetryCount = 0;
      }
    });
  }

  function historyDisplayTitle() {
    if (historyMode === 'graph') return '知识图谱';
    if (historyMode === 'category:images') return '输出图片';
    if (historyMode === 'tag') return '标签';
    if (String(historyMode || '').startsWith('category:')) {
      const id = String(historyMode).slice(9);
      const categories = historyData?.vaultCategories || [];
      const hit = categories.find(item => item.id === id);
      return hit?.label || hit?.folder || '输出文档';
    }
    return '输出文档';
  }

  function currentArtifactTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    try {
      const stored = localStorage.getItem('hermes.theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (_) {}
    return 'light';
  }

  function backFromDocumentHeader() {
    showHistory();
  }

  function syncToolbarActive() {
    document.querySelectorAll('.artifact-layout-btn').forEach((b) => {
      const m = b.dataset.layout;
      const active =
        (m === 'CHAT_ONLY' && layout === 'CHAT_ONLY') ||
        (m === 'SPLIT_VIEW' && layout === 'SPLIT_VIEW') ||
        (m === 'PREVIEW_ONLY' && layout === 'PREVIEW_ONLY');
      b.classList.toggle('active', active);
    });
    const docToggle = $('#artifactViewToggle');
    const kgToggle = $('#knowledgeViewToggle');
    const showKgToggle = currentTab === 'history' && historyMode === 'graph' && !historyPreview;
    const showDocToggle = currentTab !== 'history' || !!historyPreview;
    if (docToggle) {
      docToggle.style.display = showDocToggle ? 'inline-grid' : 'none';
      docToggle.dataset.active = currentTab === 'source' ? 'source' : 'preview';
    }
    if (kgToggle) {
      kgToggle.style.display = showKgToggle ? 'inline-grid' : 'none';
      kgToggle.dataset.active = knowledgeGraphView;
    }
    document.querySelectorAll('#artifactViewToggle .artifact-view-btn').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === currentTab);
    });
    document.querySelectorAll('#knowledgeViewToggle .artifact-view-btn').forEach((t) => {
      t.classList.toggle('active', t.dataset.kgView === knowledgeGraphView);
    });
    syncToolbarState();
  }

  function shouldShowArtifactExport() {
    if (currentTab === 'history') return !!historyPreview;
    return !!String(getSourceText() || '').trim();
  }

  function syncToolbarState() {
    const exportWrap = $('#artifactExportWrap');
    if (!exportWrap) return;
    const titleEl = $('#artifactTitleText');
    if (titleEl && currentTab === 'history' && !historyPreview) titleEl.textContent = historyDisplayTitle();
    const actionBtn = $('#artifactHistoryActionBtn');
    if (actionBtn) {
      const showSync = false;
      const showClassify = currentTab === 'history' && historyMode === 'category:outputs' && historySubFilter === 'inbox';
      actionBtn.style.display = (showSync || showClassify) ? 'inline-flex' : 'none';
      if (showSync) {
        actionBtn.textContent = '同步问题';
        actionBtn.dataset.tip = '从聊天记录同步用户问题';
        actionBtn.setAttribute('aria-label', '同步问题');
        actionBtn.onclick = () => syncAndRefreshGraph();
      } else if (showClassify) {
        actionBtn.textContent = '自动分类';
        actionBtn.dataset.tip = 'AI 自动分类临时收件箱文件';
        actionBtn.setAttribute('aria-label', '自动分类');
        actionBtn.onclick = () => autoClassify();
      } else {
        actionBtn.onclick = null;
      }
    }
    const showExport = shouldShowArtifactExport();
    exportWrap.classList.toggle('is-hidden', !showExport);
    exportWrap.setAttribute('aria-hidden', showExport ? 'false' : 'true');
    if (!showExport) hideExportMenu();
  }

  function getMarked() {
    if (global.marked && typeof global.marked.parse === 'function') return global.marked;
    if (global.marked && typeof global.marked.marked === 'function') return { parse: global.marked.marked };
    return null;
  }

  function _doRenderMarkdown(md, el, scrollHost, prevScrollTop) {
    const m = getMarked();
    if (m) {
      el.innerHTML = m.parse(stripLooseMarkdownMeta(md || ''), { breaks: true });
    } else {
      el.innerHTML = '<pre class="artifact-fallback">' + esc(md || '') + '</pre>';
    }
    if (global.enhanceMessageMarkdown) {
      global.enhanceMessageMarkdown(el);
    } else if (global.hljs) {
      el.querySelectorAll('pre code').forEach((c) => {
        try { global.hljs.highlightElement(c); } catch (_) {}
      });
    }
    if (scrollHost && prevScrollTop != null) {
      requestAnimationFrame(() => { scrollHost.scrollTop = prevScrollTop; });
    }
  }

  function renderMarkdownDebounced(md, el) {
    if (!el) return;
    const scrollHost = el.parentElement;
    const prevScrollTop = scrollHost ? scrollHost.scrollTop : null;
    if (_mdTimer) clearTimeout(_mdTimer);
    _mdTimer = setTimeout(() => {
      _mdTimer = null;
      try {
        if (getMarked()) {
          _doRenderMarkdown(md, el, scrollHost, prevScrollTop);
        } else {
          // marked not loaded yet — retry up to 5 times
          let retries = 0;
          const retryTimer = setInterval(() => {
            retries++;
            if (getMarked() || retries >= 5) {
              clearInterval(retryTimer);
              try { _doRenderMarkdown(md, el, scrollHost, prevScrollTop); } catch (_) {}
            }
          }, 500);
        }
      } catch (e) {
        el.innerHTML = '<pre class="artifact-fallback">' + esc(md || '') + '</pre>';
      }
    }, 200);
  }

  function renderPreview(type, language, content, el) {
    if (!el) return;
    const t = (type || 'markdown').toLowerCase();
    if (t === 'code') {
      const lang = language || 'plaintext';
      let html = '<pre><code class="language-' + esc(lang) + '">' + esc(content || '') + '</code></pre>';
      el.innerHTML = html;
      if (global.hljs) {
        el.querySelectorAll('pre code').forEach((c) => {
          try { global.hljs.highlightElement(c); } catch (_) {}
        });
      }
      return;
    }
    if (t === 'html') {
      el.innerHTML =
        '<iframe class="artifact-html-frame" sandbox="allow-scripts allow-downloads" referrerpolicy="no-referrer" title="HTML artifact"></iframe>';
      const fr = el.querySelector('iframe');
      if (fr) fr.srcdoc = content || '';
      return;
    }
    if (t === 'mermaid' && global.mermaid) {
      const id = 'mmd-' + Math.random().toString(36).slice(2);
      el.innerHTML = '<div class="mermaid" id="' + id + '">' + String(content || '').replace(/<\/script/gi, '') + '</div>';
      const node = document.getElementById(id);
      if (node) {
        try {
          if (typeof global.mermaid.run === 'function') {
            global.mermaid.run({ nodes: [node] }).catch(() => {
              el.innerHTML = '<pre class="artifact-fallback">' + esc(content || '') + '</pre>';
            });
          } else {
            global.mermaid.init(undefined, node);
          }
        } catch (_) {
          el.innerHTML = '<pre class="artifact-fallback">' + esc(content || '') + '</pre>';
        }
      }
      return;
    }
    renderMarkdownDebounced(content || '', el);
  }

  function flushPreviewNow(type, language, content, el) {
    if (_mdTimer) {
      clearTimeout(_mdTimer);
      _mdTimer = null;
    }
    const scrollHost = el && el.parentElement;
    const prevScrollTop = scrollHost ? scrollHost.scrollTop : null;
    renderPreview(type, language, content, el);
    if (scrollHost && prevScrollTop != null) {
      requestAnimationFrame(() => { scrollHost.scrollTop = prevScrollTop; });
    }
  }

  function getVersionList(title) {
    return versionByTitle.get(title) || [];
  }

  function upsertDocumentVersion(title, filePath, content, meta = {}) {
    const safeTitle = title || currentTitle || fileNameFromPath(filePath || '').replace(/\.md$/i, '') || 'Markdown';
    const list = versionByTitle.get(safeTitle) || [];
    const wantedPath = normalizePathForCompare(filePath);
    let row = wantedPath ? list.find(item => normalizePathForCompare(item.path) === wantedPath) : null;
    if (!row && viewVersionIndex >= 0 && viewVersionIndex < list.length) row = list[viewVersionIndex];
    if (!row && list.length === 1) row = list[0];
    if (!row) {
      row = {
        version: list.length + 1,
        type: (meta.type || 'markdown').toLowerCase(),
        language: (meta.language || '').toLowerCase(),
        path: filePath || '',
        content: content || '',
        ts: Date.now(),
      };
      list.push(row);
    } else {
      row.type = (meta.type || row.type || 'markdown').toLowerCase();
      row.language = (meta.language || row.language || '').toLowerCase();
      row.path = filePath || row.path || '';
      row.content = content || '';
      row.ts = Date.now();
    }
    versionByTitle.set(safeTitle, list);
    viewVersionIndex = Math.max(0, list.indexOf(row));
    return row;
  }

  function changedLineRange(oldContent, newContent) {
    const normOld = String(oldContent || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const normNew = String(newContent || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (normOld === normNew) return null;
    const oldLines = normOld.split('\n');
    const newLines = normNew.split('\n');
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start += 1;
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
      oldEnd -= 1;
      newEnd -= 1;
    }
    const total = Math.max(1, newLines.length);
    const lineStart = Math.max(1, Math.min(total, start + 1));
    const lineEnd = Math.max(lineStart, Math.min(total, newEnd + 1));
    return {
      lineStart,
      lineEnd,
      text: newLines.slice(lineStart - 1, lineEnd).join('\n'),
    };
  }

  function renderMarkdownDiffHtml(oldContent, newContent) {
    const normOld = String(oldContent || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const normNew = String(newContent || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const oldLines = normOld.split('\n');
    const newLines = normNew.split('\n');
    return newLines.map((line, i) => {
      const html = esc(line);
      return oldLines[i] === line ? html : '<span class="artifact-diff-added">' + html + '</span>';
    }).join('\n');
  }

  async function fetchMarkdownDocument(pathText) {
    const target = String(pathText || '').trim();
    if (!target) throw new Error('path is required');
    const attempts = [
      apiBase() + '/api/system/file-content?path=' + encodeURIComponent(target),
      apiBase() + '/api/knowledge/markdown?path=' + encodeURIComponent(target),
    ];
    let lastError = null;
    for (const url of attempts) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        });
        const json = await readJsonResponse(res, '读取文档失败');
        const data = json.data || {};
        if (data.content !== undefined) return { ...data, path: data.path || target, content: String(data.content || '') };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('读取文档失败');
  }

  function currentContentForPanel(parsed, streaming) {
    const act = parsed.activeArtifact;
    if (act) return { attrs: act.attrs, content: act.content, incomplete: streaming };
    const arts = parsed.completedArtifacts;
    if (!arts.length) return null;
    const last = arts[arts.length - 1];
    return { attrs: last.attrs, content: last.content, incomplete: false };
  }

  function getCurrentVersionRow() {
    const list = getVersionList(currentTitle);
    if (!list.length || viewVersionIndex < 0 || viewVersionIndex >= list.length) return null;
    return list[viewVersionIndex] || null;
  }

  function getSourceText() {
    const src = $('#artifactSource');
    if (currentTab === 'source' && src) return src.value || '';
    const row = getCurrentVersionRow();
    if (row) return row.content || '';
    return window.__hermesLastArtifactBody || '';
  }

  function syncSourceEditor(content, options = {}) {
    const src = $('#artifactSource');
    if (!src) return;
    const text = content || '';
    if (src.value !== text) {
      src.value = text;
      resetSourceMetricsCache();
    }
    _sourceLastSaved = text;
    if (options.highlight !== false) scheduleSourceOverlaySync({ scrollToHighlight: options.scrollToHighlight === true });
  }

  function setSourceSaveStatus(text, tone) {
    const verEl = $('#artifactVersionText');
    if (!verEl) return;
    verEl.textContent = text || '';
    verEl.dataset.saveTone = tone || '';
  }

  function currentSourceMeta() {
    const row = getCurrentVersionRow();
    const body = getSourceText().trim();
    return {
      body,
      title: currentTitle || firstHeading(body) || '未命名文档',
      type: (row && row.type) || 'markdown',
      language: (row && row.language) || '',
    };
  }

  async function saveSourceEditNow() {
    const meta = currentSourceMeta();
    if (!meta.body || meta.body === _sourceLastSaved) return;
    if (_sourceSaveInFlight) {
      _sourceSavePending = true;
      return;
    }
    _sourceSaveInFlight = true;
    setSourceSaveStatus('保存中…', 'saving');
    try {
      if (currentFilePath) {
        const res = await fetch(apiBase() + '/api/system/file-content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: currentFilePath, content: meta.body }),
        });
        const data = await readJsonResponse(res, '保存失败：请重启 WebUI 后端后再试');
      } else {
        const folder = inferFolderFromContent(meta.body, meta.title);
        const res = await fetch(apiBase() + '/api/system/md-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: meta.title, folder, content: meta.body }),
        });
        const data = await readJsonResponse(res, '保存失败：请重启 WebUI 后端后再试');
        currentFilePath = data.data && data.data.path ? data.data.path : currentFilePath;
        currentTitle = data.data && data.data.title ? data.data.title : meta.title;
        // 初始化快照
        if (data.data && data.data.path && data.data.content !== undefined) updateDocumentSnapshot(data.data.path, data.data.content);
        else if (currentFilePath) updateDocumentSnapshot(currentFilePath, meta.body);
        historyData = null;
      }
      _sourceLastSaved = meta.body;
      setSourceSaveStatus('已自动保存', 'saved');
    } catch (e) {
      setSourceSaveStatus('自动保存失败', 'error');
      if (global.toast) global.toast(e && e.message ? e.message : '自动保存失败', 'warning');
    } finally {
      _sourceSaveInFlight = false;
      if (_sourceSavePending) {
        _sourceSavePending = false;
        scheduleSourceAutoSave();
      }
    }
  }

  function scheduleSourceAutoSave() {
    clearTimeout(_sourceSaveTimer);
    setSourceSaveStatus('待保存…', 'pending');
    _sourceSaveTimer = setTimeout(saveSourceEditNow, 900);
  }
  function selectionEditPrompt(text, mode) {
    const title = currentTitle || '当前知识库文档';
    const file = currentFilePath || (historyPreview && historyPreview.path) || '';
    const ctx = getCurrentMarkdownContext();

    // 生成简洁的行号标签，类似 Cursor 风格
    let lineTag = '';
    if (ctx && ctx.lineStart) {
      if (ctx.lineStart === ctx.lineEnd) {
        lineTag = `L${ctx.lineStart}`;
      } else {
        lineTag = `L${ctx.lineStart}-${ctx.lineEnd}`;
      }
    }

    const fileLabel = file ? fileNameFromPath(file) : title;
    const locationTag = lineTag ? `${fileLabel}:${lineTag}` : fileLabel;

    return [
      `请修改文档 ${locationTag} 的内容：`,
      '',
      '```',
      text,
      '```',
      '',
      '要求：只修改选中部分，保持原文风格和格式，修改后写回原文档。',
      '',
      '修改指令：'
    ].join('\n');
  }

  function createLocalEditContext(text, mode) {
    const selectedText = String(text || '').trim().slice(0, 12000);
    if (!selectedText) return null;
    const sourceText = getSourceText() || '';
    let lineStart = 0;
    let lineEnd = 0;
    let selectionStart = -1;
    let selectionEnd = -1;
    const src = $('#artifactSource');
    if (mode === 'source' && src && currentTab === 'source') {
      selectionStart = src.selectionStart ?? -1;
      selectionEnd = src.selectionEnd ?? -1;
      if (selectionStart >= 0 && selectionEnd > selectionStart) {
        const range = getLineRangeFromOffsets(sourceText, selectionStart, selectionEnd);
        lineStart = range.lineStart;
        lineEnd = range.lineEnd;
      }
    }
    if (selectionStart < 0 || selectionEnd <= selectionStart) {
      const index = sourceText.indexOf(selectedText);
      if (index >= 0) {
        selectionStart = index;
        selectionEnd = index + selectedText.length;
        const range = getLineRangeFromOffsets(sourceText, selectionStart, selectionEnd);
        lineStart = range.lineStart;
        lineEnd = range.lineEnd;
      }
    }
    return {
      id: 'local_edit_' + Date.now(),
      title: currentTitle || firstHeading(sourceText) || '当前知识库文档',
      path: currentFilePath || (historyPreview && historyPreview.path) || '',
      mode: mode === 'source' ? 'source' : 'preview',
      selectedText,
      originalContent: selectedText,
      lineStart,
      lineEnd,
      selectionStart,
      selectionEnd,
      sourceSnapshot: sourceText.slice(0, 200000),
      createdAt: Date.now(),
    };
  }

  function getLocalEditContext() {
    return localEditContext ? { ...localEditContext } : null;
  }

  function clearLocalEditContext(id) {
    const shouldClear = !id || !localEditContext || localEditContext.id === id;
    if (!shouldClear) return;
    localEditContext = null;
    const card = document.querySelector('.edit-reference-card');
    if (card) card.remove();
  }

  function buildLocalEditUpdatedText(ctx, nextText) {
    if (!ctx) return '';
    const source = String(ctx.sourceSnapshot || getSourceText() || window.__hermesLastArtifactBody || '');
    const selected = String(ctx.selectedText || '');
    const replacement = String(nextText || '');
    if (!source || !selected) return '';

    const selectionStart = Number(ctx.selectionStart);
    const selectionEnd = Number(ctx.selectionEnd);
    if (Number.isFinite(selectionStart) && Number.isFinite(selectionEnd) && selectionStart >= 0 && selectionEnd >= selectionStart) {
      if (source.slice(selectionStart, selectionEnd) === selected) {
        return source.slice(0, selectionStart) + replacement + source.slice(selectionEnd);
      }
    }

    const start = Number(ctx.lineStart || 0);
    const end = Number(ctx.lineEnd || 0);
    if (start > 0 && end >= start) {
      const normalize = value => String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalize(source).split('\n');
      const selectedByLine = lines.slice(start - 1, end).join('\n').trim();
      if (selectedByLine === normalize(selected).trim()) {
        lines.splice(start - 1, end - start + 1, ...normalize(replacement).trim().split('\n'));
        return lines.join('\n');
      }
    }

    const index = source.indexOf(selected);
    if (index >= 0 && source.indexOf(selected, index + selected.length) < 0) {
      return source.slice(0, index) + replacement + source.slice(index + selected.length);
    }
    return '';
  }

  async function applyLocalEditReplacement(replacement, contextRef) {
    const contextId = typeof contextRef === 'object' && contextRef ? contextRef.id : contextRef;
    const fallbackCtx = typeof contextRef === 'object' && contextRef?.selectedText ? contextRef : null;
    const ctx = localEditContext && (!contextId || localEditContext.id === contextId)
      ? localEditContext
      : fallbackCtx;
    if (!ctx || !ctx.selectedText) {
      if (global.toast) global.toast('没有可应用的局部编辑选区', 'warning');
      return false;
    }
    const nextText = String(replacement || '').trim();
    if (!nextText) {
      if (global.toast) global.toast('没有可应用的替换内容', 'warning');
      return false;
    }
    if (!ctx.path) {
      if (global.toast) global.toast('当前文档尚未保存，无法快速写回', 'warning');
      return false;
    }

    const optimisticUpdated = buildLocalEditUpdatedText(ctx, nextText);
    const res = await fetch(apiBase() + '/api/knowledge/markdown/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: ctx.path,
        oldText: ctx.selectedText,
        newText: nextText,
        lineStart: ctx.lineStart || 0,
        lineEnd: ctx.lineEnd || 0,
        returnContent: !optimisticUpdated,
      }),
    });
    const data = await readJsonResponse(res, '写回文档失败');
    const updated = String((data.data && data.data.content) || optimisticUpdated || '');
    if (!updated) {
      if (global.toast) global.toast('写回成功但未返回文档内容', 'warning');
      return false;
    }

    const nextLineCount = Math.max(1, nextText.split('\n').length);
    const range = ctx.lineStart
      ? { lineStart: Math.max(1, Number(ctx.lineStart) || 1), lineEnd: Math.max(1, Number(ctx.lineStart) || 1) + nextLineCount - 1 }
      : (() => {
          const fallbackOffset = Math.max(0, updated.indexOf(nextText));
          return getLineRangeFromOffsets(updated, fallbackOffset, fallbackOffset + nextText.length);
        })();
    lastEditHighlight = {
      path: ctx.path,
      startLine: range.lineStart,
      endLine: range.lineEnd,
      text: nextText,
      createdAt: Date.now(),
    };

    currentFilePath = ctx.path;
    currentTitle = ctx.title || currentTitle;
    window.__hermesLastArtifactBody = updated;
    window.__hermesCurrentSourceBody = updated;
    historyData = null;
    updateDocumentSnapshot(ctx.path, updated, data.data || {});
    clearLocalEditContext(ctx.id);
    upsertDocumentVersion(currentTitle || ctx.title, currentFilePath, updated, { type: 'markdown' });
    syncSourceEditor(updated, { scrollToHighlight: true });
    openRef(currentTitle || ctx.title || '当前知识库文档', { tab: 'source', scrollToHighlight: true });
    scheduleSourceOverlaySync({ scrollToHighlight: true, retry: true, retries: 12 });
    if (global.toast) global.toast('已快速应用到当前文档选区', 'success');
    return true;
  }

  function insertLocalEditPrompt(text, mode) {
    const ta = document.getElementById('chatInput');
    if (!ta) {
      if (global.toast) global.toast('请先回到对话页再局部编辑', 'warning');
      return;
    }

    const simplePrompt = '修改指令：';
    localEditContext = createLocalEditContext(text, mode);
    showEditReferenceCard();
    const prefix = ta.value && ta.value.trim() ? '\n\n' : '';
    ta.value = (ta.value || '') + prefix + simplePrompt;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof global.autoResizeInput === 'function') global.autoResizeInput(ta);
    if (global.toast) global.toast('已引用选中内容，可补充修改要求后发送', 'success');
  }

  function showEditReferenceCard() {
    const ctx = localEditContext || getCurrentMarkdownContext();
    if (!ctx) return;

    const existing = document.querySelector('.edit-reference-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'edit-reference-card';
    card.innerHTML = buildComposerEditReferenceCard(ctx);
    const removeBtn = card.querySelector('.card-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        clearLocalEditContext(ctx.id);
      });
    }

    const chatInput = document.getElementById('chatInput');
    if (chatInput && chatInput.parentElement) {
      chatInput.parentElement.insertBefore(card, chatInput);
    }
  }

  function showMultiStepEdit(text, mode) {
    // 多步骤编辑：弹出 textarea 让用户逐条输入修改指令
    const ctx = getCurrentMarkdownContext();
    const pathStr = ctx && ctx.path ? ctx.path : '';
    const linesStr = (ctx && ctx.lineStart) ? (ctx.lineStart === ctx.lineEnd ? ('第 ' + ctx.lineStart + ' 行') : ('第 ' + ctx.lineStart + '-' + ctx.lineEnd + ' 行')) : '';
    const fileLabel = pathStr ? fileNameFromPath(pathStr) + (linesStr ? ' · ' + linesStr : '') : '当前选区';
    const overlay = document.createElement('div');
    overlay.className = 'artifact-multi-step-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center';
    overlay.onclick = function(e) { if (e.target === this) this.remove(); };

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--c-surface1);border:1px solid var(--c-hairline);border-radius:12px;padding:20px;max-width:520px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2)';
    panel.onclick = function(e) { e.stopPropagation(); };

    panel.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:4px">分步编辑</div>' +
      '<div style="font-size:12px;color:var(--c-ink-muted);margin-bottom:12px">' + esc(fileLabel) + '</div>' +
      '<textarea id="multiStepInput" placeholder="逐条输入修改指令，每行一步&#10;例：&#10;1. 把第二段改短&#10;2. 加一个总结句&#10;3. 更新标题" style="width:100%;min-height:100px;padding:10px;border:1px solid var(--c-hairline);border-radius:8px;background:var(--c-surface2);color:var(--c-ink);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">' +
      '<button class="artifact-multi-step-cancel" style="padding:8px 16px;border-radius:8px;border:1px solid var(--c-hairline);background:transparent;color:var(--c-ink);cursor:pointer;font-size:13px">取消</button>' +
      '<button class="artifact-multi-step-confirm" style="padding:8px 16px;border-radius:8px;border:none;background:var(--c-accent);color:#fff;cursor:pointer;font-size:13px;font-weight:500">生成编辑指令</button>' +
      '</div>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const textarea = panel.querySelector('#multiStepInput');
    const cancelBtn = panel.querySelector('.artifact-multi-step-cancel');
    const confirmBtn = panel.querySelector('.artifact-multi-step-confirm');

    cancelBtn.onclick = function() { overlay.remove(); };
    confirmBtn.onclick = function() {
      const steps = (textarea.value || '').split('\n').map(s => s.trim()).filter(Boolean);
      const stepsText = steps.length ? steps.map((s, i) => (i + 1) + '. ' + s).join('\n') : '';
      overlay.remove();
      // 构建分步编辑 prompt
      const basePrompt = selectionEditPrompt(text, mode);
      const multiPart = stepsText ? '\n\n【分步修改要求】\n' + stepsText + '\n\n请按顺序逐一执行以上修改步骤。完成一步后继续下一步，直到所有步骤完成。' : '';
      const finalPrompt = basePrompt + multiPart;
      localEditContext = createLocalEditContext(text, mode);
      const ta = document.getElementById('chatInput');
      if (ta) {
        const prefix = ta.value && ta.value.trim() ? '\n\n' : '';
        ta.value = (ta.value || '') + prefix + finalPrompt;
        ta.focus();
        ta.selectionStart = ta.selectionEnd = ta.value.length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof global.autoResizeInput === 'function') global.autoResizeInput(ta);
        if (global.toast) global.toast('已生成 ' + steps.length + ' 步编辑指令', 'success');
      }
    };

    setTimeout(function() { if (textarea) textarea.focus(); }, 100);
  }

  function hideLocalEditBubble() {
    const bubble = document.getElementById('artifactLocalEditBubble');
    if (bubble) {
      bubble.classList.remove('show');
      // 添加淡出效果
      bubble.style.opacity = '0';
      bubble.style.transform = 'scale(0.95) translateY(4px)';
      setTimeout(() => {
        bubble.style.opacity = '';
        bubble.style.transform = '';
      }, 200);
    }
  }

  function showLocalEditBubble(x, y, text, mode) {
    let bubble = document.getElementById('artifactLocalEditBubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'artifactLocalEditBubble';
      bubble.className = 'artifact-local-edit-bubble';
      bubble.innerHTML = '<button type="button" class="artifact-local-edit-btn" aria-label="局部编辑">' + renderToolbarIcon('magic') + '</button>';
      document.body.appendChild(bubble);
      bubble.addEventListener('mousedown', event => event.preventDefault());
    }
    // 从当前上下文获取路径和行号
    const ctx = getCurrentMarkdownContext();
    const pathStr = ctx && ctx.path ? ctx.path : '';
    const linesStr = (ctx && ctx.lineStart) ? (ctx.lineStart === ctx.lineEnd ? ('第 ' + ctx.lineStart + ' 行') : ('第 ' + ctx.lineStart + '-' + ctx.lineEnd + ' 行')) : '';
    bubble._selectedText = text;
    bubble._selectedMode = mode;
    bubble._ctxPath = pathStr;
    bubble._ctxLines = linesStr;
    const btn = bubble.querySelector('.artifact-local-edit-btn');
    if (btn) {
      btn.innerHTML = renderToolbarIcon('magic');
      btn.onclick = () => {
        insertLocalEditPrompt(bubble._selectedText || '', bubble._selectedMode || 'preview');
        hideLocalEditBubble();
      };
    }
    bubble.style.left = Math.min(global.innerWidth - 260, Math.max(8, x + 10)) + 'px';
    bubble.style.top = Math.min(global.innerHeight - 56, Math.max(8, y + 10)) + 'px';
    bubble.classList.add('show');
  }

  function maybeShowLocalEditBubble(event) {
    const target = event && event.target;
    if (!target || target.closest('#artifactLocalEditBubble')) return;

    // 只在代码模式显示局部编辑
    const src = $('#artifactSource');
    if (target === src && currentTab === 'source') {
      const start = src.selectionStart || 0;
      const end = src.selectionEnd || 0;
      const text = src.value.slice(start, end).trim();
      if (text.length >= 2) showLocalEditBubble(event.clientX, event.clientY, text.slice(0, 4000), 'source');
      else hideLocalEditBubble();
      return;
    }

    // 预览模式不显示局部编辑bubble
    hideLocalEditBubble();
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
  }

  function sourceInsertText(text) {
    const src = $('#artifactSource');
    if (!src) return;
    const value = src.value || '';
    const start = src.selectionStart ?? value.length;
    const end = src.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
    src.value = before + prefix + text + suffix + after;
    const next = (before + prefix + text).length;
    src.selectionStart = src.selectionEnd = next;
    updateCurrentArtifactBody(src.value || '');
  }

  async function uploadImageForSource(file) {
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch(apiBase() + '/api/images/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, fileName: file.name || 'clipboard-image.png', mime: file.type || 'image/png', source: 'artifact-source-paste', publicBase: publicApiBase() }),
    });
    const data = await readJsonResponse(res, '图片上传失败');
    return data.data || data;
  }

  async function handleSourcePaste(event) {
    if (currentTab !== 'source') return;
    const items = [...((event.clipboardData && event.clipboardData.items) || [])];
    const imageFiles = items
      .filter(item => item.kind === 'file' && item.type && item.type.startsWith('image/'))
      .map((item, i) => {
        const file = item.getAsFile();
        if (file && !file.name) {
          try { return new File([file], 'artifact-clipboard-' + Date.now() + '-' + i + '.png', { type: file.type || 'image/png' }); } catch (_) { return file; }
        }
        return file;
      })
      .filter(Boolean);
    if (!imageFiles.length) return;
    event.preventDefault();
    setSourceSaveStatus('上传图片…', 'saving');
    try {
      const markdown = [];
      for (const file of imageFiles) {
        const image = await uploadImageForSource(file);
        const url = mediaUrl(image.publicUrl || image.url || (image.id ? '/api/images/file/' + encodeURIComponent(image.id) : ''));
        markdown.push('![' + (image.originalName || image.filename || file.name || '粘贴图片') + '](' + url + ')');
      }
      sourceInsertText(markdown.join('\n\n'));
      if (global.toast) global.toast('图片已插入到代码模式', 'success');
    } catch (e) {
      setSourceSaveStatus('图片插入失败', 'error');
      if (global.toast) global.toast(e && e.message ? e.message : '图片插入失败', 'error');
    }
  }

  function updateCurrentArtifactBody(content) {
    const text = content || '';
    window.__hermesLastArtifactBody = text;
    window.__hermesCurrentSourceBody = text;
    const row = getCurrentVersionRow();
    if (row) row.content = text;
    const prev = $('#artifactPreview');
    if (prev && currentTab === 'source') {
      const meta = row || { type: 'markdown', language: '' };
      flushPreviewNow(meta.type || 'markdown', meta.language || '', text, prev);
    }
    if (currentTab === 'source') scheduleSourceAutoSave();
  }

  function updatePanelUI(cur, streaming) {
    const shell = $('#artifactShell');
    if (!shell) return;
    const titleEl = $('#artifactTitleText');
    const typeEl = $('#artifactTypeBadge');
    const verEl = $('#artifactVersionText');
    const gen = $('#artifactGenerating');
    const prev = $('#artifactPreview');
    const src = $('#artifactSource');
    if (!cur) {
      if (titleEl) titleEl.textContent = 'Artifact';
      syncDocumentHeader();
      if (typeEl) typeEl.textContent = '—';
      if (verEl) verEl.textContent = '';
      if (gen) gen.style.display = 'none';
      syncToolbarState();
      return;
    }
    const title = cur.attrs.title || '未命名';
    const nextPath = cur.attrs.path || '';
    if (nextPath) currentFilePath = nextPath;
    else if (currentTitle && currentTitle !== title) currentFilePath = '';
    currentTitle = title;
    const typ = (cur.attrs.type || 'markdown').toLowerCase();
    const lang = cur.attrs.language || '';
    if (titleEl) titleEl.textContent = title;
    syncDocumentHeader();
    if (typeEl) typeEl.textContent = typeLabel(typ);
    const list = getVersionList(title);
    const vCount = list.length || (cur.incomplete ? 1 : 0);
    let vCur = vCount;
    if (viewVersionIndex >= 0 && viewVersionIndex < list.length) vCur = viewVersionIndex + 1;
    if (verEl) verEl.textContent = vCount ? 'v' + vCur + ' / ' + vCount : streaming ? '生成中…' : 'v1 / 1';
    if (gen) gen.style.display = streaming && cur.incomplete ? 'flex' : 'none';

    const body = viewVersionIndex >= 0 && list[viewVersionIndex] ? list[viewVersionIndex].content : cur.content;
    const effType = viewVersionIndex >= 0 && list[viewVersionIndex] ? list[viewVersionIndex].type : typ;
    const effLang = viewVersionIndex >= 0 && list[viewVersionIndex] ? list[viewVersionIndex].language : lang;

    window.__hermesLastArtifactBody = body || '';
    window.__hermesCurrentSourceBody = body || '';

    if (currentTab === 'source') {
      if (src) {
        syncSourceEditor(body || '');
        src.style.display = 'block';
      }
      if (prev) prev.style.display = 'none';
    } else {
      if (src) src.style.display = 'none';
      if (prev) {
        prev.style.display = 'block';
        if (streaming && cur.incomplete) renderMarkdownDebounced(body, prev);
        else flushPreviewNow(effType, effLang, body, prev);
      }
    }

    const btnL = $('#artifactVerPrev');
    const btnR = $('#artifactVerNext');
    if (btnL) btnL.disabled = !list.length || viewVersionIndex <= 0;
    if (btnR) btnR.disabled = !list.length || viewVersionIndex >= list.length - 1 || viewVersionIndex < 0;
    syncToolbarState();
  }

  function feedStream(parsed, streaming) {
    const cur = currentContentForPanel(parsed, streaming);
    const arts = parsed.completedArtifacts || [];
    if (arts.length > _prevCompletedArtifactCount) {
      recordCompletedArtifacts(arts.slice(_prevCompletedArtifactCount));
      _prevCompletedArtifactCount = arts.length;
    }
    const hadArtifact = !!(cur || arts.length);
    if (hadArtifact && layout === 'CHAT_ONLY') {
      layout = 'SPLIT_VIEW';
      loadSplit();
      applyLayout();
      syncToolbarActive();
    }
    if (cur) viewVersionIndex = -1;
    updatePanelUI(cur, streaming);
  }

  function finalizeStream(parsed) {
    const arts = (parsed && parsed.completedArtifacts) || [];
    if (arts.length > _prevCompletedArtifactCount) {
      recordCompletedArtifacts(arts.slice(_prevCompletedArtifactCount));
      _prevCompletedArtifactCount = arts.length;
    }
    const cur = currentContentForPanel(parsed, false);
    updatePanelUI(cur, false);
    autoSaveCompletedArtifact(cur);
  }

  function flashPanel() {
    const shell = $('#artifactShell');
    if (!shell) return;
    shell.classList.add('artifact-flash');
    setTimeout(() => shell.classList.remove('artifact-flash'), 400);
  }

  function openRef(title, options = {}) {
    const targetTab = options.tab === 'source' ? 'source' : 'preview';
    currentTitle = title;
    const list = getVersionList(title);
    viewVersionIndex = list.length ? list.length - 1 : -1;
    layout = 'SPLIT_VIEW';
    if (targetTab === 'source') {
      currentTab = 'source';
      historyPreview = null;
      const hist = $('#artifactHistory');
      const prev = $('#artifactPreview');
      const src = $('#artifactSource');
      const srcShell = $('#artifactSourceShell');
      if (hist) hist.style.display = 'none';
      if (prev) prev.style.display = 'none';
      if (srcShell) srcShell.style.display = 'flex';
      if (src) src.style.display = 'block';
      syncToolbarActive();
    } else {
      setTab('preview');
    }
    loadSplit();
    applyLayout();
    syncToolbarActive();
    if (list.length && viewVersionIndex >= 0) {
      const row = list[viewVersionIndex];
      currentFilePath = row.path || currentFilePath || '';
      window.__hermesLastArtifactBody = row.content;
      window.__hermesCurrentSourceBody = row.content;
      updatePanelUI(
        { attrs: { title, type: row.type, language: row.language, path: row.path || currentFilePath || '' }, content: row.content, incomplete: false },
        false
      );
      // 初始化快照
      updateDocumentSnapshot(row.path || currentFilePath || '', row.content);
    } else {
      updatePanelUI(null, false);
    }
    if (targetTab === 'source') {
      scheduleSourceOverlaySync({ scrollToHighlight: options.scrollToHighlight === true });
    }
    if (options.flash !== false) flashPanel();
  }

  function openEmpty(title, message) {
    currentTitle = '';
    currentFilePath = '';
    viewVersionIndex = -1;
    layout = 'SPLIT_VIEW';
    loadSplit();
    applyLayout();
    setTab('preview');
    const titleEl = $('#artifactTitleText');
    const typeEl = $('#artifactTypeBadge');
    const verEl = $('#artifactVersionText');
    const gen = $('#artifactGenerating');
    const prev = $('#artifactPreview');
    if (titleEl) titleEl.textContent = title || '暂无可预览文件';
    if (typeEl) typeEl.textContent = '空状态';
    if (verEl) verEl.textContent = '';
    if (gen) gen.style.display = 'none';
    const src = $('#artifactSource');
    if (src) src.style.display = 'none';
    window.__hermesLastArtifactBody = '';
    if (prev) {
      prev.style.display = 'block';
      prev.innerHTML = `<div class="artifact-empty-state">
        <div class="artifact-empty-icon">MD</div>
        <h3>${esc(title || '暂无可预览文件')}</h3>
        <p>${esc(message || '当前没有检测到可预览的输出文档。你可以在“知识库”里打开本地 Markdown。')}</p>
      </div>`;
    }
    syncToolbarState();
    flashPanel();
  }

  function bindResize() {
    const rs = $('#artifactResizer');
    const wb = $('#chatWorkbench');
    const shell = $('#artifactShell');
    if (!rs || !wb || !shell) return;
    if (rs.dataset.resizeBound === '1' && shell.dataset.resizeBound === '1') return;
    rs.dataset.resizeBound = '1';
    shell.dataset.resizeBound = '1';
    let pendingClientX = null;
    let resizeRaf = 0;
    let activePointerId = null;

    function clampSplit(next) {
      splitPct = Math.round(next * 10) / 10;
      if (splitPct < 28) {
        setLayout('preview');
        return;
      }
      if (splitPct > 88) {
        setLayout('chat');
        return;
      }
      layout = 'SPLIT_VIEW';
      applyLayout();
      syncToolbarActive();
    }

    function onMove(clientX) {
      const rect = wb.getBoundingClientRect();
      const w = rect.width;
      if (w <= 0) return;
      const x = clientX - rect.left;
      const nextSplit = (x / w) * 100;
      clampSplit(nextSplit);
    }

    function scheduleMove(clientX) {
      pendingClientX = clientX;
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        if (pendingClientX == null) return;
        const x = pendingClientX;
        pendingClientX = null;
        onMove(x);
      });
    }

    function end() {
      dragActive = false;
      _dragMode = 'split';
      document.body.classList.remove('artifact-resizing');
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
      document.removeEventListener('touchmove', tm);
      document.removeEventListener('touchend', te);
      document.removeEventListener('pointermove', pm);
      document.removeEventListener('pointerup', pu);
      document.removeEventListener('pointercancel', pu);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
      pendingClientX = null;
      activePointerId = null;
      saveSplit();
    }

    function mm(e) {
      if (!dragActive) return;
      scheduleMove(e.clientX);
    }
    function mu() {
      end();
    }
    function tm(e) {
      if (!dragActive || !e.touches[0]) return;
      if (e.cancelable) e.preventDefault();
      scheduleMove(e.touches[0].clientX);
    }
    function te() {
      end();
    }

    function pm(e) {
      if (!dragActive || (activePointerId != null && e.pointerId !== activePointerId)) return;
      if (e.cancelable) e.preventDefault();
      scheduleMove(e.clientX);
    }
    function pu(e) {
      if (activePointerId != null && e.pointerId !== activePointerId) return;
      end();
    }

    function startDrag(mode, e) {
      dragActive = true;
      _dragMode = mode || 'split';
      if (e?.preventDefault) e.preventDefault();
      document.body.classList.add('artifact-resizing');
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
      onMove(e.clientX);
    }

    function startPointerDrag(mode, e) {
      if (!e || e.pointerType === 'mouse' && e.button !== 0) return;
      dragActive = true;
      _dragMode = mode || 'split';
      activePointerId = e.pointerId;
      if (e.currentTarget?.setPointerCapture) {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (e.preventDefault) e.preventDefault();
      document.body.classList.add('artifact-resizing');
      document.addEventListener('pointermove', pm, { passive: false });
      document.addEventListener('pointerup', pu);
      document.addEventListener('pointercancel', pu);
      onMove(e.clientX);
    }

    function startTouchDrag(mode, e) {
      dragActive = true;
      _dragMode = mode || 'split';
      document.body.classList.add('artifact-resizing');
      document.addEventListener('touchmove', tm, { passive: false });
      document.addEventListener('touchend', te);
    }

    rs.addEventListener('pointerdown', (e) => startPointerDrag('split', e));
    shell.addEventListener('mousedown', (e) => {
      if (!shell.classList.contains('open')) return;
      if (!e.target.closest('.artifact-edge-resizer')) return;
      startPointerDrag('edge', e);
    });
  }

  function ensureShellMarkup() {
    const shell = $('#artifactShell');
    if (!shell || shell.dataset.built) return;
    shell.dataset.built = '1';
    shell.innerHTML = `
<div class="artifact-inner">
  <div class="artifact-toolbar">
    <div class="artifact-toolbar-left">
      <div class="artifact-view-toggle" role="tablist" aria-label="文档视图切换" data-active="preview" id="artifactViewToggle">
        <button type="button" class="artifact-view-btn active artifact-tooltip" data-tab="preview" data-tip="预览" onclick="HermesArtifact.setTab('preview')" aria-label="预览">${renderToolbarIcon('eye')}</button>
        <button type="button" class="artifact-view-btn artifact-tooltip" data-tab="source" data-tip="代码" onclick="HermesArtifact.setTab('source')" aria-label="代码">${renderToolbarIcon('code')}</button>
      </div>
      <div class="artifact-view-toggle kg-parent-view-toggle" role="tablist" aria-label="知识图谱视图切换" data-active="graph" id="knowledgeViewToggle" style="display:none">
        <button type="button" class="artifact-view-btn artifact-tooltip" data-kg-view="graph" data-tip="知识图谱" onclick="HermesArtifact.setKnowledgeGraphView('graph')" aria-label="知识图谱"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="7" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="18" cy="17" r="2.4"/><circle cx="7" cy="18" r="2.4"/><path d="m8.3 8.3 7.1 6.9"/><path d="m15 7-6.5 9"/><path d="M8.8 18h6.7"/></svg></button>
        <button type="button" class="artifact-view-btn artifact-tooltip" data-kg-view="list" data-tip="列表" onclick="HermesArtifact.setKnowledgeGraphView('list')" aria-label="列表"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg></button>
        <button type="button" class="artifact-view-btn artifact-tooltip" data-kg-view="stats" data-tip="统计图" onclick="HermesArtifact.setKnowledgeGraphView('stats')" aria-label="统计图"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/></svg></button>
      </div>
      <span class="artifact-toolbar-title" id="artifactTitleText">Artifact</span>
      <span class="artifact-version-text" id="artifactVersionText"></span>
    </div>
    <div class="artifact-toolbar-actions">
      <div class="artifact-library-wrap">
        <button type="button" class="artifact-library-btn artifact-tooltip" data-tip="\u6253\u5f00\u77e5\u8bc6\u5e93" aria-label="\u6253\u5f00\u77e5\u8bc6\u5e93" onclick="HermesArtifact.showHistory()">${renderToolbarIcon('library')}<span>\u77e5\u8bc6\u5e93</span></button>
        <button type="button" class="artifact-library-caret artifact-tooltip" data-tip="\u9009\u62e9\u77e5\u8bc6\u5206\u7c7b" aria-label="\u9009\u62e9\u77e5\u8bc6\u5206\u7c7b" onclick="HermesArtifact.toggleHistoryCategoryMenu()">${renderToolbarIcon('chevron-down')}</button>
        <div class="doc-library-more-menu artifact-library-menu" id="artifactLibraryMenu" style="display:none"></div>
      </div>
      <button type="button" class="artifact-history-action artifact-tooltip" id="artifactHistoryActionBtn" style="display:none"></button>
      <button type="button" class="artifact-icon-btn artifact-refresh-btn artifact-tooltip" id="artifactRefreshBtn" data-tip="刷新" aria-label="刷新" onclick="HermesArtifact.refreshCurrentView()">${renderToolbarIcon('refresh')}</button>
      <button type="button" class="artifact-icon-btn artifact-tooltip" data-tip="关闭面板" aria-label="关闭面板" onclick="HermesArtifact.setLayout('chat')">${renderToolbarIcon('close')}</button>
    </div>
  </div>
  <div class="artifact-body">
    <div class="artifact-document-head" id="artifactDocumentHead">
      <button type="button" class="artifact-document-back" onclick="HermesArtifact.backFromDocumentHeader()" aria-label="返回">${renderToolbarIcon('back')}</button>
      <div class="artifact-document-title" id="artifactDocumentTitle">Artifact</div>
      <div class="artifact-export-wrap artifact-document-export" id="artifactExportWrap">
        <button type="button" class="artifact-copy-main artifact-tooltip" id="artifactCopyBtn" data-tip="复制当前文档" aria-label="复制当前文档" onclick="HermesArtifact.copyContent()">${renderToolbarIcon('copy')}<span>复制</span></button>
        <button type="button" class="artifact-icon-btn artifact-copy-caret artifact-tooltip" data-tip="更多文档操作" aria-label="更多文档操作" onclick="HermesArtifact.toggleExportMenu(event)">${renderToolbarIcon('chevron-down')}</button>
        <div class="artifact-export-menu" id="artifactExportMenu">
          <button type="button" onclick="HermesArtifact.download();HermesArtifact.hideExportMenu()">打开当前 MD 文档</button>
        </div>
      </div>
    </div>
    <div id="artifactGenerating" class="artifact-generating" style="display:none"><span class="dot-pulse"></span> 生成中…</div>
    <div id="artifactPreview" class="artifact-preview"></div>
    <div id="artifactSourceShell" class="artifact-source-shell" style="display:none">
      <div id="artifactSourceEditBadge" class="artifact-source-edit-badge" style="display:none"></div>
        <div id="artifactSourcePane" class="artifact-source-pane">
          <div id="artifactSourceGutter" class="artifact-source-gutter" aria-hidden="true"></div>
          <div class="artifact-source-editor-wrap">
          <div id="artifactSourceMeasure" class="artifact-source-measure" aria-hidden="true"></div>
          <div id="artifactSourceHighlight" class="artifact-source-highlight" aria-hidden="true"></div>
          <div id="artifactSourceActiveHighlight" class="artifact-source-active-highlight" aria-hidden="true"></div>
          <textarea id="artifactSource" class="artifact-source artifact-source-editor" style="display:none" spellcheck="false" wrap="soft"></textarea>
        </div>
      </div>
    </div>
    <div id="artifactHistory" class="artifact-history" style="display:none"></div>
  </div>
  <div class="image-lightbox" id="imageLightbox">
    <div class="lightbox-backdrop" onclick="HermesArtifact.closeImageLightbox()"></div>
    <div class="lightbox-content">
      <button class="lightbox-close" onclick="HermesArtifact.closeImageLightbox()" aria-label="关闭">✕</button>
      <img class="lightbox-img" id="lightboxImg" alt="预览" onclick="HermesArtifact.toggleImageLightboxZoom(this,event)" />
      <div class="lightbox-prompt" id="lightboxPrompt" onclick="HermesArtifact.copyLightboxPrompt()" title="点击复制提示词"></div>
    </div>
  </div>
  <button type="button" class="artifact-edge-resizer" aria-label="调整预览宽度" title="拖拽调整预览宽度"></button>
</div>`;
  }


  function initWorkbench() {
    loadSplit();
    ensureShellMarkup();
    const src = $('#artifactSource');
    const gutter = $('#artifactSourceGutter');
    if (src && src.dataset.editBound !== '1') {
      src.dataset.editBound = '1';
      src.addEventListener('input', () => {
        updateCurrentArtifactBody(src.value || '');
        scheduleSourceOverlaySync({ scrollToHighlight: false });
      });
      src.addEventListener('scroll', () => {
        if (gutter) gutter.scrollTop = src.scrollTop || 0;
        syncSourceHighlightScroll();
      });
      src.addEventListener('paste', handleSourcePaste);
      src.addEventListener('mouseup', maybeShowLocalEditBubble);
      src.addEventListener('keyup', maybeShowLocalEditBubble);
    }
    if (src && !_sourceResizeObs && typeof ResizeObserver !== 'undefined') {
      _sourceResizeObs = new ResizeObserver(() => {
        resetSourceMetricsCache();
        syncSourceLayerGeometry();
        scheduleSourceOverlaySync({ scrollToHighlight: false });
      });
      _sourceResizeObs.observe(src);
      const wrap = $('#artifactSourcePane');
      if (wrap) _sourceResizeObs.observe(wrap);
    }
    bindResize();
    bindToolbarMenus();
    if (document.body.dataset.artifactLocalEditBound !== '1') {
      document.body.dataset.artifactLocalEditBound = '1';
      document.addEventListener('mouseup', maybeShowLocalEditBubble);
      document.addEventListener('scroll', hideLocalEditBubble, true);
      document.addEventListener('keydown', event => { if (event.key === 'Escape') hideLocalEditBubble(); });
    }
    applyLayout();
    syncToolbarActive();
    scheduleSourceOverlaySync({ scrollToHighlight: false });
    if (global.mermaid && typeof global.mermaid.initialize === 'function') {
      try {
        global.mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark' });
      } catch (_) {}
    }
  }

  function bindToolbarMenus() {
    if (document.body.dataset.toolbarMenusBound === '1') return;
    document.body.dataset.toolbarMenusBound = '1';
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#artifactExportWrap')) hideExportMenu();
      if (!event.target.closest('#artifactHistoryMoreMenu') && !event.target.closest('.artifact-more-btn')) {
        const menu = $('#artifactHistoryMoreMenu');
        if (menu) menu.classList.remove('open');
      }
      if (!event.target.closest('.history-card-menu') && !event.target.closest('.history-card-more')) {
        document.querySelectorAll('.history-card-menu.open').forEach(menu => menu.classList.remove('open'));
      }
      if (!event.target.closest('.artifact-library-wrap') && historyCategoryMenuOpen) {
        historyCategoryMenuOpen = false;
        const libraryMenu = $('#artifactLibraryMenu');
        if (libraryMenu) libraryMenu.style.display = 'none';
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideExportMenu();
        const menu = $('#artifactHistoryMoreMenu');
        if (menu) menu.classList.remove('open');
        document.querySelectorAll('.history-card-menu.open').forEach(item => item.classList.remove('open'));
        historyCategoryMenuOpen = false;
        const libraryMenu = $('#artifactLibraryMenu');
        if (libraryMenu) libraryMenu.style.display = 'none';
      }
    });
  }

  function bumpVersion(delta) {
    const list = getVersionList(currentTitle);
    if (!list.length) return;
    if (viewVersionIndex < 0) viewVersionIndex = list.length - 1;
    viewVersionIndex = Math.max(0, Math.min(list.length - 1, viewVersionIndex + delta));
    const row = list[viewVersionIndex];
    updatePanelUI({ attrs: { title: currentTitle, type: row.type, language: row.language, path: row.path || currentFilePath || '' }, content: row.content, incomplete: false }, false);
  }

  function setTab(tab) {
    currentTab = tab;
    if (tab !== 'history') historyPreview = null;
    syncToolbarActive();
    const prev = $('#artifactPreview');
    const src = $('#artifactSource');
    const srcShell = $('#artifactSourceShell');
    const hist = $('#artifactHistory');
    if (tab === 'history') {
      if (prev) prev.style.display = 'none';
      if (src) src.style.display = 'none';
      if (srcShell) srcShell.style.display = 'none';
      syncToolbarState();
      if (hist) {
        hist.style.display = 'block';
        loadHistory();
      }
      return;
    }
    if (hist) hist.style.display = 'none';
    const list = getVersionList(currentTitle);
    if (list.length && (viewVersionIndex < 0 || viewVersionIndex >= list.length)) viewVersionIndex = list.length - 1;
    const row = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex] : null;
    if (row?.path) currentFilePath = row.path;
    const body = (row && row.content != null ? row.content : '') || window.__hermesCurrentSourceBody || window.__hermesLastArtifactBody || (src ? src.value : '') || '';
    const typ = row ? (row.type || 'markdown') : 'markdown';
    const lang = row ? (row.language || '') : '';
    if (tab === 'source') {
      if (prev) prev.style.display = 'none';
      if (srcShell) srcShell.style.display = 'flex';
      if (src) {
        src.style.display = 'block';
        syncSourceEditor(body);
        scheduleSourceOverlaySync({ scrollToHighlight: false });
      }
      window.__hermesCurrentSourceBody = body;
      window.__hermesLastArtifactBody = body;
    } else {
      if (src) src.style.display = 'none';
      if (srcShell) srcShell.style.display = 'none';
      if (prev) {
        prev.style.display = 'block';
        flushPreviewNow(typ, lang, body, prev);
      }
    }
    syncToolbarState();
  }

  function renderHistoryCard(f) {
    const name = f.file || f.name || '';
    const title = f.title || name.replace(/\.md$/, '');
    const date = formatDocDate(f.mtime);
    const safePath = encodeURIComponent(f.path || '');
    const safeName = encodeURIComponent(title || name);
    const tags = (Array.isArray(f.tags) ? f.tags : []).slice(0, 3);
    const cardId = 'docMenu_' + String(f.id || safePath).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `
      <div class="history-card" title="${esc(f.relativePath || f.path || title)}">
        <button type="button" class="history-card-more" onclick="HermesArtifact.toggleHistoryCardMenu(event, '${cardId}')" aria-label="更多操作" title="更多操作">⋮</button>
        <div class="history-card-menu" id="${cardId}">
          <button type="button" onclick="HermesArtifact.renameHistoryFile('${safePath}', '${safeName}')">编辑命名</button>
          <button type="button" onclick="HermesArtifact.copyHistoryFile('${safePath}')">复制文件</button>
          <button type="button" onclick="HermesArtifact.moveHistoryFile('${safePath}')">移动分类位置</button>
          <button type="button" class="danger" onclick="HermesArtifact.deleteHistoryFile('${safePath}')">删除</button>
        </div>
        <button type="button" class="history-card-main" aria-label="预览 ${esc(title)}" onclick="HermesArtifact.previewHistoryFile('${safePath}', '${safeName}')">
          <span class="history-card-doc-icon" aria-hidden="true">${renderToolbarIcon('doc')}</span>
          <div class="history-card-content">
            <div class="history-card-title">${esc(title)}</div>
            <div class="history-card-meta">
              <span class="history-card-meta-left">
                ${esc(date)}
                <span class="history-card-type">${esc(f.mdType || f.type || f.folder || 'Markdown')}</span>
                ${tags.map(tag => `<span class="history-card-tag" data-tag="${esc(tag)}">${esc(tag)}</span>`).join('')}
              </span>
              <span class="history-card-size">${esc(fmtBytes(f.size))}</span>
            </div>
          </div>
        </button>
      </div>`;
  }

  function postKnowledgeGraphView() {
    const frame = document.getElementById('kgGraphFrame');
    if (!frame || !frame.contentWindow) return;
    try { frame.contentWindow.postMessage({ type: 'set-view', view: knowledgeGraphView }, '*'); } catch {}
  }

  function setKnowledgeGraphView(view) {
    if (!['graph', 'list', 'stats'].includes(view)) return;
    knowledgeGraphView = view;
    syncToolbarActive();
    postKnowledgeGraphView();
  }

  function renderToolbarCategoryMenu() {
    const menu = $('#artifactLibraryMenu');
    if (!menu) return;
    const files = historyData?.filesFlat || [];
    const images = imageWaterfallData || [];
    const tags = historyData?.tags || [];
    const categories = (historyData?.vaultCategories || []).filter(item => item && item.id !== 'outputs');
    const categoryButtons = categories
      .filter(item => (item.files || []).length || item.dynamic || item.id !== 'inbox')
      .map(item => {
        const mode = 'category:' + item.id;
        const count = (item.files || []).length;
        return `<button class="${historyMode === mode ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('${esc(mode)}')">${esc(item.label || item.folder || '分类')}<span>${count || ''}</span></button>`;
      })
      .join('');
    menu.innerHTML = `
      <button class="${historyMode === 'category:outputs' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('category:outputs')">输出文档<span>${files.length}</span></button>
      <button class="${historyMode === 'tag' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('tag')">按标签<span>${tags.length || ''}</span></button>
      ${categoryButtons ? `<div class="doc-library-menu-sep"></div>${categoryButtons}` : ''}
      <div class="doc-library-menu-sep"></div>
      <button class="${historyMode === 'category:images' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('category:images')">输出图片<span>${images.length || ''}</span></button>
      <button class="${historyMode === 'graph' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('graph')">知识图谱</button>
    `;
    menu.style.display = historyCategoryMenuOpen ? 'flex' : 'none';
  }

  function renderHistoryList() {
    const hist = $('#artifactHistory');
    if (!hist || !historyData) return;
    syncToolbarState();
    syncDocumentHeader();
    renderToolbarCategoryMenu();
    const menuAll = historyData.filesFlat || [];
    const menuTags = historyData.tags || [];
    const menuCategories = historyData.vaultCategories || [];
    if (historyPreview) {
      hist.innerHTML = `
        <div class="artifact-history-preview-head">
          <button class="history-back-btn" onclick="HermesArtifact.backToHistoryList()" aria-label="返回知识库">←</button>
          <div class="artifact-history-preview-meta">
            <div class="artifact-history-preview-label">文档预览</div>
            <div class="artifact-history-preview-title">${esc(historyPreview.title || 'Markdown 预览')}</div>
            <div class="artifact-history-preview-path" title="${esc(historyPreview.path || '')}">${esc(historyPreview.path || '')}</div>
          </div>
          <div class="artifact-preview-actions">
            <button class="artifact-more-btn" onclick="HermesArtifact.toggleHistoryMore(event)" title="更多操作" aria-label="更多操作" aria-haspopup="menu">⋮</button>
            <div class="artifact-more-menu" id="artifactHistoryMoreMenu">
              <button type="button" onclick="HermesArtifact.openHistoryPreviewFile()">打开文件</button>
              <button type="button" class="danger" onclick="HermesArtifact.confirmDeleteHistoryFile()">删除文件</button>
            </div>
          </div>
        </div>
        <div class="artifact-history-preview markdown-body artifact-preview" id="artifactHistoryPreview"></div>`;
      flushPreviewNow('markdown', '', historyPreview.content || '', $('#artifactHistoryPreview'));
      syncDocumentHeader();
      return;
    }
    const all = historyData.filesFlat || [];
    const folders = (historyData.folders || []).filter(group => (group.files || []).length > 0);
    const tags = historyData.tags || [];
    const categories = historyData.vaultCategories || [];
    const outputCategory = categories.find(item => item.id === 'outputs') || { id: 'outputs', label: '输出文档', folder: '输出文档', files: all.filter(f => ['输出文档','工作文档','AI分享','教程','笔记'].includes(f.folder)) };
    const currentCategoryId = String(historyMode || '').startsWith('category:') ? String(historyMode).slice(9) : 'outputs';
    const currentCategory = categories.find(item => item.id === currentCategoryId) || outputCategory;
    const documentCategories = categories.filter(item => item.id !== 'inbox');
    const viewTitles = { 'category:outputs': '输出文档', 'category:images': '输出图片', 'graph': '知识图谱' };
    const viewTitle = viewTitles[historyMode] || (currentCategory.label || currentCategory.folder || '输出文档');
    const viewHeader = '';
    if (!all.length && historyMode !== 'category:images' && historyMode !== 'graph') {
      hist.innerHTML = viewHeader + renderDocListEmpty();
      return;
    }
    if (historyMode === 'graph') {
      const kgTheme = currentArtifactTheme();
      hist.innerHTML = viewHeader + '<div class="kg-iframe-wrap"><iframe id="kgGraphFrame" src="/knowledge-graph/?theme=' + kgTheme + '&v=' + Date.now() + '" style="width:100%;height:100%;border:none" frameborder="0"></iframe></div>';
      const wrap = hist.querySelector('.kg-iframe-wrap');
      function _syncKgHeight() {
        if (!wrap || !hist) return;
        const rect = hist.getBoundingClientRect();
        wrap.style.height = Math.max(360, window.innerHeight - rect.top) + 'px';
      }
      _syncKgHeight();
      if (_kgResizeObs) _kgResizeObs.disconnect();
      _kgResizeObs = new ResizeObserver(_syncKgHeight);
      _kgResizeObs.observe(hist);
      const frame = document.getElementById('kgGraphFrame');
      if (frame) {
        frame.addEventListener('load', () => {
          try {
            frame.contentWindow.postMessage({ type: 'theme', theme: currentArtifactTheme(), apiBase: window.location.origin }, '*');
            postKnowledgeGraphView();
            setTimeout(postKnowledgeGraphView, 80);
          } catch {}
        });
      }
      return;
    }
    if (historyMode === 'category:images') {
      hist.innerHTML = viewHeader + '<div class="image-waterfall-loading" style="text-align:center;padding:20px;color:var(--c-ink-muted)">加载图片中...</div>';
      loadImageWaterfall();
      return;
    }
    if (historyMode === 'tag') {
      hist.innerHTML = viewHeader + (tags.length ? tags.map(group => {
        const files = (group.files || []);
        if (!files.length) return '';
        return `
        <div class="history-month-group">
          <div class="history-month-title">#${esc(group.name || group.tag || '标签')} (${files.length})</div>
          <div class="history-cards">${files.map(renderHistoryCard).join('')}</div>
        </div>`;
      }).join('') || renderDocListEmpty('当前标签下还没有文档。') : renderDocListEmpty('还没有带标签的文档。'));
      return;
    }
    if (historyMode === 'category:outputs') {
      // 输出文档视图 — 子过滤只保留「全部 / 临时收件箱」；自动分类由右上工具栏按钮承载。
      const inboxCategory = categories.find(item => item.id === 'inbox') || { id: 'inbox', label: '临时收件箱', folder: '临时收件箱', files: all.filter(f => f.folder === '临时收件箱') };
      const allCount = all.length;
      const tabs = [
        `<button class="${historySubFilter === 'all' ? 'active' : ''}" onclick="HermesArtifact.setSubFilter('all')">全部 (${allCount})</button>`,
        `<button class="${historySubFilter === 'inbox' ? 'active' : ''}" onclick="HermesArtifact.setSubFilter('inbox')">临时收件箱 (${(inboxCategory.files || []).length})</button>`,
      ];
      const subTabs = `<div class="doc-sub-tabs">${tabs.join('')}</div>`;
      let files, title;
      if (historySubFilter === 'inbox') {
        files = inboxCategory.files || [];
        title = '临时收件箱';
      } else {
        files = all;
        title = '全部文档';
      }
      hist.innerHTML = viewHeader + subTabs + `<div class="history-month-group">
        <div class="history-month-title">${esc(title)} (${files.length})</div>
        <div class="history-cards">${files.length ? files.map(renderHistoryCard).join('') : renderDocListEmpty('暂无文档')}</div>
      </div>`;
      return;
    }
    if (String(historyMode || '').startsWith('category:')) {
      const files = currentCategory.files || [];
      const title = currentCategory.label || currentCategory.folder || '文档';
      hist.innerHTML = viewHeader + `<div class="history-month-group">
        <div class="history-month-title">${esc(title)} (${files.length})</div>
        <div class="history-cards">${files.length ? files.map(renderHistoryCard).join('') : renderDocListEmpty('这个分类还没有文档。')}</div>
      </div>`;
      return;
    }
    const files = (all);
    hist.innerHTML = viewHeader + `<div class="history-month-group">
      <div class="history-month-title">全部 · 按时间 (${files.length})</div>
      <div class="history-cards">${files.length ? files.map(renderHistoryCard).join('') : renderDocListEmpty('暂无文档')}</div>
    </div>`;
  }
  function setHistoryMode(mode) {
    if (_kgResizeObs && mode !== 'graph') { _kgResizeObs.disconnect(); _kgResizeObs = null; }
    historyMode = mode;
    historySubFilter = 'all';
    historyPreview = null;
    historyCategoryMenuOpen = false;
    historyCategoryMenuPos = null;
    if (currentTab !== 'history') showHistory();
    syncToolbarActive();
    renderHistoryList();
  }
  function setSubFilter(f) {
    historySubFilter = f;
    renderHistoryList();
  }

  // --- Image waterfall ---
  let imageWaterfallData = null;

  async function loadImageWaterfall() {
    const hist = $('#artifactHistory');
    if (!hist) return;
    try {
      const res = await fetch(apiBase() + '/api/images/', { cache: 'no-store' });
      const data = await res.json();
      const images = (Array.isArray(data) ? data : (data.data || data.images || [])).filter(img => img.kind === 'output' && (img.publicUrl || img.url || img.id || img.filename));
      imageWaterfallData = images;
      renderImageWaterfall(images);
    } catch (e) {
      const loading = hist.querySelector('.image-waterfall-loading');
      if (loading) loading.textContent = '加载图片失败：' + esc(e.message);
    }
  }

  function renderImageWaterfall(images) {
    const hist = $('#artifactHistory');
    if (!hist) return;
    const tabs = hist.querySelector('.doc-library-tabs');
    const tabsHtml = tabs ? tabs.outerHTML : '';
    const head = hist.querySelector('.doc-library-head');
    const headHtml = head ? head.outerHTML : '';
    if (!images || !images.length) {
      hist.innerHTML = headHtml + tabsHtml + '<div class="history-empty-docs"><h3>暂无图片</h3><p>生成图片后会出现在这里。</p></div>';
      return;
    }
    const cards = images.map(img => {
      const imgUrl = getImagePreviewUrl(img);
      const promptText = img.prompt || img.sourcePrompt || '无提示词';
      const prompt = esc(promptText);
      return `<div class="image-waterfall-card" data-url="${esc(imgUrl)}" data-prompt="${prompt}" onclick="HermesArtifact.openImageLightboxFromCard(this)">
        <div class="image-waterfall-thumb"><img src="${esc(imgUrl)}" alt="${prompt}" loading="lazy" /></div>
        <div class="image-waterfall-prompt" title="点击复制提示词" onclick="event.stopPropagation();HermesArtifact.copyImagePrompt(this.closest('.image-waterfall-card'))">${prompt}</div>
      </div>`;
    }).join('');
    hist.innerHTML = headHtml + tabsHtml + '<div class="image-waterfall">' + cards + '</div>';
  }

  function getImagePreviewUrl(img) {
    if (!img) return '';
    if (img.publicUrl) return img.publicUrl;
    if (img.url) return img.url;
    if (img.id) return '/api/images/file/' + encodeURIComponent(img.id);
    if (img.filename) return '/api/images/file/' + encodeURIComponent(img.filename);
    return '';
  }

  function ensureImageLightboxLayer() {
    const lb = document.getElementById('imageLightbox');
    if (!lb) return null;
    if (lb.parentElement !== document.body) document.body.appendChild(lb);
    if (lb.dataset.bound !== '1') {
      lb.dataset.bound = '1';
      lb.addEventListener('click', (event) => {
        if (event.target === lb || event.target.classList.contains('lightbox-backdrop')) closeImageLightbox();
      });
    }
    return lb;
  }

  function openImageLightboxFromCard(card) {
    if (!card) return;
    openImageLightbox(card.dataset.url || '', card.dataset.prompt || '无提示词');
  }
  function openImageLightbox(url, prompt) {
    const lb = ensureImageLightboxLayer();
    if (!lb) return;
    const img = lb.querySelector('.lightbox-img');
    const promptEl = lb.querySelector('.lightbox-prompt');
    if (img) { img.src = url; }
    if (promptEl) {
      const text = prompt || '无提示词';
      promptEl.innerHTML = '<div class="lightbox-prompt-text"></div><button type="button" class="lightbox-prompt-copy" onclick="event.stopPropagation();HermesArtifact.copyLightboxPrompt()">复制提示词</button>';
      const textEl = promptEl.querySelector('.lightbox-prompt-text');
      if (textEl) textEl.textContent = text;
      promptEl.title = text;
    }
    lb.classList.add('open');
  }

  function toggleImageLightboxZoom(img, event) {
    if (event) event.stopPropagation();
    if (!img) return;
    img.classList.toggle('zoomed');
  }
  function closeImageLightbox() {
    const lb = document.getElementById('imageLightbox');
    if (lb) {
      lb.classList.remove('open');
      const img = lb.querySelector('.lightbox-img');
      if (img) {
        img.removeAttribute('src');
        img.classList.remove('zoomed');
      }
    }
  }

  function copyImagePrompt(el) {
    const card = el && el.closest ? el.closest('.image-waterfall-card') : el;
    const text = card ? (card.dataset && card.dataset.prompt ? card.dataset.prompt : (card.textContent || card.title || '')) : '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => showToast('提示词已复制')).catch(() => {});
  }

  function copyLightboxPrompt() {
    const promptEl = document.querySelector('#imageLightbox .lightbox-prompt-text') || document.querySelector('#imageLightbox .lightbox-prompt');
    if (!promptEl) return;
    navigator.clipboard.writeText(promptEl.textContent || '').then(() => showToast('提示词已复制')).catch(() => {});
  }

  function showToast(msg) {
    let t = document.getElementById('hermesToast');
    if (!t) { t = document.createElement('div'); t.id = 'hermesToast'; t.className = 'hermes-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  // --- Sync prompts ---
  async function syncPrompts() {
    const actionBtn = $('#artifactHistoryActionBtn');
    const oldText = actionBtn ? actionBtn.textContent : '';
    if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = '同步中…'; }
    showToast('正在同步提示词…');
    try {
      const res = await fetch(apiBase() + '/api/knowledge/sync-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (data && data.code === 0) {
        const d = data.data || {};
        const parts = [];
        if (d.synced) parts.push('新增 ' + d.synced + ' 条');
        if (d.duplicated) parts.push('重复 ' + d.duplicated + ' 条');
        showToast('同步完成：' + (parts.join('，') || '无新内容'));
      } else {
        showToast('同步失败：' + (data && data.msg ? data.msg : '未知错误'));
      }
    } catch (e) {
      showToast('同步失败：' + e.message);
    } finally {
      if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = oldText || '同步问题'; }
    }
  }
  async function syncAndRefreshGraph() {
    await syncPrompts();
    const frame = document.getElementById('kgGraphFrame');
    if (frame) {
      try { frame.contentWindow.postMessage({ type: 'refresh' }, '*'); } catch {}
    }
  }

  // --- Auto classify ---
  async function autoClassify() {
    const actionBtn = $('#artifactHistoryActionBtn');
    const oldText = actionBtn ? actionBtn.textContent : '';
    if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = '分类中…'; }
    showToast('正在自动分类…');
    try {
      const res = await fetch(apiBase() + '/api/knowledge/auto-classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (data && data.code === 0) {
        const d = data.data || {};
        const errors = Array.isArray(d.errors) ? d.errors.length : 0;
        showToast('已分类 ' + (d.moved || 0) + ' 个文件' + (d.skipped ? '，跳过 ' + d.skipped + ' 个' : '') + (errors ? '，错误 ' + errors + ' 个' : ''));
        loadHistory();
      } else {
        showToast('分类失败：' + (data && data.msg ? data.msg : '未知错误'));
      }
    } catch (e) {
      showToast('分类失败：' + e.message);
    } finally {
      if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = oldText || '自动分类'; }
    }
  }
  function toggleHistoryCategoryMenu() {
    historyCategoryMenuOpen = !historyCategoryMenuOpen;
    historyCategoryMenuPos = null;
    if (currentTab !== 'history') {
      if (!historyData) {
        loadHistory().then(() => renderToolbarCategoryMenu());
      } else {
        renderToolbarCategoryMenu();
      }
      return;
    }
    renderHistoryList();
  }

  async function loadHistory() {
    const hist = $('#artifactHistory');
    if (!hist) return;
    hist.innerHTML = '<div style="text-align:center;padding:20px;color:var(--c-ink-muted)">加载中...</div>';
    try {
      const res = await fetch(apiBase() + '/api/system/md-library', { cache: 'no-store' });
      const data = await res.json();
      if (!data || data.code !== 0 || !data.data) {
        hist.innerHTML = '<div style="text-align:center;padding:20px;color:var(--c-ink-muted)">暂无文档</div>';
        return;
      }
      historyData = data.data;
      renderHistoryList();
    } catch (e) {
      console.error('[HermesArtifact] loadHistory failed', e);
      hist.innerHTML = '<div style="text-align:center;padding:20px;color:var(--c-error)">加载失败：' + esc(e && e.message ? e.message : String(e || '未知错误')) + '</div>';
    }
  }

  async function openHistoryFile(encodedPath, encodedName) {
    return previewHistoryFile(encodedPath, encodedName);
  }

  async function previewHistoryFile(encodedPath, encodedName) {
    const path = decodeURIComponent(encodedPath);
    const name = (decodeURIComponent(encodedName || '') || fileNameFromPath(path)).replace(/\.md$/i, '');
    try {
      const res = await fetch(apiBase() + '/api/system/file-content?path=' + encodeURIComponent(path));
      const data = await res.json();
      if (data && data.data && data.data.content) {
        resetSession();
        recordCompletedArtifacts([{ attrs: { title: name, type: 'markdown' }, content: data.data.content }]);
        currentTitle = name;
        currentFilePath = path;
        // 初始化文档快照，让后续 diff 比较有基准
        updateDocumentSnapshot(path, data.data.content);
        try { if (global.state) global.state.artifactContextIgnored = false; } catch (_) {}
        window.__hermesLastArtifactBody = data.data.content;
        window.__hermesCurrentSourceBody = data.data.content;
        historyPreview = null;
        setTab('preview');
        openRef(name);
        notifyArtifactContextChanged();
      }
    } catch (e) {
      currentTitle = name || '没有内容';
      currentFilePath = path || '';
      openEmpty(currentTitle, e && e.message ? e.message : '读取本地 Markdown 失败。');
      notifyArtifactContextChanged();
    }
  }

  function toggleHistoryMore(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const menu = $('#artifactHistoryMoreMenu');
    if (!menu) return;
    menu.classList.toggle('open');
  }

  function toggleHistoryCardMenu(event, id) {
    if (event && event.stopPropagation) event.stopPropagation();
    document.querySelectorAll('.history-card-menu.open').forEach(menu => {
      if (menu.id !== id) menu.classList.remove('open');
    });
    const menu = document.getElementById(id);
    if (menu) menu.classList.toggle('open');
  }

  async function renameHistoryFile(encodedPath, encodedName) {
    const file = decodeURIComponent(encodedPath || '');
    const currentName = decodeURIComponent(encodedName || '').replace(/\.md$/i, '');
    document.querySelectorAll('.history-card-menu.open').forEach(menu => menu.classList.remove('open'));
    if (!file) return;
    const nextName = await askRenameHistoryFile(currentName);
    if (!nextName || !nextName.trim() || nextName.trim() === currentName) return;
    try {
      const res = await fetch(apiBase() + '/api/system/md-library', {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file, name: nextName.trim() }),
      });
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error(data && data.msg ? data.msg : '重命名失败');
      if (global.toast) global.toast('文档已重命名', 'success');
      historyData = null;
      await loadHistory();
    } catch (e) {
      if (global.toast) global.toast(e && e.message ? e.message : '重命名失败', 'error');
    }
  }

  async function copyHistoryFile(encodedPath) {
    const file = decodeURIComponent(encodedPath || '');
    document.querySelectorAll('.history-card-menu.open').forEach(menu => menu.classList.remove('open'));
    if (!file) return;
    try {
      const res = await fetch(apiBase() + '/api/system/md-library/copy', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file }),
      });
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error(data && data.msg ? data.msg : '复制失败');
      historyData = null;
      if (global.toast) global.toast('已复制文档', 'success');
      await loadHistory();
    } catch (e) {
      if (global.toast) global.toast(e && e.message ? e.message : '复制失败', 'error');
    }
  }

  function historyMoveCategories(currentFolder = '') {
    const seen = new Set();
    const out = [];
    const add = (folder, label, count) => {
      const f = String(folder || '').trim();
      if (!f || seen.has(f)) return;
      seen.add(f);
      out.push({ folder: f, label: String(label || f).trim(), count: Number(count || 0), current: f === currentFolder });
    };
    (historyData?.vaultCategories || []).forEach(item => add(item.folder || item.label, item.label || item.folder, (item.files || []).length));
    (historyData?.folders || []).forEach(item => add(item.folder || item.name, item.name || item.folder, (item.files || []).length));
    return out.filter(item => item.folder !== '根目录').sort((a, b) => {
      if (a.current && !b.current) return -1;
      if (!a.current && b.current) return 1;
      return b.count - a.count || a.label.localeCompare(b.label, 'zh-CN');
    });
  }

  function askMoveHistoryFileCategory(file, currentFolder) {
    return new Promise(resolve => {
      const categories = historyMoveCategories(currentFolder);
      if (!categories.length) { resolve(''); return; }
      if (typeof global.openModal !== 'function') {
        resolve(categories.find(item => !item.current)?.folder || '');
        return;
      }
      const buttons = categories.map(item => `
        <button type="button" class="doc-move-category-btn ${item.current ? 'current' : ''}" data-folder="${esc(item.folder)}" ${item.current ? 'disabled' : ''}>
          <span>${esc(item.label)}</span>
          <small>${item.current ? '当前分类' : (item.count + ' 个文档')}</small>
        </button>`).join('');
      global.openModal(`
        <div class="doc-rename-modal doc-move-modal">
          <div class="doc-rename-head">
            <div class="doc-rename-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3.5 5.5h5l1.4 1.8h6.6v8.2h-13v-10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M7 11h6M10.5 8.5 13 11l-2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="doc-rename-title">
              <h3>移动分类位置</h3>
              <p>移动会改变文件所在文件夹；多分类请通过 Markdown 标签维护。</p>
            </div>
          </div>
          <div class="doc-move-file" title="${esc(file)}">当前文件夹：${esc(currentFolder || '未分类')}</div>
          <div class="doc-move-category-list">${buttons}</div>
          <div class="rename-actions">
            <button class="btn btn-ghost" id="historyMoveCancel">取消</button>
          </div>
        </div>
      `, { className: 'doc-rename-shell' });
      setTimeout(() => {
        const done = value => {
          if (typeof global.closeModal === 'function') global.closeModal();
          resolve(value || '');
        };
        document.querySelectorAll('.doc-move-category-btn:not([disabled])').forEach(btn => {
          btn.addEventListener('click', () => done(btn.dataset.folder || ''));
        });
        const cancel = document.getElementById('historyMoveCancel');
        if (cancel) cancel.onclick = () => done('');
      }, 0);
    });
  }

  async function moveHistoryFile(encodedPath) {
    const file = decodeURIComponent(encodedPath || '');
    document.querySelectorAll('.history-card-menu.open').forEach(menu => menu.classList.remove('open'));
    if (!file) return;
    const currentFolder = (historyData && historyData.filesFlat || []).find(item => item.path === file)?.folder || '';
    const nextFolder = await askMoveHistoryFileCategory(file, currentFolder);
    if (!nextFolder || !nextFolder.trim() || nextFolder.trim() === currentFolder) return;
    try {
      const res = await fetch(apiBase() + '/api/system/md-library/move', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file, folder: nextFolder.trim() }),
      });
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error(data && data.msg ? data.msg : '移动失败');
      historyData = null;
      if (historyPreview && historyPreview.path === file) historyPreview.path = data.data && data.data.path ? data.data.path : historyPreview.path;
      if (currentFilePath === file && data.data && data.data.path) currentFilePath = data.data.path;
      if (global.toast) global.toast('已移动到：' + nextFolder.trim(), 'success');
      await loadHistory();
    } catch (e) {
      if (global.toast) global.toast(e && e.message ? e.message : '移动失败', 'error');
    }
  }

  function askRenameHistoryFile(currentName) {
    return new Promise(resolve => {
      const safeValue = esc(currentName || '');
      if (typeof global.openModal !== 'function') {
        resolve('');
        return;
      }
      global.openModal(`
        <div class="doc-rename-modal">
          <div class="doc-rename-head">
            <div class="doc-rename-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4.25 3.25h7.08c.3 0 .6.12.81.33l3.28 3.28c.21.21.33.51.33.81v9.08h-11.5V3.25Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M11.25 3.5v4h4M6.75 11h6.5M6.75 14h4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="doc-rename-title">
              <h3>编辑文档名称</h3>
              <p>仅修改名称，内容和分类保持不变。</p>
            </div>
          </div>
          <label class="doc-rename-field">
            <span>文档名称</span>
            <input id="historyRenameInput" class="rename-input" value="${safeValue}" placeholder="输入新的文档名称">
          </label>
          <div class="rename-actions">
            <button class="btn btn-ghost" id="historyRenameCancel">取消</button>
            <button class="btn btn-primary" id="historyRenameOk">保存</button>
          </div>
        </div>
      `, { className: 'doc-rename-shell' });
      setTimeout(() => {
        const input = document.getElementById('historyRenameInput');
        const cancel = document.getElementById('historyRenameCancel');
        const ok = document.getElementById('historyRenameOk');
        const done = value => {
          if (typeof global.closeModal === 'function') global.closeModal();
          resolve(value || '');
        };
        if (input) {
          input.focus();
          input.select();
          input.addEventListener('keydown', event => {
            if (event.key === 'Enter') done(input.value.trim());
            if (event.key === 'Escape') done('');
          });
        }
        if (cancel) cancel.onclick = () => done('');
        if (ok) ok.onclick = () => done(input ? input.value.trim() : '');
      }, 0);
    });
  }

  async function deleteHistoryFile(encodedPath) {
    const file = decodeURIComponent(encodedPath || '');
    document.querySelectorAll('.history-card-menu.open').forEach(menu => menu.classList.remove('open'));
    if (!file) return;
    const message = '确定删除这个 Markdown 文档吗？\n\n' + file + '\n\n删除后会从本地知识库移除。';
    const ok = typeof global.askConfirm === 'function'
      ? await global.askConfirm(message)
      : (global.confirm ? global.confirm(message) : false);
    if (!ok) return;
    try {
      const res = await fetch(apiBase() + '/api/system/md-library?path=' + encodeURIComponent(file), {
        method: 'DELETE',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error(data && data.msg ? data.msg : '删除失败');
      if (global.toast) global.toast('文档已删除', 'success');
      historyPreview = null;
      historyData = null;
      await loadHistory();
    } catch (e) {
      if (global.toast) global.toast(e && e.message ? e.message : '删除失败', 'error');
    }
  }

  function hideHistoryMore() {
    const menu = $('#artifactHistoryMoreMenu');
    if (menu) menu.classList.remove('open');
  }

  function openHistoryPreviewFile() {
    const file = historyPreview && historyPreview.path ? historyPreview.path : '';
    hideHistoryMore();
    if (!file) return;
    openFileLocation(encodeURIComponent(file));
  }

  async function confirmDeleteHistoryFile() {
    const file = historyPreview && historyPreview.path ? historyPreview.path : '';
    if (!file) return;
    hideHistoryMore();
    const message = '确定删除这个 Markdown 文档吗？\n\n' + file + '\n\n删除后会从本地知识库移除。';
    const ok = typeof global.askConfirm === 'function'
      ? await global.askConfirm(message)
      : (global.confirm ? global.confirm(message) : false);
    if (!ok) return;
    try {
      const res = await fetch(apiBase() + '/api/system/md-library?path=' + encodeURIComponent(file), {
        method: 'DELETE',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error(data && data.msg ? data.msg : '删除失败');
      historyPreview = null;
      historyData = null;
      if (global.toast) global.toast('文档已删除', 'success');
      await loadHistory();
    } catch (e) {
      if (global.toast) global.toast(e && e.message ? e.message : '删除失败', 'error');
    }
  }
  async function openFileLocation(encodedPath) {
    const path = decodeURIComponent(encodedPath || '');
    if (!path) return;
    try {
      await fetch(apiBase() + '/api/system/open-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch (_) {}
  }

  function backToHistoryList() {
    historyPreview = null;
    renderHistoryList();
    notifyArtifactContextChanged();
  }

  function showHistory() {
    historyPreview = null;
    currentFilePath = '';
    layout = layout === 'CHAT_ONLY' ? 'SPLIT_VIEW' : layout;
    applyLayout();
    setTab('history');
    notifyArtifactContextChanged();
  }

  function getCurrentBody() {
    return getSourceText();
  }

  async function copyContent() {
    const text = getSourceText();
    if (await writeClipboardText(text)) {
      const b = $('#artifactCopyBtn');
      if (b) {
        const o = b.innerHTML;
        b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => { b.innerHTML = o; }, 1600);
      }
    }
  }


  function shouldAutoSaveArtifact(cur) {
    if (!cur || cur.incomplete) return false;
    const type = String(cur.attrs && cur.attrs.type || 'markdown').toLowerCase();
    if (type !== 'markdown') return false;
    const body = String(cur.content || '').trim();
    if (body.length < 120) return false;
    const title = String(cur.attrs && cur.attrs.title || firstHeading(body) || '').trim();
    if (!title) return false;
    const key = title + '::' + body.length + '::' + body.slice(0, 80);
    if (autoSavedKeys.has(key)) return false;
    autoSavedKeys.add(key);
    return { title, body, key };
  }

  async function autoSaveCompletedArtifact(cur) {
    const doc = shouldAutoSaveArtifact(cur);
    if (!doc) return;
    const folder = inferFolderFromContent(doc.body, doc.title);
    const btn = $('#artifactSaveBtn');
    const old = btn ? btn.textContent : '';
    if (btn) {
      btn.textContent = '自动保存中…';
      btn.disabled = true;
    }
    try {
      const res = await fetch(apiBase() + '/api/system/md-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: doc.title, folder, content: doc.body }),
      });
      const data = await readJsonResponse(res, '保存失败：请重启 WebUI 后端后再试');
      historyData = null;
      if (data.data && data.data.path) currentFilePath = data.data.path;
      if (global.toast) global.toast('已自动保存到知识库：' + data.data.folder, 'success');
      if (btn) btn.textContent = '已自动保存';
      setTimeout(() => {
        const current = $('#artifactSaveBtn');
        if (current && current.textContent === '已自动保存') current.textContent = old || '保存到知识库';
      }, 2200);
    } catch (e) {
      autoSavedKeys.delete(doc.key);
      if (global.toast) global.toast('自动保存失败，可手动保存', 'warning');
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.textContent === '自动保存中…') btn.textContent = old || '保存到知识库';
      }
    }
  }
  function inferFolderFromContent(content, title) {
    const text = (String(title || '') + '\n' + String(content || '')).toLowerCase();
    if (/教程|guide|how\s*to|manual|步骤|使用说明|排错/.test(text)) return '教程';
    if (/分享|share|presentation|演讲|课程|案例拆解/.test(text)) return 'AI分享';
    if (/笔记|note|memo|灵感|学习|知识卡片/.test(text)) return '笔记';
    if (/工作|方案|需求|prd|复盘|汇报|会议|report|plan|proposal/.test(text)) return '工作文档';
    return '临时收件箱';
  }

  function firstHeading(content) {
    const m = String(content || '').match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : '';
  }

  async function saveToLibrary() {
    const body = getSourceText().trim();
    if (!body) {
      if (global.toast) global.toast('当前没有可保存的 Markdown', 'warning');
      return;
    }
    const title = currentTitle || firstHeading(body) || '未命名文档';
    const folder = inferFolderFromContent(body, title);
    const btn = $('#artifactSaveBtn');
    const old = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '保存中…';
    }
    try {
      const res = await fetch(apiBase() + '/api/system/md-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, folder, content: body }),
      });
      const data = await readJsonResponse(res, '保存失败：请重启 WebUI 后端后再试');
      historyData = null;
      if (data.data && data.data.path) currentFilePath = data.data.path;
      if (global.toast) global.toast('已保存到知识库：' + data.data.folder, 'success');
      const verEl = $('#artifactVersionText');
      if (verEl) verEl.textContent = '已保存';
      if (currentTab === 'history') loadHistory();
    } catch (e) {
      if (global.toast) global.toast(e && e.message ? e.message : '保存失败', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || '保存到知识库';
      }
    }
  }

  function download() {
    if (currentFilePath) {
      openFileLocation(encodeURIComponent(currentFilePath));
      return;
    }
    const list = getVersionList(currentTitle);
    const body = getSourceText();
    const typ = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex].type : 'markdown';
    const ext = typ === 'code' ? 'txt' : typ === 'html' ? 'html' : typ === 'mermaid' ? 'mmd' : 'md';
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (currentTitle || 'artifact').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') + '.' + ext;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openNewWindow() {
    const list = getVersionList(currentTitle);
    const body = getSourceText();
    const typ = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex].type : 'markdown';
    const w = window.open('', '_blank');
    if (!w) return;
    if (typ === 'html') {
      w.document.write(body);
      w.document.close();
    } else {
      w.document.write('<pre style="white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace">' + esc(body) + '</pre>');
      w.document.close();
    }
  }

  function hydrateMessages(messages) {
    resetSession();
    const list = Array.isArray(messages) ? messages : [];
    for (const msg of list) {
      if (!msg || msg.role !== 'assistant') continue;
      const parsed = parseHermesStream(msg.content || '');
      const arts = parsed.completedArtifacts || [];
      if (arts.length) recordCompletedArtifacts(arts);
    }
    _prevCompletedArtifactCount = 0;
  }

  async function checkArtifactFileChanged() {
    try {
      const ctx = getCurrentMarkdownContext();
      if (!ctx || !ctx.path) return { changed: false };

      const res = await fetch(apiBase() + '/api/knowledge/markdown/status?path=' + encodeURIComponent(ctx.path), {
        cache: 'no-store',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) return { changed: false, error: 'fetch_failed' };

      const json = await res.json();
      if (json.code !== 0 || !json.data) return { changed: false, error: 'no_data' };

      const remote = json.data;
      const snapshot = ctx.snapshot || {};

      // 比较 hash 或 mtime
      const hashChanged = snapshot.hash && remote.hash && snapshot.hash !== remote.hash;
      const mtimeChanged = snapshot.mtime && remote.mtime && remote.mtime > snapshot.mtime;
      const changed = hashChanged || mtimeChanged;

      if (changed) {
        return { changed: true, remote, snapshot };
      }

      return { changed: false };
    } catch (e) {
      console.warn('[Artifact] checkArtifactFileChanged error:', e);
      return { changed: false, error: e.message };
    }
  }

  async function refreshArtifactDocument(options = {}) {
    try {
      const explicitPath = String(options.path || '').trim();
      const ctx = explicitPath ? { path: explicitPath, title: options.title || currentTitle || fileNameFromPath(explicitPath).replace(/\.md$/i, '') } : getCurrentMarkdownContext();
      if (!ctx || !ctx.path) return false;

      const data = await fetchMarkdownDocument(ctx.path);
      const documentPath = data.path || ctx.path;
      const documentTitle = options.title || ctx.title || currentTitle || fileNameFromPath(documentPath).replace(/\.md$/i, '') || 'Markdown';
      // 如果快照不存在，先从当前编辑器内容初始化（应对边缘情况）
      if (!_currentDocSnapshot) {
        const currentBody = getSourceText() || '';
        updateDocumentSnapshot(documentPath, currentBody || data.content);
      }
      const oldContent = String(options.oldContent !== undefined
        ? options.oldContent
        : ((_currentDocSnapshot && _currentDocSnapshot.content) || getSourceText() || window.__hermesLastArtifactBody || ''));
      const newContent = String(data.content || '');
      const diffRange = changedLineRange(oldContent, newContent);

      _currentDocSnapshot = {
        path: documentPath,
        content: newContent,
        mtime: data.mtime,
        hash: data.hash,
        size: data.size
      };

      currentFilePath = documentPath;
      currentTitle = documentTitle;
      window.__hermesLastArtifactBody = newContent;
      window.__hermesCurrentSourceBody = newContent;
      historyData = null;
      upsertDocumentVersion(documentTitle, documentPath, newContent, { type: 'markdown' });
      updateDocumentSnapshot(documentPath, newContent, data);

      if (diffRange) {
        lastEditHighlight = {
          path: documentPath,
          startLine: diffRange.lineStart,
          endLine: diffRange.lineEnd,
          text: diffRange.text,
          createdAt: Date.now(),
        };
      }

      // 计算行级 diff 并渲染绿色高亮
      const prev = $('#artifactPreview');
      if (prev && oldContent !== newContent) {
        // 清除旧高亮（有新修改时自动清除）
        clearOldDiffHighlights(prev);

        // 统一行尾符，避免 CRLF/LF 差异导致全绿
        if (!diffRange) {
          // 只是行尾符不同，不显示高亮
          flushPreviewNow('markdown', '', newContent, prev);
        } else {
          flushPreviewNow('markdown', '', renderMarkdownDiffHtml(oldContent, newContent), prev);
        }
      } else if (prev) {
        flushPreviewNow('markdown', '', newContent, prev);
      }

      if (options.tab === 'source' || currentTab === 'source') {
        layout = 'SPLIT_VIEW';
        loadSplit();
        currentTab = 'source';
        historyPreview = null;
        const hist = $('#artifactHistory');
        const srcShell = $('#artifactSourceShell');
        const src = $('#artifactSource');
        if (hist) hist.style.display = 'none';
        if (prev) prev.style.display = 'none';
        if (srcShell) srcShell.style.display = 'flex';
        if (src) src.style.display = 'block';
        applyLayout();
        syncToolbarActive();
        syncSourceEditor(newContent, { scrollToHighlight: options.scrollToHighlight !== false });
      }
      if (diffRange) scheduleSourceOverlaySync({ scrollToHighlight: options.scrollToHighlight !== false, retry: true, retries: 12 });
      notifyArtifactContextChanged();

      // 显示绿色高亮提示
      if (options.toast !== false) showDocumentChangedToast();

      return true;
    } catch (e) {
      console.warn('[Artifact] refreshArtifactDocument error:', e);
      return false;
    }
  }

  function clearOldDiffHighlights(container) {
    if (!container) return;
    // 移除所有旧的diff高亮class
    const oldHighlights = container.querySelectorAll('.artifact-diff-added');
    oldHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        // 将子节点移到父节点，去除span包裹
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    });
  }

  function showDocumentChangedToast() {
    // 移除已存在的toast
    const existing = document.querySelector('.artifact-change-toast');
    if (existing) existing.remove();

    // 创建新的toast
    const toast = document.createElement('div');
    toast.className = 'artifact-change-toast';
    toast.innerHTML = '<span class="toast-icon">✓</span><span>文档已更新</span>';
    document.body.appendChild(toast);

    // 2.5秒后淡出并移除
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function updateDocumentSnapshot(path, content, meta = {}) {
    if (!path || !content) return;
    const crypto = typeof window !== 'undefined' && window.crypto;
    let hash = '';
    if (crypto && crypto.subtle) {
      // 简单的客户端 hash（实际应该用服务端返回的）
      hash = String(content.length) + '_' + content.slice(0, 100).length;
    }
    _currentDocSnapshot = {
      path,
      content,
      mtime: meta.mtime || Date.now(),
      hash: meta.hash || hash,
      size: meta.size || content.length
    };
    // 清除旧的 diff 高亮
    clearDiffHighlights();
  }

  function clearDiffHighlights() {
    const prev = $('#artifactPreview');
    if (prev) {
      const diffs = prev.querySelectorAll('.artifact-diff-added');
      diffs.forEach(function(el) {
        el.className = '';
      });
    }
  }

  const API = {
    parseHermesStream,
    resetSession,
    initWorkbench,
    hydrateMessages,
    feedStream,
    finalizeStream,
    flashPanel,
    openRef,
    openEmpty,
    setLayout,
    bumpVersion,
    setTab,
    copyContent,
    hideExportMenu,
    toggleExportMenu,
    refreshCurrentView,
    saveToLibrary,
    download,
    openNewWindow,
    recordCompletedArtifacts,
    getVersionList,
    typeLabel,
    showHistory,
    getCurrentMarkdownContext,
    setKnowledgeGraphView,
    openHistoryFile,
    previewHistoryFile,
    toggleHistoryMore,
    toggleHistoryCardMenu,
    renameHistoryFile,
    copyHistoryFile,
    moveHistoryFile,
    deleteHistoryFile,
    hideHistoryMore,
    openHistoryPreviewFile,
    confirmDeleteHistoryFile,
    openFileLocation,
    backToHistoryList,
    backFromDocumentHeader,
    setHistoryMode,
    setSubFilter,
    toggleHistoryCategoryMenu,
    syncPrompts,
    syncAndRefreshGraph,
    autoClassify,
    openImageLightbox,
    openImageLightboxFromCard,
    toggleImageLightboxZoom,
    closeImageLightbox,
    copyImagePrompt,
    copyLightboxPrompt,
    insertLocalEditPrompt,
    getLocalEditContext,
    clearLocalEditContext,
    applyLocalEditReplacement,
    checkArtifactFileChanged,
    refreshArtifactDocument,
    updateDocumentSnapshot
  };


  if (!global.__hermesArtifactMessageBound) {
    global.__hermesArtifactMessageBound = true;
    global.addEventListener('message', (event) => {
      const msg = event && event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'artifact-refresh') {
        try {
          if (currentTab === 'history') loadHistory();
          else refreshCurrentView();
        } catch (_) {}
      }
    });
  }
  global.HermesArtifact = API;
})(typeof window !== 'undefined' ? window : this);






