const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const LS={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))}
};
function chatTimestamp(c){
  const raw = Number(c?.updatedAt || c?.createdAt || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
}
function formatChatDate(c, mode='short'){
  const d = new Date(chatTimestamp(c));
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2,'0');
  const y = d.getFullYear();
  const m = pad(d.getMonth()+1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  if (mode === 'full') return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
  const now = new Date();
  const sameYear = y === now.getFullYear();
  const sameDay = sameYear && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? (hh + ':' + mm) : (sameYear ? (m + '-' + day) : (y + '-' + m + '-' + day));
}

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
  eye:namedSvg('查看',16,'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>'),
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
  if(item.id) return mediaUrl('/api/images/file/'+encodeURIComponent(item.id));
  const value=item.publicUrl||item.url;
  if(value) return mediaUrl(value);
  if(item.path) return mediaUrl('/api/system/file-raw?path='+encodeURIComponent(item.path));
  return '';
}

function currentArtifactContext(){
  try{
    if(typeof HermesArtifact==='undefined' || typeof HermesArtifact.getCurrentMarkdownContext!=='function') return null;
    const ctx=HermesArtifact.getCurrentMarkdownContext();
    if(!ctx || !ctx.path) return null;
    return ctx;
  }catch(_){ return null; }
}

function activeArtifactContext(){
  const ctx=currentArtifactContext();
  return ctx && !state.artifactContextIgnored ? ctx : null;
}

function shortFileName(path='', title=''){
  const raw=String(path||title||'当前文档');
  const name=raw.split(/[\\/]/).pop()||String(title||'当前文档');
  return name.replace(/\.md$/i,'');
}

function toggleArtifactContextIgnored(){
  state.artifactContextIgnored=!state.artifactContextIgnored;
  save();
  syncArtifactContextChip();
}

function renderArtifactContextChip(){
  const ctx=currentArtifactContext();
  if(!ctx) return '';
  const ignored=!!state.artifactContextIgnored;
  const title=shortFileName(ctx.path,ctx.title);
  return `<div class="chat-context-chip${ignored?' ignored':''}" title="${ignored?'已忽略当前 Markdown 文件':'当前 Markdown 文件：'+esc(ctx.path)}">
    <span class="chat-context-file">${SVG.file}</span>
    <span class="chat-context-text">${ignored?'已忽略':esc(title)}</span>
    <button type="button" class="chat-context-eye" onclick="toggleArtifactContextIgnored()" aria-label="${ignored?'恢复引用当前文件':'忽略当前文件'}" title="${ignored?'恢复引用当前文件':'忽略当前文件'}">${SVG.eye}</button>
  </div>`;
}

function syncArtifactContextChip(){
  const slot=$('#chatArtifactContextSlot');
  if(slot) slot.innerHTML=renderArtifactContextChip();
}

async function apiGet(path) {
  try {
    const r = await fetch(apiBase() + path, { cache:'no-store', headers: { 'Accept': 'application/json', 'Cache-Control':'no-cache' } });
    const j = await r.json();
    return j.code === 0 ? j.data : null;
  } catch { return null; }
}
async function apiGetRaw(path) {
  try {
    const r = await fetch(apiBase() + path, { cache:'no-store', headers: { 'Accept': 'application/json', 'Cache-Control':'no-cache' } });
    return await r.json();
  } catch (error) {
    return { code: 1, data: null, msg: error.message || '请求失败' };
  }
}
async function apiPost(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'POST', cache:'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-cache' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.code !== 0 && path !== '/api/issues' && typeof autoReportWebuiIssue === 'function') {
      autoReportWebuiIssue('api_error', j.msg || ('POST '+path+' failed'), { severity:'medium', context:{ path, status:r.status } });
    }
    return j.code === 0 ? j.data : null;
  } catch (error) {
    if (path !== '/api/issues' && typeof autoReportWebuiIssue === 'function') autoReportWebuiIssue('api_error', error.message || ('POST '+path+' failed'), { severity:'medium', context:{ path } });
    return null;
  }
}

async function apiPostRaw(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'POST', cache:'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-cache' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (error) {
    return { code: 1, data: null, msg: error.message || '请求失败' };
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
  return `<details class="prompt-debug-panel" style="margin-top:10px;border:1px dashed var(--c-hairline);border-radius:10px;padding:8px 10px;color:var(--c-ink-muted);font-size:var(--fs-sm)">
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
async function apiPatch(path, body) {
  try {
    const r = await fetch(apiBase() + path, {
      method: 'PATCH', cache:'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-cache' },
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
    const STREAM_TIMEOUT_MS = 300000; // 5min no data = timeout
    while (true) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('stream_timeout')), STREAM_TIMEOUT_MS);
      });
      let value, done;
      try {
        ({ value, done } = await Promise.race([readPromise, timeoutPromise]));
      } catch (e) {
        if (e.message === 'stream_timeout') {
          callbacks.onError?.('连接超时，Agent 可能已停止响应。请尝试重新发送。');
          break;
        }
        throw e;
      }
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
          case 'tool_running': callbacks.onToolRunning?.(data); break;
          case 'tool_complete': callbacks.onToolComplete?.(data); break;
          case 'agent_step': callbacks.onAgentStep?.(data); break;
          case 'heartbeat': callbacks.onHeartbeat?.(data); break;
          case 'agent_raw': callbacks.onAgentRaw?.(data); break;
          case 'agent_exit': callbacks.onAgentExit?.(data); break;
          case 'title': callbacks.onTitle?.(data); break;
          case 'perf': callbacks.onPerf?.(data); break;
          case 'done': await callbacks.onDone?.(data); break;
          case 'error': callbacks.onError?.(data.msg, data); if(typeof autoReportWebuiIssue==='function') autoReportWebuiIssue('sse_error', data.msg || 'SSE error', { severity:'high', context:{ path } }); break;
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
  modelsConfigRoot: null,
  modelConfigScope: LS.get('hermes.modelConfigScope','webui'),
  _editorFetchedModels: null,
  _modelEditorContext: null,
  chatModelOverride: LS.get('hermes.chatModelOverride','auto'),
  forceImageGeneration: LS.get('hermes.forceImageGeneration',false),
  imagePromptMode: LS.get('hermes.imagePromptMode',false),
  pendingImageAttachments: LS.get('hermes.pendingImageAttachments',[]),
  imageEditReference: LS.get('hermes.imageEditReference',null),
  cliSessionLimit: LS.get('hermes.cliSessionLimit',500),
  cliStatusCache: LS.get('hermes.cliStatusCache', null),
  settings: LS.get('hermes.settings',{lang:'zh',stream:true,quickMode:false,routingMode:'auto',agentRuntime:'cli',hermesApiServerUrl:'',hermesApiServerKey:'',history:16,systemPrompt:'',api:'',dataRootDir:'',memoryDir:'',imageDir:'',historyDir:'',mdLibraryDir:'',debugPerf:false,toolPermissions:{commandPolicy:'safe',logApprovals:true,requireApprovalForRisky:true},promptToggles:{webuiRules:true,coreMemory:true,agentRules:true,userSystemPrompt:true,profilePrompt:true,skills:true,knowledgeSearch:true},knowledgeSearchLimit:3}),
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
  artifactContextIgnored: LS.get('hermes.artifactContextIgnored', false),
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
if (typeof window !== 'undefined') window.scheduleAppRender = scheduleAppRender;
if (typeof window !== 'undefined') window.syncArtifactContextChip = syncArtifactContextChip;

function blankModelsConfigClient(){
  return { params:{temperature:0.7,maxTokens:4096,topP:1}, current:'', library:[], scenarios:{chat:'',reasoning:'',vision:'',image:'',video:'',fallback:''} };
}
function isScopedModelsRoot(data){
  return !!(data && typeof data==='object' && (data.webui || data.agent));
}
function normalizeModelsConfigClient(cfg){
  const defaults=blankModelsConfigClient();
  return { ...defaults, ...(cfg||{}), params:{...defaults.params,...((cfg||{}).params||{})}, scenarios:{...defaults.scenarios,...((cfg||{}).scenarios||{})}, library:Array.isArray(cfg?.library)?cfg.library:[] };
}
function normalizeModelsRootForClient(data){
  if(isScopedModelsRoot(data)){
    return { webui:normalizeModelsConfigClient(data.webui || data.agent), agent:normalizeModelsConfigClient(data.agent || data.webui) };
  }
  const migrated=normalizeModelsConfigClient(data);
  return { webui:migrated, agent:JSON.parse(JSON.stringify(migrated)) };
}
function activeModelScope(){
  return state.settings?.quickMode ? 'webui' : 'agent';
}
function modelScopeParam(){
  return '?scope='+encodeURIComponent(activeModelScope());
}
function activeModelsConfig(){
  if(!state.modelsConfigRoot) state.modelsConfigRoot=normalizeModelsRootForClient(state.modelsConfig);
  const cfg=state.modelsConfigRoot[activeModelScope()] || blankModelsConfigClient();
  state.modelsConfig=cfg;
  return cfg;
}
function setActiveModelsConfig(cfg){
  if(!state.modelsConfigRoot) state.modelsConfigRoot=normalizeModelsRootForClient(state.modelsConfig);
  const next=normalizeModelsConfigClient(cfg);
  state.modelsConfigRoot[activeModelScope()]=next;
  state.modelsConfig=next;
  return next;
}
function syncStateModelFromModelsConfig(cfg=activeModelsConfig()){
  const lib=Array.isArray(cfg.library)?cfg.library:[];
  const currentId=cfg.current || cfg.scenarios?.chat || '';
  const current=lib.find(m=>m.id===currentId||m.name===currentId) || lib.find(m=>m.enabled!==false);
  if(!current) return;
  state.model={
    provider: current.provider || '',
    model: current.name || '',
    base: current.base || '',
    key: current.key || '',
    temperature: cfg.params?.temperature || state.model.temperature || 0.7,
    topP: cfg.params?.topP || state.model.topP || 1,
    maxTokens: cfg.params?.maxTokens || state.model.maxTokens || 4096,
  };
}
async function persistModelsConfig(cfg=activeModelsConfig()){
  const data=await apiPut('/api/models'+modelScopeParam(), cfg);
  if(!data){toast('模型配置保存失败，请检查后端连接','error');return null}
  setActiveModelsConfig(data);
  syncStateModelFromModelsConfig(data);
  save();
  return data;
}
function setModelConfigScope(scope){
  state.modelConfigScope = scope==='agent' ? 'agent' : 'webui';
  LS.set('hermes.modelConfigScope', state.modelConfigScope);
  activeModelsConfig();
  syncStateModelFromModelsConfig();
  renderPage();
}

const FIXED_AGENT_PROFILES = [
  { id:'default', name:'主 Agent', role:'主 Agent / 调度入口', modelScene:'chat', color:'var(--c-block-lime)', systemPrompt:'你是 Hermes 的默认助手，也是主 Agent。你负责日常对话、理解用户意图、维护用户规则与偏好，并在需要时查看文档梳理、产品设计、表达增强、生图研究沉淀的知识摘要。你不直接污染其他 Agent 的工作记忆；当任务明显属于某个 Agent 时，提醒用户切换或基于对应知识给出建议。', knowledgeFocus:['rules','questions','workflow'] },
  { id:'coder', name:'文档梳理', role:'工程实现 / 输出文档', modelScene:'reasoning', color:'var(--c-block-lilac)', systemPrompt:`你是文档梳理 Agent，专注于辅助用户生成、修改、上传、整理和维护文档。

身份定位：
- 把零散对话、需求、资料整理成结构清晰的 Markdown 文档。
- 辅助生成产品文档、方案文档、复盘文档、说明文档、输出文档。
- 根据用户要求修改已有文档，保持原有结构和上下文连续性。
- 帮助整理上传内容、文件内容和知识库材料，形成可复用沉淀。

工作方式：
- 先判断用户要“新建文档、修改文档、整理资料、提炼摘要、输出模板”中的哪一种。
- 优先保留用户原意，不擅自改变结论、范围和事实。
- 输出时使用清晰标题、列表、表格、步骤和必要的 Mermaid 图。
- 如果目标文件、修改范围或输出格式不明确，先简短确认。

边界：
- 不替用户虚构未提供的数据、引用和结论。
- 不把聊天历史目录当作正式输出文档目录。
- 不抢产品设计、表达润色和生图研究 Agent 的职责。`, knowledgeFocus:['docs','projects','workflow','prompts'] },
  { id:'pm', name:'产品设计', role:'产品经理 / UI 与 B 端设计', modelScene:'reasoning', color:'var(--c-block-cream)', systemPrompt:`你是产品设计 Agent，专注于产品定位、交互设计、UI 设计、界面分析、验收标准和产品方案。

身份定位：
- 帮助用户梳理产品目标、用户场景、功能边界和优先级。
- 输出交互流程、页面结构、信息架构、状态设计和验收标准。
- 分析 WebUI、B 端后台、工具型产品和 AI 工作流界面的体验问题。
- 将模糊想法转化为可执行的产品方案、设计改动清单和验收口径。

工作方式：
- 先明确目标用户、使用场景、当前问题和成功标准。
- 兼顾产品逻辑、交互效率、UI 层级、可开发性和一致性。
- 对界面问题优先给出“问题 → 原因 → 修改建议 → 验收标准”。
- 需要落地时输出清晰的任务拆分和优先级。

边界：
- 不直接替代生图提示词专家，不把 UI 分析任务泛化成视觉风格堆叠。
- 不在缺少业务信息时强行定方案，必要时先提出关键问题。`, knowledgeFocus:['projects','docs','questions','workflow'] },
  { id:'designer', name:'表达增强', role:'表达增强 / 细节优化', modelScene:'chat', color:'var(--c-block-mint)', systemPrompt:`你是表达增强 Agent，专注于把零碎、口语化、未成体系的内容补充完善、统一结构并增强表达。

身份定位：
- 将用户随手写下的想法整理成清晰、有层次、有说服力的表达。
- 帮助补全遗漏背景、逻辑链路、例子、结论和行动项。
- 统一文风、术语、标题层级和段落结构。
- 优化分享稿、需求说明、问题描述、评论反馈、产品表达和对外文案。

工作方式：
- 先保留用户原始观点和语气，再增强结构和可读性。
- 优先做“补充完整、理顺逻辑、压缩废话、统一格式”。
- 可按场景输出：更自然版、更专业版、更短版、更有感染力版。
- 对不清楚的信息用占位或提示，不替用户编造事实。

边界：
- 不改变用户核心立场。
- 不过度营销化，不把所有内容都写成广告文案。
- 不抢产品方案和文档工程职责。`, knowledgeFocus:['prompts','docs','rules'] },
  { id:'researcher', name:'生图研究', role:'生图提示词 / 视觉研究', modelScene:'image', color:'var(--c-block-coral)', systemPrompt:`你是生图研究 Agent，专注于图像生成、提示词组织、视觉风格分析和 Image2 / WebUI 生图工具协作。

身份定位：
- 帮助用户把模糊生图需求整理成可执行的高质量提示词。
- 覆盖海报、UI 设计、图标效果、IP 角色、插画、产品图、视觉探索等生图方向。
- 优先保护不能变的内容：角色/IP/品牌/产品外观/参考图结构/核心元素。
- 根据用户目标补充构图、镜头、材质、光影、色彩、风格和负向约束。

工作方式：
- 先理解目标，再锁定不能改变的内容，再列出必须保留的信息，最后给模型发挥空间。
- 对纯文字生图，输出优化后的 prompt 并调用 WebUI 生图工具。
- 对参考图/二次编辑，明确“保持原主体、构图、身份和风格，只修改用户指定部分”。
- 可解释提示词组织思路，但不要只输出提示词而不执行用户明确要求的生图。

边界：
- 不把专有角色泛化成普通外貌描述。
- 不新增无关文字、Logo、角色、品牌或产品信息。
- 不把生图稳定性问题伪装成提示词问题；工具失败时说明真实错误。`, knowledgeFocus:['images','prompts','docs'] },
];

const NAV=[
  {id:'chat',label:'对话',icon:'chat'},
  {id:'groupChat',label:'分身',icon:'group'},
  {id:'skill',label:'小脑瓜',icon:'brain'},
  {id:'settingsPage',label:'设置',icon:'settings'},
];

let renderSeq = 0;
let navFrame = 0;

function currentRenderSeq(){
  return Number($('#mainContent')?.dataset.renderSeq || 0);
}

function isRenderCurrent(seq){
  return !seq || currentRenderSeq() === Number(seq);
}

function isSkillPage(tab){
  return state.page === 'skill' && (!tab || skillCenterTab === tab);
}

function isSettingsPage(tab){
  return state.page === 'settingsPage' && (!tab || settingsTab === tab);
}

function renderAppNow(){
  renderSidebar();
  renderPage();
  toggleMobileSidebar(false);
}

function scheduleAppRender(){
  if(navFrame) cancelAnimationFrame(navFrame);
  navFrame = requestAnimationFrame(() => {
    navFrame = 0;
    renderAppNow();
  });
}

function setSkillTab(tab){
  skillCenterTab = tab || 'skills';
  state.page = 'skill';
  scheduleAppRender();
}

function setSettingsTab(tab){
  settingsTab = tab || 'settings';
  state.page = 'settingsPage';
  scheduleAppRender();
}

function scrollSettingsSection(id, btn){
  const root = document.querySelector('.settings-general-content');
  const target = document.getElementById(id);
  if(root && target) root.scrollTo({top: Math.max(0, target.offsetTop - 12), behavior: 'smooth'});
  document.querySelectorAll('.settings-side-link').forEach(item=>item.classList.toggle('active', item===btn || item.dataset.target===id));
}

function save(){
  LS.set('hermes.theme',state.theme);
  LS.set('hermes.model',state.model);
  LS.set('hermes.chatModelOverride',state.chatModelOverride);
  LS.set('hermes.forceImageGeneration',state.forceImageGeneration);
  LS.set('hermes.imagePromptMode',!!state.imagePromptMode);
  LS.set('hermes.pendingImageAttachments',state.pendingImageAttachments||[]);
  LS.set('hermes.imageEditReference',state.imageEditReference||null);
  LS.set('hermes.cliSessionLimit',state.cliSessionLimit||500);
  LS.set('hermes.settings',state.settings);
  LS.set('hermes.memories',state.memories);
  LS.set('hermes.gateways',state.gateways);
  LS.set('hermes.groupChat',state.groupChat);
  LS.set('hermes.activeProfile',state.activeProfile);
  LS.set('hermes.artifactContextIgnored',!!state.artifactContextIgnored);
}

function navigate(page){
  hideNavTooltip();
  if(['settings','models','logs','files','gateways','usage','diagnostics'].includes(page)){
    settingsTab=page;
    state.page='settingsPage';
  }else if(['skills','channels','memory','jobs','profiles'].includes(page)){
    skillCenterTab=page;
    state.page='skill';
  }else{
    state.page=page;
  }
  scheduleAppRender();
}

function toggleTheme(){
  state.theme=state.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=state.theme;
  const icon=$('#themeIcon');
  if(icon) icon.innerHTML=state.theme==='dark'?SVG.moon:SVG.sun;
  const hljsTheme = document.getElementById('hljsTheme');
  if(hljsTheme) hljsTheme.href = state.theme === 'dark' ? 'frontend/css/github-dark.min.css' : 'frontend/css/github.min.css';
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
    : state.page === 'settingsPage' || ['settings','models','logs','files','gateways','usage','diagnostics'].includes(state.page) ? 'settingsPage'
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

function recentIssueEvents(limit=12){
  const c=currentChat?.();
  const msgs=(c&&c.messages)||[];
  const lastAssistant=[...msgs].reverse().find(m=>m&&m.role==='assistant'&&Array.isArray(m.processEvents));
  return (lastAssistant?.processEvents||[]).slice(-limit);
}

function buildIssueContext(extra={}){
  const c=currentChat?.();
  const profile=(typeof currentProfile==='function'?currentProfile():null) || (typeof profileForChat==='function'&&c?profileForChat(c):null) || null;
  return {
    page:state.page,
    chatId:c?.id||c?._id||'',
    chatTitle:c?.title||'',
    messageId:state.currentAssistantMsgId||'',
    agentId:profile?.id||state.activeProfile||'',
    agentName:profile?.name||'',
    model:state.chatModelOverride||state.model?.model||'',
    runtime:'cli',
    routingMode:state.settings?.routingMode||'auto',
    url:location.href,
    ...extra,
  };
}

async function submitWebuiIssue(payload){
  const data=await apiPost('/api/issues',payload);
  if(data){ toast('\u95ee\u9898\u5df2\u8bb0\u5f55','success'); return data; }
  toast('\u95ee\u9898\u8bb0\u5f55\u5931\u8d25','error');
  return null;
}

function openIssueReporter(preset={}){
  const ctx=buildIssueContext(preset.context||{});
  const recent=recentIssueEvents();
  openModal(`<div class="issue-report-modal" style="padding:24px;min-width:min(620px,92vw);max-width:92vw">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px">
      <div><h3 style="margin:0 0 4px">\u8bb0\u5f55 WebUI \u95ee\u9898</h3><p style="margin:0;color:var(--c-ink-muted);font-size:var(--fs-sm)">\u4f1a\u81ea\u52a8\u9644\u5e26\u5f53\u524d\u9875\u9762\u3001\u4f1a\u8bdd\u3001Agent\u3001\u6a21\u578b\u548c\u6700\u8fd1\u6267\u884c\u4e8b\u4ef6\u3002</p></div>
      <button class="modal-close" onclick="closeModal()" aria-label="\u5173\u95ed">\u00d7</button>
    </div>
    <label class="settings-label">\u95ee\u9898\u63cf\u8ff0</label>
    <textarea id="issueDesc" style="width:100%;min-height:110px;margin:6px 0 12px;padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);resize:vertical" placeholder="\u6bd4\u5982\uff1a\u5207\u6362\u6a21\u578b\u540e\u8f93\u5165\u6846\u5185\u5bb9\u88ab\u6e05\u7a7a\u4e86">${esc(preset.description||'')}</textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div><label class="settings-label">\u89e6\u53d1\u6761\u4ef6</label><input id="issueTrigger" value="${esc(preset.trigger||'')}" style="width:100%;height:36px;margin-top:6px;padding:0 10px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink)"></div>
      <div><label class="settings-label">\u4f18\u5148\u7ea7</label><select id="issueSeverity" style="width:100%;height:36px;margin-top:6px"><option value="medium">\u4e2d</option><option value="high">\u9ad8</option><option value="low">\u4f4e</option><option value="critical">\u4e25\u91cd</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div><label class="settings-label">\u9884\u671f\u8868\u73b0</label><input id="issueExpected" value="${esc(preset.expected||'')}" style="width:100%;height:36px;margin-top:6px;padding:0 10px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink)"></div>
      <div><label class="settings-label">\u5b9e\u9645\u8868\u73b0</label><input id="issueActual" value="${esc(preset.actual||'')}" style="width:100%;height:36px;margin-top:6px;padding:0 10px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink)"></div>
    </div>
    <details style="margin:10px 0;color:var(--c-ink-muted)"><summary>\u9644\u5e26\u4e0a\u4e0b\u6587</summary><pre style="white-space:pre-wrap;max-height:180px;overflow:auto;background:var(--c-surface2);padding:10px;border-radius:var(--r-md)">${esc(JSON.stringify({context:ctx,recentEvents:recent},null,2))}</pre></details>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn btn-secondary" onclick="closeModal()">\u53d6\u6d88</button><button class="btn btn-primary" onclick="submitIssueFromModal()">\u4fdd\u5b58\u95ee\u9898</button></div>
  </div>`);
}

async function submitIssueFromModal(){
  const description=$('#issueDesc')?.value?.trim()||'';
  if(!description){toast('\u8bf7\u586b\u5199\u95ee\u9898\u63cf\u8ff0','warning');return}
  await submitWebuiIssue({
    source:'user',
    type:'user_reported',
    description,
    title:description.slice(0,80),
    trigger:$('#issueTrigger')?.value?.trim()||'',
    expected:$('#issueExpected')?.value?.trim()||'',
    actual:$('#issueActual')?.value?.trim()||'',
    severity:$('#issueSeverity')?.value||'medium',
    context:buildIssueContext(),
    recentEvents:recentIssueEvents(),
  });
  closeModal();
}

function autoReportWebuiIssue(kind,message,extra={}){
  const key=kind+'|'+String(message||'').slice(0,160);
  const now=Date.now();
  window.__hermesIssueDedup=window.__hermesIssueDedup||{};
  if(window.__hermesIssueDedup[key]&&now-window.__hermesIssueDedup[key]<30000) return;
  window.__hermesIssueDedup[key]=now;
  apiPost('/api/issues',{
    source:'auto',
    type:kind,
    title:String(message||kind).slice(0,100),
    description:String(message||''),
    severity:extra.severity||'medium',
    context:buildIssueContext(extra.context||{}),
    recentEvents:recentIssueEvents(),
    ...extra,
  }).catch(()=>{});
}

window.openIssueReporter=openIssueReporter;
window.submitIssueFromModal=submitIssueFromModal;

let _agentConsoleOpen=false;
let _agentConsoleMode='events';

function agentConsoleLineHtml(item){
  const ts=Number(item.ts||item.createdAt||Date.now());
  const time=new Date(ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const type=String(item.type||item.level||item.source||'log').slice(0,16);
  const text=item.msg||item.message||item.title||item.description||item.error||'';
  const cls=type.includes('error')||item.level==='error'?' error':(type.includes('stderr')?' raw_stderr':'');
  return `<div class="agent-console-line${cls}"><span class="agent-console-time">${esc(time)}</span><span class="agent-console-type">${esc(type)}</span><span class="agent-console-text">${esc(String(text||'').slice(0,600))}</span></div>`;
}

function currentProcessConsoleLines(){
  const c=currentChat?.();
  const msgs=(c&&c.messages)||[];
  const rows=[];
  msgs.slice(-8).forEach(msg=>{
    (msg.processEvents||[]).forEach(event=>rows.push({ts:msg.ts||Date.now(),type:event.type||event.stage||'event',message:processEventText(event)}));
  });
  return rows.slice(-120);
}

async function renderAgentConsole(){
  const panel=$('#agentConsolePanel');
  if(!panel) return;
  const health=`<div class="agent-console-health">
    <span class="agent-console-health-item ${state.connected!==false?'ok':'bad'}"><i></i>WebUI ${state.connected!==false?'\u6b63\u5e38':'\u65ad\u5f00'}</span>
    <span class="agent-console-health-item ${state.currentStreamController?'busy':'ok'}"><i></i>Agent ${state.currentStreamController?'\u8fd0\u884c\u4e2d':'\u7a7a\u95f2'}</span>
    <span class="agent-console-health-item ok"><i></i>CLI</span>
  </div>`;
  panel.innerHTML=`<div class="agent-console-head">
    <div class="agent-console-title"><span class="conn-dot ${state.currentStreamController?'running':(state.connected!==false?'online':'offline')}"></span><span>\u8fd0\u884c\u65e5\u5fd7</span></div>
    <div class="agent-console-actions">
      <button class="agent-console-action ${_agentConsoleMode==='events'?'active':''}" onclick="setAgentConsoleMode('events')">\u8fc7\u7a0b</button>
      <button class="agent-console-action ${_agentConsoleMode==='logs'?'active':''}" onclick="setAgentConsoleMode('logs')">\u65e5\u5fd7</button>
      <button class="agent-console-action ${_agentConsoleMode==='issues'?'active':''}" onclick="setAgentConsoleMode('issues')">\u95ee\u9898</button>
      <button class="agent-console-action" onclick="openIssueReporter()">\u8bb0\u5f55\u95ee\u9898</button>
      <button class="agent-console-close" onclick="closeAgentConsole()">\u00d7</button>
    </div>
  </div><div class="agent-console-body" id="agentConsoleBody"><div class="agent-console-empty">\u52a0\u8f7d\u4e2d\u2026</div></div>${health}`;
  const body=$('#agentConsoleBody');
  let rows=[];
  if(_agentConsoleMode==='logs') rows=(await apiGet('/api/system/logs?limit=120'))||[];
  else if(_agentConsoleMode==='issues') rows=(await apiGet('/api/issues?limit=120'))||[];
  else rows=currentProcessConsoleLines();
  if(body) body.innerHTML=rows.length?rows.map(agentConsoleLineHtml).join(''):'<div class="agent-console-empty">\u6682\u65e0\u8bb0\u5f55</div>';
}

function toggleAgentConsole(){
  _agentConsoleOpen=!_agentConsoleOpen;
  const panel=$('#agentConsolePanel');
  if(panel) panel.classList.toggle('open',_agentConsoleOpen);
  if(_agentConsoleOpen) renderAgentConsole();
}
function closeAgentConsole(){
  _agentConsoleOpen=false;
  const panel=$('#agentConsolePanel');
  if(panel) panel.classList.remove('open');
}
function setAgentConsoleMode(mode){
  _agentConsoleMode=mode||'events';
  renderAgentConsole();
}

window.toggleAgentConsole=toggleAgentConsole;
window.closeAgentConsole=closeAgentConsole;
window.setAgentConsoleMode=setAgentConsoleMode;

function renderPage(){
  const main=$('#mainContent');
  if(!main) return;
  const seq = ++renderSeq;
  main.dataset.renderSeq = String(seq);
  try{
    if(state.page==='skill'){
      main.innerHTML=renderSkillPage();
    } else if(state.page==='settingsPage'){
      main.innerHTML=renderSettingsPage();
    } else if(state.page==='groupChat'){
      main.innerHTML=renderGroupChat();
    } else {
      main.innerHTML=renderChat();
    }
  }catch(error){
    console.error('[Hermes] render failed', error);
    main.innerHTML=renderErrorPage(error);
  }
  afterRender(seq);
}

function renderErrorPage(error){
  const msg = error && (error.stack || error.message) ? String(error.stack || error.message) : 'unknown render error';
  return `<div class="page-error-state"><h2>页面渲染失败</h2><p>请复制下面的错误信息反馈，或先返回对话页继续使用。</p><pre>${esc(msg)}</pre><button class="btn btn-primary" onclick="state.page='chat';renderAppNow()">返回对话</button></div>`;
}

function afterRender(seq){
  if(!isRenderCurrent(seq)) return;
  if(state.page==='chat') initChat();
  if(state.page==='terminal') initTerminal();
  if(isSkillPage('memory') && !state.memory.data && !state.memory.loading && !state.memory.failed) loadMemoryStore(false, seq);
  if(isSettingsPage()) { loadCliStatusCard(false, seq); loadUpdateStatus(false, seq); }
  if(AgentAsk.isOpen()) AgentAsk._render();

  enhanceMessageMarkdown(document.getElementById('mainContent'));

  if(state.page==='chat' && typeof HermesArtifact !== 'undefined') {
    requestAnimationFrame(() => {
      if(!isRenderCurrent(seq) || state.page !== 'chat') return;
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
  if(!getEnabledModels().length) setupTips.push({title:'配置模型',desc:'还没有可用模型，先添加 Provider、Base URL、API Key 和模型名。',action:"setSettingsTab('models')",label:'去模型配置'});
  if(!String(state.settings.dataRootDir||state.settings.memoryDir||state.settings.imageDir||state.settings.mdLibraryDir||'').trim()) setupTips.push({title:'配置外部数据目录',desc:'建议把记忆、图片、历史和输出文档放到项目外部，方便更新和迁移。',action:"setSettingsTab('settings')",label:'去设置'});
  const setupHtml=setupTips.length?`<div class="setup-guide-card" style="max-width:720px;margin:24px auto 0;padding:16px;border:1px solid var(--c-accent-muted);border-radius:16px;background:var(--c-accent-soft);display:flex;flex-direction:column;gap:10px">
    <strong>首次使用建议先完成配置</strong>
    ${setupTips.map(item=>`<div style="display:flex;gap:12px;align-items:center;justify-content:space-between"><div><div style="font-weight:var(--fw-semibold)">${esc(item.title)}</div><div style="font-size:var(--fs-sm);color:var(--c-ink-muted)">${esc(item.desc)}</div></div><button class="btn btn-secondary btn-sm" onclick="${item.action}">${esc(item.label)}</button></div>`).join('')}
  </div>`:'';
  return `
    <div class="chat-panel">
      <div class="session-sidebar" id="sessionSidebar">
        <div class="session-sidebar-header">
          <div class="session-create-row">
            <button class="agent-switch-btn" id="chatAgentSwitchBtn" onclick="newChat(getMainWebProfile())" title="新建主 Agent 对话">
              <span class="chat-agent-avatar">+</span>
              <span>新建对话</span>
            </button>
            <button class="history-btn compact" onclick="openHistoryPopup()" title="历史记录">${SVG.history}</button>
          </div>
          <div class="agent-dock" id="chatAgentDock">${renderAgentDock()}</div>

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
            <span class="source-badge agent-header-badge">${esc(activeProfile?.name||'默认助手')}</span>
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
            <div class="chat-input-main-row">
              ${renderImagePromptModeTag()}
              <textarea id="chatInput" rows="1" placeholder="\u8f93\u5165\u6d88\u606f\u2026" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}" oninput="autoResizeInput(this)"></textarea>
            </div>
            <div class="chat-input-toolbar">
              <div class="chat-input-left">
                <button class="input-action-btn toolbar-icon-btn" onclick="document.getElementById('fileInput').click()" title="上传文件" aria-label="上传文件">${SVG.attach}</button>
                <div class="image-tool-wrap" onmouseenter="scheduleShowImageToolSwitch()" onmouseleave="scheduleHideImageToolSwitch()">
                  <button class="input-action-btn toolbar-icon-btn image-gen-toggle" onclick="insertImagePrompt()" title="\u7531 HermesAgent \u8bc6\u522b\u5e76\u8c03\u7528\u751f\u56fe\u5de5\u5177" aria-label="\u56fe\u50cf">${SVG.image}</button>
                  <div class="image-tool-pop" id="imageToolPop" onmouseenter="showImageToolSwitch()" onmouseleave="scheduleHideImageToolSwitch()">
                    <div>
                      <strong>\u8df3\u8fc7\u4e3b Agent \u76f4\u8fde\u751f\u56fe</strong>
                      <span>\u70b9\u51fb\u56fe\u50cf\u6309\u94ae\u4ec5\u63d2\u5165\u201c\u751f\u6210\u56fe\u50cf\uff1a\u201d\u8bed\u4e49\u63d0\u793a\uff0c\u9ed8\u8ba4\u4ea4\u7ed9 HermesAgent \u8c03\u7528\u751f\u56fe\u5de5\u5177\uff1b\u5f00\u542f\u6b64\u5f00\u5173\u540e\u624d\u8df3\u8fc7\u4e3b Agent \u76f4\u8fde\u751f\u56fe\u3002</span>
                    </div>
                    <label class="mini-switch">
                      <input type="checkbox" ${state.forceImageGeneration?'checked':''} onchange="setDirectImageMode(this.checked)">
                      <span></span>
                    </label>
                  </div>
                </div>
                <button class="input-action-btn toolbar-icon-btn" onclick="toggleCommandPopup()" title="打开命令面板" aria-label="打开命令面板" id="commandPopupBtn">${SVG.command}</button>
                <button class="input-action-btn toolbar-icon-btn" onclick="toggleSkillPopup()" title="技能" aria-label="技能" id="skillPopupBtn">${SVG.skills}</button>
              </div>
              <div class="chat-input-right">
                <div id="chatArtifactContextSlot" class="chat-artifact-context-slot">${renderArtifactContextChip()}</div>
                <button class="input-action-btn" onclick="toggleModelPopup()" title="选择模型" id="modelPopupBtn" style="font-size:var(--fs-xs);font-family:var(--font-mono);width:auto;padding:0 8px">${esc(state.chatModelOverride==='auto'?'自动':(getModelById(state.chatModelOverride)?.name||state.model.model))}</button>
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

function refreshChatWithoutArtifact(){
  const currentShell=document.querySelector('#artifactShell.open');
  if(!currentShell) return false;
  const temp=document.createElement('div');
  temp.innerHTML=renderChat();
  const nextSession=temp.querySelector('#sessionSidebar');
  const nextMain=temp.querySelector('#chatMainPane');
  const session=document.querySelector('#sessionSidebar');
  const main=document.querySelector('#chatMainPane');
  if(!nextSession||!nextMain||!session||!main) return false;
  session.replaceWith(nextSession);
  main.replaceWith(nextMain);
  initChat();
  enhanceMessageMarkdown(document.getElementById('chatMainPane'));
  syncArtifactContextChip();
  return true;
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
        ${tabs.map(t=>`<div class="tab${active===t.id?' active':''}" onclick="setSkillTab('${t.id}')">${SVG[t.icon]} ${t.label}</div>`).join('')}
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
    {id:'diagnostics',label:'Diagnostics',icon:'usage'},
    {id:'files',label:'文件',icon:'files'},
    {id:'usage',label:'用量统计',icon:'usage'},
  ];
  const active=settingsTab;
  const renderers={settings:renderSettings,models:renderModels,logs:renderLogs,diagnostics:renderDiagnostics,files:renderFiles,usage:renderUsage};
  return `
    <div style="display:flex;flex-direction:column;height:100%">
      <div class="tabs" style="padding:0 24px">
        ${tabs.map(t=>`<div class="tab${active===t.id?' active':''}" onclick="setSettingsTab('${t.id}')">${SVG[t.icon]} ${t.label}</div>`).join('')}
      </div>
      <div style="flex:1;overflow:hidden;min-height:0">
        ${(renderers[active]||renderSettings)()}
      </div>
    </div>`;
}

