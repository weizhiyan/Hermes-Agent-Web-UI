/** Tiny localStorage wrapper. Reset old keys on first load. */
const PREFIX = 'hermes:';

try {
  ['hermes.settings', 'hermes.model', 'hermes.skills', 'hermes.chats'].forEach(k => {
    localStorage.removeItem(k);
  });
  if (!localStorage.getItem(PREFIX + 'apiBase')) {
    localStorage.setItem(PREFIX + 'apiBase', JSON.stringify(''));
  }
} catch {}

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
  remove(key) { localStorage.removeItem(PREFIX + key); },
};

function toast(msg, ms = 1600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}


/**
 * REST client. Uses relative path when served via bridge (HTTP),
 * falls back to stored apiBase for file:// protocol.
 */

function baseUrl() {
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return '';
  }
  return store.get('apiBase', 'http://127.0.0.1:8787');
}

async function request(path, opts = {}) {
  const url = (baseUrl() || '').replace(/\/$/, '') + path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    mode: 'cors',
  });
  const json = await res.json().catch(() => ({ code: -1, msg: '连接失败，请检查桥接服务' }));
  if (json.code !== 0) throw new Error(json.msg || 'request failed');
  return json.data;
}

const api = {
  health: () => request('/api/health'),

  listChats: () => request('/api/chats'),
  createChat: (title) => request('/api/chats', { method: 'POST', body: { title } }),
  getChat: (id) => request(`/api/chats/${id}`),
  deleteChat: (id) => request(`/api/chats/${id}`, { method: 'DELETE' }),
  renameChat: (id, title) => request(`/api/chats/${id}`, { method: 'PUT', body: { title } }),

  async sendMessage(id, content, onToken, signal) {
    const url = (baseUrl() || '').replace(/\/$/, '') + `/api/chats/${id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal, mode: 'cors',
    });
    if (!res.ok || !res.body) throw new Error('stream failed: ' + res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const event = /event: (\w+)/.exec(part)?.[1];
        const data = /data: (.*)/.exec(part)?.[1];
        if (event === 'token' && data) onToken(JSON.parse(data));
        if (event === 'error') throw new Error(JSON.parse(data).msg);
      }
    }
  },

  listSkills: () => request('/api/skills'),
  addSkill: (body) => request('/api/skills', { method: 'POST', body }),
  updateSkill: (id, body) => request(`/api/skills/${id}`, { method: 'PUT', body }),
  deleteSkill: (id) => request(`/api/skills/${id}`, { method: 'DELETE' }),

  getModels: () => request('/api/models'),
  saveModels: (body) => request('/api/models', { method: 'PUT', body }),

  getSettings: () => request('/api/settings'),
  saveSettings: (body) => request('/api/settings', { method: 'PUT', body }),
};


function initRouter(onChange) {
  const buttons = document.querySelectorAll('.rail-btn');
  const views = document.querySelectorAll('.view');
  const mobileButtons = document.querySelectorAll('.mobile-nav-btn');

  function go(name) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    mobileButtons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    views.forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
    onChange?.(name);
  }

  buttons.forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  mobileButtons.forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  go('chat');
  return { go };
}



const $ = id => document.getElementById(id);

async function initSettings() {
  const form = $('#settingsForm');
  if (!form) { await new Promise(r => setTimeout(r, 200)); }
  if (!$('#settingsForm')) { console.error('initSettings: DOM not ready'); return; }
  let s;
  try { s = await api.getSettings(); }
  catch { s = { theme: 'dark', lang: 'zh', stream: true, history: 20, systemPrompt: '' }; }

  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const apiBase = isHttp ? '' : store.get('apiBase', '');

  form.innerHTML = `
    <div class="form-section">连接</div>
    <div class="form-item"><label>桥接服务地址</label>
      <input class="input" id="s_api" value="${apiBase}" placeholder="http://127.0.0.1:8787">
    </div>
    <div class="form-item"><label>状态</label>
      <div style="display:flex;align-items:center;gap:8px;height:32px">
        <span id="connDotPage" class="dot off"></span>
        <span id="connStatus" style="font-size:13px;color:var(--text-2)">未检测</span>
        <button class="btn btn-ghost btn-sm" id="checkConnBtn">检测</button>
      </div>
    </div>

    <div class="form-section">外观</div>
    <div class="form-item"><label>主题</label>
      <select class="input" id="s_theme">
        <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色</option>
        <option value="light" ${s.theme === 'light' ? 'selected' : ''}>浅色</option>
      </select>
    </div>
    <div class="form-item"><label>语言</label>
      <select class="input" id="s_lang">
        <option value="zh" ${s.lang === 'zh' ? 'selected' : ''}>中文</option>
        <option value="en" ${s.lang === 'en' ? 'selected' : ''}>English</option>
      </select>
    </div>

    <div class="form-section">对话</div>
    <div class="form-item"><label>流式输出</label>
      <select class="input" id="s_stream">
        <option value="true" ${s.stream !== false ? 'selected' : ''}>开启</option>
        <option value="false" ${s.stream === false ? 'selected' : ''}>关闭</option>
      </select>
    </div>
    <div class="form-item"><label>历史保留条数</label>
      <input class="input" id="s_hist" type="number" value="${s.history || 20}">
    </div>

    <div class="form-section">系统提示词</div>
    <div class="form-item" style="grid-column:1/-1">
      <textarea class="input" id="s_sys" rows="4" style="height:auto;min-height:60px">${s.systemPrompt || ''}</textarea>
    </div>
  `;

  $('#s_theme').addEventListener('change', e => {
    document.body.dataset.theme = e.target.value;
  });

  $('#checkConnBtn').onclick = checkConnection;
  $('#saveSettingsBtn').onclick = async () => {
    const apiVal = $('#s_api').value.trim();
    store.set('apiBase', apiVal);
    document.body.dataset.theme = $('#s_theme').value;
    try {
      await api.saveSettings({
        theme: $('#s_theme').value, lang: $('#s_lang').value,
        stream: $('#s_stream').value === 'true', history: +$('#s_hist').value,
        systemPrompt: $('#s_sys').value,
      });
      toast('已保存');
      checkConnection();
    } catch (e) { toast(e.message); }
  };

  document.body.dataset.theme = s.theme;
  setTimeout(checkConnection, 500);
}

async function checkConnection() {
  const dot = $('#connDotPage') || $('#connDot');
  const status = $('#connStatus');
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const apiBase = isHttp ? '' : store.get('apiBase', 'http://127.0.0.1:8787');

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch((apiBase || '').replace(/\/$/, '') + '/api/health', { signal: ctrl.signal });
    if (r.ok) {
      dot.className = 'dot';
      status.textContent = '✅ 已连接';
      status.style.color = 'var(--success)';
      const mainDot = $('#connDot');
      if (mainDot) mainDot.className = 'dot';
    } else { throw 0; }
  } catch {
    dot.className = 'dot off';
    status.textContent = '❌ 未连接';
    status.style.color = 'var(--danger)';
    const mainDot = $('#connDot');
    if (mainDot) mainDot.className = 'dot off';
  }
}

async function updateConnDot() {
  const dot = $('#connDot');
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const apiBase = isHttp ? '' : store.get('apiBase', 'http://127.0.0.1:8787');
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch((apiBase || '').replace(/\/$/, '') + '/api/health', { signal: ctrl.signal });
    if (r.ok) { dot.className = 'dot'; return; }
    throw 0;
  } catch { dot.className = 'dot off'; }
}



let currentId = null;
let chats = [];
let sending = false;
let abortController = null;
let attachedFiles = [];
let chatKeyword = '';

const $list = () => $('chatList');
const $msgs = () => $('messages');
const $title = () => $('chatTitle');

function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      highlight: function (code, lang) {
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          try { return hljs.highlight(code, { language: lang }).value; } catch {}
        }
        if (typeof hljs !== 'undefined') {
          try { return hljs.highlightAuto(code).value; } catch {}
        }
        return escapeHtml(code);
      },
      breaks: true, gfm: true,
    });
    return marked.parse(text || '');
  }
  return escapeHtml(text || '').replace(/\n/g, '<br>');
}

function addCopyButtons(container) {
  container.querySelectorAll('pre code').forEach(block => {
    const pre = block.parentElement;
    if (pre.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.onclick = () => {
      navigator.clipboard.writeText(block.textContent).then(() => {
        btn.textContent = '已复制';
        setTimeout(() => { btn.textContent = '复制'; }, 1500);
      });
    };
    pre.appendChild(btn);
  });
}

// ── Commands ──────────────────────────────────────────────────────────────

const COMMANDS = [
  { key: '/new', desc: '新建对话' },
  { key: '/clear', desc: '清空当前对话' },
  { key: '/retry', desc: '重新生成上一条回复' },
  { key: '/undo', desc: '撤销上一条消息' },
  { key: '/model', desc: '切换模型' },
  { key: '/help', desc: '显示帮助' },
  { key: '/export', desc: '导出对话' },
  { key: '/compress', desc: '压缩上下文' },
];

function initCommands() {
  const menu = $('cmdMenu');
  menu.innerHTML = COMMANDS.map(c =>
    `<button class="dropdown-item" data-cmd="${c.key}">
      <span style="font-family:var(--mono);color:var(--brand);font-weight:600;min-width:50px">${c.key}</span>
      <span style="color:var(--text-2);font-size:12.5px">${c.desc}</span>
    </button>`
  ).join('');

  $('cmdBtn').onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  };
  document.addEventListener('click', () => menu.classList.remove('open'));

  menu.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.onclick = () => {
      menu.classList.remove('open');
      handleCommand(btn.dataset.cmd);
    };
  });
}

function handleCommand(cmd) {
  switch (cmd) {
    case '/new': newChat(); break;
    case '/clear': clearChat(); break;
    case '/retry': retryLast(); break;
    case '/undo': undoLast(); break;
    case '/model': $('modelSwitchBtn')?.click(); break;
    case '/help': showCmdModal(); break;
    case '/export': exportCurrentChat(); break;
    case '/compress': toast('上下文压缩已请求'); break;
  }
}

function showCmdModal() {
  const modal = $('cmdModal');
  const list = $('cmdList');
  list.innerHTML = COMMANDS.map(c =>
    `<div class="cmd-item" data-cmd="${c.key}">
      <span class="cmd-key">${c.key}</span>
      <span class="cmd-desc">${c.desc}</span>
    </div>`
  ).join('');
  list.querySelectorAll('.cmd-item').forEach(el => {
    el.onclick = () => { modal.classList.remove('open'); handleCommand(el.dataset.cmd); };
  });
  modal.classList.add('open');
}

// ── Skills toggle ─────────────────────────────────────────────────────────

async function initSkillToggle() {
  const menu = $('skillToggleMenu');
  const btn = $('skillToggleBtn');

  btn.onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    renderSkillToggle();
  };
  document.addEventListener('click', () => menu.classList.remove('open'));
}

async function renderSkillToggle() {
  const menu = $('skillToggleMenu');
  let skills;
  try { skills = await api.listSkills(); } catch { skills = []; }
  menu.innerHTML = skills.filter(s => s.on).length
    ? skills.map(s => `
      <div class="dropdown-item" style="gap:8px">
        <span>${s.icon || '✨'}</span>
        <span style="flex:1">${escapeHtml(s.name)}</span>
        <div class="switch ${s.on ? 'on' : ''}" data-skill-id="${s.id}"></div>
      </div>
    `).join('')
    : '<div class="dropdown-item" style="color:var(--text-3);font-size:12px">暂无启用技能</div>';

  menu.querySelectorAll('.switch').forEach(sw => {
    sw.onclick = async (e) => {
      e.stopPropagation();
      const id = sw.dataset.skillId;
      const skill = skills.find(s => s.id === id);
      if (!skill) return;
      skill.on = !skill.on;
      sw.classList.toggle('on', skill.on);
      try { await api.updateSkill(id, { on: skill.on }); } catch {}
    };
  });
}

// ── Init ──────────────────────────────────────────────────────────────────

async function initChat() {
  const maxRetry = 20;
  let retry = 0;
  while (!$('newChatBtn') && retry < maxRetry) {
    await new Promise(r => setTimeout(r, 100));
    retry++;
  }
  if (!$('newChatBtn')) { console.error('initChat: DOM not ready'); return; }
  // Ensure $ helper works
  if (typeof $ !== 'function') window.$ = id => document.getElementById(id);

  $('newChatBtn').onclick = newChat;
  $('sendBtn').onclick = send;
  $('stopBtn').onclick = stopGeneration;
  $('toggleSourceBtn').onclick = toggleSourcePanel;
  $('closeRpanel').onclick = () => document.body.classList.remove('rpanel-open');
  $('input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $('input').addEventListener('input', () => {
    $('input').style.height = 'auto';
    $('input').style.height = Math.min($('input').scrollHeight, 160) + 'px';
  });

  // Detect / commands in input
  $('input').addEventListener('input', e => {
    const val = e.target.value;
    if (val === '/') {
      $('cmdBtn').click();
    }
  });

  // File upload
  $('uploadFileBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      if (f.size > 512 * 1024) { toast(`${f.name} 超过 512KB`); continue; }
      attachedFiles.push({ name: f.name, content: await f.text() });
    }
    renderAttachments();
    e.target.value = '';
  };

  // Export (optional, may not exist in DOM)
  const exportMenu = $('exportMenu');
  const exportBtn = $('exportBtn');
  if (exportBtn && exportMenu) {
    exportBtn.onclick = (e) => { e.stopPropagation(); exportMenu.classList.toggle('open'); };
    document.addEventListener('click', () => exportMenu.classList.remove('open'));
    exportMenu.querySelectorAll('[data-fmt]').forEach(item => {
      item.onclick = () => { exportMenu.classList.remove('open'); exportChat(item.dataset.fmt); };
    });
  }

  // Model switch
  $('modelSwitchBtn').onclick = async (e) => {
    e.stopPropagation();
    await refreshModelSwitch();
    $('modelSwitchMenu').classList.toggle('open');
  };
  document.addEventListener('click', () => $('modelSwitchMenu').classList.remove('open'));

  // Chat search
  $('chatSearch').addEventListener('input', e => {
    chatKeyword = e.target.value.toLowerCase();
    renderList();
  });

  // Commands
  initCommands();
  initSkillToggle();

  // Modal close buttons
  $('closeCmdModal').onclick = () => $('cmdModal').classList.remove('open');
  $('cmdModal').addEventListener('click', e => {
    if (e.target.id === 'cmdModal') $('cmdModal').classList.remove('open');
  });

  // Ctrl+N new chat
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); newChat(); }
  });

  await refreshList();
  if (chats[0]) await openChat(chats[0].id);
  else await newChat();
}

// ── Source panel ──────────────────────────────────────────────────────────

function toggleSourcePanel() {
  const isOpen = document.body.classList.contains('rpanel-open');
  if (isOpen) {
    document.body.classList.remove('rpanel-open');
  } else {
    document.body.classList.add('rpanel-open');
    $('rpanelTitle').textContent = 'Markdown 源码';
  }
}

// ── Chat CRUD ─────────────────────────────────────────────────────────────

function updateSendUI() {
  $('sendBtn').style.display = sending ? 'none' : '';
  $('stopBtn').style.display = sending ? '' : 'none';
}

async function refreshModelSwitch() {
  try {
    const cfg = await api.getModels();
    const current = cfg.current || 'deepseek';
    $('modelSwitchBtn').textContent = `${current} ▾`;
    const menu = $('modelSwitchMenu');
    const providers = ['anthropic', 'openai', 'deepseek', 'local'];
    const items = [];
    providers.forEach(p => {
      if (!cfg[p]) return;
      const model = cfg[p].model || p;
      const label = p === 'local' ? `🖥️ ${model} (本地)` : `☁️ ${model} (${p})`;
      items.push({ key: model, label, active: current === model });
    });
    if (cfg.wind) {
      const model = cfg.wind.model || 'wind';
      items.push({ key: model, label: `☁️ ${model} (wind)`, active: current === model });
    }
    menu.innerHTML = items.map(it =>
      `<button class="dropdown-item${it.active ? ' active' : ''}" data-model="${escapeHtml(it.key)}">${escapeHtml(it.label)}</button>`
    ).join('');
    menu.querySelectorAll('[data-model]').forEach(btn => {
      btn.onclick = async () => {
        menu.classList.remove('open');
        try {
          await api.saveModels({ current: btn.dataset.model });
          $('modelSwitchBtn').textContent = `${btn.dataset.model} ▾`;
          toast(`切换到 ${btn.dataset.model}`);
        } catch (e) { toast(e.message); }
      };
    });
  } catch {}
}

function stopGeneration() {
  if (abortController) { abortController.abort(); abortController = null; }
}

async function refreshList() {
  try { chats = await api.listChats(); } catch { chats = []; }
  renderList();
  $('historyCount').textContent = chats.length;
}

function renderList() {
  const filtered = chatKeyword
    ? chats.filter(c => (c.title || '').toLowerCase().includes(chatKeyword) || (c.preview || '').toLowerCase().includes(chatKeyword))
    : chats;
  $list().innerHTML = filtered.map(c => `
    <div class="chat-item ${c.id === currentId ? 'active' : ''}" data-id="${c.id}">
      <div class="chat-item-main" data-id="${c.id}">
        <div class="t">${escapeHtml(c.title || '未命名')}</div>
        <div class="m">${escapeHtml(c.preview || '')}</div>
      </div>
      <div class="chat-item-actions">
        <button class="item-action rename-btn" data-id="${c.id}" title="重命名">✏️</button>
        <button class="item-action delete-btn" data-id="${c.id}" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');
  $list().querySelectorAll('.chat-item-main').forEach(el => el.onclick = () => openChat(el.dataset.id));
  $list().querySelectorAll('.rename-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const newName = prompt('重命名：', chats.find(c => c.id === id)?.title || '');
      if (newName?.trim()) {
        try { await api.renameChat(id, newName.trim()); await refreshList(); if (id === currentId) $title().textContent = newName.trim(); }
        catch (e) { toast(e.message); }
      }
    };
  });
  $list().querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('确认删除？')) return;
      try {
        await api.deleteChat(btn.dataset.id);
        if (btn.dataset.id === currentId) {
          await refreshList();
          chats[0] ? await openChat(chats[0].id) : await newChat();
        } else { await refreshList(); }
      } catch (e) { toast(e.message); }
    };
  });
}

