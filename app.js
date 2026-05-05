// Hermes Agent WebUI - vanilla JS, no build step.
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):d; }catch(_){ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
};

// ---------- state ----------
const state = {
  settings: LS.get('hermes.settings', {
    theme:'dark', lang:'zh', stream:true, history:20, systemPrompt:'',
    api:'http://127.0.0.1:8088'
  }),
  model: LS.get('hermes.model', {
    provider:'anthropic', model:'claude-opus-4-7',
    base:'https://api.anthropic.com', key:'',
    temperature:0.7, topP:1.0, maxTokens:2048
  }),
  skills: LS.get('hermes.skills', [
    { id:'code-review', icon:'🧪', name:'代码评审', desc:'逐行审阅并给出重构建议', tags:['代码','重构'], on:true },
    { id:'web-search', icon:'🔍', name:'联网搜索', desc:'实时检索并引用来源', tags:['搜索'], on:false },
    { id:'file-ops', icon:'📁', name:'文件操作', desc:'读写本地文件与批处理', tags:['系统'], on:true },
    { id:'image-gen', icon:'🎨', name:'图像生成', desc:'根据提示词生成图片', tags:['多模态'], on:false },
    { id:'shell', icon:'💻', name:'Shell 执行', desc:'执行受限 Shell 命令', tags:['系统','危险'], on:false },
    { id:'memory', icon:'🧠', name:'长期记忆', desc:'跨会话记住偏好', tags:['记忆'], on:true },
  ]),
  chats: LS.get('hermes.chats', []),
  currentChat: null,
};

// ---------- routing ----------
function goto(page){
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.page===page));
  $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page===page));
  const titles = { home:'首页', chat:'对话', skills:'技能', models:'模型配置', settings:'设置' };
  $('#pageTitle').textContent = titles[page] || '';
  $('#newChat').style.display = page==='chat' ? '' : 'none';
  if(page==='home') renderHome();
  if(page==='chat') renderChat();
  if(page==='skills') renderSkills();
  if(page==='models') renderModels();
  if(page==='settings') renderSettings();
}
$('#nav').addEventListener('click', e => {
  const a = e.target.closest('a[data-page]'); if(!a) return; goto(a.dataset.page);
});
$$('[data-go]').forEach(b => b.addEventListener('click', () => goto(b.dataset.go)));

// ---------- theme ----------
function applyTheme(){
  document.documentElement.dataset.theme = state.settings.theme;
  $('#themeBtn').textContent = state.settings.theme==='dark' ? '🌙' : '☀️';
}
$('#themeBtn').addEventListener('click', () => {
  state.settings.theme = state.settings.theme==='dark' ? 'light' : 'dark';
  LS.set('hermes.settings', state.settings); applyTheme();
});

// ---------- HOME ----------
function renderHome(){
  $('#kpiChats').textContent = state.chats.length;
  $('#kpiSkills').textContent = state.skills.filter(s=>s.on).length;
  $('#kpiModel').textContent = state.model.model || '-';
}
$$('[data-prompt]').forEach(b => b.addEventListener('click', () => {
  goto('chat');
  ensureChat();
  $('#input').value = b.dataset.prompt;
  $('#input').focus();
}));

// ---------- CHAT ----------
function ensureChat(){
  if(!state.currentChat){
    if(state.chats.length===0) newChat();
    else state.currentChat = state.chats[0].id;
  }
}
function newChat(){
  const c = { id: 'c'+Date.now(), title:'新建对话', messages:[], updatedAt:Date.now() };
  state.chats.unshift(c); state.currentChat = c.id;
  LS.set('hermes.chats', state.chats);
  renderChat();
}
$('#newChat').addEventListener('click', newChat);

function currentChat(){ return state.chats.find(c=>c.id===state.currentChat); }

function renderChat(){
  ensureChat();
  const list = $('#chatList'); list.innerHTML='';
  state.chats.forEach(c => {
    const d = document.createElement('div');
    d.className = 'item'+(c.id===state.currentChat?' active':'');
    const last = c.messages[c.messages.length-1];
    d.innerHTML = `<div class="t">${escape(c.title)}</div><div class="s">${last?escape(last.content.slice(0,30)):'暂无消息'}</div>`;
    d.addEventListener('click', () => { state.currentChat=c.id; renderChat(); });
    list.appendChild(d);
  });
  const box = $('#messages'); box.innerHTML='';
  const c = currentChat();
  if(c){
    c.messages.forEach(m => {
      const el = document.createElement('div');
      el.className = 'msg '+(m.role==='user'?'user':'bot');
      el.innerHTML = `<div class="who">${m.role==='user'?'你':'助手'}</div>${escape(m.content)}`;
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
  }
  $('#modelHint').textContent = '模型：'+(state.model.model||'-');
}
function escape(s){ return String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }

$('#input').addEventListener('keydown', e => {
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
});
$('#sendBtn').addEventListener('click', send);

async function send(){
  const txt = $('#input').value.trim(); if(!txt) return;
  ensureChat();
  const c = currentChat();
  c.messages.push({ role:'user', content:txt, ts:Date.now() });
  if(c.title==='新建对话') c.title = txt.slice(0,24);
  c.updatedAt = Date.now();
  $('#input').value='';
  renderChat();
  // try real backend, fall back to local mock
  const reply = await callBackend(c.messages).catch(()=>null);
  const answer = reply || mockReply(txt);
  c.messages.push({ role:'assistant', content:answer, ts:Date.now() });
  LS.set('hermes.chats', state.chats);
  renderChat();
}

async function callBackend(messages){
  const url = (state.settings.api||'').replace(/\/$/,'') + '/api/chat';
  const ctrl = new AbortController(); setTimeout(()=>ctrl.abort(), 1500);
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ messages, model: state.model, settings: state.settings }), signal: ctrl.signal });
  if(!r.ok) throw 0;
  const j = await r.json();
  return j.content || j.message || j.reply || '';
}
function mockReply(q){
  return `（本地模拟回复，未连接 Hermes 后端）\n你说：${q}\n\n请在「设置」页配置 Hermes Agent API 地址，或保留为离线演示。`;
}

