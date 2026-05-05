import { api } from './api.js';
import { escapeHtml, toast } from './store.js';

let currentId = null;
let chats = [];
let sending = false;
let abortController = null;
let attachedFiles = [];
let chatKeyword = '';

const $ = id => document.getElementById(id);
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

export async function initChat() {
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

  initWelcomeHints();
  initScrollBottomBtn();
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

  // Export
  const exportMenu = $('exportMenu');
  $('exportBtn').onclick = (e) => { e.stopPropagation(); exportMenu.classList.toggle('open'); };
  document.addEventListener('click', () => exportMenu.classList.remove('open'));
  exportMenu.querySelectorAll('[data-fmt]').forEach(item => {
    item.onclick = () => { exportMenu.classList.remove('open'); exportChat(item.dataset.fmt); };
  });

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
  const panel = $('rpanel');
  const isVisible = panel.classList.contains('visible');
  if (isVisible) {
    panel.classList.remove('visible');
  } else {
    panel.classList.add('visible');
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
    const settings = await api.getSettings();
    const label = settings.hermesModel || 'deepseek';
    $('modelSwitchBtn').textContent = `${label} ▾`;
    const menu = $('modelSwitchMenu');
    const models = ['deepseek', 'wind', 'anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash'];
    menu.innerHTML = models.map(m =>
      `<button class="dropdown-item${settings.hermesModel === m ? ' active' : ''}" data-model="${m}">
        <span style="font-family:var(--mono);font-size:12px">${m}</span>
        ${settings.hermesModel === m ? '<span style="margin-left:auto;color:var(--brand)">✓</span>' : ''}
      </button>`
    ).join('');
    menu.querySelectorAll('[data-model]').forEach(btn => {
      btn.onclick = async () => {
        menu.classList.remove('open');
        const model = btn.dataset.model;
        try {
          await api.saveSettings({ hermesModel: model });
          $('modelSwitchBtn').textContent = `${model} ▾`;
          toast(`切换到 ${model}`);
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
  const welcome = document.getElementById('welcomeScreen');
  if ((msgs || []).length > 0 && welcome) welcome.remove();
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

function initWelcomeHints() {
  const hints = document.querySelectorAll('.welcome-hint');
  hints.forEach(btn => {
    btn.onclick = () => {
      const prompt = btn.dataset.prompt;
      if (prompt && $('input')) {
        $('input').value = prompt;
        $('input').focus();
        send();
      }
    };
  });
}

function initScrollBottomBtn() {
  const container = $msgs();
  if (!container) return;
  const btn = document.createElement('button');
  btn.className = 'scroll-bottom-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><polyline points="6 9 12 15 18 9"/></svg>';
  btn.title = '滚动到底部';
  btn.onclick = () => { container.scrollTop = container.scrollHeight; btn.classList.remove('visible'); };
  container.parentElement.style.position = 'relative';
  container.parentElement.appendChild(btn);

  container.addEventListener('scroll', () => {
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    btn.classList.toggle('visible', !nearBottom);
  });
}
