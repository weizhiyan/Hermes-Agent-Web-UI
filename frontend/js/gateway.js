/**
 * Gateway / Platform Channels page.
 * Shows all supported messaging platforms (Telegram, Discord, DingTalk, WeChat, QQ, Feishu, etc.)
 */
import { api } from './api.js';
import { escapeHtml, toast } from './store.js';

const $ = id => document.getElementById(id);

export async function initGateway() {
  const grid = $('platformGrid');
  if (!grid) return;

  async function load() {
    let data;
    try { data = await api.getGateway(); } catch { data = { enabled: false, platforms: [] }; }

    // Master toggle
    const toggle = $('gatewayMasterToggle');
    const label = $('gatewayMasterLabel');
    if (toggle) {
      toggle.className = 'switch' + (data.enabled ? ' on' : '');
      toggle.onclick = async () => {
        data.enabled = !data.enabled;
        toggle.classList.toggle('on', data.enabled);
        try {
          await api.saveGateway({ enabled: data.enabled });
          label.textContent = data.enabled ? '已启用' : '未启用';
          toast(data.enabled ? 'Gateway 已启用' : 'Gateway 已停用');
        } catch (e) { toast(e.message); }
      };
    }
    if (label) label.textContent = data.enabled ? '已启用' : '未启用';

    // Platform cards
    const platforms = data.platforms || [];
    if (platforms.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-title">暂无平台</div><div class="empty-desc">可通过 Hermes CLI 配置平台连接</div></div>';
      return;
    }

    grid.innerHTML = platforms.map(p => `
      <div class="platform-card">
        <div class="platform-card-icon">${p.icon || '📡'}</div>
        <div class="platform-card-body">
          <div class="platform-card-name">${escapeHtml(p.name)}</div>
          <div class="platform-card-desc">${escapeHtml(p.desc || '')}</div>
        </div>
        <div class="platform-card-status">
          <span class="status-dot ${p.configured ? 'online' : ''}"></span>
          <span class="status-label">${p.configured ? '已配置' : '未配置'}</span>
        </div>
        <div class="switch ${p.enabled ? 'on' : ''}" data-platform="${escapeHtml(p.name)}"></div>
      </div>
    `).join('');

    grid.querySelectorAll('.switch[data-platform]').forEach(sw => {
      sw.onclick = async (e) => {
        e.stopPropagation();
        const name = sw.dataset.platform;
        const plat = platforms.find(x => x.name === name);
        if (!plat) return;
        plat.enabled = !plat.enabled;
        sw.classList.toggle('on', plat.enabled);
        try {
          await api.saveGateway({ platforms });
          toast(`${name} ${plat.enabled ? '已启用' : '已停用'}`);
        } catch (e) { toast(e.message); }
      };
    });
  }

  await load();
}
