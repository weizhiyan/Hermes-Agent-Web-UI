import { api } from './api.js';
import { store, toast } from './store.js';

const $ = id => document.getElementById(id);

export async function initSettings() {
  const maxRetry = 20;
  let retry = 0;
  while (!$('#settingsForm') && retry < maxRetry) {
    await new Promise(r => setTimeout(r, 100));
    retry++;
  }
  if (!$('#settingsForm')) { console.error('initSettings: DOM not ready'); return; }
  const form = $('#settingsForm');
  let s;
  try { s = await api.getSettings(); }
  catch { s = { theme: 'dark', lang: 'zh', stream: true, history: 20, systemPrompt: '', useHermesCli: false, hermesModel: '' }; }

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
      <input class="input" id="s_hist" type="number" min="1" max="100" value="${s.history || 20}">
    </div>
    <div class="form-item"><label>自动标题</label>
      <select class="input" id="s_autoTitle">
        <option value="true" ${s.autoTitle !== false ? 'selected' : ''}>开启</option>
        <option value="false" ${s.autoTitle === false ? 'selected' : ''}>关闭</option>
      </select>
    </div>

    <div class="form-section">Hermes CLI 模式</div>
    <div class="form-item" style="grid-column:1/-1">
      <p class="form-hint">启用后将使用本地 Hermes CLI 进行对话，支持工具调用、技能、记忆等完整功能。关闭则使用 API 直连模式。</p>
    </div>
    <div class="form-item"><label>使用 Hermes CLI</label>
      <select class="input" id="s_useCli">
        <option value="true" ${s.useHermesCli ? 'selected' : ''}>开启</option>
        <option value="false" ${!s.useHermesCli ? 'selected' : ''}>关闭</option>
      </select>
    </div>
    <div class="form-item"><label>CLI 模型</label>
      <input class="input" id="s_hermesModel" value="${s.hermesModel || ''}" placeholder="deepseek-chat">
    </div>

    <div class="form-section">系统提示词</div>
    <div class="form-item" style="grid-column:1/-1">
      <textarea class="input" id="s_sys" rows="4" style="height:auto;min-height:60px" placeholder="设置 AI 的默认行为和角色...">${s.systemPrompt || ''}</textarea>
    </div>

    <div class="form-section">快捷键</div>
    <div class="form-item" style="grid-column:1/-1">
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--text-2)">
        <div style="display:flex;justify-content:space-between"><span>新建对话</span><span class="kbd">Ctrl+N</span></div>
        <div style="display:flex;justify-content:space-between"><span>发送消息</span><span class="kbd">Enter</span></div>
        <div style="display:flex;justify-content:space-between"><span>换行</span><span class="kbd">Shift+Enter</span></div>
        <div style="display:flex;justify-content:space-between"><span>命令菜单</span><span class="kbd">/</span></div>
      </div>
    </div>

    <div class="form-section">关于</div>
    <div class="form-item" style="grid-column:1/-1">
      <div style="font-size:12.5px;color:var(--text-2);line-height:1.6">
        <div style="font-weight:600;margin-bottom:4px">Hermes Agent</div>
        <div>版本 0.1.0</div>
        <div>智能 AI 助手 — 支持多模型、技能系统、长期记忆</div>
      </div>
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
        autoTitle: $('#s_autoTitle').value === 'true',
        systemPrompt: $('#s_sys').value,
        useHermesCli: $('#s_useCli').value === 'true',
        hermesModel: $('#s_hermesModel').value.trim(),
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
      status.style.color = 'var(--accent)';
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

export async function updateConnDot() {
  const dot = $('#connDot');
  if (!dot) return;
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