function setDirectImageMode(on){
  state.forceImageGeneration=!!on;
  save();
  toast(state.forceImageGeneration?'已开启直连生图：跳过主 Agent，使用当前提示词直接生成':'已关闭直连生图：普通描述由 HermesAgent 识别并调用生图工具','info');
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

function renderImagePromptModeTag(){
  return state.imagePromptMode?'<span class="input-mode-tag image-mode-tag"><span>\u56fe\u50cf\u751f\u6210</span><button type="button" onclick="clearImagePromptMode()" title="\u79fb\u9664\u56fe\u50cf\u751f\u6210\u6807\u7b7e">'+SVG.x+'</button></span>':'';
}

function syncImagePromptModeTag(){
  const row=document.querySelector('.chat-input-main-row');
  if(!row) return;
  const old=row.querySelector('.input-mode-tag');
  const html=renderImagePromptModeTag();
  if(state.imagePromptMode){
    if(old) old.outerHTML=html;
    else row.insertAdjacentHTML('afterbegin', html);
  }else if(old){
    old.remove();
  }
}

function insertImagePrompt(){
  state.imagePromptMode=true;
  save();
  syncImagePromptModeTag();
  const ta=$('#chatInput');
  if(ta) ta.focus();
  toast(state.forceImageGeneration?'\u5f53\u524d\u5df2\u5f00\u542f\u76f4\u8fde\u751f\u56fe\uff0c\u53d1\u9001\u540e\u4f1a\u8df3\u8fc7 Agent\u3002':'\u5df2\u6dfb\u52a0\u56fe\u50cf\u751f\u6210\u6807\u7b7e\uff0c\u53d1\u9001\u540e Agent \u4f1a\u77e5\u9053\u8fd9\u662f\u751f\u56fe\u4efb\u52a1\u3002','info');
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

function clearImagePromptMode(){
  state.imagePromptMode=false;
  save();
  syncImagePromptModeTag();
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
  {cmd:'/skill',title:'技能',desc:'查看或调用可用的技能与工具'},
  {cmd:'/summarize',title:'总结',desc:'把当前对话整理成摘要、待办和关键结论'},
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
      <span>${esc(m.name)}</span><span style="margin-left:auto;color:var(--c-ink-muted);font-size:var(--fs-xs)">${esc(m.provider||'')}</span>
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
      <div style="display:grid;gap:8px;margin-top:14px">${HERMES_COMMANDS.map(item=>`<div><code>${esc(item.cmd)}</code> · <strong>${esc(item.title)}</strong><br><span style="color:var(--c-ink-muted);font-size:var(--fs-sm)">${esc(item.desc)}</span></div>`).join('')}</div>
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
    const model=state.chatModelOverride==='auto'?'自动 · '+effectiveChatModelName():(getModelById(state.chatModelOverride)?.name||state.chatModelOverride);
    openModal(`<div style="padding:24px;min-width:min(620px,92vw)">
      <h3 style="margin:0 0 12px">当前状态</h3>
      <div style="line-height:1.9">
        <div><strong>模型：</strong>${esc(model)}</div>
        <div><strong>快速模式：</strong>${state.settings.quickMode?'已开启':'未开启'}</div>
        <div><strong>历史保留：</strong>${esc(state.settings.history||16)} 轮</div>
        <div><strong>数据目录：</strong>${esc(state.settings.dataRootDir||'默认 backend/data')}</div>
        <div><strong>记忆目录：</strong>${esc(state.settings.memoryDir||'自动匹配')}</div>
        <div><strong>图片目录：</strong>${esc(state.settings.imageDir||'自动匹配')}</div>
      </div>
      <div id="agentStatusToolsets" style="margin-top:14px;color:var(--c-ink-muted)">正在读取 Agent 工具列表…</div>
      <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" onclick="closeModal()">关闭</button></div>
    </div>`);
    apiGet('/api/agent').then(data=>{
      const el=$('#agentStatusToolsets');
      if(!el) return;
      const list=Array.isArray(data?.toolsets)?data.toolsets:[];
      el.innerHTML='<div style="font-weight:700;color:var(--c-ink);margin-bottom:8px">Agent 工具列表</div>'+list.map(t=>`<div style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><span class="conn-dot ${t.enabled?'online':'offline'}" style="margin-top:6px"></span><div><strong style="color:var(--c-ink)">${esc(t.name||'工具')}</strong><div>${esc(t.desc||'')}</div>${Array.isArray(t.tools)&&t.tools.length?`<code>${esc(t.tools.join(', '))}</code>`:''}</div></div>`).join('');
    });
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
      const models=getEnabledModels().filter(isChatSelectableModel);
      body.innerHTML=`<div class="model-popup-item${state.chatModelOverride==='auto'?' active':''}" onclick="selectModel('auto')">自动（按场景）</div>`+
        (models.length
          ? models.map(m=>`<div class="model-popup-item${state.chatModelOverride===m.id?' active':''}" onclick="selectModel('${esc(m.id)}')">${esc(m.name)} <span style="margin-left:auto;color:var(--c-ink-muted);font-size:var(--fs-xs)">${isVisionChatModel(m)?'?? ? ':''}${esc(m.provider)}</span></div>`).join('')
          : '<div class="empty-text" style="padding:12px">还没有可用模型，请先到设置 > 模型配置添加真实 Provider。</div>');
    }
    placeInputPopup(popup,$('#modelPopupBtn'),'right');
    popup.style.display='flex';
    setTimeout(()=>document.addEventListener('click',closePopupsOnOutsideClick,{once:true}),10);
  }
}

function visibleChatAgents(){
  return getProfiles().filter(p=>p.id!=='default');
}
function getDefaultChatAgent(){
  const current=state.activeProfile&&visibleChatAgents().find(p=>p.id===state.activeProfile&&p.enabled!==false);
  return current || visibleChatAgents().find(p=>p.enabled!==false) || getActiveProfile();
}

function renderAgentDock(){
  const cur=currentChat();
  const activeId=isFixedAgentMainChat(cur) ? (cur?.agentId||'') : '';
  return visibleChatAgents().map(p=>{
    const disabled=p.enabled===false;
    const active=activeId===p.id;
    return `<button class="agent-dock-item${active?' active':''}${disabled?' disabled':''}" onclick="openAgentMainChat('${esc(p.id)}')" title="${esc(p.role||p.name)}">
      ${profileAvatarHtml(p,'agent-dock-avatar')}
      <span class="agent-dock-copy"><strong>${esc(p.name)}</strong><small>${esc(p.role||'专属工作流')}</small></span>
    </button>`;
  }).join('');
}

async function openAgentMainChat(id){
  const profile=getProfiles().find(p=>p.id===id)||getActiveProfile();
  if(profile?.enabled===false){toast('Agent 已关闭','info');return}
  state.activeProfile=profile.id;
  const existing=state.chats.find(c=>isFixedAgentMainChat(c)&&c.agentId===profile.id);
  save();
  if(existing){await selectChat(existing.id);return}
  await newChat(profile,{isMainAgentChat:true,chatType:'main',title:profile.name+' · 主对话'});
}

