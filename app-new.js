const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const LS={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))}
};
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const SVG={
  chat:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  history:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  group:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  search:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  jobs:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  skills:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  memory:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  models:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  usage:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  channels:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  settings:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  profiles:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  gateways:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  logs:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  files:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  terminal:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  send:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  chevronDown:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
  moon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
  sun:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  folder:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  file:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  upload:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  panelExpand:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M13 9l4 3-4 3"/></svg>',
  brain:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a5 5 0 015 5c0 .91-.244 1.765-.67 2.5H12V2z"/><path d="M12 2a5 5 0 00-5 5c0 .91.244 1.765.67 2.5H12V2z"/><path d="M7.5 9.5A5.5 5.5 0 005 14.5C5 17.538 7.462 20 10.5 20c.91 0 1.765-.244 2.5-.67V9.5H7.5z"/><path d="M16.5 9.5A5.5 5.5 0 0119 14.5c0 3.038-2.462 5.5-5.5 5.5-.91 0-1.765-.244-2.5-.67V9.5h4.5z"/><path d="M12 9.5v10"/></svg>',
  attach:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
};

// API base — resolved at call time (uses state.settings.api when set)
function apiBase() {
  try {
    if (typeof state !== 'undefined' && state.settings && state.settings.api) {
      const a = String(state.settings.api).trim().replace(/\/$/, '');
      if (a) return a;
    }
  } catch (_) {}
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') return '';
  return 'http://127.0.0.1:8787';
}

async function apiGet(path) {
  try {
    const r = await fetch(apiBase() + path, { headers: { 'Accept': 'application/json' } });
    const j = await r.json();
    return j.code === 0 ? j.data : null;
  } catch { return null; }
}
async function apiPost(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    return j.code === 0 ? j.data : null;
  } catch { return null; }
}
async function apiPut(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    return j.code === 0 ? j.data : null;
  } catch { return null; }
}
async function apiDel(path) {
  try {
    const r = await fetch(apiBase() + path, { method: 'DELETE' });
    const j = await r.json();
    return j.code === 0;
  } catch { return false; }
}

// Real-time SSE stream for sending messages
async function apiStream(path, body, callbacks) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok || !r.body) { callbacks.onError?.('Connection failed'); return; }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        if (!part.trim()) continue;
        const evt = /^event:\s*(\S+)/m.exec(part);
        const dat = /^data:\s*(.+)/m.exec(part);
        if (!evt || !dat) continue;
        let data;
        try { data = JSON.parse(dat[1]); } catch { continue; }
        switch (evt[1]) {
          case 'token': callbacks.onToken?.(data.text); break;
          case 'reasoning': callbacks.onReasoning?.(data.text); break;
          case 'tool': callbacks.onTool?.(data); break;
          case 'tool_complete': callbacks.onToolComplete?.(data); break;
          case 'title': callbacks.onTitle?.(data); break;
          case 'done': callbacks.onDone?.(data); break;
          case 'error': callbacks.onError?.(data.msg); break;
        }
      }
    }
  } catch (e) {
    callbacks.onError?.(e.message);
  }
}

const state={
  theme: LS.get('hermes.theme','dark'),
  page: 'chat',
  chatMode: 'single',
  sidebarCollapsed: false,
  _loading: true,
  model: LS.get('hermes.model',{provider:'deepseek',model:'deepseek-v4-flash',base:'https://api.deepseek.com',key:'',temperature:0.7,topP:1,maxTokens:4096}),
  settings: LS.get('hermes.settings',{lang:'zh',stream:true,history:20,systemPrompt:'',api:''}),
  skills: [],
  skillFilter: {source:null,search:'',category:null},
  selectedSkill: null,
  chats: [],
  currentChat: null,
  connected: false,
  chatFullData: {},  // id -> full chat data from backend
  memories: LS.get('hermes.memories',{core:'',context:'',episodes:[]}),
  selectedChannel: null,
  activeProfile: 'default',
  gateways: LS.get('hermes.gateways',[]),
  groupChat: LS.get('hermes.groupChat',{
    userName:'',userDesc:'',connected:false,activeRoom:null,rooms:[],
    messages:{},agents:{},members:{},typing:{},contextStatus:{},
  }),
};

const NAV=[
  {id:'chat',label:'对话',icon:'chat'},
  {id:'groupChat',label:'群聊',icon:'group'},
  {id:'brain',label:'小脑瓜',icon:'brain'},
  {id:'settingsPage',label:'设置',icon:'settings'},
];

function save(){
  LS.set('hermes.theme',state.theme);
  LS.set('hermes.model',state.model);
  LS.set('hermes.settings',state.settings);
  LS.set('hermes.memories',state.memories);
  LS.set('hermes.gateways',state.gateways);
  LS.set('hermes.groupChat',state.groupChat);
}

function navigate(page){
  state.page=page;
  renderSidebar();
  renderPage();
  toggleMobileSidebar(false);
}

function toggleTheme(){
  state.theme=state.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=state.theme;
  const icon=$('#themeIcon');
  if(icon) icon.innerHTML=state.theme==='dark'?SVG.moon:SVG.sun;
  const hljsTheme = document.getElementById('hljsTheme');
  if(hljsTheme) hljsTheme.href = state.theme === 'dark' ? 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css' : 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css';
  save();
}

function toggleMobileSidebar(open){
  const sb=$('#sidebar');
  const bd=$('#mobileBackdrop');
  if(!sb||!bd) return;
  if(open){sb.classList.add('mobile-open');bd.classList.add('show')}
  else{sb.classList.remove('mobile-open');bd.classList.remove('show')}
}

function renderSidebar(){
  const nav=$('#sidebarNav');
  if(!nav) return;
  const activePage = state.page === 'brain' || ['skills','channels','memory','jobs','profiles'].includes(state.page) ? 'brain'
    : state.page === 'settingsPage' || ['settings','models','logs','files','gateways','usage'].includes(state.page) ? 'settingsPage'
    : state.page === 'groupChat' ? 'groupChat'
    : 'chat';
  nav.innerHTML=NAV.map(it=>`
    <button class="nav-item${activePage===it.id?' active':''}" onclick="navigate('${it.id}')" data-nav-label="${it.label}" onmouseenter="showNavTooltip(this)" onmouseleave="hideNavTooltip()">
      ${SVG[it.icon]}
    </button>
  `).join('');
  const dot=$('#statusDot');
  if(dot){
    const online = state.connected !== false;
    dot.className='conn-dot '+(online?'online':'offline');
  }
}

function showNavTooltip(el){
  const tip=document.getElementById('globalNavTooltip');
  if(!tip||!el) return;
  tip.textContent=el.dataset.navLabel||'';
  const rect=el.getBoundingClientRect();
  tip.style.left=(rect.right+10)+'px';
  tip.style.top=(rect.top+rect.height/2)+'px';
  tip.style.transform='translateY(-50%)';
  tip.classList.add('show');
}

function hideNavTooltip(){
  const tip=document.getElementById('globalNavTooltip');
  if(tip) tip.classList.remove('show');
}

function renderPage(){
  const main=$('#mainContent');
  if(!main) return;
  if(state.page==='brain'){
    main.innerHTML=renderBrainPage();
  } else if(state.page==='settingsPage'){
    main.innerHTML=renderSettingsPage();
  } else if(state.page==='groupChat'){
    main.innerHTML=renderGroupChat();
  } else {
    main.innerHTML=renderChat();
  }
  afterRender();
}

function afterRender(){
  if(state.page==='chat') initChat();
  if(state.page==='terminal') initTerminal();
  if(AgentAsk.isOpen()) AgentAsk._render();

  enhanceMessageMarkdown(document.getElementById('mainContent'));

  if(state.page==='chat' && typeof HermesArtifact !== 'undefined') {
    requestAnimationFrame(() => {
      try {
        HermesArtifact.initWorkbench();
        HermesArtifact.hydrateMessages((currentChat()?.messages)||[]);
      } catch (_) {}
    });
  }
}

function renderChat(){
  const c=currentChat();
  const msgs=c?c.messages:[];
  const models=['claude-opus-4-7','gpt-4o','gemini-2.5-pro','deepseek-r1','llama-4-maverick'];
  return `
    <div class="chat-panel">
      <div class="session-sidebar" id="sessionSidebar">
        <div class="session-sidebar-header">
          <button class="new-chat-btn" onclick="newChat()">${SVG.plus} 新建会话</button>
          <div style="position:relative">
            <button class="history-btn" onclick="openHistoryPopup()" title="历史记录">${SVG.history}</button>
          </div>
        </div>
        <div class="session-items" id="sessionItems">
          ${renderSessionList()}
        </div>
      </div>
      <div class="chat-workbench hermes-workbench" id="chatWorkbench" data-layout="CHAT_ONLY">
      <div class="chat-main chat-main-pane" id="chatMainPane">
        <div class="chat-header">
          <div class="chat-header-left">
            <button class="btn-icon" onclick="document.getElementById('sessionSidebar').classList.toggle('collapsed')" title="切换会话列表">${SVG.sidebar}</button>
            <span class="chat-header-title">${c?esc(c.title):'新建对话'}</span>
            <span class="source-badge">${esc(c._model || state.model.model)}</span>
          </div>
          <div class="header-actions">
            <button class="btn-icon header-toggle-panel-btn" onclick="openLatestPreviewPanel()" title="展开/收起右侧预览">
              ${SVG.panelExpand} <span class="toggle-text">展开</span>
            </button>
          </div>
        </div>
        <div class="messages-area" id="messagesArea">
          ${msgs.length===0?`
            <div class="empty-state" style="padding-top:120px">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <span>开始一段新对话</span>
            </div>
          `:msgs.map(m=>renderMsg(m)).join('')}
        </div>
        <div class="chat-input-area" id="chatInputArea">
          <div id="agentPanelSlot"></div>
          <div class="chat-input-box" style="position:relative">
            <textarea id="chatInput" rows="1" placeholder="输入消息…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}" oninput="autoResizeInput(this)"></textarea>
            <div class="chat-input-toolbar">
              <div class="chat-input-left">
                <button class="input-action-btn" onclick="document.getElementById('fileInput').click()" title="上传文件">${SVG.attach}</button>
                <button class="input-action-btn" onclick="toggleSkillPopup()" title="技能" id="skillPopupBtn">${SVG.skills}</button>
              </div>
              <div class="chat-input-right">
                <button class="input-action-btn" onclick="toggleModelPopup()" title="选择模型" id="modelPopupBtn" style="font-size:11px;font-family:var(--font-mono);width:auto;padding:0 8px">${esc(state.model.model)}</button>
                <button class="send-btn" id="sendBtn" onclick="sendMessage()">${SVG.send}</button>
              </div>
            </div>
            <div class="skill-popup" id="skillPopup" style="display:none">
              <div class="skill-popup-header"><h4>选择技能</h4><button class="history-popup-close" onclick="toggleSkillPopup()">${SVG.x}</button></div>
              <div class="skill-popup-body" id="skillPopupBody"></div>
            </div>
            <div class="model-popup" id="modelPopup" style="display:none">
              <div class="model-popup-header">选择模型</div>
              <div class="model-popup-body" id="modelPopupBody"></div>
            </div>
          </div>
          <input type="file" id="fileInput" style="display:none" onchange="handleFileUpload(this)">
        </div>
      </div>
      <div class="artifact-resizer" id="artifactResizer" role="separator" aria-orientation="vertical"></div>
      <aside class="artifact-shell" id="artifactShell" aria-label="Artifact"></aside>
      </div>
    </div>`;
}

let brainTab = 'skills';
let settingsTab = 'settings';

function renderBrainPage(){
  const tabs=[
    {id:'skills',label:'技能中心',icon:'skills'},
    {id:'channels',label:'频道',icon:'channels'},
    {id:'memory',label:'记忆存储',icon:'memory'},
    {id:'jobs',label:'任务管理',icon:'jobs'},
    {id:'profiles',label:'角色配置',icon:'profiles'},
  ];
  const active=brainTab;
  const renderers={skills:renderSkills,channels:renderChannels,memory:renderMemory,jobs:renderJobs,profiles:renderProfiles};
  return `
    <div style="display:flex;flex-direction:column;height:100%">
      <div class="tabs" style="padding:0 24px">
        ${tabs.map(t=>`<div class="tab${active===t.id?' active':''}" onclick="brainTab='${t.id}';document.getElementById('mainContent').innerHTML=renderBrainPage();afterRender()">${SVG[t.icon]} ${t.label}</div>`).join('')}
      </div>
      <div style="flex:1;overflow-y:auto">
        ${(renderers[active]||renderSkills)()}
      </div>
    </div>`;
}

function renderSettingsPage(){
  const tabs=[
    {id:'settings',label:'设置',icon:'settings'},
    {id:'models',label:'模型配置',icon:'models'},
    {id:'logs',label:'日志',icon:'logs'},
    {id:'files',label:'文件',icon:'files'},
    {id:'gateways',label:'网关',icon:'gateways'},
    {id:'usage',label:'用量统计',icon:'usage'},
  ];
  const active=settingsTab;
  const renderers={settings:renderSettings,models:renderModels,logs:renderLogs,files:renderFiles,gateways:renderGateways,usage:renderUsage};
  return `
    <div style="display:flex;flex-direction:column;height:100%">
      <div class="tabs" style="padding:0 24px">
        ${tabs.map(t=>`<div class="tab${active===t.id?' active':''}" onclick="settingsTab='${t.id}';document.getElementById('mainContent').innerHTML=renderSettingsPage();afterRender()">${SVG[t.icon]} ${t.label}</div>`).join('')}
      </div>
      <div style="flex:1;overflow-y:auto">
        ${(renderers[active]||renderSettings)()}
      </div>
    </div>`;
}

function handleFileUpload(input){
  if(input.files&&input.files[0]){
    const file=input.files[0];
    const c=currentChat();
    if(c){
      c.messages.push({role:'user',content:`[文件] ${file.name} (${(file.size/1024).toFixed(1)}KB)`,ts:Date.now()});
      renderPage();
    }
    input.value='';
  }
}

function toggleSkillPopup(){
  const popup=$('#skillPopup');
  if(!popup) return;
  const isVisible=popup.style.display!=='none';
  closeAllInputPopups();
  if(!isVisible){
    const body=$('#skillPopupBody');
    if(body){
      const localSkills=(state.skills||[]).filter(s=>s.source==='local');
      const otherSkills=(state.skills||[]).filter(s=>s.source!=='local');
      const all=[...localSkills,...otherSkills];
      if(all.length===0){
        body.innerHTML='<div class="empty-state" style="padding:20px 0"><span>暂无技能</span></div>';
      } else {
        body.innerHTML=all.map(s=>`<div class="skill-popup-item" onclick="insertSkill('${esc(s.name||s.title||'')}')">
          <div class="skill-popup-item-title">${esc(s.name||s.title||'未命名')}</div>
          <div class="skill-popup-item-desc">${esc(s.description||s.desc||'暂无描述')}</div>
          <div class="skill-popup-item-tags">${(s.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div>
        </div>`).join('');
      }
    }
    popup.style.display='flex';
    setTimeout(()=>document.addEventListener('click',closePopupsOnOutsideClick,{once:true}),10);
  }
}

function toggleModelPopup(){
  const popup=$('#modelPopup');
  if(!popup) return;
  const isVisible=popup.style.display!=='none';
  closeAllInputPopups();
  if(!isVisible){
    const body=$('#modelPopupBody');
    if(body){
      const models=['claude-opus-4-7','gpt-4o','gemini-2.5-pro','deepseek-r1','llama-4-maverick','deepseek-v4-flash'];
      body.innerHTML=models.map(m=>`<div class="model-popup-item${state.model.model===m?' active':''}" onclick="selectModel('${m}')">${m}</div>`).join('');
    }
    popup.style.display='flex';
    setTimeout(()=>document.addEventListener('click',closePopupsOnOutsideClick,{once:true}),10);
  }
}

function closePopupsOnOutsideClick(e){
  const sp=$('#skillPopup');
  const mp=$('#modelPopup');
  const skillBtn=$('#skillPopupBtn');
  const modelBtn=$('#modelPopupBtn');
  if(sp && sp.style.display!=='none' && !sp.contains(e.target) && !skillBtn?.contains(e.target)){
    sp.style.display='none';
  }
  if(mp && mp.style.display!=='none' && !mp.contains(e.target) && !modelBtn?.contains(e.target)){
    mp.style.display='none';
  }
}

function closeAllInputPopups(){
  const sp=$('#skillPopup');
  const mp=$('#modelPopup');
  if(sp) sp.style.display='none';
  if(mp) mp.style.display='none';
}

function selectModel(m){
  state.model.model=m;
  save();
  closeAllInputPopups();
  const btn=$('#modelPopupBtn');
  if(btn) btn.textContent=m;
}

function insertSkill(name){
  const ta=$('#chatInput');
  if(ta){
    ta.value+=` /${name} `;
    ta.focus();
  }
  closeAllInputPopups();
}

let histFilter='all';
let histSelected=new Set();

function sourceTagClass(src){
  if(!src) return 'other';
  const s=src.toLowerCase();
  if(s.includes('webui')||s.includes('web')) return 'webui';
  if(s.includes('feishu')||s.includes('飞书')||s.includes('lark')) return 'feishu';
  if(s.includes('terminal')||s.includes('终端')||s.includes('cli')) return 'terminal';
  return 'other';
}

function sourceTagLabel(src){
  if(!src) return 'WebUI';
  const s=src.toLowerCase();
  if(s.includes('feishu')||s.includes('飞书')||s.includes('lark')) return '飞书';
  if(s.includes('terminal')||s.includes('终端')||s.includes('cli')) return '终端';
  if(s.includes('webui')||s.includes('web')) return 'WebUI';
  return src;
}

function openHistoryPopup(){
  histFilter='all';
  histSelected=new Set();
  const overlay=document.createElement('div');
  overlay.className='history-popup';
  overlay.id='historyOverlay';
  overlay.onclick=e=>{if(e.target===overlay)closeHistoryPopup()};
  overlay.innerHTML=`<div class="history-popup-inner">
    <div class="history-popup-header">
      <h4>历史记录</h4>
      <div class="history-popup-actions">
        <button class="btn btn-xs btn-secondary" onclick="histSelectAll()">全选</button>
        <button class="btn btn-xs btn-secondary" id="histDeleteBtn" style="display:none" onclick="deleteSelectedHist()">删除选中</button>
        <button class="history-popup-close" onclick="closeHistoryPopup()">${SVG.x}</button>
      </div>
    </div>
    <div class="history-popup-filter" id="histFilterBar">
      <span class="filter-chip active" onclick="setHistFilter('all')">全部</span>
      <span class="filter-chip" onclick="setHistFilter('webui')">WebUI</span>
      <span class="filter-chip" onclick="setHistFilter('feishu')">飞书</span>
      <span class="filter-chip" onclick="setHistFilter('terminal')">终端</span>
    </div>
    <div class="history-popup-body" id="histBody"></div>
  </div>`;
  document.body.appendChild(overlay);
  refreshHistBody();
}

