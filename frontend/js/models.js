import { api } from './api.js';
import { toast } from './store.js';

const $ = id => document.getElementById(id);

export async function initModels() {
  const maxRetry = 20;
  let retry = 0;
  while (!$('modelsForm') && retry < maxRetry) {
    await new Promise(r => setTimeout(r, 100));
    retry++;
  }
  if (!$('modelsForm')) { console.error('initModels: DOM not ready'); return; }
  const form = $('modelsForm');
  let cfg, settings;
  try { cfg = await api.getModels(); } catch { cfg = { params: {}, current: '' }; }
  try { settings = await api.getSettings(); } catch { settings = { hermesModel: '', autoRoute: true, fastModel: 'deepseek', codeModel: 'wind' }; }

  const ds = cfg.deepseek || {};
  const wind = cfg.wind || {};
  const anthropic = cfg.anthropic || {};
  const openai = cfg.openai || {};
  const local = cfg.local || {};
  const params = cfg.params || {};

  form.innerHTML = `
    <div class="form-section">当前模型</div>
    <div class="form-item" style="grid-column:1/-1">
      <label>当前使用的模型</label>
      <select class="input" id="m_current">
        <option value="deepseek-chat" ${cfg.current === 'deepseek-chat' ? 'selected' : ''}>DeepSeek Chat</option>
        <option value="deepseek-v4-flash" ${cfg.current === 'deepseek-v4-flash' ? 'selected' : ''}>DeepSeek V4 Flash</option>
        <option value="deepseek-reasoner" ${cfg.current === 'deepseek-reasoner' ? 'selected' : ''}>DeepSeek Reasoner</option>
        <option value="claude-opus-4-7" ${cfg.current === 'claude-opus-4-7' ? 'selected' : ''}>Claude Opus 4.7</option>
        <option value="gpt-4o" ${cfg.current === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
        <option value="qwen2.5:7b" ${cfg.current === 'qwen2.5:7b' ? 'selected' : ''}>Qwen 2.5 7B (本地)</option>
      </select>
    </div>

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

    <div class="form-section">☁️ DeepSeek</div>
    <div class="form-item"><label>模型名</label>
      <input class="input" id="m_ds_model" value="${ds.model || ''}" placeholder="deepseek-chat"></div>
    <div class="form-item"><label>Base URL</label>
      <input class="input" id="m_ds_base" value="${ds.base || ''}" placeholder="https://api.deepseek.com"></div>
    <div class="form-item"><label>API Key</label>
      <input class="input" id="m_ds_key" type="password" value="${ds.key || ''}" placeholder="sk-..."></div>
    <div class="form-item"><label>状态</label>
      <div class="status-badge ${ds.key ? 'online' : 'offline'}"><span class="dot ${ds.key ? '' : 'off'}"></span>${ds.key ? '已配置' : '未配置'}</div>
    </div>

    <div class="form-section">🌀 Wind Claude</div>
    <div class="form-item"><label>模型名</label>
      <input class="input" id="m_wind_model" value="${wind.model || ''}" placeholder="[wind]claude-opus-4-7-max"></div>
    <div class="form-item"><label>Base URL</label>
      <input class="input" id="m_wind_base" value="${wind.base || ''}" placeholder="https://api.anthropic.com"></div>
    <div class="form-item"><label>API Key</label>
      <input class="input" id="m_wind_key" type="password" value="${wind.key || ''}" placeholder="sk-ant-..."></div>
    <div class="form-item"><label>状态</label>
      <div class="status-badge ${wind.key ? 'online' : 'offline'}"><span class="dot ${wind.key ? '' : 'off'}"></span>${wind.key ? '已配置' : '未配置'}</div>
    </div>

    <div class="form-section">🤖 Anthropic</div>
    <div class="form-item"><label>模型名</label>
      <input class="input" id="m_ant_model" value="${anthropic.model || ''}" placeholder="claude-opus-4-7"></div>
    <div class="form-item"><label>Base URL</label>
      <input class="input" id="m_ant_base" value="${anthropic.base || ''}" placeholder="https://api.anthropic.com"></div>
    <div class="form-item"><label>API Key</label>
      <input class="input" id="m_ant_key" type="password" value="${anthropic.key || ''}" placeholder="sk-ant-..."></div>
    <div class="form-item"><label>状态</label>
      <div class="status-badge ${anthropic.key ? 'online' : 'offline'}"><span class="dot ${anthropic.key ? '' : 'off'}"></span>${anthropic.key ? '已配置' : '未配置'}</div>
    </div>

    <div class="form-section">💡 OpenAI</div>
    <div class="form-item"><label>模型名</label>
      <input class="input" id="m_oai_model" value="${openai.model || ''}" placeholder="gpt-4o"></div>
    <div class="form-item"><label>Base URL</label>
      <input class="input" id="m_oai_base" value="${openai.base || ''}" placeholder="https://api.openai.com/v1"></div>
    <div class="form-item"><label>API Key</label>
      <input class="input" id="m_oai_key" type="password" value="${openai.key || ''}" placeholder="sk-..."></div>
    <div class="form-item"><label>状态</label>
      <div class="status-badge ${openai.key ? 'online' : 'offline'}"><span class="dot ${openai.key ? '' : 'off'}"></span>${openai.key ? '已配置' : '未配置'}</div>
    </div>

    <div class="form-section">🖥️ 本地模型 (Ollama)</div>
    <div class="form-item"><label>模型名</label>
      <input class="input" id="m_local_model" value="${local.model || ''}" placeholder="qwen2.5:7b"></div>
    <div class="form-item"><label>Base URL</label>
      <input class="input" id="m_local_base" value="${local.base || ''}" placeholder="http://127.0.0.1:11434"></div>
    <div class="form-item"><label>状态</label>
      <div id="localStatus" class="status-badge offline"><span class="dot off"></span>未检测</div>
    </div>
    <div class="form-item"><label>检测连接</label>
      <button class="btn btn-ghost" id="checkLocalBtn">检测 Ollama</button>
    </div>

    <div class="form-section">采样参数</div>
    <div class="form-item"><label>Temperature</label>
      <input class="input" id="m_temp" type="number" step="0.1" min="0" max="2" value="${params.temperature ?? 0.7}"></div>
    <div class="form-item"><label>Max Tokens</label>
      <input class="input" id="m_max" type="number" min="1" max="128000" value="${params.maxTokens ?? 4096}"></div>
    <div class="form-item"><label>Top P</label>
      <input class="input" id="m_top" type="number" step="0.05" min="0" max="1" value="${params.topP ?? 1}"></div>
  `;

  $('#checkLocalBtn').onclick = async () => {
    const base = $('#m_local_base').value.trim() || 'http://127.0.0.1:11434';
    const statusEl = $('#localStatus');
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(base.replace(/\/$/, '') + '/api/tags', { signal: ctrl.signal });
      if (r.ok) {
        const data = await r.json();
        const count = data.models?.length || 0;
        statusEl.className = 'status-badge online';
        statusEl.innerHTML = `<span class="dot"></span>已连接 (${count} 个模型)`;
      } else { throw 0; }
    } catch {
      statusEl.className = 'status-badge offline';
      statusEl.innerHTML = '<span class="dot off"></span>未连接';
    }
  };

  $('#saveModelsBtn').onclick = async () => {
    try {
      await api.saveSettings({
        autoRoute: $('#m_autoRoute').value === 'true',
        fastModel: $('#m_fastModel').value,
        codeModel: $('#m_codeModel').value,
      });
      await api.saveModels({
        current: $('#m_current').value,
        deepseek: { base: $('#m_ds_base').value, key: $('#m_ds_key').value, model: $('#m_ds_model').value },
        wind: { base: $('#m_wind_base').value, key: $('#m_wind_key').value, model: $('#m_wind_model').value },
        anthropic: { base: $('#m_ant_base').value, key: $('#m_ant_key').value, model: $('#m_ant_model').value },
        openai: { base: $('#m_oai_base').value, key: $('#m_oai_key').value, model: $('#m_oai_model').value },
        local: { base: $('#m_local_base').value, model: $('#m_local_model').value },
        params: { temperature: +$('#m_temp').value, maxTokens: +$('#m_max').value, topP: +$('#m_top').value },
      });
      toast('已保存');
    } catch (e) { toast(e.message); }
  };
}
