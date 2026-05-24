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
  let _dragMode = 'split';
  let currentTitle = '';
  let currentTab = 'preview';
  let viewVersionIndex = -1;
  let historyMode = 'all';
  let historyData = null;
  let historyPreview = null;
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
    const list = getVersionList(currentTitle);
    const row = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex] : null;
    const typ = row ? row.type : 'markdown';
    const lang = row ? row.language : '';
    const body = getSourceText();
    const prev = $('#artifactPreview');
    if (currentTab === 'source') {
      syncSourceEditor(body);
    }
    if (prev) flushPreviewNow(typ, lang, body, prev);
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
          <h3>文档库</h3>
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
      <p>${esc(message || '生成 Markdown 后点击“保存到库”，或让 Hermes Agent 按文档规范输出。')}</p>
    </div>`;
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

  function syncToolbarActive() {
    document.querySelectorAll('.artifact-layout-btn').forEach((b) => {
      const m = b.dataset.layout;
      const active =
        (m === 'CHAT_ONLY' && layout === 'CHAT_ONLY') ||
        (m === 'SPLIT_VIEW' && layout === 'SPLIT_VIEW') ||
        (m === 'PREVIEW_ONLY' && layout === 'PREVIEW_ONLY');
      b.classList.toggle('active', active);
    });
    document.querySelectorAll('.artifact-view-toggle').forEach((wrap) => {
      wrap.dataset.active = currentTab === 'source' ? 'source' : 'preview';
    });
    document.querySelectorAll('.artifact-view-btn').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === currentTab);
    });
  }

  function renderMarkdownDebounced(md, el) {
    if (!el) return;
    const scrollHost = el.parentElement;
    const prevScrollTop = scrollHost ? scrollHost.scrollTop : null;
    if (_mdTimer) clearTimeout(_mdTimer);
    _mdTimer = setTimeout(() => {
      _mdTimer = null;
      try {
        if (global.marked && typeof global.marked.parse === 'function') {
          el.innerHTML = global.marked.parse(stripLooseMarkdownMeta(md || ''), { breaks: true });
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
  }

  function updateCurrentArtifactBody(content) {
    const text = content || '';
    window.__hermesLastArtifactBody = text;
    const row = getCurrentVersionRow();
    if (row) row.content = text;
    const prev = $('#artifactPreview');
    if (prev && currentTab === 'source') {
      const meta = row || { type: 'markdown', language: '' };
      flushPreviewNow(meta.type || 'markdown', meta.language || '', text, prev);
    }
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
      if (typeEl) typeEl.textContent = '—';
      if (verEl) verEl.textContent = '';
      if (gen) gen.style.display = 'none';
      return;
    }
    const title = cur.attrs.title || '未命名';
    currentTitle = title;
    const typ = (cur.attrs.type || 'markdown').toLowerCase();
    const lang = cur.attrs.language || '';
    if (titleEl) titleEl.textContent = title;
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
    loadSplit();
    applyLayout();
    syncToolbarActive();
    if (list.length && viewVersionIndex >= 0) {
      const row = list[viewVersionIndex];
      window.__hermesLastArtifactBody = row.content;
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
    const src = $('#artifactSource');
    if (titleEl) titleEl.textContent = title || '暂无可预览文件';
    if (typeEl) typeEl.textContent = '空状态';
    if (verEl) verEl.textContent = '';
    if (gen) gen.style.display = 'none';
    if (src) src.style.display = 'none';
    if (prev) {
      prev.style.display = 'block';
      prev.innerHTML = `<div class="artifact-empty-state">
        <div class="artifact-empty-icon">MD</div>
        <h3>${esc(title || '暂无可预览文件')}</h3>
        <p>${esc(message || '当前没有检测到可预览的输出文档。你可以在“文档库”里打开本地 Markdown。')}</p>
      </div>`;
    }
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
      <div class="artifact-view-toggle" role="tablist" aria-label="文档视图切换" data-active="preview">
        <button type="button" class="artifact-view-btn active artifact-tooltip" data-tab="preview" data-tip="预览" onclick="HermesArtifact.setTab('preview')" aria-label="预览">${renderToolbarIcon('eye')}</button>
        <button type="button" class="artifact-view-btn artifact-tooltip" data-tab="source" data-tip="代码" onclick="HermesArtifact.setTab('source')" aria-label="代码">${renderToolbarIcon('code')}</button>
      </div>
      <span class="artifact-toolbar-title" id="artifactTitleText">Artifact</span>
    </div>
    <div class="artifact-toolbar-actions">
      <div class="artifact-export-wrap" id="artifactExportWrap">
        <button type="button" class="artifact-copy-main artifact-tooltip" id="artifactCopyBtn" data-tip="复制到剪贴板" aria-label="复制到剪贴板" onclick="HermesArtifact.copyContent()">${renderToolbarIcon('copy')}<span>复制</span></button>
        <button type="button" class="artifact-icon-btn artifact-copy-caret artifact-tooltip" data-tip="更多导出选项" aria-label="更多导出选项" onclick="HermesArtifact.toggleExportMenu(event)">${renderToolbarIcon('chevron-down')}</button>
        <div class="artifact-export-menu" id="artifactExportMenu">
          <button type="button" onclick="HermesArtifact.download();HermesArtifact.hideExportMenu()">下载 Markdown 文件</button>
          <button type="button" onclick="HermesArtifact.saveToLibrary();HermesArtifact.hideExportMenu()">保存到本地文档库</button>
        </div>
      </div>
      <button type="button" class="artifact-library-btn artifact-tooltip" data-tip="打开知识库" aria-label="打开知识库" onclick="HermesArtifact.showHistory()">${renderToolbarIcon('library')}<span>知识库</span></button>
      <button type="button" class="artifact-icon-btn artifact-refresh-btn artifact-tooltip" id="artifactRefreshBtn" data-tip="刷新" aria-label="刷新" onclick="HermesArtifact.refreshCurrentView()">${renderToolbarIcon('refresh')}</button>
      <button type="button" class="artifact-icon-btn artifact-tooltip" data-tip="关闭面板" aria-label="关闭面板" onclick="HermesArtifact.setLayout('chat')">${renderToolbarIcon('close')}</button>
    </div>
  </div>
  <div class="artifact-body">
    <div id="artifactGenerating" class="artifact-generating" style="display:none"><span class="dot-pulse"></span> 生成中…</div>
    <div id="artifactPreview" class="artifact-preview"></div>
    <textarea id="artifactSource" class="artifact-source artifact-source-editor" style="display:none" spellcheck="false"></textarea>
    <div id="artifactHistory" class="artifact-history" style="display:none"></div>
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
    }
    bindResize();
    bindToolbarMenus();
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
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideExportMenu();
        const menu = $('#artifactHistoryMoreMenu');
        if (menu) menu.classList.remove('open');
        document.querySelectorAll('.history-card-menu.open').forEach(item => item.classList.remove('open'));
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
      if (hist) {
        hist.style.display = 'block';
        loadHistory();
      }
      return;
    }
    if (hist) hist.style.display = 'none';
    const list = getVersionList(currentTitle);
    const body =
      list.length && viewVersionIndex >= 0
        ? list[viewVersionIndex].content
        : window.__hermesLastArtifactBody || '';
    const typ =
      list.length && viewVersionIndex >= 0 ? list[viewVersionIndex].type : 'markdown';
    const lang =
      list.length && viewVersionIndex >= 0 ? list[viewVersionIndex].language : '';
    if (tab === 'source') {
      if (prev) prev.style.display = 'none';
      if (src) {
        syncSourceEditor(body);
        src.style.display = 'block';
      }
    } else {
      if (src) src.style.display = 'none';
      if (prev) {
        prev.style.display = 'block';
        flushPreviewNow(typ, lang, body, prev);
      }
    }
  }

  function renderHistoryCard(f) {
    const name = f.file || f.name || '';
    const title = f.title || name.replace(/\.md$/, '');
    const summary = f.summary || f.preview || '暂无内容概括';
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
                ${tags.map(tag => `<span class="history-card-tag">${esc(tag)}</span>`).join('')}
              </span>
              <span class="history-card-size">${esc(fmtBytes(f.size))}</span>
            </div>
          </div>
        </button>
      </div>`;
  }
  function renderHistoryList() {
    const hist = $('#artifactHistory');
    if (!hist || !historyData) return;
    if (historyPreview) {
      hist.innerHTML = `
        <div class="artifact-history-preview-head">
          <button class="history-back-btn" onclick="HermesArtifact.backToHistoryList()" aria-label="返回文档库">←</button>
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
      return;
    }
    const all = historyData.filesFlat || [];
    const folders = (historyData.folders || []).filter(group => (group.files || []).length > 0);
    const tags = historyData.tags || [];
    const folderTabs = folders.map(group => {
      const name = group.name || group.folder || '其他';
      const mode = 'folder:' + name;
      return `<button class="${historyMode === mode ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('folder:${encodeURIComponent(name)}')" aria-pressed="${historyMode === mode ? 'true' : 'false'}">${esc(name)}<span class="history-tab-count">${(group.files || []).length}</span></button>`;
    }).join('');
    const tabs = `<div class="artifact-history-tabs doc-library-tabs">
      <button class="${historyMode === 'all' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('all')" aria-pressed="${historyMode === 'all' ? 'true' : 'false'}">全部<span class="history-tab-count">${(all).length}</span></button>
      ${folderTabs}
      <button class="${historyMode === 'tag' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('tag')" aria-pressed="${historyMode === 'tag' ? 'true' : 'false'}">标签<span class="history-tab-count">${tags.length}</span></button>
    </div>`;
    const libraryHead = renderDocLibraryHeader(all, folders, tags);
    if (!all.length) {
      hist.innerHTML = libraryHead + tabs + renderDocListEmpty();
      return;
    }
    if (historyMode === 'tag') {
      hist.innerHTML = libraryHead + tabs + (tags.length ? tags.map(group => {
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
    if (String(historyMode || '').startsWith('folder:')) {
      const selectedFolder = decodeURIComponent(String(historyMode).slice(7));
      const group = folders.find(item => (item.name || item.folder) === selectedFolder);
      const files = (group ? (group.files || []) : []);
      hist.innerHTML = libraryHead + tabs + `<div class="history-month-group">
        <div class="history-month-title">${esc(selectedFolder)} (${files.length})</div>
        <div class="history-cards">${files.length ? files.map(renderHistoryCard).join('') : renderDocListEmpty('这个文件夹还没有文档。')}</div>
      </div>`;
      return;
    }
    const files = (all);
    hist.innerHTML = libraryHead + tabs + `<div class="history-month-group">
      <div class="history-month-title">全部 · 按时间 (${files.length})</div>
      <div class="history-cards">${files.length ? files.map(renderHistoryCard).join('') : renderDocListEmpty('暂无文档')}</div>
    </div>`;
  }
  function setHistoryMode(mode) {
    historyMode = mode;
    historyPreview = null;
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
      hist.innerHTML = '<div style="text-align:center;padding:20px;color:var(--c-error)">加载失败</div>';
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
        window.__hermesLastArtifactBody = data.data.content;
        historyPreview = null;
        setTab('preview');
        openRef(name);
      }
    } catch (e) {
      openEmpty('无法读取文件', e && e.message ? e.message : '读取本地 Markdown 失败。');
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
    const message = '确定删除这个 Markdown 文档吗？\n\n' + file + '\n\n删除后会从本地文档库移除。';
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
    const message = '确定删除这个 Markdown 文档吗？\n\n' + file + '\n\n删除后会从本地文档库移除。';
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
  }

  function showHistory() {
    historyPreview = null;
    layout = layout === 'CHAT_ONLY' ? 'SPLIT_VIEW' : layout;
    applyLayout();
    setTab('history');
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
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error(data && data.msg ? data.msg : '保存失败');
      historyData = null;
      if (global.toast) global.toast('已自动保存到文档库：' + data.data.folder, 'success');
      if (btn) btn.textContent = '已自动保存';
      setTimeout(() => {
        const current = $('#artifactSaveBtn');
        if (current && current.textContent === '已自动保存') current.textContent = old || '保存到库';
      }, 2200);
    } catch (e) {
      autoSavedKeys.delete(doc.key);
      if (global.toast) global.toast('自动保存失败，可手动保存', 'warning');
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.textContent === '自动保存中…') btn.textContent = old || '保存到库';
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
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error(data && data.msg ? data.msg : '保存失败');
      historyData = null;
      if (global.toast) global.toast('已保存到文档库：' + data.data.folder, 'success');
      const verEl = $('#artifactVersionText');
      if (verEl) verEl.textContent = '已保存';
      if (currentTab === 'history') loadHistory();
    } catch (e) {
      if (global.toast) global.toast(e && e.message ? e.message : '保存失败', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || '保存到库';
      }
    }
  }

  function download() {
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
    openHistoryFile,
    previewHistoryFile,
    toggleHistoryMore,
    toggleHistoryCardMenu,
    renameHistoryFile,
    deleteHistoryFile,
    hideHistoryMore,
    openHistoryPreviewFile,
    confirmDeleteHistoryFile,
    openFileLocation,
    backToHistoryList,
    setHistoryMode
  };

  global.HermesArtifact = API;
})(typeof window !== 'undefined' ? window : this);










