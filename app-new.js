const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const LS={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))}
};
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function redactSecrets(value){
  if(value==null) return value;
  let text=String(value);
  text=text.replace(/(X-Auth-Token\s*:\s*)([^\s"'`|\\]+)(?=\\?["'`\s|]|$)/gi,'$1[已隐藏]');
  text=text.replace(/(Authorization\s*:\s*Bearer\s+)([^\s"'`|\\]+)(?=\\?["'`\s|]|$)/gi,'$1[已隐藏]');
  text=text.replace(/\b(token|api[_-]?key|secret|password)\s*[:=]\s*[^\s"'`,;|]{8,}/gi,'$1: [已隐藏]');
  text=text.replace(/\b(sk-[A-Za-z0-9_-]{20,})\b/g,'[已隐藏]');
  return text;
}
function formatBytes(bytes){
  const n=Number(bytes)||0;
  if(n<1024) return n+' B';
  if(n<1024*1024) return (n/1024).toFixed(n<10*1024?1:0)+' KB';
  return (n/1024/1024).toFixed(1)+' MB';
}

function namedSvg(name,size,fallback){
  return typeof HermesIcons!=='undefined' && HermesIcons && typeof HermesIcons.svg==='function'
    ? HermesIcons.svg(name,size,fallback)
    : (fallback || '');
}

const SVG={
  chat:namedSvg('对话',18,'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'),
  history:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  group:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  search:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  jobs:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  skills:namedSvg('技能',18,'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'),
  memory:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  models:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  usage:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  channels:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  settings:namedSvg('设置',18,'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'),
  profiles:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  gateways:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  logs:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  files:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  terminal:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  send:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  chevronDown:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
  moon:namedSvg('深色',20,'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>'),
  sun:namedSvg('浅色',20,'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'),
  folder:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  file:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  upload:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  image:namedSvg('图片',16,'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-4.5-4.5L10 17l-2.5-2.5L3 19"/></svg>'),
  sidebar:'<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.623 2.01758C18.1418 2.01763 19.373 3.24883 19.373 4.76758V15.2324C19.373 16.7512 18.1418 17.9824 16.623 17.9824H3.37695C1.85817 17.9824 0.626953 16.7512 0.626953 15.2324V4.76758C0.626953 3.2488 1.85817 2.01758 3.37695 2.01758H16.623ZM3.37695 3.51758C2.6866 3.51758 2.12695 4.07722 2.12695 4.76758V15.2324C2.12695 15.9228 2.6866 16.4824 3.37695 16.4824H16.623C17.3134 16.4824 17.873 15.9227 17.873 15.2324V4.76758C17.873 4.07726 17.3134 3.51763 16.623 3.51758H3.37695ZM4.57227 5.28711C4.98625 5.28737 5.32227 5.62306 5.32227 6.03711V13.9629C5.32227 14.3769 4.98625 14.7126 4.57227 14.7129C4.15805 14.7129 3.82227 14.3771 3.82227 13.9629V6.03711C3.82227 5.6229 4.15805 5.28711 4.57227 5.28711Z" fill="currentColor"/></svg>',
  command:namedSvg('命令',16,'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m4 7 5 5-5 5"/><path d="M11 17h9"/></svg>'),
  panelExpand:namedSvg('知识库',16,'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'),
  brain:'<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#brainClip)"><path d="M7.1385 16.5C6.77104 15.3016 6.21668 14.4083 5.47541 13.8199C4.3635 12.9373 2.59681 13.4858 1.94422 12.5755C1.29162 11.6652 2.40143 9.99111 2.79088 9.00332C3.18032 8.01557 1.29817 7.6663 1.51791 7.38587C1.66441 7.19893 2.61552 6.65946 4.37126 5.76749C4.87013 2.9225 6.7128 1.5 9.89933 1.5C14.679 1.5 16.5 5.55223 16.5 8.12957C16.5 10.7069 14.295 13.4836 11.154 14.0822C10.8732 14.4913 11.2783 15.2972 12.3693 16.5" stroke="currentColor" stroke-width="1.13" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M7.31153 5.43732C7.06654 6.38769 7.13944 7.055 7.53023 7.43926C7.92101 7.82356 8.58705 8.07485 9.52834 8.19316C9.31478 9.41892 9.57518 9.99399 10.3095 9.91831C11.0438 9.84264 11.485 9.53754 11.6331 9.00294C12.7807 9.32547 13.4027 9.05555 13.499 8.19316C13.6436 6.89956 12.946 5.86764 12.66 5.86764C12.374 5.86764 11.6331 5.83284 11.6331 5.43732C11.6331 5.04177 10.7676 4.81831 9.98648 4.81831C9.20535 4.81831 9.67545 4.29177 8.60284 4.49982C7.88775 4.6385 7.45733 4.95099 7.31153 5.43732Z" stroke="currentColor" stroke-width="1.13" stroke-linejoin="round"/><path d="M11.4372 9.5625C11.0559 9.79916 10.5326 10.1926 10.3122 10.5C9.76137 11.2686 9.31456 11.7365 9.2168 12.228" stroke="currentColor" stroke-width="1.13" stroke-linecap="round"/></g><defs><clipPath id="brainClip"><rect width="18" height="18" fill="white"/></clipPath></defs></svg>',
  attach:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
};

const IMAGE_PROMPT_PREFIX='生成图像：';
const IMAGE_PROMPT_PREFIXES=['生成图像：','图像生成：','生成图片：','图片生成：'];

// API base — resolved at call time (uses state.settings.api when set)
function apiBase() {
  try {
    if (typeof state !== 'undefined' && state.settings && state.settings.api) {
      const a = String(state.settings.api).trim().replace(/\/$/, '');
      if (a) return a;
    }
  } catch (_) {}
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') return '';
  return 'http://127.0.0.1:3381';
}

function publicApiBase(){
  const base=apiBase();
  if(base) return base.replace(/\/$/,'');
  if(window.location.protocol==='http:'||window.location.protocol==='https:') return window.location.origin;
  return 'http://127.0.0.1:3381';
}

function mediaUrl(url){
  const text=String(url||'');
  if(!text) return '';
  if(/^https?:\/\//i.test(text)||/^data:/i.test(text)) return text;
  return publicApiBase()+('/'+text.replace(/^\/+/,''));
}

function scrollChatToBottom(){
  const area=$('#messagesArea');
  if(!area) return;
  area.scrollTo ? area.scrollTo({top:area.scrollHeight,behavior:'smooth'}) : (area.scrollTop=area.scrollHeight);
}

function updateScrollToBottomButton(){
  const area=$('#messagesArea');
  const btn=$('#scrollToBottomBtn');
  if(!area||!btn) return;
  const away=area.scrollHeight-area.scrollTop-area.clientHeight>180;
  btn.classList.toggle('show',away);
}

function imageSrc(item){
  if(!item) return '';
  const value=item.url||item.publicUrl;
  if(value) return mediaUrl(value);
  if(item.id) return mediaUrl('/api/images/file/'+encodeURIComponent(item.id));
  if(item.path) return mediaUrl('/api/system/file-raw?path='+encodeURIComponent(item.path));
  return '';
}

async function apiGet(path) {
  try {
    const r = await fetch(apiBase() + path, { cache:'no-store', headers: { 'Accept': 'application/json', 'Cache-Control':'no-cache' } });
    const j = await r.json();
    return j.code === 0 ? j.data : null;
  } catch { return null; }
}
async function apiPost(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'POST', cache:'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-cache' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    return j.code === 0 ? j.data : null;
  } catch { return null; }
}

async function apiPostRaw(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'POST', cache:'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-cache' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (error) {
    return { code: 1, data: null, msg: error.message || '????' };
  }
}


function hermesPerfEnabled(){
  try{
    return new URLSearchParams(window.location.search).has('perf')
      || LS.get('hermes.debugPerf', false)
      || !!(typeof state !== 'undefined' && state.settings && state.settings.debugPerf);
  }catch(_){ return false; }
}

function hermesPerfLog(stage, data={}){
  if(!hermesPerfEnabled()) return;
  try{ console.info('[Hermes Perf]', stage, data); }catch(_){}
}

function renderPromptDebugPanel(debug){
  if(!hermesPerfEnabled() || !debug) return '';
  const parts=Array.isArray(debug.parts)?debug.parts:[];
  const totalChars=Number(debug.totalChars||0);
  const totalTokens=Number(debug.totalApproxTokens||0);
  const historyMessages=Number(debug.historyMessages||0);
  const matchedSkills=Array.isArray(debug.matchedSkills)?debug.matchedSkills:[];
  const matchedSkillsHtml=matchedSkills.length?`<div style="margin-top:8px;padding:7px 8px;border-radius:8px;background:var(--c-surface1);color:var(--c-ink)">命中 Skill：${matchedSkills.map(s=>`${esc(s.name||'未命名')}${s.match?.trigger?` <span style="color:var(--c-ink-muted)">(${esc(s.match.trigger)})</span>`:''}`).join('、')}</div>`:'';
  const rows=parts.map(part=>{
    const truncated=part.truncated?` <em style="color:var(--c-warning,#b7791f);font-style:normal">已截断 ${Number(part.originalChars||0)}→${Number(part.chars||0)}</em>`:'';
    return `<div style="display:flex;gap:8px;justify-content:space-between;border-top:1px solid var(--c-hairline-soft);padding-top:5px;margin-top:5px">
    <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(part.label||part.source||'Prompt')}${truncated}</span>
    <span style="color:var(--c-ink-muted);font-family:var(--font-mono);flex-shrink:0">${Number(part.chars||0)} 字 / ~${Number(part.approxTokens||0)} tok</span>
  </div>`;
  }).join('');
  return `<details class="prompt-debug-panel" style="margin-top:10px;border:1px dashed var(--c-hairline);border-radius:10px;padding:8px 10px;color:var(--c-ink-muted);font-size:12px">
    <summary style="cursor:pointer;color:var(--c-ink)">Prompt 调试 · ${totalChars} 字 · ~${totalTokens} tok · 历史 ${historyMessages} 条</summary>
    ${matchedSkillsHtml}
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:2px">${rows||'<div>没有额外系统提示词。</div>'}</div>
  </details>`;
}
async function apiPut(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'PUT', cache:'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-cache' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    return j.code === 0 ? j.data : null;
  } catch { return null; }
}
async function apiDel(path) {
  try {
    const r = await fetch(apiBase() + path, { method: 'DELETE', cache:'no-store', headers:{'Cache-Control':'no-cache'} });
    const j = await r.json();
    return j.code === 0;
  } catch { return false; }
}

// Real-time SSE stream for sending messages
async function apiStream(path, body, callbacks) {
  try {
    const perfStart = performance.now ? performance.now() : Date.now();
    const r = await fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: callbacks?.signal,
    });
    if (!r.ok || !r.body) {
      let message = `连接失败 (${r.status})`;
      try {
        const text = await r.text();
        try {
          const json = JSON.parse(text);
          if (json?.msg) message = json.msg;
        } catch (_) {
          if (text) message = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || message;
        }
      } catch (_) {}
      callbacks.onError?.(message);
      return;
    }
    hermesPerfLog('stream-open', { ms: Math.round((performance.now ? performance.now() : Date.now()) - perfStart), path });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let firstEventAt = 0;
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
        if (!firstEventAt) {
          firstEventAt = performance.now ? performance.now() : Date.now();
          hermesPerfLog('first-event', { ms: Math.round(firstEventAt - perfStart), event: evt[1] });
        }
        switch (evt[1]) {
          case 'token': callbacks.onToken?.(data.text); break;
          case 'reasoning': callbacks.onReasoning?.(data.text); break;
          case 'tool': callbacks.onTool?.(data); break;
          case 'tool_complete': callbacks.onToolComplete?.(data); break;
          case 'title': callbacks.onTitle?.(data); break;
          case 'perf': callbacks.onPerf?.(data); break;
          case 'done': callbacks.onDone?.(data); break;
          case 'error': callbacks.onError?.(data.msg); break;
        }
      }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') { callbacks.onAbort?.(); return; }
    callbacks.onError?.(e.message);
  }
}

const state={
  theme: LS.get('hermes.theme','dark'),
  page: 'chat',
  chatMode: 'single',
  sidebarCollapsed: false,
  _loading: true,
  model: LS.get('hermes.model',{provider:'',model:'',base:'',key:'',temperature:0.7,topP:1,maxTokens:4096}),
  modelsConfig: null,
  chatModelOverride: LS.get('hermes.chatModelOverride','auto'),
  forceImageGeneration: LS.get('hermes.forceImageGeneration',false),
  pendingImageAttachments: LS.get('hermes.pendingImageAttachments',[]),
  imageEditReference: LS.get('hermes.imageEditReference',null),
  cliSessionLimit: LS.get('hermes.cliSessionLimit',500),
  cliStatusCache: LS.get('hermes.cliStatusCache', null),
  settings: LS.get('hermes.settings',{lang:'zh',stream:true,quickMode:false,history:16,systemPrompt:'',api:'',dataRootDir:'',memoryDir:'',imageDir:'',historyDir:'',mdLibraryDir:'',debugPerf:false,toolPermissions:{commandPolicy:'safe',logApprovals:true,requireApprovalForRisky:true},promptToggles:{webuiRules:true,coreMemory:true,agentRules:true,userSystemPrompt:true,profilePrompt:true,skills:true,knowledgeSearch:true},knowledgeSearchLimit:3}),
  skills: [],
  skillFilter: {source:null,search:'',category:null},
  selectedSkill: null,
  chats: [],
  currentChat: null,
  connected: false,
  chatFullData: {},  // id -> full chat data from backend
  isStreaming: false,
  streamAbort: null,
  currentAssistantMsgId: null,
  _artifactNeedsHydrate: true,
  memories: LS.get('hermes.memories',{core:'',context:'',episodes:[]}),
  memory: { data:null, selectedType:'core', selectedId:null, current:null, mode:'preview', loading:false, failed:false, editDraft:null, conversationView:'all', sidebarScroll:0 },
  selectedChannel: null,
  activeProfile: LS.get('hermes.activeProfile','default'),
  agentPopupOpen: false,
  gateways: LS.get('hermes.gateways',[]),
  groupChat: LS.get('hermes.groupChat',{
    userName:'',userDesc:'',connected:false,activeRoom:null,rooms:[],
    messages:{},agents:{},members:{},typing:{},contextStatus:{},
  }),
};
if (typeof window !== 'undefined') window.state = state;

const NAV=[
  {id:'chat',label:'对话',icon:'chat'},
  {id:'groupChat',label:'分身',icon:'group'},
  {id:'skill',label:'小脑瓜',icon:'brain'},
  {id:'settingsPage',label:'设置',icon:'settings'},
];

function save(){
  LS.set('hermes.theme',state.theme);
  LS.set('hermes.model',state.model);
  LS.set('hermes.chatModelOverride',state.chatModelOverride);
  LS.set('hermes.forceImageGeneration',state.forceImageGeneration);
  LS.set('hermes.pendingImageAttachments',state.pendingImageAttachments||[]);
  LS.set('hermes.imageEditReference',state.imageEditReference||null);
  LS.set('hermes.cliSessionLimit',state.cliSessionLimit||500);
  LS.set('hermes.settings',state.settings);
  LS.set('hermes.memories',state.memories);
  LS.set('hermes.gateways',state.gateways);
  LS.set('hermes.groupChat',state.groupChat);
  LS.set('hermes.activeProfile',state.activeProfile);
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
  const activePage = state.page === 'skill' || ['skills','channels','memory','jobs','profiles'].includes(state.page) ? 'skill'
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
  if(state.page==='skill'){
    main.innerHTML=renderSkillPage();
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
  if(state.page==='skill' && skillCenterTab==='memory' && !state.memory.data && !state.memory.loading && !state.memory.failed) loadMemoryStore();
  if(state.page==='settingsPage') { loadCliStatusCard(); loadUpdateStatus(false); }
  if(AgentAsk.isOpen()) AgentAsk._render();

  enhanceMessageMarkdown(document.getElementById('mainContent'));

  if(state.page==='chat' && typeof HermesArtifact !== 'undefined') {
    requestAnimationFrame(() => {
      try {
        HermesArtifact.initWorkbench();
        if (state._artifactNeedsHydrate) {
          HermesArtifact.hydrateMessages((currentChat()?.messages)||[]);
          state._artifactNeedsHydrate = false;
        }
      } catch (_) {}
    });
  }
}

function renderChat(){
  const c=currentChat();
  const msgs=c?c.messages:[];
  const activeProfile=profileForChat(c);
  const pendingImages=state.pendingImageAttachments||[];
  const editRef=state.imageEditReference;
  const setupTips=[];
  if(!getEnabledModels().length) setupTips.push({title:'配置模型',desc:'还没有可用模型，先添加 Provider、Base URL、API Key 和模型名。',action:"state.page='models';renderPage()",label:'去模型配置'});
  if(!String(state.settings.dataRootDir||state.settings.memoryDir||state.settings.imageDir||state.settings.mdLibraryDir||'').trim()) setupTips.push({title:'配置外部数据目录',desc:'建议把记忆、图片、历史和输出文档放到项目外部，方便更新和迁移。',action:"state.page='settings';renderPage()",label:'去设置'});
  const setupHtml=setupTips.length?`<div class="setup-guide-card" style="max-width:720px;margin:24px auto 0;padding:16px;border:1px solid var(--c-accent-muted);border-radius:16px;background:var(--c-accent-soft);display:flex;flex-direction:column;gap:10px">
    <strong>首次使用建议先完成配置</strong>
    ${setupTips.map(item=>`<div style="display:flex;gap:12px;align-items:center;justify-content:space-between"><div><div style="font-weight:600">${esc(item.title)}</div><div style="font-size:12px;color:var(--c-ink-muted)">${esc(item.desc)}</div></div><button class="btn btn-secondary btn-sm" onclick="${item.action}">${esc(item.label)}</button></div>`).join('')}
  </div>`:'';
  return `
    <div class="chat-panel">
      <div class="session-sidebar" id="sessionSidebar">
        <div class="session-sidebar-header">
          <button class="agent-switch-btn" id="chatAgentSwitchBtn" onclick="toggleChatAgentPopup(event)" title="切换当前 Agent">
            ${profileAvatarHtml(activeProfile,'chat-agent-avatar')}
            <span class="agent-switch-copy"><strong>${esc(activeProfile?.name||'默认助手')}</strong><small>${esc(activeProfile?.modelId&&activeProfile.modelId!=='auto' ? (getModelById(activeProfile.modelId)?.name||activeProfile.model||effectiveChatModelName()) : '自动')}</small></span>
            ${SVG.chevronDown}
          </button>
          <button class="new-chat-btn" onclick="newChat()">${SVG.plus} 新建会话</button>
          <div class="chat-agent-popup" id="chatAgentPopup" style="display:none">${renderChatAgentPopup()}</div>
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
            <span class="source-badge">${esc(state.chatModelOverride==='auto'?'自动 · '+effectiveChatModelName():(getModelById(state.chatModelOverride)?.name||state.model.model))}</span>
            <span class="source-badge">${esc(activeProfile?.name||'默认助手')}</span>
          </div>
          <div class="header-actions">
            <button class="header-knowledge-btn header-toggle-panel-btn" onclick="openKnowledgePanel()" title="打开知识库" aria-label="打开知识库">
              ${SVG.panelExpand}<span>知识库</span>
            </button>
          </div>
        </div>
        <div class="messages-area" id="messagesArea" data-chat-id="${esc(c?.id||'')}">
          ${msgs.length===0?`
            <div class="empty-state" style="padding-top:120px">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <span>开始一段新对话</span>
              ${setupHtml}
            </div>
          `:msgs.map(m=>renderMsg(m)).join('')}
        </div>
        <div class="chat-input-area" id="chatInputArea">
          <button type="button" class="scroll-to-bottom-btn" id="scrollToBottomBtn" onclick="scrollChatToBottom()" title="回到底部" aria-label="回到底部">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
          </button>
          <div id="agentPanelSlot"></div>
          <div class="chat-input-box" style="position:relative">
            ${pendingImages.length||editRef?`<div class="image-attachment-strip">
              ${editRef?`<div class="image-attachment-chip image-edit-reference-chip">
                <img src="${esc(mediaUrl(editRef.url||editRef.publicUrl||''))}" alt="${esc(editRef.name||'二次编辑参考图')}">
                <span title="${esc(editRef.path||'')}">二次编辑：${esc(editRef.name||'生成图')}</span>
                <button type="button" onclick="clearImageEditReference()" title="取消引用">${SVG.x}</button>
              </div>`:''}
              ${pendingImages.map(img=>`<div class="image-attachment-chip">
                <img src="${esc(mediaUrl(img.url||img.publicUrl||''))}" alt="${esc(img.name||'上传图片')}">
                <span title="${esc(img.path||'')}">${esc(img.name||'上传图片')}</span>
                <button type="button" onclick="removePendingImage('${esc(img.id)}')" title="移除">${SVG.x}</button>
              </div>`).join('')}
            </div>`:''}
            <textarea id="chatInput" rows="1" placeholder="输入消息…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}" oninput="autoResizeInput(this)"></textarea>
            <div class="chat-input-toolbar">
              <div class="chat-input-left">
                <button class="input-action-btn toolbar-pill" onclick="document.getElementById('fileInput').click()" title="上传文件">${SVG.attach} 上传</button>
                <div class="image-tool-wrap" onmouseenter="scheduleShowImageToolSwitch()" onmouseleave="scheduleHideImageToolSwitch()">
                  <button class="input-action-btn image-gen-toggle${state.forceImageGeneration?' active':''}" onclick="insertImagePrompt()" title="${state.forceImageGeneration?'直连生图已开启：发送会跳过 Agent':'插入生成图像提示词，让 Agent 处理生图'}">${SVG.image} 图像</button>
                  <div class="image-tool-pop" id="imageToolPop" onmouseenter="showImageToolSwitch()" onmouseleave="scheduleHideImageToolSwitch()">
                    <div>
                      <strong>跳过 Agent 直连生图</strong>
                      <span>关闭时只插入“生成图像：”，由 Agent 理解和调用工具。</span>
                    </div>
                    <label class="mini-switch">
                      <input type="checkbox" ${state.forceImageGeneration?'checked':''} onchange="setDirectImageMode(this.checked)">
                      <span></span>
                    </label>
                  </div>
                </div>
                <button class="input-action-btn toolbar-pill" onclick="toggleCommandPopup()" title="打开命令面板" id="commandPopupBtn">${SVG.command} 命令</button>
                <button class="input-action-btn toolbar-pill" onclick="toggleSkillPopup()" title="技能" id="skillPopupBtn">${SVG.skills} 技能</button>
              </div>
              <div class="chat-input-right">
                <button class="input-action-btn" onclick="toggleModelPopup()" title="选择模型" id="modelPopupBtn" style="font-size:11px;font-family:var(--font-mono);width:auto;padding:0 8px">${esc(state.chatModelOverride==='auto'?'自动':(getModelById(state.chatModelOverride)?.name||state.model.model))}</button>
                <button class="send-btn${state.isStreaming?' stop':''}" id="sendBtn" onclick="${state.isStreaming?'stopGeneration()':'sendMessage()'}" title="${state.isStreaming?'终止任务':'发送'}">${state.isStreaming?'<span class="stop-square"></span>':SVG.send}</button>
              </div>
            </div>
            <div class="skill-popup" id="skillPopup" style="display:none">
              <div class="skill-popup-header"><h4>选择技能</h4><button class="history-popup-close" onclick="toggleSkillPopup()">${SVG.x}</button></div>
              <div class="skill-popup-body" id="skillPopupBody"></div>
            </div>
            <div class="command-popup" id="commandPopup" style="display:none">
              <div class="skill-popup-header"><h4>Hermes 命令</h4><button class="history-popup-close" onclick="toggleCommandPopup()">${SVG.x}</button></div>
              <div class="skill-popup-body command-popup-body" id="commandPopupBody"></div>
            </div>
            <div class="model-popup" id="modelPopup" style="display:none">
              <div class="model-popup-header">选择模型</div>
              <div class="model-popup-body" id="modelPopupBody"></div>
            </div>
          </div>
          <input type="file" id="fileInput" accept="image/*" multiple style="display:none" onchange="handleFileUpload(this)">
        </div>
      </div>
      <div class="artifact-resizer" id="artifactResizer" role="separator" aria-orientation="vertical"></div>
      <aside class="artifact-shell" id="artifactShell" aria-label="Artifact"></aside>
      </div>
    </div>`;
}

let skillCenterTab = 'skills';
let settingsTab = 'settings';

function renderSkillPage(){
  const tabs=[
    {id:'skills',label:'技能中心',icon:'skills'},
    {id:'channels',label:'频道',icon:'channels'},
    {id:'memory',label:'记忆存储',icon:'memory'},
    {id:'jobs',label:'任务管理',icon:'jobs'},
    {id:'profiles',label:'Agent 管理',icon:'profiles'},
  ];
  const active=skillCenterTab;
  const renderers={skills:renderSkills,channels:renderChannels,memory:renderMemory,jobs:renderJobs,profiles:renderProfiles};
  return `
    <div style="display:flex;flex-direction:column;height:100%">
      <div class="tabs" style="padding:0 24px">
        ${tabs.map(t=>`<div class="tab${active===t.id?' active':''}" onclick="skillCenterTab='${t.id}';document.getElementById('mainContent').innerHTML=renderSkillPage();afterRender()">${SVG[t.icon]} ${t.label}</div>`).join('')}
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
    {id:'usage',label:'用量统计',icon:'usage'},
  ];
  const active=settingsTab;
  const renderers={settings:renderSettings,models:renderModels,logs:renderLogs,files:renderFiles,usage:renderUsage};
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

function setDirectImageMode(on){
  state.forceImageGeneration=!!on;
  save();
  toast(state.forceImageGeneration?'已开启直连生图：发送会跳过 Agent':'已关闭直连生图：由 Agent 处理生成图像提示','info');
  const btn=document.querySelector('.image-gen-toggle');
  if(btn) btn.classList.toggle('active',state.forceImageGeneration);
}

let imageToolShowTimer=null;
let imageToolHideTimer=null;
function scheduleShowImageToolSwitch(){
  if(imageToolHideTimer){clearTimeout(imageToolHideTimer);imageToolHideTimer=null}
  if(imageToolShowTimer) clearTimeout(imageToolShowTimer);
  imageToolShowTimer=setTimeout(showImageToolSwitch,360);
}
function showImageToolSwitch(){
  if(imageToolShowTimer){clearTimeout(imageToolShowTimer);imageToolShowTimer=null}
  if(imageToolHideTimer){clearTimeout(imageToolHideTimer);imageToolHideTimer=null}
  const pop=$('#imageToolPop');
  if(pop) pop.classList.add('show');
}

function scheduleHideImageToolSwitch(){
  if(imageToolShowTimer){clearTimeout(imageToolShowTimer);imageToolShowTimer=null}
  if(imageToolHideTimer) clearTimeout(imageToolHideTimer);
  imageToolHideTimer=setTimeout(hideImageToolSwitch,260);
}

function hideImageToolSwitch(){
  const pop=$('#imageToolPop');
  if(pop) pop.classList.remove('show');
}

function insertImagePrompt(){
  const ta=$('#chatInput');
  if(!ta) return;
  const prefix=IMAGE_PROMPT_PREFIX;
  const value=ta.value||'';
  if(!value.trim()){
    ta.value=prefix;
  }else if(!value.includes(prefix)){
    const start=ta.selectionStart ?? value.length;
    const end=ta.selectionEnd ?? start;
    ta.value=value.slice(0,start)+prefix+value.slice(end);
    ta.selectionStart=ta.selectionEnd=start+prefix.length;
  }
  ta.focus();
  autoResizeInput(ta);
}

function insertCommandPrompt(){
  const ta=$('#chatInput');
  if(!ta) return;
  const prefix='执行命令：';
  const value=ta.value||'';
  if(!value.trim()){
    ta.value=prefix;
  }else if(!value.includes(prefix)){
    const start=ta.selectionStart ?? value.length;
    const end=ta.selectionEnd ?? start;
    ta.value=value.slice(0,start)+prefix+value.slice(end);
    ta.selectionStart=ta.selectionEnd=start+prefix.length;
  }
  ta.focus();
  autoResizeInput(ta);
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function renderPendingImageStrip(){
  const box=document.querySelector('.chat-input-box');
  if(!box) return;
  const old=box.querySelector('.image-attachment-strip');
  if(old) old.remove();
  const list=state.pendingImageAttachments||[];
  const editRef=state.imageEditReference;
  if(!list.length && !editRef) return;
  box.insertAdjacentHTML('afterbegin',`<div class="image-attachment-strip">
    ${editRef?`<div class="image-attachment-chip image-edit-reference-chip">
      <img src="${esc(mediaUrl(editRef.url||editRef.publicUrl||''))}" alt="${esc(editRef.name||'二次编辑参考图')}">
      <span title="${esc(editRef.path||'')}">二次编辑：${esc(editRef.name||'生成图')}</span>
      <button type="button" onclick="clearImageEditReference()" title="取消引用">${SVG.x}</button>
    </div>`:''}
    ${list.map(img=>`<div class="image-attachment-chip">
      <img src="${esc(mediaUrl(img.url||img.publicUrl||''))}" alt="${esc(img.name||'上传图片')}">
      <span title="${esc(img.path||'')}">${esc(img.name||'上传图片')}</span>
      <button type="button" onclick="removePendingImage('${esc(img.id)}')" title="移除">${SVG.x}</button>
    </div>`).join('')}
  </div>`);
}

function updatePendingImageStripOnly(){
  const ta=$('#chatInput');
  const value=ta?.value || '';
  const start=ta?.selectionStart ?? value.length;
  const end=ta?.selectionEnd ?? start;
  renderPendingImageStrip();
  if(ta){
    ta.value=value;
    ta.selectionStart=start;
    ta.selectionEnd=end;
    ta.focus();
    autoResizeInput(ta);
  }
}

function profileAvatarHtml(profile,cls='profile-avatar'){
  const p=profile||{};
  const name=p.name||'A';
  const bg=p.color||'var(--c-surface2)';
  if(p.avatar){
    return `<span class="${cls}" style="background-image:url('${esc(p.avatar)}');background-size:cover;background-position:center" title="${esc(name)}"></span>`;
  }
  return `<span class="${cls}" style="background:${bg}">${esc(name.charAt(0))}</span>`;
}

function presetProfileColor(seed='A'){
  const colors=['var(--c-block-lime)','var(--c-block-lilac)','var(--c-block-cream)','var(--c-block-mint)','var(--c-block-coral)'];
  const text=String(seed||'A');
  let hash=0;
  for(let i=0;i<text.length;i++) hash=(hash*31+text.charCodeAt(i))>>>0;
  return colors[hash%colors.length];
}

function sessionAvatarHtml(profile,isCli=false){
  if(isCli){
    return `<span class="session-avatar session-avatar-cli">${SVG.terminal}</span>`;
  }
  return profileAvatarHtml(profile,'session-avatar');
}

let _profileAvatarDraft='';
let _profileAvatarCleared=false;

function handleProfileAvatarInput(input){
  const file=input?.files?.[0];
  if(!file) return;
  if(!file.type?.startsWith('image/')){
    toast('请选择图片作为头像','error');
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    _profileAvatarDraft=String(reader.result||'');
    _profileAvatarCleared=false;
    const preview=document.getElementById('pfAvatarPreview');
    if(preview){
      preview.style.backgroundImage=`url('${_profileAvatarDraft}')`;
      preview.style.backgroundSize='cover';
      preview.style.backgroundPosition='center';
      preview.textContent='';
    }
  };
  reader.readAsDataURL(file);
}

function resetProfileAvatar(){
  _profileAvatarDraft='';
  _profileAvatarCleared=true;
  const name=$('#pfName')?.value?.trim()||'A';
  const preview=document.getElementById('pfAvatarPreview');
  if(preview){
    preview.style.backgroundImage='';
    preview.style.backgroundSize='';
    preview.style.backgroundPosition='';
    preview.style.background=presetProfileColor(name);
    preview.textContent=name.charAt(0);
  }
  const input=document.getElementById('pfAvatarInput');
  if(input) input.value='';
}

function removePendingImage(id){
  state.pendingImageAttachments=(state.pendingImageAttachments||[]).filter(img=>img.id!==id);
  save();
  updatePendingImageStripOnly();
}

function clearImageEditReference(){
  state.imageEditReference=null;
  save();
  updatePendingImageStripOnly();
}

async function handleFileUpload(input){
  const files=[...(input.files||[])];
  input.value='';
  await saveImageFiles(files,'chat-upload');
}

async function saveImageFiles(files,source='chat-upload'){
  if(!files.length) return;
  const images=files.filter(file=>file.type&&file.type.startsWith('image/'));
  if(images.length!==files.length) toast('当前图像生成只接收图片文件，已忽略非图片文件','info');
  if(!images.length) return;
  state.pendingImageAttachments=state.pendingImageAttachments||[];
  for(const file of images){
    try{
      const dataUrl=await fileToDataUrl(file);
      const data=await apiPost('/api/images/upload',{dataUrl,fileName:file.name,mime:file.type,source,publicBase:publicApiBase()});
      if(data){
        const rawUrl=data.url||data.publicUrl;
        state.pendingImageAttachments.push({
          id:data.id,
          name:data.originalName||data.filename||file.name,
          url:rawUrl,
          publicUrl:mediaUrl(data.publicUrl||rawUrl),
          path:data.path,
          size:data.size,
          mime:data.mime,
        });
      }
    }catch(e){
      toast(`保存图片失败：${file.name}`,'error');
    }
  }
  save();
  updatePendingImageStripOnly();
  if(source!=='clipboard'&&images.length) toast(`已保存 ${images.length} 张图片，可随消息一起发送`,'success');
}

function toggleSkillPopup(){
  const popup=$('#skillPopup');
  if(!popup) return;
  const isVisible=popup.style.display!=='none';
  closeAllInputPopups();
  if(!isVisible){
    const body=$('#skillPopupBody');
    if(body){
      const preferredSkills=(state.skills||[]).filter(s=>['external','local','user','custom'].includes(s.source));
      const otherSkills=(state.skills||[]).filter(s=>!preferredSkills.includes(s));
      const all=[...preferredSkills,...otherSkills];
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
    placeInputPopup(popup,$('#skillPopupBtn'),'left');
    popup.style.display='flex';
    setTimeout(()=>document.addEventListener('click',closePopupsOnOutsideClick,{once:true}),10);
  }
}

const HERMES_COMMANDS=[
  {cmd:'/help',title:'帮助',desc:'查看 Hermes Agent 可用命令与用法'},
  {cmd:'/status',title:'状态',desc:'查看当前 Agent、模型、工具与运行状态'},
  {cmd:'/memory',title:'记忆',desc:'查看或整理当前对话中需要记住的内容'},
  {cmd:'/save',title:'保存',desc:'将适合归档的内容保存为 Markdown 或知识库文档'},
  {cmd:'/summary',title:'总结',desc:'把当前对话整理成摘要、待办和关键结论'},
  {cmd:'/doc',title:'文档',desc:'按知识库规范输出结构化 Markdown 文档'},
  {cmd:'/run',title:'执行命令',desc:'明确请求 Agent 通过受限后端能力执行命令，危险操作需确认'},
  {cmd:'/clear',title:'清理上下文',desc:'请求整理当前上下文，减少无关信息干扰'},
];


function renderCommandPopup(){
  return HERMES_COMMANDS.map(item=>`<button type="button" class="command-popup-item" onclick="insertHermesCommand('${esc(item.cmd)}')">
    <span class="command-popup-code">${esc(item.cmd)}</span>
    <span class="command-popup-main"><strong>${esc(item.title)}</strong><small>${esc(item.desc)}</small></span>
  </button>`).join('');
}

function toggleCommandPopup(){
  const popup=$('#commandPopup');
  if(!popup) return;
  const isVisible=popup.style.display!=='none';
  closeAllInputPopups();
  if(!isVisible){
    const body=$('#commandPopupBody');
    if(body) body.innerHTML=renderCommandPopup();
    placeInputPopup(popup,$('#commandPopupBtn'),'left');
    popup.style.display='flex';
    setTimeout(()=>document.addEventListener('click',closePopupsOnOutsideClick,{once:true}),10);
  }
}

function insertHermesCommand(command){
  const ta=$('#chatInput');
  if(!ta) return;
  const value=ta.value||'';
  const insert=String(command||'').trim()+' ';
  if(!value.trim()){
    ta.value=insert;
    ta.selectionStart=ta.selectionEnd=ta.value.length;
  }else{
    const start=ta.selectionStart ?? value.length;
    const end=ta.selectionEnd ?? start;
    const prefix=start>0 && !/\s$/.test(value.slice(0,start)) ? ' ' : '';
    ta.value=value.slice(0,start)+prefix+insert+value.slice(end);
    ta.selectionStart=ta.selectionEnd=start+prefix.length+insert.length;
  }
  closeAllInputPopups();
  ta.focus();
  autoResizeInput(ta);
}

function localCommandModelList(){
  const models=getEnabledModels();
  if(!models.length) return '<p>还没有启用模型，请先到「设置 > 模型配置」添加 Provider 和模型。</p>';
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${models.map(m=>`
    <button class="model-popup-item" style="display:flex;width:100%;text-align:left" onclick="selectModel('${esc(m.id)}');closeModal();toast('已切换模型：${esc(m.name)}','success')">
      <span>${esc(m.name)}</span><span style="margin-left:auto;color:var(--c-ink-muted);font-size:11px">${esc(m.provider||'')}</span>
    </button>`).join('')}</div>`;
}

function handleLocalHermesCommand(text){
  const raw=String(text||'').trim();
  if(!raw.startsWith('/')) return false;
  const [cmd]=raw.split(/\s+/,1);
  const normalized=cmd.toLowerCase();
  if(normalized==='/help'){
    openModal(`<div style="padding:24px;min-width:min(560px,92vw)">
      <h3 style="margin:0 0 12px">Hermes 命令</h3>
      <div class="settings-desc" style="line-height:1.8">这些命令会优先在 WebUI 本地处理，避免不必要地请求模型。</div>
      <div style="display:grid;gap:8px;margin-top:14px">${HERMES_COMMANDS.map(item=>`<div><code>${esc(item.cmd)}</code> · <strong>${esc(item.title)}</strong><br><span style="color:var(--c-ink-muted);font-size:12px">${esc(item.desc)}</span></div>`).join('')}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" onclick="closeModal()">知道了</button></div>
    </div>`);
    return true;
  }
  if(normalized==='/model'){
    openModal(`<div style="padding:24px;min-width:min(560px,92vw)">
      <h3 style="margin:0 0 12px">选择模型</h3>
      <p class="settings-desc">当前：${esc(state.chatModelOverride==='auto'?'自动（按场景）':(getModelById(state.chatModelOverride)?.name||state.chatModelOverride))}</p>
      <button class="model-popup-item${state.chatModelOverride==='auto'?' active':''}" style="display:flex;width:100%;text-align:left" onclick="selectModel('auto');closeModal();toast('已切换为自动模型','success')">自动（按场景）</button>
      ${localCommandModelList()}
    </div>`);
    return true;
  }
  if(normalized==='/status'){
    const profile=profileForChat(currentChat())||getActiveProfile();
    const model=state.chatModelOverride==='auto'?'自动 · '+effectiveChatModelName():(getModelById(state.chatModelOverride)?.name||state.chatModelOverride);
    openModal(`<div style="padding:24px;min-width:min(560px,92vw)">
      <h3 style="margin:0 0 12px">当前状态</h3>
      <div style="line-height:1.9">
        <div><strong>Agent：</strong>${esc(profile?.name||'默认助手')}</div>
        <div><strong>模型：</strong>${esc(model)}</div>
        <div><strong>快速模式：</strong>${state.settings.quickMode?'已开启':'未开启'}</div>
        <div><strong>历史保留：</strong>${esc(state.settings.history||16)} 轮</div>
        <div><strong>数据目录：</strong>${esc(state.settings.dataRootDir||'默认 backend/data')}</div>
        <div><strong>记忆目录：</strong>${esc(state.settings.memoryDir||'自动匹配')}</div>
        <div><strong>图片目录：</strong>${esc(state.settings.imageDir||'自动匹配')}</div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" onclick="closeModal()">关闭</button></div>
    </div>`);
    return true;
  }
  if(normalized==='/clear'){
    const ta=$('#chatInput');
    if(ta){ta.value='';autoResizeInput(ta)}
    toast('已清空输入框；如需清理上下文，请新建对话或让 Agent 总结压缩。','info');
    return true;
  }
  return false;
}

function toggleModelPopup(){
  const popup=$('#modelPopup');
  if(!popup) return;
  const isVisible=popup.style.display!=='none';
  closeAllInputPopups();
  if(!isVisible){
    const body=$('#modelPopupBody');
    if(body){
      const models=getEnabledModels();
      body.innerHTML=`<div class="model-popup-item${state.chatModelOverride==='auto'?' active':''}" onclick="selectModel('auto')">自动（按场景）</div>`+
        (models.length
          ? models.map(m=>`<div class="model-popup-item${state.chatModelOverride===m.id?' active':''}" onclick="selectModel('${esc(m.id)}')">${esc(m.name)} <span style="margin-left:auto;color:var(--c-ink-muted);font-size:11px">${esc(m.provider)}</span></div>`).join('')
          : '<div class="empty-text" style="padding:12px">还没有可用模型，请先到设置 > 模型配置添加真实 Provider。</div>');
    }
    placeInputPopup(popup,$('#modelPopupBtn'),'right');
    popup.style.display='flex';
    setTimeout(()=>document.addEventListener('click',closePopupsOnOutsideClick,{once:true}),10);
  }
}

function renderChatAgentPopup(){
  const profiles=getProfiles();
  return profiles.map(p=>{
    const disabled=p.enabled===false;
    const active=state.activeProfile===p.id;
    const model=p.modelId==='auto'?'自动':(getModelById(p.modelId)?.name||p.model||'未设置');
    const skillCount=(p.skillIds||[]).length;
    return `<button class="chat-agent-item${active?' active':''}${disabled?' disabled':''}" onclick="selectChatProfile('${esc(p.id)}')">
      ${profileAvatarHtml(p,'chat-agent-avatar')}
      <span class="chat-agent-main"><strong>${esc(p.name||'未命名 Agent')}</strong><small>${disabled?'已关闭':esc(model)}${skillCount?` · ${skillCount} 技能`:''}</small></span>
    </button>`;
  }).join('') || '<div class="empty-text" style="padding:12px">暂无 Agent</div>';
}

function toggleChatAgentPopup(event){
  if(event) event.stopPropagation();
  const popup=$('#chatAgentPopup');
  if(!popup) return;
  const show=popup.style.display==='none';
  popup.innerHTML=renderChatAgentPopup();
  popup.style.display=show?'flex':'none';
  state.agentPopupOpen=show;
  if(show) setTimeout(()=>document.addEventListener('click',closeAgentPopupOnOutsideClick,{once:true}),10);
}

function closeAgentPopupOnOutsideClick(e){
  const popup=$('#chatAgentPopup');
  const btn=$('#chatAgentSwitchBtn');
  if(popup && popup.style.display!=='none' && !popup.contains(e.target) && !btn?.contains(e.target)){
    popup.style.display='none';
    state.agentPopupOpen=false;
  }
}

function placeInputPopup(popup,anchor,align){
  if(!popup||!anchor) return;
  const box=popup.closest('.chat-input-box');
  if(!box) return;
  const a=anchor.getBoundingClientRect();
  const b=box.getBoundingClientRect();
  popup.style.left='auto';
  popup.style.right='auto';
  popup.style.bottom=(b.bottom-a.top+8)+'px';
  const width=popup.classList.contains('skill-popup')||popup.classList.contains('command-popup')?360:260;
  const rawLeft=align==='right'?a.right-b.left-width:a.left-b.left;
  const maxLeft=Math.max(8,b.width-width-8);
  popup.style.width=width+'px';
  popup.style.left=Math.max(8,Math.min(rawLeft,maxLeft))+'px';
}

function closePopupsOnOutsideClick(e){
  const sp=$('#skillPopup');
  const mp=$('#modelPopup');
  const cp=$('#commandPopup');
  const skillBtn=$('#skillPopupBtn');
  const modelBtn=$('#modelPopupBtn');
  const commandBtn=$('#commandPopupBtn');
  if(sp && sp.style.display!=='none' && !sp.contains(e.target) && !skillBtn?.contains(e.target)){
    sp.style.display='none';
  }
  if(mp && mp.style.display!=='none' && !mp.contains(e.target) && !modelBtn?.contains(e.target)){
    mp.style.display='none';
  }
  if(cp && cp.style.display!=='none' && !cp.contains(e.target) && !commandBtn?.contains(e.target)){
    cp.style.display='none';
  }
}

function closeAllInputPopups(){
  const sp=$('#skillPopup');
  const mp=$('#modelPopup');
  const cp=$('#commandPopup');
  if(sp) sp.style.display='none';
  if(mp) mp.style.display='none';
  if(cp) cp.style.display='none';
}

function selectModel(m){
  state.chatModelOverride=m;
  if(m!=='auto'){
    const item=getModelById(m);
    state.model={...state.model,provider:item?.provider||state.model.provider,model:item?.name||m,base:item?.base||state.model.base,key:item?.key||state.model.key};
  }
  save();
  closeAllInputPopups();
  renderPage();
}

function selectChatProfile(id){
  const profiles=getProfiles();
  const requested=profiles.find(p=>p.id===id);
  if(requested?.enabled===false){
    toast('这个 Agent 已关闭，不能在对话中启用','info');
    return;
  }
  state.activeProfile=id||'default';
  const p=getActiveProfile();
  const c=currentChat();
  if(c&&!isCliChat(c)){
    c.agentId=p?.id||'';
    c.agentName=p?.name||'';
    apiPut('/api/chats/'+encodeURIComponent(c.id),{agentId:c.agentId,agentName:c.agentName});
  }
  save();
  closeAllInputPopups();
  const popup=$('#chatAgentPopup');
  if(popup) popup.style.display='none';
  toast('已切换 Agent: '+(p?.name||'默认助手'),'success');
  renderPage();
}

function selectedProfileSkills(profile){
  if(!profile) return [];
  const ids=Array.isArray(profile.skillIds)?profile.skillIds:[];
  return (state.skills||[]).filter(s=>ids.includes(s.id));
}

function getEnabledModels(){
  const cfg=state.modelsConfig||{};
  const lib=Array.isArray(cfg.library)?cfg.library:[];
  return lib.filter(m=>m.enabled!==false);
}
function getModelById(id){
  return (state.modelsConfig?.library||[]).find(m=>m.id===id||m.name===id);
}
function scenarioModel(scene){
  const id=state.modelsConfig?.scenarios?.[scene] || state.modelsConfig?.scenarios?.chat || state.model.model || '';
  return getModelById(id)?.name || id || '';
}
function effectiveChatModelName(){
  const p=getActiveProfile();
  if(p?.modelId && p.modelId!=='auto') return getModelById(p.modelId)?.name || p.model || scenarioModel('chat');
  return scenarioModel('chat') || '未配置模型';
}

function benchmarkScore(model){
  const b=model?.benchmark||{};
  if(!b.ok) return Number.POSITIVE_INFINITY;
  return Number(b.firstTokenMs||b.totalMs||999999) + Math.round(Number(b.totalMs||0)*0.15);
}

function fastestBenchmarkedChatModel(){
  return getEnabledModels()
    .filter(m=>m.apiFormat!=='openai-image' && !/image|vision|图像|图片/i.test([m.name,m.provider,...(m.tags||[])].join(' ')))
    .filter(m=>m.benchmark&&m.benchmark.ok)
    .sort((a,b)=>benchmarkScore(a)-benchmarkScore(b))[0]||null;
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
let histPopupSelected=new Set();

function sourceTagClass(src){
  if(!src) return 'other';
  const s=src.toLowerCase();
  if(s.includes('webui')||s.includes('web')) return 'webui';
  if(s.includes('feishu')||s.includes('飞书')||s.includes('lark')) return 'feishu';
  if(s.includes('terminal')||s.includes('终端')||s.includes('cli')) return 'terminal';
  return 'other';
}

function sourceTagLabel(src){
  if(!src) return 'webUI';
  const s=src.toLowerCase();
  if(s.includes('feishu')||s.includes('飞书')||s.includes('lark')) return '飞书';
  if(s.includes('terminal')||s.includes('终端')||s.includes('cli')) return 'CLI';
  if(s.includes('webui')||s.includes('web')) return 'webUI';
  return src;
}

async function refreshChatSources({limit=state.cliSessionLimit||500,keepCurrent=true}={}){
  const [sessions, chats] = await Promise.all([
    apiGet('/api/cli/sessions?limit='+encodeURIComponent(limit)),
    apiGet('/api/chats'),
  ]);
  const previousById = new Map((state.chats || []).map(c => [c.id, c]));
  const webChats = (Array.isArray(chats)?chats:[]).map(c => ({
    id: c.id,
    title: c.title || '新建对话',
    source: c.source || 'WebUI',
    messages: state.chatFullData[c.id]?.messages || [],
    preview: c.preview || '',
    messageCount: c.messageCount || 0,
    updatedAt: c.updatedAt || c.createdAt || Date.now(),
    createdAt: c.createdAt || c.updatedAt || Date.now(),
    readOnly: false,
    pinned: c.pinned !== undefined ? !!c.pinned : !!previousById.get(c.id)?.pinned,
    agentId: c.agentId || '',
  }));
  const previousCliChats = state.chats.filter(c => isCliChat(c));
  const cliSource = Array.isArray(sessions) && sessions.length ? sessions : previousCliChats;
  const cliChats = cliSource.map(s => ({
    id: s.id,
    title: s.title || s.preview || '未命名对话',
    source: s.source || 'cli',
    messages: state.chatFullData[s.id]?.messages || s.messages || [],
    preview: s.preview || '',
    messageCount: s.messageCount || (state.chatFullData[s.id]?.messages || s.messages || []).length || 0,
    updatedAt: s.updatedAt || s.createdAt || Date.now(),
    createdAt: s.createdAt || s.updatedAt || Date.now(),
    readOnly: true,
    pinned: !!previousById.get(s.id)?.pinned,
  }));
  const byId=new Map();
  [...webChats, ...cliChats].forEach(item=>{ if(item&&item.id&&!byId.has(item.id)) byId.set(item.id,item); });
  state.chats=[...byId.values()].sort(compareChatCreatedAsc);
  if(!keepCurrent || !state.chats.some(c=>c.id===state.currentChat)) state.currentChat=state.chats[state.chats.length-1]?.id||null;
  return {web:webChats.length,cli:cliChats.length,total:state.chats.length};
}

function openHistoryPopup(){
  histFilter='all';
  histPopupSelected=new Set();
  const overlay=document.createElement('div');
  overlay.className='history-popup';
  overlay.id='historyOverlay';
  overlay.onclick=e=>{if(e.target===overlay)closeHistoryPopup()};
  overlay.innerHTML=`<div class="history-popup-inner">
    <div class="history-popup-header">
      <h4>历史记录</h4>
      <div class="history-popup-actions">
        <button class="btn btn-xs btn-secondary" onclick="refreshHistorySources()">刷新</button>
        <button class="btn btn-xs btn-secondary" onclick="loadMoreCliHistory()">加载更多</button>
        <button class="btn btn-xs btn-secondary" onclick="histSelectAll()">全选</button>
        <button class="btn btn-xs btn-secondary" id="histDeleteBtn" style="display:none" onclick="deleteSelectedHist()">删除选中</button>
        <button class="history-popup-close" onclick="closeHistoryPopup()">${SVG.x}</button>
      </div>
    </div>
    <div class="history-popup-filter" id="histFilterBar">
      <span class="filter-chip active" onclick="setHistFilter('all')">全部</span>
      <span class="filter-chip" onclick="setHistFilter('webui')">webUI</span>
      <span class="filter-chip" onclick="setHistFilter('feishu')">飞书</span>
      <span class="filter-chip" onclick="setHistFilter('terminal')">CLI</span>
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
    c.classList.toggle('active',c.textContent.trim()===(f==='all'?'全部':f==='webui'?'webUI':f==='feishu'?'飞书':'CLI'));
  });
  refreshHistBody();
}

function toggleHistPopupSelect(id){
  if(histPopupSelected.has(id)) histPopupSelected.delete(id); else histPopupSelected.add(id);
  const btn=$('#histDeleteBtn');
  if(btn) btn.style.display=histPopupSelected.size>0?'inline-flex':'none';
  const item=document.querySelector(`.hist-popup-item[data-id="${id}"]`);
  if(item) item.classList.toggle('selected',histPopupSelected.has(id));
  const cb=item?.querySelector('input[type=checkbox]');
  if(cb) cb.checked=histPopupSelected.has(id);
}

async function deleteSelectedHist(){
  if(histPopupSelected.size===0) return;
  const count=histPopupSelected.size;
  const ok=await askConfirm(`确认处理选中的 ${count} 个会话？终端会话会从 WebUI 隐藏，WebUI 会话会删除。`);
  if(!ok) return;
  for(const id of [...histPopupSelected]) await removeChat(id,{silent:true});
  histPopupSelected.clear();
  const btn=$('#histDeleteBtn');
  if(btn) btn.style.display='none';
  refreshHistBody();
  renderPage();
}

async function deleteSingleHist(id){
  const ok=await askConfirm('确认处理该会话？终端会话会从 WebUI 隐藏，WebUI 会话会删除。');
  if(!ok) return;
  await removeChat(id);
  refreshHistBody();
  renderPage();
}

function refreshHistBody(){
  const body=$('#histBody');
  if(!body) return;
  let chats=[...state.chats].sort(compareChatCreatedAsc);
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
    const readonly=isCliChat(c);
    const sel=histPopupSelected.has(c.id);
    return `<div class="hist-popup-item${sel?' selected':''}" data-id="${c.id}">
      <input type="checkbox" ${sel?'checked':''} onclick="event.stopPropagation();toggleHistPopupSelect('${c.id}')">
      <div class="hist-popup-item-info" onclick="selectChatFromHist('${c.id}')">
        <div class="hist-popup-item-title">${c.pinned?'📌 ':''}${esc(c.title)}</div>
        <div class="hist-popup-item-preview">${esc(lastMsg)}</div>
      </div>
      <div class="hist-popup-item-meta">
        <span class="source-tag ${cls}">${label}</span>
        ${readonly?'<span class="readonly-tag mini">只读</span>':''}
        <button class="hist-row-delete" title="${readonly?'隐藏':'删除'}" onclick="event.stopPropagation();deleteSingleHist('${c.id}')">${readonly?'隐藏':'删除'}</button>
      </div>
    </div>`;
  }).join('');
}

function selectChatFromHist(id){
  closeHistoryPopup();
  selectChat(id);
}

async function refreshHistorySources(){
  const stats=await refreshChatSources({limit:state.cliSessionLimit||500,keepCurrent:true});
  refreshHistBody();
  const sessionItems=$('#sessionItems');
  if(sessionItems) sessionItems.innerHTML=renderSessionList();
  toast(`已刷新历史：WebUI ${stats.web} 个，终端 ${stats.cli} 个`,'success');
}

async function loadMoreCliHistory(){
  state.cliSessionLimit=Math.min((state.cliSessionLimit||500)+500,5000);
  save();
  const stats=await refreshChatSources({limit:state.cliSessionLimit,keepCurrent:true});
  refreshHistBody();
  const sessionItems=$('#sessionItems');
  if(sessionItems) sessionItems.innerHTML=renderSessionList();
  toast(`已加载到最多 ${state.cliSessionLimit} 个终端历史，当前终端 ${stats.cli} 个`,'success');
}

function histSelectAll(){
  const body=$('#histBody');
  if(!body) return;
  const items=body.querySelectorAll('.hist-popup-item');
  const allSelected=items.length>0&&[...items].every(i=>histPopupSelected.has(i.dataset.id));
  items.forEach(item=>{
    const id=item.dataset.id;
    if(allSelected){
      histPopupSelected.delete(id);
      item.classList.remove('selected');
      const cb=item.querySelector('input[type=checkbox]');
      if(cb) cb.checked=false;
    } else {
      histPopupSelected.add(id);
      item.classList.add('selected');
      const cb=item.querySelector('input[type=checkbox]');
      if(cb) cb.checked=true;
    }
  });
  const btn=$('#histDeleteBtn');
  if(btn) btn.style.display=histPopupSelected.size>0?'inline-flex':'none';
}

function renderSessionList(){
  const sorted = [...state.chats].sort(compareChatCreatedAsc);
  const groups={webui:[],terminal:[]};
  sorted.forEach(c=>{
    groups[isCliChat(c)?'terminal':'webui'].push(c);
  });
  let html='';
  const render=(label,list)=>{
    if(!list.length) return '';
    const groupClass=label==='CLI'?' cli':' webui';
    return `<div class="session-group-header${groupClass}"><span class="session-group-label">${label}</span><span class="session-group-count">${list.length}</span></div>`+
      list.map(c=>{
        const readonly=isCliChat(c);
        const preview=c.messages?.length?stripArtifactTagsForPreview(c.messages[c.messages.length-1].content||''):(c.preview||'暂无消息');
        return `<div class="session-item${state.currentChat===c.id?' active':''}">
        <div class="session-item-body" onclick="selectChat('${c.id}')">
          <div class="session-card-main">
            <div class="session-card-top">
              <span class="s-title">${c.pinned?'📌 ':''}${esc(c.title)}</span>
            </div>
            <span class="s-preview">${esc(preview)}</span>
          </div>
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
              ${readonly?'隐藏':'删除'}
            </button>
          </div>
        </div>
      </div>`}).join('');
  };
  html+=render('webUI',groups.webui);
  html+=render('CLI',groups.terminal);
  return html||'<div class="empty-state" style="padding:40px 0"><span>暂无会话</span></div>';
}

function chatCreatedTime(c){
  const n=Number(c?.createdAt||0);
  return Number.isFinite(n)&&n>0?n:Number(c?.updatedAt||0)||0;
}

function compareChatCreatedAsc(a,b){
  if(!!b?.pinned!==!!a?.pinned) return b?.pinned?1:-1;
  const diff=chatCreatedTime(a)-chatCreatedTime(b);
  if(diff) return diff;
  return String(a?.id||'').localeCompare(String(b?.id||''));
}

function sessionAgentForChat(c){
  const profiles=getProfiles();
  const id=c?.agentId||state.chatFullData?.[c?.id]?.agentId||'';
  return profiles.find(p=>p.id===id) || getActiveProfile();
}

function sessionModelForChat(c,agent){
  if(isCliChat(c)) return c?._model||c?.model||'CLI';
  if(c?._model||c?.model) return c._model||c.model;
  if(agent?.modelId&&agent.modelId!=='auto') return getModelById(agent.modelId)?.name||agent.model||scenarioModel('chat');
  return scenarioModel('chat')||state.model.model||'自动';
}

function stripArtifactTagsForPreview(raw){
  const s=redactSecrets(String(raw||''));
  if(!s||typeof HermesArtifact==='undefined') return s.slice(0,90);
  const p=HermesArtifact.parseHermesStream(s);
  const v=(p.visibleText||'').trim();
  if(!v&&(p.completedArtifacts||[]).length)return '[Artifact]';
  return redactSecrets(v).slice(0,90);
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
    const upd=list.length>1?'<span class="artifact-ref-badge">已更新</span>':'';
    const safe=encodeURIComponent(t);
    return `<button type="button" class="artifact-ref-chip" onclick="HermesArtifact.openRef(decodeURIComponent('${safe}'))">
      <span class="artifact-ref-icon" aria-hidden="true">${SVG.file}</span>
      <span class="artifact-ref-main">
        <strong>${esc(t)}${upd}</strong>
        <small>Document · MD</small>
      </span>
      <span class="artifact-ref-action">查看</span>
    </button>`;
  }).join('')+'</div>';
}

function buildPreviewActionHtml(rawContent){
  return '';
}

function processEventText(event){
  const type=String(event?.type||event?.stage||'');
  const name=String(event?.name||'');
  const ms=Number(event?.ms||event?.elapsed||0);
  const suffix=ms?` · ${ms}ms`:'';
  if(type==='queued') return '已发送请求，等待后端接收';
  if(type==='sse-flushed') return `后端已建立流式连接${suffix}`;
  if(type==='route-selected') return event?.route==='direct' ? '已选择直连模型通道' : '已选择 Hermes Agent 通道';
  if(type==='model-fallback') return `主模型失败，切换备用模型${event?.to?`：${event.to}`:''}`;
  if(type==='hermes-api-connect') return '正在连接 Hermes API Server';
  if(type==='hermes-api-failed') return `Hermes API Server 不可用，准备回退 CLI${event?.reason?`：${event.reason}`:''}`;
  if(type==='route-fallback') return event?.route==='hermes-cli' ? '已回退 Hermes CLI 通道' : '直连不可用，已回退 Hermes Agent';
  if(type==='agent-ask') return `Agent 需要用户确认${event?.title?`：${event.title}`:''}`;
  if(type==='agent-ask-result') return event?.status==='answered' ? '已收到用户确认，继续执行' : `用户确认未完成：${event?.status||'unknown'}`;
  if(type==='skill-match') return event?.items?.length ? `命中 Skill：${event.items.map(item=>item.trigger?`${item.name}（${item.trigger}）`:item.name).join('、')}` : (event?.names?.length ? `命中 Skill：${event.names.join('、')}` : '本次未命中专用 Skill');
  if(type==='first-hermes-event') return `收到模型/Agent 首个事件${event?.eventType?`：${event.eventType}`:''}${suffix}`;
  if(type==='first-cli-stdout') return `Hermes CLI 开始输出${suffix}`;
  if(type==='first-token') return `收到首个回复 token${suffix}`;
  if(type==='tool-start') return `调用工具：${name||'未命名工具'}`;
  if(type==='tool-done') return `${event?.error?'工具失败':'工具完成'}：${name||'未命名工具'}`;
  if(type==='done') return `回复完成${suffix}`;
  if(type==='error') return `发生错误：${event?.message||'请求失败'}`;
  if(type==='aborted') return '任务已终止';
  if(type) return `执行事件：${type}${suffix}`;
  return '';
}

function renderThinkingPanel(m,idPrefix){
  if(!m||m.role!=='assistant') return '';
  const tagThink=typeof HermesArtifact!=='undefined'?HermesArtifact.parseHermesStream(m.content||'').think:'';
  const rawThink=cleanThinkingContent([m.thinking||m.reasoning||'',tagThink].filter(Boolean).join('\n---\n'));
  const cleanContent=(m.content||'').replace(/<(?:redacted_thinking|think)>[\s\S]*?<\/(?:redacted_thinking|think)>/gi,'').trim();
  const skipThink=rawThink&&cleanContent&&rawThink.trim().length>20&&cleanContent.includes(rawThink.trim().slice(0,40));
  const processLines=(Array.isArray(m.processEvents)?m.processEvents:[]).map(processEventText).filter(Boolean);
  const hasRealThink=Boolean(rawThink&&!skipThink);
  const body=hasRealThink?rawThink:processLines.map((line,i)=>`${i+1}. ${line}`).join('\n');
  if(!body) return '';
  const id='th_'+(idPrefix||m._msgId||(m.ts||Date.now()))+'_'+(m.ts||0);
  const duration=m.thinkingDuration?` · ${m.thinkingDuration}ms`:'';
  const isStreaming=!!m._streaming;
  const label=hasRealThink?(isStreaming?'模型推理中':'模型推理'):(isStreaming?'执行中':'执行过程');
  return `<div class="msg-thinking">
      <div class="msg-thinking-header" onclick="toggleAllThinking('${id}')">
        <svg class="thinking-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8.5 3.8 7.4 6.2 5 7.3l2.4 1.1 1.1 2.4 1.1-2.4L12 7.3 9.6 6.2 8.5 3.8Z"/><path d="M15.8 10.5 14.4 14l-3.4 1.4 3.4 1.4 1.4 3.4 1.4-3.4 3.4-1.4-3.4-1.4-1.4-3.5Z"/></svg>
        <span class="thinking-label">${label}${isStreaming?'<span class="thinking-dots"><span></span><span></span><span></span></span>':''}</span>
        <span class="thinking-duration">${duration}</span>
        <span class="thinking-toggle collapsed" id="toggle_${id}">▶</span>
      </div>
      <div class="msg-thinking-body collapsed" id="body_${id}">${esc(body)}</div>
    </div>`;
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
  }
  if(typeof HermesArtifact.openEmpty==='function') HermesArtifact.openEmpty('暂无可预览文件','当前对话还没有输出可预览的本地 Markdown / Artifact 文件。');
}

function openKnowledgePanel(){
  if(typeof HermesArtifact==='undefined') return;
  try{
    if(typeof HermesArtifact.showHistory==='function'){
      HermesArtifact.setLayout('split');
      HermesArtifact.showHistory();
    }else{
      openLatestPreviewPanel();
    }
  }catch(_){}
}

function renderMsg(m){
  let thinkingHtml=renderThinkingPanel(m);
  let toolCallsHtml='';
  if(m.toolCalls&&m.toolCalls.length>0){
    toolCallsHtml='<div class="msg-tool-calls">'+m.toolCalls.map((tc,i)=>{
      const id='tc_'+(m.ts||Date.now())+'_'+i;
      const statusCls=tc.status==='success'?'success':tc.status==='error'?'error':'running';
      const statusText=tc.status==='success'?'完成':tc.status==='error'?'失败':'运行中';
      let bodyHtml='';
      if(tc.input) bodyHtml+=`<div class="tool-input">输入\n${esc(typeof tc.input==='string'?tc.input:JSON.stringify(tc.input,null,2))}</div>`;
      if(tc.output) bodyHtml+=`<div class="tool-output">输出\n${esc(typeof tc.output==='string'?tc.output:JSON.stringify(tc.output,null,2))}</div>`;

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
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5h16"/><path d="M7.5 4v7"/><path d="m4 16 4-4 4 4"/><path d="m12 16 4-4 4 4"/></svg>
          <span class="tool-name">${esc(tc.name)}</span>
          <span class="tool-status ${statusCls}">${statusText}</span>
          ${previewBtn}
          <span class="tool-toggle collapsed" id="toggle_${id}">▼</span>
        </div>
        <div class="msg-tool-call-body collapsed" id="body_${id}">${bodyHtml}</div>
      </div>`;
    }).join('')+'</div>';
  }
  let stepHtml='';
  if(m.step) stepHtml=`<div class="msg-step-indicator">Step ${m.step}</div>`;
  const msgId = m._msgId || String(m.ts || m.id || Date.now());
  if (!m._msgId) m._msgId = msgId;
  // Clean content: remove model normalization warnings
  let content = cleanMessageContent(m.content || '');
  if(m.role==='assistant' && m.imageGeneration?.outputs?.length){
    content=generatedImageMarkdown(m.imageGeneration.outputs);
  }
  content = content.replace(/⚠️\s*Normalized model.*?for deepseek\.?\n?/g, '');
  content = content.replace(/⚠\s*Normalized model.*?for deepseek\.?\n?/g, '');

  // Hide ask_user block or raw JSON block
  if (content.includes('<ask_user>')) {
    content = content.replace(/<ask_user>[\s\S]*?(<\/ask_user>|$)/g, '').trim();
    if (!content) content = '📋 需要你确认...';
  } else if (content.match(/```json\s*[\s\S]*?"question"[\s\S]*?"options"[\s\S]*?```/i)) {
    content = content.replace(/```json\s*[\s\S]*?"question"[\s\S]*?"options"[\s\S]*?```/i, '').trim();
    if (!content) content = '📋 需要你确认...';
  } else if (content.match(/\{[\s\S]*"question"[\s\S]*"options"[\s\S]*\}/)) {
    content = content.replace(/\{[\s\S]*"question"[\s\S]*"options"[\s\S]*\}/, '').trim();
    if (!content) content = '📋 需要你确认...';
  }

  let artifactRefsHtml='';
  let previewActionHtml='';
  let fileCardsHtml='';
  if(m.role==='assistant'&&typeof HermesArtifact!=='undefined'){
    const p=HermesArtifact.parseHermesStream(content);
    let vis=(p.visibleText||'').trim();
    const mdCount=(p.completedArtifacts||[]).filter(a=>String(a?.attrs?.type||'markdown').toLowerCase()==='markdown').length;
    if(!vis&&(p.activeArtifact||(p.completedArtifacts||[]).length))vis=mdCount?'':'已为你生成文件，可在右侧面板或下方引用查看。';
    content=vis;
    artifactRefsHtml=buildArtifactRefHtml(p);
    // 有简单 chip 时隐藏上方的富卡片，保留小卡片即可
    fileCardsHtml=artifactRefsHtml?'':renderMarkdownFileCards(m);
    previewActionHtml=buildPreviewActionHtml(m.content||content);
  }
  const modelBadge = '';
  const isLongUserMessage=m.role==='user' && (String(content||'').length>900 || String(content||'').split(/\r?\n/).length>14);
  const longClass=isLongUserMessage?' user-long-collapsed':'';
  const expandBtn=isLongUserMessage?`<button type="button" class="msg-expand-btn" onclick="toggleUserMessageExpand('${esc(msgId)}')">查看全部</button>`:'';
  // Streaming dots at bottom of content
  const imagePromptHtml = m.role==='assistant' && m.imageGeneration ? renderImagePromptPanel(m.imageGeneration) : '';
  const imageLoadingHtml = m.role==='assistant' && m._streaming && m.imageGeneration?.status==='loading' ? renderImageGenerationLoadingCard(m.imageGeneration) : '';
  const streamDots = m._streaming && !imageLoadingHtml ? '<span class="msg-streaming"><span></span><span></span><span></span></span>' : '';
  return `<div class="msg ${m.role} animate-in" id="msg_${msgId}">
    <div class="msg-main">
      ${thinkingHtml}
      ${toolCallsHtml}
      <div class="msg-bubble markdown-body${longClass}">${stepHtml}${imageLoadingHtml}${imagePromptHtml}${content?formatMsg(content):''}${renderMessageAttachments(m.attachments)}${fileCardsHtml}${artifactRefsHtml}${previewActionHtml}${modelBadge}${streamDots}${expandBtn}</div>
      ${renderMessageActions(m)}
    </div>
  </div>`;
}

function toggleUserMessageExpand(msgId){
  const el=document.getElementById('msg_'+msgId);
  const bubble=el?.querySelector('.msg-bubble');
  const btn=el?.querySelector('.msg-expand-btn');
  if(!bubble||!btn) return;
  const expanded=bubble.classList.toggle('expanded');
  btn.textContent=expanded?'收起':'查看全部';
}

function toggleCollapse(id){
  const body=document.getElementById('body_'+id);
  const toggle=document.getElementById('toggle_'+id);
  if(body&&toggle){
    body.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
  }
}

function toggleAllThinking(id){
  const clicked=document.getElementById('body_'+id);
  const toggle=document.getElementById('toggle_'+id);
  if(clicked) clicked.classList.toggle('collapsed');
  if(toggle) toggle.classList.toggle('collapsed');
}
function cleanMessageContent(raw){
  let content = redactSecrets(raw || '');
  content = content.replace(/(?:^|\n)\s*↻\s*Resumed session\s+[A-Za-z0-9_-]+\s*\(\d+\s+user messages?,\s*\d+\s+total messages?\)\s*(?=\n|$)/gi, '\n');
  content = content.replace(/⚠️\s*Normalized model.*?for deepseek\.?\n?/g, '');
  content = content.replace(/⚠\s*Normalized model.*?for deepseek\.?\n?/g, '');
  content = content.replace(/(?:^|\n)\s*(?:文件位置|本地路径)：[\s\S]*?(?=\n\s*\n|$)/g, '');
  content = content.replace(/(?:^|\n)\s*[-*]\s*(?:文件位置|本地路径)：?.*?(?=\n|$)/g, '');
  content = content.replace(/```(?:diff|patch)[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?```/gi, '').trim();
  content = content.replace(/```(?:python|py)[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?```/gi, '').trim();
  content = content.replace(/(?:^|\n)\s*[`|¦]\s*review diff[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?(?=\n\s*\n|$)/gi, '').trim();
  content = content.replace(/(?:^|\n)\s*[`|¦]?\s*review diff[\s\S]*?(?:\.\.\. omitted \d+ diff line\(s\)[^\n]*|(?=\n\s*<artifact\b)|$)/gi, '\n').trim();
  content = content.replace(/(?:^|\n)\s*(?:a\/mnt\/|b\/mnt\/|@@\s|[+]\s?#|[+]\s?>|[+]\s?\*\*\*|[+]\s?⚠)[\s\S]*?(?:\.\.\. omitted \d+ diff line\(s\)[^\n]*|(?=\n\s*<artifact\b)|$)/gi, '\n').trim();
  content = content.replace(/(?:^|\n)\s*\+\s*(?:import requests|URL\s*=|PAYLOAD\s*=|r\s*=|outputs\s*=|if outputs|for o in outputs)[\s\S]*?(?=\n\s*\n|$)/gi, '').trim();
  return content.trim();
}

function cleanThinkingContent(raw){
  let content=redactSecrets(raw||'');
  content = content.replace(/```(?:diff|patch)[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?```/gi, '').trim();
  content = content.replace(/```(?:python|py)[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?```/gi, '').trim();
  content = content.replace(/(?:^|\n)\s*[`|¦]\s*review diff[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*/gi, '').trim();
  content = content.replace(/(?:^|\n)\s*(?:a\/tmp\/|b\/tmp\/|@@|\+{1,3}|- {0,1}).*(?:gen_|api\/images\/generate|requests\.post|PAYLOAD|outputs)/gi, '').trim();
  return content.trim();
}

function renderMessageMarkdown(text){
  const raw=stripLooseMarkdownMeta(String(text||''));
  if(typeof marked!=='undefined'&&marked&&typeof marked.parse==='function'){
    try{
      return marked.parse(raw,{breaks:true}).replace(/(<img\b[^>]*\bsrc=["'])(\/api\/[^"']+)(["'][^>]*>)/gi,(m,p,u,s)=>p+esc(mediaUrl(u))+s);
    }catch(_){ }
  }
  return `<pre>${esc(raw)}</pre>`;
}

function stripLooseMarkdownMeta(markdown){
  let text=String(markdown||'').replace(/^\uFEFF/,'').trimStart();
  text=text.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/,'');
  const lines=text.split(/\r?\n/);
  const metaRe=/^(title|folder|type|tags|status|summary|createdBy|created|updated|source)\s*:/i;
  let index=0;
  let consumed=false;
  while(index<lines.length && (metaRe.test(lines[index].trim()) || (!lines[index].trim() && consumed))){
    if(metaRe.test(lines[index].trim())) consumed=true;
    index++;
  }
  if(consumed) text=lines.slice(index).join('\n').trimStart();
  return text;
}

async function writeClipboardText(value){
  const text=String(value||'');
  if(!text) return false;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(_){}
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.setAttribute('readonly','');
  ta.style.position='fixed';
  ta.style.left='-9999px';
  ta.style.top='0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0,ta.value.length);
  let ok=false;
  try{ok=document.execCommand('copy')}catch(_){ok=false}
  ta.remove();
  return ok;
}

function getMessageKey(msg){
  return String(msg?._msgId || msg?.id || msg?.ts || '');
}

function getAssistantRenderData(msg){
  const raw = cleanMessageContent(msg?.content || '');
  const parsed = typeof HermesArtifact !== 'undefined' ? HermesArtifact.parseHermesStream(raw) : null;
  const visible = parsed ? (parsed.visibleText || '').trim() : raw.trim();
  const artifacts = parsed ? (parsed.completedArtifacts || []) : [];
  const markdownArtifacts = artifacts.filter(a => String(a?.attrs?.type || 'markdown').toLowerCase() === 'markdown');
  return { raw, parsed, visible, artifacts, markdownArtifacts };
}

function openMarkdownArtifact(encodedTitle){
  if(typeof HermesArtifact==='undefined') return;
  const title=decodeURIComponent(encodedTitle||'');
  if(!title) return;
  HermesArtifact.openRef(title);
}

function renderMarkdownFileCards(msg){
  return '';
}

function getMessageCopyText(msg){
  const data = getAssistantRenderData(msg);
  if (data.markdownArtifacts.length) return String(data.markdownArtifacts[0]?.content || data.visible || data.raw || '');
  return String(data.visible || data.raw || '');
}

function getMessageFeedbackValue(msg){
  return msg?.feedback?.value || msg?.feedback || '';
}

async function sendMessageFeedback(chatId, msgKey, feedback){
  const value = feedback === 'like' ? 'like' : feedback === 'dislike' ? 'dislike' : '';
  if (!chatId || !msgKey || !value) return false;
  const data = await apiPost(`/api/chats/${encodeURIComponent(chatId)}/messages/feedback`, { msgId: msgKey, feedback: value });
  return Boolean(data);
}

function renderMessageActions(m){
  if (!m || m.role !== 'assistant') return '';
  const active = getMessageFeedbackValue(m);
  const key = getMessageKey(m);
  const chatId = esc(currentChat()?.id || currentChat()?._id || '');
  const likeActive = active === 'like' ? ' active' : '';
  const dislikeActive = active === 'dislike' ? ' active' : '';
  return `<div class="msg-actions" data-msg-key="${esc(key)}">
    <button type="button" class="msg-action-btn" onclick="copyMessageContent('${esc(key)}')" title="复制" aria-label="复制">${COPY_ICON}</button>
    <button type="button" class="msg-action-btn like-action${likeActive}" onclick="setMessageFeedback('${chatId}','${esc(key)}','like')" title="喜欢" aria-label="喜欢">${likeActive ? LIKE_FILLED_ICON : LIKE_ICON}</button>
    <button type="button" class="msg-action-btn dislike-action${dislikeActive}" onclick="setMessageFeedback('${chatId}','${esc(key)}','dislike')" title="不喜欢" aria-label="不喜欢">${dislikeActive ? DISLIKE_FILLED_ICON : DISLIKE_ICON}</button>
  </div>`;
}

async function copyMessageContent(msgKey){
  const chat=currentChat();
  const msg=(chat?.messages||[]).find(item=>getMessageKey(item)===String(msgKey));
  if(!msg) return;
  copyText(getMessageCopyText(msg), '已复制消息');
}

async function setMessageFeedback(chatId, msgKey, feedback){
  const chat=currentChat();
  if (!chat || String(chat.id || chat._id || '') !== String(chatId || '')) return;
  const msg=(chat.messages||[]).find(item=>getMessageKey(item)===String(msgKey));
  if (!msg || msg.role !== 'assistant') return;
  msg.feedback = { value: feedback === 'like' ? 'like' : 'dislike', updatedAt: Date.now() };
  save();
  renderPage();
  sendMessageFeedback(chatId, msgKey, feedback).catch(()=>{});
}

const COPY_ICON=namedSvg('复制',15,'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>');
const LIKE_ICON=namedSvg('赞',18,'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7.25 10.25V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.25 10.25L10.2 4.9C10.7 4 12 4.35 12 5.38V8.25H17.7C19.02 8.25 20.02 9.44 19.79 10.74L18.66 17.24C18.48 18.25 17.6 19 16.57 19H9.3C8.17 19 7.25 18.08 7.25 16.95V10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.2 10.25H7.25V19H4.2C3.54 19 3 18.46 3 17.8V11.45C3 10.79 3.54 10.25 4.2 10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
const DISLIKE_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g transform="rotate(180 12 12)"><path d="M7.25 10.25V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.25 10.25L10.2 4.9C10.7 4 12 4.35 12 5.38V8.25H17.7C19.02 8.25 20.02 9.44 19.79 10.74L18.66 17.24C18.48 18.25 17.6 19 16.57 19H9.3C8.17 19 7.25 18.08 7.25 16.95V10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.2 10.25H7.25V19H4.2C3.54 19 3 18.46 3 17.8V11.45C3 10.79 3.54 10.25 4.2 10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
const LIKE_FILLED_ICON=LIKE_ICON;
const DISLIKE_FILLED_ICON=DISLIKE_ICON;
const FILE_LOCATION_ICON='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 15h8"/><path d="M8 18h5"/></svg>';

function normalizeMediaRef(value){
  const text=String(value||'').trim();
  if(!text) return '';
  try{
    const u=new URL(mediaUrl(text),window.location.href);
    return u.pathname.replace(/\/+$/,'').toLowerCase();
  }catch(_){
    return text.split('?')[0].replace(/\/+$/,'').toLowerCase();
  }
}

function imagePathForSrc(src){
  const key=normalizeMediaRef(src);
  if(!key) return '';
  const chats=state.chats||[];
  for(const chat of chats){
    for(const msg of (chat.messages||[])){
      const groups=[
        ...(msg.imageGeneration?.outputs||[]),
        ...(msg.imageGeneration?.inputs||[]),
        ...(msg.attachments||[]),
      ];
      for(const item of groups){
        const urls=[item.url,item.publicUrl].filter(Boolean);
        if(urls.some(u=>normalizeMediaRef(u)===key)) return item.path||'';
      }
    }
  }
  for(const msg of (currentChat()?.messages||[])){
    const groups=[
      ...(msg.imageGeneration?.outputs||[]),
      ...(msg.imageGeneration?.inputs||[]),
      ...(msg.attachments||[]),
    ];
    for(const item of groups){
      const urls=[item.url,item.publicUrl].filter(Boolean);
      if(urls.some(u=>normalizeMediaRef(u)===key)) return item.path||'';
    }
  }
  return '';
}

function imageRecordForSrc(src){
  const key=normalizeMediaRef(src);
  if(!key) return null;
  const chats=[...(state.chats||[])];
  const cur=currentChat();
  if(cur && !chats.some(chat=>String(chat.id||chat._id||'')===String(cur.id||cur._id||''))) chats.unshift(cur);
  for(const chat of chats){
    for(const msg of (chat.messages||[])){
      const groups=[
        ...(msg.imageGeneration?.outputs||[]).map(item=>({item,kind:'output',prompt:msg.imageGeneration?.prompt||'',sourcePrompt:msg.imageGeneration?.sourcePrompt||''})),
        ...(msg.imageGeneration?.inputs||[]).map(item=>({item,kind:'input',prompt:msg.imageGeneration?.prompt||'',sourcePrompt:msg.imageGeneration?.sourcePrompt||''})),
        ...(msg.attachments||[]).map(item=>({item,kind:item.kind||'input',prompt:'',sourcePrompt:''})),
      ];
      for(const group of groups){
        const item=group.item||{};
        const urls=[item.url,item.publicUrl].filter(Boolean);
        if(urls.some(u=>normalizeMediaRef(u)===key)){
          return {
            id:item.id,
            name:item.name||item.originalName||'参考图片',
            url:item.url||item.publicUrl||src,
            publicUrl:item.publicUrl||item.url||src,
            path:item.path||'',
            kind:group.kind,
            prompt:group.prompt||item.prompt||'',
            sourcePrompt:group.sourcePrompt||'',
          };
        }
      }
    }
  }
  return null;
}

function useImageAsEditReference(src){
  const record=imageRecordForSrc(src);
  if(!record?.id){
    toast('没有找到这张图片的本地记录，无法作为二次编辑参考','error');
    return;
  }
  state.imageEditReference={...record,kind:'output'};
  if(!(state.pendingImageAttachments||[]).some(img=>img.id===record.id)){
    state.pendingImageAttachments=(state.pendingImageAttachments||[]).filter(img=>img.id!==record.id);
  }
  save();
  updatePendingImageStripOnly();
  const ta=$('#chatInput');
  if(ta){
    if(!String(ta.value||'').trim()) ta.value=IMAGE_PROMPT_PREFIX;
    ta.focus();
    autoResizeInput(ta);
  }
  toast('已引用这张图，下一次生图会进行二次编辑','success');
}

function enhanceMessageMarkdown(root){
  if(!root) return;
  if(typeof hljs!=='undefined'&&hljs){
    root.querySelectorAll('pre code').forEach(code=>{
      try{hljs.highlightElement(code);}catch(_){ }
    });
  }
  root.querySelectorAll('table').forEach(table=>{
    if(table.parentElement?.classList.contains('md-table-scroll')) return;
    const wrapper=document.createElement('div');
    wrapper.className='md-table-scroll';
    table.parentNode.insertBefore(wrapper,table);
    wrapper.appendChild(table);
    wrapper.addEventListener('wheel',(event)=>{
      if(Math.abs(event.deltaY)<=Math.abs(event.deltaX)) return;
      const scroller=wrapper.closest('.messages-area,.artifact-body,.artifact-history,.artifact-preview,.modal') || document.scrollingElement;
      if(!scroller || scroller===wrapper) return;
      scroller.scrollTop += event.deltaY;
      event.preventDefault();
    },{passive:false});
  });
  root.querySelectorAll('img').forEach(img=>{
    if(img.closest('.image-preview-wrap')) return;
    const src=img.getAttribute('src')||'';
    const alt=img.getAttribute('alt')||'图片';
    const wrapper=document.createElement('span');
    wrapper.className='image-preview-wrap';
    const declaredWidth=img.getAttribute('width')||img.style.width||'';
    if(declaredWidth) wrapper.style.width=declaredWidth;
    img.parentNode.insertBefore(wrapper,img);
    wrapper.appendChild(img);
    const parent=wrapper.parentElement;
    if(parent?.tagName==='P' && parent.textContent.trim()==='') parent.classList.add('image-only-block');
    img.style.cursor='zoom-in';
    img.style.display='block';
    img.onclick=()=>openImagePreview(src,alt);
    const bar=document.createElement('span');
    bar.className='image-preview-actions';
    const localPath=imagePathForSrc(src);
    const canEdit=Boolean(imageRecordForSrc(src)?.id);
    bar.innerHTML=`<button type="button" title="二次编辑" aria-label="二次编辑" ${canEdit?'':'disabled'}>${SVG.image}</button><button type="button" title="复制图片" aria-label="复制图片">${COPY_ICON}</button><button type="button" title="打开所在文件夹" aria-label="打开所在文件夹" ${localPath?'':'disabled'}>${FILE_LOCATION_ICON}</button>`;
    const buttons=bar.querySelectorAll('button');
    buttons[0].onclick=(event)=>{event.stopPropagation();canEdit?useImageAsEditReference(src):toast('没有找到这张图片的本地记录','info')};
    buttons[1].onclick=(event)=>{event.stopPropagation();copyImageFromUrl(src)};
    buttons[2].onclick=(event)=>{event.stopPropagation();localPath?openImageLocation(localPath):toast('没有找到本地文件位置','info')};
    wrapper.appendChild(bar);
  });
  groupImageOnlyBlocks(root);
  root.querySelectorAll('pre').forEach(pre => {
    if (pre.classList.contains('image-prompt-code')) return;
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
    btn.onclick = async () => {
      const text = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
      if (await writeClipboardText(text)) {
        const old = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => btn.innerHTML = old, 2000);
      } else {
        toast('复制失败','error');
      }
    };
    wrapper.appendChild(btn);
  });
}

function groupImageOnlyBlocks(root){
  if(!root) return;
  const flush=(items)=>{
    if(items.length<2) return;
    const grid=document.createElement('div');
    grid.className='image-preview-grid';
    items[0].parentNode.insertBefore(grid,items[0]);
    items.forEach(item=>grid.appendChild(item));
  };
  let run=[];
  Array.from(root.children).forEach(child=>{
    if(child.classList?.contains('image-preview-grid')) return;
    if(child.classList?.contains('image-only-block') && !child.closest('.image-preview-grid')){
      run.push(child);
      return;
    }
    flush(run);
    run=[];
  });
  flush(run);
}

function formatMsg(text){
  return renderMessageMarkdown(text);
}

async function copyText(text,msg='已复制'){
  const value=String(text||'');
  if(!value) return;
  const ok=await writeClipboardText(value);
  toast(ok ? msg : '复制失败', ok ? 'success' : 'error');
}

async function openImageLocation(localPath){
  try{
    const data=await apiPost('/api/system/open-path',{path:localPath});
    if(data) toast('已打开图片所在位置','success');
    else toast('打开文件位置失败','error');
  }catch(_){
    toast('打开文件位置失败','error');
  }
}

async function copyImageFromUrl(src){
  const url=mediaUrl(src);
  try{
    const resp=await fetch(url,{cache:'no-store'});
    const blob=await resp.blob();
    if(navigator.clipboard&&window.ClipboardItem){
      let copyBlob=blob;
      let mime=blob.type||'image/png';
      if(mime!=='image/png'){
        try{
          const bitmap=await createImageBitmap(blob);
          const canvas=document.createElement('canvas');
          canvas.width=bitmap.width;
          canvas.height=bitmap.height;
          const ctx=canvas.getContext('2d');
          ctx.drawImage(bitmap,0,0);
          copyBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          mime='image/png';
        }catch(_){}
      }
      if(!copyBlob) throw new Error('copy failed');
      await navigator.clipboard.write([new ClipboardItem({[mime]:copyBlob})]);
      toast('图片已复制','success');
      return;
    }
  }catch(_){}
  copyText(url,'当前浏览器不支持直接复制图片，已复制图片地址');
}

function toggleImageZoom(el,event){
  if(event) event.stopPropagation();
  if(!el) return;
  el.classList.toggle('zoomed');
  el.style.cursor=el.classList.contains('zoomed')?'zoom-out':'zoom-in';
}

function openImagePreview(src,alt='图片'){
  const safeSrc=esc(mediaUrl(src));
  openModal(`<div class="image-lightbox" onclick="closeModal()">
    <button class="image-lightbox-close" onclick="event.stopPropagation();closeModal()" aria-label="关闭">${SVG.x}</button>
    <img src="${safeSrc}" alt="${esc(alt||'图片')}" onclick="toggleImageZoom(this,event)">
  </div>`,{className:'image-lightbox-shell'});
}

function currentChat(){return state.chats.find(c=>c.id===state.currentChat)}
function currentChatFull(){return state.chatFullData[state.currentChat]}
function isCliChat(c){
  return !!c && (((c.source||'').toLowerCase()==='cli') || sourceTagClass(c.source||'')==='terminal' || c.readOnly);
}

async function removeChat(id,{silent=false}={}){
  const c=state.chats.find(x=>x.id===id);
  const cli=isCliChat(c);
  const endpoint=cli?'/api/cli/sessions/':'/api/chats/';
  const ok=await apiDel(endpoint+encodeURIComponent(id));
  if(!ok && !cli){
    toast('删除失败，请检查后端连接', 'error');
    return false;
  }
  state.chats=state.chats.filter(x=>x.id!==id);
  delete state.chatFullData[id];
  if(state.currentChat===id) state.currentChat=state.chats.sort(compareChatCreatedAsc)[state.chats.length-1]?.id||null;
  if(!silent) toast(cli?'已从 WebUI 隐藏该终端会话':'已删除', 'info');
  return true;
}

async function syncCurrentChat(chatId){
  try{
    const c=state.chats.find(x=>x.id===chatId);
    const endpoint=isCliChat(c)?'/api/cli/sessions/':'/api/chats/';
    const data=await apiGet(endpoint+encodeURIComponent(chatId));
    if(data&&data.id){
      const idx=state.chats.findIndex(c=>c.id===chatId);
      if(idx>=0){
        state.chats[idx].title=data.title;
        state.chats[idx].updatedAt=data.updatedAt;
        state.chats[idx].createdAt=data.createdAt||state.chats[idx].createdAt;
        state.chats[idx].preview=data.preview||state.chats[idx].preview;
        state.chats[idx].readOnly=!!data.readOnly;
        state.chats[idx].source=data.source||state.chats[idx].source;
        state.chats[idx].messages=data.messages||[];
        state.chats[idx].messageCount=(data.messages||[]).length;
      }
      state.chatFullData[chatId]=data;
      state.chats.sort(compareChatCreatedAsc);
      const sessionItems=$('#sessionItems');
      if(sessionItems) sessionItems.innerHTML=renderSessionList();
    }
  }catch(e){}
}

async function newChat(){
  const profile=getActiveProfile();
  const data = await apiPost('/api/chats', { title: '新建对话', agentId: profile?.id||'', agentName: profile?.name||'' });
  if (data) {
    state.chats.push({ id: data.id, title: data.title, source:data.source||'WebUI', messages: [], updatedAt: data.updatedAt, createdAt:data.createdAt, agentId: profile?.id||'' });
    state.chatFullData[data.id] = data;
    state.currentChat = data.id;
    state._artifactNeedsHydrate = true;
  } else {
    // fallback: local-only
    const c = { id: 'c'+Date.now(), title: '新建对话', source:'WebUI', messages: [], updatedAt: Date.now(), createdAt:Date.now(), agentId: profile?.id||'' };
    state.chats.push(c);
    state.currentChat = c.id;
    state._artifactNeedsHydrate = true;
  }
  renderPage();
}

async function selectChat(id){
  const sessionScrollTop=$('#sessionItems')?.scrollTop || 0;
  const artifactShell=document.querySelector('#artifactShell.open');
  const artifactHistory=document.querySelector('#artifactHistory');
  const keepKnowledgeOpen=!!(artifactShell && artifactHistory && getComputedStyle(artifactHistory).display!=='none');
  state.currentChat = id;
  state._artifactNeedsHydrate = true;
  if (typeof HermesArtifact !== 'undefined') {
    try {
      if (keepKnowledgeOpen) state._keepKnowledgeOpen = true;
      else { HermesArtifact.resetSession(); HermesArtifact.setLayout('chat'); }
    } catch (_) {}
  }
  // Load full chat data from backend if not cached
  if (!state.chatFullData[id]) {
    // Check if this is a CLI session or WebUI chat
    const c = state.chats.find(x => x.id === id);
    const endpoint = isCliChat(c) ? '/api/cli/sessions/' : '/api/chats/';
    const data = await apiGet(endpoint + encodeURIComponent(id));
    if (data) {
      state.chatFullData[id] = data;
      // Sync messages into local chat object
      if (c) {
        c.title = data.title || c.title;
        c.source = data.source || c.source;
        c.preview = data.preview || c.preview;
        c.createdAt = data.createdAt || c.createdAt;
        c.updatedAt = data.updatedAt || c.updatedAt;
        c.readOnly = !!data.readOnly;
        c.agentId = data.agentId || c.agentId || '';
        c.agentName = data.agentName || c.agentName || '';
        c.messageCount = data.messageCount || (data.messages||[]).length;
        c.messages = data.messages || [];
        c._model = data.model || state.model.model;
        // Propagate model to each assistant message
        c.messages.forEach(m => {
          if (m.role === 'assistant') m._model = c._model;
        });
      }
    }
  }
  const selected=state.chats.find(x=>x.id===id);
  const agentId=selected?.agentId||state.chatFullData[id]?.agentId||'';
  if(agentId){
    const p=getProfiles().find(x=>x.id===agentId&&x.enabled!==false);
    if(p) state.activeProfile=p.id;
  }
  renderPage();
  requestAnimationFrame(()=>{
    const list=$('#sessionItems');
    if(list) list.scrollTop=sessionScrollTop;
    if(state._keepKnowledgeOpen){
      state._keepKnowledgeOpen=false;
      openKnowledgePanel();
    }
  });
}

function clearChat(){
  const c=currentChat();
  if(c){c.messages=[];save();renderPage()}
}

function initChat(){
  const ta=$('#chatInput');
  if(!ta) return;
  ta.addEventListener('input',()=>autoResizeInput(ta));
  autoResizeInput(ta);
  ta.addEventListener('paste',handleChatPaste);
  const area=$('#messagesArea');
  if(area){
    area.querySelectorAll('.msg-bubble').forEach(enhanceMessageMarkdown);
    area.scrollTop=area.scrollHeight;
    area.addEventListener('scroll',updateScrollToBottomButton,{passive:true});
    updateScrollToBottomButton();
  }
}

async function handleChatPaste(event){
  const items=[...(event.clipboardData?.items||[])];
  const imageFiles=items
    .filter(item=>item.kind==='file'&&item.type&&item.type.startsWith('image/'))
    .map((item,i)=>{
      const file=item.getAsFile();
      if(file && !file.name) {
        try { return new File([file], `clipboard-${Date.now()}-${i}.png`, { type:file.type||'image/png' }); } catch { return file; }
      }
      return file;
    })
    .filter(Boolean);
  if(!imageFiles.length) return;
  event.preventDefault();
  await saveImageFiles(imageFiles,'clipboard');
}

function autoResizeInput(ta){
  if(!ta) return;
  const maxH=360;
  ta.style.height='auto';
  const next=Math.min(ta.scrollHeight,maxH);
  ta.style.height=next+'px';
  ta.style.overflowY=ta.scrollHeight>maxH?'auto':'hidden';
}

function updateSendButton(){
  const btn=$('#sendBtn');
  if(!btn) return;
  btn.classList.toggle('stop', !!state.isStreaming);
  btn.title=state.isStreaming?'终止任务':'发送';
  btn.onclick=state.isStreaming?stopGeneration:sendMessage;
  btn.innerHTML=state.isStreaming?'<span class="stop-square"></span>':SVG.send;
}

function setStreamingState(on,controller=null,msgId=null){
  state.isStreaming=!!on;
  state.streamAbort=controller;
  state.currentAssistantMsgId=msgId;
  updateSendButton();
}

function stopGeneration(){
  if(state.streamAbort) {
    try{ state.streamAbort.abort(); }catch(_){}
  }
  const c=currentChat();
  const msgId=state.currentAssistantMsgId;
  const msg=c?.messages?.find(m=>m._msgId===msgId) || [...(c?.messages||[])].reverse().find(m=>m.role==='assistant'&&m._streaming);
  if(msg){
    msg._streaming=false;
    if(!String(msg.content||'').trim()) msg.content='已终止任务。';
    renderMsgUpdate(msg._msgId||msgId,msg);
  }
  setStreamingState(false,null,null);
  toast('已终止当前任务','info');
}

function imageAttachmentMarkdown(images=[]){
  return images.map(img=>`![${img.name||'参考图片'}](${imageSrc(img)})`).join('\n\n');
}

function renderMessageAttachments(images=[]){
  const list=(images||[]).map(img=>({ img, src:imageSrc(img) })).filter(row=>row.img&&row.src);
  if(!list.length) return '';
  return `<div class="message-attachment-grid">
    ${list.map(({img,src})=>`<button type="button" class="message-attachment-card" onclick="openImagePreview('${esc(src)}','${esc(img.name||'上传图片')}')">
      <img src="${esc(src)}" alt="${esc(img.name||'上传图片')}">
      <span>${esc(img.name||'上传图片')}</span>
    </button>`).join('')}
  </div>`;
}

function imageGenerationLoadingText(imageGeneration={}){
  if(imageGeneration.loadingText) return imageGeneration.loadingText;
  if(imageGeneration.stage==='optimizing') return '正在优化图像提示词';
  if(imageGeneration.stage==='generating') return '正在生成图片';
  if(imageGeneration.stage==='editing') return '正在基于参考图生成';
  return '灵感正在绘制中，请稍等';
}

function renderImageGenerationLoadingCard(imageGeneration={}){
  const svg = "<svg viewBox=\"0 0 64 64\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" class=\"image-generation-loading-svg\" aria-hidden=\"true\">\n          <path pathLength=\"360\" d=\"M 56.3752 2 H 7.6248 C 7.2797 2 6.9999 2.268 6.9999 2.5985 V 61.4015 C 6.9999 61.7321 7.2797 62 7.6248 62 H 56.3752 C 56.7203 62 57.0001 61.7321 57.0001 61.4015 V 2.5985 C 57.0001 2.268 56.7203 2 56.3752 2 Z\"></path>\n          <path pathLength=\"360\" d=\"M 55.7503 60.803 H 8.2497 V 3.1971 H 55.7503 V 60.803 Z\"></path>\n          <path pathLength=\"360\" d=\"M 29.7638 47.6092 C 29.4971 47.3997 29.1031 47.4368 28.8844 47.6925 C 28.6656 47.9481 28.7046 48.3253 28.9715 48.5348 L 32.8768 51.6023 C 32.9931 51.6936 33.1333 51.738 33.2727 51.738 C 33.4533 51.738 33.6328 51.6634 33.7562 51.519 C 33.975 51.2634 33.936 50.8862 33.6692 50.6767 L 29.7638 47.6092 Z\"></path>\n          <path pathLength=\"360\" d=\"M 42.3557 34.9046 C 38.4615 34.7664 36.9617 37.6749 36.7179 39.2213 L 35.8587 44.2341 C 35.8029 44.5604 36.0335 44.8681 36.374 44.9218 C 36.4084 44.9272 36.4424 44.9299 36.476 44.9299 C 36.7766 44.9299 37.0415 44.7214 37.0918 44.4281 L 37.9523 39.4076 C 37.9744 39.2673 38.544 35.9737 42.311 36.1007 C 42.6526 36.1124 42.9454 35.8544 42.9577 35.524 C 42.9702 35.1937 42.7006 34.9164 42.3557 34.9046 Z\"></path>\n          <path pathLength=\"360\" d=\"M 13.1528 55.5663 C 13.1528 55.8968 13.4326 56.1648 13.7777 56.1648 H 50.2223 C 50.5674 56.1648 50.8472 55.8968 50.8472 55.5663 V 8.4339 C 50.8472 8.1034 50.5674 7.8354 50.2223 7.8354 H 13.7777 C 13.4326 7.8354 13.1528 8.1034 13.1528 8.4339 V 55.5663 Z\"></path>\n          <path pathLength=\"360\" d=\"M 25.3121 26.5567 C 24.9717 27.4941 25.0042 28.8167 25.0634 29.5927 C 23.6244 29.8484 20.3838 31.0913 18.9478 37.0352 C 18.5089 37.5603 17.8746 38.1205 17.2053 38.7114 C 16.2598 39.546 15.2351 40.4515 14.4027 41.5332 V 20.5393 H 23.7222 C 23.7178 22.6817 24.1666 25.4398 25.3121 26.5567 Z\"></path>\n          <path pathLength=\"360\" d=\"M 49.5975 43.4819 C 48.3838 39.1715 46.3138 33.6788 43.4709 29.7736 C 42.6161 28.5995 40.7095 27.0268 39.6852 26.1818 L 39.6352 26.1405 C 39.4176 24.783 39.1158 22.5803 38.8461 20.5394 H 49.5976 V 43.4819 Z\"></path>\n          <path pathLength=\"360\" d=\"M 29.8161 45.151 C 29.0569 44.7516 28.3216 44.4344 27.6455 44.185 C 27.6488 44.0431 27.6397 43.8917 27.6478 43.7715 C 27.9248 39.7036 30.4491 36.2472 35.1502 33.4979 C 38.7221 31.4091 42.2682 30.5427 42.3036 30.5341 C 42.3563 30.5213 42.416 30.5119 42.4781 30.5037 C 42.6695 30.7681 42.8577 31.0407 43.0425 31.3217 C 42.1523 31.4917 39.6591 32.0721 37.0495 33.6188 C 34.2273 35.2912 30.7775 38.4334 29.9445 44.0105 C 29.9025 44.2924 29.8211 45.0524 29.8161 45.151 Z\"></path>\n          <path pathLength=\"360\" d=\"M 32.2021 33.6346 C 29.1519 33.8959 26.6218 32.5634 25.6481 31.4461 C 25.9518 30.3095 28.4436 28.4847 30.2282 27.4911 C 30.436 27.3755 30.5563 27.1556 30.5372 26.9261 L 30.4311 25.6487 C 30.5264 25.6565 30.622 25.6621 30.7181 25.6642 L 30.8857 25.6672 C 32.0645 25.6912 33.2094 25.302 34.1059 24.5658 L 34.112 24.5607 L 34.4024 32.5344 C 33.8302 32.8724 33.2863 33.2227 32.7728 33.5852 C 32.5227 33.6032 32.3068 33.6258 32.2021 33.6346 Z\"></path>\n          <path pathLength=\"360\" d=\"M 27.8056 17.9207 C 27.8041 17.9207 27.8025 17.9207 27.8012 17.9207 L 27.0155 17.9259 L 26.8123 15.4718 C 26.8174 15.4609 26.8238 15.4501 26.8282 15.4389 C 27.2218 15.0856 28.158 14.3463 29.1923 14.252 C 31.0985 14.0778 33.442 14.3386 33.8213 16.5565 L 34.0564 23.0299 L 33.2927 23.6566 C 32.6306 24.2004 31.7888 24.4889 30.9118 24.4703 L 30.7437 24.4673 C 29.7977 24.4473 28.8841 24.0555 28.2376 23.3933 C 27.9671 23.1152 27.748 22.7967 27.5871 22.4474 C 27.426 22.0961 27.3292 21.7272 27.2989 21.3494 L 27.1145 19.1223 L 27.8097 19.1178 C 28.1548 19.1154 28.4327 18.8457 28.4303 18.5152 C 28.4278 18.186 28.1487 17.9207 27.8056 17.9207 Z\"></path>\n          <path pathLength=\"360\" d=\"M 38.4358 26.5433 C 38.4589 26.6829 38.5326 26.8101 38.6443 26.9026 L 38.8697 27.0889 C 39.5266 27.6307 40.6931 28.5938 41.5811 29.4829 C 40.6409 29.7428 38.2545 30.4762 35.6283 31.8516 L 35.3161 23.281 C 35.316 23.2777 35.3158 23.2743 35.3157 23.271 L 35.0692 16.4785 C 35.0682 16.455 35.0659 16.4316 35.0621 16.4082 C 34.6703 13.9692 32.4875 12.7498 29.0741 13.0603 C 28.5659 13.1067 28.0885 13.255 27.6614 13.4468 C 28.321 12.6324 29.4568 11.8605 31.3984 11.8605 C 32.892 11.8605 34.2086 12.4323 35.3118 13.5599 C 36.3478 14.6187 36.9981 15.9821 37.1923 17.5023 C 37.5097 19.987 38.0932 24.4655 38.4358 26.5433 Z\"></path>\n          <path pathLength=\"360\" d=\"M 25.6994 17.1716 L 26.053 21.4425 C 26.094 21.9536 26.225 22.4539 26.4434 22.93 C 26.6613 23.403 26.9574 23.8335 27.3242 24.2106 C 27.833 24.7317 28.4641 25.128 29.1549 25.3746 L 29.2609 26.6526 C 28.8063 26.9219 27.959 27.4459 27.0978 28.0926 C 26.7982 28.3177 26.5261 28.5365 26.2766 28.7503 C 26.2677 27.9385 26.3477 27.0941 26.6128 26.699 C 26.7087 26.5561 26.7368 26.3807 26.6898 26.2168 C 26.6428 26.0528 26.5253 25.9159 26.3667 25.8398 C 25.2812 25.3198 24.639 20.7943 25.134 18.7283 C 25.2757 18.1366 25.4822 17.6126 25.6994 17.1716 Z\"></path>\n          <path pathLength=\"360\" d=\"M 14.4025 54.9677 V 43.9616 C 15.1297 42.1745 16.6798 40.8031 18.052 39.5917 C 18.5756 39.1296 19.0771 38.6852 19.5054 38.243 C 20.1455 38.2763 21.8243 38.4721 22.2856 39.611 C 22.526 40.696 22.9861 41.6387 23.6573 42.3985 C 23.7809 42.5383 23.9573 42.6104 24.1347 42.6104 C 24.2773 42.6104 24.4206 42.5639 24.5381 42.4688 C 24.8014 42.2553 24.8343 41.8776 24.6115 41.6252 C 22.2978 39.0062 23.8504 34.5445 23.8663 34.4997 C 23.9782 34.1872 23.8046 33.8471 23.4785 33.7397 C 23.1507 33.6321 22.7964 33.7986 22.6843 34.1111 C 22.6657 34.1631 22.2262 35.4024 22.1149 37.0253 C 22.0992 37.2529 22.0927 37.476 22.0916 37.6958 C 21.4663 37.3478 20.7678 37.1827 20.215 37.1057 C 21.266 32.9598 23.2109 31.5061 24.4867 30.9973 C 24.4164 31.2001 24.3769 31.3974 24.3692 31.5894 C 24.3639 31.7208 24.404 31.8501 24.4831 31.9575 C 25.0708 32.7551 26.1363 33.5207 27.4065 34.0584 C 28.2686 34.4232 29.5576 34.8194 31.1457 34.861 C 28.2499 37.3877 26.6257 40.39 26.4009 43.6936 C 26.3992 43.7195 26.3962 43.7461 26.3928 43.7729 C 25.1023 43.399 24.2167 43.2969 24.1252 43.2873 C 23.9888 43.2728 23.8487 43.3023 23.7304 43.3716 C 23.0495 43.7702 22.591 44.3922 22.4046 45.1703 C 22.2331 45.8868 22.3106 46.6885 22.6019 47.3807 C 22.0046 47.6438 21.3269 47.7784 20.7914 47.848 C 19.4939 45.6912 20.8219 44.6351 20.989 44.5146 C 21.2655 44.3207 21.3274 43.9492 21.1268 43.6822 C 20.9253 43.4139 20.5346 43.3533 20.2546 43.5462 C 19.4539 44.0983 18.406 45.6195 19.3656 47.7888 C 18.685 47.5329 17.6255 46.8145 17.8055 44.832 C 17.8836 43.9718 18.1884 43.3352 18.7117 42.9403 C 19.5815 42.2834 20.8198 42.451 20.8366 42.4537 C 21.1748 42.503 21.4952 42.2819 21.5494 41.9563 C 21.6037 41.6297 21.3713 41.3231 21.0306 41.2712 C 20.9582 41.2599 19.2558 41.0142 17.9494 41.9917 C 17.1375 42.5992 16.6703 43.5199 16.5605 44.7282 C 16.1991 48.7092 19.7376 49.1126 19.7732 49.116 C 19.7951 49.1182 22.2326 49.1079 23.7782 48.1211 C 23.8053 48.1039 24.4158 47.7528 24.4158 47.7528 C 24.5214 47.8841 24.6624 48.0532 24.8294 48.2438 L 22.3598 49.4874 C 22.1544 49.5908 22.0257 49.7949 22.0257 50.0171 V 51.8127 C 22.0257 52.1432 22.3054 52.4112 22.6505 52.4112 S 23.2754 52.1432 23.2754 51.8127 V 50.3786 L 25.6987 49.1582 C 26.021 49.4709 26.3894 49.7985 26.7963 50.1188 L 24.6627 50.7144 C 24.4768 50.7663 24.3269 50.8977 24.2559 51.0702 L 23.3968 53.1651 C 23.2704 53.4729 23.4286 53.8202 23.7498 53.9409 C 23.8248 53.9694 23.9023 53.9825 23.9782 53.9825 C 24.2277 53.9825 24.4632 53.8384 24.5599 53.6028 L 25.307 51.7814 L 28.0879 51.0053 C 28.5412 51.2713 29.0239 51.51 29.5341 51.6979 C 29.6079 51.7252 29.6836 51.738 29.7582 51.738 C 30.0092 51.738 30.246 51.592 30.3415 51.3542 C 30.4653 51.0457 30.3048 50.6994 29.9825 50.5808 C 27.1642 49.5423 25.2952 46.9394 25.2771 46.9138 C 25.1245 46.6979 24.8439 46.6013 24.5831 46.6746 L 23.7537 46.9082 C 23.5672 46.4465 23.5125 45.8992 23.623 45.4377 C 23.7168 45.046 23.9138 44.7341 24.21 44.508 C 25.267 44.6734 29.863 45.5842 33.2732 49.2905 C 33.3967 49.4247 33.569 49.4932 33.7423 49.4932 C 33.889 49.4932 34.0364 49.444 34.1551 49.3437 C 34.414 49.1251 34.439 48.747 34.2108 48.4989 C 33.9947 48.2641 33.7738 48.0421 33.5507 47.8278 L 38.211 47.0175 C 38.3595 47.0014 40.1672 46.8356 41.295 48.2161 C 41.4182 48.3671 41.6019 48.4458 41.7875 48.4458 C 41.9222 48.4458 42.0578 48.4043 42.1721 48.3186 C 42.4439 48.1148 42.4919 47.7386 42.2791 47.4784 C 40.6703 45.5094 38.1379 45.8184 38.0305 45.8327 C 38.0218 45.8339 38.0132 45.8353 38.0043 45.8368 L 32.3855 46.8136 C 31.945 46.4667 31.4998 46.1528 31.0557 45.8697 C 31.0618 45.5534 31.0651 45.1775 31.0836 44.9842 C 31.1138 44.6713 31.1524 44.3635 31.1997 44.0606 C 31.8329 40.0032 34.0061 36.8432 37.6695 34.6587 C 40.6334 32.8915 43.5195 32.4536 43.5682 32.4464 C 43.604 32.4413 43.663 32.4341 43.7302 32.4251 C 47.2229 38.3378 49.3982 46.7588 49.5976 49.5158 V 54.9673 H 14.4025 Z\"></path>\n          <path pathLength=\"360\" d=\"M 49.5975 9.0325 V 19.3422 H 38.689 C 38.5937 18.6105 38.5061 17.9301 38.4329 17.3569 C 38.2063 15.5828 37.4422 13.9868 36.2237 12.7413 C 34.8748 11.3624 33.2514 10.6633 31.3984 10.6633 C 27.3688 10.6633 25.8233 13.5309 25.556 15.0901 C 25.1526 15.5932 24.3175 16.7856 23.916 18.46 C 23.8568 18.7069 23.8106 19.0066 23.7778 19.3421 H 14.4025 V 9.0323 H 49.5975 Z\"></path>\n          <path pathLength=\"360\" d=\"M 30.2223 21.2875 C 30.5674 21.2875 30.8471 21.0195 30.8471 20.6889 V 18.92 L 31.9916 18.9675 C 32.3376 18.9833 32.628 18.7259 32.643 18.3956 C 32.658 18.0654 32.3907 17.786 32.0459 17.7717 L 30.2495 17.6969 C 30.077 17.6889 29.9133 17.7497 29.7902 17.8624 C 29.6671 17.9753 29.5976 18.1315 29.5976 18.2948 V 20.6889 C 29.5974 21.0195 29.8772 21.2875 30.2223 21.2875 Z\"></path>\n        </svg>";
  const text=esc(imageGenerationLoadingText(imageGeneration));
  return '<div class="image-generation-loading-card" aria-label="图片生成中"><div class="image-generation-loading-inner">' + svg + '<p class="image-generation-loading-text">'+text+'<span class="text-dots"><i>.</i><i>.</i><i>.</i></span></p></div></div>';
}
function generatedImageMarkdown(images=[]){
  return images.map(img=>`![${img.name||'生成图片'}](${imageSrc(img)})`).join('\n\n');
}

function generatedImageMessageContent(imageGeneration={}){
  const imageMd=generatedImageMarkdown(imageGeneration.outputs||[]);
  const prompt=cleanImagePromptForDisplay(imageGeneration.optimizedPrompt||imageGeneration.prompt||'');
  const label=imageGeneration.mode==='image-to-image'?'图生图提示词':'图像提示词';
  const promptText=prompt?`${label}：\n${prompt}\n\n`:'';
  return `图片已生成\n\n${promptText}${imageMd}`.trim();
}

function cleanImagePromptForDisplay(value=''){
  return String(value||'')
    .replace(/(?:^|\n)\s*⚠?\s*Normalized model .*? for deepseek\.?\s*(?=\n|$)/gi,'\n')
    .replace(/^⚠?\s*Normalized model .*? for deepseek\.?\s*/i,'')
    .replace(/!\[[^\]]*]\([^)]+\)/g,'')
    .replace(/https?:\/\/\S+/gi,'')
    .replace(/\/api\/images\/file\/\S+/gi,'')
    .replace(/\s+/g,' ')
    .trim();
}

function renderImagePromptPanel(imageGeneration={}){
  const prompt=cleanImagePromptForDisplay(imageGeneration.optimizedPrompt||imageGeneration.prompt||'');
  const source=cleanImagePromptForDisplay(imageGeneration.sourcePrompt||'');
  const hasOutputs=Array.isArray(imageGeneration.outputs)&&imageGeneration.outputs.length>0;
  const hasOptimized=!!imageGeneration.optimizedByAgent || !!imageGeneration.optimizeSkill || (!!source && prompt!==source);
  if(!prompt || (!hasOutputs && !hasOptimized)) return '';
  const title=imageGeneration.mode==='image-to-image'
    ? '图生图提示词'
    : (hasOptimized && prompt!==source ? '图像提示词' : '最终提示词');
  const skill=imageGeneration.optimizeSkill ? ` · ${imageGeneration.optimizeSkill}` : '';
  return `<div class="image-prompt-panel">
    <div class="image-prompt-panel-title"><span>${title}${esc(skill)}</span><button type="button" class="image-prompt-copy" onclick="copyText(this.closest('.image-prompt-panel')?.querySelector('.image-prompt-code')?.innerText||'','已复制提示词')" title="复制提示词" aria-label="复制提示词">${COPY_ICON}</button></div>
    <pre class="image-prompt-code"><code>${esc(prompt)}</code></pre>
  </div>`;
}

function imageAttachmentAgentText(images=[]){
  if(!images.length) return '';
  return '\n\n[用户上传了本地图片，已保存到本地。重要执行规则：如果用户要求生成、改图、优化效果或基于参考图出图，请直接调用可用的图片生成工具处理；不要输出 curl、Python、HTTP 请求示例或“等待 API 返回”的文案；如果当前工具不能读取参考图，请直接说明工具限制。]\n'+images.map((img,i)=>{
    const parts=[
      `${i+1}. ${img.name||'参考图片'}`,
      `本地路径：${img.path||'未返回'}`,
      `预览地址：${mediaUrl(img.url||img.publicUrl)}`,
    ];
    return parts.join('\n');
  }).join('\n\n');
}

function directImageContext(){
  const c=currentChat();
  const msgs=[...(c?.messages||[])].reverse();
  const lastImageMsg=msgs.find(m=>m.role==='assistant'&&m.imageGeneration?.outputs?.length);
  if(!lastImageMsg) return {prompt:'',attachments:[]};
  const gen=lastImageMsg.imageGeneration||{};
  const output=gen.outputs?.[0];
  const previousPrompt=gen.prompt||gen.optimizedPrompt||output?.prompt||msgs.find(m=>m.role==='user'&&String(m.content||'').startsWith('图像生成：'))?.content || '';
  const attachment=output ? {
    id: output.id,
    name: output.name||'上一张生成图',
    url: output.url||output.publicUrl,
    publicUrl: output.publicUrl||output.url,
    path: output.path,
    kind: 'output',
  } : null;
  return {
    prompt: previousPrompt.replace(/^图像生成：/,'').trim(),
    attachments: attachment ? [attachment] : [],
  };
}

function imagePromptTextModel(profile){
  if(state.chatModelOverride && state.chatModelOverride!=='auto' && !isImageModelId(state.chatModelOverride)) return state.chatModelOverride;
  if(profile?.modelId && profile.modelId!=='auto' && !isImageModelId(profile.modelId)) return profile.modelId;
  return 'auto';
}

async function optimizeImagePromptWithAgent(payload,signal){
  const resp=await fetch(apiBase()+'/api/images/optimize-prompt',{
    method:'POST',
    cache:'no-store',
    headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},
    body:JSON.stringify(payload),
    signal,
  });
  const json=await resp.json().catch(()=>({}));
  return json.code===0?json.data:null;
}

function isImageModelId(id){
  if(!id||id==='auto') return false;
  const model=getModelById(id);
  if(!model) return false;
  const tags=(model.tags||[]).map(t=>String(t).toLowerCase());
  return model.apiFormat==='openai-image'||model.apiFormat==='openai_image'||model.kind==='image'||tags.includes('image')||tags.includes('vision');
}

function isImageGenerationIntent(pendingImages=[]){
  if(state.forceImageGeneration) return true;
  if(state.imageEditReference) return true;
  const ta=$('#chatInput');
  const text=String(ta?.value||'').trim();
  if(IMAGE_PROMPT_PREFIXES.some(prefix=>text.startsWith(prefix))) return true;
  if(pendingImages.length && /^(生成|画|绘制|做|出|改|修改|优化|换|加|去掉|保持|参考|基于).*(图|图片|图像|海报|头像|壁纸|插画|照片|视觉|效果)/i.test(text)) return true;
  return false;
}

function stripImagePromptPrefix(text=''){
  let value=String(text||'').trim();
  for(const prefix of IMAGE_PROMPT_PREFIXES){
    if(value.startsWith(prefix)) return value.slice(prefix.length).trim();
  }
  return value;
}

async function sendImageGenerationMessage(txt,pendingImages=[]){
  const ta=$('#chatInput');
  let c=currentChat();
  if(!c) return;
  const editRef=state.imageEditReference;
  const mergedImages=[...(editRef?[editRef]:[]),...pendingImages].filter((img,idx,arr)=>img?.id && arr.findIndex(item=>item?.id===img.id)===idx);
  const userPrompt=stripImagePromptPrefix(txt)||(mergedImages.length?'请基于参考图片生成一张新的图片。':'请生成一张图片。');
  const previousPrompt=editRef?.prompt||editRef?.sourcePrompt||'';
  const basePrompt=editRef && previousPrompt
    ? `基于已选择的参考图进行二次编辑。上一轮提示：${previousPrompt}\n本轮修改：${userPrompt}`
    : userPrompt;
  let prompt=basePrompt;
  const imageInputIds=mergedImages.map(img=>img.id).filter(Boolean);
  const userContent=`图像生成：${userPrompt}${mergedImages.length?'\n\n参考图片：\n'+imageAttachmentMarkdown(mergedImages):''}`;
  const userMsgId='img_user_'+Date.now();
  const userMsg={role:'user',content:userContent,ts:Date.now(),attachments:mergedImages,_msgId:userMsgId};
  c.messages.push(userMsg);
  if(c.title==='新建对话') c.title=userPrompt.slice(0,24);
  c.updatedAt=Date.now();
  if(ta){ta.value='';autoResizeInput(ta)}
  state.pendingImageAttachments=[];
  state.imageEditReference=null;
  save();

  const msgId='img_'+Date.now();
  const assistantMsg={role:'assistant',content:'',imageGeneration:{status:'loading',stage:state.forceImageGeneration?(mergedImages.length?'editing':'generating'):'optimizing',sourcePrompt:userPrompt,prompt:basePrompt},_msgId:msgId,_streaming:true,ts:Date.now()};
  c.messages.push(assistantMsg);
  const streamController=new AbortController();
  setStreamingState(true,streamController,msgId);
  renderMsgUpdate(userMsg._msgId, userMsg);
  renderMsgUpdate(msgId, assistantMsg);
  flushMsgUpdates();
  const area=$('#messagesArea');
  if(area) area.scrollTop=area.scrollHeight;

  try{
    const profile=profileForChat(c);
    if(!state.forceImageGeneration){
      const optimized=await optimizeImagePromptWithAgent({
        prompt:basePrompt,
        userPrompt,
        previousPrompt,
        attachments:mergedImages.map(img=>({name:img.name||'',path:img.path||'',kind:img.kind||'input'})),
        model:imagePromptTextModel(profile),
        profileName:profile?.name||'默认助手',
        profilePrompt:profile?.systemPrompt||'',
      },streamController.signal);
      if(optimized?.prompt) prompt=optimized.prompt;
      assistantMsg.content='';
      assistantMsg.imageGeneration={
        status:'loading',
        stage:mergedImages.length?'editing':'generating',
        sourcePrompt:userPrompt,
        prompt,
        optimizedPrompt:prompt,
        optimizeSkill:optimized?.skill||'',
        mode:optimized?.mode||''
      };
      assistantMsg.thinking='';
      renderMsgUpdate(msgId,assistantMsg);
    }
    const requestModel = isImageModelId(state.chatModelOverride) ? state.chatModelOverride : 'auto';
    const resp=await fetch(apiBase()+'/api/images/generate',{
      method:'POST',
      cache:'no-store',
      headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},
      body:JSON.stringify({
        prompt,
        sourcePrompt:userPrompt,
        optimizedByAgent:!state.forceImageGeneration,
        attachmentIds:imageInputIds,
        model:requestModel,
        chatId:c._id||c.id,
        publicBase:publicApiBase(),
      }),
      signal:streamController.signal,
    });
    const json=await resp.json().catch(()=>({}));
    const data=json.code===0?json.data:null;
    if(!data){
      assistantMsg.content='图像生成失败：'+(json.msg||'请检查图像模型场景是否已配置为 OpenAI 图片接口。');
      toast('图像生成失败','error');
    }else{
      assistantMsg.imageGeneration={model:data.model,outputs:data.outputs||[],inputs:data.inputs||[],prompt:data.prompt||prompt,sourcePrompt:userPrompt,optimizedPrompt:prompt,optimizeSkill:assistantMsg.imageGeneration?.optimizeSkill||'',mode:assistantMsg.imageGeneration?.mode||(imageInputIds.length?'image-to-image':'text-to-image'),optimizedByAgent:!state.forceImageGeneration};
      assistantMsg.content=generatedImageMessageContent(assistantMsg.imageGeneration)||data.content||'已生成图片。';
      const idx=state.chats.findIndex(x=>x.id===c.id);
      if(data.chat&&idx>=0){
        state.chats[idx].title=data.chat.title||state.chats[idx].title;
        state.chats[idx].updatedAt=data.chat.updatedAt||Date.now();
        state.chats[idx].messages=[...c.messages];
      }
      toast('图片已生成并保存到本地','success');
    }
  }catch(e){
    if(e.name==='AbortError'){
      assistantMsg.content='已终止任务。';
      toast('已终止当前任务','info');
    }else{
      assistantMsg.content='图像生成失败：'+(e.message||'未知错误');
      toast('图像生成失败','error');
    }
  }finally{
    assistantMsg._streaming=false;
    renderMsgUpdate(msgId,assistantMsg);
    setStreamingState(false,null,null);
  }
}

async function sendMessage(){
  const ta=$('#chatInput');
  const txt=ta?ta.value.trim():'';
  const pendingImages=[...(state.pendingImageAttachments||[])];
  if(!txt && !pendingImages.length) return;
  if(txt && !pendingImages.length && handleLocalHermesCommand(txt)){
    if(ta){ta.value='';autoResizeInput(ta)}
    return;
  }
  
  // Create chat if needed
  if(!state.currentChat) {
    const profile=getActiveProfile();
    const data = await apiPost('/api/chats', { title: '新建对话', agentId: profile?.id||'', agentName: profile?.name||'' });
    if (data) {
      state.chats.push({ id: data.id, title: data.title, source:data.source||'WebUI', messages: [], updatedAt: data.updatedAt, createdAt:data.createdAt, agentId: profile?.id||'' });
      state.chatFullData[data.id] = data;
      state.currentChat = data.id;
    } else {
      await newChat();
    }
    await new Promise(r => setTimeout(r, 50));
  }
  const c=currentChat();
  if(!c) return;
  const sendingToCli=isCliChat(c);

  const messagesArea = $('#messagesArea');
  if (messagesArea && messagesArea.dataset.chatId !== String(c.id || '')) {
    messagesArea.dataset.chatId = String(c.id || '');
    messagesArea.innerHTML = '';
  }

  if(isImageGenerationIntent(pendingImages)){
    await sendImageGenerationMessage(txt,pendingImages);
    return;
  }

  // Add user message to local state immediately; send attachment context to Agent separately from visible bubble.
  const agentAttachmentContext=imageAttachmentAgentText(pendingImages);
  const contentWithAttachments=txt+agentAttachmentContext;
  const userMsgId = 'u_' + Date.now();
  const userMsg = {role:'user',content:txt,agentContent:contentWithAttachments,ts:Date.now(),attachments:pendingImages,_msgId:userMsgId};
  c.messages.push(userMsg);
  if(c.title==='新建对话') c.title=(txt||'图片任务').slice(0,24);
  c.updatedAt=Date.now();
  if(ta){ta.value='';autoResizeInput(ta)}
  if(pendingImages.length){
    state.pendingImageAttachments=[];
    save();
    renderPendingImageStrip();
  }

  const msgId = '' + Date.now();
  const assistantMsg = { role: 'assistant', content: '', thinking: '', toolCalls: [], processEvents: [{ type: 'queued' }], _msgId: msgId, _streaming: true, ts: Date.now() };
  c.messages.push(assistantMsg);

  const streamController = new AbortController();
  setStreamingState(true,streamController,msgId);
  renderMsgUpdate(userMsg._msgId, userMsg);
  renderMsgUpdate(msgId, assistantMsg);
  flushMsgUpdates();
  const area=$('#messagesArea');
  if(area) area.scrollTop=area.scrollHeight;

  // SSE stream from backend
  let fullContent = '';
  let fullReasoning = '';
  const tools = [];
  let lastArtifactFeedAt = 0;
  const perfStart = performance.now ? performance.now() : Date.now();
  let firstTokenAt = 0;
  let tokenCount = 0;
  function pushProcessEvent(event){
    const item={ ...event };
    assistantMsg.processEvents=[...(assistantMsg.processEvents||[]), item].slice(-20);
  }

  const profile=profileForChat(c);
  const requestModel = state.chatModelOverride !== 'auto' ? state.chatModelOverride : (profile?.modelId && profile.modelId !== 'auto' ? profile.modelId : 'auto');
  const streamPath=sendingToCli?('/api/cli/sessions/'+encodeURIComponent(c.id)+'/messages'):('/api/chats/' + (c._id || c.id) + '/messages');
  await apiStream(streamPath, {
    content: contentWithAttachments,
    displayContent: txt,
    attachments: pendingImages,
    scene:'chat',
    model:requestModel,
    profileId:profile?.id,
    profileName:profile?.name||'默认助手',
    profilePrompt:profile?.systemPrompt||'',
    profileSkillIds:profile?.skillIds||[],
  }, {
    signal: streamController.signal,
    onPerf(data) {
      hermesPerfLog('backend', data);
      if(data?.stage && ['sse-flushed','route-selected','route-fallback','model-fallback','hermes-api-connect','hermes-api-failed','first-hermes-event','first-cli-stdout','cli-spawned','direct-api-aborted','client-aborted'].includes(data.stage)){
        pushProcessEvent(data);
      }
      if(data?.stage==='sse-flushed' && Array.isArray(data.promptDebug)){
        assistantMsg.promptDebug={
          parts:data.promptDebug,
          totalChars:data.systemChars||0,
          totalApproxTokens:data.promptTotalApproxTokens||0,
          historyMessages:data.historyMessages||0,
          matchedSkills:data.matchedSkills||[],
        };
        const skillItems=(data.matchedSkills||[]).filter(s=>s.name).slice(0,6).map(s=>({name:s.name,trigger:s.match?.trigger||'',reason:s.match?.reason||''}));
        pushProcessEvent({type:'skill-match',items:skillItems,names:skillItems.map(s=>s.name)});
        renderMsgUpdate(msgId, assistantMsg);
      }
    },
    onToken(text) {
      tokenCount += 1;
      if (!firstTokenAt) {
        firstTokenAt = performance.now ? performance.now() : Date.now();
        const firstTokenEvent={ type:'first-token', ms: Math.round(firstTokenAt - perfStart), chars: String(text||'').length };
        hermesPerfLog('first-token', firstTokenEvent);
        pushProcessEvent(firstTokenEvent);
      }
      fullContent += text;
      assistantMsg.content = fullContent;
      if (typeof HermesArtifact !== 'undefined') {
        const now = performance.now ? performance.now() : Date.now();
        const shouldFeedArtifact = /<\/?(?:artifact|think)\b/i.test(text) || now - lastArtifactFeedAt >= STREAM_MARKDOWN_INTERVAL_MS;
        if (shouldFeedArtifact) {
          const p = HermesArtifact.parseHermesStream(fullContent);
          assistantMsg.thinking = [fullReasoning, p.think].filter(Boolean).join('\n\n');
          HermesArtifact.feedStream(p, true);
          lastArtifactFeedAt = now;
        } else if (fullReasoning) {
          assistantMsg.thinking = fullReasoning;
        }
      } else {
        assistantMsg.thinking = fullReasoning;
      }
      renderMsgUpdate(msgId, assistantMsg);
    },
    onReasoning(text) {
      fullReasoning += text;
      assistantMsg.thinking = fullReasoning;
      renderMsgUpdate(msgId, assistantMsg);
    },
    onTool(data) {
      // Check if this is a clarify/ask_user tool call
      if (data.name === 'clarify' || data.name === 'ask_user' || data.name === 'AskUserQuestion') {
        assistantMsg._streaming = false;
        assistantMsg.content = '📋 需要你确认...';
        renderMsgUpdate(msgId, assistantMsg);
        // Parse question data
        let qData = data.args || data.preview || {};
        if (typeof qData === 'string') {
          try { qData = JSON.parse(qData); } catch { qData = { question: qData }; }
        }

        let askQuestions = [];
        if (qData.questions && Array.isArray(qData.questions)) {
          // Standard AskUserQuestion format
          askQuestions = qData.questions.map((q, i) => ({
            id: 'clarify_q_' + i,
            label: q.question || q.header || '请确认',
            type: q.multiSelect ? 'multi' : 'single',
            options: (q.options || []).map(c => ({
              label: c.label || c,
              value: c.label || c,
              description: c.description || '',
            }))
          }));
        } else {
          // Legacy format
          const question = qData.question || qData.label || '请确认';
          const choices = qData.choices || qData.options || [];
          if (choices.length > 0) {
            askQuestions = [{
              id: 'clarify_q',
              label: question,
              type: qData.multiSelect ? 'multi' : 'single',
              options: choices.map(c => ({
                label: c.label || c,
                value: c.value || c.label || c,
                description: c.description || '',
              })),
            }];
          } else {
            askQuestions = [{
              id: 'clarify_q',
              label: question,
              type: 'single',
              options: [{ label: '确认', value: '继续' }],
            }];
          }
        }

        askUser(askQuestions).then(answers => {
          if (answers && answers.length) {
            // Format the answer back to the agent
            let answerText = '';
            answers.forEach((ans, idx) => {
              const qLabel = askQuestions[idx].label;
              const selected = ans.selected.filter(v => v !== '__OTHER__').join(', ');
              const custom = ans.selected.includes('__OTHER__') ? ans.custom : '';
              let finalAns = [selected, custom].filter(Boolean).join(' - ');
              if (!finalAns && ans.selected.includes('__OTHER__')) finalAns = '其他';
              if (!finalAns) finalAns = '无';
              answerText += `[${qLabel}] 用户的选择是: ${finalAns}\n`;
            });

            const ta = $('#chatInput');
            if (ta) {
              ta.value = answerText.trim();
              sendMessage();
            }
          }
        });
        return;
      }
      const tc = { name: data.name, status: 'running', input: data.args || data.preview || '', output: '' };
      tools.push(tc);
      assistantMsg.toolCalls = [...tools];
      pushProcessEvent({ type:'tool-start', name:data.name });
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
      pushProcessEvent({ type:'tool-done', name:data.name, error:!!data.is_error, elapsed:data.duration||0 });
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
      setStreamingState(false,null,null);
      const doneEvent={ type:'done', ms: Math.round((performance.now ? performance.now() : Date.now()) - perfStart), tokens: tokenCount, chars: fullContent.length };
      hermesPerfLog('done', doneEvent);
      pushProcessEvent(doneEvent);

      // Check for <ask_user> XML tag OR a raw JSON block containing "question" and "options"
      let qData = null;
      const contentStr = assistantMsg.content || '';
      const askMatch = contentStr.match(/<ask_user>([\s\S]*?)<\/ask_user>/);

      if (askMatch) {
        let jsonStr = askMatch[1].replace(/```json/gi, '').replace(/```/g, '').trim();
        try { qData = JSON.parse(jsonStr); } catch(e) { console.error('Failed to parse ask_user JSON:', e); }
      } else {
        // Fallback: look for a JSON block in the text
        const jsonMatch = contentStr.match(/```json\s*([\s\S]*?)\s*```/i) || contentStr.match(/\{[\s\S]*"question"[\s\S]*"options"[\s\S]*\}/);
        if (jsonMatch) {
          let jsonStr = (jsonMatch[1] || jsonMatch[0]).trim();
          try {
            let parsed = JSON.parse(jsonStr);
            if (parsed.question && parsed.options) qData = parsed;
            else if (parsed.questions && Array.isArray(parsed.questions)) qData = parsed;
          } catch(e) {}
        }
      }

      if (qData) {
        let askQuestions = [];
        if (qData.questions && Array.isArray(qData.questions)) {
          askQuestions = qData.questions.map((q, i) => ({
            id: 'clarify_q_' + i,
            label: q.question || q.header || '请确认',
            type: q.multiSelect ? 'multi' : 'single',
            options: (q.options || []).map(c => ({
              label: c.label || c,
              value: c.value || c.label || c,
              description: c.description || '',
            }))
          }));
        } else if (qData.options && Array.isArray(qData.options)) {
          askQuestions = [{
            id: 'clarify_q',
            label: qData.question || '请确认',
            type: qData.multiSelect ? 'multi' : 'single',
            options: qData.options.map(c => ({
              label: c.label || c,
              value: c.value || c.label || c,
              description: c.description || '',
            }))
          }];
        } else {
          // Fallback if no options
          askQuestions = [{
            id: 'clarify_q',
            label: qData.question || '请确认',
            type: 'single',
            options: [{ label: '确认', value: '继续' }]
          }];
        }

        askUser(askQuestions).then(answers => {
          if (answers && answers.length) {
            let answerText = '';
            answers.forEach((ans, idx) => {
              const qLabel = askQuestions[idx].label;
              const selected = ans.selected.filter(v => v !== '__OTHER__').join(', ');
              const custom = ans.selected.includes('__OTHER__') ? ans.custom : '';
              let finalAns = [selected, custom].filter(Boolean).join(' - ');
              if (!finalAns && ans.selected.includes('__OTHER__')) finalAns = '其他';
              if (!finalAns) finalAns = '无';
              answerText += `[${qLabel}] 用户的选择是: ${finalAns}\n`;
            });
            const ta = $('#chatInput');
            if (ta) {
              ta.value = answerText.trim();
              sendMessage();
            }
          }
        });
      }

      if (typeof HermesArtifact !== 'undefined') {
        const p = HermesArtifact.parseHermesStream(assistantMsg.content || '');
        HermesArtifact.finalizeStream(p);
      }
      renderMsgUpdate(msgId, assistantMsg);
      syncCurrentChat(c._id || c.id);
    },
    onError(msg) {
      assistantMsg._streaming = false;
      setStreamingState(false,null,null);
      const errorText = '⚠️ ' + (msg || '请求失败');
      assistantMsg.content = fullContent ? (fullContent + '\n\n' + errorText) : errorText;
      assistantMsg.error = true;
      pushProcessEvent({ type:'error', message:msg||'请求失败' });
      renderMsgUpdate(msgId, assistantMsg);
      syncCurrentChat(c._id || c.id);
    },
    onAbort() {
      assistantMsg._streaming = false;
      setStreamingState(false,null,null);
      pushProcessEvent({ type:'aborted' });
      renderMsgUpdate(msgId, assistantMsg);
    },
  });
  if(state.currentAssistantMsgId===msgId) setStreamingState(false,null,null);
}

let _renderThrottleTimer = null;
let _pendingMsgUpdates = new Map();
const STREAM_RENDER_INTERVAL_MS = 80;
const STREAM_MARKDOWN_INTERVAL_MS = 260;
let _lastStreamRenderAt = 0;
let _lastStreamMarkdownAt = 0;

function renderMsgUpdate(msgId, msg) {
  _pendingMsgUpdates.set(msgId, msg);
  if (!_renderThrottleTimer) {
    const now = performance.now ? performance.now() : Date.now();
    const delay = msg?._streaming ? Math.max(0, STREAM_RENDER_INTERVAL_MS - (now - _lastStreamRenderAt)) : 0;
    _renderThrottleTimer = setTimeout(() => requestAnimationFrame(() => {
      _renderThrottleTimer = null;
      _lastStreamRenderAt = performance.now ? performance.now() : Date.now();
      flushMsgUpdates();
    }), delay);
  }
}

function flushMsgUpdates() {
  const perfStart = hermesPerfEnabled() ? (performance.now ? performance.now() : Date.now()) : 0;
  const updates = _pendingMsgUpdates;
  _pendingMsgUpdates = new Map();
  for (const [msgId, msg] of updates) {
    const el = document.getElementById('msg_' + msgId);
    if (el) {
      // In-place update: only replace bubble content to avoid flickering
      const bubble = el.querySelector('.msg-bubble');
      if (bubble) {
        let content = cleanMessageContent(msg.content || '');
        if(msg.role==='assistant' && msg.imageGeneration?.outputs?.length){
          content=generatedImageMarkdown(msg.imageGeneration.outputs);
        }
        let refs = '';
        let previewAction = '';
        let fileCards = '';
        const stepHtml = msg.step ? `<div class="msg-step-indicator">Step ${msg.step}</div>` : '';
        const isStreaming = !!msg._streaming;
        if (msg.role === 'assistant' && typeof HermesArtifact !== 'undefined') {
          const p = HermesArtifact.parseHermesStream(content);
          let vis = (p.visibleText || '').trim();
          if (!vis && (p.activeArtifact || (p.completedArtifacts || []).length)) {
            const mdCount=(p.completedArtifacts||[]).filter(a=>String(a?.attrs?.type||'markdown').toLowerCase()==='markdown').length;
            vis = mdCount ? '' : '已为你生成文件，可在右侧面板或下方引用查看。';
          }
          content = vis;
          if (isStreaming) {
            refs = p.completedArtifacts?.length ? buildArtifactRefHtml(p) : '';
            const now = performance.now ? performance.now() : Date.now();
            if (now - _lastStreamMarkdownAt >= STREAM_MARKDOWN_INTERVAL_MS) {
              previewAction = buildPreviewActionHtml(msg.content || content);
              fileCards = refs ? '' : renderMarkdownFileCards(msg);
              _lastStreamMarkdownAt = now;
            }
          } else {
            refs = buildArtifactRefHtml(p);
            previewAction = buildPreviewActionHtml(msg.content || content);
            fileCards = refs ? '' : renderMarkdownFileCards(msg);
          }
        }
        const modelBadge = '';
        const promptDebugHtml = msg.role==='assistant' ? renderPromptDebugPanel(msg.promptDebug) : '';
        const imagePromptHtml = msg.role==='assistant' && msg.imageGeneration ? renderImagePromptPanel(msg.imageGeneration) : '';
        const imageLoadingHtml = msg.role==='assistant' && msg._streaming && msg.imageGeneration?.status==='loading' ? renderImageGenerationLoadingCard(msg.imageGeneration) : '';
        const streamDots = msg._streaming && !imageLoadingHtml ? '<span class="msg-streaming"><span></span><span></span><span></span></span>' : '';
        const bodyHtml = isStreaming && content && !fileCards && !refs
          ? `<div>${esc(content).replace(/\n/g,'<br>')}</div>`
          : (content ? formatMsg(content) : '');
        bubble.innerHTML = stepHtml + imageLoadingHtml + imagePromptHtml + bodyHtml + renderMessageAttachments(msg.attachments) + fileCards + refs + previewAction + promptDebugHtml + modelBadge + streamDots;
        if (!isStreaming || fileCards || refs) enhanceMessageMarkdown(bubble);
      }
      // Update thinking / process block
      const main = el.querySelector('.msg-main');
      const bubbleWrap = el.querySelector('.msg-bubble');
      if (main) {
        let thEl = main.querySelector('.msg-thinking');
        const thHtml = renderThinkingPanel(msg, 'stream_' + msgId);
        if (thHtml) {
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
            if (tc.input) bh += `<div class="tool-input">输入\n${esc(typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input,null,2))}</div>`;
            if (tc.output) bh += `<div class="tool-output">输出\n${esc(typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output,null,2))}</div>`;
            return `<div class="msg-tool-call"><div class="msg-tool-call-header" data-tool="${esc(tc.name)}" onclick="toggleCollapse('${id}')"><svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5h16"/><path d="M7.5 4v7"/><path d="m4 16 4-4 4 4"/><path d="m12 16 4-4 4 4"/></svg><span class="tool-name">${esc(tc.name)}</span><span class="tool-status ${sc}">${st}</span><span class="tool-toggle collapsed" id="toggle_${id}">▼</span></div><div class="msg-tool-call-body collapsed" id="body_${id}">${bh}</div></div>`;
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
  if (area && area.scrollTop > area.scrollHeight - area.clientHeight - 220) area.scrollTop = area.scrollHeight;
  if (perfStart) hermesPerfLog('render-flush', { ms: Math.round((performance.now ? performance.now() : Date.now()) - perfStart), updates: updates.size });
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
  const chats = [...(state.chats || [])].sort(compareChatCreatedAsc);
  const selected = state._historySelected || new Set();

  const groups = { webui: [], terminal: [] };
  chats.forEach(c => {
    groups[isCliChat(c)?'terminal':'webui'].push(c);
  });

  const groupLabels = { webui: 'webUI', terminal: 'CLI' };

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
      const preview = c.messages?.length ? stripArtifactTagsForPreview(c.messages[c.messages.length-1].content || '') : (c.preview || '');
      const src=c.source||'WebUI';
      const cls=sourceTagClass(src);
      const label=sourceTagLabel(src);
      const readonly=isCliChat(c);
      html += `<div class="hist-item${isSelected ? ' selected' : ''}" data-id="${c.id}">
        <label class="hist-check" onclick="event.stopPropagation();toggleHistSelect('${c.id}')">
          <input type="checkbox" ${isSelected ? 'checked' : ''} class="hist-cb">
        </label>
        <div class="hist-body" onclick="selectChat('${c.id}');navigate('chat')">
          <div class="hist-title">${esc(c.title || '未命名')}</div>
          <div class="hist-meta">
            <span class="hist-date">${dateStr}</span>
            <span class="hist-msgs">${c.messageCount || c.messages?.length || 0} 条消息</span>
            <span class="source-tag ${cls}">${label}</span>
            ${readonly?'<span class="readonly-tag mini">只读</span>':''}
          </div>
          ${preview ? `<div class="hist-preview">${esc(preview)}</div>` : ''}
        </div>
        <button class="hist-row-delete" onclick="event.stopPropagation();deleteSingleHist('${c.id}')" title="${readonly?'隐藏':'删除'}">${readonly?'隐藏':'删除'}</button>
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

async function deleteSelectedChats() {
  if (!state._historySelected || state._historySelected.size === 0) return;
  const count = state._historySelected.size;
  const ok=await askConfirm(`确认处理 ${count} 个会话？终端会话会从 WebUI 隐藏，WebUI 会话会删除。`);
  if (!ok) return;
  for(const id of [...state._historySelected]) await removeChat(id,{silent:true});
  state._historySelected.clear();
  toast(`已处理 ${count} 个会话`, 'info');
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
  if (isCliChat(c)) { toast('终端会话只读，不支持改名', 'info'); return; }
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
  if (isCliChat(c)) { toast('终端会话只读，不支持改名', 'info'); closeModal(); return; }
  await apiPut('/api/chats/' + id, { title: newTitle });
  c.title = newTitle;
  closeModal();
  renderPage();
}

async function pinSessionChat(id) {
  const c = state.chats.find(x => x.id === id);
  if (!c) return;
  if (isCliChat(c)) { toast('终端会话只读，不支持置顶', 'info'); return; }
  const pinned = !c.pinned;
  await apiPut('/api/chats/' + id, { pinned });
  c.pinned = pinned;
  toast(pinned ? '已置顶' : '已取消置顶', 'info');
  renderPage();
}

async function deleteSessionChat(id) {
  const c = state.chats.find(x => x.id === id);
  const ok=await askConfirm(isCliChat(c)?'确认从 WebUI 隐藏该终端会话？':'确认删除该会话？');
  if (!ok) return;
  await removeChat(id);
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
  if (isCliChat(c)) { toast('终端会话只读，不支持改名', 'info'); return; }
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
  if (isCliChat(c)) { toast('终端会话只读，不支持置顶', 'info'); return; }
  const pinned = !c.pinned;
  await apiPut('/api/chats/' + id, { pinned });
  c.pinned = pinned;
  toast(pinned ? '已置顶' : '已取消置顶', 'info');
  renderPage();
}

async function deleteHistChat(id) {
  const c = state.chats.find(x => x.id === id);
  const ok=await askConfirm(isCliChat(c)?'确认从 WebUI 隐藏该终端会话？':'确认删除该会话？');
  if (!ok) return;
  await removeChat(id);
  renderPage();
}

function clearAllHistory(){
  askConfirm('确认清空所有历史记录？').then(ok=>{
    if(!ok) return;
    state.chats=[];state.currentChat=null;save();renderPage();
  });
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
        <button class="fig-icon-btn" onclick="gcShowAddAgent()" title="添加分身">${SVG.plus}</button>
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
          <textarea id="gcInput" rows="1" placeholder="输入消息… (@ 提及分身)" onkeydown="gcOnKeyDown(event)" oninput="gcOnInput(this)"></textarea>
          <button class="send-btn" onclick="gcSendMessage()">${SVG.send}</button>
        </div>
      </div>`;
  } else {
    mainHtml=`<div class="gc-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
      <span>选择或创建一个分身房间开始聊天</span>
    </div>`;
  }

  return `<div class="gc-panel">
    <div class="gc-rooms" id="gcRoomsSidebar">
      <div class="gc-rooms-header"><h3>分身房间</h3>
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
  openModal(`<div class="rename-modal">
    <h3>编辑房间名称</h3>
    <input id="gcRenameInput" class="input" value="${esc(room.name||'')}" placeholder="输入房间名称" onkeydown="if(event.key==='Enter'){event.preventDefault();gcConfirmRenameRoom('${id}')}">
    <div class="rename-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="gcConfirmRenameRoom('${id}')">保存</button>
    </div>
  </div>`);
  setTimeout(()=>{const input=$('#gcRenameInput'); if(input){input.focus(); input.select();}},50);
}

function gcConfirmRenameRoom(id){
  const room=state.groupChat.rooms.find(r=>r.id===id);
  const name=$('#gcRenameInput')?.value?.trim();
  if(!room||!name) return;
  room.name=name;
  save();
  closeModal();
  renderPage();
}

function gcDeleteRoom(id) {
  askConfirm('确认删除该房间？该操作会删除本地保存的分身消息。').then(ok=>{
    if(!ok) return;
    state.groupChat.rooms = state.groupChat.rooms.filter(r => r.id !== id);
    if (state.groupChat.activeRoom === id) state.groupChat.activeRoom = null;
    delete state.groupChat.messages[id];
    delete state.groupChat.members[id];
    delete state.groupChat.agents[id];
    delete state.groupChat.typing[id];
    delete state.groupChat.contextStatus[id];
    save();
    renderPage();
  });
}

function gcShowCreateRoom(){
  const code=Math.random().toString(36).substring(2,8).toUpperCase();
  openModal(`
    <div style="padding:24px;min-width:360px">
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">创建分身房间</h3>
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
  const profiles=getProfiles().map(p=>p.id);
  const existingProfiles=(state.groupChat.agents[room.id]||[]).map(a=>a.profile);
  const available=profiles.filter(p=>!existingProfiles.includes(p));
  openModal(`
    <div style="padding:24px;min-width:360px">
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">添加分身</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">选择 Profile *</label>
          <select id="gcAgentProfile" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px">
            ${available.map(p=>`<option value="${p}">${p}</option>`).join('')}
            ${available.length===0?'<option disabled>所有 Profile 已添加</option>':''}
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">分身名称 *</label>
          <input id="gcAgentName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="给分身起个名字">
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

function getProfiles(){
  if(!_profilesCache){
    _profilesCache=LS.get('hermes.profiles',[
      {id:'default',name:'默认助手',modelId:'auto',model:scenarioModel('chat'),systemPrompt:'',color:'var(--c-block-lime)'},
      {id:'coder',name:'代码专家',modelId:state.modelsConfig?.scenarios?.reasoning||'auto',model:scenarioModel('reasoning'),systemPrompt:'你是一位资深代码专家，擅长代码审查、重构和架构设计。',color:'var(--c-block-lilac)'},
      {id:'pm',name:'产品经理',modelId:state.modelsConfig?.scenarios?.reasoning||'auto',model:scenarioModel('reasoning'),systemPrompt:'你是一位产品经理，擅长需求拆解、验收标准和产品方案。',color:'var(--c-block-cream)'},
      {id:'designer',name:'设计顾问',modelId:state.modelsConfig?.scenarios?.chat||'auto',model:scenarioModel('chat'),systemPrompt:'你是一位设计顾问，关注视觉层级、交互细节和用户体验。',color:'var(--c-block-mint)'},
      {id:'researcher',name:'研究员',modelId:state.modelsConfig?.scenarios?.reasoning||'auto',model:scenarioModel('reasoning'),systemPrompt:'你是一位研究员，擅长资料整理、分析和长文总结。',color:'var(--c-block-coral)'},
    ]);
    _profilesCache=_profilesCache.map(p=>normalizeProfile(p));
    LS.set('hermes.profiles',_profilesCache);
  }
  return _profilesCache;
}

function normalizeProfile(profile){
  const p={...profile};
  if(p.enabled===undefined) p.enabled=true;
  if(!Array.isArray(p.skillIds)) p.skillIds=[];
  if(!p.modelId) p.modelId=p.model&&p.model!=='auto'?p.model:'auto';
  if(!p.color) p.color='var(--c-block-lime)';
  if(!p.avatar) p.avatar='';
  return p;
}

function getActiveProfile(){
  const profiles=getProfiles();
  let p=profiles.find(p=>p.id===state.activeProfile&&p.enabled!==false);
  if(!p) p=profiles.find(p=>p.enabled!==false) || profiles[0] || null;
  if(p&&state.activeProfile!==p.id){state.activeProfile=p.id;save();}
  return p;
}

function profileForChat(chat=currentChat()){
  const profiles=getProfiles();
  const agentId=chat?.agentId||state.chatFullData?.[chat?.id]?.agentId||'';
  const byChat=agentId ? profiles.find(p=>p.id===agentId) : null;
  if(byChat) return byChat;
  return getActiveProfile();
}

gcShowAddAgent=function(){
  const room=state.groupChat.rooms.find(r=>r.id===state.groupChat.activeRoom);
  if(!room) return;
  const profiles=getProfiles();
  const existing=(state.groupChat.agents[room.id]||[]).map(a=>a.profileId);
  const available=profiles.filter(p=>!existing.includes(p.id));
  openModal(`<div style="padding:24px;min-width:420px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">添加分身</h3>
    <div style="display:grid;gap:12px">
      <label style="font-size:12px;color:var(--c-ink-muted)">选择角色</label>
      <select id="gcAgentProfile" onchange="toggleGcCustomAgent()">
        ${available.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.model||scenarioModel('chat'))}</option>`).join('')}
        <option value="__custom__">自定义分身</option>
      </select>
      <input id="gcAgentName" placeholder="分身名称，留空使用角色名称">
      <input id="gcAgentDesc" placeholder="一句话描述分身能力，可留空">
      <select id="gcAgentModel" style="display:none">
        <option value="auto">自动（按场景）</option>
        ${getEnabledModels().map(m=>`<option value="${esc(m.id)}">${esc(m.name)} · ${esc(m.provider)}</option>`).join('')}
      </select>
      <textarea id="gcAgentPrompt" placeholder="自定义分身的系统提示词 / 行为规则" style="display:none;min-height:100px"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="gcAddAgent()">添加</button></div>
    </div>
  </div>`);
};

function toggleGcCustomAgent(){
  const custom=$('#gcAgentProfile')?.value==='__custom__';
  ['#gcAgentModel','#gcAgentPrompt'].forEach(sel=>{const el=$(sel);if(el) el.style.display=custom?'block':'none'});
}

gcAddAgent=function(){
  const profileId=$('#gcAgentProfile')?.value;
  const custom=profileId==='__custom__';
  const role=custom?null:getProfiles().find(p=>p.id===profileId);
  if(!custom&&!role){toast('请先选择角色','error');return}
  const roomId=state.groupChat.activeRoom;
  const name=$('#gcAgentName')?.value?.trim()||(custom?'自定义分身':role.name);
  const prompt=$('#gcAgentPrompt')?.value?.trim()||'';
  const desc=$('#gcAgentDesc')?.value?.trim()||prompt||role?.systemPrompt||role?.name||name;
  const modelId=custom?($('#gcAgentModel')?.value||'auto'):(role.modelId||'auto');
  const colors=['#e53935','#8e24aa','#1e88e5','#43a047','#fb8c00','#00acc1','#6d4c41','#546e7a'];
  state.groupChat.agents[roomId].push({
    id:'a_'+Date.now(),roomId,agentId:'agent_'+Date.now(),profileId:custom?'custom_'+Date.now():profileId,
    profile:custom?(getModelById(modelId)?.name||scenarioModel('reasoning')):(role.model||scenarioModel('reasoning')),modelId,
    systemPrompt:prompt||role?.systemPrompt||'',
    name,description:desc,color:role?.color||colors[state.groupChat.agents[roomId].length%colors.length],invited:true,
  });
  save();closeModal();renderPage();toast('分身已添加','success');
};

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
  askConfirm('确认删除该房间？该操作会删除本地保存的分身消息。').then(ok=>{
    if(!ok) return;
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
  });
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
        const systemPrompt=`你是分身房间中的分身 "${agent.name}"，使用模型 ${agent.profile}。${agent.description?'你的能力：'+agent.description:''}${agent.systemPrompt?'\n角色规则：'+agent.systemPrompt:''}。请简洁回复，用中文。`;
        const messages=[{role:'system',content:systemPrompt},...history,{role:'user',content:'['+state.groupChat.userName+'] '+content}];
        const r=await fetch(apiBase()+'/api/chats/gc-stream',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({messages,model:agent.modelId||agent.profile,scene:'reasoning'}),
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
  let html=renderMessageMarkdown(content);
  agents.forEach(a=>{
    const escapedName=esc(a.name);
    html=html.replace(new RegExp('@'+escapedName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),`<span class="mention">@${escapedName}</span>`);
  });
  const raw=String(content||'');
  if(raw.length>240 && /(^|\n)#{1,6}\s|```|\|.+\||^\s*[-*]\s/m.test(raw)){
    const id='gc_md_'+Math.random().toString(36).slice(2);
    window.__gcMarkdownPreview=window.__gcMarkdownPreview||{};
    window.__gcMarkdownPreview[id]=raw;
    html+=`<div class="gc-md-actions"><button class="btn btn-xs btn-secondary" onclick="openGcMarkdownPreview('${id}')">预览 Markdown</button></div>`;
  }
  return html;
}

function openGcMarkdownPreview(id){
  const content=window.__gcMarkdownPreview?.[id]||'';
  if(!content) return;
  openModal(`<div style="padding:0;min-width:min(920px,92vw);max-width:92vw;max-height:86vh;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--c-hairline)">
      <h3 style="font-size:16px;font-weight:700">分身 Markdown 预览</h3>
      <button class="history-popup-close" onclick="closeModal()">${SVG.x}</button>
    </div>
    <div class="artifact-preview markdown-body" style="padding:22px;overflow:auto">${renderMessageMarkdown(content)}</div>
  </div>`);
  enhanceMessageMarkdown(document.querySelector('.modal'));
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


function normalizeSkillItem(s){
  return {
    ...s,
    description:s.description||s.desc||'',
    category:s.category||(s.tags&&s.tags[0])||'未分类',
    enabled:s.enabled!==undefined?s.enabled:s.on!==false,
  };
}

async function loadSkills(){
  const skills=await apiGet('/api/skills');
  if(!skills) return false;
  const selected=state.selectedSkill;
  state.skills=skills.map(normalizeSkillItem);
  syncSkillEnabledFlags();
  if(selected&&!state.skills.some(s=>s.id===selected)) state.selectedSkill=null;
  _profilesCache=null;
  return true;
}

async function refreshSkills(){
  const ok=await loadSkills();
  if(ok){
    save();
    renderPage();
    toast('Skill 已刷新','success');
    if(state.selectedSkill) setTimeout(()=>skPreviewPrimaryFile(state.selectedSkill),0);
  }else{
    toast('Skill 刷新失败，请确认后端已启动','error');
  }
}

function renderSkills(){
  const f=state.skillFilter;
  let filtered=state.skills.slice();
  if(f.source) filtered=filtered.filter(s=>s.source===f.source);
  if(f.search){
    const q=f.search.toLowerCase();
    filtered=filtered.filter(s=>(s.name||'').toLowerCase().includes(q)||(s.description||'').toLowerCase().includes(q));
  }
  filtered.sort((a,b)=>{
    if(!!b.pinned!==!!a.pinned) return b.pinned?1:-1;
    return String(a.name||'').localeCompare(String(b.name||''),'zh-Hans-CN');
  });
  const sel=state.selectedSkill?state.skills.find(s=>s.id===state.selectedSkill):null;

  let sidebarHtml=filtered.map(s=>`<div class="skill-item${state.selectedSkill===s.id?' active':''}" onclick="skSelect('${s.id}')">
    <span class="sk-source-dot ${s.source}"></span>
    <span class="sk-name">${esc(s.name)}</span>
    ${s.modified?'<span class="sk-modified">✎</span>':''}
    ${s.pinned?'<span class="sk-pinned">📌</span>':''}
  </div>`).join('');
  if(filtered.length===0) sidebarHtml='<div class="skill-empty" style="padding:40px 0;height:auto"><span>没有匹配的技能</span></div>';

  let detailHtml='';
  if(sel){
    const sourceLabel={builtin:'Hermes 内置',external:'我的 Skill',user:'自定义',custom:'自定义'}[sel.source]||sel.source;
    const files=(sel.files||[]).map(f=>typeof f==='string'?f:f.name).filter(Boolean);
    const triggers=Array.isArray(sel.triggers)?sel.triggers:String(sel.triggers||'').split(/[，,、\s]+/).filter(Boolean);
    let filesHtml=files.map(f=>`<div class="skill-file-item" onclick="skViewFile('${sel.id}','${esc(f)}')">${SVG.file} <span title="${esc(f)}">${esc(f)}</span></div>`).join('');
    detailHtml=`
      <div class="skill-detail-breadcrumb"><span onclick="skSelect(null)">技能中心</span> / ${esc(sel.name)}</div>
      <div class="skill-detail-header">
        <div class="skill-detail-title">
          <div class="skill-detail-name">${esc(sel.name)}</div>
          <button class="skill-edit-icon" onclick="skEdit('${sel.id}')" title="编辑技能" aria-label="编辑技能">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          </button>
        </div>
        <button class="fig-icon-btn" onclick="skTogglePin('${sel.id}')" title="${sel.pinned?'取消置顶':'置顶'}" style="${sel.pinned?'color:var(--c-accent)':''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${sel.pinned?'currentColor':'none'}" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </button>
      </div>
      <div class="skill-detail-desc">${esc(sel.description)}</div>
      <div class="skill-meta">
        <div class="skill-meta-item"><span class="sk-source-dot ${sel.source}" style="width:8px;height:8px"></span> ${sourceLabel}${sel.modified?' · 已修改':''}</div>
        <div class="skill-meta-item">分类：${esc(sel.category||(sel.tags||[])[0]||'未分类')} · 优先级：${esc(sel.priority||0)}</div>
        <div class="skill-meta-item">触发词：${triggers.length?triggers.map(t=>`<span class="tag">${esc(t)}</span>`).join(' '):'未设置'}</div>
        ${sel.root?`<div class="skill-meta-item" title="${esc(sel.root)}">路径：${esc(sel.root)}</div>`:''}
      </div>
      <div class="skill-detail-actions">
        <button class="btn btn-secondary btn-sm" onclick="suggestSkillTriggers('${sel.id}')" title="根据名称和描述生成触发词">
          生成触发词
        </button>
        <button class="btn btn-secondary btn-sm" onclick="skOpenFolder('${sel.id}')" title="打开文件夹">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          文件夹
        </button>
        ${sel.source!=='builtin'?`<button class="btn btn-secondary btn-sm" style="color:var(--c-error)" onclick="skDelete('${sel.id}')">删除</button>`:''}
        <div class="skill-toggle-wrap" onclick="event.stopPropagation()">
          <span class="skill-toggle-label">${sel.enabled?'已启用':'已停用'}</span>
          <label class="toggle skill-toggle" title="${sel.enabled?'关闭技能':'启用技能'}">
            <input type="checkbox" ${sel.enabled?'checked':''} onchange="skSetEnabled('${sel.id}',this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="skill-files">
        <h4>技能文件 <button class="btn btn-xs btn-secondary" style="margin-left:8px" onclick="refreshSkillFiles('${sel.id}')">刷新文件</button></h4>
        <div class="skill-file-list">${filesHtml||'<div style="font-size:13px;color:var(--c-ink-muted)">无附件</div>'}</div>
      </div>
      <div id="skFileContent"></div>
      `;
  } else {
    detailHtml=`<div class="skill-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>选择一个技能查看详情</span>
    </div>`;
  }

  return `<div class="skills-view">
    <div class="page-header"><h2>技能中心</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-secondary" onclick="refreshSkills()">刷新 Skill</button>
        <button class="btn btn-sm btn-primary" onclick="skAdd()">${SVG.plus} 添加技能</button>
      </div>
    </div>
    <div class="skills-layout">
      <div class="skills-sidebar">
        <div class="skill-search"><input placeholder="搜索技能…" value="${esc(f.search)}" oninput="skSearch(this.value)"></div>
        <div class="source-legend">
          <span class="legend-item${!f.source?' active':''}" onclick="skFilterSource(null)">全部</span>
          <span class="legend-item${f.source==='builtin'?' active':''}" onclick="skFilterSource('builtin')"><span class="legend-dot dot-builtin"></span>内置</span>
          <span class="legend-item${f.source==='external'?' active':''}" onclick="skFilterSource('external')"><span class="legend-dot dot-external"></span>我的 Skill</span>
        </div>
        <div class="skill-flat-list">${sidebarHtml}</div>
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
    refreshSkillFiles(id, true).then(()=>setTimeout(()=>skPreviewPrimaryFile(id),0));
  }
  save();renderPage();
}

async function skPreviewPrimaryFile(id){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  const files=(s.files||[]).map(f=>typeof f==='string'?f:f.name).filter(Boolean);
  const file=files.find(f=>/skill\.md$/i.test(f))||files.find(f=>/\.md$/i.test(f))||files[0];
  if(file) await skViewFileReal(id,file,{previewOnly:true});
}

async function refreshSkillFiles(id,silent){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  const data=await apiGet('/api/skills/'+encodeURIComponent(id)+'/files');
  if(data){
    s.root=data.root;
    s.files=(data.files||[]).map(f=>f.name||f);
    if(!silent) toast('技能文件已刷新','success');
    if(state.selectedSkill===id) renderPage();
  }else if(!silent){
    toast('技能文件读取失败，请确认后端已重启','error');
  }
}

function skToggle(id){
  const s=state.skills.find(x=>x.id===id);
  if(s){
    skSetEnabled(id,!s.enabled);
  }
}

function skSetEnabled(id,on){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  s.enabled=!!on;
  s.on=s.enabled;
  apiPut('/api/skills/'+encodeURIComponent(id),{on:s.on,enabled:s.enabled});
  save();renderPage();toast(s.enabled?'已启用':'已禁用','info');
}

function syncSkillEnabledFlags(){
  (state.skills||[]).forEach(s=>{
    if(s.enabled===undefined) s.enabled=s.on!==false;
    if(s.on===undefined) s.on=!!s.enabled;
    Object.assign(s, normalizeSkillMeta(s));
  });
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

function splitSkillTriggers(value){
  return String(value||'').split(/[，,、\s]+/).map(s=>s.trim()).filter(Boolean).slice(0,24);
}

function inferSkillTriggers(skill={}){
  const text=String([skill.name,skill.description,skill.desc,skill.category,(skill.tags||[]).join(' '),skill.prompt].filter(Boolean).join(' ')).toLowerCase();
  const groups=[
    {keys:['图像','图片','生图','改图','image','logo','海报','插画'],triggers:['生成图片','图片','生图','改图','海报','插画','logo']},
    {keys:['代码','bug','报错','重构','测试','开发','前端','后端','code'],triggers:['代码','bug','报错','重构','测试','接口','前端','后端']},
    {keys:['文档','写作','markdown','md','教程','方案','总结'],triggers:['文档','方案','教程','总结','Markdown','MD']},
    {keys:['设计','ui','视觉','交互','弹窗','卡片','按钮'],triggers:['设计','UI','视觉','交互','弹窗','卡片','按钮']},
    {keys:['记忆','偏好','习惯','长期','remember'],triggers:['记忆','偏好','习惯','长期','remember']},
    {keys:['搜索','联网','浏览','网页','资料','官网'],triggers:['搜索','联网','网页','资料','官网','最新']},
    {keys:['更新','安装','github','版本','升级'],triggers:['更新','安装','GitHub','版本','升级']},
  ];
  const found=[];
  groups.forEach(group=>{
    if(group.keys.some(k=>text.includes(k.toLowerCase()))) found.push(...group.triggers);
  });
  String(skill.name||'').split(/[\s/｜|_-]+/).filter(x=>x.length>=2&&x.length<=12).forEach(x=>found.push(x));
  return [...new Set(found)].slice(0,12);
}

function normalizeSkillMeta(skill={}){
  const next={...skill};
  if(!next.description && next.desc) next.description=next.desc;
  if(!next.category) next.category=(Array.isArray(next.tags)&&next.tags[0])||'未分类';
  if(next.priority===undefined || next.priority===null || next.priority==='') next.priority=0;
  if(!Array.isArray(next.triggers)) next.triggers=splitSkillTriggers(next.triggers||'');
  return next;
}

function suggestSkillTriggers(id){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  const triggers=inferSkillTriggers(s);
  if(!triggers.length){toast('暂时没有推断到合适触发词','info');return}
  s.triggers=triggers;
  s.modified=true;
  apiPut('/api/skills/'+encodeURIComponent(id),{triggers:s.triggers,priority:Number(s.priority||0),category:s.category||((s.tags||[])[0])||'未分类'});
  save();renderPage();toast('已生成触发词建议','success');
}


function skFilterSource(src){
  state.skillFilter.source=src||null;
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
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">触发词</label>
          <input id="skAddTriggers" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" placeholder="例如：代码、bug、重构">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">优先级</label>
          <input id="skAddPriority" type="number" min="0" max="100" value="50" style="width:120px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px">
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
  const triggers=splitSkillTriggers($('#skAddTriggers')?.value||'');
  const priority=Number($('#skAddPriority')?.value||50)||0;
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
  const body={name,desc,tags:[cat],category:cat,triggers,priority,source:'custom',on:true,prompt:fileContent||''};
  if(fileContent) body.content=fileContent;
  const data=await apiPost('/api/skills/import',body);
  if(data){
    state.skills.push({...data,category:cat,description:desc,triggers,priority,enabled:true,modified:false,pinned:false,useCount:0,viewCount:0,patchCount:0,files:[fileName],tags:[cat]});
  }else{
    state.skills.push({id:'sk_'+Date.now(),name,description:desc,category:cat,triggers,priority,source:'local',enabled:true,modified:false,pinned:false,useCount:0,viewCount:0,patchCount:0,files:[fileName],tags:[cat]});
  }
  save();closeModal();renderPage();toast('技能已添加','success');
}

function skEdit(id){
  const s=state.skills.find(x=>x.id===id);
  if(!s) return;
  const triggers=Array.isArray(s.triggers)?s.triggers.join('、'):String(s.triggers||'');
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
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">触发词</label>
          <input id="skEditTriggers" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(triggers)}" placeholder="例如：设计、UI、弹窗">
        </div>
        <div>
          <label style="font-size:12px;color:var(--c-ink-muted);margin-bottom:4px;display:block">优先级</label>
          <input id="skEditPriority" type="number" min="0" max="100" style="width:120px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:14px" value="${esc(s.priority||0)}">
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
  s.triggers=splitSkillTriggers($('#skEditTriggers')?.value||'');
  s.priority=Number($('#skEditPriority')?.value||0)||0;
  s.modified=true;
  await apiPut('/api/skills/'+id,{name:s.name,desc:s.description,tags:[s.category],category:s.category,triggers:s.triggers,priority:s.priority});
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

async function skViewFileReal(skillId,fileName,options={}){
  const el=$('#skFileContent');
  if(!el) return;
  const mode=options.mode||el.dataset.mode||'source';
  el.dataset.skillId=skillId;
  el.dataset.fileName=fileName;
  el.dataset.mode=mode;
  el.innerHTML='<div class="skill-file-preview-card">正在读取文件...</div>';
  const data=await apiGet('/api/skills/'+encodeURIComponent(skillId)+'/file?path='+encodeURIComponent(fileName));
  if(!data){el.innerHTML='<div class="skill-file-preview-card">文件读取失败</div>';return}
  const content=data.content||'';
  const isPreview=mode==='preview';
  el.innerHTML=`<div class="skill-file-preview-card">
    <div class="skill-file-preview-head">
      <div><strong>${esc(fileName)}</strong><span>${esc(data.path||fileName)}</span></div>
      <div class="skill-file-mode-tabs">
        <button class="skill-file-mode-btn ${isPreview?'active':''}" onclick="skSwitchFileMode('preview')">预览</button>
        <button class="skill-file-mode-btn ${!isPreview?'active':''}" onclick="skSwitchFileMode('source')">源码</button>
      </div>
      <button class="btn btn-primary btn-sm" onclick="skSaveFile('${esc(skillId)}','${esc(fileName)}')" ${isPreview?'style="display:none"':''}>保存</button>
    </div>
    ${isPreview?`<div class="skill-md-preview-full artifact-preview markdown-body">${renderMessageMarkdown(content)}</div>`:`<textarea id="skFileEditor" class="skill-file-editor">${esc(content)}</textarea>`}
  </div>`;
  enhanceMessageMarkdown(el);
}

function skSwitchFileMode(mode){
  const el=$('#skFileContent');
  if(!el?.dataset.skillId||!el?.dataset.fileName) return;
  skViewFileReal(el.dataset.skillId,el.dataset.fileName,{mode});
}
skViewFile=skViewFileReal;
async function skSaveFile(skillId,fileName){
  const content=$('#skFileEditor')?.value||'';
  const data=await apiPut('/api/skills/'+encodeURIComponent(skillId)+'/file?path='+encodeURIComponent(fileName),{content});
  if(data){toast('技能文件已保存','success');skViewFile(skillId,fileName)}
  else toast('保存失败','error');
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

function renderMemoryLibrary(){
  const data=state.memory.data;
  const current=state.memory.current;
  const core=data?.core||[];
  const groups=data?.conversations||[];
  const allConversations=data?.conversationsFlat||groups.flatMap(g=>g.files||[]).sort((a,b)=>(b.mtime||0)-(a.mtime||0));
  const typeGroups=data?.conversationTypes||[];
  const stats=data?.stats||{};
  const selectedId=state.memory.selectedId;
  const mode=state.memory.mode||'preview';
  const conversationView=state.memory.conversationView||'all';
  const workspacePath=data?.workspaceDir||'C:\\Users\\Administrator\\Desktop\\Hermes Agent';
  const currentPath=current?.path||'选择左侧文件查看内容';
  const headerMeta=current?[
    current.type==='core'?'核心文件':'对话记忆',
    current.mtime?new Date(current.mtime).toLocaleString():'',
    current.size?formatBytes(current.size):'',
  ].filter(Boolean).join(' · '):'选择左侧文件查看内容';

  const coreHtml=core.map(item=>`
    <button class="memory-file${selectedId===item.id?' active':''}" onclick="selectMemoryFile('core','${esc(item.id)}')">
      <span class="memory-file-icon">${SVG.file}</span>
      <span class="memory-file-main">
        <span class="memory-file-title">${esc(item.title)}</span>
        <span class="memory-file-desc">${esc(item.description||item.preview||'')}</span>
      </span>
    </button>`).join('');

  const conversationCard=item=>`
    <button class="memory-file compact${selectedId===item.id?' active':''}" onclick="selectMemoryFile('conversation','${esc(item.id)}')">
      <span class="memory-file-icon">${SVG.history}</span>
      <span class="memory-file-main">
        <span class="memory-file-title">${esc(item.title)}</span>
        <span class="memory-file-desc">${esc(item.summary||item.preview||'暂无预览')}</span>
        <span class="memory-file-meta">${item.mtime?new Date(item.mtime).toLocaleDateString('zh-CN'):''}${item.mdType?' · '+esc(item.mdType):''}</span>
      </span>
    </button>`;
  const allConversationHtml=allConversations.length?`
    <div class="memory-month">
      <div class="memory-month-title">全部 · 按时间 <span>${allConversations.length}</span></div>
      ${allConversations.map(conversationCard).join('')}
    </div>`:'<div class="memory-empty-small">还没有对话 Markdown。发送一次对话后会自动生成。</div>';
  const typeConversationHtml=typeGroups.length?typeGroups.map(group=>`
    <div class="memory-month">
      <div class="memory-month-title">${esc(group.type)} <span>${group.files.length}</span></div>
      ${(group.files||[]).map(conversationCard).join('')}
    </div>`).join(''):'<div class="memory-empty-small">类型分类等待 Agent 归纳。当前还没有可分类的 Markdown。</div>';
  const conversationHtml=conversationView==='type'?typeConversationHtml:allConversationHtml;

  const shownContent=current?.type==='conversation'&&mode==='compact'?(current.compactContent||current.content||''):(current?.content||'');
  const previewHtml=current?renderMessageMarkdown(shownContent):`<div class="memory-empty">
    ${SVG.memory}
    <h3>选择一份记忆</h3>
    <p>核心记忆会注入 Hermes Agent，对话记忆来自聊天 Markdown 归档。</p>
  </div>`;
  const canEdit=current?.type==='core';

  return `<div class="memory-view">
    <div class="memory-topbar">
      <div class="memory-crumb"><span>技能中心</span><span>/</span><strong>记忆储存</strong></div>
      <div class="memory-workspace-path">工作区路径：<code>${esc(workspacePath)}</code></div>
      <button class="btn btn-sm btn-secondary" onclick="loadMemoryStore(true)">刷新</button>
    </div>
    <div class="memory-subbar">
      <span>核心记忆 ${stats.coreCount||core.length} 份</span>
      <span>历史对话文件 ${stats.conversationCount||0} 份</span>
      <span>AI摘要会把长对话压缩成可复用上下文，原文可随时切换</span>
    </div>
    <div class="memory-library">
      <aside class="memory-sidebar">
        <div class="memory-side-section">
          <div class="memory-side-heading"><div><strong>核心文件</strong><small>引导角色、身份和工具指南。</small></div></div>
          ${coreHtml||'<div class="memory-empty-small">核心记忆初始化中...</div>'}
        </div>
        <div class="memory-side-section fill">
          <div class="memory-side-heading"><div><strong>历史对话文件</strong><small>默认按时间排序，也可按 Agent 推断的类型查看。</small></div></div>
          <div class="memory-list-tabs">
            <button class="${conversationView==='all'?'active':''}" onclick="setMemoryConversationView('all')">全部</button>
            <button class="${conversationView==='type'?'active':''}" onclick="setMemoryConversationView('type')">按类型</button>
          </div>
          <div class="memory-conversation-list">${conversationHtml}</div>
        </div>
      </aside>
      <section class="memory-reader">
        <div class="memory-reader-head">
          <div>
            <div class="memory-reader-title">${esc(current?.file||current?.title||'记忆预览')}</div>
            <div class="memory-reader-path">${esc(currentPath)}</div>
            <div class="memory-reader-meta">${esc(headerMeta)}</div>
          </div>
          ${current?`<div class="memory-reader-actions">
            ${current.type==='conversation'?`<button class="btn btn-xs ${mode==='compact'?'btn-primary':'btn-secondary'}" onclick="setMemoryMode('compact')">AI摘要</button>`:''}
            <button class="btn btn-xs ${mode==='preview'?'btn-primary':'btn-secondary'}" onclick="setMemoryMode('preview')">预览</button>
            <button class="btn btn-xs ${mode==='source'?'btn-primary':'btn-secondary'}" onclick="setMemoryMode('source')">${canEdit?'编辑':'原文'}</button>
            ${canEdit&&mode==='source'?`<button class="btn btn-xs btn-secondary" onclick="cancelMemoryEdit()">取消</button><button class="btn btn-xs btn-primary" onclick="saveCoreMemory('${esc(current.id)}')">保存</button>`:''}
          </div>`:''}
        </div>
        <div class="memory-content-label">
          <span>内容</span>
          ${current?`<span>${mode==='compact'?'AI可用的压缩上下文':mode==='source'?(canEdit?'编辑源码':'原始 Markdown'):'Markdown 预览'}</span>`:''}
        </div>
        <div class="memory-reader-body">
          ${state.memory.loading?'<div class="memory-empty-small">正在读取记忆...</div>':mode==='source'&&current?`<textarea id="memoryEditor" class="memory-editor" ${canEdit?'':'readonly'}>${esc(state.memory.editDraft ?? current.content ?? '')}</textarea>`:`<div class="artifact-preview memory-preview markdown-body">${previewHtml}</div>`}
        </div>
      </section>
    </div>
  </div>`;
}

renderMemory=renderMemoryLibrary;

function rememberMemorySidebarScroll(){
  const el=document.querySelector('.memory-sidebar');
  if(el) state.memory.sidebarScroll=el.scrollTop||0;
}

function restoreMemorySidebarScroll(){
  const top=state.memory.sidebarScroll||0;
  requestAnimationFrame(()=>{
    const el=document.querySelector('.memory-sidebar');
    if(el) el.scrollTop=top;
  });
}

function setMemoryConversationView(view){
  rememberMemorySidebarScroll();
  state.memory.conversationView=view;
  renderPage();
  restoreMemorySidebarScroll();
}

async function loadMemoryStore(force){
  if(force) state.memory.failed=false;
  if(state.memory.data&&!force) return state.memory.data;
  state.memory.loading=true;
  const data=await apiGet('/api/memory');
  state.memory.loading=false;
  if(!data){state.memory.failed=true;toast('记忆读取失败，请重启后端服务','error');renderPage();return null}
  state.memory.failed=false;
  state.memory.data=data;
  if(!state.memory.selectedId&&data.core?.length){
    state.memory.selectedType='core';
    state.memory.selectedId=data.core[0].id;
  }
  if(force) toast('记忆已刷新','success');
  renderPage();
  restoreMemorySidebarScroll();
  if(state.memory.selectedId&&!state.memory.current){
    selectMemoryFile(state.memory.selectedType,state.memory.selectedId);
  }
  return data;
}
async function selectMemoryFile(type,id){
  rememberMemorySidebarScroll();
  state.memory.selectedType=type;
  state.memory.selectedId=id;
  state.memory.mode=type==='conversation'?'compact':'preview';
  state.memory.editDraft=null;
  state.memory.loading=true;
  renderPage();
  restoreMemorySidebarScroll();
  const path=type==='core'?'/api/memory/core/':'/api/memory/conversation/';
  const item=await apiGet(path+encodeURIComponent(id));
  state.memory.loading=false;
  if(!item){toast('读取记忆失败','error');renderPage();return}
  state.memory.current=item;
  renderPage();
  restoreMemorySidebarScroll();
  requestAnimationFrame(()=>{
    const body=document.querySelector('.memory-reader-body');
    if(body) body.scrollTop=0;
  });
}
function setMemoryMode(mode){
  if(mode==='source'&&state.memory.current?.type==='core'){
    state.memory.editDraft=state.memory.current.content||'';
  }
  state.memory.mode=mode;
  renderPage();
}
function cancelMemoryEdit(){
  state.memory.editDraft=null;
  state.memory.mode='preview';
  renderPage();
}
async function saveCoreMemory(id){
  const content=$('#memoryEditor')?.value||'';
  const item=await apiPut('/api/memory/core/'+encodeURIComponent(id),{content});
  if(!item){toast('保存失败','error');return}
  state.memory.current=item;
  state.memory.data=null;
  state.memory.selectedType='core';
  state.memory.selectedId=id;
  state.memory.editDraft=null;
  state.memory.mode='preview';
  await loadMemoryStore(true);
  state.memory.current=item;
  renderPage();
  toast('核心记忆已保存','success');
}

function renderModelsLegacy(){
  const providers=[];
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
          <div><label style="font-size:12px;color:var(--c-ink-muted)">API URL</label><input id="fetchUrl" placeholder="https://your-provider.example/v1/models" style="width:100%;margin-top:4px"></div>
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
  const providers=[];
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
let usageRange=LS.get('hermes.usageRange','30d');
let usageCustomStart=LS.get('hermes.usageCustomStart','');
let usageCustomEnd=LS.get('hermes.usageCustomEnd','');
function renderModelsV2Legacy(){
  const cfg=state.modelsConfig||{};
  const lib=Array.isArray(cfg.library)?cfg.library:[];
  const enabled=lib.filter(m=>m.enabled!==false);
  const scenarios=cfg.scenarios||{};
  const fastestChat=fastestBenchmarkedChatModel();
  const scenarioFallback={chat:'普通对话',reasoning:'深度推理',image:'图像生成'};
  const optionHtml=(selected)=>`<option value="">未设置</option>`+enabled.map(m=>`<option value="${esc(m.id)}"${selected===m.id?' selected':''}>${esc(m.name)} · ${esc(m.provider)}</option>`).join('');
  const groups=lib.reduce((acc,m)=>{const k=m.provider||'custom';(acc[k]=acc[k]||[]).push(m);return acc},{});
  const row=m=>`<div class="model-lib-row">
    <label class="model-check"><input type="checkbox" ${m.enabled!==false?'checked':''} onchange="toggleLibraryModel('${esc(m.id)}',this.checked)"><span></span></label>
    <div class="model-lib-main">
      <div class="model-lib-name">${esc(m.name)}</div>
      <div class="model-lib-meta">${esc(m.apiFormat||'openai-chat')} · ${esc(m.authType||'bearer')} · ${esc(m.base||'未填写 Base URL')}</div>
    </div>
    <div class="model-lib-tags">${(m.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div>
    <button class="btn btn-xs btn-secondary" onclick="editLibraryModel('${esc(m.id)}')">编辑</button>
    <button class="btn btn-xs btn-secondary" onclick="testLibraryModel('${esc(m.id)}')">测试</button>
    <button class="btn btn-xs btn-ghost" style="color:var(--c-error)" onclick="deleteLibraryModel('${esc(m.id)}')">删除</button>
  </div>`;
  const groupHtml=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([provider,items])=>`
    <div class="model-provider-group">
      <div class="model-provider-head"><strong>${esc(provider)}</strong><span>${items.filter(m=>m.enabled!==false).length}/${items.length} 已启用</span></div>
      ${items.map(row).join('')}
    </div>`).join('');
  return `<div class="models-view">
    <div class="page-header"><h2>模型配置</h2><button class="btn btn-sm btn-primary" onclick="addModelModal()">添加模型</button></div>
    <div class="models-content">
      <div class="model-layout">
        <section class="model-panel">
          <h3>应用场景</h3>
          <p>对话页面默认使用“自动”，也就是这里配置的普通对话模型；角色和分身也会共用同一个模型库。</p>
          ${[
            ['chat','普通对话','日常问答、轻量任务，对模型要求不高。'],
            ['reasoning','深度推理','复杂操作、代码、规划、长链路任务。'],
            ['image','图像生成','有图像模型时，Agent 可调用它生成图片。'],
          ].map(([id,title,desc])=>`<div class="scenario-row">
            <div><strong>${title}</strong><span>${desc}</span></div>
            <select onchange="setScenarioModel('${id}',this.value)">${optionHtml(scenarios[id])}</select>
          </div>`).join('')}
        </section>
        <section class="model-panel">
          <h3>获取模型</h3>
          <p>右侧负责连接 Provider，通过 URL 和 Key 拉取模型列表；勾选后按 Provider 分组加入模型库。</p>
          <div class="model-connector-grid">
            <input id="mProvider" placeholder="Provider 名称，如 deepseek" value="${esc(state.model.provider||'deepseek')}">
            <select id="mApiFormat" onchange="applyApiFormatPreset()">
              <option value="openai-chat">OpenAI 兼容 / Chat Completions</option>
              <option value="ollama">Ollama / 本地</option>
              <option value="anthropic_messages">Anthropic / Messages</option>
              <option value="gemini">Gemini（预留）</option>
            </select>
            <input id="mBase" placeholder="Base URL" value="${esc(state.model.base||'')}">
            <select id="mAuthType" onchange="toggleCustomAuthHeader()">
              <option value="bearer">Bearer Token</option>
              <option value="x-api-key">x-api-key</option>
              <option value="api-key">api-key</option>
              <option value="custom">自定义 Header</option>
              <option value="none">无需认证</option>
            </select>
            <input id="mAuthHeader" placeholder="自定义认证 Header" style="display:none">
            <input id="mKey" type="password" placeholder="API Key / Token" value="${esc(state.model.key||'')}">
            <button class="btn btn-secondary" onclick="fetchModelsForLibrary()">获取模型</button>
          </div>
          <div id="modelMsg" class="model-msg"></div>
          <div id="fetchModelsList" class="model-fetch-list" style="display:none">
            <div class="model-fetch-actions"><button class="btn btn-xs btn-secondary" onclick="selectAllFetchModels()">全选</button><button class="btn btn-xs btn-secondary" onclick="deselectAllFetchModels()">取消全选</button><button class="btn btn-xs btn-primary" onclick="addSelectedFetchedModels()">加入模型库</button></div>
            <div id="fetchModelsItems"></div>
          </div>
        </section>
      </div>
      <section class="model-panel">
        <h3>模型库</h3>
        <p>模型库共用给对话、角色配置和分身。一个模型可以同时用于多个场景或多个角色。</p>
        <div class="model-lib-list">${lib.length?groupHtml:'<div class="empty-text">暂无模型，请先添加或获取模型。</div>'}</div>
      </section>
    </div>
  </div>`;
}

// Legacy model page kept only for reference; the active entry is renderModelsV3 below.

async function persistModelsConfig(cfg){
  const data=await apiPut('/api/models',cfg);
  if(data) state.modelsConfig=data;
  return data;
}
async function setScenarioModel(scene,id){
  const cfg=state.modelsConfig||{};
  cfg.scenarios={...(cfg.scenarios||{}),[scene]:id};
  if(scene==='chat') cfg.current=id || cfg.current || '';
  await persistModelsConfig(cfg);
  if(scene==='chat'){
    state.chatModelOverride='auto';
    const item=getModelById(id);
    if(item) state.model={...state.model,provider:item.provider||'',model:item.name||'',base:item.base||'',key:item.key||''};
    save();
  }
  toast('场景模型已更新','success');
  renderPage();
}

async function applyFastestChatModel(){
  const model=fastestBenchmarkedChatModel();
  if(!model){toast('请先给聊天模型测速','info');return}
  await setScenarioModel('chat',model.id);
  toast(`已切换普通对话为最快模型：${model.name}`,'success');
}
function toggleLibraryModel(id,on){
  const cfg=state.modelsConfig||{};
  const item=(cfg.library||[]).find(m=>m.id===id);
  if(item){item.enabled=on;persistModelsConfig(cfg).then(()=>renderPage())}
}
function applyApiFormatPreset(){
  const fmt=$('#mApiFormat')?.value||'openai-chat';
  const base=$('#mBase');
  const auth=$('#mAuthType');
  if(fmt==='ollama'){
    if(base&&!base.value) base.value='http://127.0.0.1:11434';
    if(auth) auth.value='none';
  }else if(fmt==='openai-chat'){
    if(auth&&auth.value==='none') auth.value='bearer';
  }else if(fmt==='anthropic'||fmt==='anthropic_messages'){
    if(base&&!base.value) base.value='https://api.anthropic.com';
    if(auth) auth.value='x-api-key';
  }else if(fmt==='gemini'){
    if(base&&!base.value) base.value='https://generativelanguage.googleapis.com';
    if(auth) auth.value='x-api-key';
  }
  toggleCustomAuthHeader();
}
function toggleCustomAuthHeader(){
  const input=$('#mAuthHeader');
  if(input) input.style.display=$('#mAuthType')?.value==='custom'?'block':'none';
}
async function fetchModelsForLibrary(){
  const provider=$('#mProvider')?.value?.trim()||'custom';
  const base=$('#mBase')?.value?.trim();
  const key=$('#mKey')?.value||'';
  const apiFormat=$('#mApiFormat')?.value||'openai-chat';
  const authType=$('#mAuthType')?.value||'bearer';
  const authHeader=$('#mAuthHeader')?.value?.trim()||'';
  const msg=$('#modelMsg');
  if(!base){toast('请填写 Base URL','error');return}
  if(msg) msg.textContent='正在获取模型...';
  const data=await apiPost('/api/models/fetch-remote',{base,key,apiFormat,authType,authHeader});
  if(!data||!data.models?.length){if(msg) msg.textContent='未找到模型或获取失败';return}
  state._fetchedModels={provider,base,key,apiFormat,authType,authHeader,models:data.models.map(m=>typeof m==='string'?m:(m.id||m.name||''))};
  const box=$('#fetchModelsList'), items=$('#fetchModelsItems');
  if(box) box.style.display='block';
  if(items) items.innerHTML=state._fetchedModels.models.filter(Boolean).map(name=>`<label class="model-fetch-item"><input type="checkbox" class="fetch-model-cb" value="${esc(name)}" checked><span>${esc(name)}</span></label>`).join('');
  if(msg) msg.textContent='找到 '+data.models.length+' 个模型';
  state.model={...state.model,provider,base,key};
  save();
}
function selectAllFetchModels(){document.querySelectorAll('.fetch-model-cb').forEach(c=>c.checked=true)}
function deselectAllFetchModels(){document.querySelectorAll('.fetch-model-cb').forEach(c=>c.checked=false)}
async function addSelectedFetchedModels(){
  const selected=[...document.querySelectorAll('.fetch-model-cb:checked')].map(c=>c.value);
  const f=state._fetchedModels;
  if(!f||!selected.length){toast('请先选择模型','info');return}
  const cfg=state.modelsConfig||{library:[],scenarios:{}};
  const existing=new Map((cfg.library||[]).map(m=>[m.id,m]));
  selected.forEach(name=>{
    existing.set(`${f.provider}:${name}`,{id:`${f.provider}:${name}`,provider:f.provider,name,base:f.base,key:f.key,enabled:true,tags:[],apiFormat:f.apiFormat,authType:f.authType,authHeader:f.authHeader});
  });
  cfg.library=[...existing.values()];
  await persistModelsConfig(cfg);
  toast('已加入 '+selected.length+' 个模型','success');
  renderPage();
}
function addModelModal(){
  openModelEditor();
}

function openModelEditor(model){
  const isEdit=!!model;
  openModal(`<div style="padding:24px;min-width:460px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">${isEdit?'编辑模型':'添加模型'}</h3>
    <div style="display:grid;gap:12px">
      <input id="addModelProvider" placeholder="Provider，例如 openai / deepseek / siliconflow" value="${esc(model?.provider||'')}">
      <input id="addModelName" placeholder="模型名称，例如 claude-sonnet-thinking" value="${esc(model?.name||'')}">
      <select id="addModelApiFormat">
        ${['openai-chat','ollama','anthropic_messages','gemini'].map(v=>`<option value="${v}"${(model?.apiFormat||'openai-chat')===v?' selected':''}>${v==='openai-chat'?'OpenAI 兼容 / Chat Completions':v==='ollama'?'Ollama / 本地':v==='anthropic_messages'?'Anthropic / Messages':'Gemini（预留）'}</option>`).join('')}
      </select>
      <input id="addModelBase" placeholder="Base URL" value="${esc(model?.base||'')}">
      <select id="addModelAuthType" onchange="document.getElementById('addModelAuthHeader').style.display=this.value==='custom'?'block':'none'">
        ${['bearer','x-api-key','api-key','custom','none'].map(v=>`<option value="${v}"${(model?.authType||'bearer')===v?' selected':''}>${v==='bearer'?'Bearer Token':v==='custom'?'自定义 Header':v==='none'?'无需认证':v}</option>`).join('')}
      </select>
      <input id="addModelAuthHeader" placeholder="自定义认证 Header" style="${(model?.authType||'bearer')==='custom'?'':'display:none'}" value="${esc(model?.authHeader||'')}">
      <input id="addModelKey" type="password" placeholder="API Key" value="${esc(model?.key||'')}">
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doSaveModel('${esc(model?.id||'')}')">${isEdit?'保存':'添加'}</button></div>
    </div>
  </div>`);
}

function editLibraryModel(id){
  const model=getModelById(id);
  if(!model){toast('模型不存在','error');return}
  openModelEditor(model);
}

async function doSaveModel(existingId){
  const provider=$('#addModelProvider')?.value?.trim()||'custom';
  const name=$('#addModelName')?.value?.trim();
  if(!name){toast('请填写模型名称','error');return}
  const item={id:existingId||`${provider}:${name}`,provider,name,base:$('#addModelBase')?.value?.trim()||'',key:$('#addModelKey')?.value||'',enabled:true,tags:getModelById(existingId)?.tags||[],apiFormat:$('#addModelApiFormat')?.value||'openai-chat',authType:$('#addModelAuthType')?.value||'bearer',authHeader:$('#addModelAuthHeader')?.value?.trim()||''};
  const data=await apiPost('/api/models/library',item);
  if(data){state.modelsConfig=data;closeModal();renderPage();toast(existingId?'模型已保存':'模型已添加','success')}
}
async function deleteLibraryModel(id){
  const okConfirm=await askConfirm('确认删除这个模型？如果它正在某个应用场景中使用，会自动清空该场景选择。');
  if(!okConfirm) return;
  const data=await fetch(apiBase()+'/api/models/library/'+encodeURIComponent(id),{method:'DELETE',cache:'no-store',headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()).catch(()=>null);
  if(data&&data.code===0){state.modelsConfig=data.data;renderPage();toast('模型已删除','info')}
  else toast('删除失败','error');
}
async function testLibraryModel(id){
  const m=getModelById(id);
  if(!m){toast('模型不存在','error');return}
  const r=await fetch(apiBase()+'/api/models/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:{base:m.base,model:m.name,key:m.key,apiFormat:m.apiFormat,authType:m.authType,authHeader:m.authHeader}})});
  const j=await r.json().catch(()=>({}));
  if(j.ok) toast('连接成功: '+m.name,'success');
  else toast('连接失败: '+(j.error||j.msg||'未知错误'),'error');
}

function apiFormatLabel(fmt){
  return fmt==='openai-chat'?'OpenAI 兼容':fmt==='openai-image'?'OpenAI 图片接口':fmt==='ollama'?'Ollama':(fmt==='anthropic'||fmt==='anthropic_messages')?'Anthropic Messages':fmt==='gemini'?'Gemini':(fmt||'未设置');
}
function authTypeLabel(type,header=''){
  if(type==='bearer') return 'Bearer Token';
  if(type==='custom') return header?`自定义 Header: ${header}`:'自定义 Header';
  if(type==='none') return '无需认证';
  return type||'未设置';
}
function domId(value){
  return String(value||'x').replace(/[^a-zA-Z0-9_-]/g,ch=>'_'+ch.charCodeAt(0).toString(16));
}
function inferModelTags(name=''){
  const text=String(name).toLowerCase();
  const tags=[];
  if(/r1|reason|thinking|think|推理|思考/.test(text)) tags.push('reasoning');
  if(/vision|image|draw|sd|dall|flux|midjourney|图像|图片/.test(text)) tags.push('vision');
  if(!tags.includes('vision')) tags.unshift('chat');
  return [...new Set(tags)];
}
function modelFormValues(prefix='m'){
  return {
    provider:$(`#${prefix}Provider`)?.value?.trim()||'',
    base:$(`#${prefix}Base`)?.value?.trim()||'',
    key:$(`#${prefix}Key`)?.value||'',
    apiFormat:$(`#${prefix}ApiFormat`)?.value||'openai-chat',
    authType:$(`#${prefix}AuthType`)?.value||'bearer',
    authHeader:$(`#${prefix}AuthHeader`)?.value?.trim()||'',
  };
}
function applyApiFormatPreset(prefix='m'){
  const fmt=$(`#${prefix}ApiFormat`)?.value||'openai-chat';
  const provider=$(`#${prefix}Provider`)?.value?.trim()||'';
  const base=$(`#${prefix}Base`);
  const auth=$(`#${prefix}AuthType`);
  if(fmt==='ollama'){
    if(base&&!base.value) base.value='http://127.0.0.1:11434';
    if(auth) auth.value='none';
  }else if(fmt==='openai-chat'){
    if(auth&&auth.value==='none') auth.value='bearer';
    if(auth&&/new\s*api|one\s*api|中转|gateway/i.test(provider)) auth.value='bearer';
  }else if(fmt==='openai-image'){
    if(auth&&auth.value==='none') auth.value='bearer';
  }else if(fmt==='anthropic'||fmt==='anthropic_messages'){
    if(auth) auth.value='x-api-key';
  }else if(fmt==='gemini'){
    if(auth) auth.value='x-api-key';
  }
  toggleCustomAuthHeader(prefix);
  updateModelFormatHint(prefix);
}
function applyProviderPreset(prefix='m'){
  const provider=$(`#${prefix}Provider`)?.value?.trim()||'';
  const fmt=$(`#${prefix}ApiFormat`);
  const auth=$(`#${prefix}AuthType`);
  if(/ollama/i.test(provider)){
    if(fmt) fmt.value='ollama';
    if(auth) auth.value='none';
  }else if(/anthropic|claude/i.test(provider)){
    if(fmt) fmt.value='anthropic_messages';
    if(auth) auth.value='x-api-key';
  }else if(/new\s*api|one\s*api|openai|deepseek|siliconflow|openrouter|中转|gateway/i.test(provider)){
    if(fmt) fmt.value='openai-chat';
    if(auth&&auth.value==='none') auth.value='bearer';
  }
  applyApiFormatPreset(prefix);
}
function toggleCustomAuthHeader(prefix='m'){
  const input=$(`#${prefix}AuthHeader`);
  if(input) input.style.display=$(`#${prefix}AuthType`)?.value==='custom'?'block':'none';
  updateModelFormatHint(prefix);
}
function updateModelFormatHint(prefix='m'){
  const hint=$(`#${prefix}FormatHint`);
  if(!hint) return;
  const {apiFormat,authType}=modelFormValues(prefix);
  if(apiFormat==='ollama') hint.textContent='Ollama 会测试 Base URL + /api/chat，通常只用于本机 11434。';
  else if(apiFormat==='openai-chat') hint.textContent=`OpenAI 兼容会测试 Base URL + /v1/chat/completions；认证方式：${authTypeLabel(authType)}。Claude/Kiro 中转模型如对话空回复，改用 Anthropic Messages。`;
  else if(apiFormat==='openai-image') hint.textContent=`OpenAI 图片接口会用 Base URL + /v1/models 验证连接；文生图请求 /v1/images/generations，上传参考图时优先请求 /v1/images/edits。`;
  else if(apiFormat==='anthropic'||apiFormat==='anthropic_messages') hint.textContent=`Anthropic Messages 会测试 Base URL + /v1/messages；Claude/Kiro 中转模型建议用这个格式，认证方式通常是 x-api-key。`;
  else hint.textContent='该格式目前主要是字段预留；如走中转站，请按 Provider 实际协议选择。';
}

function renderModelsV3(){
  const cfg=state.modelsConfig||{library:[],scenarios:{}};
  const lib=Array.isArray(cfg.library)?cfg.library:[];
  const enabled=lib.filter(m=>m.enabled!==false);
  const scenarios=cfg.scenarios||{};
  const scenarioRows=[
    ['chat','普通对话','日常问答和轻量任务。对话页选择“自动”时优先使用这里。'],
    ['reasoning','深度推理','复杂操作、代码、规划、长链路任务和分身协作。'],
    ['image','图像生成','后续接入图像模型时，Agent 会优先调用这里。'],
    ['fallback','失败回退','普通对话模型失败时可回退到这里。'],
  ];
  const optionHtml=(selected)=>`<option value="">未设置</option>`+enabled.map(m=>`<option value="${esc(m.id)}"${selected===m.id?' selected':''}>${esc(m.name)} · ${esc(m.provider||'custom')}</option>`).join('');
  const groups=lib.reduce((acc,m)=>{const k=m.provider||'custom';(acc[k]=acc[k]||[]).push(m);return acc},{});
  const row=m=>`<div class="model-lib-row">
    <label class="model-check" title="启用模型"><input type="checkbox" ${m.enabled!==false?'checked':''} onchange="toggleLibraryModel('${esc(m.id)}',this.checked)"><span></span></label>
    <div class="model-lib-main">
      <div class="model-lib-name">${esc(m.name)}</div>
      <div class="model-lib-meta">${esc(apiFormatLabel(m.apiFormat))} · ${esc(authTypeLabel(m.authType,m.authHeader))} · ${esc(m.base||'未填写 Base URL')}${m.benchmark?` · 首包 ${Number(m.benchmark.firstTokenMs||0)}ms · 总耗时 ${Number(m.benchmark.totalMs||0)}ms`:''}</div>
    </div>
    <div class="model-lib-tags">${(m.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div>
    <button class="btn btn-xs btn-secondary" onclick="editLibraryModel('${esc(m.id)}')">编辑</button>
    <button class="btn btn-xs btn-secondary" id="modelTestBtn_${domId(m.id)}" onclick="testLibraryModel('${esc(m.id)}')">测试</button>
    <button class="btn btn-xs btn-secondary" id="modelBenchBtn_${domId(m.id)}" onclick="benchmarkLibraryModel('${esc(m.id)}')">测速</button>
    <button class="btn btn-xs btn-ghost" style="color:var(--c-error)" onclick="deleteLibraryModel('${esc(m.id)}')">删除</button>
  </div>`;
  const groupHtml=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([provider,items])=>`
    <div class="model-provider-group">
      <div class="model-provider-head"><strong>${esc(provider)}</strong><span>${items.filter(m=>m.enabled!==false).length}/${items.length} 已启用</span></div>
      ${items.map(row).join('')}
    </div>`).join('');
  const currentCards=scenarioRows.map(([id,title])=>{
    const model=getModelById(scenarios[id]);
    return `<div><strong>${title}</strong><span>${model?`${esc(model.name)} · ${esc(model.provider||'custom')}`:'未设置'}</span></div>`;
  }).join('');
  return `<div class="models-view">
    <div class="page-header"><h2>模型配置</h2><button class="btn btn-sm btn-primary" onclick="addModelModal()">添加模型</button></div>
    <div class="models-content">
      <section class="model-panel" style="margin-bottom:16px">
        <h3>当前生效</h3>
        <p>这里展示真实后端配置，不再内置演示模型。没有配置时，对话会走 Hermes CLI 或提示你先添加模型。</p>
        <div class="model-effective-grid">${currentCards}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="applyFastestChatModel()" ${fastestChat?'':'disabled'}>使用最快普通模型</button>
          <span style="font-size:12px;color:var(--c-ink-muted)">${fastestChat?`测速最快：${esc(fastestChat.name)} · 首包 ${Number(fastestChat.benchmark?.firstTokenMs||0)}ms`:'需要先对模型库里的聊天模型测速'}</span>
        </div>
      </section>
      <div class="model-layout">
        <section class="model-panel">
          <h3>应用场景</h3>
          <p>一个模型可以复用到多个场景；对话页默认“自动”，除非手动指定某个模型。</p>
          ${scenarioRows.map(([id,title,desc])=>`<div class="scenario-row">
            <div><strong>${title}</strong><span>${desc}</span></div>
            <select onchange="setScenarioModel('${id}',this.value)">${optionHtml(scenarios[id])}</select>
          </div>`).join('')}
        </section>
        <section class="model-panel">
          <h3>获取模型</h3>
          <p>填写 Provider、Base URL 和 Key 后，从远端拉取模型列表。New API / One API / 中转站通常选择 OpenAI 兼容。</p>
          <div class="model-connector-grid">
            <input id="mProvider" placeholder="Provider，如 New API / deepseek / openrouter" value="${esc(state.model.provider||'')}" oninput="applyProviderPreset('m')">
            <select id="mApiFormat" onchange="applyApiFormatPreset('m')">
              <option value="openai-chat">OpenAI 兼容 / Chat Completions</option>
              <option value="openai-image">OpenAI 图片接口 / Images</option>
              <option value="ollama">Ollama / 本地</option>
              <option value="anthropic_messages">Anthropic / Messages</option>
              <option value="gemini">Gemini（预留）</option>
            </select>
            <input id="mBase" placeholder="Base URL，如 http://host:3000 或 https://api.xxx.com/v1" value="${esc(state.model.base||'')}">
            <select id="mAuthType" onchange="toggleCustomAuthHeader('m')">
              <option value="bearer">Bearer Token</option>
              <option value="x-api-key">x-api-key</option>
              <option value="api-key">api-key</option>
              <option value="custom">自定义 Header</option>
              <option value="none">无需认证</option>
            </select>
            <input id="mAuthHeader" placeholder="自定义认证 Header" style="display:none">
            <input id="mKey" type="password" placeholder="API Key / Token" value="${esc(state.model.key||'')}">
            <div id="mFormatHint" class="model-format-hint"></div>
            <button class="btn btn-secondary" id="fetchModelsBtn" onclick="fetchModelsForLibrary()">获取模型</button>
          </div>
          <div id="modelMsg" class="model-msg"></div>
          <div id="fetchModelsList" class="model-fetch-list" style="display:none">
            <div class="model-fetch-actions"><button class="btn btn-xs btn-secondary" onclick="selectAllFetchModels()">全选</button><button class="btn btn-xs btn-secondary" onclick="deselectAllFetchModels()">取消全选</button><button class="btn btn-xs btn-primary" onclick="addSelectedFetchedModels()">加入模型库</button></div>
            <div id="fetchModelsItems"></div>
          </div>
        </section>
      </div>
      <section class="model-panel">
        <h3>模型库</h3>
        <p>模型库按 Provider 分组，是对话、角色和分身共用的真实配置。</p>
        <div class="model-lib-list">${lib.length?groupHtml:'<div class="model-empty-state"><strong>还没有模型</strong><span>添加或获取真实 Provider 后，这里才会出现可用模型。WebUI 不再预置假数据。</span><button class="btn btn-sm btn-primary" onclick="addModelModal()">添加第一个模型</button></div>'}</div>
      </section>
    </div>
  </div>`;
}

renderModels=renderModelsV3;

async function setScenarioModel(scene,id){
  const cfg=state.modelsConfig||{library:[],scenarios:{}};
  cfg.scenarios={...(cfg.scenarios||{}),[scene]:id};
  if(scene==='chat') cfg.current=id || cfg.current || '';
  await persistModelsConfig(cfg);
  if(scene==='chat'){
    state.chatModelOverride='auto';
    const item=getModelById(id);
    if(item) state.model={...state.model,provider:item.provider||'',model:item.name||'',base:item.base||'',key:item.key||''};
    save();
  }
  toast('场景模型已更新','success');
  renderPage();
}
function toggleLibraryModel(id,on){
  const cfg=state.modelsConfig||{library:[],scenarios:{}};
  const item=(cfg.library||[]).find(m=>m.id===id);
  if(item){item.enabled=on;persistModelsConfig(cfg).then(()=>renderPage())}
}
async function fetchModelsForLibrary(){
  const values=modelFormValues('m');
  const msg=$('#modelMsg');
  const btn=$('#fetchModelsBtn');
  if(!values.base){toast('请填写 Base URL','error');return}
  if(msg) msg.textContent='正在获取模型...';
  if(btn){btn.disabled=true;btn.textContent='获取中...'}
  try{
    const r=await fetch(apiBase()+'/api/models/fetch-remote',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify(values)});
    const j=await r.json().catch(()=>({}));
    const data=j.code===0?j.data:null;
    if(!data||!data.models?.length){
      if(msg) msg.textContent=(j.msg||'未找到模型，请检查 Base URL、API 格式和认证方式。');
      return;
    }
    const provider=values.provider||'custom';
    state._fetchedModels={...values,provider,models:data.models.map(m=>typeof m==='string'?m:(m.id||m.name||''))};
    const box=$('#fetchModelsList'), items=$('#fetchModelsItems');
    if(box) box.style.display='block';
    if(items) items.innerHTML=state._fetchedModels.models.filter(Boolean).map(name=>`<label class="model-fetch-item"><input type="checkbox" class="fetch-model-cb" value="${esc(name)}" checked><span>${esc(name)}</span></label>`).join('');
    if(msg) msg.textContent='找到 '+data.models.length+' 个模型，勾选后加入模型库。';
    state.model={...state.model,provider,base:values.base,key:values.key};
    save();
  }catch(e){
    if(msg) msg.textContent='获取失败: '+e.message;
  }finally{
    if(btn){btn.disabled=false;btn.textContent='获取模型'}
  }
}
async function addSelectedFetchedModels(){
  const selected=[...document.querySelectorAll('.fetch-model-cb:checked')].map(c=>c.value);
  const f=state._fetchedModels;
  if(!f||!selected.length){toast('请先选择模型','info');return}
  const cfg=state.modelsConfig||{library:[],scenarios:{}};
  const existing=new Map((cfg.library||[]).map(m=>[m.id,m]));
  selected.forEach(name=>{
    existing.set(`${f.provider}:${name}`,{
      id:`${f.provider}:${name}`,
      provider:f.provider,
      name,
      base:f.base,
      key:f.key,
      enabled:true,
      tags:inferModelTags(name),
      kind:'chat',
      apiFormat:f.apiFormat,
      authType:f.authType,
      authHeader:f.authHeader,
    });
  });
  cfg.library=[...existing.values()];
  cfg.current=cfg.current||`${f.provider}:${selected[0]}`;
  cfg.scenarios={...(cfg.scenarios||{})};
  if(!cfg.scenarios.chat) cfg.scenarios.chat=`${f.provider}:${selected[0]}`;
  const reasoning=selected.find(n=>inferModelTags(n).includes('reasoning'));
  if(reasoning&&!cfg.scenarios.reasoning) cfg.scenarios.reasoning=`${f.provider}:${reasoning}`;
  await persistModelsConfig(cfg);
  toast('已加入 '+selected.length+' 个模型','success');
  renderPage();
}
function addModelModal(){openModelEditor()}
function openModelEditor(model){
  const isEdit=!!model;
  const tags=new Set(model?.tags||[]);
  openModal(`<div class="model-editor-modal">
    <h3>${isEdit?'编辑模型':'添加模型'}</h3>
    <div class="model-editor-grid">
      <label>Provider<input id="addModelProvider" placeholder="例如 New API / deepseek / openrouter" value="${esc(model?.provider||'')}" oninput="applyProviderPreset('addModel')"></label>
      <label>模型名称<input id="addModelName" placeholder="例如 claude-sonnet-4.6-thinking" value="${esc(model?.name||'')}"></label>
      <label>API 格式<select id="addModelApiFormat" onchange="applyApiFormatPreset('addModel')">
        ${['openai-chat','openai-image','ollama','anthropic_messages','gemini'].map(v=>`<option value="${v}"${(model?.apiFormat||'openai-chat')===v?' selected':''}>${apiFormatLabel(v)}</option>`).join('')}
      </select></label>
      <label>认证方式<select id="addModelAuthType" onchange="toggleCustomAuthHeader('addModel')">
        ${['bearer','x-api-key','api-key','custom','none'].map(v=>`<option value="${v}"${(model?.authType||'bearer')===v?' selected':''}>${authTypeLabel(v)}</option>`).join('')}
      </select></label>
      <label class="wide">Base URL<input id="addModelBase" placeholder="网关根地址或 /v1 地址" value="${esc(model?.base||'')}"></label>
      <input id="addModelAuthHeader" class="wide" placeholder="自定义认证 Header" style="${(model?.authType||'bearer')==='custom'?'':'display:none'}" value="${esc(model?.authHeader||'')}">
      <label class="wide">API Key<input id="addModelKey" type="password" placeholder="API Key / Token" value="${esc(model?.key||'')}"></label>
      <div class="wide model-tag-editor">
        <span>用途标签</span>
        ${['chat','reasoning','vision','image'].map(t=>`<label><input type="checkbox" class="addModelTag" value="${t}" ${tags.has(t)?'checked':''}>${t}</label>`).join('')}
      </div>
      <div id="addModelFormatHint" class="wide model-format-hint"></div>
    </div>
    <div class="model-editor-actions">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-secondary" onclick="doSaveModel('${esc(model?.id||'')}',true)">保存并测试</button>
      <button class="btn btn-primary" onclick="doSaveModel('${esc(model?.id||'')}')">${isEdit?'保存':'添加'}</button>
    </div>
  </div>`);
  setTimeout(()=>updateModelFormatHint('addModel'),0);
}
function editLibraryModel(id){
  const model=getModelById(id);
  if(!model){toast('模型不存在','error');return}
  openModelEditor(model);
}
async function doSaveModel(existingId,shouldTest=false){
  const values=modelFormValues('addModel');
  const provider=values.provider||'custom';
  const name=$('#addModelName')?.value?.trim();
  if(!name){toast('请填写模型名称','error');return}
  const old=getModelById(existingId)||{};
  const tags=[...document.querySelectorAll('.addModelTag:checked')].map(c=>c.value);
  const id=existingId||`${provider}:${name}`;
  const item={...old,id,provider,name,base:values.base,key:values.key,enabled:old.enabled!==false,tags:tags.length?tags:inferModelTags(name),kind:'chat',apiFormat:values.apiFormat,authType:values.authType,authHeader:values.authHeader};
  const data=await apiPost('/api/models/library',item);
  if(data){
    state.modelsConfig=data;
    state.model={...state.model,provider,model:name,base:values.base,key:values.key};
    save();
    closeModal();
    renderPage();
    toast(existingId?'模型已保存':'模型已添加','success');
    if(shouldTest) setTimeout(()=>testLibraryModel(id),80);
  }
}
async function deleteLibraryModel(id){
  const m=getModelById(id);
  const okConfirm=await askConfirm(`确认删除模型「${m?.name||id}」？\n如果它正在某个应用场景中使用，会自动清空对应场景。`);
  if(!okConfirm) return;
  const data=await fetch(apiBase()+'/api/models/library/'+encodeURIComponent(id),{method:'DELETE',cache:'no-store',headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()).catch(()=>null);
  if(data&&data.code===0){state.modelsConfig=data.data;renderPage();toast('模型已删除','info')}
  else toast('删除失败','error');
}
function buildModelTestModal(model,result){
  const ok=!!result.ok;
  const hints=Array.isArray(result.hints)?result.hints:[];
  const canQuickFix=(result.apiFormat==='ollama'||model.apiFormat==='ollama') && !/127\.0\.0\.1:11434|localhost:11434|ollama/i.test(`${model.base} ${model.provider}`);
  const canAnthropicFix=(model.apiFormat||result.apiFormat)==='openai-chat' && /claude|kiro|anthropic/i.test(`${model.name} ${model.provider}`);
  return `<div class="model-test-modal">
    <div class="model-test-head ${ok?'ok':'fail'}">
      <span>${ok?'连接成功':'连接失败'}</span>
      <strong>${esc(model.name)}</strong>
    </div>
    <div class="model-test-grid">
      <div><span>测试地址</span><code>${esc(result.testedUrl||'未生成')}</code></div>
      <div><span>API 格式</span><code>${esc(apiFormatLabel(result.apiFormat||model.apiFormat))}</code></div>
      <div><span>认证方式</span><code>${esc(result.authHeader||authTypeLabel(model.authType,model.authHeader))}</code></div>
      <div><span>状态</span><code>${esc(result.status?`${result.status} ${result.statusText||''}`:(ok?'OK':'未连接'))}</code></div>
    </div>
    ${result.error?`<div class="model-test-error">${esc(result.error)}</div>`:''}
    ${result.bodySnippet?`<pre class="model-test-snippet">${esc(result.bodySnippet)}</pre>`:''}
    ${hints.length?`<div class="model-test-hints"><strong>建议排查</strong>${hints.map(h=>`<p>${esc(h)}</p>`).join('')}</div>`:''}
    <div class="model-editor-actions">
      ${canQuickFix?`<button class="btn btn-secondary" onclick="quickFixOpenAICompat('${esc(model.id)}')">改为 OpenAI 兼容 + Bearer 后重试</button>`:''}
      ${canAnthropicFix?`<button class="btn btn-secondary" onclick="quickFixAnthropicMessages('${esc(model.id)}')">改为 Anthropic Messages 后重试</button>`:''}
      <button class="btn btn-secondary" onclick="editLibraryModel('${esc(model.id)}')">编辑配置</button>
      <button class="btn btn-primary" onclick="closeModal()">知道了</button>
    </div>
  </div>`;
}
async function quickFixAnthropicMessages(id){
  const cfg=state.modelsConfig||{library:[],scenarios:{}};
  const m=(cfg.library||[]).find(x=>x.id===id);
  if(!m) return;
  m.apiFormat='anthropic_messages';
  m.authType='x-api-key';
  const data=await persistModelsConfig(cfg);
  if(data) state.modelsConfig=data;
  closeModal();
  renderPage();
  setTimeout(()=>testLibraryModel(id),80);
}
async function quickFixOpenAICompat(id){
  const cfg=state.modelsConfig||{library:[],scenarios:{}};
  const m=(cfg.library||[]).find(x=>x.id===id);
  if(!m) return;
  m.apiFormat='openai-chat';
  m.authType='bearer';
  const data=await persistModelsConfig(cfg);
  if(data) state.modelsConfig=data;
  closeModal();
  renderPage();
  setTimeout(()=>testLibraryModel(id),80);
}
async function testLibraryModel(id){
  const m=getModelById(id);
  if(!m){toast('模型不存在','error');return}
  const btn=$(`#modelTestBtn_${domId(id)}`);
  if(btn){btn.disabled=true;btn.textContent='测试中...'}
  try{
    const r=await fetch(apiBase()+'/api/models/test',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify({provider:{provider:m.provider,base:m.base,model:m.name,key:m.key,apiFormat:m.apiFormat,authType:m.authType,authHeader:m.authHeader}})});
    const j=await r.json().catch(()=>({}));
    openModal(buildModelTestModal(m,j));
    toast(j.ok?'连接成功':'连接失败',j.ok?'success':'error');
  }catch(e){
    openModal(buildModelTestModal(m,{ok:false,error:e.message,hints:['后端测试接口不可达，请确认 WebUI 后端服务已启动。']}));
  }finally{
    if(btn){btn.disabled=false;btn.textContent='测试'}
  }
}

function renderUsage(){
  if(!_usageFetchStarted){
    _usageFetchStarted=true;
    const qs=new URLSearchParams({range:usageRange});
    if(usageRange==='custom'){
      if(usageCustomStart) qs.set('start',usageCustomStart);
      if(usageCustomEnd) qs.set('end',usageCustomEnd);
    }
    apiGet('/api/usage?'+qs.toString()).then(data=>{
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
function fmtTokens(n){
  n=Number(n)||0;
  if(n>=1000000) return (n/1000000).toFixed(1)+'M';
  if(n>=1000) return (n/1000).toFixed(1)+'K';
  return String(n);
}
function localDateInput(date){
  const d=date instanceof Date?date:new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function setUsageRange(range){
  usageRange=range||'30d';
  if(usageRange==='custom' && (!usageCustomStart || !usageCustomEnd)){
    const end=new Date();
    const start=new Date(Date.now()-6*86400000);
    usageCustomEnd=localDateInput(end);
    usageCustomStart=localDateInput(start);
    LS.set('hermes.usageCustomStart',usageCustomStart);
    LS.set('hermes.usageCustomEnd',usageCustomEnd);
  }
  LS.set('hermes.usageRange',usageRange);
  _usageFetchStarted=false;
  _usageCache=null;
  renderPage();
}
function applyUsageCustom(){
  usageCustomStart=$('#usageStart')?.value||'';
  usageCustomEnd=$('#usageEnd')?.value||'';
  LS.set('hermes.usageCustomStart',usageCustomStart);
  LS.set('hermes.usageCustomEnd',usageCustomEnd);
  usageRange='custom';
  LS.set('hermes.usageRange',usageRange);
  _usageFetchStarted=false;
  _usageCache=null;
  renderPage();
}
function collectGroupUsage(){
  const rooms=state.groupChat?.rooms||[];
  let totalMessages=0,totalTokens=0;
  const roomRows=rooms.map(room=>{
    const messages=state.groupChat.messages?.[room.id]||[];
    const tokens=messages.reduce((sum,m)=>sum+Math.ceil(String(m.content||'').length/3),0);
    totalMessages+=messages.length;
    totalTokens+=tokens;
    return {name:room.name||'未命名房间',messages:messages.length,tokens,agents:(state.groupChat.agents?.[room.id]||[]).length};
  }).sort((a,b)=>b.tokens-a.tokens);
  return {totalMessages,totalTokens,rooms:roomRows};
}
function buildUsageHtml(data){
  data=data||{};
  const totalTokens=data.totalTokens||0;
  const todayTokens=data.todayTokens||0;
  const totalMessages=data.totalMessages||0;
  const todayMessages=data.todayMessages||0;
  const totalSessions=data.totalSessions||0;
  const models=data.models||{};
  const sources=data.sources||{};
  const daily=data.daily||[];
  const groupUsage=collectGroupUsage();
  const modelEntries=Object.entries(models).sort((a,b)=>(b[1].tokens||0)-(a[1].tokens||0));
  const sourceEntries=Object.entries(sources).sort((a,b)=>(b[1].tokens||0)-(a[1].tokens||0));
  const totalTokensStr=fmtTokens(totalTokens);
  const estCost=(totalTokens*0.000003).toFixed(2);
  const activeSkills=state.skills.filter(s=>s.on||s.enabled).length;
  const rangeTabs=[['today','1天'],['7d','7天'],['30d','30天'],['custom','自定义']];
  const maxDaily=Math.max(...daily.map(d=>d.tokens||0),1);
  const dailyHtml=daily.length?`<div class="chart-container">
    <div class="chart-title">Token 趋势 · ${esc(data.range||usageRange)}</div>
    <div class="bar-chart usage-bars">
      ${daily.map(d=>`<div class="bar" style="height:${Math.max(4,Math.round((d.tokens||0)/maxDaily*100))}%" title="${esc(d.date)} · ${fmtTokens(d.tokens)} tokens · ${d.messages||0} 条"><span class="bar-label">${esc(d.label||'')}</span><span class="bar-tip">${fmtTokens(d.tokens)}</span></div>`).join('')}
    </div>
  </div>`:'';
  let modelBreakdownHtml='';
  if(modelEntries.length>0){
    const maxTokens=Math.max(...modelEntries.map(([,m])=>m.tokens||0),1);
    const colors=['var(--c-block-lime)','var(--c-block-lilac)','var(--c-block-cream)','var(--c-block-mint)','#e57373','#64b5f6'];
    modelBreakdownHtml=`<div class="chart-container"><div class="chart-title">模型用量分布</div><div class="breakdown-list">
      ${modelEntries.map(([name,m],i)=>{
        const pct=maxTokens>0?Math.round((m.tokens/maxTokens)*100):0;
        return `<div class="breakdown-item"><span class="breakdown-name">${esc(name)}</span><div class="breakdown-bar-wrap"><div class="breakdown-bar-fill" style="width:${pct}%;background:${colors[i%colors.length]}"></div></div><span class="breakdown-value">${fmtTokens(m.tokens)} / ${m.messages||0}条</span></div>`;
      }).join('')}
    </div></div>`;
  }
  const sourceHtml=sourceEntries.length?`<div class="chart-container"><div class="chart-title">来源用量</div><div class="usage-mini-grid">
    ${sourceEntries.map(([name,s])=>`<div class="usage-mini-card"><strong>${esc(name)}</strong><span>${fmtTokens(s.tokens)} tokens</span><small>${s.messages||0} 条消息 · ${s.sessions||0} 个会话</small></div>`).join('')}
  </div></div>`:'';
  const groupHtml=`<div class="chart-container">
    <div class="chart-title">分身用量（本地估算）</div>
    ${groupUsage.rooms.length?`<div class="breakdown-list">${groupUsage.rooms.map(r=>{
      const pct=Math.round((r.tokens||0)/Math.max(groupUsage.totalTokens,1)*100);
      return `<div class="breakdown-item"><span class="breakdown-name">${esc(r.name)}</span><div class="breakdown-bar-wrap"><div class="breakdown-bar-fill" style="width:${Math.max(4,pct)}%;background:var(--c-accent)"></div></div><span class="breakdown-value">${fmtTokens(r.tokens)} / ${r.messages}条</span></div>`;
    }).join('')}</div>`:'<div class="empty-state" style="height:120px"><span>暂无分身房间用量</span></div>'}
  </div>`;
  return `<div class="usage-toolbar">
    <div class="usage-range-tabs">${rangeTabs.map(([id,label])=>`<button class="${usageRange===id?'active':''}" onclick="setUsageRange('${id}')">${label}</button>`).join('')}</div>
    <button class="btn btn-xs btn-secondary" onclick="_usageFetchStarted=false;_usageCache=null;renderPage()">刷新</button>
  </div>
  <div class="usage-custom-row">
    <span>自定义范围</span>
    <input id="usageStart" type="date" value="${esc(usageCustomStart)}">
    <span>至</span>
    <input id="usageEnd" type="date" value="${esc(usageCustomEnd)}">
    <button class="btn btn-xs btn-primary" onclick="applyUsageCustom()">应用</button>
  </div>
  <div class="stat-cards">
    <div class="stat-card color-block color-block-lime"><div class="stat-value">${data.rangeMessages??todayMessages}</div><div class="stat-label">当前范围消息</div></div>
    <div class="stat-card color-block color-block-lilac"><div class="stat-value">${fmtTokens(data.rangeTokens??todayTokens)}</div><div class="stat-label">当前范围 Token</div></div>
    <div class="stat-card color-block color-block-cream"><div class="stat-value">$${estCost}</div><div class="stat-label">总预估费用</div></div>
    <div class="stat-card color-block color-block-mint"><div class="stat-value">${activeSkills}</div><div class="stat-label">活跃技能</div></div>
  </div>
  <div class="chart-container">
    <div class="chart-title">总览</div>
    <div style="display:flex;gap:24px;padding:16px 0">
      <div><span style="font-size:24px;font-weight:600">${todayMessages}</span><div style="font-size:12px;color:var(--c-ink-muted)">今日消息</div></div>
      <div><span style="font-size:24px;font-weight:600">${fmtTokens(todayTokens)}</span><div style="font-size:12px;color:var(--c-ink-muted)">今日 Token</div></div>
      <div><span style="font-size:24px;font-weight:600">${totalSessions}</span><div style="font-size:12px;color:var(--c-ink-muted)">总会话数</div></div>
      <div><span style="font-size:24px;font-weight:600">${totalMessages}</span><div style="font-size:12px;color:var(--c-ink-muted)">总消息数</div></div>
    </div>
  </div>
  ${dailyHtml}
  ${modelBreakdownHtml}
  ${sourceHtml}
  ${groupHtml}
  <div class="usage-note">说明：当前 Token 和费用为本地估算，后续如果模型 API 返回真实 usage，可在后端写入 usage 日志后替换为精确统计。</div>`;
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
    ${platforms.map(p=>`<div class="platform-card" style="cursor:pointer" onclick="editChannel('${esc(p.id)}')">
      <div class="platform-header"><span class="platform-icon">${p.id==='feishu'?'FS':(icons[p.id]||'??')}</span><div><div class="platform-name">${esc(p.name)}</div><span class="platform-status ${(p.streamConnected||p.connected)?'connected':'disconnected'}">${p.streamConnected?'\u957f\u8fde\u63a5\u5df2\u8fde\u63a5':(p.connected?'\u5df2\u8fde\u63a5':(p.configured?'\u672a\u8fde\u901a':'\u672a\u914d\u7f6e'))}</span></div></div>
      <div style="font-size:13px;color:var(--c-ink-muted)">${esc(p.desc||'')}</div>
    </div>`).join('')}
  </div>`;
}

async function editChannel(id){
  if(!_channelsCache || !_channelsCache.platforms?.length){
    _channelsCache=await apiGet('/api/gateway')||{enabled:true,platforms:[]};
  }
  _gatewaysCache=_channelsCache;
  editGateway(id);
}

function renderSettings(){
  const promptToggles={webuiRules:true,coreMemory:true,agentRules:true,userSystemPrompt:true,profilePrompt:true,skills:true,knowledgeSearch:true,...(state.settings.promptToggles||{})};
  const enabledModels=getEnabledModels();
  const missingModel=!enabledModels.length;
  const missingDataRoot=!String(state.settings.dataRootDir||state.settings.memoryDir||state.settings.imageDir||state.settings.mdLibraryDir||'').trim();
  const onboardingHtml=(missingModel||missingDataRoot)?`<div class="settings-section" style="border-color:var(--c-accent-muted);background:var(--c-accent-soft)">
    <div class="settings-section-title">首次配置引导</div>
    ${missingModel?`<div class="settings-item"><div><div class="settings-label">还没有可用模型</div><div class="settings-desc">请先到「模型配置」添加 Provider、Base URL、API Key 和模型名。</div></div><button class="btn btn-secondary" onclick="state.page='models';renderPage()">去配置模型</button></div>`:''}
    ${missingDataRoot?'<div class="settings-item"><div><div class="settings-label">建议配置外部数据目录</div><div class="settings-desc">把记忆、图片、历史和输出文档放到项目外，更新 WebUI 时更安全。</div></div><span style="font-size:12px;color:var(--c-ink-muted)">例如 F:\\\\AI\\\\Hermes Agent\\\\记忆</span></div>':''}
  </div>`:'';
  return `<div class="settings-view">
    <div class="page-header"><h2>设置</h2></div>
    <div class="settings-content">
      ${onboardingHtml}
      <div class="settings-section">
        <div class="settings-section-title">通用</div>
        <div class="settings-item"><div><div class="settings-label">语言</div><div class="settings-desc">界面显示语言</div></div>
          <select id="sLang" style="width:120px"><option value="zh"${state.settings.lang==='zh'?' selected':''}>中文</option><option value="en"${state.settings.lang==='en'?' selected':''}>English</option></select>
        </div>
        <div class="settings-item"><div><div class="settings-label">流式输出</div><div class="settings-desc">实时显示 AI 回复</div></div>
          <label class="toggle"><input type="checkbox" id="sStream" ${state.settings.stream?'checked':''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item"><div><div class="settings-label">性能调试</div><div class="settings-desc">在浏览器控制台输出 WebUI / Hermes 流式时序</div></div>
          <label class="toggle"><input type="checkbox" id="sDebugPerf" ${state.settings.debugPerf?'checked':''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item"><div><div class="settings-label">快速模式</div><div class="settings-desc">跳过 Hermes Agent，直接调用大模型 API（更快但不支持工具调用）</div></div>
          <label class="toggle"><input type="checkbox" id="sQuick" ${state.settings.quickMode?'checked':''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item"><div><div class="settings-label">回复速度优化</div><div class="settings-desc">普通 Agent 模式会保留工具链；想要更快首 token，可开启快速模式并把历史记录保留控制在 12-20 轮。</div></div>
          <span style="font-size:12px;color:var(--c-ink-muted)">当前历史：${esc(state.settings.history||20)} 轮</span>
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
        <div class="settings-section-title">Agent 路由策略</div>
        <div class="settings-item"><div><div class="settings-label">路由模式</div><div class="settings-desc">自动：普通聊天直连模型，复杂文件/命令/代码任务走 Hermes Agent。</div></div>
          <select id="sRoutingMode" style="width:180px">
            <option value="auto" ${(state.settings.routingMode||'auto')==='auto'?'selected':''}>自动</option>
            <option value="direct" ${(state.settings.routingMode||'auto')==='direct'?'selected':''}>始终直连</option>
            <option value="hermes" ${(state.settings.routingMode||'auto')==='hermes'?'selected':''}>始终 Hermes Agent</option>
          </select>
        </div>
        <div class="settings-item"><div><div class="settings-label">Hermes API Server 地址</div><div class="settings-desc">预留给官方 Hermes API Server；留空继续使用当前 CLI/直连策略。</div></div>
          <input id="sHermesApiServerUrl" value="${esc(state.settings.hermesApiServerUrl||'')}" placeholder="例如 http://127.0.0.1:8000" style="width:320px">
        </div>
        <div class="settings-item"><div><div class="settings-label">Hermes API Key</div><div class="settings-desc">如 API Server 启用鉴权，在这里填写；本地空值即可。</div></div>
          <input id="sHermesApiServerKey" type="password" value="${esc(state.settings.hermesApiServerKey||'')}" placeholder="可选" style="width:320px">
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">模型策略状态</div>
        <div class="settings-item"><div><div class="settings-label">普通对话模型</div><div class="settings-desc">用于默认聊天和 Agent 自动模式。</div></div><span style="font-size:12px;color:var(--c-ink-muted)">${esc(scenarioModel('chat')||'未配置')}</span></div>
        <div class="settings-item"><div><div class="settings-label">深度推理模型</div><div class="settings-desc">用于分身、代码、研究等推理场景。</div></div><span style="font-size:12px;color:var(--c-ink-muted)">${esc(scenarioModel('reasoning')||'未配置')}</span></div>
        <div class="settings-item"><div><div class="settings-label">图像模型</div><div class="settings-desc">用于图片生成和图生图。</div></div><span style="font-size:12px;color:var(--c-ink-muted)">${esc(scenarioModel('image')||'未配置')}</span></div>
        <div class="settings-item"><div><div class="settings-label">模型健康建议</div><div class="settings-desc">普通对话建议选择响应快的模型；深度推理选择强推理模型；图像模型需配置 OpenAI 图片接口格式。</div></div><button class="btn btn-secondary" onclick="state.page='models';renderPage()">打开模型配置</button></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">本地数据目录</div>
        <div class="settings-item"><div><div class="settings-label">数据根目录</div><div class="settings-desc">记忆、图片、历史和输出文档的默认根目录；留空使用 backend/data/workspace。</div></div>
          <input id="sDataRootDir" value="${esc(state.settings.dataRootDir||'')}" placeholder="例如 F:\\AI\\Hermes Agent\\记忆" style="width:420px">
        </div>
        <div class="settings-item"><div><div class="settings-label">记忆目录</div><div class="settings-desc">核心记忆和 Agent 规则目录；留空使用 数据根目录\\memory。</div></div>
          <input id="sMemoryDir" value="${esc(state.settings.memoryDir||'')}" placeholder="留空自动匹配数据根目录\\memory" style="width:420px">
        </div>
        <div class="settings-item"><div><div class="settings-label">图片目录</div><div class="settings-desc">上传参考图和生成图片统一保存到这里；留空使用 数据根目录\\images。</div></div>
          <input id="sImageDir" value="${esc(state.settings.imageDir||'')}" placeholder="留空自动匹配数据根目录\\images" style="width:420px">
        </div>
        <div class="settings-item"><div><div class="settings-label">历史归档目录</div><div class="settings-desc">对话自动导出的 Markdown 历史；留空使用 数据根目录\\history-md。</div></div>
          <input id="sHistoryDir" value="${esc(state.settings.historyDir||'')}" placeholder="留空自动匹配数据根目录\\history-md" style="width:420px">
        </div>
        <div class="settings-item"><div><div class="settings-label">MD 输出库目录</div><div class="settings-desc">右侧“历史文件”读取 Agent 输出文章/报告等 Markdown 的独立文件夹；留空使用 backend/data/output-md。</div></div>
          <input id="sMdLibraryDir" value="${esc(state.settings.mdLibraryDir||'')}" placeholder="留空自动匹配数据根目录\\output-md" style="width:420px">
        </div>
        <div class="settings-item"><div><div class="settings-label">迁移检查</div><div class="settings-desc">如果旧 backend/data 和外部目录同时存在，建议确认后再手动合并数据，避免覆盖。</div></div>
          <button class="btn btn-secondary" onclick="openPathFromSetting('data')">打开当前数据目录</button>
        </div>
        <div class="settings-item" style="align-items:flex-start"><div><div class="settings-label">一键备份导出</div><div class="settings-desc">导出设置、模型配置、Skill、聊天索引和数据目录清单；API Key 会自动脱敏。</div><div id="backupExportResult" style="font-size:12px;color:var(--c-ink-muted);margin-top:6px"></div></div>
          <button class="btn btn-secondary" onclick="exportWebuiBackup()">生成备份</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Prompt 注入治理</div>
        ${[
          ['webuiRules','WebUI 自保护规则','图像任务、自保护和 WebUI 对话边界，建议保持开启。'],
          ['coreMemory','核心记忆','注入长期核心记忆。'],
          ['agentRules','Agent 规则','注入常驻短规则和按需知识库规则。'],
          ['userSystemPrompt','全局系统提示词','注入下方自定义系统提示词。'],
          ['profilePrompt','Agent Profile','注入当前 Agent 的角色提示词。'],
          ['skills','技能 Prompt','注入当前 Agent 绑定或启用的技能。'],
          ['knowledgeSearch','轻量知识库检索','从 MD 输出库按当前问题检索少量相关片段。'],
        ].map(([id,label,desc])=>`<div class="settings-item"><div><div class="settings-label">${label}</div><div class="settings-desc">${desc}</div></div><label class="toggle"><input type="checkbox" id="pt_${id}" ${promptToggles[id]?'checked':''}><span class="toggle-slider"></span></label></div>`).join('')}
        <div class="settings-item"><div><div class="settings-label">知识库检索条数</div><div class="settings-desc">每次最多注入的 Markdown 片段数量，0 表示不注入。</div></div>
          <input id="sKnowledgeSearchLimit" type="number" min="0" max="8" value="${esc(state.settings.knowledgeSearchLimit??3)}" style="width:80px">
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">工具权限与安全</div>
        <div class="settings-item"><div><div class="settings-label">命令执行策略</div><div class="settings-desc">安全模式会阻止危险命令并记录审批日志；严格模式会拦截高风险命令。</div></div>
          <select id="sCommandPolicy" style="width:160px">
            <option value="safe" ${(state.settings.toolPermissions?.commandPolicy||'safe')==='safe'?'selected':''}>安全模式</option>
            <option value="strict" ${(state.settings.toolPermissions?.commandPolicy||'safe')==='strict'?'selected':''}>严格模式</option>
            <option value="off" ${(state.settings.toolPermissions?.commandPolicy||'safe')==='off'?'selected':''}>关闭拦截</option>
          </select>
        </div>
        <div class="settings-item"><div><div class="settings-label">记录审批日志</div><div class="settings-desc">记录命令执行、阻止原因和风险等级，可在任务日志中查看。</div></div><label class="toggle"><input type="checkbox" id="sLogApprovals" ${state.settings.toolPermissions?.logApprovals!==false?'checked':''}><span class="toggle-slider"></span></label></div>
        <div class="settings-item"><div><div class="settings-label">高风险命令弹窗确认</div><div class="settings-desc">例如 git push、git reset --hard、npm publish 等命令会先弹窗，确认后才执行。</div></div><label class="toggle"><input type="checkbox" id="sRequireRiskyApproval" ${state.settings.toolPermissions?.requireApprovalForRisky!==false?'checked':''}><span class="toggle-slider"></span></label></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">更新中心</div>
        <div id="updateStatusCard" class="settings-item" style="align-items:flex-start;gap:12px">
          <div style="flex:1;min-width:0">
            <div class="settings-label">正在检测...</div>
            <div class="settings-desc">只读取本地 Git 状态，不会自动更新代码。</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
            <button class="btn btn-secondary" onclick="loadUpdateStatus(false)">刷新状态</button>
            <button class="btn btn-secondary" onclick="loadUpdateStatus(true)">检查远端</button>
            <button class="btn btn-secondary" onclick="showUpdateGuide()">查看方法</button>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Hermes CLI 状态</div>
        <div id="cliStatusCard" class="settings-item" style="align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div class="settings-label">正在检测...</div>
            <div class="settings-desc">正在检查 Hermes CLI 是否可用，以及是否需要安装或配置 WSL 路径。</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-secondary" onclick="loadCliStatusCard()">刷新状态</button>
            <button class="btn btn-secondary" onclick="showCliInstallGuide()">安装指引</button>
          </div>
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
        <p style="font-size:12px;color:var(--c-ink-muted);margin-top:8px;line-height:1.6">文档工作台：输出工作文档、AI分享、教程、笔记等长内容时，建议使用 <code>&lt;artifact type="markdown" title="文件名" docType="work|share|tutorial|note"&gt;</code> 包裹完整 Markdown；正文顶部使用 YAML frontmatter，包含 <code>title / folder / type / tags / status / summary</code>。文件夹建议为：工作文档、AI分享、教程、笔记、临时收件箱。</p>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-primary" onclick="saveSettings()">保存设置</button>
        <button class="btn btn-secondary" onclick="pingApi()">测试连接</button>
      </div>
      <div id="settingsMsg" style="font-size:12px;color:var(--c-ink-muted);margin-top:8px"></div>
    </div>
  </div>`;
}

function openPathFromSetting(kind){
  const candidates={
    data: state.settings.dataRootDir || state.settings.mdLibraryDir || '',
    memory: state.settings.memoryDir || '',
    image: state.settings.imageDir || '',
    md: state.settings.mdLibraryDir || '',
  };
  const target=candidates[kind]||'';
  if(!target){toast('当前使用默认目录，请先保存设置或到文件页查看 Hermes 数据目录','info');return}
  apiPost('/api/system/open-path',{path:target}).then(ok=>toast(ok?'已请求打开目录':'打开目录失败',ok?'success':'error'));
}

async function exportWebuiBackup(){
  const el=$('#backupExportResult');
  if(el) el.textContent='正在生成备份...';
  const data=await apiPost('/api/system/backup/export',{});
  if(!data){
    if(el) el.textContent='备份失败，请确认后端已重启并查看日志。';
    toast('备份导出失败','error');
    return;
  }
  const size=formatBytes(data.size||0);
  if(el) el.innerHTML=`已生成：<code>${esc(data.fileName)}</code> · ${esc(size)} · <a href="${mediaUrl(data.downloadUrl)}" target="_blank" rel="noreferrer">下载</a>`;
  toast('备份已生成','success');
}

function showUpdateGuide(){
  openModal(`<div style="padding:24px;min-width:min(620px,92vw)">
    <h3 style="margin:0 0 12px">WebUI 更新方法</h3>
    <div style="line-height:1.8;color:var(--c-ink-muted)">
      <p>如果当前 WebUI 是从 GitHub 克隆的，推荐关闭正在运行的服务后双击项目根目录的 <code>update.bat</code>。</p>
      <p>它会执行 <code>git pull --ff-only</code> 和 <code>npm install</code>，完成后重新运行 <code>start.bat</code>。</p>
      <p>建议先把记忆、图片、历史和输出文档配置到外部数据目录，避免更新代码时影响个人数据。</p>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" onclick="closeModal()">知道了</button></div>
  </div>`);
}

function updateStatusCardHtml(status={}, {checking=false, error=''}={}){
  if(checking){
    return `<div style="flex:1;min-width:0"><div class="settings-label">正在检测更新状态...</div><div class="settings-desc">正在读取本地 Git 信息，请稍候。</div></div>`;
  }
  if(error){
    return `<div style="flex:1;min-width:0"><div class="settings-label">更新状态检测失败</div><div class="settings-desc">${esc(error)}</div></div>`;
  }
  if(!status.isGitRepo){
    return `<div style="flex:1;min-width:0"><div class="settings-label">当前不是 Git 克隆项目</div><div class="settings-desc">${esc(status.message||'无法通过 GitHub 自动检测更新。')}</div><div style="margin-top:8px;font-size:12px;color:var(--c-ink-muted)">版本：${esc(status.packageVersion||'unknown')} · 目录：${esc(status.projectRoot||'')}</div></div>`;
  }
  const behind=Number(status.behind||0);
  const ahead=Number(status.ahead||0);
  const dirty=Number(status.dirtyCount||0);
  const stateText=behind>0?'发现远端更新':dirty>0?'存在本地未提交改动':ahead>0?'本地领先远端':'当前代码已是最新状态';
  const stateClass=behind>0?'disconnected':'connected';
  const advice=behind>0
    ? (status.safeToPull?'可以关闭 WebUI 后执行 update.bat 或 git pull --ff-only。':'建议先处理本地改动，再执行 git pull --ff-only。')
    : '如果要主动确认 GitHub 最新版本，可点击“检查远端”。';
  return `<div style="flex:1;min-width:0">
    <div class="settings-label">GitHub 更新 · <span class="platform-status ${stateClass}" style="display:inline-flex;align-items:center">${esc(stateText)}</span></div>
    <div class="settings-desc">${esc(advice)}</div>
    <div style="margin-top:8px;font-size:12px;color:var(--c-ink-muted);line-height:1.7">
      版本：${esc(status.packageVersion||'unknown')} · 分支：${esc(status.branch||'unknown')} · 提交：${esc(status.localCommit||'')}${status.currentTag?` · 当前标签：${esc(status.currentTag)}`:''}${status.latestTag?` · 最新标签：${esc(status.latestTag)}`:''}<br>
      远端：${esc(status.upstream||'未设置 upstream')} · 落后 ${behind} / 领先 ${ahead} · 本地改动 ${dirty} 个${status.fetched?' · 已检查远端':''}${status.fetchError?`<br>远端检查失败：${esc(status.fetchError)}`:''}
    </div>
  </div>`;
}

async function loadUpdateStatus(fetchRemote=false){
  const card=$('#updateStatusCard');
  if(!card) return;
  card.innerHTML=`${updateStatusCardHtml({}, {checking:true})}<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary" disabled>检测中</button><button class="btn btn-secondary" onclick="showUpdateGuide()">查看方法</button></div>`;
  try{
    const data=await apiGet('/api/system/update-status'+(fetchRemote?'?fetch=1':''));
    card.innerHTML=`${updateStatusCardHtml(data||{}, {error:data?'' : '接口没有返回有效数据'})}<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary" onclick="loadUpdateStatus(false)">刷新状态</button><button class="btn btn-secondary" onclick="loadUpdateStatus(true)">检查远端</button><button class="btn btn-secondary" onclick="showUpdateGuide()">查看方法</button></div>`;
  }catch(err){
    card.innerHTML=`${updateStatusCardHtml({}, {error:err.message||String(err)})}<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary" onclick="loadUpdateStatus(false)">重试</button><button class="btn btn-secondary" onclick="showUpdateGuide()">查看方法</button></div>`;
  }
}

function cliStatusCardHtml(cli={}, {checking=false, error=''}={}){
  const ok=!!cli.available;
  const stale=!!cli.stale;
  const statusClass=ok?'connected':'disconnected';
  const statusText=checking ? '检测中' : ok ? (stale?'上次可用':'可用') : '不可用';
  const detail=error
    ? error
    : ok
      ? `命令：${cli.command||'unknown'} · 版本：${cli.version||'unknown'}${stale?' · 当前为缓存状态，正在后台复查':''}`
      : ((cli.error||'未检测到 Hermes CLI') + '。普通聊天默认依赖 Hermes CLI；只有开启快速模式时才会直连模型 API。');
  return `
    <div style="flex:1;min-width:0">
      <div class="settings-label">Hermes CLI ${statusText}</div>
      <div class="settings-desc">${esc(detail)}</div>
      <div style="margin-top:8px;font-size:12px;color:var(--c-ink-muted)">状态：<span class="platform-status ${statusClass}" style="display:inline-flex;align-items:center">${statusText}</span> · 模式：${esc(cli.type||'unknown')}</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;align-items:flex-start">
      <button class="btn btn-secondary" onclick="loadCliStatusCard(true)">${checking?'检测中...':'刷新状态'}</button>
      <button class="btn btn-secondary" onclick="showCliInstallGuide()">安装指引</button>
    </div>`;
}

async function loadCliStatusCard(force=false){
  const box=$('#cliStatusCard');
  if(!box) return;
  const cached=state.cliStatusCache;
  if(cached && cached.available && !force){
    box.innerHTML=cliStatusCardHtml({...cached, stale:true}, {checking:true});
  }else{
    box.innerHTML=`<div style="flex:1"><div class="settings-label">正在检测...</div><div class="settings-desc">正在查询 Hermes CLI 与运行状态。</div></div>`;
  }
  try{
    const data=await apiGet('/api/agent');
    const cli=data?.hermesCli||{};
    if(cli.available){
      state.cliStatusCache={...cli, checkedAt:Date.now()};
      LS.set('hermes.cliStatusCache',state.cliStatusCache);
    }
    if(!cli.available && cached?.available){
      box.innerHTML=cliStatusCardHtml({...cached, stale:true}, {checking:false});
      return;
    }
    box.innerHTML=cliStatusCardHtml(cli);
  }catch(e){
    if(cached?.available){
      box.innerHTML=cliStatusCardHtml({...cached, stale:true}, {error:'后端状态暂时读取失败，保留上次可用状态。'});
      return;
    }
    box.innerHTML=cliStatusCardHtml({available:false,type:'unknown',error:e.message||'请检查后端是否正常运行。普通聊天默认依赖 Hermes CLI；只有开启快速模式时才会直连模型 API。'});
  }
}

function showCliInstallGuide(){
  openModal(`
    <div class="confirm-modal">
      <h3>Hermes CLI 安装指引</h3>
      <div style="display:grid;gap:10px;font-size:13px;line-height:1.65;color:var(--c-ink)">
        <div>1. 先确认终端能执行 <code>hermes --version</code>。</div>
        <div>2. 如果你在 Windows 上使用 WSL，先在 WSL 里安装 Hermes，再回到 WebUI 刷新状态。</div>
        <div>3. 不确定是否安装成功时，优先用“快速模式”直连可用的模型 API。</div>
        <div>4. 如果命令不可用，检查 <code>PATH</code> 是否包含 Hermes 安装目录。</div>
        <div style="padding:12px;border:1px solid var(--c-hairline);border-radius:12px;background:var(--c-surface1)">
          <strong>建议检查</strong>
          <div style="margin-top:6px;color:var(--c-ink-muted)">在终端依次运行：<code>where hermes</code>（Windows）或 <code>which hermes</code>（WSL/Linux）。</div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
      </div>
    </div>
  `);
}

function saveSettings(){
  const promptToggles={};
  ['webuiRules','coreMemory','agentRules','userSystemPrompt','profilePrompt','skills','knowledgeSearch'].forEach(id=>promptToggles[id]=$(`#pt_${id}`)?.checked!==false);
  state.settings={lang:$('#sLang').value,stream:$('#sStream').checked,debugPerf:$('#sDebugPerf').checked,quickMode:$('#sQuick').checked,routingMode:$('#sRoutingMode')?.value||'auto',hermesApiServerUrl:$('#sHermesApiServerUrl')?.value?.trim()||'',hermesApiServerKey:$('#sHermesApiServerKey')?.value?.trim()||'',toolPermissions:{commandPolicy:$('#sCommandPolicy')?.value||'safe',logApprovals:$('#sLogApprovals')?.checked!==false,requireApprovalForRisky:$('#sRequireRiskyApproval')?.checked!==false},history:parseInt($('#sHistory').value)||20,systemPrompt:$('#sSys').value,api:$('#sApi').value.trim(),style:$('#sStyle')?.value||'minimal',dataRootDir:$('#sDataRootDir')?.value?.trim()||'',memoryDir:$('#sMemoryDir')?.value?.trim()||'',imageDir:$('#sImageDir')?.value?.trim()||'',historyDir:$('#sHistoryDir')?.value?.trim()||'',mdLibraryDir:$('#sMdLibraryDir')?.value?.trim()||'',promptToggles,knowledgeSearchLimit:Math.max(0,Math.min(parseInt($('#sKnowledgeSearchLimit')?.value)||0,8))};
  save();
  apiPut('/api/settings', {
    lang: state.settings.lang,
    stream: state.settings.stream,
    debugPerf: state.settings.debugPerf,
    quickMode: state.settings.quickMode,
    routingMode: state.settings.routingMode || 'auto',
    hermesApiServerUrl: state.settings.hermesApiServerUrl || '',
    hermesApiServerKey: state.settings.hermesApiServerKey || '',
    toolPermissions: state.settings.toolPermissions || { commandPolicy:'safe', logApprovals:true, requireApprovalForRisky:true },
    history: state.settings.history,
    systemPrompt: state.settings.systemPrompt,
    style: state.settings.style,
    api: state.settings.api || '',
    dataRootDir: state.settings.dataRootDir || '',
    memoryDir: state.settings.memoryDir || '',
    imageDir: state.settings.imageDir || '',
    historyDir: state.settings.historyDir || '',
    mdLibraryDir: state.settings.mdLibraryDir || '',
    promptToggles: state.settings.promptToggles || {},
    knowledgeSearchLimit: state.settings.knowledgeSearchLimit ?? 3,
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
  askConfirm('确认重置所有本地数据？这会清空当前浏览器里的 UI 设置、分身、角色等本地状态。').then(ok=>{
    if(!ok) return;
    ['hermes.settings','hermes.model','hermes.skills','hermes.chats','hermes.memories','hermes.gateways','hermes.theme'].forEach(k=>localStorage.removeItem(k));
    location.reload();
  });
}

let _profilesCache=null;
function renderProfiles(){
  if(!_profilesCache){
    _profilesCache=LS.get('hermes.profiles',[
      {id:'default',name:'默认助手',modelId:'auto',model:scenarioModel('chat'),systemPrompt:'',color:'var(--c-block-lime)'},
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
  const p=getProfiles().find(x=>x.id===id);
  if(!p) return;
  if(p.enabled===false){toast('这个 Agent 已关闭，不能用于对话','info');return}
  state.activeProfile=p.id;
  state.model.model=p.model||scenarioModel('chat');
  save();toast('已切换到角色: '+p.name,'success');
  if(state.page==='chat') renderPage();
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
      <span style="font-size:11px;padding:2px 8px;border-radius:var(--r-pill);background:${(p.streamConnected||p.connected)?'var(--c-success)':(p.configured?'var(--c-accent-soft)':'var(--c-hairline)')};color:${(p.streamConnected||p.connected)?'#fff':(p.configured?'var(--c-accent)':'var(--c-ink-muted)')}">${p.streamConnected?'\u957f\u8fde\u63a5':(p.connected?'\u5df2\u8fde\u63a5':(p.configured?'\u5f85\u8fde\u63a5':'\u672a\u914d\u7f6e'))}</span>
    </div>
    <div style="font-size:12px;color:var(--c-ink-muted);margin-top:4px">${esc(p.desc||'')}</div>
    <div style="font-size:12px;color:var(--c-ink-muted);margin-top:2px">${p.enabled?'\u2713 \u5df2\u542f\u7528':'\u2717 \u5df2\u7981\u7528'}${(p.streamStatusMsg||p.statusMsg)?' - '+esc(p.streamStatusMsg||p.statusMsg):''}</div>
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
  const feishuHelp=id==='feishu'?`<div style="font-size:12px;color:var(--c-ink-muted);line-height:1.6;margin:-4px 0 12px">\u5df2\u542f\u7528\u98de\u4e66\u957f\u8fde\u63a5\u6a21\u5f0f\uff1a\u53ea\u9700\u8981 App ID / App Secret\uff0c\u4e0d\u9700\u8981\u516c\u7f51\u56de\u8c03\u5730\u5740\u3002<br>\u5728\u98de\u4e66\u91cc\u53d1\u9001\u201c\u751f\u56fe/\u751f\u6210\u56fe\u7247/\u753b\u56fe + \u63cf\u8ff0\u201d\uff0cWebUI \u4f1a\u672c\u5730\u751f\u6210\u56fe\u7247\u5e76\u56de\u53d1\u5230\u98de\u4e66\u3002</div>`:'';
  openModal(`<div style="padding:24px;min-width:400px">
    <h3 style="margin-bottom:16px;font-size:18px;font-weight:600">${esc(p.icon||'')} ${esc(p.name)}</h3>
    <p style="font-size:13px;color:var(--c-ink-muted);margin-bottom:16px">${esc(p.desc||'')}</p>
    <div style="display:flex;flex-direction:column;gap:12px">${fields||'<div style="font-size:13px;color:var(--c-ink-muted)">无需额外配置</div>'}</div>
    ${feishuHelp}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
      <label class="toggle"><input type="checkbox" id="gwEnabled_${esc(id)}" ${(p.enabled||id==='feishu')?'checked':''}><span class="toggle-slider"></span></label>
      <div style="display:flex;gap:8px"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-secondary" onclick="testGateway('${esc(id)}')">测试连接</button><button class="btn btn-primary" onclick="saveGateway('${esc(id)}')">保存</button></div>
    </div>
  </div>`);
}
function collectGatewayForm(id){
  const p=(_gatewaysCache?.platforms||[]).find(x=>x.id===id);
  if(!p) return null;
  const config={};
  (p.fields||[]).forEach(f=>{const v=$('#gw_'+f)?.value?.trim();if(v) config[f]=v});
  p.config=config;
  p.configured=id==='feishu' ? !!(config.appId&&config.appSecret) : Object.values(config).some(Boolean);
  p.enabled=$('#gwEnabled_'+id)?.checked??p.enabled;
  if(id==='feishu' && p.configured) p.enabled=true;
  return p;
}
async function testGateway(id,{silent=false}={}){
  const p=collectGatewayForm(id);
  if(!p) return null;
  const resp=await apiPostRaw('/api/gateway/'+encodeURIComponent(id)+'/test',{config:p.config,enabled:p.enabled});
  if(resp?.data?.platform){
    Object.assign(p,resp.data.platform);
    if(_channelsCache?.platforms){
      const cp=_channelsCache.platforms.find(x=>x.id===id);
      if(cp) Object.assign(cp,resp.data.platform);
    }
    if(_gatewaysCache?.platforms){
      const gp=_gatewaysCache.platforms.find(x=>x.id===id);
      if(gp) Object.assign(gp,resp.data.platform);
    }
  }
  const ok=resp?.code===0 && resp?.data?.ok;
  if(!silent) toast(resp?.data?.msg || resp?.msg || (ok?'????':'????'), ok?'success':'error');
  return {ok,msg:resp?.data?.msg||resp?.msg||''};
}
async function saveGateway(id){
  const p=collectGatewayForm(id);
  if(!p) return;
  if(id==='feishu' && p.enabled){
    const result=await testGateway(id,{silent:true});
    if(!result?.ok){
      toast(result?.msg || '?????????? appId / appSecret', 'error');
      return;
    }
  }else{
    await apiPut('/api/gateway',_gatewaysCache);
  }
  _gatewaysCache=await apiGet('/api/gateway')||_gatewaysCache;
  _channelsCache=_gatewaysCache;
  closeModal();renderPage();toast(id==='feishu'?'????????':'???????','success');
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
    <div class="page-header"><h2>任务日志</h2>
      <div class="header-actions"><button class="btn btn-xs btn-ghost" onclick="_logsCache=null;renderPage()">刷新</button></div>
    </div>
    <div class="log-container" id="logsContainer">${buildLogsHtml(_logsCache)}</div>
  </div>`;
}
function buildLogsHtml(logs){
  if(!logs||!logs.length) return '<div class="empty-state"><span>暂无日志记录</span></div>';
  return logs.slice().reverse().map(l=>{
    const ts=l.ts?new Date(l.ts).toLocaleString('zh-CN'):'--:--:--';
    const level=l.level||'info';
    const route=l.route?` · ${esc(l.route)}`:'';
    const reason=l.reason?` / ${esc(l.reason)}`:'';
    const duration=l.durationMs?` · ${Number(l.durationMs)}ms`:'';
    const chars=l.outputChars?` · ${Number(l.outputChars)}字`:'';
    const title=l.title?esc(l.title):esc(l.msg||'');
    const err=l.error?`<div style="margin-top:4px;color:var(--c-danger)">${esc(l.error)}</div>`:'';
    return `<div class="log-line log-${level}"><span class="log-ts">${ts}</span><span class="log-level">${level}</span><span class="log-msg"><strong>${title}</strong><span style="color:var(--c-ink-muted)">${route}${reason}${duration}${chars}</span>${err}</span></div>`;
  }).join('');
}

let _filesCache=null;
let _filesPath='';
let _fileContentView=null;
let _filesMeta=null;
let _filesSelected='';
const _filesExpanded=new Set();
const _filesTreeCache={};
function renderProfilesV2(){
  const profiles=getProfiles();
  return `<div class="profiles-view">
    <div class="page-header"><h2>Agent 管理</h2><button class="btn btn-sm btn-primary" onclick="addProfileV2()">${SVG.plus} 新建 Agent</button></div>
    <div class="profiles-content">
      <div class="profile-grid agent-grid">${profiles.map(p=>{
        const enabled=p.enabled!==false;
        const skillNames=selectedProfileSkills(p).map(s=>s.name).slice(0,3);
        const model=p.modelId==='auto'?'自动 · '+scenarioModel('chat'):(getModelById(p.modelId)?.name||p.model||'未设置');
        return `<div class="profile-card agent-card${enabled?'':' disabled'}${state.activeProfile===p.id?' active':''}" onclick="editProfileV2('${p.id}')">
        <div class="agent-card-head">
          ${profileAvatarHtml(p,'profile-avatar')}
          <div class="agent-card-title">
            <div class="profile-name">${esc(p.name)}</div>
            <div class="agent-card-status">${enabled?'可用于对话/分身':'已关闭'}</div>
          </div>
          <label class="toggle agent-toggle" title="${enabled?'关闭 Agent':'开启 Agent'}" onclick="event.stopPropagation()">
            <input type="checkbox" ${enabled?'checked':''} onchange="toggleProfileEnabled('${p.id}',this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="profile-model">${esc(model)}</div>
        <p class="agent-prompt-preview">${esc((p.systemPrompt||'通用 Agent，没有额外提示词。').slice(0,100))}</p>
        <div class="agent-skill-chips">${skillNames.length?skillNames.map(n=>`<span>${esc(n)}</span>`).join(''):'<span>未绑定技能</span>'}${(p.skillIds||[]).length>3?`<span>+${(p.skillIds||[]).length-3}</span>`:''}</div>
        <div class="agent-card-actions">
          <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();useProfile('${p.id}')">用于对话</button>
          ${p.id!=='default'?`<button class="btn btn-xs btn-ghost" style="color:var(--c-error)" onclick="event.stopPropagation();deleteProfile('${p.id}')">删除</button>`:''}
        </div>
      </div>`;
      }).join('')}</div>
    </div>
  </div>`;
}
renderProfiles=renderProfilesV2;
function profileModal(profile){
  const p=normalizeProfile(profile||{id:'',name:'',modelId:'auto',systemPrompt:'',enabled:true,skillIds:[]});
  _profileAvatarDraft=p.avatar||'';
  _profileAvatarCleared=false;
  const models=getEnabledModels();
  const opts=`<option value="auto"${p.modelId==='auto'?' selected':''}>自动（按场景）</option>`+models.map(m=>`<option value="${esc(m.id)}"${p.modelId===m.id||p.model===m.name?' selected':''}>${esc(m.name)} · ${esc(m.provider)}</option>`).join('');
  const skills=(state.skills||[]);
  const skillHtml=skills.length?skills.map(s=>{
    const checked=(p.skillIds||[]).includes(s.id);
    return `<label class="agent-skill-option">
      <input type="checkbox" value="${esc(s.id)}" ${checked?'checked':''}>
      <span><strong>${esc(s.name||'未命名技能')}</strong><small>${esc(s.description||s.desc||'暂无描述')}</small></span>
    </label>`;
  }).join(''):'<div class="empty-text">技能中心还没有技能。</div>';
  openModal(`<div class="agent-editor-modal">
    <h3>${profile?'编辑 Agent':'新建 Agent'}</h3>
    <div class="agent-editor-grid">
      <div class="agent-avatar-field wide">
        <span id="pfAvatarPreview" class="profile-avatar" style="${p.avatar?`background-image:url('${esc(p.avatar)}');background-size:cover;background-position:center`:`background:${p.color||'var(--c-block-lime)'}`}">${p.avatar?'':esc((p.name||'A').charAt(0))}</span>
        <div>
          <strong>Agent 头像</strong>
          <small>头像会同步显示到对话页面、Agent 切换和会话卡片。</small>
          <div class="agent-avatar-actions">
            <button class="btn btn-xs btn-secondary" onclick="document.getElementById('pfAvatarInput').click()">更换头像</button>
            <button class="btn btn-xs btn-ghost" onclick="resetProfileAvatar()">恢复默认头像</button>
          </div>
          <input id="pfAvatarInput" type="file" accept="image/*" style="display:none" onchange="handleProfileAvatarInput(this)">
        </div>
      </div>
      <label>名称<input id="pfName" placeholder="Agent 名称" value="${esc(p.name)}"></label>
      <label>模型<select id="pfModel">${opts}</select></label>
      <label class="wide">Agent 提示词<textarea id="pfPrompt" placeholder="描述这个 Agent 的身份、能力边界、工作方式…" style="min-height:130px">${esc(p.systemPrompt||'')}</textarea></label>
      <div class="agent-skill-picker wide">
        <div><strong>可用技能</strong><small>与技能中心保持一致，只会注入被这个 Agent 勾选的技能。</small></div>
        <div class="agent-skill-list">${skillHtml}</div>
      </div>
      <label class="agent-editor-switch wide"><input type="checkbox" id="pfEnabled" ${p.enabled!==false?'checked':''}> 启用这个 Agent</label>
      <div class="model-format-hint">关闭后，这个 Agent 在对话、分身等任何场景都不会启动；默认 Agent 也可以关闭，但系统会自动选择下一个启用的 Agent。</div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="${profile?`doEditProfileV2('${p.id}')`:'doAddProfileV2()'}">保存</button></div>
    </div>
  </div>`);
}
function addProfileV2(){profileModal(null)}
function editProfileV2(id){profileModal(getProfiles().find(p=>p.id===id))}
function doAddProfileV2(){
  const name=$('#pfName')?.value?.trim();
  if(!name){toast('请填写角色名称','error');return}
  const modelId=$('#pfModel')?.value||'auto';
  const model=getModelById(modelId)?.name||scenarioModel('chat');
  const colors=['var(--c-block-lime)','var(--c-block-lilac)','var(--c-block-cream)','var(--c-block-mint)','var(--c-block-coral)'];
  _profilesCache=getProfiles();
  const skillIds=[...document.querySelectorAll('.agent-skill-option input:checked')].map(i=>i.value);
  _profilesCache.push({id:'pf_'+Date.now(),name,modelId,model,enabled:$('#pfEnabled')?.checked!==false,skillIds,systemPrompt:$('#pfPrompt')?.value?.trim()||'',color:colors[_profilesCache.length%colors.length],avatar:_profileAvatarDraft||''});
  LS.set('hermes.profiles',_profilesCache);closeModal();renderPage();toast('角色已保存','success');
}
function doEditProfileV2(id){
  const p=getProfiles().find(x=>x.id===id); if(!p) return;
  p.name=$('#pfName')?.value?.trim()||p.name;
  p.modelId=$('#pfModel')?.value||'auto';
  p.model=getModelById(p.modelId)?.name||scenarioModel('chat');
  p.enabled=$('#pfEnabled')?.checked!==false;
  p.skillIds=[...document.querySelectorAll('.agent-skill-option input:checked')].map(i=>i.value);
  p.systemPrompt=$('#pfPrompt')?.value?.trim()||'';
  p.avatar=_profileAvatarCleared?'':(_profileAvatarDraft||p.avatar||'');
  if(_profileAvatarCleared&&!p.color) p.color=presetProfileColor(p.name);
  if(p.enabled===false&&state.activeProfile===p.id){
    const next=getProfiles().find(x=>x.id!==p.id&&x.enabled!==false);
    if(next) state.activeProfile=next.id;
  }
  LS.set('hermes.profiles',_profilesCache);closeModal();renderPage();toast('角色已更新','success');
}

function toggleProfileEnabled(id,on){
  const p=getProfiles().find(x=>x.id===id);
  if(!p) return;
  p.enabled=!!on;
  if(!p.enabled&&state.activeProfile===id){
    const next=getProfiles().find(x=>x.id!==id&&x.enabled!==false);
    if(next) state.activeProfile=next.id;
  }
  LS.set('hermes.profiles',_profilesCache);
  save();
  renderPage();
  toast(p.enabled?'Agent 已启用':'Agent 已关闭','info');
}

function renderFiles(){
  if(!_filesCache){
    const initialDir=state.settings.mdLibraryDir||'';
    apiGet('/api/system/files'+(initialDir?'?dir='+encodeURIComponent(initialDir):'')).then(data=>{
      if(data){
        _filesCache=data.items||[];
        _filesPath=data.path||'';
        _filesMeta=data;
        if(data.path){_filesExpanded.add(data.path);_filesTreeCache[data.path]=data.items||[]}
      }
      else _filesCache=[];
      const root=$('#filesContent');
      if(root) root.innerHTML=buildFilesViewHtml();
    });
    _filesCache=[];
  }
  return `<div class="files-view">
    <div class="page-header"><h2>文件</h2>
      <div class="header-actions">
        <button class="btn btn-sm btn-secondary" onclick="openCurrentFilesFolder()">打开当前目录</button>
        <button class="btn btn-sm btn-secondary" onclick="_filesCache=null;_fileContentView=null;renderPage()">${SVG.upload} 刷新</button>
      </div>
    </div>
    <div class="files-content" id="filesContent">${buildFilesViewHtml()}</div>
  </div>`;
}
function buildFilesViewHtml(){
  const roots=_filesMeta?.roots||[];
  const current=_filesPath||'加载中…';
  const crumbs=current.split(/[\\/]/).filter(Boolean);
  return `<div class="files-layout">
    <aside class="files-tree" id="filesTree">
      <div class="files-root-list">
        ${roots.map(r=>`<button class="${current===r.path?'active':''}" onclick="browseFilesAbs('${encodeURIComponent(r.path)}')">${esc(r.label)}</button>`).join('')}
      </div>
      <div class="files-current-path" title="${esc(current)}">${esc(current)}</div>
      <div class="files-crumbs">${crumbs.slice(-4).map(c=>`<span>${esc(c)}</span>`).join('<b>/</b>')}</div>
      ${_filesMeta?.parent?`<button class="file-item folder up" onclick="browseFilesAbs('${encodeURIComponent(_filesMeta.parent)}')">← 上一级</button>`:''}
      ${buildFilesHtml(_filesCache)}
    </aside>
    <section class="files-main" id="filesMain">
      ${_fileContentView||'<div class="files-empty"><div>'+SVG.files+'</div><h3>选择一个文件预览</h3><p>这里用于查看工作区、数据目录和 MD 输出库。点击文件夹进入，点击文件读取内容。</p></div>'}
    </section>
  </div>`;
}
function isPreviewImage(path=''){
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(path||''));
}

function isPreviewText(path=''){
  return /\.(md|txt|json|js|css|html|xml|yml|yaml|log|csv|env|bat|ps1|py|ts|tsx|jsx)$/i.test(String(path||''));
}

function fileTreeIndent(depth){
  return 12 + (Number(depth)||0)*18;
}

function buildFilesHtml(items,depth=0){
  if(!items||!items.length) return '<div style="font-size:13px;color:var(--c-ink-muted);padding:8px 12px">空目录</div>';
  return items.map(f=>{
    const encoded=encodeURIComponent(f.path);
    if(f.type==='folder'){
      const open=_filesExpanded.has(f.path);
      const children=_filesTreeCache[f.path]||[];
      return `<div class="file-tree-node">
        <div class="file-item folder${_filesSelected===f.path?' active':''}" style="padding-left:${fileTreeIndent(depth)}px" onclick="toggleFileFolder('${encoded}')">
          <span class="file-chevron${open?' open':''}">${SVG.chevronDown}</span>
          ${SVG.folder}
          <span>${esc(f.name)}</span>
        </div>
        ${open?`<div class="file-tree-children">${children.length?buildFilesHtml(children,depth+1):'<div class="file-tree-loading" style="padding-left:'+fileTreeIndent(depth+1)+'px">空目录</div>'}</div>`:''}
      </div>`;
    }
    return `<div class="file-item${_filesSelected===f.path?' active':''}" style="padding-left:${fileTreeIndent(depth)}px" onclick="viewFileAbs('${encoded}')">
      <span class="file-chevron spacer"></span>
      ${isPreviewImage(f.path)?SVG.image:SVG.file}
      <span>${esc(f.name)}</span>
      ${f.size?`<span style="font-size:11px;color:var(--c-ink-muted);margin-left:auto">${formatBytes(f.size)}</span>`:''}
    </div>`;
  }).join('');
}
async function browseFiles(name){
  const dir=_filesPath?_filesPath+'/'+name:name;
  return browseFilesAbs(encodeURIComponent(dir));
}
async function browseFilesAbs(encodedPath){
  const dir=decodeURIComponent(encodedPath||'');
  const data=await apiGet('/api/system/files?dir='+encodeURIComponent(dir));
  if(data){_filesCache=data.items||[];_filesPath=data.path||dir;_filesMeta=data;_filesSelected='';_filesExpanded.add(data.path||dir);_filesTreeCache[data.path||dir]=data.items||[]}
  const root=$('#filesContent');
  if(root) root.innerHTML=buildFilesViewHtml();
}

async function toggleFileFolder(encodedPath){
  const dir=decodeURIComponent(encodedPath||'');
  if(_filesExpanded.has(dir)){
    _filesExpanded.delete(dir);
  }else{
    _filesExpanded.add(dir);
    if(!_filesTreeCache[dir]){
      _filesTreeCache[dir]=[];
      const root=$('#filesContent');
      if(root) root.innerHTML=buildFilesViewHtml();
      const data=await apiGet('/api/system/files?dir='+encodeURIComponent(dir));
      _filesTreeCache[dir]=data?.items||[];
    }
  }
  const root=$('#filesContent');
  if(root) root.innerHTML=buildFilesViewHtml();
}
async function viewFile(name){
  const p=_filesPath?_filesPath+'/'+name:name;
  return viewFileAbs(encodeURIComponent(p));
}
async function viewFileAbs(encodedPath){
  const p=decodeURIComponent(encodedPath||'');
  _filesSelected=p;
  if(isPreviewImage(p)){
    const raw=apiBase()+'/api/system/file-raw?path='+encodeURIComponent(p);
    _fileContentView=`<div class="file-preview-panel"><div class="file-preview-head"><button class="btn btn-secondary btn-sm" onclick="clearFilePreview()">← 返回</button><div><strong>${esc(p.split(/[\\/]/).pop())}</strong><span>${esc(p)}</span></div></div><div class="file-preview-image"><img src="${esc(raw)}" alt="${esc(p.split(/[\\/]/).pop())}"></div></div>`;
      const root=$('#filesContent');
      if(root) root.innerHTML=buildFilesViewHtml();
      const main=$('#filesMain');
      if(main) main.innerHTML=_fileContentView;
      return;
  }
  if(!isPreviewText(p)){
    _fileContentView=`<div class="file-preview-panel"><div class="file-preview-head"><button class="btn btn-secondary btn-sm" onclick="clearFilePreview()">← 返回</button><div><strong>${esc(p.split(/[\\/]/).pop())}</strong><span>${esc(p)}</span></div></div><div class="files-empty"><div>${SVG.file}</div><h3>暂不支持直接预览</h3><p>这个文件类型不能在 WebUI 内安全预览，可以从左侧定位后使用“打开当前目录”。</p></div></div>`;
    const root=$('#filesContent');
    if(root) root.innerHTML=buildFilesViewHtml();
    const main=$('#filesMain');
    if(main) main.innerHTML=_fileContentView;
    return;
  }
  const data=await apiGet('/api/system/file-content?path='+encodeURIComponent(p));
  const el=$('#filesMain');
  if(!el) return;
  if(data){
    const isMd=(data.ext||data.path||'').toLowerCase().endsWith('.md');
    const preview=isMd?`<div class="file-preview-render artifact-preview markdown-body">${renderMessageMarkdown(data.content)}</div>`:`<pre class="file-preview-source">${esc(data.content)}</pre>`;
    _fileContentView=`<div class="file-preview-panel"><div class="file-preview-head"><button class="btn btn-secondary btn-sm" onclick="clearFilePreview()">← 返回</button><div><strong>${esc(data.path.split(/[\\/]/).pop())}</strong><span>${esc(data.path)}</span></div><em>${formatBytes(data.size)}</em></div>${preview}</div>`;
    const root=$('#filesContent');
    if(root){
      root.innerHTML=buildFilesViewHtml();
      enhanceMessageMarkdown(root);
    } else {
      el.innerHTML=_fileContentView;
      enhanceMessageMarkdown(el);
    }
  } else {
    el.innerHTML='<div class="empty-state"><span>无法读取文件内容</span></div>';
  }
}
function clearFilePreview(){
  _fileContentView=null;
  _filesSelected='';
  const root=$('#filesContent');
  if(root) root.innerHTML=buildFilesViewHtml();
}
async function openCurrentFilesFolder(){
  if(!_filesPath) return;
  await apiPost('/api/system/open-path',{path:_filesPath});
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

function openModal(html,options={}){
  const overlay=$('#modalOverlay');
  const content=$('#modalContent');
  if(!overlay||!content) return;
  content.className='modal';
  if(options.className) content.classList.add(options.className);
  content.innerHTML=html;
  overlay.classList.add('show');
}

function closeModal(){
  const overlay=$('#modalOverlay');
  const content=$('#modalContent');
  if(overlay) overlay.classList.remove('show');
  if(content) content.className='modal';
}

function askConfirm(message){
  return new Promise(resolve=>{
    const safe=esc(message||'确认继续？');
    openModal(`
      <div class="confirm-modal">
        <h3>请确认</h3>
        <p>${safe}</p>
        <div class="rename-actions">
          <button class="btn btn-ghost" id="confirmCancelBtn">取消</button>
          <button class="btn btn-primary" id="confirmOkBtn">确认</button>
        </div>
      </div>
    `);
    const done=(value)=>{ closeModal(); resolve(value); };
    setTimeout(()=>{
      const cancel=document.getElementById('confirmCancelBtn');
      const ok=document.getElementById('confirmOkBtn');
      if(cancel) cancel.onclick=()=>done(false);
      if(ok) ok.onclick=()=>done(true);
      if(ok) ok.focus();
    },0);
  });
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
  es.addEventListener('ask', e => {
    try {
      const d = JSON.parse(e.data);
      handleAgentAskEvent(d);
    } catch(err){ console.error('SSE ask error:', err); }
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
  _needsScroll:false,

  ask(questions,opts){
    opts=opts||{};
    const sessionId=opts.id||('ask_'+Date.now());
    this._session={
      id:sessionId,
      title:opts.title||'Agent 提问',
      message:opts.message||'',
      questions:questions.map((q,i)=>({
        id:q.id||('q_'+i),
        label:q.label||q.question||q.header||('问题 '+(i+1)),
        type:q.type||(q.multiSelect?'multi':'single'),
        options:(q.options||[]).map(opt=>{
          if(typeof opt==='string') return {label:opt,value:opt};
          return {...opt,label:opt.label??opt.value??'',value:opt.value??opt.label??''};
        }),
        hint:q.hint||'',
        required:q.required!==false,
        maxLength:q.maxLength||0,
        placeholder:q.placeholder||q.inputPlaceholder||'请输入补充说明…',
      })),
      createdAt:Date.now(),
    };
    this._activeTab=0;
    this._answers={};
    this._session.questions.forEach(q=>{
      this._answers[q.id]={selected:[],custom:''};
    });
    this._needsScroll=true;
    this._render();
    return new Promise(resolve=>{
      this._resolve=resolve;
    });
  },

  _render(){
    const slot=$('#agentPanelSlot');
    if(!slot||!this._session) return;
    const s=this._session;
    const q=s.questions[this._activeTab];
    const ans=this._answers[q.id];
    const answeredCount=s.questions.filter(qq=>this._isAnswered(qq.id)).length;
    const allAnswered=answeredCount===s.questions.length;
    const isCurrentAnswered=this._isAnswered(q.id);
    const hasNextQuestion=this._activeTab < s.questions.length - 1;
    const isSingle = q.type==='single';
    const indicatorCls = isSingle ? 'agent-option-radio' : 'agent-option-check';
    const clickFn = isSingle ? '_selectSingle' : '_toggleMulti';
    const otherTitle = '其他';
    const topStatus = `<span class="agent-panel-count">${answeredCount}/${s.questions.length} 已回答</span>`;

    let tabsHtml='';
    if (s.questions.length > 1) {
      tabsHtml = `<div class="agent-tabs">` + s.questions.map((qq,i)=>{
        const isAnswered=this._isAnswered(qq.id);
        const cls=i===this._activeTab?'active':'';
        const dot=isAnswered?'<span class="tab-answered"></span>':'<span class="tab-pending"></span>';
        return `<button class="agent-tab ${cls}" onclick="AgentAsk._switchTab(${i})">${esc(qq.label)}${dot}</button>`;
      }).join('') + `</div>`;
    } else {
      tabsHtml = `<div class="agent-panel-title-compact">${esc(q.label||s.title)}</div>`;
    }

    let optionsHtml = q.options.map(opt=>{
      const value = String(opt.value ?? opt.label ?? '');
      const sel=ans.selected.includes(value)?'selected':'';
      const descHtml = opt.description ? `<div class="agent-option-desc">${esc(opt.description)}</div>` : '';
      const encodedValue = encodeURIComponent(value).replace(/'/g,'%27');
      return `<div class="agent-option ${sel}" role="button" tabindex="0" onclick="AgentAsk.${clickFn}(this, '${q.id}', '${encodedValue}')">
        <div class="${indicatorCls}"></div>
        <div class="agent-option-text">
          <div class="agent-option-label">${esc(opt.label)}</div>
          ${descHtml}
        </div>
      </div>`;
    }).join('');

    const isOtherSelected = ans.selected.includes('__OTHER__');
    const inlineTextarea = `<textarea class="agent-inline-textarea" id="agentCustomInput_${q.id}" rows="2" placeholder="${esc(q.placeholder)}" onclick="event.stopPropagation()" onfocus="AgentAsk._selectOtherInput(this, '${q.id}', '${q.type}')" oninput="AgentAsk._updateCustom('${q.id}',this.value)">${esc(ans.custom)}</textarea>`;
    optionsHtml += `
      <div class="agent-option agent-option-other ${isOtherSelected ? 'selected' : ''}" role="button" tabindex="0" onclick="AgentAsk._selectOther(this, '${q.id}', '${q.type}')">
        <div class="${indicatorCls}"></div>
        <div class="agent-option-text">
          <div class="agent-option-label">${otherTitle}</div>
        </div>
        ${inlineTextarea}
      </div>
    `;


    slot.innerHTML=`
      <div class="agent-panel agent-panel-floating" role="dialog" aria-modal="true" aria-label="${esc(s.title)}">
        <div class="agent-panel-top">
          ${tabsHtml}
          ${topStatus}
        </div>
        <div class="agent-body">
          <div class="agent-question">
            <div class="agent-question-header">
              <div>

              </div>
            </div>
            ${s.message?`<div class="agent-question-hint">${esc(s.message)}</div>`:''}
            ${q.hint?`<div class="agent-question-hint">${esc(q.hint)}</div>`:''}
            <div class="agent-options">${optionsHtml}</div>
          </div>
        </div>
        <div class="agent-footer">
          <div class="agent-footer-spacer"></div>
          <div class="agent-footer-right">
            <button class="btn btn-secondary btn-sm" onclick="AgentAsk.dismiss()">取消</button>
            <button class="btn btn-primary btn-sm agent-submit-all" onclick="AgentAsk._submitAll()" ${allAnswered?'':'disabled style="opacity:0.5"'}>提交</button>
          </div>
        </div>
      </div>`;

    const inputArea=$('#chatInputArea');
    if(inputArea) inputArea.classList.add('has-agent-panel');

    if (this._needsScroll) {
      this._needsScroll = false;
      setTimeout(() => {
        const area = $('#messagesArea');
        if (area) area.scrollTop = area.scrollHeight;
      }, 50);
    }
  },

  _isAnswered(qId){
    const a=this._answers[qId];
    if(!a) return false;
    const q=this._session.questions.find(qq=>qq.id===qId);
    if(!q) return false;
    if(q.required) {
      return a.selected.length > 0;
    }
    return true;
  },

  _switchTab(idx){
    this._activeTab=idx;
    this._render();
  },

  _selectSingle(target,qId,value){
    if(target?.closest('textarea')) return;
    const decodedValue=decodeURIComponent(value);
    this._answers[qId].selected=[decodedValue];
    target?.closest('.agent-options')?.querySelectorAll('.agent-option.selected').forEach(el=>el.classList.remove('selected'));
    target?.classList.add('selected');
    this._refreshStatus();
    const q=this._session?.questions[this._activeTab];
    const currentIdx=this._activeTab;
    if(q?.type==='single' && currentIdx < this._session.questions.length - 1){
      setTimeout(()=>{
        if(this._session && this._activeTab===currentIdx) {
          this._activeTab=currentIdx+1;
          this._render();
        }
      }, 180);
    }
  },

  _toggleMulti(target,qId,value){
    if(target?.closest('textarea')) return;
    const decodedValue = decodeURIComponent(value);
    const arr=this._answers[qId].selected;
    const idx=arr.indexOf(decodedValue);
    if(idx>=0) {
      arr.splice(idx,1);
      target?.classList.remove('selected');
    } else {
      arr.push(decodedValue);
      target?.classList.add('selected');
    }
    this._refreshStatus();
  },

  _selectOther(target,qId, type){
    if(target?.closest('textarea')) return;
    const ans = this._answers[qId];
    if (type === 'single') {
      ans.selected = ['__OTHER__'];
      target?.closest('.agent-options')?.querySelectorAll('.agent-option.selected').forEach(el=>el.classList.remove('selected'));
      target?.classList.add('selected');
    } else {
      const idx = ans.selected.indexOf('__OTHER__');
      if (idx >= 0) {
        ans.selected.splice(idx, 1);
        target?.classList.remove('selected');
      } else {
        ans.selected.push('__OTHER__');
        target?.classList.add('selected');
      }
    }
    this._refreshStatus();
    setTimeout(() => {
      const ta = document.getElementById(`agentCustomInput_${qId}`);
      if (ta) ta.focus();
    }, 50);
  },

  _selectOtherInput(target,qId,type){
    const ans=this._answers[qId];
    if(!ans) return;
    const option=target?.closest('.agent-option');
    if(type==='single') {
      ans.selected=['__OTHER__'];
      option?.closest('.agent-options')?.querySelectorAll('.agent-option.selected').forEach(el=>el.classList.remove('selected'));
    } else if(!ans.selected.includes('__OTHER__')) {
      ans.selected.push('__OTHER__');
    }
    option?.classList.add('selected');
    this._refreshStatus();
  },

  _updateCustom(qId,val){
    const q=this._session?.questions.find(qq=>qq.id===qId);
    const max=q?.maxLength||0;
    const nextVal=String(val||'');
    this._answers[qId].custom=max>0?nextVal.slice(0,max):nextVal;
    const ans=this._answers[qId];
    if(ans && this._answers[qId].custom.trim() && !ans.selected.includes('__OTHER__')){
      if(q?.type==='single') ans.selected=['__OTHER__'];
      else ans.selected.push('__OTHER__');
    }
    const ta=document.getElementById(`agentCustomInput_${qId}`);
    const meta=ta?.nextElementSibling;
    ta?.closest('.agent-option')?.classList.toggle('selected', !!ans?.selected.includes('__OTHER__'));
    if(ta && ta.value!==this._answers[qId].custom) ta.value=this._answers[qId].custom;
    if(meta && meta.classList.contains('agent-inline-meta')) meta.textContent=`${this._answers[qId].custom.length}${max?`/${max}`:''}`;
    this._refreshStatus();
  },

  _refreshStatus(){
    if(!this._session) return;
    const s=this._session;
    const answeredCount=s.questions.filter(qq=>this._isAnswered(qq.id)).length;
    const allAnswered=answeredCount===s.questions.length;
    const footerText=document.querySelector('.agent-panel-count');
    if(footerText) footerText.textContent=`${answeredCount}/${s.questions.length} 已回答`;
    document.querySelectorAll('.agent-tab').forEach((tab,i)=>{
      const q=s.questions[i];
      const marker=tab.querySelector('.tab-answered,.tab-pending');
      if(marker && q) marker.className=this._isAnswered(q.id)?'tab-answered':'tab-pending';
    });
    const submit=document.querySelector('.agent-submit-all');
    if(submit){
      submit.disabled=!allAnswered;
      submit.style.opacity=allAnswered?'':'0.5';
    }
    const current=s.questions[this._activeTab];
    const nextBtn=document.querySelector('.agent-next-btn');
    if(nextBtn && current){
      const currentAnswered=this._isAnswered(current.id);
      const hasNextQuestion=this._activeTab < s.questions.length - 1;
      nextBtn.disabled=!currentAnswered;
      nextBtn.style.opacity=currentAnswered?'':'0.5';
      nextBtn.textContent=hasNextQuestion?'下一步':'提交当前';
    }
  },

  _submitCurrent(){
    const q=this._session.questions[this._activeTab];
    if(q.required&&!this._isAnswered(q.id)){
      toast('请至少选择一个选项或填写补充说明','error');
      return;
    }
    const nextIdx=this._activeTab+1;
    if(nextIdx<this._session.questions.length){
      this._activeTab=nextIdx;
      this._render();
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
      selected:[...this._answers[q.id].selected],
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
window.AgentAsk = AgentAsk;
window.askUser = askUser;

async function handleAgentAskEvent(data){
  if(!data||!data.id) return;
  const questions=Array.isArray(data.questions)?data.questions:[];
  if(!questions.length) return;
  if(typeof pushProcessEvent==='function') pushProcessEvent({type:'agent-ask', title:data.title||'Agent 需要确认'});
  const answers=await AgentAsk.ask(questions,{id:data.id,title:data.title||'Agent 需要确认',message:data.message||''});
  try{
    await apiPost('/api/sse/ask/'+encodeURIComponent(data.id)+'/answer',{
      answers,
      cancelled:answers===null,
    });
    toast(answers===null?'已取消 Agent 提问':'已提交给 Agent，等待继续执行', answers===null?'info':'success');
  }catch(err){
    toast('Agent 提问结果提交失败：'+(err.message||err),'error');
  }
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
    if (settings.quickMode !== undefined) state.settings.quickMode = !!settings.quickMode;
    if (settings.routingMode !== undefined) state.settings.routingMode = settings.routingMode || 'auto';
    if (settings.hermesApiServerUrl !== undefined) state.settings.hermesApiServerUrl = settings.hermesApiServerUrl || '';
    if (settings.hermesApiServerKey !== undefined) state.settings.hermesApiServerKey = settings.hermesApiServerKey || '';
    if (settings.toolPermissions !== undefined) state.settings.toolPermissions = { ...(state.settings.toolPermissions||{}), ...(settings.toolPermissions||{}) };
    if (settings.dataRootDir !== undefined) state.settings.dataRootDir = settings.dataRootDir || '';
    if (settings.memoryDir !== undefined) state.settings.memoryDir = settings.memoryDir || '';
    if (settings.imageDir !== undefined) state.settings.imageDir = settings.imageDir || '';
    if (settings.historyDir !== undefined) state.settings.historyDir = settings.historyDir || '';
    if (settings.mdLibraryDir !== undefined) state.settings.mdLibraryDir = settings.mdLibraryDir || '';
    if (settings.promptToggles !== undefined) state.settings.promptToggles = { ...(state.settings.promptToggles||{}), ...(settings.promptToggles||{}) };
    if (settings.knowledgeSearchLimit !== undefined) state.settings.knowledgeSearchLimit = settings.knowledgeSearchLimit;
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
    state.modelsConfig = modelData;
    const lib=Array.isArray(modelData.library)?modelData.library:[];
    const currentId=modelData.current || modelData.scenarios?.chat || '';
    const current=lib.find(m=>m.id===currentId||m.name===currentId) || lib.find(m=>m.enabled!==false);
    state.model = {
      provider: current?.provider || '',
      model: current?.name || '',
      base: current?.base || '',
      key: current?.key || '',
      temperature: modelData.params?.temperature || state.model.temperature || 0.7,
      topP: modelData.params?.topP || state.model.topP || 1,
      maxTokens: modelData.params?.maxTokens || state.model.maxTokens || 4096,
    };
  }

  // Load WebUI chats and real Hermes CLI sessions together.
  await refreshChatSources({limit:state.cliSessionLimit||500,keepCurrent:false});
  if (state.chats.length) await selectChat(state.chats[state.chats.length-1].id);

  // Load skills
  await loadSkills();
  _profilesCache=null;
  getProfiles();

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