function closeHistoryPopup(){
  const el=$('#historyOverlay');
  if(el) el.remove();
}

function setHistFilter(f){
  histFilter=f;
  const bar=$('#histFilterBar');
  if(!bar) return;
  bar.querySelectorAll('.filter-chip').forEach(c=>{
    c.classList.toggle('active',c.textContent.trim()===(f==='all'?'全部':f==='webui'?'WebUI':f==='feishu'?'飞书':'终端'));
  });
  refreshHistBody();
}

function toggleHistSelect(id){
  if(histSelected.has(id)) histSelected.delete(id); else histSelected.add(id);
  const btn=$('#histDeleteBtn');
  if(btn) btn.style.display=histSelected.size>0?'inline-flex':'none';
  const item=document.querySelector(`.hist-popup-item[data-id="${id}"]`);
  if(item) item.classList.toggle('selected',histSelected.has(id));
  const cb=item?.querySelector('input[type=checkbox]');
  if(cb) cb.checked=histSelected.has(id);
}

async function deleteSelectedHist(){
  if(histSelected.size===0) return;
  for(const id of histSelected){
    await apiDel('/api/chats/'+id);
    state.chats=state.chats.filter(c=>c.id!==id);
    if(state.currentChat===id) state.currentChat=null;
  }
  histSelected.clear();
  const btn=$('#histDeleteBtn');
  if(btn) btn.style.display='none';
  refreshHistBody();
  renderPage();
}

function refreshHistBody(){
  const body=$('#histBody');
  if(!body) return;
  let chats=[...state.chats].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  if(histFilter!=='all'){
    chats=chats.filter(c=>{
      const cls=sourceTagClass(c.source||'');
      return cls===histFilter;
    });
  }
  if(chats.length===0){
    body.innerHTML='<div class="empty-state" style="padding:40px 0"><span>暂无会话</span></div>';
    return;
  }
  body.innerHTML=chats.map(c=>{
    const src=c.source||'WebUI';
    const cls=sourceTagClass(src);
    const label=sourceTagLabel(src);
    const lastMsg=c.messages?.length?stripArtifactTagsForPreview(c.messages[c.messages.length-1].content||'').slice(0,50)||'':'暂无消息';
    const sel=histSelected.has(c.id);
    return `<div class="hist-popup-item${sel?' selected':''}" data-id="${c.id}">
      <input type="checkbox" ${sel?'checked':''} onclick="event.stopPropagation();toggleHistSelect('${c.id}')">
      <div class="hist-popup-item-info" onclick="selectChatFromHist('${c.id}')">
        <div class="hist-popup-item-title">${c.pinned?'📌 ':''}${esc(c.title)}</div>
        <div class="hist-popup-item-preview">${esc(lastMsg)}</div>
      </div>
      <div class="hist-popup-item-meta">
        <span class="source-tag ${cls}">${label}</span>
      </div>
    </div>`;
  }).join('');
}

function selectChatFromHist(id){
  closeHistoryPopup();
  selectChat(id);
}

function histSelectAll(){
  const body=$('#histBody');
  if(!body) return;
  const items=body.querySelectorAll('.hist-popup-item');
  const allSelected=items.length>0&&[...items].every(i=>histSelected.has(i.dataset.id));
  items.forEach(item=>{
    const id=item.dataset.id;
    if(allSelected){
      histSelected.delete(id);
      item.classList.remove('selected');
      const cb=item.querySelector('input[type=checkbox]');
      if(cb) cb.checked=false;
    } else {
      histSelected.add(id);
      item.classList.add('selected');
      const cb=item.querySelector('input[type=checkbox]');
      if(cb) cb.checked=true;
    }
  });
  const btn=$('#histDeleteBtn');
  if(btn) btn.style.display=histSelected.size>0?'inline-flex':'none';
}

function renderSessionList(){
  // Pinned chats first
  const sorted = [...state.chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  const groups={today:[],yesterday:[],older:[],pinned:[]};
  const now=Date.now();
  sorted.forEach(c=>{
    if (c.pinned) { groups.pinned.push(c); return; }
    const diff=now-(c.updatedAt||0);
    if(diff<86400000) groups.today.push(c);
    else if(diff<172800000) groups.yesterday.push(c);
    else groups.older.push(c);
  });
  let html='';
  const render=(label,list)=>{
    if(!list.length) return '';
    return `<div class="session-group-header"><span class="session-group-label">${label}</span><span class="session-group-count">${list.length}</span></div>`+
      list.map(c=>{
        const src=c.source||'WebUI';
        const cls=sourceTagClass(src);
        const label=sourceTagLabel(src);
        return `<div class="session-item${state.currentChat===c.id?' active':''}">
        <div class="session-item-body" onclick="selectChat('${c.id}')">
          <span class="s-title">${c.pinned?'📌 ':''}${esc(c.title)} <span class="source-tag ${cls}" style="font-size:9px;vertical-align:middle">${label}</span></span>
          <span class="s-preview">${c.messages?.length?esc(stripArtifactTagsForPreview(c.messages[c.messages.length-1].content||'')):'暂无消息'}</span>
        </div>
        <div class="session-more-wrap">
          <button class="session-more-btn" onclick="event.stopPropagation();toggleSessionMenu('${c.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
          <div class="session-menu" id="sessionMenu_${c.id}">
            <button onclick="event.stopPropagation();renameSessionChat('${c.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              编辑标题
            </button>
            <button onclick="event.stopPropagation();pinSessionChat('${c.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg>
              ${c.pinned?'取消置顶':'置顶'}
            </button>
            <button class="danger" onclick="event.stopPropagation();deleteSessionChat('${c.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              删除
            </button>
          </div>
        </div>
      </div>`}).join('');
  };
  html+=render('📌 置顶',groups.pinned);
  html+=render('今天',groups.today);
  html+=render('昨天',groups.yesterday);
  html+=render('更早',groups.older);
  return html||'<div class="empty-state" style="padding:40px 0"><span>暂无会话</span></div>';
}

function stripArtifactTagsForPreview(raw){
  const s=String(raw||'');
  if(!s||typeof HermesArtifact==='undefined') return s.slice(0,90);
  const p=HermesArtifact.parseHermesStream(s);
  const v=(p.visibleText||'').trim();
  if(!v&&(p.completedArtifacts||[]).length)return '[Artifact]';
  return v.slice(0,90);
}

function buildArtifactRefHtml(p){
  if(typeof HermesArtifact==='undefined'||!p) return '';
  const titles=[];
  (p.completedArtifacts||[]).forEach(a=>{const t=a.attrs&&a.attrs.title;if(t&&!titles.includes(t))titles.push(t);});
  if(p.activeArtifact&&p.activeArtifact.attrs&&p.activeArtifact.attrs.title){
    const t=p.activeArtifact.attrs.title;if(!titles.includes(t))titles.push(t);
  }
  if(!titles.length) return '';
  return '<div class="artifact-ref-row">'+titles.map(t=>{
    const list=HermesArtifact.getVersionList(t);
    const upd=list.length>1?' <span class="artifact-ref-badge">已更新</span>':'';
    const safe=encodeURIComponent(t);
    return `<button type="button" class="artifact-ref-chip" onclick="HermesArtifact.openRef(decodeURIComponent('${safe}'))">📄 ${esc(t)}${upd} · 查看</button>`;
  }).join('')+'</div>';
}

function buildPreviewActionHtml(rawContent){
  return '';
}

function openMarkdownPreview(content,title){
  if(typeof HermesArtifact==='undefined') return;
  const text=String(content||'').trim();
  if(!text) return;
  try{
    HermesArtifact.resetSession();
    HermesArtifact.recordCompletedArtifacts([{attrs:{title:title||'Markdown 预览',type:'markdown'},content:text}]);
    HermesArtifact.openRef(title||'Markdown 预览');
  }catch(_){}
}


function openLatestPreviewPanel(){
  if(typeof HermesArtifact==='undefined') return;
  const wb = document.getElementById('chatWorkbench');
  if (wb && wb.dataset.layout === 'SPLIT_VIEW') {
    HermesArtifact.setLayout('chat');
    return;
  }
  const c=currentChat();
  const msgs=(c&&c.messages)||[];
  for(let i=msgs.length-1;i>=0;i--){
    const m=msgs[i];
    if(!m||m.role!=='assistant') continue;
    const parsed=HermesArtifact.parseHermesStream(m.content||'');
    const titles=[];
    (parsed.completedArtifacts||[]).forEach(a=>{const t=a.attrs&&a.attrs.title;if(t&&!titles.includes(t))titles.push(t);});
    if(parsed.activeArtifact?.attrs?.title&&!titles.includes(parsed.activeArtifact.attrs.title)) titles.push(parsed.activeArtifact.attrs.title);
    if(titles.length){
      HermesArtifact.openRef(titles[titles.length-1]);
      return;
    }
    const visible=(parsed.visibleText||String(m.content||'')).trim();
    if(visible){
      openMarkdownPreview(visible,'Markdown 预览');
      return;
    }
  }
}

function renderMsg(m){
  let thinkingHtml='';
  const tagThink=m.role==='assistant'&&typeof HermesArtifact!=='undefined'?HermesArtifact.parseHermesStream(m.content||'').think:'';
  const thinkBody=[m.thinking||m.reasoning||'',tagThink].filter(Boolean).join('\n---\n');
  // Skip thinking if it's essentially same as visible output
  const cleanContent=(m.content||'').replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/g,'').trim();
  const skipThink=thinkBody && cleanContent && thinkBody.trim().length>20 && cleanContent.includes(thinkBody.trim().slice(0,40));
  if(thinkBody && !skipThink){
    const id='th_'+(m._msgId||(m.ts||Date.now()))+'_'+(m.ts||0);
    const duration=m.thinkingDuration?` · ${m.thinkingDuration}ms`:'';
    const isStreaming=m._streaming;
    thinkingHtml=`<div class="msg-thinking">
      <div class="msg-thinking-header" onclick="toggleCollapse('${id}')">
        <svg class="thinking-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <span class="thinking-label">思考过程${isStreaming?'<span class="thinking-dots"><span></span><span></span><span></span></span>':''}</span>
        <span class="thinking-duration">${duration}</span>
        <span class="thinking-toggle" id="toggle_${id}">▶</span>
      </div>
      <div class="msg-thinking-body collapsed" id="body_${id}">${esc(thinkBody)}</div>
    </div>`;
  }
  let toolCallsHtml='';
  if(m.toolCalls&&m.toolCalls.length>0){
    toolCallsHtml='<div class="msg-tool-calls">'+m.toolCalls.map((tc,i)=>{
      const id='tc_'+(m.ts||Date.now())+'_'+i;
      const statusCls=tc.status==='success'?'success':tc.status==='error'?'error':'running';
      const statusText=tc.status==='success'?'完成':tc.status==='error'?'失败':'运行中';
      let bodyHtml='';
      if(tc.input) bodyHtml+=`<div class="tool-input">→ ${esc(typeof tc.input==='string'?tc.input:JSON.stringify(tc.input,null,2))}</div>`;
      if(tc.output) bodyHtml+=`<div class="tool-output">← ${esc(typeof tc.output==='string'?tc.output:JSON.stringify(tc.output,null,2))}</div>`;

      let previewBtn = '';
      if (tc.status === 'success' && (tc.name === 'Write' || tc.name === 'Edit')) {
        let filePath = '';
        try {
          const inputObj = typeof tc.input === 'string' ? JSON.parse(tc.input) : tc.input;
          filePath = inputObj.file_path || inputObj.path || '';
        } catch(e) {}
        if (filePath && filePath.endsWith('.md')) {
          const safePath = encodeURIComponent(filePath);
          const safeName = encodeURIComponent(filePath.split(/[/\\]/).pop());
          previewBtn = `<button class="history-card-btn" style="margin-left:8px" onclick="event.stopPropagation(); HermesArtifact.openHistoryFile('${safePath}', '${safeName}')">预览文档</button>`;
        }
      }

      return `<div class="msg-tool-call">
        <div class="msg-tool-call-header" data-tool="${esc(tc.name)}" onclick="toggleCollapse('${id}')">
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          <span class="tool-name">${esc(tc.name)}</span>
          <span class="tool-status ${statusCls}">${statusText}</span>
          ${previewBtn}
          <span class="tool-toggle" id="toggle_${id}">▼</span>
        </div>
        <div class="msg-tool-call-body" id="body_${id}">${bodyHtml}</div>
      </div>`;
    }).join('')+'</div>';
  }
  let stepHtml='';
  if(m.step) stepHtml=`<div class="msg-step-indicator">Step ${m.step}</div>`;
  const msgId = m._msgId || '';
  // Clean content: remove model normalization warnings
  let content = m.content || '';
  content = content.replace(/⚠️\s*Normalized model.*?for deepseek\.?\n?/g, '');
  content = content.replace(/⚠\s*Normalized model.*?for deepseek\.?\n?/g, '');
  let artifactRefsHtml='';
  let previewActionHtml='';
  if(m.role==='assistant'&&typeof HermesArtifact!=='undefined'){
    const p=HermesArtifact.parseHermesStream(content);
    let vis=(p.visibleText||'').trim();
    if(!vis&&(p.activeArtifact||(p.completedArtifacts||[]).length))vis='已为你生成文件，可在右侧面板或下方引用查看。';
    content=vis;
    artifactRefsHtml=buildArtifactRefHtml(p);
    previewActionHtml=buildPreviewActionHtml(m.content||content);
  }
  const modelBadge = '';
  // Streaming dots at bottom of content
  const streamDots = m._streaming ? '<span class="msg-streaming"><span></span><span></span><span></span></span>' : '';
  return `<div class="msg ${m.role} animate-in" id="msg_${msgId}">
    <div class="msg-avatar">${m.role==='user'?'U':'H'}</div>
    <div class="msg-main">
      ${thinkingHtml}
      ${toolCallsHtml}
      <div class="msg-bubble markdown-body">${stepHtml}${formatMsg(content)}${artifactRefsHtml}${previewActionHtml}${modelBadge}${streamDots}</div>
    </div>
  </div>`;
}

function toggleCollapse(id){
  const body=document.getElementById('body_'+id);
  const toggle=document.getElementById('toggle_'+id);
  if(body&&toggle){
    body.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
  }
}
function renderMessageMarkdown(text){
  const raw=String(text||'');
  if(typeof marked!=='undefined'&&marked&&typeof marked.parse==='function'){
    try{
      return marked.parse(raw,{breaks:true});
    }catch(_){ }
  }
  return `<pre>${esc(raw)}</pre>`;
}

function enhanceMessageMarkdown(root){
  if(!root) return;
  if(typeof hljs!=='undefined'&&hljs){
    root.querySelectorAll('pre code').forEach(code=>{
      try{hljs.highlightElement(code);}catch(_){ }
    });
  }
  root.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-code-btn') || pre.parentElement.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    wrapper.style.position = 'relative';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    btn.title = '复制代码';
    btn.onclick = () => {
      const text = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
      navigator.clipboard.writeText(text).then(() => {
        const old = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => btn.innerHTML = old, 2000);
      });
    };
    wrapper.appendChild(btn);
  });
}

function formatMsg(text){
  return renderMessageMarkdown(text);
}

function currentChat(){return state.chats.find(c=>c.id===state.currentChat)}
function currentChatFull(){return state.chatFullData[state.currentChat]}

async function syncCurrentChat(chatId){
  try{
    const data=await apiGet('/api/chats/'+chatId);
    if(data&&data.id){
      const idx=state.chats.findIndex(c=>c.id===chatId);
      if(idx>=0){
        state.chats[idx].title=data.title;
        state.chats[idx].updatedAt=data.updatedAt;
        state.chats[idx].messages=data.messages||[];
        state.chats[idx].messageCount=(data.messages||[]).length;
      }
      state.chatFullData[chatId]=data;
      const sessionItems=$('#sessionItems');
      if(sessionItems) sessionItems.innerHTML=renderSessionList();
    }
  }catch(e){}
}

async function newChat(){
  const data = await apiPost('/api/chats', { title: '新建对话' });
  if (data) {
    state.chats.unshift({ id: data.id, title: data.title, messages: [], updatedAt: data.updatedAt });
    state.chatFullData[data.id] = data;
    state.currentChat = data.id;
  } else {
    // fallback: local-only
    const c = { id: 'c'+Date.now(), title: '新建对话', messages: [], updatedAt: Date.now() };
    state.chats.unshift(c);
    state.currentChat = c.id;
  }
  renderPage();
}

async function selectChat(id){
  state.currentChat = id;
  if (typeof HermesArtifact !== 'undefined') {
    try { HermesArtifact.resetSession(); HermesArtifact.setLayout('chat'); } catch (_) {}
  }
  // Load full chat data from backend if not cached
  if (!state.chatFullData[id]) {
    // Check if this is a CLI session or WebUI chat
    const c = state.chats.find(x => x.id === id);
    const endpoint = c && c.source === 'cli' ? '/api/cli/sessions/' : '/api/chats/';
    const data = await apiGet(endpoint + id);
    if (data) {
      state.chatFullData[id] = data;
      // Sync messages into local chat object
      if (c) {
        c.messages = data.messages || [];
        c._model = data.model || state.model.model;
        // Propagate model to each assistant message
        c.messages.forEach(m => {
          if (m.role === 'assistant') m._model = c._model;
        });
      }
    }
  }
  renderPage();
}

function clearChat(){
  const c=currentChat();
  if(c){c.messages=[];save();renderPage()}
}

function initChat(){
  const ta=$('#chatInput');
  if(!ta) return;
  ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,400)+'px'});
  const area=$('#messagesArea');
  if(area){
    area.querySelectorAll('.msg-bubble').forEach(enhanceMessageMarkdown);
    area.scrollTop=area.scrollHeight;
  }
}

function autoResizeInput(ta){
  ta.style.height='auto';
  const maxH=400;
  ta.style.height=Math.min(ta.scrollHeight,maxH)+'px';
}