async function openChat(id) {
  currentId = id;
  renderList();
  try {
    const chat = await api.getChat(id);
    $title().textContent = chat.title || '新建对话';
    renderMessages(chat.messages);
  } catch (e) { toast(e.message); }
}

async function newChat() {
  try {
    const chat = await api.createChat('新建对话');
    await refreshList();
    await openChat(chat.id);
  } catch { toast('后端未连接'); }
}

function clearChat() {
  if (!currentId) return;
  $msgs().innerHTML = '';
}

async function retryLast() {
  if (!currentId || sending) return;
  try {
    const chat = await api.getChat(currentId);
    const msgs = chat.messages;
    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
    if (lastUser) await streamReply(lastUser.content);
  } catch {}
}

async function undoLast() {
  if (!currentId || sending) return;
  try {
    const chat = await api.getChat(currentId);
    if (chat.messages.length >= 2) {
      chat.messages.splice(-2);
      await api.renameChat(currentId, chat.title); // trigger save
      renderMessages(chat.messages);
    }
  } catch {}
}

// ── Export ─────────────────────────────────────────────────────────────────

async function exportChat(fmt) {
  if (!currentId) return toast('没有选中的对话');
  try {
    const chat = await api.getChat(currentId);
    let content, filename, mime;
    if (fmt === 'json') {
      content = JSON.stringify(chat, null, 2);
      filename = `${chat.title || 'chat'}.json`;
      mime = 'application/json';
    } else {
      const lines = [`# ${chat.title || '对话记录'}\n`];
      (chat.messages || []).forEach(m => {
        const who = m.role === 'user' ? '用户' : 'Hermes';
        lines.push(`## ${who} (${m.ts ? new Date(m.ts).toLocaleString('zh-CN') : ''})\n\n${m.content}\n`);
      });
      content = lines.join('\n');
      filename = `${chat.title || 'chat'}.md`;
      mime = 'text/markdown';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast('已导出');
  } catch (e) { toast(e.message); }
}

async function exportCurrentChat() {
  await exportChat('md');
}

// ── Messages ──────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function renderMessages(msgs) {
  $msgs().innerHTML = (msgs || []).length
    ? (msgs || []).map((m, i) => buildMsgHtml(m, i)).join('')
    : `<div class="msg asst" style="max-width:90%;align-self:center;text-align:center;opacity:.6">
        <div class="bubble" style="background:transparent;border:none;font-size:13px">
          Hermes Agent — 智能 AI 助手<br>
          <span style="color:var(--text-3);font-size:12px">发送消息开始对话</span>
        </div>
      </div>`;
  addCopyButtons($msgs());
  bindMsgActions();
  $msgs().scrollTop = $msgs().scrollHeight;
}

