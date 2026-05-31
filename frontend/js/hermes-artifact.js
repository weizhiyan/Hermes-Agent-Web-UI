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
  const DOC_FOLDERS = ['工作文档', 'AI分享', '教程', '笔记', '临时收件箱'];
  const autoSavedKeys = new Set();

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
    return { title, path, type: 'markdown', previewing: true, size: body ? body.length : 0 };
  }

  function syncDocumentHeader() {
    const head = $('#artifactDocumentHead');
    const titleEl = $('#artifactDocumentTitle');
    const show = currentTab !== 'history' || !!historyPreview;
    if (head) head.style.display = show ? 'flex' : 'none';
    if (titleEl) titleEl.textContent = artifactDisplayTitle();
  }

  function historyDisplayTitle() {
    if (historyMode === 'graph') return '知识图谱';
    if (historyMode === 'category:images') return '图片';
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
      const showSync = currentTab === 'history' && historyMode === 'graph';
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

  function syncSourceEditor(content) {
    const src = $('#artifactSource');
    if (!src) return;
    const text = content || '';
    if (src.value !== text) src.value = text;
    _sourceLastSaved = text;
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
    const label = mode === 'source' ? '代码模式选区' : '预览选区';
    return [
      '请对当前知识库文档做局部编辑，并把结果写回原文档。',
      '只修改下面选中的局部内容，不要重写全文；保持原文风格、Markdown 层级和上下文语气。',
      '如果你能操作文件，请读取文档路径，定位选区文本并替换为修改后的片段，然后保存。',
      '',
      '【文档】' + title,
      file ? '【文档路径】' + file : '【文档路径】当前 Artifact 尚未保存，请先根据上下文更新当前知识库文档',
      '【来源】' + label,
      '【选中内容】',
      text,
      '',
      '【修改要求】',
      ''
    ].join('\n');
  }

  function createLocalEditContext(text, mode) {
    const selectedText = String(text || '').trim().slice(0, 12000);
    if (!selectedText) return null;
    const sourceText = getSourceText() || '';
    return {
      id: 'local_edit_' + Date.now(),
      title: currentTitle || firstHeading(sourceText) || '当前知识库文档',
      path: currentFilePath || (historyPreview && historyPreview.path) || '',
      mode: mode === 'source' ? 'source' : 'preview',
      selectedText,
      sourceSnapshot: sourceText.slice(0, 200000),
      createdAt: Date.now(),
    };
  }

  function getLocalEditContext() {
    return localEditContext ? { ...localEditContext } : null;
  }

  function clearLocalEditContext(id) {
    if (!id || (localEditContext && localEditContext.id === id)) localEditContext = null;
  }

  async function applyLocalEditReplacement(replacement, contextId) {
    const ctx = localEditContext && (!contextId || localEditContext.id === contextId) ? localEditContext : null;
    if (!ctx || !ctx.selectedText) {
      if (global.toast) global.toast('没有可应用的局部编辑选区', 'warning');
      return false;
    }
    const nextText = String(replacement || '').trim();
    if (!nextText) {
      if (global.toast) global.toast('没有可应用的替换内容', 'warning');
      return false;
    }
    let source = getSourceText() || ctx.sourceSnapshot || '';
    if (!source.includes(ctx.selectedText) && ctx.path) {
      try {
        const res = await fetch(apiBase() + '/api/system/file-content?path=' + encodeURIComponent(ctx.path), { cache: 'no-store' });
        const data = await readJsonResponse(res, '读取文档失败');
        source = String((data.data && data.data.content) || '');
      } catch (_) {}
    }
    if (!source.includes(ctx.selectedText)) {
      if (global.toast) global.toast('原选区已变化，无法自动替换', 'warning');
      return false;
    }
    const updated = source.replace(ctx.selectedText, nextText);
    if (ctx.path) {
      const res = await fetch(apiBase() + '/api/system/file-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: ctx.path, content: updated }),
      });
      await readJsonResponse(res, '写回文档失败');
      currentFilePath = ctx.path;
      currentTitle = ctx.title || currentTitle;
    } else {
      currentTitle = ctx.title || currentTitle;
      const res = await fetch(apiBase() + '/api/system/md-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentTitle, folder: inferFolderFromContent(updated, currentTitle), content: updated }),
      });
      const data = await readJsonResponse(res, '保存文档失败');
      currentFilePath = data.data && data.data.path ? data.data.path : currentFilePath;
      currentTitle = data.data && data.data.title ? data.data.title : currentTitle;
    }
    window.__hermesLastArtifactBody = updated;
    historyData = null;
    clearLocalEditContext(ctx.id);
    recordCompletedArtifacts([{ attrs: { title: currentTitle || ctx.title, type: 'markdown', path: currentFilePath }, content: updated }]);
    openRef(currentTitle || ctx.title || '当前知识库文档');
    if (global.toast) global.toast('已应用到当前文档选区', 'success');
    return true;
  }

  function insertLocalEditPrompt(text, mode) {
    const ta = document.getElementById('chatInput');
    if (!ta) {
      if (global.toast) global.toast('请先回到对话页再局部编辑', 'warning');
      return;
    }
    const prompt = selectionEditPrompt(text, mode);
    localEditContext = createLocalEditContext(text, mode);
    const prefix = ta.value && ta.value.trim() ? '\n\n' : '';
    ta.value = (ta.value || '') + prefix + prompt;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof global.autoResizeInput === 'function') global.autoResizeInput(ta);
    if (global.toast) global.toast('已引用选中内容，可补充修改要求后发送', 'success');
  }

  function hideLocalEditBubble() {
    const bubble = document.getElementById('artifactLocalEditBubble');
    if (bubble) bubble.classList.remove('show');
  }

  function showLocalEditBubble(x, y, text, mode) {
    let bubble = document.getElementById('artifactLocalEditBubble');
    if (!bubble) {
      bubble = document.createElement('button');
      bubble.type = 'button';
      bubble.id = 'artifactLocalEditBubble';
      bubble.className = 'artifact-local-edit-bubble';
      bubble.title = '引用选区进行局部编辑';
      bubble.setAttribute('aria-label', '引用选区进行局部编辑');
      bubble.innerHTML = renderToolbarIcon('magic') + '<span>局部编辑</span>';
      document.body.appendChild(bubble);
      bubble.addEventListener('mousedown', event => event.preventDefault());
    }
    bubble._selectedText = text;
    bubble._selectedMode = mode;
    bubble.onclick = () => {
      insertLocalEditPrompt(bubble._selectedText || '', bubble._selectedMode || 'preview');
      hideLocalEditBubble();
    };
    bubble.style.left = Math.min(global.innerWidth - 116, Math.max(8, x + 10)) + 'px';
    bubble.style.top = Math.min(global.innerHeight - 44, Math.max(8, y + 10)) + 'px';
    bubble.classList.add('show');
  }

  function maybeShowLocalEditBubble(event) {
    const target = event && event.target;
    if (!target || target.closest('#artifactLocalEditBubble')) return;
    const src = $('#artifactSource');
    if (target === src && currentTab === 'source') {
      const start = src.selectionStart || 0;
      const end = src.selectionEnd || 0;
      const text = src.value.slice(start, end).trim();
      if (text.length >= 2) showLocalEditBubble(event.clientX, event.clientY, text.slice(0, 4000), 'source');
      else hideLocalEditBubble();
      return;
    }
    const preview = target.closest && target.closest('#artifactPreview,.artifact-history-preview');
    if (!preview) { hideLocalEditBubble(); return; }
    const sel = global.getSelection ? global.getSelection() : null;
    const text = sel ? String(sel.toString() || '').trim() : '';
    if (text.length < 2) { hideLocalEditBubble(); return; }
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    if (!node || !preview.contains(node)) { hideLocalEditBubble(); return; }
    showLocalEditBubble(event.clientX, event.clientY, text.slice(0, 4000), 'preview');
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
    if (currentTitle && currentTitle !== title && !cur.attrs.path) currentFilePath = '';
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

  function openRef(title) {
    currentTitle = title;
    const list = getVersionList(title);
    viewVersionIndex = list.length ? list.length - 1 : -1;
    layout = 'SPLIT_VIEW';
    setTab('preview');
    loadSplit();
    applyLayout();
    syncToolbarActive();
    if (list.length && viewVersionIndex >= 0) {
      const row = list[viewVersionIndex];
      window.__hermesLastArtifactBody = row.content;
      window.__hermesCurrentSourceBody = row.content;
      updatePanelUI(
        { attrs: { title, type: row.type, language: row.language }, content: row.content, incomplete: false },
        false
      );
    } else {
      updatePanelUI(null, false);
    }
    flashPanel();
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
    <textarea id="artifactSource" class="artifact-source artifact-source-editor" style="display:none" spellcheck="false"></textarea>
    <div id="artifactHistory" class="artifact-history" style="display:none"></div>
  </div>
  <div class="image-lightbox" id="imageLightbox">
    <div class="lightbox-backdrop" onclick="HermesArtifact.closeImageLightbox()"></div>
    <div class="lightbox-content">
      <button class="lightbox-close" onclick="HermesArtifact.closeImageLightbox()" aria-label="关闭">✕</button>
      <img class="lightbox-img" id="lightboxImg" alt="预览" />
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
    if (src && src.dataset.editBound !== '1') {
      src.dataset.editBound = '1';
      src.addEventListener('input', () => {
        updateCurrentArtifactBody(src.value || '');
      });
      src.addEventListener('paste', handleSourcePaste);
      src.addEventListener('mouseup', maybeShowLocalEditBubble);
      src.addEventListener('keyup', maybeShowLocalEditBubble);
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
    updatePanelUI({ attrs: { title: currentTitle, type: row.type, language: row.language }, content: row.content, incomplete: false }, false);
  }

  function setTab(tab) {
    currentTab = tab;
    if (tab !== 'history') historyPreview = null;
    syncToolbarActive();
    const prev = $('#artifactPreview');
    const src = $('#artifactSource');
    const hist = $('#artifactHistory');
    if (tab === 'history') {
      if (prev) prev.style.display = 'none';
      if (src) src.style.display = 'none';
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
    const body = (row && row.content != null ? row.content : '') || window.__hermesCurrentSourceBody || window.__hermesLastArtifactBody || (src ? src.value : '') || '';
    const typ = row ? (row.type || 'markdown') : 'markdown';
    const lang = row ? (row.language || '') : '';
    if (tab === 'source') {
      if (prev) prev.style.display = 'none';
      if (src) {
        syncSourceEditor(body);
        src.style.display = 'block';
      }
      window.__hermesCurrentSourceBody = body;
      window.__hermesLastArtifactBody = body;
    } else {
      if (src) src.style.display = 'none';
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
          <button type="button" onclick="HermesArtifact.moveHistoryFile('${safePath}')">移动分类</button>
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
    const categories = historyData?.vaultCategories || [];
    const categoryButtons = categories.map(item => {
      const id = String(item.id || item.folder || 'outputs');
      const label = item.label || item.folder || '文档';
      const count = (item.files || []).length;
      return `<button class="${historyMode === 'category:' + id ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('category:${esc(id)}')">${esc(label)}<span>${count}</span></button>`;
    }).join('');
    menu.innerHTML = `
      ${categoryButtons || `<button class="${historyMode === 'category:outputs' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('category:outputs')">输出文档<span>${(historyData?.filesFlat || []).length}</span></button>`}
      <button class="${historyMode === 'category:images' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('category:images')">图片</button>
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
    const viewTitles = { 'category:outputs': '输出文档', 'category:images': '图片', 'graph': '知识图谱' };
    const viewTitle = viewTitles[historyMode] || (currentCategory.label || currentCategory.folder || '输出文档');
    const viewHeader = '';
    if (!all.length) {
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
      // 输出文档视图 — 按当前真实文件夹动态生成子 tab
      const inboxCategory = categories.find(item => item.id === 'inbox') || { id: 'inbox', label: '临时收件箱', folder: '临时收件箱', files: all.filter(f => f.folder === '临时收件箱') };
      const allCount = all.length;
      const tabs = [
        `<button class="${historySubFilter === 'all' ? 'active' : ''}" onclick="HermesArtifact.setSubFilter('all')">全部 (${allCount})</button>`,
        ...documentCategories.map(item => `<button class="${historySubFilter === 'cat:' + item.id ? 'active' : ''}" onclick="HermesArtifact.setSubFilter('cat:${esc(String(item.id))}')">${esc(item.label || item.folder || '文档')} (${(item.files || []).length})</button>`),
        `<button class="${historySubFilter === 'inbox' ? 'active' : ''}" onclick="HermesArtifact.setSubFilter('inbox')">临时收件箱 (${(inboxCategory.files || []).length})</button>`,
        `<button class="doc-auto-classify-btn" onclick="HermesArtifact.autoClassify()">自动分类</button>`,
      ];
      const subTabs = `<div class="doc-sub-tabs">${tabs.join('')}</div>`;
      let files, title;
      if (historySubFilter === 'inbox') {
        files = inboxCategory.files || [];
        title = '临时收件箱';
      } else if (String(historySubFilter || '').startsWith('cat:')) {
        const subId = String(historySubFilter).slice(4);
        const hit = categories.find(item => item.id === subId);
        files = hit ? (hit.files || []) : [];
        title = hit ? (hit.label || hit.folder || '文档') : '文档';
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
      const images = (Array.isArray(data) ? data : (data.data || data.images || [])).filter(img => img.kind === 'output' && (img.url || img.filename));
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
      const imgUrl = img.url || ('/api/images/file/' + encodeURIComponent(img.filename));
      const prompt = esc(img.prompt || img.sourcePrompt || '无提示词');
      return `<div class="image-waterfall-card" onclick="HermesArtifact.openImageLightbox('${esc(imgUrl)}', '${prompt.replace(/'/g, "\\'")}')">
        <img src="${esc(imgUrl)}" alt="${prompt}" loading="lazy" />
        <div class="image-waterfall-prompt" title="${prompt}" onclick="event.stopPropagation();HermesArtifact.copyImagePrompt(this)">${prompt}</div>
      </div>`;
    }).join('');
    hist.innerHTML = headHtml + tabsHtml + '<div class="image-waterfall">' + cards + '</div>';
  }

  function openImageLightbox(url, prompt) {
    const lb = document.getElementById('imageLightbox');
    if (!lb) return;
    const img = lb.querySelector('.lightbox-img');
    const promptEl = lb.querySelector('.lightbox-prompt');
    if (img) { img.src = url; }
    if (promptEl) { promptEl.textContent = prompt || '无提示词'; promptEl.title = prompt || ''; }
    lb.classList.add('open');
  }

  function closeImageLightbox() {
    const lb = document.getElementById('imageLightbox');
    if (lb) lb.classList.remove('open');
  }

  function copyImagePrompt(el) {
    const text = el ? (el.textContent || el.title || '') : '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => showToast('提示词已复制')).catch(() => {});
  }

  function copyLightboxPrompt() {
    const promptEl = document.querySelector('#imageLightbox .lightbox-prompt');
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
              <h3>移动分类</h3>
              <p>根据当前知识库分类选择目标位置。</p>
            </div>
          </div>
          <div class="doc-move-file" title="${esc(file)}">当前：${esc(currentFolder || '未分类')}</div>
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
    closeImageLightbox,
    copyImagePrompt,
    copyLightboxPrompt,
    insertLocalEditPrompt,
    getLocalEditContext,
    clearLocalEditContext,
    applyLocalEditReplacement
  };

  global.HermesArtifact = API;
})(typeof window !== 'undefined' ? window : this);