// ---------- SKILLS ----------
function renderSkills(){
  const grid = $('#skillGrid'); grid.innerHTML='';
  const kw = ($('#skillSearch').value||'').toLowerCase();
  state.skills.filter(s => !kw || (s.name+s.desc+s.tags.join(',')).toLowerCase().includes(kw))
    .forEach(s => {
      const card = document.createElement('div');
      card.className = 'card skill';
      card.innerHTML = `
        <div class="head"><div class="ico">${s.icon}</div><div><div class="name">${escape(s.name)}</div><div class="muted">${escape(s.desc)}</div></div></div>
        <div class="tags">${s.tags.map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div>
        <div class="skill-foot"><span class="muted">${s.on?'已启用':'未启用'}</span><div class="switch ${s.on?'on':''}" data-id="${s.id}"></div></div>`;
      grid.appendChild(card);
    });
  $$('.switch', grid).forEach(sw => sw.addEventListener('click', () => {
    const it = state.skills.find(x=>x.id===sw.dataset.id); it.on=!it.on;
    LS.set('hermes.skills', state.skills); renderSkills();
  }));
}
$('#skillSearch').addEventListener('input', renderSkills);
$('#addSkill').addEventListener('click', () => {
  const name = prompt('技能名称'); if(!name) return;
  const desc = prompt('简介','')||'';
  state.skills.push({ id:'u'+Date.now(), icon:'✨', name, desc, tags:['自定义'], on:false });
  LS.set('hermes.skills', state.skills); renderSkills();
});

// ---------- MODELS ----------
function renderModels(){
  const m = state.model;
  $('#mProvider').value = m.provider; $('#mModel').value = m.model; $('#mBase').value = m.base;
  $('#mKey').value = m.key; $('#mTemp').value = m.temperature; $('#mTopP').value = m.topP;
  $('#mMax').value = m.maxTokens; $('#tVal').textContent = m.temperature; $('#pVal').textContent = m.topP;
}
$('#mTemp').addEventListener('input', e => $('#tVal').textContent=e.target.value);
$('#mTopP').addEventListener('input', e => $('#pVal').textContent=e.target.value);
$('#saveModel').addEventListener('click', () => {
  state.model = {
    provider:$('#mProvider').value, model:$('#mModel').value.trim(), base:$('#mBase').value.trim(),
    key:$('#mKey').value, temperature:parseFloat($('#mTemp').value), topP:parseFloat($('#mTopP').value),
    maxTokens:parseInt($('#mMax').value)||2048,
  };
  LS.set('hermes.model', state.model);
  $('#modelMsg').textContent = '已保存 ✓';
  setTimeout(()=>$('#modelMsg').textContent='', 1500);
});
$('#testModel').addEventListener('click', async () => {
  $('#modelMsg').textContent = '测试中…';
  try{
    const ctrl = new AbortController(); setTimeout(()=>ctrl.abort(),2000);
    const r = await fetch($('#mBase').value, { signal:ctrl.signal, mode:'no-cors' });
    $('#modelMsg').textContent = '已发送测试请求（浏览器环境无法读取响应，仅检查可达性）';
  }catch(_){ $('#modelMsg').textContent='连接失败：'+($('#mBase').value||'未填写'); }
});

// ---------- SETTINGS ----------
function renderSettings(){
  const s = state.settings;
  $('#sTheme').value=s.theme; $('#sLang').value=s.lang; $('#sStream').checked=!!s.stream;
  $('#sHistory').value=s.history; $('#sSys').value=s.systemPrompt; $('#sApi').value=s.api;
}
$('#saveSettings').addEventListener('click', () => {
  state.settings = {
    theme:$('#sTheme').value, lang:$('#sLang').value, stream:$('#sStream').checked,
    history:parseInt($('#sHistory').value)||20, systemPrompt:$('#sSys').value, api:$('#sApi').value.trim(),
  };
  LS.set('hermes.settings', state.settings); applyTheme();
  $('#settingsMsg').textContent='已保存 ✓'; setTimeout(()=>$('#settingsMsg').textContent='',1500);
  pingApi();
});
$('#pingApi').addEventListener('click', pingApi);
$('#resetAll').addEventListener('click', () => {
  if(!confirm('确认重置所有本地数据？')) return;
  ['hermes.settings','hermes.model','hermes.skills','hermes.chats'].forEach(k=>localStorage.removeItem(k));
  location.reload();
});

async function pingApi(){
  const dot=$('#dot'), st=$('#status');
  const url = (state.settings.api||'').replace(/\/$/,'') + '/api/health';
  try{
    const ctrl = new AbortController(); setTimeout(()=>ctrl.abort(),1500);
    const r = await fetch(url, { signal:ctrl.signal });
    if(r.ok){ dot.classList.remove('off'); st.textContent='已连接 Hermes Agent'; return; }
    throw 0;
  }catch(_){
    dot.classList.add('off'); st.textContent='离线模式（未连接后端）';
  }
}

// ---------- init ----------
applyTheme();
renderHome();
pingApi();
