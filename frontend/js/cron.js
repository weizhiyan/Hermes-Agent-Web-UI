/**
 * Cron Jobs page — manage scheduled tasks.
 */
import { api } from './api.js';
import { escapeHtml, toast } from './store.js';

const $ = id => document.getElementById(id);
let editingId = null;

export async function initCron() {
  const content = $('cronContent');
  if (!content) return;

  // Modal setup
  $('newCronBtn').onclick = () => openCronModal(null);
  $('closeCronModal').onclick = closeCronModal;
  $('cancelCronModal').onclick = closeCronModal;
  $('saveCronModal').onclick = saveCron;
  $('cronModal').addEventListener('click', e => {
    if (e.target.id === 'cronModal') closeCronModal();
  });

  // Schedule presets
  document.querySelectorAll('#cronModal [data-schedule]').forEach(el => {
    el.onclick = () => { $('cronSchedule').value = el.dataset.schedule; };
  });

  await load();
}

async function load() {
  const content = $('cronContent');
  let crons;
  try { crons = await api.listCrons(); } catch { crons = []; }

  if (crons.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏰</div>
        <div class="empty-title">定时任务</div>
        <div class="empty-desc">创建定时运行的 AI 任务，如每日报告、代码审查等</div>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div class="cron-list">
      ${crons.map(c => `
        <div class="cron-card ${c.enabled ? '' : 'cron-disabled'}">
          <div class="cron-card-left">
            <div class="switch ${c.enabled ? 'on' : ''}" data-cron-id="${c.id}"></div>
          </div>
          <div class="cron-card-body">
            <div class="cron-name">${escapeHtml(c.name || '未命名任务')}</div>
            <div class="cron-schedule"><span class="kbd">${escapeHtml(c.schedule || '')}</span></div>
            <div class="cron-prompt">${escapeHtml((c.prompt || '').substring(0, 80))}</div>
            <div class="cron-meta">
              <span>${c.lastRun ? '上次运行: ' + new Date(c.lastRun).toLocaleString() : '尚未运行'}</span>
            </div>
          </div>
          <div class="cron-card-actions">
            <button class="item-action edit-cron-btn" data-cron-id="${c.id}" title="编辑">✏️</button>
            <button class="item-action delete-cron-btn" data-cron-id="${c.id}" title="删除">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Attach events
  content.querySelectorAll('.switch[data-cron-id]').forEach(sw => {
    sw.onclick = async () => {
      const id = sw.dataset.cronId;
      const enabled = sw.classList.toggle('on');
      try { await api.updateCron(id, { enabled }); toast(enabled ? '已启用' : '已停用'); }
      catch (e) { toast(e.message); }
    };
  });
  content.querySelectorAll('.edit-cron-btn').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); openCronModal(btn.dataset.cronId); };
  });
  content.querySelectorAll('.delete-cron-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('确认删除此定时任务？')) return;
      try { await api.deleteCron(btn.dataset.cronId); toast('已删除'); await load(); }
      catch (e) { toast(e.message); }
    };
  });
}

function openCronModal(id) {
  editingId = id;
  $('cronModalTitle').textContent = id ? '编辑定时任务' : '新建定时任务';
  if (id) {
    // Load existing data
    api.listCrons().then(crons => {
      const c = crons.find(x => x.id === id);
      if (!c) return;
      $('cronName').value = c.name || '';
      $('cronSchedule').value = c.schedule || '0 9 * * *';
      $('cronPrompt').value = c.prompt || '';
    }).catch(() => {});
  } else {
    $('cronName').value = '';
    $('cronSchedule').value = '0 9 * * *';
    $('cronPrompt').value = '';
  }
  $('cronModal').classList.add('open');
}

function closeCronModal() {
  $('cronModal').classList.remove('open');
  editingId = null;
}

async function saveCron() {
  const name = $('cronName').value.trim();
  const schedule = $('cronSchedule').value.trim();
  const prompt = $('cronPrompt').value.trim();
  if (!name || !schedule) { toast('请填写名称和定时表达式'); return; }
  try {
    if (editingId) {
      await api.updateCron(editingId, { name, schedule, prompt });
      toast('已更新');
    } else {
      await api.createCron({ name, schedule, prompt });
      toast('已创建');
    }
    closeCronModal();
    await load();
  } catch (e) { toast(e.message); }
}