async function sendMessage(){
  const ta=$('#chatInput');
  const txt=ta?ta.value.trim():'';
  if(!txt) return;
  
  // If current chat is a CLI session (read-only), create a new WebUI chat
  if (state.currentChat) {
    const cur = currentChat();
    if (cur && cur.source === 'cli') {
      // Create a new WebUI chat for this conversation
      const data = await apiPost('/api/chats', { title: txt.slice(0, 24) });
      if (data) {
        // Copy CLI messages into new chat
        data.messages = [...(cur.messages || [])];
        state.chats.unshift({ id: data.id, title: data.title, source: 'webui', messages: data.messages, updatedAt: data.updatedAt });
        state.chatFullData[data.id] = data;
        state.currentChat = data.id;
      }
    }
  }
  
  // Create chat if needed
  if(!state.currentChat) {
    await newChat();
    await new Promise(r => setTimeout(r, 50));
  }
  const c=currentChat();
  if(!c) return;

  // Add user message to local state immediately (backend will also add it)
  const userMsg = {role:'user',content:txt,ts:Date.now()};
  c.messages.push(userMsg);
  if(c.title==='新建对话') c.title=txt.slice(0,24);
  c.updatedAt=Date.now();
  if(ta){ta.value='';autoResizeInput(ta)}

  const msgId = '' + Date.now();
  const assistantMsg = { role: 'assistant', content: '', thinking: '', toolCalls: [], _msgId: msgId, _streaming: true, ts: Date.now() };
  c.messages.push(assistantMsg);

  if (typeof HermesArtifact !== 'undefined') HermesArtifact.resetSession();

  renderPage();
  const area=$('#messagesArea');
  if(area) area.scrollTop=area.scrollHeight;

  // SSE stream from backend
  let fullContent = '';
  let fullReasoning = '';
  const tools = [];

  await apiStream('/api/chats/' + (c._id || c.id) + '/messages', { content: txt }, {
    onToken(text) {
      fullContent += text;
      assistantMsg.content = fullContent;
      if (typeof HermesArtifact !== 'undefined') {
        const p = HermesArtifact.parseHermesStream(fullContent);
        assistantMsg.thinking = [fullReasoning, p.think].filter(Boolean).join('\n\n');
        HermesArtifact.feedStream(p, true);
      } else {
        assistantMsg.thinking = fullReasoning;
      }
      renderMsgUpdate(msgId, assistantMsg);
    },
    onReasoning(text) {
      fullReasoning += text;
      if (typeof HermesArtifact !== 'undefined') {
        const p = HermesArtifact.parseHermesStream(fullContent);
        assistantMsg.thinking = [fullReasoning, p.think].filter(Boolean).join('\n\n');
      } else {
        assistantMsg.thinking = fullReasoning;
      }
      renderMsgUpdate(msgId, assistantMsg);
    },
    onTool(data) {
      // Check if this is a clarify/ask_user tool call
      if (data.name === 'clarify' || data.name === 'ask_user') {
        assistantMsg._streaming = false;
        assistantMsg.content = '📋 需要你确认...';
        renderMsgUpdate(msgId, assistantMsg);
        // Parse question data
        let qData = data.args || data.preview || {};
        if (typeof qData === 'string') {
          try { qData = JSON.parse(qData); } catch { qData = { question: qData }; }
        }
        const question = qData.question || qData.label || '请确认';
        const choices = qData.choices || qData.options || [];
        if (choices.length > 0) {
          askUser([{
            id: 'clarify_q',
            label: question,
            type: 'single',
            options: choices.map(c => ({
              label: c.label || c,
              value: c.value || c,
            })),
          }]).then(answers => {
            if (answers && answers.length) {
              const answer = answers[0].selected[0] || answers[0].custom || 'ok';
              // Send the answer as a follow-up message
              const ta = $('#chatInput');
              if (ta) {
                ta.value = answer;
                sendMessage();
              }
            }
          });
        } else {
          // Open-ended question
          askUser([{
            id: 'clarify_q',
            label: question,
            type: 'single',
            options: [{ label: '确认', value: '继续' }],
          }]).then(answers => {
            const answer = answers?.[0]?.custom || answers?.[0]?.selected?.[0] || '继续';
            const ta = $('#chatInput');
            if (ta) {
              ta.value = answer;
              sendMessage();
            }
          });
        }
        return;
      }
      const tc = { name: data.name, status: 'running', input: data.args || data.preview || '', output: '' };
      tools.push(tc);
      assistantMsg.toolCalls = [...tools];
      renderMsgUpdate(msgId, assistantMsg);
    },
    onToolComplete(data) {
      for (const t of tools) {
        if (t.name === data.name && t.status === 'running') {
          t.status = data.is_error ? 'error' : 'success';
          t.output = data.preview || '';
          break;
        }
      }
      assistantMsg.toolCalls = [...tools];
      renderMsgUpdate(msgId, assistantMsg);
    },
    onTitle(data) {
      if (data.title && c.title === '新建对话') {
        c.title = data.title;
        const titleEl = document.querySelector('.chat-header-title');
        if (titleEl) titleEl.textContent = data.title;
        const sessionItems = $('#sessionItems');
        if (sessionItems) sessionItems.innerHTML = renderSessionList();
      }
    },
    onDone() {
      assistantMsg._streaming = false;
      if (typeof HermesArtifact !== 'undefined') {
        const p = HermesArtifact.parseHermesStream(assistantMsg.content || '');
        HermesArtifact.finalizeStream(p);
      }
      renderMsgUpdate(msgId, assistantMsg);
      syncCurrentChat(c._id || c.id);
    },
    onError(msg) {
      assistantMsg._streaming = false;
      if (!fullContent) assistantMsg.content = '⚠️ ' + msg;
      renderMsgUpdate(msgId, assistantMsg);
    },
  });
}

let _renderThrottleTimer = null;
let _pendingMsgUpdates = new Map();

function renderMsgUpdate(msgId, msg) {
  _pendingMsgUpdates.set(msgId, msg);
  if (!_renderThrottleTimer) {
    _renderThrottleTimer = requestAnimationFrame(() => {
      _renderThrottleTimer = null;
      flushMsgUpdates();
    });
  }
}

function flushMsgUpdates() {
  const updates = _pendingMsgUpdates;
  _pendingMsgUpdates = new Map();
  for (const [msgId, msg] of updates) {
    const el = document.getElementById('msg_' + msgId);
    if (el) {
      // In-place update: only replace bubble content to avoid flickering
      const bubble = el.querySelector('.msg-bubble');
      if (bubble) {
        let content = msg.content || '';
        content = content.replace(/⚠️\s*Normalized model.*?for deepseek\.?\n?/g, '');
        content = content.replace(/⚠\s*Normalized model.*?for deepseek\.?\n?/g, '');
        let refs = '';
        let previewAction = '';
        if (msg.role === 'assistant' && typeof HermesArtifact !== 'undefined') {
          const p = HermesArtifact.parseHermesStream(content);
          let vis = (p.visibleText || '').trim();
          if (!vis && (p.activeArtifact || (p.completedArtifacts || []).length)) {
            vis = '已为你生成文件，可在右侧面板或下方引用查看。';
          }
          content = vis;
          refs = buildArtifactRefHtml(p);
          previewAction = buildPreviewActionHtml(msg.content || content);
        }
        const modelBadge = '';
        const streamDots = msg._streaming ? '<span class="msg-streaming"><span></span><span></span><span></span></span>' : '';
        bubble.innerHTML = formatMsg(content) + refs + previewAction + modelBadge + streamDots;
        enhanceMessageMarkdown(bubble);
      }
      // Update thinking block
      const main = el.querySelector('.msg-main');
      const bubbleWrap = el.querySelector('.msg-bubble');
      const tagThink = msg.role === 'assistant' && typeof HermesArtifact !== 'undefined'
        ? HermesArtifact.parseHermesStream(msg.content || '').think : '';
      const combinedThink = [msg.thinking || msg.reasoning || '', tagThink].filter(Boolean).join('\n---\n');
      // Skip thinking if same as output
      const cleanContent=(msg.content||'').replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/g,'').trim();
      const skipThink=combinedThink && cleanContent && combinedThink.trim().length>20 && cleanContent.includes(combinedThink.trim().slice(0,40));
      if (main) {
        let thEl = main.querySelector('.msg-thinking');
        if (combinedThink && !skipThink) {
          const thId = 'th_stream_' + msgId;
          const isStreaming=msg._streaming;
          const duration=msg.thinkingDuration?` · ${msg.thinkingDuration}ms`:'';
          const thHtml = `<div class="msg-thinking"><div class="msg-thinking-header" onclick="toggleCollapse('${thId}')"><svg class="thinking-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span class="thinking-label">思考过程${isStreaming?'<span class="thinking-dots"><span></span><span></span><span></span></span>':''}</span><span class="thinking-duration">${duration}</span><span class="thinking-toggle collapsed" id="toggle_${thId}">▶</span></div><div class="msg-thinking-body collapsed" id="body_${thId}">${esc(combinedThink)}</div></div>`;
          if (thEl) thEl.outerHTML = thHtml;
          else if (bubbleWrap) bubbleWrap.insertAdjacentHTML('beforebegin', thHtml);
        } else if (thEl) {
          thEl.remove();
        }
      }
      // Update tool calls
      if (main) {
        let tcEl = main.querySelector('.msg-tool-calls');
        if (msg.toolCalls && msg.toolCalls.length) {
          const tcHtml = '<div class="msg-tool-calls">' + msg.toolCalls.map((tc,i) => {
            const id = 'tc_' + (msg.ts||Date.now()) + '_' + i;
            const sc = tc.status === 'success' ? 'success' : tc.status === 'error' ? 'error' : 'running';
            const st = tc.status === 'success' ? '完成' : tc.status === 'error' ? '失败' : '运行中';
            let bh = '';
            if (tc.input) bh += `<div class="tool-input">→ ${esc(typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input,null,2))}</div>`;
            if (tc.output) bh += `<div class="tool-output">← ${esc(typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output,null,2))}</div>`;
            return `<div class="msg-tool-call"><div class="msg-tool-call-header" data-tool="${esc(tc.name)}" onclick="toggleCollapse('${id}')"><svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg><span class="tool-name">${esc(tc.name)}</span><span class="tool-status ${sc}">${st}</span><span class="tool-toggle" id="toggle_${id}">▼</span></div><div class="msg-tool-call-body" id="body_${id}">${bh}</div></div>`;
          }).join('') + '</div>';
          if (tcEl) tcEl.outerHTML = tcHtml;
          else if (bubbleWrap) bubbleWrap.insertAdjacentHTML('beforebegin', tcHtml);
        } else if (tcEl) {
          tcEl.remove();
        }
      }
    } else {
      // Full re-render fallback for new messages
      const messagesArea = $('#messagesArea');
      if (messagesArea) {
        const msgEl = document.createElement('div');
        msgEl.innerHTML = renderMsg(msg);
        const child = msgEl.firstElementChild;
        if (child) messagesArea.appendChild(child);
        if (messagesArea.scrollTop > messagesArea.scrollHeight - 600) {
          messagesArea.scrollTop = messagesArea.scrollHeight;
        }
      }
    }
  }
  const area = $('#messagesArea');
  if (area) area.scrollTop = area.scrollHeight;
}

function mockReply(q){
  const thinkDuration=800+Math.floor(Math.random()*1200);
  const toolDuration=300+Math.floor(Math.random()*500);
  const hasTools=Math.random()>0.3;
  const toolCalls=[];
  if(hasTools){
    const tools=[
      {name:'read_file',input:{path:'/src/main.py'},output:'def main():\n    print("hello")\n    return 0'},
      {name:'search_code',input:{query:'function handler',scope:'src/'},output:'Found 3 matches:\n  src/handler.py:12\n  src/api.py:45\n  src/routes.py:8'},
      {name:'execute_command',input:{command:'python -m pytest tests/'},output:'4 passed, 0 failed in 1.2s'},
      {name:'write_file',input:{path:'/src/config.yaml',content:'debug: false\nport: 8080'},output:'File written successfully'},
      {name:'web_search',input:{query:'latest python release'},output:'Python 3.13.0 released on 2024-10-07'},
    ];
    const count=1+Math.floor(Math.random()*2);
    const shuffled=tools.sort(()=>Math.random()-0.5);
    for(let i=0;i<count;i++){
      toolCalls.push({...shuffled[i],status:'success',duration:toolDuration});
    }
  }
  const thinkingTexts=[
    `用户询问了关于"${q.slice(0,20)}"的问题。\n\n让我分析一下：\n1. 首先需要理解用户的意图\n2. 查找相关的上下文信息\n3. 制定回答策略\n\n根据已有信息，我可以给出以下建议...`,
    `收到问题，让我思考一下...\n\n这个问题涉及几个方面：\n- 核心需求：${q.slice(0,15)}\n- 需要考虑的边界情况\n- 最佳实践建议\n\n我需要先查看一些信息来给出准确的回答。`,
    `分析用户请求中...\n\n关键词提取：${q.split(' ').slice(0,3).join('、')}\n意图判断：技术咨询\n置信度：高\n\n准备调用相关工具获取更多信息...`,
  ];
  const replies=[
    `根据我的分析，以下是关于你问题的回答：\n\n**核心要点**\n\n${q.length>10?'你提到的这个问题很关键，':'这很重要，'}需要从多个角度来理解。\n\n**建议**\n\n1. 首先确认当前环境配置\n2. 按照最佳实践进行操作\n3. 注意边界情况的处理\n\n如果你需要更详细的说明，请告诉我。`,
    `好的，让我来回答你的问题。\n\n经过分析，我认为最合适的方案是：\n\n1. **理解需求** — 明确目标\n2. **设计方案** — 选择最优路径\n3. **实施验证** — 确保结果正确\n\n有什么其他问题可以继续问我。`,
    `这是一个很好的问题！让我详细解答。\n\n**分析过程**\n\n基于当前上下文，我梳理了以下几个关键点：\n\n- 需要考虑实际场景\n- 注意性能和可维护性的平衡\n- 遵循行业最佳实践\n\n**结论**\n\n建议采用渐进式方案，先解决核心问题，再逐步优化。`,
  ];
  return {
    role:'assistant',
    content:replies[Math.floor(Math.random()*replies.length)],
    thinking:thinkingTexts[Math.floor(Math.random()*thinkingTexts.length)],
    thinkingDuration:thinkDuration,
    toolCalls:toolCalls.length>0?toolCalls:undefined,
    step:hasTools?2:1,
    ts:Date.now(),
  };
}

function renderHistory(){
  const chats = state.chats || [];
  const selected = state._historySelected || new Set();

  // Group by date
  const groups = { today: [], yesterday: [], week: [], month: [], older: [] };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;
  const monthAgo = today - 30 * 86400000;

  chats.forEach(c => {
    const t = c.createdAt || c.updatedAt || 0;
    if (t >= today) groups.today.push(c);
    else if (t >= yesterday) groups.yesterday.push(c);
    else if (t >= weekAgo) groups.week.push(c);
    else if (t >= monthAgo) groups.month.push(c);
    else groups.older.push(c);
  });

  const groupLabels = {
    today: '今天', yesterday: '昨天',
    week: '最近7天', month: '最近30天', older: '更早'
  };

  let html = '';
  let totalSelected = 0;
  for (const [key, label] of Object.entries(groupLabels)) {
    const list = groups[key];
    if (!list.length) continue;
    html += `<div class="hist-date-header">${label} <span class="hist-count">${list.length}</span></div>`;
    list.forEach(c => {
      const isSelected = selected.has(c.id);
      if (isSelected) totalSelected++;
      const date = new Date(c.createdAt || c.updatedAt || Date.now());
      const dateStr = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const preview = c.messages?.length ? c.messages[c.messages.length-1].content?.slice(0, 50) : '';
      html += `<div class="hist-item${isSelected ? ' selected' : ''}" data-id="${c.id}">
        <label class="hist-check" onclick="event.stopPropagation();toggleHistSelect('${c.id}')">
          <input type="checkbox" ${isSelected ? 'checked' : ''} class="hist-cb">
        </label>
        <div class="hist-body" onclick="state.currentChat='${c.id}';navigate('chat')">
          <div class="hist-title">${esc(c.title || '未命名')}</div>
          <div class="hist-meta">
            <span class="hist-date">${dateStr}</span>
            <span class="hist-msgs">${c.messages?.length || 0} 条消息</span>
          </div>
          ${preview ? `<div class="hist-preview">${esc(preview)}</div>` : ''}
        </div>
      </div>`;
    });
  }

  if (!html) html = '<div class="empty-state" style="padding:80px 0"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>暂无历史记录</span></div>';

  return `<div class="history-panel">
    <div class="page-header">
      <h2>历史记录 <span class="hist-total">${chats.length}</span></h2>
      <div class="header-actions">
        ${totalSelected > 0
          ? `<button class="btn btn-sm btn-danger" onclick="deleteSelectedChats()">删除 ${totalSelected} 项</button>
             <button class="btn btn-sm btn-ghost" onclick="clearHistSelect()">取消选择</button>`
          : `<button class="btn btn-sm btn-ghost" onclick="toggleHistSelectAll()">全选</button>`
        }
      </div>
    </div>
    <div class="hist-list">${html}</div>
    <div class="toast" id="histToast"></div>
  </div>`;
}

function initHistory(){
  // Load full data for any chats that don't have messages loaded
}

// === History helpers ===
function toggleHistSelect(id) {
  if (!state._historySelected) state._historySelected = new Set();
  if (state._historySelected.has(id)) state._historySelected.delete(id);
  else state._historySelected.add(id);
  renderPage();
}

function toggleHistSelectAll() {
  if (!state._historySelected) state._historySelected = new Set();
  const chats = state.chats || [];
  if (state._historySelected.size === chats.length) {
    state._historySelected.clear();
  } else {
    chats.forEach(c => state._historySelected.add(c.id));
  }
  renderPage();
}

function clearHistSelect() {
  state._historySelected = new Set();
  renderPage();
}

function deleteSelectedChats() {
  if (!state._historySelected || state._historySelected.size === 0) return;
  const count = state._historySelected.size;
  if (!confirm(`确认删除 ${count} 个会话？`)) return;
  state._historySelected.forEach(async id => {
    await apiDel('/api/chats/' + id);
    state.chats = state.chats.filter(c => c.id !== id);
    delete state.chatFullData[id];
    if (state.currentChat === id) state.currentChat = null;
  });
  state._historySelected.clear();
  toast(`已删除 ${count} 个会话`, 'info');
  renderPage();
}

// Close menus on outside click
// === Session (chat sidebar) more menu ===
function toggleSessionMenu(id) {
  document.querySelectorAll('.session-menu.show').forEach(m => m.classList.remove('show'));
  const menu = document.getElementById('sessionMenu_' + id);
  if (menu) menu.classList.toggle('show');
}

