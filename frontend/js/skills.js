import { api } from './api.js';
import { toast, escapeHtml } from './store.js';

const $ = id => document.getElementById(id);

let skills = [];
let keyword = '';
let currentTab = 'builtin';
let selectedSkillId = null;
let editingId = null;

export async function initSkills() {
  if (!$('skillSearch')) { await new Promise(r => setTimeout(r, 200)); }
  if (!$('skillSearch')) { console.error('initSkills: DOM not ready'); return; }
  $('skillSearch').addEventListener('input', e => {
    keyword = e.target.value.toLowerCase();
    render();
  });
  $('addSkillBtn').onclick = () => openModal(null);
  $('closeSkillModal').onclick = closeModal;
  $('cancelSkillModal').onclick = closeModal;
  $('saveSkillModal').onclick = saveSkill;
  $('skillModal').addEventListener('click', e => {
    if (e.target.id === 'skillModal') closeModal();
  });
  $('closeRpanel').onclick = () => {
    document.body.classList.remove('rpanel-open');
  };

  document.querySelectorAll('#skillTabs .tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#skillTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      render();
    };
  });

  await load();
}

async function load() {
  try { skills = await api.listSkills(); } catch { skills = []; }
  render();
}

function getFilteredSkills() {
  let filtered = skills;
  if (currentTab === 'builtin') {
    filtered = skills.filter(s =>
      !s.tags?.includes('自定义') && !s.tags?.includes('custom') &&
      !s.tags?.includes('用户') && !s.tags?.includes('user')
    );
  } else if (currentTab === 'custom') {
    filtered = skills.filter(s => s.tags?.includes('自定义') || s.tags?.includes('custom'));
  } else {
    filtered = skills.filter(s => s.tags?.includes('用户') || s.tags?.includes('user'));
  }
  if (keyword) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(keyword) || s.desc.toLowerCase().includes(keyword)
    );
  }
  return filtered;
}

function render() {
  const grid = $('skillGrid');
  const filtered = getFilteredSkills();

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3);font-size:13px">
      暂无技能${keyword ? '，试试其他关键词' : ''}
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="skill-card ${selectedSkillId === s.id ? 'active' : ''}" data-id="${s.id}">
      <div class="ico">${s.icon || '✨'}</div>
      <div class="skill-card-body">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(s.desc || '')}</p>
        <div>${(s.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
      <div class="skill-card-actions">
        <div class="switch ${s.on ? 'on' : ''}" data-id="${s.id}"></div>
        <button class="item-action edit-skill-btn" data-id="${s.id}" title="编辑">✏️</button>
        <button class="item-action delete-skill-btn" data-id="${s.id}" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.switch').forEach(sw => {
    sw.onclick = async () => {
      const s = skills.find(x => x.id === sw.dataset.id);
      if (!s) return;
      s.on = !s.on;
      sw.classList.toggle('on', s.on);
      try { await api.updateSkill(s.id, { on: s.on }); } catch {}
      if (selectedSkillId === s.id) showSkillDetail(s);
    };
  });

  grid.querySelectorAll('.skill-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.switch') || e.target.closest('.edit-skill-btn') || e.target.closest('.delete-skill-btn')) return;
      const skill = skills.find(s => s.id === card.dataset.id);
      if (skill) {
        selectedSkillId = skill.id;
        render();
        showSkillDetail(skill);
      }
    };
  });

  grid.querySelectorAll('.edit-skill-btn').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); openModal(btn.dataset.id); };
  });
  grid.querySelectorAll('.delete-skill-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('确认删除此技能？')) return;
      try {
        await api.deleteSkill(btn.dataset.id);
        if (selectedSkillId === btn.dataset.id) {
          selectedSkillId = null;
          document.body.classList.remove('rpanel-open');
        }
        await load();
        toast('已删除');
      } catch (e) { toast(e.message); }
    };
  });
}

function showSkillDetail(skill) {
  const panel = $('rpanel');
  const title = $('rpanelTitle');
  const body = $('rpanelBody');

  title.textContent = '技能详情';
  const source = skill.tags?.includes('内置') || skill.tags?.includes('builtin') ? '内置' :
                 skill.tags?.includes('用户') || skill.tags?.includes('user') ? '用户制作' : '我添加的';
  const filePath = skill.file || skill.path || '';

  body.innerHTML = `
    <div class="skill-detail">
      <div class="skill-detail-header">
        <div class="skill-detail-icon">${skill.icon || '✨'}</div>
        <div>
          <div class="skill-detail-name">${escapeHtml(skill.name)}</div>
          <div style="font-size:12px;color:var(--text-3)">${escapeHtml(skill.desc || '')}</div>
        </div>
        <span class="skill-detail-source">${source}</span>
      </div>
      ${filePath ? `
      <div class="skill-detail-field">
        <label>文件路径</label>
        <div class="value mono">${escapeHtml(filePath)}</div>
      </div>` : ''}
      <div class="skill-detail-field">
        <label>标签</label>
        <div class="value">${(skill.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</div>
      </div>
      ${skill.prompt ? `
      <div class="skill-detail-field">
        <label>提示词</label>
        <div class="value" style="max-height:300px">${escapeHtml(skill.prompt)}</div>
      </div>` : ''}
      <div class="skill-detail-field">
        <label>状态</label>
        <div class="value">
          <span style="color:${skill.on ? 'var(--success)' : 'var(--text-3)'}">
            ${skill.on ? '● 已启用' : '○ 未启用'}
          </span>
        </div>
      </div>
    </div>
  `;

  document.body.classList.add('rpanel-open');
}

function openModal(id) {
  editingId = id;
  $('skillModalTitle').textContent = id ? '编辑技能' : '新增技能';
  if (id) {
    const s = skills.find(x => x.id === id);
    if (!s) return;
    $('skillIcon').value = s.icon || '';
    $('skillName').value = s.name || '';
    $('skillDesc').value = s.desc || '';
    $('skillTags').value = (s.tags || []).join(', ');
    $('skillPrompt').value = s.prompt || '';
  } else {
    $('skillIcon').value = '✨';
    $('skillName').value = '';
    $('skillDesc').value = '';
    $('skillTags').value = '';
    $('skillPrompt').value = '';
  }
  $('skillModal').classList.add('open');
}

function closeModal() {
  $('skillModal').classList.remove('open');
  editingId = null;
}

async function saveSkill() {
  const icon = $('skillIcon').value.trim() || '✨';
  const name = $('skillName').value.trim();
  const desc = $('skillDesc').value.trim();
  const tagsStr = $('skillTags').value.trim();
  const prompt = $('skillPrompt').value.trim();
  if (!name) { toast('请输入名称'); return; }
  const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : ['自定义'];
  try {
    if (editingId) {
      await api.updateSkill(editingId, { icon, name, desc, tags, prompt });
      toast('已更新');
    } else {
      await api.addSkill({ icon, name, desc, tags, prompt, on: false });
      toast('已添加');
    }
    closeModal();
    await load();
  } catch (e) { toast(e.message); }
}
