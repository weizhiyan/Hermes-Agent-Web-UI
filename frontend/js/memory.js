/**
 * Memory page — browse past conversations.
 */
import { escapeHtml } from './store.js';
import { api } from './api.js';

export async function initMemory() {
  const search = document.getElementById('memorySearch');
  const content = document.getElementById('memoryContent');
  if (!search || !content) return;

  async function loadMemories(query) {
    content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3)">加载中…</div>';
    let chats = [];
    try {
      chats = await api.listChats();
    } catch {}

    const kw = (query || '').toLowerCase();
    const filtered = kw
      ? chats.filter(c => (c.title || '').toLowerCase().includes(kw))
      : chats;

    if (filtered.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◇</div>
          <div class="empty-title">${kw ? '没有匹配的记忆' : '记忆空间'}</div>
          <div class="empty-desc">${kw ? '试试其他关键词' : '对话会自动保存在这里，方便随时回顾'}</div>
        </div>`;
      return;
    }

    content.innerHTML = `
      <div class="memory-grid">
        ${filtered.map(c => `
          <div class="memory-card" data-id="${c.id || c._id}">
            <div class="memory-card-icon">○</div>
            <div class="memory-card-body">
              <h3>${escapeHtml(c.title || '未命名对话')}</h3>
              <p>${escapeHtml((c.preview || '').substring(0, 80))}</p>
              <span class="memory-card-date">${new Date(c.updatedAt || Date.now()).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('')}
      </div>`;

    content.querySelectorAll('.memory-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const chatBtn = document.querySelector('[data-view="chat"]');
        if (chatBtn) chatBtn.click();
        window.dispatchEvent(new CustomEvent('load-chat', { detail: { id } }));
      });
    });
  }

  search.addEventListener('input', () => loadMemories(search.value));
  loadMemories('');
}