async function renameSessionChat(id) {
  const c = state.chats.find(x => x.id === id);
  if (!c) return;
  const currentTitle = c.title || '';
  openModal(`
    <div class="rename-modal">
      <h3>编辑标题</h3>
      <input id="renameInput" class="input" value="${esc(currentTitle)}" placeholder="输入新标题" autofocus
        onkeydown="if(event.key==='Enter'){event.preventDefault();confirmRename('${id}')}">
      <div class="rename-actions">
        <button class="btn btn-ghost" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="confirmRename('${id}')">保存</button>
      </div>
    </div>
  `);
  setTimeout(() => {
    const inp = document.getElementById('renameInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 100);
}

async function confirmRename(id) {
  const inp = document.getElementById('renameInput');
  if (!inp) return;
  const newTitle = inp.value.trim();
  if (!newTitle) return;
  const c = state.chats.find(x => x.id === id);
  if (!c) return;
  await apiPut('/api/chats/' + id, { title: newTitle });
  c.title = newTitle;
  closeModal();
  renderPage();
}

async function pinSessionChat(id) {
  const c = state.chats.find(x => x.id === id);
  if (!c) return;
  const pinned = !c.pinned;
  await apiPut('/api/chats/' + id, { pinned });
  c.pinned = pinned;
  toast(pinned ? '已置顶' : '已取消置顶', 'info');
  renderPage();
}

async function deleteSessionChat(id) {
  if (!confirm('确认删除该会话？')) return;
  await apiDel('/api/chats/' + id);
  state.chats = state.chats.filter(c => c.id !== id);
  delete state.chatFullData[id];
  if (state.currentChat === id) state.currentChat = null;
  toast('已删除', 'info');
  renderPage();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hist-more-wrap')) {
    document.querySelectorAll('.hist-menu.show').forEach(m => m.classList.remove('show'));
  }
  if (!e.target.closest('.gc-room-more-wrap')) {
    document.querySelectorAll('.gc-room-menu.show').forEach(m => m.classList.remove('show'));
  }
  if (!e.target.closest('.session-more-wrap')) {
    document.querySelectorAll('.session-menu.show').forEach(m => m.classList.remove('show'));
  }
});

// === More menu ===
function toggleHistMenu(id) {
  // Close all other menus
  document.querySelectorAll('.hist-menu.show').forEach(m => m.classList.remove('show'));
  const menu = document.getElementById('histMenu_' + id);
  if (menu) menu.classList.toggle('show');
}

async function renameHistChat(id) {
  const c = state.chats.find(x => x.id === id);
  if (!c) return;
  const currentTitle = c.title || '';
  openModal(`
    <div class="rename-modal">
      <h3>编辑标题</h3>
      <input id="renameInput" class="input" value="${esc(currentTitle)}" placeholder="输入新标题" autofocus
        onkeydown="if(event.key==='Enter'){event.preventDefault();confirmRename('${id}')}">
      <div class="rename-actions">
        <button class="btn btn-ghost" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="confirmRename('${id}')">保存</button>
      </div>
    </div>
  `);
  setTimeout(() => {
    const inp = document.getElementById('renameInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 100);
}

async function pinHistChat(id) {
  const c = state.chats.find(x => x.id === id);
  if (!c) return;
  const pinned = !c.pinned;
  await apiPut('/api/chats/' + id, { pinned });
  c.pinned = pinned;
  toast(pinned ? '已置顶' : '已取消置顶', 'info');
  renderPage();
}

async function deleteHistChat(id) {
  if (!confirm('确认删除该会话？')) return;
  await apiDel('/api/chats/' + id);
  state.chats = state.chats.filter(c => c.id !== id);
  delete state.chatFullData[id];
  if (state.currentChat === id) state.currentChat = null;
  toast('已删除', 'info');
  renderPage();
}

function clearAllHistory(){
  if(!confirm('确认清空所有历史记录？')) return;
  state.chats=[];state.currentChat=null;save();renderPage();
}

function renderGroupChat(){
  const gc=state.groupChat;
  const room=gc.rooms.find(r=>r.id===gc.activeRoom);
  const agents=room?gc.agents[room.id]||[]:[];
  const messages=room?gc.messages[room.id]||[]:[];
  const members=room?gc.members[room.id]||[]:[];
  const typingUsers=room?(gc.typing[room.id]||[]):[];
  const ctxStatuses=room?(gc.contextStatus[room.id]||{}):{};
  const allAvatars=[{name:gc.userName,color:'#333'},...agents.map(a=>({name:a.name,color:a.color}))];
  const maxShow=4;
  const showAvatars=allAvatars.slice(0,maxShow);
  const extraCount=allAvatars.length-maxShow;

  let roomsHtml=gc.rooms.map(r=>{
    const lastMsg=(gc.messages[r.id]||[]).slice(-1)[0];
    const tokenPct=r.totalTokens?Math.min(100,r.totalTokens/100000*100):0;
    return `<div class="gc-room-item${gc.activeRoom===r.id?' active':''}" onclick="gcSelectRoom('${r.id}')">
      <div class="gc-room-info">
        <div class="gc-room-name">${esc(r.name)}</div>
        <div class="gc-room-preview">${lastMsg?esc(lastMsg.content.slice(0,30)):'暂无消息'}</div>
        <div class="gc-room-meta">
          <span>${(gc.members[r.id]||[]).length+1} 人</span>
          <div class="gc-token-bar"><div class="gc-token-fill" style="width:${tokenPct}%"></div></div>
          <span>${r.totalTokens||0} tok</span>
        </div>
      </div>
      <div class="gc-room-more-wrap">
        <button class="gc-room-more-btn" onclick="event.stopPropagation();gcToggleRoomMenu('${r.id}')">⋮</button>
        <div class="gc-room-menu" id="gcRoomMenu_${r.id}">
          <button onclick="event.stopPropagation();gcRenameRoom('${r.id}')">✏️ 编辑名称</button>
          <button class="danger" onclick="event.stopPropagation();gcDeleteRoom('${r.id}')">🗑️ 删除房间</button>
        </div>
      </div>
    </div>`;
  }).join('');

  let mainHtml='';
  if(room){
    let msgsHtml=messages.map(m=>{
      const isSelf=m.senderId==='user';
      const isAgent=m.senderType==='agent';
      return `<div class="gc-msg${isSelf?' self':''}${isAgent?' agent':''}">
        <div class="gc-msg-avatar" style="background:${m.senderColor||'#666'}">${esc(m.senderName.charAt(0))}</div>
        <div class="gc-msg-body">
          <div class="gc-msg-sender">${esc(m.senderName)}</div>
          <div class="gc-msg-bubble">${gcRenderContent(m.content,agents)}</div>
          <div class="gc-msg-time">${gcFormatTime(m.timestamp)}</div>
        </div>
      </div>`;
    }).join('');
    if(msgsHtml==='') msgsHtml='<div class="gc-empty" style="padding-top:80px"><span>暂无消息，开始聊天吧</span></div>';

    let typingHtml='';
    if(typingUsers.length>0){
      typingHtml=`<div class="gc-typing-dots"><span></span><span></span><span></span></div> ${esc(typingUsers.join('、'))} 正在输入...`;
    }
    Object.entries(ctxStatuses).forEach(([aid,st])=>{
      if(st==='compressing') typingHtml+=` · ${esc(aid)} 正在压缩上下文...`;
      if(st==='replying') typingHtml+=` · ${esc(aid)} 正在回复...`;
    });

    let avatarsHtml=showAvatars.map(a=>`<div class="gc-avatar" style="background:${a.color}">${esc(a.name.charAt(0))}</div>`).join('');
    if(extraCount>0) avatarsHtml+=`<div class="gc-avatar gc-avatar-more">+${extraCount}</div>`;

    mainHtml=`
      <div class="gc-header">
        <button class="fig-icon-btn" onclick="gcToggleRooms()" style="display:none" id="gcRoomsToggle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="gc-header-title">${esc(room.name)}</div>
        <div class="gc-avatars">${avatarsHtml}</div>
        <button class="fig-icon-btn" onclick="gcShowAddAgent()" title="添加 Agent">${SVG.plus}</button>
        <button class="fig-icon-btn" onclick="gcShowSettings()" title="房间设置">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </button>
        <div class="gc-conn-dot ${gc.connected?'online':'offline'}"></div>
      </div>
      <div class="gc-messages" id="gcMessages">${msgsHtml}</div>
      <div class="gc-status-bar" id="gcStatusBar">${typingHtml}</div>
      <div class="gc-input-area">
        <div class="gc-mention-menu" id="gcMentionMenu"></div>
        <div class="gc-input-wrap">
          <textarea id="gcInput" rows="1" placeholder="输入消息… (@ 提及 Agent)" onkeydown="gcOnKeyDown(event)" oninput="gcOnInput(this)"></textarea>
          <button class="send-btn" onclick="gcSendMessage()">${SVG.send}</button>
        </div>
      </div>`;
  } else {
    mainHtml=`<div class="gc-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
      <span>选择或创建一个房间开始聊天</span>
    </div>`;
  }

  return `<div class="gc-panel">
    <div class="gc-rooms" id="gcRoomsSidebar">
      <div class="gc-rooms-header"><h3>群聊房间</h3>
        <button class="btn btn-sm btn-primary" onclick="gcShowCreateRoom()">创建</button>
      </div>
      <div class="gc-rooms-list">${roomsHtml}</div>
    </div>
    <div class="gc-main">${mainHtml}</div>
  </div>`;
}

function gcSelectRoom(id){
  state.groupChat.activeRoom=id;
  save();
  renderPage();
  setTimeout(()=>{
    const el=$('#gcMessages');
    if(el) el.scrollTop=el.scrollHeight;
  },50);
}

// === Group chat room more menu ===
function gcToggleRoomMenu(id) {
  document.querySelectorAll('.gc-room-menu.show').forEach(m => m.classList.remove('show'));
  const menu = document.getElementById('gcRoomMenu_' + id);
  if (menu) {
    const btn = menu.parentElement.querySelector('.gc-room-more-btn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      menu.style.left = (rect.right - 130) + 'px';
      menu.style.top = (rect.bottom + 4) + 'px';
    }
    menu.classList.toggle('show');
  }
}

function gcRenameRoom(id) {
  const room = state.groupChat.rooms.find(r => r.id === id);
  if (!room) return;
  const name = prompt('编辑房间名称:', room.name || '');
  if (!name || name === room.name) return;
  room.name = name;
  save();
  renderPage();
}

function gcDeleteRoom(id) {
  if (!confirm('确认删除该房间？')) return;
  state.groupChat.rooms = state.groupChat.rooms.filter(r => r.id !== id);
  if (state.groupChat.activeRoom === id) state.groupChat.activeRoom = null;
  delete state.groupChat.messages[id];
  delete state.groupChat.members[id];
  delete state.groupChat.agents[id];
  delete state.groupChat.typing[id];
  delete state.groupChat.contextStatus[id];
  save();
  renderPage();
}

function gcShowCreateRoom(){
  const code=Math.random().toString(36).substring(2,8).toUpperCase();
  openModal(`
    <div style="padding:24px;min-width:360px">
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">创建群聊房间</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">你的昵称 *</label>
          <input id="gcNewNick" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(state.groupChat.userName)}" placeholder="输入昵称">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">自我描述</label>
          <input id="gcNewDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="一句话介绍自己">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">房间名称 *</label>
          <input id="gcNewRoomName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="例如：产品讨论">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">邀请码</label>
          <div style="display:flex;gap:8px">
            <input id="gcNewInvite" style="flex:1;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;font-family:var(--font-mono)" value="${code}">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('gcNewInvite').value=Math.random().toString(36).substring(2,8).toUpperCase()">刷新</button>
          </div>
        </div>
        <div style="border-top:1px solid var(--c-hairline);padding-top:12px;margin-top:4px">
          <div style="font-size:12px;color:var(--c-ink-muted);margin-bottom:8px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'flex':'none'">▶ 压缩设置</div>
          <div style="display:none;flex-direction:column;gap:8px">
            <div><label style="font-size:12px;color:var(--c-ink-muted)">触发阈值 (tokens)</label><input id="gcNewTrigger" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:13px" value="100000"></div>
            <div><label style="font-size:12px;color:var(--c-ink-muted)">最大历史 (tokens)</label><input id="gcNewMaxHist" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:13px" value="32000"></div>
            <div><label style="font-size:12px;color:var(--c-ink-muted)">保留最近消息数</label><input id="gcNewTail" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:13px" value="20"></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="gcCreateRoom()">创建</button>
        </div>
      </div>
    </div>
  `);
}

function gcCreateRoom(){
  const nick=$('#gcNewNick').value.trim();
  const desc=$('#gcNewDesc').value.trim();
  const name=$('#gcNewRoomName').value.trim();
  const invite=$('#gcNewInvite').value.trim();
  const trigger=parseInt($('#gcNewTrigger').value)||100000;
  const maxHist=parseInt($('#gcNewMaxHist').value)||32000;
  const tail=parseInt($('#gcNewTail').value)||20;
  if(!nick||!name){toast('请填写昵称和房间名称','error');return}
  const id='r_'+Date.now();
  const room={id,name,inviteCode:invite,triggerTokens:trigger,maxHistoryTokens:maxHist,tailMessageCount:tail,totalTokens:0};
  state.groupChat.userName=nick;
  state.groupChat.userDesc=desc;
  state.groupChat.rooms.push(room);
  state.groupChat.messages[id]=[];
  state.groupChat.agents[id]=[];
  state.groupChat.members[id]=[];
  state.groupChat.activeRoom=id;
  save();
  closeModal();
  renderPage();
  toast('房间已创建','info');
}

function gcShowAddAgent(){
  const room=state.groupChat.rooms.find(r=>r.id===state.groupChat.activeRoom);
  if(!room) return;
  const profiles=['claude-opus-4-7','gpt-4o','gemini-2.5-pro','deepseek-r1','llama-3.3-70b'];
  const existingProfiles=(state.groupChat.agents[room.id]||[]).map(a=>a.profile);
  const available=profiles.filter(p=>!existingProfiles.includes(p));
  openModal(`
    <div style="padding:24px;min-width:360px">
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">添加 Agent</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">选择 Profile *</label>
          <select id="gcAgentProfile" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px">
            ${available.map(p=>`<option value="${p}">${p}</option>`).join('')}
            ${available.length===0?'<option disabled>所有 Profile 已添加</option>':''}
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">Agent 名称 *</label>
          <input id="gcAgentName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="给 Agent 起个名字">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">描述</label>
          <input id="gcAgentDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="一句话描述 Agent 的能力">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="gcAddAgent()">添加</button>
        </div>
      </div>
    </div>
  `);
}

function gcAddAgent(){
  const profile=$('#gcAgentProfile').value;
  const name=$('#gcAgentName').value.trim();
  const desc=$('#gcAgentDesc').value.trim();
  if(!profile||!name){toast('请填写 Profile 和名称','error');return}
  const roomId=state.groupChat.activeRoom;
  const colors=['#e53935','#8e24aa','#1e88e5','#43a047','#fb8c00','#00acc1','#6d4c41','#546e7a'];
  const agent={
    id:'a_'+Date.now(),
    roomId,
    agentId:'agent_'+Date.now(),
    profile,
    name,
    description:desc||profile,
    color:colors[state.groupChat.agents[roomId].length%colors.length],
    invited:true,
  };
  state.groupChat.agents[roomId].push(agent);
  save();
  closeModal();
  renderPage();
  toast(`Agent "${name}" 已加入`,'info');
}

function gcRemoveAgent(agentId){
  const roomId=state.groupChat.activeRoom;
  const agents=state.groupChat.agents[roomId];
  const idx=agents.findIndex(a=>a.id===agentId);
  if(idx>=0){
    const name=agents[idx].name;
    agents.splice(idx,1);
    save();
    renderPage();
    toast(`Agent "${name}" 已移除`,'info');
  }
}

function gcShowSettings(){
  const room=state.groupChat.rooms.find(r=>r.id===state.groupChat.activeRoom);
  if(!room) return;
  const agents=state.groupChat.agents[room.id]||[];
  let agentsHtml=agents.map(a=>`
    <div class="gc-agent-card">
      <div class="gc-agent-avatar" style="background:${a.color}">${esc(a.name.charAt(0))}</div>
      <div class="gc-agent-info">
        <div class="gc-agent-name">${esc(a.name)}</div>
        <div class="gc-agent-desc">${esc(a.description)} · ${esc(a.profile)}</div>
      </div>
      <button class="gc-agent-remove" onclick="gcRemoveAgent('${a.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');

  openModal(`
    <div style="padding:24px;min-width:400px;max-height:80vh;overflow-y:auto">
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">房间设置</h3>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <div style="font-size:13px;font-weight:480;margin-bottom:8px">房间信息</div>
          <div style="font-size:13px;color:var(--c-ink-muted)">名称：${esc(room.name)}</div>
          <div style="font-size:13px;color:var(--c-ink-muted)">邀请码：<code style="font-family:var(--font-mono);background:var(--c-surface2);padding:2px 6px;border-radius:var(--r-sm)">${esc(room.inviteCode||'无')}</code></div>
        </div>
        <div>
          <div style="font-size:13px;font-weight:480;margin-bottom:8px">Agent 列表 (${agents.length})</div>
          ${agentsHtml||'<div style="font-size:13px;color:var(--c-ink-muted)">暂无 Agent</div>'}
        </div>
        <div>
          <div style="font-size:13px;font-weight:480;margin-bottom:8px">压缩配置</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div><label style="font-size:12px;color:var(--c-ink-muted)">触发阈值</label><input id="gcSetTrigger" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:13px" value="${room.triggerTokens||100000}"></div>
            <div><label style="font-size:12px;color:var(--c-ink-muted)">最大历史</label><input id="gcSetMaxHist" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:13px" value="${room.maxHistoryTokens||32000}"></div>
            <div><label style="font-size:12px;color:var(--c-ink-muted)">保留消息数</label><input id="gcSetTail" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:13px" value="${room.tailMessageCount||20}"></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px">
          <button class="btn btn-secondary" style="color:var(--c-error)" onclick="gcDeleteRoom()">删除房间</button>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="gcSaveSettings()">保存</button>
          </div>
        </div>
      </div>
    </div>
  `);
}

function gcSaveSettings(){
  const room=state.groupChat.rooms.find(r=>r.id===state.groupChat.activeRoom);
  if(!room) return;
  room.triggerTokens=parseInt($('#gcSetTrigger').value)||100000;
  room.maxHistoryTokens=parseInt($('#gcSetMaxHist').value)||32000;
  room.tailMessageCount=parseInt($('#gcSetTail').value)||20;
  save();
  closeModal();
  toast('设置已保存','info');
}

function gcDeleteRoom(){
  const id=state.groupChat.activeRoom;
  state.groupChat.rooms=state.groupChat.rooms.filter(r=>r.id!==id);
  delete state.groupChat.messages[id];
  delete state.groupChat.agents[id];
  delete state.groupChat.members[id];
  delete state.groupChat.typing[id];
  delete state.groupChat.contextStatus[id];
  if(state.groupChat.activeRoom===id) state.groupChat.activeRoom=null;
  save();
  closeModal();
  renderPage();
  toast('房间已删除','info');
}

function gcSendMessage(){
  const input=$('#gcInput');
  if(!input) return;
  const content=input.value.trim();
  if(!content) return;
  const roomId=state.groupChat.activeRoom;
  if(!roomId) return;
  if(!state.groupChat.messages[roomId]) state.groupChat.messages[roomId]=[];
  state.groupChat.messages[roomId].push({
    id:'m_'+Date.now(),
    roomId,
    senderId:'user',
    senderName:state.groupChat.userName||'我',
    senderType:'user',
    senderColor:'#333',
    content,
    timestamp:Date.now(),
  });
  const room=state.groupChat.rooms.find(r=>r.id===roomId);
  if(room) room.totalTokens=(room.totalTokens||0)+Math.ceil(content.length*1.5);
  save();
  input.value='';
  renderPage();
  setTimeout(()=>{
    const el=$('#gcMessages');
    if(el) el.scrollTop=el.scrollHeight;
  },50);
  gcProcessMentions(content,roomId);
}

function gcProcessMentions(content,roomId){
  const agents=state.groupChat.agents[roomId]||[];
  const mentionedAgents=agents.filter(a=>content.includes('@'+a.name));
  const agentsToReply=mentionedAgents.length>0?mentionedAgents:agents;
  if(agentsToReply.length===0) return;
  agentsToReply.forEach((agent,idx)=>{
    setTimeout(async()=>{
      state.groupChat.contextStatus[roomId]=state.groupChat.contextStatus[roomId]||{};
      state.groupChat.contextStatus[roomId][agent.name]='replying';
      renderPage();
      try{
        const history=(state.groupChat.messages[roomId]||[]).slice(-20).map(m=>({
          role:m.senderType==='user'?'user':'assistant',
          content:(m.senderType!=='user'?'['+m.senderName+'] ':'')+m.content,
        }));
        const systemPrompt=`你是群聊中的 Agent "${agent.name}"，使用模型 ${agent.profile}。${agent.description?'你的能力：'+agent.description:''}。请简洁回复，用中文。`;
        const messages=[{role:'system',content:systemPrompt},...history,{role:'user',content:'['+state.groupChat.userName+'] '+content}];
        const r=await fetch(apiBase()+'/api/chats/gc-stream',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({messages,model:agent.profile}),
        });
        if(!r.ok||!r.body){
          throw new Error('API返回错误: '+r.status);
        }
        const reader=r.body.getReader();
        const dec=new TextDecoder();
        let buf='';
        let fullText='';
        while(true){
          const{value,done}=await reader.read();
          if(done) break;
          buf+=dec.decode(value,{stream:true});
          const parts=buf.split('\n\n');
          buf=parts.pop();
          for(const part of parts){
            if(!part.trim()) continue;
            const dat=/^data:\s*(.+)/m.exec(part);
            if(!dat) continue;
            try{
              const d=JSON.parse(dat[1]);
              if(d.text) fullText+=d.text;
            }catch{}
          }
        }
        if(!fullText) fullText='（思考中...暂时无法回复）';
        if(!state.groupChat.messages[roomId]) state.groupChat.messages[roomId]=[];
        state.groupChat.messages[roomId].push({
          id:'m_'+Date.now(),
          roomId,
          senderId:agent.agentId,
          senderName:agent.name,
          senderType:'agent',
          senderColor:agent.color,
          content:fullText,
          timestamp:Date.now(),
        });
        const room=state.groupChat.rooms.find(r=>r.id===roomId);
        if(room) room.totalTokens=(room.totalTokens||0)+Math.ceil(fullText.length*1.5);
      }catch(e){
        if(!state.groupChat.messages[roomId]) state.groupChat.messages[roomId]=[];
        state.groupChat.messages[roomId].push({
          id:'m_'+Date.now(),
          roomId,
          senderId:agent.agentId,
          senderName:agent.name,
          senderType:'agent',
          senderColor:agent.color,
          content:'⚠️ 回复失败: '+e.message,
          timestamp:Date.now(),
        });
      }
      delete state.groupChat.contextStatus[roomId][agent.name];
      save();
      renderPage();
      setTimeout(()=>{
        const el=$('#gcMessages');
        if(el) el.scrollTop=el.scrollHeight;
      },50);
    },500+idx*800);
  });
}

function gcOnKeyDown(e){
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    gcSendMessage();
    return;
  }
  const menu=$('#gcMentionMenu');
  if(!menu||!menu.classList.contains('show')) return;
  const items=[...menu.querySelectorAll('.gc-mention-item')];
  const active=menu.querySelector('.gc-mention-item.active');
  const idx=items.indexOf(active);
  if(e.key==='ArrowDown'){
    e.preventDefault();
    if(active) active.classList.remove('active');
    items[(idx+1)%items.length].classList.add('active');
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    if(active) active.classList.remove('active');
    items[(idx-1+items.length)%items.length].classList.add('active');
  } else if(e.key==='Tab'||e.key==='Enter'){
    if(active){e.preventDefault();active.click()}
  } else if(e.key==='Escape'){
    menu.classList.remove('show');
  }
}

function gcOnInput(textarea){
  const val=textarea.value;
  const pos=textarea.selectionStart;
  const menu=$('#gcMentionMenu');
  if(!menu) return;
  const roomId=state.groupChat.activeRoom;
  const agents=state.groupChat.agents[roomId]||[];
  if(agents.length===0){menu.classList.remove('show');return}
  const before=val.substring(0,pos);
  const atIdx=before.lastIndexOf('@');
  if(atIdx<0){menu.classList.remove('show');return}
  const textAfterAt=before.substring(atIdx+1);
  if(textAfterAt.includes(' ')){menu.classList.remove('show');return}
  const isStart=atIdx===0||before[atIdx-1]===' '||before[atIdx-1]==='\n';
  if(!isStart){menu.classList.remove('show');return}
  const query=textAfterAt.toLowerCase();
  const matches=agents.filter(a=>a.name.toLowerCase().includes(query));
  if(matches.length===0){menu.classList.remove('show');return}
  menu.innerHTML=matches.map((a,i)=>`
    <div class="gc-mention-item${i===0?' active':''}" onclick="gcInsertMention('${esc(a.name)}')">
      <div class="gc-mention-avatar" style="background:${a.color}">${esc(a.name.charAt(0))}</div>
      <span>${esc(a.name)}</span>
      <span style="font-size:11px;color:var(--c-ink-muted);margin-left:auto">${esc(a.profile)}</span>
    </div>
  `).join('');
  menu.classList.add('show');
}

function gcInsertMention(name){
  const ta=$('#gcInput');
  if(!ta) return;
  const val=ta.value;
  const pos=ta.selectionStart;
  const before=val.substring(0,pos);
  const atIdx=before.lastIndexOf('@');
  const newVal=val.substring(0,atIdx)+'@'+name+' '+val.substring(pos);
  ta.value=newVal;
  ta.focus();
  const newPos=atIdx+name.length+2;
  ta.setSelectionRange(newPos,newPos);
  const menu=$('#gcMentionMenu');
  if(menu) menu.classList.remove('show');
}

function gcRenderContent(content,agents){
  let html=esc(content);
  agents.forEach(a=>{
    const escapedName=esc(a.name);
    html=html.replace(new RegExp('@'+escapedName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),`<span class="mention">@${escapedName}</span>`);
  });
  return html;
}

function gcFormatTime(ts){
  const d=new Date(ts);
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  if(d.toDateString()===now.toDateString()) return pad(d.getHours())+':'+pad(d.getMinutes());
  return (d.getMonth()+1)+'/'+d.getDate()+' '+pad(d.getHours())+':'+pad(d.getMinutes());
}

function gcToggleRooms(){
  const sidebar=$('#gcRoomsSidebar');
  if(sidebar) sidebar.classList.toggle('open');
}

function renderSearch(){
  return `<div class="search-view">
    <div class="page-header" style="cursor:pointer" onclick="this.nextElementSibling.classList.toggle('expanded')"><h2>搜索 <span style="font-size:12px;color:var(--c-ink-muted);margin-left:6px">▶</span></h2>
      <div class="search-wrap">${SVG.search}<input class="search-input" id="searchInput" placeholder="搜索对话、技能、设置…" oninput="doSearch(this.value)"></div>
    </div>
    <div class="search-content" id="searchResults">
      <div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>输入关键词开始搜索</span></div>
    </div>
  </div>`;
}

function doSearch(q){
  const el=$('#searchResults');
  if(!el) return;
  if(!q.trim()){el.innerHTML='<div class="empty-state"><span>输入关键词开始搜索</span></div>';return}
  const kw=q.toLowerCase();
  const chatResults=state.chats.filter(c=>c.title.toLowerCase().includes(kw)||c.messages.some(m=>m.content.toLowerCase().includes(kw)));
  const skillResults=state.skills.filter(s=>(s.name+s.desc+s.tags.join(',')).toLowerCase().includes(kw));
  el.innerHTML=`
    ${chatResults.length?`<div class="setting-group"><div class="setting-group-title">对话 (${chatResults.length})</div>
      ${chatResults.map(c=>`<div class="session-item" onclick="state.currentChat='${c.id}';navigate('chat')">
        <span class="s-title">${esc(c.title)}</span>
        <span class="s-preview">${c.messages.length} 条消息</span>
      </div>`).join('')}</div>`:''}
    ${skillResults.length?`<div class="setting-group"><div class="setting-group-title">技能 (${skillResults.length})</div>
      ${skillResults.map(s=>`<div class="session-item"><span class="s-title">${s.icon} ${esc(s.name)}</span><span class="s-preview">${esc(s.desc)}</span></div>`).join('')}</div>`:''}
    ${!chatResults.length&&!skillResults.length?'<div class="empty-state"><span>未找到结果</span></div>':''}
  `;
}

let _jobsCache=null;
function renderJobs(){
  if(!_jobsCache){
    _jobsCache=LS.get('hermes.jobs',[
      {id:'j1',name:'每日代码审查',schedule:'0 9 * * *',status:'active'},
      {id:'j2',name:'周报生成',schedule:'0 17 * * 5',status:'paused'},
      {id:'j3',name:'数据备份',schedule:'0 2 * * *',status:'active'},
    ]);
  }
  return `<div class="jobs-view">
    <div class="page-header"><h2>任务管理</h2>
      <button class="btn btn-sm btn-primary" onclick="addJob()">${SVG.plus} 新建任务</button>
    </div>
    <div style="padding:20px;overflow-y:auto;flex:1">
      ${_jobsCache.map(j=>`<div class="job-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div class="job-name">${esc(j.name)}</div><div class="job-schedule">${esc(j.schedule)}</div></div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="job-status ${j.status}" onclick="toggleJob('${j.id}')" style="cursor:pointer">${j.status==='active'?'运行中':'已暂停'}</span>
            <button class="btn btn-xs btn-ghost" style="color:var(--c-error)" onclick="deleteJob('${j.id}')">删除</button>
          </div>
        </div>
      </div>`).join('')}
      ${_jobsCache.length===0?'<div class="empty-state"><span>暂无任务</span></div>':''}
    </div>
  </div>`;
}
function addJob(){
  openModal(`<div style="padding:24px;min-width:380px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">新建任务</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">任务名称</label><input id="jobName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="例如：每日代码审查"></div>
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">Cron 表达式</label><input id="jobSchedule" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;font-family:var(--font-mono)" placeholder="0 9 * * *" value="0 9 * * *"></div>
      <div style="font-size:12px;color:var(--c-ink-muted)">常用：每天9点 <code>0 9 * * *</code> · 每周五17点 <code>0 17 * * 5</code> · 每小时 <code>0 * * * *</code></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="doAddJob()">创建</button>
      </div>
    </div>
  </div>`);
}
function doAddJob(){
  const name=$('#jobName')?.value?.trim();
  const schedule=$('#jobSchedule')?.value?.trim()||'0 9 * * *';
  if(!name){toast('请填写任务名称','error');return}
  _jobsCache.push({id:'j_'+Date.now(),name,schedule,status:'active'});
  LS.set('hermes.jobs',_jobsCache);
  closeModal();renderPage();toast('任务已创建','success');
}
function toggleJob(id){
  const j=_jobsCache.find(x=>x.id===id);
  if(j){j.status=j.status==='active'?'paused':'active';LS.set('hermes.jobs',_jobsCache);renderPage();toast(j.status==='active'?'任务已启动':'任务已暂停','info')}
}
function deleteJob(id){
  _jobsCache=_jobsCache.filter(x=>x.id!==id);
  LS.set('hermes.jobs',_jobsCache);
  renderPage();toast('任务已删除','info');
}

function renderSkills(){
  const f=state.skillFilter;
  let filtered=state.skills.slice();
  if(f.source) filtered=filtered.filter(s=>s.source===f.source);
  if(f.source==='modified') filtered=filtered.filter(s=>s.modified);
  if(f.search){
    const q=f.search.toLowerCase();
    filtered=filtered.filter(s=>s.name.toLowerCase().includes(q)||s.description.toLowerCase().includes(q));
  }
  const cats={};
  filtered.forEach(s=>{
    if(!cats[s.category]) cats[s.category]=[];
    cats[s.category].push(s);
  });
  const catNames=Object.keys(cats).sort();
  const sel=state.selectedSkill?state.skills.find(s=>s.id===state.selectedSkill):null;
  const collapsedCats=LS.get('hermes.skillCatsCollapsed',[]);

  let sidebarHtml=catNames.map(cat=>{
    const skills=cats[cat];
    const isCollapsed=collapsedCats.includes(cat);
    return `<div class="skill-cat-group">
      <div class="skill-cat-header${f.category===cat?' active':''}" onclick="skToggleCat('${esc(cat)}')">
        <span class="cat-arrow${isCollapsed?' collapsed':''}">▼</span>
        <span style="flex:1">${esc(cat)}</span>
        <span class="cat-count">${skills.length}</span>
      </div>
      <div class="skill-cat-items" style="max-height:${isCollapsed?'0':'1000px'}">
        ${skills.map(s=>`<div class="skill-item${state.selectedSkill===s.id?' active':''}" onclick="skSelect('${s.id}')">
          <span class="sk-source-dot ${s.source}"></span>
          <span class="sk-name">${esc(s.name)}</span>
          ${s.modified?'<span class="sk-modified">✎</span>':''}
          ${s.pinned?'<span class="sk-pinned">📌</span>':''}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  if(catNames.length===0) sidebarHtml='<div class="skill-empty" style="padding:40px 0"><span>没有匹配的技能</span></div>';

  let detailHtml='';
  if(sel){
    const sourceLabel={builtin:'内置',hub:'Hub',local:'本地'}[sel.source]||sel.source;
    let filesHtml=(sel.files||[]).map(f=>`<div class="skill-file-item" onclick="skViewFile('${sel.id}','${esc(f)}')">${SVG.file} ${esc(f)}</div>`).join('');
    detailHtml=`
      <div class="skill-detail-breadcrumb"><span onclick="skSelect(null)">技能中心</span> / <span onclick="skFilterCat('${esc(sel.category)}')">${esc(sel.category)}</span> / ${esc(sel.name)}</div>
      <div class="skill-detail-header">
        <div class="skill-detail-name">${esc(sel.name)}</div>
        <button class="fig-icon-btn" onclick="skTogglePin('${sel.id}')" title="${sel.pinned?'取消置顶':'置顶'}" style="${sel.pinned?'color:var(--c-accent)':''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${sel.pinned?'currentColor':'none'}" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </button>
      </div>
      <div class="skill-detail-desc">${esc(sel.description)}</div>
      <div class="skill-meta">
        <div class="skill-meta-item"><span class="sk-source-dot ${sel.source}" style="width:8px;height:8px"></span> ${sourceLabel}${sel.modified?' · 已修改':''}</div>
        ${sel.useCount>0?`<div class="skill-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> 使用 ${sel.useCount}</div>`:''}
        ${sel.viewCount>0?`<div class="skill-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> 浏览 ${sel.viewCount}</div>`:''}
        ${sel.patchCount>0?`<div class="skill-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 补丁 ${sel.patchCount}</div>`:''}
      </div>
      <div class="skill-detail-actions">
        <button class="btn ${sel.enabled?'btn-secondary':'btn-primary'} btn-sm" onclick="skToggle('${sel.id}')">${sel.enabled?'禁用':'启用'}</button>
        <button class="btn btn-secondary btn-sm" onclick="skEdit('${sel.id}')">编辑</button>
        <button class="btn btn-secondary btn-sm" onclick="skOpenFolder('${sel.id}')" title="打开文件夹">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          文件夹
        </button>
        ${sel.source!=='builtin'?`<button class="btn btn-secondary btn-sm" style="color:var(--c-error)" onclick="skDelete('${sel.id}')">删除</button>`:''}
      </div>
      <div class="skill-files">
        <h4>附件文件</h4>
        ${filesHtml||'<div style="font-size:13px;color:var(--c-ink-muted)">无附件</div>'}
      </div>
      <div id="skFileContent"></div>
      <div class="skill-md-preview" style="margin-top:16px">
        <h4>技能说明</h4>
        <div style="background:var(--c-canvas);border:1px solid var(--c-hairline);border-radius:var(--r-md);padding:16px;font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:300px;overflow-y:auto">${esc(sel.description)}</div>
      </div>`;
  } else {
    detailHtml=`<div class="skill-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>选择一个技能查看详情</span>
    </div>`;
  }

  return `<div class="skills-view">
    <div class="page-header"><h2>技能中心</h2>
      <button class="btn btn-sm btn-primary" onclick="skAdd()">${SVG.plus} 添加技能</button>
    </div>
    <div class="skills-layout">
      <div class="skills-sidebar">
        <div class="skill-search"><input placeholder="搜索技能…" value="${esc(f.search)}" oninput="skSearch(this.value)"></div>
        <div class="source-legend">
          <span class="legend-item${f.source==='builtin'?' active':''}" onclick="skFilterSource('builtin')"><span class="legend-dot dot-builtin"></span>内置</span>
          <span class="legend-item${f.source==='hub'?' active':''}" onclick="skFilterSource('hub')"><span class="legend-dot dot-hub"></span>Hub</span>
          <span class="legend-item${f.source==='local'?' active':''}" onclick="skFilterSource('local')"><span class="legend-dot dot-local"></span>本地</span>
          <span class="legend-item${f.source==='modified'?' active':''}" onclick="skFilterSource('modified')"><span class="legend-dot dot-modified"></span>已修改</span>
        </div>
        <div style="flex:1;overflow-y:auto;padding:4px">${sidebarHtml}</div>
      </div>
      <div class="skills-main">
        <div class="skill-detail">${detailHtml}</div>
      </div>
    </div>
  </div>`;
}

function skSelect(id){
  state.selectedSkill=id;
  if(id){
    const s=state.skills.find(x=>x.id===id);
    if(s) s.viewCount=(s.viewCount||0)+1;
  }
  save();renderPage();
}

function skToggle(id){
  const s=state.skills.find(x=>x.id===id);
  if(s){s.enabled=!s.enabled;save();renderPage();toast(s.enabled?'已启用':'已禁用','info')}
}

function skTogglePin(id){
  const s=state.skills.find(x=>x.id===id);
  if(s){s.pinned=!s.pinned;save();renderPage();toast(s.pinned?'已置顶':'已取消置顶','info')}
}

function skToggleCat(cat){
  const arr=LS.get('hermes.skillCatsCollapsed',[]);
  const idx=arr.indexOf(cat);
  if(idx>=0) arr.splice(idx,1); else arr.push(cat);
  LS.set('hermes.skillCatsCollapsed',arr);
  renderPage();
}

function skSearch(val){
  state.skillFilter.search=val;
  renderPage();
}

function skFilterSource(src){
  state.skillFilter.source=state.skillFilter.source===src?null:src;
  renderPage();
}

function skFilterCat(cat){
  state.skillFilter.category=state.skillFilter.category===cat?null:cat;
  renderPage();
}

function skViewFile(skillId,fileName){
  const el=$('#skFileContent');
  if(!el) return;
  const s=state.skills.find(x=>x.id===skillId);
  if(!s) return;
  const content=fileName==='SKILL.md'
    ?`# ${s.name}\n\n${s.description}\n\n## 使用方法\n\n该技能由 Hermes Agent 自动管理。启用后，Agent 将在相关场景中自动调用此技能。\n\n## 配置\n\n无需额外配置。`
    :`// ${fileName}\n// 此文件为技能 "${s.name}" 的附件\n// 实际内容由后端提供`;
  el.innerHTML=`<div style="margin-top:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <button class="btn btn-secondary btn-sm" onclick="document.getElementById('skFileContent').innerHTML=''">← 返回</button>
      <span style="font-size:13px;color:var(--c-ink-muted)">${esc(s.name)} / ${esc(fileName)}</span>
    </div>
    <div class="skill-content">${esc(content)}</div>
  </div>`;
}

function skAdd(){
  openModal(`
    <div style="padding:24px;min-width:420px">
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">添加技能</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">上传技能文件</label>
          <div style="border:2px dashed var(--c-hairline);border-radius:var(--r-lg);padding:24px;text-align:center;cursor:pointer;transition:all var(--transition-fast)" onclick="document.getElementById('skFileInput').click()" onmouseover="this.style.borderColor='var(--c-accent)'" onmouseout="this.style.borderColor='var(--c-hairline)'">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink-muted)" stroke-width="1.5" style="margin:0 auto 8px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div style="font-size:13px;color:var(--c-ink-muted)">点击上传 .md / .yaml / .json 技能文件</div>
            <div id="skFileName" style="font-size:12px;color:var(--c-accent);margin-top:4px"></div>
          </div>
          <input type="file" id="skFileInput" style="display:none" accept=".md,.yaml,.yml,.json" onchange="document.getElementById('skFileName').textContent=this.files[0]?.name||''">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">技能名称 *</label>
          <input id="skAddName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="例如：代码评审">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">描述（留空则AI自动生成）</label>
          <textarea id="skAddDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;min-height:60px;resize:vertical" placeholder="描述技能的功能和用途"></textarea>
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">分类</label>
          <input id="skAddCat" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="例如：开发" value="自定义">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="skDoAdd()">添加</button>
        </div>
      </div>
    </div>
  `);
}

async function skDoAdd(){
  const name=$('#skAddName').value.trim();
  let desc=$('#skAddDesc').value.trim();
  const cat=$('#skAddCat').value.trim()||'自定义';
  const fileInput=$('#skFileInput');
  const file=fileInput?.files?.[0];
  if(!name){toast('请填写技能名称','error');return}
  let fileContent='';
  if(file){
    fileContent=await new Promise(resolve=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>resolve('');
      reader.readAsText(file);
    });
  }
  if(!desc&&fileContent){
    const data=await apiPost('/api/skills/describe',{name,content:fileContent});
    if(data&&data.description) desc=data.description;
  }
  if(!desc){
    desc=name+'相关技能';
  }
  const fileName=file?file.name:'SKILL.md';
  const body={name,desc,tags:[cat],source:'custom',on:true,prompt:fileContent||''};
  if(fileContent) body.content=fileContent;
  const data=await apiPost('/api/skills/import',body);
  if(data){
    state.skills.push({...data,category:cat,description:desc,enabled:true,modified:false,pinned:false,useCount:0,viewCount:0,patchCount:0,files:[fileName],tags:[cat]});
  }else{
    state.skills.push({id:'sk_'+Date.now(),name,description:desc,category:cat,source:'local',enabled:true,modified:false,pinned:false,useCount:0,viewCount:0,patchCount:0,files:[fileName],tags:[cat]});
  }
  save();closeModal();renderPage();toast('技能已添加','success');
}

function skEdit(id){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  openModal(`
    <div style="padding:24px;min-width:380px">
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">编辑技能</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">技能名称</label>
          <input id="skEditName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(s.name)}">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">描述</label>
          <textarea id="skEditDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;min-height:60px;resize:vertical">${esc(s.description)}</textarea>
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">分类</label>
          <input id="skEditCat" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(s.category)}">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="skDoEdit('${s.id}')">保存</button>
        </div>
      </div>
    </div>
  `);
}

async function skDoEdit(id){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  s.name=$('#skEditName').value.trim()||s.name;
  s.description=$('#skEditDesc').value.trim()||s.description;
  s.category=$('#skEditCat').value.trim()||s.category;
  s.modified=true;
  await apiPut('/api/skills/'+id,{name:s.name,desc:s.description,tags:[s.category]});
  save();closeModal();renderPage();toast('技能已更新','info');
}

function skDelete(id){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  if(s.source==='builtin'){toast('内置技能不可删除','error');return}
  openModal(`
    <div style="padding:24px;min-width:320px">
      <h3 style="margin-bottom:12px;font-size:18px;font-weight:600">确认删除</h3>
      <p style="font-size:14px;color:var(--c-ink-muted);margin-bottom:20px">确定要删除技能 "${esc(s.name)}" 吗？此操作不可撤销。</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" style="background:var(--c-error)" onclick="skDoDelete('${id}')">删除</button>
      </div>
    </div>
  `);
}

async function skOpenFolder(id){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  toast('正在打开技能文件夹…','info');
  try{
    const r=await fetch(apiBase()+'/api/skills/'+encodeURIComponent(id)+'/open-folder',{method:'POST',headers:{'Accept':'application/json'}});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.code!==0) toast((j&&j.msg)||'打开失败','error');
  }catch(e){ toast('打开失败: '+e.message,'error');}
}

async function skDoDelete(id){
  await apiDel('/api/skills/'+id);
  state.skills=state.skills.filter(s=>s.id!==id);
  if(state.selectedSkill===id) state.selectedSkill=null;
  save();closeModal();renderPage();toast('技能已删除','info');
}

function renderMemory(){
  return `<div class="memory-view">
    <div class="page-header"><h2>记忆存储</h2></div>
    <div class="memory-content">
      <div class="memory-sections">
        <div class="memory-section">
          <div class="section-header"><div class="section-title-row"><span class="section-icon">${SVG.memory}</span><span class="section-title">核心记忆</span><button class="btn btn-xs btn-ghost" onclick="editMemory('core')" style="margin-left:auto">编辑</button></div></div>
          <div class="section-body"><pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:13px">${state.memories.core||'<span class="empty-text">暂无核心记忆</span>'}</pre></div>
        </div>
        <div class="memory-section">
          <div class="section-header"><div class="section-title-row"><span class="section-icon">${SVG.chat}</span><span class="section-title">上下文记忆</span><button class="btn btn-xs btn-ghost" onclick="editMemory('context')" style="margin-left:auto">编辑</button></div></div>
          <div class="section-body"><pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:13px">${state.memories.context||'<span class="empty-text">暂无上下文记忆</span>'}</pre></div>
        </div>
        <div class="memory-section">
          <div class="section-header"><div class="section-title-row"><span class="section-icon">${SVG.history}</span><span class="section-title">情景记忆</span><button class="btn btn-xs btn-ghost" onclick="addMemoryEpisode()" style="margin-left:auto">添加</button></div></div>
          <div class="section-body">
            ${state.memories.episodes&&state.memories.episodes.length?state.memories.episodes.map((e,i)=>`<div style="padding:8px 0;border-bottom:1px solid var(--c-hairline-soft);display:flex;justify-content:space-between;align-items:start"><div style="flex:1"><div style="font-size:13px">${esc(e.content)}</div><div style="font-size:11px;color:var(--c-ink-muted)">${new Date(e.ts).toLocaleString()}</div></div><button class="btn btn-xs btn-ghost" style="color:var(--c-error);flex-shrink:0" onclick="deleteMemoryEpisode(${i})">删除</button></div>`).join(''):'<span class="empty-text">暂无情景记忆</span>'}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function editMemory(field){
  const label=field==='core'?'核心记忆':'上下文记忆';
  const val=state.memories[field]||'';
  openModal(`<div style="padding:24px;min-width:420px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">编辑${label}</h3>
    <textarea id="memEditVal" style="width:100%;min-height:200px;padding:12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;font-family:var(--font-mono);resize:vertical">${esc(val)}</textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveMemoryField('${field}')">保存</button>
    </div>
  </div>`);
}
function saveMemoryField(field){
  state.memories[field]=$('#memEditVal')?.value||'';
  save();closeModal();renderPage();toast('记忆已保存','success');
}
function addMemoryEpisode(){
  openModal(`<div style="padding:24px;min-width:380px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">添加情景记忆</h3>
    <textarea id="memEpVal" style="width:100%;min-height:100px;padding:12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;resize:vertical" placeholder="输入要记住的内容…"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="doAddMemoryEpisode()">添加</button>
    </div>
  </div>`);
}
function doAddMemoryEpisode(){
  const content=$('#memEpVal')?.value?.trim();
  if(!content){toast('请输入内容','error');return}
  if(!state.memories.episodes) state.memories.episodes=[];
  state.memories.episodes.push({content,ts:Date.now()});
  save();closeModal();renderPage();toast('记忆已添加','success');
}
function deleteMemoryEpisode(idx){
  if(state.memories.episodes) state.memories.episodes.splice(idx,1);
  save();renderPage();toast('记忆已删除','info');
}

function renderModels(){
  const providers=[
    {name:'Anthropic',base:'https://api.anthropic.com',models:['claude-opus-4-7','claude-sonnet-4-5','claude-haiku-3-5']},
    {name:'OpenAI',base:'https://api.openai.com',models:['gpt-4o','gpt-4o-mini','o3','o4-mini']},
    {name:'Google',base:'https://generativelanguage.googleapis.com',models:['gemini-2.5-pro','gemini-2.5-flash']},
    {name:'DeepSeek',base:'https://api.deepseek.com',models:['deepseek-r1','deepseek-v3']},
    {name:'Meta',base:'https://api.together.xyz',models:['llama-4-maverick','llama-4-scout']},
  ];
  const currentProvider=state.model.provider||'openai';
  const providerObj=providers.find(p=>p.name.toLowerCase()===currentProvider);
  const providerModels=providerObj?providerObj.models:[];
  return `<div class="models-view">
    <div class="page-header"><h2>模型配置</h2></div>
    <div class="models-content" style="padding:24px;max-width:800px">
      <div class="card" style="margin-bottom:24px">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">当前配置</h3>
        <div style="display:grid;gap:12px">
          <div style="display:flex;gap:12px">
            <div style="flex:1"><label style="font-size:12px;color:var(--c-ink-muted)">Provider</label><input id="mProvider" list="providerList" value="${esc(state.model.provider||'openai')}" style="width:100%;margin-top:4px" oninput="onProviderInput()">
            <datalist id="providerList">${providers.map(p=>`<option value="${p.name.toLowerCase()}">`).join('')}</datalist></div>
            <div style="flex:1;display:flex;gap:6px;align-items:flex-end"><div style="flex:1"><label style="font-size:12px;color:var(--c-ink-muted)">模型</label><input id="mModel" list="modelList" value="${esc(state.model.model)}" style="width:100%;margin-top:4px">
            <datalist id="modelList">${providerModels.map(m=>`<option value="${m}">`).join('')}</datalist></div>
            <button class="btn btn-secondary btn-sm" onclick="fetchModelsForCurrent()" title="获取模型" style="height:38px;flex-shrink:0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12a9 9 0 11-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
              获取
            </button></div>
          </div>
          <div><label style="font-size:12px;color:var(--c-ink-muted)">Base URL</label><input id="mBase" value="${esc(state.model.base)}" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:12px;color:var(--c-ink-muted)">API Key</label><input id="mKey" type="password" value="${esc(state.model.key)}" style="width:100%;margin-top:4px"></div>
          <div style="display:flex;gap:12px">
            <div style="flex:1"><label style="font-size:12px;color:var(--c-ink-muted)">Temperature <span id="tVal">${state.model.temperature}</span></label><input id="mTemp" type="range" min="0" max="2" step="0.1" value="${state.model.temperature}" style="width:100%;margin-top:4px" oninput="document.getElementById('tVal').textContent=this.value"></div>
            <div style="flex:1"><label style="font-size:12px;color:var(--c-ink-muted)">Top P <span id="pVal">${state.model.topP}</span></label><input id="mTopP" type="range" min="0" max="1" step="0.1" value="${state.model.topP}" style="width:100%;margin-top:4px" oninput="document.getElementById('pVal').textContent=this.value"></div>
            <div style="flex:1"><label style="font-size:12px;color:var(--c-ink-muted)">Max Tokens</label><input id="mMax" type="number" value="${state.model.maxTokens}" style="width:100%;margin-top:4px"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary btn-sm" onclick="testModel()">测试连接</button><button class="btn btn-primary btn-sm" onclick="saveModel()">保存</button></div>
          <div id="modelMsg" style="font-size:12px;color:var(--c-ink-muted)"></div>
        </div>
      </div>
      <div class="card" style="margin-bottom:24px">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">获取模型</h3>
        <div style="display:grid;gap:12px">
          <div><label style="font-size:12px;color:var(--c-ink-muted)">API URL</label><input id="fetchUrl" placeholder="https://api.openai.com/v1/models" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:12px;color:var(--c-ink-muted)">API Key</label><input id="fetchKey" type="password" placeholder="sk-..." style="width:100%;margin-top:4px"></div>
          <div style="display:flex;gap:8px;align-items:center"><button class="btn btn-accent btn-sm" onclick="fetchModels()">获取模型</button><span id="fetchMsg" style="font-size:12px;color:var(--c-ink-muted)"></span></div>
          <div id="fetchResult" style="display:none">
            <div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn btn-xs btn-secondary" onclick="selectAllFetchModels()">全选</button><button class="btn btn-xs btn-secondary" onclick="deselectAllFetchModels()">取消全选</button><button class="btn btn-xs btn-primary" onclick="enableSelectedModels()">启用选中</button></div>
            <div id="fetchModelList" style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:2px"></div>
          </div>
        </div>
      </div>
      <div class="provider-grid">
        ${providers.map(p=>`<div class="provider-card">
          <div class="provider-header"><span class="provider-name">${p.name}</span></div>
          <div class="provider-base">${p.base}</div>
          <div class="provider-models">${p.models.map(m=>`<span class="model-tag">${m}</span>`).join('')}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function onProviderInput(){
  const providers=[
    {name:'anthropic',base:'https://api.anthropic.com',models:['claude-opus-4-7','claude-sonnet-4-5','claude-haiku-3-5']},
    {name:'openai',base:'https://api.openai.com',models:['gpt-4o','gpt-4o-mini','o3','o4-mini']},
    {name:'google',base:'https://generativelanguage.googleapis.com',models:['gemini-2.5-pro','gemini-2.5-flash']},
    {name:'deepseek',base:'https://api.deepseek.com',models:['deepseek-r1','deepseek-v3']},
    {name:'meta',base:'https://api.together.xyz',models:['llama-4-maverick','llama-4-scout']},
  ];
  const val=$('#mProvider').value.trim().toLowerCase();
  const p=providers.find(x=>x.name===val);
  const base=$('#mBase');
  const ml=$('#modelList');
  if(p&&base) base.value=p.base;
  if(p&&ml) ml.innerHTML=p.models.map(m=>`<option value="${m}">`).join('');
}

async function fetchModelsForCurrent(){
  const base=$('#mBase')?.value.trim();
  const key=$('#mKey')?.value;
  if(!base){toast('请先填写 Base URL','error');return}
  const msg=$('#modelMsg');
  if(msg) msg.textContent='获取中…';
  try{
    const data=await apiPost('/api/models/fetch-remote',{url:base+'/v1/models',key});
    if(data&&data.models&&data.models.length>0){
      const ml=$('#modelList');
      if(ml) ml.innerHTML=data.models.map(m=>`<option value="${typeof m==='string'?m:m.id||''}">`).join('');
      if(msg){msg.textContent='找到 '+data.models.length+' 个模型';msg.style.color='var(--c-success)'}
    } else {
      if(msg){msg.textContent='未找到模型';msg.style.color='var(--c-ink-muted)'}
    }
  }catch(e){
    if(msg){msg.textContent='获取失败: '+e.message;msg.style.color='var(--c-error)'}
  }
}

function saveModel(){
  state.model={provider:$('#mProvider').value.toLowerCase(),model:$('#mModel').value.trim(),base:$('#mBase').value.trim(),key:$('#mKey').value,temperature:parseFloat($('#mTemp').value),topP:parseFloat($('#mTopP').value),maxTokens:parseInt($('#mMax').value)||4096};
  save();
  // Persist to backend API
  const body = {};
  body[state.model.provider] = { base: state.model.base, key: state.model.key, model: state.model.model };
  body.current = state.model.model;
  body.params = { temperature: state.model.temperature, maxTokens: state.model.maxTokens, topP: state.model.topP };
  apiPut('/api/models', body);
  toast('模型配置已保存','success');
}

async function testModel(){
  const msg=$('#modelMsg');if(!msg) return;
  msg.textContent='测试中…';msg.style.color='var(--c-ink-muted)';
  try{
    const r=await fetch(apiBase()+'/api/models/test',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({provider:{base:$('#mBase').value.trim(),model:$('#mModel').value.trim(),key:$('#mKey').value}}),
    });
    const j=await r.json();
    if(j.ok){msg.textContent='✓ 连接成功 ('+j.model+')';msg.style.color='var(--c-success)';toast('连接成功','success')}
    else{msg.textContent='✗ 连接失败: '+(j.error||'未知错误');msg.style.color='var(--c-error)';toast('连接失败','error')}
  }catch(e){
    msg.textContent='✗ 连接失败: '+e.message;msg.style.color='var(--c-error)';toast('连接失败','error');
  }
}

async function fetchModels(){
  const msg=$('#fetchMsg');const result=$('#fetchResult');const list=$('#fetchModelList');
  if(!msg||!result||!list) return;
  const url=$('#fetchUrl').value.trim();
  const key=$('#fetchKey').value;
  if(!url){msg.textContent='请输入 API URL';return}
  msg.textContent='获取中…';
  try{
    const data=await apiPost('/api/models/fetch-remote',{url,key});
    if(!data||!data.models||data.models.length===0){msg.textContent='未找到模型';return}
    msg.textContent='找到 '+data.models.length+' 个模型';
    result.style.display='block';
    list.innerHTML=data.models.map((m,i)=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-sm);cursor:pointer;font-size:13px;transition:background var(--transition-fast)" onmouseover="this.style.background='var(--c-accent-soft)'" onmouseout="this.style.background='transparent'"><input type="checkbox" class="fetch-model-cb" value="${esc(typeof m==='string'?m:m.id||'')}" data-name="${esc(typeof m==='string'?m:m.id||'')}">${esc(typeof m==='string'?m:JSON.stringify(m))}</label>`).join('');
  }catch(e){
    msg.textContent='获取失败: '+e.message;
  }
}

function selectAllFetchModels(){document.querySelectorAll('.fetch-model-cb').forEach(c=>c.checked=true)}
function deselectAllFetchModels(){document.querySelectorAll('.fetch-model-cb').forEach(c=>c.checked=false)}
function enableSelectedModels(){
  const selected=[...document.querySelectorAll('.fetch-model-cb:checked')].map(c=>c.value);
  if(selected.length>0){
    const ml=$('#modelList');
    if(ml) ml.innerHTML=selected.map(m=>`<option value="${m}">`).join('');
    const mInput=$('#mModel');
    if(mInput&&!mInput.value) mInput.value=selected[0];
    toast('已加载 '+selected.length+' 个模型到候选列表','success');
  }
  else toast('请先选择模型','info');
}

let _usageCache=null;
let _usageFetchStarted=false;
function renderUsage(){
  if(!_usageFetchStarted){
    _usageFetchStarted=true;
    apiGet('/api/usage').then(data=>{
      _usageCache=data||{};
      const el=$('#usageContent');
      if(el) el.innerHTML=buildUsageHtml(_usageCache);
    });
  }
  return `<div class="usage-view">
    <div class="page-header"><h2>用量统计</h2></div>
    <div class="usage-content" id="usageContent">${buildUsageHtml(_usageCache)}</div>
  </div>`;
}
function buildUsageHtml(data){
  data=data||{};
  const totalTokens=data.totalTokens||0;
  const todayTokens=data.todayTokens||0;
  const totalMessages=data.totalMessages||0;
  const todayMessages=data.todayMessages||0;
  const totalSessions=data.totalSessions||0;
  const models=data.models||{};
  const modelEntries=Object.entries(models);
  const totalTokensStr=totalTokens>1000000?(totalTokens/1000000).toFixed(1)+'M':totalTokens>1000?(totalTokens/1000).toFixed(1)+'K':''+totalTokens;
  const estCost=(totalTokens*0.000003).toFixed(2);
  const activeSkills=state.skills.filter(s=>s.on||s.enabled).length;
  let modelBreakdownHtml='';
  if(modelEntries.length>0){
    const maxTokens=Math.max(...modelEntries.map(([,m])=>m.tokens||0),1);
    const colors=['var(--c-block-lime)','var(--c-block-lilac)','var(--c-block-cream)','var(--c-block-mint)','#e57373','#64b5f6'];
    modelBreakdownHtml=`<div class="chart-container"><div class="chart-title">模型用量分布</div><div class="breakdown-list">
      ${modelEntries.map(([name,m],i)=>{
        const pct=maxTokens>0?Math.round((m.tokens/maxTokens)*100):0;
        return `<div class="breakdown-item"><span class="breakdown-name">${esc(name)}</span><div class="breakdown-bar-wrap"><div class="breakdown-bar-fill" style="width:${pct}%;background:${colors[i%colors.length]}"></div></div><span class="breakdown-value">${(m.tokens||0).toLocaleString()} tokens</span></div>`;
      }).join('')}
    </div></div>`;
  }
  return `<div class="stat-cards">
    <div class="stat-card color-block color-block-lime"><div class="stat-value">${totalMessages}</div><div class="stat-label">总消息数</div></div>
    <div class="stat-card color-block color-block-lilac"><div class="stat-value">${totalTokensStr}</div><div class="stat-label">Token 用量</div></div>
    <div class="stat-card color-block color-block-cream"><div class="stat-value">$${estCost}</div><div class="stat-label">预估费用</div></div>
    <div class="stat-card color-block color-block-mint"><div class="stat-value">${activeSkills}</div><div class="stat-label">活跃技能</div></div>
  </div>
  <div class="chart-container">
    <div class="chart-title">今日统计</div>
    <div style="display:flex;gap:24px;padding:16px 0">
      <div><span style="font-size:24px;font-weight:600">${todayMessages}</span><div style="font-size:12px;color:var(--c-ink-muted)">今日消息</div></div>
      <div><span style="font-size:24px;font-weight:600">${todayTokens>1000?(todayTokens/1000).toFixed(1)+'K':todayTokens}</span><div style="font-size:12px;color:var(--c-ink-muted)">今日 Token</div></div>
      <div><span style="font-size:24px;font-weight:600">${totalSessions}</span><div style="font-size:12px;color:var(--c-ink-muted)">总会话数</div></div>
    </div>
  </div>
  ${modelBreakdownHtml}`;
}

let _channelsCache=null;
function renderChannels(){
  if(!_channelsCache){
    apiGet('/api/gateway').then(data=>{
      _channelsCache=data||{enabled:true,platforms:[]};
      const el=$('#channelsContent');
      if(el) el.innerHTML=buildChannelsHtml(_channelsCache);
    });
    _channelsCache={enabled:true,platforms:[]};
  }
  return `<div class="channels-view">
    <div class="page-header"><h2>频道</h2></div>
    <div class="channels-content" id="channelsContent">${buildChannelsHtml(_channelsCache)}</div>
  </div>`;
}
function buildChannelsHtml(data){
  const platforms=data.platforms||[];
  if(!platforms.length) return '<div class="empty-state"><span>暂无频道配置</span></div>';
  const icons={telegram:'✈️',discord:'🎮',slack:'💬',dingtalk:'🔔',feishu:'🐦',wechat:'💬'};
  return `<div class="platform-grid">
    ${platforms.map(p=>`<div class="platform-card" style="cursor:pointer" onclick="editGateway('${esc(p.id)}');navigate('settingsPage');settingsTab='gateways'">
      <div class="platform-header"><span class="platform-icon">${icons[p.id]||'📡'}</span><div><div class="platform-name">${esc(p.name)}</div><span class="platform-status ${p.configured&&p.enabled?'connected':'disconnected'}">${p.configured&&p.enabled?'已连接':'未连接'}</span></div></div>
      <div style="font-size:13px;color:var(--c-ink-muted)">${esc(p.desc||'')}</div>
    </div>`).join('')}
  </div>`;
}

function renderSettings(){
  return `<div class="settings-view">
    <div class="page-header"><h2>设置</h2></div>
    <div class="settings-content">
      <div class="settings-section">
        <div class="settings-section-title">通用</div>
        <div class="settings-item"><div><div class="settings-label">语言</div><div class="settings-desc">界面显示语言</div></div>
          <select id="sLang" style="width:120px"><option value="zh"${state.settings.lang==='zh'?' selected':''}>中文</option><option value="en"${state.settings.lang==='en'?' selected':''}>English</option></select>
        </div>
        <div class="settings-item"><div><div class="settings-label">流式输出</div><div class="settings-desc">实时显示 AI 回复</div></div>
          <label class="toggle"><input type="checkbox" id="sStream" ${state.settings.stream?'checked':''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item"><div><div class="settings-label">快速模式</div><div class="settings-desc">跳过 Hermes Agent，直接调用大模型 API（更快但不支持工具调用）</div></div>
          <label class="toggle"><input type="checkbox" id="sQuick" ${state.settings.quickMode?'checked':''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item"><div><div class="settings-label">历史记录保留</div><div class="settings-desc">保留的对话轮数</div></div>
          <input id="sHistory" type="number" value="${state.settings.history}" style="width:80px">
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">API 配置</div>
        <div class="settings-item"><div><div class="settings-label">Hermes API 地址</div><div class="settings-desc">后端服务地址</div></div>
          <input id="sApi" value="${esc(state.settings.api)}" style="width:280px">
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">风格设置</div>
        <div class="settings-item"><div><div class="settings-label">界面风格</div><div class="settings-desc">选择界面显示风格</div></div>
          <select id="sStyle" style="width:160px"><option value="minimal"${(state.settings.style||'minimal')==='minimal'?' selected':''}>简约默认风格</option></select>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">系统提示词</div>
        <textarea id="sSys" style="width:100%;min-height:100px;margin-top:8px">${esc(state.settings.systemPrompt)}</textarea>
        <p style="font-size:12px;color:var(--c-ink-muted);margin-top:8px;line-height:1.5">Artifact 面板：模型可使用 <code>&lt;redacted_thinking&gt;</code>（思考草稿，默认折叠）与 <code>&lt;artifact type="markdown|code|html|mermaid" title="文件名"&gt;</code> 包裹长内容；同 title 重复出现会生成新版本。</p>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-primary" onclick="saveSettings()">保存设置</button>
        <button class="btn btn-secondary" onclick="pingApi()">测试连接</button>
      </div>
      <div id="settingsMsg" style="font-size:12px;color:var(--c-ink-muted);margin-top:8px"></div>
    </div>
  </div>`;
}

function saveSettings(){
  state.settings={lang:$('#sLang').value,stream:$('#sStream').checked,quickMode:$('#sQuick').checked,history:parseInt($('#sHistory').value)||20,systemPrompt:$('#sSys').value,api:$('#sApi').value.trim(),style:$('#sStyle')?.value||'minimal'};
  save();
  apiPut('/api/settings', {
    lang: state.settings.lang,
    stream: state.settings.stream,
    quickMode: state.settings.quickMode,
    history: state.settings.history,
    systemPrompt: state.settings.systemPrompt,
    style: state.settings.style,
    api: state.settings.api || '',
  });
  toast('设置已保存','success');pingApi();
}

async function pingApi(){
  const dot=$('#statusDot');
  const st=$('#statusText');
  if(!dot) return;
  const url = (apiBase() || window.location.origin) + '/api/health';
  try{
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),3000);
    const r=await fetch(url,{signal:ctrl.signal});
    if(r.ok){
      dot.classList.remove('offline');dot.classList.add('online');
      if(st) st.textContent='已连接';
      state.connected=true;return
    }
    throw 0;
  }catch(_){
    dot.classList.remove('online');dot.classList.add('offline');
    if(st) st.textContent='未连接';
    state.connected=false
  }
}

function resetAll(){
  if(!confirm('确认重置所有本地数据？')) return;
  ['hermes.settings','hermes.model','hermes.skills','hermes.chats','hermes.memories','hermes.gateways','hermes.theme'].forEach(k=>localStorage.removeItem(k));
  location.reload();
}

let _profilesCache=null;
function renderProfiles(){
  if(!_profilesCache){
    _profilesCache=LS.get('hermes.profiles',[
      {id:'default',name:'默认助手',model:state.model.model||'deepseek-v4-flash',systemPrompt:'',color:'var(--c-block-lime)'},
      {id:'coder',name:'代码专家',model:'deepseek-r1',systemPrompt:'你是一位资深代码专家，擅长代码审查、重构和架构设计。',color:'var(--c-block-lilac)'},
      {id:'writer',name:'写作助手',model:'gpt-4o',systemPrompt:'你是一位专业的写作助手，擅长各类文案和内容创作。',color:'var(--c-block-cream)'},
    ]);
  }
  return `<div class="profiles-view">
    <div class="page-header"><h2>角色配置</h2>
      <button class="btn btn-sm btn-primary" onclick="addProfile()">${SVG.plus} 新建</button>
    </div>
    <div class="profiles-content">
      <div class="profile-grid">
        ${_profilesCache.map(p=>`<div class="profile-card" onclick="editProfile('${p.id}')">
          <div class="profile-avatar" style="background:${p.color}">${esc(p.name.charAt(0))}</div>
          <div class="profile-name">${esc(p.name)}</div>
          <div class="profile-model">${esc(p.model)}</div>
          <div style="display:flex;gap:4px;margin-top:8px">
            <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();useProfile('${p.id}')">使用</button>
            ${p.id!=='default'?`<button class="btn btn-xs btn-ghost" style="color:var(--c-error)" onclick="event.stopPropagation();deleteProfile('${p.id}')">删除</button>`:''}
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}
function addProfile(){
  const colors=['var(--c-block-lime)','var(--c-block-lilac)','var(--c-block-cream)','var(--c-block-mint)','#e57373','#64b5f6','#ffb74d','#81c784'];
  openModal(`<div style="padding:24px;min-width:400px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">新建角色</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">角色名称</label><input id="pfName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="例如：代码专家"></div>
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">使用模型</label><input id="pfModel" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(state.model.model)}"></div>
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">系统提示词</label><textarea id="pfPrompt" style="width:100%;min-height:80px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;resize:vertical" placeholder="描述角色的能力和行为…"></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="doAddProfile()">创建</button>
      </div>
    </div>
  </div>`);
}
function doAddProfile(){
  const name=$('#pfName')?.value?.trim();
  const model=$('#pfModel')?.value?.trim()||state.model.model;
  const systemPrompt=$('#pfPrompt')?.value?.trim()||'';
  if(!name){toast('请填写角色名称','error');return}
  const colors=['var(--c-block-lime)','var(--c-block-lilac)','var(--c-block-cream)','var(--c-block-mint)','#e57373','#64b5f6'];
  _profilesCache.push({id:'pf_'+Date.now(),name,model,systemPrompt,color:colors[_profilesCache.length%colors.length]});
  LS.set('hermes.profiles',_profilesCache);
  closeModal();renderPage();toast('角色已创建','success');
}
function editProfile(id){
  const p=_profilesCache.find(x=>x.id===id);
  if(!p) return;
  openModal(`<div style="padding:24px;min-width:400px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">编辑角色</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">角色名称</label><input id="pfName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(p.name)}"></div>
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">使用模型</label><input id="pfModel" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(p.model)}"></div>
      <div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">系统提示词</label><textarea id="pfPrompt" style="width:100%;min-height:80px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px;resize:vertical">${esc(p.systemPrompt||'')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="doEditProfile('${id}')">保存</button>
      </div>
    </div>
  </div>`);
}
function doEditProfile(id){
  const p=_profilesCache.find(x=>x.id===id);
  if(!p) return;
  p.name=$('#pfName')?.value?.trim()||p.name;
  p.model=$('#pfModel')?.value?.trim()||p.model;
  p.systemPrompt=$('#pfPrompt')?.value?.trim()||'';
  LS.set('hermes.profiles',_profilesCache);
  closeModal();renderPage();toast('角色已更新','success');
}
function useProfile(id){
  const p=_profilesCache.find(x=>x.id===id);
  if(!p) return;
  state.model.model=p.model;
  if(p.systemPrompt) state.settings.systemPrompt=p.systemPrompt;
  save();toast('已切换到角色: '+p.name,'success');
}
function deleteProfile(id){
  _profilesCache=_profilesCache.filter(x=>x.id!==id);
  LS.set('hermes.profiles',_profilesCache);
  renderPage();toast('角色已删除','info');
}

let _gatewaysCache=null;
function renderGateways(){
  if(!_gatewaysCache){
    apiGet('/api/gateway').then(data=>{
      _gatewaysCache=data||{enabled:true,platforms:[]};
      const el=$('#gatewaysContent');
      if(el) el.innerHTML=buildGatewaysHtml(_gatewaysCache);
    });
    _gatewaysCache={enabled:true,platforms:[]};
  }
  return `<div class="gateways-view">
    <div class="page-header"><h2>网关</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <label class="toggle" style="margin-right:8px"><input type="checkbox" id="gwEnabled" ${_gatewaysCache.enabled?'checked':''} onchange="toggleGatewayEnabled()"><span class="toggle-slider"></span></label>
        <span style="font-size:13px;color:var(--c-ink-muted)">${_gatewaysCache.enabled?'已启用':'已禁用'}</span>
      </div>
    </div>
    <div class="gateways-content" id="gatewaysContent">${buildGatewaysHtml(_gatewaysCache)}</div>
  </div>`;
}
function buildGatewaysHtml(data){
  const platforms=data.platforms||[];
  if(!platforms.length) return '<div class="empty-state"><span>暂无网关配置</span></div>';
  return `<div class="gateway-grid">${platforms.map(p=>`<div class="gateway-card" style="cursor:pointer" onclick="editGateway('${esc(p.id)}')">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:600">${esc(p.icon||'')} ${esc(p.name)}</div>
      <span style="font-size:11px;padding:2px 8px;border-radius:var(--r-pill);background:${p.configured?'var(--c-success)':'var(--c-hairline)'};color:${p.configured?'#fff':'var(--c-ink-muted)'}">${p.configured?'已配置':'未配置'}</span>
    </div>
    <div style="font-size:12px;color:var(--c-ink-muted);margin-top:4px">${esc(p.desc||'')}</div>
    <div style="font-size:12px;color:var(--c-ink-muted);margin-top:2px">${p.enabled?'✓ 已启用':'✗ 已禁用'}</div>
  </div>`).join('')}</div>`;
}
function toggleGatewayEnabled(){
  const enabled=$('#gwEnabled')?.checked;
  if(_gatewaysCache){_gatewaysCache.enabled=enabled;apiPut('/api/gateway',{enabled})}
}
function editGateway(id){
  const p=(_gatewaysCache?.platforms||[]).find(x=>x.id===id);
  if(!p) return;
  const fields=(p.fields||[]).map(f=>`<div><label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">${esc(f)}</label><input id="gw_${esc(f)}" value="${esc(p.config?.[f]||'')}" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px"></div>`).join('');
  openModal(`<div style="padding:24px;min-width:400px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">${esc(p.icon||'')} ${esc(p.name)}</h3>
    <p style="font-size:13px;color:var(--c-ink-muted);margin-bottom:16px">${esc(p.desc||'')}</p>
    <div style="display:flex;flex-direction:column;gap:12px">${fields||'<div style="font-size:13px;color:var(--c-ink-muted)">无需额外配置</div>'}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
      <label class="toggle"><input type="checkbox" id="gwEnabled_${esc(id)}" ${p.enabled?'checked':''}><span class="toggle-slider"></span></label>
      <div style="display:flex;gap:8px"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveGateway('${esc(id)}')">保存</button></div>
    </div>
  </div>`);
}
function saveGateway(id){
  const p=(_gatewaysCache?.platforms||[]).find(x=>x.id===id);
  if(!p) return;
  const config={};
  (p.fields||[]).forEach(f=>{const v=$('#gw_'+f)?.value;if(v) config[f]=v});
  p.config=config;
  p.configured=Object.values(config).some(Boolean);
  p.enabled=$('#gwEnabled_'+id)?.checked??p.enabled;
  apiPut('/api/gateway',_gatewaysCache);
  closeModal();renderPage();toast('网关配置已保存','success');
}

let _logsCache=null;
function renderLogs(){
  if(!_logsCache){
    apiGet('/api/system/logs?limit=200').then(data=>{
      if(data&&data.length) _logsCache=data;
      else _logsCache=[];
      const el=$('#logsContainer');
      if(el) el.innerHTML=buildLogsHtml(_logsCache);
    });
    _logsCache=[];
  }
  return `<div class="logs-view">
    <div class="page-header"><h2>日志</h2>
      <div class="header-actions"><button class="btn btn-xs btn-ghost" onclick="_logsCache=null;renderPage()">刷新</button></div>
    </div>
    <div class="log-container" id="logsContainer">${buildLogsHtml(_logsCache)}</div>
  </div>`;
}
function buildLogsHtml(logs){
  if(!logs||!logs.length) return '<div class="empty-state"><span>暂无日志记录</span></div>';
  return logs.map(l=>{
    const ts=l.ts?new Date(l.ts).toLocaleTimeString('zh-CN'):'--:--:--';
    const level=l.level||'info';
    const msg=esc(l.msg||'');
    return `<div class="log-line log-${level}"><span class="log-ts">${ts}</span><span class="log-level">${level}</span><span class="log-msg">${msg}</span></div>`;
  }).join('');
}

let _filesCache=null;
let _filesPath='';
let _fileContentView=null;
function renderFiles(){
  if(!_filesCache){
    _filesPath='';
    apiGet('/api/system/files').then(data=>{
      if(data){_filesCache=data.items||[];_filesPath=data.path||''}
      else _filesCache=[];
      const el=$('#filesTree');
      if(el) el.innerHTML=buildFilesHtml(_filesCache);
    });
    _filesCache=[];
  }
  return `<div class="files-view">
    <div class="page-header"><h2>文件</h2>
      <button class="btn btn-sm btn-secondary" onclick="_filesCache=null;renderPage()">${SVG.upload} 刷新</button>
    </div>
    <div class="files-content"><div class="files-layout">
      <div class="files-tree" id="filesTree">
        <div style="font-size:12px;color:var(--c-ink-muted);padding:4px 12px;margin-bottom:4px">${esc(_filesPath||'加载中…')}</div>
        ${buildFilesHtml(_filesCache)}
      </div>
      <div class="files-main" id="filesMain">
        ${_fileContentView||'<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>选择文件查看内容</span></div>'}
      </div>
    </div></div>
  </div>`;
}
function buildFilesHtml(items){
  if(!items||!items.length) return '<div style="font-size:13px;color:var(--c-ink-muted);padding:8px 12px">空目录</div>';
  return items.map(f=>`
    <div class="file-item${f.type==='folder'?' folder':''}" style="padding-left:12px" onclick="${f.type==='folder'?`browseFiles('${esc(f.name)}')`:`viewFile('${esc(f.name)}')`}">
      ${f.type==='folder'?SVG.folder:SVG.file}
      <span>${esc(f.name)}</span>
      ${f.size?`<span style="font-size:11px;color:var(--c-ink-muted);margin-left:auto">${(f.size/1024).toFixed(1)}KB</span>`:''}
    </div>
  `).join('');
}
async function browseFiles(name){
  const dir=name||_filesPath;
  const data=await apiGet('/api/system/files?dir='+encodeURIComponent(dir));
  if(data){_filesCache=data.items||[];_filesPath=data.path||dir}
  const el=$('#filesTree');
  if(el) el.innerHTML=`<div style="font-size:12px;color:var(--c-ink-muted);padding:4px 12px;margin-bottom:4px">${esc(_filesPath)}</div>`+buildFilesHtml(_filesCache);
}
async function viewFile(name){
  const p=_filesPath?_filesPath+'/'+name:name;
  const data=await apiGet('/api/system/file-content?path='+encodeURIComponent(p));
  const el=$('#filesMain');
  if(!el) return;
  if(data){
    _fileContentView=`<div style="padding:16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><button class="btn btn-secondary btn-sm" onclick="_fileContentView=null;document.getElementById('filesMain').innerHTML='<div class=empty-state><span>选择文件查看内容</span></div>'">← 返回</button><span style="font-size:13px;color:var(--c-ink-muted)">${esc(data.path)}</span><span style="font-size:11px;color:var(--c-ink-muted)">${(data.size/1024).toFixed(1)}KB</span></div><pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:13px;background:var(--c-surface1);padding:16px;border-radius:var(--r-lg);overflow:auto;max-height:calc(100vh - 200px)">${esc(data.content)}</pre></div>`;
    el.innerHTML=_fileContentView;
  } else {
    el.innerHTML='<div class="empty-state"><span>无法读取文件内容</span></div>';
  }
}

function renderTerminal(){
  // Show CLI history (all chat sessions formatted as terminal output)
  const chats = state.chats || [];
  let sessionsHtml = '';
  if (chats.length === 0) {
    sessionsHtml = '<div class="term-line"><span class="term-prompt">#</span>暂无终端会话记录</div>';
  } else {
    chats.forEach(c => {
      const date = new Date(c.updatedAt || Date.now()).toLocaleString('zh-CN');
      const preview = c.messages?.length ? c.messages[c.messages.length-1].content?.slice(0, 60) : (c.title || '');
      sessionsHtml += `<div class="term-session" onclick="selectChat('${c.id}');navigate('chat')">
        <div class="term-session-title"><span class="term-prompt">▶</span> ${esc(c.title || '未命名')}</div>
        <div class="term-session-meta">${date} · ${c.messages?.length || '?'}条消息</div>
        <div class="term-session-preview">${esc(preview || '')}</div>
      </div>`;
    });
  }
  return `<div class="terminal-view">
    <div class="page-header" style="cursor:pointer" onclick="this.nextElementSibling.classList.toggle('expanded')">
      <h2>终端历史 <span style="font-size:12px;color:var(--c-ink-muted);margin-left:6px">▶</span></h2>
      <div class="header-actions">
        <span class="term-badge">${chats.length} 个会话</span>
      </div>
    </div>
    <div class="terminal-container">
      <div class="terminal-output" id="termOutput">
        <div class="term-line"><span class="term-prompt">$</span>Hermes Agent CLI — 会话历史</div>
        <div class="term-line"><span class="term-prompt">$</span>点击任一会话切换至对话页面查看详情</div>
        <div class="term-sep"></div>
        ${sessionsHtml}
      </div>
    </div>
  </div>`;
}

function initTerminal(){
  // Terminal view doesn't need special init
}

function execTerm(cmd){
  const out=$('#termOutput');
  if(!out) return;
  out.innerHTML+=`<div class="term-line"><span class="term-prompt">$</span>${esc(cmd)}</div>`;
  const responses={
    help:'可用命令: help, status, model, skills, clear, version',
    status:`状态: 在线 | 模型: ${state.model.model}`,
    model:`当前模型: ${state.model.model} | Provider: ${state.model.provider}`,
    skills:`已启用技能: ${state.skills.filter(s=>s.on).map(s=>s.name).join(', ')||'无'}`,
    version:'Hermes Agent v0.5.12',
    clear:'__CLEAR__',
  };
  const r=responses[cmd.trim().toLowerCase()]||`未知命令: ${cmd}。输入 help 查看帮助。`;
  if(r==='__CLEAR__'){out.innerHTML='';return}
  out.innerHTML+=`<div class="term-line">${esc(r)}</div>`;
  out.scrollTop=out.scrollHeight;
}

function openModal(html){
  const overlay=$('#modalOverlay');
  const content=$('#modalContent');
  if(!overlay||!content) return;
  content.innerHTML=html;
  overlay.classList.add('show');
}

function closeModal(){
  const overlay=$('#modalOverlay');
  if(overlay) overlay.classList.remove('show');
}

function initNotificationSSE(){
  const base = (apiBase() || window.location.origin).replace(/\/$/, '');
  const es = new EventSource(base + '/api/sse/notify');
  es.addEventListener('modal', e => {
    try {
      const d = JSON.parse(e.data);
      const html = d.html || '<p>无内容</p>';
      const title = d.title ? `<div class="modal-header"><h3>${esc(d.title)}</h3></div>` : '';
      openModal(title + `<div class="modal-body">${html}</div>` +
        `<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">确定</button></div>`);
    } catch(err){ console.error('SSE modal error:', err); }
  });
  es.addEventListener('toast', e => {
    try {
      const d = JSON.parse(e.data);
      toast(d.msg, d.type);
    } catch(err){ console.error('SSE toast error:', err); }
  });
  es.onerror = () => {}; // Auto-reconnect by default
}

function toast(msg,type){
  type=type||'info';
  const t=document.createElement('div');
  t.className='toast toast-'+type;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2500);
}

const AgentAsk={
  _session:null,
  _activeTab:0,
  _answers:{},
  _resolve:null,
  _overlayEl:null,

  ask(questions,opts){
    opts=opts||{};
    const sessionId='ask_'+Date.now();
    this._session={
      id:sessionId,
      title:opts.title||'Agent 提问',
      questions:questions.map((q,i)=>({
        id:q.id||('q_'+i),
        label:q.label||('问题 '+(i+1)),
        type:q.type||'single',
        options:q.options||[],
        hint:q.hint||'',
        required:q.required!==false,
        maxLength:q.maxLength||500,
        placeholder:q.placeholder||'补充说明（可选）…',
      })),
      createdAt:Date.now(),
    };
    this._activeTab=0;
    this._answers={};
    this._session.questions.forEach(q=>{
      this._answers[q.id]={selected:[],custom:''};
    });
    this._render();
    this._showOverlay();
    return new Promise(resolve=>{
      this._resolve=resolve;
    });
  },

  _showOverlay(){
    if(!this._overlayEl){
      this._overlayEl=document.createElement('div');
      this._overlayEl.className='agent-overlay';
      this._overlayEl.onclick=()=>{};
      document.body.appendChild(this._overlayEl);
    }
    requestAnimationFrame(()=>this._overlayEl.classList.add('show'));
  },

  _hideOverlay(){
    if(this._overlayEl) this._overlayEl.classList.remove('show');
  },

  _render(){
    const slot=$('#agentPanelSlot');
    if(!slot||!this._session) return;
    const s=this._session;
    const q=s.questions[this._activeTab];
    const ans=this._answers[q.id];
    const answeredCount=s.questions.filter(qq=>this._isAnswered(qq.id)).length;
    const allAnswered=answeredCount===s.questions.length;

    let tabsHtml=s.questions.map((qq,i)=>{
      const isAnswered=this._isAnswered(qq.id);
      const cls=i===this._activeTab?'active':'';
      const dot=isAnswered?'<span class="tab-answered"></span>':'<span class="tab-pending"></span>';
      return `<button class="agent-tab ${cls}" onclick="AgentAsk._switchTab(${i})">${esc(qq.label)}${dot}</button>`;
    }).join('');

    let optionsHtml='';
    if(q.type==='single'){
      optionsHtml=q.options.map((opt,oi)=>{
        const sel=ans.selected.includes(opt.value)?'selected':'';
        return `<div class="agent-option ${sel}" onclick="AgentAsk._selectSingle('${q.id}','${esc(opt.value)}')">
          <div class="agent-option-radio"></div>
          <span>${esc(opt.label)}</span>
        </div>`;
      }).join('');
    } else {
      optionsHtml=q.options.map((opt,oi)=>{
        const sel=ans.selected.includes(opt.value)?'selected':'';
        return `<div class="agent-option ${sel}" onclick="AgentAsk._toggleMulti('${q.id}','${esc(opt.value)}')">
          <div class="agent-option-check"></div>
          <span>${esc(opt.label)}</span>
        </div>`;
      }).join('');
    }

    let progressHtml=s.questions.map((qq,i)=>{
      const isAnswered=this._isAnswered(qq.id);
      const cls=isAnswered?'answered':(i===this._activeTab?'current':'');
      return `<div class="agent-progress-dot ${cls}"></div>`;
    }).join('');

    slot.innerHTML=`
      <div class="agent-panel">
        <div class="agent-panel-header">
          <div class="agent-panel-title">
            <span>${esc(s.title)}</span>
            <span class="agent-badge">AGENT</span>
          </div>
          <button class="agent-panel-close" onclick="AgentAsk.dismiss()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="agent-tabs">${tabsHtml}</div>
        <div class="agent-body">
          <div class="agent-question">
            <div class="agent-question-label">${esc(q.label)}</div>
            ${q.hint?`<div class="agent-question-hint">${esc(q.hint)}</div>`:''}
            <div class="agent-options">${optionsHtml}</div>
            <div class="agent-custom-input">
              <label>补充说明</label>
              <textarea id="agentCustomInput_${q.id}" placeholder="${esc(q.placeholder)}" maxlength="${q.maxLength}" oninput="AgentAsk._updateCustom('${q.id}',this.value)">${esc(ans.custom)}</textarea>
            </div>
          </div>
        </div>
        <div class="agent-footer">
          <div class="agent-footer-left">
            <div class="agent-progress">${progressHtml}</div>
            <span>${answeredCount}/${s.questions.length} 已回答</span>
          </div>
          <div class="agent-footer-right">
            <button class="btn btn-secondary btn-sm" onclick="AgentAsk._submitCurrent()">提交当前</button>
            <button class="btn btn-primary btn-sm" onclick="AgentAsk._submitAll()" ${allAnswered?'':'disabled style="opacity:0.5"'}>全部提交</button>
          </div>
        </div>
      </div>`;

    const inputArea=$('#chatInputArea');
    if(inputArea) inputArea.classList.add('has-agent-panel');
  },

  _isAnswered(qId){
    const a=this._answers[qId];
    if(!a) return false;
    const q=this._session.questions.find(qq=>qq.id===qId);
    if(!q) return false;
    if(q.required) return a.selected.length>0||a.custom.trim().length>0;
    return true;
  },

  _switchTab(idx){
    this._activeTab=idx;
    this._render();
  },

  _selectSingle(qId,value){
    this._answers[qId].selected=[value];
    this._render();
  },

  _toggleMulti(qId,value){
    const arr=this._answers[qId].selected;
    const idx=arr.indexOf(value);
    if(idx>=0) arr.splice(idx,1);
    else arr.push(value);
    this._render();
  },

  _updateCustom(qId,val){
    this._answers[qId].custom=val;
  },

  _submitCurrent(){
    const q=this._session.questions[this._activeTab];
    if(q.required&&!this._isAnswered(q.id)){
      toast('请至少选择一个选项或填写补充说明','error');
      return;
    }
    const nextUnanswered=this._session.questions.findIndex(qq=>!this._isAnswered(qq.id));
    if(nextUnanswered>=0){
      this._activeTab=nextUnanswered;
      this._render();
      toast('已记录回答，请继续','info');
    } else {
      this._submitAll();
    }
  },

  _submitAll(){
    const unanswered=this._session.questions.filter(q=>q.required&&!this._isAnswered(q.id));
    if(unanswered.length>0){
      toast(`还有 ${unanswered.length} 个必答问题未回答`,'error');
      this._activeTab=this._session.questions.indexOf(unanswered[0]);
      this._render();
      return;
    }
    const result=this._session.questions.map(q=>({
      id:q.id,
      label:q.label,
      selected:this._answers[q.id].selected,
      custom:this._answers[q.id].custom,
    }));
    this._cleanup();
    if(this._resolve){
      this._resolve(result);
      this._resolve=null;
    }
  },

  dismiss(){
    this._cleanup();
    if(this._resolve){
      this._resolve(null);
      this._resolve=null;
    }
  },

  _cleanup(){
    this._session=null;
    this._activeTab=0;
    this._answers={};
    this._hideOverlay();
    const slot=$('#agentPanelSlot');
    if(slot) slot.innerHTML='';
    const inputArea=$('#chatInputArea');
    if(inputArea) inputArea.classList.remove('has-agent-panel');
  },

  isOpen(){
    return this._session!==null;
  }
};

function askUser(questions,opts){
  return AgentAsk.ask(questions,opts);
}

// ===== Init: load real data from backend =====
async function initApp() {
  document.documentElement.dataset.theme = state.theme;
  const themeIcon = $('#themeIcon');
  if (themeIcon) themeIcon.innerHTML = state.theme === 'dark' ? SVG.moon : SVG.sun;
  const hljsTheme = document.getElementById('hljsTheme');
  if(hljsTheme) hljsTheme.href = state.theme === 'dark' ? 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css' : 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css';

  // Load settings
  const settings = await apiGet('/api/settings');
  if (settings) {
    const localStyle = state.settings.style;
    const localApi = state.settings.api;
    state.settings = { ...state.settings, ...settings };
    if (settings.api != null && String(settings.api).trim() !== '') {
      state.settings.api = String(settings.api).trim().replace(/\/$/, '');
    } else if (localApi != null && String(localApi).trim() !== '') {
      state.settings.api = String(localApi).trim().replace(/\/$/, '');
    } else {
      state.settings.api = '';
    }
    if (!state.settings.style && localStyle) state.settings.style = localStyle;
  }

  // Load model config
  const modelData = await apiGet('/api/models');
  if (modelData) {
    const currentM = modelData.current || 'deepseek-v4-flash';
    for (const [prov, cfg] of Object.entries(modelData)) {
      if (cfg && cfg.model) {
        state.model = {
          provider: prov,
          model: cfg.model || currentM,
          base: cfg.base || 'https://api.deepseek.com',
          key: cfg.key || '',
          temperature: modelData.params?.temperature || 0.7,
          topP: modelData.params?.topP || 1,
          maxTokens: modelData.params?.maxTokens || 4096,
        };
        break;
      }
    }
  }

  // Load CLI sessions (real Hermes conversation history)
  const sessions = await apiGet('/api/cli/sessions');
  if (sessions && sessions.length) {
    state.chats = sessions.map(s => ({
      id: s.id,
      title: s.title || s.preview || '未命名对话',
      source: 'cli',
      messages: [],
      updatedAt: Date.now(),
      createdAt: Date.now(),
    }));
  } else {
    // Fallback: load from WebUI's own chat store
    const chats = await apiGet('/api/chats');
    if (chats && chats.length) {
      state.chats = chats.map(c => ({
        id: c.id,
        title: c.title || '新建对话',
        source: c.source || 'WebUI',
        messages: [],
        updatedAt: c.updatedAt,
      }));
    }
  }
  if (state.chats.length) await selectChat(state.chats[0].id);

  // Load skills
  const skills = await apiGet('/api/skills');
  if (skills) state.skills = skills;

  // Load gateways
  const gateways = await apiGet('/api/gateway');
  if (gateways) state.gateways = gateways;

  state._loading = false;
  pingApi();
  initNotificationSSE();
  renderSidebar();
  renderPage();
}

initApp();
