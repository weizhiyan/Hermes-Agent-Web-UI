/**
 * Usage / Token Stats page.
 * Shows token consumption, message counts, and per-model stats.
 */
import { api } from './api.js';
import { escapeHtml } from './store.js';

const $ = id => document.getElementById(id);

export async function initUsage() {
  const content = $('usageContent');
  if (!content) return;

  $('refreshUsageBtn').onclick = load;

  async function load() {
    let data;
    try { data = await api.getUsage(); } catch { data = {}; }

    const models = data.models || {};
    const modelKeys = Object.keys(models);
    const todayTokens = data.todayTokens ?? 0;
    const todayMsgs = data.todayMessages ?? 0;
    const totalTokens = data.totalTokens ?? 0;
    const totalMsgs = data.totalMessages ?? 0;
    const totalSessions = data.totalSessions ?? 0;

    content.innerHTML = `
      <div class="usage-grid">

        <!-- Summary stats -->
        <div class="usage-stat-card">
          <div class="usage-stat-value">${todayTokens.toLocaleString()}</div>
          <div class="usage-stat-label">今日 Token</div>
        </div>
        <div class="usage-stat-card">
          <div class="usage-stat-value">${todayMsgs}</div>
          <div class="usage-stat-label">今日消息</div>
        </div>
        <div class="usage-stat-card">
          <div class="usage-stat-value">${totalTokens.toLocaleString()}</div>
          <div class="usage-stat-label">总 Token 消耗</div>
        </div>
        <div class="usage-stat-card">
          <div class="usage-stat-value">${(totalMsgs + totalSessions).toLocaleString()}</div>
          <div class="usage-stat-label">总消息数</div>
        </div>

        <!-- Per-model breakdown -->
        <div class="usage-card usage-card-full">
          <div class="usage-card-title">各模型用量</div>
          ${modelKeys.length === 0 ? '<div style="color:var(--text-3);font-size:13px;padding:8px 0">暂无数据</div>' : ''}
          ${modelKeys.map(key => {
            const m = models[key] || {};
            return `
              <div class="usage-model-row">
                <div class="usage-model-name">${escapeHtml(key)}</div>
                <div class="usage-model-stats">
                  <span>${(m.tokens || 0).toLocaleString()} tokens</span>
                  <span>${m.messages || 0} 条消息</span>
                  <span>$${(m.cost || 0).toFixed(4)}</span>
                </div>
                <div class="usage-model-bar">
                  <div class="usage-model-fill" style="width:${Math.min(100, ((m.tokens || 0) / Math.max(1, totalTokens)) * 100)}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Info -->
        <div class="usage-card usage-card-full" style="color:var(--text-3);font-size:12px;line-height:1.6">
          <div class="usage-card-title">说明</div>
          <div>Token 统计来自桥接服务的运行数据。如需更精准的用量分析，可在 Hermes CLI 中运行 <code>hermes insights</code> 查看详细报告。</div>
        </div>

      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .usage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 16px 20px; overflow: auto; align-content: start; }
      .usage-stat-card { background: var(--surface); border: 1px solid var(--color-border-1); border-radius: var(--radius); padding: 14px; text-align: center; }
      .usage-stat-value { font-size: 22px; font-weight: 700; color: var(--brand); font-family: var(--mono); }
      .usage-stat-label { font-size: 11px; color: var(--text-3); margin-top: 2px; text-transform: uppercase; letter-spacing: .5px; }
      .usage-card { background: var(--surface); border: 1px solid var(--color-border-1); border-radius: var(--radius); padding: 14px; }
      .usage-card-full { grid-column: 1/-1; }
      .usage-card-title { font-size: 12px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
      .usage-model-row { padding: 6px 0; border-bottom: 1px solid var(--border-light); }
      .usage-model-row:last-child { border-bottom: none; }
      .usage-model-name { font-size: 13px; font-weight: 500; color: var(--text-1); margin-bottom: 2px; }
      .usage-model-stats { display: flex; gap: 12px; font-size: 11.5px; color: var(--text-3); font-family: var(--mono); }
      .usage-model-bar { height: 3px; background: var(--surface-2); border-radius: 2px; margin-top: 4px; overflow: hidden; }
      .usage-model-fill { height: 100%; background: var(--brand); border-radius: 2px; transition: width .3s ease; }
    `;
    const existing = document.getElementById('usage-page-style');
    if (existing) existing.remove();
    style.id = 'usage-page-style';
    document.head.appendChild(style);
  }

  await load();
}
