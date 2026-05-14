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
    return str.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '');
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
    s.replace(/<think>([\s\S]*?)<\/redacted_thinking>/gi, (_, inner) => {
      think += inner;
      return '';
    });
    let noClosedThink = s.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '');
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

  function renderToolbarIcon(kind) {
    if (kind === 'chat') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>';
    }
    if (kind === 'split') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg>';
    }
    if (kind === 'preview') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10"/><path d="M7 12h7"/><path d="M7 16h8"/></svg>';
    }
    if (kind === 'copy') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M5 15V7a2 2 0 012-2h8"/></svg>';
    }
    if (kind === 'download') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/></svg>';
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
    return 'http://127.0.0.1:8787';
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
      const nextLabel = isOpen ? '收起右侧预览' : '打开右侧预览';
      toggleButton.classList.toggle('is-open', isOpen);
      toggleButton.setAttribute('title', nextLabel);
      toggleButton.setAttribute('aria-label', nextLabel);
    }
    if (layout === 'CHAT_ONLY') {
      shell.classList.remove('open', 'full');
      shell.classList.remove('artifact-focused');
      main.style.flex = '1 1 auto';
      main.style.width = '';
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
    main.style.flex = `0 0 ${splitPct}%`;
    main.style.width = `${splitPct}%`;
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
  }

  function renderMarkdownDebounced(md, el) {
    if (!el) return;
    if (_mdTimer) clearTimeout(_mdTimer);
    _mdTimer = setTimeout(() => {
      _mdTimer = null;
      try {
        if (global.marked && typeof global.marked.parse === 'function') {
          el.innerHTML = global.marked.parse(md || '', { breaks: true });
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
    renderPreview(type, language, content, el);
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
        src.textContent = body || '';
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
      prev.innerHTML = `<div class="memory-empty" style="min-height:300px">
        <h3>${esc(title || '暂无可预览文件')}</h3>
        <p>${esc(message || '当前没有检测到可预览的输出文件。你可以在“历史文件”里打开本地 Markdown。')}</p>
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
    <div class="artifact-toolbar-label">
      <span>Markdown 预览</span>
    </div>
    <div class="artifact-toolbar-actions">
      <button type="button" class="artifact-icon-btn" id="artifactCopyBtn" title="复制" onclick="HermesArtifact.copyContent()">${renderToolbarIcon('copy')}</button>
      <button type="button" class="artifact-icon-btn" title="下载" onclick="HermesArtifact.download()">${renderToolbarIcon('download')}</button>
      <button type="button" class="artifact-icon-btn" title="关闭面板" onclick="HermesArtifact.setLayout('chat')">${renderToolbarIcon('close')}</button>
    </div>
  </div>
  <div class="artifact-titlebar">
    <span class="artifact-file-icon">${renderToolbarIcon('doc')}</span>
    <span class="artifact-title-text" id="artifactTitleText">Artifact</span>
    <span class="artifact-type-badge" id="artifactTypeBadge">—</span>
    <span class="artifact-version-wrap">
      <button type="button" class="artifact-icon-btn sm" id="artifactVerPrev" onclick="HermesArtifact.bumpVersion(-1)">⟨</button>
      <span id="artifactVersionText" class="artifact-version-text"></span>
      <button type="button" class="artifact-icon-btn sm" id="artifactVerNext" onclick="HermesArtifact.bumpVersion(1)">⟩</button>
    </span>
  </div>
  <div class="artifact-tabs">
    <button type="button" class="artifact-tab active" data-tab="preview" onclick="HermesArtifact.setTab('preview')">预览</button>
    <button type="button" class="artifact-tab" data-tab="source" onclick="HermesArtifact.setTab('source')">源码</button>
    <button type="button" class="artifact-tab" data-tab="history" style="margin-left:auto" onclick="HermesArtifact.showHistory()">历史文件</button>
  </div>
  <div class="artifact-body">
    <div id="artifactGenerating" class="artifact-generating" style="display:none"><span class="dot-pulse"></span> 生成中…</div>
    <div id="artifactPreview" class="artifact-preview"></div>
    <pre id="artifactSource" class="artifact-source" style="display:none"></pre>
    <div id="artifactHistory" class="artifact-history" style="display:none"></div>
  </div>
  <button type="button" class="artifact-edge-resizer" aria-label="调整预览宽度" title="拖拽调整预览宽度"></button>
</div>`;
  }

  function initWorkbench() {
    loadSplit();
    ensureShellMarkup();
    bindResize();
    applyLayout();
    syncToolbarActive();
    if (global.mermaid && typeof global.mermaid.initialize === 'function') {
      try {
        global.mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark' });
      } catch (_) {}
    }
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
    document.querySelectorAll('.artifact-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
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
        src.textContent = body;
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
    const date = f.mtime ? new Date(f.mtime).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
    const safePath = encodeURIComponent(f.path || '');
    const safeName = encodeURIComponent(name || title);
    return `
      <div class="history-card">
        <div class="history-card-kicker">
          <span>${esc(f.mdType || f.type || f.folder || 'Markdown')}</span>
          <span>${esc(fmtBytes(f.size))}</span>
        </div>
        <button type="button" class="history-card-title" onclick="HermesArtifact.previewHistoryFile('${safePath}', '${safeName}')">${esc(title)}</button>
        <div class="history-card-summary">${esc(summary)}</div>
        <div class="history-card-meta">
          <span>${esc(date)}${f.folder ? ' · ' + esc(f.folder) : ''}</span>
        </div>
        <div class="history-card-actions">
          <button class="history-card-btn primary" onclick="HermesArtifact.previewHistoryFile('${safePath}', '${safeName}')">预览</button>
          <button class="history-card-btn secondary" onclick="HermesArtifact.openFileLocation('${safePath}')">打开文件</button>
        </div>
      </div>`;
  }

  function renderHistoryList() {
    const hist = $('#artifactHistory');
    if (!hist || !historyData) return;
    if (historyPreview) {
      hist.innerHTML = `
        <div class="artifact-history-preview-head">
          <button class="history-back-btn" onclick="HermesArtifact.backToHistoryList()">← 返回</button>
          <div>
            <div class="artifact-history-preview-title">${esc(historyPreview.title || 'Markdown 预览')}</div>
            <div class="artifact-history-preview-path">${esc(historyPreview.path || '')}</div>
          </div>
          <button class="history-card-btn secondary" onclick="HermesArtifact.openFileLocation('${encodeURIComponent(historyPreview.path || '')}')">打开文件</button>
        </div>
        <div class="artifact-history-preview markdown-body artifact-preview" id="artifactHistoryPreview"></div>`;
      flushPreviewNow('markdown', '', historyPreview.content || '', $('#artifactHistoryPreview'));
      return;
    }
    const all = historyData.filesFlat || [];
    const types = historyData.types || [];
    const folders = historyData.folders || [];
    const tags = historyData.tags || [];
    const groupList = historyMode === 'folder' ? folders : historyMode === 'tag' ? tags : types;
    const root = historyData.root || '';
    const tabs = `<div class="artifact-history-tabs">
      <button class="${historyMode === 'all' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('all')">全部</button>
      <button class="${historyMode === 'type' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('type')">按类型</button>
      <button class="${historyMode === 'folder' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('folder')">按文件夹</button>
      <button class="${historyMode === 'tag' ? 'active' : ''}" onclick="HermesArtifact.setHistoryMode('tag')">按标签</button>
    </div>`;
    if (!all.length) {
      hist.innerHTML = tabs + `<div class="history-empty-docs">
        <h3>暂无本地 MD 输出文件</h3>
        <p>这里读取的是 Agent 输出文章/报告等 Markdown 的独立文件夹，不是聊天历史记录。</p>
        <code>${esc(root)}</code>
      </div>`;
      return;
    }
    const intro = `<div class="artifact-history-root">MD 输出库：<code>${esc(root)}</code></div>`;
    if (historyMode !== 'all') {
      hist.innerHTML = tabs + intro + (groupList.length ? groupList.map(group => `
        <div class="history-month-group">
          <div class="history-month-title">${esc(group.name || group.type || group.folder || group.tag || '其他')} (${group.files.length})</div>
          <div class="history-cards">${(group.files || []).map(renderHistoryCard).join('')}</div>
        </div>`).join('') : '<div style="text-align:center;padding:28px;color:var(--c-ink-muted)">当前分类暂无文件</div>');
      return;
    }
    hist.innerHTML = tabs + intro + `<div class="history-month-group">
      <div class="history-month-title">全部 · 按时间 (${all.length})</div>
      <div class="history-cards">${all.map(renderHistoryCard).join('')}</div>
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
        hist.innerHTML = '<div style="text-align:center;padding:20px;color:var(--c-ink-muted)">暂无历史文件</div>';
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
        const historyVisible = currentTab === 'history' && $('#artifactHistory') && $('#artifactHistory').style.display !== 'none';
        if (historyVisible) {
          historyPreview = { title: name, path, content: data.data.content };
          renderHistoryList();
          currentTitle = name;
          window.__hermesLastArtifactBody = data.data.content;
          const titleEl = $('#artifactTitleText');
          const typeEl = $('#artifactTypeBadge');
          const verEl = $('#artifactVersionText');
          if (titleEl) titleEl.textContent = name;
          if (typeEl) typeEl.textContent = 'Markdown';
          if (verEl) verEl.textContent = '本地文件';
        } else {
          openRef(name);
        }
      }
    } catch (e) {
      openEmpty('无法读取文件', e && e.message ? e.message : '读取本地 Markdown 失败。');
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
    setTab('history');
  }

  function getCurrentBody() {
    const list = getVersionList(currentTitle);
    if (list.length && viewVersionIndex >= 0) return list[viewVersionIndex].content;
    const src = $('#artifactSource');
    return src ? src.textContent : '';
  }

  function copyContent() {
    const list = getVersionList(currentTitle);
    let text = '';
    if (currentTab === 'source' || document.getElementById('artifactSource')?.style.display !== 'none') {
      text = document.getElementById('artifactSource')?.textContent || '';
    } else {
      text = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex].content : window.__hermesLastArtifactBody || '';
    }
    navigator.clipboard.writeText(text).then(() => {
      const b = $('#artifactCopyBtn');
      if (b) {
        const o = b.innerHTML;
        b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => { b.innerHTML = o; }, 1600);
      }
    }).catch(() => {});
  }

  function download() {
    const list = getVersionList(currentTitle);
    const body = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex].content : window.__hermesLastArtifactBody || '';
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
    const body = list.length && viewVersionIndex >= 0 ? list[viewVersionIndex].content : window.__hermesLastArtifactBody || '';
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
    download,
    openNewWindow,
    recordCompletedArtifacts,
    getVersionList,
    typeLabel,
    showHistory,
    openHistoryFile,
    previewHistoryFile,
    openFileLocation,
    backToHistoryList,
    setHistoryMode
  };

  global.HermesArtifact = API;
})(typeof window !== 'undefined' ? window : this);
