/**
 * Agent Status page.
 * Shows Hermes agent configuration, toolset status, and core settings.
 */
import { api } from './api.js';
import { escapeHtml } from './store.js';

const $ = id => document.getElementById(id);

export async function initAgent() {
  const content = $('agentContent');
  if (!content) return;

  const updateDot = $('#agentStatusDot');
  const updateLabel = $('#agentStatusLabel');

  async function load() {
    let data;
    try { data = await api.getAgent(); } catch { data = {}; }

    if (updateDot) updateDot.className = 'dot' + (data.status !== 'running' ? ' off' : '');
    if (updateLabel) updateLabel.textContent = data.status === 'running' ? '运行中' : (data.status || '未知');

    const toolsets = (data.toolsets || []).filter(t => t);
    const cfg = data.config || {};

    content.innerHTML = `
      <div class="agent-grid">

        <!-- Status card -->
        <div class="agent-card">
          <div class="agent-card-title">代理状态</div>
          <div class="agent-status-row">
            <span class="dot ${data.status === 'running' ? '' : 'off'}"></span>
            <span>${data.status === 'running' ? '运行中' : '已停止'}</span>
          </div>
          <div class="agent-meta">
            <div><span class="meta-label">运行时间</span><span class="meta-value">${escapeHtml(data.uptime || 'N/A')}</span></div>
            <div><span class="meta-label">会话数</span><span class="meta-value">${data.sessionCount ?? 0}</span></div>
            <div><span class="meta-label">记忆</span><span class="meta-value">${data.memoryEnabled ? '✅ 已启用' : '❌ 未启用'}</span></div>
            <div><span class="meta-label">技能</span><span class="meta-value">${data.skillsEnabled ? '✅ 已启用' : '❌ 未启用'}</span></div>
          </div>
        </div>

        <!-- Config card -->
        <div class="agent-card">
          <div class="agent-card-title">代理配置</div>
          <div class="agent-meta">
            <div><span class="meta-label">最大轮次</span><span class="meta-value">${cfg.max_turns ?? 90}</span></div>
            <div><span class="meta-label">上下文压缩</span><span class="meta-value">${cfg.compression_enabled ? '已启用' : '已禁用'}</span></div>
            <div><span class="meta-label">压缩阈值</span><span class="meta-value">${((cfg.compression_threshold ?? 0.5) * 100).toFixed(0)}%</span></div>
            <div><span class="meta-label">压缩目标</span><span class="meta-value">${((cfg.compression_target_ratio ?? 0.2) * 100).toFixed(0)}%</span></div>
            <div><span class="meta-label">工具强制使用</span><span class="meta-value">${cfg.tool_use_enforcement ? '✅' : '❌'}</span></div>
          </div>
        </div>

        <!-- Toolsets card -->
        <div class="agent-card agent-card-full">
          <div class="agent-card-title">工具集 (${toolsets.length})</div>
          <div class="toolset-grid">
            ${toolsets.map(t => `
              <div class="toolset-item">
                <span class="dot ${t.enabled ? '' : 'off'}"></span>
                <div class="toolset-info">
                  <div class="toolset-name">${escapeHtml(t.name)}</div>
                  <div class="toolset-desc">${escapeHtml(t.desc || '')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Apply grid styles for the agent page
    const style = document.createElement('style');
    style.textContent = `
      .agent-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 20px; min-height: 0; overflow: auto; align-content: start;
      }
      .agent-card {
        background: var(--surface); border: 1px solid var(--color-border-1); border-radius: var(--radius); padding: 14px;
      }
      .agent-card-full { grid-column: 1/-1; }
      .agent-card-title { font-size: 12px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 8px; }
      .agent-status-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--color-text-1); margin-bottom: 12px; }
      .agent-meta { display: flex; flex-direction: column; gap: 6px; }
      .agent-meta > div { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; }
      .meta-label { color: var(--text-3); }
      .meta-value { color: var(--text-2); font-family: var(--mono); font-size: 12px; }
      .toolset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
      .toolset-item { display: flex; align-items: flex-start; gap: 6px; padding: 6px 8px; border-radius: 6px; background: var(--surface-2); }
      .toolset-item .dot { margin-top: 4px; flex-shrink: 0; width: 6px; height: 6px; }
      .toolset-info { min-width: 0; }
      .toolset-name { font-size: 12px; font-weight: 500; color: var(--text-1); }
      .toolset-desc { font-size: 10.5px; color: var(--text-3); line-height: 1.3; }
    `;
    // Avoid duplicate styles
    const existing = document.getElementById('agent-page-style');
    if (existing) existing.remove();
    style.id = 'agent-page-style';
    document.head.appendChild(style);
  }

  await load();
}