function buildMsgHtml(m, idx) {
  const isUser = m.role === 'user';
  return `
    <div class="msg ${isUser ? 'user' : 'asst'}" data-idx="${idx}" data-role="${m.role}">
      <div class="bubble">${isUser ? escapeHtml(m.content) : renderMarkdown(m.content)}</div>
      <div class="msg-footer">
        <span class="meta">${formatTime(m.ts)}</span>
        <div class="msg-actions">
          <button class="msg-action copy-msg-btn" title="复制">📋</button>
          ${!isUser ? '<button class="msg-action regen-btn" title="重新生成">🔄</button>' : ''}
        </div>
      </div>
    </div>`;
}

function bindMsgActions() {
  $msgs().querySelectorAll('.copy-msg-btn').forEach(btn => {
    btn.onclick = () => {
      const bubble = btn.closest('.msg').querySelector('.bubble');
      navigator.clipboard.writeText(bubble.textContent).then(() => toast('已复制'));
    };
  });
  $msgs().querySelectorAll('.regen-btn').forEach(btn => {
    btn.onclick = async () => {
      if (sending) return;
      const idx = +btn.closest('.msg').dataset.idx;
      await regenerateFrom(idx);
    };
  });
}

async function regenerateFrom(asstIdx) {
  if (!currentId || sending) return;
  try {
    const chat = await api.getChat(currentId);
    const msgs = chat.messages;
    if (asstIdx >= msgs.length || msgs[asstIdx].role !== 'assistant') return;
    const prevUserIdx = asstIdx - 1;
    if (prevUserIdx < 0 || msgs[prevUserIdx].role !== 'user') return;
    const userContent = msgs[prevUserIdx].content;
    msgs.splice(asstIdx, 1);
    renderMessages(msgs);
    await streamReply(userContent);
  } catch (e) { toast(e.message); }
}