function renderChatAgentPopup(){
  const profiles=getProfiles();
  return profiles.map(p=>{
    const disabled=p.enabled===false;
    const active=state.activeProfile===p.id;
    const model=p.modelId==='auto'?'自动':(getModelById(p.modelId)?.name||p.model||'未设置');
    const skillCount=(p.skillIds||[]).length;
    return `<button class="chat-agent-item${active?' active':''}${disabled?' disabled':''}" onclick="newChatWithProfile('${esc(p.id)}')">
      ${profileAvatarHtml(p,'chat-agent-avatar')}
      <div class="chat-agent-info"><strong>${esc(p.name)}</strong><span>${esc(model)} · ${skillCount} 个技能</span></div>
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
  const item=m==='auto'?null:getModelById(m);
  if(item && !isChatSelectableModel(item)){
    toast('\u8f93\u5165\u6846\u53ea\u80fd\u9009\u62e9\u5bf9\u8bdd\u6a21\u578b\uff1b\u56fe\u50cf/\u89c6\u9891\u6a21\u578b\u8bf7\u5728\u6a21\u578b\u914d\u7f6e\u7684\u5e94\u7528\u573a\u666f\u4e2d\u8bbe\u7f6e\u3002','warning');
    return;
  }
  state.chatModelOverride=m;
  if(m!=='auto'){
    state.model={...state.model,provider:item?.provider||state.model.provider,model:item?.name||m,base:item?.base||state.model.base,key:item?.key||state.model.key};
  }
  save();
  closeAllInputPopups();
  const btn=$('#modelPopupBtn');
  if(btn) btn.textContent=state.chatModelOverride==='auto'?'??':(item?.name||m);
}

async function newChatWithProfile(id){
  const profiles=getProfiles();
  const requested=profiles.find(p=>p.id===id) || getActiveProfile();
  if(requested?.enabled===false){toast('Agent is disabled','info');return}
  state.activeProfile=requested?.id||'default';
  save();
  const popup=$('#chatAgentPopup');
  if(popup) popup.style.display='none';
  await newChat(requested);
}
function selectChatProfile(id){
  const c=currentChat();
  if(c && c.agentId){toast('This chat is locked to its Agent. Create a new chat to switch Agent.','info');return}
  newChatWithProfile(id);
}
function selectedProfileSkills(profile){
  if(!profile) return [];
  const ids=Array.isArray(profile.skillIds)?profile.skillIds:[];
  return (state.skills||[]).filter(s=>ids.includes(s.id));
}

function getEnabledModels(){
  const cfg=activeModelsConfig();
  const lib=Array.isArray(cfg.library)?cfg.library:[];
  return lib.filter(m=>m.enabled!==false);
}
function modelTags(model){
  return [...new Set([...(model?.tags||[]), model?.kind||'', model?.apiFormat||''].map(v=>String(v||'').toLowerCase()).filter(Boolean))];
}
function isVideoGenerationModel(model){
  const tags=modelTags(model);
  return model?.apiFormat==='openai-video' || tags.includes('video') || tags.includes('openai-video') || /video|sora|runway|kling|pika|veo/i.test(model?.name||'');
}
function isImageGenerationModel(model){
  const tags=modelTags(model);
  if(isVideoGenerationModel(model)) return false;
  return model?.apiFormat==='openai-image' || tags.includes('image') || tags.includes('openai-image') || tags.includes('openai_image');
}
function isVisionChatModel(model){
  const tags=modelTags(model);
  return !isImageGenerationModel(model) && !isVideoGenerationModel(model) && (tags.includes('vision') || tags.includes('multimodal') || /vision|vl|gpt-4o|gemini|qwen.*vl/i.test(model?.name||''));
}
function isChatSelectableModel(model){
  return model && model.enabled!==false && !isImageGenerationModel(model) && !isVideoGenerationModel(model);
}
function modelIdentityKey(model){
  return [model?.id||'',model?.name||'',model?.provider||'',model?.base||''].join('::').toLowerCase();
}
function stripModelRuntimeMeta(model){
  const copy={...(model||{})};
  delete copy._scope;
  delete copy._sharedScope;
  return copy;
}
function allScopedModels(){
  const root=state.modelsConfigRoot || normalizeModelsRootForClient(state.modelsConfig);
  return ['webui','agent'].flatMap(scope=>{
    const list=Array.isArray(root?.[scope]?.library)?root[scope].library:[];
    return list.map(m=>({...m,_scope:scope}));
  });
}
function dedupeModels(list){
  const seen=new Set();
  return (list||[]).filter(m=>{
    const key=modelIdentityKey(m);
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function getModelById(id){
  const value=String(id||'');
  if(!value) return null;
  const cfg=activeModelsConfig();
  return (cfg.library||[]).find(m=>m.id===value||m.name===value) || allScopedModels().find(m=>m.id===value||m.name===value) || null;
}
function scenarioModel(scene){
  const cfg=activeModelsConfig();
  const id=cfg.scenarios?.[scene] || cfg.scenarios?.chat || state.model.model || '';
  const model=getModelById(id);
  return model?.id || id || '';
}
function scenarioModelName(scene){
  const id=scenarioModel(scene);
  return getModelById(id)?.name || id || '';
}
async function setScenarioModel(scene,id){
  const cfg=activeModelsConfig();
  cfg.scenarios={...(cfg.scenarios||{})};
  if(id){
    const selected=getModelById(id);
    const lib=Array.isArray(cfg.library)?cfg.library:(cfg.library=[]);
    if(selected && !lib.some(m=>m.id===selected.id||m.name===selected.name)){
      lib.push(stripModelRuntimeMeta(selected));
    }
    cfg.scenarios[scene]=selected?.id || id;
  }else{
    delete cfg.scenarios[scene];
  }
  await persistModelsConfig(cfg);
  toast('应用场景模型已更新','success');
  renderPage();
}
function effectiveChatModelName(){
  const p=getActiveProfile();
  if(p?.modelId && p.modelId!=='auto') return getModelById(p.modelId)?.name || p.model || scenarioModelName('chat');
  return scenarioModelName('chat') || '未配置模型';
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
    agentName: c.agentName || '',
    chatType: c.chatType || 'main',
    isMainAgentChat: !!c.isMainAgentChat,
    agentSnapshot: c.agentSnapshot || null,
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
  state.chats=[...byId.values()].sort(compareChatCreatedDesc);
  if(!keepCurrent || !state.chats.some(c=>c.id===state.currentChat)) state.currentChat=state.chats[0]?.id||null;
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
  let chats=[...state.chats].sort(compareChatCreatedDesc);
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
    const chatDate=formatChatDate(c);
    const chatFullDate=formatChatDate(c,'full');
    const readonly=isCliChat(c);
    const sel=histPopupSelected.has(c.id);
    return `<div class="hist-popup-item${sel?' selected':''}" data-id="${c.id}">
      <input type="checkbox" ${sel?'checked':''} onclick="event.stopPropagation();toggleHistPopupSelect('${c.id}')">
      <div class="hist-popup-item-info" onclick="selectChatFromHist('${c.id}')">
        <div class="hist-popup-item-title">${c.pinned?'📌 ':''}${esc(c.title)}</div>
        <div class="hist-popup-item-preview" title="${esc(lastMsg)} · ${esc(chatFullDate)}">${esc(chatFullDate)}</div>
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

function renderSessionSearch(query){
  const box=$('#sessionItems');
  if(box) box.innerHTML=renderSessionList(query||'');
}

function renderSessionList(query=''){
  const q=String(query||'').trim().toLowerCase();
  const sorted = visibleSessionChats()
    .filter(c=>!q || String(c.title||'').toLowerCase().includes(q) || String(c.agentName||'').toLowerCase().includes(q) || String(c.preview||'').toLowerCase().includes(q))
    .sort(compareChatCreatedDesc);
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
        const chatDate=formatChatDate(c);
        const chatFullDate=formatChatDate(c,'full');
        return `<div class="session-item${state.currentChat===c.id?' active':''}" title="${esc(c.title)} · ${esc(chatFullDate)}">
        <div class="session-item-body" onclick="selectChat('${c.id}')">
          <div class="session-card-main">
            <div class="session-card-top">
              <span class="s-title">${c.pinned?'📌 ':''}${esc(c.title)}</span>
            </div>
            <span class="s-preview" title="${esc(c.title)} · ${esc(chatFullDate)}">${esc(chatDate)}</span>
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

function compareChatCreatedDesc(a,b){
  if(!!b?.pinned!==!!a?.pinned) return b?.pinned?1:-1;
  const diff=chatCreatedTime(b)-chatCreatedTime(a);
  if(diff) return diff;
  return String(b?.id||'').localeCompare(String(a?.id||''));
}

function sessionAgentForChat(c){
  const profiles=getProfiles();
  const id=c?.agentId||state.chatFullData?.[c?.id]?.agentId||'';
  return profiles.find(p=>p.id===id) || getActiveProfile();
}

function sessionModelForChat(c,agent){
  if(isCliChat(c)) return c?._model||c?.model||'CLI';
  if(c?._model||c?.model) return c._model||c.model;
  if(agent?.modelId&&agent.modelId!=='auto') return getModelById(agent.modelId)?.name||agent.model||scenarioModelName('chat');
  return scenarioModelName('chat')||state.model.model||'自动';
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

function toolDisplayName(tc){
  return String(tc?.name || tc?.tool || tc?.tool_name || tc?.toolName || tc?.server || tc?.id || tc?.event_type || 'tool').trim() || 'tool';
}

function processEventText(event){
  const type=String(event?.type||event?.stage||'');
  const name=toolDisplayName(event);
  const ms=Number(event?.ms||event?.elapsed||event?.elapsedMs||0);
  const suffix=ms?` · ${ms}ms`:'';
  if(type==='agent-step'||type==='agent_step') {
    const title=String(event?.title||'Agent 步骤').trim();
    const detail=String(event?.detail||'').trim();
    return detail ? `${title}：${detail}` : title;
  }
  if(type==='queued') return '已加入执行队列';
  if(type==='sse-flushed') return `已连接事件流${suffix}`;
  if(type==='route-selected') {
    if(event?.route==='direct') return `使用直连模型${event?.reason?`：${event.reason}`:''}`;
    const runtime=event?.runtime&&event.runtime!=='auto' ? ` (${event.runtime})` : '';
    return `使用 Hermes Agent${runtime}${event?.reason?`：${event.reason}`:''}`;
  }
  if(type==='model-fallback') return `模型已切换${event?.to?`：${event.to}`:''}`;
  if(type==='hermes-api-connect') return '正在连接 Hermes API 服务';
  if(type==='hermes-api-failed') return `Hermes API 不可用，切换到本地 CLI${event?.reason?`：${event.reason}`:''}`;
  if(type==='hermes-session') {
    const sid=event?.sessionId||event?.hermesSessionId||event?.session_id||'';
    return `Hermes 会话已建立${sid?`：${sid}`:''}`;
  }
  if(type==='runtime-selected') return event?.runtime==='cli' ? '已选择本地 Hermes CLI 运行时' : `已选择 Hermes 运行时${event?.runtime?`：${event.runtime}`:''}`;
  if(type==='route-fallback') return event?.route==='hermes-cli' ? '已回退到本地 Hermes CLI' : '已回退到 Hermes Agent';
  if(type==='agent-ask') return `等待你的确认${event?.title?`：${event.title}`:''}`;
  if(type==='agent-ask-result') return event?.status==='answered' ? '已收到你的确认' : `确认结果：${event?.status||'unknown'}`;
  if(type==='skill-match') return event?.items?.length ? `已匹配技能：${event.items.map(item=>item.trigger?`${item.name} (${item.trigger})`:item.name).join('、')}` : (event?.names?.length ? `已匹配技能：${event.names.join('、')}` : '未匹配到专用技能');
  if(type==='first-hermes-event') return `收到 Hermes 首个事件${event?.eventType?`：${event.eventType}`:''}${suffix}`;
  if(type==='cli-spawned') return `本地 Hermes 进程已启动${suffix}`;
  if(type==='first-cli-stdout') return `本地 Hermes 开始输出${suffix}`;
  if(type==='first-token') return `开始生成回复${suffix}`;
  if(type==='tool-start') return `开始调用工具：${name||'tool'}`;
  if(type==='tool-running') return `正在执行工具：${name||'tool'}${suffix}`;
  if(type==='agent-raw') return `${event?.stream==='stderr'?'运行日志':'输出'}：${String(event?.text||'').slice(0,160)}`;
  if(type==='agent-exit') return `本地 Hermes 已退出：code=${event?.code ?? 'unknown'}${event?.stderrTail?'，日志：'+String(event.stderrTail).slice(0,120):''}`;
  if(type==='tool-done') return `${event?.error?'工具执行失败':'工具执行完成'}：${name||'tool'}`;
  if(type==='done') return `执行完成${suffix}`;
  if(type==='error') return `出错：${event?.message||event?.msg||'请求失败'}`;
  if(type==='aborted') return '已中断';
  if(type) return `事件：${type}${suffix}`;
  return '';
}

function parseToolPreviewJson(value){
  const text=String(value||'').trim();
  if(!text) return null;
  try{return JSON.parse(text)}catch(_){return null}
}

function dirnameFromPath(filePath){
  const text=String(filePath||'').replace(/\\/g,'/');
  const idx=text.lastIndexOf('/');
  return idx>=0?text.slice(0,idx):'';
}

function joinLocalPath(base, rel){
  const raw=String(rel||'').replace(/\\/g,'/');
  if(/^[A-Za-z]:[\\/]/.test(raw)) return raw.replace(/\//g,'\\');
  const parts=[];
  [String(base||'').replace(/\\/g,'/'), raw].filter(Boolean).join('/').split('/').forEach(part=>{
    if(!part||part==='.') return;
    if(part==='..') parts.pop(); else parts.push(part);
  });
  if(/^[A-Za-z]:$/.test(parts[0]||'')) return parts.shift()+'\\'+parts.join('\\');
  return parts.join('\\');
}

function fileRawUrl(localPath){
  const value=String(localPath||'').trim();
  return value?mediaUrl('/api/system/file-raw?path='+encodeURIComponent(value)):'';
}

function insertedMarkdownImageResult(tc){
  const data=parseToolPreviewJson(tc?.output||tc?.preview);
  if(!data||data.type!=='webui_markdown_insert_image_result'||!data.success) return null;
  const fullImagePath=data.fullImagePath || (data.fullPath&&data.imagePath?joinLocalPath(dirnameFromPath(data.fullPath),data.imagePath):'');
  return {...data, fullImagePath};
}

function renderInsertedImageToolCard(tc){
  const data=insertedMarkdownImageResult(tc);
  if(!data) return '';
  const src=fileRawUrl(data.fullImagePath);
  const title=data.imagePath||data.fullImagePath||'inserted image';
  const doc=data.path||data.fullPath||'';
  const imgHtml=src?'<button type="button" class="tool-image-card-preview" onclick="event.stopPropagation();openImagePreview(\''+esc(src)+'\',\''+esc(title)+'\')"><img src="'+esc(src)+'" alt="'+esc(title)+'"></button>':'';
  const copyBtn=data.fullImagePath?'<button type="button" onclick="event.stopPropagation();copyText(\''+esc(data.fullImagePath)+'\',\'\u56fe\u7247\u8def\u5f84\u5df2\u590d\u5236\')">\u590d\u5236\u8def\u5f84</button>':'';
  const openBtn=data.fullPath?'<button type="button" onclick="event.stopPropagation();HermesArtifact&&HermesArtifact.openHistoryFile(\''+encodeURIComponent(data.fullPath)+'\',\''+encodeURIComponent((data.path||'\u6587\u6863').split('/').pop())+'\')">\u6253\u5f00\u6587\u6863</button>':'';
  return '<div class="tool-image-card">'+imgHtml+'<div class="tool-image-card-main"><div class="tool-image-card-title">\u5df2\u63d2\u5165\u56fe\u7247\u6587\u4ef6</div><div class="tool-image-card-path" title="'+esc(data.fullImagePath||'')+'">'+esc(title)+'</div><div class="tool-image-card-doc" title="'+esc(doc)+'">\u76ee\u6807\u6587\u6863\uff1a'+esc(doc)+'</div><div class="tool-image-card-actions">'+copyBtn+openBtn+'</div></div></div>';
}

function renderToolArtifactCardsHtml(toolCalls){
  if(!Array.isArray(toolCalls)||!toolCalls.length) return '';
  const cards=toolCalls.map(tc=>renderInsertedImageToolCard(tc)).filter(Boolean);
  return cards.length?'<div class="tool-artifact-cards">'+cards.join('')+'</div>':'';
}

function processEventTone(event){
  const type=String(event?.type||event?.stage||'');
  if(type==='agent-step'||type==='agent_step') {
    const status=String(event?.status||'').toLowerCase();
    if(status==='error'||event?.error) return 'error';
    if(status==='done'||status==='completed'||status==='success') return 'success';
    return 'active';
  }
  if(type==='error'||event?.error) return 'error';
  if(type==='tool-done') return event?.error?'error':'success';
  if(type==='done') return 'success';
  if(['tool-start','tool-running','first-token','first-hermes-event','cli-spawned','hermes-api-connect'].includes(type)) return 'active';
  return 'info';
}

function processEventIsTaskStep(event){
  const type=String(event?.type||event?.stage||'');
  return type==='agent-step'||type==='agent_step'||type==='tool-start'||type==='tool-running'||type==='tool-done'||type==='agent-ask'||type==='agent-ask-result'||type==='error'||type==='done';
}

function processEventDisplayList(events=[], isStreaming=false){
  const list=Array.isArray(events)?events:[];
  const hasSemantic=list.some(event=>{
    const type=String(event?.type||event?.stage||'');
    return type==='agent-step'||type==='agent_step'||type==='tool-start'||type==='tool-running'||type==='tool-done';
  });
  const visible=hasSemantic ? list.filter(processEventIsTaskStep) : list;
  return isStreaming ? visible : visible.slice(-18);
}

function processEventSummary(events=[], isStreaming=false){
  const list=Array.isArray(events)?events:[];
  const visible=processEventDisplayList(list, isStreaming).filter(event=>processEventText(event));
  const last=[...visible].reverse().find(event=>String(event?.type||event?.stage||'')!=='done');
  const done=visible.find(event=>String(event?.type||event?.stage||'')==='done');
  const error=[...visible].reverse().find(event=>processEventTone(event)==='error');
  const runningTool=[...visible].reverse().find(event=>String(event?.type||event?.stage||'')==='tool-running' || String(event?.type||event?.stage||'')==='tool-start');
  if(error) return { status:'error', label:'执行出错', detail:processEventText(error), count:visible.length };
  if(isStreaming){
    const current=runningTool || last;
    return { status:'running', label:runningTool?'正在执行中':'思考中', detail:current?processEventText(current):'正在等待 Agent 返回事件', count:visible.length };
  }
  const doneMs=Number(done?.ms||0);
  return { status:'done', label:'执行完成', detail:`已收集 ${visible.length} 个步骤${doneMs?` · ${doneMs}ms`:''}`, count:visible.length };
}

function renderProcessTimelineHtml(events=[], options={}){
  const isStreaming=!!options.isStreaming;
  const list=Array.isArray(events)?events:[];
  const visibleEvents=processEventDisplayList(list, isStreaming);
  const rows=visibleEvents.map((event,i)=>{
    const label=processEventText(event);
    if(!label) return '';
    const tone=processEventTone(event);
    const name=event?.name?'<span>'+esc(event.name)+'</span>':'';
    const route=event?.route?'<span>'+esc(event.route)+'</span>':'';
    return '<div class="process-timeline-row '+tone+'"><span class="process-timeline-text">'+esc(label)+'</span><span class="process-timeline-meta">'+name+route+'</span></div>';
  }).filter(Boolean).join('');
  const hiddenCount=Math.max(0, list.length-visibleEvents.length);
  const hidden=hiddenCount?'<div class="process-timeline-more">已收起更早 '+hiddenCount+' 个事件</div>':'';
  return rows?'<div class="process-timeline">'+hidden+rows+'</div>':'';
}
function renderThinkingPanel(m,idPrefix){
  if(!m||m.role!=='assistant') return '';
  const tagThink=typeof HermesArtifact!=='undefined'?HermesArtifact.parseHermesStream(m.content||'').think:'';
  const rawThink=cleanThinkingContent([m.thinking||m.reasoning||'',tagThink].filter(Boolean).join('\n---\n'));
  const cleanContent=(m.content||'').replace(/<(?:redacted_thinking|think)>[\s\S]*?<\/(?:redacted_thinking|think)>/gi,'').trim();
  const skipThink=rawThink&&cleanContent&&rawThink.trim().length>20&&cleanContent.includes(rawThink.trim().slice(0,40));
  const isStreaming=!!m._streaming;
  const processHtml=renderProcessTimelineHtml(m.processEvents||[], { isStreaming });
  const hasRealThink=Boolean(rawThink&&!skipThink);
  const body=hasRealThink?rawThink:processHtml;
  if(!body) return '';
  const id='th_'+(idPrefix||m._msgId||(m.ts||Date.now()))+'_'+(m.ts||0);
  const duration=m.thinkingDuration?` · ${m.thinkingDuration}ms`:'';
  const summary=processEventSummary(m.processEvents||[], isStreaming);
  const label=hasRealThink?(isStreaming?'模型推理中':'模型推理'):summary.label;
  const detail=hasRealThink?(isStreaming?'正在整理推理内容':'点击查看推理内容'):summary.detail;
  const expandedStore=window.__hermesThinkingExpanded instanceof Set ? window.__hermesThinkingExpanded : (window.__hermesThinkingExpanded=new Set());
  const collapsed=!expandedStore.has(id);
  return `<div class="msg-thinking ${isStreaming?'is-running':'is-finished'} ${summary.status==='error'?'has-error':''}">
      <div class="msg-thinking-header" onclick="toggleAllThinking('${id}')">
        <svg class="thinking-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8.5 3.8 7.4 6.2 5 7.3l2.4 1.1 1.1 2.4 1.1-2.4L12 7.3 9.6 6.2 8.5 3.8Z"/><path d="M15.8 10.5 14.4 14l-3.4 1.4 3.4 1.4 1.4 3.4 1.4-3.4 3.4-1.4-3.4-1.4-1.4-3.5Z"/></svg>
        <span class="thinking-label">${esc(label)}${isStreaming?'<span class="thinking-dots"><span></span><span></span><span></span></span>':''}</span>
        <span class="thinking-current">${esc(detail)}</span>
        <span class="thinking-duration">${duration}</span>
        <span class="thinking-count">${summary.count?summary.count+' 步':''}</span>
        <span class="thinking-toggle ${collapsed?'collapsed':''}" id="toggle_${id}">▶</span>
      </div>
      <div class="msg-thinking-body ${collapsed?'collapsed':''}${hasRealThink?' is-raw':' is-timeline'}" id="body_${id}">${hasRealThink?esc(body):body}</div>
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

// Strip raw <tool_call> XML tags from content; optionally extract into structured tool calls
function stripRawToolCallTags(content, msg){
  if(!content||!/<tool_call[\s>]/.test(content)) return content;
  // Extract tool calls from raw XML and add to msg.toolCalls
  const tcRegex=/<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let match;
  while((match=tcRegex.exec(content))!==null){
    const xml=match[1];
    const nameMatch=xml.match(/<name>([\s\S]*?)<\/name>/i);
    const paramMatch=xml.match(/<parameters>([\s\S]*?)<\/parameters>/i);
    const name=nameMatch?nameMatch[1].trim():'tool';
    let input='';
    if(paramMatch){
      try{input=JSON.stringify(JSON.parse(paramMatch[1].trim()),null,2)}catch(_){input=paramMatch[1].trim()}
    }
    if(msg){
      if(!msg.toolCalls) msg.toolCalls=[];
      msg.toolCalls.push({name,input,status:'success',duration:0});
    }
  }
  // Remove all raw tool_call tags from visible content
  return content.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi,'').replace(/<\/?invoke>|<\/?parameter[^>]*>/gi,'').trim();
}

function stringifyToolPreviewValue(value){
  if(value==null) return '';
  return typeof value==='string' ? value : JSON.stringify(value,null,2);
}

function cleanToolPreviewText(value){
  const raw=stringifyToolPreviewValue(value);
  return stripLocalEditDiffNoise(redactSecrets(raw)).trim();
}

function getToolCallDiffInfo(tc){
  const raw=[stringifyToolPreviewValue(tc?.input), stringifyToolPreviewValue(tc?.output)].filter(Boolean).join('\n');
  return parseLocalEditDiffInfo(raw);
}

function getToolCallFilePath(tc){
  try{
    const inputObj=typeof tc?.input==='string' ? JSON.parse(tc.input) : tc?.input;
    return inputObj?.file_path || inputObj?.path || '';
  }catch(_){
    return '';
  }
}

function renderToolCallBodyHtml(tc){
  let bodyHtml='';
  const inputText=cleanToolPreviewText(tc?.input);
  const outputText=cleanToolPreviewText(tc?.output);
  if(inputText) bodyHtml+=`<div class="tool-input">输入\n${esc(inputText)}</div>`;
  if(outputText) bodyHtml+=`<div class="tool-output">输出\n${esc(outputText)}</div>`;
  if(!bodyHtml){
    const diff=getToolCallDiffInfo(tc);
    if(diff?.path) bodyHtml+=`<div class="tool-local-file">${renderLocalEditFileChip(diff.path)}</div>`;
  }
  return bodyHtml;
}

function renderToolPreviewButton(tc){
  const name=toolDisplayName(tc);
  if(!(tc?.status==='success' && (name==='Write' || name==='Edit'))) return '';
  const filePath=getToolCallFilePath(tc);
  if(!filePath || !filePath.endsWith('.md')) return '';
  const safePath=encodeURIComponent(filePath);
  const safeName=encodeURIComponent(filePath.split(/[/\\]/).pop());
  return `<button class="history-card-btn" style="margin-left:8px" onclick="event.stopPropagation(); HermesArtifact.openHistoryFile('${safePath}', '${safeName}')">预览文档</button>`;
}

function renderToolCallsHtml(toolCalls, msg){
  if(!toolCalls||!toolCalls.length) return '';
  return '<div class="msg-tool-calls">'+toolCalls.map((tc,i)=>{
    const id='tc_'+(msg?.ts||msg?.id||Date.now())+'_'+i;
    const toolName=toolDisplayName(tc);
    const statusCls=tc.status==='success'?'success':tc.status==='error'?'error':'running';
    const statusText=tc.status==='success'?'完成':tc.status==='error'?'失败':'运行中';
    const bodyHtml=renderToolCallBodyHtml(tc);
    const previewBtn=renderToolPreviewButton(tc);
    return `<div class="msg-tool-call">
        <div class="msg-tool-call-header" data-tool="${esc(toolName)}" onclick="toggleCollapse('${id}')">
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5h16"/><path d="M7.5 4v7"/><path d="m4 16 4-4 4 4"/><path d="m12 16 4-4 4 4"/></svg>
          <span class="tool-name">${esc(toolName)}</span>
          <span class="tool-status ${statusCls}">${statusText}</span>
          ${previewBtn}
          <span class="tool-toggle collapsed" id="toggle_${id}">▼</span>
        </div>
        <div class="msg-tool-call-body collapsed" id="body_${id}">${bodyHtml}</div>
      </div>`;
  }).join('')+'</div>';
}

function previousUserPromptForMessage(msg){
  try{
    const c=currentChat();
    const messages=c?.messages||[];
    const idx=messages.findIndex(item=>item===msg || (msg?._msgId && item?._msgId===msg._msgId));
    for(let i=(idx>=0?idx-1:messages.length-1);i>=0;i--){
      if(messages[i]?.role==='user' && String(messages[i].content||'').trim()) return String(messages[i].content||'').trim();
    }
  }catch(_){}
  return '';
}

function renderMsg(m){
  let thinkingHtml=renderThinkingPanel(m);
  let toolCallsHtml=renderToolCallsHtml(m.toolCalls, m);
  let toolArtifactCardsHtml=m.role==='assistant'?renderToolArtifactCardsHtml(m.toolCalls):'';
  let stepHtml='';
  if(m.step) stepHtml=`<div class="msg-step-indicator">Step ${m.step}</div>`;
  const msgId = m._msgId || String(m.ts || m.id || Date.now());
  if (!m._msgId) m._msgId = msgId;
  maybeResumeVideoPolling(m);
  // Clean content: remove model normalization warnings
  let content = cleanMessageContent(m.content || '');
  if(m.role==='assistant' && m.imageGeneration?.outputs?.length){
    content=m.imageGeneration.mediaType==='video'?generatedVideoMarkdown(m.imageGeneration.outputs, previousUserPromptForMessage(m)):generatedImageMarkdown(m.imageGeneration.outputs);
  }
  content = content.replace(/⚠️\s*Normalized model.*?for deepseek\.?\n?/g, '');
  content = content.replace(/⚠\s*Normalized model.*?for deepseek\.?\n?/g, '');
  // Strip raw <tool_call> XML tags and extract into structured tool calls
  if(m.role==='assistant') content = stripRawToolCallTags(content, m);
  const isLocalEditAssistant=m.role==='assistant' && !!m.localEditContextId;
  const isLocalEditCompletion=isLocalEditAssistant && !m._streaming;
  const localEditContextForAssistant=isLocalEditCompletion ? getLocalEditContextForAssistant(m) : null;
  let localEditCompletionHtml='';
  if(isLocalEditCompletion){
    localEditCompletionHtml=buildLocalEditCompletionHtml(m, localEditContextForAssistant);
    content='';
  }else if(m.role==='assistant' && m.localEditContextId && !m._streaming && !String(content||'').trim()){
    content = m.localEditApplied ? '已完成修改，右侧文档已更新。' : '已完成修改。';
  }

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
  let localEditActionHtml='';
  let fileCardsHtml='';
  let localEditCardHtml='';
  if(m.role==='assistant'&&typeof HermesArtifact!=='undefined'&&!isLocalEditAssistant){
    const p=HermesArtifact.parseHermesStream(content);
    let vis=(p.visibleText||'').trim();
    const mdCount=(p.completedArtifacts||[]).filter(a=>String(a?.attrs?.type||'markdown').toLowerCase()==='markdown').length;
    if(!vis&&(p.activeArtifact||(p.completedArtifacts||[]).length)){
      if(mdCount){
        const excerpts=(p.completedArtifacts||[]).filter(a=>String(a?.attrs?.type||'markdown').toLowerCase()==='markdown').map(a=>{
          const t=a.attrs?.title||'';
          const preview=String(a.content||'').replace(/<[^>]+>/g,'').replace(/```[\s\S]*?```/g,'').replace(/[#*`>\-]/g,'').trim().slice(0,100);
          return t?(t+'：'+preview):preview;
        }).filter(Boolean);
        vis=excerpts.length?excerpts.join('；')+'…':'已为你生成文档，可在右侧面板查看。';
      }else{
        vis='已为你生成文件，可在右侧面板或下方引用查看。';
      }
    }
    content=vis;
    artifactRefsHtml=buildArtifactRefHtml(p);
    fileCardsHtml=artifactRefsHtml?'':renderMarkdownFileCards(m);
    previewActionHtml=buildPreviewActionHtml(m.content||content);
    if(m.localEditContextId && !m._streaming){
    }
  }
  if(m.role==='user' && m.localEditContext){
    localEditCardHtml=renderLocalEditMessageCard(m.localEditContext,'chat-local-edit-card');
  }
  const modelBadge = '';
  const isLongUserMessage=m.role==='user' && (String(content||'').length>900 || String(content||'').split(/\r?\n/).length>14);
  const longClass=isLongUserMessage?' user-long-collapsed':'';
  const expandBtn=isLongUserMessage?`<button type="button" class="msg-expand-btn" onclick="toggleUserMessageExpand('${esc(msgId)}')">查看全部</button>`:'';
  // Streaming dots at bottom of content
  const imagePromptHtml = m.role==='assistant' && m.imageGeneration ? renderImagePromptPanel(m.imageGeneration) : '';
  const imageLoadingHtml = m.role==='assistant' && m._streaming && m.imageGeneration?.status==='loading' ? renderImageGenerationLoadingCard(m.imageGeneration) : '';
  const streamDots = m._streaming && !imageLoadingHtml ? '<span class="msg-streaming"><span></span><span></span><span></span></span>' : '';
  const msgFullDate=formatChatDate(m,'full');
  return `<div class="msg ${m.role} animate-in" id="msg_${msgId}" title="${esc(msgFullDate)}">
    <div class="msg-main">
      ${thinkingHtml}
      ${toolCallsHtml}
      <div class="msg-bubble markdown-body${longClass}">${localEditCardHtml}${stepHtml}${imageLoadingHtml}${imagePromptHtml}${localEditCompletionHtml}${content?formatMsg(content):''}${renderMessageAttachments(m.attachments)}${toolArtifactCardsHtml}${fileCardsHtml}${artifactRefsHtml}${previewActionHtml}${localEditActionHtml}${modelBadge}${streamDots}${expandBtn}</div>
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
  const expandedStore=window.__hermesThinkingExpanded instanceof Set ? window.__hermesThinkingExpanded : (window.__hermesThinkingExpanded=new Set());
  if(clicked&&!clicked.classList.contains('collapsed')) expandedStore.add(id);
  else expandedStore.delete(id);
}
function cleanMessageContent(raw){
  let content = redactSecrets(raw || '');
  content = content.replace(/(?:^|\n)\s*↻\s*Resumed session\s+[A-Za-z0-9_-]+\s*\(\d+\s+user messages?,\s*\d+\s+total messages?\)\s*(?=\n|$)/gi, '\n');
  content = content.replace(/(?:^|\n)\s*[^\w\n]{0,8}\s*Resumed session\s+[A-Za-z0-9_-]+\s*\(\d+\s+user messages?,\s*\d+\s+total messages?\)\s*(?=\n|$)/gi, '\n');
  content = content.replace(/(?:^|\n)\s*[^\w\n]{0,8}\s*(?:session_id|Session):\s*[A-Za-z0-9_-]+\s*(?=\n|$)/gi, '\n');
  content = content.replace(/⚠️\s*Normalized model.*?for deepseek\.?\n?/g, '');
  content = content.replace(/⚠\s*Normalized model.*?for deepseek\.?\n?/g, '');
  content = content.replace(/(?:^|\n)\s*(?:文件位置|本地路径)：[\s\S]*?(?=\n\s*\n|$)/g, '');
  content = content.replace(/(?:^|\n)\s*[-*]\s*(?:文件位置|本地路径)：?.*?(?=\n|$)/g, '');
  content = stripLocalEditDiffNoise(content);
  content = content.replace(/(?:^|\n)\s*[`|¦]?\s*r?eview diff\s*\n(?:\s*(?:[ab]\/{1,2}|[ab]\\|@@|diff --git|index\s|---\s|\+\+\+\s|[-+]\s).*(?:\n|$))+/gi, '\n').trim();
  content = content.replace(/```(?:diff|patch)[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?```/gi, '').trim();
  content = content.replace(/```(?:python|py)[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?```/gi, '').trim();
  content = content.replace(/(?:^|\n)\s*[`|¦]\s*review diff[\s\S]*?(?:api\/images\/generate|Generate image via Hermes WebUI)[\s\S]*?(?=\n\s*\n|$)/gi, '').trim();
  content = content.replace(/(?:^|\n)\s*[`|¦]?\s*review diff[\s\S]*?(?:\.\.\. omitted \d+ diff line\(s\)[^\n]*|(?=\n\s*<artifact\b)|$)/gi, '\n').trim();
  content = content.replace(/(?:^|\n)\s*(?:a\/mnt\/|b\/mnt\/|@@\s|[+]\s?#|[+]\s?>|[+]\s?\*\*\*|[+]\s?⚠)[\s\S]*?(?:\.\.\. omitted \d+ diff line\(s\)[^\n]*|(?=\n\s*<artifact\b)|$)/gi, '\n').trim();
  content = content.replace(/(?:^|\n)\s*\+\s*(?:import requests|URL\s*=|PAYLOAD\s*=|r\s*=|outputs\s*=|if outputs|for o in outputs)[\s\S]*?(?=\n\s*\n|$)/gi, '').trim();
  return content.trim();
}

function normalizeLocalEditPath(pathText){
  let text=String(pathText||'').trim();
  if(!text) return '';
  text=text.replace(/\\/g,'/');
  text=text.replace(/^([ab])\/{2,}/i,'$1/');
  text=text.replace(/^[ab]\//i,'');
  text=text.replace(/^\/mnt\/([a-z])\//i,(_,drive)=>drive.toUpperCase()+':/');
  return text;
}

function parseLocalEditDiffInfo(raw){
  const text=String(raw||'');
  const re=/(?:^|\n)\s*[`|¦]?\s*r?eview diff\s*\n\s*([ab]\/{1,2}[^\n]+?)\s*(?:→|->)\s*([ab]\/{1,2}[^\n]+?)(?=\n|$)/i;
  const match=re.exec(text);
  if(!match) return null;
  const before=normalizeLocalEditPath(match[1]);
  const after=normalizeLocalEditPath(match[2]);
  return { before, after, path: after || before };
}

function stripLocalEditDiffNoise(raw){
  return String(raw||'')
    .replace(/(?:^|\n)\s*(?:>\s*)?[`|¦]?\s*r?eview diff\s*\n[\s\S]*?(?=\n\s*(?:>\s*)?\*\*\s*编辑[前后]\s*[:：]?\s*\*\*|\n\s*<artifact\b|$)/gi, '\n')
    .replace(/(?:^|\n)\s*[`|¦]?\s*r?eview diff\s*\n(?:\s*(?:[ab]\/{1,2}|[ab]\\|@@|diff --git|index\s|---\s|\+\+\+\s|[-+]\s).*(?:\n|$))+/gi, '\n')
    .trim();
}

function localEditCompletionSummary(assistantMsg, localEditContext){
  const after=cleanLocalEditReplacement(assistantMsg?.content||'', { allowPlain:false }) || '';
  const original=String(localEditContext?.originalContent || localEditContext?.selectedText || '').trim();
  if(after && original){
    const beforePlain=original.replace(/\s+/g,' ').trim();
    const afterPlain=after.replace(/\s+/g,' ').trim();
    if(beforePlain && afterPlain && beforePlain !== afterPlain && beforePlain.length <= 42 && afterPlain.length <= 58){
      return `已完成修改：将“${beforePlain}”修改为“${afterPlain}”。`;
    }
    if(afterPlain.length <= 90) return `已完成修改：已将选中内容更新为“${afterPlain}”。`;
    return '已完成修改：已按你的要求优化选中内容，并更新到右侧文档。';
  }
  return assistantMsg?.localEditApplied ? '已完成修改，右侧文档已更新。' : '已完成修改。';
}

function renderLocalEditFileChip(pathText){
  const path=normalizeLocalEditPath(pathText);
  if(!path) return '';
  const label=shortFileName(path);
  return `<div class="local-edit-file-chip" title="${esc(path)}">`
    + `<span class="local-edit-file-icon">${FILE_LOCATION_ICON}</span>`
    + `<span class="local-edit-file-name">${esc(label)}</span>`
    + `</div>`;
}

function renderLocalEditCompletionFileCard(pathText, localEditContext){
  const path=normalizeLocalEditPath(pathText || localEditContext?.path || '');
  if(!path) return '';
  const label=shortFileName(path, localEditContext?.title);
  const lineLabel=getLineLabel(localEditContext?.lineStart, localEditContext?.lineEnd);
  const safePath=encodeURIComponent(path);
  const safeName=encodeURIComponent(label);
  return `<button type="button" class="artifact-ref-chip local-edit-file-card" title="${esc(path)}" onclick="event.stopPropagation(); if(typeof HermesArtifact!=='undefined') HermesArtifact.openHistoryFile('${safePath}', '${safeName}')">`
    + `<span class="artifact-ref-icon" aria-hidden="true">${FILE_LOCATION_ICON}</span>`
    + `<span class="artifact-ref-main">`
    + `<strong>${esc(label)}${lineLabel ? `<span class="local-edit-file-lines">${esc(lineLabel)}</span>` : ''}</strong>`
    + `<small class="local-edit-file-path">${esc(path)}</small>`
    + `</span>`
    + `<span class="artifact-ref-action">查看</span>`
    + `</button>`;
}

function buildLocalEditCompletionHtml(assistantMsg, localEditContext){
  const raw=String(assistantMsg?.content||'');
  const cleanRaw=stripLocalEditDiffNoise(raw);
  const diff=parseLocalEditDiffInfo(raw);
  const path=(diff&&diff.path) || localEditContext?.path || '';
  const summary=localEditCompletionSummary(assistantMsg, localEditContext);
  const comparison=hasLocalEditComparisonBlock(cleanRaw) ? renderLocalEditComparison(cleanRaw) : '';
  return `<div class="local-edit-completion">`
    + renderLocalEditCompletionFileCard(path, localEditContext)
    + `<p>${esc(summary)}</p>`
    + (comparison ? `<div class="local-edit-comparison">${comparison}</div>` : '')
    + `</div>`;
}

function getLocalEditContextForAssistant(msg){
  if(!msg?.localEditContextId) return null;
  const chat=currentChat();
  const messages=chat?.messages||[];
  const msgKey=getMessageKey(msg);
  const foundIndex=messages.findIndex(item=>item===msg || (msgKey && getMessageKey(item)===msgKey));
  const startIndex=foundIndex>=0 ? foundIndex-1 : messages.length-1;
  for(let i=startIndex;i>=0;i--){
    const item=messages[i];
    if(item?.localEditContext && (!msg.localEditContextId || item.localEditContext.id===msg.localEditContextId)){
      return item.localEditContext;
    }
  }
  return msg.localEditContext || null;
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

function stableMessageActionKey(msg){
  if(!msg) return '';
  if(!msg._actionKey) msg._actionKey = String(msg._msgId || msg.id || msg.ts || Date.now() + '_' + Math.random().toString(36).slice(2,8));
  return String(msg._actionKey);
}

function getLineLabel(lineStart, lineEnd){
  const start = Number(lineStart) || 0;
  const end = Number(lineEnd) || 0;
  if(!start) return '';
  return start === end || !end ? `L${start}` : `L${start}-${end}`;
}

function hasLocalEditComparisonBlock(content){
  const text=String(content||'');
  return /\*\*\s*编辑前\s*[:：]?\s*\*\*[\s\S]*?\*\*\s*编辑后\s*[:：]?\s*\*\*/i.test(text);
}

function extractLocalEditBlock(text, label, stopLabel){
  const value=String(text||'');
  const header=new RegExp('\\*\\*\\s*'+label+'\\s*[:：]?\\s*\\*\\*','i').exec(value);
  if(!header) return '';
  let tail=value.slice(header.index + header[0].length).trim();
  if(stopLabel){
    const stop=new RegExp('\\n\\s*\\*\\*\\s*'+stopLabel+'\\s*[:：]?\\s*\\*\\*','i').exec(tail);
    if(stop) tail=tail.slice(0, stop.index).trim();
  }
  const fenced=tail.match(/^```[^\n]*\n([\s\S]*?)\n```/);
  if(fenced) return fenced[1].trim();
  return tail.replace(/^```[^\n]*\n?|\n?```$/g,'').trim();
}

function renderLocalEditComparison(content){
  const before=extractLocalEditBlock(content,'编辑前','编辑后');
  const after=extractLocalEditBlock(content,'编辑后','编辑前');
  if(!before && !after) return formatMsg(content);
  return [
    before ? `<section class="local-edit-compare-block is-before"><p>编辑前：</p><pre>${esc(before)}</pre></section>` : '',
    after ? `<section class="local-edit-compare-block is-after"><p>编辑后：</p><pre>${esc(after)}</pre></section>` : ''
  ].join('');
}

function buildLocalEditComparisonBlock(beforeText, afterText){
  const before=String(beforeText||'').trim();
  const after=String(afterText||'').trim();
  if(!before || !after) return '';
  return [
    '',
    '**编辑前：**',
    '```md',
    before,
    '```',
    '',
    '**编辑后：**',
    '```md',
    after,
    '```'
  ].join('\n');
}

function extractLocalEditAfterBlock(text){
  return extractLocalEditBlock(text,'编辑后','编辑前');
}

async function appendLocalEditComparisonIfMissing(assistantMsg, localEditContext){
  if(!assistantMsg || !localEditContext || hasLocalEditComparisonBlock(assistantMsg.content)) return false;
  const before=localEditContext.originalContent || localEditContext.selectedText || '';
  const after=cleanLocalEditReplacement(assistantMsg.content || '');
  const block=buildLocalEditComparisonBlock(before, after);
  if(!block) return false;
  assistantMsg.content = String(assistantMsg.content || '').trimEnd() + '\n\n' + block.trim();
  return true;
}

function renderLocalEditMessageCard(ctx, extraClass=''){
  if(!ctx) return '';
  const fileLabel = ctx.path ? shortFileName(ctx.path) : (ctx.title || '当前文档');
  const lineLabel = getLineLabel(ctx.lineStart, ctx.lineEnd);
  const className = ['local-edit-card'];
  if(extraClass) className.push(extraClass);
  return `<div class="${className.join(' ')}">`
    + `<span class="local-edit-card-title" title="${esc(fileLabel)}">${esc(fileLabel)}</span>`
    + (lineLabel ? `<span class="local-edit-card-lines">${esc(lineLabel)}</span>` : '')
    + `</div>`;
}

function getMessageCopyPayload(msg){
  return { text: getMessageCopyText(msg), label: '\u5df2\u590d\u5236\u6d88\u606f' };
}

function makeTraceId(prefix='tr'){
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,8);
}

function getMessageDiagnosticsText(msg){
  const chat=currentChat();
  const messages=chat?.messages||[];
  const idx=messages.indexOf(msg);
  const userMsg=idx>0 ? [...messages.slice(0, idx)].reverse().find(item=>item?.role==='user') : null;
  const events=(Array.isArray(msg?.processEvents)?msg.processEvents:[]).slice(-10);
  const tools=(Array.isArray(msg?.toolCalls)?msg.toolCalls:[]).slice(-8);
  const eventSession=[...events].reverse().map(event=>event?.hermesSessionId||event?.sessionId||event?.session_id||'').find(Boolean);
  const rawSession=String(msg?.hermesSessionId||msg?.sessionId||eventSession||'').trim();
  const chatId=String(chat?.id||chat?._id||'');
  const hermesSessionId=rawSession && rawSession!==chatId ? rawSession : '';
  const lines=[
    'WebUI Diagnostic',
    'chatId: '+chatId,
    'chatTitle: '+String(chat?.title||''),
    'traceId: '+String(msg?.traceId||userMsg?.traceId||''),
    'userMsgId: '+String(msg?.userMsgId||userMsg?._msgId||''),
    'assistantMsgId: '+String(msg?._msgId||''),
    'hermesSessionId: '+hermesSessionId,
    'streaming: '+String(!!msg?._streaming),
    'error: '+String(msg?.error?true:false),
  ];
  if(events.length){
    lines.push('', 'processEvents:');
    events.forEach((event,i)=>lines.push((i+1)+'. '+processEventText(event)));
  }
  if(tools.length){
    lines.push('', 'toolCalls:');
    tools.forEach((tool,i)=>lines.push((i+1)+'. '+toolDisplayName(tool)+' ['+String(tool.status||'unknown')+'] '+String(tool.output||tool.preview||'').slice(0,180)));
  }
  const stderr=(events.map(event=>event?.stderrTail||event?.text||'').filter(Boolean).slice(-3).join('\n')||'').trim();
  if(stderr) lines.push('', 'stderrTail:', stderr.slice(0,800));
  return lines.join('\n');
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
  if(!msg) return '';
  if(msg.role !== 'assistant') return String(msg.content || '').trim();
  const data = getAssistantRenderData(msg);
  if (data.markdownArtifacts.length) return String(data.markdownArtifacts[0]?.content || data.visible || data.raw || '');
  return String(data.visible || data.raw || '');
}

function getMessageFeedbackValue(msg){
  return msg?.feedback?.value || msg?.feedback || '';
}

async function sendMessageFeedback(chatId, msgKey, feedback){
  const value = feedback === 'like' ? 'like' : feedback === 'dislike' ? 'dislike' : feedback === 'partial' ? 'partial' : '';
  if (!chatId || !msgKey || !value) return false;
  const data = await apiPost(`/api/chats/${encodeURIComponent(chatId)}/messages/feedback`, { msgId: msgKey, feedback: value });
  return Boolean(data);
}

function renderMessageActions(m){
  if (!m || m.role !== 'assistant') return '';
  const active = getMessageFeedbackValue(m);
  const key = getMessageKey(m);
  const actionKey = stableMessageActionKey(m);
  const chatId = esc(currentChat()?.id || currentChat()?._id || '');
  const likeActive = active === 'like' ? ' active' : '';
  const partialActive = active === 'partial' ? ' active' : '';
  const dislikeActive = active === 'dislike' ? ' active' : '';
  const msgTime = formatChatDate(m, 'full');
  return `<div class="msg-actions" data-msg-key="${esc(key)}">
    <button type="button" class="msg-action-btn" onclick="copyMessageContent('${esc(actionKey)}')" title="复制" aria-label="复制">${COPY_ICON}</button>
    <button type="button" class="msg-action-btn" onclick="copyMessageDiagnostics('${esc(actionKey)}')" title="\u590d\u5236\u8bca\u65adID" aria-label="\u590d\u5236\u8bca\u65adID">ID</button>
    <button type="button" class="msg-action-btn like-action${likeActive}" onclick="setMessageFeedback('${chatId}','${esc(key)}','like')" title="有用" aria-label="有用">${likeActive ? LIKE_FILLED_ICON : LIKE_ICON}</button>
    <button type="button" class="msg-action-btn dislike-action${dislikeActive}" onclick="setMessageFeedback('${chatId}','${esc(key)}','dislike')" title="没用" aria-label="没用">${dislikeActive ? DISLIKE_FILLED_ICON : DISLIKE_ICON}</button>
    <button type="button" class="msg-action-btn partial-action${partialActive}" onclick="setMessageFeedback('${chatId}','${esc(key)}','partial')" title="部分有用" aria-label="部分有用">${partialActive ? PARTIAL_FILLED_ICON : PARTIAL_ICON}</button>
    <span class="msg-action-time" title="${esc(msgTime)}">${esc(msgTime)}</span>
  </div>`;
}

async function copyMessageContent(actionKey){
  const chat=currentChat();
  const msg=(chat?.messages||[]).find(item=>stableMessageActionKey(item)===String(actionKey));
  if(!msg){
    toast('\u6ca1\u6709\u627e\u5230\u53ef\u590d\u5236\u7684\u6d88\u606f','warning');
    return;
  }
  const payload=getMessageCopyPayload(msg);
  if(!String(payload.text||'').trim()){
    toast('\u8fd9\u6761\u6d88\u606f\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9','warning');
    return;
  }
  copyText(payload.text, payload.label || '\u5df2\u590d\u5236\u6d88\u606f');
}

async function copyMessageDiagnostics(actionKey){
  const chat=currentChat();
  const msg=(chat?.messages||[]).find(item=>stableMessageActionKey(item)===String(actionKey));
  if(!msg){
    toast('\u6ca1\u6709\u627e\u5230\u8bca\u65ad\u4fe1\u606f','warning');
    return;
  }
  copyText(getMessageDiagnosticsText(msg), '\u5df2\u590d\u5236\u8bca\u65adID');
}

async function setMessageFeedback(chatId, msgKey, feedback){
  const chat=currentChat();
  if (!chat || String(chat.id || chat._id || '') !== String(chatId || '')) return;
  const msg=(chat.messages||[]).find(item=>getMessageKey(item)===String(msgKey));
  if (!msg || msg.role !== 'assistant') return;
  msg.feedback = { value: feedback === 'like' ? 'like' : feedback === 'dislike' ? 'dislike' : feedback === 'partial' ? 'partial' : '', updatedAt: Date.now() };
  save();
  renderPage();
  sendMessageFeedback(chatId, msgKey, feedback).catch(()=>{});
}

const COPY_ICON=namedSvg('复制',15,'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>');
const LIKE_ICON=namedSvg('赞',18,'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7.25 10.25V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.25 10.25L10.2 4.9C10.7 4 12 4.35 12 5.38V8.25H17.7C19.02 8.25 20.02 9.44 19.79 10.74L18.66 17.24C18.48 18.25 17.6 19 16.57 19H9.3C8.17 19 7.25 18.08 7.25 16.95V10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.2 10.25H7.25V19H4.2C3.54 19 3 18.46 3 17.8V11.45C3 10.79 3.54 10.25 4.2 10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
const DISLIKE_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g transform="rotate(180 12 12)"><path d="M7.25 10.25V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.25 10.25L10.2 4.9C10.7 4 12 4.35 12 5.38V8.25H17.7C19.02 8.25 20.02 9.44 19.79 10.74L18.66 17.24C18.48 18.25 17.6 19 16.57 19H9.3C8.17 19 7.25 18.08 7.25 16.95V10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.2 10.25H7.25V19H4.2C3.54 19 3 18.46 3 17.8V11.45C3 10.79 3.54 10.25 4.2 10.25Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
const PARTIAL_ICON=namedSvg('部分有用',15,'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>');
const LIKE_FILLED_ICON=LIKE_ICON;
const DISLIKE_FILLED_ICON=DISLIKE_ICON;
const PARTIAL_FILLED_ICON=PARTIAL_ICON;
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
      if(wrapper.scrollWidth>Math.ceil(wrapper.clientWidth) && Math.abs(event.deltaX)>0) return;
      const scroller=wrapper.closest('.messages-area,.artifact-body,.artifact-history,.modal') || document.scrollingElement;
      if(!scroller || scroller===wrapper) return;
      scroller.scrollTop += event.deltaY;
    },{passive:true});
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
    if(img.dataset.issueBound!=='1'){
      img.dataset.issueBound='1';
      img.addEventListener('error',()=>{
        if(typeof autoReportWebuiIssue==='function') autoReportWebuiIssue('image_load_error','\u56fe\u7247\u52a0\u8f7d\u5931\u8d25', { severity:'medium', context:{ src, alt } });
      }, { once:true });
    }
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

function openVideoPreview(src,title='\u89c6\u9891',prompt=''){
  const safeSrc=esc(mediaUrl(src));
  const safeTitle=esc(title||'\u89c6\u9891');
  const safePrompt=esc(prompt||'');
  const downloadName=(safeTitle||'video').replace(/[\\/:*?"<>|]+/g,'_');
  const promptHtml=prompt ? '<div class="chat-image-lightbox-prompt video-lightbox-prompt"><div>'+safePrompt+'</div><button type="button" onclick="event.stopPropagation();copyText(this.previousElementSibling.textContent,\'\u63d0\u793a\u8bcd\u5df2\u590d\u5236\')">\u590d\u5236\u63d0\u793a\u8bcd</button></div>' : '';
  openModal('<div class="chat-image-lightbox video-lightbox" onclick="closeModal()">' +
    '<button class="image-lightbox-close" onclick="event.stopPropagation();closeModal()" aria-label="\u5173\u95ed">'+SVG.x+'</button>' +
    '<div class="chat-image-lightbox-stage video-lightbox-stage" onclick="event.stopPropagation()">' +
      '<div class="video-lightbox-player-wrap"><video controls autoplay playsinline src="'+safeSrc+'"></video>' +
        '<div class="video-lightbox-actions">' +
          '<button type="button" class="video-lightbox-fullscreen" aria-label="\u5168\u5c4f\u64ad\u653e" title="\u5168\u5c4f\u64ad\u653e"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg></button>' +
          '<a href="'+safeSrc+'" download="'+downloadName+'" onclick="event.stopPropagation()" aria-label="\u4e0b\u8f7d\u89c6\u9891" title="\u4e0b\u8f7d\u89c6\u9891"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg></a>' +
        '</div></div>' +
      '<div class="video-lightbox-title">'+safeTitle+'</div>' +
      promptHtml +
    '</div>' +
  '</div>',{className:'image-lightbox-shell video-lightbox-shell'});
}

function requestVideoFullscreen(trigger){
  const stage=trigger?.closest?.('.video-lightbox-stage,.video-preview-wrap')||document;
  const video=stage.querySelector?.('video');
  const target=video||stage;
  if(target?.requestFullscreen) target.requestFullscreen().catch(()=>{});
  else if(target?.webkitRequestFullscreen) target.webkitRequestFullscreen();
}

window.openVideoPreview=openVideoPreview;
window.requestVideoFullscreen=requestVideoFullscreen;
if(typeof document!=='undefined' && !window.__hermesVideoPreviewBound){
  window.__hermesVideoPreviewBound=true;
  document.addEventListener('click',(event)=>{
    const fullscreenBtn=event.target?.closest?.('.video-lightbox-fullscreen,.video-card-expand');
    if(fullscreenBtn){ event.preventDefault(); event.stopPropagation(); requestVideoFullscreen(fullscreenBtn); return; }
    if(event.target?.closest?.('.video-card-download')) return;
    if(event.target?.closest?.('.video-preview-stage video')) return;
    const stage=event.target?.closest?.('.video-preview-stage');
    if(!stage) return;
    event.preventDefault();
    const wrap=stage.closest('.video-preview-wrap');
    openVideoPreview(wrap?.dataset.videoSrc||stage.dataset.videoSrc||'',wrap?.dataset.videoTitle||stage.dataset.videoTitle||'\u89c6\u9891',wrap?.dataset.videoPrompt||stage.dataset.videoPrompt||'');
  });
}

function openImagePreview(src,alt='图片'){
  const safeSrc=esc(mediaUrl(src));
  const record=imageRecordForSrc(src);
  const prompt=record ? (record.prompt || record.sourcePrompt || '') : '';
  const promptHtml=prompt ? `<div class="chat-image-lightbox-prompt"><div>${esc(prompt)}</div><button type="button" onclick="event.stopPropagation();copyText(this.previousElementSibling.textContent,'提示词已复制')">复制提示词</button></div>` : '';
  openModal(`<div class="chat-image-lightbox" onclick="closeModal()">
    <button class="image-lightbox-close" onclick="event.stopPropagation();closeModal()" aria-label="关闭">${SVG.x}</button>
    <div class="chat-image-lightbox-stage" onclick="event.stopPropagation()">
      <img src="${safeSrc}" alt="${esc(alt||'图片')}" onclick="toggleImageZoom(this,event)">
      ${promptHtml}
    </div>
  </div>`,{className:'image-lightbox-shell'});
}

function currentChat(){return state.chats.find(c=>c.id===state.currentChat)}
function currentChatFull(){return state.chatFullData[state.currentChat]}
function isCliChat(c){
  return !!c && (((c.source||'').toLowerCase()==='cli') || sourceTagClass(c.source||'')==='terminal' || c.readOnly);
}
function isFixedAgentMainChat(c){
  return !!c && !isCliChat(c) && (c.isMainAgentChat || c.chatType === 'main');
}
function isDefaultWebChat(c){
  return !!c && !isCliChat(c) && !isFixedAgentMainChat(c);
}
function visibleSessionChats(){
  return state.chats.filter(c => isCliChat(c) || isDefaultWebChat(c));
}

function compactMessageText(value){
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function imageIdSet(imageGeneration){
  const ids = [
    ...((imageGeneration?.outputs || []).map(item => item?.id || item?.url || item?.publicUrl)),
    ...((imageGeneration?.inputs || []).map(item => item?.id || item?.url || item?.publicUrl)),
  ].filter(Boolean).map(String);
  return new Set(ids);
}

function messageRichScore(msg){
  if(!msg) return 0;
  let score = 0;
  if(msg.localEditContextId) score += 8;
  if(msg.localEditApplied) score += 6;
  if(msg.localEditContext) score += 5;
  if(Array.isArray(msg.imageGeneration?.outputs) && msg.imageGeneration.outputs.length) score += 8 + msg.imageGeneration.outputs.length;
  if(Array.isArray(msg.imageGeneration?.inputs) && msg.imageGeneration.inputs.length) score += 3 + msg.imageGeneration.inputs.length;
  if(Array.isArray(msg.toolCalls) && msg.toolCalls.length) score += 3 + msg.toolCalls.length;
  if(Array.isArray(msg.processEvents) && msg.processEvents.length) score += 2;
  if(Array.isArray(msg.attachments) && msg.attachments.length) score += 2 + msg.attachments.length;
  if(msg.promptDebug) score += 2;
  if(msg.thinking || msg.reasoning) score += 1;
  return score;
}

function sameImageGeneration(a,b){
  const left = imageIdSet(a?.imageGeneration);
  const right = imageIdSet(b?.imageGeneration);
  if(!left.size || !right.size) return false;
  for(const id of left) if(right.has(id)) return true;
  return false;
}

function findLocalMessageMatch(serverMsg, localMessages, used, index){
  const serverId = String(serverMsg?._msgId || serverMsg?.id || '');
  if(serverId){
    const exact = localMessages.findIndex((msg,i) => !used.has(i) && String(msg?._msgId || msg?.id || '') === serverId);
    if(exact >= 0) return exact;
  }
  if(serverMsg?.localEditContextId){
    const localEdit = localMessages.findIndex((msg,i) => !used.has(i) && msg?.role === serverMsg.role && String(msg?.localEditContextId || '') === String(serverMsg.localEditContextId));
    if(localEdit >= 0) return localEdit;
  }
  if(serverMsg?.imageGeneration){
    const image = localMessages.findIndex((msg,i) => !used.has(i) && msg?.role === serverMsg.role && sameImageGeneration(serverMsg,msg));
    if(image >= 0) return image;
  }
  const text = compactMessageText(serverMsg?.content || '');
  if(text){
    const byContent = localMessages.findIndex((msg,i) => !used.has(i) && msg?.role === serverMsg.role && compactMessageText(msg?.content || '') === text);
    if(byContent >= 0) return byContent;
  }
  const localAtIndex = localMessages[index];
  if(localAtIndex && !used.has(index) && localAtIndex.role === serverMsg?.role) return index;
  const serverTs = Number(serverMsg?.ts || 0);
  if(serverTs){
    const byTime = localMessages.findIndex((msg,i) => !used.has(i) && msg?.role === serverMsg.role && Math.abs(Number(msg?.ts || 0) - serverTs) < 10000);
    if(byTime >= 0) return byTime;
  }
  return -1;
}

function mergeMessageRecord(serverMsg={}, localMsg=null){
  if(!localMsg) return { ...serverMsg };
  const merged = { ...serverMsg };
  if(!merged._msgId && localMsg._msgId) merged._msgId = localMsg._msgId;
  if(localMsg._actionKey) merged._actionKey = localMsg._actionKey;
  if(localMsg._streaming) merged._streaming = true;
  const richFields = ['localEditContext','localEditContextId','localEditApplied','localEditAppliedAt','localEditApplyError','imageGeneration','attachments','toolCalls','processEvents','promptDebug','thinking','reasoning','feedback'];
  for(const field of richFields){
    const localValue = localMsg[field];
    if(localValue === undefined || localValue === null) continue;
    const serverValue = merged[field];
    const serverEmptyArray = Array.isArray(serverValue) && !serverValue.length;
    const localArray = Array.isArray(localValue);
    if(serverValue === undefined || serverValue === null || serverEmptyArray || field === 'feedback'){
      merged[field] = localArray ? [...localValue] : (typeof localValue === 'object' ? { ...localValue } : localValue);
    }
  }
  if(localMsg.imageGeneration && merged.imageGeneration){
    merged.imageGeneration = { ...merged.imageGeneration, ...localMsg.imageGeneration };
    if(Array.isArray(localMsg.imageGeneration.outputs) && localMsg.imageGeneration.outputs.length) merged.imageGeneration.outputs = localMsg.imageGeneration.outputs;
    if(Array.isArray(localMsg.imageGeneration.inputs) && localMsg.imageGeneration.inputs.length) merged.imageGeneration.inputs = localMsg.imageGeneration.inputs;
  }
  const localContent = String(localMsg.content || '');
  const serverContent = String(merged.content || '');
  const preferLocalContent = localContent && (
    !serverContent
    || localMsg._streaming
    || localMsg.localEditContextId
    || localMsg.localEditApplied
    || (localMsg.imageGeneration?.outputs || []).length
    || messageRichScore(localMsg) > messageRichScore(serverMsg)
  );
  if(preferLocalContent) merged.content = localContent;
  return merged;
}

function mergeChatMessages(serverMessages=[], localMessages=[]){
  const serverList = Array.isArray(serverMessages) ? serverMessages : [];
  const localList = Array.isArray(localMessages) ? localMessages : [];
  const used = new Set();
  const merged = serverList.map((msg,index) => {
    const match = findLocalMessageMatch(msg, localList, used, index);
    if(match >= 0){
      used.add(match);
      return mergeMessageRecord(msg, localList[match]);
    }
    return { ...msg };
  });
  localList.forEach((msg,index) => {
    if(used.has(index)) return;
    if(msg?._streaming || msg?.localEditContextId || msg?.localEditContext || msg?.imageGeneration || messageRichScore(msg) > 0){
      merged.push({ ...msg });
    }
  });
  return merged;
}

function applySyncedChatData(chatId,data){
  if(!data || !data.id) return null;
  const idx=state.chats.findIndex(c=>c.id===chatId);
  const existing=idx>=0 ? state.chats[idx] : null;
  const cached=state.chatFullData[chatId] || {};
  const localMessages=existing?.messages || cached.messages || [];
  const mergedMessages=mergeChatMessages(data.messages || [], localMessages);
  const nextData={ ...data, messages: mergedMessages };
  if(idx>=0){
    state.chats[idx]={
      ...state.chats[idx],
      title:data.title || state.chats[idx].title,
      updatedAt:data.updatedAt || state.chats[idx].updatedAt,
      createdAt:data.createdAt || state.chats[idx].createdAt,
      preview:data.preview || state.chats[idx].preview,
      readOnly:!!data.readOnly,
      source:data.source || state.chats[idx].source,
      agentId:data.agentId || state.chats[idx].agentId || '',
      agentName:data.agentName || state.chats[idx].agentName || '',
      chatType:data.chatType || state.chats[idx].chatType || (data.isMainAgentChat ? 'main' : 'task'),
      isMainAgentChat:!!(data.isMainAgentChat || state.chats[idx].isMainAgentChat),
      messages:mergedMessages,
      messageCount:Math.max(data.messageCount || 0, mergedMessages.length),
      _model:data.model || state.chats[idx]._model || state.model.model,
    };
    state.chats[idx].messages.forEach(m => { if(m.role === 'assistant') m._model = state.chats[idx]._model; });
  }
  state.chatFullData[chatId]=nextData;
  return nextData;
}

async function persistAssistantMessageState(chatId,msg){
  if(!chatId || !msg || msg.role !== 'assistant') return false;
  const msgId=getMessageKey(msg);
  if(!msgId) return false;
  const payload={
    content:msg.content || '',
    thinking:msg.thinking || '',
    reasoning:msg.reasoning || '',
    localEditContextId:msg.localEditContextId || undefined,
    localEditApplied:msg.localEditApplied,
    localEditAppliedAt:msg.localEditAppliedAt,
    localEditApplyError:msg.localEditApplyError || undefined,
    imageGeneration:msg.imageGeneration || undefined,
    toolCalls:msg.toolCalls || undefined,
    processEvents:msg.processEvents || undefined,
    promptDebug:msg.promptDebug || undefined,
    feedback:msg.feedback || undefined,
  };
  Object.keys(payload).forEach(key=>payload[key]===undefined && delete payload[key]);
  const updated=await apiPatch(`/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(msgId)}`, payload);
  if(!updated) return false;
  const chat=state.chats.find(c=>String(c.id||c._id||'')===String(chatId));
  const messages=chat?.messages || state.chatFullData[chatId]?.messages || [];
  const index=messages.findIndex(item=>getMessageKey(item)===msgId);
  if(index>=0) messages[index]=mergeMessageRecord(updated,messages[index]);
  if(chat) chat.messages=messages;
  state.chatFullData[chatId]={...(state.chatFullData[chatId]||{}),id:chatId,messages};
  return true;
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
  if(state.currentChat===id) state.currentChat=visibleSessionChats().sort(compareChatCreatedDesc)[0]?.id||null;
  if(!silent) toast(cli?'已从 WebUI 隐藏该终端会话':'已删除', 'info');
  return true;
}

async function syncCurrentChat(chatId){
  try{
    const c=state.chats.find(x=>x.id===chatId);
    const endpoint=isCliChat(c)?'/api/cli/sessions/':'/api/chats/';
    const data=await apiGet(endpoint+encodeURIComponent(chatId));
    if(data&&data.id){
      applySyncedChatData(chatId,data);
      state.chats.sort(compareChatCreatedDesc);
      const sessionItems=$('#sessionItems');
      if(sessionItems) sessionItems.innerHTML=renderSessionList();
    }
  }catch(e){}
}

async function newChat(profileArg, options={}){
  const profile=normalizeProfile(profileArg||getActiveProfile());
  const payload={...agentChatPayload(profile),...(options||{})};
  const data = await apiPost('/api/chats', payload);
  if (data) {
    state.chats.push({ id: data.id, title: data.title, source:data.source||'WebUI', messages: [], updatedAt: data.updatedAt, createdAt:data.createdAt, agentId: data.agentId||profile?.id||'', agentName:data.agentName||profile?.name||'', agentSnapshot:data.agentSnapshot, lockedAgent:true, chatType:data.chatType||options.chatType||'task', isMainAgentChat:!!(data.isMainAgentChat||options.isMainAgentChat) });
    state.chatFullData[data.id] = data;
    state.currentChat = data.id;
    state._artifactNeedsHydrate = true;
  } else {
    const c = { id: 'c'+Date.now(), title: options.title||'新建对话', source:'WebUI', messages: [], updatedAt: Date.now(), createdAt:Date.now(), agentId: profile?.id||'', agentName:profile?.name||'', agentSnapshot:agentSnapshotForProfile(profile), lockedAgent:true, chatType:options.chatType||'task', isMainAgentChat:!!options.isMainAgentChat };
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
  const artifactCtx=typeof HermesArtifact !== 'undefined' && typeof HermesArtifact.getCurrentMarkdownContext === 'function'
    ? HermesArtifact.getCurrentMarkdownContext()
    : null;
  const keepArtifactOpen=!!(artifactShell && (
    (artifactHistory && getComputedStyle(artifactHistory).display!=='none')
    || artifactCtx?.path
  ));
  state.currentChat = id;
  state._artifactNeedsHydrate = !keepArtifactOpen;
  if (typeof HermesArtifact !== 'undefined') {
    try {
      if (!keepArtifactOpen) { HermesArtifact.resetSession(); HermesArtifact.setLayout('chat'); }
    } catch (_) {}
  }
  // Load full chat data from backend if not cached
  if (!state.chatFullData[id]) {
    // Check if this is a CLI session or WebUI chat
    const c = state.chats.find(x => x.id === id);
    const cliChat=isCliChat(c);
    const endpoint = cliChat ? '/api/cli/sessions/' : '/api/chats/';
    const data = await apiGet(endpoint + encodeURIComponent(id));
    if (data) {
      applySyncedChatData(id,data);
    }
  }
  const selected=state.chats.find(x=>x.id===id);
  const agentId=selected?.agentId||state.chatFullData[id]?.agentId||'';
  if(agentId && isFixedAgentMainChat(selected)){
    const p=getProfiles().find(x=>x.id===agentId&&x.enabled!==false);
    if(p) state.activeProfile=p.id;
  } else if(isDefaultWebChat(selected)){
    state.activeProfile='default';
  }
  if(keepArtifactOpen){
    refreshChatWithoutArtifact();
  }else{
    renderPage();
  }
  requestAnimationFrame(()=>{
    const list=$('#sessionItems');
    if(list) list.scrollTop=sessionScrollTop;
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


function isWebuiImageToolName(name=''){
  const value=String(name||'').toLowerCase();
  return value==='webui_image_generate' || value.endsWith('_webui_image_generate') || value.includes('webui_image_generate');
}

function isWebuiVideoToolName(name=''){
  const value=String(name||'').toLowerCase();
  return value==='webui_video_generate' || value.endsWith('_webui_video_generate') || value.includes('webui_video_generate');
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

function imageGenerationElapsedMs(imageGeneration={}){
  const startedAt=Number(imageGeneration.startedAt||imageGeneration.startedAtMs||0);
  if(!startedAt) return Number(imageGeneration.elapsedMs||imageGeneration.duration||0)||0;
  const now=Date.now();
  return Math.max(0, Number(imageGeneration.elapsedMs||0)||now-startedAt);
}

function formatImageGenerationElapsed(imageGeneration={}){
  const ms=imageGenerationElapsedMs(imageGeneration);
  if(!ms) return '';
  const seconds=Math.max(0, Math.floor(ms/1000));
  const mins=Math.floor(seconds/60);
  const secs=seconds%60;
  return mins ? `${mins}:${String(secs).padStart(2,'0')}` : `${secs}s`;
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
function videoPromptForItem(vid={}){
  return String(vid.prompt||vid.sourcePrompt||'').trim();
}

function formatVideoCreatedAt(value){
  const n=Number(value||0);
  if(!Number.isFinite(n)||n<=0) return '';
  try{
    return new Date(n).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(/\//g,'-');
  }catch(_){ return ''; }
}

function generatedVideoMarkdown(videos=[],fallbackPrompt=''){
  return (videos||[]).map((vid,index)=>{
    const src=imageSrc(vid);
    if(!src) return '';
    const title=vid.name||vid.filename||('\u751f\u6210\u89c6\u9891 '+(index+1));
    const prompt=videoPromptForItem(vid)||String(fallbackPrompt||'').trim();
    const timeLabel=formatVideoCreatedAt(vid.createdAt);
    const safeSrc=esc(src);
    const safeTitle=esc(title);
    const safePrompt=esc(prompt);
    const safeTime=esc(timeLabel);
    return '<div class="video-preview-wrap" data-video-src="'+safeSrc+'" data-video-title="'+safeTitle+'" data-video-prompt="'+safePrompt+'">'
      + '<div class="video-preview-stage" data-video-src="'+safeSrc+'" data-video-title="'+safeTitle+'" data-video-prompt="'+safePrompt+'">'
      + '<video preload="metadata" controls playsinline src="'+safeSrc+'"></video>'
      + (timeLabel?'<div class="video-preview-time">'+safeTime+'</div>':'')
      + '</div>'
      + '<div class="video-preview-meta"><span class="video-preview-title">'+safeTitle+'</span></div>'
      + '</div>';
  }).filter(Boolean).join('\n\n');
}

function generatedImageMarkdown(images=[]){
  return images.map(img=>`![${img.name||'生成图片'}](${imageSrc(img)})`).join('\n\n');
}

function generatedImageMessageContent(imageGeneration={}){
  const imageMd=generatedImageMarkdown(imageGeneration.outputs||[]);
  const prompt=cleanImagePromptForDisplay(imageGeneration.optimizedPrompt||imageGeneration.prompt||'');
  const label=String(imageGeneration.mode||'').startsWith('image-to-image')?'图生图提示词':'图像提示词';
  const promptText=prompt?`${label}：\n${prompt}\n\n`:'';
  return `图片已生成\n\n${promptText}${imageMd}`.trim();
}

function parseWebuiImageToolResult(value){
  const raw=String(value||'').trim();
  if(!raw || !raw.includes('webui_image_generate_result')) return null;
  const candidates=[raw];
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fenced) candidates.push(fenced[1].trim());
  const jsonMatch=raw.match(/\{[\s\S]*"webui_image_generate_result"[\s\S]*\}/);
  if(jsonMatch) candidates.push(jsonMatch[0]);
  for(const item of candidates){
    try{
      const data=JSON.parse(item);
      if(data?.type==='webui_image_generate_result' || (data?.success===true && Array.isArray(data?.outputs))){
        return data;
      }
    }catch(_){}
  }
  return null;
}

function applyWebuiImageToolResult(msg,result){
  if(!msg||!result||!Array.isArray(result.outputs)||!result.outputs.length) return false;
  msg.imageGeneration={
    ...(msg.imageGeneration||{}),
    status:'done',
    model:result.model||msg.imageGeneration?.model||'',
    provider:result.provider||msg.imageGeneration?.provider||'',
    outputs:result.outputs||[],
    inputs:result.inputs||[],
    prompt:result.prompt||msg.imageGeneration?.prompt||'',
    sourcePrompt:result.sourcePrompt||msg.imageGeneration?.sourcePrompt||'',
    optimizedPrompt:result.prompt||msg.imageGeneration?.optimizedPrompt||'',
    mode:result.mode||msg.imageGeneration?.mode||'',
    optimizedByAgent:!!result.optimizedByAgent,
    directMode:false
  };
  msg.content=generatedImageMessageContent(msg.imageGeneration)||result.content||result.markdown||'\u5df2\u751f\u6210\u56fe\u7247\u3002';
  return true;
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


function parseVideoPendingText(value){
  const raw=String(value||'');
  const taskId=(raw.match(/task_[A-Za-z0-9]+/)||[])[0]||'';
  if(!taskId) return null;
  if(!/(queued|pending|video task submitted|\u6392\u961f|\u89c6\u9891\u4efb\u52a1\u5df2\u63d0\u4ea4|\u751f\u6210\u5b8c\u6210\u540e|\u751f\u6210\u4e2d)/i.test(raw)) return null;
  const model=(raw.match(/(?:\u6a21\u578b|model)[:?]\s*([^\n]+)/i)||[])[1]||'auto';
  return {success:true,type:'webui_video_generate_result',taskId,status:'pending',taskStatus:'queued',outputs:[],model:String(model).trim(),content:raw};
}
function parseWebuiVideoToolResult(value){
  const raw=String(value||'').trim();
  if(!raw || !raw.includes('webui_video_generate_result')) return null;
  const candidates=[raw];
  const fenced=raw.match(new RegExp('```(?:json)?\\s*([\\s\\S]*?)```','i'));
  if(fenced) candidates.push(fenced[1].trim());
  const jsonMatch=raw.match(/\{[\s\S]*"webui_video_generate_result"[\s\S]*\}/);
  if(jsonMatch) candidates.push(jsonMatch[0]);
  for(const item of candidates){
    try{
      const data=JSON.parse(item);
      if(data?.type==='webui_video_generate_result' || (data?.success===true && (Array.isArray(data?.outputs)||data?.videoUrl))){
        return data;
      }
    }catch(_){}
  }
  return null;
}
function maybeResumeVideoPolling(msg){
  if(!msg || msg.role!=='assistant') return;
  let gen=msg.imageGeneration||{};
  if((!gen.taskId || gen.mediaType!=='video') && msg.role==='assistant'){
    const pending=parseVideoPendingText(msg.content||'');
    if(pending){
      msg.imageGeneration={...(gen||{}),status:'loading',mediaType:'video',taskId:pending.taskId,taskStatus:pending.taskStatus,model:pending.model||gen.model||'auto',prompt:gen.prompt||'',sourcePrompt:gen.sourcePrompt||'',outputs:[]};
      gen=msg.imageGeneration;
    }
  }
  if(gen.mediaType==='video' && gen.status==='loading' && gen.taskId && !msg._videoTaskPolling){
    setTimeout(()=>pollWebuiVideoTask(msg,{taskId:gen.taskId,model:gen.model||'auto',prompt:gen.prompt||'',sourcePrompt:gen.sourcePrompt||''}),100);
  }
}

async function pollWebuiVideoTask(msg,result){
  const taskId=String(result?.taskId||msg?.imageGeneration?.taskId||'').trim();
  if(!msg||!taskId||msg._videoTaskPolling) return;
  msg._videoTaskPolling=true;
  const started=Date.now();
  try{
    for(let i=0;i<60;i++){
      await new Promise(resolve=>setTimeout(resolve,i?10000:3000));
      const data=await apiGet('/api/images/video/task/'+encodeURIComponent(taskId)+'?model='+encodeURIComponent(result?.model||'auto')+'&publicBase='+encodeURIComponent(publicApiBase())+'&prompt='+encodeURIComponent(result?.prompt||'')+'&sourcePrompt='+encodeURIComponent(result?.sourcePrompt||''));
      if(!data) continue;
      const status=String(data.status||'').toLowerCase();
      const outputs=Array.isArray(data.outputs)?data.outputs:[];
      msg.imageGeneration={
        ...(msg.imageGeneration||{}),
        status:outputs.length?'done':'loading',
        mediaType:'video',
        taskId,
        taskStatus:status||msg.imageGeneration?.taskStatus||'queued',
        outputs,
        prompt:msg.imageGeneration?.prompt||result?.prompt||'',
        sourcePrompt:msg.imageGeneration?.sourcePrompt||result?.sourcePrompt||'',
        model:data.raw?.model||result?.model||msg.imageGeneration?.model||'',
        provider:result?.provider||msg.imageGeneration?.provider||'',
        loadingText:'\u89c6\u9891\u751f\u6210\u4e2d\uff0c\u5df2\u7b49\u5f85 '+Math.floor((Date.now()-started)/1000)+' \u79d2',
      };
      if(outputs.length){
        msg._streaming=false;
        msg.content=generatedVideoMarkdown(outputs, msg.imageGeneration?.prompt||msg.imageGeneration?.sourcePrompt||'')||'\u89c6\u9891\u5df2\u751f\u6210\u3002';
        if(typeof HermesArtifact!=='undefined'&&typeof HermesArtifact.refreshImageWaterfall==='function') HermesArtifact.refreshImageWaterfall({rescan:true,silent:true}).catch(()=>{});
        renderMsgUpdate(msg._msgId||msg.id||msg.ts,msg);
        try{ persistAssistantMessageState(currentChat()?.id||currentChat()?._id,msg).catch(()=>{}); }catch(_){}
        toast('?????','success');
        return;
      }
      if(['failed','error','cancelled','canceled'].includes(status)){
        msg._streaming=false;
        msg.content='\u89c6\u9891\u751f\u6210\u5931\u8d25\uff1a'+(data.raw?.error?.message||data.raw?.error||status);
        renderMsgUpdate(msg._msgId||msg.id||msg.ts,msg);
        return;
      }
      renderMsgUpdate(msg._msgId||msg.id||msg.ts,msg);
    }
    msg._streaming=false;
    msg.content='\u89c6\u9891\u4efb\u52a1\u4ecd\u5728\u6392\u961f\u4e2d\uff0c\u4efb\u52a1ID\uff1a'+taskId+'\u3002\u7a0d\u540e\u53ef\u5728\u8f93\u51fa\u56fe\u7247/\u89c6\u9891\u9762\u677f\u5237\u65b0\u67e5\u770b\u3002';
    renderMsgUpdate(msg._msgId||msg.id||msg.ts,msg);
  }finally{
    msg._videoTaskPolling=false;
  }
}

function applyWebuiVideoToolResult(msg,result){
  if(!msg||!result) return false;
  const outputs=Array.isArray(result.outputs)?result.outputs:[];
  const taskId=String(result.taskId||'').trim();
  msg.imageGeneration={
    ...(msg.imageGeneration||{}),
    status:outputs.length?'done':'loading',
    mediaType:'video',
    model:result.model||msg.imageGeneration?.model||'',
    provider:result.provider||msg.imageGeneration?.provider||'',
    outputs,
    inputs:result.inputs||[],
    prompt:result.prompt||msg.imageGeneration?.prompt||'',
    sourcePrompt:result.sourcePrompt||msg.imageGeneration?.sourcePrompt||'',
    optimizedPrompt:result.prompt||msg.imageGeneration?.optimizedPrompt||'',
    mode:result.mode||'text-to-video',
    taskId:taskId||msg.imageGeneration?.taskId||'',
    taskStatus:result.taskStatus||result.status||msg.imageGeneration?.taskStatus||'',
    loadingText:outputs.length?'':'\u89c6\u9891\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u6b63\u5728\u7b49\u5f85\u751f\u6210\u7ed3\u679c',
    directMode:false,
  };
  if(outputs.length){
    msg.content=generatedVideoMarkdown(outputs, result.prompt||result.sourcePrompt||msg.imageGeneration?.prompt||'')||result.content||result.markdown||'\u89c6\u9891\u5df2\u751f\u6210\u3002';
    msg._streaming=false;
    try{ persistAssistantMessageState(currentChat()?.id||currentChat()?._id,msg).catch(()=>{}); }catch(_){}
  }else if(taskId){
    msg.content='\u89c6\u9891\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u6b63\u5728\u751f\u6210\u4e2d\u3002\u4efb\u52a1ID\uff1a'+taskId;
    pollWebuiVideoTask(msg,result);
  }else{
    msg.content=result.content||result.markdown||'\u89c6\u9891\u4efb\u52a1\u5df2\u63d0\u4ea4\uff0c\u6b63\u5728\u751f\u6210\u4e2d\u3002';
  }
  return true;
}
function renderImagePromptPanel(imageGeneration={}){
  const prompt=cleanImagePromptForDisplay(imageGeneration.optimizedPrompt||imageGeneration.prompt||'');
  const source=cleanImagePromptForDisplay(imageGeneration.sourcePrompt||'');
  const hasOutputs=Array.isArray(imageGeneration.outputs)&&imageGeneration.outputs.length>0;
  const hasOptimized=!!imageGeneration.optimizedByAgent || !!imageGeneration.optimizeSkill || (!!source && prompt!==source);
  if(!prompt || (!hasOutputs && !hasOptimized)) return '';
  const title=String(imageGeneration.mode||'').startsWith('image-to-image')
    ? '图生图提示词'
    : (hasOptimized && prompt!==source ? '图像提示词' : '最终提示词');
  const skill=imageGeneration.optimizeSkill ? ` · ${imageGeneration.optimizeSkill}` : '';
  return `<div class="image-prompt-panel">
    <div class="image-prompt-panel-title"><span>${title}${esc(skill)}</span></div>
    <pre class="image-prompt-code"><code>${esc(prompt)}</code></pre>
  </div>`;
}

function imageAttachmentAgentText(images=[]){
  if(!images.length) return '';
  const ids=images.map(img=>img.id).filter(Boolean).join(', ');
  return '\n\n[WebUI uploaded image attachment context. The user uploaded local reference images and WebUI saved them locally. IMPORTANT: If the user asks for image generation/editing, call webui_image_generate and pass attachmentIds. If the user asks for video / animation / motion / image-to-video / make this image move, call webui_video_generate and pass the same attachmentIds. If the user asks to insert/use this image in a Markdown document/report, keep the image path/Preview URL and write Markdown image syntax into the target document with a markdown/file write tool; do not claim success unless the write tool succeeds. Do not omit attachmentIds. Do not use text-to-video when reference images exist. Preserve the reference image identity, character, composition, colors, and style; only add the requested motion. Available attachmentIds: '+ids+'.]\n'+images.map((img,i)=>{
    const parts=[
      `${i+1}. ${img.name||'reference image'}`,
      `Attachment ID: ${img.id||''}`,
      `Local path: ${img.path||''}`,
      `Preview URL: ${mediaUrl(img.url||img.publicUrl)}`,
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

function isVideoGenerationIntent(){
  const ta=$('#chatInput');
  const text=String(ta?.value||'').trim();
  if(!text) return false;
  return /(\u751f\u6210|\u505a|\u521b\u5efa|\u8f93\u51fa|\u5236\u4f5c).{0,32}(\u89c6\u9891|\u77ed\u7247|\u52a8\u753b|\u52a8\u6548|\u52a8\u6001\u753b\u9762|motion|video|clip|animation)|\u6587\u751f\u89c6\u9891|\u56fe\u751f\u89c6\u9891|video generation|generate.{0,80}(video|clip|animation|motion)|create.{0,80}(video|clip|animation|motion)|make.{0,80}(video|clip|animation|motion)/i.test(text);
}

function isImageGenerationIntent(pendingImages=[], options={}){
  if(state.forceImageGeneration) return true;
  if(state.imageEditReference) return true;
  const ta=$('#chatInput');
  const text=String(ta?.value||'').trim();
  if(!text && !pendingImages.length) return false;
  return !!(options.explicitDirectImageMode || ta?.dataset?.directImageMode==='1');
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
  let optimizedByImageAgent=false;
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
  const assistantMsg={role:'assistant',content:'',imageGeneration:{status:'loading',stage:'optimizing',sourcePrompt:userPrompt,prompt:basePrompt,directMode:false,startedAt:Date.now()},_msgId:msgId,_streaming:true,ts:Date.now()};
  c.messages.push(assistantMsg);
  const streamController=new AbortController();
  setStreamingState(true,streamController,msgId);
  renderMsgUpdate(userMsg._msgId, userMsg);
  renderMsgUpdate(msgId, assistantMsg);
  flushMsgUpdates();
  const area=$('#messagesArea');
  if(area) area.scrollTop=area.scrollHeight;
  let imageRequestTimedOut=false;
  let imageProgressTimer=null;
  let imageTimeoutTimer=null;

  try{
    const profile=profileForChat(c);
    try{
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
      optimizedByImageAgent=!!optimized;
      assistantMsg.content='';
      assistantMsg.imageGeneration={
        status:'loading',
        stage:mergedImages.length?'editing':'generating',
        sourcePrompt:userPrompt,
        prompt,
        optimizedPrompt:prompt,
        optimizeSkill:optimized?.skill||'',
        mode:optimized?.mode||'',
        optimizedByAgent:optimizedByImageAgent,
        directMode:!!state.forceImageGeneration,
        startedAt:assistantMsg.imageGeneration?.startedAt||Date.now()
      };
      assistantMsg.thinking='';
      renderMsgUpdate(msgId,assistantMsg);
    }catch(optimizeError){
      if(streamController.signal.aborted) throw optimizeError;
      assistantMsg.imageGeneration={
        status:'loading',
        stage:mergedImages.length?'editing':'generating',
        sourcePrompt:userPrompt,
        prompt,
        optimizedPrompt:prompt,
        optimizeSkill:'',
        mode:imageInputIds.length?'image-to-image':'text-to-image',
        optimizedByAgent:false,
        directMode:!!state.forceImageGeneration,
        loadingText:'提示词优化失败，已使用原始描述继续生成。'
      };
      renderMsgUpdate(msgId,assistantMsg);
    }
    const requestModel = isImageModelId(state.chatModelOverride) ? state.chatModelOverride : 'auto';
    const imageRequestController=new AbortController();
    const imageRequestStartedAt=Date.now();
    const updateImageWaitText=()=>{
      const waited=Math.max(0,Math.floor((Date.now()-imageRequestStartedAt)/1000));
      assistantMsg.imageGeneration={...(assistantMsg.imageGeneration||{}),loadingText:'\u6b63\u5728\u751f\u6210\u56fe\u7247\uff08\u5df2\u7b49\u5f85 '+waited+' \u79d2\uff09'};
      renderMsgUpdate(msgId,assistantMsg);
    };
    imageTimeoutTimer=setTimeout(()=>{imageRequestTimedOut=true;imageRequestController.abort();},180000);
    if(streamController.signal){
      if(streamController.signal.aborted) imageRequestController.abort();
      else streamController.signal.addEventListener('abort',()=>imageRequestController.abort(),{once:true});
    }
    updateImageWaitText();
    imageProgressTimer=setInterval(updateImageWaitText,1000);
    const resp=await fetch(apiBase()+'/api/images/generate',{
      method:'POST',
      cache:'no-store',
      headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},
      body:JSON.stringify({
        prompt,
        sourcePrompt:userPrompt,
        optimizedByAgent:optimizedByImageAgent,
        attachmentIds:imageInputIds,
        model:requestModel,
        chatId:c._id||c.id,
        publicBase:publicApiBase(),
        userMsgId,
        assistantMsgId:msgId,
      }),
      signal:imageRequestController.signal,
    });
    clearTimeout(imageTimeoutTimer);
    if(imageProgressTimer){clearInterval(imageProgressTimer);imageProgressTimer=null;}
    const json=await resp.json().catch(()=>({}));
    const data=json.code===0?json.data:null;
    if(!data){
      assistantMsg.content='图像生成失败：'+(json.msg||'请检查图像模型场景是否已配置为 OpenAI 图片接口。');
      toast('图像生成失败','error');
    }else{
      assistantMsg.imageGeneration={model:data.model,outputs:data.outputs||[],inputs:data.inputs||[],prompt:data.prompt||prompt,sourcePrompt:userPrompt,optimizedPrompt:prompt,optimizeSkill:assistantMsg.imageGeneration?.optimizeSkill||'',mode:assistantMsg.imageGeneration?.mode||(imageInputIds.length?'image-to-image':'text-to-image'),optimizedByAgent:optimizedByImageAgent,directMode:assistantMsg.imageGeneration?.directMode};
      assistantMsg.content=generatedImageMessageContent(assistantMsg.imageGeneration)||data.content||'已生成图片。';
      const idx=state.chats.findIndex(x=>x.id===c.id);
      if(data.chat&&idx>=0){
        state.chats[idx].title=data.chat.title||state.chats[idx].title;
        state.chats[idx].updatedAt=data.chat.updatedAt||Date.now();
        state.chats[idx].messages=[...c.messages];
        state.chats[idx].messageCount=Math.max(data.chat.messageCount||0,c.messages.length);
        state.chatFullData[c.id]={...(state.chatFullData[c.id]||{}),...(data.chat||{}),id:c.id,messages:[...c.messages]};
      }
      toast('图片已生成并保存到本地','success');
    }
  }catch(e){
    if(e.name==='AbortError'){
      if(imageRequestTimedOut){
        assistantMsg.content='\u56fe\u50cf\u751f\u6210\u5931\u8d25\uff1a\u8bf7\u6c42\u8d85\u8fc7 180 \u79d2\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u6216\u68c0\u67e5\u56fe\u50cf\u6a21\u578b\u670d\u52a1\u3002';
        toast('\u56fe\u50cf\u751f\u6210\u8d85\u65f6','error');
      }else{
        assistantMsg.content='\u5df2\u7ec8\u6b62\u4efb\u52a1\u3002';
        toast('\u5df2\u7ec8\u6b62\u5f53\u524d\u4efb\u52a1','info');
      }
    }else{
      assistantMsg.content='图像生成失败：'+(e.message||'未知错误');
      toast('图像生成失败','error');
    }
  }finally{
    if(imageTimeoutTimer){clearTimeout(imageTimeoutTimer);imageTimeoutTimer=null;}
    if(imageProgressTimer){clearInterval(imageProgressTimer);imageProgressTimer=null;}
    if(assistantMsg.imageGeneration?.outputs?.length && typeof HermesArtifact !== 'undefined' && typeof HermesArtifact.refreshImageWaterfall === 'function') {
      HermesArtifact.refreshImageWaterfall({ rescan:true, silent:true }).catch(()=>{});
    }
    assistantMsg._streaming=false;
    renderMsgUpdate(msgId,assistantMsg);
    flushMsgUpdates();
    setStreamingState(false,null,null);
    save();
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
    const profile=getMainWebProfile();
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

  const explicitImageMode=!!state.imagePromptMode;
  const explicitDirectImageMode=!!(ta?.dataset?.directImageMode==='1');
  if(isImageGenerationIntent(pendingImages,{explicitDirectImageMode})){
    state.imagePromptMode=false;
    save();
    if(ta) { delete ta.dataset.explicitImageMode; delete ta.dataset.directImageMode; }
    await sendImageGenerationMessage(txt,pendingImages);
    return;
  }
  state.imagePromptMode=false;
  save();
  if(ta) { delete ta.dataset.directImageMode; delete ta.dataset.explicitImageMode; }

  // Add user message to local state immediately; send attachment context to Agent separately from visible bubble.
  const agentAttachmentContext=imageAttachmentAgentText(pendingImages);
  const localEditContext=typeof HermesArtifact!=='undefined' && typeof HermesArtifact.getLocalEditContext==='function'
    ? HermesArtifact.getLocalEditContext()
    : null;
  const artifactContext=activeArtifactContext();
  const localEditAgentContext=localEditContext ? [
    '\n\n<webui_local_edit_context>',
    '任务类型：知识库文档局部编辑',
    `文档标题：${localEditContext.title||'当前知识库文档'}`,
    `文档路径：${localEditContext.path||'当前 Artifact 尚未保存'}`,
    `行号范围：L${localEditContext.lineStart||''}-${localEditContext.lineEnd||''}`,
    `选区来源：${localEditContext.mode==='source'?'代码模式':'预览模式'}`,
    '',
    '编辑前内容：',
    '```',
    localEditContext.originalContent||localEditContext.selectedText||'',
    '```',
    '',
    '要求：',
    '1. 只修改上述选中部分，保持原文风格和格式',
    '2. 修改后写回原文档的对应位置',
    '3. 完成修改后，请在回复中以代码块形式输出编辑前后的对比，格式如下：',
    '',
    '**编辑前：**',
    '```',
    '[原始内容]',
    '```',
    '',
    '**编辑后：**',
    '```',
    '[修改后内容]',
    '```',
    '',
    '</webui_local_edit_context>'
  ].join('\n') : '';
  const artifactAgentContext=artifactContext && !localEditContext ? [
    '\n\n<webui_current_markdown_context>',
    '任务类型：当前 Markdown 文档上下文',
    `文档标题：${artifactContext.title||shortFileName(artifactContext.path)}`,
    `文档路径：${artifactContext.path}`,
    `文档总行数：${artifactContext.totalLines ? artifactContext.totalLines + ' 行' : ''}`,
    '说明：用户正在预览这个本地 Markdown 文件。若用户要求修改/优化/续写，请优先针对该文件。',
    '修改规则：如果用户指定了行号范围（如"改第 80-100 行"），请只修改该范围内的内容，不要重写全文。',
    '需要写回时请读取并保存同一路径。工具操作优先使用行号定位选区。',
    '重要：如果你修改了该文件内容并保存成功，请在回复末尾用一句话总结你做了什么修改（如："已完成修改：改写了第 80-100 行，优化了段落结构"），方便用户知道变更内容。',
    '</webui_current_markdown_context>'
  ].join('\n') : '';
  const contentWithAttachments=txt+agentAttachmentContext+localEditAgentContext+artifactAgentContext;
  const traceId = makeTraceId('chat');
  const userMsgId = 'u_' + Date.now();
  const userMsg = {role:'user',content:txt,agentContent:contentWithAttachments,ts:Date.now(),attachments:pendingImages,_msgId:userMsgId,traceId};
  if(localEditContext) userMsg.localEditContext=localEditContext;
  if(artifactContext && !localEditContext) userMsg.artifactContext=artifactContext;
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
  const assistantMsg = { role: 'assistant', content: '', thinking: '', toolCalls: [], processEvents: [{ type: 'queued', traceId }], _msgId: msgId, userMsgId, traceId, _streaming: true, ts: Date.now() };
  if(localEditContext) assistantMsg.localEditContextId=localEditContext.id;
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
    const item={ ...event, at: Date.now() };
    const normalizedType = item.type === 'perf' && item.stage ? item.stage : (item.type || item.stage || 'event');
    item.type = normalizedType;
    const list=[...(assistantMsg.processEvents||[])];
    const last=list[list.length-1];
    const sameToolProgress=last && item.type==='tool-running' && last.type==='tool-running' && last.name===item.name;
    const sameRoute=last && item.type===last.type && ['sse-flushed','route-selected','cli-spawned','first-cli-stdout'].includes(item.type);
    if(sameToolProgress || sameRoute) list[list.length-1]={...last,...item};
    else list.push(item);
    assistantMsg.processEvents=list.slice(-80);
  }

  const profile=profileForChat(c);
  const requestModel = state.chatModelOverride !== 'auto' ? state.chatModelOverride : (profile?.modelId && profile.modelId !== 'auto' ? profile.modelId : 'auto');
  const streamPath=sendingToCli?('/api/cli/sessions/'+encodeURIComponent(c.id)+'/messages'):('/api/chats/' + (c._id || c.id) + '/messages');
  const routingMode=effectiveRoutingMode(profile);
  await apiStream(streamPath, {
    content: contentWithAttachments,
    displayContent: txt,
    attachments: pendingImages,
    pendingAttachmentIds: pendingImages.map(img=>img.id).filter(Boolean),
    routingMode,
    scene:isVideoGenerationIntent()?'video':(explicitImageMode?'image':(pendingImages.length?'vision':(profile?.modelScene||'chat'))),
    model:requestModel,
    profileId:profile?.id,
    profileName:profile?.name||'默认助手',
    profilePrompt:profile?.systemPrompt||'',
    profileSkillIds:profile?.skillIds||[],
    agentRuntime:'cli',
    localEditContext,
    traceId,
    userMsgId,
    assistantMsgId:msgId,
  }, {
    signal: streamController.signal,
    onPerf(data) {
      hermesPerfLog('backend', data);
      if(data?.traceId) assistantMsg.traceId=data.traceId;
      if(data?.userMsgId) assistantMsg.userMsgId=data.userMsgId;
      let shouldRenderPerf = false;
      if(data?.stage==='hermes-session'){
        const sid=String(data.hermesSessionId||data.sessionId||data.session_id||'').trim();
        if(sid) {
          assistantMsg.hermesSessionId=sid;
          shouldRenderPerf = true;
        }
      }
      if(data?.stage && ['sse-flushed','route-selected','runtime-selected','route-fallback','model-fallback','hermes-api-connect','hermes-api-failed','hermes-session','first-hermes-event','first-cli-stdout','cli-spawned','direct-api-aborted','client-aborted'].includes(data.stage)){
        pushProcessEvent(data);
        if(data.stage==='hermes-session') shouldRenderPerf = true;
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
      if(shouldRenderPerf) renderMsgUpdate(msgId, assistantMsg);
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
      if (assistantMsg.imageGeneration?.outputs?.length && typeof HermesArtifact !== 'undefined' && typeof HermesArtifact.refreshImageWaterfall === 'function') {
        HermesArtifact.refreshImageWaterfall({ rescan:true, silent:true }).catch(()=>{});
      }

      if (typeof HermesArtifact !== 'undefined') {
        if (localEditContext) {
          assistantMsg.thinking = fullReasoning;
        } else if (fullReasoning) {
          const now = performance.now ? performance.now() : Date.now();
          const shouldFeedArtifact = /<\/?(?:artifact|think)\b/i.test(text) || now - lastArtifactFeedAt >= STREAM_MARKDOWN_INTERVAL_MS;
          if (shouldFeedArtifact) {
            const p = HermesArtifact.parseHermesStream(fullContent);
            assistantMsg.thinking = [fullReasoning, p.think].filter(Boolean).join('\n\n');
            HermesArtifact.feedStream(p, true);
            lastArtifactFeedAt = now;
          } else {
            assistantMsg.thinking = fullReasoning;
          }
        } else {
          const now = performance.now ? performance.now() : Date.now();
          const shouldFeedArtifact = /<\/?(?:artifact|think)\b/i.test(text) || now - lastArtifactFeedAt >= STREAM_MARKDOWN_INTERVAL_MS;
          if (shouldFeedArtifact) {
            const p = HermesArtifact.parseHermesStream(fullContent);
            assistantMsg.thinking = p.think;
            HermesArtifact.feedStream(p, true);
            lastArtifactFeedAt = now;
          }
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
      const name = toolDisplayName(data);
      // Check if this is a clarify/ask_user tool call
      if (name === 'clarify' || name === 'ask_user' || name === 'AskUserQuestion') {
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
      const tc = { name, status: 'running', input: data.args || data.input || data.params || data.preview || '', output: '', startedAt: Date.now() };
      tools.push(tc);
      assistantMsg.toolCalls = [...tools];
      if(isWebuiImageToolName(name)){
        let imageToolArgs=data.args || {};
        if(typeof imageToolArgs==='string'){
          try{ imageToolArgs=JSON.parse(imageToolArgs); }catch(_){ imageToolArgs={prompt:imageToolArgs}; }
        }
        assistantMsg.imageGeneration={
          ...(assistantMsg.imageGeneration||{}),
          status:'loading',
          stage:Array.isArray(imageToolArgs.attachmentIds)&&imageToolArgs.attachmentIds.length?'editing':'generating',
          prompt:imageToolArgs.prompt||'',
          sourcePrompt:imageToolArgs.sourcePrompt||imageToolArgs.prompt||'',
          loadingText:'\u6b63\u5728\u8c03\u7528 WebUI \u751f\u56fe\u5de5\u5177',
          startedAt:assistantMsg.imageGeneration?.startedAt||Date.now()
        };
        assistantMsg.content='';
      }
      pushProcessEvent({ type:'tool-start', name });
      renderMsgUpdate(msgId, assistantMsg);
    },
    onToolRunning(data) {
      const name = toolDisplayName(data);
      const preview = data?.preview || '';
      let target = null;
      for (let i=tools.length-1;i>=0;i--) {
        const existingName=toolDisplayName(tools[i]);
        if (tools[i].status === 'running' && (existingName === name || name === 'tool')) {
          target=tools[i];
          break;
        }
      }
      if (target) {
        target.output = preview || target.output || '';
        target.elapsedMs = data.elapsedMs || (target.startedAt ? Date.now() - target.startedAt : 0);
        if(toolDisplayName(target)==='tool' && name !== 'tool') target.name = name;
      } else {
        tools.push({ name, status:'running', input:'', output:preview, startedAt:Date.now(), elapsedMs:data.elapsedMs||0 });
      }
      assistantMsg.toolCalls = [...tools];
      if((isWebuiImageToolName(name)||isWebuiVideoToolName(name)) && assistantMsg.imageGeneration?.status === 'loading'){
        const elapsedMs = data.elapsedMs || imageGenerationElapsedMs(assistantMsg.imageGeneration);
        assistantMsg.imageGeneration={
          ...(assistantMsg.imageGeneration||{}),
          loadingText:(isWebuiVideoToolName(name)?'正在生成视频，已等待 ':'正在生成图片，已等待 ')+Math.floor(elapsedMs/1000)+' 秒',
          elapsedMs
        };
      }
      pushProcessEvent({ type:'tool-running', name, elapsed:data.elapsedMs||0 });
      renderMsgUpdate(msgId, assistantMsg);
    },
    onAgentStep(data) {
      const title=String(data?.title||'Agent 步骤').trim();
      const detail=String(data?.detail||'').trim();
      if(!title && !detail) return;
      pushProcessEvent({
        type:'agent-step',
        phase:data?.phase||'',
        status:data?.status||'running',
        title,
        detail,
        raw:data?.raw||'',
        error:!!data?.error
      });
      renderMsgUpdate(msgId, assistantMsg);
    },
    onHeartbeat(data) {
      if(assistantMsg.imageGeneration?.status === 'loading'){
        const elapsedMs = imageGenerationElapsedMs(assistantMsg.imageGeneration);
        assistantMsg.imageGeneration={
          ...(assistantMsg.imageGeneration||{}),
          loadingText:'正在生成媒体，已等待 '+Math.floor(elapsedMs/1000)+' 秒',
          elapsedMs
        };
        renderMsgUpdate(msgId, assistantMsg);
      }
    },
    onAgentRaw(data) {
      const text = String(data?.text || '').trim();
      if(!text || data?.stream !== 'stderr') return;
      pushProcessEvent({ type:'agent-raw', stream:'stderr', text:text.slice(0, 500), rawType:data.rawType||'' });
      renderMsgUpdate(msgId, assistantMsg);
    },
    onAgentExit(data) {
      if(data?.code || !data?.meaningfulStdout || data?.stderrTail){
        pushProcessEvent({ type:'agent-exit', code:data?.code, meaningfulStdout:!!data?.meaningfulStdout, ms:data?.ms||0, stderrTail:data?.stderrTail||'' });
        renderMsgUpdate(msgId, assistantMsg);
      }
    },
    onToolComplete(data) {
      const name = toolDisplayName(data);
      let matched = false;
      for (let i=tools.length-1;i>=0;i--) {
        const t=tools[i];
        const existingName=toolDisplayName(t);
        if (t.status === 'running' && (existingName === name || existingName === 'tool' || name === 'tool')) {
          t.status = data.is_error ? 'error' : 'success';
          t.output = data.preview || '';
          t.duration = data.duration || (t.startedAt ? Date.now() - t.startedAt : 0);
          if(existingName === 'tool' && name !== 'tool') t.name = name;
          matched = true;
          break;
        }
      }
      if(!matched){
        tools.push({ name, status:data.is_error?'error':'success', input:data.args || data.input || data.params || '', output:data.preview || '', duration:data.duration||0, startedAt:Date.now()-(Number(data.duration)||0) });
      }
      assistantMsg.toolCalls = [...tools];
      if(isWebuiImageToolName(name)){
        if(data.is_error){
          assistantMsg.imageGeneration=null;
        }else{
          const toolResult=parseWebuiImageToolResult(data.preview);
          if(toolResult){
            const elapsedMs=data.duration || imageGenerationElapsedMs(assistantMsg.imageGeneration);
            applyWebuiImageToolResult(assistantMsg, toolResult);
            assistantMsg.imageGeneration={...(assistantMsg.imageGeneration||{}),elapsedMs,duration:elapsedMs};
            if (typeof HermesArtifact !== 'undefined' && typeof HermesArtifact.refreshImageWaterfall === 'function') {
              HermesArtifact.refreshImageWaterfall({ rescan:true, silent:true }).catch(()=>{});
            }
          }else if(assistantMsg.imageGeneration?.status==='loading'){
            assistantMsg.imageGeneration={...(assistantMsg.imageGeneration||{}),status:'done',elapsedMs:data.duration||imageGenerationElapsedMs(assistantMsg.imageGeneration),duration:data.duration||imageGenerationElapsedMs(assistantMsg.imageGeneration)};
          }
        }
      }
      if(isWebuiVideoToolName(name)){
        const toolResult=parseWebuiVideoToolResult(data.preview)||parseVideoPendingText(data.preview)||parseVideoPendingText(assistantMsg.content);
        if(data.is_error && !toolResult){
          assistantMsg.imageGeneration=null;
        }else if(toolResult){
          applyWebuiVideoToolResult(assistantMsg, toolResult);
          if (typeof HermesArtifact !== 'undefined' && typeof HermesArtifact.refreshImageWaterfall === 'function') {
            HermesArtifact.refreshImageWaterfall({ rescan:true, silent:true }).catch(()=>{});
          }
        }
      }
      pushProcessEvent({ type:'tool-done', name, error:!!data.is_error, elapsed:data.duration||0, preview:data.preview||'' });
      if(data.is_error) toast('工具 '+name+' 执行失败','error');
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
    async onDone(data) {
      if(data?.traceId) assistantMsg.traceId=data.traceId;
      if(data?.userMsgId) assistantMsg.userMsgId=data.userMsgId;
      if(data?.assistantMsgId) assistantMsg._msgId=data.assistantMsgId;
      const doneSessionId=String(data?.hermesSessionId||data?.sessionId||data?.session_id||'').trim();
      const chatSessionId=String(data?.chat_session_id||c?.id||c?._id||'').trim();
      if(doneSessionId && doneSessionId!==chatSessionId && !assistantMsg.hermesSessionId) assistantMsg.hermesSessionId=doneSessionId;
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

      if(String(assistantMsg.content||'').includes('webui_image_generate_result')){
        const toolResult=parseWebuiImageToolResult(assistantMsg.content||'');
        if(toolResult){
          applyWebuiImageToolResult(assistantMsg, toolResult);
        }
      }
      if(String(assistantMsg.content||'').includes('webui_video_generate_result')){
        const toolResult=parseWebuiVideoToolResult(assistantMsg.content||'');
        if(toolResult){
          applyWebuiVideoToolResult(assistantMsg, toolResult);
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
        if(localEditContext){
          await autoApplyAssistantReplyToLocalEdit(assistantMsg, localEditContext);
          await appendLocalEditComparisonIfMissing(assistantMsg, localEditContext);
          if (typeof HermesArtifact.refreshArtifactDocument === 'function' && localEditContext.path) {
            await HermesArtifact.refreshArtifactDocument({
              path: localEditContext.path,
              title: localEditContext.title,
              oldContent: localEditContext.sourceSnapshot,
              tab: 'source',
              scrollToHighlight: true,
            }).catch(() => {});
          }
          if(!cleanMessageContent(assistantMsg.content||'').trim()){
            assistantMsg.content = assistantMsg.localEditApplied ? '已完成修改，右侧文档已更新。' : '已完成修改。';
          }
        }else{
          const p = HermesArtifact.parseHermesStream(assistantMsg.content || '');
          HermesArtifact.finalizeStream(p);
          // 主动刷新右侧文档：Agent 完成对话后，只要有 Markdown 文档打开就刷新
          if (typeof HermesArtifact.refreshArtifactDocument === 'function') {
            HermesArtifact.refreshArtifactDocument().catch(() => {});
          }
        }
      }
      renderMsgUpdate(msgId, assistantMsg);
      await persistAssistantMessageState(c._id || c.id, assistantMsg);
      syncCurrentChat(c._id || c.id);
    },
    onError(msg, data) {
      if(data?.traceId) assistantMsg.traceId=data.traceId;
      if(data?.userMsgId) assistantMsg.userMsgId=data.userMsgId;
      if(data?.assistantMsgId) assistantMsg._msgId=data.assistantMsgId;
      assistantMsg._streaming = false;
      setStreamingState(false,null,null);
      const errorText = '⚠️ ' + (msg || '请求失败');
      assistantMsg.content = fullContent ? (fullContent + '\n\n' + errorText) : errorText;
      assistantMsg.error = true;
      pushProcessEvent({ type:'error', message:msg||'请求失败' });
      renderMsgUpdate(msgId, assistantMsg);
      persistAssistantMessageState(c._id || c.id, assistantMsg).catch(()=>{});
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

function cleanLocalEditReplacement(text, options={}){
  let value=String(text||'').trim();
  let structured=false;
  value=value.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  value=value.replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi,'').trim();
  const afterBlock=extractLocalEditAfterBlock(value);
  if(afterBlock) return afterBlock;
  value=stripLocalEditDiffNoise(value);
  const artifactMatch=value.match(/<artifact\s+[^>]*>[\s\S]*?<\/artifact>/i);
  if(artifactMatch && typeof HermesArtifact!=='undefined'){
    structured=true;
    const parsed=HermesArtifact.parseHermesStream(value);
    const last=(parsed.completedArtifacts||[]).slice(-1)[0];
    if(last?.content) value=last.content.trim();
    else value=(parsed.visibleText||value).trim();
  }
  if(hasLocalEditComparisonBlock(value)){
    const after=extractLocalEditAfterBlock(value);
    if(after) return after;
  }
  const fences=[...value.matchAll(/```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```/gi)];
  if(fences.length){
    structured=true;
    value=fences[fences.length-1][1].trim();
  }
  value=value.replace(/⚠️?\s*session_id:\s*\S+/gi,'').trim();
  value=value.replace(/^\s*r?eview diff\s*\n(?:\s*(?:[ab]\/{1,2}|[ab]\\|@@|diff --git|index\s|---\s|\+\+\+\s|[-+]\s).*(?:\n|$))+/gim,'').trim();
  value=value.replace(/^\s*review diff[\s\S]*?(?=\n\s*\n|$)/im,'').trim();
  value=value.replace(/^\s*[ab]\/[^\n]+\s*→\s*[ab]\/[^\n]+\s*$/gm,'').trim();
  if(options.requireStructured && !structured) return '';
  if(!value || value.length < 10) return '';
  return value;
}

async function autoApplyAssistantReplyToLocalEdit(assistantMsg, localEditContext){
  if(!assistantMsg || !localEditContext || assistantMsg.localEditApplied) return false;
  const replacement=cleanLocalEditReplacement(assistantMsg.content||'', { requireStructured:true });
  if(!replacement) return false;
  if(typeof HermesArtifact==='undefined'||typeof HermesArtifact.applyLocalEditReplacement!=='function') return false;
  try{
    const ok=await HermesArtifact.applyLocalEditReplacement(replacement, localEditContext);
    assistantMsg.localEditApplied=!!ok;
    if(ok) assistantMsg.localEditAppliedAt=Date.now();
    return !!ok;
  }catch(e){
    assistantMsg.localEditApplyError=e?.message||'应用到选区失败';
    toast(assistantMsg.localEditApplyError,'error');
    return false;
  }
}

async function applyAssistantReplyToLocalEdit(msgId, contextId){
  const chat=currentChat();
  const msg=(chat?.messages||[]).find(item=>String(item._msgId||item.id||'')===String(msgId||''));
  const replacement=cleanLocalEditReplacement(msg?.content||'');
  if(!replacement){ toast('没有可应用的回复内容','warning'); return; }
  if(typeof HermesArtifact==='undefined'||typeof HermesArtifact.applyLocalEditReplacement!=='function'){
    toast('知识库编辑器未就绪','warning');
    return;
  }
  try{
    await HermesArtifact.applyLocalEditReplacement(replacement, contextId);
  }catch(e){
    toast(e?.message||'应用到选区失败','error');
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
          content=msg.imageGeneration.mediaType==='video'?generatedVideoMarkdown(msg.imageGeneration.outputs, msg.imageGeneration.prompt||msg.imageGeneration.sourcePrompt||previousUserPromptForMessage(msg)):generatedImageMarkdown(msg.imageGeneration.outputs);
        }
        const isLocalEditAssistant=msg.role==='assistant' && !!msg.localEditContextId;
        const isLocalEditCompletion=isLocalEditAssistant && !msg._streaming;
        const localEditContextForAssistant=isLocalEditCompletion ? getLocalEditContextForAssistant(msg) : null;
        let localEditCompletionHtml='';
        if(isLocalEditCompletion){
          localEditCompletionHtml=buildLocalEditCompletionHtml(msg, localEditContextForAssistant);
          content='';
        }
        let refs = '';
        let previewAction = '';
        let localEditAction = '';
        let fileCards = '';
        let localEditCard = msg.role==='user' && msg.localEditContext ? renderLocalEditMessageCard(msg.localEditContext,'chat-local-edit-card') : '';
        const stepHtml = msg.step ? `<div class="msg-step-indicator">Step ${msg.step}</div>` : '';
        const isStreaming = !!msg._streaming;
        if (msg.role === 'assistant' && typeof HermesArtifact !== 'undefined' && !isLocalEditAssistant) {
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
          if (msg.localEditContextId && !isStreaming) {
            // 已通过右侧面板自动刷新，无需对话内"应用到选区"按钮
          }
        }
        const modelBadge = '';
        const promptDebugHtml = msg.role==='assistant' ? renderPromptDebugPanel(msg.promptDebug) : '';
        const imagePromptHtml = msg.role==='assistant' && msg.imageGeneration ? renderImagePromptPanel(msg.imageGeneration) : '';
        const imageLoadingHtml = msg.role==='assistant' && msg.imageGeneration?.status==='loading' ? renderImageGenerationLoadingCard(msg.imageGeneration) : '';
        const streamDots = msg._streaming && !imageLoadingHtml ? '<span class="msg-streaming"><span></span><span></span><span></span></span>' : '';
        const bodyHtml = isStreaming && content && !fileCards && !refs
          ? `<div>${esc(content).replace(/\n/g,'<br>')}</div>`
          : (content ? formatMsg(content) : '');
        bubble.innerHTML = localEditCard + stepHtml + imageLoadingHtml + imagePromptHtml + localEditCompletionHtml + bodyHtml + renderMessageAttachments(msg.attachments) + fileCards + refs + previewAction + localEditAction + promptDebugHtml + modelBadge + streamDots;
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
          const tcHtml = renderToolCallsHtml(msg.toolCalls, msg);
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
  const chats = [...(state.chats || [])].sort(compareChatCreatedDesc);
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
      <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">创建分身房间</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">你的昵称 *</label>
          <input id="gcNewNick" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(state.groupChat.userName)}" placeholder="输入昵称">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">自我描述</label>
          <input id="gcNewDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="一句话介绍自己">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">房间名称 *</label>
          <input id="gcNewRoomName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="例如：产品讨论">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">邀请码</label>
          <div style="display:flex;gap:8px">
            <input id="gcNewInvite" style="flex:1;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);font-family:var(--font-mono)" value="${code}">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('gcNewInvite').value=Math.random().toString(36).substring(2,8).toUpperCase()">刷新</button>
          </div>
        </div>
        <div style="border-top:1px solid var(--c-hairline);padding-top:12px;margin-top:4px">
          <div style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:8px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'flex':'none'">▶ 压缩设置</div>
          <div style="display:none;flex-direction:column;gap:8px">
            <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">触发阈值 (tokens)</label><input id="gcNewTrigger" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-md)" value="100000"></div>
            <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">最大历史 (tokens)</label><input id="gcNewMaxHist" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-md)" value="32000"></div>
            <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">保留最近消息数</label><input id="gcNewTail" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-md)" value="20"></div>
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
      <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">添加分身</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">选择 Profile *</label>
          <select id="gcAgentProfile" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)">
            ${available.map(p=>`<option value="${p}">${p}</option>`).join('')}
            ${available.length===0?'<option disabled>所有 Profile 已添加</option>':''}
          </select>
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">分身名称 *</label>
          <input id="gcAgentName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="给分身起个名字">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">描述</label>
          <input id="gcAgentDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="一句话描述 Agent 的能力">
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

function defaultFixedProfiles(){
  return FIXED_AGENT_PROFILES.map(def=>({
    id:def.id,name:def.name,role:def.role,fixed:true,modelScene:def.modelScene,routingMode:def.routingMode||((def.id==='default')?'auto':'hermes'),
    modelId:activeModelsConfig().scenarios?.[def.modelScene]||'auto',
    model:scenarioModelName(def.modelScene==='image'?'chat':def.modelScene),
    systemPrompt:def.systemPrompt,color:def.color,knowledgeFocus:def.knowledgeFocus||[],skillIds:[],enabled:true,routingMode:def.routingMode||((def.id==='default')?'auto':'hermes'),
  }));
}
function mergeFixedProfiles(stored){
  const byId=new Map((Array.isArray(stored)?stored:[]).map(p=>[String(p.id||''),p]));
  return defaultFixedProfiles().map(def=>{
    const old=byId.get(def.id)||{};
    const keepUserPrompt = def.id === 'default' && old.systemPrompt;
    return normalizeProfile({...def,...old,id:def.id,name:def.name,role:def.role,fixed:true,color:old.color||def.color,systemPrompt:keepUserPrompt?old.systemPrompt:def.systemPrompt,knowledgeFocus:def.knowledgeFocus});
  });
}
function getProfiles(){
  if(!_profilesCache){
    _profilesCache=mergeFixedProfiles(LS.get('hermes.profiles',defaultFixedProfiles()));
    LS.set('hermes.profiles',_profilesCache);
  }
  return _profilesCache;
}

function normalizeProfile(profile){
  const p={...profile};
  if(p.enabled===undefined) p.enabled=true;
  if(!Array.isArray(p.skillIds)) p.skillIds=[];
  if(!Array.isArray(p.knowledgeFocus)) p.knowledgeFocus=[];
  if(!p.modelId) p.modelId=p.model&&p.model!=='auto'?p.model:'auto';
  if(!p.color) p.color='var(--c-block-lime)';
  if(!p.avatar) p.avatar='';
  if(!p.routingMode) p.routingMode=p.id==='default'?'auto':'hermes';
  return p;
}

function agentDirs(profile){
  const id = String(profile?.id || 'default').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'') || 'default';
  const root = (state.settings.dataRootDir || 'backend/data/workspace') + '/agents/' + id;
  return { root, soulDir: root + '/soul', memoryDir: root + '/memory', workspaceDir: root + '/workspace', knowledgeDir: root + '/knowledge' };
}
function agentSnapshotForProfile(profile){
  const p=normalizeProfile(profile||getActiveProfile()||{});
  const dirs=agentDirs(p);
  return { id:p.id, name:p.name, role:p.role||'', modelId:p.modelId||'auto', routingMode:p.routingMode||'auto', systemPrompt:p.systemPrompt||'', skillIds:p.skillIds||[], knowledgeFocus:p.knowledgeFocus||[], ...dirs };
}
function agentChatPayload(profile){
  const snap=agentSnapshotForProfile(profile);
  return { title:'新建对话', agentId:snap.id, agentName:snap.name, modelId:snap.modelId, profileId:snap.id, profileName:snap.name, profilePrompt:snap.systemPrompt, profileSkillIds:snap.skillIds, agentRole:snap.role||'', knowledgeFocus:snap.knowledgeFocus||[] };
}

function getMainWebProfile(){
  return getProfiles().find(p=>p.id==='default'&&p.enabled!==false) || getProfiles().find(p=>p.id==='default') || getActiveProfile();
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

function effectiveRoutingMode(profile){
  const globalMode=String(state.settings?.routingMode||'auto').toLowerCase();
  if(globalMode && globalMode!=='auto') return globalMode;
  return String(profile?.routingMode||globalMode||'auto').toLowerCase();
}

gcShowAddAgent=function(){
  const room=state.groupChat.rooms.find(r=>r.id===state.groupChat.activeRoom);
  if(!room) return;
  const profiles=getProfiles();
  const existing=(state.groupChat.agents[room.id]||[]).map(a=>a.profileId);
  const available=profiles.filter(p=>!existing.includes(p.id));
  openModal(`<div style="padding:24px;min-width:420px">
    <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">添加分身</h3>
    <div style="display:grid;gap:12px">
      <label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">选择角色</label>
      <select id="gcAgentProfile" onchange="toggleGcCustomAgent()">
        ${available.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.model||scenarioModelName('chat'))}</option>`).join('')}
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
    profile:custom?(getModelById(modelId)?.name||scenarioModelName('reasoning')):(role.model||scenarioModelName('reasoning')),modelId,
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
      <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">房间设置</h3>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <div style="font-size:var(--fs-md);font-weight:var(--fw-medium);margin-bottom:8px">房间信息</div>
          <div style="font-size:var(--fs-md);color:var(--c-ink-muted)">名称：${esc(room.name)}</div>
          <div style="font-size:var(--fs-md);color:var(--c-ink-muted)">邀请码：<code style="font-family:var(--font-mono);background:var(--c-surface2);padding:2px 6px;border-radius:var(--r-sm)">${esc(room.inviteCode||'无')}</code></div>
        </div>
        <div>
          <div style="font-size:var(--fs-md);font-weight:var(--fw-medium);margin-bottom:8px">Agent 列表 (${agents.length})</div>
          ${agentsHtml||'<div style="font-size:var(--fs-md);color:var(--c-ink-muted)">暂无 Agent</div>'}
        </div>
        <div>
          <div style="font-size:var(--fs-md);font-weight:var(--fw-medium);margin-bottom:8px">压缩配置</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">触发阈值</label><input id="gcSetTrigger" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-md)" value="${room.triggerTokens||100000}"></div>
            <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">最大历史</label><input id="gcSetMaxHist" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-md)" value="${room.maxHistoryTokens||32000}"></div>
            <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">保留消息数</label><input id="gcSetTail" type="number" style="width:100%;padding:6px 10px;border-radius:var(--r-sm);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-md)" value="${room.tailMessageCount||20}"></div>
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
          body:JSON.stringify({
            messages,
            model:agent.modelId||agent.profile,
            scene:'reasoning',
            routingMode:state.settings.routingMode||'auto',
            agentRuntime:'cli',
            agentId:agent.profileId||agent.agentId,
            profileId:agent.profileId||agent.agentId,
            profileName:agent.name,
            profilePrompt:agent.systemPrompt||'',
          }),
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
      <span style="font-size:var(--fs-xs);color:var(--c-ink-muted);margin-left:auto">${esc(a.profile)}</span>
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
      <h3 style="font-size:var(--fs-lg);font-weight:var(--fw-bold)">分身 Markdown 预览</h3>
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
    <div class="page-header" style="cursor:pointer" onclick="this.nextElementSibling.classList.toggle('expanded')"><h2>搜索 <span style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-left:6px">▶</span></h2>
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
    <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">新建任务</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">任务名称</label><input id="jobName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="例如：每日代码审查"></div>
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">Cron 表达式</label><input id="jobSchedule" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);font-family:var(--font-mono)" placeholder="0 9 * * *" value="0 9 * * *"></div>
      <div style="font-size:var(--fs-sm);color:var(--c-ink-muted)">常用：每天9点 <code>0 9 * * *</code> · 每周五17点 <code>0 17 * * 5</code> · 每小时 <code>0 * * * *</code></div>
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
        <div class="skill-file-list">${filesHtml||'<div style="font-size:var(--fs-md);color:var(--c-ink-muted)">无附件</div>'}</div>
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
      <span style="font-size:var(--fs-md);color:var(--c-ink-muted)">${esc(s.name)} / ${esc(fileName)}</span>
    </div>
    <div class="skill-content">${esc(content)}</div>
  </div>`;
}

function skAdd(){
  openModal(`
    <div style="padding:24px;min-width:420px">
      <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">添加技能</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">上传技能文件</label>
          <div style="border:2px dashed var(--c-hairline);border-radius:var(--r-lg);padding:24px;text-align:center;cursor:pointer;transition:all var(--transition-fast)" onclick="document.getElementById('skFileInput').click()" onmouseover="this.style.borderColor='var(--c-accent)'" onmouseout="this.style.borderColor='var(--c-hairline)'">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink-muted)" stroke-width="1.5" style="margin:0 auto 8px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div style="font-size:var(--fs-md);color:var(--c-ink-muted)">点击上传 .md / .yaml / .json 技能文件</div>
            <div id="skFileName" style="font-size:var(--fs-sm);color:var(--c-accent);margin-top:4px"></div>
          </div>
          <input type="file" id="skFileInput" style="display:none" accept=".md,.yaml,.yml,.json" onchange="document.getElementById('skFileName').textContent=this.files[0]?.name||''">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">技能名称 *</label>
          <input id="skAddName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="例如：代码评审">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">描述（留空则AI自动生成）</label>
          <textarea id="skAddDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);min-height:60px;resize:vertical" placeholder="描述技能的功能和用途"></textarea>
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">分类</label>
          <input id="skAddCat" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="例如：开发" value="自定义">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">触发词</label>
          <input id="skAddTriggers" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="例如：代码、bug、重构">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">优先级</label>
          <input id="skAddPriority" type="number" min="0" max="100" value="50" style="width:120px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)">
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
      <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">编辑技能</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">技能名称</label>
          <input id="skEditName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(s.name)}">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">描述</label>
          <textarea id="skEditDesc" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);min-height:60px;resize:vertical">${esc(s.description)}</textarea>
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">分类</label>
          <input id="skEditCat" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(s.category)}">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">触发词</label>
          <input id="skEditTriggers" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(triggers)}" placeholder="例如：设计、UI、弹窗">
        </div>
        <div>
          <label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">优先级</label>
          <input id="skEditPriority" type="number" min="0" max="100" style="width:120px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(s.priority||0)}">
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
      <h3 style="margin-bottom:12px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">确认删除</h3>
      <p style="font-size:var(--fs-base);color:var(--c-ink-muted);margin-bottom:20px">确定要删除技能 "${esc(s.name)}" 吗？此操作不可撤销。</p>
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
          <div class="section-body"><pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:var(--fs-md)">${state.memories.core||'<span class="empty-text">暂无核心记忆</span>'}</pre></div>
        </div>
        <div class="memory-section">
          <div class="section-header"><div class="section-title-row"><span class="section-icon">${SVG.chat}</span><span class="section-title">上下文记忆</span><button class="btn btn-xs btn-ghost" onclick="editMemory('context')" style="margin-left:auto">编辑</button></div></div>
          <div class="section-body"><pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:var(--fs-md)">${state.memories.context||'<span class="empty-text">暂无上下文记忆</span>'}</pre></div>
        </div>
        <div class="memory-section">
          <div class="section-header"><div class="section-title-row"><span class="section-icon">${SVG.history}</span><span class="section-title">情景记忆</span><button class="btn btn-xs btn-ghost" onclick="addMemoryEpisode()" style="margin-left:auto">添加</button></div></div>
          <div class="section-body">
            ${state.memories.episodes&&state.memories.episodes.length?state.memories.episodes.map((e,i)=>`<div style="padding:8px 0;border-bottom:1px solid var(--c-hairline-soft);display:flex;justify-content:space-between;align-items:start"><div style="flex:1"><div style="font-size:var(--fs-md)">${esc(e.content)}</div><div style="font-size:var(--fs-xs);color:var(--c-ink-muted)">${new Date(e.ts).toLocaleString()}</div></div><button class="btn btn-xs btn-ghost" style="color:var(--c-error);flex-shrink:0" onclick="deleteMemoryEpisode(${i})">删除</button></div>`).join(''):'<span class="empty-text">暂无情景记忆</span>'}
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
    <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">编辑${label}</h3>
    <textarea id="memEditVal" style="width:100%;min-height:200px;padding:12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);font-family:var(--font-mono);resize:vertical">${esc(val)}</textarea>
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
    <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">添加情景记忆</h3>
    <textarea id="memEpVal" style="width:100%;min-height:100px;padding:12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);resize:vertical" placeholder="输入要记住的内容…"></textarea>
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
  const workspacePath=data?.workspaceDir||'C:\Users\\Administrator\\Desktop\\Hermes Agent';
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
      <div class="memory-month-title">${esc(group.type)} <span>${(group.files||[]).length}</span></div>
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
      <div class="memory-crumb"><strong>记忆储存</strong></div>
      <div class="memory-workspace-path">工作区路径：<code>${esc(workspacePath)}</code></div>
      <button class="btn btn-sm btn-secondary" onclick="loadMemoryStore(true)">刷新</button>
    </div>
    <div class="memory-library">
      <aside class="memory-sidebar">
        <div class="memory-side-section">
          <div class="memory-side-heading"><div><strong>核心文件</strong><small>引导角色、身份和工具指南。</small></div></div>
          ${coreHtml||'<div class="memory-empty-small">核心记忆初始化中...</div>'}
        </div>
          <div class="memory-side-section agent-memory-filter">
            <div class="memory-side-heading"><div><strong>Agent 记忆</strong><small>按 Agent 查看关联记忆。</small></div></div>
            <div class="memory-agent-list">
              ${getProfiles().map(p=>`<button class="memory-agent-chip" onclick="openAgentMemory('${esc(p.id)}')">${profileAvatarHtml(p,'chat-agent-avatar')}<span>${esc(p.name)}</span></button>`).join('')}
            </div>
          </div>
          <div class="memory-side-section fill">
            <div class="memory-side-heading"><div><strong>历史对话文件</strong><small>按全部或类型查看。</small></div></div>
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

function openAgentMemory(id){
  const p=getProfiles().find(item=>item.id===id);
  if(!p) return;
  const dirs=agentDirs(p);
  const content=['# '+p.name+' Agent Memory','', '## Soul', dirs.soulDir, '', '## Memory', dirs.memoryDir, '', '## Workspace', dirs.workspaceDir, '', '## Knowledge', dirs.knowledgeDir, '', '> Agent-specific memory files will be stored under these folders.'].join('\n');
  state.memory.current={id:'agent-'+p.id,type:'agent',title:p.name+' Agent Memory',file:p.name+' Agent Memory',path:dirs.root,content,mtime:Date.now(),size:content.length};
  state.memory.selectedId='agent-'+p.id;
  state.memory.selectedType='agent';
  state.memory.mode='preview';
  renderPage();
}
renderMemory=renderMemoryLibrary;

function rememberMemoryReaderScroll(){
  const el=document.querySelector('.memory-reader-body');
  if(el) state.memory.readerScroll=el.scrollTop||0;
}
function restoreMemoryReaderScroll(){
  const top=state.memory.readerScroll||0;
  requestAnimationFrame(()=>{
    const el=document.querySelector('.memory-reader-body');
    if(el) el.scrollTop=top;
  });
}

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

async function loadMemoryStore(force, seq){
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

function apiFormatLabel(value){
  const map={
    'openai-chat':'OpenAI 兼容',
    'openai-image':'OpenAI 图像',
    'openai-video':'OpenAI 视频',
    'ollama':'Ollama / 本地',
    'anthropic_messages':'Anthropic Messages',
    'anthropic':'Anthropic Messages',
    'gemini':'Gemini'
  };
  return map[value] || value || 'OpenAI 兼容';
}
const MODEL_API_FORMATS=['openai-chat','openai-image','openai-video','ollama','anthropic_messages','gemini'];
function apiFormatOptionsHtml(selected='openai-chat'){
  return MODEL_API_FORMATS.map(v=>`<option value="${v}"${(selected||'openai-chat')===v?' selected':''}>${apiFormatLabel(v)}</option>`).join('');
}
function authTypeLabel(value, customHeader=''){
  const map={bearer:'Bearer Token','x-api-key':'x-api-key','api-key':'api-key',custom:customHeader||'Custom Header',none:'No Auth'};
  return map[value] || value || 'Bearer Token';
}
function inferModelTags(name){
  const text=String(name||'').toLowerCase();
  const tags=[];
  if(/video|sora|runway|kling|pika|veo|视频|生成视频/.test(text)) tags.push('video');
  if(/reason|r1|thinking|o1|o3|o4|deep|推理/.test(text)) tags.push('reasoning');
  if(/gpt-image|image|draw|sd|stable-diffusion|dall|flux|midjourney|生图|绘图|图像生成/.test(text)) tags.push('image');
  if(/vision|visual|omni|vl\b|gpt-4o|gemini|多模态|视觉|看图|识图/.test(text)) tags.push('vision');
  if(!tags.includes('chat') && !tags.includes('image') && !tags.includes('video')) tags.unshift('chat');
  return [...new Set(tags)];
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
        <h3 style="font-size:var(--fs-lg);font-weight:var(--fw-semibold);margin-bottom:16px">当前配置</h3>
        <div style="display:grid;gap:12px">
          <div style="display:flex;gap:12px">
            <div style="flex:1"><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">Provider</label><input id="mProvider" list="providerList" value="${esc(state.model.provider||'openai')}" style="width:100%;margin-top:4px" oninput="onProviderInput()">
            <datalist id="providerList">${providers.map(p=>`<option value="${p.name.toLowerCase()}">`).join('')}</datalist></div>
            <div style="flex:1;display:flex;gap:6px;align-items:flex-end"><div style="flex:1"><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">模型</label><input id="mModel" list="modelList" value="${esc(state.model.model)}" style="width:100%;margin-top:4px">
            <datalist id="modelList">${providerModels.map(m=>`<option value="${m}">`).join('')}</datalist></div>
            <button class="btn btn-secondary btn-sm" onclick="fetchModelsForCurrent()" title="获取模型" style="height:38px;flex-shrink:0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12a9 9 0 11-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
              获取
            </button></div>
          </div>
          <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">Base URL</label><input id="mBase" value="${esc(state.model.base)}" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">API Key</label><input id="mKey" type="password" value="${esc(state.model.key)}" style="width:100%;margin-top:4px"></div>
          <div style="display:flex;gap:12px">
            <div style="flex:1"><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">Temperature <span id="tVal">${state.model.temperature}</span></label><input id="mTemp" type="range" min="0" max="2" step="0.1" value="${state.model.temperature}" style="width:100%;margin-top:4px" oninput="document.getElementById('tVal').textContent=this.value"></div>
            <div style="flex:1"><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">Top P <span id="pVal">${state.model.topP}</span></label><input id="mTopP" type="range" min="0" max="1" step="0.1" value="${state.model.topP}" style="width:100%;margin-top:4px" oninput="document.getElementById('pVal').textContent=this.value"></div>
            <div style="flex:1"><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">Max Tokens</label><input id="mMax" type="number" value="${state.model.maxTokens}" style="width:100%;margin-top:4px"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary btn-sm" onclick="testModel()">测试连接</button><button class="btn btn-primary btn-sm" onclick="saveModel()">保存</button></div>
          <div id="modelMsg" style="font-size:var(--fs-sm);color:var(--c-ink-muted)"></div>
        </div>
      </div>
      <div class="card" style="margin-bottom:24px">
        <h3 style="font-size:var(--fs-lg);font-weight:var(--fw-semibold);margin-bottom:16px">获取模型</h3>
        <div style="display:grid;gap:12px">
          <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">API URL</label><input id="fetchUrl" placeholder="https://your-provider.example/v1/models" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted)">API Key</label><input id="fetchKey" type="password" placeholder="sk-..." style="width:100%;margin-top:4px"></div>
          <div style="display:flex;gap:8px;align-items:center"><button class="btn btn-accent btn-sm" onclick="fetchModels()">获取模型</button><span id="fetchMsg" style="font-size:var(--fs-sm);color:var(--c-ink-muted)"></span></div>
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
  apiPut('/api/models'+modelScopeParam(), body);
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
    list.innerHTML=data.models.map((m,i)=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-sm);cursor:pointer;font-size:var(--fs-md);transition:background var(--transition-fast)" onmouseover="this.style.background='var(--c-accent-soft)'" onmouseout="this.style.background='transparent'"><input type="checkbox" class="fetch-model-cb" value="${esc(typeof m==='string'?m:m.id||'')}" data-name="${esc(typeof m==='string'?m:m.id||'')}">${esc(typeof m==='string'?m:JSON.stringify(m))}</label>`).join('');
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
  const cfg=activeModelsConfig();
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
            <input id="mBase" placeholder="Base URL, /v1, or full /v1/chat/completions" value="${esc(state.model.base||'')}">
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


function inferModelKind(model = {}) {
  const tags = modelTags(model);
  if ((model.apiFormat || '') === 'openai-video' || tags.includes('video')) return 'video';
  if ((model.apiFormat || '') === 'openai-image' || tags.includes('image')) return 'image';
  if (tags.includes('vision') || model.kind === 'vision') return 'vision';
  return 'chat';
}
function scenarioKeyForModel(model = {}) {
  const kind = inferModelKind(model);
  if (kind === 'video') return 'video';
  if (kind === 'image') return 'image';
  if (kind === 'vision') return 'vision';
  const tags = modelTags(model);
  if (tags.includes('reasoning')) return 'reasoning';
  return 'chat';
}
function toggleSecretInput(id){
  const input=$('#'+id);
  if(!input) return;
  input.type=input.type==='password'?'text':'password';
}

function renderModels(){
  const cfg=activeModelsConfig();
  const lib=Array.isArray(cfg.library)?cfg.library:[];
  const scenarios=[
    {key:'chat',title:'\u666e\u901a\u5bf9\u8bdd',desc:'\u9ed8\u8ba4\u804a\u5929\u3001\u65e5\u5e38\u95ee\u7b54\u548c\u8f7b\u91cf\u4efb\u52a1\u3002'},
    {key:'reasoning',title:'\u6df1\u5ea6\u63a8\u7406',desc:'\u590d\u6742\u5206\u6790\u3001\u89c4\u5212\u548c\u957f\u94fe\u8def\u4efb\u52a1\u3002'},
    {key:'vision',title:'\u56fe\u7247\u8bc6\u522b',desc:'\u770b\u56fe\u3001\u8bc6\u56fe\u548c\u591a\u6a21\u6001\u56fe\u7247\u5206\u6790\u3002'},
    {key:'image',title:'\u56fe\u50cf\u751f\u6210',desc:'\u7ed8\u56fe\u3001\u6539\u56fe\u548c\u56fe\u7247 Prompt \u5de5\u4f5c\u6d41\u3002'},
    {key:'video',title:'\u751f\u6210\u89c6\u9891',desc:'\u6587\u751f\u89c6\u9891\u3001\u77ed\u7247\u548c\u52a8\u6001\u521b\u610f\u751f\u6210\u3002'},
    {key:'fallback',title:'\u5931\u8d25\u9000\u56de',desc:'\u4e3b\u6a21\u578b\u4e0d\u53ef\u7528\u65f6\u81ea\u52a8\u515c\u5e95\u3002'}
  ];
  const currentScope=activeModelScope();
  const enabledLib=lib.filter(m=>m.enabled!==false);
  const scopedEnabled=allScopedModels().filter(m=>m.enabled!==false);
  const modelsForScenario=(key)=>{
    if(key==='image') return enabledLib.filter(isImageGenerationModel);
    if(key==='video') return dedupeModels([
      ...enabledLib.filter(isVideoGenerationModel).map(m=>({...m,_scope:currentScope})),
      ...scopedEnabled.filter(isVideoGenerationModel)
    ]);
    if(key==='vision') return enabledLib.filter(isVisionChatModel);
    return enabledLib.filter(isChatSelectableModel);
  };
  const optionHtml=(selected,key)=>`<option value="">选择模型</option>`+modelsForScenario(key).map(m=>{
    const shared=m._scope&&m._scope!==currentScope?' · Agent共享':'';
    return `<option value="${esc(m.id)}"${selected===m.id?' selected':''}>${esc(m.name)} · ${esc(m.provider||'custom')}${shared}</option>`;
  }).join('');
  const cards=scenarios.map(item=>{
    const selected=scenarioModel(item.key);
    const list=modelsForScenario(item.key);
    const warning=item.key==='image'&&!list.length?'<div class="scenario-warning">\u8bf7\u5148\u6dfb\u52a0\u63a5\u53e3\u683c\u5f0f\u4e3a OpenAI \u56fe\u50cf\u7684\u6a21\u578b\u3002</div>':(item.key==='video'&&!list.length?'<div class="scenario-warning">\u8bf7\u5148\u6dfb\u52a0\u89c6\u9891\u751f\u6210\u6a21\u578b\u3002</div>':(item.key==='vision'&&!list.length?'<div class="scenario-warning">\u8bf7\u5148\u6dfb\u52a0\u5e26 vision \u6807\u7b7e\u6216\u591a\u6a21\u6001\u540d\u79f0\u7684\u804a\u5929\u6a21\u578b\u3002</div>':''));
    return `<div class="scenario-card"><div><strong>${esc(item.title)}</strong><p>${esc(item.desc)}</p></div><select onchange="setScenarioModel('${item.key}',this.value)">${optionHtml(selected,item.key)}</select>${warning}</div>`;
  }).join('');
  const groups={};
  lib.forEach(m=>{ const k=m.provider||'Custom'; (groups[k]||(groups[k]=[])).push(m); });
  const modelRow=(m)=>{
    const enabled=m.enabled!==false;
    const tags=(m.tags||[]).slice(0,5).map(t=>`<span>${esc(t)}</span>`).join('');
    const kindLabel={chat:'\u5bf9\u8bdd',vision:'\u8bc6\u56fe',image:'\u751f\u56fe',video:'\u89c6\u9891'}[inferModelKind(m)]||'\u5bf9\u8bdd';
    return `<div class="model-lib-item model-lib-item-rich ${enabled?'':'disabled'}"><label class="toggle model-card-toggle" title="${enabled?'\u505c\u7528\u6a21\u578b':'\u542f\u7528\u6a21\u578b'}" onclick="event.stopPropagation()"><input type="checkbox" ${enabled?'checked':''} onchange="toggleLibraryModel('${esc(m.id)}',this.checked)"><span class="toggle-slider"></span></label><div class="model-lib-main"><div class="model-lib-name-row"><strong>${esc(m.name)}</strong><span class="model-status-pill ${enabled?'on':'off'}">${enabled?'\u542f\u7528':'\u505c\u7528'}</span><span class="model-status-pill">${kindLabel}</span></div><small>${esc(m.provider||'custom')} \u00b7 ${esc(apiFormatLabel(m.apiFormat||'openai-chat'))} \u00b7 ${esc(m.base||'\u672a\u586b\u5199\u5730\u5740')}</small><div class="model-lib-meta">${tags}</div></div><div class="model-lib-actions"><button class="btn btn-xs btn-secondary" onclick="editLibraryModel('${esc(m.id)}')">\u7f16\u8f91</button><button class="btn btn-xs btn-secondary" id="modelTestBtn_${domId(m.id)}" onclick="testLibraryModel('${esc(m.id)}')">\u6d4b\u8bd5</button><button class="btn btn-xs btn-ghost danger" onclick="deleteLibraryModel('${esc(m.id)}')">\u5220\u9664</button></div></div>`;
  };
  const groupHtml=Object.entries(groups).map(([provider,items])=>`<div class="model-provider-group"><div class="model-provider-title"><strong>${esc(provider)}</strong><span>${items.length}</span><div class="model-provider-actions"><button class="btn btn-xs btn-secondary" onclick="testProviderModels('${esc(provider)}')">\u6d4b\u8bd5</button><button class="btn btn-xs btn-secondary" onclick="editProviderModels('${esc(provider)}')">\u7f16\u8f91</button></div></div><div class="model-provider-body">${items.map(modelRow).join('')}</div></div>`).join('');
  return `<div class="models-view"><div class="page-header"><h2>\u6a21\u578b\u914d\u7f6e</h2><div style="display:flex;gap:8px;align-items:center"><span class="model-scope-pill">\u5f53\u524d\u914d\u7f6e\uff1a${activeModelScope()==='webui'?'WebUI \u4e13\u7528':'Agent \u5171\u4eab'}</span><button class="btn btn-sm btn-primary" onclick="addModelModal()">\u6dfb\u52a0\u6a21\u578b</button></div></div><div class="models-content model-v15-content"><section class="model-panel model-scenario-panel"><h3>\u5e94\u7528\u573a\u666f</h3><p>\u914d\u7f6e\u666e\u901a\u5bf9\u8bdd\u3001\u6df1\u5ea6\u63a8\u7406\u3001\u56fe\u7247\u8bc6\u522b\u3001\u56fe\u50cf\u751f\u6210\u3001\u89c6\u9891\u751f\u6210\u548c\u5931\u8d25\u9000\u56de\u4f7f\u7528\u7684\u9ed8\u8ba4\u6a21\u578b\u3002</p><div class="scenario-card-grid">${cards}</div></section><div class="model-main-layout"><section class="model-panel model-fetch-panel"><h3>\u83b7\u53d6\u6a21\u578b</h3><p>\u4ece Provider \u62c9\u53d6\u6a21\u578b\u5217\u8868\uff0c\u52fe\u9009\u540e\u52a0\u5165\u6a21\u578b\u5e93\uff1b\u56fe\u50cf/\u89c6\u9891\u6a21\u578b\u4f1a\u6309\u540d\u79f0\u4e0e\u63a5\u53e3\u683c\u5f0f\u81ea\u52a8\u5206\u7c7b\u3002</p><div class="model-connector-grid"><label><span class="model-field-label">Provider</span><input id="mProvider" placeholder="\u5982 xiaomi / deepseek / openai" value="${esc(state.model.provider||'')}" oninput="applyProviderPreset()"></label><label class="model-field-wide"><span class="model-field-label">API Key</span><span class="secret-input-wrap"><input id="mKey" type="password" placeholder="sk-..." value="${esc(state.model.key||'')}"><button type="button" class="secret-eye-btn" onclick="toggleSecretInput('mKey')">&#128065;</button></span></label><label class="model-field-wide"><span class="model-field-label">API \u5730\u5740</span><input id="mBase" placeholder="\u5982 https://api.openai.com/v1" value="${esc(state.model.base||'')}"></label><label><span class="model-field-label">\u63a5\u53e3\u683c\u5f0f</span><select id="mApiFormat" onchange="applyApiFormatPreset()"><option value="openai-chat">OpenAI \u5bf9\u8bdd</option><option value="openai-image">OpenAI \u56fe\u50cf</option><option value="openai-video">OpenAI \u89c6\u9891</option><option value="ollama">Ollama / \u672c\u5730</option><option value="anthropic_messages">Anthropic Messages</option><option value="gemini">Gemini</option></select></label><div id="mFormatHint" class="model-format-hint">\u63d0\u793a\uff1aDeepSeek\u3001OpenAI \u517c\u5bb9\u670d\u52a1\u901a\u5e38\u586b\u5199 API Key \u548c /v1 \u5730\u5740\u3002</div><button class="btn btn-secondary" id="fetchModelsBtn" onclick="fetchModelsForLibrary()">\u83b7\u53d6\u6a21\u578b</button></div><div id="modelMsg" class="model-msg"></div><div id="fetchModelsList" class="model-fetch-list" style="display:none"><div class="model-fetch-actions"><button class="btn btn-xs btn-secondary" onclick="selectAllFetchModels()">\u5168\u9009</button><button class="btn btn-xs btn-secondary" onclick="deselectAllFetchModels()">\u53d6\u6d88\u5168\u9009</button><button class="btn btn-xs btn-primary" onclick="addSelectedFetchedModels()">\u52a0\u5165\u6a21\u578b\u5e93</button></div><div id="fetchModelsItems"></div></div></section><section class="model-panel model-library-panel"><h3>\u6a21\u578b\u5e93</h3><p>\u6309 Provider \u5206\u7ec4\u7ba1\u7406\u6a21\u578b\uff0c\u53ef\u542f\u7528\u3001\u6d4b\u8bd5\u3001\u7f16\u8f91\u6216\u5220\u9664\u3002</p><div class="model-lib-list">${lib.length?groupHtml:'<div class="model-empty-state"><strong>\u6682\u65e0\u6a21\u578b</strong><span>\u8bf7\u5148\u6dfb\u52a0\u6216\u83b7\u53d6\u6a21\u578b\u3002</span><button class="btn btn-sm btn-primary" onclick="addModelModal()">\u6dfb\u52a0\u6a21\u578b</button></div>'}</div></section></div></div></div>`;
}

function domId(value){return String(value||'').replace(/[^a-zA-Z0-9_-]/g,'_')}
function toggleLibraryModel(id,on){
  const cfg=activeModelsConfig();
  const item=(cfg.library||[]).find(m=>m.id===id);
  if(item){item.enabled=on;persistModelsConfig(cfg).then(()=>renderPage())}
}
function toggleCustomAuthHeader(prefix='m'){
  const auth=$('#'+prefix+'AuthType');
  const input=$('#'+prefix+'AuthHeader');
  if(input) input.style.display=auth?.value==='custom'?'block':'none';
}
function updateModelFormatHint(prefix='m'){
  const hint=$('#'+prefix+'FormatHint');
  if(!hint) return;
  const values=modelFormValues(prefix);
  const notes=[];
  if(values.apiFormat==='openai-image') notes.push('\u7528\u4e8e\u56fe\u50cf\u751f\u6210\u6a21\u578b\uff0c\u4f1a\u81ea\u52a8\u5f52\u5165\u56fe\u50cf\u751f\u6210\u573a\u666f\u3002');
  if(values.apiFormat==='openai-video') notes.push('\u7528\u4e8e\u89c6\u9891\u751f\u6210\u6a21\u578b\uff0c\u4f1a\u81ea\u52a8\u5f52\u5165\u751f\u6210\u89c6\u9891\u573a\u666f\u3002');
  if(values.apiFormat==='ollama') notes.push('Ollama usually needs no API Key; default endpoint is http://127.0.0.1:11434.');
  if(values.apiFormat==='anthropic_messages') notes.push('Claude / Anthropic uses x-api-key and Messages API.');
  hint.textContent=notes.join(' ');
}
function applyApiFormatPreset(prefix='m'){
  const fmt=$('#'+prefix+'ApiFormat')?.value||'openai-chat';
  const base=$('#'+prefix+'Base');
  const auth=$('#'+prefix+'AuthType');
  if(fmt==='ollama'){
    if(base&&!base.value) base.value='http://127.0.0.1:11434';
    if(auth) auth.value='none';
  }else if(fmt==='anthropic'||fmt==='anthropic_messages'){
    if(base&&!base.value) base.value='https://api.anthropic.com';
    if(auth) auth.value='x-api-key';
  }else if(fmt==='gemini'){
    if(base&&!base.value) base.value='https://generativelanguage.googleapis.com';
    if(auth) auth.value='x-api-key';
  }else{
    if(auth&&auth.value==='none') auth.value='bearer';
  }
  toggleCustomAuthHeader(prefix);
  if(typeof updateModelFormatHint==='function') updateModelFormatHint(prefix);
}
function applyProviderPreset(prefix='m'){
  const provider=$('#'+prefix+'Provider')?.value||'';
  const fmt=$('#'+prefix+'ApiFormat');
  const auth=$('#'+prefix+'AuthType');
  if(/ollama/i.test(provider)){
    if(fmt) fmt.value='ollama';
    if(auth) auth.value='none';
  }else if(/anthropic|claude/i.test(provider)){
    if(fmt) fmt.value='anthropic_messages';
    if(auth) auth.value='x-api-key';
  }else if(/new\s*api|one\s*api|openai|deepseek|siliconflow|openrouter|xiaomi|mimo|mi\s*model|gateway|relay/i.test(provider)){
    if(fmt) fmt.value='openai-chat';
    if(auth) auth.value='bearer';
  }
  applyApiFormatPreset(prefix);
}
function modelFormValues(prefix='m'){
  return {
    provider:$('#'+prefix+'Provider')?.value?.trim()||'custom',
    base:$('#'+prefix+'Base')?.value?.trim()||'',
    key:$('#'+prefix+'Key')?.value||'',
    apiFormat:$('#'+prefix+'ApiFormat')?.value||'openai-chat',
    authType:$('#'+prefix+'AuthType')?.value||'bearer',
    authHeader:$('#'+prefix+'AuthHeader')?.value?.trim()||'',
  };
}
async function fetchModelsForLibrary(){
  const values=modelFormValues('m');
  const msg=$('#modelMsg');
  const btn=$('#fetchModelsBtn');
  if(!values.base){toast('请填写 API 请求地址','error');return}
  if(!values.key && values.authType!=='none'){toast('请填写 API Key','error');return}
  if(msg) msg.textContent='正在获取模型列表...';
  if(btn){btn.disabled=true;btn.textContent='获取中...'}
  try{
    const r=await fetch(apiBase()+'/api/models/fetch-remote',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify(values)});
    const j=await r.json().catch(()=>({}));
    const data=j.code===0?j.data:null;
    if(!data||!data.models?.length){
      if(msg) msg.textContent=(j.msg||'没有获取到模型，请检查 API 请求地址、API Key 或服务商兼容格式。');
      return;
    }
    state._fetchedModels={...values,models:data.models.map(m=>typeof m==='string'?m:(m.id||m.name||''))};
    const box=$('#fetchModelsList'), items=$('#fetchModelsItems');
    if(box) box.style.display='block';
    if(items) items.innerHTML=state._fetchedModels.models.filter(Boolean).map(name=>`<label class="model-fetch-item"><input type="checkbox" class="fetch-model-cb" value="${esc(name)}" checked><span>${esc(name)}</span></label>`).join('');
    if(msg) msg.textContent='已获取 '+data.models.length+' 个模型，请选择后添加到模型库。';
    state.model={...state.model,provider:values.provider,base:values.base,key:values.key};
    save();
  }catch(e){
    if(msg) msg.textContent='获取失败： '+e.message;
  }finally{
    if(btn){btn.disabled=false;btn.textContent='获取模型'}
  }
}

function classifyFetchedModel(name, apiFormat='openai-chat'){
  const tags=[...new Set([...(inferModelTags(name)), ...(apiFormat==='openai-image'?['image']:[]), ...(apiFormat==='openai-video'?['video']:[])])];
  const kind=apiFormat==='openai-image'?'image':(apiFormat==='openai-video'?'video':(tags.includes('image')?'image':(tags.includes('video')?'video':(tags.includes('vision')?'vision':'chat'))));
  return { tags, kind };
}

async function addSelectedFetchedModels(){
  const selected=[...document.querySelectorAll('.fetch-model-cb:checked')].map(c=>c.value);
  const f=state._fetchedModels;
  if(!f||!selected.length){toast('请选择要添加的模型','info');return}
  const cfg=activeModelsConfig();
  const existing=new Map((cfg.library||[]).map(m=>[m.id,m]));
  selected.forEach(name=>{
    const { tags, kind } = classifyFetchedModel(name, f.apiFormat);
    existing.set(f.provider+':'+name,{
      id:f.provider+':'+name,provider:f.provider,name,base:f.base,key:f.key,enabled:true,
      tags,kind,apiFormat:f.apiFormat,authType:f.authType,authHeader:f.authHeader,
    });
  });
  cfg.library=[...existing.values()];
  cfg.current=cfg.current||f.provider+':'+selected[0];
  cfg.scenarios={...(cfg.scenarios||{})};
  const byKind = selected.map(name => ({ name, id: f.provider+':'+name, ...classifyFetchedModel(name, f.apiFormat) }));
  const firstChat = byKind.find(item => item.kind === 'chat');
  const firstReasoning = byKind.find(item => item.tags.includes('reasoning') && item.kind === 'chat');
  const firstVision = byKind.find(item => item.kind === 'vision');
  const firstImage = byKind.find(item => item.kind === 'image');
  const firstVideo = byKind.find(item => item.kind === 'video');
  if(firstChat && !cfg.scenarios.chat) cfg.scenarios.chat = firstChat.id;
  if(firstReasoning && !cfg.scenarios.reasoning) cfg.scenarios.reasoning = firstReasoning.id;
  if(firstVision && !cfg.scenarios.vision) cfg.scenarios.vision = firstVision.id;
  if(firstImage && !cfg.scenarios.image) cfg.scenarios.image = firstImage.id;
  if(firstVideo && !cfg.scenarios.video) cfg.scenarios.video = firstVideo.id;
  if(!cfg.scenarios.chat && byKind.length && byKind[0].kind !== 'image' && byKind[0].kind !== 'video') cfg.scenarios.chat = byKind[0].id;
  const data=await persistModelsConfig(cfg);
  if(!data) return;
  toast('已添加 '+selected.length+' 个模型','success');
  renderPage();
}


function fetchedModelNames(models=[]){
  const seen=new Set();
  return (models||[]).map(m=>typeof m==='string'?m:(m?.id||m?.name||'')).map(name=>String(name||'').trim()).filter(Boolean).filter(name=>{
    const key=name.toLowerCase();
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function modelIdFor(provider,name){
  return `${provider||'custom'}:${name}`;
}

function modelNameForMerge(model){
  return String(model?.name||model?.id||'').trim();
}

function applyModelIdMap(cfg,idMap){
  if(!idMap?.size) return;
  if(idMap.has(cfg.current)) cfg.current=idMap.get(cfg.current);
  cfg.scenarios={...(cfg.scenarios||{})};
  Object.keys(cfg.scenarios).forEach(key=>{
    if(idMap.has(cfg.scenarios[key])) cfg.scenarios[key]=idMap.get(cfg.scenarios[key]);
  });
}

function syncProviderConnectionModels(cfg, originalProvider, values){
  const provider=values.provider||'custom';
  const idMap=new Map();
  const merged=new Map();
  (cfg.library||[]).forEach(model=>{
    const fromProvider=(model.provider||'Custom')===(originalProvider||'Custom');
    const name=modelNameForMerge(model);
    const next=fromProvider
      ? {...model,id:modelIdFor(provider,name),provider,base:values.base,key:values.key,apiFormat:values.apiFormat,authType:values.authType,authHeader:values.authHeader}
      : {...model};
    if(fromProvider && model.id && model.id!==next.id) idMap.set(model.id,next.id);
    const key=String(next.id||modelIdFor(next.provider||'custom',modelNameForMerge(next))).toLowerCase();
    merged.set(key,{...(merged.get(key)||{}),...next});
  });
  cfg.library=[...merged.values()];
  applyModelIdMap(cfg,idMap);
  return idMap;
}

function upsertFetchedModelIntoLibrary(library,name,values){
  const provider=values.provider||'custom';
  const id=modelIdFor(provider,name);
  const providerNameKey=`${provider.toLowerCase()}::${String(name).toLowerCase()}`;
  let index=library.findIndex(item=>item.id===id);
  if(index<0) index=library.findIndex(item=>`${String(item.provider||'custom').toLowerCase()}::${String(item.name||'').toLowerCase()}`===providerNameKey);
  const old=index>=0?library[index]:null;
  const classified=classifyFetchedModel(name, values.apiFormat);
  const tags=[...new Set((old?.tags?.length?old.tags:classified.tags)||[])];
  if(values.apiFormat==='openai-image'&&!tags.includes('image')) tags.push('image');
  if(values.apiFormat==='openai-video'&&!tags.includes('video')) tags.push('video');
  const kind=values.apiFormat==='openai-image'?'image':(values.apiFormat==='openai-video'?'video':(tags.includes('image')?'image':(tags.includes('video')?'video':(tags.includes('vision')?'vision':'chat'))));
  const next={...(old||{}),id,provider,name,base:values.base,key:values.key,enabled:old?old.enabled!==false:true,tags,kind,apiFormat:values.apiFormat,authType:values.authType,authHeader:values.authHeader};
  if(index>=0){
    library[index]=next;
    return 'updated';
  }
  library.push(next);
  return 'added';
}

function fillScenarioDefaultsFromFetched(cfg,names,values){
  cfg.scenarios={...(cfg.scenarios||{})};
  const byKind=names.map(name=>({name,id:modelIdFor(values.provider||'custom',name),...classifyFetchedModel(name,values.apiFormat)}));
  const firstChat=byKind.find(item=>item.kind==='chat');
  const firstReasoning=byKind.find(item=>item.tags.includes('reasoning')&&item.kind==='chat');
  const firstVision=byKind.find(item=>item.kind==='vision');
  const firstImage=byKind.find(item=>item.kind==='image');
  const firstVideo=byKind.find(item=>item.kind==='video');
  if(firstChat&&!cfg.scenarios.chat) cfg.scenarios.chat=firstChat.id;
  if(firstReasoning&&!cfg.scenarios.reasoning) cfg.scenarios.reasoning=firstReasoning.id;
  if(firstVision&&!cfg.scenarios.vision) cfg.scenarios.vision=firstVision.id;
  if(firstImage&&!cfg.scenarios.image) cfg.scenarios.image=firstImage.id;
  if(firstVideo&&!cfg.scenarios.video) cfg.scenarios.video=firstVideo.id;
  if(!cfg.scenarios.chat&&byKind.length&&byKind[0].kind!=='image'&&byKind[0].kind!=='video') cfg.scenarios.chat=byKind[0].id;
}

function selectedEditorFetchedModels(){
  return [...document.querySelectorAll('.editor-fetch-model-cb:checked')].map(c=>c.value).filter(Boolean);
}

function editorFetchVisibleCheckboxes(){
  return [...document.querySelectorAll('.editor-fetch-model-cb')].filter(c=>!c.closest('.model-fetch-item')?.hidden);
}

function selectedVisibleEditorFetchedModels(){
  return editorFetchVisibleCheckboxes().filter(c=>c.checked).map(c=>c.value).filter(Boolean);
}

function updateEditorFetchSelectedCount(){
  const count=$('#editorFetchSelectedCount');
  if(count) count.textContent=selectedEditorFetchedModels().length;
  const hint=$('#editorFetchVisibleHint');
  if(hint){
    const visible=editorFetchVisibleCheckboxes().length;
    const total=document.querySelectorAll('.editor-fetch-model-cb').length;
    hint.textContent=visible===total?`共 ${total} 个`:`当前显示 ${visible}/${total} 个`;
  }
}

function selectAllEditorFetchModels(){
  editorFetchVisibleCheckboxes().forEach(c=>c.checked=true);
  updateEditorFetchSelectedCount();
}

function deselectAllEditorFetchModels(){
  editorFetchVisibleCheckboxes().forEach(c=>c.checked=false);
  updateEditorFetchSelectedCount();
}

function filterEditorFetchedModels(){
  const q=($('#editorFetchSearch')?.value||'').trim().toLowerCase();
  let visible=0;
  document.querySelectorAll('#addFetchModelsList .model-fetch-item.remote').forEach(row=>{
    const name=(row.dataset.modelName||row.querySelector('.model-fetch-name')?.textContent||'').toLowerCase();
    const show=!q||name.includes(q);
    row.hidden=!show;
    row.style.display=show?'':'none';
    if(show) visible++;
  });
  const empty=$('#editorFetchEmpty');
  if(empty) empty.style.display=visible?'none':'block';
  updateEditorFetchSelectedCount();
}

function renderEditorFetchedModels(){
  if($('#providerModelMapRows')){
    renderProviderMappingRemoteSelectors();
    return;
  }
  const box=$('#addFetchModelsList');
  const fetched=state._editorFetchedModels;
  if(!box||!fetched) return;
  const prevQuery=$('#editorFetchSearch')?.value||'';
  const values=modelFormValues('addModel');
  const existing=new Set(providerModels(values.provider||fetched.provider||'custom').map(item=>String(item.name||item.id||'').toLowerCase()));
  const rows=(fetched.models||[]).map(name=>{
    const exists=existing.has(String(name).toLowerCase());
    const classified=classifyFetchedModel(name, values.apiFormat||fetched.apiFormat);
    const kindLabel={chat:'对话',vision:'识图',image:'生图',video:'视频'}[classified.kind]||'对话';
    return `<label class="model-fetch-item remote ${exists?'is-existing':''}" data-model-name="${esc(name)}" title="${esc(name)}"><input type="checkbox" class="editor-fetch-model-cb" value="${esc(name)}" ${exists?'':'checked'} onchange="updateEditorFetchSelectedCount()"><span class="model-fetch-name">${esc(name)}</span><span class="model-fetch-badges"><em>${esc(kindLabel)}</em>${exists?'<em>已添加</em>':''}</span></label>`;
  }).join('');
  const existingCount=(fetched.models||[]).filter(name=>existing.has(String(name).toLowerCase())).length;
  box.style.display='block';
  box.innerHTML=`<div class="model-fetch-toolbar"><div class="model-fetch-summary"><strong>远端返回 ${fetched.models.length} 个模型</strong><span>${existingCount?`${existingCount} 个已在当前 Provider 中`: '可直接勾选加入模型库'}</span></div><div class="model-fetch-toolbar-actions"><button type="button" class="btn btn-xs btn-secondary" onclick="selectAllEditorFetchModels()">全选当前</button><button type="button" class="btn btn-xs btn-secondary" onclick="deselectAllEditorFetchModels()">取消当前</button><button type="button" class="btn btn-xs btn-secondary" onclick="applySelectedFetchedModelToEditor()">填入选中</button><button type="button" class="btn btn-xs btn-primary" onclick="addSelectedEditorFetchedModels()">加入选中模型</button></div></div><div class="model-fetch-search-row"><input id="editorFetchSearch" placeholder="搜索远端模型名称" value="${esc(prevQuery)}" oninput="filterEditorFetchedModels()"></div><div class="model-fetch-selected">已选择 <strong id="editorFetchSelectedCount">0</strong> 个模型 <span id="editorFetchVisibleHint"></span></div><div id="editorFetchEmpty" class="model-fetch-empty">没有匹配的远端模型</div><div class="model-fetch-remote-list">${rows}</div>`;
  filterEditorFetchedModels();
}

function applyFetchedModelToEditor(name){
  const input=document.getElementById('addModelName');
  if(input) input.value=name;
  const apiFormat=document.getElementById('addModelApiFormat')?.value||'openai-chat';
  const classified=classifyFetchedModel(name, apiFormat);
  document.querySelectorAll('.addModelTag').forEach(cb=>{ cb.checked=classified.tags.includes(cb.value); });
  if(classified.kind==='image') document.querySelectorAll('.addModelTag[value="image"]').forEach(cb=>{ cb.checked=true; });
  if(classified.kind==='video') document.querySelectorAll('.addModelTag[value="video"]').forEach(cb=>{ cb.checked=true; });
  if(classified.kind==='vision') document.querySelectorAll('.addModelTag[value="vision"]').forEach(cb=>{ cb.checked=true; });
}

function applySelectedFetchedModelToEditor(){
  const selected=selectedVisibleEditorFetchedModels();
  const fallback=selectedEditorFetchedModels();
  const name=selected[0] || fallback[0] || state._editorFetchedModels?.models?.[0] || '';
  if(!name){toast('请选择要填入的模型','info');return}
  applyFetchedModelToEditor(name);
  toast('已填入：'+name,'success');
}

async function fetchModelsFromEditor(){
  const values=modelFormValues('addModel');
  const btn=$('#addFetchModelsBtn');
  if(!values.base){toast('\u8bf7\u586b\u5199 API \u8bf7\u6c42\u5730\u5740','error');return}
  if(!values.key && values.authType!=='none'){toast('\u8bf7\u586b\u5199 API Key','error');return}
  const summary=$('#providerModelMapFetchSummary');
  if(summary){
    summary.dataset.tone='loading';
    summary.style.display='block';
    summary.textContent='正在获取模型列表...';
  }
  if(btn){btn.disabled=true;btn.textContent='\u83b7\u53d6\u4e2d...'}
  try{
    const r=await fetch(apiBase()+'/api/models/fetch-remote',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify(values)});
    const j=await r.json().catch(()=>({}));
    const data=j.code===0?j.data:null;
    if(!data||!data.models?.length){
      const msg=j.msg||'\u6ca1\u6709\u83b7\u53d6\u5230\u6a21\u578b';
      if(summary){summary.dataset.tone='error';summary.style.display='block';summary.textContent=msg}
      toast(msg,'error');
      return;
    }
    state._editorFetchedModels={...values,models:fetchedModelNames(data.models)};
    if(!state._editorFetchedModels.models.length){
      const msg=j.msg||'没有获取到可用模型名';
      if(summary){summary.dataset.tone='error';summary.style.display='block';summary.textContent=msg}
      toast(msg,'error');
      return;
    }
    renderEditorFetchedModels();
    const count=state._editorFetchedModels.models.length;
    if(summary){
      summary.dataset.tone='success';
      summary.style.display='block';
      summary.textContent=`已获取 ${count} 个远端模型；点击“实际请求模型”右侧箭头选择。`;
    }
    toast(`已获取 ${count} 个模型`,'success');
  }catch(e){
    const msg='\u83b7\u53d6\u5931\u8d25\uff1a'+e.message;
    if(summary){summary.dataset.tone='error';summary.style.display='block';summary.textContent=msg}
    toast(msg,'error');
  }
  finally{if(btn){btn.disabled=false;btn.textContent=btn.dataset.idleText||'\u83b7\u53d6\u6a21\u578b'}}
}

async function addSelectedEditorFetchedModels(){
  const fetched=state._editorFetchedModels;
  const selected=selectedEditorFetchedModels();
  if(!fetched||!selected.length){toast('请选择要加入的模型','info');return}
  const values=modelFormValues('addModel');
  if(!values.base&&values.apiFormat!=='ollama'){toast('请填写 API 请求地址','error');return}
  if(!values.key&&values.authType!=='none'){toast('请填写 API Key','error');return}
  const cfg=activeModelsConfig();
  cfg.library=[...(cfg.library||[])];
  const ctx=state._modelEditorContext||{};
  if(ctx.providerEdit) syncProviderConnectionModels(cfg, ctx.originalProvider||values.provider, values);
  let added=0,updated=0;
  selected.forEach(name=>{
    const result=upsertFetchedModelIntoLibrary(cfg.library,name,values);
    if(result==='added') added++;
    else updated++;
  });
  cfg.current=cfg.current||modelIdFor(values.provider||'custom',selected[0]);
  fillScenarioDefaultsFromFetched(cfg,selected,values);
  const data=await persistModelsConfig(cfg);
  if(!data) return;
  state.model={...state.model,provider:values.provider,model:selected[0],base:values.base,key:values.key};
  save();
  closeModal();
  renderPage();
  toast(`已加入 ${added} 个，更新 ${updated} 个模型`,'success');
}

function addModelModal(){openModelEditor()}

function editorRemoteModelOptionsHtml(selected=''){
  const names=state._editorFetchedModels?.models||[];
  if(!names.length) return '';
  const selectedKey=String(selected||'').toLowerCase();
  const current=names.find(name=>String(name).toLowerCase()===selectedKey)||'';
  return `<button type="button" class="provider-model-remote-trigger" title="选择远端模型（已加载 ${names.length} 个）" aria-label="选择远端模型" onclick="toggleProviderModelRemoteMenu(this,event)">
      <span class="provider-model-remote-current">${current?esc(current):'选择'}</span>
      <span class="provider-model-remote-chevron">⌄</span>
    </button>
    <div class="provider-model-remote-menu" hidden>
      ${names.map(name=>`<button type="button" class="provider-model-remote-option${String(name).toLowerCase()===selectedKey?' active':''}" data-model-name="${esc(name)}" onclick="chooseRemoteModelForMappingRow(this,event)">${esc(name)}</button>`).join('')}
    </div>`;
}

function providerModelMappingRowHtml(item={}, index=''){
  const rowId=index||String(Date.now());
  const name=item.name||'';
  const apiFormat=item.apiFormat||'openai-chat';
  return `<div class="provider-model-map-row" data-row-id="${esc(rowId)}" data-model-id="${esc(item.id||'')}" data-enabled="${item.enabled===false?'0':'1'}" data-original-api-format="${esc(apiFormat)}">
    <div class="provider-model-name-cell">
      <input class="provider-model-name-input" placeholder="实际请求模型" value="${esc(name)}">
      <span class="provider-model-remote-slot">${editorRemoteModelOptionsHtml(name)}</span>
    </div>
    <select class="provider-model-api-format">${apiFormatOptionsHtml(apiFormat)}</select>
    <button type="button" class="btn btn-xs btn-ghost danger provider-model-delete" onclick="removeProviderModelMappingRow(this)">删除</button>
  </div>`;
}

function providerEditModelListHtml(model){
  if(!model?._providerEdit) return '';
  const items=providerModels(model.provider||'Custom');
  const rows=items.map((item,index)=>providerModelMappingRowHtml(item,index)).join('');
  return `<section class="wide provider-model-map">
    <div class="provider-model-map-head">
      <strong>模型映射</strong>
      <div class="provider-model-map-actions">
        <button type="button" class="btn btn-sm btn-secondary" id="addFetchModelsBtn" data-idle-text="获取模型列表" onclick="fetchModelsFromEditor()">获取模型列表</button>
        <button type="button" class="btn btn-sm btn-primary" onclick="addProviderModelMappingRow()">添加模型</button>
      </div>
    </div>
    <div class="provider-model-map-labels"><span>实际请求模型</span><span>接口格式</span><span>操作</span></div>
    <div id="providerModelMapRows" class="provider-model-map-rows">${rows||'<div class="provider-model-map-empty">还没有模型，点击“添加模型”新建一行。</div>'}</div>
    <div id="providerModelMapFetchSummary" class="provider-model-fetch-summary" style="display:none"></div>
  </section>`;
}

function renderProviderMappingRemoteSelectors(){
  const names=state._editorFetchedModels?.models||[];
  const rowsBox=$('#providerModelMapRows');
  if(names.length&&rowsBox){
    rowsBox.querySelector('.provider-model-map-empty')?.remove();
    const apiFormat=$('#addModelApiFormat')?.value||'openai-chat';
    if(!rowsBox.querySelector('.provider-model-map-row')){
      rowsBox.insertAdjacentHTML('beforeend', providerModelMappingRowHtml({name:'',apiFormat,enabled:true}, 'new-'+Date.now()));
    }
  }
  const summary=$('#providerModelMapFetchSummary');
  if(summary){
    summary.dataset.tone=names.length?'success':'info';
    summary.style.display=names.length?'block':'none';
    summary.textContent=names.length?`已获取 ${names.length} 个远端模型；点击每行“实际请求模型”右侧箭头选择，或直接手动输入。`:'';
  }
  document.querySelectorAll('.provider-model-map-row').forEach(row=>{
    const input=row.querySelector('.provider-model-name-input');
    const slot=row.querySelector('.provider-model-remote-slot');
    if(slot) slot.innerHTML=editorRemoteModelOptionsHtml(input?.value||'');
  });
}

function closeProviderModelRemoteMenus(except){
  document.querySelectorAll('.provider-model-remote-menu').forEach(menu=>{
    if(menu!==except){
      menu.hidden=true;
      menu.style.removeProperty('top');
      menu.style.removeProperty('left');
      menu.style.removeProperty('width');
      menu.style.removeProperty('max-height');
    }
  });
}

function positionProviderModelRemoteMenu(button, menu){
  if(!button||!menu) return;
  const rect=button.getBoundingClientRect();
  const viewportW=document.documentElement.clientWidth||window.innerWidth||0;
  const viewportH=document.documentElement.clientHeight||window.innerHeight||0;
  const width=Math.min(420, Math.max(220, viewportW-32));
  const left=Math.min(Math.max(16, rect.right-width), Math.max(16, viewportW-width-16));
  const belowTop=rect.bottom+6;
  let maxHeight=Math.min(300, Math.max(160, viewportH-belowTop-16));
  let top=belowTop;
  if(viewportH-belowTop<160 && rect.top>180){
    maxHeight=Math.min(300, Math.max(160, rect.top-16));
    top=Math.max(16, rect.top-6-maxHeight);
  }
  menu.style.top=`${top}px`;
  menu.style.left=`${left}px`;
  menu.style.width=`${width}px`;
  menu.style.maxHeight=`${maxHeight}px`;
}

function toggleProviderModelRemoteMenu(button,event){
  if(event) event.stopPropagation();
  const menu=button?.parentElement?.querySelector('.provider-model-remote-menu');
  if(!menu) return;
  const willOpen=menu.hidden;
  closeProviderModelRemoteMenus(menu);
  menu.hidden=!willOpen;
  if(willOpen) positionProviderModelRemoteMenu(button,menu);
}

function chooseRemoteModelForMappingRow(button,event){
  if(event) event.stopPropagation();
  const name=button?.dataset?.modelName||button?.textContent?.trim()||'';
  const row=button?.closest('.provider-model-map-row');
  const input=row?.querySelector('.provider-model-name-input');
  if(!row||!input||!name) return;
  input.value=name;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  const current=row.querySelector('.provider-model-remote-current');
  if(current) current.textContent=name;
  row.querySelectorAll('.provider-model-remote-option').forEach(item=>item.classList.toggle('active', item===button));
  closeProviderModelRemoteMenus();
}

if(typeof window!=='undefined'&&!window.__providerModelRemotePickerBound){
  window.__providerModelRemotePickerBound=true;
  document.addEventListener('click',()=>closeProviderModelRemoteMenus());
  window.addEventListener('resize',()=>closeProviderModelRemoteMenus());
  document.addEventListener('scroll',(event)=>{
    if(event.target?.closest?.('.provider-model-remote-menu')) return;
    closeProviderModelRemoteMenus();
  },true);
}

function addProviderModelMappingRow(){
  const rows=$('#providerModelMapRows');
  if(!rows) return;
  rows.querySelector('.provider-model-map-empty')?.remove();
  const apiFormat=$('#addModelApiFormat')?.value||'openai-chat';
  rows.insertAdjacentHTML('beforeend', providerModelMappingRowHtml({name:'',apiFormat,enabled:true}, 'new-'+Date.now()));
  renderProviderMappingRemoteSelectors();
}

function removeProviderModelMappingRow(button){
  const row=button?.closest('.provider-model-map-row');
  const rows=$('#providerModelMapRows');
  if(row) row.remove();
  if(rows&&!rows.querySelector('.provider-model-map-row')){
    rows.innerHTML='<div class="provider-model-map-empty">还没有模型，点击“添加模型”新建一行。</div>';
  }
}

function collectProviderModelMappings(){
  const rows=[...document.querySelectorAll('.provider-model-map-row')];
  const mappings=[];
  const seen=new Set();
  for(const row of rows){
    row.classList.remove('invalid');
    const name=row.querySelector('.provider-model-name-input')?.value?.trim()||'';
    if(!name) continue;
    const key=name.toLowerCase();
    if(seen.has(key)){
      row.classList.add('invalid');
      toast('模型映射里有重复的模型名：'+name,'error');
      return null;
    }
    seen.add(key);
    mappings.push({
      name,
      apiFormat:row.querySelector('.provider-model-api-format')?.value||'openai-chat',
      originalId:row.dataset.modelId||'',
      enabled:row.dataset.enabled!=='0',
    });
  }
  return mappings;
}

function uniqueModelTags(tags=[]){
  return [...new Set((tags||[]).map(t=>String(t||'').trim()).filter(Boolean))];
}

function providerRowTags(oldModel={}, name='', apiFormat='openai-chat'){
  const classified=classifyFetchedModel(name, apiFormat);
  let tags=uniqueModelTags(oldModel.tags?.length?oldModel.tags:classified.tags);
  if(apiFormat==='openai-image'){
    tags=tags.filter(t=>t!=='video');
    if(!tags.includes('image')) tags.push('image');
  }else if(apiFormat==='openai-video'){
    tags=tags.filter(t=>t!=='image');
    if(!tags.includes('video')) tags.push('video');
  }else{
    if(oldModel.apiFormat==='openai-image'||oldModel.kind==='image') tags=tags.filter(t=>t!=='image');
    if(oldModel.apiFormat==='openai-video'||oldModel.kind==='video') tags=tags.filter(t=>t!=='video');
    if(!tags.length) tags=classified.tags;
  }
  return uniqueModelTags(tags);
}

function providerRowKind(apiFormat='openai-chat', tags=[]){
  if(apiFormat==='openai-image') return 'image';
  if(apiFormat==='openai-video') return 'video';
  if((tags||[]).includes('image')) return 'image';
  if((tags||[]).includes('video')) return 'video';
  if((tags||[]).includes('vision')) return 'vision';
  return 'chat';
}

function cleanupModelSelections(cfg){
  const ids=new Set((cfg.library||[]).map(m=>m.id));
  cfg.scenarios={...(cfg.scenarios||{})};
  Object.keys(cfg.scenarios).forEach(key=>{ if(cfg.scenarios[key]&&!ids.has(cfg.scenarios[key])) cfg.scenarios[key]=''; });
  if(cfg.current&&!ids.has(cfg.current)) cfg.current=cfg.scenarios.chat||cfg.library.find(m=>m.enabled!==false)?.id||cfg.library[0]?.id||'';
}

function fillScenarioDefaultsFromModels(cfg, models=[]){
  cfg.scenarios={...(cfg.scenarios||{})};
  const firstChat=models.find(item=>item.kind==='chat');
  const firstReasoning=models.find(item=>(item.tags||[]).includes('reasoning')&&item.kind==='chat');
  const firstVision=models.find(item=>item.kind==='vision');
  const firstImage=models.find(item=>item.kind==='image');
  const firstVideo=models.find(item=>item.kind==='video');
  if(firstChat&&!cfg.scenarios.chat) cfg.scenarios.chat=firstChat.id;
  if(firstReasoning&&!cfg.scenarios.reasoning) cfg.scenarios.reasoning=firstReasoning.id;
  if(firstVision&&!cfg.scenarios.vision) cfg.scenarios.vision=firstVision.id;
  if(firstImage&&!cfg.scenarios.image) cfg.scenarios.image=firstImage.id;
  if(firstVideo&&!cfg.scenarios.video) cfg.scenarios.video=firstVideo.id;
}

function openModelEditor(model){
  const isEdit=!!model;
  const isProviderEdit=!!model?._providerEdit;
  state._editorFetchedModels=null;
  state._modelEditorContext={providerEdit:isProviderEdit,originalProvider:model?.provider||'Custom',existingId:model?.id||''};
  const tags=new Set(model?.tags||[]);
  const apiOptions=apiFormatOptionsHtml(model?.apiFormat||'openai-chat');
  const authOptions=['bearer','x-api-key','api-key','custom','none'].map(v=>`<option value="${v}"${(model?.authType||'bearer')===v?' selected':''}>${authTypeLabel(v)}</option>`).join('');
  const tagOptions=['chat','reasoning','vision','image','video'].map(t=>`<label><input type="checkbox" class="addModelTag" value="${t}" ${tags.has(t)?'checked':''}>${t}</label>`).join('');
  const authType=model?.authType||'bearer';
  const providerAuthBody=authType==='custom'
    ? `<details class="wide model-advanced-details model-auth-section">
      <summary>高级认证设置</summary>
      <div class="model-editor-grid inner">
        <label>认证方式<select id="addModelAuthType" onchange="toggleCustomAuthHeader('addModel')">${authOptions}</select></label>
        <label>自定义认证 Header<input id="addModelAuthHeader" placeholder="如 X-API-Key" value="${esc(model?.authHeader||'')}"></label>
      </div>
    </details>`
    : `<input id="addModelAuthType" type="hidden" value="${esc(authType)}"><input id="addModelAuthHeader" type="hidden" value="${esc(model?.authHeader||'')}">`;
  const providerEditorBody=`<section class="wide model-editor-section provider-info-section">
      <div class="model-editor-section-head"><strong>提供者信息</strong></div>
      <div class="model-editor-grid inner provider-info-grid">
        <label>提供者名称<input id="addModelProvider" placeholder="例如 xiaomi / deepseek / openai" value="${esc(model?.provider||'')}" oninput="applyProviderPreset('addModel');renderEditorFetchedModels()"></label>
        <label>API Key<span class="secret-input-wrap"><input id="addModelKey" type="password" placeholder="sk-..." value="${esc(model?.key||'')}"><button type="button" class="secret-eye-btn" onclick="toggleSecretInput(\'addModelKey\')">&#128065;</button></span></label>
        <label class="wide">API 请求地址<input id="addModelBase" placeholder="例如 https://api.openai.com/v1" value="${esc(model?.base||'')}"></label>
        <input id="addModelApiFormat" type="hidden" value="${esc(model?.apiFormat||'openai-chat')}">
      </div>
    </section>
    ${providerEditModelListHtml(model)}
    ${providerAuthBody}
    <div id="addModelFormatHint" class="wide model-format-hint" style="display:none"></div>`;
  const singleModelBody=`<label>提供者<input id="addModelProvider" placeholder="例如 xiaomi / deepseek / openai" value="${esc(model?.provider||'')}" oninput="applyProviderPreset('addModel');renderEditorFetchedModels()"></label>
      <label>\u6a21\u578b\u540d\u79f0<span class="model-name-fetch-row"><input id="addModelName" placeholder="\u4f8b\u5982 mimo-v2.5-pro" value="${esc(model?.name||'')}"><button type="button" class="btn btn-sm btn-secondary" id="addFetchModelsBtn" onclick="fetchModelsFromEditor()">\u83b7\u53d6\u6a21\u578b</button></span></label>
      <label class="wide">API Key<span class="secret-input-wrap"><input id="addModelKey" type="password" placeholder="sk-..." value="${esc(model?.key||'')}"><button type="button" class="secret-eye-btn" onclick="toggleSecretInput(\'addModelKey\')">&#128065;</button></span></label>
      <label class="wide">API 请求地址<input id="addModelBase" placeholder="例如 https://api.openai.com/v1" value="${esc(model?.base||'')}"></label>
      <label>接口格式<select id="addModelApiFormat" onchange="applyApiFormatPreset('addModel');renderEditorFetchedModels()">${apiOptions}</select></label>
      <label>启用状态<select id="addModelEnabled"><option value="1"${model?.enabled!==false?' selected':''}>启用</option><option value="0"${model?.enabled===false?' selected':''}>停用</option></select></label>
      <details class="wide model-advanced-details">
        <summary>高级认证设置</summary>
        <div class="model-editor-grid inner">
          <label>认证方式<select id="addModelAuthType" onchange="toggleCustomAuthHeader('addModel')">${authOptions}</select></label>
          <input id="addModelAuthHeader" placeholder="自定义认证 Header" style="${(model?.authType||'bearer')==='custom'?'':'display:none'}" value="${esc(model?.authHeader||'')}">
        </div>
      </details>
      <div class="wide model-tag-editor"><span>用途标签</span>${tagOptions}</div>
      <div id="addModelFormatHint" class="wide model-format-hint"></div>
      <div class="wide model-editor-fetch"><div id="addFetchModelsList" class="model-fetch-list compact" style="display:none"></div></div>`;
  openModal(`<div class="model-editor-modal">
    <div class="model-editor-head"><div><h3>${isProviderEdit?'编辑模型':(isEdit?'编辑模型':'添加模型')}</h3>${isProviderEdit?'':'<p>配置单个模型；获取模型后可填入名称或批量加入模型库。</p>'}</div><button type="button" class="modal-close" onclick="closeModal()" aria-label="关闭">×</button></div>
    <div class="model-editor-grid">
      ${isProviderEdit?providerEditorBody:singleModelBody}
    </div>
    <div class="model-editor-actions">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-secondary" onclick="doSaveModel('${esc(model?.id||'')}',true)">保存并测试</button>
      <button class="btn btn-primary" onclick="doSaveModel('${esc(model?.id||'')}')">${isEdit?'保存':'添加'}</button>
    </div>
  </div>`, { className:'model-editor-shell', disableBackdropClose:true });
  setTimeout(()=>updateModelFormatHint('addModel'),0);
}
function editLibraryModel(id){
  const model=getModelById(id);
  if(!model){toast('模型不存在','error');return}
  openModelEditor(model);
}

function providerModels(provider){
  const lib=activeModelsConfig().library||[];
  return lib.filter(m=>(m.provider||'Custom')===provider);
}
function testProviderModels(provider){
  const items=providerModels(provider);
  const model=items.find(m=>m.enabled!==false)||items[0];
  if(!model) return toast('\u8fd9\u4e2a Provider \u8fd8\u6ca1\u6709\u6a21\u578b','error');
  toast(`正在测试 ${model.name||provider}...`,'info');
  testLibraryModel(model.id);
}
function editProviderModels(provider){
  const model=providerModels(provider)[0];
  if(!model) return toast('\u8fd9\u4e2a Provider \u8fd8\u6ca1\u6709\u6a21\u578b','error');
  openModelEditor({...model,_providerEdit:true});
}

async function doSaveModel(existingId,shouldTest=false){
  const values=modelFormValues('addModel');
  const provider=values.provider||'custom';
  const name=$('#addModelName')?.value?.trim();
  const editorCtx=state._modelEditorContext||{};
  const providerEdit=!!editorCtx.providerEdit;
  const old=getModelById(existingId)||{};
  if(providerEdit){
    const mappings=collectProviderModelMappings();
    if(!mappings) return;
    if(!mappings.length){
      const ok=await askConfirm('当前没有模型映射，保存后会删除这个 Provider 下的所有模型。确定继续吗？');
      if(!ok) return;
    }
    if(mappings.length&&!values.base&&mappings.some(item=>item.apiFormat!=='ollama')){toast('请填写 API 请求地址','error');return}
    if(mappings.length&&!values.key&&values.authType!=='none'){toast('请填写 API Key','error');return}
    const cfg=activeModelsConfig();
    cfg.library=[...(cfg.library||[])];
    const originalProvider=editorCtx.originalProvider||old.provider||provider;
    const originalItems=cfg.library.filter(m=>(m.provider||'Custom')===(originalProvider||'Custom'));
    const oldById=new Map(originalItems.map(item=>[item.id,item]));
    const oldByName=new Map(originalItems.map(item=>[String(item.name||item.id||'').toLowerCase(),item]));
    const idMap=new Map();
    const kept=cfg.library.filter(m=>(m.provider||'Custom')!==(originalProvider||'Custom')).map(m=>({...m}));
    const mappedModels=mappings.map(item=>{
      const oldModel=oldById.get(item.originalId)||oldByName.get(item.name.toLowerCase())||{};
      const id=modelIdFor(provider,item.name);
      if(oldModel.id&&oldModel.id!==id) idMap.set(oldModel.id,id);
      const tags=providerRowTags(oldModel,item.name,item.apiFormat);
      const kind=providerRowKind(item.apiFormat,tags);
      return {...oldModel,id,provider,name:item.name,base:values.base,key:values.key,enabled:oldModel.enabled!==undefined?oldModel.enabled!==false:item.enabled!==false,tags,kind,apiFormat:item.apiFormat,authType:values.authType,authHeader:values.authHeader};
    });
    const merged=new Map();
    [...kept,...mappedModels].forEach(item=>{
      const key=String(item.id||modelIdFor(item.provider||'custom',modelNameForMerge(item))).toLowerCase();
      merged.set(key,{...(merged.get(key)||{}),...item});
    });
    cfg.library=[...merged.values()];
    applyModelIdMap(cfg,idMap);
    cleanupModelSelections(cfg);
    fillScenarioDefaultsFromModels(cfg,mappedModels);
    if(!cfg.current&&mappedModels.length) cfg.current=(mappedModels.find(m=>m.enabled!==false)||mappedModels[0]).id;
    const data=await persistModelsConfig(cfg);
    if(!data) return;
    const first=mappedModels.find(m=>m.enabled!==false)||mappedModels[0]||{};
    state.model={...state.model,provider,model:first.name||'',base:values.base,key:values.key};
    save();
    closeModal();
    renderPage();
    toast(shouldTest?'模型配置已保存，开始测试...':'模型配置已保存','success');
    if(shouldTest&&first.id) setTimeout(()=>testLibraryModel(first.id),80);
    return;
  }
  if(!values.base && values.apiFormat!=='ollama'){toast('请填写 API 请求地址','error');return}
  if(!values.key && values.authType!=='none'){toast('请填写 API Key','error');return}
  if(!name){toast('请填写模型名称','error');return}
  const tags=[...document.querySelectorAll('.addModelTag:checked')].map(c=>c.value);
  const id=existingId||`${provider}:${name}`;
  const enabled=$('#addModelEnabled')?.value!=='0';
  const classified=classifyFetchedModel(name, values.apiFormat);
  const finalTags=tags.length?tags:classified.tags;
  if(values.apiFormat==='openai-image'&&!finalTags.includes('image')) finalTags.push('image');
  if(values.apiFormat==='openai-video'&&!finalTags.includes('video')) finalTags.push('video');
  const kind=values.apiFormat==='openai-image'?'image':(values.apiFormat==='openai-video'?'video':(finalTags.includes('image')?'image':(finalTags.includes('vision')?'vision':'chat')));
  const item={...old,id,provider,name,base:values.base,key:values.key,enabled,tags:finalTags,kind,apiFormat:values.apiFormat,authType:values.authType,authHeader:values.authHeader};
  let data=await apiPost('/api/models/library'+modelScopeParam(),item);
  if(data&&providerEdit){
    const cfgAfter=data;
    cfgAfter.library=(cfgAfter.library||[]).map(m=>(m.provider||'Custom')===(old.provider||'Custom')?{...m,provider,base:values.base,key:values.key,apiFormat:values.apiFormat,authType:values.authType,authHeader:values.authHeader}:m);
    data=await persistModelsConfig(cfgAfter)||cfgAfter;
  }
  if(data){
    setActiveModelsConfig(data);
    const savedCfg=activeModelsConfig();
    savedCfg.scenarios={...(savedCfg.scenarios||{})};
    if(kind==='image' && !savedCfg.scenarios.image) savedCfg.scenarios.image=id;
    else if(kind==='video' && !savedCfg.scenarios.video) savedCfg.scenarios.video=id;
    else if(kind==='vision' && !savedCfg.scenarios.vision) savedCfg.scenarios.vision=id;
    else if(kind==='chat' && !savedCfg.scenarios.chat) savedCfg.scenarios.chat=id;
    if(finalTags.includes('reasoning') && kind==='chat' && !savedCfg.scenarios.reasoning) savedCfg.scenarios.reasoning=id;
    await persistModelsConfig(savedCfg);
    state.model={...state.model,provider,model:name,base:values.base,key:values.key};
    save();
    closeModal();
    renderPage();
    toast(shouldTest?'模型已保存，开始测试...':(existingId?'模型已保存':'模型已添加'),'success');
    if(shouldTest) setTimeout(()=>testLibraryModel(id),80);
  }
}
async function deleteLibraryModel(id){
  const m=getModelById(id);
  const okConfirm=await askConfirm(`确认删除模型「${m?.name||id}」？\n如果它正在某个应用场景中使用，会自动清空对应场景。`);
  if(!okConfirm) return;
  const data=await fetch(apiBase()+'/api/models/library/'+encodeURIComponent(id)+modelScopeParam(),{method:'DELETE',cache:'no-store',headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()).catch(()=>null);
  if(data&&data.code===0){setActiveModelsConfig(data.data);renderPage();toast('模型已删除','info')}
  else toast('删除失败','error');
}
function buildModelTestModal(model,result){
  const ok=!!result.ok;
  const hints=Array.isArray(result.hints)?result.hints:[];
  const canQuickFix=(result.apiFormat==='ollama'||model.apiFormat==='ollama') && !/127\.0\.0\.1:11434|localhost:11434|ollama/i.test(`${model.base} ${model.provider}`);
  const canAnthropicFix=(model.apiFormat||result.apiFormat)==='openai-chat' && /claude|kiro|anthropic/i.test(`${model.name} ${model.provider}`);
  const caps=result.capabilities||{};
  const suggested=result.suggestedConfig||{};
  const capItems=[];
  if('text' in caps) capItems.push('文本对话：'+(caps.text?'支持':'未通过'));
  if('image' in caps) capItems.push('图片识别：'+(caps.image?(caps.imageVerified?'已验证':'疑似支持'):'未检测到'));
  if('video' in caps) capItems.push('视频生成：'+(caps.video?(caps.videoVerified?'已验证':'疑似支持'):'未检测到'));
  const suggestedTags=Array.isArray(suggested.tags)?suggested.tags:[];
  const autoApplied=!!result.autoApplied;
  return `<div class="model-test-modal">
    <div class="model-test-head ${ok?'ok':'fail'}">
      <span>${ok?'连接成功':'连接失败'}</span>
      <strong>${esc(model.name)}</strong>
    </div>
    <div class="model-test-grid">
      <div><span>测试地址</span><code>${esc(result.testedUrl||'未生成')}</code></div>
      <div><span>API 格式</span><code>${esc(apiFormatLabel(result.apiFormat||model.apiFormat))}</code></div>
      <div><span>认证方式</span><code>${esc(result.authHeader||authTypeLabel(model.authType,model.authHeader))}</code></div>
      <div><span>测试模式</span><code>${esc((result.mode==='text'||result.mode==='text-only')?'仅文本对话':'自动检测能力')}</code></div>
      <div><span>状态</span><code>${esc(result.status?`${result.status} ${result.statusText||''}`:(ok?'OK':'未连接'))}</code></div>
      ${suggestedTags.length?`<div><span>建议标签</span><code>${esc(suggestedTags.join(', '))}</code></div>`:''}
    </div>
    ${capItems.length?`<div class="model-test-hints"><strong>能力检测</strong>${capItems.map(h=>`<p>${esc(h)}</p>`).join('')}${autoApplied?'<p>已自动写入模型标签/类型，并补全对应应用场景。</p>':''}</div>`:''}
    ${result.visionError?`<div class="model-test-error">视觉探测未通过：${esc(result.visionError)}</div>`:''}
    ${result.error?`<div class="model-test-error">${esc(result.error)}</div>`:''}
    ${result.bodySnippet?`<pre class="model-test-snippet">${esc(result.bodySnippet)}</pre>`:''}
    ${hints.length?`<div class="model-test-hints"><strong>建议排查</strong>${hints.map(h=>`<p>${esc(h)}</p>`).join('')}</div>`:''}
    <div class="model-editor-actions">
      ${ok&&suggestedTags.length&&!autoApplied?`<button class="btn btn-secondary" onclick="applyModelCapabilityConfig('${esc(model.id)}',${esc(JSON.stringify(result))})">写入检测配置</button>`:''}
      ${canQuickFix?`<button class="btn btn-secondary" onclick="quickFixOpenAICompat('${esc(model.id)}')">改为 OpenAI 兼容 + Bearer 后重试</button>`:''}
      ${canAnthropicFix?`<button class="btn btn-secondary" onclick="quickFixAnthropicMessages('${esc(model.id)}')">改为 Anthropic Messages 后重试</button>`:''}
      <button class="btn btn-secondary" onclick="editLibraryModel('${esc(model.id)}')">编辑配置</button>
      <button class="btn btn-primary" onclick="closeModal()">知道了</button>
    </div>
  </div>`;
}
async function quickFixAnthropicMessages(id){
  const cfg=activeModelsConfig();
  const m=(cfg.library||[]).find(x=>x.id===id);
  if(!m) return;
  m.apiFormat='anthropic_messages';
  m.authType='x-api-key';
  const data=await persistModelsConfig(cfg);
  if(data) setActiveModelsConfig(data);
  closeModal();
  renderPage();
  setTimeout(()=>testLibraryModel(id),80);
}
async function quickFixOpenAICompat(id){
  const cfg=activeModelsConfig();
  const m=(cfg.library||[]).find(x=>x.id===id);
  if(!m) return;
  m.apiFormat='openai-chat';
  m.authType='bearer';
  const data=await persistModelsConfig(cfg);
  if(data) setActiveModelsConfig(data);
  closeModal();
  renderPage();
  setTimeout(()=>testLibraryModel(id),80);
}
async function benchmarkLibraryModel(id){
  const m=getModelById(id);
  if(!m){toast('模型不存在','error');return}
  const btn=$('#modelBenchBtn_'+domId(id));
  if(btn){btn.disabled=true;btn.textContent='测速中...'}
  try{
    const r=await fetch(apiBase()+'/api/models/benchmark',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify({provider:{provider:m.provider,base:m.base,model:m.name,key:m.key,apiFormat:m.apiFormat,authType:m.authType,authHeader:m.authHeader}})});
    const result=await r.json().catch(()=>({}));
    const bench=result.code===0?result.data:result;
    const cfg=activeModelsConfig();
    const item=(cfg.library||[]).find(x=>x.id===id);
    if(item){item.benchmark=bench; const data=await persistModelsConfig(cfg); if(data) setActiveModelsConfig(data);}
    toast(bench.ok?'测速完成':'测速失败',bench.ok?'success':'error');
    renderPage();
    if(!bench.ok) openModal(buildModelTestModal(m,{...bench,hints:bench.hints||['测速失败，请先使用“测试”查看接口连通性。']}));
  }catch(e){
    toast('测速失败：'+(e.message||e),'error');
  }finally{
    const nextBtn=$('#modelBenchBtn_'+domId(id));
    if(nextBtn){nextBtn.disabled=false;nextBtn.textContent='测速'}
  }
}

async function applyModelCapabilityConfig(id,result,opts={}){
  const suggested=result?.suggestedConfig||{};
  const tags=Array.isArray(suggested.tags)?suggested.tags:[];
  if(!tags.length) return false;
  const cfg=activeModelsConfig();
  const item=(cfg.library||[]).find(x=>x.id===id);
  if(!item) return false;
  item.tags=[...new Set([...(item.tags||[]),...tags])];
  if(suggested.kind) item.kind=suggested.kind;
  cfg.scenarios={...(cfg.scenarios||{})};
  const scenes=suggested.scenarios||{};
  if(scenes.chat && !cfg.scenarios.chat) cfg.scenarios.chat=id;
  if(scenes.vision) cfg.scenarios.vision=id;
  if(scenes.image && !cfg.scenarios.image) cfg.scenarios.image=id;
  if(item.tags.includes('reasoning') && !cfg.scenarios.reasoning) cfg.scenarios.reasoning=id;
  const data=await persistModelsConfig(cfg);
  if(data) setActiveModelsConfig(data);
  if(!opts.silent){toast('已写入能力检测配置','success');closeModal();renderPage();}
  return !!data;
}
async function testLibraryModel(id){
  const m=getModelById(id);
  if(!m){toast('模型不存在','error');return}
  const btn=$(`#modelTestBtn_${domId(id)}`);
  const mode=$(`#modelTestMode_${domId(id)}`)?.value||'auto';
  if(btn){btn.disabled=true;btn.textContent='测试中...'}
  else toast(`正在测试 ${m.name||id}...`,'info');
  try{
    const r=await fetch(apiBase()+'/api/models/test',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify({mode,testMode:mode,provider:{provider:m.provider,base:m.base,model:m.name,key:m.key,apiFormat:m.apiFormat,authType:m.authType,authHeader:m.authHeader}})});
    const j=await r.json().catch(()=>({}));
    if(j.ok && mode!=='text' && j.suggestedConfig){
      j.autoApplied=await applyModelCapabilityConfig(id,j,{silent:true});
    }
    const latest=getModelById(id)||m;
    openModal(buildModelTestModal(latest,j));
    toast(j.ok?(j.autoApplied?'连接成功，已自动配置能力':'连接成功'):'连接失败',j.ok?'success':'error');
    if(j.autoApplied) renderPage();
  }catch(e){
    openModal(buildModelTestModal(m,{ok:false,mode,error:e.message,hints:['后端测试接口不可达，请确认 WebUI 后端服务已启动。']}));
  }finally{
    const nextBtn=$(`#modelTestBtn_${domId(id)}`);
    if(nextBtn){nextBtn.disabled=false;nextBtn.textContent='测试'}
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
      <div><span style="font-size:24px;font-weight:var(--fw-semibold)">${todayMessages}</span><div style="font-size:var(--fs-sm);color:var(--c-ink-muted)">今日消息</div></div>
      <div><span style="font-size:24px;font-weight:var(--fw-semibold)">${fmtTokens(todayTokens)}</span><div style="font-size:var(--fs-sm);color:var(--c-ink-muted)">今日 Token</div></div>
      <div><span style="font-size:24px;font-weight:var(--fw-semibold)">${totalSessions}</span><div style="font-size:var(--fs-sm);color:var(--c-ink-muted)">总会话数</div></div>
      <div><span style="font-size:24px;font-weight:var(--fw-semibold)">${totalMessages}</span><div style="font-size:var(--fs-sm);color:var(--c-ink-muted)">总消息数</div></div>
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
      <div style="font-size:var(--fs-md);color:var(--c-ink-muted)">${esc(p.desc||'')}</div>
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
  const settingsSections=[
    ['general','通用'],
    ['api','API 配置'],
    ['routing','Agent 路由策略'],
    ['data','本地数据目录'],
    ['prompt','Prompt 注入治理'],
    ['tools','工具权限与安全'],
    ['update','更新中心'],
    ['cli','Hermes CLI 状态'],
    ['style','风格设置'],
    ['system','系统提示词'],
  ];
  const settingsSideNav=`<aside class="settings-side-nav settings-inner-nav"><div class="settings-side-list">${settingsSections.map((item,idx)=>`<button type="button" class="settings-side-link${idx===0?' active':''}" data-target="${esc(item[0])}" onclick="scrollSettingsSection('${esc(item[0])}',this)"><span>${esc(item[1])}</span></button>`).join('')}</div></aside>`;
  return `<div class="settings-design-page">
    <div class="page-header settings-page-header settings-design-header">
      <div><h2>设计</h2><p class="page-subtitle">集中管理运行状态、更新、界面风格和系统提示词。</p></div>
      <button class="btn btn-primary" onclick="saveSettings()">保存设置</button>
    </div>
    <div class="settings-shell settings-inner-shell settings-design-body">
      ${settingsSideNav}
      <section class="settings-main-panel"><div class="settings-panel-fade"><div class="settings-view settings-general-view">
      <div class="settings-content settings-general-content">
      <div class="settings-section" id="general">
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
        <div class="settings-item"><div><div class="settings-label">快速模式</div><div class="settings-desc">纯直连 API 大模型：开启后跳过 Hermes Agent 和工具调用，只使用 WebUI 模型配置。</div></div>
          <label class="toggle"><input type="checkbox" id="sQuick" ${state.settings.quickMode?'checked':''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item"><div><div class="settings-label">回复速度优化</div><div class="settings-desc">想要最快纯聊天可开启快速模式；需要工具/文件/语雀能力请关闭快速模式，并在下方路由模式选择“自动”或“始终 Hermes Agent”。</div></div>
          <span style="font-size:var(--fs-sm);color:var(--c-ink-muted)">当前历史：${esc(state.settings.history||20)} 轮</span>
        </div>
        <div class="settings-item"><div><div class="settings-label">历史记录保留</div><div class="settings-desc">保留的对话轮数</div></div>
          <input id="sHistory" type="number" value="${state.settings.history}" style="width:80px">
        </div>
      </div>
      <div class="settings-section" id="api">
        <div class="settings-section-title">API 配置</div>
        <div class="settings-item"><div><div class="settings-label">Hermes API 地址</div><div class="settings-desc">后端服务地址</div></div>
          <input id="sApi" value="${esc(state.settings.api)}" style="width:280px">
        </div>
      </div>
      <div class="settings-section" id="routing">
        <div class="settings-section-title">Agent 路由策略</div>
        <div class="settings-item"><div><div class="settings-label">路由模式</div><div class="settings-desc">自动：普通聊天直连模型；本地文档、语雀、文件、命令、代码等需要工具的任务自动走 Hermes Agent。</div></div>
          <select id="sRoutingMode" style="width:180px">
            <option value="auto" ${(state.settings.routingMode||'auto')==='auto'?'selected':''}>自动</option>
            <option value="direct" ${(state.settings.routingMode||'auto')==='direct'?'selected':''}>始终直连</option>
            <option value="hermes" ${(state.settings.routingMode||'auto')==='hermes'?'selected':''}>始终 Hermes Agent</option>
          </select>
        </div>
      </div>
      <div class="settings-section" id="data">
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
        <div class="settings-item"><div><div class="settings-label">输出文档目录</div><div class="settings-desc">生成和预览的 Markdown 输出文档统一保存到这里；留空使用 数据根目录\output-md。</div></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="sMdLibraryDir" value="${esc(state.settings.mdLibraryDir||'')}" placeholder="留空自动匹配数据根目录\output-md" style="width:420px"><button class="btn btn-secondary" type="button" onclick="openPathFromSetting('md')">打开</button></div>
        </div>
        <div class="settings-item"><div><div class="settings-label">迁移检查</div><div class="settings-desc">如果旧 backend/data 和外部目录同时存在，建议确认后再手动合并数据，避免覆盖。</div></div>
          <button class="btn btn-secondary" onclick="openPathFromSetting('data')">打开当前数据目录</button>
        </div>
        <div class="settings-item" style="align-items:flex-start"><div><div class="settings-label">一键备份导出</div><div class="settings-desc">导出设置、模型配置、Skill、聊天索引和数据目录清单；API Key 会自动脱敏。</div><div id="backupExportResult" style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-top:6px"></div></div>
          <button class="btn btn-secondary" onclick="exportWebuiBackup()">生成备份</button>
        </div>
      </div>
      <div class="settings-section" id="prompt">
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
      <div class="settings-section" id="tools">
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
      <div class="settings-section" id="update">
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
      <div class="settings-section" id="cli">
        <div class="settings-section-title">Hermes CLI 状态</div>
        <div id="cliStatusCard" class="settings-item" style="align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div class="settings-label">正在检测...</div>
            <div class="settings-desc">Checking native Hermes CLI availability on Windows.</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-secondary" onclick="loadCliStatusCard()">刷新状态</button>
            <button class="btn btn-secondary" onclick="showCliInstallGuide()">安装指引</button>
          </div>
        </div>
      </div>
      <div class="settings-section" id="style">
        <div class="settings-section-title">风格设置</div>
        <div class="settings-item"><div><div class="settings-label">界面风格</div><div class="settings-desc">选择界面显示风格</div></div>
          <select id="sStyle" style="width:160px"><option value="minimal"${(state.settings.style||'minimal')==='minimal'?' selected':''}>简约默认风格</option></select>
        </div>
      </div>
      <div class="settings-section" id="system">
        <div class="settings-section-title">系统提示词</div>
        <textarea id="sSys" style="width:100%;min-height:100px;margin-top:8px">${esc(state.settings.systemPrompt)}</textarea>
        
      </div>
      <div id="settingsMsg" style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-top:8px"></div>
      </div></div></section>
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
    <h3 style="margin:0 0 12px">安装与更新方法</h3>
    <div style="line-height:1.8;color:var(--c-ink-muted)">
      <p>第一次使用：双击项目根目录的 <code>install.bat</code>，它会检查 Node.js / Git、安装依赖，然后启动 WebUI。</p>
      <p>日常启动：双击 <code>start.bat</code>。如果依赖缺失，它会自动补装后再启动。</p>
      <p>更新代码：关闭正在运行的 WebUI 后双击 <code>update.bat</code>，或在本页点击“安全更新”。</p>
      <p>公司电脑常见失败点是 GitHub / npm 被代理、证书或防火墙拦截；本页会尽量把失败原因显示出来。</p>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" onclick="closeModal()">知道了</button></div>
  </div>`);
}

function updateStatusCardHtml(status={}, {checking=false, error=''}={}){
  if(checking){
    return `<div style="flex:1;min-width:0"><div class="settings-label">正在检测更新状态...</div><div class="settings-desc">正在读取 Git / Node / npm 信息，请稍候。</div></div>`;
  }
  if(error){
    return `<div style="flex:1;min-width:0"><div class="settings-label">更新状态检测失败</div><div class="settings-desc">${esc(error)}</div></div>`;
  }
  const gitOk=status.git?.available!==false;
  const nodeOk=status.node?.available!==false;
  const npmOk=status.npm?.available!==false;
  const toolLine=`Git：${gitOk?esc(status.git?.version||'已检测'):'未检测到'} · Node：${nodeOk?esc(status.node?.version||'已检测'):'未检测到'} · npm：${npmOk?esc(status.npm?.version||'已检测'):'未检测到'} · 依赖：${status.dependenciesInstalled?'已安装':'可能缺失'}`;
  if(!status.isGitRepo){
    const title=status.reason==='git_missing'?'未检测到 Git':'当前不是 Git 克隆项目';
    return `<div style="flex:1;min-width:0">
      <div class="settings-label">${esc(title)}</div>
      <div class="settings-desc">${esc(status.message||'无法通过 GitHub 自动检测更新。')}</div>
      <div style="margin-top:8px;font-size:var(--fs-sm);color:var(--c-ink-muted);line-height:1.7">
        ${toolLine}<br>
        版本：${esc(status.packageVersion||'unknown')} · 目录：${esc(status.projectRoot||'')}<br>
        下一步：${esc(status.nextAction||'请使用 install.bat 或下载新版压缩包。')}
      </div>
    </div>`;
  }
  const behind=Number(status.behind||0);
  const ahead=Number(status.ahead||0);
  const dirty=Number(status.dirtyCount||0);
  const stateText=status.reason==='fetch_failed'?'远端检查失败'
    : status.reason==='dirty_worktree'?'存在本地未提交改动'
    : status.reason==='ahead'?'本地领先远端'
    : status.reason==='no_upstream'?'未设置远端分支'
    : behind>0?'发现远端更新'
    : '当前代码已是最新状态';
  const stateClass=status.safeToPull||status.reason==='up_to_date'?'connected':'disconnected';
  const advice=status.message||'如果要主动确认 GitHub 最新版本，可点击“检查远端”。';
  const dirtyPreview=Array.isArray(status.dirtyFiles)&&status.dirtyFiles.length
    ? `<br>改动预览：${status.dirtyFiles.map(x=>`<code>${esc(x)}</code>`).join(' ')}${dirty>status.dirtyFiles.length?' ...':''}`
    : '';
  return `<div style="flex:1;min-width:0">
    <div class="settings-label">GitHub 更新 · <span class="platform-status ${stateClass}" style="display:inline-flex;align-items:center">${esc(stateText)}</span></div>
    <div class="settings-desc">${esc(advice)}</div>
    <div style="margin-top:8px;font-size:var(--fs-sm);color:var(--c-ink-muted);line-height:1.7">
      ${toolLine}<br>
      版本：${esc(status.packageVersion||'unknown')} · 分支：${esc(status.branch||'unknown')} · 提交：${esc(status.localCommit||'')}${status.currentTag?` · 当前标签：${esc(status.currentTag)}`:''}${status.latestTag?` · 最新标签：${esc(status.latestTag)}`:''}<br>
      远端：${esc(status.upstream||'未设置 upstream')} · 落后 ${behind} / 领先 ${ahead} · 本地改动 ${dirty} 个${status.fetched?' · 已检查远端':''}${status.fetchError?`<br>远端错误：${esc(status.fetchError)}`:''}${dirtyPreview}<br>
      下一步：${esc(status.nextAction||'可以点击“检查远端”重新检测。')}
    </div>
  </div>`;
}

async function applySafeUpdate(){
  if(!confirm('将执行 git pull --ff-only 和 npm install。仅在没有本地未提交改动时继续，完成后需要重启 WebUI。是否继续？')) return;
  const card=$('#updateStatusCard');
  if(card) card.innerHTML=updateStatusCardHtml({}, {checking:true})+'<div style="display:flex;gap:8px;flex-shrink:0"><button class="btn btn-secondary" disabled>更新中...</button></div>';
  try{
    const result=await apiPostRaw('/api/system/update-apply', {});
    if(result?.code!==0) throw new Error(result?.msg||'更新失败');
    toast(result.data?.message||'更新完成，请重启 WebUI','success');
    await loadUpdateStatus(false);
  }catch(err){
    toast(err.message||String(err),'error');
    await loadUpdateStatus(true);
  }
}

async function repairUpdateDependencies(){
  if(!confirm('将重新执行 npm install 修复 WebUI 依赖。不会拉取代码，完成后建议重启 WebUI。是否继续？')) return;
  const card=$('#updateStatusCard');
  if(card) card.innerHTML=updateStatusCardHtml({}, {checking:true})+'<div style="display:flex;gap:8px;flex-shrink:0"><button class="btn btn-secondary" disabled>修复中...</button></div>';
  try{
    const result=await apiPostRaw('/api/system/update-repair-deps', {});
    if(result?.code!==0) throw new Error(result?.msg||'依赖修复失败');
    toast(result.data?.message||'依赖修复完成，请重启 WebUI','success');
    await loadUpdateStatus(false);
  }catch(err){
    toast(err.message||String(err),'error');
    await loadUpdateStatus(false);
  }
}

async function loadUpdateStatus(fetchRemote=false, seq){
  const card=$('#updateStatusCard');
  if(!card || !isSettingsPage('settings')) return;
  card.innerHTML=`${updateStatusCardHtml({}, {checking:true})}<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary" disabled>检测中</button><button class="btn btn-secondary" onclick="showUpdateGuide()">查看方法</button></div>`;
  try{
    const raw=await apiGetRaw('/api/system/update-status'+(fetchRemote?'?fetch=1':''));
    const data=raw?.code===0 ? raw.data : null;
    if(!isRenderCurrent(seq) || !isSettingsPage('settings')) return;
    card.innerHTML=`${updateStatusCardHtml(data||{}, {error:data?'' : (raw?.msg||'接口没有返回有效数据')})}<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary" onclick="loadUpdateStatus(false)">刷新状态</button><button class="btn btn-secondary" onclick="loadUpdateStatus(true)">检查远端</button><button class="btn btn-primary" onclick="applySafeUpdate()" ${data?.safeToPull?'':'disabled'}>安全更新</button><button class="btn btn-secondary" onclick="repairUpdateDependencies()" ${data?.canRepairDependencies===false?'disabled':''}>修复依赖</button><button class="btn btn-secondary" onclick="showUpdateGuide()">安装/更新说明</button></div>`;
  }catch(err){
    if(!isRenderCurrent(seq) || !isSettingsPage('settings')) return;
    card.innerHTML=`${updateStatusCardHtml({}, {error:err.message||String(err)})}<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary" onclick="loadUpdateStatus(false)">重试</button><button class="btn btn-secondary" onclick="repairUpdateDependencies()">修复依赖</button><button class="btn btn-secondary" onclick="showUpdateGuide()">安装/更新说明</button></div>`;
  }
}

function cliStatusCardHtml(cli={}, {checking=false, error=''}={}){
  const ok=!!cli.available;
  const stale=!!cli.stale;
  const statusClass=ok?'connected':'disconnected';
  const statusText=checking ? 'Checking' : ok ? (stale?'Last known good':'Available') : 'Unavailable';
  const detail=error
    ? error
    : ok
      ? `Command: ${cli.command||'hermes'} ? Version: ${cli.version||'unknown'}${cli.path ? ` ? Path: ${cli.path}` : ''}${stale?' ? Cached result, rechecking in background':''}`
      : ((cli.error||'Hermes CLI not detected') + '. Install native Hermes for Windows and ensure hermes is on PATH.');
  return `
    <div style="flex:1;min-width:0">
      <div class="settings-label">Hermes CLI ${statusText}</div>
      <div class="settings-desc">${esc(detail)}</div>
      <div style="margin-top:8px;font-size:var(--fs-sm);color:var(--c-ink-muted)">Status: <span class="platform-status ${statusClass}" style="display:inline-flex;align-items:center">${statusText}</span> ? Runtime: ${esc(cli.type||'native')}</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;align-items:flex-start">
      <button class="btn btn-secondary" onclick="loadCliStatusCard(true)">${checking?'Checking...':'Refresh status'}</button>
      <button class="btn btn-secondary" onclick="showCliInstallGuide()">Install guide</button>
    </div>`;
}

async function loadCliStatusCard(force=false, seq){
  const box=$('#cliStatusCard');
  if(!box || !isSettingsPage('settings')) return;
  const cached=state.cliStatusCache;
  if(cached && cached.available && !force){
    box.innerHTML=cliStatusCardHtml({...cached, stale:true}, {checking:true});
  }else{
    box.innerHTML=`<div style="flex:1"><div class="settings-label">正在检测...</div><div class="settings-desc">正在查询 Hermes CLI 与运行状态。</div></div>`;
  }
  try{
    const data=await apiGet('/api/agent');
    if(!isRenderCurrent(seq) || !isSettingsPage('settings')) return;
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
    if(!isRenderCurrent(seq) || !isSettingsPage('settings')) return;
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
      <h3>Hermes CLI for Windows</h3>
      <div style="display:grid;gap:10px;font-size:var(--fs-md);line-height:1.65;color:var(--c-ink)">
        <div>1. Install the native Windows Hermes Agent CLI.</div>
        <div>2. Open Windows Terminal and verify <code>hermes --version</code>.</div>
        <div>3. If detection fails, make sure the Hermes install directory is included in <code>PATH</code>.</div>
        <div style="padding:12px;border:1px solid var(--c-hairline);border-radius:12px;background:var(--c-surface1)">
          <strong>Recommended checks</strong>
          <div style="margin-top:6px;color:var(--c-ink-muted)"><code>where hermes</code><br><code>hermes --version</code></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>`);
}

function saveSettings(){
  const promptToggles={};
  ['webuiRules','coreMemory','agentRules','userSystemPrompt','profilePrompt','skills','knowledgeSearch'].forEach(id=>promptToggles[id]=$(`#pt_${id}`)?.checked!==false);
  state.settings={lang:$('#sLang').value,stream:$('#sStream').checked,debugPerf:$('#sDebugPerf').checked,quickMode:$('#sQuick').checked,routingMode:$('#sRoutingMode')?.value||'auto',agentRuntime:'cli',hermesApiServerUrl:state.settings.hermesApiServerUrl||'',hermesApiServerKey:state.settings.hermesApiServerKey||'',toolPermissions:{commandPolicy:$('#sCommandPolicy')?.value||'safe',logApprovals:$('#sLogApprovals')?.checked!==false,requireApprovalForRisky:$('#sRequireRiskyApproval')?.checked!==false},history:parseInt($('#sHistory').value)||20,systemPrompt:$('#sSys').value,api:$('#sApi').value.trim(),style:$('#sStyle')?.value||'minimal',dataRootDir:$('#sDataRootDir')?.value?.trim()||'',memoryDir:$('#sMemoryDir')?.value?.trim()||'',imageDir:$('#sImageDir')?.value?.trim()||'',historyDir:$('#sHistoryDir')?.value?.trim()||'',mdLibraryDir:$('#sMdLibraryDir')?.value?.trim()||'',promptToggles,knowledgeSearchLimit:Math.max(0,Math.min(parseInt($('#sKnowledgeSearchLimit')?.value)||0,8))};
  state.modelConfigScope = state.settings.quickMode ? 'webui' : 'agent';
  LS.set('hermes.modelConfigScope', state.modelConfigScope);
  activeModelsConfig();
  syncStateModelFromModelsConfig();
  save();
  apiPut('/api/settings', {
    lang: state.settings.lang,
    stream: state.settings.stream,
    debugPerf: state.settings.debugPerf,
    quickMode: state.settings.quickMode,
    routingMode: state.settings.routingMode || 'auto',
    agentRuntime: 'cli',
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
  }).then(ok=>{
    toast(ok?'设置已保存，已立即生效':'设置已保存到本地，后端同步失败','success');
    renderPage();
    pingApi();
  });
}

async function loadAppVersion(){
  const el=$('#appVersionText');
  if(!el) return;
  try{
    const data=await apiGet('/api/system/update-status');
    if(data?.packageVersion) el.textContent='V'+data.packageVersion;
  }catch(_){}
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
      {id:'default',name:'默认助手',modelId:'auto',model:scenarioModelName('chat'),systemPrompt:'',color:'var(--c-block-lime)'},
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
    <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">新建角色</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">角色名称</label><input id="pfName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" placeholder="例如：代码专家"></div>
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">使用模型</label><input id="pfModel" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(state.model.model)}"></div>
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">系统提示词</label><textarea id="pfPrompt" style="width:100%;min-height:80px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);resize:vertical" placeholder="描述角色的能力和行为…"></textarea></div>
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
    <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">编辑角色</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">角色名称</label><input id="pfName" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(p.name)}"></div>
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">使用模型</label><input id="pfModel" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)" value="${esc(p.model)}"></div>
      <div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">系统提示词</label><textarea id="pfPrompt" style="width:100%;min-height:80px;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base);resize:vertical">${esc(p.systemPrompt||'')}</textarea></div>
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
  state.model.model=p.model||scenarioModelName('chat');
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
        <span style="font-size:var(--fs-md);color:var(--c-ink-muted)">${_gatewaysCache.enabled?'已启用':'已禁用'}</span>
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
      <div style="font-weight:var(--fw-semibold)">${esc(p.icon||'')} ${esc(p.name)}</div>
      <span style="font-size:var(--fs-xs);padding:2px 8px;border-radius:var(--r-pill);background:${(p.streamConnected||p.connected)?'var(--c-success)':(p.configured?'var(--c-accent-soft)':'var(--c-hairline)')};color:${(p.streamConnected||p.connected)?'#fff':(p.configured?'var(--c-accent)':'var(--c-ink-muted)')}">${p.streamConnected?'\u957f\u8fde\u63a5':(p.connected?'\u5df2\u8fde\u63a5':(p.configured?'\u5f85\u8fde\u63a5':'\u672a\u914d\u7f6e'))}</span>
    </div>
    <div style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-top:4px">${esc(p.desc||'')}</div>
    <div style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-top:2px">${p.enabled?'\u2713 \u5df2\u542f\u7528':'\u2717 \u5df2\u7981\u7528'}${(p.streamStatusMsg||p.statusMsg)?' - '+esc(p.streamStatusMsg||p.statusMsg):''}</div>
  </div>`).join('')}</div>`;
}
function toggleGatewayEnabled(){
  const enabled=$('#gwEnabled')?.checked;
  if(_gatewaysCache){_gatewaysCache.enabled=enabled;apiPut('/api/gateway',{enabled})}
}
function editGateway(id){
  const p=(_gatewaysCache?.platforms||[]).find(x=>x.id===id);
  if(!p) return;
  const fields=(p.fields||[]).map(f=>`<div><label style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-bottom:4px;display:block">${esc(f)}</label><input id="gw_${esc(f)}" value="${esc(p.config?.[f]||'')}" style="width:100%;padding:8px 12px;border-radius:var(--r-md);border:1px solid var(--c-hairline);background:var(--c-canvas);color:var(--c-ink);font-size:var(--fs-base)"></div>`).join('');
  const feishuHelp=id==='feishu'?`<div style="font-size:var(--fs-sm);color:var(--c-ink-muted);line-height:1.6;margin:-4px 0 12px">\u5df2\u542f\u7528\u98de\u4e66\u957f\u8fde\u63a5\u6a21\u5f0f\uff1a\u53ea\u9700\u8981 App ID / App Secret\uff0c\u4e0d\u9700\u8981\u516c\u7f51\u56de\u8c03\u5730\u5740\u3002<br>\u5728\u98de\u4e66\u91cc\u53d1\u9001\u201c\u751f\u56fe/\u751f\u6210\u56fe\u7247/\u753b\u56fe + \u63cf\u8ff0\u201d\uff0cWebUI \u4f1a\u672c\u5730\u751f\u6210\u56fe\u7247\u5e76\u56de\u53d1\u5230\u98de\u4e66\u3002</div>`:'';
  openModal(`<div style="padding:24px;min-width:400px">
    <h3 style="margin-bottom:16px;font-size:var(--fs-xl);font-weight:var(--fw-semibold)">${esc(p.icon||'')} ${esc(p.name)}</h3>
    <p style="font-size:var(--fs-md);color:var(--c-ink-muted);margin-bottom:16px">${esc(p.desc||'')}</p>
    <div style="display:flex;flex-direction:column;gap:12px">${fields||'<div style="font-size:var(--fs-md);color:var(--c-ink-muted)">无需额外配置</div>'}</div>
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
  if(!silent) toast(resp?.data?.msg || resp?.msg || (ok?'测试成功':'测试失败'), ok?'success':'error');
  return {ok,msg:resp?.data?.msg||resp?.msg||''};
}
async function saveGateway(id){
  const p=collectGatewayForm(id);
  if(!p) return;
  if(id==='feishu' && p.enabled){
    const result=await testGateway(id,{silent:true});
    if(!result?.ok){
      toast(result?.msg || '飞书网关测试失败，请检查 appId / appSecret', 'error');
      return;
    }
  }else{
    await apiPut('/api/gateway',_gatewaysCache);
  }
  _gatewaysCache=await apiGet('/api/gateway')||_gatewaysCache;
  _channelsCache=_gatewaysCache;
  closeModal();renderPage();toast(id==='feishu'?'飞书网关已保存':'网关配置已保存','success');
}

let _diagnosticsCache=null;
function renderDiagnostics(){
  if(!_diagnosticsCache){
    apiGet('/api/system/diagnostics').then(data=>{
      _diagnosticsCache=data||null;
      const el=$('#diagnosticsContainer');
      if(el) el.innerHTML=buildDiagnosticsHtml(_diagnosticsCache);
    });
  }
  return `<div class="logs-view diagnostic-page">
    <div class="page-header"><h2>Diagnostics</h2>
      <div class="page-subtitle">Windows native Hermes, data directories, models, and recent warnings.</div>
      <div class="header-actions"><button class="btn btn-xs btn-ghost" onclick="refreshDiagnostics()">Refresh</button></div>
    </div>
    <div id="diagnosticsContainer">${buildDiagnosticsHtml(_diagnosticsCache)}</div>
  </div>`;
}
function buildDiagnosticsHtml(data){
  if(typeof HermesDiagnostics!=='undefined' && HermesDiagnostics && typeof HermesDiagnostics.render==='function') return HermesDiagnostics.render(data);
  return data ? `<pre>${esc(JSON.stringify(data,null,2))}</pre>` : '<div class="empty-state"><span>Loading diagnostics...</span></div>';
}
function refreshDiagnostics(){
  _diagnosticsCache=null;
  if(isSettingsPage('diagnostics')) renderPage();
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
      <div class="header-actions"><button class="btn btn-xs btn-secondary" onclick="setSettingsTab('diagnostics')">Diagnostics</button><button class="btn btn-xs btn-ghost" onclick="_logsCache=null;renderPage()">刷新</button></div>
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
    <div class="page-header"><h2>Agent 管理</h2><div class="page-subtitle">固定 5 个核心 Agent，可配置头像、模型、提示词与技能。</div></div>
    <div class="profiles-content">
      <div class="profile-grid agent-grid">${profiles.map(p=>{
        const enabled=p.enabled!==false;
        const skillNames=selectedProfileSkills(p).map(s=>s.name).slice(0,3);
        const model=p.modelId==='auto'?'自动 · '+scenarioModelName('chat'):(getModelById(p.modelId)?.name||p.model||'未设置');
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
    <div class="agent-editor-head">
      <div>
        <h3>${profile?'编辑 Agent':'新建 Agent'}</h3>
        <p>${esc(p.role||'配置这个 Agent 的模型、提示词、技能与记忆入口。')}</p>
      </div>
      <button class="btn-icon" onclick="closeModal()" title="关闭">×</button>
    </div>
    <div class="agent-editor-body">
      <section class="agent-editor-section agent-avatar-field">
        <span id="pfAvatarPreview" class="profile-avatar" style="${p.avatar?`background-image:url('${esc(p.avatar)}');background-size:cover;background-position:center`:`background:${p.color||'var(--c-block-lime)'}`}">${p.avatar?'':esc((p.name||'A').charAt(0))}</span>
        <div class="agent-editor-section-main">
          <small>头像、记忆入口与启用状态会同步影响对话页和 Agent 切换。</small>
          <div class="agent-avatar-actions">
            <button class="btn btn-xs btn-secondary" onclick="document.getElementById('pfAvatarInput').click()">更换头像</button>
            <button class="btn btn-xs btn-ghost" onclick="resetProfileAvatar()">恢复默认头像</button>
          </div>
          <input id="pfAvatarInput" type="file" accept="image/*" style="display:none" onchange="handleProfileAvatarInput(this)">
        </div>
        <label class="agent-editor-toggle" title="启用这个 Agent"><input type="checkbox" id="pfEnabled" ${p.enabled!==false?'checked':''}><span></span></label>
      </section>
      <div class="agent-editor-fields">
        <label>名称<input id="pfName" placeholder="Agent 名称" value="${esc(p.name)}"></label>
        <label>模型<select id="pfModel">${opts}</select></label>
      </div>
      <label class="agent-editor-prompt">Agent 提示词<textarea id="pfPrompt" placeholder="描述这个 Agent 的身份、能力边界、工作方式…">${esc(p.systemPrompt||'')}</textarea></label>
      <section class="agent-skill-picker">
        <div class="agent-skill-picker-head"><strong>\u6280\u80fd</strong></div>
        <div class="agent-skill-list">${skillHtml}</div>
      </section>
    </div>
    <div class="agent-editor-actions"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="${profile?`doEditProfileV2('${p.id}')`:'doAddProfileV2()'}">保存</button></div>
  </div>`);
}
function addProfileV2(){toast('当前版本固定 5 个核心 Agent，请直接编辑对应 Agent。','info')}
function editProfileV2(id){profileModal(getProfiles().find(p=>p.id===id))}
function doAddProfileV2(){
  const name=$('#pfName')?.value?.trim();
  if(!name){toast('请填写角色名称','error');return}
  const modelId=$('#pfModel')?.value||'auto';
  const model=getModelById(modelId)?.name||scenarioModelName('chat');
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
  p.model=getModelById(p.modelId)?.name||scenarioModelName('chat');
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
  if(!items||!items.length) return '<div style="font-size:var(--fs-md);color:var(--c-ink-muted);padding:8px 12px">空目录</div>';
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
      ${f.size?`<span style="font-size:var(--fs-xs);color:var(--c-ink-muted);margin-left:auto">${formatBytes(f.size)}</span>`:''}
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
      <h2>终端历史 <span style="font-size:var(--fs-sm);color:var(--c-ink-muted);margin-left:6px">▶</span></h2>
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
  overlay.dataset.disableBackdropClose=options.disableBackdropClose?'1':'0';
  content.innerHTML=html;
  overlay.classList.add('show');
}

function handleModalOverlayClick(event){
  const overlay=$('#modalOverlay');
  if(!overlay || event.target!==overlay) return;
  if(overlay.dataset.disableBackdropClose==='1') return;
  closeModal();
}

function closeModal(){
  const overlay=$('#modalOverlay');
  const content=$('#modalContent');
  if(overlay){
    overlay.classList.remove('show');
    overlay.dataset.disableBackdropClose='0';
  }
  if(content) content.className='modal';
  state._editorFetchedModels=null;
  state._modelEditorContext=null;
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
  if(hljsTheme) hljsTheme.href = state.theme === 'dark' ? 'frontend/css/github-dark.min.css' : 'frontend/css/github.min.css';

  // Load settings
  const settings = await apiGet('/api/settings');
  if (settings) {
    const localStyle = state.settings.style;
    const localApi = state.settings.api;
    state.settings = { ...state.settings, ...settings };
    if (settings.quickMode !== undefined) state.settings.quickMode = !!settings.quickMode;
    if (settings.routingMode !== undefined) state.settings.routingMode = settings.routingMode || 'auto';
    state.settings.agentRuntime = 'cli';
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
    state.modelsConfigRoot = normalizeModelsRootForClient(modelData);
    state.modelsConfig = activeModelsConfig();
    syncStateModelFromModelsConfig(state.modelsConfig);
  }

  // Load WebUI chats and real Hermes CLI sessions together.
  await refreshChatSources({limit:state.cliSessionLimit||500,keepCurrent:false});
  if (state.chats.length) await selectChat(state.chats[0].id);

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











function toggleSecretInput(id, btn){
  const input=document.getElementById(id);
  if(!input) return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  if(btn) btn.classList.toggle('active', show);
}


if (typeof window !== 'undefined' && !window.__hermesIssueGlobalBound) {
  window.__hermesIssueGlobalBound = true;
  window.addEventListener('error', (event) => {
    if (typeof autoReportWebuiIssue === 'function') autoReportWebuiIssue('frontend_error', event.message || 'frontend error', { severity:'medium', context:{ filename:event.filename||'', lineno:event.lineno||0, colno:event.colno||0 } });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason && (event.reason.stack || event.reason.message) ? (event.reason.stack || event.reason.message) : String(event.reason || 'unhandled rejection');
    if (typeof autoReportWebuiIssue === 'function') autoReportWebuiIssue('frontend_rejection', reason, { severity:'medium' });
  });
}