// ── Send ──────────────────────────────────────────────────────────────────

async function send() {
  const input = $('input');
  if (!input) { toast('输入框未加载'); return; }
  const content = input.value.trim();
  if ((!content && !attachedFiles.length) || !currentId || sending) return;

  // If no current chat, create one
  if (!currentId) {
    try {
      const chat = await api.createChat('新建对话');
      currentId = chat.id;
      await refreshList();
    } catch (e) { toast('无法创建对话: ' + e.message); return; }
  }

  let fullContent = content;
  if (attachedFiles.length) {
    const fileParts = attachedFiles.map(f =>
      `---\n📎 文件: ${f.name}\n\`\`\`\n${f.content}\n\`\`\`\n---`
    ).join('\n\n');
    fullContent = content ? content + '\n\n' + fileParts : fileParts;
    attachedFiles = [];
    renderAttachments();
  }

  input.value = '';
  input.style.height = 'auto';
  renderAttachments();

  appendMsg('user', fullContent);
  await streamReply(fullContent);
}

async function streamReply(userContent) {
  sending = true;
  updateSendUI();

  const asstEl = appendMsg('asst', '');
  const bubble = asstEl.querySelector('.bubble');
  bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

  abortController = new AbortController();

  try {
    let full = '';
    await api.sendMessage(currentId, userContent, tok => {
      if (abortController?.signal?.aborted) return;
      full += tok;
      bubble.innerHTML = renderMarkdown(full);
      addCopyButtons(bubble);
      $msgs().scrollTop = $msgs().scrollHeight;
      const rpanelBody = $('rpanelBody');
      if (rpanelBody) rpanelBody.textContent = full;
    }, abortController.signal);
    const meta = asstEl.querySelector('.meta');
    if (meta) meta.textContent = formatTime(Date.now());
    refreshList();
  } catch (e) {
    if (e.name === 'AbortError') {
      if (!bubble.textContent || bubble.textContent.includes('typing-dots')) {
        bubble.innerHTML = '<span class="muted">[已停止]</span>';
      }
    } else {
      bubble.innerHTML = `<span class="error-text">[错误] ${escapeHtml(e.message)}</span>`;
    }
  } finally {
    sending = false;
    abortController = null;
    updateSendUI();
  }
}

function appendMsg(role, content) {
  const div = document.createElement('div');
  const isUser = role === 'user';
  div.className = 'msg ' + (isUser ? 'user' : 'asst');
  div.dataset.role = role;
  div.innerHTML = `
    <div class="bubble">${isUser ? escapeHtml(content) : renderMarkdown(content)}</div>
    <div class="msg-footer">
      <span class="meta">${formatTime(Date.now())}</span>
      <div class="msg-actions">
        <button class="msg-action copy-msg-btn">📋</button>
        ${!isUser ? '<button class="msg-action regen-btn">🔄</button>' : ''}
      </div>
    </div>`;
  if (!isUser && content) addCopyButtons(div);
  const copyBtn = div.querySelector('.copy-msg-btn');
  if (copyBtn) copyBtn.onclick = () => navigator.clipboard.writeText(div.querySelector('.bubble').textContent).then(() => toast('已复制'));
  const regenBtn = div.querySelector('.regen-btn');
  if (regenBtn) regenBtn.onclick = async () => { if (sending) return; const idx = Array.from($msgs().querySelectorAll('.msg')).indexOf(div); await regenerateFrom(idx); };
  $msgs().appendChild(div);
  $msgs().scrollTop = $msgs().scrollHeight;
  return div;
}

function renderAttachments() {
  const container = $('attachments');
  if (!attachedFiles.length) { container.innerHTML = ''; return; }
  container.innerHTML = attachedFiles.map((f, i) => `
    <div class="attachment-chip">
      <span>📎 ${escapeHtml(f.name)}</span>
      <button class="remove-attachment" data-idx="${i}">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('.remove-attachment').forEach(btn => {
    btn.onclick = () => { attachedFiles.splice(+btn.dataset.idx, 1); renderAttachments(); };
  });
}




let skills = [];
let keyword = '';
let currentTab = 'builtin';
let selectedSkillId = null;
let editingId = null;

async function initSkills() {
  if (!$('skillSearch')) { await new Promise(r => setTimeout(r, 200)); }
  if (!$('skillSearch')) { console.error('initSkills: DOM not ready'); return; }
  $('skillSearch').addEventListener('input', e => {
    keyword = e.target.value.toLowerCase();
    render();
  });
  $('addSkillBtn').onclick = () => openModal(null);
  $('closeSkillModal').onclick = closeModal;
  $('cancelSkillModal').onclick = closeModal;
  $('saveSkillModal').onclick = saveSkill;
  $('skillModal').addEventListener('click', e => {
    if (e.target.id === 'skillModal') closeModal();
  });
  $('closeRpanel').onclick = () => {
    document.body.classList.remove('rpanel-open');
  };

  document.querySelectorAll('#skillTabs .tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#skillTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      render();
    };
  });

  await load();
}

async function load() {
  try { skills = await api.listSkills(); } catch { skills = []; }
  render();
}

function getFilteredSkills() {
  let filtered = skills;
  if (currentTab === 'builtin') {
    filtered = skills.filter(s =>
      !s.tags?.includes('自定义') && !s.tags?.includes('custom') &&
      !s.tags?.includes('用户') && !s.tags?.includes('user')
    );
  } else if (currentTab === 'custom') {
    filtered = skills.filter(s => s.tags?.includes('自定义') || s.tags?.includes('custom'));
  } else {
    filtered = skills.filter(s => s.tags?.includes('用户') || s.tags?.includes('user'));
  }
  if (keyword) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(keyword) || s.desc.toLowerCase().includes(keyword)
    );
  }
  return filtered;
}

function render() {
  const grid = $('skillGrid');
  const filtered = getFilteredSkills();

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3);font-size:13px">
      暂无技能${keyword ? '，试试其他关键词' : ''}
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="skill-card ${selectedSkillId === s.id ? 'active' : ''}" data-id="${s.id}">
      <div class="ico">${s.icon || '✨'}</div>
      <div class="skill-card-body">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(s.desc || '')}</p>
        <div>${(s.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
      <div class="skill-card-actions">
        <div class="switch ${s.on ? 'on' : ''}" data-id="${s.id}"></div>
        <button class="item-action edit-skill-btn" data-id="${s.id}" title="编辑">✏️</button>
        <button class="item-action delete-skill-btn" data-id="${s.id}" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.switch').forEach(sw => {
    sw.onclick = async () => {
      const s = skills.find(x => x.id === sw.dataset.id);
      if (!s) return;
      s.on = !s.on;
      sw.classList.toggle('on', s.on);
      try { await api.updateSkill(s.id, { on: s.on }); } catch {}
      if (selectedSkillId === s.id) showSkillDetail(s);
    };
  });

  grid.querySelectorAll('.skill-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.switch') || e.target.closest('.edit-skill-btn') || e.target.closest('.delete-skill-btn')) return;
      const skill = skills.find(s => s.id === card.dataset.id);
      if (skill) {
        selectedSkillId = skill.id;
        render();
        showSkillDetail(skill);
      }
    };
  });

  grid.querySelectorAll('.edit-skill-btn').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); openModal(btn.dataset.id); };
  });
  grid.querySelectorAll('.delete-skill-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('确认删除此技能？')) return;
      try {
        await api.deleteSkill(btn.dataset.id);
        if (selectedSkillId === btn.dataset.id) {
          selectedSkillId = null;
          document.body.classList.remove('rpanel-open');
        }
        await load();
        toast('已删除');
      } catch (e) { toast(e.message); }
    };
  });
}

function showSkillDetail(skill) {
  const panel = $('rpanel');
  const title = $('rpanelTitle');
  const body = $('rpanelBody');

  title.textContent = '技能详情';
  const source = skill.tags?.includes('内置') || skill.tags?.includes('builtin') ? '内置' :
                 skill.tags?.includes('用户') || skill.tags?.includes('user') ? '用户制作' : '我添加的';
  const filePath = skill.file || skill.path || '';

  body.innerHTML = `
    <div class="skill-detail">
      <div class="skill-detail-header">
        <div class="skill-detail-icon">${skill.icon || '✨'}</div>
        <div>
          <div class="skill-detail-name">${escapeHtml(skill.name)}</div>
          <div style="font-size:12px;color:var(--text-3)">${escapeHtml(skill.desc || '')}</div>
        </div>
        <span class="skill-detail-source">${source}</span>
      </div>
      ${filePath ? `
      <div class="skill-detail-field">
        <label>文件路径</label>
        <div class="value mono">${escapeHtml(filePath)}</div>
      </div>` : ''}
      <div class="skill-detail-field">
        <label>标签</label>
        <div class="value">${(skill.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</div>
      </div>
      ${skill.prompt ? `
      <div class="skill-detail-field">
        <label>提示词</label>
        <div class="value" style="max-height:300px">${escapeHtml(skill.prompt)}</div>
      </div>` : ''}
      <div class="skill-detail-field">
        <label>状态</label>
        <div class="value">
          <span style="color:${skill.on ? 'var(--success)' : 'var(--text-3)'}">
            ${skill.on ? '● 已启用' : '○ 未启用'}
          </span>
        </div>
      </div>
    </div>
  `;

  document.body.classList.add('rpanel-open');
}

function openModal(id) {
  editingId = id;
  $('skillModalTitle').textContent = id ? '编辑技能' : '新增技能';
  if (id) {
    const s = skills.find(x => x.id === id);
    if (!s) return;
    $('skillIcon').value = s.icon || '';
    $('skillName').value = s.name || '';
    $('skillDesc').value = s.desc || '';
    $('skillTags').value = (s.tags || []).join(', ');
    $('skillPrompt').value = s.prompt || '';
  } else {
    $('skillIcon').value = '✨';
    $('skillName').value = '';
    $('skillDesc').value = '';
    $('skillTags').value = '';
    $('skillPrompt').value = '';
  }
  $('skillModal').classList.add('open');
}

function closeModal() {
  $('skillModal').classList.remove('open');
  editingId = null;
}

async function saveSkill() {
  const icon = $('skillIcon').value.trim() || '✨';
  const name = $('skillName').value.trim();
  const desc = $('skillDesc').value.trim();
  const tagsStr = $('skillTags').value.trim();
  const prompt = $('skillPrompt').value.trim();
  if (!name) { toast('请输入名称'); return; }
  const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : ['自定义'];
  try {
    if (editingId) {
      await api.updateSkill(editingId, { icon, name, desc, tags, prompt });
      toast('已更新');
    } else {
      await api.addSkill({ icon, name, desc, tags, prompt, on: false });
      toast('已添加');
    }
    closeModal();
    await load();
  } catch (e) { toast(e.message); }
}




async function initModels() {
  if (!$('#modelsForm')) { await new Promise(r => setTimeout(r, 200)); }
  if (!$('#modelsForm')) { console.error('initModels: DOM not ready'); return; }
  const form = $('#modelsForm');
  let cfg, settings;
  try { cfg = await api.getModels(); } catch { cfg = { params: {}, current: '' }; }
  try { settings = await api.getSettings(); } catch { settings = { hermesModel: '', autoRoute: true, fastModel: 'deepseek', codeModel: 'wind' }; }

  form.innerHTML = `
    <div class="form-section">智能模型路由</div>
    <div class="form-item" style="grid-column:1/-1">
      <p class="form-hint">日常对话走快速模型，检测到代码/UI 任务自动切换到强大模型。</p>
    </div>
    <div class="form-item"><label>自动路由</label>
      <select class="input" id="m_autoRoute">
        <option value="true" ${settings.autoRoute !== false ? 'selected' : ''}>开启（自动选择模型）</option>
        <option value="false" ${settings.autoRoute === false ? 'selected' : ''}>关闭（手动选择）</option>
      </select>
    </div>
    <div class="form-item"><label>日常模型</label>
      <select class="input" id="m_fastModel">
        <option value="deepseek" ${(settings.fastModel || 'deepseek') === 'deepseek' ? 'selected' : ''}>DeepSeek (快速)</option>
        <option value="wind" ${settings.fastModel === 'wind' ? 'selected' : ''}>Wind Claude (强大)</option>
      </select>
    </div>
    <div class="form-item"><label>代码/UI 模型</label>
      <select class="input" id="m_codeModel">
        <option value="wind" ${(settings.codeModel || 'wind') === 'wind' ? 'selected' : ''}>Wind Claude (默认)</option>
        <option value="deepseek" ${settings.codeModel === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
      </select>
    </div>

    <div class="form-section">模型 API 配置</div>
    <div class="form-item"><label>DeepSeek 模型名</label>
      <input class="input" id="m_ds_model" value="${(cfg.deepseek && cfg.deepseek.model) || ''}" placeholder="deepseek-chat"></div>
    <div class="form-item"><label>DeepSeek Base URL</label>
      <input class="input" id="m_ds_base" value="${(cfg.deepseek && cfg.deepseek.base) || ''}"></div>
    <div class="form-item"><label>DeepSeek Key</label>
      <input class="input" id="m_ds_key" type="password" value="${(cfg.deepseek && cfg.deepseek.key) || ''}"></div>
    <div class="form-item"><label>Wind Claude 模型名</label>
      <input class="input" id="m_wind_model" value="${(cfg.wind && cfg.wind.model) || ''}" placeholder="[wind]claude-opus-4-7-max"></div>
    <div class="form-item"><label>Wind Claude Base URL</label>
      <input class="input" id="m_wind_base" value="${(cfg.wind && cfg.wind.base) || ''}"></div>
    <div class="form-item"><label>Wind Claude Key</label>
      <input class="input" id="m_wind_key" type="password" value="${(cfg.wind && cfg.wind.key) || ''}"></div>

    <div class="form-section">采样参数</div>
    <div class="form-item"><label>Temperature</label>
      <input class="input" id="m_temp" type="number" step="0.1" value="${(cfg.params && cfg.params.temperature) ?? 0.7}"></div>
    <div class="form-item"><label>Max Tokens</label>
      <input class="input" id="m_max" type="number" value="${(cfg.params && cfg.params.maxTokens) ?? 4096}"></div>
    <div class="form-item"><label>Top P</label>
      <input class="input" id="m_top" type="number" step="0.05" value="${(cfg.params && cfg.params.topP) ?? 1}"></div>
  `;

  $('#saveModelsBtn').onclick = async () => {
    try {
      await api.saveSettings({
        autoRoute: $('#m_autoRoute').value === 'true',
        fastModel: $('#m_fastModel').value,
        codeModel: $('#m_codeModel').value,
      });
      await api.saveModels({
        deepseek: { base: $('#m_ds_base').value, key: $('#m_ds_key').value, model: $('#m_ds_model').value },
        wind: { base: $('#m_wind_base').value, key: $('#m_wind_key').value, model: $('#m_wind_model').value },
        params: { temperature: +$('#m_temp').value, maxTokens: +$('#m_max').value, topP: +$('#m_top').value },
      });
      toast('已保存');
    } catch (e) { toast(e.message); }
  };
}



const loaded = new Set();

async function ensureView(name) {
  if (loaded.has(name)) return;
  loaded.add(name);
  try {
    if (name === 'chat') await initChat();
    else if (name === 'tools') await initSkills();
    else if (name === 'models') await initModels();
    else if (name === 'settings') await initSettings();
  } catch (e) {
    console.warn('init ' + name + ' failed:', e);
  }
}

(async function bootstrap() {
  try {
    await initSettings();
  } catch (e) {
    console.warn('settings init failed, continuing:', e);
  }
  initRouter(ensureView);
  try {
    await ensureView('chat');
  } catch (e) {
    console.warn('chat init failed:', e);
  }
  try { updateConnDot(); } catch {}
  setInterval(() => { try { updateConnDot(); } catch {} }, 15_000);

  const collapseBtn = document.getElementById('collapseBtn');
  if (collapseBtn) {
    collapseBtn.onclick = () => {
      document.body.classList.toggle('sidebar-hidden');
      const bar = document.getElementById('historyBar');
      if (bar) bar.style.display = document.body.classList.contains('sidebar-hidden') ? 'flex' : 'none';
    };
  }

  const historyBar = document.getElementById('historyBar');
  if (historyBar) {
    historyBar.onclick = () => {
      document.body.classList.remove('sidebar-hidden');
      historyBar.style.display = 'none';
    };
  }
})();
